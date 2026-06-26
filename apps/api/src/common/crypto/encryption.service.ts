import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

// Application-level field encryption for sensitive columns (e.g. User.mfaSecret).
// This protects specific values at rest in the database independent of disk/volume
// encryption, which depends on the hosting infrastructure (LUKS, EBS encryption, etc.)
// and is out of reach of the application code in this environment. ENCRYPTION_KEY must
// be a 32-byte key, hex-encoded (64 hex chars) — generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex || hex.length !== KEY_LENGTH * 2) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY ausente ou invalida (esperado hex de 64 caracteres / 32 bytes)',
      );
    }
    this.key = Buffer.from(hex, 'hex');
  }

  // Returns a string in the form "iv:authTag:ciphertext" (all base64), so the result
  // is a single opaque string that fits in a normal String column.
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const [ivB64, authTagB64, ciphertextB64] = payload.split(':');
    if (!ivB64 || !authTagB64 || !ciphertextB64) {
      throw new InternalServerErrorException('Payload criptografado invalido');
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }
}
