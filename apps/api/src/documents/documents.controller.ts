import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FarmAccessGuard } from '../auth/guards/farm-access.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { StorageService } from '../common/storage/storage.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Controller('fazendas/:farmId/documentos')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  @UseInterceptors(
    FileInterceptor('file', {
      // Buffered in memory rather than written to disk: StorageService decides where
      // the bytes actually end up (local disk in dev, Cloudflare R2 in production).
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  upload(
    @Param('farmId') farmId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.create(farmId, user.id, file, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(@Param('farmId') farmId: string) {
    return this.documentsService.findAll(farmId);
  }

  @Get(':documentId/baixar')
  @UseGuards(FarmAccessGuard)
  async download(
    @Param('farmId') farmId: string,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const document = await this.documentsService.findOne(farmId, documentId);
    await this.storageService.downloadToResponse(
      document.storagePath,
      document.fileName,
      res,
    );
  }

  @Delete(':documentId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(
    @Param('farmId') farmId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.remove(farmId, documentId);
  }
}
