# Mapeamento do Schema Legado Finlly (MySQL)

## 📋 Índice
1. Inventário de Tabelas por Domínio
2. Descrição Detalhada de Cada Tabela
3. Matriz de Relacionamentos
4. Lista de Inconsistências do Legado
5. Recomendações para Postgres

## 1️⃣ Inventário de Tabelas por Domínio

### 👤 Domínio: Usuários & Autenticação
- usuarios
- webhook_events
- whatsapp_logs

### 💳 Domínio: Faturamento & Assinaturas
- assinantes
- assinantes_pagamentos
- cupons

### 💰 Domínio: Financeiro
#### Contas
- contas
- movimentacoes_caixa

#### Contas a Pagar
- contas_pagar

#### Contas a Receber
- contas_receber

#### Categorias
- categorias

### 📈 Domínio: Investimentos
- investimentos
- investimentos_eventos
- tipos_investimento
- instituicoes_financeiras

### 🎯 Domínio: Metas
- metas
- metas_movimentos

### 📎 Domínio: Attachments & Processamento
- anexos
- anexos_vinculos
- jobs

## 2️⃣ Descrição Detalhada de Cada Tabela

### 👤 USUARIOS
**Finalidade:** Armazenar dados dos usuários da plataforma

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| nome | varchar(150) | NO | - | - | - | - |
| email | varchar(190) | NO | - | - | - | ✅ UNIQUE |
| telefone_whatsapp | varchar(20) | YES | NULL | - | - | - |
| whatsapp | varchar(20) | YES | NULL | - | - | - |
| senha_hash | varchar(255) | NO | - | - | - | - |
| timezone | varchar(50) | NO | 'America/Sao_Paulo' | - | - | - |
| moeda | varchar(10) | NO | 'BRL' | - | - | - |
| ativo | tinyint(1) | NO | 1 | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| atualizado_em | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |
| ultimo_login_em | datetime | YES | NULL | - | - | - |

**FKs Implícitas:** Nenhuma (é tabela root)

**Relacionamentos:** 
- 1→N com assinantes (usuario_id)
- 1→N com contas (usuario_id)
- 1→N com categorias (usuario_id)
- 1→N com contas_pagar (usuario_id)
- 1→N com contas_receber (usuario_id)
- 1→N com investimentos (usuario_id)
- 1→N com metas (usuario_id)
- 1→N com anexos (usuario_id)
- 1→N com movimentacoes_caixa (usuario_id)

**Volume Esperado:** Baixo (~100-1000 registros)

**Operações Principais:** CREATE, UPDATE, READ, DELETE

---

### 💳 ASSINANTES
**Finalidade:** Gerenciar assinaturas SaaS integradas com Asaas

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| usuario_id | int(10) UNSIGNED | YES | NULL | - | ✅ usuarios | ✅ |
| nome | varchar(150) | NO | - | - | - | - |
| email | varchar(150) | NO | - | - | - | ✅ UNIQUE (com plano) |
| cpf | varchar(14) | YES | NULL | - | - | - |
| cpf_cnpj | varchar(20) | NO | - | - | - | - |
| telefone | varchar(20) | YES | NULL | - | - | - |
| plano | enum('mensal','anual') | NO | - | - | - | - |
| valor | decimal(10,2) | NO | - | - | - | - |
| asaas_customer_id | varchar(50) | NO | - | - | - | ✅ |
| asaas_subscription_id | varchar(50) | NO | - | - | - | ✅ |
| ultimo_status_asaas | varchar(30) | YES | NULL | - | - | - |
| status | enum('pendente','ativo','inadimplente','cancelado') | NO | 'pendente' | - | - | - |
| billing_grace_days | int(10) UNSIGNED | NO | 3 | - | - | - |
| bloqueado_em | datetime | YES | NULL | - | - | - |
| data_ultimo_pagamento | date | YES | NULL | - | - | - |
| data_proximo_vencimento | date | YES | NULL | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| atualizado_em | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |
| ultimo_webhook_em | datetime | YES | NULL | - | - | - |

**FKs Explícitas:** usuario_id → usuarios(id) ON DELETE CASCADE

**Relacionamentos:**
- N←1 com usuarios
- 1→N com assinantes_pagamentos (assinante_id)
- Implícito: webhook_events vinculados via asaas_subscription_id

**Volume Esperado:** Médio (~100-10k)

**Operações Principais:** CREATE, READ, UPDATE (via webhook)

---

