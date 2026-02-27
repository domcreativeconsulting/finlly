-- =============================================================================
-- Finlly v2 — Schema PostgreSQL Completo
-- Gerado em: 2026-02-27
-- Banco: PostgreSQL 15+
-- Encoding: UTF-8
-- =============================================================================

-- Habilitar extensão para UUIDs (disponível por padrão no Postgres 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE status_assinante AS ENUM (
  'trial',
  'ativo',
  'inativo',
  'cancelado',
  'inadimplente'
);

CREATE TYPE status_pagamento AS ENUM (
  'pendente',
  'pago',
  'cancelado',
  'estornado',
  'falhou'
);

CREATE TYPE status_conta AS ENUM (
  'ativa',
  'inativa',
  'arquivada'
);

CREATE TYPE status_meta AS ENUM (
  'ativa',
  'concluida',
  'cancelada'
);

CREATE TYPE tipo_conta AS ENUM (
  'corrente',
  'poupanca',
  'cartao_credito',
  'cartao_debito',
  'dinheiro',
  'investimento',
  'outro'
);

CREATE TYPE tipo_movimentacao AS ENUM (
  'entrada',
  'saida',
  'transferencia'
);

CREATE TYPE tipo_meta AS ENUM (
  'economia',
  'despesa',
  'investimento'
);

CREATE TYPE tipo_evento_investimento AS ENUM (
  'aporte',
  'resgate',
  'rendimento',
  'taxa',
  'dividendo'
);

CREATE TYPE tipo_recorrencia AS ENUM (
  'diario',
  'semanal',
  'quinzenal',
  'mensal',
  'bimestral',
  'trimestral',
  'semestral',
  'anual'
);

-- =============================================================================
-- DOMAIN: USUÁRIOS
-- =============================================================================

-- Entidade central do sistema. Toda FK de negócio aponta para esta tabela.
-- Soft-delete via deleted_at (conformidade LGPD).
CREATE TABLE usuarios (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             VARCHAR(255) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  senha_hash       VARCHAR(255) NOT NULL,
  telefone         VARCHAR(20),
  avatar_url       TEXT,
  email_verificado BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,

  CONSTRAINT uq_usuarios_email UNIQUE (email)
);

COMMENT ON TABLE  usuarios              IS 'Usuários do sistema. Soft-delete via deleted_at (LGPD).';
COMMENT ON COLUMN usuarios.senha_hash   IS 'Hash bcrypt da senha — nunca armazenar senha em texto plano.';
COMMENT ON COLUMN usuarios.deleted_at   IS 'Soft-delete: registro inativo quando preenchido.';

-- =============================================================================
-- DOMAIN: BILLING
-- =============================================================================

-- Cupons de desconto para planos de assinatura.
CREATE TABLE cupons (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo               VARCHAR(50)  NOT NULL,
  desconto_percentual  NUMERIC(5,2) CHECK (desconto_percentual BETWEEN 0 AND 100),
  desconto_fixo        NUMERIC(10,2) CHECK (desconto_fixo >= 0),
  valido_ate           TIMESTAMPTZ,
  uso_maximo           INTEGER      CHECK (uso_maximo > 0),
  uso_atual            INTEGER      NOT NULL DEFAULT 0 CHECK (uso_atual >= 0),
  ativo                BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ,

  CONSTRAINT uq_cupons_codigo UNIQUE (codigo),
  CONSTRAINT ck_cupons_desconto CHECK (
    (desconto_percentual IS NOT NULL AND desconto_fixo IS NULL)
    OR (desconto_percentual IS NULL AND desconto_fixo IS NOT NULL)
  )
);

COMMENT ON TABLE  cupons              IS 'Cupons de desconto para assinatura. Soft-delete.';
COMMENT ON COLUMN cupons.codigo       IS 'Código único case-sensitive do cupom.';
COMMENT ON COLUMN cupons.uso_maximo   IS 'NULL = uso ilimitado.';

-- Assinatura de cada usuário no sistema de billing.
-- Um registro por usuário (1:1 com usuarios).
CREATE TABLE assinantes (
  id                       UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id               UUID             NOT NULL,
  status                   status_assinante NOT NULL DEFAULT 'trial',
  plano                    VARCHAR(50)      NOT NULL DEFAULT 'free',
  provider                 VARCHAR(50),
  provider_customer_id     VARCHAR(100),
  provider_subscription_id VARCHAR(100),
  cupom_id                 UUID,
  trial_inicio             TIMESTAMPTZ,
  trial_fim                TIMESTAMPTZ,
  proxima_cobranca         TIMESTAMPTZ,
  created_at               TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ,

  CONSTRAINT uq_assinantes_usuario UNIQUE (usuario_id),
  CONSTRAINT fk_assinantes_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_assinantes_cupom   FOREIGN KEY (cupom_id)
    REFERENCES cupons (id) ON DELETE SET NULL
);

COMMENT ON TABLE  assinantes              IS 'Assinatura do usuário. Um por usuário. Soft-delete.';
COMMENT ON COLUMN assinantes.provider     IS 'Provedor de pagamento: asaas | stripe | manual.';
COMMENT ON COLUMN assinantes.trial_fim    IS 'Data de expiração do período trial.';

-- Histórico de cobranças por assinante.
CREATE TABLE assinantes_pagamentos (
  id                  UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  assinante_id        UUID             NOT NULL,
  usuario_id          UUID             NOT NULL,
  status              status_pagamento NOT NULL DEFAULT 'pendente',
  valor               NUMERIC(10,2)    NOT NULL CHECK (valor >= 0),
  provider            VARCHAR(50),
  provider_payment_id VARCHAR(100),
  descricao           TEXT,
  data_pagamento      TIMESTAMPTZ,
  data_vencimento     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT fk_apagamentos_assinante FOREIGN KEY (assinante_id)
    REFERENCES assinantes (id) ON DELETE CASCADE,
  CONSTRAINT fk_apagamentos_usuario   FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE RESTRICT
);

COMMENT ON TABLE assinantes_pagamentos IS 'Histórico de cobranças por assinante. Soft-delete.';

CREATE INDEX idx_apagamentos_assinante ON assinantes_pagamentos (assinante_id);
CREATE INDEX idx_apagamentos_usuario   ON assinantes_pagamentos (usuario_id, status);

-- Eventos de webhook recebidos de provedores externos.
-- BIGSERIAL: alto throughput. Hard-delete (sem deleted_at).
CREATE TABLE webhook_events (
  id            BIGSERIAL    PRIMARY KEY,
  provider      VARCHAR(50)  NOT NULL,
  event_id      VARCHAR(255) NOT NULL,
  event_type    VARCHAR(100) NOT NULL,
  payload       JSONB        NOT NULL,
  processado    BOOLEAN      NOT NULL DEFAULT FALSE,
  processado_em TIMESTAMPTZ,
  erro          TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_webhook_provider_event UNIQUE (provider, event_id)
);

COMMENT ON TABLE  webhook_events           IS 'Eventos de webhook. BIGSERIAL, hard-delete.';
COMMENT ON COLUMN webhook_events.event_id  IS 'ID do evento no provedor (idempotência).';

CREATE INDEX idx_webhook_processado ON webhook_events (processado) WHERE processado = FALSE;

-- =============================================================================
-- DOMAIN: FINANCEIRO
-- =============================================================================

-- Lookup table de instituições financeiras (bancos, corretoras, etc.).
CREATE TABLE instituicoes_financeiras (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                VARCHAR(255) NOT NULL,
  codigo_compensacao  VARCHAR(10),
  logo_url            TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT uq_instituicoes_nome UNIQUE (nome)
);

COMMENT ON TABLE  instituicoes_financeiras                   IS 'Lookup: bancos e instituições. Soft-delete.';
COMMENT ON COLUMN instituicoes_financeiras.codigo_compensacao IS 'Código COMPE (3 dígitos) ou ISPB (8 dígitos).';

-- Contas financeiras do usuário (corrente, poupança, cartão, etc.).
-- Saldo NÃO é armazenado — calculado via movimentacoes_caixa.
CREATE TABLE contas (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id                UUID        NOT NULL,
  nome                      VARCHAR(255) NOT NULL,
  tipo                      tipo_conta  NOT NULL,
  instituicao_financeira_id UUID,
  cor                       VARCHAR(7)  CHECK (cor ~ '^#[0-9A-Fa-f]{6}$'),
  icone                     VARCHAR(50),
  incluir_total             BOOLEAN     NOT NULL DEFAULT TRUE,
  status                    status_conta NOT NULL DEFAULT 'ativa',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                TIMESTAMPTZ,

  CONSTRAINT fk_contas_usuario       FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_contas_instituicao   FOREIGN KEY (instituicao_financeira_id)
    REFERENCES instituicoes_financeiras (id) ON DELETE SET NULL
);

COMMENT ON TABLE  contas              IS 'Contas financeiras. Saldo calculado via movimentacoes_caixa. Soft-delete.';
COMMENT ON COLUMN contas.incluir_total IS 'Se deve somar ao patrimônio total do usuário.';

CREATE INDEX idx_contas_usuario_status ON contas (usuario_id, status);

-- Categorias de transações financeiras.
-- Suporta hierarquia (pai_id) e categorias do sistema (usuario_id NULL).
CREATE TABLE categorias (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID,
  nome        VARCHAR(255)      NOT NULL,
  tipo        tipo_movimentacao NOT NULL,
  icone       VARCHAR(50),
  cor         VARCHAR(7)        CHECK (cor ~ '^#[0-9A-Fa-f]{6}$'),
  pai_id      UUID,
  is_sistema  BOOLEAN           NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,

  CONSTRAINT fk_categorias_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_categorias_pai    FOREIGN KEY (pai_id)
    REFERENCES categorias (id) ON DELETE SET NULL
);

COMMENT ON TABLE  categorias            IS 'Categorias com hierarquia. usuario_id NULL = sistema. Soft-delete.';
COMMENT ON COLUMN categorias.is_sistema IS 'TRUE = categoria padrão do sistema, não editável pelo usuário.';

CREATE INDEX idx_categorias_usuario_tipo ON categorias (usuario_id, tipo);
CREATE INDEX idx_categorias_pai          ON categorias (pai_id) WHERE pai_id IS NOT NULL;

-- Contas a pagar com suporte a recorrência e parcelamento.
CREATE TABLE contas_pagar (
  id                   UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id           UUID             NOT NULL,
  descricao            VARCHAR(500)     NOT NULL,
  valor                NUMERIC(10,2)    NOT NULL CHECK (valor > 0),
  data_vencimento      DATE             NOT NULL,
  data_pagamento       DATE,
  status               status_pagamento NOT NULL DEFAULT 'pendente',
  categoria_id         UUID,
  conta_id             UUID,
  recorrente           BOOLEAN          NOT NULL DEFAULT FALSE,
  recorrencia          tipo_recorrencia,
  parcela_atual        INTEGER          CHECK (parcela_atual > 0),
  total_parcelas       INTEGER          CHECK (total_parcelas > 0),
  grupo_recorrencia_id UUID,
  observacoes          TEXT,
  created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ,

  CONSTRAINT fk_cpagar_usuario   FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_cpagar_categoria FOREIGN KEY (categoria_id)
    REFERENCES categorias (id) ON DELETE SET NULL,
  CONSTRAINT fk_cpagar_conta     FOREIGN KEY (conta_id)
    REFERENCES contas (id) ON DELETE SET NULL,
  CONSTRAINT ck_cpagar_parcelas  CHECK (
    (parcela_atual IS NULL AND total_parcelas IS NULL)
    OR (parcela_atual IS NOT NULL AND total_parcelas IS NOT NULL AND parcela_atual <= total_parcelas)
  )
);

COMMENT ON TABLE  contas_pagar                    IS 'Contas a pagar. Suporte a recorrência e parcelamento. Soft-delete.';
COMMENT ON COLUMN contas_pagar.grupo_recorrencia_id IS 'UUID compartilhado entre parcelas/recorrências do mesmo grupo.';

CREATE INDEX idx_cpagar_usuario_vencimento   ON contas_pagar (usuario_id, data_vencimento);
CREATE INDEX idx_cpagar_usuario_status       ON contas_pagar (usuario_id, status);
CREATE INDEX idx_cpagar_grupo_recorrencia    ON contas_pagar (grupo_recorrencia_id) WHERE grupo_recorrencia_id IS NOT NULL;

-- Contas a receber com suporte a recorrência e parcelamento.
CREATE TABLE contas_receber (
  id                   UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id           UUID             NOT NULL,
  descricao            VARCHAR(500)     NOT NULL,
  valor                NUMERIC(10,2)    NOT NULL CHECK (valor > 0),
  data_vencimento      DATE             NOT NULL,
  data_recebimento     DATE,
  status               status_pagamento NOT NULL DEFAULT 'pendente',
  categoria_id         UUID,
  conta_id             UUID,
  recorrente           BOOLEAN          NOT NULL DEFAULT FALSE,
  recorrencia          tipo_recorrencia,
  parcela_atual        INTEGER          CHECK (parcela_atual > 0),
  total_parcelas       INTEGER          CHECK (total_parcelas > 0),
  grupo_recorrencia_id UUID,
  observacoes          TEXT,
  created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ,

  CONSTRAINT fk_creceber_usuario   FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_creceber_categoria FOREIGN KEY (categoria_id)
    REFERENCES categorias (id) ON DELETE SET NULL,
  CONSTRAINT fk_creceber_conta     FOREIGN KEY (conta_id)
    REFERENCES contas (id) ON DELETE SET NULL,
  CONSTRAINT ck_creceber_parcelas  CHECK (
    (parcela_atual IS NULL AND total_parcelas IS NULL)
    OR (parcela_atual IS NOT NULL AND total_parcelas IS NOT NULL AND parcela_atual <= total_parcelas)
  )
);

COMMENT ON TABLE contas_receber IS 'Contas a receber. Suporte a recorrência e parcelamento. Soft-delete.';

CREATE INDEX idx_creceber_usuario_vencimento ON contas_receber (usuario_id, data_vencimento);
CREATE INDEX idx_creceber_usuario_status     ON contas_receber (usuario_id, status);
CREATE INDEX idx_creceber_grupo_recorrencia  ON contas_receber (grupo_recorrencia_id) WHERE grupo_recorrencia_id IS NOT NULL;

-- Lançamentos financeiros reais em caixa.
-- Esta tabela é a fonte de verdade para cálculo de saldo.
CREATE TABLE movimentacoes_caixa (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID              NOT NULL,
  conta_id         UUID              NOT NULL,
  tipo             tipo_movimentacao NOT NULL,
  valor            NUMERIC(10,2)     NOT NULL CHECK (valor > 0),
  descricao        VARCHAR(500)      NOT NULL,
  data             DATE              NOT NULL,
  categoria_id     UUID,
  conta_destino_id UUID,
  conta_pagar_id   UUID,
  conta_receber_id UUID,
  observacoes      TEXT,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,

  CONSTRAINT fk_movim_usuario        FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_movim_conta          FOREIGN KEY (conta_id)
    REFERENCES contas (id) ON DELETE RESTRICT,
  CONSTRAINT fk_movim_categoria      FOREIGN KEY (categoria_id)
    REFERENCES categorias (id) ON DELETE SET NULL,
  CONSTRAINT fk_movim_conta_destino  FOREIGN KEY (conta_destino_id)
    REFERENCES contas (id) ON DELETE SET NULL,
  CONSTRAINT fk_movim_conta_pagar    FOREIGN KEY (conta_pagar_id)
    REFERENCES contas_pagar (id) ON DELETE SET NULL,
  CONSTRAINT fk_movim_conta_receber  FOREIGN KEY (conta_receber_id)
    REFERENCES contas_receber (id) ON DELETE SET NULL,
  CONSTRAINT ck_movim_transferencia  CHECK (
    tipo <> 'transferencia' OR conta_destino_id IS NOT NULL
  )
);

COMMENT ON TABLE  movimentacoes_caixa               IS 'Fonte de verdade do saldo. Soft-delete.';
COMMENT ON COLUMN movimentacoes_caixa.conta_destino_id IS 'Obrigatório quando tipo = transferencia.';

CREATE INDEX idx_movimentacoes_usuario_data  ON movimentacoes_caixa (usuario_id, data);
CREATE INDEX idx_movimentacoes_usuario_tipo  ON movimentacoes_caixa (usuario_id, tipo);
CREATE INDEX idx_movimentacoes_conta_data    ON movimentacoes_caixa (conta_id, data);

-- =============================================================================
-- DOMAIN: INVESTIMENTOS
-- =============================================================================

-- Lookup table de tipos de investimento.
CREATE TABLE tipos_investimento (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        VARCHAR(100) NOT NULL,
  descricao   TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,

  CONSTRAINT uq_tipos_investimento_nome UNIQUE (nome)
);

COMMENT ON TABLE tipos_investimento IS 'Lookup: CDB, LCI, LCA, Tesouro Direto, Ações, FII, etc. Soft-delete.';

-- Posições de investimento do usuário.
-- Valor atual = SUM(investimentos_eventos.valor) filtrado por tipo.
CREATE TABLE investimentos (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID         NOT NULL,
  nome            VARCHAR(255) NOT NULL,
  tipo_id         UUID         NOT NULL,
  instituicao_id  UUID,
  valor_inicial   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_inicial >= 0),
  data_inicio     DATE         NOT NULL,
  data_vencimento DATE,
  status          status_conta NOT NULL DEFAULT 'ativa',
  observacoes     TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT fk_invest_usuario     FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_invest_tipo        FOREIGN KEY (tipo_id)
    REFERENCES tipos_investimento (id) ON DELETE RESTRICT,
  CONSTRAINT fk_invest_instituicao FOREIGN KEY (instituicao_id)
    REFERENCES instituicoes_financeiras (id) ON DELETE SET NULL
);

