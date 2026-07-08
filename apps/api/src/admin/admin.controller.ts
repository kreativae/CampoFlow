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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { AdminService } from './admin.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateAccountUserDto } from './dto/update-account-user.dto';
import { DeleteAccountsDto } from './dto/delete-accounts.dto';
import { UpdateMercadoPagoConfigDto } from './dto/update-mercadopago-config.dto';
import { UpdateNotificationConfigDto } from './dto/update-notification-config.dto';
import { ListAccountsDto } from './dto/list-accounts.dto';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { ExtendTrialDto } from './dto/extend-trial.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('saude')
  healthCheck() {
    return this.adminService.healthCheck();
  }

  @Get('overview')
  overview() {
    return this.adminService.overview();
  }

  @Get('contas')
  listAccounts(@Query() query: ListAccountsDto) {
    return this.adminService.listAccounts(query);
  }

  @Get('contas/:accountId')
  getAccount(@Param('accountId') accountId: string) {
    return this.adminService.getAccount(accountId);
  }

  @Patch('contas/:accountId/assinatura')
  updateSubscription(
    @Param('accountId') accountId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.adminService.updateSubscription(accountId, dto);
  }

  @Patch('contas/:accountId')
  updateAccount(
    @Param('accountId') accountId: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.adminService.updateAccount(accountId, dto);
  }

  @Patch('contas/:accountId/usuarios/:userId')
  updateAccountUser(
    @Param('accountId') accountId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateAccountUserDto,
  ) {
    return this.adminService.updateAccountUser(accountId, userId, dto);
  }

  @Delete('contas/:accountId')
  deleteAccount(@Param('accountId') accountId: string) {
    return this.adminService.deleteAccount(accountId);
  }

  @Delete('contas')
  deleteAccounts(@Body() dto: DeleteAccountsDto) {
    return this.adminService.deleteAccounts(dto.accountIds);
  }

  @Get('mercadopago/config')
  getMercadoPagoConfig() {
    return this.adminService.getMercadoPagoConfig();
  }

  @Patch('mercadopago/config')
  updateMercadoPagoConfig(@Body() dto: UpdateMercadoPagoConfigDto) {
    return this.adminService.updateMercadoPagoConfig(dto);
  }

  @Get('mercadopago/logs')
  getMercadoPagoLogs() {
    return this.adminService.getMercadoPagoLogs();
  }

  @Get('notificacoes/config')
  getNotificationConfig() {
    return this.adminService.getNotificationConfig();
  }

  @Patch('notificacoes/config')
  updateNotificationConfig(@Body() dto: UpdateNotificationConfigDto) {
    return this.adminService.updateNotificationConfig(dto);
  }

  // Ações rápidas de suporte
  @Post('contas/:accountId/estender-trial')
  extendTrial(
    @Param('accountId') accountId: string,
    @Body() dto: ExtendTrialDto,
  ) {
    return this.adminService.extendTrial(accountId, dto.days);
  }

  @Post('contas/:accountId/gerar-notificacoes')
  generateNotifications(@Param('accountId') accountId: string) {
    return this.adminService.generateNotificationsForAccount(accountId);
  }

  @Post('cotacoes/atualizar')
  refreshQuotations() {
    return this.adminService.refreshQuotations();
  }

  // Auditoria
  @Get('auditoria')
  listAuditLogs(@Query() query: ListAuditLogsDto) {
    return this.adminService.listAuditLogs(query);
  }

  // TEMPORÁRIO: limpa todo o histórico de auditoria.
  @Delete('auditoria')
  clearAuditLogs() {
    return this.adminService.clearAuditLogs();
  }
}
