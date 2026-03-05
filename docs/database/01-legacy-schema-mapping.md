# 01 — Levantamento do Esquema Legado (MySQL)

> **Fonte:** dump `finlly_go.sql` + código PHP (`auth.php`, `assinatura.php`, `checkout_assinatura.php`,
> `contas_pagar.php`, `contas_receber.php`, `configuracoes_financeiras.php`, `asaas_client.php`)  
> **Data:** 2026-03-02  
> **Propósito:** Inventariar completamente o esquema MySQL legado para informar o redesenho em Postgres v2.

---

## Sumário de Domínios

| Domínio                 | Tabelas MySQL (legado)                                           | Qtd    |
| ----------------------- | ---------------------------------------------------------------- | ------ |
| Usuários & Autenticação | `users`, `webhook_logs`                                          | 2      |
| Billing & Assinaturas   | `plans`, `subscriptions`, `payments`, `cupons`                   | 4      |
| Financeiro — Contas     | `accounts`, `categories`, `bills`, `receivables`, `transactions` | 5      |
| Investimentos           | `investment_types`, `banks`, `investments`, `investment_events`  | 4      |
| Metas & Objetivos       | `goals`, `goal_movements`                                        | 2      |
| Anexos & Documentos     | `attachments`, `attachment_relations`                            | 2      |
| Comunicação & Logs      | `whatsapp_messages`, `background_jobs`                           | 2      |
| **Total**               |                                                                  | **21** |

---

## Seção 1 — Inventário Técnico de Tabelas

### Domínio: Usuários & Autenticação

---

#### Tabela `users`

**Nome proposto (Postgres):** `usuarios`  
**Finalidade:** Entidade central do sistema. Todo registro de negócio possui FK para esta tabela.

| Campo        | Tipo MySQL           | Nullable | Default | Observações                              |
| ------------ | -------------------- | -------- | ------- | ---------------------------------------- |
| `id`         | `INT AUTO_INCREMENT` | NOT NULL | —       | PK sequencial exposta (anti-pattern)     |
| `username`   | `VARCHAR(100)`       | NOT NULL | —       | Usado como login; duplicação com `email` |
| `email`      | `VARCHAR(255)`       | NOT NULL | —       | Sem UNIQUE explícita no legado           |
| `password`   | `VARCHAR(255)`       | NOT NULL | —       | Hash MD5 ou bcrypt conforme versão       |
| `name`       | `VARCHAR(255)`       | NULL     | NULL    | Nome completo                            |
| `phone`      | `VARCHAR(20)`        | NULL     | NULL    |                                          |
| `avatar`     | `VARCHAR(255)`       | NULL     | NULL    | Caminho relativo ao filesystem local     |
| `created_at` | `DATETIME`           | NOT NULL | `NOW()` | Sem timezone                             |
| `updated_at` | `DATETIME`           | NOT NULL | `NOW()` | Sem timezone                             |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:**

- `INDEX (username)` — busca por login
- Sem índice em `email` (❌ problema)

**Volume estimado:** Baixo/Médio (base de usuários SaaS)  
**Operações principais:** INSERT (cadastro), SELECT (autenticação), UPDATE (perfil), soft-delete ausente  
**Questões de design:**

- Sem soft-delete (`deleted_at`): remoção física viola LGPD
- `password` em campo genérico — nome não documenta que é hash
- `username` redundante com `email` — dois identificadores de login
- `INT AUTO_INCREMENT` expõe enumeração de IDs na API
- `avatar` armazena path local — não funciona em ambientes distribuídos

---

#### Tabela `webhook_logs`

**Nome proposto (Postgres):** `webhook_events`  
**Finalidade:** Log de eventos recebidos de provedores externos (Asaas, Stripe). Auditoria e idempotência.

| Campo        | Tipo MySQL           | Nullable | Default | Observações                          |
| ------------ | -------------------- | -------- | ------- | ------------------------------------ |
| `id`         | `INT AUTO_INCREMENT` | NOT NULL | —       | PK; volume alto — deveria ser BIGINT |
| `provider`   | `VARCHAR(50)`        | NOT NULL | —       | Ex: `asaas`, `stripe`                |
| `event_type` | `VARCHAR(100)`       | NOT NULL | —       | Ex: `PAYMENT_RECEIVED`               |
| `payload`    | `LONGTEXT`           | NOT NULL | —       | JSON serializado como texto          |
| `processed`  | `TINYINT(1)`         | NOT NULL | `0`     | Flag booleana (0/1)                  |
| `created_at` | `DATETIME`           | NOT NULL | `NOW()` |                                      |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:**

- `INDEX (processed)` — fila de processamento
- Sem `event_id` do provedor: sem garantia de idempotência (❌ crítico)

**Volume estimado:** Alto (um registro por evento de cobrança)  
**Operações principais:** INSERT (recebimento), UPDATE (marcar processado), SELECT (fila pendente)  
**Questões de design:**

- `payload` como `LONGTEXT` sem indexação JSON — buscas impossíveis
- Sem campo `event_id` (ID do evento no provedor): duplicatas não detectadas
- `processed` como TINYINT em vez de BOOLEAN/ENUM — semântica opaca

---

### Domínio: Billing & Assinaturas

