# ETL Migration Guide — MySQL → Postgres

## Overview

This ETL (Extract-Transform-Load) script migrates data from the legacy **Finlly MySQL** database (`finlly_go`) to the new **Postgres** database with:

- ✅ **Idempotent execution** — safe to run multiple times
- ✅ **Granular control** — migrate specific tables via `--tables`
- ✅ **Dry-run mode** — preview changes without writing to Postgres
- ✅ **Incremental migration** — migrate only records from a given date via `--since`
- ✅ **Automatic validation** — count checks, FK orphan detection, sample spot-checks
- ✅ **Comprehensive logging** — detailed JSON report per table

---

## Quick Start

### 1. Configuration

Copy the example environment file:

```bash
cd scripts/etl
cp .env.example .env.local
```

Edit `.env.local` with your database credentials:

```bash
LEGACY_MYSQL_HOST=mysql.example.com
LEGACY_MYSQL_USER=finlly_go
LEGACY_MYSQL_PASSWORD=your_password
LEGACY_MYSQL_DATABASE=finlly_go

DATABASE_URL=postgresql://user:password@postgres.example.com:5432/finlly
TZ=America/Sao_Paulo
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Verify Database Connections

```bash
npm run etl:test
```

### 4. Run Migration

#### **Full Migration (all tables)**
```bash
npm run etl
```

#### **Dry-run Mode** (no changes to Postgres)
```bash
npm run etl -- --dry-run
# or shorthand:
npm run etl -- -d
```

#### **Specific Tables Only**
```bash
npm run etl -- --tables=usuarios,contas,movimentacoes_caixa
# or shorthand:
npm run etl -- -t usuarios,assinantes,cupons
```

#### **Reset Tables** (truncate before loading)
```bash
# ⚠️  DANGEROUS — requires --confirm flag
npm run etl -- --reset --confirm
```

#### **Incremental Migration** (since a date)
```bash
npm run etl -- --since=2024-01-15
```

#### **Combined Flags**
```bash
# Dry-run specific tables
npm run etl -- --dry-run --tables=usuarios,contas

# Reset and reload specific tables
npm run etl -- --reset --confirm --tables=usuarios,assinantes
```

---

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run etl` | Full migration using CLI flags (entry point: `index.ts`) |
| `npm run etl:dry-run` | Dry-run via `ETL_DRY_RUN=true` env var |
| `npm run etl:execute` | Full execution via `ETL_DRY_RUN=false` env var |
| `npm run etl:rollback` | Truncate all Postgres tables (rollback) |
| `npm run etl:test` | Test MySQL + Postgres connectivity |

---

## CLI Flags

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--dry-run` | `-d` | boolean | `false` | Preview without writing to Postgres |
| `--tables` | `-t` | string | all | Comma-separated list of tables |
| `--reset` | `-r` | boolean | `false` | Truncate tables before loading |
| `--confirm` | — | boolean | `false` | Required with `--reset` (safety) |
| `--since` | `-s` | string | all data | ISO date for incremental migration |
| `--help` | `-h` | — | — | Show help |

---

## How It Works

### **Phase 1: Extract**
- Reads data from MySQL in batches (`ETL_BATCH_SIZE` rows)
- All 20 tables are extracted in parallel for performance
- Preserves original data integrity

### **Phase 2: Transform**
- Converts MySQL `INT AUTO_INCREMENT` IDs → Postgres `UUID` (deterministic via UUID v5)
- Transforms `VARCHAR` status strings → Postgres `ENUM` values
- Normalizes `DATETIME` → `TIMESTAMPTZ` (UTC)
- Maps foreign keys using the UUID mapping
- Removes denormalized computed fields (`balance`, `current_value`, `current_amount`)
- Validates CHECK constraints before loading

### **Phase 3: Load**
- Inserts rows into Postgres using Prisma ORM
- Batch loading for performance
- Idempotent via `skipDuplicates: true`
- Respects FK dependency order (parent tables before child tables)

### **Phase 4: Validate**
- **Count Validation**: compares MySQL count vs Postgres count per table
- **Orphan Detection**: finds FK violations (child without parent)
- **Sample Validation**: spot-checks 15 random rows per table
- Generates a detailed JSON report

---

## Table Execution Order

Tables are migrated in dependency order to respect FK constraints:

1. `usuarios` — base user table
2. `assinantes` — depends on `usuarios`
3. `assinantes_pagamentos` — depends on `assinantes`
4. `cupons` — independent reference table
5. `webhook_events` — independent
6. `instituicoes_financeiras` — reference table
7. `contas` — depends on `usuarios`, `instituicoes_financeiras`
8. `categorias` — depends on `usuarios`
9. `contas_pagar` — depends on `contas`, `categorias`
10. `contas_receber` — depends on `contas`, `categorias`
11. `movimentacoes_caixa` — depends on `contas`, `categorias`
12. `tipos_investimento` — reference table
13. `investimentos` — depends on `contas`, `tipos_investimento`
14. `investimentos_eventos` — depends on `investimentos`
15. `metas` — depends on `usuarios`
16. `metas_movimentos` — depends on `metas`
17. `anexos` — depends on `usuarios`
18. `anexos_vinculos` — depends on `anexos`
19. `whatsapp_logs` — depends on `usuarios`
20. `jobs` — independent

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LEGACY_MYSQL_HOST` | Yes | `localhost` | MySQL host |
| `LEGACY_MYSQL_PORT` | No | `3306` | MySQL port |
| `LEGACY_MYSQL_USER` | Yes | — | MySQL username |
| `LEGACY_MYSQL_PASSWORD` | Yes | — | MySQL password |
| `LEGACY_MYSQL_DATABASE` | Yes | `finlly_go` | MySQL database name |
| `DATABASE_URL` | Yes | — | Postgres connection string |
| `TZ` | No | — | Timezone (e.g. `America/Sao_Paulo`) |
| `ETL_BATCH_SIZE` | No | `1000` | Rows per batch insert |
| `ETL_DRY_RUN` | No | `false` | Enable dry-run via env var |
| `ETL_VALIDATE_SAMPLES` | No | `true` | Enable sample validation |
| `ETL_TRANSACTION_TIMEOUT_MS` | No | `120000` | Transaction timeout (ms) |

