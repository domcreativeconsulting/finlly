import { jest } from '@jest/globals';

const mockCreate = jest.fn();
const mockLogError = jest.fn();

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: {
    auditoriaEvento: {
      create: mockCreate,
    },
  },
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: {
    error: mockLogError,
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

let registrarEvento;

beforeAll(async () => {
  const mod = await import('../auditoria.service.js');
  registrarEvento = mod.registrarEvento;
});

beforeEach(() => {
  mockCreate.mockReset();
  mockLogError.mockReset();
});

describe('registrarEvento', () => {
  test('creates an auditoria event with legacy fields (tipo/detalhes)', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-1' });

    await registrarEvento({
      usuarioId: 'user-uuid',
      tipo: 'login',
      detalhes: { email: 'user@test.com' },
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      sucesso: true,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuario_id: 'user-uuid',
        tipo: 'login',
        detalhes: { email: 'user@test.com' },
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
        sucesso: true,
      }),
    });
  });

  test('creates an auditoria event with new structured fields', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-new' });

    await registrarEvento({
      usuarioId: 'user-uuid',
      actorType: 'USER',
      eventType: 'auth',
      eventAction: 'login_sucesso',
      entityType: 'usuario',
      entityId: 'user-uuid',
      requestId: 'req-123',
      metadata: { plano: 'mensal' },
      ip: '10.0.0.1',
      userAgent: 'TestAgent/1.0',
      sucesso: true,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuario_id: 'user-uuid',
        actor_type: 'USER',
        event_type: 'auth',
        event_action: 'login_sucesso',
        entity_type: 'usuario',
        entity_id: 'user-uuid',
        request_id: 'req-123',
        metadata: { plano: 'mensal' },
        sucesso: true,
      }),
    });
  });

  test('stores actorType as actor_type', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-actor' });

    await registrarEvento({ actorType: 'WEBHOOK', eventType: 'webhook', eventAction: 'webhook_recebido' });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.actor_type).toBe('WEBHOOK');
  });

  test('stores eventType as event_type and eventAction as event_action', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-event' });

    await registrarEvento({ eventType: 'billing', eventAction: 'assinatura_criada', usuarioId: 'u1' });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.event_type).toBe('billing');
    expect(callData.event_action).toBe('assinatura_criada');
  });

  test('stores entityType and entityId', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-entity' });

    await registrarEvento({ eventType: 'delete', eventAction: 'conta_pagar_excluida', entityType: 'conta_pagar', entityId: 'cp-123' });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.entity_type).toBe('conta_pagar');
    expect(callData.entity_id).toBe('cp-123');
  });

  test('stores requestId as request_id', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-req' });

    await registrarEvento({ tipo: 'login', requestId: 'req-abc-123' });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.request_id).toBe('req-abc-123');
  });

  test('stores metadata field', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-meta' });

    await registrarEvento({ eventType: 'billing', eventAction: 'assinatura_criada', metadata: { plano: 'anual', subscriptionId: 'sub_001' } });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.metadata).toEqual({ plano: 'anual', subscriptionId: 'sub_001' });
  });

  test('metadata does not contain sensitive fields', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-safe' });

    const metadata = { plano: 'mensal', subscriptionId: 'sub_001' };

    await registrarEvento({ eventType: 'auth', eventAction: 'login_sucesso', metadata });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.metadata).not.toHaveProperty('senha');
    expect(callData.metadata).not.toHaveProperty('token');
    expect(callData.metadata).not.toHaveProperty('senha_hash');
    expect(callData.metadata).not.toHaveProperty('refresh_token');
  });

  test('defaults sucesso to true when not provided', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-2' });

    await registrarEvento({ tipo: 'registro' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sucesso: true }),
      })
    );
  });

  test('uses null for usuarioId when not provided', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-3' });

    await registrarEvento({ tipo: 'login' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ usuario_id: null }),
      })
    );
  });

  test('truncates ip_address to 45 characters', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-4' });
    const longIp = 'a'.repeat(100);

    await registrarEvento({ tipo: 'login', ip: longIp });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.ip_address).toHaveLength(45);
  });

  test('truncates user_agent to 512 characters', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-5' });
    const longAgent = 'b'.repeat(600);

    await registrarEvento({ tipo: 'login', userAgent: longAgent });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.user_agent).toHaveLength(512);
  });

  test('truncates actor_type to 50 characters', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-trunc-actor' });
    const longActorType = 'X'.repeat(100);

    await registrarEvento({ actorType: longActorType, eventType: 'auth', eventAction: 'login' });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.actor_type).toHaveLength(50);
  });

  test('does not throw when prisma.create fails (fail-safe)', async () => {
    mockCreate.mockRejectedValue(new Error('DB connection lost'));

    await expect(registrarEvento({ tipo: 'login' })).resolves.toBeUndefined();
  });

  test('logs error when prisma.create fails', async () => {
    mockCreate.mockRejectedValue(new Error('DB down'));

    await registrarEvento({ tipo: 'login' });

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ msg: expect.stringContaining('auditoria') })
    );
  });

  test('handles null detalhes', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-6' });

    await registrarEvento({ tipo: 'conta_criada' });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.detalhes).toBeNull();
  });

  test('handles null metadata when not provided', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-7' });

    await registrarEvento({ eventType: 'auth', eventAction: 'login_sucesso' });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.metadata).toBeNull();
  });

  test('null for new fields when not provided', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-8' });

    await registrarEvento({ tipo: 'login' });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.actor_type).toBeNull();
    expect(callData.event_type).toBeNull();
    expect(callData.event_action).toBeNull();
    expect(callData.entity_type).toBeNull();
    expect(callData.entity_id).toBeNull();
    expect(callData.request_id).toBeNull();
  });
});
