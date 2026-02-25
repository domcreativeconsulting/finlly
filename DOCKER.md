# Docker Setup

## Overview

Este repositório inclui um `docker-compose.yml` que sobe **PostgreSQL 15** e **Redis 7** localmente, sem necessidade de instalação manual.

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) instalado
- [Docker Compose](https://docs.docker.com/compose/install/) (incluso no Docker Desktop)

## Uso

### Subir os serviços

```bash
docker compose up -d
```

### Verificar status

```bash
docker compose ps
```

### Parar os serviços

```bash
docker compose down
```

### Parar e remover volumes (apaga dados)

```bash
docker compose down -v
```

### Ver logs

```bash
docker compose logs -f
```

## Credenciais padrão

| Serviço    | Variável        | Valor                                          |
|------------|-----------------|------------------------------------------------|
| PostgreSQL | `DATABASE_URL`  | `postgresql://user:password@localhost:5432/finlly` |
| Redis      | `REDIS_URL`     | `redis://localhost:6379`                       |

### PostgreSQL

| Parâmetro  | Valor      |
|------------|------------|
| Host       | `localhost` |
| Port       | `5432`     |
| User       | `user`     |
| Password   | `password` |
| Database   | `finlly`   |
| Timezone   | `America/Sao_Paulo` |

### Redis

| Parâmetro | Valor       |
|-----------|-------------|
| Host      | `localhost` |
| Port      | `6379`      |

## Health Checks

Ambos os serviços possuem health checks configurados:

- **PostgreSQL**: executa `pg_isready -U user -d finlly` a cada 10 segundos
- **Redis**: executa `redis-cli ping` a cada 10 segundos

Para verificar a saúde dos containers:

```bash
docker compose ps
```

A coluna `STATUS` exibirá `healthy` quando os serviços estiverem prontos.

## Configuração do ambiente

Copie o arquivo `.env.example` para `.env` na raiz e em `apps/api/`:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

As credenciais já estão configuradas para conectar nos containers Docker sem ajustes adicionais.

## Volumes

Os dados são persistidos em volumes nomeados do Docker:

- `postgres_data` — dados do PostgreSQL
- `redis_data` — dados do Redis

Os dados sobrevivem a reinicializações dos containers. Para apagá-los completamente, use `docker compose down -v`.
