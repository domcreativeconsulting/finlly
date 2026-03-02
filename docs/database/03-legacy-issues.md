# 03 — Problemas do Legado MySQL

> **Fonte:** `finlly_go.sql` + código PHP (`auth.php`, `assinatura.php`, `checkout_assinatura.php`,
> `contas_pagar.php`, `contas_receber.php`, `configuracoes_financeiras.php`, `asaas_client.php`)  
> **Data:** 2026-03-02  
> **Propósito:** Lista estruturada de anti-patterns, inconsistências e riscos do esquema MySQL legado,
> com recomendações de correção para o redesenho em Postgres v2.

---

## Sumário de Severidade

| Severidade | Qtd | Descrição                                                  |
|------------|-----|------------------------------------------------------------|
| 🔴 Crítico  | 6   | Risco de dados corrompidos ou perda irreversível de dados  |
| 🟠 Alto     | 7   | Inconsistência de dados ou bugs silenciosos em produção    |
| 🟡 Médio    | 8   | Degradação de performance ou manutenibilidade              |
| 🟢 Baixo    | 4   | Melhorias de design sem impacto imediato em dados          |
| **Total**  | **25** |                                                         |

---

## 🔴 Problemas Críticos

---

### CR-01: Ausência Total de Foreign Keys Explícitas

**Tabelas afetadas:** Todas (21 tabelas)  
**Anti-pattern:** Integridade referencial mantida **exclusivamente** pelo código PHP.

**Impacto:**
- Qualquer acesso direto ao banco (migração, script de manutenção, dashboard de BI) pode criar registros órfãos.
- Deleção de `users` gera ~13 tabelas com registros órfãos silenciosamente.
- Impossível auditar relacionamentos via schema — dependência total do código PHP.

**Exemplo de risco:**
```sql
-- Legado: deleta usuário sem cascade → 10+ tabelas ficam com user_id inválido
DELETE FROM users WHERE id = 42;
-- accounts, bills, receivables, transactions... todos mantêm user_id = 42
```

**Correção no Postgres v2:**  
Todas as relações possuem FKs explícitas com `ON DELETE CASCADE | SET NULL | RESTRICT` conforme contexto
(ver `02-relationships-matrix.md` e `db/schema.sql`).

---

### CR-02: Saldo Armazenado em `accounts.balance` (Desnormalização Crítica)

**Tabela afetada:** `accounts`  
**Anti-pattern:** Campo `balance DECIMAL(10,2)` armazenado e atualizado via PHP.

**Impacto:**
- Se qualquer atualização de `balance` falhar (erro de rede, exception PHP), saldo fica inconsistente.
- Não existe garantia de atomicidade entre `INSERT INTO transactions` e `UPDATE accounts SET balance`.
- Inconsistências acumulam silenciosamente ao longo do tempo.

**Exemplo de divergência:**
```sql
-- PHP: insere transação, mas falha antes de atualizar balance
INSERT INTO transactions (account_id, type, amount, ...) VALUES (1, 'expense', 150.00, ...);
-- UPDATE accounts SET balance = balance - 150 WHERE id = 1;  ← nunca executado
```

**Correção no Postgres v2:**  
`balance` **removido** de `contas`. Saldo calculado on-demand:
```sql
SELECT SUM(CASE tipo WHEN 'entrada' THEN valor ELSE -valor END)
FROM movimentacoes_caixa
WHERE conta_id = ? AND deleted_at IS NULL;
```

---

### CR-03: Sem Soft-Delete em Entidades Financeiras (Violação LGPD)

**Tabelas afetadas:** `users`, `accounts`, `bills`, `receivables`, `transactions`, `investments`, `goals`, `attachments`  
**Anti-pattern:** Deleção física (`DELETE`) sem mecanismo de recuperação.

**Impacto:**
- LGPD exige que dados pessoais possam ser "esquecidos" **de forma auditável**, não apagados abruptamente.
- Histórico financeiro irrecuperável após exclusão de conta.
- Sem trilha de auditoria de quem deletou o quê e quando.

**Correção no Postgres v2:**  
Coluna `deleted_at TIMESTAMPTZ` adicionada em todas as entidades de negócio. Registro "ativo" = `deleted_at IS NULL`.

---

### CR-04: `webhook_logs` Sem Campo `event_id` (Sem Idempotência)

**Tabela afetada:** `webhook_logs`  
**Anti-pattern:** Ausência de identificador único do evento no provedor.

**Impacto:**
- Redelivery de webhook (comportamento padrão Asaas/Stripe) processa o mesmo evento N vezes.
- Pagamentos podem ser marcados como pagos múltiplas vezes.
- Assinaturas ativadas/canceladas erroneamente por eventos duplicados.

