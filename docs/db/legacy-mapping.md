# Documentação do Esquema Legado MySQL

## Visão Geral por Domínio
Este documento apresenta uma visão abrangente do esquema de banco de dados legado MySQL extraído de `finlly_go.sql`. A documentação está organizada por domínio e inclui detalhes sobre tabelas, colunas, chaves primárias (PK), chaves estrangeiras (FK), índices, relacionamentos e considerações importantes para evitar inconsistências durante o redesenho em PostgreSQL.

## Tabelas

### Tabela: usuarios
- **Colunas**:
  - id (INT, PK)
  - nome (VARCHAR)
  - email (VARCHAR)
- **Chaves Primárias**: 
  - id
- **Chaves Estrangeiras**: Nenhuma
- **Índices**: 
  - email (UNIQUE)
- **Relacionamentos**: 
  - Um para muitos com contas, contas_pagar, contas_receber

### Tabela: contas
- **Colunas**:
  - id (INT, PK)
  - usuario_id (INT, FK -> usuarios.id)
  - saldo_inicial (DECIMAL)
- **Chaves Primárias**: 
  - id
- **Chaves Estrangeiras**: 
  - usuario_id referencia usuarios(id)
- **Índices**: 
  - usuario_id (INDEX)
- **Relacionamentos**: 
  - Muitos para um com usuarios

... (continuar com as demais tabelas)

## Considerações para o Redesenho em PostgreSQL
- Garantir que os tipos de dados sejam ajustados do formato MySQL para o PostgreSQL.
- Revisar e corrigir possíveis problemas com valores padrão e restrições de NULL.
- Avaliar cuidadosamente os relacionamentos de chave estrangeira para garantir a integridade referencial.
- Testar condições de índice único que possam diferir entre MySQL e PostgreSQL.