# Mapeamento Legado MySQL → Postgres

## Contexto

Este documento mapeia o modelo de dados legado do Finlly (MySQL) para o novo modelo Postgres v2.  
Identifica tabelas renomeadas, colunas alteradas, tipos migrados e funcionalidades substituídas.

---

## Tabelas Mapeadas

| Tabela MySQL (legado)     | Tabela Postgres (v2)       | Status       | Observações                                                   |
| ------------------------- | -------------------------- | ------------ | ------------------------------------------------------------- |
| `users`                   | `usuarios`                 | ✅ Renomeada | `id` INT → UUID; `password` → `senha_hash`                    |
| `plans` / `subscriptions` | `assinantes`               | ✅ Unificada | Uma tabela por usuário, FK 1:1                                |
| `payments`                | `assinantes_pagamentos`    | ✅ Renomeada | `status` string → ENUM `status_pagamento`                     |
| `cupons`                  | `cupons`                   | ✅ Renomeada | `discount` genérico → `desconto_percentual` + `desconto_fixo` |
| `webhook_logs`            | `webhook_events`           | ✅ Renomeada | INT → BIGSERIAL; campo `event_id` para idempotência           |
| `accounts`                | `contas`                   | ✅ Renomeada | `balance` DECIMAL removido → calculado via movimentacoes      |
| `categories`              | `categorias`               | ✅ Renomeada | Hierarquia via `pai_id` (antes sem hierarquia)                |
| `bills`                   | `contas_pagar`             | ✅ Renomeada | `status` string → ENUM; parcelas adicionadas                  |
| `receivables`             | `contas_receber`           | ✅ Renomeada | `status` string → ENUM; parcelas adicionadas                  |
| `transactions`            | `movimentacoes_caixa`      | ✅ Renomeada | `type` string → ENUM `tipo_movimentacao`                      |
| `investment_types`        | `tipos_investimento`       | ✅ Renomeada | Lookup table mantida                                          |
| `banks`                   | `instituicoes_financeiras` | ✅ Renomeada | `ispb` + `compe` → `codigo_compensacao`                       |
| `investments`             | `investimentos`            | ✅ Renomeada | `current_value` removido → calculado via eventos              |
| `investment_events`       | `investimentos_eventos`    | ✅ Renomeada | `type` string → ENUM `tipo_evento_investimento`               |
| `goals`                   | `metas`                    | ✅ Renomeada | `current_amount` removido → SUM(metas_movimentos)             |
| `goal_movements`          | `metas_movimentos`         | ✅ Renomeada | Link opcional a movimentacoes_caixa adicionado                |
| `attachments`             | `anexos`                   | ✅ Renomeada | `hash_sha256` adicionado para deduplicação                    |
| `attachment_relations`    | `anexos_vinculos`          | ✅ Renomeada | `entity_type` restrito via CHECK constraint                   |
| `whatsapp_messages`       | `whatsapp_logs`            | ✅ Renomeada | INT → BIGSERIAL; hard-delete                                  |
| `background_jobs`         | `jobs`                     | ✅ Renomeada | INT → BIGSERIAL; `status` via CHECK constraint                |

---

## Mudanças de Tipo de Dado

| Campo            | MySQL (legado)             | Postgres (v2)                    | Motivo                                                     |
| ---------------- | -------------------------- | -------------------------------- | ---------------------------------------------------------- |
| `id` (entidades) | `INT AUTO_INCREMENT`       | `UUID DEFAULT gen_random_uuid()` | Escalabilidade, interoperabilidade, sem exposição seq.     |
| `id` (logs/jobs) | `INT AUTO_INCREMENT`       | `BIGSERIAL`                      | Alto throughput, ordenação temporal natural                |
| `status`         | `VARCHAR(20)` (string)     | ENUM Postgres                    | Integridade de dados, erro em tempo de inserção            |
| `type`           | `VARCHAR(50)` (string)     | ENUM Postgres                    | Idem                                                       |
| `created_at`     | `DATETIME`                 | `TIMESTAMPTZ`                    | Timezone-aware; DATETIME perde info de fuso                |
| `updated_at`     | `DATETIME`                 | `TIMESTAMPTZ`                    | Idem                                                       |
| `deleted_at`     | `DATETIME` ou ausente      | `TIMESTAMPTZ` (NULL = ativo)     | Soft-delete padronizado em todas entidades financeiras     |
| `balance`        | `DECIMAL(10,2)` armazenado | Calculado via query              | Evita inconsistência entre saldo e movimentações           |
| `current_amount` | `DECIMAL(10,2)` armazenado | Calculado via query              | Idem para metas e investimentos                            |
| Texto monetário  | `FLOAT` em alguns campos   | `NUMERIC(10,2)`                  | `FLOAT` tem erro de arredondamento para valores monetários |

---

## Colunas Removidas (Calculadas)

