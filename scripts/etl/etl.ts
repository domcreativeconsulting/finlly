import { config } from './config.ts';
import { getMappedCount, clearCache } from './transformers/id-mapper.js';

// Extractors
import { UsuariosExtractor } from './extractors/usuarios.extractor.js';
import { CuponsExtractor } from './extractors/cupons.extractor.js';
import { AssinantesExtractor } from './extractors/assinantes.extractor.js';
import { AssinantesPagamentosExtractor } from './extractors/assinantes-pagamentos.extractor.js';
import { WebhookEventsExtractor } from './extractors/webhook-events.extractor.js';
import { InstituicoesFinanceirasExtractor } from './extractors/instituicoes-financeiras.extractor.js';
import { ContasExtractor } from './extractors/contas.extractor.js';
import { CategoriasExtractor } from './extractors/categorias.extractor.js';
import { ContasPagarExtractor } from './extractors/contas-pagar.extractor.js';
import { ContasReceberExtractor } from './extractors/contas-receber.extractor.js';
import { MovimentacoesCaixaExtractor } from './extractors/movimentacoes-caixa.extractor.js';
import { TiposInvestimentoExtractor } from './extractors/tipos-investimento.extractor.js';
import { InvestimentosExtractor } from './extractors/investimentos.extractor.js';
import { InvestimentosEventosExtractor } from './extractors/investimentos-eventos.extractor.js';
import { MetasExtractor } from './extractors/metas.extractor.js';
import { MetasMovimentosExtractor } from './extractors/metas-movimentos.extractor.js';
import { AnexosExtractor } from './extractors/anexos.extractor.js';
import { AnexosVinculosExtractor } from './extractors/anexos-vinculos.extractor.js';
import { WhatsappLogsExtractor } from './extractors/whatsapp-logs.extractor.js';
import { JobsExtractor } from './extractors/jobs.extractor.js';

// Transformers
import { transformUsuario } from './transformers/usuario.transformer.js';
import { transformCupom } from './transformers/cupom.transformer.js';
import { transformAssinante } from './transformers/assinante.transformer.js';
import { transformAssinantePagamento } from './transformers/assinante-pagamento.transformer.js';
import { transformWebhookEvent } from './transformers/webhook-event.transformer.js';
import { transformInstituicaoFinanceira } from './transformers/instituicao-financeira.transformer.js';
import { transformConta } from './transformers/conta.transformer.js';
import { transformCategoria } from './transformers/categoria.transformer.js';
import { transformContaPagar } from './transformers/conta-pagar.transformer.js';
import { transformContaReceber } from './transformers/conta-receber.transformer.js';
import { transformMovimentacaoCaixa } from './transformers/movimentacao-caixa.transformer.js';
import { transformTipoInvestimento } from './transformers/tipo-investimento.transformer.js';
import { transformInvestimento } from './transformers/investimento.transformer.js';
import { transformInvestimentoEvento } from './transformers/investimento-evento.transformer.js';
import { transformMeta } from './transformers/meta.transformer.js';
import { transformMetaMovimento } from './transformers/meta-movimento.transformer.js';
import { transformAnexo } from './transformers/anexo.transformer.js';
import { transformAnexoVinculo } from './transformers/anexo-vinculo.transformer.js';
import { transformWhatsappLog } from './transformers/whatsapp-log.transformer.js';
import { transformJob } from './transformers/job.transformer.js';

// Loader
import { PostgresLoader } from './loaders/postgres.loader.js';

// Validators
import { CountValidator } from './validators/count-validator.js';
import { SampleValidator } from './validators/sample-validator.js';
import { OrphanDetector } from './validators/orphan-detector.js';
import { DataValidator } from './validators/data-validator.js';

// Reporter
import {
  ReportGenerator,
  type MigrationStatus,
} from './reporters/report-generator.js';

