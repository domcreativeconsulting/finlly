import { BaseExtractor } from '../extractors/base.extractor';
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

/** The 20 entity tables that hold migrated data — MySQL and Postgres use the same table names */
const TABLE_PAIRS: Array<{
  mysqlTable: string;
  postgresTable: string;
  label: string;
}> = [
  { mysqlTable: 'usuarios', postgresTable: 'usuarios', label: 'usuarios' },
  { mysqlTable: 'cupons', postgresTable: 'cupons', label: 'cupons' },
  { mysqlTable: 'assinantes', postgresTable: 'assinantes', label: 'assinantes' },
  {
    mysqlTable: 'assinantes_pagamentos',
    postgresTable: 'assinantes_pagamentos',
    label: 'assinantes_pagamentos',
  },
  {
    mysqlTable: 'webhook_events',
    postgresTable: 'webhook_events',
    label: 'webhook_events',
  },
  {
    mysqlTable: 'instituicoes_financeiras',
    postgresTable: 'instituicoes_financeiras',
    label: 'instituicoes_financeiras',
  },
  { mysqlTable: 'contas', postgresTable: 'contas', label: 'contas' },
  {
    mysqlTable: 'categorias',
    postgresTable: 'categorias',
    label: 'categorias',
  },
  { mysqlTable: 'contas_pagar', postgresTable: 'contas_pagar', label: 'contas_pagar' },
  {
    mysqlTable: 'contas_receber',
    postgresTable: 'contas_receber',
    label: 'contas_receber',
  },
  {
    mysqlTable: 'movimentacoes_caixa',
    postgresTable: 'movimentacoes_caixa',
    label: 'movimentacoes_caixa',
  },
  {
    mysqlTable: 'tipos_investimento',
    postgresTable: 'tipos_investimento',
    label: 'tipos_investimento',
  },
  {
    mysqlTable: 'investimentos',
    postgresTable: 'investimentos',
    label: 'investimentos',
  },
  {
    mysqlTable: 'investimentos_eventos',
    postgresTable: 'investimentos_eventos',
    label: 'investimentos_eventos',
  },
  { mysqlTable: 'metas', postgresTable: 'metas', label: 'metas' },
  {
    mysqlTable: 'metas_movimentos',
    postgresTable: 'metas_movimentos',
    label: 'metas_movimentos',
  },
  { mysqlTable: 'anexos', postgresTable: 'anexos', label: 'anexos' },
  {
    mysqlTable: 'anexos_vinculos',
    postgresTable: 'anexos_vinculos',
    label: 'anexos_vinculos',
  },
  {
    mysqlTable: 'whatsapp_logs',
    postgresTable: 'whatsapp_logs',
    label: 'whatsapp_logs',
  },
  { mysqlTable: 'jobs', postgresTable: 'jobs', label: 'jobs' },
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
        .catch((err: Error) => {
          console.warn(`   ⚠️  Não foi possível contar ${pair.mysqlTable} no MySQL: ${err.message}`);
          return 0;
        });
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
