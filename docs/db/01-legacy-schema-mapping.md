# Inventário de Tabelas — Schema Legado MySQL (`finlly_go.sql`)

> **Fonte:** dump `finlly_go.sql`
> **Data:** 2026-03-02
> **Propósito:** Inventariar completamente o esquema MySQL legado por domínio como base para o redesenho em Postgres v2.

---

## Sumário de Domínios

| Domínio                        | Tabelas                                                                                    | Qtd |
|-------------------------------|--------------------------------------------------------------------------------------------|-----|
| Autenticação e Usuários        | `usuarios`                                                                                 | 1   |
| Billing e Assinaturas          | `assinantes`, `assinantes_pagamentos`                                                      | 2   |
| Financeiro — Estrutura Base    | `contas`, `categorias`                                                                     | 2   |
| Financeiro — Contas a Pagar    | `contas_pagar`                                                                             | 1   |
| Financeiro — Contas a Receber  | `contas_receber`                                                                           | 1   |
| Financeiro — Movimentações     | `movimentacoes_caixa`                                                                      | 1   |
| Investimentos                  | `tipos_investimento`, `investimentos`, `investimentos_eventos`, `instituicoes_financeiras` | 4   |
| Metas                          | `metas`, `metas_movimentos`                                                                | 2   |
| Anexos                         | `anexos`, `anexos_vinculos`                                                                | 2   |
| Cupons                         | `cupons`                                                                                   | 1   |
| WhatsApp / Logs                | `whatsapp_logs`, `webhook_events`, `jobs`                                                  | 3   |
| **Total**                      |                                                                                            | **21** |

---

## Domínio: Autenticação e Usuários

### Tabela `usuarios`

- **Finalidade:** Armazenar dados de login e perfil de usuários.

| Coluna              | Tipo             | Nullable | Default                | Observações                            |
|---------------------|------------------|----------|------------------------|----------------------------------------|
| `id`                | INT              | NOT NULL | AUTO_INCREMENT         | PK                                     |
| `nome`              | VARCHAR(150)     | NOT NULL | —                      |                                        |
| `email`             | VARCHAR(190)     | NOT NULL | —                      | UNIQUE                                 |
| `telefone_whatsapp` | VARCHAR(20)      | NULL     | NULL                   | Campo duplicado com `whatsapp`         |
| `whatsapp`          | VARCHAR(20)      | NULL     | NULL                   | Campo duplicado com `telefone_whatsapp`|
| `senha_hash`        | VARCHAR(255)     | NOT NULL | —                      |                                        |
| `timezone`          | VARCHAR(50)      | NOT NULL | `'America/Sao_Paulo'`  |                                        |
| `moeda`             | VARCHAR(10)      | NOT NULL | `'BRL'`                |                                        |
| `ativo`             | TINYINT(1)       | NOT NULL | `1`                    |                                        |
| `criado_em`         | DATETIME         | NOT NULL | `CURRENT_TIMESTAMP`    |                                        |
| `atualizado_em`     | DATETIME         | NOT NULL | ON UPDATE CURRENT_TIMESTAMP |                                   |
| `ultimo_login_em`   | DATETIME         | NULL     | NULL                   |                                        |

- **PK:** `id`
- **FKs:** nenhuma
- **Índices:** `UNIQUE KEY email (email)`
- **Volume esperado:** Baixo (< 10k)
- **Operações principais:** CREATE, UPDATE, SELECT por email, SELECT por id

---

## Domínio: Billing e Assinaturas

### Tabela `assinantes`

- **Finalidade:** Registrar assinantes (usuários que pagam).

| Coluna                    | Tipo                                              | Nullable | Default        |
|---------------------------|---------------------------------------------------|----------|----------------|
| `id`                      | INT UNSIGNED                                      | NOT NULL | AUTO_INCREMENT |
| `usuario_id`              | INT UNSIGNED                                      | NULL     | NULL           |
| `nome`                    | VARCHAR(150)                                      | NOT NULL | —              |
| `email`                   | VARCHAR(150)                                      | NOT NULL | —              |
| `cpf`                     | VARCHAR(14)                                       | NULL     | NULL           |
| `cpf_cnpj`                | VARCHAR(20)                                       | NOT NULL | —              |
| `telefone`                | VARCHAR(20)                                       | NULL     | NULL           |
| `plano`                   | ENUM('mensal', 'anual')                           | NOT NULL | —              |
| `valor`                   | DECIMAL(10,2)                                     | NOT NULL | —              |
| `asaas_customer_id`       | VARCHAR(50)                                       | NOT NULL | —              |
| `asaas_subscription_id`   | VARCHAR(50)                                       | NOT NULL | —              |
| `ultimo_status_asaas`     | VARCHAR(30)                                       | NULL     | NULL           |
| `status`                  | ENUM('pendente','ativo','inadimplente','cancelado')| NOT NULL | `'pendente'`   |
| `billing_grace_days`      | INT UNSIGNED                                      | NOT NULL | `3`            |
| `bloqueado_em`            | DATETIME                                          | NULL     | NULL           |
| `data_ultimo_pagamento`   | DATE                                              | NULL     | NULL           |
| `data_proximo_vencimento` | DATE                                              | NULL     | NULL           |
| `criado_em`               | DATETIME                                          | NOT NULL | `CURRENT_TIMESTAMP` |
| `atualizado_em`           | DATETIME                                          | NOT NULL | ON UPDATE CURRENT_TIMESTAMP |
| `ultimo_webhook_em`       | DATETIME                                          | NULL     | NULL           |

