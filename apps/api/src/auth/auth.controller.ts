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
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthEnabledGuard } from './guards/google-auth-enabled.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './decorators/current-user.decorator';
import type { GoogleProfile } from './strategies/google.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
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
