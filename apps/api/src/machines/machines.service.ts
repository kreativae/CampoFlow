import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMachineDto } from './dto/create-machine.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { CreateFuelRecordDto } from './dto/create-fuel-record.dto';
import { UpdateFuelRecordDto } from './dto/update-fuel-record.dto';

@Injectable()
export class MachinesService {
  constructor(private readonly prisma: PrismaService) {}

  create(farmId: string, dto: CreateMachineDto) {
    return this.prisma.machine.create({ data: { ...dto, farmId } });
  }

  findAll(farmId: string) {
    return this.prisma.machine.findMany({
      where: { farmId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(farmId: string, machineId: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        maintenances: { orderBy: { performedAt: 'desc' } },
        fuelRecords: { orderBy: { recordedAt: 'desc' } },
      },
    });
    if (!machine || machine.farmId !== farmId) {
      throw new NotFoundException('Máquina não encontrada');
    }
    return machine;
  }

  async update(farmId: string, machineId: string, dto: UpdateMachineDto) {
    await this.findOne(farmId, machineId);
    return this.prisma.machine.update({ where: { id: machineId }, data: dto });
  }

  async remove(farmId: string, machineId: string) {
    await this.findOne(farmId, machineId);
    await this.prisma.machine.delete({ where: { id: machineId } });
    return { success: true };
  }

  // Records a maintenance and advances the hour meter if a higher reading was reported.
  async addMaintenance(
    farmId: string,
    machineId: string,
    dto: CreateMaintenanceDto,
  ) {
    const machine = await this.findOne(farmId, machineId);

    const [, maintenance] = await this.prisma.$transaction([
      this.prisma.machine.update({
        where: { id: machineId },
        data: {
          currentHourMeter:
            dto.hourMeterAt && dto.hourMeterAt > machine.currentHourMeter
              ? dto.hourMeterAt
              : machine.currentHourMeter,
        },
      }),
      this.prisma.machineMaintenance.create({
        data: {
          machineId,
          description: dto.description,
          cost: dto.cost,
          hourMeterAt: dto.hourMeterAt,
          performedAt: dto.performedAt ? new Date(dto.performedAt) : undefined,
          notes: dto.notes,
        },
      }),
    ]);

    return maintenance;
  }

  // Records a fuel entry and advances the hour meter if a higher reading was reported.
  async addFuelRecord(
    farmId: string,
    machineId: string,
    dto: CreateFuelRecordDto,
  ) {
    const machine = await this.findOne(farmId, machineId);

    const [, fuelRecord] = await this.prisma.$transaction([
      this.prisma.machine.update({
        where: { id: machineId },
        data: {
          currentHourMeter:
            dto.hourMeterAt && dto.hourMeterAt > machine.currentHourMeter
              ? dto.hourMeterAt
              : machine.currentHourMeter,
        },
      }),
      this.prisma.machineFuelRecord.create({
        data: {
          machineId,
          liters: dto.liters,
          cost: dto.cost,
          hourMeterAt: dto.hourMeterAt,
          recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : undefined,
          notes: dto.notes,
        },
      }),
    ]);

    return fuelRecord;
  }

  // currentHourMeter always tracks the highest hourMeterAt across every
  // maintenance/fuel record — recomputed here because editing/deleting a record
  // can change which one holds that high-water mark without it being the one
  // just touched.
  private async recomputeHourMeter(machineId: string) {
    const [maintenances, fuelRecords] = await Promise.all([
      this.prisma.machineMaintenance.findMany({
        where: { machineId, hourMeterAt: { not: null } },
        select: { hourMeterAt: true },
      }),
      this.prisma.machineFuelRecord.findMany({
        where: { machineId, hourMeterAt: { not: null } },
        select: { hourMeterAt: true },
      }),
    ]);
    const readings = [...maintenances, ...fuelRecords]
      .map((r) => r.hourMeterAt ?? 0)
      .filter((v) => v > 0);
    const max = readings.length > 0 ? Math.max(...readings) : 0;
    await this.prisma.machine.update({
      where: { id: machineId },
      data: { currentHourMeter: max },
    });
  }

  private async assertMaintenanceBelongsToMachine(
    machineId: string,
    maintenanceId: string,
  ) {
    const record = await this.prisma.machineMaintenance.findUnique({
      where: { id: maintenanceId },
    });
    if (!record || record.machineId !== machineId) {
      throw new NotFoundException('Manutenção não encontrada');
    }
    return record;
  }

  async updateMaintenance(
    farmId: string,
    machineId: string,
    maintenanceId: string,
    dto: UpdateMaintenanceDto,
  ) {
    await this.findOne(farmId, machineId);
    await this.assertMaintenanceBelongsToMachine(machineId, maintenanceId);

    const record = await this.prisma.machineMaintenance.update({
      where: { id: maintenanceId },
      data: {
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.cost !== undefined ? { cost: dto.cost } : {}),
        ...(dto.hourMeterAt !== undefined
          ? { hourMeterAt: dto.hourMeterAt }
          : {}),
        ...(dto.performedAt !== undefined
          ? { performedAt: new Date(dto.performedAt) }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    await this.recomputeHourMeter(machineId);
    return record;
  }

  async removeMaintenance(
    farmId: string,
    machineId: string,
    maintenanceId: string,
  ) {
    await this.findOne(farmId, machineId);
    await this.assertMaintenanceBelongsToMachine(machineId, maintenanceId);

    await this.prisma.machineMaintenance.delete({
      where: { id: maintenanceId },
    });
    await this.recomputeHourMeter(machineId);
    return { success: true };
  }

  private async assertFuelRecordBelongsToMachine(
    machineId: string,
    fuelRecordId: string,
  ) {
    const record = await this.prisma.machineFuelRecord.findUnique({
      where: { id: fuelRecordId },
    });
    if (!record || record.machineId !== machineId) {
      throw new NotFoundException('Registro de combustível não encontrado');
    }
    return record;
  }

  async updateFuelRecord(
    farmId: string,
    machineId: string,
    fuelRecordId: string,
    dto: UpdateFuelRecordDto,
  ) {
    await this.findOne(farmId, machineId);
    await this.assertFuelRecordBelongsToMachine(machineId, fuelRecordId);

    const record = await this.prisma.machineFuelRecord.update({
      where: { id: fuelRecordId },
      data: {
        ...(dto.liters !== undefined ? { liters: dto.liters } : {}),
        ...(dto.cost !== undefined ? { cost: dto.cost } : {}),
        ...(dto.hourMeterAt !== undefined
          ? { hourMeterAt: dto.hourMeterAt }
          : {}),
        ...(dto.recordedAt !== undefined
          ? { recordedAt: new Date(dto.recordedAt) }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    await this.recomputeHourMeter(machineId);
    return record;
  }

  async removeFuelRecord(
    farmId: string,
    machineId: string,
    fuelRecordId: string,
  ) {
    await this.findOne(farmId, machineId);
    await this.assertFuelRecordBelongsToMachine(machineId, fuelRecordId);

    await this.prisma.machineFuelRecord.delete({
      where: { id: fuelRecordId },
    });
    await this.recomputeHourMeter(machineId);
    return { success: true };
  }

  // Total maintenance + fuel cost per machine for the farm.
  async costsSummary(farmId: string) {
    const machines = await this.prisma.machine.findMany({
      where: { farmId },
      include: { maintenances: true, fuelRecords: true },
    });

    return machines.map((m) => {
      const maintenanceCost = m.maintenances.reduce(
        (sum, r) => sum + (r.cost ?? 0),
        0,
      );
      const fuelCost = m.fuelRecords.reduce((sum, r) => sum + (r.cost ?? 0), 0);
      const totalLiters = m.fuelRecords.reduce((sum, r) => sum + r.liters, 0);

      return {
        machineId: m.id,
        name: m.name,
        currentHourMeter: m.currentHourMeter,
        maintenanceCost,
        fuelCost,
        totalCost: maintenanceCost + fuelCost,
        totalLiters,
      };
    });
  }
}
