import { jest } from '@jest/globals';
import { z } from 'zod';

let validate;

beforeAll(async () => {
  const mod = await import('../validate.js');
  validate = mod.validate;
});

function makeReq(body = {}, query = {}, params = {}) {
  return { body, query, params };
}

function makeRes() {
  return {};
}

describe('validate middleware', () => {
  describe('with a direct Zod schema (body validation)', () => {
    const schema = z.object({
      nome: z.string().min(2),
      email: z.string().email(),
    });

    test('calls next() with no error when body is valid', () => {
      const req = makeReq({ nome: 'Alice', email: 'alice@test.com' });
      const next = jest.fn();
      validate(schema)(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    test('replaces req.body with parsed (coerced) data on success', () => {
      const s = z.object({ valor: z.coerce.number() });
      const req = makeReq({ valor: '42' });
      const next = jest.fn();
      validate(s)(req, makeRes(), next);
      expect(req.body.valor).toBe(42);
    });

    test('calls next(AppError) with 422 status when body is invalid', () => {
      const req = makeReq({ nome: 'A', email: 'not-an-email' });
      const next = jest.fn();
      validate(schema)(req, makeRes(), next);
      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeTruthy();
      expect(err.status).toBe(422);
      expect(err.code).toBe('VALIDATION_ERROR');
    });

    test('error details contains fields map', () => {
      const req = makeReq({ nome: 'A', email: 'bad' });
      const next = jest.fn();
      validate(schema)(req, makeRes(), next);
      const err = next.mock.calls[0][0];
      expect(err.details).toHaveProperty('fields');
    });
  });

  describe('with a shape object { body, query, params }', () => {
    const bodySchema = z.object({ valor: z.number().positive() });
    const querySchema = z.object({ page: z.coerce.number().default(1) });

    test('validates body and query independently', () => {
      const req = makeReq({ valor: 10 }, { page: '2' });
      const next = jest.fn();
      validate({ body: bodySchema, query: querySchema })(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
      expect(req.body.valor).toBe(10);
      expect(req.query.page).toBe(2);
    });

    test('returns validation error when body fails', () => {
      const req = makeReq({ valor: -5 }, { page: '1' });
      const next = jest.fn();
      validate({ body: bodySchema, query: querySchema })(req, makeRes(), next);
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(422);
    });

    test('returns validation error when query fails', () => {
      const req = makeReq({ valor: 5 }, { page: 'invalid' });
      const next = jest.fn();
      validate({ body: bodySchema, query: querySchema })(req, makeRes(), next);
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(422);
    });

    test('validates params schema', () => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const req = makeReq({}, {}, { id: '123e4567-e89b-12d3-a456-426614174000' });
      const next = jest.fn();
      validate({ params: paramsSchema })(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    test('returns error for invalid uuid in params', () => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const req = makeReq({}, {}, { id: 'not-a-uuid' });
      const next = jest.fn();
      validate({ params: paramsSchema })(req, makeRes(), next);
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(422);
    });
  });

  describe('sanitization', () => {
    test('trims strings when schema uses .trim()', () => {
      const s = z.object({ nome: z.string().trim() });
      const req = makeReq({ nome: '  Alice  ' });
      const next = jest.fn();
      validate(s)(req, makeRes(), next);
      expect(req.body.nome).toBe('Alice');
    });

    test('lowercases email when schema uses .toLowerCase()', () => {
      const s = z.object({ email: z.string().trim().toLowerCase().email() });
      const req = makeReq({ email: 'Alice@Test.COM' });
      const next = jest.fn();
      validate(s)(req, makeRes(), next);
      expect(req.body.email).toBe('alice@test.com');
    });
  });

  describe('com schema de headers', () => {
    const headersSchema = z.object({
      'x-custom-header': z.string().min(1),
    });

    test('passa quando header obrigatório está presente', () => {
      const req = { body: {}, query: {}, params: {}, headers: { 'x-custom-header': 'valor' } };
      const next = jest.fn();
      validate({ headers: headersSchema })(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('retorna erro 422 quando header obrigatório está ausente', () => {
      const req = { body: {}, query: {}, params: {}, headers: {} };
      const next = jest.fn();
      validate({ headers: headersSchema })(req, {}, next);
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(422);
      expect(err.code).toBe('VALIDATION_ERROR');
    });
  });
});
