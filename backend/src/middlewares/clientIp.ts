import { Response, NextFunction } from 'express';
import { AppRequest } from '../types/index.js';
import { config } from '../config/index.js';

const trustedProxies = config.TRUSTED_PROXY_IPS.split(',').map((ip) => ip.trim());

function isTrustedProxy(ip: string): boolean {
  if (!ip) return false;
  // Normalize ipv6 prefix for localhost
  const cleanIp = ip.replace(/^::ffff:/, '');
  return trustedProxies.some((trusted) => {
    if (trusted === cleanIp) return true;
    if (trusted === '127.0.0.1' && (cleanIp === '127.0.0.1' || cleanIp === '::1')) return true;
    // Basic CIDR or subnet prefix check
    if (trusted.includes('/')) {
      const [subnet] = trusted.split('/');
      return cleanIp.startsWith(subnet.substring(0, subnet.lastIndexOf('.')));
    }
    return false;
  });
}

export function clientIpMiddleware(req: AppRequest, res: Response, next: NextFunction): void {
  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
  const cleanSocketIp = socketIp.replace(/^::ffff:/, '');

  if (isTrustedProxy(cleanSocketIp)) {
    // Only trust headers if request came from our reverse proxy
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];

    if (typeof forwarded === 'string') {
      // First IP in chain is original client
      req.clientIp = forwarded.split(',')[0].trim();
    } else if (typeof realIp === 'string') {
      req.clientIp = realIp.trim();
    } else {
      req.clientIp = cleanSocketIp;
    }
  } else {
    // Direct connection, untrusted proxy or direct access
    req.clientIp = cleanSocketIp;
  }

  next();
}
