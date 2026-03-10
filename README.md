# Monorepo Setup Instructions

## Introduction
This repository is set up as a monorepo that allows for managing multiple projects within a single repository.

## Prerequisites
- Node.js (LTS version) or Docker / Docker Compose
- pnpm (package manager used in this project)

## Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/domcreativeconsulting/finlly.git
   cd finlly
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and fill in your values
   ```

4. **Start infrastructure (Postgres + Redis) with Docker Compose**
   ```bash
   docker-compose up -d
   ```

5. **Run database migrations and seed**
   ```bash
   npm run db:migrate   # Creates all tables, indexes and constraints
   npm run db:seed      # Populates initial data (idempotent)
   ```

6. **Run the projects**
   ```bash
   pnpm dev
   ```

## Database Scripts

| Command              | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `npm run db:migrate` | Apply pending migrations + generate Prisma Client        |
| `npm run db:seed`    | Populate initial data (idempotent — safe to run again)   |
| `npm run db:reset`   | ⚠️ Drop + migrate + seed (destroys all data)             |
| `npm run db:studio`  | Open Prisma Studio GUI (dev only)                        |

> See [docs/setup-postgres.md](docs/setup-postgres.md) for the full database setup guide.

## Folder Structure
- `apps/`
  - `api/` - Express API server
  - `web/` - React/Vite web application

## Environment Variables

The application validates all required environment variables at startup using [Zod](https://zod.dev). If a required variable is missing or invalid, the app will exit immediately with a clear error message.

Copy `.env.example` to `.env` and fill in the values before starting the application.

### Required Variables

| Variable             | Description                                    | Example                                                  |
| -------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string                   | `postgresql://user:password@localhost:5432/finlly`       |
| `REDIS_URL`          | Redis connection string                        | `redis://localhost:6379`                                 |
| `JWT_SECRET`         | Secret for signing JWT tokens (≥ 32 chars)     | `change_me_with_a_secure_random_string_minimum_32_chars` |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens (≥ 32 chars) | `change_me_with_a_secure_random_string_minimum_32_chars` |

### Optional Variables (with defaults)

| Variable                 | Default                 | Description                                                   |
| ------------------------ | ----------------------- | ------------------------------------------------------------- |
| `NODE_ENV`               | `development`           | Runtime environment (`development` \| `production` \| `test`) |
| `API_PORT`               | `3001`                  | Port the API server listens on                                |
| `APP_URL`                | `http://localhost:5173` | Frontend application URL (used for CORS etc.)                 |
| `JWT_EXPIRES_IN`         | `15m`                   | Access token expiry                                           |
| `JWT_REFRESH_EXPIRES_IN` | `30d`                   | Refresh token expiry                                          |
| `ASAAS_ENV`              | `sandbox`               | Asaas billing environment (`sandbox` \| `production`)         |
| `ASAAS_API_KEY`          | —                       | Asaas API key                                                 |
| `ASAAS_WEBHOOK_SECRET`   | —                       | Asaas webhook signing secret                                  |
| `ASAAS_BASE_URL`         | —                       | Asaas API base URL                                            |
| `WA_PROVIDER`            | —                       | WhatsApp provider name (e.g. `evolution`)                     |
| `WA_BASE_URL`            | —                       | WhatsApp provider base URL                                    |
| `WA_TOKEN`               | —                       | WhatsApp provider token                                       |
| `WA_PHONE_NUMBER_ID`     | —                       | WhatsApp phone number ID                                      |
| `RATE_LIMIT_STORE`       | `memory`                | Rate limit store (`memory` \| `redis`)                        |
| `RATE_LIMIT_MAX`         | `10`                    | Max requests per window                                       |
| `RATE_LIMIT_WINDOW_MS`   | `600000`                | Rate limit window in milliseconds                             |

> **Never** commit your `.env` file to version control. It is already listed in `.gitignore`.

## Additional Information
For more detailed instructions about each project, please refer to their respective README files within the project folders.

## Observability

### Log Format

