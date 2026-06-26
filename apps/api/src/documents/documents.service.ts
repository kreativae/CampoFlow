import { Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(
    farmId: string,
    uploadedById: string,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
  ) {
    return this.prisma.document.create({
      data: {
        farmId,
        category: dto.category,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath: file.path,
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
    await fs.unlink(document.storagePath).catch(() => undefined);
    return { success: true };
  }
}