COMMENT ON TABLE  investimentos             IS 'Posições de investimento. Valor atual via eventos. Soft-delete.';
COMMENT ON COLUMN investimentos.tipo_id     IS 'FK RESTRICT: tipo não pode ser deletado enquanto houver investimentos.';

CREATE INDEX idx_investimentos_usuario_status ON investimentos (usuario_id, status);
CREATE INDEX idx_investimentos_usuario_tipo   ON investimentos (usuario_id, tipo_id);

-- Histórico de eventos de investimento (aportes, resgates, rendimentos).
CREATE TABLE investimentos_eventos (
  id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  investimento_id UUID                    NOT NULL,
  usuario_id      UUID                    NOT NULL,
  tipo            tipo_evento_investimento NOT NULL,
  valor           NUMERIC(10,2)           NOT NULL CHECK (valor > 0),
  data            DATE                    NOT NULL,
  descricao       TEXT,
  created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT fk_inv_evento_investimento FOREIGN KEY (investimento_id)
    REFERENCES investimentos (id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_evento_usuario      FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE
);

COMMENT ON TABLE investimentos_eventos IS 'Eventos de investimento. Soft-delete.';

CREATE INDEX idx_inv_eventos_investimento_data ON investimentos_eventos (investimento_id, data);
CREATE INDEX idx_inv_eventos_usuario_data      ON investimentos_eventos (usuario_id, data);

-- =============================================================================
-- DOMAIN: METAS
-- =============================================================================

-- Metas financeiras do usuário.
-- valor_atual = SUM(metas_movimentos.valor) — não armazenado.
CREATE TABLE metas (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID         NOT NULL,
  nome        VARCHAR(255) NOT NULL,
  tipo        tipo_meta    NOT NULL DEFAULT 'economia',
  valor_alvo  NUMERIC(10,2) NOT NULL CHECK (valor_alvo > 0),
  data_inicio DATE         NOT NULL,
  data_fim    DATE,
  status      status_meta  NOT NULL DEFAULT 'ativa',
  icone       VARCHAR(50),
  cor         VARCHAR(7)   CHECK (cor ~ '^#[0-9A-Fa-f]{6}$'),
  observacoes TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,

  CONSTRAINT fk_metas_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE
);

COMMENT ON TABLE  metas            IS 'Metas financeiras. valor_atual = SUM(metas_movimentos). Soft-delete.';
COMMENT ON COLUMN metas.valor_alvo IS 'Valor-alvo da meta. Progresso em metas_movimentos.';

CREATE INDEX idx_metas_usuario_status ON metas (usuario_id, status);

-- Movimentos de aportes e resgates em metas.
CREATE TABLE metas_movimentos (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id         UUID         NOT NULL,
  usuario_id      UUID         NOT NULL,
  valor           NUMERIC(10,2) NOT NULL,
  data            DATE         NOT NULL,
  descricao       TEXT,
  movimentacao_id UUID,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT fk_mm_meta         FOREIGN KEY (meta_id)
    REFERENCES metas (id) ON DELETE CASCADE,
  CONSTRAINT fk_mm_usuario      FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_mm_movimentacao FOREIGN KEY (movimentacao_id)
    REFERENCES movimentacoes_caixa (id) ON DELETE SET NULL
);

COMMENT ON TABLE  metas_movimentos              IS 'Aportes/resgates em metas. Soft-delete.';
COMMENT ON COLUMN metas_movimentos.valor        IS 'Positivo = aporte, negativo = resgate.';
COMMENT ON COLUMN metas_movimentos.movimentacao_id IS 'Vincula ao lançamento real quando existir.';

CREATE INDEX idx_metas_mov_meta_data ON metas_movimentos (meta_id, data);

-- =============================================================================
-- DOMAIN: ANEXOS
-- =============================================================================

-- Arquivos anexados (comprovantes, documentos, etc.).
-- hash_sha256 permite deduplicação por usuário.
CREATE TABLE anexos (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID         NOT NULL,
  nome_original  VARCHAR(255) NOT NULL,
  nome_arquivo   VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(100) NOT NULL,
  tamanho_bytes  BIGINT       NOT NULL CHECK (tamanho_bytes > 0),
  url            TEXT         NOT NULL,
  hash_sha256    VARCHAR(64)  CHECK (hash_sha256 ~ '^[0-9a-f]{64}$'),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,

  CONSTRAINT fk_anexos_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE
);

COMMENT ON TABLE  anexos             IS 'Arquivos anexos. Deduplicação via hash_sha256. Soft-delete.';
COMMENT ON COLUMN anexos.hash_sha256 IS 'SHA-256 do conteúdo binário. NULL para arquivos não deduplificados.';

CREATE INDEX idx_anexos_usuario_hash ON anexos (usuario_id, hash_sha256) WHERE hash_sha256 IS NOT NULL;

-- Vínculos polimórficos entre anexos e entidades.
CREATE TABLE anexos_vinculos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  anexo_id      UUID        NOT NULL,
  entidade_tipo VARCHAR(50) NOT NULL,
  entidade_id   UUID        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_avinculos_anexo FOREIGN KEY (anexo_id)
    REFERENCES anexos (id) ON DELETE CASCADE,
  CONSTRAINT ck_avinculos_tipo  CHECK (
    entidade_tipo IN ('contas_pagar', 'contas_receber', 'investimentos', 'metas', 'movimentacoes_caixa')
  )
);

