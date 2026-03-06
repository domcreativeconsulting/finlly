import { BaseExtractor } from '../extractors/base.extractor.js';
import { PrismaClient } from '@prisma/client';
import { mapId } from '../transformers/id-mapper.js';

export interface SampleCheckResult {
  table: string;
  mysqlId: number;
  postgresId: string;
  found: boolean;
  fieldChecks: FieldCheck[];
}

export interface FieldCheck {
  field: string;
  mysqlValue: unknown;
  postgresValue: unknown;
  match: boolean;
  note?: string;
}

export class SampleValidator {
  constructor(
    private readonly extractor: BaseExtractor,
    private readonly prisma: PrismaClient,
    private readonly sampleSize: number = 15,
  ) {}

  private async randomSample(
    mysqlTable: string,
    sampleSize: number,
  ): Promise<Array<{ id: number }>> {
    return this.extractor['query']<{ id: number }>(
      `SELECT id FROM ${mysqlTable} ORDER BY RAND() LIMIT ?`,
      [sampleSize],
    );
  }

  private uuidCheck(id: number, pgId: string): FieldCheck {
    return {
      field: 'id_format',
      mysqlValue: `INT(${id})`,
      postgresValue: pgId,
      match: pgId.length === 36,
      note: 'UUID deve ter 36 caracteres',
    };
  }

  private timestampCheck(field: string, value: Date | null | undefined): FieldCheck {
    return {
      field,
      mysqlValue: value,
      postgresValue: value instanceof Date ? value.toISOString() : null,
      match: value instanceof Date,
      note: 'TIMESTAMPTZ deve ser instância de Date',
    };
  }

