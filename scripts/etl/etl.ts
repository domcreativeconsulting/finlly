import { config } from './config';
import { getMappedCount, clearCache, mapId } from './transformers/id-mapper';

// Extractors
import { UsuariosExtractor } from './extractors/usuarios.extractor';
import { CuponsExtractor } from './extractors/cupons.extractor';
import { AssinantesExtractor } from './extractors/assinantes.extractor';
import { AssinantesPagamentosExtractor } from './extractors/assinantes-pagamentos.extractor';
import { WebhookEventsExtractor } from './extractors/webhook-events.extractor';
import { InstituicoesFinanceirasExtractor } from './extractors/instituicoes-financeiras.extractor';
import { ContasExtractor } from './extractors/contas.extractor';
import { CategoriasExtractor } from './extractors/categorias.extractor';
import { ContasPagarExtractor } from './extractors/contas-pagar.extractor';
import { ContasReceberExtractor } from './extractors/contas-receber.extractor';
import { MovimentacoesCaixaExtractor } from './extractors/movimentacoes-caixa.extractor';
import { TiposInvestimentoExtractor } from './extractors/tipos-investimento.extractor';
import { InvestimentosExtractor } from './extractors/investimentos.extractor';
import { InvestimentosEventosExtractor } from './extractors/investimentos-eventos.extractor';
import { MetasExtractor } from './extractors/metas.extractor';
import { MetasMovimentosExtractor } from './extractors/metas-movimentos.extractor';
import { AnexosExtractor } from './extractors/anexos.extractor';
import { AnexosVinculosExtractor } from './extractors/anexos-vinculos.extractor';
import { WhatsappLogsExtractor } from './extractors/whatsapp-logs.extractor';
import { JobsExtractor } from './extractors/jobs.extractor';

// Transformers
import { transformUsuario } from './transformers/usuario.transformer';
import { transformCupom } from './transformers/cupom.transformer';
import { transformAssinante } from './transformers/assinante.transformer';
import { transformAssinantePagamento } from './transformers/assinante-pagamento.transformer';
import { transformWebhookEvent } from './transformers/webhook-event.transformer';
import { transformInstituicaoFinanceira } from './transformers/instituicao-financeira.transformer';
import { transformConta } from './transformers/conta.transformer';
import { transformCategoria } from './transformers/categoria.transformer';
import { transformContaPagar } from './transformers/conta-pagar.transformer';
import { transformContaReceber } from './transformers/conta-receber.transformer';
import { transformMovimentacaoCaixa } from './transformers/movimentacao-caixa.transformer';
import { transformTipoInvestimento } from './transformers/tipo-investimento.transformer';
import { transformInvestimento } from './transformers/investimento.transformer';
import { transformInvestimentoEvento } from './transformers/investimento-evento.transformer';
import { transformMeta } from './transformers/meta.transformer';
import { transformMetaMovimento } from './transformers/meta-movimento.transformer';
import { transformAnexo } from './transformers/anexo.transformer';
import { transformAnexoVinculo } from './transformers/anexo-vinculo.transformer';
import { transformWhatsappLog } from './transformers/whatsapp-log.transformer';
import { transformJob } from './transformers/job.transformer';

// Loader
import { PostgresLoader } from './loaders/postgres.loader';

// Validators
import { CountValidator } from './validators/count-validator';
import { SampleValidator } from './validators/sample-validator';
import { OrphanDetector } from './validators/orphan-detector';
import { DataValidator } from './validators/data-validator';

// Reporter
import {
  ReportGenerator,
  type MigrationStatus,
} from './reporters/report-generator';