---

#### Tabela `plans`

**Nome proposto (Postgres):** _unificada em `assinantes`_  
**Finalidade:** Configuração de planos disponíveis (free, pro, enterprise).

| Campo        | Tipo MySQL           | Nullable | Default | Observações              |
| ------------ | -------------------- | -------- | ------- | ------------------------ |
| `id`         | `INT AUTO_INCREMENT` | NOT NULL | —       | PK                       |
| `name`       | `VARCHAR(50)`        | NOT NULL | —       | Ex: `free`, `pro`        |
| `price`      | `DECIMAL(10,2)`      | NOT NULL | `0.00`  |                          |
| `features`   | `TEXT`               | NULL     | NULL    | JSON livre sem validação |
| `created_at` | `DATETIME`           | NOT NULL | `NOW()` |                          |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Questões de design:**

- `features` como JSON em TEXT — sem validação de esquema
- Redundante com `subscriptions` quando unificado em `assinantes`

---

#### Tabela `subscriptions`

**Nome proposto (Postgres):** `assinantes` (unificada com `plans`)  
**Finalidade:** Assinatura ativa de cada usuário em um plano.

| Campo          | Tipo MySQL           | Nullable | Default   | Observações                  |
| -------------- | -------------------- | -------- | --------- | ---------------------------- |
| `id`           | `INT AUTO_INCREMENT` | NOT NULL | —         | PK                           |
| `user_id`      | `INT`                | NOT NULL | —         | FK implícita → `users.id`    |
| `plan_id`      | `INT`                | NOT NULL | —         | FK implícita → `plans.id`    |
| `status`       | `VARCHAR(20)`        | NOT NULL | `'trial'` | String livre: sem ENUM/CHECK |
| `provider`     | `VARCHAR(50)`        | NULL     | NULL      | Ex: `asaas`                  |
| `provider_id`  | `VARCHAR(100)`       | NULL     | NULL      | ID da assinatura no provedor |
| `coupon_id`    | `INT`                | NULL     | NULL      | FK implícita → `cupons.id`   |
| `trial_start`  | `DATETIME`           | NULL     | NULL      |                              |
| `trial_end`    | `DATETIME`           | NULL     | NULL      |                              |
| `next_billing` | `DATETIME`           | NULL     | NULL      |                              |
| `created_at`   | `DATETIME`           | NOT NULL | `NOW()`   |                              |
| `updated_at`   | `DATETIME`           | NOT NULL | `NOW()`   |                              |

**PK:** `id`  
**FKs Explícitas:** nenhuma (todas implícitas por convenção de código PHP)  
**Índices:** nenhum declarado no schema (❌ `user_id` sem índice)  
**Questões de design:**

- `status` como `VARCHAR` livre — valores inválidos possíveis
- FKs para `users`, `plans`, `cupons` não declaradas — integridade violável
- Sem UNIQUE em `user_id`: múltiplas assinaturas ativas por usuário possível

---

#### Tabela `payments`

**Nome proposto (Postgres):** `assinantes_pagamentos`  
**Finalidade:** Histórico de cobranças e pagamentos de assinaturas.

| Campo             | Tipo MySQL           | Nullable | Default     | Observações                       |
| ----------------- | -------------------- | -------- | ----------- | --------------------------------- |
| `id`              | `INT AUTO_INCREMENT` | NOT NULL | —           | PK                                |
| `subscription_id` | `INT`                | NOT NULL | —           | FK implícita → `subscriptions.id` |
| `user_id`         | `INT`                | NOT NULL | —           | FK implícita → `users.id`         |
| `status`          | `VARCHAR(20)`        | NOT NULL | `'pending'` | String livre                      |
| `amount`          | `DECIMAL(10,2)`      | NOT NULL | —           |                                   |
| `provider`        | `VARCHAR(50)`        | NULL     | NULL        |                                   |
| `provider_pay_id` | `VARCHAR(100)`       | NULL     | NULL        | ID do pagamento no provedor       |
| `description`     | `TEXT`               | NULL     | NULL        |                                   |
| `paid_at`         | `DATETIME`           | NULL     | NULL        |                                   |
| `due_date`        | `DATETIME`           | NULL     | NULL        |                                   |
| `created_at`      | `DATETIME`           | NOT NULL | `NOW()`     |                                   |
| `updated_at`      | `DATETIME`           | NOT NULL | `NOW()`     |                                   |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** nenhum declarado (❌ `subscription_id` e `user_id` sem índice)  
**Questões de design:**

- `status` string livre — sem restrição de valores
- `amount` sem CHECK `>= 0`
- Sem soft-delete (deleção de assinatura pode orphanar pagamentos)

---

#### Tabela `cupons`

**Nome proposto (Postgres):** `cupons`  
**Finalidade:** Cupons de desconto para planos de assinatura.

