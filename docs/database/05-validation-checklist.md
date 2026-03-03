# 05 — Checklist de Validação do Levantamento Legado

> **Data:** 2026-03-03  
> **Propósito:** Confirmar que todos os critérios de aceite do levantamento do esquema legado MySQL
> foram atendidos e que os documentos produzidos estão prontos para alimentar o redesenho ERD Postgres v2
> (subtask 02.1).

---

## AC1 — Cobertura Total das Tabelas

### ✅ 21 tabelas mapeadas e classificadas em 7 domínios

| # | Domínio                   | Tabela MySQL           | PK Identificada | FKs Mapeadas | Índices Listados | Documento     |
|---|---------------------------|------------------------|:---------------:|:------------:|:----------------:|---------------|
| 1 | Usuários & Autenticação   | `users`                | ✅ `id`         | ✅ (nenhuma) | ✅               | `01-legacy-schema-mapping.md` §1 |
| 2 | Usuários & Autenticação   | `webhook_logs`         | ✅ `id`         | ✅ (nenhuma) | ✅               | `01-legacy-schema-mapping.md` §1 |
| 3 | Billing & Assinaturas     | `plans`                | ✅ `id`         | ✅ (nenhuma) | ✅               | `01-legacy-schema-mapping.md` §2 |
| 4 | Billing & Assinaturas     | `subscriptions`        | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §2 |
| 5 | Billing & Assinaturas     | `payments`             | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §2 |
| 6 | Billing & Assinaturas     | `coupons`              | ✅ `id`         | ✅ (nenhuma) | ✅               | `01-legacy-schema-mapping.md` §2 |
| 7 | Financeiro — Contas       | `accounts`             | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §3 |
| 8 | Financeiro — Contas       | `categories`           | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §3 |
| 9 | Financeiro — Contas       | `bills`                | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §3 |
|10 | Financeiro — Contas       | `receivables`          | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §3 |
|11 | Financeiro — Contas       | `transactions`         | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §3 |
|12 | Investimentos             | `investment_types`     | ✅ `id`         | ✅ (nenhuma) | ✅               | `01-legacy-schema-mapping.md` §4 |
|13 | Investimentos             | `banks`                | ✅ `id`         | ✅ (nenhuma) | ✅               | `01-legacy-schema-mapping.md` §4 |
|14 | Investimentos             | `investments`          | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §4 |
|15 | Investimentos             | `investment_events`    | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §4 |
|16 | Metas & Objetivos         | `goals`                | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §5 |
|17 | Metas & Objetivos         | `goal_movements`       | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §5 |
|18 | Anexos & Documentos       | `attachments`          | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §6 |
|19 | Anexos & Documentos       | `attachment_relations` | ✅ `id`         | ✅ ❌ polim. | ✅               | `01-legacy-schema-mapping.md` §6 |
|20 | Comunicação & Logs        | `whatsapp_messages`    | ✅ `id`         | ✅ ⚠️ impl.  | ✅               | `01-legacy-schema-mapping.md` §7 |
|21 | Comunicação & Logs        | `background_jobs`      | ✅ `id`         | ✅ (nenhuma) | ✅               | `01-legacy-schema-mapping.md` §7 |

**Resultado:** ✅ 21/21 tabelas cobertas — 100% de cobertura.

---

## AC2 — Precisão Técnica por Tabela

### ✅ PK identificada em todas as tabelas

Todas as 21 tabelas possuem PK `id INT AUTO_INCREMENT` no legado MySQL.

### ✅ FKs identificadas (ou marcadas como implícitas)

| Tipo de FK | Qtd | Tabelas |
|-----------|:---:|---------|
| ✅ Explícita no DDL | 0 | *(nenhuma no legado)* |
| ⚠️ Implícita (via PHP) | 34 | Todas as tabelas com `user_id`, `account_id`, etc. |
| ❌ Polimórfica (sem FK real) | 1 | `attachment_relations.entity_id` |

> ⚠️ **Confirmado:** O legado MySQL não possui **nenhuma FK explícita** declarada no DDL.
> Todas as 34 relações identificadas são mantidas exclusivamente via código PHP.

### ✅ Índices e UNIQUE declarados

