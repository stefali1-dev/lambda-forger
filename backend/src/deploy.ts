import { randomUUID } from 'crypto';
import { createWriteStream } from 'fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import archiver from 'archiver';
import { build } from 'esbuild';
import {
  AddPermissionCommand,
  CreateFunctionCommand,
  CreateFunctionUrlConfigCommand,
  LambdaClient,
} from '@aws-sdk/client-lambda';
import {
  AttachRolePolicyCommand,
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  NoSuchEntityException,
} from '@aws-sdk/client-iam';

const execFileAsync = promisify(execFile);

const ASSUME_ROLE_POLICY = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { Service: 'lambda.amazonaws.com' },
      Action: 'sts:AssumeRole',
    },
  ],
});

const BASIC_EXEC_POLICY = 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole';
const S3_READONLY_POLICY = 'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess';
const DEFAULT_EXEC_ROLE_NAME = 'ai-lambda-forger-mvp-role';

const HANDLER_EXPORT_REGEX =
  /\bexport\s+(async\s+)?function\s+handler\b|\bexport\s+const\s+handler\b|\bexport\s*\{\s*handler(?:\s+as\s+\w+)?\s*\}/;
const COMMON_JS_HANDLER_REGEX = /\bmodule\.exports\b|\bexports\.handler\b/;

export interface DeploySourceFile {
  path: string;
  content: string;
}

export class ClientInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientInputError';
  }
}

export interface DeployPayload {
  files: DeploySourceFile[];
  entryFile: string;
  template: 'chatCompletion';
  openaiKey: string;
  systemPrompt?: string;
  s3ContextFiles?: string[];
}

export interface DeployResult {
  functionName: string;
  functionUrl: string;
  curlExample: string;
}

interface DeployOptions {
  region: string;
  roleArnOverride?: string;
}

function ensureEntryExportsHandler(entryCode: string, entryFile: string): void {
  const trimmed = entryCode.trim();
  if (!trimmed) {
    throw new ClientInputError(`Entry file \`${entryFile}\` cannot be empty.`);
  }

  if (HANDLER_EXPORT_REGEX.test(trimmed)) {
    return;
  }

  if (COMMON_JS_HANDLER_REGEX.test(trimmed)) {
    throw new ClientInputError(
      `Entry file \`${entryFile}\` must export \`handler\` using ESM syntax (for example: \`export const handler = async (event) => { ... }\`).`,
    );
  }

  throw new ClientInputError(`Entry file \`${entryFile}\` must export a \`handler\` function.`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function zipDirectory(sourceDir: string, outPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function ensureExecutionRole(iamClient: IAMClient): Promise<string> {
  const roleName = process.env.MVP_LAMBDA_ROLE_NAME || DEFAULT_EXEC_ROLE_NAME;

  try {
    const existing = await iamClient.send(new GetRoleCommand({ RoleName: roleName }));
    if (existing.Role?.Arn) {
      return existing.Role.Arn;
    }
    throw new Error(`Role ${roleName} exists but ARN was not returned.`);
  } catch (error) {
    if (!(error instanceof NoSuchEntityException)) {
      throw error;
    }
  }

  const created = await iamClient.send(
    new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: ASSUME_ROLE_POLICY,
      Description: 'MVP role for AI Lambda Forger deployed functions',
    }),
  );

  await Promise.all([
    iamClient.send(new AttachRolePolicyCommand({ RoleName: roleName, PolicyArn: BASIC_EXEC_POLICY })),
    iamClient.send(new AttachRolePolicyCommand({ RoleName: roleName, PolicyArn: S3_READONLY_POLICY })),
  ]);

  // IAM can take a few seconds to propagate role + policy attachments.
  await sleep(12_000);

  if (!created.Role?.Arn) {
    throw new Error(`Role ${roleName} was created but ARN was not returned.`);
  }

  return created.Role.Arn;
}

function resolveWorkspacePath(workspaceRoot: string, relativePath: string): string {
  const candidate = path.resolve(workspaceRoot, relativePath);
  const relative = path.relative(workspaceRoot, candidate);

  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return candidate;
  }

  throw new ClientInputError(`Unsafe file path detected while packaging: ${relativePath}`);
}

function containsOpenAiImport(files: DeploySourceFile[]): boolean {
  return files.some((file) =>
    /from\s+['"]openai['"]|require\(\s*['"]openai['"]\s*\)|import\s*\(\s*['"]openai['"]\s*\)/.test(file.content),
  );
}

