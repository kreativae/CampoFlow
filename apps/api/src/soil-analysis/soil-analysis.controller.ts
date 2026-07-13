import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FarmAccessGuard } from '../auth/guards/farm-access.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { SoilAnalysisService } from './soil-analysis.service';
import { StorageService } from '../common/storage/storage.service';
import { CreateSoilAnalysisDto } from './dto/create-soil-analysis.dto';
import { UpdateSoilAnalysisDto } from './dto/update-soil-analysis.dto';

@Controller('fazendas/:farmId/analises-solo')
@UseGuards(JwtAuthGuard)
export class SoilAnalysisController {
  constructor(
    private readonly soilAnalysisService: SoilAnalysisService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE, Role.VETERINARIAN)
  @UseInterceptors(FileInterceptor('documento', { storage: memoryStorage() }))
  create(
    @Param('farmId') farmId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSoilAnalysisDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.soilAnalysisService.create(farmId, user.id, dto, file);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(
    @Param('farmId') farmId: string,
    @Query('mapFeatureId') mapFeatureId?: string,
  ) {
    return this.soilAnalysisService.findAll(farmId, mapFeatureId);
  }

  @Get('historico')
  @UseGuards(FarmAccessGuard)
  history(
    @Param('farmId') farmId: string,
    @Query('mapFeatureId') mapFeatureId: string,
  ) {
    return this.soilAnalysisService.history(farmId, mapFeatureId);
  }

  @Get(':id')
  @UseGuards(FarmAccessGuard)
  findOne(@Param('farmId') farmId: string, @Param('id') id: string) {
    return this.soilAnalysisService.findOne(farmId, id);
  }

  @Get(':id/recomendacao')
  @UseGuards(FarmAccessGuard)
  async recommendation(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Query('metaSaturacao') metaSaturacao?: string,
  ) {
    const analysis = await this.soilAnalysisService.findOne(farmId, id);
    return this.soilAnalysisService.recommendation(
      analysis,
      metaSaturacao ? Number(metaSaturacao) : undefined,
    );
  }

  @Get(':id/baixar')
  @UseGuards(FarmAccessGuard)
  async download(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { path, fileName } = await this.soilAnalysisService.downloadDocument(
      farmId,
      id,
    );
    await this.storageService.downloadToResponse(path, fileName, res);
  }

  // --- Photos ---

  @Post(':id/fotos')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE, Role.VETERINARIAN)
  @UseInterceptors(FilesInterceptor('fotos', 10, { storage: memoryStorage() }))
  async uploadPhotos(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Body() body: { metadata?: string },
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    let metadata: {
      takenAt?: string;
      latitude?: number;
      longitude?: number;
      caption?: string;
    }[] = [];
    if (body.metadata) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata = JSON.parse(body.metadata);
      } catch {
        // ignore parse errors — metadata is optional
      }
    }
    return this.soilAnalysisService.uploadPhotos(farmId, id, files, metadata);
  }

  @Get(':id/fotos')
  @UseGuards(FarmAccessGuard)
  listPhotos(@Param('farmId') farmId: string, @Param('id') id: string) {
    return this.soilAnalysisService.listPhotos(farmId, id);
  }

  @Get(':id/fotos/:photoId/baixar')
  @UseGuards(FarmAccessGuard)
  async downloadPhoto(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Res() res: Response,
  ) {
    const photo = await this.soilAnalysisService.getPhoto(farmId, id, photoId);
    await this.storageService.downloadToResponse(
      photo.storagePath,
      photo.fileName,
      res,
    );
  }

  @Delete(':id/fotos/:photoId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  async deletePhoto(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    return this.soilAnalysisService.deletePhoto(farmId, id, photoId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE, Role.VETERINARIAN)
  update(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSoilAnalysisDto,
  ) {
    return this.soilAnalysisService.update(farmId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(@Param('farmId') farmId: string, @Param('id') id: string) {
    return this.soilAnalysisService.remove(farmId, id);
  }
}
