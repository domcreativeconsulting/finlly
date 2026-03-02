# Inconsistências do Legado MySQL — Não Repetir no Postgres

> **Data:** 2026-03-02
> **Propósito:** Lista estruturada de problemas do schema legado a evitar no redesenho Postgres v2.

---

## 1. Campos Duplicados / Redundantes

| Tabela               | Campos Duplicados                                              | Ação                                              |
|----------------------|----------------------------------------------------------------|---------------------------------------------------|
| `metas`              | `created_at` + `criado_em`, `updated_at` + `atualizado_em`    | Usar apenas `created_at` e `updated_at`           |
| `metas_movimentos`   | `data_mov` + `data_movimento`                                  | Usar apenas `data_mov`                            |
| `investimentos`      | `tipo_investimento` (string) + `tipo_investimento_id` (FK)     | Remover campo string; manter apenas FK            |
| `investimentos`      | `created_at` + `criado_em`, `updated_at` + `atualizado_em`    | Usar apenas `created_at` e `updated_at`           |
| `usuarios`           | `telefone_whatsapp` + `whatsapp`                               | Consolidar em um único campo canônico             |

---

## 2. Status/Tipo como String Livre (Sem Constraint)

| Tabela                  | Campo        | Problema                                              |
|-------------------------|--------------|-------------------------------------------------------|
| `assinantes_pagamentos` | `status`     | VARCHAR(30) livre — sem ENUM ou CHECK                 |
| `assinantes`            | `ultimo_status_asaas` | String livre que pode divergir do `status` ENUM |

**Ação:** Converter para ENUM Postgres strict com DEFAULT explícito em todos os campos de status.

---

## 3. Ausência de Constraints

| Problema                                   | Tabelas Afetadas                     | Correção                                                      |
|--------------------------------------------|--------------------------------------|---------------------------------------------------------------|
| FK polimórfica sem constraint real         | `movimentacoes_caixa` (`id_origem`)  | Tabelas separadas ou trigger de validação                     |
| FK polimórfica sem validação de domínio    | `anexos_vinculos` (`entidade_id`)    | CHECK constraint nos valores de `entidade`                    |
| Sem `CHECK (valor > 0)` em campos monetários | `contas_pagar`, `contas_receber`   | Adicionar `CHECK (valor > 0)`                                 |
| Sem `CHECK (parcelas_total >= 1)`          | `contas_pagar`                       | Adicionar constraint                                          |
| `contas_pagar.confirmado_pagamento` vs `pagamento_confirmado` | `contas_pagar`    | Definir campo canônico e remover duplicata                    |

---

## 4. Tipos Errados / Imprecisos

| Campo                                   | Tipo Atual          | Problema                                    | Tipo Recomendado      |
|-----------------------------------------|---------------------|---------------------------------------------|-----------------------|
| `contas_pagar.juros_mensal_percent`     | DECIMAL(6,2)        | Duplica `juros_percent_mes` — qual usar?    | Consolidar em um campo|
| `investimentos.taxa_anual`              | DECIMAL(7,4)        | Confunde com `percentual_cdi` (mesmo tipo)  | Renomear com semântica clara |
| `cupons.valor`                          | DECIMAL(10,2)       | Semântica ambígua (% ou R$?) — depende de `tipo` | Separar em `desconto_percentual` + `desconto_fixo` |
| `categorias.icone`                      | VARCHAR(50)         | Sem padronização — nome de emoji, classe CSS ou URL? | Definir convenção |
| Todos os `DATETIME`                     | DATETIME (sem TZ)   | Sem informação de fuso horário              | `TIMESTAMPTZ` no Postgres |
| Todos os `TINYINT(1)` booleanos         | TINYINT(1)          | Semântica opaca                             | `BOOLEAN` no Postgres |

---

## 5. Nulos Inconsistentes

| Campo                          | Problema                                                          |
|--------------------------------|-------------------------------------------------------------------|
| `usuarios.telefone_whatsapp` e `usuarios.whatsapp` | Ambos NULL — qual é o canônico?              |
| `contas.banco_codigo`          | NULL quando `banco_nome` também é NULL — deixa registro vago      |
| `investimentos.indice_referencia` | NULL em renda fixa — sem índice definido é dado incompleto    |
| `metas.data_alvo`              | NULL permite meta sem prazo — aceitável ou bug?                   |
| `anexos_vinculos.entidade_id`  | NOT NULL mas a entidade referenciada pode não existir             |

