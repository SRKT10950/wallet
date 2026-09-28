import crypto from 'crypto';
import * as argon2 from '@node-rs/argon2';

/**
 * Hashes a plaintext password using Argon2id or Node crypto scrypt as fallback
 */
export async function hashPassword(password: string): Promise<string> {
  if (argon2 && typeof argon2.hash === 'function') {
    try {
      return await argon2.hash(password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });
    } catch {
      // Fallback to scrypt
    }
  }

  // Scrypt fallback with salt
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verifies a password against a stored hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;

  if (storedHash.startsWith('$argon2') && argon2 && typeof argon2.verify === 'function') {
    try {
      return await argon2.verify(storedHash, password);
    } catch {
      return false;
    }
  }

  if (storedHash.startsWith('scrypt:')) {
    const [, salt, key] = storedHash.split(':');
    return new Promise((resolve) => {
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return resolve(false);
        const match = crypto.timingSafeEqual(
          Buffer.from(key, 'hex'),
          derivedKey
        );
        resolve(match);
      });
    });
  }

  return false;
}

/**
 * Generates a cryptographically strong random token of specified bytes
 */
export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generates an API key with a safe human prefix (e.g. mw_live_...)
 */
export function generateApiKey(): { apiKey: string; keyHash: string; keyPrefix: string } {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  const apiKey = `mw_${randomPart}`;
  const keyPrefix = apiKey.substring(0, 8);
  const keyHash = hashKey(apiKey);
  return { apiKey, keyHash, keyPrefix };
}

/**
 * Hashes a secret key using SHA-256 for secure lookup and verification
 */
export function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Constant-time comparison between two hashes
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
