import { randomUUID } from 'crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import dotenv from 'dotenv';
import {
  AddPermissionCommand,
  CreateFunctionCommand,
  CreateFunctionUrlConfigCommand,
  DeleteFunctionCommand,
  GetFunctionCommand,
  LambdaClient,
} from '@aws-sdk/client-lambda';

dotenv.config();

const region = process.env.AWS_REGION || 'eu-central-1';
const roleArn = process.env.MVP_LAMBDA_ROLE_ARN;

if (!roleArn) {
  throw new Error('Missing MVP_LAMBDA_ROLE_ARN in environment.');
}

const lambdaClient = new LambdaClient({ region });

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

async function waitForFunctionActive(functionName: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await lambdaClient.send(new GetFunctionCommand({ FunctionName: functionName }));
    const state = res.Configuration?.State;
    if (state === 'Active') {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error('Timed out waiting for Lambda function to become Active.');
}

async function main(): Promise<void> {
  const functionName = `ai-lambda-spike-${randomUUID().slice(0, 8)}`;
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'lambda-url-spike-'));
  const codeDir = path.join(tempRoot, 'code');
  const zipPath = path.join(tempRoot, 'bundle.zip');
  let functionCreated = false;
  await mkdir(codeDir, { recursive: true });

  await writeFile(
    path.join(codeDir, 'handler.js'),
    `exports.handler = async () => ({\n` +
      `  statusCode: 200,\n` +
      `  headers: { 'content-type': 'application/json' },\n` +
      `  body: JSON.stringify({ ok: true, source: 'function-url-spike' })\n` +
      `});\n`,
    'utf8',
  );

  await zipDirectory(codeDir, zipPath);
  const zipBytes = await readFile(zipPath);

  console.log(`Creating Lambda function ${functionName} in ${region}...`);

  try {
    await lambdaClient.send(
      new CreateFunctionCommand({
        FunctionName: functionName,
        Runtime: 'nodejs22.x',
        Role: roleArn,
        Handler: 'handler.handler',
        Timeout: 30,
        Code: { ZipFile: zipBytes },
        Publish: true,
      }),
    );
    functionCreated = true;

    await waitForFunctionActive(functionName);

    const urlConfig = await lambdaClient.send(
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

    const functionUrl = urlConfig.FunctionUrl;
    if (!functionUrl) {
      throw new Error('Function URL was not returned by AWS.');
    }

    await lambdaClient.send(
      new AddPermissionCommand({
        Action: 'lambda:InvokeFunctionUrl',
        FunctionName: functionName,
        Principal: '*',
        FunctionUrlAuthType: 'NONE',
        StatementId: `url-public-${randomUUID().slice(0, 8)}`,
      }),
    );

    await lambdaClient.send(
      new AddPermissionCommand({
        Action: 'lambda:InvokeFunction',
        FunctionName: functionName,
        Principal: '*',
        InvokedViaFunctionUrl: true,
        StatementId: `invoke-public-${randomUUID().slice(0, 8)}`,
      }),
    );

    console.log(`Function URL created: ${functionUrl}`);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ping: true }),
    });

    const body = await response.text();
    console.log(`Invocation status: ${response.status}`);
    console.log(`Invocation body: ${body}`);
    console.log('Spike completed successfully.');
  } finally {
    if (functionCreated) {
      console.log('Cleaning up spike Lambda function...');
      await lambdaClient.send(new DeleteFunctionCommand({ FunctionName: functionName }));
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch(async (error) => {
  console.error('Spike failed:', error);
  process.exitCode = 1;
});
