# Monorepo Setup Instructions

## Introduction

This repository is set up as a monorepo that allows for managing multiple projects within a single repository.

## Prerequisites

- Node.js installed (preferably LTS version)
- Yarn or npm for package management

## Setup Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/domcreativeconsulting/finlly.git
   cd finlly
   ```

2. **Install dependencies**

   ```bash
   yarn install  # or npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

4. **Run the projects**
   Each project can be run individually by navigating to the respective project folder and executing:
   ```bash
   yarn start  # or npm start
   ```

## Folder Structure

- `apps/`
  - `api/` - Express API server
  - `web/` - React/Vite web application

## Environment Setup

### Quick Start

```bash
cp .env.example .env
# Edit .env with your values, then:
docker compose up -d postgres redis
cd apps/api && npm start
```

### Environment Variables

#### Obrigatórias (Required)

| Variable                 | Description                                                   | Default                 |
| ------------------------ | ------------------------------------------------------------- | ----------------------- |
| `NODE_ENV`               | Application environment (`development`, `test`, `production`) | `development`           |
| `API_PORT`               | API server port                                               | `3001`                  |
| `APP_URL`                | Frontend application URL                                      | `http://localhost:5173` |
| `DATABASE_URL`           | PostgreSQL connection string                                  | —                       |
| `REDIS_URL`              | Redis connection string                                       | —                       |
| `JWT_SECRET`             | JWT access token secret (min. 32 chars)                       | —                       |
| `JWT_EXPIRES_IN`         | JWT access token expiration                                   | `15m`                   |
| `JWT_REFRESH_SECRET`     | JWT refresh token secret (min. 32 chars)                      | —                       |
| `JWT_REFRESH_EXPIRES_IN` | JWT refresh token expiration                                  | `30d`                   |

#### Opcionais (Optional) — Billing Asaas

| Variable               | Description                                 | Default |
| ---------------------- | ------------------------------------------- | ------- |
| `ASAAS_ENV`            | Asaas environment (`sandbox`, `production`) | —       |
| `ASAAS_API_KEY`        | Asaas API key                               | —       |
| `ASAAS_WEBHOOK_SECRET` | Asaas webhook secret                        | —       |
| `ASAAS_BASE_URL`       | Asaas API base URL                          | —       |

#### Opcionais (Optional) — WhatsApp Agent

| Variable             | Description                          | Default |
| -------------------- | ------------------------------------ | ------- |
| `WA_PROVIDER`        | WhatsApp provider (e.g. `evolution`) | —       |
| `WA_BASE_URL`        | WhatsApp provider base URL           | —       |
| `WA_TOKEN`           | WhatsApp provider token              | —       |
| `WA_PHONE_NUMBER_ID` | WhatsApp phone number ID             | —       |

#### Opcionais (Optional) — Rate Limiting

| Variable               | Description                          | Default  |
| ---------------------- | ------------------------------------ | -------- |
| `RATE_LIMIT_STORE`     | Rate limit store (`memory`, `redis`) | `memory` |
| `RATE_LIMIT_MAX`       | Max requests per window              | `10`     |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds    | `600000` |

#### Web (React/Vite)

| Variable            | Description                       | Default                 |
| ------------------- | --------------------------------- | ----------------------- |
| `VITE_API_BASE_URL` | API base URL used by the frontend | `http://localhost:3001` |

### Running with Docker Compose

```bash
# Start infrastructure (PostgreSQL + Redis)
docker compose up -d

# Stop infrastructure
docker compose down
```

## Additional Information

For more detailed instructions about each project, please refer to their respective README files within the project folders.