### Batch Size Guidance

| Dataset Size | Recommended `ETL_BATCH_SIZE` |
|---|---|
| < 10K rows | 1000 |
| 10K – 100K rows | 5000 (default) |
| > 100K rows | 10000 |

Higher batch size = faster migration, but higher memory usage.

---

## Understanding the Output

### Dry-run Example

```
📊 ETL Execution Plan:
   Dry-run: ✅ YES (read-only)
   Reset:   ❌ NO
   Since:   All data
   Tables:  20/20

🔍 DRY-RUN MODE: No data will be written to Postgres

🚀 Iniciando migração MySQL → Postgres

⚙️  Modo: DRY RUN (simulação sem inserção)
📊 Batch size: 1000

📖 FASE 1: EXTRACT
   ✅ usuarios: 150 extraídos
   ✅ contas: 48 extraídos
   ...

🔄 FASE 2: TRANSFORM
   ✅ 150 usuarios transformados
   ✅ 48 contas transformadas
   ...

💾 FASE 3: LOAD
   🔄 [DRY-RUN] Simulando carga de 150 usuarios...
   ...

✓  FASE 4: VALIDATE
   ✅ usuarios: contagem OK (MySQL=150, Postgres=150)
   ...

✅ Migration complete!
```

### JSON Report Structure

After each run, a report is saved to `scripts/etl/reports/`:

```json
{
  "timestamp": "2026-01-15T10:30:00Z",
  "status": "success",
  "modo": "dry_run",
  "summary": {
    "total_tabelas": 20,
    "tabelas_ok": 20,
    "tabelas_com_erro": 0,
    "total_registros_mysql": 5432,
    "total_registros_postgres": 5432,
    "total_erros": 0
  },
  "por_tabela": [
    {
      "tabela": "usuarios",
      "mysql_count": 150,
      "postgres_count": 150,
      "status": "ok"
    }
  ]
}
```

---

## Troubleshooting

### **Error: "Cannot connect to MySQL"**
```bash
# Check credentials in .env.local
cat .env.local | grep LEGACY_MYSQL

# Test connection manually
mysql -h $LEGACY_MYSQL_HOST -u $LEGACY_MYSQL_USER -p $LEGACY_MYSQL_DATABASE
```

### **Error: "⛔ --reset is DANGEROUS"**
The `--reset` flag requires `--confirm` to prevent accidental data loss:
```bash
npm run etl -- --reset --confirm
```

### **Error: "Postgres constraint violation"**
This indicates a data quality issue. The ETL report shows which rows failed.
Check the JSON report in `scripts/etl/reports/` for the `errors` field.

### **Error: "--since value is not a valid date"**
Use ISO 8601 date format:
```bash
# Correct:
npm run etl -- --since=2024-01-15

# Wrong:
npm run etl -- --since=15/01/2024
```

### **Migration is slow**
- Increase `ETL_BATCH_SIZE` (e.g., `10000`)
- Check network latency to databases
- Run during off-peak hours

### **Rerun a specific failed table**
```bash
# Preview first
npm run etl -- --tables=usuarios --dry-run

# Then execute
npm run etl -- --tables=usuarios
```

---

## Safety & Best Practices

### ✅ Do This

1. **Always test with `--dry-run` first**
   ```bash
   npm run etl -- --dry-run
   ```

2. **Backup Postgres before `--reset`**
   ```bash
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
   npm run etl -- --reset --confirm
   ```

3. **Start with a subset of tables**
   ```bash
   npm run etl -- --tables=usuarios,assinantes
   ```

4. **Log the full run output**
   ```bash
   npm run etl 2>&1 | tee etl-$(date +%Y%m%d_%H%M%S).log
   ```

### ❌ Avoid This

1. ❌ **Don't use `--reset` without a Postgres backup**
2. ❌ **Don't modify MySQL data during migration** (may cause skipped or duplicate rows)
3. ❌ **Don't ignore orphan detector warnings** (indicates FK integrity issues)
4. ❌ **Don't run `--reset` in production without `--dry-run` verification first**

---

## Idempotency Guarantee

The ETL is **idempotent** — running it multiple times produces the same result:

```bash
# First run
npm run etl

# Second run (safe — skips duplicates)
npm run etl
```

Why it is safe:
- **UUID v5 deterministic mapping** — the same MySQL ID always maps to the same Postgres UUID
- **`skipDuplicates: true`** — Prisma skips rows that already exist in the target table
- **Incremental mode** — `--since` re-processes only records newer than the given date

---

## Performance Characteristics

| Dataset Size | Expected Duration | Notes |
|---|---|---|
| < 10K rows | 5–10 s | Fast; local network |
| 10K – 100K rows | 30–60 s | Typical; moderate batch |
| 100K – 1M rows | 2–5 min | Larger batches help |
| > 1M rows | 5+ min | Use incremental mode |

---

## Contact & Support

For issues or questions:
1. Check the error log (JSON report in `scripts/etl/reports/`)
2. Review the Troubleshooting section above
3. Open a GitHub issue with:
   - Command used (`npm run etl -- ...`)
   - Full error message
   - `.env.local` (without credentials)
   - JSON report

---

**Last Updated:** 2026-01  
**Version:** 1.0.0  
**Status:** Production Ready ✅
