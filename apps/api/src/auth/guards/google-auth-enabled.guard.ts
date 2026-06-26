import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

// Blocks /auth/google* before Passport's GoogleStrategy ever runs, when no real
// Google Cloud OAuth credentials are configured. Without this guard, clicking
// "Entrar com Google" would hit Google with bogus placeholder credentials and fail
// with a confusing error from Google's side instead of a clear message from ours.
@Injectable()
export class GoogleAuthEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new ServiceUnavailableException(
        'Login com Google não está configurado neste ambiente (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET ausentes).',
      );
    }
    return true;
  }
}
