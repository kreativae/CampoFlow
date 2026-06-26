import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMachineDto } from './dto/create-machine.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { CreateFuelRecordDto } from './dto/create-fuel-record.dto';

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