  async validateUsuarios(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('usuarios', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'users');
      const [mysql, pg] = await Promise.all([
        this.extractor['query']<Record<string, unknown>>(`SELECT * FROM usuarios WHERE id = ?`, [id])
          .then((r) => r[0])
          .catch(() => undefined),
        this.prisma.usuario.findUnique({ where: { id: pgId } }).catch(() => undefined),
      ]);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (mysql && pg) {
        fieldChecks.push({
          field: 'email',
          mysqlValue: mysql['email'],
          postgresValue: pg.email,
          match: String(mysql['email']).toLowerCase().trim() === pg.email,
        });
        fieldChecks.push(this.uuidCheck(id, pgId));
        fieldChecks.push(this.timestampCheck('created_at_format', pg.created_at));
      }

      results.push({ table: 'usuarios', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateCupons(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('cupons', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'cupons');
      const pg = await this.prisma.cupom.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
        // ck_cupons_desconto: exactly one must be non-null
        const dp = pg.desconto_percentual;
        const df = pg.desconto_fixo;
        fieldChecks.push({
          field: 'ck_cupons_desconto',
          mysqlValue: { desconto_percentual: dp, desconto_fixo: df },
          postgresValue: { desconto_percentual: dp, desconto_fixo: df },
          match: (dp != null) !== (df != null),
          note: 'Exatamente um de desconto_percentual/desconto_fixo deve estar preenchido',
        });
      }

      results.push({ table: 'cupons', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateAssinantes(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('assinantes', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'plans');
      const pg = await this.prisma.assinante.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
        fieldChecks.push(this.timestampCheck('created_at', pg.created_at));
      }

      results.push({ table: 'assinantes', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateAssinantesPagamentos(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('assinantes_pagamentos', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'payments');
      const pg = await this.prisma.assinantePagamento.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
        const valor = Number(pg.valor);
        fieldChecks.push({
          field: 'valor_nao_negativo',
          mysqlValue: valor,
          postgresValue: valor,
          match: valor >= 0,
          note: 'valor deve ser >= 0',
        });
      }

      results.push({ table: 'assinantes_pagamentos', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateWebhookEvents(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('webhook_events', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      // webhook_events uses provider+event_id as the business key; find by event_id from MySQL
      const mysql = await this.extractor['query']<Record<string, unknown>>(
        `SELECT * FROM webhook_events WHERE id = ?`,
        [id],
      )
        .then((r) => r[0])
        .catch(() => undefined);

      const found = mysql != null;
      const fieldChecks: FieldCheck[] = [];

      if (mysql) {
        const pgRecord = await this.prisma.webhookEvent
          .findFirst({ where: { event_id: String(mysql['event_id'] ?? '') } })
          .catch(() => undefined);

        fieldChecks.push({
          field: 'event_migrated',
          mysqlValue: mysql['event_id'],
          postgresValue: pgRecord?.event_id ?? null,
          match: pgRecord != null,
          note: 'event_id deve estar presente no Postgres',
        });
      }

      results.push({ table: 'webhook_events', mysqlId: id, postgresId: String(id), found, fieldChecks });
    }

    return results;
  }

  async validateInstituicoesFinanceiras(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('instituicoes_financeiras', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'banks');
      const pg = await this.prisma.instituicaoFinanceira.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
      }

      results.push({ table: 'instituicoes_financeiras', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateContas(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('contas', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'accounts');
      const pg = await this.prisma.conta.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
        // balance should NOT be present in v2
        fieldChecks.push({
          field: 'balance_removed',
          mysqlValue: 'present',
          postgresValue: 'absent',
          match: !('balance' in pg),
          note: 'Campo balance deve ter sido removido',
        });
      }

      results.push({ table: 'contas', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateCategorias(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('categorias', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'categories');
      const pg = await this.prisma.categoria.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
      }

      results.push({ table: 'categorias', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateContasPagar(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('contas_pagar', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'bills');
      const pg = await this.prisma.contaPagar.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
        const valor = Number(pg.valor);
        fieldChecks.push({
          field: 'valor_positivo',
          mysqlValue: valor,
          postgresValue: valor,
          match: valor > 0,
          note: 'valor deve ser > 0',
        });
      }

      results.push({ table: 'contas_pagar', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateContasReceber(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('contas_receber', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'receivables');
      const pg = await this.prisma.contaReceber.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
        const valor = Number(pg.valor);
        fieldChecks.push({
          field: 'valor_positivo',
          mysqlValue: valor,
          postgresValue: valor,
          match: valor > 0,
          note: 'valor deve ser > 0',
        });
      }

      results.push({ table: 'contas_receber', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateMovimentacoesCaixa(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('movimentacoes_caixa', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'transactions');
      const pg = await this.prisma.movimentacaoCaixa.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
        const valor = Number(pg.valor);
        fieldChecks.push({
          field: 'valor_positivo',
          mysqlValue: valor,
          postgresValue: valor,
          match: valor > 0,
          note: 'valor deve ser > 0',
        });
      }

      results.push({ table: 'movimentacoes_caixa', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateTiposInvestimento(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('tipos_investimento', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'investment_types');
      const pg = await this.prisma.tipoInvestimento.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
      }

      results.push({ table: 'tipos_investimento', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateInvestimentos(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('investimentos', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'investments');
      const pg = await this.prisma.investimento.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
        // current_value should NOT be present in v2
        fieldChecks.push({
          field: 'current_value_removed',
          mysqlValue: 'present',
          postgresValue: 'absent',
          match: !('current_value' in pg),
          note: 'Campo current_value deve ter sido removido',
        });
      }

      results.push({ table: 'investimentos', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateInvestimentosEventos(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('investimentos_eventos', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'investment_events');
      const pg = await this.prisma.investimentoEvento.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
        const valor = Number(pg.valor);
        fieldChecks.push({
          field: 'valor_positivo',
          mysqlValue: valor,
          postgresValue: valor,
          match: valor > 0,
          note: 'valor deve ser > 0',
        });
      }

      results.push({ table: 'investimentos_eventos', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateMetas(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('metas', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'goals');
      const pg = await this.prisma.meta.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
        const va = Number(pg.valor_alvo);
        fieldChecks.push({
          field: 'valor_alvo_positivo',
          mysqlValue: va,
          postgresValue: va,
          match: va > 0,
          note: 'valor_alvo deve ser > 0',
        });
        // current_amount should NOT be present in v2
        fieldChecks.push({
          field: 'current_amount_removed',
          mysqlValue: 'present',
          postgresValue: 'absent',
          match: !('current_amount' in pg),
          note: 'Campo current_amount deve ter sido removido',
        });
      }

      results.push({ table: 'metas', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateMetasMovimentos(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('metas_movimentos', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'goal_movements');
      const pg = await this.prisma.metaMovimento.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
      }

      results.push({ table: 'metas_movimentos', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateAnexos(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('anexos', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'attachments');
      const pg = await this.prisma.anexo.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
        const tb = Number(pg.tamanho_bytes);
        fieldChecks.push({
          field: 'tamanho_bytes_positivo',
          mysqlValue: tb,
          postgresValue: tb,
          match: tb > 0,
          note: 'tamanho_bytes deve ser > 0',
        });
      }

      results.push({ table: 'anexos', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateAnexosVinculos(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('anexos_vinculos', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'attachment_relations');
      const pg = await this.prisma.anexoVinculo.findUnique({ where: { id: pgId } }).catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push(this.uuidCheck(id, pgId));
      }

      results.push({ table: 'anexos_vinculos', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  /** Runs all sample validators and returns a flat list of results */
  async validateAll(): Promise<SampleCheckResult[]> {
    const all: SampleCheckResult[] = [];

    const validators = [
      () => this.validateUsuarios(),
      () => this.validateCupons(),
      () => this.validateAssinantes(),
      () => this.validateAssinantesPagamentos(),
      () => this.validateWebhookEvents(),
      () => this.validateInstituicoesFinanceiras(),
      () => this.validateContas(),
      () => this.validateCategorias(),
      () => this.validateContasPagar(),
      () => this.validateContasReceber(),
      () => this.validateMovimentacoesCaixa(),
      () => this.validateTiposInvestimento(),
      () => this.validateInvestimentos(),
      () => this.validateInvestimentosEventos(),
      () => this.validateMetas(),
      () => this.validateMetasMovimentos(),
      () => this.validateAnexos(),
      () => this.validateAnexosVinculos(),
    ];

    for (const fn of validators) {
      const results = await fn().catch((err) => {
        console.error(`   ⚠️  Erro ao executar sample validator: ${(err as Error).message}`);
        return [] as SampleCheckResult[];
      });
      all.push(...results);
    }

    const failed = all.filter((r) => !r.found || r.fieldChecks.some((c) => !c.match));
    const passed = all.filter((r) => r.found && r.fieldChecks.every((c) => c.match));

    console.log(`   ✅ ${passed.length} amostras OK — ⚠️  ${failed.length} com problemas`);
    return all;
  }
}