async function main(): Promise<void> {
  const dryRun = config.etl.dryRun;
  const batchSize = config.etl.batchSize;
  const { sampleSize } = config.etl;

  console.log('\n🚀 Iniciando migração MySQL → Postgres\n');
  console.log(
    `⚙️  Modo: ${dryRun ? 'DRY RUN (simulação sem inserção)' : 'EXECUÇÃO REAL'}`
  );
  console.log(`📊 Batch size: ${batchSize}\n`);

  const reporter = new ReportGenerator();
  let migrationStatus: MigrationStatus = 'success';

  // ── Shared extractor (reused for counts + sample validation) ───────────────
  const sharedExtractor = new UsuariosExtractor();

  // ── Loader ─────────────────────────────────────────────────────────────────
  const loader = new PostgresLoader();

  try {
    // ── FASE 1: EXTRACT ───────────────────────────────────────────────────────
    console.log('📖 FASE 1: EXTRACT\n');

    await sharedExtractor.connect();

    const usuariosEx = new UsuariosExtractor();
    const cuponsEx = new CuponsExtractor();
    const assinantesEx = new AssinantesExtractor();
    const pagamentosEx = new AssinantesPagamentosExtractor();
    const webhookEx = new WebhookEventsExtractor();
    const instituicoesEx = new InstituicoesFinanceirasExtractor();
    const contasEx = new ContasExtractor();
    const categoriasEx = new CategoriasExtractor();
    const contasPagarEx = new ContasPagarExtractor();
    const contasReceberEx = new ContasReceberExtractor();
    const movimentacoesEx = new MovimentacoesCaixaExtractor();
    const tiposInvestEx = new TiposInvestimentoExtractor();
    const investimentosEx = new InvestimentosExtractor();
    const investEventosEx = new InvestimentosEventosExtractor();
    const metasEx = new MetasExtractor();
    const metasMovEx = new MetasMovimentosExtractor();
    const anexosEx = new AnexosExtractor();
    const anexosVinculosEx = new AnexosVinculosExtractor();
    const whatsappEx = new WhatsappLogsExtractor();
    const jobsEx = new JobsExtractor();

    const allExtractors = [
      usuariosEx,
      cuponsEx,
      assinantesEx,
      pagamentosEx,
      webhookEx,
      instituicoesEx,
      contasEx,
      categoriasEx,
      contasPagarEx,
      contasReceberEx,
      movimentacoesEx,
      tiposInvestEx,
      investimentosEx,
      investEventosEx,
      metasEx,
      metasMovEx,
      anexosEx,
      anexosVinculosEx,
      whatsappEx,
      jobsEx,
    ];

    for (const ex of allExtractors) {
      await ex.connect();
    }

    const [
      rawUsuarios,
      rawCupons,
      rawAssinantes,
      rawPagamentos,
      rawWebhooks,
      rawInstituicoes,
      rawContas,
      rawCategorias,
      rawContasPagar,
      rawContasReceber,
      rawMovimentacoes,
      rawTiposInvest,
      rawInvestimentos,
      rawInvestEventos,
      rawMetas,
      rawMetasMov,
      rawAnexos,
      rawAnexosVinculos,
      rawWhatsapp,
      rawJobs,
    ] = await Promise.all([
      usuariosEx.extract(),
      cuponsEx.extract(),
      assinantesEx.extract(),
      pagamentosEx.extract(),
      webhookEx.extract(),
      instituicoesEx.extract(),
      contasEx.extract(),
      categoriasEx.extract(),
      contasPagarEx.extract(),
      contasReceberEx.extract(),
      movimentacoesEx.extract(),
      tiposInvestEx.extract(),
      investimentosEx.extract(),
      investEventosEx.extract(),
      metasEx.extract(),
      metasMovEx.extract(),
      anexosEx.extract(),
      anexosVinculosEx.extract(),
      whatsappEx.extract(),
      jobsEx.extract(),
    ]);

    console.log(`   ✅ usuarios: ${rawUsuarios.length} extraídos`);
    console.log(`   ✅ cupons: ${rawCupons.length} extraídos`);
    console.log(`   ✅ assinantes: ${rawAssinantes.length} extraídos`);
    console.log(
      `   ✅ assinantes_pagamentos: ${rawPagamentos.length} extraídos`
    );
    console.log(`   ✅ webhook_events: ${rawWebhooks.length} extraídos`);
    console.log(
      `   ✅ instituicoes_financeiras: ${rawInstituicoes.length} extraídos`
    );
    console.log(`   ✅ contas: ${rawContas.length} extraídos`);
    console.log(`   ✅ categorias: ${rawCategorias.length} extraídos`);
    console.log(`   ✅ contas_pagar: ${rawContasPagar.length} extraídos`);
    console.log(`   ✅ contas_receber: ${rawContasReceber.length} extraídos`);
    console.log(
      `   ✅ movimentacoes_caixa: ${rawMovimentacoes.length} extraídos`
    );
    console.log(`   ✅ tipos_investimento: ${rawTiposInvest.length} extraídos`);
    console.log(`   ✅ investimentos: ${rawInvestimentos.length} extraídos`);
    console.log(
      `   ✅ investimentos_eventos: ${rawInvestEventos.length} extraídos`
    );
    console.log(`   ✅ metas: ${rawMetas.length} extraídos`);
    console.log(`   ✅ metas_movimentos: ${rawMetasMov.length} extraídos`);
    console.log(`   ✅ anexos: ${rawAnexos.length} extraídos`);
    console.log(`   ✅ anexos_vinculos: ${rawAnexosVinculos.length} extraídos`);
    console.log(`   ✅ whatsapp_logs: ${rawWhatsapp.length} extraídos`);
    console.log(`   ✅ jobs: ${rawJobs.length} extraídos`);

    // ── FASE 2: TRANSFORM ──────────────────────────────────────────────────────
    console.log('\n🔄 FASE 2: TRANSFORM\n');

    clearCache();

    const pgUsuarios = rawUsuarios.map(transformUsuario);
    const pgCupons = rawCupons.map(transformCupom);
    const pgAssinantes = rawAssinantes.map(transformAssinante);
    const pgPagamentos = rawPagamentos.map(transformAssinantePagamento);
    const pgWebhooks = rawWebhooks.map(transformWebhookEvent);
    const pgInstituicoes = rawInstituicoes.map(transformInstituicaoFinanceira);
    const pgContas = rawContas.map(transformConta);
    const pgCategorias = rawCategorias.map(transformCategoria);
    const pgContasPagar = rawContasPagar.map(transformContaPagar);
    const pgContasReceber = rawContasReceber.map(transformContaReceber);
    const pgMovimentacoes = rawMovimentacoes.map(transformMovimentacaoCaixa);
    const pgTiposInvest = rawTiposInvest.map(transformTipoInvestimento);
    const pgInvestimentos = rawInvestimentos.map(transformInvestimento);
    const pgInvestEventos = rawInvestEventos.map(transformInvestimentoEvento);
    const pgMetas = rawMetas.map(transformMeta);
    const pgMetasMov = rawMetasMov.map(transformMetaMovimento);
    const pgAnexos = rawAnexos.map(transformAnexo);
    const pgAnexosVinculos = rawAnexosVinculos
      .map(transformAnexoVinculo)
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const pgWhatsapp = rawWhatsapp.map(transformWhatsappLog);
    const pgJobs = rawJobs.map(transformJob);

    const idsTotal = getMappedCount();
    console.log(`   ✅ ${pgUsuarios.length} usuarios transformados`);
    console.log(`   ✅ ${pgCupons.length} cupons transformados`);
    console.log(`   ✅ ${pgAssinantes.length} assinantes transformados`);
    console.log(
      `   ✅ ${pgPagamentos.length} assinantes_pagamentos transformados`
    );
    console.log(`   ✅ ${pgWebhooks.length} webhook_events transformados`);
    console.log(
      `   ✅ ${pgInstituicoes.length} instituicoes_financeiras transformados`
    );
    console.log(`   ✅ ${pgContas.length} contas transformados`);
    console.log(`   ✅ ${pgCategorias.length} categorias transformados`);
    console.log(`   ✅ ${pgContasPagar.length} contas_pagar transformados`);
    console.log(`   ✅ ${pgContasReceber.length} contas_receber transformados`);
    console.log(
      `   ✅ ${pgMovimentacoes.length} movimentacoes_caixa transformados`
    );
    console.log(
      `   ✅ ${pgTiposInvest.length} tipos_investimento transformados`
    );
    console.log(`   ✅ ${pgInvestimentos.length} investimentos transformados`);
    console.log(
      `   ✅ ${pgInvestEventos.length} investimentos_eventos transformados`
    );
    console.log(`   ✅ ${pgMetas.length} metas transformados`);
    console.log(`   ✅ ${pgMetasMov.length} metas_movimentos transformados`);
    console.log(`   ✅ ${pgAnexos.length} anexos transformados`);
    console.log(
      `   ✅ ${pgAnexosVinculos.length} anexos_vinculos transformados`
    );
    console.log(`   ✅ ${pgWhatsapp.length} whatsapp_logs transformados`);
    console.log(`   ✅ ${pgJobs.length} jobs transformados`);
    console.log(`   🔑 ${idsTotal} IDs mapeados (INT → UUID v5)`);
    console.log(
      `   🗑️  Campos removidos: balance, current_value, current_amount`
    );

    // ── FASE 2.5: DATA VALIDATION ──────────────────────────────────────────────
    console.log('\n🔍 FASE 2.5: DATA VALIDATION\n');

    const dataValidator = new DataValidator();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataValidationResult = dataValidator.validateAll({
      cupons: pgCupons as unknown as Record<string, unknown>[],
      assinantesPagamentos: pgPagamentos as unknown as Record<string, unknown>[],
      contasPagar: pgContasPagar as unknown as Record<string, unknown>[],
      contasReceber: pgContasReceber as unknown as Record<string, unknown>[],
      movimentacoesCaixa: pgMovimentacoes as unknown as Record<string, unknown>[],
      investimentosEventos: pgInvestEventos as unknown as Record<string, unknown>[],
      metas: pgMetas as unknown as Record<string, unknown>[],
      anexos: pgAnexos as unknown as Record<string, unknown>[],
      jobs: pgJobs as unknown as Record<string, unknown>[],
      whatsappLogs: pgWhatsapp as unknown as Record<string, unknown>[],
    });

    if (dataValidationResult.totalViolations > 0) {
      migrationStatus = 'partial';
      reporter.addError(
        `DataValidator: ${dataValidationResult.totalViolations} violação(ões) detectada(s) antes do LOAD`
      );
    }

    // ── FASE 3: LOAD ───────────────────────────────────────────────────────────
    console.log('\n💾 FASE 3: LOAD\n');

    await loader.truncateAll(dryRun);

    await loader.loadUsuarios(pgUsuarios, batchSize, dryRun);
    await loader.loadCupons(pgCupons, batchSize, dryRun);
    await loader.loadAssinantes(pgAssinantes, batchSize, dryRun);
    await loader.loadAssinantesPagamentos(pgPagamentos, batchSize, dryRun);
    await loader.loadWebhookEvents(pgWebhooks, batchSize, dryRun);
    await loader.loadInstituicoesFinanceiras(pgInstituicoes, batchSize, dryRun);
    await loader.loadContas(pgContas, batchSize, dryRun);
    await loader.loadCategorias(pgCategorias, batchSize, dryRun);
    await loader.loadContasPagar(pgContasPagar, batchSize, dryRun);
    await loader.loadContasReceber(pgContasReceber, batchSize, dryRun);
    await loader.loadMovimentacoesCaixa(pgMovimentacoes, batchSize, dryRun);
    await loader.loadTiposInvestimento(pgTiposInvest, batchSize, dryRun);
    await loader.loadInvestimentos(pgInvestimentos, batchSize, dryRun);
    await loader.loadInvestimentosEventos(pgInvestEventos, batchSize, dryRun);
    await loader.loadMetas(pgMetas, batchSize, dryRun);
    await loader.loadMetasMovimentos(pgMetasMov, batchSize, dryRun);
    await loader.loadAnexos(pgAnexos, batchSize, dryRun);
    await loader.loadAnexosVinculos(pgAnexosVinculos, batchSize, dryRun);
    await loader.loadWhatsappLogs(pgWhatsapp, batchSize, dryRun);
    await loader.loadJobs(pgJobs, batchSize, dryRun);

    // ── FASE 4: VALIDATE ───────────────────────────────────────────────────────
    console.log('\n✓  FASE 4: VALIDATE\n');

    const countValidator = new CountValidator(sharedExtractor, loader.prisma);
    const countResults = await countValidator.validateAll().catch((err) => {
      reporter.addError(
        `Validação de contagens falhou: ${(err as Error).message}`
      );
      return [];
    });

    const { allMatch, mismatches } = CountValidator.summarize(countResults);
    if (!allMatch) {
      migrationStatus = 'partial';
      for (const m of mismatches) {
        reporter.addError(
          `Contagem divergente em ${m.table}: MySQL=${m.mysqlCount}, Postgres=${m.postgresCount}`
        );
      }
    }

    let sampleResults: Awaited<ReturnType<SampleValidator['validateAll']>> = [];
    if (config.etl.validateSamples && !dryRun) {
      const sampleValidator = new SampleValidator(
        sharedExtractor,
        loader.prisma,
        sampleSize
      );
      sampleResults = await sampleValidator.validateAll().catch((err) => {
        reporter.addError(
          `Validação de amostras falhou: ${(err as Error).message}`
        );
        return [];
      });
    }

    const orphanDetector = new OrphanDetector(loader.prisma);
    const orphanResults = await orphanDetector.detectAll().catch((err) => {
      reporter.addError(
        `Detecção de orphans falhou: ${(err as Error).message}`
      );
      return [];
    });

    // ── FASE 5: REPORT ─────────────────────────────────────────────────────────
    const report = reporter.generate(
      migrationStatus,
      dryRun,
      countResults,
      sampleResults,
      orphanResults,
      {
        ids_mapeados: idsTotal,
        tipos_convertidos: [
          'DATETIME → TIMESTAMPTZ',
          'INT → UUID (v5)',
          'VARCHAR → ENUM',
        ],
        campos_removidos: ['balance', 'current_value', 'current_amount'],
        campos_adicionados: [
          'hash_sha256',
          'deleted_at',
          'is_sistema',
          'conta_destino_id',
        ],
      },
      dataValidationResult,
      loader.failedRows,
    );

    const reportPath = reporter.save(report);
    console.log(
      `\n✨ Migração concluída com status: ${migrationStatus.toUpperCase()}`
    );
    console.log(`📄 Relatório salvo em: ${reportPath}`);

    if (!allMatch) {
      console.warn(
        '\n⚠️  Atenção: existem divergências de contagem. Verifique o relatório.'
      );
    }
  } catch (err) {
    const message = (err as Error).message;
    console.error(`\n💥 Erro fatal durante a migração: ${message}`);
    reporter.addError(`Erro fatal: ${message}`);

    const report = reporter.generate('error', dryRun, [], [], [], {
      ids_mapeados: getMappedCount(),
      tipos_convertidos: [],
      campos_removidos: [],
      campos_adicionados: [],
    });
    const reportPath = reporter.save(report);
    console.error(`📄 Relatório de erro salvo em: ${reportPath}`);
    process.exit(1);
  } finally {
    await sharedExtractor.disconnect().catch(() => undefined);
    await loader.disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
