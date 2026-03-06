import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from '../config';
import type { PostgresUsuario } from '../transformers/usuario.transformer';
import type { PostgresCupom } from '../transformers/cupom.transformer';
import type { PostgresAssinante } from '../transformers/assinante.transformer';
import type { PostgresAssinantePagamento } from '../transformers/assinante-pagamento.transformer';
import type { PostgresWebhookEvent } from '../transformers/webhook-event.transformer';
import type { PostgresInstituicaoFinanceira } from '../transformers/instituicao-financeira.transformer';
import type { PostgresConta } from '../transformers/conta.transformer';
import type { PostgresCategoria } from '../transformers/categoria.transformer';
import type { PostgresContaPagar } from '../transformers/conta-pagar.transformer';
import type { PostgresContaReceber } from '../transformers/conta-receber.transformer';
import type { PostgresMovimentacaoCaixa } from '../transformers/movimentacao-caixa.transformer';
import type { PostgresTipoInvestimento } from '../transformers/tipo-investimento.transformer';
import type { PostgresInvestimento } from '../transformers/investimento.transformer';
import type { PostgresInvestimentoEvento } from '../transformers/investimento-evento.transformer';
import type { PostgresMeta } from '../transformers/meta.transformer';
import type { PostgresMetaMovimento } from '../transformers/meta-movimento.transformer';
import type { PostgresAnexo } from '../transformers/anexo.transformer';
import type { PostgresAnexoVinculo } from '../transformers/anexo-vinculo.transformer';
import type { PostgresWhatsappLog } from '../transformers/whatsapp-log.transformer';
import type { PostgresJob } from '../transformers/job.transformer';

/** A minimal interface matching any Prisma model delegate that supports createMany and create */
interface PrismaDelegate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createMany(args: { data: any[]; skipDuplicates: boolean }): Promise<{ count: number }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(args: { data: any }): Promise<unknown>;
}

/** Returns the Prisma model delegate for the given camelCase model name from a client instance */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDelegate(client: any, modelName: string): PrismaDelegate {
  return client[modelName] as PrismaDelegate;
}

/** Tracks rows that failed to insert for reporting and manual review */
export interface FailedRow {
  table: string;
  rowIndex: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: string;
}

export class PostgresLoader {
  public prisma: PrismaClient;
  public failedRows: FailedRow[] = [];

