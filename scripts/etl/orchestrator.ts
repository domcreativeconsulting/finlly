import { ETLOptions } from './cli';

export const TABLE_EXECUTION_ORDER = [
  'usuarios',
  'assinantes',
  'assinantes_pagamentos',
  'cupons',
  'webhook_events',
  'instituicoes_financeiras',
  'contas',
  'categorias',
  'contas_pagar',
  'contas_receber',
  'movimentacoes_caixa',
  'tipos_investimento',
  'investimentos',
  'investimentos_eventos',
  'metas',
  'metas_movimentos',
  'anexos',
  'anexos_vinculos',
  'whatsapp_logs',
  'jobs',
] as const;

export type TableName = (typeof TABLE_EXECUTION_ORDER)[number];

export class ETLOrchestrator {
  getTableOrder(requestedTables?: string[]): string[] {
    if (!requestedTables) {
      return [...TABLE_EXECUTION_ORDER];
    }
    // Filter and maintain dependency order
    return TABLE_EXECUTION_ORDER.filter((t) => requestedTables.includes(t));
  }

  printExecutionPlan(options: ETLOptions): void {
    const tablesToRun = this.getTableOrder(options.tables);

    console.log('\n📊 ETL Execution Plan:');
    console.log(`   Dry-run: ${options.dryRun ? '✅ YES (read-only)' : '❌ NO (will write)'}`);
    console.log(`   Reset:   ${options.reset ? '⚠️  YES (truncate first)' : '❌ NO'}`);
    console.log(`   Since:   ${options.since ? options.since.toISOString() : 'All data'}`);
    console.log(`   Tables:  ${tablesToRun.length}/${TABLE_EXECUTION_ORDER.length}`);
    if (tablesToRun.length < TABLE_EXECUTION_ORDER.length) {
      console.log(`   Running: ${tablesToRun.join(', ')}`);
    }
    console.log();

    if (options.dryRun) {
      console.log('🔍 DRY-RUN MODE: No data will be written to Postgres\n');
    }
  }

  validateSince(since?: Date): void {
    if (!since) return;
    if (isNaN(since.getTime())) {
      throw new Error('⛔ --since value is not a valid date. Use ISO format: YYYY-MM-DD');
    }
  }
}
