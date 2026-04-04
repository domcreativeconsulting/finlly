import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockFindMany = jest.fn();
const mockListContasPagar = jest.fn();

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: {
    usuario: { findMany: mockFindMany },
  },
}));

jest.unstable_mockModule('../../services/contasPagarService.js', () => ({
  listContasPagar: mockListContasPagar,
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
let buscarUsuariosComWhatsapp;
let buscarContasDoDia;

beforeAll(async () => {
  const mod = await import('../contasPagarDiariaService.js');
  buscarUsuariosComWhatsapp = mod.buscarUsuariosComWhatsapp;
  buscarContasDoDia = mod.buscarContasDoDia;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buscarUsuariosComWhatsapp', () => {
  test('chama prisma.usuario.findMany com filtros corretos', async () => {
    const expected = [{ id: 'u1', nome: 'Ana', whatsapp: '5511999990001' }];
    mockFindMany.mockResolvedValue(expected);

    const result = await buscarUsuariosComWhatsapp();

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        whatsapp: { not: null },
        status: 'ativo',
        deleted_at: null,
      },
      select: { id: true, nome: true, whatsapp: true },
    });
    expect(result).toEqual(expected);
  });

  test('retorna lista vazia quando não há usuários com WhatsApp', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await buscarUsuariosComWhatsapp();
    expect(result).toEqual([]);
  });
});

describe('buscarContasDoDia', () => {
  test('chama listContasPagar duas vezes (hoje + atrasadas)', async () => {
    mockListContasPagar.mockResolvedValue({ data: [] });
    await buscarContasDoDia('u1');
    expect(mockListContasPagar).toHaveBeenCalledTimes(2);
  });

  test('busca contas de hoje com filtros corretos', async () => {
    mockListContasPagar.mockResolvedValue({ data: [] });
    const dataHoje = new Date().toISOString().slice(0, 10);
    await buscarContasDoDia('u1');

    expect(mockListContasPagar).toHaveBeenCalledWith('u1', {
      status: 'pendente',
      data_vencimento_de: dataHoje,
      data_vencimento_ate: dataHoje,
      limit: 50,
    });
  });

  test('busca contas atrasadas com data_vencimento_ate = ontem', async () => {
    mockListContasPagar.mockResolvedValue({ data: [] });
    const ontem = new Date();
    ontem.setUTCDate(ontem.getUTCDate() - 1);
    const dataOntem = ontem.toISOString().slice(0, 10);

    await buscarContasDoDia('u1');

    expect(mockListContasPagar).toHaveBeenCalledWith('u1', {
      status: 'pendente',
      data_vencimento_ate: dataOntem,
      limit: 50,
    });
  });

  test('retorna { hoje, atrasadas } com os dados corretos', async () => {
    const contasHoje = [{ id: 'c1', descricao: 'Aluguel', valor: 1500 }];
    const contasAtrasadas = [{ id: 'c2', descricao: 'Energia', valor: 200 }];

    mockListContasPagar
      .mockResolvedValueOnce({ data: contasHoje })
      .mockResolvedValueOnce({ data: contasAtrasadas });

    const result = await buscarContasDoDia('u1');

    expect(result).toEqual({ hoje: contasHoje, atrasadas: contasAtrasadas });
  });

  test('retorna { hoje: [], atrasadas: [] } quando não há contas', async () => {
    mockListContasPagar.mockResolvedValue({ data: [] });
    const result = await buscarContasDoDia('u1');
    expect(result).toEqual({ hoje: [], atrasadas: [] });
  });
});
