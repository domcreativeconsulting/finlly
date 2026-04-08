/**
 * Tests for trust proxy configuration.
 *
 * Verifies that when app.set('trust proxy', N) is configured, req.ip
 * reflects the X-Forwarded-For header instead of the proxy's IP address,
 * which is required for per-IP rate limiting to work correctly in production.
 */
import express from 'express';
import http from 'node:http';

/**
 * Creates an Express app with an optional trust proxy setting and a /ip endpoint.
 * @param {{ trustProxy?: number|false }} options
 */
function makeApp({ trustProxy } = {}) {
  const app = express();
  if (trustProxy !== undefined && trustProxy > 0) {
    app.set('trust proxy', trustProxy);
  }
  app.get('/ip', (req, res) => {
    res.json({ ip: req.ip });
  });
  return app;
}

/**
 * Starts the app on a random port and returns { server, port }.
 * @param {import('express').Application} app
 */
function startServer(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

/**
 * Makes a GET request to /ip with optional X-Forwarded-For header.
 * @param {number} port
 * @param {string|undefined} xForwardedFor
 * @returns {Promise<{ ip: string }>}
 */
function getIp(port, xForwardedFor) {
  return new Promise((resolve, reject) => {
    const headers = { host: '127.0.0.1' };
    if (xForwardedFor) headers['x-forwarded-for'] = xForwardedFor;

    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/ip', method: 'GET', headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('trust proxy — req.ip resolution', () => {
  test('without trust proxy, req.ip is the socket remote address (proxy IP)', async () => {
    const app = makeApp(); // no trust proxy
    const { server, port } = await startServer(app);
    try {
      const body = await getIp(port, '203.0.113.42');
      // Without trust proxy, Express ignores X-Forwarded-For; req.ip is the
      // loopback address of the connecting socket (127.0.0.1 or ::ffff:127.0.0.1).
      expect(body.ip).not.toBe('203.0.113.42');
      expect(['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(body.ip)).toBe(true);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  test('with trust proxy = 1, req.ip reflects X-Forwarded-For', async () => {
    const app = makeApp({ trustProxy: 1 });
    const { server, port } = await startServer(app);
    try {
      const body = await getIp(port, '203.0.113.42');
      expect(body.ip).toBe('203.0.113.42');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  test('with trust proxy = 1, uses the rightmost X-Forwarded-For IP for two-hop chain', async () => {
    // With trust proxy = 1, when connecting from a loopback address (127.0.0.1),
    // Express trusts 1 hop from the socket. For XFF "client, proxy1", the
    // rightmost entry (proxy1 / 10.0.0.1) is trusted, so req.ip = 10.0.0.1.
    // To reach the original client IP (203.0.113.42) from a two-hop chain,
    // trust proxy = 2 is required.
    const app = makeApp({ trustProxy: 1 });
    const { server, port } = await startServer(app);
    try {
      const body = await getIp(port, '203.0.113.42, 10.0.0.1');
      expect(body.ip).toBe('10.0.0.1');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  test('with trust proxy = 2, req.ip resolves through a two-hop chain to the original client IP', async () => {
    // With trust proxy = 2, Express trusts 2 hops: the loopback socket (127.0.0.1)
    // plus 10.0.0.1 (the intermediate proxy), so req.ip becomes 203.0.113.42.
    const app = makeApp({ trustProxy: 2 });
    const { server, port } = await startServer(app);
    try {
      const body = await getIp(port, '203.0.113.42, 10.0.0.1');
      expect(body.ip).toBe('203.0.113.42');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  test('different X-Forwarded-For values produce different req.ip values', async () => {
    const app = makeApp({ trustProxy: 1 });
    const { server, port } = await startServer(app);
    try {
      const [body1, body2] = await Promise.all([
        getIp(port, '1.2.3.4'),
        getIp(port, '5.6.7.8'),
      ]);
      expect(body1.ip).toBe('1.2.3.4');
      expect(body2.ip).toBe('5.6.7.8');
      expect(body1.ip).not.toBe(body2.ip);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});

/**
 * Parses the TRUST_PROXY env string value (as index.js does) and returns
 * the effective trust proxy value, or false when it should be disabled.
 * @param {string} raw
 * @returns {number|false}
 */
function parseTrustProxy(raw) {
  return raw === 'false' ? false : Number(raw);
}

/**
 * Returns whether app.set('trust proxy', N) would be called for the given
 * TRUST_PROXY env string, mirroring the logic in index.js.
 * @param {string} raw
 * @returns {boolean}
 */
function wouldEnableTrustProxy(raw) {
  const v = parseTrustProxy(raw);
  return v !== false && v > 0;
}

describe('TRUST_PROXY env config parsing', () => {
  test("TRUST_PROXY='false' disables trust proxy", () => {
    expect(parseTrustProxy('false')).toBe(false);
    expect(wouldEnableTrustProxy('false')).toBe(false);
  });

  test("TRUST_PROXY='0' disables trust proxy", () => {
    expect(parseTrustProxy('0')).toBe(0);
    expect(wouldEnableTrustProxy('0')).toBe(false);
  });

  test("TRUST_PROXY='1' (default) enables trust proxy with value 1", () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(wouldEnableTrustProxy('1')).toBe(true);
  });

  test("TRUST_PROXY='2' enables trust proxy with value 2", () => {
    expect(parseTrustProxy('2')).toBe(2);
    expect(wouldEnableTrustProxy('2')).toBe(true);
  });
});