- **PK:** `id`
- **FKs:** `usuario_id` → `usuarios.id`
- **Índices:** `UNIQUE (email, plano)`, `KEY (asaas_customer_id)`, `KEY (asaas_subscription_id)`, `KEY (usuario_id)`
- **Volume esperado:** Baixo (< 1k)
- **Operações principais:** CREATE, UPDATE por webhook, SELECT por usuario_id/email

---

### Tabela `assinantes_pagamentos`

- **Finalidade:** Histórico de cobranças/pagamentos de assinatura.

| Coluna              | Tipo          | Nullable | Default             |
|---------------------|---------------|----------|---------------------|
| `id`                | INT UNSIGNED  | NOT NULL | AUTO_INCREMENT      |
| `assinante_id`      | INT UNSIGNED  | NOT NULL | —                   |
| `asaas_payment_id`  | VARCHAR(50)   | NOT NULL | —                   |
| `status`            | VARCHAR(30)   | NOT NULL | —                   |
| `valor`             | DECIMAL(10,2) | NOT NULL | `0.00`              |
| `due_date`          | DATE          | NULL     | NULL                |
| `payment_date`      | DATE          | NULL     | NULL                |
| `invoice_url`       | VARCHAR(255)  | NULL     | NULL                |
| `raw_payload`       | LONGTEXT      | NULL     | NULL                |
| `criado_em`         | DATETIME      | NOT NULL | `CURRENT_TIMESTAMP` |
| `atualizado_em`     | DATETIME      | NULL     | ON UPDATE CURRENT_TIMESTAMP |

- **PK:** `id`
- **FKs:** `assinante_id` → `assinantes.id` (ON DELETE CASCADE)
- **Índices:** `UNIQUE (asaas_payment_id)`, `KEY (assinante_id)`
- **Volume esperado:** Baixo (< 10k)
- **Operações principais:** INSERT (webhook), SELECT (relatório)

---

## Domínio: Financeiro — Estrutura Base

### Tabela `contas`

- **Finalidade:** Contas bancárias/carteiras do usuário.

| Coluna          | Tipo                                                    | Nullable | Default             |
|-----------------|---------------------------------------------------------|----------|---------------------|
| `id`            | INT UNSIGNED                                            | NOT NULL | AUTO_INCREMENT      |
| `usuario_id`    | INT UNSIGNED                                            | NOT NULL | —                   |
| `nome`          | VARCHAR(100)                                            | NOT NULL | —                   |
| `tipo`          | ENUM('corrente','poupanca','carteira','corretora','outro')| NOT NULL | `'corrente'`       |
| `banco_nome`    | VARCHAR(100)                                            | NULL     | NULL                |
| `banco_codigo`  | VARCHAR(20)                                             | NULL     | NULL                |
| `saldo_inicial` | DECIMAL(15,2)                                           | NOT NULL | `0.00`              |
| `ativo`         | TINYINT(1)                                              | NOT NULL | `1`                 |
| `criado_em`     | DATETIME                                                | NOT NULL | `CURRENT_TIMESTAMP` |
| `atualizado_em` | DATETIME                                                | NULL     | ON UPDATE CURRENT_TIMESTAMP |

- **PK:** `id`
- **FKs:** `usuario_id` → `usuarios.id` (ON DELETE CASCADE)
- **Índices:** `KEY (usuario_id)`
- **Volume esperado:** Baixo (~ 5 por usuário)
- **Operações principais:** CREATE, UPDATE, LIST by usuario_id

---

### Tabela `categorias`

- **Finalidade:** Categorias/subcategorias para classificar transações.

| Coluna          | Tipo                           | Nullable | Default             |
|-----------------|--------------------------------|----------|---------------------|
| `id`            | INT UNSIGNED                   | NOT NULL | AUTO_INCREMENT      |
| `usuario_id`    | INT UNSIGNED                   | NOT NULL | —                   |
| `tipo`          | ENUM('receita','despesa',...)  | NOT NULL | —                   |
| `nome`          | VARCHAR(100)                   | NOT NULL | —                   |
| `cor`           | VARCHAR(20)                    | NULL     | NULL                |
| `icone`         | VARCHAR(50)                    | NULL     | NULL                |
| `parent_id`     | INT UNSIGNED                   | NULL     | NULL                |
| `natureza`      | ENUM('fixa','variavel')        | NULL     | NULL                |
| `criado_em`     | DATETIME                       | NOT NULL | `CURRENT_TIMESTAMP` |
| `atualizado_em` | DATETIME                       | NULL     | ON UPDATE CURRENT_TIMESTAMP |

