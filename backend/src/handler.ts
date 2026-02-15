import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import dotenv from 'dotenv';
import busboy from 'busboy';
import path from 'path';
import { ClientInputError, deployLambda, DeployPayload } from './deploy';
import { UploadedFileInput, uploadContextFiles } from './s3Upload';

dotenv.config();

const DEPLOY_TARGET_REGION = process.env.DEPLOY_TARGET_REGION || process.env.AWS_REGION || 'eu-central-1';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function getPath(event: APIGatewayProxyEventV2): string {
  return event.rawPath || '/';
}

function decodeBody(event: APIGatewayProxyEventV2): string {
  if (!event.body) {
    return '';
  }

  return event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

const ALLOWED_SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs', '.mts', '.cts']);

function normalizeSourcePath(rawPath: string, fieldName: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    throw new ClientInputError(`\`${fieldName}\` must be a non-empty string.`);
  }

  const normalizedSlashes = trimmed.replace(/\\/g, '/').replace(/^\.\/+/, '');

  if (normalizedSlashes.startsWith('/') || /^[a-zA-Z]:\//.test(normalizedSlashes)) {
    throw new ClientInputError(`\`${fieldName}\` must be a relative file path.`);
  }

  const normalized = path.posix.normalize(normalizedSlashes);
  if (!normalized || normalized === '.' || normalized.startsWith('../')) {
    throw new ClientInputError(`\`${fieldName}\` contains an invalid or unsafe path.`);
  }

  const extension = path.posix.extname(normalized).toLowerCase();
  if (!ALLOWED_SOURCE_EXTENSIONS.has(extension)) {
    throw new ClientInputError(
      `\`${fieldName}\` has unsupported extension "${extension || '(none)'}". Allowed: ${Array.from(ALLOWED_SOURCE_EXTENSIONS).join(', ')}.`,
    );
  }

  return normalized;
}

function parseDeployPayload(event: APIGatewayProxyEventV2): DeployPayload {
  const bodyString = decodeBody(event);
  if (!bodyString) {
    throw new ClientInputError('Request body is required.');
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(bodyString) as Record<string, unknown>;
  } catch {
    throw new ClientInputError('Request body must be valid JSON.');
  }

  if (payload.code !== undefined) {
    throw new ClientInputError(
      'v1 `code` payload is no longer supported. Send v2 payload with `files[]` and `entryFile`.',
    );
  }

  if (payload.template !== 'chatCompletion') {
    throw new ClientInputError('`template` must be exactly "chatCompletion" for MVP v2.');
  }

  if (typeof payload.openaiKey !== 'string' || payload.openaiKey.trim().length === 0) {
    throw new ClientInputError('`openaiKey` is required and must be a non-empty string.');
  }

  if (payload.systemPrompt !== undefined && typeof payload.systemPrompt !== 'string') {
    throw new ClientInputError('`systemPrompt` must be a string when provided.');
  }

  if (!Array.isArray(payload.files) || payload.files.length === 0) {
    throw new ClientInputError('`files` is required and must be a non-empty array.');
  }

  const seenPaths = new Set<string>();
  const parsedFiles = payload.files.map((rawFile, index) => {
    const fileObject = asObject(rawFile);
    if (!fileObject) {
      throw new ClientInputError(`\`files[${index}]\` must be an object with \`path\` and \`content\`.`);
    }

    if (typeof fileObject.path !== 'string') {
      throw new ClientInputError(`\`files[${index}].path\` is required and must be a string.`);
    }

    if (typeof fileObject.content !== 'string') {
      throw new ClientInputError(`\`files[${index}].content\` is required and must be a string.`);
    }

    if (fileObject.content.trim().length === 0) {
      throw new ClientInputError(`\`files[${index}].content\` cannot be empty.`);
    }

    const normalizedPath = normalizeSourcePath(fileObject.path, `files[${index}].path`);
    const dedupeKey = normalizedPath.toLowerCase();
    if (seenPaths.has(dedupeKey)) {
      throw new ClientInputError(`Duplicate file path detected: \`${normalizedPath}\`.`);
    }
    seenPaths.add(dedupeKey);

    return {
      path: normalizedPath,
      content: fileObject.content,
    };
  });

  if (typeof payload.entryFile !== 'string') {
    throw new ClientInputError('`entryFile` is required and must be a string.');
  }

  const normalizedEntryFile = normalizeSourcePath(payload.entryFile, 'entryFile');
  if (!parsedFiles.some((file) => file.path === normalizedEntryFile)) {
    throw new ClientInputError(`\`entryFile\` was not found in files: \`${normalizedEntryFile}\`.`);
  }

  if (payload.s3ContextFiles !== undefined && !isStringArray(payload.s3ContextFiles)) {
    throw new ClientInputError('`s3ContextFiles` must be an array of S3 URL strings.');
  }

  if (payload.s3ContextFiles?.some((value) => value.trim().length === 0)) {
    throw new ClientInputError('`s3ContextFiles` cannot include empty values.');
  }

  const parsed: DeployPayload = {
    template: 'chatCompletion',
    openaiKey: payload.openaiKey.trim(),
    files: parsedFiles,
    entryFile: normalizedEntryFile,
  };

  if (payload.systemPrompt !== undefined) {
    parsed.systemPrompt = payload.systemPrompt;
  }

  if (payload.s3ContextFiles !== undefined) {
    parsed.s3ContextFiles = payload.s3ContextFiles.map((value) => value.trim());
  }

  return parsed;
}