| Campo | Tabela | Índice Legado | Observação |
|-------|--------|:-------------:|------------|
| `user_id` | `accounts`, `categories`, `bills`, `receivables`, `transactions`, `investments`, `goals`, `attachments`, `whatsapp_messages` | ✅ | Declarado no legado |
| `due_date` | `bills`, `receivables` | ✅ | Declarado no legado |
| `date` | `transactions` | ✅ | Declarado no legado |
| `investment_id` | `investment_events` | ✅ | Declarado no legado |
| `goal_id` | `goal_movements` | ✅ | Declarado no legado |
| `status` | `background_jobs` | ✅ | Declarado no legado |
| `processed` | `webhook_logs` | ✅ | Declarado no legado |
| `entity_type, entity_id` | `attachment_relations` | ✅ | Declarado no legado |
| `email` | `users` | ❌ | **Ausente** — full table scan no login |
| `user_id` | `subscriptions`, `payments` | ❌ | **Ausente** — corrigido no v2 |
| `code` | `coupons` | ❌ | **Ausente** — full table scan na validação |
| `parent_id` | `categories` | ❌ | **Ausente** — corrigido no v2 |
| `user_id` | `investment_events` | ❌ | **Ausente** — corrigido no v2 |

### ✅ Observações de design documentadas

Todas as tabelas possuem seção "Questões de design" em `01-legacy-schema-mapping.md` descrevendo
os anti-patterns identificados e a correção proposta para o Postgres v2.

---

## AC3 — Relacionamentos Validados

### ✅ `usuario_id → usuarios` (todas as tabelas)

Confirmado via análise de `auth.php` (`getUsuarioId()`, `requireLogin()`) e presente em:
`subscriptions`, `payments`, `accounts`, `categories`, `bills`, `receivables`, `transactions`,
`investments`, `investment_events`, `goals`, `goal_movements`, `attachments`, `whatsapp_messages`
— **13 tabelas** com FK para `users.id`.

### ✅ `assinantes → pagamentos / webhook`

| Relação | Arquivo PHP | Evidência |
|---------|-------------|-----------|
| `payments.subscription_id → subscriptions.id` | `asaas_client.php` | Criação de pagamento vinculando `subscription_id` |
| `subscriptions.coupon_id → coupons.id` | `checkout_assinatura.php` | Busca de cupom por ID antes de aplicar desconto |

### ✅ `contas_pagar`/`receber` → `categorias`/`contas`/`usuarios`

| Relação | Arquivo PHP | Evidência |
|---------|-------------|-----------|
| `bills.category_id → categories.id` | `contas_pagar.php` | JOIN explícito `categories ON bills.category_id` |
| `bills.account_id → accounts.id` | `contas_pagar.php` | JOIN para obter nome da conta no lançamento |
| `receivables.category_id → categories.id` | `contas_receber.php` | JOIN idêntico ao de `bills` |
| `receivables.account_id → accounts.id` | `contas_receber.php` | JOIN para obter nome da conta |

### ✅ `movimentacoes_caixa → origem` (pagar/receber/manual)

| Relação | Arquivo PHP | Evidência |
|---------|-------------|-----------|
| `transactions.bill_id → bills.id` | `contas_pagar.php` | UPDATE `bills.status = 'paid'` ao lançar transação |
| `transactions.receivable_id → receivables.id` | `contas_receber.php` | UPDATE `receivables.status = 'received'` ao lançar transação |

### ✅ `anexos_vinculos → entidade` (polimórfica)

Relação polimórfica confirmada: `attachment_relations.entity_type` + `entity_id` vincula a
`bills`, `receivables`, `investments`, `goals` ou `transactions`.

No Postgres v2 (`anexos_vinculos`): CHECK constraint
`entidade_tipo IN ('contas_pagar', 'contas_receber', 'investimentos', 'metas', 'movimentacoes_caixa')`.

### ✅ Relações auto-referenciais

| Relação | Evidência |
|---------|-----------|
| `categories.parent_id → categories.id` | `configuracoes_financeiras.php`: `SELECT filhos WHERE parent_id = ?` |

---

## AC4 — Lista de Problemas do Legado

### ✅ 25 problemas documentados em `03-legacy-issues.md`