- **PK:** `id`
- **FKs:** `usuario_id` → `usuarios.id` (ON DELETE CASCADE), `parent_id` → `categorias.id` (self-reference)
- **Índices:** `UNIQUE (usuario_id, tipo, nome)`, `KEY (usuario_id, tipo, parent_id)`, `KEY (parent_id)`
- **Volume esperado:** Baixo (~ 20 por usuário)
- **Operações principais:** CREATE, UPDATE, DELETE (com validação de uso), LIST

---

## Domínio: Financeiro — Contas a Pagar

### Tabela `contas_pagar`

- **Finalidade:** Despesas a pagar (boletos, aluguel, etc.).

| Coluna                  | Tipo                                                          | Nullable | Default             |
|-------------------------|---------------------------------------------------------------|----------|---------------------|
| `id`                    | INT UNSIGNED                                                  | NOT NULL | AUTO_INCREMENT      |
| `usuario_id`            | INT UNSIGNED                                                  | NOT NULL | —                   |
| `conta_id`              | INT UNSIGNED                                                  | NULL     | NULL                |
| `categoria_id`          | INT UNSIGNED                                                  | NULL     | NULL                |
| `subcategoria_id`       | INT UNSIGNED                                                  | NULL     | NULL                |
| `descricao`             | VARCHAR(255)                                                  | NOT NULL | —                   |
| `valor`                 | DECIMAL(15,2)                                                 | NOT NULL | —                   |
| `multa_percent`         | DECIMAL(6,2)                                                  | NULL     | NULL                |
| `multa_valor_fixo`      | DECIMAL(15,2)                                                 | NOT NULL | `0.00`              |
| `juros_percent_mes`     | DECIMAL(5,2)                                                  | NOT NULL | `0.00`              |
| `valor_pago`            | DECIMAL(15,2)                                                 | NULL     | NULL                |
| `debito_automatico`     | TINYINT(1)                                                    | NOT NULL | `0`                 |
| `confirmado_pagamento`  | TINYINT(1)                                                    | NOT NULL | `1`                 |
| `juros_mensal_percent`  | DECIMAL(6,2)                                                  | NULL     | NULL                |
| `data_vencimento`       | DATE                                                          | NOT NULL | —                   |
| `data_pagamento`        | DATE                                                          | NULL     | NULL                |
| `pagamento_confirmado`  | TINYINT(1)                                                    | NOT NULL | `0`                 |
| `status`                | ENUM('pendente','provisionado','agendado','atrasado','pago','cancelado') | NOT NULL | `'pendente'` |
| `tipo_despesa`          | ENUM('fixa','variavel')                                       | NOT NULL | `'variavel'`        |
| `parcelado`             | TINYINT(1)                                                    | NOT NULL | `0`                 |
| `parcelas_total`        | INT                                                           | NOT NULL | `1`                 |
| `parcela_num`           | INT                                                           | NOT NULL | `1`                 |
| `grupo_parcelamento`    | CHAR(36)                                                      | NULL     | NULL                |
| `grupo_parcela`         | CHAR(36)                                                      | NULL     | NULL                |
| `recorrencia_tipo`      | ENUM('nenhuma','semanal','mensal','anual')                    | NOT NULL | `'nenhuma'`         |
| `recorrencia_intervalo` | INT                                                           | NOT NULL | `1`                 |
| `recorrencia_ate`       | DATE                                                          | NULL     | NULL                |
| `observacoes`           | TEXT                                                          | NULL     | NULL                |
| `criado_em`             | DATETIME                                                      | NOT NULL | `CURRENT_TIMESTAMP` |
| `atualizado_em`         | DATETIME                                                      | NULL     | ON UPDATE CURRENT_TIMESTAMP |

- **PK:** `id`
- **FKs:** `usuario_id` → `usuarios.id` (CASCADE), `conta_id` → `contas.id` (SET NULL), `categoria_id` → `categorias.id` (SET NULL)
- **Índices:** `KEY (usuario_id, data_vencimento)`, `KEY (status)`, `KEY (usuario_id, status)`, `KEY (usuario_id, categoria_id, subcategoria_id)`, `KEY (usuario_id, grupo_parcela)`, `KEY (data_vencimento, status)`
- **Volume esperado:** Médio (~ 100–500 por usuário/ano)
- **Operações principais:** CREATE (parcelado), UPDATE, DELETE lógico, LIST+FILTER (por status, data, categoria), BULK UPDATE (status automático)

---

## Domínio: Financeiro — Contas a Receber

### Tabela `contas_receber`

- **Finalidade:** Receitas esperadas (vendas, freelances, etc.).