| Campo           | Tipo MySQL           | Nullable | Default | Observações                             |
| --------------- | -------------------- | -------- | ------- | --------------------------------------- |
| `id`            | `INT AUTO_INCREMENT` | NOT NULL | —       | PK                                      |
| `code`          | `VARCHAR(50)`        | NOT NULL | —       | Sem UNIQUE explícita (❌)               |
| `discount`      | `DECIMAL(5,2)`       | NOT NULL | —       | Ambíguo: percentual ou fixo?            |
| `discount_type` | `VARCHAR(20)`        | NULL     | NULL    | `'percent'` ou `'fixed'` — string livre |
| `valid_until`   | `DATETIME`           | NULL     | NULL    |                                         |
| `max_uses`      | `INT`                | NULL     | NULL    | NULL = ilimitado                        |
| `current_uses`  | `INT`                | NOT NULL | `0`     | Sem CHECK `>= 0` ou `<= max_uses`       |
| `active`        | `TINYINT(1)`         | NOT NULL | `1`     |                                         |
| `created_at`    | `DATETIME`           | NOT NULL | `NOW()` |                                         |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** nenhum (❌ busca por `code` sem índice)  
**Questões de design:**

- `code` sem UNIQUE — cupons duplicados possíveis
- `discount` + `discount_type` separados mas sem CHECK que garanta exclusividade
- `active` como TINYINT(1) em vez de BOOLEAN

---

### Domínio: Financeiro — Contas & Movimentação

---

#### Tabela `accounts`

**Nome proposto (Postgres):** `contas`  
**Finalidade:** Contas financeiras do usuário (corrente, poupança, cartão, carteira, etc.).

| Campo           | Tipo MySQL           | Nullable | Default | Observações                            |
| --------------- | -------------------- | -------- | ------- | -------------------------------------- |
| `id`            | `INT AUTO_INCREMENT` | NOT NULL | —       | PK                                     |
| `user_id`       | `INT`                | NOT NULL | —       | FK implícita → `users.id`              |
| `name`          | `VARCHAR(255)`       | NOT NULL | —       |                                        |
| `type`          | `VARCHAR(50)`        | NOT NULL | —       | String livre: sem ENUM/CHECK           |
| `bank_id`       | `INT`                | NULL     | NULL    | FK implícita → `banks.id`              |
| `balance`       | `DECIMAL(10,2)`      | NOT NULL | `0.00`  | **Saldo armazenado** — desnormalização |
| `color`         | `VARCHAR(7)`         | NULL     | NULL    | Hex color; sem validação de formato    |
| `icon`          | `VARCHAR(50)`        | NULL     | NULL    |                                        |
| `include_total` | `TINYINT(1)`         | NOT NULL | `1`     |                                        |
| `active`        | `TINYINT(1)`         | NOT NULL | `1`     | Status como boolean simples            |
| `created_at`    | `DATETIME`           | NOT NULL | `NOW()` |                                        |
| `updated_at`    | `DATETIME`           | NOT NULL | `NOW()` |                                        |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** `INDEX (user_id)`  
**Questões de design:**

- `balance` armazenado → pode divergir de `transactions` (inconsistência crítica)
- `type` string livre → valores não padronizados entre registros
- Sem soft-delete

---

#### Tabela `categories`

**Nome proposto (Postgres):** `categorias`  
**Finalidade:** Categorias de receitas e despesas, incluindo categorias padrão do sistema.

| Campo        | Tipo MySQL           | Nullable | Default | Observações                             |
| ------------ | -------------------- | -------- | ------- | --------------------------------------- |
| `id`         | `INT AUTO_INCREMENT` | NOT NULL | —       | PK                                      |
| `user_id`    | `INT`                | NULL     | NULL    | NULL = categoria do sistema             |
| `name`       | `VARCHAR(255)`       | NOT NULL | —       |                                         |
| `type`       | `VARCHAR(20)`        | NOT NULL | —       | `'income'` / `'expense'` — string livre |
| `icon`       | `VARCHAR(50)`        | NULL     | NULL    |                                         |
| `color`      | `VARCHAR(7)`         | NULL     | NULL    | Sem validação de formato hex            |
| `parent_id`  | `INT`                | NULL     | NULL    | FK self-referencial — implícita         |
| `created_at` | `DATETIME`           | NOT NULL | `NOW()` |                                         |
| `updated_at` | `DATETIME`           | NOT NULL | `NOW()` |                                         |

**PK:** `id`  
**FKs Explícitas:** nenhuma (incluindo `parent_id`)  
**Índices:** `INDEX (user_id)`  
**Questões de design:**

- `parent_id` sem FK explícita — hierarquia violável
- `type` sem ENUM — `'other'`, `'misc'` podem aparecer ad hoc no PHP
- Sem campo `is_system` — diferenciação por `user_id IS NULL` apenas (frágil)

---

#### Tabela `bills`

**Nome proposto (Postgres):** `contas_pagar`  
**Finalidade:** Contas a pagar do usuário.

