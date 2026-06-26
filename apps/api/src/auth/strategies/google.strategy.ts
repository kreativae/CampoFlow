import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

// Constructed unconditionally at app bootstrap (Nest instantiates every registered
// strategy eagerly), so we must never pass an empty clientID/clientSecret — the
// underlying oauth2 library throws synchronously in that case. When credentials are
// not configured (no Google Cloud OAuth app set up yet), we fall back to harmless
// placeholder values; the routes that would use this strategy are kept behind
// GoogleAuthEnabledGuard, which checks the same env vars and refuses the request
// with a clear message before Passport ever gets to use this strategy for real.
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'not-configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'not-configured',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; emails?: { value: string }[]; displayName?: string },
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Conta do Google sem e-mail público'), undefined);
      return;
    }
    const result: GoogleProfile = {
      googleId: profile.id,
      email,
      name: profile.displayName || email,
    };
    done(null, result);
  }
}
