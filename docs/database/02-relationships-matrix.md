# 02 — Matriz de Relacionamentos

> **Fonte:** `finlly_go.sql` (DDL MySQL) + código PHP (`auth.php`, `assinatura.php`,
> `checkout_assinatura.php`, `contas_pagar.php`, `contas_receber.php`,
> `configuracoes_financeiras.php`, `asaas_client.php`)  
> **Data:** 2026-03-02  
> **Propósito:** Documentar todas as relações entre tabelas — explícitas (FK no DDL) e implícitas (inferidas
> do código PHP) — e mapear o comportamento de cascade esperado no redesenho Postgres v2.

---

## Convenções

| Símbolo | Significado                                           |
|---------|-------------------------------------------------------|
| ✅ Explícita | FK declarada no DDL do MySQL                     |
| ⚠️ Implícita | Relação mantida somente via código PHP           |
| ❌ Polimórfica | Sem FK real — vínculo por `entity_type`+`entity_id` |
| `CASCADE` | Deleção do pai propaga deleção ao filho            |
| `SET NULL` | Deleção do pai anula a FK no filho               |
| `RESTRICT` | Impede deleção do pai enquanto filho existir     |
| `—` | Nenhum comportamento declarado (legado)                |

---

## Matriz Completa de Relacionamentos

### Domínio: Billing & Assinaturas

| Tabela Origem      | Campo FK         | Tabela Destino | Tipo Relação | Cardinalidade | FK Legado | Cascade Legado | Cascade v2 (Postgres) |
|--------------------|------------------|----------------|--------------|---------------|-----------|----------------|-----------------------|
| `subscriptions`    | `user_id`        | `users`        | N:1          | Muitos→Um     | ⚠️ Implícita | —             | `CASCADE`             |
| `subscriptions`    | `plan_id`        | `plans`        | N:1          | Muitos→Um     | ⚠️ Implícita | —             | *(unificado — N/A)*   |
| `subscriptions`    | `coupon_id`      | `coupons`      | N:1          | Muitos→Um     | ⚠️ Implícita | —             | `SET NULL`            |
| `payments`         | `subscription_id`| `subscriptions`| N:1          | Muitos→Um     | ⚠️ Implícita | —             | `CASCADE`             |
| `payments`         | `user_id`        | `users`        | N:1          | Muitos→Um     | ⚠️ Implícita | —             | `RESTRICT`            |

> **Nota de unificação:** `plans` e `subscriptions` são unificados em `assinantes` no Postgres v2.
> O campo `plan_id` é substituído pela coluna `plano VARCHAR(50)` diretamente em `assinantes`.

---

### Domínio: Usuários & Webhooks

| Tabela Origem   | Campo FK | Tabela Destino | Tipo Relação | Cardinalidade | FK Legado | Cascade Legado | Cascade v2 (Postgres) |
|-----------------|----------|----------------|--------------|---------------|-----------|----------------|-----------------------|
| `webhook_logs`  | —        | —              | —            | —             | —         | —              | —                     |

> `webhook_logs` não possui relacionamento com outras tabelas no legado nem no v2.
> BIGSERIAL com hard-delete; auditoria autossuficiente.

---

### Domínio: Financeiro — Contas & Movimentação