| Campo         | Tipo MySQL           | Nullable | Default     | Observações                    |
| ------------- | -------------------- | -------- | ----------- | ------------------------------ |
| `id`          | `INT AUTO_INCREMENT` | NOT NULL | —           | PK                             |
| `user_id`     | `INT`                | NOT NULL | —           | FK implícita → `users.id`      |
| `description` | `VARCHAR(500)`       | NOT NULL | —           |                                |
| `amount`      | `DECIMAL(10,2)`      | NOT NULL | —           | Sem CHECK `> 0`                |
| `due_date`    | `DATE`               | NOT NULL | —           |                                |
| `paid_date`   | `DATE`               | NULL     | NULL        |                                |
| `status`      | `VARCHAR(20)`        | NOT NULL | `'pending'` | String livre                   |
| `category_id` | `INT`                | NULL     | NULL        | FK implícita → `categories.id` |
| `account_id`  | `INT`                | NULL     | NULL        | FK implícita → `accounts.id`   |
| `recurring`   | `TINYINT(1)`         | NOT NULL | `0`         |                                |
| `recurrence`  | `VARCHAR(20)`        | NULL     | NULL        | String livre: sem ENUM         |
| `notes`       | `TEXT`               | NULL     | NULL        |                                |
| `created_at`  | `DATETIME`           | NOT NULL | `NOW()`     |                                |
| `updated_at`  | `DATETIME`           | NOT NULL | `NOW()`     |                                |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** `INDEX (user_id)`, `INDEX (due_date)`  
**Questões de design:**

- Sem suporte nativo a parcelamento (`installment_number`, `total_installments` ausentes)
- `recurrence` string livre — valores inconsistentes entre registros
- `status` sem constraint — qualquer string é aceita

---

#### Tabela `receivables`

**Nome proposto (Postgres):** `contas_receber`  
**Finalidade:** Contas a receber do usuário. Estrutura espelha `bills`.

| Campo           | Tipo MySQL           | Nullable | Default     | Observações     |
| --------------- | -------------------- | -------- | ----------- | --------------- |
| `id`            | `INT AUTO_INCREMENT` | NOT NULL | —           | PK              |
| `user_id`       | `INT`                | NOT NULL | —           | FK implícita    |
| `description`   | `VARCHAR(500)`       | NOT NULL | —           |                 |
| `amount`        | `DECIMAL(10,2)`      | NOT NULL | —           | Sem CHECK `> 0` |
| `due_date`      | `DATE`               | NOT NULL | —           |                 |
| `received_date` | `DATE`               | NULL     | NULL        |                 |
| `status`        | `VARCHAR(20)`        | NOT NULL | `'pending'` | String livre    |
| `category_id`   | `INT`                | NULL     | NULL        | FK implícita    |
| `account_id`    | `INT`                | NULL     | NULL        | FK implícita    |
| `recurring`     | `TINYINT(1)`         | NOT NULL | `0`         |                 |
| `recurrence`    | `VARCHAR(20)`        | NULL     | NULL        | String livre    |
| `notes`         | `TEXT`               | NULL     | NULL        |                 |
| `created_at`    | `DATETIME`           | NOT NULL | `NOW()`     |                 |
| `updated_at`    | `DATETIME`           | NOT NULL | `NOW()`     |                 |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** `INDEX (user_id)`, `INDEX (due_date)`  
**Questões de design:** mesmos problemas de `bills`

---

#### Tabela `transactions`

**Nome proposto (Postgres):** `movimentacoes_caixa`  
**Finalidade:** Lançamentos financeiros reais. Fonte de verdade para cálculo de saldo.

| Campo           | Tipo MySQL           | Nullable | Default | Observações                            |
| --------------- | -------------------- | -------- | ------- | -------------------------------------- |
| `id`            | `INT AUTO_INCREMENT` | NOT NULL | —       | PK                                     |
| `user_id`       | `INT`                | NOT NULL | —       | FK implícita → `users.id`              |
| `account_id`    | `INT`                | NOT NULL | —       | FK implícita → `accounts.id`           |
| `type`          | `VARCHAR(20)`        | NOT NULL | —       | `'income'`/`'expense'`/`'transfer'`    |
| `amount`        | `DECIMAL(10,2)`      | NOT NULL | —       | Sem CHECK `> 0`                        |
| `description`   | `VARCHAR(500)`       | NOT NULL | —       |                                        |
| `date`          | `DATE`               | NOT NULL | —       |                                        |
| `category_id`   | `INT`                | NULL     | NULL    | FK implícita                           |
| `to_account_id` | `INT`                | NULL     | NULL    | FK implícita → `accounts.id` (destino) |
| `bill_id`       | `INT`                | NULL     | NULL    | FK implícita → `bills.id`              |
| `receivable_id` | `INT`                | NULL     | NULL    | FK implícita → `receivables.id`        |
| `notes`         | `TEXT`               | NULL     | NULL    |                                        |
| `created_at`    | `DATETIME`           | NOT NULL | `NOW()` |                                        |
| `updated_at`    | `DATETIME`           | NOT NULL | `NOW()` |                                        |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** `INDEX (user_id)`, `INDEX (date)`  
**Questões de design:**

- Sem CHECK que exija `to_account_id` quando `type = 'transfer'`
- `type` string livre — sem restrição de valores
- `account.balance` atualizado via trigger/PHP — dessincronização possível

---

### Domínio: Investimentos

---

#### Tabela `investment_types`

**Nome proposto (Postgres):** `tipos_investimento`  
**Finalidade:** Lookup de tipos de investimento (CDB, LCI, Ações, FII, etc.).