### 💰 CONTAS
**Finalidade:** Definir as contas financeiras do usuário (corrente, poupança, carteira, etc)

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| usuario_id | int(10) UNSIGNED | NO | - | - | ✅ usuarios | ✅ |
| nome | varchar(100) | NO | - | - | - | - |
| tipo | enum('corrente','poupanca','carteira','corretora','outro') | NO | 'corrente' | - | - | - |
| banco_nome | varchar(100) | YES | NULL | - | - | - |
| banco_codigo | varchar(20) | YES | NULL | - | - | - |
| saldo_inicial | decimal(15,2) | NO | 0.00 | - | - | - |
| ativo | tinyint(1) | NO | 1 | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| atualizado_em | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |

**FKs Explícitas:** usuario_id → usuarios(id) ON DELETE CASCADE

**Relacionamentos:**
- N←1 com usuarios
- 1→N com contas_pagar (conta_id)
- 1→N com contas_receber (conta_id)
- 1→N com investimentos (conta_id)
- 1→N com movimentacoes_caixa (conta_id)
- 1→N com metas (conta_id - opcional)

**Volume Esperado:** Baixo (~5-20 por usuário)

**Operações Principais:** CREATE, READ, UPDATE

---

### 📊 CONTAS_PAGAR
**Finalidade:** Registrar despesas com suporte a multa, juros, parcelamento, agendamento e recorrência

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| usuario_id | int(10) UNSIGNED | NO | - | - | ✅ usuarios | ✅ |
| conta_id | int(10) UNSIGNED | YES | NULL | - | ✅ contas | ✅ |
| categoria_id | int(10) UNSIGNED | YES | NULL | - | ✅ categorias | ✅ |
| subcategoria_id | int(10) UNSIGNED | YES | NULL | - | - | - |
| descricao | varchar(255) | NO | - | - | - | - |
| valor | decimal(15,2) | NO | - | - | - | - |
| multa_percent | decimal(6,2) | YES | NULL | - | - | - |
| multa_valor_fixo | decimal(15,2) | NO | 0.00 | - | - | - |
| juros_percent_mes | decimal(5,2) | NO | 0.00 | - | - | - |
| valor_pago | decimal(15,2) | YES | NULL | - | - | - |
| debito_automatico | tinyint(1) | NO | 0 | - | - | - |
| confirmado_pagamento | tinyint(1) | NO | 1 | - | - | ✅ |
| juros_mensal_percent | decimal(6,2) | YES | NULL | - | - | - |
| data_vencimento | date | NO | - | - | - | ✅ |
| data_pagamento | date | YES | NULL | - | - | - |
| pagamento_confirmado | tinyint(1) | NO | 0 | - | - | - |
| status | enum('pendente','provisionado','agendado','atrasado','pago','cancelado') | NO | 'pendente' | - | - | ✅ |
| tipo_despesa | enum('fixa','variavel') | NO | 'variavel' | - | - | - |
| parcelado | tinyint(1) | NO | 0 | - | - | - |
| parcelas_total | int(11) | NO | 1 | - | - | - |
| parcela_num | int(11) | NO | 1 | - | - | - |
| grupo_parcelamento | char(36) | YES | NULL | - | - | - |
| grupo_parcela | char(36) | YES | NULL | - | - | ✅ |
| recorrencia_tipo | enum('nenhuma','semanal','mensal','anual') | NO | 'nenhuma' | - | - | - |
| recorrencia_intervalo | int(11) | NO | 1 | - | - | - |
| recorrencia_ate | date | YES | NULL | - | - | - |
| observacoes | text | YES | NULL | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| atualizado_em | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |

**FKs Explícitas:**
- usuario_id → usuarios(id) ON DELETE CASCADE
- conta_id → contas(id) ON DELETE SET NULL
- categoria_id → categorias(id) ON DELETE SET NULL

**Relacionamentos:**
- N←1 com usuarios, contas, categorias
- 1→N com movimentacoes_caixa (id_origem com origem='conta_pagar')
- 1→N com anexos_vinculos (entidade_id com entidade='conta_pagar')

**Volume Esperado:** Médio-Alto (~1k-100k)

**Operações Principais:** CREATE, READ, UPDATE, DELETE, REPORT (filtros por status/período)

---

### 📥 CONTAS_RECEBER
**Finalidade:** Registrar receitas esperadas

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| usuario_id | int(10) UNSIGNED | NO | - | - | ✅ usuarios | ✅ |
| conta_id | int(10) UNSIGNED | YES | NULL | - | ✅ contas | ✅ |
| categoria_id | int(10) UNSIGNED | YES | NULL | - | ✅ categorias | ✅ |
| origem | varchar(150) | YES | NULL | - | - | - |
| descricao | varchar(255) | NO | - | - | - | - |
| valor | decimal(15,2) | NO | - | - | - | - |
| data_vencimento | date | NO | - | - | - | ✅ |
| data_prevista | date | NO | - | - | - | - |
| data_recebimento | date | YES | NULL | - | - | - |
| status | enum('previsto','recebido','cancelado') | NO | 'previsto' | - | - | ✅ |
| recorrencia_tipo | enum('nenhuma','semanal','mensal','anual') | NO | 'nenhuma' | - | - | - |
| recorrencia_intervalo | int(11) | NO | 1 | - | - | - |
| observacoes | text | YES | NULL | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| atualizado_em | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |

**FKs Explícitas:**
- usuario_id → usuarios(id) ON DELETE CASCADE
- conta_id → contas(id) ON DELETE SET NULL
- categoria_id → categorias(id) ON DELETE SET NULL

**Relacionamentos:**
- N←1 com usuarios, contas, categorias
- 1→N com movimentacoes_caixa (origem='conta_receber')
- 1→N com anexos_vinculos (entidade='conta_receber')

**Volume Esperado:** Médio (~100-10k)

**Operações Principais:** CREATE, READ, UPDATE, DELETE, REPORT

---

### 🏷️ CATEGORIAS
**Finalidade:** Definir categorias para despesas e receitas

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| usuario_id | int(10) UNSIGNED | NO | - | - | ✅ usuarios | ✅ |
| tipo | enum('receita','despesa') | NO | - | - | - | ✅ |
| nome | varchar(100) | NO | - | - | - | ✅ UNIQUE (usuario_id, tipo, nome) |
| cor | varchar(20) | YES | NULL | - | - | - |
| icone | varchar(50) | YES | NULL | - | - | - |
| parent_id | int(10) UNSIGNED | YES | NULL | - | - | ✅ |
| natureza | enum('fixa','variavel') | YES | NULL | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| atualizado_em | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |

**FKs Explícitas:**
- usuario_id → usuarios(id) ON DELETE CASCADE

**Implícitas (sugeridas):**
- parent_id → categorias(id) ON DELETE SET NULL (para subcategorias)

**Relacionamentos:**
- N←1 com usuarios
- 1→N com contas_pagar (categoria_id)
- 1→N com contas_receber (categoria_id)
- Autorreferência: parent_id → id (subcategorias)

**Volume Esperado:** Baixo (~20-100 por usuário)

**Operações Principais:** CREATE, READ, UPDATE, DELETE

---

### 💸 MOVIMENTACOES_CAIXA
**Finalidade:** Registrar fluxo de caixa (entrada/saída/transferência)

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| usuario_id | int(10) UNSIGNED | NO | - | - | ✅ usuarios | ✅ |
| conta_id | int(10) UNSIGNED | NO | - | - | ✅ contas | ✅ |
| tipo | enum('entrada','saida','transferencia') | NO | - | - | - | - |
| origem | enum('conta_pagar','conta_receber','ajuste','investimento') | NO | 'ajuste' | - | - | - |
| id_origem | int(10) UNSIGNED | YES | NULL | - | - | - |
| descricao | varchar(255) | NO | - | - | - | - |
| valor | decimal(15,2) | NO | - | - | - | - |
| data_movimento | date | NO | - | - | - | ✅ |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |

**FKs Explícitas:**
- usuario_id → usuarios(id) ON DELETE CASCADE
- conta_id → contas(id) ON DELETE CASCADE

**Implícitas:**
- id_origem: depende de `origem` (polimórfico - contas_pagar.id, contas_receber.id, investimentos.id)

**Relacionamentos:**
- N←1 com usuarios, contas
- Implícito: referência a id_origem (contas_pagar | contas_receber | investimentos)

**Volume Esperado:** Alto (~1k-1M)

**Operações Principais:** CREATE (insert-only), READ, REPORT

---

### 📈 INVESTIMENTOS
**Finalidade:** Registrar aplicações financeiras

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| usuario_id | int(10) UNSIGNED | NO | - | - | ✅ usuarios | ✅ |
| instituicao_id | int(10) UNSIGNED | YES | NULL | - | ✅ instituicoes_financeiras | ✅ |
| conta_id | int(10) UNSIGNED | YES | NULL | - | ✅ contas | ✅ |
| tipo_investimento | varchar(100) | NO | - | - | - | - |
| produto | varchar(150) | YES | NULL | - | - | - |
| tipo_investimento_id | int(10) UNSIGNED | NO | - | - | ✅ tipos_investimento | ✅ |
| nome_produto | varchar(150) | NO | - | - | - | - |
| data_aplicacao | date | NO | - | - | - | - |
| data_vencimento | date | YES | NULL | - | - | - |
| valor_aplicado | decimal(15,2) | NO | - | - | - | - |
| taxa_anual | decimal(7,4) | YES | NULL | - | - | - |
| modelo_rentabilidade | varchar(50) | YES | NULL | - | - | - |
| valor_inicial | decimal(15,2) | NO | 0.00 | - | - | - |
| taxa_ano | decimal(9,6) | YES | NULL | - | - | - |
| percentual_cdi | decimal(7,4) | YES | NULL | - | - | - |
| taxa_real_ano | decimal(9,6) | YES | NULL | - | - | - |
| indice_referencia | enum('CDI','IPCA','SELIC','OUTRO') | YES | NULL | - | - | - |
| situacao | enum('ativo','resgatado','vencido','cancelado') | NO | 'ativo' | - | - | ✅ |
| observacoes | text | YES | NULL | - | - | - |
| created_at | datetime | YES | CURRENT_TIMESTAMP | - | - | - |
| updated_at | datetime | YES | CURRENT_TIMESTAMP ON UPDATE | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| atualizado_em | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |

**FKs Explícitas:**
- usuario_id → usuarios(id) ON DELETE CASCADE
- instituicao_id → instituicoes_financeiras(id) ON DELETE SET NULL
- conta_id → contas(id) ON DELETE SET NULL
- tipo_investimento_id → tipos_investimento(id) ON UPDATE CASCADE

**Relacionamentos:**
- N←1 com usuarios, contas, tipos_investimento
- 1→N com investimentos_eventos (investimento_id)
- Implícito: movimentacoes_caixa (origem='investimento', id_origem=id)

**Volume Esperado:** Médio (~100-10k)

**Operações Principais:** CREATE, READ, UPDATE, REPORT

---

### 🎯 METAS
**Finalidade:** Definir metas de economia/investimento

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(11) | NO | - | ✅ | - | - |
| usuario_id | int(10) UNSIGNED | NO | - | - | ✅ usuarios | ✅ |
| titulo | varchar(120) | NO | - | - | - | - |
| descricao | varchar(255) | YES | NULL | - | - | - |
| valor_alvo | decimal(12,2) | NO | - | - | - | - |
| valor_atual | decimal(12,2) | NO | 0.00 | - | - | - |
| data_alvo | date | YES | NULL | - | - | - |
| prioridade | enum('baixa','media','alta') | NO | 'media' | - | - | - |
| status | enum('ativa','pausada','concluida','cancelada') | NO | 'ativa' | - | - | ✅ |
| created_at | datetime | NO | CURRENT_TIMESTAMP | - | - | ✅ |
| updated_at | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |
| criado_em | datetime | YES | NULL | - | - | - |
| atualizado_em | datetime | YES | NULL | - | - | - |
| conta_id | int(11) | YES | NULL | - | - | - |

**FKs Explícitas:**
- usuario_id → usuarios(id) ON DELETE CASCADE

**Relacionamentos:**
- N←1 com usuarios
- 1→N com metas_movimentos (meta_id)

**Volume Esperado:** Baixo (~10-100 por usuário)

**Operações Principais:** CREATE, READ, UPDATE, DELETE

---

### 📎 ANEXOS
**Finalidade:** Armazenar arquivos/comprovantes com suporte a processamento OCR/AI

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(11) | NO | - | ✅ | - | - |
| usuario_id | int(10) UNSIGNED | NO | - | - | ✅ usuarios | ✅ |
| tipo | enum('comprovante','extrato','fatura','documento','outro') | NO | 'comprovante' | - | - | - |
| descricao | varchar(180) | YES | NULL | - | - | - |
| original_nome | varchar(255) | NO | - | - | - | - |
| mime | varchar(120) | NO | - | - | - | - |
| tamanho | int(10) UNSIGNED | NO | - | - | - | - |
| hash_sha256 | char(64) | NO | - | - | - | ✅ |
| storage_path | varchar(300) | NO | - | - | - | - |
| created_at | datetime | NO | CURRENT_TIMESTAMP | - | - | ✅ |
| processamento_status | enum('pendente','processando','concluido','erro') | NO | 'pendente' | - | - | ✅ |
| processamento_model | varchar(60) | YES | NULL | - | - | - |
| processamento_tokens | int(11) | YES | NULL | - | - | - |
| processamento_em | datetime | YES | NULL | - | - | - |
| processamento_erro | varchar(1000) | YES | NULL | - | - | - |
| extraido_texto | longtext | YES | NULL | - | - | - |
| extraido_json | longtext | YES | NULL | - | - | - |

**FKs Explícitas:**
- usuario_id → usuarios(id) ON DELETE CASCADE

**Relacionamentos:**
- N←1 com usuarios
- 1→N com anexos_vinculos (anexo_id)

**Volume Esperado:** Médio (~1k-100k arquivos)

