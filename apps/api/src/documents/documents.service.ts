import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(
    farmId: string,
    uploadedById: string,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
  ) {
    // storagePath is an opaque key, not a filesystem path: it's resolved by whichever
    // StorageProvider is active (local disk in dev, Cloudflare R2 in production).
    const storagePath = `${farmId}/${randomUUID()}${extname(file.originalname)}`;
    await this.storageService.upload(storagePath, file.buffer, file.mimetype);

    return this.prisma.document.create({
      data: {
        farmId,
        category: dto.category,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedById,
        notes: dto.notes,
      },
    });
  }

  findAll(farmId: string) {
    return this.prisma.document.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(farmId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document || document.farmId !== farmId) {
      throw new NotFoundException('Documento não encontrado');
    }
    return document;
  }

  async remove(farmId: string, documentId: string) {
    const document = await this.findOne(farmId, documentId);
    await this.prisma.document.delete({ where: { id: documentId } });
    await this.storageService.delete(document.storagePath);
    return { success: true };
  }
}