| Tabela (legado) | Coluna Removida  | Como Calcular (v2)                                                                                                                              |
| --------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `accounts`      | `balance`        | `SELECT SUM(CASE tipo WHEN 'entrada' THEN valor ELSE -valor END) FROM movimentacoes_caixa WHERE conta_id = ?`                                   |
| `investments`   | `current_value`  | `SELECT SUM(CASE tipo WHEN 'aporte' THEN valor WHEN 'resgate' THEN -valor ELSE valor END) FROM investimentos_eventos WHERE investimento_id = ?` |
| `goals`         | `current_amount` | `SELECT SUM(valor) FROM metas_movimentos WHERE meta_id = ?`                                                                                     |

---

## Colunas Adicionadas (v2)

| Tabela (v2)           | Coluna Adicionada                                         | Motivo                                               |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| `usuarios`            | `deleted_at`                                              | Soft-delete para conformidade LGPD                   |
| `contas_pagar`        | `parcela_atual`, `total_parcelas`, `grupo_recorrencia_id` | Suporte a parcelamento e recorrência                 |
| `contas_receber`      | `parcela_atual`, `total_parcelas`, `grupo_recorrencia_id` | Idem                                                 |
| `movimentacoes_caixa` | `conta_destino_id`                                        | Suporte a transferências entre contas                |
| `movimentacoes_caixa` | `conta_pagar_id`, `conta_receber_id`                      | Vínculo entre pagamento e lançamento                 |
| `anexos`              | `hash_sha256`                                             | Deduplicação de arquivos por usuário                 |
| `metas_movimentos`    | `movimentacao_id`                                         | Vínculo ao lançamento real de caixa                  |
| `webhook_events`      | `event_id`                                                | Idempotência (evitar reprocessamento de webhooks)    |
| `categorias`          | `pai_id`, `is_sistema`                                    | Hierarquia de categorias e categorias padrão sistema |

---

## Constraints Adicionadas

| Tabela                | Constraint                                                        | Tipo   | Motivo                        |
| --------------------- | ----------------------------------------------------------------- | ------ | ----------------------------- |
| `usuarios`            | `UNIQUE (email)`                                                  | Unique | Evitar duplicatas no cadastro |
| `assinantes`          | `UNIQUE (usuario_id)`                                             | Unique | Um plano por usuário          |
| `cupons`              | `UNIQUE (codigo)`                                                 | Unique | Código único                  |
| `webhook_events`      | `UNIQUE (provider, event_id)`                                     | Unique | Idempotência de eventos       |
| `contas_pagar`        | `CHECK (parcela_atual <= total_parcelas)`                         | Check  | Integridade de parcelas       |
| `contas_receber`      | `CHECK (parcela_atual <= total_parcelas)`                         | Check  | Idem                          |
| `movimentacoes_caixa` | `CHECK (tipo <> 'transferencia' OR conta_destino_id IS NOT NULL)` | Check  | Transferência exige destino   |
| `cupons`              | `CHECK (apenas um tipo de desconto)`                              | Check  | Percentual OU fixo, não ambos |
| `contas`              | `CHECK (cor ~ '^#[0-9A-Fa-f]{6}$')`                               | Check  | Formato hex válido            |

---

## Relacionamentos Adicionados (FKs Explícitas)

No modelo legado MySQL, diversas relações eram implícitas (sem FK declarada). No Postgres v2 todas são explícitas:

| Tabela                | FK Nova                                    | ON DELETE |
| --------------------- | ------------------------------------------ | --------- |
| `contas`              | `usuario_id → usuarios.id`                 | CASCADE   |
| `categorias`          | `usuario_id → usuarios.id`                 | CASCADE   |
| `contas_pagar`        | `usuario_id → usuarios.id`                 | CASCADE   |
| `contas_pagar`        | `categoria_id → categorias.id`             | SET NULL  |
| `contas_pagar`        | `conta_id → contas.id`                     | SET NULL  |
| `contas_receber`      | `usuario_id → usuarios.id`                 | CASCADE   |
| `movimentacoes_caixa` | `conta_id → contas.id`                     | RESTRICT  |
| `movimentacoes_caixa` | `conta_destino_id → contas.id`             | SET NULL  |
| `investimentos`       | `tipo_id → tipos_investimento.id`          | RESTRICT  |
| `metas_movimentos`    | `movimentacao_id → movimentacoes_caixa.id` | SET NULL  |

---

## Decisões de ON DELETE

| Estratégia | Quando Usar                                    | Exemplo                                                 |
| ---------- | ---------------------------------------------- | ------------------------------------------------------- |
| `CASCADE`  | Registro filho não faz sentido sem o pai       | `contas` sem `usuario`, `movimentacoes` sem `usuario`   |
| `SET NULL` | Relacionamento não-crítico; filho pode existir | `conta_pagar.categoria_id`, `whatsapp_logs.usuario_id`  |
| `RESTRICT` | Não pode deletar pai se filho existir          | `movimentacoes_caixa.conta_id`, `investimentos.tipo_id` |

---

_Documento gerado em: 2026-02-27_
