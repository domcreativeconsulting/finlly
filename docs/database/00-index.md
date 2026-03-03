# Levantamento do Esquema Legado MySQL — Índice

> **Projeto:** Finlly  
> **Sprint:** 01 — Levantamento Legado  
> **Data:** 2026-03-03  
> **Propósito:** Documento-índice que consolida o levantamento completo do esquema MySQL legado e serve de
> ponto de entrada para o redesenho em Postgres (sprint 02).

---

## Estrutura de Documentos

```
docs/database/
├── 00-index.md                  ← Este documento
├── 01-legacy-schema-mapping.md  ← Inventário técnico das 21 tabelas
├── 02-relationships-matrix.md   ← Matriz de relacionamentos (legado → Postgres v2)
├── 03-legacy-issues.md          ← 25 problemas do legado com severidade e recomendações
├── 04-indexing-strategy.md      ← Estratégia de indexação para Postgres v2
└── 05-validation-checklist.md   ← Checklist de validação dos critérios de aceite
```

---

## Sumário Executivo

O sistema **Finlly** possui um banco de dados MySQL legado com **21 tabelas** organizadas em **7 domínios**
funcionais. O esquema foi mapeado a partir de:

- `finlly_go.sql` — dump DDL completo do banco MySQL
- `auth.php`, `assinatura.php`, `checkout_assinatura.php`, `contas_pagar.php`, `contas_receber.php`,
  `configuracoes_financeiras.php`, `asaas_client.php` — código PHP de negócio

### Domínios Identificados

| #  | Domínio                   | Tabelas MySQL (legado)                                                  | Qtd |
|----|---------------------------|-------------------------------------------------------------------------|-----|
| 1  | Usuários & Autenticação   | `users`, `webhook_logs`                                                 | 2   |
| 2  | Billing & Assinaturas     | `plans`, `subscriptions`, `payments`, `coupons`                         | 4   |
| 3  | Financeiro — Contas       | `accounts`, `categories`, `bills`, `receivables`, `transactions`        | 5   |
| 4  | Investimentos             | `investment_types`, `banks`, `investments`, `investment_events`          | 4   |
| 5  | Metas & Objetivos         | `goals`, `goal_movements`                                               | 2   |
| 6  | Anexos & Documentos       | `attachments`, `attachment_relations`                                   | 2   |
| 7  | Comunicação & Logs        | `whatsapp_messages`, `background_jobs`                                  | 2   |
|    | **Total**                 |                                                                         | **21** |

### Principais Achados

| Categoria             | Quantidade | Detalhe                                                                     |
|-----------------------|:----------:|-----------------------------------------------------------------------------|
| Tabelas mapeadas      | 21         | 100% cobertura, agrupadas nos 7 domínios acima                              |
| Relacionamentos       | 34+        | 0 FKs explícitas no DDL; todas as relações mantidas via PHP                 |
| Problemas identificados | 25       | 6 críticos · 7 altos · 8 médios · 4 baixos (ver `03-legacy-issues.md`)     |
| Índices ausentes      | 7+         | Campos de filtro críticos sem índice (email, subscription_id, coupon code…) |
| Anti-patterns críticos | 6         | Sem FKs, saldo desnormalizado, sem soft-delete, overflow INT, sem idempotência webhook, cupons duplicados |

---

## Guia de Navegação

### 01 — Inventário Técnico (`01-legacy-schema-mapping.md`)

Descreve **cada uma das 21 tabelas** com:

- Finalidade da tabela
- Colunas: nome, tipo MySQL, nullable, default e observações
- PK, FKs (explícitas ou implícitas), índices declarados
- Questões de design identificadas
- Mapeamento para o nome proposto no Postgres v2

**Use este documento quando precisar de:** detalhes de uma coluna específica, entender o tipo de dado
legado, ou confirmar o mapeamento legado → Postgres.

---

### 02 — Matriz de Relacionamentos (`02-relationships-matrix.md`)

Documenta **todas as relações entre tabelas** — explícitas (FK no DDL) e implícitas (inferidas do PHP) —
e especifica o comportamento de **cascade esperado no Postgres v2**.

**Convenções:**

| Símbolo     | Significado                                           |
|-------------|-------------------------------------------------------|
| ✅ Explícita | FK declarada no DDL do MySQL                         |
| ⚠️ Implícita | Relação mantida somente via código PHP               |
| ❌ Polimórfica | Sem FK real — vínculo por `entity_type`+`entity_id` |

Relacionamentos críticos documentados:

- `usuario_id → usuarios` (presente em 13 tabelas)
- `assinantes → pagamentos / webhook`
- `contas_pagar` / `contas_receber` → `categorias` / `contas` / `usuarios`
- `movimentacoes_caixa → origem` (pagar / receber / manual)
- `anexos_vinculos → entidade` (polimórfica com CHECK)

**Use este documento quando precisar de:** definir o `ON DELETE` de uma FK no Postgres v2, entender
impacto de uma deleção em cascade, ou validar cardinalidades.

---

