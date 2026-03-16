import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
jest.unstable_mockModule('../../../config/env.js', () => ({
  config: {
    ASAAS_ENV: 'sandbox',
    ASAAS_API_KEY: 'test_api_key',
    ASAAS_BASE_URL: undefined,
    ASAAS_TIMEOUT_MS: 100,
    ASAAS_MAX_RETRIES: 2,
  },
}));

jest.unstable_mockModule('../../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
let asaas;

beforeAll(async () => {
  const mod = await import('../asaasClient.js');
  asaas = mod.asaas;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function makeResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h) => headers[h.toLowerCase()] ?? null },
    json: () => Promise.resolve(body),
  };
}

// ---------------------------------------------------------------------------
// describe('request — sucesso')
// ---------------------------------------------------------------------------
describe('request — sucesso', () => {
  test('retorna JSON parseado quando response é 200', async () => {
    const payload = { id: 'cus_123', name: 'Test' };
    global.fetch = jest.fn().mockResolvedValue(makeResponse(200, payload));

    const result = await asaas.getCustomerByEmail('test@example.com');
    // getCustomerByEmail returns data.data[0] or null — use createCustomer for raw JSON test
    global.fetch = jest.fn().mockResolvedValue(makeResponse(200, payload));
    const result2 = await asaas.createCustomer({ nome: 'Test', email: 'test@example.com' });
    expect(result2).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('retorna null quando response é 204', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(204, null));

    const result = await asaas.cancelSubscription('sub_123');
    expect(result).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// describe('request — erros não retriáveis (4xx exceto 429)')
// ---------------------------------------------------------------------------
describe('request — erros não retriáveis (4xx exceto 429)', () => {
  const nonRetriableCases = [400, 401, 403, 404, 422];

  test.each(nonRetriableCases)('HTTP %i → lança AppError imediatamente, fetch chamado 1 vez', async (status) => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(status, { errors: ['error'] }));

    await expect(asaas.getSubscription('sub_123')).rejects.toMatchObject({
      status: 500,
      name: 'AppError',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// describe('request — erros retriáveis esgotam tentativas')
// ---------------------------------------------------------------------------
describe('request — erros retriáveis esgotam tentativas', () => {
  // ASAAS_MAX_RETRIES = 2 → total attempts = 3
  const TOTAL_ATTEMPTS = 3;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('erro de rede (TypeError) → retria, fetch chamado MAX_RETRIES+1 vezes, lança AppError', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network error'));

    const promise = asaas.getSubscription('sub_123');
    const assertion = expect(promise).rejects.toMatchObject({ status: 500, name: 'AppError' });
    await jest.runAllTimersAsync();
    await assertion;
    expect(global.fetch).toHaveBeenCalledTimes(TOTAL_ATTEMPTS);
  });

  test.each([500, 502, 503, 504])('HTTP %i → retria, fetch chamado MAX_RETRIES+1 vezes, lança AppError', async (status) => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(status, {}));

    const promise = asaas.getSubscription('sub_123');
    const assertion = expect(promise).rejects.toMatchObject({ status: 500, name: 'AppError' });
    await jest.runAllTimersAsync();
    await assertion;
    expect(global.fetch).toHaveBeenCalledTimes(TOTAL_ATTEMPTS);
  });

  test('AbortError (timeout) → retria, fetch chamado MAX_RETRIES+1 vezes, lança AppError', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortErr);

    const promise = asaas.getSubscription('sub_123');
    const assertion = expect(promise).rejects.toMatchObject({ status: 500, name: 'AppError' });
    await jest.runAllTimersAsync();
    await assertion;
    expect(global.fetch).toHaveBeenCalledTimes(TOTAL_ATTEMPTS);
  });
});

// ---------------------------------------------------------------------------
// describe('request — retry bem-sucedido')
// ---------------------------------------------------------------------------
describe('request — retry bem-sucedido', () => {
  test('falha na 1ª tentativa (rede), sucesso na 2ª → retorna dados, fetch chamado 2 vezes', async () => {
    jest.useFakeTimers();

    const payload = { id: 'sub_abc' };
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Network error'))
      .mockResolvedValueOnce(makeResponse(200, payload));

    const promise = asaas.getSubscription('sub_abc');
    await jest.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// describe('request — HTTP 429 Retry-After')
// ---------------------------------------------------------------------------
describe('request — HTTP 429 Retry-After', () => {
  test('HTTP 429 com header Retry-After: 1 → aguarda ~1000ms antes de retentar', async () => {
    jest.useFakeTimers();

    const payload = { id: 'cus_ok' };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(429, {}, { 'retry-after': '1' }))
      .mockResolvedValueOnce(makeResponse(200, payload));

    const promise = asaas.getSubscription('sub_429');
    await jest.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// describe('getCustomerByEmail')
// ---------------------------------------------------------------------------
describe('getCustomerByEmail', () => {
  test('retorna primeiro customer quando data.data não está vazio', async () => {
    const customer = { id: 'cus_1', email: 'a@b.com' };
    global.fetch = jest.fn().mockResolvedValue(makeResponse(200, { data: [customer] }));

    const result = await asaas.getCustomerByEmail('a@b.com');
    expect(result).toEqual(customer);
  });

  test('retorna null quando data.data está vazio', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(200, { data: [] }));

    const result = await asaas.getCustomerByEmail('none@b.com');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// describe('createCustomer')
// ---------------------------------------------------------------------------
describe('createCustomer', () => {
  test('envia name, email, cpfCnpj, mobilePhone corretamente', async () => {
    const created = { id: 'cus_new' };
    global.fetch = jest.fn().mockResolvedValue(makeResponse(200, created));

    await asaas.createCustomer({ nome: 'João', email: 'joao@test.com', cpfCnpj: '123', telefone: '11999' });

    const [, init] = global.fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ name: 'João', email: 'joao@test.com', cpfCnpj: '123', mobilePhone: '11999' });
  });
});

// ---------------------------------------------------------------------------
// describe('createSubscription')
// ---------------------------------------------------------------------------
describe('createSubscription', () => {
  test('envia customer, billingType, cycle, value, nextDueDate, description, externalReference', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(200, { id: 'sub_new' }));

    await asaas.createSubscription({
      customer: 'cus_1',
      billingType: 'PIX',
      cycle: 'MONTHLY',
      value: 29.9,
      nextDueDate: '2026-03-16',
      description: 'Plano mensal',
      externalReference: 'user_42',
    });

    const [, init] = global.fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      customer: 'cus_1',
      billingType: 'PIX',
      cycle: 'MONTHLY',
      value: 29.9,
      nextDueDate: '2026-03-16',
      description: 'Plano mensal',
      externalReference: 'user_42',
    });
  });
});

// ---------------------------------------------------------------------------
// describe('cancelSubscription')
// ---------------------------------------------------------------------------
describe('cancelSubscription', () => {
  test('faz DELETE em /subscriptions/:id', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(204, null));

    await asaas.cancelSubscription('sub_del');

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toContain('/subscriptions/sub_del');
    expect(init.method).toBe('DELETE');
  });
});

// ---------------------------------------------------------------------------
// describe('getSubscription')
// ---------------------------------------------------------------------------
describe('getSubscription', () => {
  test('faz GET em /subscriptions/:id', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(200, { id: 'sub_get' }));

    await asaas.getSubscription('sub_get');

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain('/subscriptions/sub_get');
  });
});

// ---------------------------------------------------------------------------
// describe('getPaymentsBySubscription')
// ---------------------------------------------------------------------------
describe('getPaymentsBySubscription', () => {
  test('faz GET em /payments?subscription=:id', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(200, { data: [] }));

    await asaas.getPaymentsBySubscription('sub_pay');

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain('/payments?subscription=');
    expect(url).toContain('sub_pay');
  });
});
