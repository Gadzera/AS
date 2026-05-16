import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error('[Prisma]', err.code, err.meta);
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Resource already exists' });
    } else if (err.code === 'P2025') {
      res.status(404).json({ error: 'Resource not found' });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error('[Prisma validation]', err.message.slice(0, 200));
    res.status(500).json({ error: 'Internal Server Error' });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error]', err.message, err.stack);
  } else {
    console.error('[Error]', err.message);
  }

  const statusCode = (err as AppError).statusCode ?? 500;
  const message = statusCode === 500 ? 'Internal Server Error' : err.message;

  res.status(statusCode).json({ error: message });
}

export function createError(message: string, statusCode: number): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  return err;
}