**Evidência no código (`asaas_client.php`):**
- O handler de webhook não verifica se o `event_id` já foi processado antes de executar ações.

**Correção no Postgres v2:**  
`webhook_events` possui `event_id VARCHAR(255)` com `UNIQUE (provider, event_id)` — inserção duplicada falha na constraint, garantindo idempotência.

---

### CR-05: Overflow de `INT` em Tabelas de Alto Volume

**Tabelas afetadas:** `webhook_logs`, `whatsapp_messages`, `background_jobs`  
**Anti-pattern:** PK `INT AUTO_INCREMENT` (máximo ~2.1 bilhões de registros).

**Impacto:**
- Sistema de billing/WhatsApp com alto volume pode atingir o limite de INT em produção.
- Após overflow: novos inserts falham com erro de constraint (sistema para).
- Migração de INT para BIGINT em produção requer lock de tabela (downtime).

**Correção no Postgres v2:**  
`BIGSERIAL` (8 bytes, ~9.2 × 10¹⁸) nestas tabelas.

---

### CR-06: `coupons.code` Sem UNIQUE — Cupons Duplicados Aceitos

**Tabela afetada:** `coupons`  
**Anti-pattern:** Campo `code VARCHAR(50)` sem índice UNIQUE.

**Impacto:**
- Dois cupons com o mesmo código podem existir simultaneamente.
- Comportamento do PHP ao aplicar cupom é imprevisível (qual registro retorna o SELECT?).
- Cliente pode conseguir desconto indevido ou receber erro inconsistente.

**Correção no Postgres v2:**  
`CONSTRAINT uq_cupons_codigo UNIQUE (codigo)` em `cupons`.

---

## 🟠 Problemas Altos

---

### AL-01: `status` e `type` como VARCHAR Livre (Sem Enum/Check)

**Tabelas afetadas:** `subscriptions`, `payments`, `bills`, `receivables`, `transactions`, `goals`, `investments`, `investment_events`, `categories`, `background_jobs`, `whatsapp_messages`  
**Anti-pattern:** Status e tipos de campo definidos como `VARCHAR(20)` sem validação de domínio.

**Impacto:**
- Valores como `'Pending'`, `'PENDING'`, `'pending'` coexistem no banco (case sensitivity).
- Queries de filtro por status exigem `LOWER()` ou falham silenciosamente.
- Novos valores inválidos entram no banco sem erro.

**Valores encontrados no legado (exemplos):**
- `bills.status`: `'pending'`, `'paid'`, `'overdue'`, `'cancelled'` (e variantes com typo)
- `transactions.type`: `'income'`, `'expense'`, `'transfer'`, `'Income'`

**Correção no Postgres v2:**  
ENUMs Postgres para todos os campos de status/tipo:
`status_pagamento`, `tipo_movimentacao`, `status_assinante`, `tipo_conta`, `tipo_meta`, `tipo_evento_investimento`, `tipo_recorrencia`.

---

### AL-02: `investments.current_value` e `goals.current_amount` Desnormalizados

**Tabelas afetadas:** `investments`, `goals`  
**Anti-pattern:** Valores calculáveis armazenados redundantemente.

**Impacto:**
- Idem ao CR-02: pode divergir dos eventos/movimentos quando atualização falha.
- Relatórios de patrimônio e progresso de metas mostram valores incorretos.

**Correção no Postgres v2:**  
Campos removidos. Calculados via `SUM()` em `investimentos_eventos` e `metas_movimentos`.

---

### AL-03: `bills` e `receivables` Sem Suporte a Parcelamento

**Tabelas afetadas:** `bills`, `receivables`  
**Anti-pattern:** Ausência de campos `installment_number`, `total_installments`, `installment_group_id`.

**Impacto:**
- Parcelamento implementado via lógica PHP — sem rastreabilidade no banco.
- Impossível consultar "todas as parcelas de uma compra" via SQL sem heurísticas de texto.
- Cancelar parcelas individuais vs. todo o grupo exige lógica frágil no PHP.

**Evidência (`contas_pagar.php`):**  
PHP gera N registros em `bills` com mesmo `description` — sem campo de agrupamento.

**Correção no Postgres v2:**  
`contas_pagar` e `contas_receber` possuem `parcela_atual`, `total_parcelas` e `grupo_recorrencia_id UUID`.

---

### AL-04: `attachment_relations.entity_type` Sem Validação de Domínio

