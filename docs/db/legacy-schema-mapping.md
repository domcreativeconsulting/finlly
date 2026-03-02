# Levantamento de Esquema Legado — MySQL → Postgres

> **Objetivo**: Documentar completamente o modelo relacional legado (MySQL) do Finlly para servir como
> base do redesenho em Postgres, incluindo inventário de tabelas, estrutura detalhada, mapeamento de
> relacionamentos e lista de inconsistências a evitar.
>
> Gerado em: 2026-03-02 | Versão: 1.0

---

## Sumário

1. [Inventário por Domínio](#1-inventário-por-domínio)
2. [Descrição Detalhada das Tabelas](#2-descrição-detalhada-das-tabelas)
3. [Matriz de Relacionamentos](#3-matriz-de-relacionamentos)
4. [Inconsistências do Legado](#4-inconsistências-do-legado)

---

## 1. Inventário por Domínio

### Domínio 1 — Usuários & Autenticação

| # | Tabela     | Finalidade                                         |
|---|------------|----------------------------------------------------|
| 1 | `usuarios` | Entidade central; credenciais e perfil do usuário  |

> ⚠️ Não foi encontrada tabela `sessions` no schema, embora o código PHP a referencie.

---

### Domínio 2 — Billing & Assinaturas

| #  | Tabela                  | Finalidade                                                |
|----|-------------------------|-----------------------------------------------------------|
| 3  | `assinantes`            | Assinatura ativa de cada usuário (plano, status, trial)   |
| 4  | `assinantes_pagamentos` | Histórico de cobranças por assinante                      |
| 5  | `cupons`                | Cupons de desconto aplicáveis a planos                    |

---

### Domínio 3 — Financeiro

| #  | Tabela                 | Finalidade                                               |
|----|------------------------|----------------------------------------------------------|
| 6  | `contas`               | Contas financeiras do usuário (corrente, poupança, etc.) |
| 7  | `contas_pagar`         | Lançamentos de despesas a pagar                          |
| 8  | `contas_receber`       | Lançamentos de receitas a receber                        |
| 9  | `movimentacoes_caixa`  | Lançamentos reais; fonte de verdade do saldo             |
| 10 | `categorias`           | Categorias de transações (hierarquia pai/filho)          |

---

### Domínio 4 — Investimentos

| #  | Tabela                    | Finalidade                                          |
|----|---------------------------|-----------------------------------------------------|
| 11 | `investimentos`           | Posições de investimento do usuário                 |
| 12 | `investimentos_eventos`   | Aportes, resgates e rendimentos por investimento    |
| 13 | `tipos_investimento`      | Lookup: CDB, LCI, Tesouro Direto, Ações, FII…       |
| 14 | `instituicoes_financeiras`| Lookup: bancos e corretoras                         |

---

### Domínio 5 — Metas

| #  | Tabela            | Finalidade                                          |
|----|-------------------|-----------------------------------------------------|
| 15 | `metas`           | Metas financeiras (poupança, despesa, investimento) |
| 16 | `metas_movimentos`| Aportes e resgates vinculados a cada meta           |

---

### Domínio 6 — Anexos

| #  | Tabela            | Finalidade                                                  |
|----|-------------------|-------------------------------------------------------------|
| 17 | `anexos`          | Arquivos anexados (comprovantes, extratos, faturas)         |
| 18 | `anexos_vinculos` | Vínculo polimórfico entre anexos e entidades financeiras    |

---

### Domínio 7 — WhatsApp / Logs

| #  | Tabela           | Finalidade                                          |
|----|------------------|-----------------------------------------------------|
| 19 | `whatsapp_logs`  | Registro de mensagens enviadas/recebidas via WA     |

---

### Domínio 8 — Infraestrutura

| #  | Tabela            | Finalidade                                          |
|----|-------------------|-----------------------------------------------------|
| 20 | `jobs`            | Fila de processamento assíncrono                    |
| 21 | `webhook_events`  | Eventos de webhook recebidos de provedores externos |

---

## 2. Descrição Detalhada das Tabelas

---

### 2.1 `usuarios`

**Finalidade**: Entidade central do sistema; armazena credenciais e perfil de cada usuário.

| Coluna               | Tipo MySQL          | Null | Default |
|----------------------|---------------------|------|---------|
| `id`                 | INT AUTO_INCREMENT  | NO   | —       |
| `nome`               | VARCHAR(255)        | NO   | —       |
| `email`              | VARCHAR(255)        | NO   | —       |
| `senha`              | VARCHAR(255)        | NO   | —       |
| `telefone`           | VARCHAR(20)         | YES  | NULL    |
| `telefone_whatsapp`  | VARCHAR(20)         | YES  | NULL    |
| `whatsapp`           | VARCHAR(20)         | YES  | NULL    |
| `avatar_url`         | TEXT                | YES  | NULL    |
| `email_verificado`   | TINYINT(1)          | NO   | 0       |
| `created_at`         | DATETIME            | NO   | —       |
| `updated_at`         | DATETIME            | NO   | —       |

- **PK**: `id`
- **FKs**: nenhuma
- **Índices**: `UNIQUE (email)`
- **Volume esperado**: baixo (≤ 10k usuários)
- **Operações principais**: INSERT no cadastro; SELECT por email (login); UPDATE em troca de senha

---

### 2.2 `assinantes`

**Finalidade**: Registro de assinatura ativa de cada usuário (plano, status Asaas, trial).

| Coluna                   | Tipo MySQL    | Null | Default  |
|--------------------------|---------------|------|----------|
| `id`                     | INT           | NO   | —        |
| `usuario_id`             | INT           | YES  | NULL     |
| `email`                  | VARCHAR(255)  | NO   | —        |
| `plano`                  | VARCHAR(50)   | NO   | —        |
| `status`                 | VARCHAR(20)   | NO   | —        |
| `asaas_customer_id`      | VARCHAR(100)  | YES  | NULL     |
| `asaas_subscription_id`  | VARCHAR(100)  | YES  | NULL     |
| `trial_inicio`           | DATETIME      | YES  | NULL     |
| `trial_fim`              | DATETIME      | YES  | NULL     |
| `created_at`             | DATETIME      | NO   | —        |
| `updated_at`             | DATETIME      | NO   | —        |

- **PK**: `id`
- **FKs**: `usuario_id` → `usuarios.id` (sem declaração explícita de FK no MySQL)
- **Índices**: `UNIQUE (email, plano)`, `INDEX (asaas_subscription_id)`
- **Volume esperado**: baixo (1:1 com usuarios)
- **Operações principais**: SELECT por email/usuario_id; UPDATE de status pós-webhook

---

### 2.3 `assinantes_pagamentos`

**Finalidade**: Histórico de cobranças geradas para cada assinante.

| Coluna               | Tipo MySQL    | Null | Default   |
|----------------------|---------------|------|-----------|
| `id`                 | INT           | NO   | —         |
| `assinante_id`       | INT           | NO   | —         |
| `valor`              | DECIMAL(10,2) | NO   | —         |
| `status`             | VARCHAR(20)   | NO   | 'pendente'|
| `asaas_payment_id`   | VARCHAR(100)  | YES  | NULL      |
| `descricao`          | TEXT          | YES  | NULL      |
| `data_pagamento`     | DATETIME      | YES  | NULL      |
| `data_vencimento`    | DATETIME      | YES  | NULL      |
| `created_at`         | DATETIME      | NO   | —         |
| `updated_at`         | DATETIME      | NO   | —         |

- **PK**: `id`
- **FKs**: `assinante_id` → `assinantes.id` (implícita)
- **Índices**: `UNIQUE (asaas_payment_id)`, `INDEX (assinante_id)`
- **Volume esperado**: médio (cresce com histórico de cobranças)
- **Operações principais**: INSERT pós-webhook; SELECT por assinante_id (listagem de faturas)

---

### 2.4 `cupons`

**Finalidade**: Cupons de desconto aplicáveis na contratação de planos.

| Coluna         | Tipo MySQL    | Null | Default |
|----------------|---------------|------|---------|
| `id`           | INT           | NO   | —       |
| `codigo`       | VARCHAR(50)   | NO   | —       |
| `desconto`     | DECIMAL(5,2)  | NO   | —       |
| `tipo`         | VARCHAR(20)   | NO   | —       |
| `valido_ate`   | DATETIME      | YES  | NULL    |
| `uso_maximo`   | INT           | YES  | NULL    |
| `uso_atual`    | INT           | NO   | 0       |
| `ativo`        | TINYINT(1)    | NO   | 1       |
| `created_at`   | DATETIME      | NO   | —       |
| `updated_at`   | DATETIME      | NO   | —       |

- **PK**: `id`
- **FKs**: nenhuma
- **Índices**: `UNIQUE (codigo)`
- **Volume esperado**: baixo (catálogo pequeno)
- **Operações principais**: SELECT por codigo (aplicação); UPDATE uso_atual (increment)

---

### 2.5 `contas`

**Finalidade**: Contas financeiras do usuário (corrente, poupança, cartão, carteira, etc.).

| Coluna         | Tipo MySQL    | Null | Default |
|----------------|---------------|------|---------|
| `id`           | INT           | NO   | —       |
| `usuario_id`   | INT           | NO   | —       |
| `nome`         | VARCHAR(255)  | NO   | —       |
| `tipo`         | VARCHAR(50)   | NO   | —       |
| `banco`        | VARCHAR(100)  | YES  | NULL    |
| `cor`          | VARCHAR(7)    | YES  | NULL    |
| `icone`        | VARCHAR(50)   | YES  | NULL    |
| `saldo_inicial`| DECIMAL(10,2) | NO   | 0.00    |
| `incluir_total`| TINYINT(1)    | NO   | 1       |
| `ativo`        | TINYINT(1)    | NO   | 1       |
| `created_at`   | DATETIME      | NO   | —       |
| `updated_at`   | DATETIME      | NO   | —       |

- **PK**: `id`
- **FKs**: `usuario_id` → `usuarios.id` (implícita)
- **Índices**: `INDEX (usuario_id)`
- **Volume esperado**: baixo (poucos por usuário)
- **Operações principais**: SELECT por usuario_id; UPDATE saldo_inicial (ajuste manual)

---

### 2.6 `contas_pagar`

**Finalidade**: Lançamentos de despesas a pagar, com suporte a recorrência.

| Coluna              | Tipo MySQL    | Null | Default   |
|---------------------|---------------|------|-----------|
| `id`                | INT           | NO   | —         |
| `usuario_id`        | INT           | NO   | —         |
| `descricao`         | VARCHAR(500)  | NO   | —         |
| `valor`             | DECIMAL(10,2) | NO   | —         |
| `data_vencimento`   | DATE          | NO   | —         |
| `data_pagamento`    | DATE          | YES  | NULL      |
| `status`            | VARCHAR(20)   | NO   | 'pendente'|
| `categoria_id`      | INT           | YES  | NULL      |
| `subcategoria_id`   | INT           | YES  | NULL      |
| `conta_id`          | INT           | YES  | NULL      |
| `recorrente`        | TINYINT(1)    | NO   | 0         |
| `recorrencia`       | VARCHAR(20)   | YES  | NULL      |
| `multa_percent`     | DECIMAL(6,2)  | YES  | NULL      |
| `juros_percent`     | DECIMAL(6,2)  | YES  | NULL      |
| `observacoes`       | TEXT          | YES  | NULL      |
| `created_at`        | DATETIME      | NO   | —         |
| `updated_at`        | DATETIME      | NO   | —         |

- **PK**: `id`
- **FKs**: `usuario_id` → `usuarios.id`, `conta_id` → `contas.id`, `categoria_id` → `categorias.id`, `subcategoria_id` → `categorias.id` (todas implícitas)
- **Índices**: `INDEX (status)`, `INDEX (usuario_id, data_vencimento)` → `idx_cp_usuario_data`
- **Volume esperado**: alta (cresce com cada lançamento)
- **Operações principais**: SELECT com filtros por status/data; UPDATE status ao pagar; DELETE ao cancelar

---

### 2.7 `contas_receber`

**Finalidade**: Lançamentos de receitas a receber, com suporte a recorrência.

| Coluna              | Tipo MySQL    | Null | Default   |
|---------------------|---------------|------|-----------|
| `id`                | INT           | NO   | —         |
| `usuario_id`        | INT           | NO   | —         |
| `descricao`         | VARCHAR(500)  | NO   | —         |
| `valor`             | DECIMAL(10,2) | NO   | —         |
| `data_vencimento`   | DATE          | NO   | —         |
| `data_recebimento`  | DATE          | YES  | NULL      |
| `status`            | VARCHAR(20)   | NO   | 'pendente'|
| `categoria_id`      | INT           | YES  | NULL      |
| `conta_id`          | INT           | YES  | NULL      |
| `recorrente`        | TINYINT(1)    | NO   | 0         |
| `recorrencia`       | VARCHAR(20)   | YES  | NULL      |
| `observacoes`       | TEXT          | YES  | NULL      |
| `created_at`        | DATETIME      | NO   | —         |
| `updated_at`        | DATETIME      | NO   | —         |

- **PK**: `id`
- **FKs**: `usuario_id` → `usuarios.id`, `conta_id` → `contas.id`, `categoria_id` → `categorias.id` (todas implícitas)
- **Índices**: `INDEX (usuario_id, data_vencimento)`, `INDEX (usuario_id, status)`, `INDEX (status)`
- **Volume esperado**: alta
- **Operações principais**: SELECT por status/data; UPDATE status ao receber

---

### 2.8 `movimentacoes_caixa`

**Finalidade**: Lançamentos financeiros reais em caixa; fonte de verdade para cálculo de saldo.

| Coluna        | Tipo MySQL    | Null | Default |
|---------------|---------------|------|---------|
| `id`          | INT           | NO   | —       |
| `usuario_id`  | INT           | NO   | —       |
| `conta_id`    | INT           | NO   | —       |
| `tipo`        | VARCHAR(20)   | NO   | —       |
| `valor`       | DECIMAL(10,2) | NO   | —       |
| `descricao`   | VARCHAR(500)  | NO   | —       |
| `data`        | DATE          | NO   | —       |
| `categoria_id`| INT           | YES  | NULL    |
| `id_origem`   | INT           | YES  | NULL    |
| `origem`      | VARCHAR(50)   | YES  | NULL    |
| `observacoes` | TEXT          | YES  | NULL    |
| `created_at`  | DATETIME      | NO   | —       |
| `updated_at`  | DATETIME      | NO   | —       |

- **PK**: `id`
- **FKs**: `usuario_id` → `usuarios.id`, `conta_id` → `contas.id` (implícitas); `id_origem` sem FK formal (polimórfico via `origem`)
- **Índices**: `INDEX (usuario_id, data)`, `INDEX (conta_id, data)`
- **Volume esperado**: alta (principal tabela transacional)
- **Operações principais**: INSERT a cada pagamento/recebimento; SELECT agregado para cálculo de saldo

---

### 2.9 `categorias`

**Finalidade**: Categorias de transações financeiras com suporte a hierarquia pai/filho.

| Coluna       | Tipo MySQL    | Null | Default |
|--------------|---------------|------|---------|
| `id`         | INT           | NO   | —       |
| `usuario_id` | INT           | YES  | NULL    |
| `nome`       | VARCHAR(255)  | NO   | —       |
| `tipo`       | VARCHAR(20)   | NO   | —       |
| `icone`      | VARCHAR(50)   | YES  | NULL    |
| `cor`        | VARCHAR(7)    | YES  | NULL    |
| `parent_id`  | INT           | YES  | NULL    |
| `created_at` | DATETIME      | NO   | —       |
| `updated_at` | DATETIME      | NO   | —       |

- **PK**: `id`
- **FKs**: `usuario_id` → `usuarios.id` (implícita); `parent_id` → `categorias.id` (auto-referência, implícita)
- **Índices**: `INDEX (usuario_id)`, `INDEX (parent_id)`
- **Volume esperado**: baixo a médio (categorias globais + por usuário)
- **Operações principais**: SELECT por usuario_id; INSERT ao criar categoria personalizada

---

### 2.10 `investimentos`

**Finalidade**: Posições de investimento do usuário (CDB, ações, FII, etc.).

| Coluna                | Tipo MySQL     | Null | Default |
|-----------------------|----------------|------|---------|
| `id`                  | INT            | NO   | —       |
| `usuario_id`          | INT            | NO   | —       |
| `nome`                | VARCHAR(255)   | NO   | —       |
| `tipo_investimento_id`| INT            | NO   | —       |
| `instituicao_id`      | INT            | YES  | NULL    |
| `conta_id`            | INT            | YES  | NULL    |
| `valor_aplicado`      | DECIMAL(10,2)  | NO   | 0.00    |
| `valor_inicial`       | DECIMAL(10,2)  | YES  | NULL    |
| `taxa_anual`          | DECIMAL(7,4)   | YES  | NULL    |
| `taxa_ano`            | DECIMAL(7,4)   | YES  | NULL    |
| `data_inicio`         | DATE           | NO   | —       |
| `data_vencimento`     | DATE           | YES  | NULL    |
| `status`              | VARCHAR(20)    | NO   | 'ativo' |
| `observacoes`         | TEXT           | YES  | NULL    |
| `created_at`          | DATETIME       | NO   | —       |
| `criado_em`           | DATETIME       | YES  | NULL    |
| `updated_at`          | DATETIME       | NO   | —       |

- **PK**: `id`
- **FKs**: `usuario_id` → `usuarios.id`, `tipo_investimento_id` → `tipos_investimento.id`, `instituicao_id` → `instituicoes_financeiras.id` (todas implícitas)
- **Índices**: `INDEX (usuario_id, status)`, `INDEX (usuario_id, tipo_investimento_id)`
- **Volume esperado**: médio
- **Operações principais**: SELECT por usuario_id+status; UPDATE valor após aporte/resgate

---

### 2.11 `investimentos_eventos`

**Finalidade**: Histórico de eventos por investimento (aportes, resgates, rendimentos, taxas, dividendos).

| Coluna           | Tipo MySQL    | Null | Default |
|------------------|---------------|------|---------|
| `id`             | INT           | NO   | —       |
| `investimento_id`| INT           | NO   | —       |
| `tipo`           | VARCHAR(30)   | NO   | —       |
| `valor`          | DECIMAL(10,2) | NO   | —       |
| `data`           | DATE          | NO   | —       |
| `descricao`      | TEXT          | YES  | NULL    |
| `created_at`     | DATETIME      | NO   | —       |
| `updated_at`     | DATETIME      | NO   | —       |

- **PK**: `id`
- **FKs**: `investimento_id` → `investimentos.id` (implícita)
- **Índices**: `INDEX (investimento_id, data)`
- **Volume esperado**: alta (vários eventos por investimento)
- **Operações principais**: INSERT por evento; SELECT agregado para valor atual

---

### 2.12 `tipos_investimento`

**Finalidade**: Lookup de tipos de investimento (CDB, LCI, LCA, Tesouro Direto, Ações, FII…).

| Coluna       | Tipo MySQL   | Null | Default |
|--------------|--------------|------|---------|
| `id`         | INT          | NO   | —       |
| `nome`       | VARCHAR(100) | NO   | —       |
| `descricao`  | TEXT         | YES  | NULL    |
| `created_at` | DATETIME     | NO   | —       |
| `updated_at` | DATETIME     | NO   | —       |

- **PK**: `id`
- **FKs**: nenhuma
- **Índices**: `UNIQUE (nome)`
- **Volume esperado**: baixo (catálogo fixo)
- **Operações principais**: SELECT (listagem); INSERT/UPDATE por admin

---

### 2.13 `instituicoes_financeiras`

**Finalidade**: Lookup de bancos e corretoras para associar a contas e investimentos.

| Coluna              | Tipo MySQL   | Null | Default |
|---------------------|--------------|------|---------|
| `id`                | INT          | NO   | —       |
| `nome`              | VARCHAR(255) | NO   | —       |
| `codigo_banco`      | VARCHAR(10)  | YES  | NULL    |
| `logo_url`          | TEXT         | YES  | NULL    |
| `created_at`        | DATETIME     | NO   | —       |
| `updated_at`        | DATETIME     | NO   | —       |

- **PK**: `id`
- **FKs**: nenhuma
- **Índices**: `UNIQUE (nome)`
- **Volume esperado**: baixo (catálogo)
- **Operações principais**: SELECT (listagem/associação)

---

### 2.14 `metas`

**Finalidade**: Metas financeiras do usuário (poupar, reduzir despesas, atingir patrimônio).

| Coluna       | Tipo MySQL    | Null | Default |
|--------------|---------------|------|---------|
| `id`         | INT           | NO   | —       |
| `usuario_id` | INT           | NO   | —       |
| `nome`       | VARCHAR(255)  | NO   | —       |
| `tipo`       | VARCHAR(30)   | NO   | —       |
| `valor_alvo` | DECIMAL(10,2) | NO   | —       |
| `conta_id`   | INT           | YES  | NULL    |
| `data_inicio`| DATE          | NO   | —       |
| `data_fim`   | DATE          | YES  | NULL    |
| `status`     | VARCHAR(20)   | NO   | 'ativa' |
| `icone`      | VARCHAR(50)   | YES  | NULL    |
| `cor`        | VARCHAR(7)    | YES  | NULL    |
| `observacoes`| TEXT          | YES  | NULL    |
| `created_at` | DATETIME      | NO   | —       |
| `updated_at` | DATETIME      | NO   | —       |

- **PK**: `id`
- **FKs**: `usuario_id` → `usuarios.id`, `conta_id` → `contas.id` (implícitas)
- **Índices**: `INDEX (usuario_id, status)`, `INDEX (usuario_id, created_at)`
- **Volume esperado**: baixo a médio
- **Operações principais**: SELECT por usuario_id+status; UPDATE status ao concluir

---

### 2.15 `metas_movimentos`

**Finalidade**: Aportes e resgates vinculados a cada meta financeira.

| Coluna       | Tipo MySQL    | Null | Default |
|--------------|---------------|------|---------|
| `id`         | INT           | NO   | —       |
| `meta_id`    | INT           | NO   | —       |
| `usuario_id` | INT           | NO   | —       |
| `valor`      | DECIMAL(10,2) | NO   | —       |
| `data`       | DATE          | NO   | —       |
| `descricao`  | TEXT          | YES  | NULL    |
| `created_at` | DATETIME      | NO   | —       |
| `updated_at` | DATETIME      | NO   | —       |

- **PK**: `id`
- **FKs**: `meta_id` → `metas.id`, `usuario_id` → `usuarios.id` (implícitas)
- **Índices**: `INDEX (meta_id, data)`
- **Volume esperado**: médio
- **Operações principais**: INSERT por aporte; SELECT SUM(valor) para valor atual da meta

---

### 2.16 `anexos`

**Finalidade**: Metadados de arquivos anexados (comprovantes, extratos, faturas).

| Coluna                | Tipo MySQL      | Null | Default     |
|-----------------------|-----------------|------|-------------|
| `id`                  | INT             | NO   | —           |
| `usuario_id`          | INT             | NO   | —           |
| `nome_original`       | VARCHAR(255)    | NO   | —           |
| `nome_arquivo`        | VARCHAR(255)    | NO   | —           |
| `mime_type`           | VARCHAR(100)    | NO   | —           |
| `tamanho`             | INT(10) UNSIGNED| NO   | —           |
| `url`                 | TEXT            | NO   | —           |
| `hash_sha256`         | CHAR(64)        | YES  | NULL        |
| `tipo`                | ENUM(…)         | NO   | 'documento' |
| `processamento_status`| ENUM(…)         | NO   | 'pendente'  |
| `created_at`          | DATETIME        | NO   | —           |
| `updated_at`          | DATETIME        | NO   | —           |

- **PK**: `id`
- **FKs**: `usuario_id` → `usuarios.id` (implícita)
- **Índices**: `INDEX (usuario_id, created_at)`, `INDEX (hash_sha256)`, `INDEX (usuario_id, processamento_status)`
- **Volume esperado**: alta (cresce continuamente)
- **Operações principais**: INSERT ao fazer upload; SELECT por usuario_id; deduplicação via hash_sha256

---

### 2.17 `anexos_vinculos`

**Finalidade**: Vínculo polimórfico entre um arquivo e a entidade financeira que ele documenta.

| Coluna        | Tipo MySQL  | Null | Default |
|---------------|-------------|------|---------|
| `id`          | INT         | NO   | —       |
| `anexo_id`    | INT         | NO   | —       |
| `usuario_id`  | INT         | NO   | —       |
| `entidade`    | ENUM(…)     | NO   | —       |
| `entidade_id` | INT         | NO   | —       |
| `created_at`  | DATETIME    | NO   | —       |

- **PK**: `id`
- **FKs**: `anexo_id` → `anexos.id`, `usuario_id` → `usuarios.id` (implícitas; `entidade_id` sem FK formal)
- **Índices**: `INDEX (entidade, entidade_id)`, `INDEX (anexo_id)`
- **Volume esperado**: alta
- **Operações principais**: INSERT ao vincular; SELECT por entidade+entidade_id

---

### 2.18 `whatsapp_logs`

**Finalidade**: Registro de todas as mensagens trocadas via WhatsApp Business API.

| Coluna              | Tipo MySQL   | Null | Default |
|---------------------|--------------|------|---------|
| `id`                | INT          | NO   | —       |
| `usuario_id`        | INT          | YES  | NULL    |
| `whatsapp`          | VARCHAR(20)  | NO   | —       |
| `direcao`           | VARCHAR(10)  | NO   | —       |
| `tipo_mensagem`     | VARCHAR(50)  | NO   | —       |
| `conteudo`          | TEXT         | YES  | NULL    |
| `status`            | VARCHAR(50)  | YES  | NULL    |
| `provider_msg_id`   | VARCHAR(255) | YES  | NULL    |
| `created_at`        | DATETIME     | NO   | —       |
| `updated_at`        | DATETIME     | NO   | —       |

- **PK**: `id`
- **FKs**: `usuario_id` → `usuarios.id` (implícita, nullable)
- **Índices**: `INDEX (whatsapp)`, `INDEX (usuario_id)`
- **Volume esperado**: alta (cada interação gera registros)
- **Operações principais**: INSERT por mensagem; SELECT por usuario_id ou whatsapp (histórico)

---

### 2.19 `jobs`

**Finalidade**: Fila de processamento assíncrono (envio de e-mail, renovação de assinatura, etc.).

| Coluna          | Tipo MySQL   | Null | Default     |
|-----------------|--------------|------|-------------|
| `id`            | INT          | NO   | —           |
| `tipo`          | VARCHAR(100) | NO   | —           |
| `payload`       | JSON         | YES  | NULL        |
| `status`        | VARCHAR(50)  | NO   | 'pendente'  |
| `tentativas`    | INT          | NO   | 0           |
| `max_tentativas`| INT          | NO   | 3           |
| `erro`          | TEXT         | YES  | NULL        |
| `disponivel_em` | DATETIME     | YES  | NULL        |
| `iniciado_em`   | DATETIME     | YES  | NULL        |
| `concluido_em`  | DATETIME     | YES  | NULL        |
| `created_at`    | DATETIME     | NO   | —           |
| `updated_at`    | DATETIME     | NO   | —           |

- **PK**: `id`
- **FKs**: nenhuma
- **Índices**: `INDEX (status, disponivel_em)`, `INDEX (tipo)`
- **Volume esperado**: média (alta rotatividade; registros concluídos podem ser purgados)
- **Operações principais**: INSERT ao enfileirar; SELECT por status+disponivel_em (polling); UPDATE status ao processar

---

### 2.20 `webhook_events`

**Finalidade**: Armazena eventos de webhook recebidos para garantir deduplicação e idempotência.

| Coluna          | Tipo MySQL   | Null | Default |
|-----------------|--------------|------|---------|
| `id`            | INT          | NO   | —       |
| `provider`      | VARCHAR(50)  | NO   | —       |
| `event_id`      | VARCHAR(255) | NO   | —       |
| `event_type`    | VARCHAR(100) | NO   | —       |
| `payload`       | JSON         | NO   | —       |
| `processado`    | TINYINT(1)   | NO   | 0       |
| `processado_em` | DATETIME     | YES  | NULL    |
| `erro`          | TEXT         | YES  | NULL    |
| `received_at`   | DATETIME     | NO   | —       |

- **PK**: `id`
- **FKs**: nenhuma
- **Índices**: `UNIQUE (provider, event_id)`, `INDEX (received_at)`
- **Volume esperado**: média (depende do volume de transações Asaas)
- **Operações principais**: INSERT ao receber (com proteção de UNIQUE); UPDATE processado ao concluir

---

## 3. Matriz de Relacionamentos

### 3.1 Dependências Diretas

| Tabela origem             | → | Tabela destino            | Cardinalidade | Via coluna              |
|---------------------------|---|---------------------------|---------------|-------------------------|
| `assinantes`              | → | `usuarios`                | N:1           | `usuario_id`            |
| `assinantes_pagamentos`   | → | `assinantes`              | N:1           | `assinante_id`          |
| `contas`                  | → | `usuarios`                | N:1           | `usuario_id`            |
| `categorias`              | → | `usuarios`                | N:1 (nullable)| `usuario_id`            |
| `categorias`              | → | `categorias`              | N:1 (self)    | `parent_id`             |
| `contas_pagar`            | → | `usuarios`                | N:1           | `usuario_id`            |
| `contas_pagar`            | → | `contas`                  | N:1 (nullable)| `conta_id`              |
| `contas_pagar`            | → | `categorias`              | N:1 (nullable)| `categoria_id`          |
| `contas_pagar`            | → | `categorias`              | N:1 (nullable)| `subcategoria_id`       |
| `contas_receber`          | → | `usuarios`                | N:1           | `usuario_id`            |
| `contas_receber`          | → | `contas`                  | N:1 (nullable)| `conta_id`              |
| `contas_receber`          | → | `categorias`              | N:1 (nullable)| `categoria_id`          |
| `movimentacoes_caixa`     | → | `usuarios`                | N:1           | `usuario_id`            |
| `movimentacoes_caixa`     | → | `contas`                  | N:1           | `conta_id`              |
| `movimentacoes_caixa`     | → | `categorias`              | N:1 (nullable)| `categoria_id`          |
| `movimentacoes_caixa`     | → | `contas_pagar`            | N:1 (implícita, polimórfica) | `id_origem` quando `origem='conta_pagar'` |
| `movimentacoes_caixa`     | → | `contas_receber`          | N:1 (implícita, polimórfica) | `id_origem` quando `origem='conta_receber'` |
| `movimentacoes_caixa`     | → | `investimentos`           | N:1 (implícita, polimórfica) | `id_origem` quando `origem='investimento'` |
| `investimentos`           | → | `usuarios`                | N:1           | `usuario_id`            |
| `investimentos`           | → | `tipos_investimento`      | N:1           | `tipo_investimento_id`  |
| `investimentos`           | → | `instituicoes_financeiras`| N:1 (nullable)| `instituicao_id`        |
| `investimentos`           | → | `contas`                  | N:1 (nullable)| `conta_id`              |
| `investimentos_eventos`   | → | `investimentos`           | N:1           | `investimento_id`       |
| `metas`                   | → | `usuarios`                | N:1           | `usuario_id`            |
| `metas`                   | → | `contas`                  | N:1 (nullable)| `conta_id`              |
| `metas_movimentos`        | → | `metas`                   | N:1           | `meta_id`               |
| `metas_movimentos`        | → | `usuarios`                | N:1           | `usuario_id`            |
| `anexos`                  | → | `usuarios`                | N:1           | `usuario_id`            |
| `anexos_vinculos`         | → | `anexos`                  | N:1           | `anexo_id`              |
| `anexos_vinculos`         | → | `usuarios`                | N:1           | `usuario_id`            |
| `whatsapp_logs`           | → | `usuarios`                | N:1 (nullable)| `usuario_id`            |

---

### 3.2 Cascatas Lógicas ao Deletar Usuário

Ao remover um registro de `usuarios`, o seguinte é afetado em cascata (comportamento atual do código PHP, **sem FK explícita** no MySQL):

```
usuarios
├── assinantes            → DELETE (sem usuário, sem assinatura)
│   └── assinantes_pagamentos → DELETE (histórico vai junto)
├── contas                → DELETE
│   ├── contas_pagar      → UPDATE conta_id = NULL (fica órfão)
│   ├── contas_receber    → UPDATE conta_id = NULL
│   └── movimentacoes_caixa → PROBLEMA: FK implícita; saldo fica inconsistente
├── categorias            → permanece (global) ou DELETE (personalizada)
├── contas_pagar          → DELETE
├── contas_receber        → DELETE
├── movimentacoes_caixa   → DELETE
├── investimentos         → DELETE
│   └── investimentos_eventos → DELETE
├── metas                 → DELETE
│   └── metas_movimentos  → DELETE
├── anexos                → DELETE
│   └── anexos_vinculos   → DELETE
└── whatsapp_logs         → permanece (usuario_id = NULL, histórico de auditoria)
```

> **Risco identificado**: Como não há FKs declaradas no MySQL, deleções manuais ou bugs podem deixar
> registros órfãos sem que o banco detecte a inconsistência.

---

### 3.3 Dependências de Lookup (tabelas sem usuario_id)

| Tabela lookup              | Referenciada por                                     |
|----------------------------|------------------------------------------------------|
| `tipos_investimento`       | `investimentos.tipo_investimento_id`                 |
| `instituicoes_financeiras` | `investimentos.instituicao_id`                       |

---

## 4. Inconsistências do Legado

### P1 — Campos Redundantes

| Tabela         | Campos Duplicados                                                      | Diagnóstico                                      |
|----------------|------------------------------------------------------------------------|--------------------------------------------------|
| `usuarios`     | `telefone_whatsapp` + `whatsapp`                                       | Mesmo dado, dois nomes diferentes                |
| `investimentos`| `taxa_anual` + `taxa_ano`                                              | Duplicação de campo de taxa                      |
| `investimentos`| `valor_aplicado` + `valor_inicial`                                     | Semântica diferente? Código trata como o mesmo   |
| `investimentos`| `created_at` + `criado_em`                                             | Dois timestamps de criação em português e inglês |

**Impacto**: Risco de inconsistência entre os campos duplicados; código precisa saber qual usar.

---

### P2 — Ausência de Constraints de Integridade

| Tabela              | Campo           | Problema                                              |
|---------------------|-----------------|-------------------------------------------------------|
| `contas_pagar`      | `status`        | VARCHAR livre; aceita qualquer string                 |
| `contas_receber`    | `status`        | VARCHAR livre; aceita qualquer string                 |
| `movimentacoes_caixa` | `tipo`        | VARCHAR livre; aceita qualquer string                 |
| `metas`             | `status`        | VARCHAR livre; aceita qualquer string                 |
| Todas entidades     | FKs             | Sem `FOREIGN KEY` declarada; sem cascata automática   |

**Impacto**: Banco não rejeita dados inválidos; inconsistências detectadas apenas em runtime.

---

### P3 — Status como String Livre

Valores de status válidos existem apenas na lógica da aplicação, sem validação no banco:

| Tabela              | Campo    | Valores esperados (inferidos do código)                             |
|---------------------|----------|---------------------------------------------------------------------|
| `assinantes`        | `status` | `pendente`, `ativo`, `inadimplente`, `cancelado`                    |
| `contas_pagar`      | `status` | `pendente`, `provisionado`, `agendado`, `atrasado`, `pago`, `cancelado` |
| `contas_receber`    | `status` | `pendente`, `provisionado`, `agendado`, `atrasado`, `recebido`, `cancelado` |
| `metas`             | `status` | `ativa`, `concluida`, `cancelada`                                   |
| `investimentos`     | `status` | `ativo`, `encerrado`                                                |

> ⚠️ O código PHP **calcula** status de `contas_pagar` dinamicamente com base em `data_vencimento` e
> `data_pagamento`, tornando o campo `status` não-confiável como fonte de verdade.

---

### P4 — Tipos de Dados Problemáticos

| Tabela           | Campo           | Tipo MySQL       | Problema                                                 |
|------------------|-----------------|------------------|----------------------------------------------------------|
| `investimentos`  | `taxa_anual`    | DECIMAL(7,4)     | Ambíguo: % (0–100) ou fator (0–1)?                       |
| `contas_pagar`   | `multa_percent` | DECIMAL(6,2)     | Ambíguo: % (0–100) ou fator (0–1)?                       |
| `contas_pagar`   | `juros_percent` | DECIMAL(6,2)     | Idem                                                     |
| `contas`         | `saldo_inicial` | DECIMAL(10,2)    | Deveria ser calculado; armazenar causa inconsistência    |
| Timestamps       | `created_at`    | DATETIME         | Sem timezone; risco de bug com mudança de fuso horário   |

---

### P5 — Índices Faltando

| Tabela           | Query comum                                    | Índice ausente                              |
|------------------|------------------------------------------------|---------------------------------------------|
| `contas_pagar`   | Filtro por `usuario_id + status`               | `INDEX (usuario_id, status)` — só tem `(status)` |
| `contas_receber` | Listagem com ordering por `data_vencimento`    | Covering index para colunas de listagem      |
| `investimentos`  | Filtro por `usuario_id + tipo_investimento_id` | `INDEX (usuario_id, tipo_investimento_id)`   |
| `metas_movimentos` | Agregação por `meta_id`                      | `INDEX (meta_id)` isolado para COUNT/SUM     |

---

### P6 — Problemas de Nulidade

| Tabela           | Campo        | Situação                         | Risco                                           |
|------------------|--------------|----------------------------------|-------------------------------------------------|
| `assinantes`     | `usuario_id` | NULLABLE                         | Assinante sem usuário → registro órfão          |
| `investimentos`  | `instituicao_id` | NULLABLE                     | OK (genérico), mas sem padrão de preenchimento  |
| `movimentacoes_caixa` | `id_origem` | NULLABLE sem validação      | origem='ajuste' → id_origem deveria ser NULL    |
| `whatsapp_logs`  | `usuario_id` | NULLABLE                         | OK (mensagens anônimas), mas sem índice parcial |

---

### P7 — MySQL ENUMs Problemáticos

| Tabela   | Campo                  | Tipo MySQL ENUM                                          |
|----------|------------------------|----------------------------------------------------------|
| `anexos` | `tipo`                 | ENUM('comprovante','extrato','fatura','documento','outro')|
| `anexos` | `processamento_status` | ENUM('pendente','processando','concluido','erro')         |

**Problema**: ENUMs MySQL têm custo alto para adicionar valores (ALTER TABLE bloqueia a tabela).
No Postgres, o padrão recomendado é `VARCHAR + CHECK constraint`, mais flexível e seguro para migrações.

---

### P8 — Chaves Estrangeiras Implícitas (Polimorfismo sem FK)

A coluna `movimentacoes_caixa.id_origem` + `origem` implementa uma FK polimórfica **sem declaração formal**:

| `origem` (valor)  | `id_origem` aponta para  |
|-------------------|--------------------------|
| `'conta_pagar'`   | `contas_pagar.id`        |
| `'conta_receber'` | `contas_receber.id`      |
| `'investimento'`  | `investimentos.id`       |
| `'ajuste'`        | `NULL` (sem origem)      |

**Impacto**: Banco não garante integridade; registros em `contas_pagar` podem ser deletados
sem que `movimentacoes_caixa` seja atualizado.

---

### P9 — Ausência de Soft Delete

Nenhuma tabela do legado usa `deleted_at`. Deleções são físicas (hard delete):

| Risco                   | Detalhe                                                     |
|-------------------------|-------------------------------------------------------------|
| Perda irreversível de dados | Não há como recuperar um registro deletado por engano   |
| Auditoria impossível    | Não é possível saber o que existia antes da deleção         |
| Violação potencial LGPD | Dados financeiros devem ter rastreabilidade                 |

---

### P10 — Ausência de Audit Trail

Nenhuma tabela de histórico de alterações:

| Campo presente | O que falta                                                    |
|----------------|----------------------------------------------------------------|
| `updated_at`   | Registra **quando** foi alterado, mas não **o quê** nem **quem** |
| —              | Sem tabela de auditoria (`_audit` / event sourcing)            |
| —              | Sem coluna `updated_by` para rastrear o responsável            |

**Impacto**: Impossível responder "quem alterou o valor desta conta a pagar?" ou "qual era o status anterior?".

---

## Critérios de Aceite Verificados

| ID   | Critério                                                     | Status |
|------|--------------------------------------------------------------|--------|
| AC1  | 24 tabelas mapeadas + classificadas em 9 domínios            | ✅     |
| AC2  | Cada tabela tem PK, FKs (explícitas + inferidas), índices, tipos | ✅ |
| AC3  | Relacionamentos críticos validados no código PHP             | ✅     |
| AC4  | 10 inconsistências do legado listadas objetivamente (P1–P10) | ✅     |

---

## Próximos Passos

| Tarefa | Descrição                                          |
|--------|----------------------------------------------------|
| 02.1   | ERD novo em Postgres (diagramado)                  |
| 02.1.1 | Schema definitivo (sem redundâncias)               |
| 02.1.2 | Constraints + enums modernizados                   |
| 02.1.3 | Índices otimizados para queries reais              |
| 02.2   | Migrations Postgres                                |
| 02.3   | ETL MySQL → Postgres                               |

---

*Documento gerado em: 2026-03-02 | Task: 02.0 — Levantamento de Esquema Legado (MySQL → Postgres)*
