import { jest } from '@jest/globals';

let requireAtivo;

beforeAll(async () => {
  const mod = await import('../requireAtivo.js');
  requireAtivo = mod.requireAtivo;
});

function makeReq(overrides = {}) {
  return { ...overrides };
}

describe('requireAtivo', () => {
  // --- Statuses that PASS (have an active subscription) ---

  test('calls next() without error when user status is ativo', () => {
    const req = makeReq({ user: { sub: 'user-1', status: 'ativo' } });
    const next = jest.fn();

    requireAtivo(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  test('calls next() without error when user status is trial', () => {
    const req = makeReq({ user: { sub: 'user-2', status: 'trial' } });
    const next = jest.fn();

    requireAtivo(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  test('calls next() without error when user status is pendente', () => {
    const req = makeReq({ user: { sub: 'user-3', status: 'pendente' } });
    const next = jest.fn();

    requireAtivo(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  // --- Statuses that are BLOCKED (no active subscription) ---

  test('calls next with AppError 403 SEM_ASSINATURA when user status is bloqueado_inadimplencia', () => {
    const req = makeReq({ user: { sub: 'user-4', status: 'bloqueado_inadimplencia' } });
    const next = jest.fn();

    requireAtivo(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.status).toBe(403);
    expect(err.code).toBe('SEM_ASSINATURA');
  });

  test('calls next with AppError 403 SEM_ASSINATURA when user status is cancelado', () => {
    const req = makeReq({ user: { sub: 'user-5', status: 'cancelado' } });
    const next = jest.fn();

    requireAtivo(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.status).toBe(403);
    expect(err.code).toBe('SEM_ASSINATURA');
  });

  test('calls next with AppError 403 SEM_ASSINATURA when user status is inativo', () => {
    const req = makeReq({ user: { sub: 'user-6', status: 'inativo' } });
    const next = jest.fn();

    requireAtivo(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.status).toBe(403);
    expect(err.code).toBe('SEM_ASSINATURA');
  });

  test('calls next with AppError 403 SEM_ASSINATURA when req.user.status is undefined', () => {
    const req = makeReq({ user: { sub: 'user-7' } });
    const next = jest.fn();

    requireAtivo(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.status).toBe(403);
    expect(err.code).toBe('SEM_ASSINATURA');
  });

  test('calls next with AppError 403 SEM_ASSINATURA when req.user is absent', () => {
    const req = makeReq({});
    const next = jest.fn();

    requireAtivo(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.status).toBe(403);
    expect(err.code).toBe('SEM_ASSINATURA');
  });

  test('calls next with AppError 403 SEM_ASSINATURA when req.user.status is null', () => {
    const req = makeReq({ user: { sub: 'user-8', status: null } });
    const next = jest.fn();

    requireAtivo(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.status).toBe(403);
    expect(err.code).toBe('SEM_ASSINATURA');
  });
});
