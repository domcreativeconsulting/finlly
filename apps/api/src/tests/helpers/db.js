import prisma from '../../utils/database.js';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL must be set before importing test DB helpers. ' +
      'Integration tests require a dedicated test database.',
  );
}

/**
 * The Prisma client instance pointing at the test database.
 * Relies on DATABASE_URL being set to TEST_DATABASE_URL before any module is loaded.
 * Set this at the top of each integration test file:
 *   process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
 */
export const prismaTest = prisma;

/**
 * Deletes all rows from billing/webhook tables in FK-safe order.
 * Call in beforeEach to isolate tests.
 */
export async function cleanDb() {
  await prismaTest.webhookEvent.deleteMany();
  await prismaTest.assinantePagamento.deleteMany();
  await prismaTest.assinante.deleteMany();
  await prismaTest.usuario.deleteMany();
}

/**
 * Disconnects the test Prisma client.
 * Call in afterAll.
 */
export async function disconnectDb() {
  await prismaTest.$disconnect();
}