function badRequest(message: string): APIGatewayProxyResultV2 {
  return jsonResponse(400, { error: message });
}

function internalError(message: string): APIGatewayProxyResultV2 {
  return jsonResponse(500, { error: message });
}

async function handleHealth(): Promise<APIGatewayProxyResultV2> {
  return jsonResponse(200, { ok: true, service: 'ai-lambda-forger-backend' });
}

async function handleDeploy(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const payload = parseDeployPayload(event);
    const deployOptions = process.env.MVP_LAMBDA_ROLE_ARN
      ? { region: DEPLOY_TARGET_REGION, roleArnOverride: process.env.MVP_LAMBDA_ROLE_ARN }
      : { region: DEPLOY_TARGET_REGION };

    const result = await deployLambda(payload, deployOptions);
    return jsonResponse(200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown deployment error.';
    return error instanceof ClientInputError ? badRequest(message) : internalError(message);
  }
}

async function handleUpload(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const files = await parseMultipartFiles(event);

    if (files.length === 0) {
      return badRequest('No files uploaded. Use multipart/form-data with field `files`.');
    }

    const result = await uploadContextFiles(
      files,
      {
        region: DEPLOY_TARGET_REGION,
      },
    );

    return jsonResponse(200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upload error.';
    return internalError(message);
  }
}

function getHeaderValue(headers: APIGatewayProxyEventV2['headers'], name: string): string | undefined {
  const direct = headers?.[name];
  if (direct) {
    return direct;
  }

  const lowerName = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === lowerName);
  return entry?.[1];
}

function decodeBodyBuffer(event: APIGatewayProxyEventV2): Buffer {
  if (!event.body) {
    return Buffer.alloc(0);
  }

  return event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body, 'utf8');
}

async function parseMultipartFiles(event: APIGatewayProxyEventV2): Promise<UploadedFileInput[]> {
  const contentType = getHeaderValue(event.headers, 'content-type');
  if (!contentType || !contentType.toLowerCase().includes('multipart/form-data')) {
    throw new Error('Content-Type must be multipart/form-data.');
  }

  const body = decodeBodyBuffer(event);
  if (body.length === 0) {
    return [];
  }

  return await new Promise<UploadedFileInput[]>((resolve, reject) => {
    const parsedFiles: UploadedFileInput[] = [];
    const parser = busboy({
      headers: {
        'content-type': contentType,
      },
    });

    parser.on('file', (_, stream, info) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => {
        parsedFiles.push({
          originalname: info.filename || 'upload.txt',
          buffer: Buffer.concat(chunks),
          mimetype: info.mimeType || 'application/octet-stream',
        });
      });
    });

    parser.on('error', reject);
    parser.on('finish', () => resolve(parsedFiles));
    parser.end(body);
  });
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method.toUpperCase();
  const path = getPath(event);

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
    };
  }

  if (method === 'GET' && path === '/health') {
    return handleHealth();
  }

  if (method === 'POST' && path === '/deploy') {
    return handleDeploy(event);
  }

  if (method === 'POST' && path === '/upload') {
    return handleUpload(event);
  }

  return jsonResponse(404, { error: `Route not found: ${method} ${path}` });
}