**Operações Principais:** CREATE, READ, UPDATE (processamento_status)

---

### 🔗 ANEXOS_VINCULOS
**Finalidade:** Vincular anexos a entidades (contas_pagar, contas_receber, investimentos, metas)

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(11) | NO | - | ✅ | - | - |
| anexo_id | int(11) | NO | - | - | ✅ anexos | ✅ UNIQUE (com entidade, entidade_id) |
| usuario_id | int(10) UNSIGNED | NO | - | - | ✅ usuarios | ✅ |
| entidade | enum('conta_pagar','conta_receber','investimento','investimento_evento','movimentacao_caixa') | NO | - | - | - | ✅ |
| entidade_id | int(11) | NO | - | - | - | ✅ |
| created_at | datetime | NO | CURRENT_TIMESTAMP | - | - | - |

**FKs Explícitas:**
- anexo_id → anexos(id) ON DELETE CASCADE
- usuario_id → usuarios(id) ON DELETE CASCADE

**Implícitas (sugeridas):**
- entidade_id + entidade: referência polimórfica (tipo discriminador)

**Relacionamentos:**
- N←1 com anexos, usuarios
- Polimórfico: entidade_id referencia diferentes tabelas conforme `entidade`

**Volume Esperado:** Médio (~1k-100k)

**Operações Principais:** CREATE, READ, DELETE

---

### 🤖 JOBS
**Finalidade:** Fila de trabalho para processamento assíncrono (OCR, webhooks, etc)

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(11) | NO | - | ✅ | - | - |
| tipo | varchar(60) | NO | - | - | - | ✅ |
| payload_json | longtext | NO | - | - | - | - |
| status | enum('pendente','processando','concluido','erro') | NO | 'pendente' | - | - | ✅ |
| prioridade | int(11) | NO | 100 | - | - | - |
| disponivel_em | datetime | NO | CURRENT_TIMESTAMP | - | - | ✅ |
| tentativas | int(11) | NO | 0 | - | - | - |
| max_tentativas | int(11) | NO | 5 | - | - | - |
| iniciado_em | datetime | YES | NULL | - | - | - |
| concluido_em | datetime | YES | NULL | - | - | - |
| ultimo_erro | varchar(1000) | YES | NULL | - | - | - |
| resultado_resumo | varchar(500) | YES | NULL | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| atualizado_em | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |

**FKs:** Nenhuma (tabela de sistema)

**Relacionamentos:** Nenhuma FK, mas `payload_json` pode referenciar outras entidades via ID

**Volume Esperado:** Alto (~10k-1M)

**Operações Principais:** CREATE, READ, UPDATE (status), DELETE (cleanup)

---

### 🪝 WEBHOOK_EVENTS
**Finalidade:** Auditoria de webhooks recebidos (Asaas, Evolution API)

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | bigint(20) UNSIGNED | NO | - | ✅ | - | - |
| provider | varchar(32) | NO | - | - | - | ✅ UNIQUE (provider, event_id) |
| event_id | varchar(100) | NO | - | - | - | ✅ |
| payload_hash | char(64) | NO | - | - | - | - |
| received_at | datetime | NO | - | - | - | ✅ |

**FKs:** Nenhuma explícita (auditoria pura)

**Relacionamentos:** Nenhuma

**Volume Esperado:** Alto (~100k-10M)

**Operações Principais:** CREATE (insert-only), READ

---

### 💬 WHATSAPP_LOGS
**Finalidade:** Log de mensagens WhatsApp bidirecionais (in/out)

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| usuario_id | int(10) UNSIGNED | YES | NULL | - | ✅ usuarios | ✅ |
| whatsapp | varchar(30) | NO | - | - | - | ✅ |
| direction | enum('in','out') | NO | - | - | - | - |
| mensagem | text | NO | - | - | - | - |
| raw_payload | longtext | YES | NULL | - | - | - |
| created_at | datetime | YES | CURRENT_TIMESTAMP | - | - | - |

**FKs Explícitas:**
- usuario_id → usuarios(id) ON DELETE SET NULL

**Relacionamentos:**
- N←1 com usuarios (opcional)

**Volume Esperado:** Alto (~100k-10M)

**Operações Principais:** CREATE, READ

---

### 💳 ASSINANTES_PAGAMENTOS
**Finalidade:** Histórico de cobranças/pagamentos via Asaas

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| assinante_id | int(10) UNSIGNED | NO | - | - | ✅ assinantes | ✅ |
| asaas_payment_id | varchar(50) | NO | - | - | - | ✅ UNIQUE |
| status | varchar(30) | NO | - | - | - | - |
| valor | decimal(10,2) | NO | 0.00 | - | - | - |
| due_date | date | YES | NULL | - | - | - |
| payment_date | date | YES | NULL | - | - | - |
| invoice_url | varchar(255) | YES | NULL | - | - | - |
| raw_payload | longtext | YES | NULL | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| atualizado_em | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |

**FKs Explícitas:**
- assinante_id → assinantes(id) ON DELETE CASCADE

**Relacionamentos:**
- N←1 com assinantes

**Volume Esperado:** Médio (~1k-100k)

**Operações Principais:** CREATE, READ, UPDATE (via webhook)

---

### 🎟️ CUPONS
**Finalidade:** Códigos promocionais/desconto

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| codigo | varchar(50) | NO | - | - | - | ✅ UNIQUE |
| tipo | enum('percentual','valor') | NO | - | - | - | - |
| valor | decimal(10,2) | NO | - | - | - | - |
| trial_dias | int(11) | YES | NULL | - | - | - |
| somente_plano | enum('mensal','anual','ambos') | NO | 'ambos' | - | - | - |
| ativo | tinyint(1) | NO | 1 | - | - | - |
| max_usos | int(10) UNSIGNED | YES | NULL | - | - | - |
| usos | int(10) UNSIGNED | NO | 0 | - | - | - |
| data_expiracao | date | YES | NULL | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| atualizado_em | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |

**FKs:** Nenhuma

**Relacionamentos:** Nenhuma (tabela de lookup)

**Volume Esperado:** Baixo (~10-1k)

**Operações Principais:** CREATE, READ, UPDATE (usos)

---

### 🏦 INSTITUICOES_FINANCEIRAS
**Finalidade:** Catálogo de bancos/corretoras

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| nome | varchar(150) | NO | - | - | - | - |
| tipo | enum('banco','corretora','fintech','outro') | NO | 'banco' | - | - | - |
| codigo | varchar(20) | YES | NULL | - | - | - |
| cnpj | varchar(20) | YES | NULL | - | - | - |
| site | varchar(200) | YES | NULL | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| atualizado_em | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |

**FKs:** Nenhuma

**Relacionamentos:**
- 1→N com investimentos (instituicao_id)

**Volume Esperado:** Baixo (~1k global)

**Operações Principais:** READ, CREATE (raro)

---

### 📊 TIPOS_INVESTIMENTO
**Finalidade:** Classificação de tipos de investimentos

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| nome | varchar(100) | NO | - | - | - | - |
| classe | enum('renda_fixa','fundo','acao','outro') | NO | 'renda_fixa' | - | - | - |
| modelo_calculo | enum('PREFIXADO','CDI_PERCENTUAL','IPCA_MAIS_TAXA','POUPANCA','MANUAL') | NO | 'MANUAL' | - | - | - |
| descricao | text | YES | NULL | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| atualizado_em | datetime | NO | CURRENT_TIMESTAMP ON UPDATE | - | - | - |

**FKs:** Nenhuma

**Relacionamentos:**
- 1→N com investimentos (tipo_investimento_id)

**Volume Esperado:** Baixo (~10-100)

**Operações Principais:** READ, CREATE (raro)

---

### 🎯 INVESTIMENTOS_EVENTOS
**Finalidade:** Histórico de aportes/resgates/ajustes em investimentos

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(10) UNSIGNED | NO | - | ✅ | - | - |
| investimento_id | int(10) UNSIGNED | NO | - | - | ✅ investimentos | ✅ |
| data_evento | date | NO | - | - | - | ✅ |
| tipo_evento | enum('APLICACAO','APORTE','RESGATE','AJUSTE') | NO | - | - | - | - |
| valor | decimal(15,2) | NO | - | - | - | - |
| observacoes | text | YES | NULL | - | - | - |
| criado_em | datetime | NO | CURRENT_TIMESTAMP | - | - | - |

**FKs Explícitas:**
- investimento_id → investimentos(id) ON DELETE CASCADE

**Relacionamentos:**
- N←1 com investimentos

**Volume Esperado:** Médio (~1k-100k)

**Operações Principais:** CREATE, READ, DELETE

---

### 🎯 METAS_MOVIMENTOS
**Finalidade:** Histórico de aportes/saques/ajustes em metas

| Campo | Tipo | NULL | Default | PK | FK | Index |
|-------|------|------|---------|----|----|-------|
| id | int(11) | NO | - | ✅ | - | - |
| meta_id | int(11) | NO | - | - | ✅ metas | ✅ |
| usuario_id | int(10) UNSIGNED | NO | - | - | ✅ usuarios | ✅ |
| tipo | enum('aporte','saque','ajuste') | NO | - | - | - | - |
| valor | decimal(12,2) | NO | - | - | - | - |
| data_mov | date | NO | - | - | - | ✅ |
| observacoes | varchar(255) | YES | NULL | - | - | - |
| created_at | datetime | NO | CURRENT_TIMESTAMP | - | - | - |
| data_movimento | date | YES | NULL | - | - | - |

