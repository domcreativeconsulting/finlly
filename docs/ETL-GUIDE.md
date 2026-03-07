# ETL Guide — MySQL → Postgres Migration

## Visão Geral

Este guia descreve como executar o script ETL (Extract, Transform, Load) que migra dados do banco MySQL legado (`finlly_go`) para o banco Postgres v2 do Finlly.

A migração cobre **20 tabelas** e realiza as seguintes transformações principais:

- `INT AUTO_INCREMENT` → `UUID` (via UUIDv5 determinístico)
- `DATETIME` → `TIMESTAMPTZ` (America/Sao_Paulo → UTC, com suporte a DST)
- `VARCHAR status` → `ENUM` Postgres
- Remoção de campos desnormalizados: `balance`, `current_value`, `current_amount`
- Geração de `hash_sha256` para deduplicação de anexos

---

## Pré-requisitos

1. **Node.js** ≥ 18
2. **MySQL legado** acessível e com dados
3. **Postgres v2** com migrações aplicadas (`npm run db:migrate`)
4. **Variáveis de ambiente** configuradas (ver seção abaixo)

---

## Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto (ou configure no seu ambiente):

```env
# Banco de dados legado (MySQL)
LEGACY_MYSQL_HOST=localhost
LEGACY_MYSQL_PORT=3306
LEGACY_MYSQL_USER=finlly_go
LEGACY_MYSQL_PASSWORD=change_me
LEGACY_MYSQL_DATABASE=finlly_go

# Banco de dados v2 (Postgres)
DATABASE_URL=postgresql://user:password@localhost:5432/finlly

# Timezone (obrigatório — todos os DATETIMEs do MySQL são interpretados neste fuso)
TZ=America/Sao_Paulo

# Configurações do ETL
ETL_BATCH_SIZE=1000        # Registros por lote (padrão: 1000)
ETL_DRY_RUN=false          # true = simula sem inserir dados
ETL_VALIDATE_SAMPLES=true  # true = valida amostras aleatórias após carga
```

> **Atenção:** Nunca comite o arquivo `.env.local` no controle de versão.

---

## Comandos Disponíveis

### 1. Testar Conexões

Verifica a conectividade com MySQL e Postgres antes de executar a migração:

```bash
npm run etl:test
```

**Saída esperada:**
```
🔌 Testando conexões...

✅ MySQL: conexão bem-sucedida
✅ Postgres: conexão bem-sucedida

✨ Todas as conexões estabelecidas com sucesso!
```

### 2. Dry Run (Simulação)

Executa todas as fases (Extract, Transform) sem inserir dados no Postgres.
Ideal para validar o processo antes da execução real:

```bash
npm run etl:dry-run
```

### 3. Execução Real

Executa a migração completa: extrai do MySQL, transforma e insere no Postgres:

```bash
npm run etl:execute
```

**Fluxo completo:**
```
🚀 Iniciando migração MySQL → Postgres

⚙️  Modo: EXECUÇÃO REAL
📊 Batch size: 1000

📖 FASE 1: EXTRACT
   ✅ usuarios: 15 extraídos
   ✅ contas: 48 extraídos
   ...

🔄 FASE 2: TRANSFORM
   ✅ 15 usuarios transformados
   ✅ 48 contas transformadas
   ...

💾 FASE 3: LOAD
   🗑️  Limpando usuarios...
   ✅ usuarios: Lote 1/1 inserido (15 total)
   ...

✓  FASE 4: VALIDATE
   ✅ usuarios: MySQL=15, Postgres=15
   ✅ contas: MySQL=48, Postgres=48
   ...

✨ Migração concluída com status: SUCCESS
📄 Relatório salvo em: migration-report-2026-03-04.json
```

### 4. Rollback

Limpa todas as tabelas Postgres (TRUNCATE CASCADE), permitindo executar a migração novamente:

```bash
npm run etl:rollback
```

> **Atenção:** O rollback apaga todos os dados das tabelas. Use com cautela em produção.

---

## Estrutura dos Arquivos

