import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import dotenv from 'dotenv';
import busboy from 'busboy';
import { deployLambda, DeployPayload } from './deploy';
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

function parseDeployPayload(event: APIGatewayProxyEventV2): DeployPayload {
  const bodyString = decodeBody(event);
  if (!bodyString) {
    throw new Error('Request body is required.');
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(bodyString) as Record<string, unknown>;
  } catch {
    throw new Error('Request body must be valid JSON.');
  }

  if (typeof payload.code !== 'string' || payload.code.trim().length === 0) {
    throw new Error('`code` is required and must be a non-empty string.');
  }

  if (payload.template !== 'chatCompletion') {
    throw new Error('`template` must be exactly "chatCompletion" for MVP.');
  }

  if (typeof payload.openaiKey !== 'string' || payload.openaiKey.trim().length === 0) {
    throw new Error('`openaiKey` is required and must be a non-empty string.');
  }

  if (payload.s3ContextFiles !== undefined && !isStringArray(payload.s3ContextFiles)) {
    throw new Error('`s3ContextFiles` must be an array of S3 URL strings.');
  }

  const parsed: DeployPayload = {
    code: payload.code,
    template: 'chatCompletion',
    openaiKey: payload.openaiKey,
  };

  if (payload.s3ContextFiles !== undefined) {
    parsed.s3ContextFiles = payload.s3ContextFiles;
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
  return jsonResponse(200, { ok: true, service: 'ai-lambda-builder-backend' });
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
    const isClientError =
      message.includes('required') || message.includes('must') || message.includes('valid JSON');

    return isClientError ? badRequest(message) : internalError(message);
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