**FKs Explícitas:**
- meta_id → metas(id) ON DELETE CASCADE
- usuario_id → usuarios(id) ON DELETE CASCADE

**Relacionamentos:**
- N←1 com metas, usuarios

**Volume Esperado:** Médio (~1k-100k)

**Operações Principais:** CREATE, READ, DELETE

---

## 3️⃣ Matriz de Relacionamentos

### Dependências Críticas (CASCATA)

```
usuarios (root)
├── assinantes
│   └── assinantes_pagamentos
├── contas
│   ├── contas_pagar
│   │   └── movimentacoes_caixa
│   │   └── anexos_vinculos
│   ├── contas_receber
│   │   └── movimentacoes_caixa
│   │   └── anexos_vinculos
│   ├── investimentos
│   │   ├── investimentos_eventos
│   │   └── movimentacoes_caixa (implícito)
│   │   └── anexos_vinculos
│   └── metas
├── categorias
│   ├── contas_pagar
│   └── contas_receber
├── anexos
│   └── anexos_vinculos
├── metas
│   └── metas_movimentos
└── whatsapp_logs (soft FK)
```

### Polimorfismos

- **movimentacoes_caixa.id_origem + origem**: referencia contas_pagar | contas_receber | investimentos
- **anexos_vinculos.entidade_id + entidade**: referencia conta_pagar | conta_receber | investimento | investimento_evento | movimentacao_caixa

### Webhook/Eventos

- **assinantes_pagamentos**: atualizado via webhook Asaas
- **webhook_events**: auditoria de webhooks
- **whatsapp_logs**: mensagens via Evolution API

---

## 4️⃣ Lista de Inconsistências do Legado

### ⚠️ Problemas Críticos

**1. Campo `provisionado` não existe no schema**
- Código usa `$provisionado` mas tabela só tem `status`
- Sugestão: adicionar coluna `is_provisioned` BOOLEAN ou usar status='provisionado'

**2. Coluna `subcategoria_id` sem FK explícita**
- Não existe constraint em contas_pagar.subcategoria_id → categorias(id)
- Esperado: adicionar FK com validação parent_id

**3. Status como string livre em some places**
- contas_pagar.status: ENUM (bom)
- webhook_events, assinantes_pagamentos.status: VARCHAR (ruim)
- Inconsistência: usar sempre ENUM ou sempre VARCHAR

**4. Índices de filtro faltando**
- contas_pagar: faltam índices em (usuario_id, status), (usuario_id, data_vencimento)
- movimentacoes_caixa: faltam índices em (usuario_id, data_movimento)
- Impacto: queries lentas em relatórios

**5. Dois conjuntos de timestamps (created_at + criado_em)**
- Algumas tabelas: created_at, updated_at
- Outras: criado_em, atualizado_em
- Inconsistência: padronizar nome

**6. Campos redundantes em investimentos**
- `taxa_anual` E `taxa_ano` (mesma coisa)
- `valor_aplicado` E `valor_inicial` (aparentemente iguais)
- Sugestão: remover duplicação no Postgres

**7. Relacionamento polimórfico sem type safety**
- movimentacoes_caixa.origem + id_origem
- anexos_vinculos.entidade + entidade_id
- Sem constraints: impossível forçar integridade referencial
- Sugestão: adicionar CHECK constraints ou usar junction tables separadas

**8. Cascade DELETE em cascade**
- Usuário deletado → deleta tudo (assinantes, contas, contas_pagar, etc)
- Pode ser intencional (multi-tenant), mas perigoso
- Sugestão: adicionar soft delete (deleted_at) com logical constraints

---

### ⚠️ Problemas de Design

**9. categoria_id + subcategoria_id ambíguo**
- Permitido ter ambos NOT NULL
- Sem constraint de exclusão mútua
- Sugestão: usar apenas categoria_id (com parent_id em categorias)

**10. data_vencimento vs data_prevista (contas_receber)**
- Duas datas com semântica similar
- data_vencimento: vencimento real
- data_prevista: previsão de recebimento
- Sugestão: consolidar ou documentar diferença

**11. Status calculado vs armazenado**
- Código calcula status com regras (vencimento < hoje → atrasado)
- Status também é campo enum
- Desincronização possível se status não atualizar automaticamente

**12. Multa como percent + valor fixo**
- Ambos podem ser NOT NULL
- Cálculo: (valor * multa_percent) + multa_valor_fixo
- Sem exemplo de uso claro
- Sugestão: documentar ou simplificar

