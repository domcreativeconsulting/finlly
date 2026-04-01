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

beforeAll(async () => {
  const mod = await import('../attachmentProcessingService.js');
  processAttachment = mod.processAttachment;
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

    // Must call update at least 3 times: PROCESSING, (optional increment), PROCESSED
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

  test('AC5: falha de OCR → status FAILED registrado, erro propagado (não mascarado)', async () => {
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockOcrUpdate.mockResolvedValue({});
    const ocrError = new Error('OCR provider unavailable');
    mockProcessarDocumento.mockRejectedValue(ocrError);

    await expect(processAttachment({ attachmentId: ATTACHMENT_ID })).rejects.toThrow('OCR provider unavailable');

    const failedCall = mockOcrUpdate.mock.calls.find((c) => c[0]?.data?.status === 'FAILED');
    expect(failedCall).toBeDefined();
    expect(failedCall[0].data.error_message).toBe('OCR provider unavailable');
    // Must NOT have a PROCESSED call
    const processedCall = mockOcrUpdate.mock.calls.find((c) => c[0]?.data?.status === 'PROCESSED');
    expect(processedCall).toBeUndefined();
  });

  test('AC5: falha de persistência → status FAILED registrado, erro propagado (não mascarado)', async () => {
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockProcessarDocumento.mockResolvedValue(MOCK_OCR_RESULT);

    const persistError = new Error('DB connection lost');
    // First calls (PROCESSING, increment) succeed; last call (PROCESSED update) fails, then FAILED update succeeds
    mockOcrUpdate
      .mockResolvedValueOnce({}) // PROCESSING
      .mockResolvedValueOnce({}) // increment (optional)
      .mockRejectedValueOnce(persistError) // PROCESSED fails
      .mockResolvedValueOnce({}); // FAILED update

    await expect(processAttachment({ attachmentId: ATTACHMENT_ID })).rejects.toThrow('DB connection lost');

    const failedCall = mockOcrUpdate.mock.calls.find((c) => c[0]?.data?.status === 'FAILED');
    expect(failedCall).toBeDefined();
    expect(failedCall[0].data.error_message).toBe('DB connection lost');
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

  test('lança NOT_FOUND quando anexo não existe', async () => {
    mockAnexoFindFirst.mockResolvedValue(null);

    await expect(processAttachment({ attachmentId: ATTACHMENT_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});
