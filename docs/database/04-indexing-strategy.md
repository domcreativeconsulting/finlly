# 04 — Estratégia de Indexação (Postgres v2)

> **Fonte:** análise de queries do código PHP + problemas identificados em `03-legacy-issues.md` (ME-05)  
> **Data:** 2026-03-03  
> **Propósito:** Definir os índices obrigatórios para o esquema Postgres v2 do Finlly, corrigindo os
> campos sem índice identificados no legado MySQL e otimizando as queries mais frequentes.

---

## Contexto: Problemas de Indexação no Legado

O legado MySQL não declara índices em campos críticos de filtro (problema ME-05 em `03-legacy-issues.md`):

| Tabela              | Campo sem índice             | Impacto identificado                       |
| ------------------- | ---------------------------- | ------------------------------------------ |
| `users`             | `email`                      | Login por email faz full table scan        |
| `subscriptions`     | `user_id`                    | Busca de assinatura por usuário sem índice |
| `payments`          | `subscription_id`, `user_id` | Histórico de pagamentos sem índice         |
| `cupons`            | `code`                       | Validação de cupom faz full table scan     |
| `categories`        | `parent_id`                  | Busca de subcategorias sem índice          |
| `investment_events` | `user_id`                    | Relatório de eventos sem índice            |
| `goal_movements`    | `goal_id`                    | Cálculo de progresso sem índice            |

---

## Tipos de Índice Utilizados

### B-Tree (padrão)

Tipo padrão do Postgres. Usado para colunas com consultas de igualdade (`=`), faixas (`<`, `>`, `BETWEEN`),
e ordenação (`ORDER BY`). Cobre a grande maioria dos casos.

```sql
CREATE INDEX idx_contas_usuario_id ON contas (usuario_id);
```

### UNIQUE

Garante unicidade e cria automaticamente um índice B-tree subjacente. Deve ser preferido a
`CREATE UNIQUE INDEX` quando a restrição de negócio deve ser aplicada no banco.

```sql
CONSTRAINT uq_usuarios_email UNIQUE (email)
```

### Parcial (`WHERE`)

Indexa apenas um subconjunto de linhas. Essencial para tabelas com soft-delete — a maioria das
queries filtra `deleted_at IS NULL`.

```sql
CREATE INDEX idx_contas_pagar_pendentes
  ON contas_pagar (usuario_id, data_vencimento)
  WHERE status = 'pendente' AND deleted_at IS NULL;
```

### Composto (multi-coluna)

Usado quando queries filtram por mais de uma coluna simultaneamente. A coluna mais seletiva vem primeiro.

```sql
CREATE INDEX idx_movimentacoes_usuario_data
  ON movimentacoes_caixa (usuario_id, data DESC);
```

### GIN (Generalized Inverted Index)

Necessário para colunas `JSONB` quando há buscas por campos internos do JSON.

```sql
CREATE INDEX idx_jobs_payload ON jobs USING GIN (payload);
```

---

## Índices por Domínio

### Domínio 1 — Usuários & Autenticação

#### `usuarios`

| Índice                    | Colunas      | Tipo                                        | Justificativa                                      |
| ------------------------- | ------------ | ------------------------------------------- | -------------------------------------------------- |
| `uq_usuarios_email`       | `email`      | UNIQUE                                      | Login por email; corrige legado sem UNIQUE (AL-06) |
| `idx_usuarios_deleted_at` | `deleted_at` | B-Tree parcial (`WHERE deleted_at IS NULL`) | Queries de usuários ativos — maioria das consultas |

#### `webhook_events`

| Índice                      | Colunas                | Tipo                                        | Justificativa                   |
| --------------------------- | ---------------------- | ------------------------------------------- | ------------------------------- |
| `uq_webhook_provider_event` | `(provider, event_id)` | UNIQUE                                      | Idempotência — corrige CR-04    |
| `idx_webhook_processado`    | `processado`           | B-Tree parcial (`WHERE processado = FALSE`) | Fila de eventos não processados |

---

### Domínio 2 — Billing & Assinaturas

#### `assinantes`