**Tabela afetada:** `attachment_relations`  
**Anti-pattern:** `entity_type VARCHAR(50)` sem CHECK — qualquer string aceita.

**Impacto:**
- Vínculos para entidades inexistentes criados silenciosamente.
- Busca de anexos por entidade falha para values com typo (ex: `'bill'` vs `'bills'`).
- Sem FK real: a entidade referenciada pode ser deletada sem remover o vínculo.

**Correção no Postgres v2:**  
`CONSTRAINT ck_avinculos_tipo CHECK (entidade_tipo IN ('contas_pagar', 'contas_receber', 'investimentos', 'metas', 'movimentacoes_caixa'))` em `anexos_vinculos`.

---

### AL-05: `subscriptions` Sem UNIQUE em `user_id`

**Tabela afetada:** `subscriptions`  
**Anti-pattern:** Ausência de constraint UNIQUE em `user_id`.

**Impacto:**
- Múltiplas assinaturas ativas por usuário possíveis.
- PHP pode criar nova assinatura trial sem verificar se já existe uma ativa.
- Conflito de billing: usuário cobrado múltiplas vezes.

**Correção no Postgres v2:**  
`CONSTRAINT uq_assinantes_usuario UNIQUE (usuario_id)` em `assinantes`.

---

### AL-06: `users.email` Sem UNIQUE

**Tabela afetada:** `users`  
**Anti-pattern:** Email sem constraint de unicidade no banco.

**Impacto:**
- Usuários duplicados com mesmo email (race condition no cadastro).
- Login por email retorna múltiplos registros — comportamento imprevisível.
- Reset de senha pode afetar conta errada.

**Correção no Postgres v2:**  
`CONSTRAINT uq_usuarios_email UNIQUE (email)` em `usuarios`.

---

### AL-07: `background_jobs.payload` como `LONGTEXT`

**Tabela afetada:** `background_jobs`  
**Anti-pattern:** JSON armazenado como `LONGTEXT` sem validação de formato.

**Impacto:**
- Payload inválido inserido sem erro → job falha em runtime sem diagnóstico claro.
- Impossível indexar campos do payload para filtros de monitoramento.
- Sem schema, impossível validar estrutura esperada por tipo de job.

**Correção no Postgres v2:**  
`payload JSONB` em `jobs` — validação de formato JSON na inserção + indexação GIN disponível.

---

## 🟡 Problemas Médios

---

### ME-01: `DATETIME` Sem Timezone em Todos os Campos Temporais

**Tabelas afetadas:** Todas (21 tabelas)  
**Anti-pattern:** `DATETIME` MySQL não armazena informação de timezone.

**Impacto:**
- Ambiguidade em horários de verão (DST): o mesmo instante UTC pode aparecer duas vezes.
- Relatórios financeiros com datas incorretas para usuários em fusos diferentes de UTC.
- Ao migrar servidor entre datacenters, timestamps passados ficam errados.

**Correção no Postgres v2:**  
`TIMESTAMPTZ` (timestamp with time zone) em todos os campos de data/hora.

---

### ME-02: `INT AUTO_INCREMENT` Exposto em APIs (Enumeração de IDs)

**Tabelas afetadas:** Todas entidades de negócio  
**Anti-pattern:** IDs sequenciais expostos em endpoints REST.

**Impacto:**
- Enumeração trivial de recursos: `GET /bills/1`, `/bills/2`, ... `GET /bills/99999`.
- Exposição de volume de dados (concorrentes podem contar quantos clientes existem).
- Facilita ataques de force-brute em endpoints sem autenticação adequada.

**Correção no Postgres v2:**  
UUID v4 (`gen_random_uuid()`) para todas as entidades de negócio.

---

### ME-03: `avatar`/`logo` Armazenados como Caminhos Locais

**Tabelas afetadas:** `users` (campo `avatar`), `banks` (campo `logo`)  
**Anti-pattern:** Caminhos de filesystem local em vez de URLs.

**Impacto:**
- Não funciona em ambientes containerizados (Docker, Kubernetes) — filesystem efêmero.
- Impossível usar CDN para servir arquivos estáticos.
- Path traversal potencial se o campo for lido sem sanitização.

**Correção no Postgres v2:**  
`avatar_url TEXT` e `logo_url TEXT` — armazenam URLs completas (CDN/S3/R2).

---

### ME-04: `banks.ispb` e `banks.compe` como Campos Separados

**Tabela afetada:** `banks`  
**Anti-pattern:** Dois campos para identificar instituição (ISPB 8 dígitos e COMPE 3 dígitos).