COMMENT ON TABLE  anexos_vinculos              IS 'Vínculo polimórfico anexo ↔ entidade. Sem soft-delete.';
COMMENT ON COLUMN anexos_vinculos.entidade_tipo IS 'Nome da tabela: contas_pagar | contas_receber | investimentos | metas | movimentacoes_caixa.';

CREATE INDEX idx_avinculos_entidade ON anexos_vinculos (entidade_tipo, entidade_id);
CREATE INDEX idx_avinculos_anexo    ON anexos_vinculos (anexo_id);

-- =============================================================================
-- DOMAIN: WHATSAPP
-- =============================================================================

-- Log de mensagens WhatsApp.
-- BIGSERIAL: alto volume de mensagens. Hard-delete (sem deleted_at).
CREATE TABLE whatsapp_logs (
  id                  BIGSERIAL    PRIMARY KEY,
  usuario_id          UUID,
  provider            VARCHAR(50)  NOT NULL,
  telefone            VARCHAR(20)  NOT NULL,
  direcao             VARCHAR(10)  NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  tipo_mensagem       VARCHAR(50)  NOT NULL,
  conteudo            TEXT,
  status              VARCHAR(50),
  provider_message_id VARCHAR(255),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_wa_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE SET NULL
);

COMMENT ON TABLE  whatsapp_logs           IS 'Logs WhatsApp. BIGSERIAL, hard-delete.';
COMMENT ON COLUMN whatsapp_logs.direcao   IS 'Direção da mensagem: entrada (recebida) | saida (enviada).';
COMMENT ON COLUMN whatsapp_logs.usuario_id IS 'SET NULL ao deletar usuário (preserva histórico de auditoria).';