| Campo         | Tipo MySQL           | Nullable | Default | Observações |
| ------------- | -------------------- | -------- | ------- | ----------- |
| `id`          | `INT AUTO_INCREMENT` | NOT NULL | —       | PK          |
| `name`        | `VARCHAR(100)`       | NOT NULL | —       | Sem UNIQUE  |
| `description` | `TEXT`               | NULL     | NULL    |             |
| `created_at`  | `DATETIME`           | NOT NULL | `NOW()` |             |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** nenhum  
**Questões de design:**

- `name` sem UNIQUE — tipos duplicados possíveis

---

#### Tabela `banks`

**Nome proposto (Postgres):** `instituicoes_financeiras`  
**Finalidade:** Lookup de instituições financeiras (bancos, corretoras).

| Campo        | Tipo MySQL           | Nullable | Default | Observações                        |
| ------------ | -------------------- | -------- | ------- | ---------------------------------- |
| `id`         | `INT AUTO_INCREMENT` | NOT NULL | —       | PK                                 |
| `name`       | `VARCHAR(255)`       | NOT NULL | —       | Sem UNIQUE                         |
| `ispb`       | `VARCHAR(8)`         | NULL     | NULL    | ISPB separado de COMPE             |
| `compe`      | `VARCHAR(3)`         | NULL     | NULL    | Código de compensação BACEN        |
| `logo`       | `VARCHAR(255)`       | NULL     | NULL    | Path local — não funciona em cloud |
| `created_at` | `DATETIME`           | NOT NULL | `NOW()` |                                    |

**PK:** `id`  
**Questões de design:**

- `ispb` e `compe` separados — unificado em `codigo_compensacao` no Postgres
- `logo` como path — deveria ser URL

---

#### Tabela `investments`

**Nome proposto (Postgres):** `investimentos`  
**Finalidade:** Posições de investimento do usuário.

| Campo           | Tipo MySQL           | Nullable | Default | Observações                            |
| --------------- | -------------------- | -------- | ------- | -------------------------------------- |
| `id`            | `INT AUTO_INCREMENT` | NOT NULL | —       | PK                                     |
| `user_id`       | `INT`                | NOT NULL | —       | FK implícita → `users.id`              |
| `name`          | `VARCHAR(255)`       | NOT NULL | —       |                                        |
| `type_id`       | `INT`                | NOT NULL | —       | FK implícita → `investment_types.id`   |
| `bank_id`       | `INT`                | NULL     | NULL    | FK implícita → `banks.id`              |
| `initial_value` | `DECIMAL(10,2)`      | NOT NULL | `0.00`  |                                        |
| `current_value` | `DECIMAL(10,2)`      | NOT NULL | `0.00`  | **Desnormalização** — valor calculável |
| `start_date`    | `DATE`               | NOT NULL | —       |                                        |
| `end_date`      | `DATE`               | NULL     | NULL    |                                        |
| `active`        | `TINYINT(1)`         | NOT NULL | `1`     |                                        |
| `notes`         | `TEXT`               | NULL     | NULL    |                                        |
| `created_at`    | `DATETIME`           | NOT NULL | `NOW()` |                                        |
| `updated_at`    | `DATETIME`           | NOT NULL | `NOW()` |                                        |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** `INDEX (user_id)`  
**Questões de design:**

- `current_value` armazenado → pode divergir de `investment_events`

---

#### Tabela `investment_events`

**Nome proposto (Postgres):** `investimentos_eventos`  
**Finalidade:** Histórico de aportes, resgates, rendimentos e dividendos.

| Campo           | Tipo MySQL           | Nullable | Default | Observações                     |
| --------------- | -------------------- | -------- | ------- | ------------------------------- |
| `id`            | `INT AUTO_INCREMENT` | NOT NULL | —       | PK                              |
| `investment_id` | `INT`                | NOT NULL | —       | FK implícita → `investments.id` |
| `user_id`       | `INT`                | NOT NULL | —       | FK implícita → `users.id`       |
| `type`          | `VARCHAR(50)`        | NOT NULL | —       | String livre: sem ENUM          |
| `amount`        | `DECIMAL(10,2)`      | NOT NULL | —       | Sem CHECK `> 0`                 |
| `date`          | `DATE`               | NOT NULL | —       |                                 |
| `description`   | `TEXT`               | NULL     | NULL    |                                 |
| `created_at`    | `DATETIME`           | NOT NULL | `NOW()` |                                 |
| `updated_at`    | `DATETIME`           | NOT NULL | `NOW()` |                                 |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** `INDEX (investment_id)`  
**Questões de design:**

- `type` string livre — valores `'deposit'`, `'withdrawal'`, `'yield'` não padronizados

---

### Domínio: Metas & Objetivos

---

#### Tabela `goals`

**Nome proposto (Postgres):** `metas`  
**Finalidade:** Metas financeiras do usuário (economia, investimento, despesa planejada).