| Índice                        | Colunas                   | Tipo   | Justificativa                                      |
| ----------------------------- | ------------------------- | ------ | -------------------------------------------------- |
| `uq_assinantes_usuario`       | `usuario_id`              | UNIQUE | Um usuário = uma assinatura; corrige AL-05         |
| `idx_assinantes_status`       | `status`                  | B-Tree | Listagem por status (ativo/inadimplente/cancelado) |
| `idx_assinantes_proximo_venc` | `data_proximo_vencimento` | B-Tree | Cobrança de renovações por data                    |

#### `assinantes_pagamentos`

| Índice                     | Colunas        | Tipo   | Justificativa                                      |
| -------------------------- | -------------- | ------ | -------------------------------------------------- |
| `idx_pagamentos_assinante` | `assinante_id` | B-Tree | Histórico por assinante; corrige legado sem índice |
| `idx_pagamentos_usuario`   | `usuario_id`   | B-Tree | Consulta por usuário; corrige legado sem índice    |
| `idx_pagamentos_status`    | `status`       | B-Tree | Filtro por status de cobrança                      |

#### `cupons`

| Índice             | Colunas  | Tipo                                  | Justificativa                           |
| ------------------ | -------- | ------------------------------------- | --------------------------------------- |
| `uq_cupons_codigo` | `codigo` | UNIQUE                                | Corrige CR-06 — cupons com mesmo código |
| `idx_cupons_ativo` | `ativo`  | B-Tree parcial (`WHERE ativo = TRUE`) | Validação de cupom busca apenas ativos  |

---

### Domínio 3 — Financeiro — Contas & Movimentação

#### `contas`

| Índice               | Colunas        | Tipo                                 | Justificativa                   |
| -------------------- | -------------- | ------------------------------------ | ------------------------------- |
| `idx_contas_usuario` | `usuario_id`   | B-Tree                               | Listagem de contas por usuário  |
| `idx_contas_ativas`  | `(usuario_id)` | Parcial (`WHERE deleted_at IS NULL`) | Queries padrão de contas ativas |

#### `categorias`

| Índice                   | Colunas      | Tipo   | Justificativa                                     |
| ------------------------ | ------------ | ------ | ------------------------------------------------- |
| `idx_categorias_usuario` | `usuario_id` | B-Tree | Categorias do usuário + sistema (`NULL`)          |
| `idx_categorias_parent`  | `parent_id`  | B-Tree | Busca de subcategorias; corrige legado sem índice |

#### `contas_pagar`

| Índice                      | Colunas                         | Tipo                                  | Justificativa                          |
| --------------------------- | ------------------------------- | ------------------------------------- | -------------------------------------- |
| `idx_cp_usuario_vencimento` | `(usuario_id, data_vencimento)` | B-Tree                                | Dashboard: próximas contas a vencer    |
| `idx_cp_status_pendente`    | `(usuario_id, data_vencimento)` | Parcial (`WHERE status = 'pendente'`) | Filtro de pendentes (query mais comum) |
| `idx_cp_categoria`          | `categoria_id`                  | B-Tree                                | Relatórios por categoria               |
| `idx_cp_conta`              | `conta_id`                      | B-Tree                                | Filtro por conta bancária              |
| `idx_cp_grupo_recorrencia`  | `grupo_recorrencia_id`          | B-Tree                                | Gestão de parcelas (novo no v2)        |

#### `contas_receber`

| Índice                      | Colunas                         | Tipo                                  | Justificativa                 |
| --------------------------- | ------------------------------- | ------------------------------------- | ----------------------------- |
| `idx_cr_usuario_vencimento` | `(usuario_id, data_vencimento)` | B-Tree                                | Dashboard: próximas a receber |
| `idx_cr_status_pendente`    | `(usuario_id, data_vencimento)` | Parcial (`WHERE status = 'pendente'`) | Filtro de pendentes           |
| `idx_cr_categoria`          | `categoria_id`                  | B-Tree                                | Relatórios por categoria      |
| `idx_cr_conta`              | `conta_id`                      | B-Tree                                | Filtro por conta bancária     |

#### `movimentacoes_caixa`