### 03 — Problemas do Legado (`03-legacy-issues.md`)

Lista estruturada de **25 problemas** com:

- Código único (CR-01, AL-01, ME-01, BA-01…)
- Tabelas afetadas
- Impacto técnico / de negócio
- Exemplo de código ou SQL que demonstra o problema
- Correção recomendada para o Postgres v2

**Distribuição de severidade:**

| Severidade | Código | Qtd | Exemplos                                             |
|------------|--------|-----|------------------------------------------------------|
| 🔴 Crítico  | CR     | 6   | Sem FKs, saldo desnormalizado, sem soft-delete        |
| 🟠 Alto     | AL     | 7   | Status VARCHAR livre, sem UNIQUE em email/user_id     |
| 🟡 Médio    | ME     | 8   | DATETIME sem TZ, INT exposto em API, sem CHECK        |
| 🟢 Baixo    | BA     | 4   | TINYINT como bool, username redundante                |

**Use este documento quando precisar de:** justificar uma decisão de design no ERD v2, preparar um
script de sanitização pré-migração, ou priorizar riscos para o sprint de migração (02.2).

---

### 04 — Estratégia de Indexação (`04-indexing-strategy.md`)

Define a **estratégia de indexação** para o Postgres v2:

- Índices obrigatórios por tabela (B-tree, UNIQUE, parcial, composto)
- Índices especiais (GIN para JSONB, parcial para soft-delete)
- Estratégia de manutenção (VACUUM, ANALYZE, monitoramento)

**Use este documento quando precisar de:** criar o `db/schema.sql`, revisar EXPLAIN ANALYZE de uma
query lenta, ou definir o plano de manutenção de índices em produção.

---

### 05 — Checklist de Validação (`05-validation-checklist.md`)

Valida que **todos os critérios de aceite** do levantamento foram atendidos antes de avançar para
o redesenho ERD (02.1).

**Use este documento quando precisar de:** confirmar que o sprint 01 está concluído e o sprint 02
pode iniciar com premissas corretas.

---

## Decisões de Nomenclatura (MySQL → Postgres)

| Tabela MySQL (legado)   | Tabela Postgres v2          | Motivo da mudança                                           |
|-------------------------|-----------------------------|-------------------------------------------------------------|
| `users`                 | `usuarios`                  | Padronização em pt-BR                                       |
| `plans`                 | *(unificada em `assinantes`)* | Eliminar tabela lookup desnecessária                      |
| `subscriptions`         | `assinantes`                | Nome de domínio mais claro                                  |
| `payments`              | `assinantes_pagamentos`     | Prefixo de domínio para clareza                             |
| `coupons`               | `cupons`                    | Padronização em pt-BR                                       |
| `webhook_logs`          | `webhook_events`            | Semântica mais precisa (evento, não apenas log)             |
| `accounts`              | `contas`                    | Padronização em pt-BR                                       |
| `categories`            | `categorias`                | Padronização em pt-BR                                       |
| `bills`                 | `contas_pagar`              | Nome de domínio padrão do sistema financeiro BR             |
| `receivables`           | `contas_receber`            | Nome de domínio padrão do sistema financeiro BR             |
| `transactions`          | `movimentacoes_caixa`       | Clareza sobre tipo de registro                              |
| `investment_types`      | `tipos_investimento`        | Padronização em pt-BR                                       |
| `banks`                 | `instituicoes_financeiras`  | Engloba corretoras e outros (não apenas bancos)             |
| `investments`           | `investimentos`             | Padronização em pt-BR                                       |
| `investment_events`     | `investimentos_eventos`     | Padronização em pt-BR                                       |
| `goals`                 | `metas`                     | Padronização em pt-BR                                       |
| `goal_movements`        | `metas_movimentos`          | Padronização em pt-BR                                       |
| `attachments`           | `anexos`                    | Padronização em pt-BR                                       |
| `attachment_relations`  | `anexos_vinculos`           | Padronização em pt-BR                                       |
| `whatsapp_messages`     | `whatsapp_logs`             | Alinhamento com outros logs do sistema                      |
| `background_jobs`       | `jobs`                      | Simplificação do nome                                       |

---

## Próximos Passos (Sprint 02)

| Subtask | Entregável                                     | Depende de                    |
|---------|------------------------------------------------|-------------------------------|
| 02.1    | ERD Postgres v2 (DBML + diagrama)              | Todos os documentos deste índice |
| 02.2    | Migrations SQL (`db/schema.sql` inicial)       | 02.1 ERD finalizado           |
| 02.3    | Scripts ETL (MySQL → Postgres)                 | 02.2 migrations prontas       |
| 02.4    | Validação de dados migrados                    | 02.3 ETL executado            |

> ⚠️ **Premissa crítica para 02.1:** Os problemas CR-01 a CR-06 (ver `03-legacy-issues.md`) **devem**
> ser corrigidos no redesenho. Não reproduzir os anti-patterns do legado.

---

*Documento gerado em: 2026-03-03*  
*Autores: Levantamento automatizado via análise de `finlly_go.sql` + código PHP*