| Campo            | Tipo MySQL           | Nullable | Default    | Observações                      |
| ---------------- | -------------------- | -------- | ---------- | -------------------------------- |
| `id`             | `INT AUTO_INCREMENT` | NOT NULL | —          | PK                               |
| `user_id`        | `INT`                | NOT NULL | —          | FK implícita → `users.id`        |
| `name`           | `VARCHAR(255)`       | NOT NULL | —          |                                  |
| `type`           | `VARCHAR(50)`        | NOT NULL | —          | String livre                     |
| `target_amount`  | `DECIMAL(10,2)`      | NOT NULL | —          | Sem CHECK `> 0`                  |
| `current_amount` | `DECIMAL(10,2)`      | NOT NULL | `0.00`     | **Desnormalização** — calculável |
| `start_date`     | `DATE`               | NOT NULL | —          |                                  |
| `end_date`       | `DATE`               | NULL     | NULL       |                                  |
| `status`         | `VARCHAR(20)`        | NOT NULL | `'active'` | String livre                     |
| `icon`           | `VARCHAR(50)`        | NULL     | NULL       |                                  |
| `color`          | `VARCHAR(7)`         | NULL     | NULL       | Sem validação de formato hex     |
| `notes`          | `TEXT`               | NULL     | NULL       |                                  |
| `created_at`     | `DATETIME`           | NOT NULL | `NOW()`    |                                  |
| `updated_at`     | `DATETIME`           | NOT NULL | `NOW()`    |                                  |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** `INDEX (user_id)`  
**Questões de design:**

- `current_amount` desnormalizado — pode divergir de `goal_movements`

---

#### Tabela `goal_movements`

**Nome proposto (Postgres):** `metas_movimentos`  
**Finalidade:** Registro de aportes e resgates em metas financeiras.

| Campo         | Tipo MySQL           | Nullable | Default | Observações                             |
| ------------- | -------------------- | -------- | ------- | --------------------------------------- |
| `id`          | `INT AUTO_INCREMENT` | NOT NULL | —       | PK                                      |
| `goal_id`     | `INT`                | NOT NULL | —       | FK implícita → `goals.id`               |
| `user_id`     | `INT`                | NOT NULL | —       | FK implícita → `users.id`               |
| `amount`      | `DECIMAL(10,2)`      | NOT NULL | —       | Positivo (aporte) ou negativo (resgate) |
| `date`        | `DATE`               | NOT NULL | —       |                                         |
| `description` | `TEXT`               | NULL     | NULL    |                                         |
| `created_at`  | `DATETIME`           | NOT NULL | `NOW()` |                                         |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** `INDEX (goal_id)`  
**Questões de design:**

- Sem link para `transactions` — não é possível saber se aporte veio de um lançamento real

---

### Domínio: Anexos & Documentos

---

#### Tabela `attachments`

**Nome proposto (Postgres):** `anexos`  
**Finalidade:** Arquivos anexados a registros financeiros (comprovantes, extratos, documentos).

| Campo           | Tipo MySQL           | Nullable | Default | Observações                        |
| --------------- | -------------------- | -------- | ------- | ---------------------------------- |
| `id`            | `INT AUTO_INCREMENT` | NOT NULL | —       | PK                                 |
| `user_id`       | `INT`                | NOT NULL | —       | FK implícita → `users.id`          |
| `original_name` | `VARCHAR(255)`       | NOT NULL | —       |                                    |
| `filename`      | `VARCHAR(255)`       | NOT NULL | —       | Nome gerado internamente           |
| `mime_type`     | `VARCHAR(100)`       | NOT NULL | —       |                                    |
| `size`          | `INT`                | NOT NULL | —       | Bytes; INT pode estourar para >2GB |
| `url`           | `TEXT`               | NOT NULL | —       |                                    |
| `created_at`    | `DATETIME`           | NOT NULL | `NOW()` |                                    |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** `INDEX (user_id)`  
**Questões de design:**

- `size` como `INT` — limite de ~2.1 GB (deveria ser BIGINT)
- Sem hash para deduplicação — uploads duplicados possíveis

---

#### Tabela `attachment_relations`

**Nome proposto (Postgres):** `anexos_vinculos`  
**Finalidade:** Vínculo polimórfico entre anexos e entidades (contas a pagar, investimentos, etc.).

| Campo           | Tipo MySQL           | Nullable | Default | Observações                        |
| --------------- | -------------------- | -------- | ------- | ---------------------------------- |
| `id`            | `INT AUTO_INCREMENT` | NOT NULL | —       | PK                                 |
| `attachment_id` | `INT`                | NOT NULL | —       | FK implícita → `attachments.id`    |
| `entity_type`   | `VARCHAR(50)`        | NOT NULL | —       | String livre: sem CHECK de valores |
| `entity_id`     | `INT`                | NOT NULL | —       | FK polimórfica — sem FK real       |
| `created_at`    | `DATETIME`           | NOT NULL | `NOW()` |                                    |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** `INDEX (entity_type, entity_id)`  
**Questões de design:**

- `entity_type` sem CHECK — qualquer string é aceita; valores inválidos passam silenciosamente
- Vínculo polimórfico sem FK real impossibilita integridade referencial

---

### Domínio: Comunicação & Logs

---

#### Tabela `whatsapp_messages`

**Nome proposto (Postgres):** `whatsapp_logs`  
**Finalidade:** Log de mensagens WhatsApp enviadas e recebidas pelo sistema.