```
scripts/etl/
├── etl.ts                                  # Orquestrador principal
├── rollback.ts                             # Script de rollback
├── test-connection.ts                      # Teste de conexões
├── config.ts                               # Configuração centralizada
├── extractors/
│   ├── base.extractor.ts                  # Classe base MySQL
│   ├── usuarios.extractor.ts
│   ├── cupons.extractor.ts
│   ├── assinantes.extractor.ts
│   ├── assinantes-pagamentos.extractor.ts
│   ├── webhook-events.extractor.ts
│   ├── instituicoes-financeiras.extractor.ts
│   ├── contas.extractor.ts
│   ├── categorias.extractor.ts
│   ├── contas-pagar.extractor.ts
│   ├── contas-receber.extractor.ts
│   ├── movimentacoes-caixa.extractor.ts
│   ├── tipos-investimento.extractor.ts
│   ├── investimentos.extractor.ts
│   ├── investimentos-eventos.extractor.ts
│   ├── metas.extractor.ts
│   ├── metas-movimentos.extractor.ts
│   ├── anexos.extractor.ts
│   ├── anexos-vinculos.extractor.ts
│   ├── whatsapp-logs.extractor.ts
│   └── jobs.extractor.ts
├── transformers/
│   ├── id-mapper.ts                        # INT → UUID v5
│   ├── type-converter.ts                   # Conversões de tipo
│   ├── usuario.transformer.ts
│   ├── cupom.transformer.ts
│   ├── assinante.transformer.ts
│   ├── assinante-pagamento.transformer.ts
│   ├── webhook-event.transformer.ts
│   ├── instituicao-financeira.transformer.ts
│   ├── conta.transformer.ts
│   ├── categoria.transformer.ts
│   ├── conta-pagar.transformer.ts
│   ├── conta-receber.transformer.ts
│   ├── movimentacao-caixa.transformer.ts
│   ├── tipo-investimento.transformer.ts
│   ├── investimento.transformer.ts
│   ├── investimento-evento.transformer.ts
│   ├── meta.transformer.ts
│   ├── meta-movimento.transformer.ts
│   ├── anexo.transformer.ts
│   ├── anexo-vinculo.transformer.ts
│   ├── whatsapp-log.transformer.ts
│   └── job.transformer.ts
├── loaders/
│   └── postgres.loader.ts                  # Inserção em Postgres via Prisma
├── validators/
│   ├── count-validator.ts                  # Validação de contagens
│   ├── sample-validator.ts                 # Spot check aleatório
│   └── orphan-detector.ts                  # Detecção de FKs inválidas
└── reporters/
    └── report-generator.ts                 # Geração de relatório JSON
```

---

## Relatório de Migração

Após cada execução, um arquivo `migration-report-YYYY-MM-DD.json` é gerado na raiz do projeto.

### Estrutura do Relatório

```json
{
  "timestamp": "2026-03-04T20:00:00.000Z",
  "status": "success",
  "modo": "execucao_real",
  "summary": {
    "total_tabelas": 20,
    "tabelas_ok": 20,
    "tabelas_com_erro": 0,
    "total_registros_mysql": 5000,
    "total_registros_postgres": 5000,
    "total_erros": 0,
    "total_avisos": 0
  },
  "por_tabela": [
    { "tabela": "usuarios", "mysql_count": 15, "postgres_count": 15, "status": "ok" }
  ],
  "amostras": [...],
  "orphans_found": [],
  "transformacoes_aplicadas": {
    "ids_mapeados": 5000,
    "tipos_convertidos": ["DATETIME → TIMESTAMPTZ", "INT → UUID (v5)", "VARCHAR → ENUM"],
    "campos_removidos": ["balance", "current_value", "current_amount"],
    "campos_adicionados": ["hash_sha256", "deleted_at", "is_sistema", "conta_destino_id"]
  },
  "erros": []
}
```

**Status possíveis:**
- `success` — migração concluída sem erros
- `partial` — migração concluída com avisos (ex: divergências de contagem)
- `error` — migração abortada por erro fatal

