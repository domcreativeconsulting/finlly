import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockFindFirst = jest.fn();
const mockJobUpdate = jest.fn();
const mockOcrUpdate = jest.fn();

const mockPrisma = {
  job: {
    findFirst: mockFindFirst,
    update: mockJobUpdate,
  },
  anexoOcrResultado: {
    update: mockOcrUpdate,
  },
};

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: mockPrisma,
}));

const mockProcessarDocumento = jest.fn();

jest.unstable_mockModule('../../services/ocrService.js', () => ({
  processarDocumento: mockProcessarDocumento,
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: { OCR_JOB_INTERVAL_MS: 5000 },
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
let startOcrJob;
let stopOcrJob;

beforeAll(async () => {
  const mod = await import('../ocr.job.js');
  startOcrJob = mod.startOcrJob;
  stopOcrJob = mod.stopOcrJob;
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  stopOcrJob();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const PENDING_JOB = {
  id: 1n,
  tipo: 'ocr_processar',
  status: 'pendente',
  tentativas: 0,
  max_tentativas: 3,
  payload: { anexo_id: 'anexo-uuid-001', file_path: '/uploads/user/file.pdf', mime_type: 'application/pdf' },
};

describe('startOcrJob', () => {
  test('inicia sem erros quando não há jobs pendentes', async () => {
    mockFindFirst.mockResolvedValue(null);

    startOcrJob();
    await Promise.resolve();

    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockJobUpdate).not.toHaveBeenCalled();
  });

  test('agenda próximo ciclo após execução sem jobs', async () => {
    mockFindFirst.mockResolvedValue(null);

    startOcrJob();
    await Promise.resolve();

    expect(jest.getTimerCount()).toBe(1);
  });

  test('processa job pendente com sucesso', async () => {
    mockFindFirst.mockResolvedValue(PENDING_JOB);
    mockJobUpdate.mockResolvedValue({});
    mockOcrUpdate.mockResolvedValue({});
    mockProcessarDocumento.mockResolvedValue({
      extractedAmount: 100.5,
      extractedDate: '2024-01-15',
      extractedDescription: 'Boleto teste',
      extractedType: 'boleto',
      confidenceScore: 0.9,
      rawText: 'texto extraído',
    });

    startOcrJob();
    await Promise.resolve();
    // allow async operations to complete
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1n }, data: expect.objectContaining({ status: 'processando' }) }),
    );
    expect(mockProcessarDocumento).toHaveBeenCalledWith({
      anexoId: 'anexo-uuid-001',
      filePath: '/uploads/user/file.pdf',
      mimeType: 'application/pdf',
    });
    expect(mockOcrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { anexo_id: 'anexo-uuid-001' }, data: expect.objectContaining({ status: 'PROCESSED' }) }),
    );
  });

  test('marca job como falhou após max_tentativas atingido', async () => {
    const jobQuaseFalhando = { ...PENDING_JOB, tentativas: 2, max_tentativas: 3 };
    mockFindFirst.mockResolvedValue(jobQuaseFalhando);
    mockJobUpdate.mockResolvedValue({});
    mockOcrUpdate.mockResolvedValue({});
    mockProcessarDocumento.mockRejectedValue(new Error('OCR timeout'));

    startOcrJob();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'falhou', tentativas: 3 }) }),
    );
    expect(mockOcrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  test('mantém job pendente quando tentativas < max_tentativas', async () => {
    const jobComErro = { ...PENDING_JOB, tentativas: 1, max_tentativas: 3 };
    mockFindFirst.mockResolvedValue(jobComErro);
    mockJobUpdate.mockResolvedValue({});
    mockProcessarDocumento.mockRejectedValue(new Error('Erro temporário'));

    startOcrJob();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pendente', tentativas: 2 }) }),
    );
    expect(mockOcrUpdate).not.toHaveBeenCalled();
  });

  test('agenda próxima execução mesmo após erro no ciclo principal', async () => {
    mockFindFirst.mockRejectedValue(new Error('DB error'));

    startOcrJob();
    await Promise.resolve();

    expect(jest.getTimerCount()).toBe(1);
  });
});

describe('stopOcrJob', () => {
  test('cancela timeout agendado', async () => {
    mockFindFirst.mockResolvedValue(null);

    startOcrJob();
    await Promise.resolve();

    expect(jest.getTimerCount()).toBe(1);
    stopOcrJob();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('não lança erro se chamado sem job ativo', () => {
    expect(() => stopOcrJob()).not.toThrow();
  });
});
