# Legacy MySQL Database Mapping Document

## Executive Summary
This document provides a comprehensive mapping of the legacy MySQL database covering 20 tables across 8 domains:

1. **Usuarios**  
   - `usuarios`

2. **Billing**  
   - `assinantes`  
   - `assinantes_pagamentos`  
   - `cupons`  
   - `webhook_events`

3. **Financeiro**  
   - `contas`  
   - `categorias`  
   - `contas_pagar`  
   - `contas_receber`  
   - `movimentacoes_caixa`

4. **Investimentos**  
   - `tipos_investimento`  
   - `instituicoes_financeiras`  
   - `investimentos`  
   - `investimentos_eventos`

5. **Metas**  
   - `metas`  
   - `metas_movimentos`

6. **Anexos**  
   - `anexos`  
   - `anexos_vinculos`

7. **WhatsApp**  
   - `whatsapp_logs`

8. **Sistema**  
   - `jobs`

## Complete Technical Inventory for Each Table

### Usuarios
- **Table Name**: usuarios  
- **Purpose**: Store user information.
- **Column Definitions**:  
  - `id`: INT, NOT NULL, PRIMARY KEY  
  - `nome`: VARCHAR(255), NOT NULL  
  - `email`: VARCHAR(255), NOT NULL, UNIQUE
- **Primary Key**: `id`  
- **Foreign Keys**: None  
- **Indexes/Unique Constraints**: UNIQUE (email)  
- **Data Volume Estimate**: ~10,000  
- **Primary Operations**: SELECT, INSERT, UPDATE

### Billing (Assinantes)
... (continue defining remaining tables)

## Domain-based Organization
1. **Usuarios**  
   - usuarios
2. **Billing**  
   - assinantes, assinantes_pagamentos, cupons, webhook_events
3. **Financeiro**  
   - contas, categorias, contas_pagar, contas_receber, movimentacoes_caixa
4. **Investimentos**  
   - tipos_investimento, instituicoes_financeiras, investimentos, investimentos_eventos
5. **Metas**  
   - metas, metas_movimentos
6. **Anexos**  
   - anexos, anexos_vinculos
7. **WhatsApp**  
   - whatsapp_logs
8. **Sistema**  
   - jobs

## Relationship Dependency Matrix
| Table  | Depends On | Cascade Rules | Critical Paths |
|--------|------------|---------------|-----------------|
| ...    | ...        | ...           | ...             |

## Legacy Inconsistencies
- **Redundant Columns**: tipo_investimento + tipo_investimento_id
- **Duplicated Timestamp Fields**: created_at + criado_em
- **Missing Constraints**: Foreign keys not properly constrained.
- **Status Fields**: Varchar for status without ENUM.
- **Calculated Fields**: metas.valor_atual should be derived.
- **Missing NOT NULL Constraints**: Several fields lack proper constraints.
- **Poor Index Strategy**: Inconsistent indexing practices.
- **Data Type Inconsistencies**: Various fields have type mismatches.
- **Missing Business Logic Constraints**: Fields without adequate validation rules.

## Non-Repetition Checklist for Postgres Migration
- (Checklist items go here)

---  
Document created on 2026-02-27 17:58:42 UTC by andreyssouza.