async function main(): Promise<void> {
  const dryRun = config.etl.dryRun;
  const batchSize = config.etl.batchSize;
  const { sampleSize, transactionTimeout } = config.etl;

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
    // Build a UUID → raw record lookup BEFORE filtering so the diagnostic in FASE 2.7
    // can show the original MySQL user_id even after nulls are dropped.
    const rawAssinanteByPgId = new Map(
      rawAssinantes
        .filter(r => r.user_id != null)
        .map(r => [mapId(r.id, 'plans'), r])
    );
    const pgAssinantes = rawAssinantes
      .map(transformAssinante)
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const pgPagamentos = rawPagamentos.map(transformAssinantePagamento);
    const pgWebhooks = rawWebhooks.map(transformWebhookEvent);
    const pgInstituicoes = rawInstituicoes.map(transformInstituicaoFinanceira);
    const pgContas = rawContas
      .map(transformConta)
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const pgCategorias = rawCategorias.map(transformCategoria);
    const pgContasPagar = rawContasPagar
      .map(transformContaPagar)
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const pgContasReceber = rawContasReceber
      .map(transformContaReceber)
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const pgMovimentacoes = rawMovimentacoes
      .map(transformMovimentacaoCaixa)
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const pgTiposInvest = rawTiposInvest.map(transformTipoInvestimento);
    const pgInvestimentos = rawInvestimentos
      .map(transformInvestimento)
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const pgInvestEventos = rawInvestEventos.map(transformInvestimentoEvento);
    const pgMetas = rawMetas
      .map(transformMeta)
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const pgMetasMov = rawMetasMov.map(transformMetaMovimento);
    const pgAnexos = rawAnexos
      .map(transformAnexo)
      .filter((v): v is NonNullable<typeof v> => v !== null);
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

    // ── FASE 2.7: ID MAPPING CONSISTENCY CHECK ────────────────────────────────
    // Verify that every child-table FK reference (usuario_id on assinantes) resolves
    // to an actual row that will be inserted into the parent table (usuarios).
    // This catches the "FK constraint violated" error before hitting the DB.
    console.log('\n🔍 DETAILED ID MAPPING CHECK\n');

    // Show the first few usuarios that will be inserted
    console.log('   Usuarios inseridos:');
    for (let i = 0; i < Math.min(3, pgUsuarios.length); i++) {
      const rawU = rawUsuarios[i];
      console.log(`     [${i}] MySQL id=${rawU?.id} → Postgres UUID: ${pgUsuarios[i].id}`);
    }

    // Build a Set of all usuario UUIDs for O(1) lookup
    const usuarioIdSet = new Set(pgUsuarios.map(u => u.id));

    // Show the first few assinantes and whether their usuario_id resolves
    console.log('\n   Assinantes (com usuario_id):');
    for (let i = 0; i < Math.min(3, pgAssinantes.length); i++) {
      const assinante = pgAssinantes[i];
      // Use the pre-built lookup map so the MySQL user_id shown always matches
      // this exact pg record, even after null-user_id rows were filtered out.
      const rawA = rawAssinanteByPgId.get(assinante.id);
      const exists = usuarioIdSet.has(assinante.usuario_id);
      console.log(
        `     [${i}] usuario_id: ${assinante.usuario_id} (from MySQL: user_id=${rawA?.user_id})`
      );
      console.log(`         ├─ Existe em usuarios: ${exists ? '✅' : '❌'}`);
      if (!exists) {
        console.log(`         └─ ERRO: Referência FK quebrada!`);
      }
    }

    // Full validation: find all assinantes whose usuario_id has no matching usuario
    const invalidAssinantes = pgAssinantes.filter(a => !usuarioIdSet.has(a.usuario_id));
    if (invalidAssinantes.length > 0) {
      console.error(
        `\n❌ FATAL: ${invalidAssinantes.length} assinante(s) com usuario_id inválido (FK quebrada):`
      );
      invalidAssinantes.slice(0, 3).forEach((a, idx) => {
        console.error(`   [${idx}] usuario_id=${a.usuario_id} (NÃO encontrado em usuarios!)`);
      });
      migrationStatus = 'partial';
      reporter.addError(
        `FK violation: ${invalidAssinantes.length} assinante(s) referenciam usuario_id inexistente em usuarios. ` +
        `Primeiro: usuario_id=${invalidAssinantes[0].usuario_id}`
      );
      process.exit(1);
    } else if (pgAssinantes.length > 0) {
      console.log('\n   ✅ Todos os assinantes têm usuario_id válido em usuarios');
    }

    // ── FASE 3: LOAD ───────────────────────────────────────────────────────────
    console.log('\n💾 FASE 3: LOAD\n');

    await loader.truncateAll(dryRun);

    // Helper that runs all load operations in dependency order.
    // When `tx` is provided, all inserts share a single DB transaction so that
    // FK constraints (deferred via SET CONSTRAINTS ALL DEFERRED) are checked only
    // at commit time rather than after each individual table is loaded.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const execLoad = async (tx?: any): Promise<void> => {
      // Parent tables (no FK dependencies) first
      await loader.loadUsuarios(pgUsuarios, batchSize, dryRun, tx);
      await loader.loadCupons(pgCupons, batchSize, dryRun, tx);
      await loader.loadTiposInvestimento(pgTiposInvest, batchSize, dryRun, tx);
      await loader.loadInstituicoesFinanceiras(pgInstituicoes, batchSize, dryRun, tx);
      await loader.loadWebhookEvents(pgWebhooks, batchSize, dryRun, tx);

      // Level-1 children (FK to parent tables only)
      await loader.loadCategorias(pgCategorias, batchSize, dryRun, tx);
      await loader.loadAssinantes(pgAssinantes, batchSize, dryRun, tx);
      await loader.loadContas(pgContas, batchSize, dryRun, tx);

      // Level-2 children (FK to level-1 tables)
      await loader.loadAssinantesPagamentos(pgPagamentos, batchSize, dryRun, tx);
      await loader.loadContasPagar(pgContasPagar, batchSize, dryRun, tx);
      await loader.loadContasReceber(pgContasReceber, batchSize, dryRun, tx);
      await loader.loadInvestimentos(pgInvestimentos, batchSize, dryRun, tx);
      await loader.loadMetas(pgMetas, batchSize, dryRun, tx);
      await loader.loadAnexos(pgAnexos, batchSize, dryRun, tx);
      await loader.loadWhatsappLogs(pgWhatsapp, batchSize, dryRun, tx);

      // Level-3 children (FK to level-2 tables)
      await loader.loadMovimentacoesCaixa(pgMovimentacoes, batchSize, dryRun, tx);
      await loader.loadInvestimentosEventos(pgInvestEventos, batchSize, dryRun, tx);
      await loader.loadAnexosVinculos(pgAnexosVinculos, batchSize, dryRun, tx);

      // Level-4 children (FK to level-3 tables)
      await loader.loadMetasMovimentos(pgMetasMov, batchSize, dryRun, tx);

      // No-FK tables
      await loader.loadJobs(pgJobs, batchSize, dryRun, tx);
    };

    if (!dryRun) {
      // Wrap all inserts in a single transaction with deferred FK constraint checks.
      await loader.prisma.$transaction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (tx: any) => {
          await tx.$executeRaw`SET CONSTRAINTS ALL DEFERRED`;
          await execLoad(tx);
        },
        { timeout: transactionTimeout },
      );
    } else {
      await execLoad();
    }

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
