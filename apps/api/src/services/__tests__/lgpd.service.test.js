import { jest } from '@jest/globals';

const mockRegistrarEvento = jest.fn();
const mockLogInfo = jest.fn();

// Build a complete Prisma mock
const mockPrisma = {
  usuario: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  usuarioSessao: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  usuarioEventoAuth: { findMany: jest.fn() },
  conta: { findMany: jest.fn() },
  contaPagar: { findMany: jest.fn() },
  contaReceber: { findMany: jest.fn() },
  movimentacaoCaixa: { findMany: jest.fn() },
  investimento: { findMany: jest.fn() },
  meta: { findMany: jest.fn() },
  assinante: { findUnique: jest.fn() },
  auditoriaEvento: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../../services/auditoria.service.js', () => ({
  registrarEvento: mockRegistrarEvento,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: mockLogInfo,
    debug: jest.fn(),
  },
}));

let exportarDadosUsuario;
let anonimizarUsuario;
let minimizarDados;

const USUARIO_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

function buildEmptyMocks() {
  mockPrisma.usuario.findUnique.mockResolvedValue({
    id: USUARIO_ID,
    nome: 'Alice',
    email: 'alice@test.com',
    telefone: null,
    avatar_url: null,
    email_verificado: true,
    role: 'user',
    status: 'ativo',
    whatsapp: null,
    timezone: 'America/Sao_Paulo',
    moeda: 'BRL',
    ultima_senha_troca: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  });
  mockPrisma.usuarioSessao.findMany.mockResolvedValue([]);
  mockPrisma.usuarioEventoAuth.findMany.mockResolvedValue([]);
  mockPrisma.conta.findMany.mockResolvedValue([]);
  mockPrisma.contaPagar.findMany.mockResolvedValue([]);
  mockPrisma.contaReceber.findMany.mockResolvedValue([]);
  mockPrisma.movimentacaoCaixa.findMany.mockResolvedValue([]);
  mockPrisma.investimento.findMany.mockResolvedValue([]);
  mockPrisma.meta.findMany.mockResolvedValue([]);
  mockPrisma.assinante.findUnique.mockResolvedValue(null);
  mockPrisma.auditoriaEvento.findMany.mockResolvedValue([]);
}

beforeAll(async () => {
  const mod = await import('../lgpd.service.js');
  exportarDadosUsuario = mod.exportarDadosUsuario;
  anonimizarUsuario = mod.anonimizarUsuario;
  minimizarDados = mod.minimizarDados;
});

beforeEach(() => {
  jest.clearAllMocks();
  buildEmptyMocks();
  mockPrisma.$transaction.mockImplementation((ops) => Promise.all(ops));
});

describe('minimizarDados', () => {
  test('returns only the allowed fields', () => {
    const obj = { id: '1', nome: 'Alice', senha_hash: 'secret', extra: 'x' };
    const result = minimizarDados(obj, ['id', 'nome']);
    expect(result).toEqual({ id: '1', nome: 'Alice' });
  });

  test('ignores fields not in the object', () => {
    const obj = { id: '1' };
    const result = minimizarDados(obj, ['id', 'nome']);
    expect(result).toEqual({ id: '1' });
  });

  test('returns input unchanged for non-objects', () => {
    expect(minimizarDados('string', ['a'])).toBe('string');
    expect(minimizarDados(null, ['a'])).toBeNull();
  });
});

describe('exportarDadosUsuario', () => {
  test('returns structured data object with all sections', async () => {
    const result = await exportarDadosUsuario(USUARIO_ID);

    expect(result).toHaveProperty('usuario');
    expect(result).toHaveProperty('sessoes');
    expect(result).toHaveProperty('eventos_auth');
    expect(result).toHaveProperty('contas');
    expect(result).toHaveProperty('contas_pagar');
    expect(result).toHaveProperty('contas_receber');
    expect(result).toHaveProperty('movimentacoes');
    expect(result).toHaveProperty('investimentos');
    expect(result).toHaveProperty('metas');
    expect(result).toHaveProperty('assinante');
    expect(result).toHaveProperty('auditoria_eventos');
    expect(result).toHaveProperty('exportado_em');
  });

  test('does not include senha_hash in usuario data', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: USUARIO_ID,
      nome: 'Alice',
      email: 'alice@test.com',
      senha_hash: 'SHOULD_NOT_APPEAR',
    });
    const result = await exportarDadosUsuario(USUARIO_ID);
    expect(result.usuario).not.toHaveProperty('senha_hash');
  });

  test('includes usuario name and email', async () => {
    const result = await exportarDadosUsuario(USUARIO_ID);
    expect(result.usuario.nome).toBe('Alice');
    expect(result.usuario.email).toBe('alice@test.com');
  });

  test('queries all Prisma models', async () => {
    await exportarDadosUsuario(USUARIO_ID);
    expect(mockPrisma.usuario.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.conta.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.contaPagar.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.investimento.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('anonimizarUsuario', () => {
  test('calls prisma.$transaction with update and updateMany', async () => {
    await anonimizarUsuario(USUARIO_ID, { ip: '127.0.0.1' });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test('updates usuario with anonymized values', async () => {
    await anonimizarUsuario(USUARIO_ID);

    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USUARIO_ID },
        data: expect.objectContaining({
          nome: 'Usuário Removido',
          email: `removed_${USUARIO_ID}@finlly.deleted`,
          telefone: null,
          avatar_url: null,
          whatsapp: null,
        }),
      })
    );
  });

  test('revokes all active sessions', async () => {
    await anonimizarUsuario(USUARIO_ID);

    expect(mockPrisma.usuarioSessao.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuario_id: USUARIO_ID, data_revogacao: null },
        data: expect.objectContaining({ data_revogacao: expect.any(Date) }),
      })
    );
  });

  test('registers audit event after anonymization', async () => {
    await anonimizarUsuario(USUARIO_ID, { ip: '1.2.3.4', userAgent: 'test' });

    expect(mockRegistrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: USUARIO_ID,
        tipo: 'conta_usuario_excluida',
        sucesso: true,
      })
    );
  });

  test('logs info message after anonymization', async () => {
    await anonimizarUsuario(USUARIO_ID);
    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.objectContaining({ msg: expect.stringContaining('anonimizado') })
    );
  });
});