| Tabela Origem  | Campo FK       | Tabela Destino | Tipo Relação | Cardinalidade | FK Legado    | Cascade Legado | Cascade v2 (Postgres) |
|----------------|----------------|----------------|--------------|---------------|--------------|----------------|-----------------------|
| `accounts`     | `user_id`      | `users`        | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`             |
| `accounts`     | `bank_id`      | `banks`        | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `SET NULL`            |
| `categories`   | `user_id`      | `users`        | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`             |
| `categories`   | `parent_id`    | `categories`   | N:1 (self)   | Muitos→Um     | ⚠️ Implícita | —              | `SET NULL`            |
| `bills`        | `user_id`      | `users`        | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`             |
| `bills`        | `category_id`  | `categories`   | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `SET NULL`            |
| `bills`        | `account_id`   | `accounts`     | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `SET NULL`            |
| `receivables`  | `user_id`      | `users`        | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`             |
| `receivables`  | `category_id`  | `categories`   | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `SET NULL`            |
| `receivables`  | `account_id`   | `accounts`     | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `SET NULL`            |
| `transactions` | `user_id`      | `users`        | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`             |
| `transactions` | `account_id`   | `accounts`     | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `RESTRICT`            |
| `transactions` | `category_id`  | `categories`   | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `SET NULL`            |
| `transactions` | `to_account_id`| `accounts`     | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `SET NULL`            |
| `transactions` | `bill_id`      | `bills`        | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `SET NULL`            |
| `transactions` | `receivable_id`| `receivables`  | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `SET NULL`            |

> **Nota sobre `transactions.account_id`:** No Postgres v2 (`movimentacoes_caixa.conta_id`) usa `RESTRICT`
> para evitar exclusão de contas com lançamentos — garantia de auditoria financeira.

---

### Domínio: Investimentos

| Tabela Origem      | Campo FK        | Tabela Destino     | Tipo Relação | Cardinalidade | FK Legado    | Cascade Legado | Cascade v2 (Postgres) |
|--------------------|-----------------|--------------------|--------------|---------------|--------------|----------------|-----------------------|
| `investments`      | `user_id`       | `users`            | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`             |
| `investments`      | `type_id`       | `investment_types` | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `RESTRICT`            |
| `investments`      | `bank_id`       | `banks`            | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `SET NULL`            |
| `investment_events`| `investment_id` | `investments`      | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`             |
| `investment_events`| `user_id`       | `users`            | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`             |

> **Nota sobre `investments.type_id`:** `RESTRICT` no Postgres v2 garante que tipos de investimento não
> sejam removidos enquanto houver posições vinculadas.

---

### Domínio: Metas & Objetivos

| Tabela Origem   | Campo FK         | Tabela Destino       | Tipo Relação | Cardinalidade | FK Legado    | Cascade Legado | Cascade v2 (Postgres) |
|-----------------|------------------|----------------------|--------------|---------------|--------------|----------------|-----------------------|
| `goals`         | `user_id`        | `users`              | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`             |
| `goal_movements`| `goal_id`        | `goals`              | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`             |
| `goal_movements`| `user_id`        | `users`              | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`             |
| `goal_movements`| `transaction_id` | `transactions`       | N:1          | Muitos→Um     | ❌ Ausente   | —              | `SET NULL`            |

> **Nota:** `goal_movements.transaction_id` **não existe no legado**. Inferido do código PHP que vincula
> aportes de metas a lançamentos de caixa. Adicionado no Postgres v2 como `movimentacao_id SET NULL`.

---

### Domínio: Anexos & Documentos

| Tabela Origem         | Campo FK        | Tabela Destino  | Tipo Relação | Cardinalidade | FK Legado    | Cascade Legado | Cascade v2 (Postgres)            |
|-----------------------|-----------------|-----------------|--------------|---------------|--------------|----------------|----------------------------------|
| `attachments`         | `user_id`       | `users`         | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`                        |
| `attachment_relations`| `attachment_id` | `attachments`   | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `CASCADE`                        |
| `attachment_relations`| `entity_id`     | *(polimórfico)* | N:1          | Muitos→Um     | ❌ Polimórfica| —              | CHECK constraint em `entity_type` |

> **Nota:** A relação polimórfica via `entity_type` + `entity_id` não pode ser representada como FK real.
> No Postgres v2 (`anexos_vinculos`) o campo `entidade_tipo` possui CHECK constraint restringindo os
> valores aceitos: `contas_pagar`, `contas_receber`, `investimentos`, `metas`, `movimentacoes_caixa`.

---

### Domínio: Comunicação & Logs

| Tabela Origem      | Campo FK  | Tabela Destino | Tipo Relação | Cardinalidade | FK Legado    | Cascade Legado | Cascade v2 (Postgres) |
|--------------------|-----------|----------------|--------------|---------------|--------------|----------------|-----------------------|
| `whatsapp_messages`| `user_id` | `users`        | N:1          | Muitos→Um     | ⚠️ Implícita | —              | `SET NULL`            |

> **Nota:** `SET NULL` ao deletar usuário — preserva histórico de mensagens para auditoria,
> mas desvincula do usuário deletado (conformidade LGPD).