**Impacto:**
- Redundância: alguns bancos têm apenas COMPE, outros apenas ISPB, outros ambos.
- Sem CHECK de formato (ISPB deve ter 8 dígitos, COMPE 3 dígitos).
- Queries de busca por código precisam verificar dois campos.

**Correção no Postgres v2:**  
`codigo_compensacao VARCHAR(10)` — único campo, aceita COMPE ou ISPB com comentário de documentação.

---

### ME-05: Ausência de Índices em Campos de Filtro Críticos

**Tabelas afetadas:**

| Tabela          | Campo sem índice      | Impacto de Performance                          |
|-----------------|-----------------------|-------------------------------------------------|
| `users`         | `email`               | Login por email faz full table scan             |
| `subscriptions` | `user_id`             | Busca de assinatura por usuário sem índice      |
| `payments`      | `subscription_id`, `user_id` | Histórico de pagamentos sem índice       |
| `coupons`       | `code`                | Busca de cupom faz full table scan              |
| `categories`    | `parent_id`           | Busca de subcategorias sem índice               |
| `investment_events` | `user_id`         | Relatório de eventos sem índice                 |
| `goal_movements`| `goal_id`             | Cálculo de progresso sem índice                 |

**Correção no Postgres v2:**  
Índices criados em todos os campos de filtro frequente (ver `db/schema.sql`).

---

### ME-06: `recurrence` em `bills`/`receivables` Como String Livre

**Tabelas afetadas:** `bills`, `receivables`  
**Anti-pattern:** Campo `recurrence VARCHAR(20)` sem enum.

**Impacto:**
- Valores como `'monthly'`, `'mensal'`, `'mes'`, `'month'` coexistem nos dados.
- Lógica PHP de geração de recorrência frágil: cada versão do código pode usar um valor diferente.

**Correção no Postgres v2:**  
`tipo_recorrencia ENUM('diario', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual')`.

---

### ME-07: Ausência de CHECK em Campos Monetários

**Tabelas afetadas:** `bills.amount`, `receivables.amount`, `transactions.amount`, `investment_events.amount`, `goals.target_amount`  
**Anti-pattern:** Campos DECIMAL sem `CHECK (valor > 0)`.

**Impacto:**
- Valores negativos ou zero inseridos silenciosamente.
- Relatórios financeiros com somas incorretas.

**Correção no Postgres v2:**  
`CHECK (valor > 0)` em todos os campos monetários de entrada/saída.

---

### ME-08: `coupons.discount_type` Como String Livre

**Tabela afetada:** `coupons`  
**Anti-pattern:** `discount_type VARCHAR(20)` sem CHECK.

**Impacto:**
- Valores inválidos aceitos (ex: `'percentage'` vs `'percent'`).
- Sem garantia de que apenas um tipo de desconto está ativo por cupom.

**Correção no Postgres v2:**  
Dois campos separados `desconto_percentual` e `desconto_fixo` com CHECK de exclusividade:
```sql
CONSTRAINT ck_cupons_desconto CHECK (
  (desconto_percentual IS NOT NULL AND desconto_fixo IS NULL)
  OR (desconto_percentual IS NULL AND desconto_fixo IS NOT NULL)
)
```

---

## 🟢 Problemas Baixos

---

### BA-01: `TINYINT(1)` Usado como Boolean

**Tabelas afetadas:** `accounts` (`active`), `coupons` (`active`), `investments` (`active`), `bills` (`recurring`), `receivables` (`recurring`), `webhook_logs` (`processed`)  
**Anti-pattern:** Boolean representado como `TINYINT(1)`.

**Impacto:** Código PHP precisa comparar com `== 1` / `== 0` em vez de `=== true` / `=== false`.  
**Correção no Postgres v2:** `BOOLEAN NOT NULL DEFAULT FALSE/TRUE`.

---

### BA-02: `users.username` Redundante com `users.email`

**Tabela afetada:** `users`  
**Anti-pattern:** Dois identificadores de login (username e email).

**Impacto:** Duplicação; código PHP usa email para login mas campo username persiste sem uso claro.  
**Correção no Postgres v2:** Campo `username` removido de `usuarios`. Login exclusivamente por email.

---

### BA-03: `plans` Tabela Separada com `features` Como JSON em TEXT

**Tabelas afetadas:** `plans`  
**Anti-pattern:** Metadados de plano em `TEXT` sem schema.

**Impacto:** Sem validação de quais features um plano tem; difícil de auditar.  
**Correção no Postgres v2:** `plans` unificado em `assinantes.plano VARCHAR(50)`. Features de plano geridas na aplicação.

---

### BA-04: `color` Sem Validação de Formato Hex

