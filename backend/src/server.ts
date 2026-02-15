import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { deployLambda, DeployPayload } from './deploy';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const AWS_REGION = process.env.AWS_REGION || 'eu-central-1';

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ai-lambda-builder-backend' });
});

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseDeployPayload(body: unknown): DeployPayload {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object.');
  }

  const payload = body as Record<string, unknown>;

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

app.post('/deploy', async (req, res) => {
  try {
    const payload = parseDeployPayload(req.body);
    const deployOptions = process.env.MVP_LAMBDA_ROLE_ARN
      ? { region: AWS_REGION, roleArnOverride: process.env.MVP_LAMBDA_ROLE_ARN }
      : { region: AWS_REGION };
    const deployResult = await deployLambda(payload, deployOptions);

    res.status(200).json(deployResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown deployment error.';
    const statusCode = message.includes('`') || message.includes('must') || message.includes('required') ? 400 : 500;

    res.status(statusCode).json({
      error: message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