| Código | Descrição | Severidade | Documento |
|--------|-----------|:----------:|-----------|
| CR-01 | Ausência Total de Foreign Keys Explícitas | 🔴 Crítico | `03-legacy-issues.md` |
| CR-02 | Saldo Armazenado em `accounts.balance` | 🔴 Crítico | `03-legacy-issues.md` |
| CR-03 | Sem Soft-Delete em Entidades Financeiras | 🔴 Crítico | `03-legacy-issues.md` |
| CR-04 | `webhook_logs` Sem Campo `event_id` | 🔴 Crítico | `03-legacy-issues.md` |
| CR-05 | Overflow de `INT` em Tabelas de Alto Volume | 🔴 Crítico | `03-legacy-issues.md` |
| CR-06 | `coupons.code` Sem UNIQUE | 🔴 Crítico | `03-legacy-issues.md` |
| AL-01 | `status` e `type` como VARCHAR Livre | 🟠 Alto | `03-legacy-issues.md` |
| AL-02 | `investments.current_value` e `goals.current_amount` Desnormalizados | 🟠 Alto | `03-legacy-issues.md` |
| AL-03 | `bills` e `receivables` Sem Suporte a Parcelamento | 🟠 Alto | `03-legacy-issues.md` |
| AL-04 | `attachment_relations.entity_type` Sem Validação de Domínio | 🟠 Alto | `03-legacy-issues.md` |
| AL-05 | `subscriptions` Sem UNIQUE em `user_id` | 🟠 Alto | `03-legacy-issues.md` |
| AL-06 | `users.email` Sem UNIQUE | 🟠 Alto | `03-legacy-issues.md` |
| AL-07 | `background_jobs.payload` como `LONGTEXT` | 🟠 Alto | `03-legacy-issues.md` |
| ME-01 | `DATETIME` Sem Timezone | 🟡 Médio | `03-legacy-issues.md` |
| ME-02 | `INT AUTO_INCREMENT` Exposto em APIs | 🟡 Médio | `03-legacy-issues.md` |
| ME-03 | `avatar`/`logo` Armazenados como Caminhos Locais | 🟡 Médio | `03-legacy-issues.md` |
| ME-04 | `banks.ispb` e `banks.compe` como Campos Separados | 🟡 Médio | `03-legacy-issues.md` |
| ME-05 | Ausência de Índices em Campos de Filtro Críticos | 🟡 Médio | `03-legacy-issues.md` |
| ME-06 | `recurrence` em `bills`/`receivables` Como String Livre | 🟡 Médio | `03-legacy-issues.md` |
| ME-07 | Ausência de CHECK em Campos Monetários | 🟡 Médio | `03-legacy-issues.md` |
| ME-08 | `coupons.discount_type` Como String Livre | 🟡 Médio | `03-legacy-issues.md` |
| BA-01 | `TINYINT(1)` Usado como Boolean | 🟢 Baixo | `03-legacy-issues.md` |
| BA-02 | `users.username` Redundante com `users.email` | 🟢 Baixo | `03-legacy-issues.md` |
| BA-03 | `plans` Tabela Separada com `features` Como JSON em TEXT | 🟢 Baixo | `03-legacy-issues.md` |
| BA-04 | `color` Sem Validação de Formato Hex | 🟢 Baixo | `03-legacy-issues.md` |

**Resultado:** ✅ 25/25 problemas documentados com severidade e recomendação de correção.

---

## Validação dos Documentos Entregues

| Documento | Status | Critério Atendido |
|-----------|:------:|-------------------|
| `00-index.md` | ✅ Completo | Índice geral com navegação, sumário executivo e tabela de decisões |
| `01-legacy-schema-mapping.md` | ✅ Completo | 21 tabelas detalhadas com colunas, PK, FK, índices e questões de design |
| `02-relationships-matrix.md` | ✅ Completo | 34+ relacionamentos mapeados com comportamento de cascade para Postgres v2 |
| `03-legacy-issues.md` | ✅ Completo | 25 problemas com severidade, impacto, exemplo e correção |
| `04-indexing-strategy.md` | ✅ Completo | Índices por domínio/tabela, tipos, manutenção e ranking de prioridade |
| `05-validation-checklist.md` | ✅ Este documento | Confirma AC1-AC4 atendidos |

---

## Declaração de Prontidão para Sprint 02

Com base na validação acima, confirmo que:

- [x] **AC1:** 100% das 21 tabelas estão listadas, classificadas e detalhadas
- [x] **AC2:** Cada tabela possui PK, FKs (ou marcação ⚠️/❌), índices e observações de design
- [x] **AC3:** Todos os relacionamentos críticos foram identificados e validados no código PHP
- [x] **AC4:** 25 problemas do legado documentados com severidade e recomendações de correção

**✅ O levantamento do esquema legado está COMPLETO.**  
**✅ Os documentos estão prontos para alimentar o redesenho ERD Postgres v2 (subtask 02.1).**

> ⚠️ **Atenção para o sprint 02.1:** Os 6 problemas críticos (CR-01 a CR-06) identificados no legado
> **devem ser corrigidos** no ERD v2. Em especial: adicionar FKs explícitas com cascade adequado,
> remover saldos desnormalizados, implementar soft-delete e garantir idempotência de webhooks.

---

*Documento gerado em: 2026-03-03*  
*Documentos relacionados: `00-index.md`, `01-legacy-schema-mapping.md`, `02-relationships-matrix.md`,
`03-legacy-issues.md`, `04-indexing-strategy.md`*
