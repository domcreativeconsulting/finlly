import prisma from '../utils/database.js';
import { asaas } from '../lib/asaas/asaasClient.js';
import { AppError } from '../errors/AppError.js';
import logger from '../logger.js';

const PLANOS = {
  mensal: { valor: 29.90, cicloAsaas: 'MONTHLY', label: 'Mensal' },
  anual:  { valor: 287.90, cicloAsaas: 'YEARLY',  label: 'Anual' },
};

const GRACE_PERIOD_DAYS = 3;

/**
 * Formats a Date to YYYY-MM-DD string (Asaas date format).
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Validates and applies a coupon discount to a value.
 * @param {string} cupomCodigo
 * @param {number} valor
 * @returns {Promise<{ valorComDesconto: number, cupomId: string }>}
 */
async function aplicarCupom(cupomCodigo, valor) {
  const cupom = await prisma.cupom.findFirst({
    where: {
      codigo: cupomCodigo,
      ativo: true,
      deleted_at: null,
    },
  });

  if (!cupom) {
    throw AppError.badRequest(`Cupom "${cupomCodigo}" inválido ou expirado`);
  }

  if (cupom.valido_ate && cupom.valido_ate < new Date()) {
    throw AppError.badRequest(`Cupom "${cupomCodigo}" expirado`);
  }

  if (cupom.uso_maximo !== null && cupom.uso_atual >= cupom.uso_maximo) {
    throw AppError.badRequest(`Cupom "${cupomCodigo}" atingiu o limite de uso`);
  }

  let valorComDesconto = valor;

  if (cupom.desconto_percentual) {
    valorComDesconto = Math.max(0, valor - (valor * Number(cupom.desconto_percentual)) / 100);
  } else if (cupom.desconto_fixo) {
    valorComDesconto = Math.max(0, valor - Number(cupom.desconto_fixo));
  }

  return { valorComDesconto: Math.round(valorComDesconto * 100) / 100, cupomId: cupom.id };
}

/**
 * Creates or updates an Asaas subscription for a user.
 * @param {string} usuarioId
 * @param {{ plano: string, ciclo: string, cupomCodigo?: string }} params
 * @returns {Promise<{ assinante: object, paymentLink?: string }>}
 */
export async function criarAssinatura(usuarioId, { plano, ciclo, cupomCodigo }) {
  const planoDef = PLANOS[ciclo];
  if (!planoDef) {
    throw AppError.badRequest(`Ciclo inválido: ${ciclo}. Use 'mensal' ou 'anual'`);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId, deleted_at: null },
    select: { id: true, nome: true, email: true, telefone: true },
  });

  if (!usuario) {
    throw AppError.notFound('Usuário não encontrado');
  }

  // Calculate price (with optional coupon)
  let valor = planoDef.valor;
  let cupomId = null;

  if (cupomCodigo) {
    const { valorComDesconto, cupomId: id } = await aplicarCupom(cupomCodigo, valor);
    valor = valorComDesconto;
    cupomId = id;
  }

  // Get or create Asaas customer
  let asaasCustomer = await asaas.getCustomerByEmail(usuario.email);

  if (!asaasCustomer) {
    asaasCustomer = await asaas.createCustomer({
      nome: usuario.nome,
      email: usuario.email,
      phone: usuario.telefone || undefined,
    });
  }

  const nextDueDate = formatDate(new Date());

  const subscription = await asaas.createSubscription({
    customer: asaasCustomer.id,
    billingType: 'BOLETO',
    cycle: planoDef.cicloAsaas,
    value: valor,
    nextDueDate,
    description: `Plano ${planoDef.label} - Finlly`,
    externalReference: usuarioId,
  });

  const assinante = await prisma.assinante.upsert({
    where: { usuario_id: usuarioId },
    update: {
      status: 'pendente',
      plano,
      provider: 'asaas',
      provider_customer_id: asaasCustomer.id,
      provider_subscription_id: subscription.id,
      ...(cupomId ? { cupom_id: cupomId } : {}),
      proxima_cobranca: new Date(nextDueDate),
      updated_at: new Date(),
    },
    create: {
      usuario_id: usuarioId,
      status: 'pendente',
      plano,
      provider: 'asaas',
      provider_customer_id: asaasCustomer.id,
      provider_subscription_id: subscription.id,
      ...(cupomId ? { cupom_id: cupomId } : {}),
      proxima_cobranca: new Date(nextDueDate),
    },
  });

  logger.info({ msg: 'Assinatura criada', usuarioId, plano, ciclo, subscriptionId: subscription.id });

  return {
    assinante,
    paymentLink: subscription.invoiceUrl || subscription.bankSlipUrl || undefined,
  };
}

/**
 * Returns the subscription status and recent payments for a user.
 * @param {string} usuarioId
 * @returns {Promise<{ assinante: object|null, ultimosPagamentos: object[] }>}
 */
export async function getStatusAssinatura(usuarioId) {
  const assinante = await prisma.assinante.findUnique({
    where: { usuario_id: usuarioId },
  });

  const ultimosPagamentos = await prisma.assinantePagamento.findMany({
    where: { usuario_id: usuarioId, deleted_at: null },
    orderBy: { created_at: 'desc' },
    take: 10,
  });

  return { assinante, ultimosPagamentos };
}

/**
 * Cancels the user's Asaas subscription.
 * @param {string} usuarioId
 * @returns {Promise<void>}
 */
export async function cancelarAssinatura(usuarioId) {
  const assinante = await prisma.assinante.findUnique({
    where: { usuario_id: usuarioId },
  });

  if (!assinante || !['ativo', 'pendente', 'trial', 'inadimplente'].includes(assinante.status)) {
    throw AppError.badRequest('Nenhuma assinatura ativa encontrada para cancelar');
  }

  if (assinante.provider_subscription_id) {
    try {
      await asaas.cancelSubscription(assinante.provider_subscription_id);
    } catch (err) {
      // If already cancelled in Asaas, continue with local update
      logger.warn({ msg: 'Asaas cancel subscription error (continuing)', err: err.message });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.assinante.update({
      where: { id: assinante.id },
      data: { status: 'cancelado', updated_at: new Date() },
    });

    await tx.usuario.update({
      where: { id: usuarioId },
      data: { status: 'ativo', updated_at: new Date() },
    });
  });

  logger.info({ msg: 'Assinatura cancelada', usuarioId, assinanteId: assinante.id });
}

export { PLANOS, GRACE_PERIOD_DAYS };
