import prisma from '../utils/database.js';
import { listContasPagar } from './contasPagarService.js';

/**
 * Returns today's date as YYYY-MM-DD (UTC).
 * @returns {string}
 */
function hoje() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetches all active users with WhatsApp linked.
 * @returns {Promise<Array<{ id: string, nome: string, whatsapp: string }>>}
 */
export async function buscarUsuariosComWhatsapp() {
  return prisma.usuario.findMany({
    where: {
      whatsapp: { not: null },
      status: 'ativo',
      deleted_at: null,
    },
    select: { id: true, nome: true, whatsapp: true },
  });
}

/**
 * Fetches contas a pagar due today AND overdue (pendente only) for a user.
 * @param {string} userId
 * @returns {Promise<{ hoje: import('@prisma/client').ContaPagar[], atrasadas: import('@prisma/client').ContaPagar[] }>}
 */
export async function buscarContasDoDia(userId) {
  const dataHoje = hoje();

  const { data: contasHoje } = await listContasPagar(userId, {
    status: 'pendente',
    data_vencimento_de: dataHoje,
    data_vencimento_ate: dataHoje,
    limit: 50,
  });

  const ontem = new Date();
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  const dataOntem = ontem.toISOString().slice(0, 10);

  const { data: contasAtrasadas } = await listContasPagar(userId, {
    status: 'pendente',
    data_vencimento_ate: dataOntem,
    limit: 50,
  });

  return { hoje: contasHoje, atrasadas: contasAtrasadas };
}
