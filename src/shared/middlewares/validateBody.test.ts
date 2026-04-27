import { describe, it, expect, jest } from '@jest/globals';
import { z } from 'zod';
import { validateBody } from './validateBody.js';
import { ValidationError } from '../errors/ValidationError.js';
import type { Request, Response } from 'express';

describe('validateBody Middleware', () => {
  const schema = z.object({
    name: z.string(),
    age: z.number().min(18),
  });

  it('should call next() if body is valid', () => {
    const middleware = validateBody(schema);
    const req = { body: { name: 'John', age: 25 } } as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it('should call next(ValidationError) if body is invalid', () => {
    const middleware = validateBody(schema);
    const req = { body: { name: 'John', age: 10 } } as Request; // Too young
    const res = {} as Response;
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });
});
