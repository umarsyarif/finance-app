import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validate =
  (schema: AnyZodObject) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        params: req.params,
        query: req.query,
        body: req.body,
      });
      // Keep the schema's trims/defaults/transforms; unknown keys stay as sent
      if (parsed.body && typeof parsed.body === 'object') req.body = { ...req.body, ...parsed.body };

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: 'fail',
          message: error.errors.map((e) => e.message).join(', '),
          errors: error.errors,
        });
      }
      next(error);
    }
  };