---

## Idempotência

O ETL é idempotente: pode ser executado múltiplas vezes com o mesmo resultado.

- **TRUNCATE CASCADE** é executado antes de cada carga
- **skipDuplicates** garante que registros duplicados sejam ignorados
- O mapeamento de IDs (INT → UUID) é determinístico via UUIDv5

---

## Detalhes das Transformações

### Mapeamento de IDs

Os IDs inteiros do MySQL são convertidos para UUIDs determinísticos usando UUIDv5:

```
UUID = uuidv5("<tableName>:<mysqlId>", DNS_NAMESPACE)
```

Isso garante que o mesmo MySQL ID sempre gera o mesmo UUID, tornando a migração idempotente.

### Conversão de Status

| MySQL (string)     | Postgres (ENUM)   | Tabela                  |
|--------------------|-------------------|-------------------------|
| `active`           | `ativo`           | `status_assinante`      |
| `trial`            | `trial`           | `status_assinante`      |
| `paid`             | `pago`            | `status_pagamento`      |
| `pending`          | `pendente`        | `status_pagamento`      |
| `income`           | `entrada`         | `tipo_movimentacao`     |
| `expense`          | `saida`           | `tipo_movimentacao`     |
| `transfer`         | `transferencia`   | `tipo_movimentacao`     |

### Campos Removidos

| Tabela MySQL   | Campo Removido  | Motivo                                      |
|----------------|-----------------|---------------------------------------------|
| `accounts`     | `balance`       | Calculado via `movimentacoes_caixa`         |
| `investments`  | `current_value` | Calculado via `investimentos_eventos`       |
| `goals`        | `current_amount`| Calculado via `metas_movimentos`            |

---

## Troubleshooting

### Erro: "MySQL: erro de conexão"

**Causa:** Credenciais inválidas ou MySQL inacessível.

**Solução:**
1. Verifique as variáveis `LEGACY_MYSQL_*` no `.env.local`
2. Confirme que o MySQL está rodando: `mysql -h $LEGACY_MYSQL_HOST -u $LEGACY_MYSQL_USER -p`
3. Verifique permissões do usuário: `SHOW GRANTS FOR 'finlly_go'@'localhost';`

### Erro: "Postgres: erro de conexão"

**Causa:** `DATABASE_URL` incorreta ou Postgres inacessível.

**Solução:**
1. Verifique a variável `DATABASE_URL`
2. Confirme que as migrações foram aplicadas: `npm run db:migrate`

### Aviso: "Contagem divergente"

**Causa:** O número de registros no MySQL não bate com o Postgres após a carga.

**Solução:**
1. Verifique o relatório JSON para identificar qual tabela tem divergência
2. Possíveis causas: registros com constraints violadas foram ignorados (`skipDuplicates`)
3. Execute `npm run etl:rollback` e tente novamente com `ETL_DRY_RUN=true` para investigar

### Erro: "orphan detectado"

**Causa:** Existem registros com FK apontando para IDs inexistentes.

**Solução:**
1. Verifique o campo `orphans_found` no relatório
2. Garanta que a tabela pai foi carregada antes da tabela filha
3. No MySQL legado, verifique se as FKs eram implícitas (sem constraint) e se há dados inconsistentes

### Erro: "duplicate key value violates unique constraint"

**Causa:** Tentativa de inserir registros com valores duplicados em campos com UNIQUE constraint.

**Solução:**
1. O ETL usa `skipDuplicates: true` — duplicatas são silenciosamente ignoradas
2. Se a contagem divergir, investigue os registros duplicados no MySQL

---

## Backup Antes da Migração

Antes de executar em produção, faça backup do MySQL:

```bash
mysqldump \
  -h $LEGACY_MYSQL_HOST \
  -u $LEGACY_MYSQL_USER \
  -p$LEGACY_MYSQL_PASSWORD \
  $LEGACY_MYSQL_DATABASE \
  > backup-finlly-go-$(date +%Y%m%d).sql
```

E do Postgres:

```bash
pg_dump $DATABASE_URL > backup-finlly-v2-$(date +%Y%m%d).sql
```

---

## Tratamento de Timezone (America/Sao_Paulo)

### Por que isso importa

O banco MySQL legado armazena todos os `DATETIME` **sem informação de fuso horário**. O ETL assume que esses valores estão em **America/Sao_Paulo** e os converte para UTC antes de inserir no Postgres como `TIMESTAMPTZ`.

Isso garante que o Postgres armazene o instante correto no tempo, independentemente do fuso do servidor.

### Horário de Verão (DST)

O Brasil aboliu o horário de verão em 2019. Desde então, `America/Sao_Paulo` permanece **UTC-3 o ano todo**. A biblioteca `date-fns-tz` usa o banco de dados IANA de fusos horários, portanto trata corretamente registros históricos (anteriores a 2019) que possam ter sido gerados durante o horário de verão (UTC-2).

| Período | Offset São Paulo |
|---------|-----------------|
| A partir de 2020 (sem DST) | UTC-3 (ano todo) |
| Antes de 2020 — verão (nov–fev) | UTC-2 (histórico) |
| Antes de 2020 — inverno (mar–out) | UTC-3 (histórico) |

### Exemplo de conversão

```
MySQL value:      '2026-03-07 14:30:00'
Interpretation:   2026-03-07 14:30 em São Paulo (UTC-3, horário padrão)
UTC resultante:   2026-03-07 17:30:00 UTC
Postgres storage: '2026-03-07 17:30:00+00' (TIMESTAMPTZ)
```

### Fluxo completo

```
Extract (MySQL)
  ↓
'2026-03-07 14:30:00' (sem timezone)
  ↓
Transform (JavaScript / date-fns-tz)
  ↓
Interpreta como America/Sao_Paulo → 2026-03-07 14:30 -03:00
Converte para UTC → 2026-03-07 17:30:00 UTC
  ↓
Load (Postgres)
  ↓
TIMESTAMPTZ: '2026-03-07 17:30:00+00'
  ↓
Consulta na aplicação (AT TIME ZONE)
  ↓
SELECT created_at AT TIME ZONE 'America/Sao_Paulo' AS created_at_sp
Resultado: 2026-03-07 14:30:00 ✅
```

### Configuração obrigatória

Defina `TZ=America/Sao_Paulo` no arquivo `.env.local` (ou variável de ambiente). O ETL valida o timezone na inicialização e exibe um erro claro se for inválido:

```
🌎 Timezone: America/Sao_Paulo (UTC offset: -3.0h)
```

Se o timezone for inválido:

```
❌ Timezone inválido ou não reconhecido: "America/Foo"
   Defina TZ=America/Sao_Paulo no arquivo .env.local ou nas variáveis de ambiente.
```

### Verificando datas no Postgres

Após a migração, use `AT TIME ZONE` para inspecionar os valores convertidos:

```sql
-- Verificar created_at no fuso de São Paulo
SELECT
  id,
  created_at AS created_at_utc,
  created_at AT TIME ZONE 'America/Sao_Paulo' AS created_at_sp
FROM usuarios
LIMIT 5;

-- Confirmar que a data original do MySQL é restaurada corretamente
-- Se o MySQL tinha '2026-03-07 14:30:00', o resultado de created_at_sp
-- deve ser '2026-03-07 14:30:00'
```

### Campos afetados

| Função | Campos |
|--------|--------|
| `toTimestamptz()` | `created_at`, `updated_at`, `deleted_at`, datas de agendamento e pagamento |
| `toDateOnly()` | `data_inicio`, `data_fim`, `data_vencimento`, `data_recebimento`, `data_pagamento` |

---

## Próximos Passos

Após a migração ser validada:

1. **Task 02.4** — Testes de integridade dos dados migrados
2. **Cutover** — Redirecionar a aplicação para o Postgres v2
3. **Monitoramento** — Validar métricas pós-migração
4. **Descomissionamento** — Planejar remoção do MySQL legado

---

*Documento gerado em: 2026-03-04*
