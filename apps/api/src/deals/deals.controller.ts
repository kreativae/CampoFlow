import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FarmAccessGuard } from '../auth/guards/farm-access.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

@Controller('fazendas/:farmId/negocios')
@UseGuards(JwtAuthGuard)
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  create(
    @Param('farmId') farmId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDealDto,
  ) {
    return this.dealsService.create(farmId, user.id, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(
    @Param('farmId') farmId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.dealsService.findAll(farmId, { type, status });
  }

  @Get(':id')
  @UseGuards(FarmAccessGuard)
  async findOne(@Param('farmId') farmId: string, @Param('id') id: string) {
    const deal = await this.dealsService.findOne(farmId, id);
    return {
      ...deal,
      summary: this.dealsService.summary(deal),
    };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  update(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.dealsService.update(farmId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(@Param('farmId') farmId: string, @Param('id') id: string) {
    return this.dealsService.remove(farmId, id);
  }
}