| Coluna                  | Tipo                                      | Nullable | Default             |
|-------------------------|-------------------------------------------|----------|---------------------|
| `id`                    | INT UNSIGNED                              | NOT NULL | AUTO_INCREMENT      |
| `usuario_id`            | INT UNSIGNED                              | NOT NULL | —                   |
| `conta_id`              | INT UNSIGNED                              | NULL     | NULL                |
| `categoria_id`          | INT UNSIGNED                              | NULL     | NULL                |
| `origem`                | VARCHAR(150)                              | NULL     | NULL                |
| `descricao`             | VARCHAR(255)                              | NOT NULL | —                   |
| `valor`                 | DECIMAL(15,2)                             | NOT NULL | —                   |
| `data_vencimento`       | DATE                                      | NOT NULL | —                   |
| `data_prevista`         | DATE                                      | NOT NULL | —                   |
| `data_recebimento`      | DATE                                      | NULL     | NULL                |
| `status`                | ENUM('previsto','recebido','cancelado')   | NOT NULL | `'previsto'`        |
| `recorrencia_tipo`      | ENUM('nenhuma','semanal','mensal','anual')| NOT NULL | `'nenhuma'`         |
| `recorrencia_intervalo` | INT                                       | NOT NULL | `1`                 |
| `observacoes`           | TEXT                                      | NULL     | NULL                |
| `criado_em`             | DATETIME                                  | NOT NULL | `CURRENT_TIMESTAMP` |
| `atualizado_em`         | DATETIME                                  | NULL     | ON UPDATE CURRENT_TIMESTAMP |

- **PK:** `id`
- **FKs:** `usuario_id` → `usuarios.id` (CASCADE), `conta_id` → `contas.id` (SET NULL), `categoria_id` → `categorias.id` (SET NULL)
- **Índices:** `KEY (usuario_id, data_prevista)`, `KEY (status)`, `KEY (usuario_id, data_prevista)`
- **Volume esperado:** Baixo–Médio (~ 50–200 por usuário/ano)
- **Operações principais:** CREATE, UPDATE, SELECT, MARK recebido

---

## Domínio: Financeiro — Movimentações

### Tabela `movimentacoes_caixa`

- **Finalidade:** Auditoria de fluxo de caixa (entrada/saída de dinheiro).

| Coluna           | Tipo                                                         | Nullable | Default             |
|------------------|--------------------------------------------------------------|----------|---------------------|
| `id`             | INT UNSIGNED                                                 | NOT NULL | AUTO_INCREMENT      |
| `usuario_id`     | INT UNSIGNED                                                 | NOT NULL | —                   |
| `conta_id`       | INT UNSIGNED                                                 | NOT NULL | —                   |
| `tipo`           | ENUM('entrada','saida','transferencia')                      | NOT NULL | —                   |
| `origem`         | ENUM('conta_pagar','conta_receber','ajuste','investimento')  | NOT NULL | `'ajuste'`          |
| `id_origem`      | INT UNSIGNED                                                 | NULL     | NULL                |
| `descricao`      | VARCHAR(255)                                                 | NOT NULL | —                   |
| `valor`          | DECIMAL(15,2)                                                | NOT NULL | —                   |
| `data_movimento` | DATE                                                         | NOT NULL | —                   |
| `criado_em`      | DATETIME                                                     | NOT NULL | `CURRENT_TIMESTAMP` |

- **PK:** `id`
- **FKs:** `usuario_id` → `usuarios.id` (CASCADE), `conta_id` → `contas.id` (CASCADE)
- **Índices:** `KEY (usuario_id, data_movimento)`, `KEY (conta_id)`
- **Volume esperado:** Alto (~ 1–2 por transação)
- **Operações principais:** INSERT (log), SELECT (relatório), nunca DELETE/UPDATE
- **Observação:** `id_origem` + `origem` formam uma FK polimórfica sem constraint real no banco.

---

## Domínio: Investimentos

### Tabela `tipos_investimento`

- **Finalidade:** Catálogo de tipos de investimento (CDB, ações, fundo, etc.).

| Coluna             | Tipo                                                    | Nullable | Default             |
|--------------------|---------------------------------------------------------|----------|---------------------|
| `id`               | INT UNSIGNED                                            | NOT NULL | AUTO_INCREMENT      |
| `nome`             | VARCHAR(100)                                            | NOT NULL | —                   |
| `classe`           | ENUM('renda_fixa','fundo','acao','outro')               | NOT NULL | `'renda_fixa'`      |
| `modelo_calculo`   | ENUM('PREFIXADO','CDI_PERCENTUAL','IPCA_MAIS_TAXA','POUPANCA','MANUAL') | NOT NULL | `'MANUAL'` |
| `descricao`        | TEXT                                                    | NULL     | NULL                |
| `criado_em`        | DATETIME                                                | NOT NULL | `CURRENT_TIMESTAMP` |
| `atualizado_em`    | DATETIME                                                | NULL     | ON UPDATE CURRENT_TIMESTAMP |

- **PK:** `id`
- **FKs:** nenhuma
- **Índices:** nenhum
- **Volume esperado:** Muito Baixo (< 50)
- **Operações principais:** SELECT, occasional CREATE/UPDATE