async function buildDeploymentBundle(payload: DeployPayload): Promise<Buffer> {
  const entryFile = payload.files.find((file) => file.path === payload.entryFile);
  if (!entryFile) {
    throw new ClientInputError(`Entry file \`${payload.entryFile}\` was not found in \`files\`.`);
  }

  ensureEntryExportsHandler(entryFile.content, payload.entryFile);

  const tempRoot = await mkdtemp(path.join(tmpdir(), 'lambda-deploy-'));
  const zipPath = path.join(tmpdir(), `lambda-deploy-bundle-${randomUUID()}.zip`);
  const needsOpenAiDependency = containsOpenAiImport(payload.files);

  try {
    for (const file of payload.files) {
      const outputFile = resolveWorkspacePath(tempRoot, file.path);
      await mkdir(path.dirname(outputFile), { recursive: true });
      await writeFile(outputFile, file.content, 'utf8');
    }

    const bundledHandlerPath = path.join(tempRoot, 'handler.mjs');
    const entryPath = resolveWorkspacePath(tempRoot, payload.entryFile);

    try {
      await build({
        entryPoints: [entryPath],
        outfile: bundledHandlerPath,
        bundle: true,
        format: 'esm',
        platform: 'node',
        target: 'node22',
        packages: 'external',
        sourcemap: false,
        logLevel: 'silent',
      });
    } catch (error) {
      const details =
        typeof error === 'object' &&
        error !== null &&
        'errors' in error &&
        Array.isArray((error as { errors?: Array<{ text?: string }> }).errors)
          ? (error as { errors: Array<{ text?: string }> }).errors.find((item) => typeof item.text === 'string')?.text
          : undefined;

      throw new ClientInputError(
        `Failed to build entry file \`${payload.entryFile}\`${details ? `: ${details}` : '. Check file imports and syntax.'}`,
      );
    }

    await writeFile(
      path.join(tempRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'ai-lambda-runtime',
          version: '1.0.0',
          private: true,
          type: 'module',
          ...(needsOpenAiDependency ? { dependencies: { openai: '^5.22.0' } } : {}),
        },
        null,
        2,
      ),
      'utf8',
    );

    if (needsOpenAiDependency) {
      try {
        await execFileAsync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], {
          cwd: tempRoot,
          env: process.env,
        });
      } catch (error) {
        throw new Error(
          'Failed to install runtime dependency `openai` while packaging Lambda code. Verify outbound network/NPM registry access from the backend runtime or remove `openai` imports from the function code.',
        );
      }
    }

    await zipDirectory(tempRoot, zipPath);
    return await readFile(zipPath);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(zipPath, { force: true });
  }
}

export async function deployLambda(payload: DeployPayload, options: DeployOptions): Promise<DeployResult> {
  const lambdaClient = new LambdaClient({ region: options.region });
  const iamClient = new IAMClient({ region: options.region });

  const functionName = `ai-lambda-user-${randomUUID().slice(0, 8)}`;
  const zipBytes = await buildDeploymentBundle(payload);
  const roleArn = options.roleArnOverride || (await ensureExecutionRole(iamClient));

  await lambdaClient.send(
    new CreateFunctionCommand({
      FunctionName: functionName,
      Runtime: 'nodejs22.x',
      Role: roleArn,
      Handler: 'handler.handler',
      Timeout: 30,
      MemorySize: 512,
      Code: { ZipFile: zipBytes },
      Environment: {
        Variables: {
          OPENAI_API_KEY: payload.openaiKey,
          SYSTEM_PROMPT: payload.systemPrompt || '',
          S3_CONTEXT_FILES: (payload.s3ContextFiles || []).join(','),
        },
      },
      Publish: true,
    }),
  );

  const functionUrlResponse = await lambdaClient.send(
    new CreateFunctionUrlConfigCommand({
      FunctionName: functionName,
      AuthType: 'NONE',
      Cors: {
        AllowOrigins: ['*'],
        AllowMethods: ['GET', 'POST'],
        AllowHeaders: ['Content-Type'],
      },
    }),
  );

  if (!functionUrlResponse.FunctionUrl) {
    throw new Error('AWS did not return a Lambda function URL.');
  }

  await lambdaClient.send(
    new AddPermissionCommand({
      Action: 'lambda:InvokeFunctionUrl',
      FunctionName: functionName,
      Principal: '*',
      FunctionUrlAuthType: 'NONE',
      StatementId: `invoke-url-${randomUUID().slice(0, 8)}`,
    }),
  );

  await lambdaClient.send(
    new AddPermissionCommand({
      Action: 'lambda:InvokeFunction',
      FunctionName: functionName,
      Principal: '*',
      InvokedViaFunctionUrl: true,
      StatementId: `invoke-fn-${randomUUID().slice(0, 8)}`,
    }),
  );

  return {
    functionName,
    functionUrl: functionUrlResponse.FunctionUrl,
    curlExample: `curl -X POST ${functionUrlResponse.FunctionUrl} -H 'Content-Type: application/json' -d '{"message":"Hello"}'`,
  };
}
