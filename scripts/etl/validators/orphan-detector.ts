import { PrismaClient } from '@prisma/client';

export interface OrphanResult {
  table: string;
  fkColumn: string;
  referencedTable: string;
  orphanCount: number;
  sampleIds: string[];
}

export class OrphanDetector {
  constructor(private readonly prisma: PrismaClient) {}

  private async detectOrphans(
    childTable: string,
    fkColumn: string,
    parentTable: string,
    parentIdColumn = 'id',
  ): Promise<OrphanResult> {
    const result = await this.prisma.$queryRawUnsafe<Array<{ orphan_id: string }>>(
      `
      SELECT c."${fkColumn}" AS orphan_id
      FROM "${childTable}" c
      LEFT JOIN "${parentTable}" p ON p."${parentIdColumn}" = c."${fkColumn}"
      WHERE c."${fkColumn}" IS NOT NULL AND p."${parentIdColumn}" IS NULL
      LIMIT 20
      `,
    ).catch(() => [] as Array<{ orphan_id: string }>);

    const countResult = await this.prisma.$queryRawUnsafe<[{ n: bigint }]>(
      `
      SELECT COUNT(*) AS n
      FROM "${childTable}" c
      LEFT JOIN "${parentTable}" p ON p."${parentIdColumn}" = c."${fkColumn}"
      WHERE c."${fkColumn}" IS NOT NULL AND p."${parentIdColumn}" IS NULL
      `,
    ).catch(() => [{ n: BigInt(0) }]);

    return {
      table: childTable,
      fkColumn,
      referencedTable: parentTable,
      orphanCount: Number(countResult[0]?.n ?? 0),
      sampleIds: result.map((r) => String(r.orphan_id)),
    };
  }

  async detectAll(): Promise<OrphanResult[]> {
    const checks: Array<[string, string, string]> = [
      ['assinantes', 'usuario_id', 'usuarios'],
      ['assinantes', 'cupom_id', 'cupons'],
      ['assinantes_pagamentos', 'assinante_id', 'assinantes'],
      ['assinantes_pagamentos', 'usuario_id', 'usuarios'],
      ['contas', 'usuario_id', 'usuarios'],
      ['contas', 'instituicao_financeira_id', 'instituicoes_financeiras'],
      ['categorias', 'usuario_id', 'usuarios'],
      ['contas_pagar', 'usuario_id', 'usuarios'],
      ['contas_pagar', 'categoria_id', 'categorias'],
      ['contas_pagar', 'conta_id', 'contas'],
      ['contas_receber', 'usuario_id', 'usuarios'],
      ['contas_receber', 'categoria_id', 'categorias'],
      ['contas_receber', 'conta_id', 'contas'],
      ['movimentacoes_caixa', 'usuario_id', 'usuarios'],
      ['movimentacoes_caixa', 'conta_id', 'contas'],
      ['movimentacoes_caixa', 'categoria_id', 'categorias'],
      ['movimentacoes_caixa', 'conta_destino_id', 'contas'],
      ['movimentacoes_caixa', 'conta_pagar_id', 'contas_pagar'],
      ['movimentacoes_caixa', 'conta_receber_id', 'contas_receber'],
      ['investimentos', 'usuario_id', 'usuarios'],
      ['investimentos', 'tipo_id', 'tipos_investimento'],
      ['investimentos', 'instituicao_id', 'instituicoes_financeiras'],
      ['investimentos_eventos', 'investimento_id', 'investimentos'],
      ['investimentos_eventos', 'usuario_id', 'usuarios'],
      ['metas', 'usuario_id', 'usuarios'],
      ['metas_movimentos', 'meta_id', 'metas'],
      ['metas_movimentos', 'usuario_id', 'usuarios'],
      ['metas_movimentos', 'movimentacao_id', 'movimentacoes_caixa'],
      ['anexos', 'usuario_id', 'usuarios'],
      ['anexos_vinculos', 'anexo_id', 'anexos'],
    ];

    const results: OrphanResult[] = [];

    for (const [childTable, fkColumn, parentTable] of checks) {
      const result = await this.detectOrphans(childTable, fkColumn, parentTable).catch(
        () =>
          ({
            table: childTable,
            fkColumn,
            referencedTable: parentTable,
            orphanCount: -1,
            sampleIds: [],
          }) as OrphanResult,
      );
      results.push(result);
    }

    const orphansFound = results.filter((r) => r.orphanCount > 0);
    if (orphansFound.length === 0) {
      console.log('   ✅ Nenhum orphan encontrado');
    } else {
      for (const orphan of orphansFound) {
        console.log(
          `   ⚠️  ${orphan.table}.${orphan.fkColumn} → ${orphan.referencedTable}: ${orphan.orphanCount} orphans`,
        );
      }
    }

    return results;
  }
}