---

## Relações Implícitas Confirmadas via PHP

As seguintes relações foram confirmadas pela análise do código PHP fornecido:

| Relação                                            | Arquivo PHP                     | Evidência                                                     |
|----------------------------------------------------|---------------------------------|---------------------------------------------------------------|
| `subscriptions.user_id → users.id`                | `auth.php`, `assinatura.php`    | `WHERE user_id = $_SESSION['user_id']` em queries de assinatura |
| `subscriptions.coupon_id → coupons.id`            | `checkout_assinatura.php`       | Busca de cupom por ID antes de aplicar desconto               |
| `payments.subscription_id → subscriptions.id`     | `asaas_client.php`              | Criação de pagamento vinculando `subscription_id`             |
| `bills.category_id → categories.id`               | `contas_pagar.php`              | JOIN explícito `categories ON bills.category_id`              |
| `bills.account_id → accounts.id`                  | `contas_pagar.php`              | JOIN para obter nome da conta no lançamento                   |
| `receivables.category_id → categories.id`         | `contas_receber.php`            | JOIN idêntico ao de `bills`                                   |
| `transactions.bill_id → bills.id`                 | `contas_pagar.php`              | UPDATE `bills.status = 'paid'` ao lançar transação            |
| `transactions.receivable_id → receivables.id`     | `contas_receber.php`            | UPDATE `receivables.status = 'received'` ao lançar transação  |
| `categories.parent_id → categories.id`            | `configuracoes_financeiras.php` | SELECT filhos de categoria via `WHERE parent_id = ?`          |
| `investments.bank_id → banks.id`                  | *(schema inference)*            | JOIN em listagem de investimentos                             |
| `goal_movements.goal_id → goals.id`               | *(schema inference)*            | SUM por `goal_id` para calcular progresso                     |

---

## Diagrama de Dependências (Texto)

```
users (central)
├── subscriptions ──── plans (unificado)
│   ├── payments
│   └── coupon ──── coupons
├── accounts ──── banks
│   └── transactions
│       ├── → categories
│       ├── → accounts (to_account)
│       ├── → bills
│       └── → receivables
├── categories (self-join via parent_id)
├── bills ──── categories, accounts
├── receivables ──── categories, accounts
├── investments ──── investment_types, banks
│   └── investment_events
├── goals
│   └── goal_movements ──── transactions (implícito)
├── attachments
│   └── attachment_relations ──► bills | receivables | investments | goals | transactions
└── whatsapp_messages
```

---

## Resumo: Contagem de Relacionamentos por Tabela

| Tabela              | Relações como Origem | Relações como Destino | Total |
|---------------------|---------------------:|-----------------------:|------:|
| `users`             | 0                    | 13                     | 13    |
| `subscriptions`     | 3                    | 1                      | 4     |
| `payments`          | 2                    | 0                      | 2     |
| `coupons`           | 0                    | 1                      | 1     |
| `accounts`          | 2                    | 3                      | 5     |
| `categories`        | 2                    | 3                      | 5     |
| `bills`             | 3                    | 2                      | 5     |
| `receivables`       | 3                    | 2                      | 5     |
| `transactions`      | 6                    | 3                      | 9     |
| `investment_types`  | 0                    | 1                      | 1     |
| `banks`             | 0                    | 2                      | 2     |
| `investments`       | 3                    | 1                      | 4     |
| `investment_events` | 2                    | 0                      | 2     |
| `goals`             | 1                    | 1                      | 2     |
| `goal_movements`    | 3                    | 0                      | 3     |
| `attachments`       | 1                    | 1                      | 2     |
| `attachment_relations`| 2 (+ 1 polimórfica)| 0                      | 3     |
| `whatsapp_messages` | 1                    | 0                      | 1     |
| `webhook_logs`      | 0                    | 0                      | 0     |
| `background_jobs`   | 0                    | 0                      | 0     |
| `plans`             | 0                    | 1                      | 1     |

---

*Documento gerado em: 2026-03-02*  
*Documentos relacionados: `01-legacy-schema-mapping.md`, `03-legacy-issues.md`*
