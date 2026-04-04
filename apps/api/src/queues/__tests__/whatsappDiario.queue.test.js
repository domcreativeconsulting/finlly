import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockAdd = jest.fn();
const MockQueue = jest.fn(() => ({ add: mockAdd }));

jest.unstable_mockModule('bullmq', () => ({
  Queue: MockQueue,
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    REDIS_URL: 'redis://localhost:6379',
    WHATSAPP_DIARIO_JOB_ATTEMPTS: 3,
    WHATSAPP_DIARIO_JOB_BACKOFF_DELAY_MS: 5000,
  },
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
let addWhatsappDiarioJob;
let WHATSAPP_DIARIO_QUEUE_NAME;

beforeAll(async () => {
  const mod = await import('../whatsappDiario.queue.js');
  addWhatsappDiarioJob = mod.addWhatsappDiarioJob;
  WHATSAPP_DIARIO_QUEUE_NAME = mod.WHATSAPP_DIARIO_QUEUE_NAME;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WHATSAPP_DIARIO_QUEUE_NAME', () => {
  test('is "whatsapp-diario"', () => {
    expect(WHATSAPP_DIARIO_QUEUE_NAME).toBe('whatsapp-diario');
  });
});

describe('addWhatsappDiarioJob', () => {
  test('calls queue.add with the correct job name and data', async () => {
    const data = { usuarioId: 'u1', nome: 'Ana Silva', whatsapp: '5511999990001' };
    mockAdd.mockResolvedValue({ id: 'job-1' });

    await addWhatsappDiarioJob(data);

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(
      'send-resumo-diario',
      data,
      expect.objectContaining({ jobId: expect.stringMatching(/^resumo-diario-u1-\d{4}-\d{2}-\d{2}$/) }),
    );
  });

  test('uses jobId deduplication pattern resumo-diario-{usuarioId}-{YYYY-MM-DD}', async () => {
    const data = { usuarioId: 'abc-123', nome: 'Carlos', whatsapp: '5521999990002' };
    mockAdd.mockResolvedValue({ id: 'job-2' });

    await addWhatsappDiarioJob(data);

    const callArgs = mockAdd.mock.calls[0];
    const options = callArgs[2];
    const today = new Date().toISOString().slice(0, 10);
    expect(options.jobId).toBe(`resumo-diario-abc-123-${today}`);
  });

  test('returns the job returned by queue.add', async () => {
    const fakeJob = { id: 'job-42', data: {} };
    mockAdd.mockResolvedValue(fakeJob);

    const result = await addWhatsappDiarioJob({ usuarioId: 'u2', nome: 'Maria', whatsapp: '5531999990003' });

    expect(result).toBe(fakeJob);
  });
});
