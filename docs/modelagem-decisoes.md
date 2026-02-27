# Documento de Decisões Arquiteturais — Finlly v2

## Contexto

Este documento registra as decisões técnicas tomadas na modelagem do banco de dados Postgres do Finlly v2.  
Cada decisão inclui as opções avaliadas, o trade-off e a justificativa técnica.

---

## 1. UUID vs BIGSERIAL

### Opções Avaliadas

| Opção      | Vantagens                                                              | Desvantagens                                             |
|------------|------------------------------------------------------------------------|----------------------------------------------------------|
| UUID       | Globalmente único, seguro para exposição em APIs, suporta geração offline | Maior tamanho (16 bytes vs 8), index ligeiramente maior  |
| BIGSERIAL  | Compacto, ordenação natural por tempo, melhor throughput em insert     | Expõe sequência (enumeração), dificulta sharding futuro  |

### Decisão

- **UUID** (`gen_random_uuid()`) para todas as entidades de negócio: `usuarios`, `contas`, `categorias`, `contas_pagar`, `contas_receber`, `movimentacoes_caixa`, `investimentos`, `metas`, `anexos`, etc.
- **BIGSERIAL** para tabelas de alto throughput sem necessidade de exposição externa: `webhook_events`, `whatsapp_logs`, `jobs`.

### Justificativa

UUIDs evitam enumeração de IDs em APIs REST (segurança), permitem geração de IDs no lado da aplicação antes de persistir (útil em operações offline/batch), e facilitam integração com sistemas externos. Para tabelas de logs e filas, BIGSERIAL é suficiente e mais eficiente dado o alto volume de inserções.

---

## 2. ENUM vs Lookup Table

### Opções Avaliadas

| Opção         | Vantagens                                                        | Desvantagens                                            |
|---------------|------------------------------------------------------------------|---------------------------------------------------------|
| ENUM Postgres | Validação no banco, sem JOIN, performático                       | Alteração requer `ALTER TYPE` (DDL), não dinamicamente editável |
| Lookup Table  | Editável sem DDL, suporta metadados adicionais (cor, ícone, etc.)| Requer JOIN, sem validação automática no banco           |
| CHECK constraint | Simples, sem schema extra                                    | Sem metadados, difícil de listar programaticamente       |

### Decisão

- **ENUM Postgres** para status de ciclo de vida com valores fixos e conhecidos:
  - `status_assinante`: trial, ativo, inativo, cancelado, inadimplente
  - `status_pagamento`: pendente, pago, cancelado, estornado, falhou
  - `status_conta`: ativa, inativa, arquivada
  - `status_meta`: ativa, concluida, cancelada
  - `tipo_movimentacao`: entrada, saida, transferencia
  - `tipo_conta`: corrente, poupanca, cartao_credito, cartao_debito, dinheiro, investimento, outro
  - `tipo_meta`: economia, despesa, investimento
  - `tipo_evento_investimento`: aporte, resgate, rendimento, taxa, dividendo
  - `tipo_recorrencia`: diario, semanal, quinzenal, mensal, bimestral, trimestral, semestral, anual

- **Lookup Table** para domínios flexíveis que podem ser expandidos sem DDL:
  - `tipos_investimento`: CDB, LCI, LCA, Tesouro Direto, Ações, FII, etc. (usuários podem querer tipos customizados)
  - `instituicoes_financeiras`: bancos e corretoras (novas instituições surgem frequentemente)
  - `categorias`: categorias financeiras com hierarquia e customização por usuário

### Justificativa

Status de ciclo de vida raramente mudam (e quando mudam, requerem código novo de qualquer forma). ENUMs garantem integridade sem custo de JOIN. Tipos de investimento e instituições financeiras evoluem constantemente — lookup tables permitem inserção de novos registros sem deploy.

---

## 3. Soft Delete vs Hard Delete

### Opções Avaliadas

| Estratégia   | Vantagens                                                         | Desvantagens                                              |
|--------------|-------------------------------------------------------------------|-----------------------------------------------------------|
| Soft Delete  | Recuperação de dados, auditoria LGPD, histórico preservado        | Queries precisam de `WHERE deleted_at IS NULL`, tamanho maior |
| Hard Delete  | Queries simples, banco menor, sem complexidade extra              | Dados irrecuperáveis, possível violação de requisitos legais |

### Decisão

- **Soft Delete** (`deleted_at TIMESTAMPTZ`) em todas as entidades financeiras e de negócio:
  - `usuarios`, `assinantes`, `assinantes_pagamentos`, `cupons`
  - `contas`, `categorias`, `contas_pagar`, `contas_receber`, `movimentacoes_caixa`
  - `investimentos`, `investimentos_eventos`, `tipos_investimento`, `instituicoes_financeiras`
  - `metas`, `metas_movimentos`, `anexos`

- **Hard Delete** em tabelas de logs e filas com baixa relevância temporal:
  - `webhook_events`, `whatsapp_logs`, `jobs`

### Justificativa

A LGPD (Lei Geral de Proteção de Dados) exige capacidade de auditoria e, em alguns cenários, de recuperação de dados financeiros. Dados contábeis deletados podem ser necessários para contestação de cobranças ou relatórios históricos. Para logs operacionais (webhooks, mensagens, jobs), a relevância decai rapidamente e o volume é alto — hard delete é suficiente e mais eficiente.

