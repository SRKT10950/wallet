import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppRequest } from '../types/index.js';

export function requestTraceMiddleware(req: AppRequest, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || `req_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      route: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: duration,
      clientIp: req.clientIp,
      userId: req.user?.id || null,
      deviceId: req.device?.deviceId || null,
    };

    // Output structured JSON log
    if (res.statusCode >= 400) {
      console.warn(JSON.stringify({ level: 'warn', ...logData }));
    } else {
      console.log(JSON.stringify({ level: 'info', ...logData }));
    }
  });

  next();
}