**Ação:** Definir política clara — NOT NULL para campos críticos, DEFAULT para opcionais, comentário no schema explicando semântica.

---

## 6. Índices Faltando em Colunas de Filtro Crítico

| Tabela          | Campo sem índice adequado       | Impacto                                          |
|-----------------|---------------------------------|--------------------------------------------------|
| `contas_pagar`  | `grupo_parcela`                 | Filtrado na app mas sem índice explícito confirmado |
| `contas_receber`| `status` composto com `data_prevista` | Consultas combinadas podem ser lentas     |
| `anexos`        | `processamento_status`          | `WHERE processamento_status='pendente'` sem índice parcial |

---

## 7. Sem Soft Delete

| Tabela           | Problema                                                       | Ação                              |
|------------------|----------------------------------------------------------------|-----------------------------------|
| `contas_pagar`   | DELETE físico ou status='cancelado' — inconsistente            | Padronizar com `deleted_at`       |
| `metas`          | DELETE físico ou status='cancelada' — inconsistente            | Padronizar com `deleted_at`       |
| `anexos`         | DELETE direto com cascata — perda de auditoria                 | Adicionar `deleted_at`            |

**Ação:** Adotar `deleted_at TIMESTAMPTZ` (nullable) como padrão em todas as entidades de negócio.

---

## 8. Relacionamentos Polimórficos Mal Implementados

| Tabela                | Problema                                           | Opções de Correção                                               |
|-----------------------|----------------------------------------------------|------------------------------------------------------------------|
| `movimentacoes_caixa` | `origem` (string) + `id_origem` (int) sem FK real  | **Recomendado:** Tabelas separadas (movimentacoes_pagar, movimentacoes_receber) |
| `anexos_vinculos`     | `entidade` (string) + `entidade_id` (int) sem FK   | CHECK constraint nos valores de `entidade` + trigger de validação |

---

## 9. Defaults Inconsistentes / Faltando

| Campo                               | Problema                                       |
|-------------------------------------|------------------------------------------------|
| `categorias.tipo`                   | Sem DEFAULT declarado — pode resultar em NULL inadvertido |
| `investimentos.valor_aplicado`      | Sem DEFAULT — risco de NULL em campo NOT NULL  |
| `contas_pagar.confirmado_pagamento` vs `pagamento_confirmado` | Defaults distintos para campos que parecem redundantes |

---

## 10. Colisão de Nomes / Confusão Semântica

| Problema                                             | Tabela         | Ação                              |
|------------------------------------------------------|----------------|-----------------------------------|
| `confirmado_pagamento` (default=1) vs `pagamento_confirmado` (default=0) | `contas_pagar` | Definir campo único canônico |
| `created_at` vs `criado_em` (duplicate de timestamp)| `investimentos`, `metas` | Remover duplicatas     |

---

## 11. Falta de Versionamento / Auditoria

- Nenhuma tabela tem `versao` ou campo de revisão.
- Sem `atualizado_por` ou `motivo_alteracao`.
- `movimentacoes_caixa` serve como log de caixa, mas não há histórico de **mudanças** em `contas_pagar`/`contas_receber`.

**Ação:** Considerar trigger para audit log nas tabelas financeiras críticas.

---

## 12. Índices Redundantes

| Tabela        | Problema                                              | Ação                     |
|---------------|-------------------------------------------------------|--------------------------|
| `assinantes`  | `KEY (asaas_subscription_id)` possivelmente duplicado | Verificar e remover       |
| `categorias`  | `KEY (usuario_id, tipo, parent_id)` + `KEY (parent_id)` — segundo pode ser redundante | Avaliar plano de execução |

---

## 13. Volume / Performance

- Não há PARTITIONING nas tabelas de alto volume: `movimentacoes_caixa`, `jobs`, `whatsapp_logs`.
- Sem estratégia de arquivamento para `jobs` e `whatsapp_logs` antigos.

**Ação:** Planejar particionamento por data em `movimentacoes_caixa` (por mês/ano) no Postgres v2.

---

*Documento gerado em: 2026-03-02*
*Documentos relacionados: `01-legacy-schema-mapping.md` (inventário), `legacy-mapping.md` (mapa de relacionamentos)*