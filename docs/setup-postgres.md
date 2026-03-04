# Setup PostgreSQL — Finlly v2

Guia de configuração do banco de dados PostgreSQL usando Prisma Migrate.

---

## Pré-requisitos

- **Node.js** ≥ 18 (LTS)
- **PostgreSQL** ≥ 15 (local ou Docker)
- **npm** ≥ 9

---

## Configuração rápida (Docker)

A maneira mais rápida de ter um PostgreSQL local é via Docker Compose:

```bash
docker-compose up -d
```

O `docker-compose.yml` sobe PostgreSQL na porta `5432` e Redis na porta `6379`.

---

## Variáveis de ambiente

Copie o arquivo de exemplo e ajuste conforme seu ambiente:

```bash
cp .env.example .env
```

Edite o `.env` e configure a variável obrigatória:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/finlly
```

| Variável       | Descrição                          | Exemplo                                              |
| -------------- | ---------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL` | String de conexão PostgreSQL (DSN) | `postgresql://user:password@localhost:5432/finlly`   |

> ⚠️ **Nunca** commite o arquivo `.env` — ele está no `.gitignore`.

---

## Scripts disponíveis

| Comando           | Descrição                                                  |
| ----------------- | ---------------------------------------------------------- |
| `npm run db:migrate` | Aplica todas as migrations pendentes + gera o Prisma Client |
| `npm run db:seed`    | Popula dados iniciais (idempotente)                       |
| `npm run db:reset`   | Drop + migrate + seed (⚠️ DESTRÓI TODOS OS DADOS)         |
| `npm run db:studio`  | Abre o Prisma Studio (interface visual, apenas dev)        |

---

## Setup do banco do zero

Execute os comandos na ordem:

```bash
# 1. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com sua DATABASE_URL

# 2. Aplique as migrations (cria todas as tabelas, índices, constraints)
npm run db:migrate

# 3. Popule os dados iniciais
npm run db:seed
```

Resultado esperado:
```
🌱 Iniciando seed...
✅ 12 tipos de investimento sincronizados
✅ 16 categorias do sistema inseridas (0 já existiam)
✅ Seed concluído com sucesso!
```

---

## Onboarding automático — categorias padrão por usuário

Ao cadastrar um novo usuário via `POST /usuarios`, o sistema cria automaticamente
**16 categorias financeiras padrão** associadas exclusivamente a esse usuário:

| Tipo    | Categorias |
| ------- | ---------- |
| Entrada | Salário, Freelance, Rendimento de Investimento, Transferência recebida, Presente, Outros — Entrada |
| Saída   | Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Vestuário, Assinaturas e Serviços, Impostos e Taxas, Outros — Saída |

A criação ocorre dentro de uma **transação atômica**: se qualquer etapa falhar, o
usuário e as categorias são revertidos juntos.

### Exemplo de requisição

```http
POST /usuarios
Content-Type: application/json

{
  "nome": "João Silva",
  "email": "joao@example.com",
  "senha": "minha_senha_segura"
}
```

### Exemplo de resposta

```json
{
  "message": "Usuário criado com sucesso",
  "usuario": {
    "id": "a1b2c3d4-...",
    "nome": "João Silva",
    "email": "joao@example.com",
    "created_at": "2026-03-04T17:00:00.000Z",
    "categorias_criadas": 16
  }
}
```

### Idempotência

A criação de categorias é idempotente — re-executar para o mesmo usuário não duplica:

```http
POST /usuarios  → 201 Created  (16 categorias criadas)
POST /usuarios  → 409 Conflict (e-mail já cadastrado)
```

---

## Rodar o seed novamente (idempotente)

O seed é idempotente — pode ser executado múltiplas vezes sem criar duplicatas:

```bash
npm run db:seed
# Segunda execução:
# ✅ 12 tipos de investimento sincronizados
# ✅ 0 categorias do sistema inseridas (16 já existiam)
```

---

## Resetar o ambiente local

> ⚠️ **ATENÇÃO:** Este comando apaga **todos os dados** do banco.

```bash
npm run db:reset
```

O Prisma solicitará confirmação antes de executar. Para ambientes de CI use:

```bash
npx prisma migrate reset --force
```

---

## Estrutura de migrations

As migrations ficam em `prisma/migrations/` com timestamps:

```
prisma/
├── schema.prisma                          ← Definição do schema Prisma
├── migrations/
│   ├── migration_lock.toml                ← Lock do provider (não editar)
│   └── 20260303000000_init/
│       └── migration.sql                  ← SQL da migration inicial
└── seed.ts                                ← Seed idempotente
```

Cada migration é um diretório com timestamp `YYYYMMDDHHMMSS_<nome>` contendo um arquivo `migration.sql`.

---

## Criando novas migrations

Para evoluir o schema:

1. Edite `prisma/schema.prisma` com as novas definições
2. Gere a migration:
   ```bash
   npx prisma migrate dev --name descricao_da_mudanca
   ```
3. Commite os arquivos gerados em `prisma/migrations/`

---

## Prisma Studio (interface visual)

Para inspecionar o banco de dados visualmente durante o desenvolvimento:

```bash
npm run db:studio
```

Abre em `http://localhost:5555` por padrão.

---

## CI/CD

Para ambientes de CI (GitHub Actions), adicione ao seu workflow:

```yaml
- name: Setup PostgreSQL
  # Configure seu serviço PostgreSQL aqui

- name: Apply migrations
  run: npm run db:migrate
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Seed database
  run: npm run db:seed
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## Schema — Domínios e Tabelas

O schema v2 cobre 7 domínios com 17 tabelas PostgreSQL:

| Domínio                  | Tabelas                                                                         |
| ------------------------ | ------------------------------------------------------------------------------- |
| Usuários                 | `usuarios`                                                                      |
| Billing & Assinaturas    | `cupons`, `assinantes`, `assinantes_pagamentos`, `webhook_events`               |
| Financeiro               | `instituicoes_financeiras`, `contas`, `categorias`, `contas_pagar`, `contas_receber`, `movimentacoes_caixa` |
| Investimentos            | `tipos_investimento`, `investimentos`, `investimentos_eventos`                  |
| Metas & Objetivos        | `metas`, `metas_movimentos`                                                     |
| Anexos & Documentos      | `anexos`, `anexos_vinculos`                                                     |
| Comunicação & Sistema    | `whatsapp_logs`, `jobs`                                                         |

Todas as entidades de negócio têm soft-delete via coluna `deleted_at`.

---

## Referências

- [Prisma Migrate Docs](https://www.prisma.io/docs/orm/prisma-migrate)
- [Prisma Schema Reference](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)
- [docs/database/01-legacy-schema-mapping.md](./database/01-legacy-schema-mapping.md) — inventário MySQL legado
- [docs/database/04-indexing-strategy.md](./database/04-indexing-strategy.md) — estratégia de índices