| Índice                  | Colunas                   | Tipo   | Justificativa                              |
| ----------------------- | ------------------------- | ------ | ------------------------------------------ |
| `idx_mov_usuario_data`  | `(usuario_id, data DESC)` | B-Tree | Extrato cronológico — query mais frequente |
| `idx_mov_conta_data`    | `(conta_id, data DESC)`   | B-Tree | Extrato por conta                          |
| `idx_mov_categoria`     | `categoria_id`            | B-Tree | Relatórios por categoria                   |
| `idx_mov_conta_pagar`   | `conta_pagar_id`          | B-Tree | Vincular lançamento a conta a pagar        |
| `idx_mov_conta_receber` | `conta_receber_id`        | B-Tree | Vincular lançamento a conta a receber      |

---

### Domínio 4 — Investimentos

#### `investimentos`

| Índice                | Colunas                | Tipo   | Justificativa                     |
| --------------------- | ---------------------- | ------ | --------------------------------- |
| `idx_inv_usuario`     | `usuario_id`           | B-Tree | Portfólio do usuário              |
| `idx_inv_tipo`        | `tipo_investimento_id` | B-Tree | Filtro por tipo de investimento   |
| `idx_inv_instituicao` | `instituicao_id`       | B-Tree | Filtro por instituição financeira |

#### `investimentos_eventos`

| Índice                   | Colunas                   | Tipo   | Justificativa                                      |
| ------------------------ | ------------------------- | ------ | -------------------------------------------------- |
| `idx_invev_investimento` | `investimento_id`         | B-Tree | Histórico por investimento (cálculo de rendimento) |
| `idx_invev_usuario_data` | `(usuario_id, data DESC)` | B-Tree | Corrige legado sem índice em user_id               |

---

### Domínio 5 — Metas & Objetivos

#### `metas`

| Índice              | Colunas                | Tipo   | Justificativa                |
| ------------------- | ---------------------- | ------ | ---------------------------- |
| `idx_metas_usuario` | `usuario_id`           | B-Tree | Listagem de metas do usuário |
| `idx_metas_status`  | `(usuario_id, status)` | B-Tree | Filtro de metas ativas       |

#### `metas_movimentos`

| Índice                     | Colunas           | Tipo   | Justificativa                                        |
| -------------------------- | ----------------- | ------ | ---------------------------------------------------- |
| `idx_metamov_meta`         | `meta_id`         | B-Tree | SUM de progresso por meta; corrige legado sem índice |
| `idx_metamov_usuario`      | `usuario_id`      | B-Tree | Histórico de aportes do usuário                      |
| `idx_metamov_movimentacao` | `movimentacao_id` | B-Tree | Vínculo com lançamento de caixa (novo no v2)         |

---

### Domínio 6 — Anexos & Documentos

#### `anexos`

| Índice               | Colunas       | Tipo   | Justificativa                        |
| -------------------- | ------------- | ------ | ------------------------------------ |
| `idx_anexos_usuario` | `usuario_id`  | B-Tree | Listagem de anexos do usuário        |
| `idx_anexos_hash`    | `hash_sha256` | B-Tree | Deduplicação de uploads (novo no v2) |

#### `anexos_vinculos`

| Índice                   | Colunas                        | Tipo   | Justificativa                                           |
| ------------------------ | ------------------------------ | ------ | ------------------------------------------------------- |
| `idx_avinculos_entidade` | `(entidade_tipo, entidade_id)` | B-Tree | Busca de anexos por entidade (índice existia no legado) |
| `idx_avinculos_anexo`    | `anexo_id`                     | B-Tree | Todos os vínculos de um anexo                           |

---

### Domínio 7 — Comunicação & Logs

#### `whatsapp_logs`

| Índice                | Colunas          | Tipo   | Justificativa         |
| --------------------- | ---------------- | ------ | --------------------- |
| `idx_wlogs_usuario`   | `usuario_id`     | B-Tree | Histórico por usuário |
| `idx_wlogs_criado_em` | `criado_em DESC` | B-Tree | Paginação cronológica |

#### `jobs`

