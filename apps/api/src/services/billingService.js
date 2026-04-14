import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';
import { asaas } from '../lib/asaas/asaasClient.js';
import logger from '../logger.js';
import { atualizarStatusAssinante } from './assinanteStatusService.js';
import { getRedisClient } from '../utils/redisClient.js';
import { config } from '../config/env.js';
import { registrarEvento } from './auditoria.service.js';

const BILLING_STATUS_CACHE_PREFIX = 'billing:status:';

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
 * Removes all non-digit characters from a string.
 * @param {string|undefined|null} value
 * @returns {string|undefined}
 */
function apenasDigitos(value) {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 ? digits : undefined;
}

/**
 * Creates or updates a subscription for the given user.
 *
 * @param {string} usuarioId
 * @param {{ plano: string, ciclo: string, formaPagamento: 'PIX'|'CREDIT_CARD', cupomCodigo?: string, cpf?: string, telefone?: string }} params
 * @returns {Promise<{ assinante: object, paymentLink: string|null }>}
 */
export async function criarAssinatura(usuarioId, { plano, ciclo, formaPagamento, cupomCodigo, cpf, telefone }) {
  if (!CICLO_ASAAS[ciclo]) {
    throw AppError.badRequest(`Ciclo inválido: ${ciclo}. Use 'mensal' ou 'anual'`);
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id: usuarioId, deleted_at: null },
  });
  if (!usuario) throw AppError.notFound('Usuário não encontrado');

  // Guard: impede criação se já existe assinatura ativa ou pendente
  const assinaturaExistente = await prisma.assinante.findFirst({
    where: {
      usuario_id: usuarioId,
      deleted_at: null,
      status: { in: ['ativo', 'pendente'] },
    },
  });
  if (assinaturaExistente) {
    throw AppError.conflict('Usuário já possui uma assinatura ativa ou pendente');
  }

  let valor = PRECOS[ciclo] ?? PRECOS.mensal;

  // Apply coupon if provided
  let cupomId = undefined;
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
    cupomId = cupomValido.id;
  }

  // Find or create Asaas customer
  // CPF e telefone são limpos (apenas dígitos) pois o Asaas não aceita formatação
  let customer = await asaas.getCustomerByEmail(usuario.email);
  if (!customer) {
    const cpfLimpo      = apenasDigitos(cpf);
    const telefoneLimpo = apenasDigitos(telefone ?? usuario.telefone);

    customer = await asaas.createCustomer({
      nome:     usuario.nome,
      email:    usuario.email,
      cpfCnpj:  cpfLimpo,
      telefone: telefoneLimpo,
    });
  }

  // Guard: se customer ainda null, criação falhou no Asaas
  if (!customer || !customer.id) {
    throw AppError.internal('Não foi possível criar o cliente no provedor de pagamento');
  }

  const nextDueDate = getNextDueDate();
  const subscription = await asaas.createSubscription({
    customer:          customer.id,
    billingType:       formaPagamento,
    cycle:             CICLO_ASAAS[ciclo],
    value:             valor,
    nextDueDate,
    description:       `Plano ${plano} — ${ciclo}`,
    externalReference: usuarioId,
  });

  const assinante = await prisma.assinante.upsert({
    where: { usuario_id: usuarioId },
    create: {
      usuario_id:               usuarioId,
      status:                   'pendente',
      plano,
      provider:                 'asaas',
      provider_customer_id:     customer.id,
      provider_subscription_id: subscription.id,
      ...(cupomId ? { cupom_id: cupomId } : {}),
    },
    update: {
      status:                   'pendente',
      plano,
      provider:                 'asaas',
      provider_customer_id:     customer.id,
      provider_subscription_id: subscription.id,
      deleted_at:               null,
      ...(cupomId ? { cupom_id: cupomId } : {}),
    },
  });

  // Increment coupon usage after successful subscription creation
  if (cupomId) {
    await prisma.cupom.update({
      where: { id: cupomId },
      data:  { uso_atual: { increment: 1 } },
    });
  }

  logger.info({ usuarioId, subscriptionId: subscription.id, plano, ciclo }, 'Assinatura criada');

  registrarEvento({
    usuarioId,
    actorType:    'USER',
    eventType:    'billing',
    eventAction:  'assinatura_criada',
    entityType:   'assinante',
    entityId:     assinante.id,
    metadata:     { plano, ciclo, subscriptionId: subscription.id },
    sucesso:      true,
  });

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

  await atualizarStatusAssinante(assinante.id, assinante.usuario_id, 'cancelado');

  // Invalidate billing status cache (best-effort)
  try {
    const redis = await getRedisClient();
    await redis.del(`${BILLING_STATUS_CACHE_PREFIX}${usuarioId}`);
  } catch {
    // Redis unavailable — ignore
  }

  logger.info({ usuarioId }, 'Assinatura cancelada');

  registrarEvento({
    usuarioId,
    actorType:   'USER',
    eventType:   'billing',
    eventAction: 'assinatura_cancelada',
    entityType:  'assinante',
    entityId:    assinante.id,
    metadata:    { plano: assinante.plano },
    sucesso:     true,
  });
}

/**
 * Returns the subscription status for the given user.
 *
 * @param {string} usuarioId
 * @returns {Promise<object|null>}
 */
export async function getStatusAssinatura(usuarioId) {
  const cacheKey = `${BILLING_STATUS_CACHE_PREFIX}${usuarioId}`;

  // Try cache first
  try {
    const redis = await getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }
  } catch {
    // Redis unavailable — fall through to DB
  }

  // Fetch from DB
  const assinante = await prisma.assinante.findFirst({
    where: { usuario_id: usuarioId, deleted_at: null },
  });

  // Save to cache (best-effort)
  try {
    const redis = await getRedisClient();
    const ttl = config.BILLING_STATUS_CACHE_TTL;
    await redis.set(cacheKey, JSON.stringify(assinante), { EX: ttl });
  } catch {
    // Redis unavailable — ignore
  }

  return assinante ?? null;
}
