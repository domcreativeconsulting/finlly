import { jest } from '@jest/globals';

let sanitizeResponse;

beforeAll(async () => {
  const mod = await import('../sanitizeResponse.js');
  sanitizeResponse = mod.sanitizeResponse;
});

function makeReq() {
  return {};
}

function makeRes() {
  let lastBody = null;
  const res = {
    _sentBody: null,
    json(body) {
      res._sentBody = body;
      return res;
    },
  };
  return res;
}

describe('sanitizeResponse middleware', () => {
  test('calls next()', () => {
    const res = makeRes();
    const next = jest.fn();
    sanitizeResponse(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('overrides res.json on the response object', () => {
    const res = makeRes();
    const originalJson = res.json;
    const next = jest.fn();
    sanitizeResponse(makeReq(), res, next);
    expect(res.json).not.toBe(originalJson);
  });

  test('removes senha_hash from response body', () => {
    const res = makeRes();
    sanitizeResponse(makeReq(), res, jest.fn());
    res.json({ id: '1', nome: 'Alice', senha_hash: '$2b$10$secrethash' });
    expect(res._sentBody).not.toHaveProperty('senha_hash');
    expect(res._sentBody.nome).toBe('Alice');
  });

  test('removes refresh_token_hash from response body', () => {
    const res = makeRes();
    sanitizeResponse(makeReq(), res, jest.fn());
    res.json({ id: '1', refresh_token_hash: 'abc123' });
    expect(res._sentBody).not.toHaveProperty('refresh_token_hash');
  });

  test('removes token_hash from response body', () => {
    const res = makeRes();
    sanitizeResponse(makeReq(), res, jest.fn());
    res.json({ id: '1', token_hash: 'xyz' });
    expect(res._sentBody).not.toHaveProperty('token_hash');
  });

  test('removes senha from response body', () => {
    const res = makeRes();
    sanitizeResponse(makeReq(), res, jest.fn());
    res.json({ id: '1', senha: 'plaintext' });
    expect(res._sentBody).not.toHaveProperty('senha');
  });

  test('keeps non-sensitive fields intact', () => {
    const res = makeRes();
    sanitizeResponse(makeReq(), res, jest.fn());
    res.json({ id: '1', nome: 'Bob', email: 'bob@test.com' });
    expect(res._sentBody).toEqual({ id: '1', nome: 'Bob', email: 'bob@test.com' });
  });

  test('removes sensitive fields nested in objects', () => {
    const res = makeRes();
    sanitizeResponse(makeReq(), res, jest.fn());
    res.json({ usuario: { id: '1', senha_hash: 'hash', nome: 'Alice' } });
    expect(res._sentBody.usuario).not.toHaveProperty('senha_hash');
    expect(res._sentBody.usuario.nome).toBe('Alice');
  });

  test('removes sensitive fields from objects inside arrays', () => {
    const res = makeRes();
    sanitizeResponse(makeReq(), res, jest.fn());
    res.json([
      { id: '1', senha_hash: 'h1', nome: 'Alice' },
      { id: '2', senha_hash: 'h2', nome: 'Bob' },
    ]);
    expect(res._sentBody[0]).not.toHaveProperty('senha_hash');
    expect(res._sentBody[1]).not.toHaveProperty('senha_hash');
    expect(res._sentBody[0].nome).toBe('Alice');
  });

  test('passes null and undefined values through unchanged', () => {
    const res = makeRes();
    sanitizeResponse(makeReq(), res, jest.fn());
    res.json(null);
    expect(res._sentBody).toBeNull();
  });

  test('removes multiple sensitive fields in a single object', () => {
    const res = makeRes();
    sanitizeResponse(makeReq(), res, jest.fn());
    res.json({
      id: '1',
      senha_hash: 'h',
      refresh_token_hash: 'r',
      token_hash: 't',
      senha: 'p',
      nome: 'Alice',
    });
    expect(res._sentBody).not.toHaveProperty('senha_hash');
    expect(res._sentBody).not.toHaveProperty('refresh_token_hash');
    expect(res._sentBody).not.toHaveProperty('token_hash');
    expect(res._sentBody).not.toHaveProperty('senha');
    expect(res._sentBody.nome).toBe('Alice');
  });
});