**Tabelas afetadas:** `accounts`, `categories`, `goals`  
**Anti-pattern:** Campo `color VARCHAR(7)` sem CHECK de formato.

**Impacto:** Valores inválidos (ex: `'red'`, `'#ZZZZZZ'`) armazenados sem erro.  
**Correção no Postgres v2:**
```sql
CHECK (cor ~ '^#[0-9A-Fa-f]{6}$')
```

---

## Riscos de Migração

### Conversão de Dados

| Campo Legado          | Tipo Legado       | Tipo v2          | Risco de Conversão                                      |
|-----------------------|-------------------|------------------|---------------------------------------------------------|
| `id` (todas tabelas)  | `INT`             | `UUID`           | **Alto:** IDs precisam ser mapeados; registros cruzados precisam ser re-vinculados via tabela de mapeamento |
| `status` (string)     | `VARCHAR`         | `ENUM`           | **Médio:** Valores com typo ou case diferente precisam ser normalizados antes da migração |
| `created_at`/`updated_at` | `DATETIME` | `TIMESTAMPTZ`    | **Baixo:** Assume-se UTC; confirmar timezone do servidor MySQL |
| `balance` (accounts)  | `DECIMAL`         | *(removido)*     | **Médio:** Verificar consistência entre `balance` e soma de `transactions` antes de remover |
| `current_value` (investments) | `DECIMAL` | *(removido)*  | **Médio:** Idem — verificar consistência com `investment_events` |
| `current_amount` (goals) | `DECIMAL`    | *(removido)*     | **Médio:** Idem — verificar consistência com `goal_movements` |
| `size` (attachments)  | `INT`             | `BIGINT`         | **Baixo:** Conversão direta; sem perda de dados         |
| `payload` (jobs)      | `LONGTEXT`        | `JSONB`          | **Médio:** Validar que todos os payloads são JSON válido antes de migrar |

### Dados Inconsistentes a Tratar Antes da Migração

1. **Saldos divergentes:** `accounts.balance` ≠ SUM(`transactions`) → definir estratégia (qual valor é a verdade?).
2. **Status inválidos:** Normalizar todos os valores de `status`/`type` para os ENUMs definidos.
3. **Emails duplicados:** Resolver usuários com mesmo email antes de adicionar UNIQUE constraint.
4. **Cupons com código duplicado:** Desativar duplicatas e manter o mais recente.
5. **Registros órfãos:** Identificar e tratar registros em `bills`, `receivables`, `transactions` com `user_id` inválido.
6. **`attachment_relations` com `entity_type` inválido:** Limpar ou migrar para os valores aceitos no v2.

---

## Recomendações de Correção Consolidadas

### O que manter no Postgres v2

- Estrutura geral de domínios (financeiro, billing, investimentos, metas, anexos)
- Semântica dos campos principais (datas, descrições, valores)
- Lookup tables (`investment_types`, `banks` → `instituicoes_financeiras`)
- Vínculo polimórfico em `attachment_relations` (agora com CHECK constraint)
- Log de jobs (`background_jobs` → `jobs`) com estrutura similar

### O que refatorar

- **Todos os IDs:** INT → UUID (entidades de negócio) ou BIGSERIAL (logs/filas)
- **Todos os campos temporais:** DATETIME → TIMESTAMPTZ
- **Todos os status/type:** VARCHAR livre → ENUM Postgres
- **FKs implícitas:** Declarar explicitamente com ON DELETE adequado
- **Campos monetários calculáveis:** Remover `balance`, `current_value`, `current_amount`
- **Soft-delete:** Adicionar `deleted_at TIMESTAMPTZ` em todas as entidades de negócio
- **Parcelamento:** Adicionar `parcela_atual`, `total_parcelas`, `grupo_recorrencia_id` em contas a pagar/receber
- **Webhook:** Adicionar `event_id` com UNIQUE constraint para idempotência
- **JSON:** Migrar `LONGTEXT` → `JSONB`
- **Paths locais:** Migrar para URLs (avatar_url, logo_url)

### O que pode ser removido/unificado

- `plans` + `subscriptions` → unificado em `assinantes`
- `users.username` → removido (login por email)
- `accounts.balance`, `investments.current_value`, `goals.current_amount` → removidos (calculados)
- `banks.ispb` + `banks.compe` → unificados em `codigo_compensacao`
- `coupons.discount` + `coupons.discount_type` → substituídos por `desconto_percentual` + `desconto_fixo`

---

*Documento gerado em: 2026-03-02*  
*Documentos relacionados: `01-legacy-schema-mapping.md`, `02-relationships-matrix.md`*
