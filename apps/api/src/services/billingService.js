import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';
import { asaas } from '../lib/asaas/asaasClient.js';
import logger from '../logger.js';

/** Base prices in BRL */
const PRECOS = {
  mensal: 29.9,
  anual: 287.9,
};

/** Cycle mapping to Asaas values */
const CICLO_ASAAS = {
  mensal: 'MONTHLY',
  anual: 'YEARLY',
};

/**
 * Returns tomorrow's date as YYYY-MM-DD string.
 * @returns {string}
 */
function getNextDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Creates or updates a subscription for the given user.
 *
 * @param {string} usuarioId
 * @param {{ plano: string, ciclo: string, cupomCodigo?: string }} params
 * @returns {Promise<{ assinante: object, paymentLink: string|null }>}
 */
export async function criarAssinatura(usuarioId, { plano, ciclo, cupomCodigo }) {
  if (!CICLO_ASAAS[ciclo]) {
    throw AppError.badRequest(`Ciclo inválido: ${ciclo}. Use 'mensal' ou 'anual'`);
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id: usuarioId, deleted_at: null },
  });
  if (!usuario) throw AppError.notFound('Usuário não encontrado');

  let valor = PRECOS[ciclo] ?? PRECOS.mensal;

  // Apply coupon if provided
  if (cupomCodigo) {
    const agora = new Date();
    const cupomValido = await prisma.cupom.findFirst({
      where: {
        codigo: cupomCodigo,
        ativo: true,
        deleted_at: null,
        OR: [{ valido_ate: null }, { valido_ate: { gt: agora } }],
      },
    });

    if (!cupomValido || (cupomValido.uso_maximo !== null && cupomValido.uso_atual >= cupomValido.uso_maximo)) {
      throw AppError.badRequest('Cupom inválido ou expirado');
    }

    if (cupomValido.desconto_percentual) {
      const pct = Number(cupomValido.desconto_percentual);
      valor = Math.round(valor * (1 - pct / 100) * 100) / 100;
    } else if (cupomValido.desconto_fixo) {
      valor = valor - Number(cupomValido.desconto_fixo);
    }

    // Minimum value R$ 1,00
    if (valor < 1) valor = 1;
  }

  // Find or create Asaas customer
  let customer = await asaas.getCustomerByEmail(usuario.email);
  if (!customer) {
    customer = await asaas.createCustomer({
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone ?? undefined,
    });
  }

  const nextDueDate = getNextDueDate();
  const subscription = await asaas.createSubscription({
    customer: customer.id,
    billingType: 'BOLETO',
    cycle: CICLO_ASAAS[ciclo],
    value: valor,
    nextDueDate,
    description: `Plano ${plano} — ${ciclo}`,
    externalReference: usuarioId,
  });

  const assinante = await prisma.assinante.upsert({
    where: { usuario_id: usuarioId },
    create: {
      usuario_id: usuarioId,
      status: 'inativo',
      plano,
      provider: 'asaas',
      provider_customer_id: customer.id,
      provider_subscription_id: subscription.id,
    },
    update: {
      status: 'inativo',
      plano,
      provider: 'asaas',
      provider_customer_id: customer.id,
      provider_subscription_id: subscription.id,
      deleted_at: null,
    },
  });

  logger.info({ usuarioId, subscriptionId: subscription.id, plano, ciclo }, 'Assinatura criada');

  return {
    assinante,
    paymentLink: subscription.invoiceUrl ?? null,
  };
}

/**
 * Cancels the subscription for the given user.
 *
 * @param {string} usuarioId
 * @returns {Promise<void>}
 */
export async function cancelarAssinatura(usuarioId) {
  const assinante = await prisma.assinante.findFirst({
    where: { usuario_id: usuarioId, deleted_at: null },
  });

  if (!assinante) {
    throw AppError.badRequest('Nenhuma assinatura ativa encontrada');
  }

  if (assinante.status === 'cancelado') {
    throw AppError.badRequest('Assinatura já cancelada');
  }

  // Try to cancel on Asaas, but don't fail if it throws
  if (assinante.provider_subscription_id) {
    try {
      await asaas.cancelSubscription(assinante.provider_subscription_id);
    } catch (err) {
      logger.error({ err, usuarioId, subscriptionId: assinante.provider_subscription_id }, 'Erro ao cancelar assinatura no Asaas');
    }
  }

  await prisma.assinante.update({
    where: { id: assinante.id },
    data: { status: 'cancelado' },
  });

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { status: 'ativo' },
  });

  logger.info({ usuarioId }, 'Assinatura cancelada');
}

/**
 * Returns the subscription status for the given user.
 *
 * @param {string} usuarioId
 * @returns {Promise<object|null>}
 */
export async function getStatusAssinatura(usuarioId) {
  const assinante = await prisma.assinante.findFirst({
    where: { usuario_id: usuarioId, deleted_at: null },
  });
  return assinante ?? null;
}
