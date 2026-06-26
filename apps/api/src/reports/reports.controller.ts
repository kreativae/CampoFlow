import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService, ReportType } from './reports.service';
import { toCsv } from './exporters/csv.exporter';
import { toXlsx } from './exporters/xlsx.exporter';
import { toPdf } from './exporters/pdf.exporter';

const VALID_TYPES: ReportType[] = [
  'rebanho',
  'financeiro',
  'sanidade',
  'reproducao',
  'custos',
];
const VALID_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
type ReportFormat = (typeof VALID_FORMATS)[number];

const CONTENT_TYPES: Record<ReportFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

@Controller('farms/:farmId/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.MANAGER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(':type')
  async download(
    @Param('farmId') farmId: string,
    @Param('type') type: string,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    if (!VALID_TYPES.includes(type as ReportType)) {
      throw new BadRequestException(
        `Tipo de relatório inválido. Use: ${VALID_TYPES.join(', ')}`,
      );
    }
    const resolvedFormat = (format ?? 'csv') as ReportFormat;
    if (!VALID_FORMATS.includes(resolvedFormat)) {
      throw new BadRequestException(
        `Formato inválido. Use: ${VALID_FORMATS.join(', ')}`,
      );
    }

    const table = await this.reportsService.build(farmId, type as ReportType);

    const buffer =
      resolvedFormat === 'csv'
        ? toCsv(table)
        : resolvedFormat === 'xlsx'
          ? await toXlsx(table)
          : await toPdf(table);

    res.set({
      'Content-Type': CONTENT_TYPES[resolvedFormat],
      'Content-Disposition': `attachment; filename="${type}.${resolvedFormat}"`,
    });
    res.send(buffer);
  }
}