  constructor() {
    const adapter = new PrismaPg({ connectionString: config.postgres.connectionString });
    this.prisma = new PrismaClient({ adapter });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /** Splits an array into chunks of the given size */
  private chunks<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  /**
   * Inserts rows in batches using the given Prisma model name.
   * When an external `tx` is provided (single-transaction load), inserts are made
   * directly against that transaction client; FK constraints are expected to be
   * deferred by the caller via SET CONSTRAINTS ALL DEFERRED.
   * Without an external `tx`, each batch is wrapped in its own transaction with
   * SET CONSTRAINTS ALL DEFERRED; on batch failure, falls back to row-by-row.
   * In dry-run mode the insertion is skipped but the count is still calculated.
   */
  private async insertBatches<T>(
    label: string,
    modelName: string,
    items: T[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    if (items.length === 0) return 0;
    const batches = this.chunks(items, batchSize);
    let total = 0;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!;
      if (!dryRun) {
        if (tx) {
          // External transaction — insert directly; caller is responsible for
          // SET CONSTRAINTS ALL DEFERRED.  Any error propagates to the caller.
          const result = await getDelegate(tx, modelName).createMany({ data: batch, skipDuplicates: true });
          total += result.count;
        } else {
          try {
            const result = await this.prisma.$transaction(async (innerTx: PrismaClient) => {
              await innerTx.$executeRaw`SET CONSTRAINTS ALL DEFERRED`;
              return getDelegate(innerTx, modelName).createMany({ data: batch, skipDuplicates: true });
            });
            total += result.count;
          } catch (batchErr) {
            // Batch failed — fall back to inserting rows individually
            console.warn(
              `   ⚠️  ${label}: lote ${i + 1} falhou (${(batchErr as Error).message}), tentando linha a linha…`,
            );
            for (let j = 0; j < batch.length; j++) {
              const row = batch[j]!;
              try {
                await this.prisma.$transaction(async (innerTx: PrismaClient) => {
                  await innerTx.$executeRaw`SET CONSTRAINTS ALL DEFERRED`;
                  return getDelegate(innerTx, modelName).create({ data: row });
                });
                total += 1;
              } catch (rowErr) {
                const errorMsg = (rowErr as Error).message;
                console.error(
                  `   ❌ ${label}: lote ${i + 1} linha ${j + 1} ignorada — ${errorMsg}`,
                );
                this.failedRows.push({
                  table: label,
                  rowIndex: i * batchSize + j,
                  data: row,
                  error: errorMsg,
                });
              }
            }
          }
        }
      } else {
        total += batch.length;
      }
      console.log(`   ✅ ${label}: Lote ${i + 1}/${batches.length} inserido (${total} total)`);
    }
    return total;
  }

  async truncateAll(dryRun: boolean): Promise<void> {
    if (dryRun) {
      console.log('   🏃 DRY RUN — TRUNCATE ignorado');
      return;
    }
    // Order matters: children before parents to respect FK constraints
    await this.prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        jobs,
        whatsapp_logs,
        anexos_vinculos,
        anexos,
        metas_movimentos,
        metas,
        investimentos_eventos,
        investimentos,
        tipos_investimento,
        movimentacoes_caixa,
        contas_receber,
        contas_pagar,
        categorias,
        contas,
        instituicoes_financeiras,
        webhook_events,
        assinantes_pagamentos,
        assinantes,
        cupons,
        usuarios
      RESTART IDENTITY CASCADE
    `);
    console.log('   🗑️  Todas as tabelas limpas (TRUNCATE CASCADE)');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadUsuarios(rows: PostgresUsuario[], batchSize: number, dryRun: boolean, tx?: any): Promise<number> {
    console.log('   📥 Carregando usuarios...');
    return this.insertBatches('usuarios', 'usuario', rows, batchSize, dryRun, tx);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadCupons(rows: PostgresCupom[], batchSize: number, dryRun: boolean, tx?: any): Promise<number> {
    console.log('   📥 Carregando cupons...');
    return this.insertBatches('cupons', 'cupom', rows, batchSize, dryRun, tx);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadAssinantes(rows: PostgresAssinante[], batchSize: number, dryRun: boolean, tx?: any): Promise<number> {
    console.log('   📥 Carregando assinantes...');
    return this.insertBatches('assinantes', 'assinante', rows, batchSize, dryRun, tx);
  }

  async loadAssinantesPagamentos(
    rows: PostgresAssinantePagamento[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando assinantes_pagamentos...');
    return this.insertBatches('assinantes_pagamentos', 'assinantePagamento', rows, batchSize, dryRun, tx);
  }

  async loadWebhookEvents(
    rows: PostgresWebhookEvent[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando webhook_events...');
    return this.insertBatches('webhook_events', 'webhookEvent', rows, batchSize, dryRun, tx);
  }

  async loadInstituicoesFinanceiras(
    rows: PostgresInstituicaoFinanceira[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando instituicoes_financeiras...');
    return this.insertBatches('instituicoes_financeiras', 'instituicaoFinanceira', rows, batchSize, dryRun, tx);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadContas(rows: PostgresConta[], batchSize: number, dryRun: boolean, tx?: any): Promise<number> {
    console.log('   📥 Carregando contas...');
    return this.insertBatches('contas', 'conta', rows, batchSize, dryRun, tx);
  }

  async loadCategorias(
    rows: PostgresCategoria[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando categorias...');
    return this.insertBatches('categorias', 'categoria', rows, batchSize, dryRun, tx);
  }

  async loadContasPagar(
    rows: PostgresContaPagar[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando contas_pagar...');
    return this.insertBatches('contas_pagar', 'contaPagar', rows, batchSize, dryRun, tx);
  }

  async loadContasReceber(
    rows: PostgresContaReceber[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando contas_receber...');
    return this.insertBatches('contas_receber', 'contaReceber', rows, batchSize, dryRun, tx);
  }

  async loadMovimentacoesCaixa(
    rows: PostgresMovimentacaoCaixa[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando movimentacoes_caixa...');
    return this.insertBatches('movimentacoes_caixa', 'movimentacaoCaixa', rows, batchSize, dryRun, tx);
  }

  async loadTiposInvestimento(
    rows: PostgresTipoInvestimento[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando tipos_investimento...');
    return this.insertBatches('tipos_investimento', 'tipoInvestimento', rows, batchSize, dryRun, tx);
  }

  async loadInvestimentos(
    rows: PostgresInvestimento[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando investimentos...');
    return this.insertBatches('investimentos', 'investimento', rows, batchSize, dryRun, tx);
  }

  async loadInvestimentosEventos(
    rows: PostgresInvestimentoEvento[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando investimentos_eventos...');
    return this.insertBatches('investimentos_eventos', 'investimentoEvento', rows, batchSize, dryRun, tx);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadMetas(rows: PostgresMeta[], batchSize: number, dryRun: boolean, tx?: any): Promise<number> {
    console.log('   📥 Carregando metas...');
    return this.insertBatches('metas', 'meta', rows, batchSize, dryRun, tx);
  }

  async loadMetasMovimentos(
    rows: PostgresMetaMovimento[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando metas_movimentos...');
    return this.insertBatches('metas_movimentos', 'metaMovimento', rows, batchSize, dryRun, tx);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadAnexos(rows: PostgresAnexo[], batchSize: number, dryRun: boolean, tx?: any): Promise<number> {
    console.log('   📥 Carregando anexos...');
    return this.insertBatches('anexos', 'anexo', rows, batchSize, dryRun, tx);
  }

  async loadAnexosVinculos(
    rows: PostgresAnexoVinculo[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando anexos_vinculos...');
    return this.insertBatches('anexos_vinculos', 'anexoVinculo', rows, batchSize, dryRun, tx);
  }

  async loadWhatsappLogs(
    rows: PostgresWhatsappLog[],
    batchSize: number,
    dryRun: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<number> {
    console.log('   📥 Carregando whatsapp_logs...');
    return this.insertBatches('whatsapp_logs', 'whatsappLog', rows, batchSize, dryRun, tx);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadJobs(rows: PostgresJob[], batchSize: number, dryRun: boolean, tx?: any): Promise<number> {
    console.log('   📥 Carregando jobs...');
    return this.insertBatches('jobs', 'job', rows, batchSize, dryRun, tx);
  }
}