| Campo             | Tipo MySQL           | Nullable | Default | Observações                                      |
| ----------------- | -------------------- | -------- | ------- | ------------------------------------------------ |
| `id`              | `INT AUTO_INCREMENT` | NOT NULL | —       | PK; volume alto — deveria ser BIGINT             |
| `user_id`         | `INT`                | NULL     | NULL    | FK implícita; NULL para mensagens não vinculadas |
| `provider`        | `VARCHAR(50)`        | NOT NULL | —       |                                                  |
| `phone`           | `VARCHAR(20)`        | NOT NULL | —       |                                                  |
| `direction`       | `VARCHAR(10)`        | NOT NULL | —       | `'in'`/`'out'` — string livre                    |
| `message_type`    | `VARCHAR(50)`        | NOT NULL | —       |                                                  |
| `content`         | `TEXT`               | NULL     | NULL    |                                                  |
| `status`          | `VARCHAR(50)`        | NULL     | NULL    | String livre                                     |
| `provider_msg_id` | `VARCHAR(255)`       | NULL     | NULL    |                                                  |
| `created_at`      | `DATETIME`           | NOT NULL | `NOW()` |                                                  |
| `updated_at`      | `DATETIME`           | NOT NULL | `NOW()` |                                                  |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** `INDEX (user_id)`  
**Questões de design:**

- `INT` PK pode estourar com volume alto de mensagens
- `direction` string livre — sem CHECK

---

#### Tabela `background_jobs`

**Nome proposto (Postgres):** `jobs`  
**Finalidade:** Fila de tarefas assíncronas (envio de e-mail, renovação de assinatura, etc.).

| Campo          | Tipo MySQL           | Nullable | Default     | Observações                 |
| -------------- | -------------------- | -------- | ----------- | --------------------------- |
| `id`           | `INT AUTO_INCREMENT` | NOT NULL | —           | PK; volume alto             |
| `type`         | `VARCHAR(100)`       | NOT NULL | —           |                             |
| `payload`      | `LONGTEXT`           | NULL     | NULL        | JSON serializado como texto |
| `status`       | `VARCHAR(50)`        | NOT NULL | `'pending'` | String livre                |
| `attempts`     | `INT`                | NOT NULL | `0`         | Sem CHECK `>= 0`            |
| `max_attempts` | `INT`                | NOT NULL | `3`         | Sem CHECK `> 0`             |
| `error`        | `TEXT`               | NULL     | NULL        |                             |
| `scheduled_at` | `DATETIME`           | NULL     | NULL        |                             |
| `started_at`   | `DATETIME`           | NULL     | NULL        |                             |
| `completed_at` | `DATETIME`           | NULL     | NULL        |                             |
| `created_at`   | `DATETIME`           | NOT NULL | `NOW()`     |                             |
| `updated_at`   | `DATETIME`           | NOT NULL | `NOW()`     |                             |

**PK:** `id`  
**FKs Explícitas:** nenhuma  
**Índices:** `INDEX (status)`  
**Questões de design:**

- `payload` como LONGTEXT — sem indexação nem validação de estrutura JSON
- `status` sem CHECK — qualquer valor aceito

---

## Seção 2 — Mapa de Relacionamentos

> **Legenda:**
>
> - **Explícita:** FK declarada no DDL do MySQL
> - **Implícita:** Relação inferida do código PHP (sem FK no banco)
> - **1:1**, **1:N**, **N:M** — cardinalidade

| Tabela Origem          | Campo FK          | Tabela Destino     | Tipo Relação | Tipo de FK | Cascade Atual |
| ---------------------- | ----------------- | ------------------ | ------------ | ---------- | ------------- |
| `subscriptions`        | `user_id`         | `users`            | 1:1          | Implícita  | Nenhum        |
| `subscriptions`        | `plan_id`         | `plans`            | N:1          | Implícita  | Nenhum        |
| `subscriptions`        | `coupon_id`       | `cupons`           | N:1          | Implícita  | Nenhum        |
| `payments`             | `subscription_id` | `subscriptions`    | N:1          | Implícita  | Nenhum        |
| `payments`             | `user_id`         | `users`            | N:1          | Implícita  | Nenhum        |
| `webhook_logs`         | —                 | —                  | —            | —          | —             |
| `accounts`             | `user_id`         | `users`            | N:1          | Implícita  | Nenhum        |
| `accounts`             | `bank_id`         | `banks`            | N:1          | Implícita  | Nenhum        |
| `categories`           | `user_id`         | `users`            | N:1          | Implícita  | Nenhum        |
| `categories`           | `parent_id`       | `categories`       | N:1 (self)   | Implícita  | Nenhum        |
| `bills`                | `user_id`         | `users`            | N:1          | Implícita  | Nenhum        |
| `bills`                | `category_id`     | `categories`       | N:1          | Implícita  | Nenhum        |
| `bills`                | `account_id`      | `accounts`         | N:1          | Implícita  | Nenhum        |
| `receivables`          | `user_id`         | `users`            | N:1          | Implícita  | Nenhum        |
| `receivables`          | `category_id`     | `categories`       | N:1          | Implícita  | Nenhum        |
| `receivables`          | `account_id`      | `accounts`         | N:1          | Implícita  | Nenhum        |
| `transactions`         | `user_id`         | `users`            | N:1          | Implícita  | Nenhum        |
| `transactions`         | `account_id`      | `accounts`         | N:1          | Implícita  | Nenhum        |
| `transactions`         | `category_id`     | `categories`       | N:1          | Implícita  | Nenhum        |
| `transactions`         | `to_account_id`   | `accounts`         | N:1          | Implícita  | Nenhum        |
| `transactions`         | `bill_id`         | `bills`            | N:1          | Implícita  | Nenhum        |
| `transactions`         | `receivable_id`   | `receivables`      | N:1          | Implícita  | Nenhum        |
| `investments`          | `user_id`         | `users`            | N:1          | Implícita  | Nenhum        |
| `investments`          | `type_id`         | `investment_types` | N:1          | Implícita  | Nenhum        |
| `investments`          | `bank_id`         | `banks`            | N:1          | Implícita  | Nenhum        |
| `investment_events`    | `investment_id`   | `investments`      | N:1          | Implícita  | Nenhum        |
| `investment_events`    | `user_id`         | `users`            | N:1          | Implícita  | Nenhum        |
| `goals`                | `user_id`         | `users`            | N:1          | Implícita  | Nenhum        |
| `goal_movements`       | `goal_id`         | `goals`            | N:1          | Implícita  | Nenhum        |
| `goal_movements`       | `user_id`         | `users`            | N:1          | Implícita  | Nenhum        |
| `attachments`          | `user_id`         | `users`            | N:1          | Implícita  | Nenhum        |
| `attachment_relations` | `attachment_id`   | `attachments`      | N:1          | Implícita  | Nenhum        |
| `attachment_relations` | `entity_id`       | _(polimórfico)_    | N:1          | Nenhuma    | Nenhum        |
| `whatsapp_messages`    | `user_id`         | `users`            | N:1          | Implícita  | Nenhum        |