---

### Tabela `investimentos`

- **Finalidade:** Registrar alocações de investimento do usuário.

| Coluna                  | Tipo                                        | Nullable | Default             |
|-------------------------|---------------------------------------------|----------|---------------------|
| `id`                    | INT UNSIGNED                                | NOT NULL | AUTO_INCREMENT      |
| `usuario_id`            | INT UNSIGNED                                | NOT NULL | —                   |
| `instituicao_id`        | INT UNSIGNED                                | NULL     | NULL                |
| `conta_id`              | INT UNSIGNED                                | NULL     | NULL                |
| `tipo_investimento`     | VARCHAR(100)                                | NOT NULL | —                   |
| `produto`               | VARCHAR(150)                                | NULL     | NULL                |
| `tipo_investimento_id`  | INT UNSIGNED                                | NOT NULL | —                   |
| `nome_produto`          | VARCHAR(150)                                | NOT NULL | —                   |
| `data_aplicacao`        | DATE                                        | NOT NULL | —                   |
| `data_vencimento`       | DATE                                        | NULL     | NULL                |
| `valor_aplicado`        | DECIMAL(15,2)                               | NOT NULL | —                   |
| `taxa_anual`            | DECIMAL(7,4)                                | NULL     | NULL                |
| `modelo_rentabilidade`  | VARCHAR(50)                                 | NULL     | NULL                |
| `valor_inicial`         | DECIMAL(15,2)                               | NOT NULL | `0.00`              |
| `taxa_ano`              | DECIMAL(9,6)                                | NULL     | NULL                |
| `percentual_cdi`        | DECIMAL(7,4)                                | NULL     | NULL                |
| `taxa_real_ano`         | DECIMAL(9,6)                                | NULL     | NULL                |
| `indice_referencia`     | ENUM('CDI','IPCA','SELIC','OUTRO')          | NULL     | NULL                |
| `situacao`              | ENUM('ativo','resgatado','vencido','cancelado') | NOT NULL | `'ativo'`        |
| `observacoes`           | TEXT                                        | NULL     | NULL                |
| `created_at`            | DATETIME                                    | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at`            | DATETIME                                    | NULL     | ON UPDATE CURRENT_TIMESTAMP |
| `criado_em`             | DATETIME                                    | NOT NULL | `CURRENT_TIMESTAMP` |
| `atualizado_em`         | DATETIME                                    | NULL     | ON UPDATE CURRENT_TIMESTAMP |

- **PK:** `id`
- **FKs:** `usuario_id` → `usuarios.id` (CASCADE), `instituicao_id` → `instituicoes_financeiras.id` (SET NULL), `conta_id` → `contas.id` (SET NULL), `tipo_investimento_id` → `tipos_investimento.id`
- **Índices:** `KEY (usuario_id)`, `KEY (instituicao_id)`, `KEY (conta_id)`, `KEY (tipo_investimento_id)`, `KEY (situacao)`
- **Volume esperado:** Baixo (~ 10 por usuário)
- **Operações principais:** CREATE, UPDATE, SELECT, FILTER por situacao
- **Observação:** Quatro campos de timestamp duplicados (`created_at`/`criado_em`, `updated_at`/`atualizado_em`).

---

### Tabela `investimentos_eventos`

- **Finalidade:** Log de eventos (aportes, resgates, ajustes) de um investimento.

| Coluna           | Tipo                                          | Nullable | Default             |
|------------------|-----------------------------------------------|----------|---------------------|
| `id`             | INT UNSIGNED                                  | NOT NULL | AUTO_INCREMENT      |
| `investimento_id`| INT UNSIGNED                                  | NOT NULL | —                   |
| `data_evento`    | DATE                                          | NOT NULL | —                   |
| `tipo_evento`    | ENUM('APLICACAO','APORTE','RESGATE','AJUSTE') | NOT NULL | —                   |
| `valor`          | DECIMAL(15,2)                                 | NOT NULL | —                   |
| `observacoes`    | TEXT                                          | NULL     | NULL                |
| `criado_em`      | DATETIME                                      | NOT NULL | `CURRENT_TIMESTAMP` |

- **PK:** `id`
- **FKs:** `investimento_id` → `investimentos.id` (ON DELETE CASCADE)
- **Índices:** `KEY (investimento_id)`, `KEY (data_evento)`
- **Volume esperado:** Baixo (~ 5–20 por investimento)
- **Operações principais:** CREATE (log), SELECT (histórico)

---

### Tabela `instituicoes_financeiras`

- **Finalidade:** Catálogo de bancos/corretoras.

| Coluna          | Tipo                                    | Nullable | Default             |
|-----------------|-----------------------------------------|----------|---------------------|
| `id`            | INT UNSIGNED                            | NOT NULL | AUTO_INCREMENT      |
| `nome`          | VARCHAR(150)                            | NOT NULL | —                   |
| `tipo`          | ENUM('banco','corretora','fintech','outro') | NOT NULL | `'banco'`        |
| `codigo`        | VARCHAR(20)                             | NULL     | NULL                |
| `cnpj`          | VARCHAR(20)                             | NULL     | NULL                |
| `site`          | VARCHAR(200)                            | NULL     | NULL                |
| `criado_em`     | DATETIME                                | NOT NULL | `CURRENT_TIMESTAMP` |
| `atualizado_em` | DATETIME                                | NULL     | ON UPDATE CURRENT_TIMESTAMP |

- **PK:** `id`
- **FKs:** nenhuma
- **Índices:** nenhum
- **Volume esperado:** Muito Baixo (< 100)
- **Operações principais:** SELECT, occasional INSERT

---

## Domínio: Metas

### Tabela `metas`

- **Finalidade:** Metas financeiras do usuário (comprar casa, poupança, etc.).

| Coluna          | Tipo                                        | Nullable | Default             |
|-----------------|---------------------------------------------|----------|---------------------|
| `id`            | INT                                         | NOT NULL | AUTO_INCREMENT      |
| `usuario_id`    | INT UNSIGNED                                | NOT NULL | —                   |
| `titulo`        | VARCHAR(120)                                | NOT NULL | —                   |
| `descricao`     | VARCHAR(255)                                | NULL     | NULL                |
| `valor_alvo`    | DECIMAL(12,2)                               | NOT NULL | —                   |
| `valor_atual`   | DECIMAL(12,2)                               | NOT NULL | `0.00`              |
| `data_alvo`     | DATE                                        | NULL     | NULL                |
| `prioridade`    | ENUM('baixa','media','alta')                | NOT NULL | `'media'`           |
| `status`        | ENUM('ativa','pausada','concluida','cancelada') | NOT NULL | `'ativa'`        |
| `created_at`    | DATETIME                                    | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at`    | DATETIME                                    | NULL     | ON UPDATE CURRENT_TIMESTAMP |
| `criado_em`     | DATETIME                                    | NULL     | NULL                |
| `atualizado_em` | DATETIME                                    | NULL     | NULL                |
| `conta_id`      | INT                                         | NULL     | NULL                |

