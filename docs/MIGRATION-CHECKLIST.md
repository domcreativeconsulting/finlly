# Migration Checklist — MySQL → PostgreSQL (ETL 02.3)

This checklist documents every step required to execute a successful migration and
serves as a manual verification guide after each run.

---

## Pre-Migration

- [ ] Set `DATABASE_URL` (Postgres) in `.env`
- [ ] Set `MYSQL_URL` (MySQL legacy) in `.env`
- [ ] Run `npm run db:migrate` to ensure Postgres schema is current
- [ ] Confirm MySQL source database is accessible (`npm run etl:test`)
- [ ] Create a Postgres backup if migrating into a production database

---

## Phase 1 — EXTRACT

- [ ] All 20 extractors connect without errors
- [ ] Row counts are non-zero for core tables (`usuarios`, `contas`, `metas`, etc.)
- [ ] No timeout errors during parallel extraction

## Phase 2 — TRANSFORM

- [ ] All transformers complete without uncaught exceptions
- [ ] `cupom.transformer`: `desconto_percentual` OR `desconto_fixo` is set (never both, never neither) — satisfies `ck_cupons_desconto`
- [ ] `movimentacao-caixa.transformer`: `valor > 0` — satisfies `CHECK (valor > 0)`
- [ ] `conta-pagar.transformer`: `valor > 0` — satisfies `CHECK (valor > 0)`
- [ ] `conta-receber.transformer`: `valor > 0` — satisfies `CHECK (valor > 0)`
- [ ] `investimento-evento.transformer`: `valor > 0` — satisfies `CHECK (valor > 0)`
- [ ] `meta.transformer`: `valor_alvo > 0` — satisfies `CHECK (valor_alvo > 0)`
- [ ] `anexo.transformer`: `tamanho_bytes > 1` — satisfies `CHECK (tamanho_bytes > 0)`
- [ ] `job.transformer`: `status IN ('pendente','processando','concluido','falhou')` and `max_tentativas > 0`
- [ ] `whatsapp-log.transformer`: `direcao IN ('entrada','saida')`

## Phase 2.5 — DATA VALIDATION

- [ ] `DataValidator.validateAll` runs without errors
- [ ] Zero critical violations OR all violations are logged and explained
- [ ] Report section `qualidade_dados.total_violacoes` is reviewed
- [ ] Any warnings are noted and addressed before production migration

## Phase 3 — LOAD

- [ ] `TRUNCATE CASCADE` completes (or DRY RUN skips it)
- [ ] All 20 tables load without fatal errors
- [ ] Per-row fallback (`create`) is used only if batch failures occur
- [ ] `loader.failedRows.length` is 0 (or failed rows are exported for manual fix)

## Phase 4 — VALIDATE

- [ ] `CountValidator`: all table counts match between MySQL and Postgres
- [ ] `SampleValidator`: all 18 sampled tables pass UUID format and field-level checks
- [ ] `OrphanDetector`: no orphan records detected

## Phase 5 — REPORT

- [ ] Report file `migration-report-YYYY-MM-DD.json` is generated
- [ ] `status` = `"success"` (or `"partial"` if acceptable divergences exist)
- [ ] `qualidade_dados.linhas_ignoradas` = 0 (or documented)
- [ ] `erros` array is empty

---

## Post-Migration Verification

- [ ] Run application smoke tests against the new Postgres database
- [ ] Verify user login works end-to-end
- [ ] Check financial summaries are consistent with legacy data
- [ ] Confirm no orphan FK references remain (`OrphanDetector`)

---

## Rollback

If the migration must be rolled back:

```bash
npm run etl:rollback
```

This truncates all migrated tables in the correct FK order.

---

## Known Constraints (Postgres CHECK)

| Table | Constraint | Rule |
|-------|-----------|------|
| `cupons` | `ck_cupons_desconto` | Exactly one of `desconto_percentual` / `desconto_fixo` must be non-null |
| `cupons` | inline | `desconto_percentual BETWEEN 0 AND 100` |
| `cupons` | inline | `desconto_fixo >= 0` |
| `cupons` | inline | `uso_maximo > 0` (if set) |
| `cupons` | inline | `uso_atual >= 0` |
| `assinantes_pagamentos` | inline | `valor >= 0` |
| `contas` | inline | `cor ~ '^#[0-9A-Fa-f]{6}$'` (if set) |
| `categorias` | inline | `cor ~ '^#[0-9A-Fa-f]{6}$'` (if set) |
| `contas_pagar` | inline | `valor > 0` |
| `contas_pagar` | `ck_cpagar_parcelas` | Both `parcela_atual` / `total_parcelas` null OR both set with `parcela_atual <= total_parcelas` |
| `contas_receber` | inline | `valor > 0` |
| `contas_receber` | `ck_creceber_parcelas` | Both `parcela_atual` / `total_parcelas` null OR both set with `parcela_atual <= total_parcelas` |
| `movimentacoes_caixa` | inline | `valor > 0` |
| `investimentos` | inline | `valor_inicial >= 0` |
| `investimentos_eventos` | inline | `valor > 0` |
| `metas` | inline | `valor_alvo > 0` |
| `metas` | inline | `cor ~ '^#[0-9A-Fa-f]{6}$'` (if set) |
| `anexos` | inline | `tamanho_bytes > 0` |
| `anexos` | inline | `hash_sha256 ~ '^[0-9a-f]{64}$'` (if set) |
| `whatsapp_logs` | inline | `direcao IN ('entrada', 'saida')` |
| `jobs` | inline | `status IN ('pendente', 'processando', 'concluido', 'falhou')` |
| `jobs` | inline | `tentativas >= 0` |
| `jobs` | inline | `max_tentativas > 0` |