> ⚠️ **Nenhuma FK é explícita no DDL MySQL legado.** Todas as relações são mantidas exclusivamente via lógica de aplicação PHP.

---

## Seção 3 — Explosão em Cascade ao Deletar Usuário

Ao executar `DELETE FROM users WHERE id = ?` no legado **não há cascade** — registros órfãos são criados silenciosamente:

```
users
├── subscriptions          (user_id — sem cascade → registro órfão)
│   └── payments           (subscription_id — sem cascade → registro órfão)
├── accounts               (user_id — sem cascade → registro órfão)
│   └── transactions       (account_id — sem cascade → registro órfão)
├── categories             (user_id — sem cascade → registro órfão)
├── bills                  (user_id — sem cascade → registro órfão)
├── receivables            (user_id — sem cascade → registro órfão)
├── investments            (user_id — sem cascade → registro órfão)
│   └── investment_events  (user_id — sem cascade → registro órfão)
├── goals                  (user_id — sem cascade → registro órfão)
│   └── goal_movements     (user_id — sem cascade → registro órfão)
├── attachments            (user_id — sem cascade → registro órfão)
│   └── attachment_relations (attachment_id — sem cascade → registro órfão)
└── whatsapp_messages      (user_id — sem cascade → registro órfão)
```

No Postgres v2 cada relação tem comportamento explícito (`CASCADE`, `SET NULL`, `RESTRICT`) — ver `02-relationships-matrix.md`.

---

## Seção 4 — Padrões a NÃO Repetir no Postgres

| #   | Anti-pattern                               | Impacto                                                                              |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1   | FKs puramente implícitas (sem DDL)         | Integridade depende exclusivamente do PHP; queries diretas podem quebrar referências |
| 2   | `status` / `type` como VARCHAR livre       | Dados inconsistentes entre registros; impossível criar índice eficiente por tipo     |
| 3   | Saldo (`balance`) armazenado em `accounts` | Divergência entre saldo e movimentações após falha de atualização                    |
| 4   | `current_value` em `investments`           | Idem — calculável via `investment_events`                                            |
| 5   | `current_amount` em `goals`                | Idem — calculável via `goal_movements`                                               |
| 6   | `DATETIME` sem timezone                    | Horário ambíguo em ambiente multi-timezone / mudança de horário de verão             |
| 7   | `INT AUTO_INCREMENT` exposto na API        | Enumeração de recursos; sequência predizível                                         |
| 8   | `INT` para colunas de alto volume          | Overflow em `webhook_logs`, `whatsapp_messages`, `background_jobs`                   |
| 9   | `LONGTEXT` para JSON                       | Sem validação, sem indexação; consultas por campo interno impossíveis                |
| 10  | Sem soft-delete em entidades financeiras   | Violação LGPD; histórico irrecuperável após exclusão                                 |
| 11  | Ausência de UNIQUE em `email` (`users`)    | Usuários duplicados com mesmo e-mail                                                 |
| 12  | Ausência de UNIQUE em `code` (`cupons`)    | Cupons duplicados aceitos silenciosamente                                            |
| 13  | `avatar`/`logo` como path local            | Inutilizável em containers ou ambientes distribuídos                                 |
| 14  | Sem `event_id` em `webhook_logs`           | Sem idempotência — evento duplicado reprocessado                                     |
| 15  | Sem parcelamento em `bills`/`receivables`  | Parcelamento implementado fora do banco (lógica PHP frágil)                          |

---

_Documento gerado em: 2026-03-02_  
_Próximos documentos: `02-relationships-matrix.md`, `03-legacy-issues.md`_
