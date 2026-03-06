import { writeFileSync } from 'fs';
import { join } from 'path';
import type { TableCountResult } from '../validators/count-validator';
import type { SampleCheckResult } from '../validators/sample-validator';
import type { OrphanResult } from '../validators/orphan-detector';
import type { DataValidationSummary } from '../validators/data-validator';

export type MigrationStatus = 'success' | 'error' | 'partial';

export interface TransformacaoInfo {
  ids_mapeados: number;
  tipos_convertidos: string[];
  campos_removidos: string[];
  campos_adicionados: string[];
}

export interface DataQualityMetrics {
  total_violacoes: number;
  linhas_sanitizadas: number;
  linhas_ignoradas: number;
  por_tabela: Array<{
    tabela: string;
    total_linhas: number;
    violacoes: number;
  }>;
}

export interface MigrationReport {
  timestamp: string;
  status: MigrationStatus;
  modo: 'dry_run' | 'execucao_real';
  summary: {
    total_tabelas: number;
    tabelas_ok: number;
    tabelas_com_erro: number;
    total_registros_mysql: number;
    total_registros_postgres: number;
    total_erros: number;
    total_avisos: number;
  };
  por_tabela: Array<{
    tabela: string;
    mysql_count: number;
    postgres_count: number;
    status: 'ok' | 'mismatch' | 'erro';
  }>;
  amostras: Array<{
    tabela: string;
    mysql_id: number;
    postgres_id: string;
    encontrado: boolean;
    campos_ok: number;
    campos_com_erro: number;
  }>;
  orphans_found: Array<{
    tabela: string;
    coluna_fk: string;
    tabela_referenciada: string;
    quantidade: number;
    exemplos: string[];
  }>;
  qualidade_dados: DataQualityMetrics;
  linhas_com_falha: {
    total: number;
    por_tabela: {
      [table: string]: {
        count: number;
        motivo: string;
      };
    };
  };
  transformacoes_aplicadas: TransformacaoInfo;
  erros: string[];
}

export class ReportGenerator {
  private errors: string[] = [];

  addError(message: string): void {
    this.errors.push(message);
  }

  generate(
    status: MigrationStatus,
    dryRun: boolean,
    countResults: TableCountResult[],
    sampleResults: SampleCheckResult[],
    orphanResults: OrphanResult[],
    transformacaoInfo: TransformacaoInfo,
    dataValidation?: DataValidationSummary,
    failedRows?: Array<{ table: string; rowIndex: number; error: string }>,
  ): MigrationReport {
    const totalMysql = countResults.reduce((s, r) => s + (r.mysqlCount >= 0 ? r.mysqlCount : 0), 0);
    const totalPostgres = countResults.reduce(
      (s, r) => s + (r.postgresCount >= 0 ? r.postgresCount : 0),
      0,
    );
    const tabelasOk = countResults.filter((r) => r.match).length;
    const tabelasErro = countResults.filter((r) => !r.match).length;
    const orphansFound = orphanResults.filter((r) => r.orphanCount > 0);
    const sampleErros = sampleResults.filter(
      (r) => !r.found || r.fieldChecks.some((c) => !c.match),
    );

    const qualidade_dados: DataQualityMetrics = dataValidation
      ? {
          total_violacoes: dataValidation.totalViolations,
          linhas_sanitizadas: dataValidation.tableResults.reduce(
            (s, r) => s + r.violationsFound,
            0,
          ),
          linhas_ignoradas: failedRows?.length ?? 0,
          por_tabela: dataValidation.tableResults.map((r) => ({
            tabela: r.table,
            total_linhas: r.totalRows,
            violacoes: r.violationsFound,
          })),
        }
      : {
          total_violacoes: 0,
          linhas_sanitizadas: 0,
          linhas_ignoradas: failedRows?.length ?? 0,
          por_tabela: [],
        };

    return {
      timestamp: new Date().toISOString(),
      status,
      modo: dryRun ? 'dry_run' : 'execucao_real',
      summary: {
        total_tabelas: countResults.length,
        tabelas_ok: tabelasOk,
        tabelas_com_erro: tabelasErro,
        total_registros_mysql: totalMysql,
        total_registros_postgres: totalPostgres,
        total_erros: this.errors.length,
        total_avisos: orphansFound.length + sampleErros.length + (dataValidation?.totalViolations ?? 0),
      },
      por_tabela: countResults.map((r) => ({
        tabela: r.table,
        mysql_count: r.mysqlCount,
        postgres_count: r.postgresCount,
        status: r.mysqlCount < 0 || r.postgresCount < 0 ? 'erro' : r.match ? 'ok' : 'mismatch',
      })),
      amostras: sampleResults.map((r) => ({
        tabela: r.table,
        mysql_id: r.mysqlId,
        postgres_id: r.postgresId,
        encontrado: r.found,
        campos_ok: r.fieldChecks.filter((c) => c.match).length,
        campos_com_erro: r.fieldChecks.filter((c) => !c.match).length,
      })),
      orphans_found: orphanResults
        .filter((r) => r.orphanCount > 0)
        .map((r) => ({
          tabela: r.table,
          coluna_fk: r.fkColumn,
          tabela_referenciada: r.referencedTable,
          quantidade: r.orphanCount,
          exemplos: r.sampleIds,
        })),
      qualidade_dados,
      linhas_com_falha: (() => {
        const rows = failedRows ?? [];
        const porTabela: { [table: string]: { count: number; motivo: string } } = {};
        for (const r of rows) {
          if (!porTabela[r.table]) {
            porTabela[r.table] = { count: 0, motivo: r.error };
          } else if (!porTabela[r.table]!.motivo.includes(r.error)) {
            porTabela[r.table]!.motivo += `; ${r.error}`;
          }
          porTabela[r.table]!.count += 1;
        }
        return { total: rows.length, por_tabela: porTabela };
      })(),
      transformacoes_aplicadas: transformacaoInfo,
      erros: this.errors,
    };
  }

  save(report: MigrationReport, outputDir = '.'): string {
    const date = new Date().toISOString().slice(0, 10);
    const filename = `migration-report-${date}.json`;
    const filepath = join(outputDir, filename);
    writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
    return filepath;
  }
}
