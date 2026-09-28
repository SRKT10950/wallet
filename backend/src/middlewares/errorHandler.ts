import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppRequest } from '../types/index.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  const appReq = req as AppRequest;
  const requestId = appReq.id || 'req_unknown';

  // Never leak SQL or stack details to clients
  console.error(`[UNHANDLED ERROR] [${requestId}]:`, err);

  if (err instanceof ZodError) {
    const formattedIssues = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    res.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload or parameters.',
        details: formattedIssues,
      },
      requestId,
    });
    return;
  }

  // Handle generic errors
  const status = err.status || err.statusCode || 500;
  const code = err.code && typeof err.code === 'string' && err.code.length < 32 ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = status < 500 ? err.message : 'An unexpected server error occurred. Please try again later.';

  res.status(status).json({
    success: false,
    data: null,
    error: {
      code,
      message,
    },
    requestId,
  });
}
