import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthEnabledGuard } from './guards/google-auth-enabled.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './decorators/current-user.decorator';
import type { GoogleProfile } from './strategies/google.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Tighter-than-global limits on the routes most attractive to brute-force/abuse
  // (credential stuffing on login, spam registrations, password-reset flooding).
  // The global ThrottlerModule default (100 req/min) still applies everywhere else.
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Limit set above LOGIN_LOCKOUT_THRESHOLD so the account-lockout check (which is
  // per-account, not per-IP) is what kicks in first for a slow/targeted attack —
  // this throttle exists to cap raw request volume, not replace the lockout.
  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('esqueci-senha')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('redefinir-senha')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.id);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  setupMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setupMfa(user.id, user.email);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  enableMfa(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyMfaDto) {
    return this.authService.enableMfa(user.id, dto.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  disableMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.disableMfa(user.id);
  }

  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  exportPersonalData(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.exportPersonalData(user.id);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.deleteAccount(user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Get('google/status')
  googleStatus() {
    return { enabled: this.authService.isGoogleConfigured() };
  }

  @Get('google')
  @UseGuards(GoogleAuthEnabledGuard, AuthGuard('google'))
  googleAuth() {
    // Intentionally empty: AuthGuard('google') intercepts the request and redirects
    // to Google before this method body would ever run.
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthEnabledGuard, AuthGuard('google'))
  async googleCallback(
    @Req() req: { user: GoogleProfile },
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.loginWithGoogle(req.user);

    const redirectBase =
      process.env.WEB_OAUTH_REDIRECT_URL ||
      'http://localhost:3100/oauth/callback';
    const redirectUrl = `${redirectBase}?accessToken=${encodeURIComponent(
      accessToken,
    )}&refreshToken=${encodeURIComponent(refreshToken)}`;
    res.redirect(redirectUrl);
  }
}
