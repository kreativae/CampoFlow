import { Injectable } from '@nestjs/common';
import type { Response } from 'express';

export interface StorageProvider {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  downloadToResponse(
    key: string,
    fileName: string,
    res: Response,
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

// Thin facade so DocumentsService/Controller never know which provider is active.
// Swapping providers (e.g. moving from local disk to Cloudflare R2) only touches
// storage.module.ts — nothing else in the app needs to change.
@Injectable()
export class StorageService {
  constructor(private readonly provider: StorageProvider) {}

  upload(key: string, buffer: Buffer, mimeType: string) {
    return this.provider.upload(key, buffer, mimeType);
  }

  downloadToResponse(key: string, fileName: string, res: Response) {
    return this.provider.downloadToResponse(key, fileName, res);
  }

  delete(key: string) {
    return this.provider.delete(key);
  }
}
