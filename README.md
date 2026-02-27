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

## Additional Information
For more detailed instructions about each project, please refer to their respective README files within the project folders.