CREATE INDEX idx_wa_logs_usuario_data ON whatsapp_logs (usuario_id, created_at);

-- =============================================================================
-- DOMAIN: SISTEMA
-- =============================================================================

-- Fila de jobs assíncronos.
-- BIGSERIAL: alta rotatividade. Hard-delete (sem deleted_at).
CREATE TABLE jobs (
  id             BIGSERIAL    PRIMARY KEY,
  tipo           VARCHAR(100) NOT NULL,
  payload        JSONB,
  status         VARCHAR(50)  NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'processando', 'concluido', 'falhou')),
  tentativas     INTEGER      NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  max_tentativas INTEGER      NOT NULL DEFAULT 3 CHECK (max_tentativas > 0),
  erro           TEXT,
  agendado_para  TIMESTAMPTZ,
  iniciado_em    TIMESTAMPTZ,
  concluido_em   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  jobs             IS 'Fila de jobs assíncronos. BIGSERIAL, hard-delete.';
COMMENT ON COLUMN jobs.tipo        IS 'Identificador do job: email.enviar | assinatura.renovar | etc.';
COMMENT ON COLUMN jobs.tentativas  IS 'Número de tentativas já realizadas.';

CREATE INDEX idx_jobs_status_agendado ON jobs (status, agendado_para)
  WHERE status IN ('pendente', 'falhou');
