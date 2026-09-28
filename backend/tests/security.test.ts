import { describe, it, expect, vi } from 'vitest';
import { deviceSecurityGuard } from '../src/middlewares/deviceSecurity.js';
import { AppRequest } from '../src/types/index.js';

describe('Device Security Middleware Logic', () => {
  it('rejects request with 401 when X-API-Key is missing', async () => {
    const middleware = deviceSecurityGuard();
    const req = {
      headers: {},
      id: 'req_test_1',
    } as AppRequest;

    let responseCode: number | null = null;
    let responseBody: any = null;
    const res = {
      status: (code: number) => {
        responseCode = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    } as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(responseCode).toBe(401);
    expect(responseBody.error.code).toBe('API_KEY_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with 401 when X-Device-Security-Key is missing on protected route', async () => {
    // Mock db lookup for api key
    vi.mock('../src/database/index.js', () => ({
      db: (table: string) => {
        if (table === 'api_keys') {
          return {
            join: () => ({
              select: () => ({
                where: () => ({
                  first: async () => ({
                    api_key_id: 'key_1',
                    business_id: 'biz_1',
                    key_active: true,
                    application_id: 'app_1',
                    app_name: 'My Wallet Android',
                    app_identifier: 'com.mywallet.android',
                    platform: 'Android',
                    app_active: true,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    }));

    const middleware = deviceSecurityGuard({ requireDevice: true });
    const req = {
      headers: {
        'x-api-key': 'mw_test_key_123',
      },
      id: 'req_test_2',
    } as any;

    let responseCode: number | null = null;
    let responseBody: any = null;
    const res = {
      status: (code: number) => {
        responseCode = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    } as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(responseCode).toBe(401);
    expect(responseBody.error.code).toBe('DEVICE_SECURITY_KEY_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });
});
