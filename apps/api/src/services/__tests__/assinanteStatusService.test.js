import { jest } from '@jest/globals';

const mockPrisma = {
  assinante: { update: jest.fn() },
  usuario: { update: jest.fn() },
};

jest.unstable_mockModule('../../utils/database.js', () => ({ default: mockPrisma }));
jest.unstable_mockModule('../../logger.js', () => ({ default: { info: jest.fn() } }));

const { atualizarStatusAssinante, mapAsaasStatusToLocal } = await import('../assinanteStatusService.js');

const ASSINANTE_ID = 'assinante-uuid-001';
const USUARIO_ID = 'usuario-uuid-001';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.assinante.update.mockResolvedValue({});
  mockPrisma.usuario.update.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// mapAsaasStatusToLocal
// ---------------------------------------------------------------------------

describe('mapAsaasStatusToLocal', () => {
  test.each([
    ['ACTIVE', 'ativo'],
    ['PENDING', 'pendente'],
    ['OVERDUE', 'inadimplente'],
    ['INACTIVE', 'cancelado'],
    ['CANCELLED', 'cancelado'],
    ['UNKNOWN', null],
    [undefined, null],
  ])('mapAsaasStatusToLocal(%s) → %s', (input, expected) => {
    expect(mapAsaasStatusToLocal(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// atualizarStatusAssinante
// ---------------------------------------------------------------------------

describe('atualizarStatusAssinante', () => {
  test('ativo — atualiza assinante e usuario para ativo', async () => {
    await atualizarStatusAssinante(ASSINANTE_ID, USUARIO_ID, 'ativo');

    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ASSINANTE_ID },
        data: expect.objectContaining({ status: 'ativo' }),
      }),
    );
    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USUARIO_ID },
        data: { status: 'ativo' },
      }),
    );
  });

  test('pendente — atualiza assinante para pendente e usuario para ativo', async () => {
    await atualizarStatusAssinante(ASSINANTE_ID, USUARIO_ID, 'pendente');

    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pendente' }) }),
    );
    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ativo' } }),
    );
  });

  test('inadimplente — atualiza assinante para inadimplente e usuario para bloqueado_inadimplencia', async () => {
    await atualizarStatusAssinante(ASSINANTE_ID, USUARIO_ID, 'inadimplente');

    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'inadimplente' }) }),
    );
    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'bloqueado_inadimplencia' } }),
    );
  });

  test('cancelado — atualiza assinante para cancelado e usuario para ativo', async () => {
    await atualizarStatusAssinante(ASSINANTE_ID, USUARIO_ID, 'cancelado');

    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'cancelado' }) }),
    );
    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ativo' } }),
    );
  });

  test('inclui proxima_cobranca quando fornecido', async () => {
    const data = new Date('2026-04-17');
    await atualizarStatusAssinante(ASSINANTE_ID, USUARIO_ID, 'ativo', { proxima_cobranca: data });

    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ proxima_cobranca: data }),
      }),
    );
  });

  test('não inclui proxima_cobranca quando não fornecido', async () => {
    await atualizarStatusAssinante(ASSINANTE_ID, USUARIO_ID, 'ativo');

    const call = mockPrisma.assinante.update.mock.calls[0][0];
    expect(call.data).not.toHaveProperty('proxima_cobranca');
  });

  test('usa transação (tx) quando fornecida em vez de prisma global', async () => {
    const mockTx = {
      assinante: { update: jest.fn().mockResolvedValue({}) },
      usuario: { update: jest.fn().mockResolvedValue({}) },
    };

    await atualizarStatusAssinante(ASSINANTE_ID, USUARIO_ID, 'ativo', { tx: mockTx });

    expect(mockTx.assinante.update).toHaveBeenCalled();
    expect(mockTx.usuario.update).toHaveBeenCalled();
    expect(mockPrisma.assinante.update).not.toHaveBeenCalled();
  });

  test('sempre inclui updated_at no update do assinante', async () => {
    await atualizarStatusAssinante(ASSINANTE_ID, USUARIO_ID, 'ativo');

    const call = mockPrisma.assinante.update.mock.calls[0][0];
    expect(call.data.updated_at).toBeInstanceOf(Date);
  });
});
