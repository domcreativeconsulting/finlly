// ... other imports

jest.unstable_mockModule('express-rate-limit', () => ({
  rateLimit: () => (_req, _res, next) => next(),
  ipKeyGenerator: (req) => req.ip || '127.0.0.1',
}));

// ... rest of the file content unchanged