---

## 4. Auditoria Mínima

### Campos Obrigatórios

Todas as tabelas com soft-delete possuem:

| Campo        | Tipo          | Significado                                      |
|--------------|---------------|--------------------------------------------------|
| `created_at` | `TIMESTAMPTZ` | Momento de criação do registro                   |
| `updated_at` | `TIMESTAMPTZ` | Momento da última atualização                    |
| `deleted_at` | `TIMESTAMPTZ` | Momento da exclusão lógica (NULL = ativo)         |

### Decisão de Fase

- **Fase atual (v2)**: auditoria temporal mínima (`created_at`, `updated_at`, `deleted_at`)
- **Fase futura (P1)**: auditoria de atores (`created_by`, `updated_by`, `deleted_by` → FK para `usuarios.id`)

### Justificativa

A auditoria completa com atores requer infraestrutura adicional (contexto de usuário no banco, triggers ou camada de aplicação). Para a fase inicial, timestamps são suficientes para rastrear quando as mudanças ocorreram. A adição futura de `*_by` é retrocompatível.

---

## 5. Normalização e Campos Calculados

### Decisão

Saldos, totais e valores acumulados **não são armazenados** nas tabelas principais — são calculados em tempo de execução:

| Campo Removido              | Tabela          | Como Calcular                                                   |
|-----------------------------|-----------------|-----------------------------------------------------------------|
| `saldo` / `balance`         | `contas`        | `SUM(CASE tipo WHEN 'entrada' THEN valor ELSE -valor END)` em `movimentacoes_caixa` |
| `valor_atual`               | `investimentos` | `SUM` de aportes menos resgates em `investimentos_eventos`       |
| `valor_atual` / `progresso` | `metas`         | `SUM(valor)` em `metas_movimentos`                               |

### Justificativa

Armazenar valores derivados cria risco de inconsistência entre o campo armazenado e os registros que o compõem. Em caso de bug, correção manual ou migração de dados, o saldo poderia ficar divergente das movimentações. Calcular em tempo real garante consistência absoluta. Para performance, índices compostos `(conta_id, data)` e `(usuario_id, data)` mitigam o custo das queries.

---

## 6. Estratégia de Índices

### Princípio

Índices foram definidos com base em queries reais esperadas no produto, não de forma genérica.

### Índices Compostos Principais

| Tabela                | Índice                                | Query que suporta                             |
|-----------------------|---------------------------------------|-----------------------------------------------|
| `contas`              | `(usuario_id, status)`                | Listar contas ativas do usuário               |
| `categorias`          | `(usuario_id, tipo)`                  | Categorias de entrada ou saída do usuário     |
| `contas_pagar`        | `(usuario_id, data_vencimento)`       | Contas a vencer no mês                        |
| `contas_pagar`        | `(usuario_id, status)`                | Contas pendentes do usuário                   |
| `contas_receber`      | `(usuario_id, data_vencimento)`       | Recebíveis a vencer                           |
| `movimentacoes_caixa` | `(usuario_id, data)`                  | Extrato por período                           |
| `movimentacoes_caixa` | `(conta_id, data)`                    | Saldo de uma conta por período                |
| `investimentos`       | `(usuario_id, status)`                | Investimentos ativos do usuário               |
| `metas`               | `(usuario_id, status)`                | Metas ativas                                  |
| `whatsapp_logs`       | `(usuario_id, created_at)`            | Histórico de mensagens do usuário             |

### Índices de Deduplicação

| Tabela    | Índice                        | Finalidade                             |
|-----------|-------------------------------|----------------------------------------|
| `anexos`  | `(usuario_id, hash_sha256)`   | Evitar upload duplicado do mesmo arquivo |

### Índices Parciais

| Tabela           | Índice                               | Condição                          |
|------------------|--------------------------------------|-----------------------------------|
| `webhook_events` | `processado` (partial)               | `WHERE processado = FALSE`        |
| `jobs`           | `(status, agendado_para)` (partial)  | `WHERE status IN ('pendente', 'falhou')` |

Índices parciais são mais compactos e eficientes pois indexam apenas os registros relevantes para a query mais crítica.

---

## 7. Vínculos Polimórficos (Anexos)

### Decisão

`anexos_vinculos` usa modelo polimórfico com `entidade_tipo VARCHAR + entidade_id UUID`, restrito via CHECK constraint ao conjunto de tabelas válidas.

### Trade-off

| Abordagem            | Vantagens                                    | Desvantagens                              |
|----------------------|----------------------------------------------|-------------------------------------------|
| FK explícita por tipo| Integridade referencial 100% garantida       | Muitas colunas nullable, schema rígido    |
| Polimórfico + CHECK  | Schema flexível, uma tabela para todos vínculos | Sem FK real; integridade via aplicação  |
| Tabela join por tipo | Máxima integridade                           | Muitas tabelas de vínculo (uma por entidade) |

Polimórfico com CHECK foi escolhido por equilíbrio entre flexibilidade e controle. O conjunto de `entidade_tipo` válidos é restrito via constraint, evitando referências inválidas.

---

*Documento gerado em: 2026-02-27*