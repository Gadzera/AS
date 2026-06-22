import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  // M16-4: machine-readable контекст для INSUFFICIENT_CREDITS (UI/Reports).
  required?: number;
  available?: number;
  source?: string;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Невалидный ввод (zod) — это 400, а не 500 (единая обработка для всех роутов).
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    return;
  }

  console.error('[Error]', err.message, err.stack);

  const statusCode = err.statusCode ?? 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    ...(err.code ? { code: err.code } : {}),
    // M16-4: единый machine-readable формат блокировки по кредитам.
    ...(err.code === 'INSUFFICIENT_CREDITS' ? { required: err.required, available: err.available, source: err.source } : {}),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function createError(message: string, statusCode: number): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  return err;
}
