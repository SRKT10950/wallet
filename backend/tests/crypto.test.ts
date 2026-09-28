import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateApiKey,
  hashKey,
  generateRandomToken,
  safeCompare,
} from '../src/utils/crypto.js';

describe('Cryptographic Operations', () => {
  it('hashes and verifies passwords securely using Argon2id / scrypt', async () => {
    const password = 'SuperSecurePassword@2026';
    const hash = await hashPassword(password);

    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(password);

    const isMatch = await verifyPassword(password, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword('WrongPassword123', hash);
    expect(isWrongMatch).toBe(false);
  });

  it('generates well-formed API keys with recognizable prefix and correct hash', () => {
    const { apiKey, keyHash, keyPrefix } = generateApiKey();

    expect(apiKey.startsWith('mw_')).toBe(true);
    expect(keyPrefix).toBe(apiKey.substring(0, 8));
    expect(keyHash).toBe(hashKey(apiKey));
    expect(keyHash.length).toBe(64); // SHA-256 hex string length
  });

  it('performs constant-time safe comparison', () => {
    const str1 = 'abc1234567890';
    const str2 = 'abc1234567890';
    const str3 = 'abc1234567891';

    expect(safeCompare(str1, str2)).toBe(true);
    expect(safeCompare(str1, str3)).toBe(false);
    expect(safeCompare(str1, 'short')).toBe(false);
  });

  it('generates random tokens of specified byte lengths', () => {
    const token32 = generateRandomToken(32);
    expect(token32.length).toBe(64); // 32 bytes = 64 hex characters

    const token48 = generateRandomToken(48);
    expect(token48.length).toBe(96); // 48 bytes = 96 hex characters
  });
});
