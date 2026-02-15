import { randomUUID } from 'crypto';
import {
  BucketLocationConstraint,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const DEFAULT_BUCKET = 'ai-lambda-mvp-873550638583-euc1';

export interface UploadedFileInput {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
}

export interface UploadResult {
  s3Urls: string[];
}

interface UploadOptions {
  region: string;
  bucketName?: string;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function ensureBucket(s3Client: S3Client, bucketName: string, region: string): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return;
  } catch {
    // continue and attempt create
  }

  await s3Client.send(
    new CreateBucketCommand({
      Bucket: bucketName,
      ...(region === 'us-east-1'
        ? {}
        : { CreateBucketConfiguration: { LocationConstraint: region as BucketLocationConstraint } }),
    }),
  );
}

export async function uploadContextFiles(files: UploadedFileInput[], options: UploadOptions): Promise<UploadResult> {
  const bucketName = options.bucketName || process.env.S3_CONTEXT_BUCKET || DEFAULT_BUCKET;
  const s3Client = new S3Client({ region: options.region });

  await ensureBucket(s3Client, bucketName, options.region);

  const folderId = `ai-lambda-context-${randomUUID().slice(0, 8)}`;
  const s3Urls: string[] = [];

  for (const file of files) {
    const key = `${folderId}/${sanitizeFileName(file.originalname)}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || 'text/plain',
      }),
    );
    s3Urls.push(`s3://${bucketName}/${key}`);
  }

  return { s3Urls };
}