- **PK:** `id`
- **FKs:** `usuario_id` → `usuarios.id` (CASCADE), `conta_id` → `contas.id` (SET NULL)
- **Índices:** `KEY (usuario_id, status)`, `KEY (usuario_id, created_at)`
- **Volume esperado:** Muito Baixo (~ 5 por usuário)
- **Operações principais:** CREATE, UPDATE, SELECT
- **Observação:** Campos duplicados: `created_at`/`criado_em` e `updated_at`/`atualizado_em`.

---

### Tabela `metas_movimentos`

- **Finalidade:** Histórico de aportes/saques/ajustes de uma meta.

| Coluna          | Tipo                              | Nullable | Default             |
|-----------------|-----------------------------------|----------|---------------------|
| `id`            | INT                               | NOT NULL | AUTO_INCREMENT      |
| `meta_id`       | INT                               | NOT NULL | —                   |
| `usuario_id`    | INT UNSIGNED                      | NOT NULL | —                   |
| `tipo`          | ENUM('aporte','saque','ajuste')   | NOT NULL | —                   |
| `valor`         | DECIMAL(12,2)                     | NOT NULL | —                   |
| `data_mov`      | DATE                              | NOT NULL | —                   |
| `observacoes`   | VARCHAR(255)                      | NULL     | NULL                |
| `created_at`    | DATETIME                          | NOT NULL | `CURRENT_TIMESTAMP` |
| `data_movimento`| DATE                              | NULL     | NULL                |

- **PK:** `id`
- **FKs:** `meta_id` → `metas.id` (ON DELETE CASCADE), `usuario_id` → `usuarios.id` (CASCADE)
- **Índices:** `KEY (meta_id, data_mov)`, `KEY (usuario_id, data_mov)`
- **Volume esperado:** Baixo (~ 10–50 por meta)
- **Operações principais:** CREATE (log), SELECT (histórico)
- **Observação:** `data_mov` e `data_movimento` são campos duplicados.

---

## Domínio: Anexos

### Tabela `anexos`

- **Finalidade:** Armazenar metadados de arquivos (comprovantes, extratos, áudio, etc.) e resultado de processamento (OCR, IA).

