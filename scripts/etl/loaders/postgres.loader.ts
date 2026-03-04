import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from '../config.js';
import type { PostgresUsuario } from '../transformers/usuario.transformer.js';
import type { PostgresCupom } from '../transformers/cupom.transformer.js';
import type { PostgresAssinante } from '../transformers/assinante.transformer.js';
import type { PostgresAssinantePagamento } from '../transformers/assinante-pagamento.transformer.js';
import type { PostgresWebhookEvent } from '../transformers/webhook-event.transformer.js';
import type { PostgresInstituicaoFinanceira } from '../transformers/instituicao-financeira.transformer.js';
import type { PostgresConta } from '../transformers/conta.transformer.js';
import type { PostgresCategoria } from '../transformers/categoria.transformer.js';
import type { PostgresContaPagar } from '../transformers/conta-pagar.transformer.js';
import type { PostgresContaReceber } from '../transformers/conta-receber.transformer.js';
import type { PostgresMovimentacaoCaixa } from '../transformers/movimentacao-caixa.transformer.js';
import type { PostgresTipoInvestimento } from '../transformers/tipo-investimento.transformer.js';
import type { PostgresInvestimento } from '../transformers/investimento.transformer.js';
import type { PostgresInvestimentoEvento } from '../transformers/investimento-evento.transformer.js';
import type { PostgresMeta } from '../transformers/meta.transformer.js';
import type { PostgresMetaMovimento } from '../transformers/meta-movimento.transformer.js';
import type { PostgresAnexo } from '../transformers/anexo.transformer.js';
import type { PostgresAnexoVinculo } from '../transformers/anexo-vinculo.transformer.js';
import type { PostgresWhatsappLog } from '../transformers/whatsapp-log.transformer.js';
import type { PostgresJob } from '../transformers/job.transformer.js';

/** A minimal interface matching any Prisma model delegate that supports createMany */
interface PrismaDelegate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createMany(args: { data: any[]; skipDuplicates: boolean }): Promise<{ count: number }>;
}

export class PostgresLoader {
  public prisma: PrismaClient;

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
   * Inserts rows in batches using the given Prisma delegate.
   * In dry-run mode the insertion is skipped but the count is still calculated.
   */
  private async insertBatches<T>(
    label: string,
    items: T[],
    batchSize: number,
    delegate: PrismaDelegate,
    dryRun: boolean,
  ): Promise<number> {
    if (items.length === 0) return 0;
    const batches = this.chunks(items, batchSize);
    let total = 0;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!;
      if (!dryRun) {
        const result = await delegate.createMany({ data: batch, skipDuplicates: true });
        total += result.count;
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

  async loadUsuarios(rows: PostgresUsuario[], batchSize: number, dryRun: boolean): Promise<number> {
    console.log('   📥 Carregando usuarios...');
    return this.insertBatches('usuarios', rows, batchSize, this.prisma.usuario as unknown as PrismaDelegate, dryRun);
  }

  async loadCupons(rows: PostgresCupom[], batchSize: number, dryRun: boolean): Promise<number> {
    console.log('   📥 Carregando cupons...');
    return this.insertBatches('cupons', rows, batchSize, this.prisma.cupom as unknown as PrismaDelegate, dryRun);
  }

  async loadAssinantes(rows: PostgresAssinante[], batchSize: number, dryRun: boolean): Promise<number> {
    console.log('   📥 Carregando assinantes...');
    return this.insertBatches('assinantes', rows, batchSize, this.prisma.assinante as unknown as PrismaDelegate, dryRun);
  }

  async loadAssinantesPagamentos(
    rows: PostgresAssinantePagamento[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando assinantes_pagamentos...');
    return this.insertBatches(
      'assinantes_pagamentos',
      rows,
      batchSize,
      this.prisma.assinantePagamento as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadWebhookEvents(
    rows: PostgresWebhookEvent[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando webhook_events...');
    return this.insertBatches(
      'webhook_events',
      rows,
      batchSize,
      this.prisma.webhookEvent as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadInstituicoesFinanceiras(
    rows: PostgresInstituicaoFinanceira[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando instituicoes_financeiras...');
    return this.insertBatches(
      'instituicoes_financeiras',
      rows,
      batchSize,
      this.prisma.instituicaoFinanceira as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadContas(rows: PostgresConta[], batchSize: number, dryRun: boolean): Promise<number> {
    console.log('   📥 Carregando contas...');
    return this.insertBatches('contas', rows, batchSize, this.prisma.conta as unknown as PrismaDelegate, dryRun);
  }

  async loadCategorias(
    rows: PostgresCategoria[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando categorias...');
    return this.insertBatches(
      'categorias',
      rows,
      batchSize,
      this.prisma.categoria as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadContasPagar(
    rows: PostgresContaPagar[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando contas_pagar...');
    return this.insertBatches(
      'contas_pagar',
      rows,
      batchSize,
      this.prisma.contaPagar as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadContasReceber(
    rows: PostgresContaReceber[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando contas_receber...');
    return this.insertBatches(
      'contas_receber',
      rows,
      batchSize,
      this.prisma.contaReceber as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadMovimentacoesCaixa(
    rows: PostgresMovimentacaoCaixa[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando movimentacoes_caixa...');
    return this.insertBatches(
      'movimentacoes_caixa',
      rows,
      batchSize,
      this.prisma.movimentacaoCaixa as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadTiposInvestimento(
    rows: PostgresTipoInvestimento[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando tipos_investimento...');
    return this.insertBatches(
      'tipos_investimento',
      rows,
      batchSize,
      this.prisma.tipoInvestimento as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadInvestimentos(
    rows: PostgresInvestimento[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando investimentos...');
    return this.insertBatches(
      'investimentos',
      rows,
      batchSize,
      this.prisma.investimento as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadInvestimentosEventos(
    rows: PostgresInvestimentoEvento[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando investimentos_eventos...');
    return this.insertBatches(
      'investimentos_eventos',
      rows,
      batchSize,
      this.prisma.investimentoEvento as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadMetas(rows: PostgresMeta[], batchSize: number, dryRun: boolean): Promise<number> {
    console.log('   📥 Carregando metas...');
    return this.insertBatches('metas', rows, batchSize, this.prisma.meta as unknown as PrismaDelegate, dryRun);
  }

  async loadMetasMovimentos(
    rows: PostgresMetaMovimento[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando metas_movimentos...');
    return this.insertBatches(
      'metas_movimentos',
      rows,
      batchSize,
      this.prisma.metaMovimento as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadAnexos(rows: PostgresAnexo[], batchSize: number, dryRun: boolean): Promise<number> {
    console.log('   📥 Carregando anexos...');
    return this.insertBatches('anexos', rows, batchSize, this.prisma.anexo as unknown as PrismaDelegate, dryRun);
  }

  async loadAnexosVinculos(
    rows: PostgresAnexoVinculo[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando anexos_vinculos...');
    return this.insertBatches(
      'anexos_vinculos',
      rows,
      batchSize,
      this.prisma.anexoVinculo as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadWhatsappLogs(
    rows: PostgresWhatsappLog[],
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    console.log('   📥 Carregando whatsapp_logs...');
    return this.insertBatches(
      'whatsapp_logs',
      rows,
      batchSize,
      this.prisma.whatsappLog as unknown as PrismaDelegate,
      dryRun,
    );
  }

  async loadJobs(rows: PostgresJob[], batchSize: number, dryRun: boolean): Promise<number> {
    console.log('   📥 Carregando jobs...');
    return this.insertBatches('jobs', rows, batchSize, this.prisma.job as unknown as PrismaDelegate, dryRun);
  }
}
