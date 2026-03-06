/**
 * DataValidator — pre-load constraint checker.
 *
 * Validates transformed rows against Postgres CHECK constraints and NOT NULL
 * rules before the LOAD phase.  Returns a summary of violations found so that
 * the ETL can surface data-quality warnings in the migration report without
 * aborting the run.
 */

export interface ValidationViolation {
  table: string;
  rowId: string;
  field: string;
  rule: string;
  actualValue: unknown;
  sanitizedValue?: unknown;
}

export interface TableValidationResult {
  table: string;
  totalRows: number;
  violationsFound: number;
  violations: ValidationViolation[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function violation(
  table: string,
  rowId: string,
  field: string,
  rule: string,
  actualValue: unknown,
  sanitizedValue?: unknown,
): ValidationViolation {
  return { table, rowId, field, rule, actualValue, sanitizedValue };
}

function rowId(row: Record<string, unknown>): string {
  return String(row['id'] ?? 'unknown');
}

// ---------------------------------------------------------------------------
// Per-table validators
// ---------------------------------------------------------------------------

export function validateCupons(
  rows: Record<string, unknown>[],
): TableValidationResult {
  const violations: ValidationViolation[] = [];

  for (const row of rows) {
    const id = rowId(row);
    const dp = row['desconto_percentual'] as number | undefined;
    const df = row['desconto_fixo'] as number | undefined;

    // ck_cupons_desconto: exactly one must be non-null
    const bothNull = dp == null && df == null;
    const bothSet = dp != null && df != null;
    if (bothNull || bothSet) {
      violations.push(
        violation(
          'cupons',
          id,
          bothNull ? 'desconto_percentual' : 'desconto_fixo',
          'ck_cupons_desconto: exactly one of desconto_percentual / desconto_fixo must be set',
          { desconto_percentual: dp, desconto_fixo: df },
        ),
      );
    }

    // desconto_percentual BETWEEN 0 AND 100
    if (dp != null && (dp < 0 || dp > 100)) {
      violations.push(
        violation('cupons', id, 'desconto_percentual', 'BETWEEN 0 AND 100', dp, Math.min(100, Math.max(0, dp))),
      );
    }

    // desconto_fixo >= 0
    if (df != null && df < 0) {
      violations.push(violation('cupons', id, 'desconto_fixo', '>= 0', df, 0));
    }

    // uso_maximo > 0 (if set)
    const um = row['uso_maximo'] as number | undefined;
    if (um != null && um <= 0) {
      violations.push(violation('cupons', id, 'uso_maximo', '> 0 or NULL', um, undefined));
    }

    // uso_atual >= 0
    const ua = row['uso_atual'] as number | undefined;
    if (ua != null && ua < 0) {
      violations.push(violation('cupons', id, 'uso_atual', '>= 0', ua, 0));
    }
  }

  return { table: 'cupons', totalRows: rows.length, violationsFound: violations.length, violations };
}

export function validateAssinantesPagamentos(
  rows: Record<string, unknown>[],
): TableValidationResult {
  const violations: ValidationViolation[] = [];

  for (const row of rows) {
    const id = rowId(row);
    const valor = row['valor'] as number | undefined;
    if (valor != null && valor < 0) {
      violations.push(violation('assinantes_pagamentos', id, 'valor', '>= 0', valor, 0));
    }
  }

  return {
    table: 'assinantes_pagamentos',
    totalRows: rows.length,
    violationsFound: violations.length,
    violations,
  };
}

export function validateContasPagar(
  rows: Record<string, unknown>[],
): TableValidationResult {
  const violations: ValidationViolation[] = [];

  for (const row of rows) {
    const id = rowId(row);

    // valor > 0
    const valor = row['valor'] as number | undefined;
    if (valor != null && valor <= 0) {
      violations.push(violation('contas_pagar', id, 'valor', '> 0', valor, 0.01));
    }

    // ck_cpagar_parcelas
    const pa = row['parcela_atual'] as number | undefined;
    const tp = row['total_parcelas'] as number | undefined;
    const bothParcNull = pa == null && tp == null;
    const bothParcSet = pa != null && tp != null;
    if (!bothParcNull && !bothParcSet) {
      violations.push(
        violation(
          'contas_pagar',
          id,
          'parcela_atual/total_parcelas',
          'ck_cpagar_parcelas: both null or both set with parcela_atual <= total_parcelas',
          { parcela_atual: pa, total_parcelas: tp },
        ),
      );
    }
    if (bothParcSet && pa! > tp!) {
      violations.push(
        violation(
          'contas_pagar',
          id,
          'parcela_atual',
          'parcela_atual <= total_parcelas',
          pa,
        ),
      );
    }
    if (pa != null && pa <= 0) {
      violations.push(violation('contas_pagar', id, 'parcela_atual', '> 0', pa, 1));
    }
    if (tp != null && tp <= 0) {
      violations.push(violation('contas_pagar', id, 'total_parcelas', '> 0', tp, 1));
    }
  }

  return {
    table: 'contas_pagar',
    totalRows: rows.length,
    violationsFound: violations.length,
    violations,
  };
}

export function validateContasReceber(
  rows: Record<string, unknown>[],
): TableValidationResult {
  const violations: ValidationViolation[] = [];

  for (const row of rows) {
    const id = rowId(row);

    // valor > 0
    const valor = row['valor'] as number | undefined;
    if (valor != null && valor <= 0) {
      violations.push(violation('contas_receber', id, 'valor', '> 0', valor, 0.01));
    }

    // ck_creceber_parcelas
    const pa = row['parcela_atual'] as number | undefined;
    const tp = row['total_parcelas'] as number | undefined;
    const bothParcNull = pa == null && tp == null;
    const bothParcSet = pa != null && tp != null;
    if (!bothParcNull && !bothParcSet) {
      violations.push(
        violation(
          'contas_receber',
          id,
          'parcela_atual/total_parcelas',
          'ck_creceber_parcelas: both null or both set with parcela_atual <= total_parcelas',
          { parcela_atual: pa, total_parcelas: tp },
        ),
      );
    }
    if (bothParcSet && pa! > tp!) {
      violations.push(
        violation('contas_receber', id, 'parcela_atual', 'parcela_atual <= total_parcelas', pa),
      );
    }
    if (pa != null && pa <= 0) {
      violations.push(violation('contas_receber', id, 'parcela_atual', '> 0', pa, 1));
    }
    if (tp != null && tp <= 0) {
      violations.push(violation('contas_receber', id, 'total_parcelas', '> 0', tp, 1));
    }
  }

  return {
    table: 'contas_receber',
    totalRows: rows.length,
    violationsFound: violations.length,
    violations,
  };
}

export function validateMovimentacoesCaixa(
  rows: Record<string, unknown>[],
): TableValidationResult {
  const violations: ValidationViolation[] = [];

  for (const row of rows) {
    const id = rowId(row);
    const valor = row['valor'] as number | undefined;
    if (valor != null && valor <= 0) {
      violations.push(violation('movimentacoes_caixa', id, 'valor', '> 0', valor, 0.01));
    }
  }

  return {
    table: 'movimentacoes_caixa',
    totalRows: rows.length,
    violationsFound: violations.length,
    violations,
  };
}

export function validateInvestimentosEventos(
  rows: Record<string, unknown>[],
): TableValidationResult {
  const violations: ValidationViolation[] = [];

  for (const row of rows) {
    const id = rowId(row);
    const valor = row['valor'] as number | undefined;
    if (valor != null && valor <= 0) {
      violations.push(violation('investimentos_eventos', id, 'valor', '> 0', valor, 0.01));
    }
  }

  return {
    table: 'investimentos_eventos',
    totalRows: rows.length,
    violationsFound: violations.length,
    violations,
  };
}

export function validateMetas(
  rows: Record<string, unknown>[],
): TableValidationResult {
  const violations: ValidationViolation[] = [];

  for (const row of rows) {
    const id = rowId(row);
    const va = row['valor_alvo'] as number | undefined;
    if (va != null && va <= 0) {
      violations.push(violation('metas', id, 'valor_alvo', '> 0', va, 0.01));
    }
  }

  return { table: 'metas', totalRows: rows.length, violationsFound: violations.length, violations };
}

export function validateAnexos(
  rows: Record<string, unknown>[],
): TableValidationResult {
  const violations: ValidationViolation[] = [];
  const SHA256_RE = /^[0-9a-f]{64}$/;

  for (const row of rows) {
    const id = rowId(row);

    // tamanho_bytes > 0
    const tb = Number(row['tamanho_bytes'] ?? 0);
    if (tb <= 0) {
      violations.push(violation('anexos', id, 'tamanho_bytes', '> 0', tb, 1));
    }

    // hash_sha256 format (if set)
    const hash = row['hash_sha256'] as string | undefined;
    if (hash != null && !SHA256_RE.test(hash)) {
      violations.push(
        violation('anexos', id, 'hash_sha256', '^[0-9a-f]{64}$', hash),
      );
    }
  }

  return { table: 'anexos', totalRows: rows.length, violationsFound: violations.length, violations };
}

export function validateJobs(
  rows: Record<string, unknown>[],
): TableValidationResult {
  const violations: ValidationViolation[] = [];
  const VALID_STATUS = new Set(['pendente', 'processando', 'concluido', 'falhou']);

  for (const row of rows) {
    const jobTipo = String(row['tipo'] ?? 'unknown');

    // status CHECK
    const status = row['status'] as string | undefined;
    if (status != null && !VALID_STATUS.has(status)) {
      violations.push(violation('jobs', jobTipo, 'status', "IN ('pendente','processando','concluido','falhou')", status, 'pendente'));
    }

    // tentativas >= 0
    const tent = row['tentativas'] as number | undefined;
    if (tent != null && tent < 0) {
      violations.push(violation('jobs', jobTipo, 'tentativas', '>= 0', tent, 0));
    }

    // max_tentativas > 0
    const maxTent = row['max_tentativas'] as number | undefined;
    if (maxTent != null && maxTent <= 0) {
      violations.push(violation('jobs', jobTipo, 'max_tentativas', '> 0', maxTent, 1));
    }
  }

  return { table: 'jobs', totalRows: rows.length, violationsFound: violations.length, violations };
}

export function validateWhatsappLogs(
  rows: Record<string, unknown>[],
): TableValidationResult {
  const violations: ValidationViolation[] = [];
  const VALID_DIRECAO = new Set(['entrada', 'saida']);

  for (const row of rows) {
    const id = rowId(row);
    const direcao = row['direcao'] as string | undefined;
    if (direcao != null && !VALID_DIRECAO.has(direcao)) {
      violations.push(
        violation('whatsapp_logs', id, 'direcao', "IN ('entrada','saida')", direcao, 'saida'),
      );
    }
  }

  return {
    table: 'whatsapp_logs',
    totalRows: rows.length,
    violationsFound: violations.length,
    violations,
  };
}

// ---------------------------------------------------------------------------
// Aggregate validator
// ---------------------------------------------------------------------------

export interface DataValidationSummary {
  totalViolations: number;
  tableResults: TableValidationResult[];
}

export class DataValidator {
  /**
   * Run all table-level validators against the provided transformed data sets.
   * Returns a summary of violations found across all tables.
   */
  validateAll(data: {
    cupons: Record<string, unknown>[];
    assinantesPagamentos: Record<string, unknown>[];
    contasPagar: Record<string, unknown>[];
    contasReceber: Record<string, unknown>[];
    movimentacoesCaixa: Record<string, unknown>[];
    investimentosEventos: Record<string, unknown>[];
    metas: Record<string, unknown>[];
    anexos: Record<string, unknown>[];
    jobs: Record<string, unknown>[];
    whatsappLogs: Record<string, unknown>[];
  }): DataValidationSummary {
    const tableResults: TableValidationResult[] = [
      validateCupons(data.cupons),
      validateAssinantesPagamentos(data.assinantesPagamentos),
      validateContasPagar(data.contasPagar),
      validateContasReceber(data.contasReceber),
      validateMovimentacoesCaixa(data.movimentacoesCaixa),
      validateInvestimentosEventos(data.investimentosEventos),
      validateMetas(data.metas),
      validateAnexos(data.anexos),
      validateJobs(data.jobs),
      validateWhatsappLogs(data.whatsappLogs),
    ];

    const totalViolations = tableResults.reduce((s, r) => s + r.violationsFound, 0);

    this.printSummary(tableResults, totalViolations);

    return { totalViolations, tableResults };
  }

  private printSummary(results: TableValidationResult[], total: number): void {
    if (total === 0) {
      console.log('   ✅ DataValidator: nenhuma violação de constraints encontrada');
      return;
    }

    console.warn(`   ⚠️  DataValidator: ${total} violação(ões) de constraints detectada(s):`);
    for (const r of results) {
      if (r.violationsFound > 0) {
        console.warn(`      • ${r.table}: ${r.violationsFound}/${r.totalRows} linha(s)`);
        for (const v of r.violations.slice(0, 5)) {
          console.warn(
            `        ↳ id=${v.rowId} field=${v.field} rule="${v.rule}" value=${JSON.stringify(v.actualValue)}${v.sanitizedValue !== undefined ? ` → ${JSON.stringify(v.sanitizedValue)}` : ''}`,
          );
        }
        if (r.violations.length > 5) {
          console.warn(`        … e mais ${r.violations.length - 5} violação(ões)`);
        }
      }
    }
  }
}
