import { jest } from '@jest/globals';
import { Buffer } from 'buffer';
import { AppError } from '../../errors/AppError.js';

const mockRegisterUser = jest.fn();

// express-rate-limit → passthrough em testes
jest.unstable_mockModule('express-rate-limit', () => ({
    rateLimit: () => (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../services/usuarioService.js', () => ({
    registerUser: mockRegisterUser,
}));

jest.unstable_mockModule('../../logger.js', () => ({
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
    config: { NODE_ENV: 'test', API_PORT: 3001, RATE_LIMIT_STORE: 'memory' },
}));

jest.unstable_mockModule('../../utils/rateLimitStore.js', () => ({
    buildStore: () => undefined,
}));

let usuariosRouter;
let express;

beforeAll(async () => {
    const expressMod = await import('express');
    express = expressMod.default;
    const mod = await import('../../routes/usuarios.js');
    usuariosRouter = mod.default;
});

beforeEach(() => {
    mockRegisterUser.mockReset();
});

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(usuariosRouter);
    app.use((err, req, res, _next) => {
        res.status(err.status || 500).json({ code: err.code, message: err.message, details: err.details });
    });
    return app;
}

async function request(app, method, path, body) {
    const { default: http } = await import('http');
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.listen(0, () => {
            const port = server.address().port;
            const data = body ? JSON.stringify(body) : undefined;
            const options = {
                hostname: 'localhost',
                port,
                path,
                method,
                headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), },
            };

            const req = http.request(options, (res) => {
                let rawData = '';
                res.on('data', (chunk) => (rawData += chunk));
                res.on('end', () => {
                    server.close(() => resolve({ status: res.statusCode, body: JSON.parse(rawData) }));
                });
            });
            req.on('error', (e) => {
                server.close(() => reject(e));
            });
            if (data) req.write(data);
            req.end();
        });
    });
}

describe('POST /usuarios', () => {
    test('returns 201 with created user on valid input', async () => {
        const fakeUsuario = {
            id: 'uuid-123',
            nome: 'João',
            email: 'joao@example.com',
            created_at: new Date().toISOString(),
            categorias_criadas: 16,
        };
        mockRegisterUser.mockResolvedValue(fakeUsuario);
        const app = makeApp();
        const res = await request(app, 'POST', '/usuarios', { nome: 'João', email: 'joao@example.com', senha: 'password123', });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Usuário criado com sucesso');
        expect(res.body.usuario.id).toBe('uuid-123');
        expect(res.body.usuario.categorias_criadas).toBe(16);
    });

    test('returns 422 when validation fails', async () => {
        const app = makeApp();
        const res = await request(app, 'POST', '/usuarios', { nome: '', email: 'not-an-email', senha: '123', });
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('returns 409 when email already exists (P2002)', async () => {
        const err = new Error('Unique constraint');
        err.code = 'P2002';
        mockRegisterUser.mockRejectedValue(err);
        const app = makeApp();
        const res = await request(app, 'POST', '/usuarios', { nome: 'João', email: 'joao@example.com', senha: 'password123', });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('CONFLICT');
    });

    test('returns 422 when required fields are missing', async () => {
        const app = makeApp();
        const res = await request(app, 'POST', '/usuarios', {});
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('returns 429 when rate limit exceeded', async () => {
        mockRegisterUser.mockRejectedValue(AppError.tooManyRequests('Muitas tentativas de registro. Tente novamente em 1 hora.'));
        const app = makeApp();
        const res = await request(app, 'POST', '/usuarios', { nome: 'João', email: 'joao@example.com', senha: 'password123', });
        expect(res.status).toBe(429);
        expect(res.body.code).toBe('TOO_MANY_REQUESTS');
    });
});