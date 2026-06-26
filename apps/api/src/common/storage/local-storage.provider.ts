import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import type { Response } from 'express';
import type { StorageProvider } from './storage.service';

const UPLOADS_ROOT = join(process.cwd(), 'uploads');

// Default storage when no Cloudflare R2 (or other S3-compatible) credentials are
// configured — used for local development. Not suitable for production behind
// multiple instances/ephemeral filesystems, which is exactly why R2StorageProvider
// exists as a drop-in replacement (see storage.module.ts).
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private resolvePath(key: string) {
    return join(UPLOADS_ROOT, key);
  }

  async upload(key: string, buffer: Buffer): Promise<void> {
    const path = this.resolvePath(key);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, buffer);
  }

  downloadToResponse(
    key: string,
    fileName: string,
    res: Response,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      res.download(this.resolvePath(key), fileName, (err) =>
        err ? reject(err) : resolve(),
      );
    });
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(this.resolvePath(key)).catch(() => undefined);
  }
}
