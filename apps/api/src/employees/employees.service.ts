import { Injectable, NotFoundException } from '@nestjs/common';
import { Employee, TimeEntry } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  // Aggregates a worker's time entries into worked hours, banked balance and cost.
  // worked  = sum of positive entries (hours actually put in);
  // balance = sum of all entries (positive credit minus negative folga/débito);
  // grossCost = worked hours × hourlyRate (total generated);
  // paidCost  = value of entries already marked as paid;
  // totalCost = cost still owed: every unpaid entry × rate, so negative (folga)
  //             entries subtract and paid entries are abated from the balance due.
  private summarize(employee: Employee, entries: TimeEntry[]) {
    const rate = employee.hourlyRate;
    const totalHours = entries
      .filter((e) => e.hours > 0)
      .reduce((sum, e) => sum + e.hours, 0);
    const balanceHours = entries.reduce((sum, e) => sum + e.hours, 0);
    const grossCost = totalHours * rate;
    const paidCost = entries
      .filter((e) => e.paid)
      .reduce((sum, e) => sum + e.hours * rate, 0);
    const totalCost = entries
      .filter((e) => !e.paid)
      .reduce((sum, e) => sum + e.hours * rate, 0);
    return {
      totalHours: Number(totalHours.toFixed(2)),
      balanceHours: Number(balanceHours.toFixed(2)),
      grossCost: Number(grossCost.toFixed(2)),
      paidCost: Number(paidCost.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
    };
  }

  create(farmId: string, dto: CreateEmployeeDto) {
    return this.prisma.employee.create({ data: { ...dto, farmId } });
  }

  async findAll(farmId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { farmId },
      orderBy: { name: 'asc' },
      include: { timeEntries: true },
    });

    return employees.map((e) => {
      const { timeEntries, ...employee } = e;
      return { ...employee, ...this.summarize(e, timeEntries) };
    });
  }

  async findOne(farmId: string, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { timeEntries: { orderBy: { workDate: 'desc' } } },
    });
    if (!employee || employee.farmId !== farmId) {
      throw new NotFoundException('Funcionário não encontrado');
    }
    return { ...employee, ...this.summarize(employee, employee.timeEntries) };
  }

  async update(farmId: string, employeeId: string, dto: UpdateEmployeeDto) {
    await this.assertEmployee(farmId, employeeId);
    return this.prisma.employee.update({
      where: { id: employeeId },
      data: dto,
    });
  }

  async remove(farmId: string, employeeId: string) {
    await this.assertEmployee(farmId, employeeId);
    await this.prisma.employee.delete({ where: { id: employeeId } });
    return { success: true };
  }

  // Farm-level totals across all employees, for the dashboard summary.
  async summary(farmId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { farmId },
      include: { timeEntries: true },
    });

    let totalHours = 0;
    let balanceHours = 0;
    let grossCost = 0;
    let paidCost = 0;
    let totalCost = 0;
    for (const e of employees) {
      const s = this.summarize(e, e.timeEntries);
      totalHours += s.totalHours;
      balanceHours += s.balanceHours;
      grossCost += s.grossCost;
      paidCost += s.paidCost;
      totalCost += s.totalCost;
    }

    return {
      employeeCount: employees.length,
      activeCount: employees.filter((e) => e.active).length,
      totalHours: Number(totalHours.toFixed(2)),
      balanceHours: Number(balanceHours.toFixed(2)),
      grossCost: Number(grossCost.toFixed(2)),
      paidCost: Number(paidCost.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
    };
  }

  private async assertEmployee(farmId: string, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee || employee.farmId !== farmId) {
      throw new NotFoundException('Funcionário não encontrado');
    }
    return employee;
  }

  async addTimeEntry(
    farmId: string,
    employeeId: string,
    dto: CreateTimeEntryDto,
  ) {
    await this.assertEmployee(farmId, employeeId);
    return this.prisma.timeEntry.create({
      data: {
        farmId,
        employeeId,
        description: dto.description,
        hours: dto.hours,
        paid: dto.paid ?? false,
        workDate: dto.workDate ? new Date(dto.workDate) : undefined,
        notes: dto.notes,
      },
    });
  }

  private async assertTimeEntry(employeeId: string, timeEntryId: string) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id: timeEntryId },
    });
    if (!entry || entry.employeeId !== employeeId) {
      throw new NotFoundException('Registro de horas não encontrado');
    }
    return entry;
  }

  async updateTimeEntry(
    farmId: string,
    employeeId: string,
    timeEntryId: string,
    dto: UpdateTimeEntryDto,
  ) {
    await this.assertEmployee(farmId, employeeId);
    await this.assertTimeEntry(employeeId, timeEntryId);
    return this.prisma.timeEntry.update({
      where: { id: timeEntryId },
      data: {
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.hours !== undefined ? { hours: dto.hours } : {}),
        ...(dto.paid !== undefined ? { paid: dto.paid } : {}),
        ...(dto.workDate !== undefined
          ? { workDate: new Date(dto.workDate) }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async removeTimeEntry(
    farmId: string,
    employeeId: string,
    timeEntryId: string,
  ) {
    await this.assertEmployee(farmId, employeeId);
    await this.assertTimeEntry(employeeId, timeEntryId);
    await this.prisma.timeEntry.delete({ where: { id: timeEntryId } });
    return { success: true };
  }
}