API logs are structured JSON (via [Pino](https://getpino.io)). Each log entry includes at minimum:

```json
{
  "level": "info",
  "time": "2024-01-01T00:00:00.000Z",
  "msg": "GET /health 200 12ms",
  "requestId": "a1b2c3d4-...",
  "method": "GET",
  "path": "/health",
  "statusCode": 200,
  "durationMs": 12
}
```

### `x-request-id` Header

Every request to the API is tracked with a unique `requestId`:

- If the client sends an `x-request-id` header with a **valid** value, the API reuses it.
- If the client sends an `x-correlation-id` header (and no `x-request-id`), the API uses that value instead — for proxy/gateway compatibility.
- Invalid headers (wrong characters or longer than 64 chars) are rejected and a new UUID v4 is generated.
- If no header is sent, the API generates a new UUID v4.
- The `requestId` is returned in every response via the `x-request-id` header.
- The `requestId` appears in all logs related to that request.

**Validation rules for accepted headers:**
- Maximum 64 characters
- Allowed characters: `[A-Za-z0-9-_]`

```bash
# Example: pass your own request ID
curl -H "x-request-id: my-trace-id" http://localhost:3001/health
# Response headers will include: x-request-id: my-trace-id

# Example: pass a correlation ID (gateway/proxy compatibility)
curl -H "x-correlation-id: gateway-trace-123" http://localhost:3001/health
# Response headers will include: x-request-id: gateway-trace-123
```

### Standard Error Format

All unhandled errors return a consistent JSON payload:

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "An unexpected error occurred",
  "requestId": "a1b2c3d4-..."
}
```

| Field       | Description                                              |
| ----------- | -------------------------------------------------------- |
| `code`      | Machine-readable error code (e.g. `NOT_FOUND`)           |
| `message`   | Human-readable description (safe for display)            |
| `requestId` | The request trace ID for debugging                       |
| `details`   | Optional field with extra context (e.g. validation info) |

Stack traces are never included in production responses.

### Error Codes

| Code                   | HTTP Status | Description                              |
| ---------------------- | ----------- | ---------------------------------------- |
| `BAD_REQUEST`          | 400         | Malformed request or invalid input       |
| `UNAUTHORIZED`         | 401         | Missing or invalid authentication        |
| `FORBIDDEN`            | 403         | Authenticated but not authorized         |
| `NOT_FOUND`            | 404         | Resource does not exist                  |
| `CONFLICT`             | 409         | Duplicate or conflicting resource        |
| `VALIDATION_ERROR`     | 422         | Schema validation failed (Zod)           |
| `INTERNAL_SERVER_ERROR`| 500         | Unexpected server-side error             |

### Throwing Application Errors

Use the `AppError` class (and its factory helpers) to throw structured errors from route handlers or services:

```javascript
import { AppError } from '../errors/AppError.js';

// 404
throw AppError.notFound('User not found');

// 401
throw AppError.unauthorized();

// 403
throw AppError.forbidden('Insufficient permissions');

// 409
throw AppError.conflict('Email already in use');

// 400 with details
throw AppError.badRequest('Invalid payload', { reason: 'missing field' });

// 500
throw AppError.internal();
```

### Validation Errors (Zod)

Use `toValidationError` to convert a Zod parse error into a structured `422` response:

```javascript
import { z } from 'zod';
import { toValidationError } from '../errors/toValidationError.js';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const result = schema.safeParse(req.body);
if (!result.success) {
  throw toValidationError(result.error);
}
```

The client receives:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "requestId": "abc-123",
  "details": {
    "fields": {
      "email": "Invalid email format",
      "password": "Must be at least 8 characters"
    }
  }
}
```

### Error Log Differentiation

- **4xx errors** (client errors) are logged at `warn` level with minimal context.
- **5xx errors** (server errors) are logged at `error` level with the full stack trace (non-production only).
- All log entries include the `requestId` for tracing.
- Sensitive data (e.g. `Authorization` header, cookies, passwords) is never logged.

### ErrorBoundary (Web)

The web app uses a React `ErrorBoundary` to catch unexpected runtime errors and show a friendly fallback UI instead of a blank screen.

**Default usage** (already applied at root in `main.jsx`):

```jsx
import ErrorBoundary from './components/ErrorBoundary.jsx';

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

**Custom fallback UI:**

```jsx
<ErrorBoundary fallback={<p>Something went wrong.</p>}>
  <YourComponent />
</ErrorBoundary>
```

- In development: detailed error info is logged to the console.
- In production: only critical errors are logged; no sensitive details exposed.

## Rate Limiting

A API aplica rate limiting em todos os endpoints sensíveis de autenticação para proteção contra brute-force e abuso.

### Políticas por Endpoint

| Endpoint                           | Método | Limite        | Janela  | Chave       |
| ---------------------------------- | ------ | ------------- | ------- | ----------- |
| `/auth/login`                      | POST   | 5 tentativas  | 15 min  | IP          |
| `/auth/register`                   | POST   | 10 tentativas | 1 hora  | IP          |
| `/auth/forgot-password`            | POST   | 3 tentativas  | 1 hora  | email ou IP |
| `/auth/refresh`, `/auth/logout`    | POST   | 30 tentativas | 15 min  | IP          |
| `/auth/me`, `/perfil`, `/users/me` | GET    | 30 tentativas | 15 min  | IP          |

> Além do rate limit por IP, o `authService` aplica um rate limit adicional por **email+IP** (SHA-256 do email normalizado) diretamente via Redis para o endpoint de login.

### Resposta ao Exceder o Limite

```json
{
  "code": "RATE_LIMITED",
  "message": "Muitas tentativas. Tente novamente em 15 minutos.",
  "requestId": "abc-123"
}
```

**HTTP Status:** `429 Too Many Requests`  
**Header:** `Retry-After` é incluído automaticamente via `standardHeaders: true`.

### Armazenamento

| Ambiente  | Store       | Configuração              |
| --------- | ----------- | ------------------------- |
| Dev       | MemoryStore | padrão (sem config extra) |
| Produção  | Redis       | `RATE_LIMIT_STORE=redis`  |

### Configuração via Env

| Variável               | Padrão    | Descrição                                           |
| ---------------------- | --------- | --------------------------------------------------- |
| `RATE_LIMIT_STORE`     | `memory`  | Store do rate limit: `memory` ou `redis`            |
| `RATE_LIMIT_MAX`       | `10`      | Máximo de requisições por janela (endpoints gerais) |
| `RATE_LIMIT_WINDOW_MS` | `600000`  | Janela em ms (padrão: 10 min)                       |

> As políticas específicas de login (5/15min) e registro (10/1h) são configuradas diretamente no código e podem ser ajustadas em `apps/api/src/routes/auth.js`.

## Testing Health Endpoint

With the API running, verify the health endpoint:

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Troubleshooting

### Missing environment variables
If the API fails to start with a configuration error, ensure all required variables in `.env` are set (see [Environment Variables](#environment-variables)).

### Docker Compose issues
If PostgreSQL or Redis containers fail to start:
```bash
docker-compose down -v
docker-compose up -d
```

### Port conflicts
- API default port: `3001` (override with `API_PORT` in `.env`)
- Web default port: `5173` (override in `apps/web/vite.config.js`)