import { PostgresLoader } from './loaders/postgres.loader';

async function rollback(): Promise<void> {
  console.log('🔄 Iniciando rollback — limpando todas as tabelas...\n');
  const loader = new PostgresLoader();
  try {
    await loader.truncateAll(false);
    console.log('\n✅ Rollback concluído — todas as tabelas estão vazias.');
  } catch (err) {
    console.error('💥 Erro durante rollback:', (err as Error).message);
    process.exit(1);
  } finally {
    await loader.disconnect();
  }
}

rollback().catch((err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
