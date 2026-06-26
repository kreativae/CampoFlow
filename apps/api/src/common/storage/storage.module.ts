import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './local-storage.provider';
import { R2StorageProvider } from './r2-storage.provider';

function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_ENDPOINT,
  );
}

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      useFactory: () =>
        new StorageService(
          isR2Configured()
            ? new R2StorageProvider()
            : new LocalStorageProvider(),
        ),
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
