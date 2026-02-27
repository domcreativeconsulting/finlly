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

5. **Run the projects**
   ```bash
   pnpm dev
   ```

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

## Testing Health Endpoint

The application includes a health check endpoint that verifies the status of all critical services:

### Quick Test

```bash
curl http://localhost:3001/health
```

### Response Format

```json
{
  "status": "ok|degraded|down",
  "db": "ok|down",
  "redis": "ok|down",
  "timestamp": "2026-02-27T10:30:45.123Z"
}
```

### Status Meanings

- **ok**: All services are healthy (HTTP 200)
- **degraded**: At least one service is unavailable (HTTP 503)
- **down**: All services are unavailable (HTTP 503)

### Example Responses

#### All services healthy

```bash
$ curl http://localhost:3001/health
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "timestamp": "2026-02-27T10:30:45.123Z"
}
```

#### Database down

```bash
{
  "status": "degraded",
  "db": "down",
  "redis": "ok",
  "timestamp": "2026-02-27T10:30:45.123Z"
}
```

#### All services down

```bash
{
  "status": "down",
  "db": "down",
  "redis": "down",
  "timestamp": "2026-02-27T10:30:45.123Z"
}
```

## Troubleshooting

### Port Already in Use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3001`

**Solution**:

```bash
# Find process using the port
lsof -i :3001
# Kill the process
kill -9 <PID>

# Or use a different port
API_PORT=3002 npm run dev
```

### Docker Containers Won't Start

**Problem**: `docker compose up` fails or containers exit

**Solution**:

```bash
# Check container logs
docker compose logs postgres
docker compose logs redis

# Remove stopped containers and try again
docker compose down
docker compose up -d

# Ensure port 5432 and 6379 are not in use
lsof -i :5432
lsof -i :6379
```

### Database Connection Refused

**Problem**: Health endpoint shows `"db": "down"`

**Solution**:

```bash
# Verify Postgres is running
docker compose ps postgres

# Check if it's ready (wait for healthcheck to pass)
docker compose logs postgres | grep "database system is ready"

# Test connection directly
psql postgresql://user:password@localhost:5432/finlly
```

### Health Check Always Returns 300ms Timeout

**Problem**: Health endpoint is slow or times out

**Solution**:

```bash
# Check if database and redis are responding
docker compose exec postgres pg_isready -U user
docker compose exec redis redis-cli ping

# Check container resource usage
docker stats

# Restart services
docker compose restart postgres redis
```

### Node_modules Issues

**Problem**: `npm install` fails or modules are corrupted

**Solution**:

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and lock files
rm -rf node_modules package-lock.json
rm -rf apps/*/node_modules

# Reinstall
npm install
```

### ESLint or Prettier Errors in CI

**Problem**: PR fails with lint or format errors

**Solution**:

```bash
# Fix automatically
npm run lint:fix
npm run format

# Commit fixed files
git add .
git commit -m "chore: fix linting and formatting"
```

## Additional Information
For more detailed instructions about each project, please refer to their respective README files within the project folders.