**13. Recorrência sem limite de tempo implícito**
- recorrencia_tipo='mensal', recorrencia_ate=NULL
- Pode gerar infinitas contas_pagar
- Sugestão: adicionar max_occurrences ou usar scheduled tasks

**14. hash_sha256 em anexos, mas sem uso visível**
- Provavelmente para deduplicação
- Sem unique constraint
- Sugestão: adicionar UNIQUE(usuario_id, hash_sha256) ou usar para cleanup

**15. raw_payload em múltiplas tabelas**
- anexos, whatsapp_logs, assinantes_pagamentos, webhook_events: todos armazenam JSON bruto
- Ótimo para auditoria, mas duplica espaço
- Sugestão: arquivo/blob storage + reference ao Postgres

---

### ⚠️ Problemas de Performance

**16. Sem índice em group_parcela (contas_pagar)**
- Querys para agrupar parcelas podem ser lentas
- Sugestão: adicionar INDEX(grupo_parcela)

**17. DECIMAL vs NUMERIC**
- Usando DECIMAL em monetário (correto!)
- Mas sem PRECISION documentada
- Sugestão: padronizar como DECIMAL(15,2) ou NUMERIC(15,2) em Postgres

**18. Sem índice em origem (movimentacoes_caixa)**
- Querys por origem (pagar/receber/ajuste) podem ser lentas
- Sugestão: adicionar INDEX(usuario_id, origem, data_movimento)

---

### ⚠️ Problemas de Integridade

**19. assinantes.usuario_id pode ser NULL**
- Caso de uso: assinante sem usuário criado ainda?
- Mas webhook referencia assinante → deixa órfã o user?
- Sugestão: tornar NOT NULL ou documentar workflow

**20. Sem default para created_at em algumas tabelas**
- algumas: DEFAULT CURRENT_TIMESTAMP
- outras: sem default (deve inserir manualmente)
- Risco: dados com data_vencimento no futuro mas created_at NULL
- Sugestão: DEFAULT CURRENT_TIMESTAMP em todas

**21. Enum values case-sensitive**
- contas_pagar.status: 'pendente', 'pago', 'cancelado'
- assinantes.status: 'pendente', 'ativo', 'inadimplente', 'cancelado'
- Sem namespace: confusão se mudar
- Sugestão: prefixar (conta_status, assinante_status) ou criar tabelas de domínio

---

## 5️⃣ Recomendações para PostgreSQL

### Migrações Imediatas (v1.0)

- [ ] Adicionar FK explícita em subcategoria_id → categorias(id)
- [ ] Adicionar índices em tabelas de filtro (status, data_vencimento, usuario_id)
- [ ] Padronizar timestamp columns (criado_em / atualizado_em)
- [ ] Remover campos redundantes (taxa_ano, valor_inicial duplicados)
- [ ] Adicionar CHECK CONSTRAINTS para polimorfismos

### Revisões de Design (v1.1-1.2)

- [ ] Implementar soft delete (deleted_at) com lógica de auditoria
- [ ] Separar junction tables para polimorfismos (movimentacoes_pagar, movimentacoes_receber, etc)
- [ ] Consolidar categoria hierarquia (usar parent_id, remover subcategoria_id)
- [ ] Adicionar unique constraint em anexos (usuario_id, hash_sha256)
- [ ] Documentar e consolidar status enums (criar domain types em Postgres)

### Otimizações de Storage (v1.3+)

- [ ] Mover raw_payload para JSONB storage ou arquivo externo
- [ ] Implementar particionamento em movimentacoes_caixa (por usuario_id + data_movimento)
- [ ] Adicionar materialized view para relatórios (contas_pagar_summary por status/período)

---

## 📝 Conclusão

O schema legado é **funcionalmente completo** mas apresenta:
- ✅ Cobertura boa de domínios
- ⚠️ Inconsistências de nomenclatura e tipos
- ⚠️ Falta de constraints explícitas (polimorfismos)
- ⚠️ Índices incompletos para performance
- ✅ Boas bases para migração (estrutura clara)

**Próximos passos:**
1. ✅ Este documento (inventário completo)
2. → 02.1 ERD novo (Postgres) baseado neste mapeamento
3. → 02.2 Migrations (aplicar 5️⃣ Recomendações)
4. → 02.3 ETL (validação de dados + transformação)

---

**Versão:** 1.0  
**Data:** 2026-03-02 19:12:19  
**Autor:** GitHub Copilot  
**Epic:** EPIC 02 — Modelagem de Dados (Postgres)  
**Story:** 02.1 ERD e decisões de modelagem