| Índice                     | Colunas                   | Tipo                                  | Justificativa                                   |
| -------------------------- | ------------------------- | ------------------------------------- | ----------------------------------------------- |
| `idx_jobs_status_agendado` | `(status, agendado_para)` | Parcial (`WHERE status = 'pendente'`) | Worker busca próximo job a processar            |
| `idx_jobs_payload`         | `payload`                 | GIN                                   | Busca por campos internos do JSONB (novo no v2) |

---

## Índices Especiais para Soft-Delete

Todas as entidades de negócio possuem `deleted_at TIMESTAMPTZ`. O padrão recomendado é criar um
**índice parcial** que exclui registros deletados — reduz tamanho do índice e melhora performance
de leitura (a maioria das queries filtra `deleted_at IS NULL`):

```sql
-- Exemplo de índice parcial para soft-delete
CREATE INDEX idx_contas_ativas
  ON contas (usuario_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_metas_ativas
  ON metas (usuario_id)
  WHERE deleted_at IS NULL;

-- Repetir para: contas_pagar, contas_receber, movimentacoes_caixa,
-- investimentos, metas, anexos, assinantes, usuarios
```

---

## Estratégia de Manutenção

### VACUUM e ANALYZE

```sql
-- Executar após carga inicial de dados (ETL)
VACUUM ANALYZE;

-- Programar VACUUM periódico para tabelas de alto volume
-- (via pg_cron ou cron externo)
-- Tabelas: webhook_events, whatsapp_logs, jobs, movimentacoes_caixa
```

### Monitoramento de Uso de Índices

```sql
-- Identificar índices não utilizados (candidatos à remoção)
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY tablename, indexname;

-- Identificar tabelas com full table scan frequente
SELECT relname, seq_scan, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan
ORDER BY seq_scan DESC;
```

### Detecção de Índices Inchados (Bloat)

```sql
-- Identificar índices fragmentados que se beneficiam de REINDEX
SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) AS tamanho
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;
```

### Política de Recriação

- **CONCURRENTLY**: usar `CREATE INDEX CONCURRENTLY` e `REINDEX CONCURRENTLY` em produção para
  evitar lock de tabela.
- **Após migrações de dados (ETL):** desabilitar índices antes do bulk insert, recriar após —
  mais rápido que atualização incremental para grandes volumes.
- **Revisão trimestral:** executar a query de índices não utilizados e remover os que ficaram
  zerados por 90+ dias.

---

## Resumo: Índices Críticos Obrigatórios no Dia 1

Os índices abaixo devem existir no `db/schema.sql` antes do primeiro deploy em produção:

| Prioridade | Índice                      | Tabela                  | Tipo            |
| :--------: | --------------------------- | ----------------------- | --------------- |
|     🔴     | `uq_usuarios_email`         | `usuarios`              | UNIQUE          |
|     🔴     | `uq_assinantes_usuario`     | `assinantes`            | UNIQUE          |
|     🔴     | `uq_cupons_codigo`          | `cupons`                | UNIQUE          |
|     🔴     | `uq_webhook_provider_event` | `webhook_events`        | UNIQUE          |
|     🟠     | `idx_cp_usuario_vencimento` | `contas_pagar`          | B-Tree composto |
|     🟠     | `idx_cr_usuario_vencimento` | `contas_receber`        | B-Tree composto |
|     🟠     | `idx_mov_usuario_data`      | `movimentacoes_caixa`   | B-Tree composto |
|     🟠     | `idx_pagamentos_assinante`  | `assinantes_pagamentos` | B-Tree          |
|     🟠     | `idx_invev_investimento`    | `investimentos_eventos` | B-Tree          |
|     🟠     | `idx_metamov_meta`          | `metas_movimentos`      | B-Tree          |
|     🟡     | `idx_jobs_status_agendado`  | `jobs`                  | B-Tree parcial  |
|     🟡     | `idx_jobs_payload`          | `jobs`                  | GIN             |

---

_Documento gerado em: 2026-03-03_  
_Documentos relacionados: `01-legacy-schema-mapping.md`, `03-legacy-issues.md` (ME-05)_
