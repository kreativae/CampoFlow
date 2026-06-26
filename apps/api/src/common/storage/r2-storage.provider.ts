import { Injectable, NotFoundException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';
import type { Response } from 'express';
import type { StorageProvider } from './storage.service';

// Cloudflare R2 exposes an S3-compatible API, so the same @aws-sdk/client-s3 client
// used for AWS S3 works here unmodified — just point `endpoint` at the R2 account
// endpoint instead of AWS. Swapping to real AWS S3 later (or Backblaze B2, which is
// also S3-compatible) would only mean changing the env vars, not this code.
@Injectable()
export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.R2_BUCKET!;
    this.client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
  }

  async downloadToResponse(
    key: string,
    fileName: string,
    res: Response,
  ): Promise<void> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body) {
      throw new NotFoundException('Arquivo não encontrado no storage');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    if (result.ContentType) {
      res.setHeader('Content-Type', result.ContentType);
    }
    (result.Body as Readable).pipe(res);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