| Coluna                  | Tipo                                                    | Nullable | Default             |
|-------------------------|---------------------------------------------------------|----------|---------------------|
| `id`                    | INT                                                     | NOT NULL | AUTO_INCREMENT      |
| `usuario_id`            | INT UNSIGNED                                            | NOT NULL | —                   |
| `tipo`                  | ENUM('comprovante','extrato','fatura','documento','outro') | NOT NULL | `'comprovante'`   |
| `descricao`             | VARCHAR(180)                                            | NULL     | NULL                |
| `original_nome`         | VARCHAR(255)                                            | NOT NULL | —                   |
| `mime`                  | VARCHAR(120)                                            | NOT NULL | —                   |
| `tamanho`               | INT UNSIGNED                                            | NOT NULL | —                   |
| `hash_sha256`           | CHAR(64)                                                | NOT NULL | —                   |
| `storage_path`          | VARCHAR(300)                                            | NOT NULL | —                   |
| `created_at`            | DATETIME                                                | NOT NULL | `CURRENT_TIMESTAMP` |
| `processamento_status`  | ENUM('pendente','processando','concluido','erro')       | NOT NULL | `'pendente'`        |
| `processamento_model`   | VARCHAR(60)                                             | NULL     | NULL                |
| `processamento_tokens`  | INT                                                     | NULL     | NULL                |
| `processamento_em`      | DATETIME                                                | NULL     | NULL                |
| `processamento_erro`    | VARCHAR(1000)                                           | NULL     | NULL                |
| `extraido_texto`        | LONGTEXT                                                | NULL     | NULL                |
| `extraido_json`         | LONGTEXT                                                | NULL     | NULL                |

- **PK:** `id`
- **FKs:** `usuario_id` → `usuarios.id` (ON DELETE CASCADE)
- **Índices:** `KEY (usuario_id, created_at)`, `UNIQUE KEY (hash_sha256)`, `KEY (usuario_id, processamento_status)`
- **Volume esperado:** Médio (~ 50–200 por usuário/ano)
- **Operações principais:** CREATE (upload), UPDATE (processamento), SELECT, DELETE (com cascade)

---

### Tabela `anexos_vinculos`

- **Finalidade:** Vincular um anexo a uma ou mais entidades (conta_pagar, investimento, etc.) — relação polimórfica.

| Coluna        | Tipo                                                                                         | Nullable | Default             |
|---------------|----------------------------------------------------------------------------------------------|----------|---------------------|
| `id`          | INT                                                                                          | NOT NULL | AUTO_INCREMENT      |
| `anexo_id`    | INT                                                                                          | NOT NULL | —                   |
| `usuario_id`  | INT UNSIGNED                                                                                 | NOT NULL | —                   |
| `entidade`    | ENUM('conta_pagar','conta_receber','investimento','investimento_evento','movimentacao_caixa') | NOT NULL | —                  |
| `entidade_id` | INT                                                                                          | NOT NULL | —                   |
| `created_at`  | DATETIME                                                                                     | NOT NULL | `CURRENT_TIMESTAMP` |

- **PK:** `id`
- **FKs:** `anexo_id` → `anexos.id` (ON DELETE CASCADE), `usuario_id` → `usuarios.id` (ON DELETE CASCADE)
- **Índices:** `UNIQUE (anexo_id, entidade, entidade_id)`, `KEY (usuario_id, entidade, entidade_id)`
- **Volume esperado:** Baixo (~ 1–3 por anexo)
- **Operações principais:** CREATE, DELETE, SELECT
- **Observação:** `entidade_id` não tem FK real — vínculo validado somente na aplicação.

---

## Domínio: Cupons

### Tabela `cupons`

- **Finalidade:** Cupons/códigos de desconto (trial, % off, etc.).

| Coluna           | Tipo                            | Nullable | Default             |
|------------------|---------------------------------|----------|---------------------|
| `id`             | INT UNSIGNED                    | NOT NULL | AUTO_INCREMENT      |
| `codigo`         | VARCHAR(50)                     | NOT NULL | —                   |
| `tipo`           | ENUM('percentual','valor')      | NOT NULL | —                   |
| `valor`          | DECIMAL(10,2)                   | NOT NULL | —                   |
| `trial_dias`     | INT                             | NULL     | NULL                |
| `somente_plano`  | ENUM('mensal','anual','ambos')  | NOT NULL | `'ambos'`           |
| `ativo`          | TINYINT(1)                      | NOT NULL | `1`                 |
| `max_usos`       | INT UNSIGNED                    | NULL     | NULL                |
| `usos`           | INT UNSIGNED                    | NOT NULL | `0`                 |
| `data_expiracao` | DATE                            | NULL     | NULL                |
| `criado_em`      | DATETIME                        | NOT NULL | `CURRENT_TIMESTAMP` |
| `atualizado_em`  | DATETIME                        | NULL     | ON UPDATE CURRENT_TIMESTAMP |

- **PK:** `id`
- **FKs:** nenhuma
- **Índices:** `UNIQUE (codigo)`
- **Volume esperado:** Muito Baixo (< 100)
- **Operações principais:** SELECT, UPDATE (usos), CREATE

---

## Domínio: WhatsApp / Logs

### Tabela `whatsapp_logs`

- **Finalidade:** Log de mensagens WhatsApp (entrada/saída).

| Coluna        | Tipo                  | Nullable | Default             |
|---------------|-----------------------|----------|---------------------|
| `id`          | INT UNSIGNED          | NOT NULL | AUTO_INCREMENT      |
| `usuario_id`  | INT UNSIGNED          | NULL     | NULL                |
| `whatsapp`    | VARCHAR(30)           | NOT NULL | —                   |
| `direction`   | ENUM('in','out')      | NOT NULL | —                   |
| `mensagem`    | TEXT                  | NOT NULL | —                   |
| `raw_payload` | LONGTEXT              | NULL     | NULL                |
| `created_at`  | DATETIME              | NOT NULL | `CURRENT_TIMESTAMP` |

