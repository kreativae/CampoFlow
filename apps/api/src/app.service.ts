import { Injectable } from '@nestjs/common';

export interface ApiInfo {
  name: string;
  version: string;
  status: string;
  docs: string;
}

@Injectable()
export class AppService {
  getInfo(): ApiInfo {
    return {
      name: 'CampoFlow API',
      version: process.env.npm_package_version ?? '0.0.1',
      status: 'ok',
      docs: '/docs',
    };
  }
}
