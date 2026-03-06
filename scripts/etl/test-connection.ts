import 'dotenv/config';
import mysql from 'mysql2/promise';
import { Pool } from 'pg';
import { config } from './config';

async function testMysqlConnection(): Promise<boolean> {
  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection(config.mysql);
    const [rows] =
      await connection.query<mysql.RowDataPacket[]>('SELECT 1 AS ok');
    const ok = Array.isArray(rows) && rows[0]?.['ok'] === 1;
    if (ok) {
      console.log('✅ MySQL: conexão bem-sucedida');
    }
    return ok;
  } catch (err) {
    console.error('❌ MySQL: erro de conexão —', (err as Error).message);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

async function testPostgresConnection(): Promise<boolean> {
  const pool = new Pool({ connectionString: config.postgres.connectionString });
  try {
    const result = await pool.query('SELECT 1 AS ok');
    const ok = result.rows[0]?.['ok'] === 1;
    if (ok) {
      console.log('✅ Postgres: conexão bem-sucedida');
    }
    return ok;
  } catch (err) {
    console.error('❌ Postgres: erro de conexão —', (err as Error).message);
    return false;
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  console.log('🔌 Testando conexões...\n');
  const mysqlOk = await testMysqlConnection();
  const postgresOk = await testPostgresConnection();

  if (mysqlOk && postgresOk) {
    console.log('\n✨ Todas as conexões estabelecidas com sucesso!');
    process.exit(0);
  } else {
    console.error(
      '\n💥 Falha em uma ou mais conexões. Verifique as variáveis de ambiente.'
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