- **PK:** `id`
- **FKs:** `usuario_id` → `usuarios.id` (SET NULL)
- **Índices:** `KEY (whatsapp)`, `KEY (usuario_id)`
- **Volume esperado:** Alto (~ 10–50 por dia)
- **Operações principais:** INSERT (log), SELECT (chat history), DELETE (limpeza)

---

### Tabela `webhook_events`

- **Finalidade:** Deduplicação de webhooks (Asaas, Evolution).

| Coluna        | Tipo          | Nullable | Default |
|---------------|---------------|----------|---------|
| `id`          | BIGINT UNSIGNED | NOT NULL | AUTO_INCREMENT |
| `provider`    | VARCHAR(32)   | NOT NULL | —       |
| `event_id`    | VARCHAR(100)  | NOT NULL | —       |
| `payload_hash`| CHAR(64)      | NOT NULL | —       |
| `received_at` | DATETIME      | NOT NULL | —       |

- **PK:** `id`
- **FKs:** nenhuma
- **Índices:** `UNIQUE (provider, event_id)`, `KEY (received_at)`
- **Volume esperado:** Médio (~ 100–500/dia)
- **Operações principais:** INSERT, SELECT (dedup check)

---

### Tabela `jobs`

- **Finalidade:** Fila de trabalho assíncrono (processamento de anexo, IA, sync, etc.).

| Coluna              | Tipo                                            | Nullable | Default             |
|---------------------|-------------------------------------------------|----------|---------------------|
| `id`                | INT                                             | NOT NULL | AUTO_INCREMENT      |
| `tipo`              | VARCHAR(60)                                     | NOT NULL | —                   |
| `payload_json`      | LONGTEXT                                        | NOT NULL | —                   |
| `status`            | ENUM('pendente','processando','concluido','erro') | NOT NULL | `'pendente'`       |
| `prioridade`        | INT                                             | NOT NULL | `100`               |
| `disponivel_em`     | DATETIME                                        | NOT NULL | `CURRENT_TIMESTAMP` |
| `tentativas`        | INT                                             | NOT NULL | `0`                 |
| `max_tentativas`    | INT                                             | NOT NULL | `5`                 |
| `iniciado_em`       | DATETIME                                        | NULL     | NULL                |
| `concluido_em`      | DATETIME                                        | NULL     | NULL                |
| `ultimo_erro`       | VARCHAR(1000)                                   | NULL     | NULL                |
| `resultado_resumo`  | VARCHAR(500)                                    | NULL     | NULL                |
| `criado_em`         | DATETIME                                        | NOT NULL | `CURRENT_TIMESTAMP` |
| `atualizado_em`     | DATETIME                                        | NULL     | ON UPDATE CURRENT_TIMESTAMP |

- **PK:** `id`
- **FKs:** nenhuma
- **Índices:** `KEY (status, disponivel_em)`, `KEY (tipo)`
- **Volume esperado:** Alto (milhares/dia, com limpeza periódica)
- **Operações principais:** INSERT, UPDATE (status), SELECT (worker), DELETE (cleanup)

---

## Resumo de Domínios

| Domínio              | Tabelas                    | Volume Típico            | Criticidade            |
|----------------------|----------------------------|--------------------------|------------------------|
| Autenticação         | `usuarios`                 | < 10k                    | CRÍTICA                |
| Billing              | `assinantes`, `assinantes_pagamentos` | < 1k          | CRÍTICA                |
| Financeiro Base      | `contas`, `categorias`     | < 100/usuário            | ALTA                   |
| Contas a Pagar       | `contas_pagar`             | 100–500/usuário/ano      | ALTA                   |
| Contas a Receber     | `contas_receber`           | 50–200/usuário/ano       | MÉDIA                  |
| Movimentação         | `movimentacoes_caixa`      | 1–2/transação            | ALTA (auditoria)       |
| Investimentos        | `investimentos`, `investimentos_eventos`, `tipos_investimento`, `instituicoes_financeiras` | 10–50/usuário | MÉDIA |
| Metas                | `metas`, `metas_movimentos`| 5–20/usuário             | BAIXA                  |
| Anexos               | `anexos`, `anexos_vinculos`| 50–200/usuário/ano       | MÉDIA                  |
| Cupons               | `cupons`                   | < 100                    | BAIXA                  |
| WhatsApp/Logs        | `whatsapp_logs`, `webhook_events`, `jobs` | Alta (~1k+/dia) | MÉDIA            |

---

*Documento gerado em: 2026-03-02*
*Documentos relacionados: `legacy-mapping.md` (mapa de relacionamentos), `legacy-schema-mapping.md` (inconsistências do legado)*