import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockAnexoFindFirst = jest.fn();
const mockOcrUpdate = jest.fn();

const mockPrisma = {
  anexo: { findFirst: mockAnexoFindFirst },
  anexoOcrResultado: { update: mockOcrUpdate },
};

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: mockPrisma,
}));

const mockProcessarDocumento = jest.fn();

jest.unstable_mockModule('../../services/ocrService.js', () => ({
  processarDocumento: mockProcessarDocumento,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
let processAttachment;
let PermanentError;

beforeAll(async () => {
  const mod = await import('../attachmentProcessingService.js');
  processAttachment = mod.processAttachment;
  const errMod = await import('../../errors/PermanentError.js');
  PermanentError = errMod.PermanentError;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ATTACHMENT_ID = 'attachment-uuid-001';

const MOCK_ANEXO = {
  id: ATTACHMENT_ID,
  storage_path: '/uploads/user/file.pdf',
  mime_type: 'application/pdf',
  deleted_at: null,
  ocr_resultado: { status: 'UPLOADED' },
};

const MOCK_OCR_RESULT = {
  extractedAmount: 250.0,
  extractedDate: '2026-04-01',
  extractedDescription: 'Nota fiscal serviços',
  extractedType: 'invoice',
  confidenceScore: 0.92,
  rawText: 'Texto bruto extraído do documento.',
  structuredJson: {
    amount: 250.0,
    date: '2026-04-01',
    description: 'Nota fiscal serviços',
    documentType: 'invoice',
    confidence: 0.92,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processAttachment', () => {
  test('AC1+AC2+AC4: persiste raw_text, extracted_json e status PROCESSED após sucesso', async () => {
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockOcrUpdate.mockResolvedValue({});
    mockProcessarDocumento.mockResolvedValue(MOCK_OCR_RESULT);

    const result = await processAttachment({ attachmentId: ATTACHMENT_ID });

    // Must call update at least twice: PROCESSING (with increment), PROCESSED
    const calls = mockOcrUpdate.mock.calls;
    const processedCall = calls.find((c) => c[0]?.data?.status === 'PROCESSED');

    expect(processedCall).toBeDefined();
    expect(processedCall[0].data).toMatchObject({
      status: 'PROCESSED',
      raw_text: MOCK_OCR_RESULT.rawText,
      extracted_json: MOCK_OCR_RESULT.structuredJson,
    });
    expect(processedCall[0].data.processed_at).toBeInstanceOf(Date);
    expect(result).toBe(MOCK_OCR_RESULT);
  });

  test('AC3: vínculo correto — update usa o attachmentId correto', async () => {
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockOcrUpdate.mockResolvedValue({});
    mockProcessarDocumento.mockResolvedValue(MOCK_OCR_RESULT);

    await processAttachment({ attachmentId: ATTACHMENT_ID });

    const processedCall = mockOcrUpdate.mock.calls.find((c) => c[0]?.data?.status === 'PROCESSED');
    expect(processedCall[0].where).toEqual({ anexo_id: ATTACHMENT_ID });
  });

  test('AC2: incrementa processing_attempts e persiste processing_started_at no update PROCESSING', async () => {
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockOcrUpdate.mockResolvedValue({});
    mockProcessarDocumento.mockResolvedValue(MOCK_OCR_RESULT);

    await processAttachment({ attachmentId: ATTACHMENT_ID, jobId: 'job-42' });

    const processingCall = mockOcrUpdate.mock.calls.find((c) => c[0]?.data?.status === 'PROCESSING');
    expect(processingCall).toBeDefined();
    expect(processingCall[0].data.processing_attempts).toEqual({ increment: 1 });
    expect(processingCall[0].data.processing_started_at).toBeInstanceOf(Date);
    expect(processingCall[0].data.bullmq_job_id).toBe('job-42');
  });

  test('AC5: falha de OCR → status FAILED com failed_at registrado, erro propagado (não mascarado)', async () => {
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockOcrUpdate.mockResolvedValue({});
    const ocrError = new Error('OCR provider unavailable');
    mockProcessarDocumento.mockRejectedValue(ocrError);

    await expect(processAttachment({ attachmentId: ATTACHMENT_ID })).rejects.toThrow('OCR provider unavailable');

    const failedCall = mockOcrUpdate.mock.calls.find((c) => c[0]?.data?.status === 'FAILED');
    expect(failedCall).toBeDefined();
    expect(failedCall[0].data.error_message).toBe('OCR provider unavailable');
    expect(failedCall[0].data.failed_at).toBeInstanceOf(Date);
    // Must NOT have a PROCESSED call
    const processedCall = mockOcrUpdate.mock.calls.find((c) => c[0]?.data?.status === 'PROCESSED');
    expect(processedCall).toBeUndefined();
  });

  test('AC5: falha de persistência → status FAILED com failed_at registrado, erro propagado (não mascarado)', async () => {
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockProcessarDocumento.mockResolvedValue(MOCK_OCR_RESULT);

    const persistError = new Error('DB connection lost');
    // First call (PROCESSING with increment) succeeds; PROCESSED update fails, then FAILED update succeeds
    mockOcrUpdate
      .mockResolvedValueOnce({}) // PROCESSING
      .mockRejectedValueOnce(persistError) // PROCESSED fails
      .mockResolvedValueOnce({}); // FAILED update

    await expect(processAttachment({ attachmentId: ATTACHMENT_ID })).rejects.toThrow('DB connection lost');

    const failedCall = mockOcrUpdate.mock.calls.find((c) => c[0]?.data?.status === 'FAILED');
    expect(failedCall).toBeDefined();
    expect(failedCall[0].data.error_message).toBe('DB connection lost');
    expect(failedCall[0].data.failed_at).toBeInstanceOf(Date);
    expect(mockOcrUpdate).toHaveBeenCalledTimes(3);
  });

  test('AC6: structuredJson nulo → extracted_json gravado como null sem erro', async () => {
    const resultWithoutJson = { ...MOCK_OCR_RESULT, structuredJson: null };
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockOcrUpdate.mockResolvedValue({});
    mockProcessarDocumento.mockResolvedValue(resultWithoutJson);

    const result = await processAttachment({ attachmentId: ATTACHMENT_ID });

    const processedCall = mockOcrUpdate.mock.calls.find((c) => c[0]?.data?.status === 'PROCESSED');
    expect(processedCall).toBeDefined();
    expect(processedCall[0].data.extracted_json).toBeNull();
    expect(processedCall[0].data.raw_text).toBe(MOCK_OCR_RESULT.rawText);
    expect(result).toBe(resultWithoutJson);
  });

  test('ignora reprocessamento quando status já é PROCESSED', async () => {
    const processedAnexo = { ...MOCK_ANEXO, ocr_resultado: { status: 'PROCESSED' } };
    mockAnexoFindFirst.mockResolvedValue(processedAnexo);

    const result = await processAttachment({ attachmentId: ATTACHMENT_ID });

    expect(result).toBeNull();
    expect(mockOcrUpdate).not.toHaveBeenCalled();
    expect(mockProcessarDocumento).not.toHaveBeenCalled();
  });

  test('AC5 (PermanentError): lança PermanentError quando anexo não existe — não deve ser retentado', async () => {
    mockAnexoFindFirst.mockResolvedValue(null);

    await expect(processAttachment({ attachmentId: ATTACHMENT_ID })).rejects.toMatchObject({
      name: 'PermanentError',
      permanent: true,
      message: `Anexo não encontrado ou removido: ${ATTACHMENT_ID}`,
    });
  });
});

