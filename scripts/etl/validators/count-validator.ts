import { BaseExtractor } from '../extractors/base.extractor.js';
import { PrismaClient } from '@prisma/client';

export interface TableCountResult {
  table: string;
  mysqlTable: string;
  postgresTable: string;
  mysqlCount: number;
  postgresCount: number;
  match: boolean;
  discrepancy: number;
}

/** The 20 entity tables that hold migrated data (excludes BIGSERIAL tables like jobs/whatsapp_logs) */
const TABLE_PAIRS: Array<{
  mysqlTable: string;
  postgresTable: string;
  label: string;
}> = [
  { mysqlTable: 'usuarios', postgresTable: 'usuarios', label: 'usuarios' },
  { mysqlTable: 'cupons', postgresTable: 'cupons', label: 'cupons' },
  { mysqlTable: 'plans', postgresTable: 'assinantes', label: 'assinantes' },
  {
    mysqlTable: 'payments',
    postgresTable: 'assinantes_pagamentos',
    label: 'assinantes_pagamentos',
  },
  {
    mysqlTable: 'webhook_logs',
    postgresTable: 'webhook_events',
    label: 'webhook_events',
  },
  {
    mysqlTable: 'banks',
    postgresTable: 'instituicoes_financeiras',
    label: 'instituicoes_financeiras',
  },
  { mysqlTable: 'accounts', postgresTable: 'contas', label: 'contas' },
  {
    mysqlTable: 'categories',
    postgresTable: 'categorias',
    label: 'categorias',
  },
  { mysqlTable: 'bills', postgresTable: 'contas_pagar', label: 'contas_pagar' },
  {
    mysqlTable: 'receivables',
    postgresTable: 'contas_receber',
    label: 'contas_receber',
  },
  {
    mysqlTable: 'transactions',
    postgresTable: 'movimentacoes_caixa',
    label: 'movimentacoes_caixa',
  },
  {
    mysqlTable: 'investment_types',
    postgresTable: 'tipos_investimento',
    label: 'tipos_investimento',
  },
  {
    mysqlTable: 'investments',
    postgresTable: 'investimentos',
    label: 'investimentos',
  },
  {
    mysqlTable: 'investment_events',
    postgresTable: 'investimentos_eventos',
    label: 'investimentos_eventos',
  },
  { mysqlTable: 'goals', postgresTable: 'metas', label: 'metas' },
  {
    mysqlTable: 'goal_movements',
    postgresTable: 'metas_movimentos',
    label: 'metas_movimentos',
  },
  { mysqlTable: 'attachments', postgresTable: 'anexos', label: 'anexos' },
  {
    mysqlTable: 'attachment_relations',
    postgresTable: 'anexos_vinculos',
    label: 'anexos_vinculos',
  },
  {
    mysqlTable: 'whatsapp_messages',
    postgresTable: 'whatsapp_logs',
    label: 'whatsapp_logs',
  },
  { mysqlTable: 'background_jobs', postgresTable: 'jobs', label: 'jobs' },
];

export class CountValidator {
  constructor(
    private readonly extractor: BaseExtractor,
    private readonly prisma: PrismaClient
  ) {}

  async validateAll(): Promise<TableCountResult[]> {
    const results: TableCountResult[] = [];

    for (const pair of TABLE_PAIRS) {
      const mysqlCount = await this.extractor
        .count(pair.mysqlTable)
        .catch(() => -1);
      const pgResult = await this.prisma
        .$queryRawUnsafe<
          [{ n: bigint }]
        >(`SELECT COUNT(*) AS n FROM "${pair.postgresTable}"`)
        .catch(() => [{ n: BigInt(-1) }]);
      const postgresCount = Number(pgResult[0]?.n ?? -1);

      const match = mysqlCount === postgresCount;
      const discrepancy = postgresCount - mysqlCount;

      const icon = match ? '✅' : '⚠️ ';
      console.log(
        `   ${icon} ${pair.label}: MySQL=${mysqlCount}, Postgres=${postgresCount}${match ? '' : ` (diferença: ${discrepancy})`}`
      );

      results.push({
        table: pair.label,
        mysqlTable: pair.mysqlTable,
        postgresTable: pair.postgresTable,
        mysqlCount,
        postgresCount,
        match,
        discrepancy,
      });
    }

    return results;
  }

  static summarize(results: TableCountResult[]): {
    allMatch: boolean;
    mismatches: TableCountResult[];
  } {
    const mismatches = results.filter((r) => !r.match);
    return { allMatch: mismatches.length === 0, mismatches };
  }
}
