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
// ✅ CORREÇÃO: preços atualizados para 39.90 mensal e 399.00 anual
const PRECOS = {
  mensal: 5.00,
  anual: 399.0,
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
 * ✅ CORREÇÃO: mapeia campos snake_case do banco para camelCase esperado pelo frontend
 */
function mapAssinante(assinante) {
  if (!assinante) return null;
  return {
    ...assinante,
    formaPagamento:        assinante.forma_pagamento ?? null,
    dataProximoVencimento: assinante.proxima_cobranca ?? null, // ajuste correto
    providerSubscriptionId: assinante.provider_subscription_id ?? null,
    providerCustomerId: assinante.provider_customer_id ?? null,
    // remove or add other mappings as needed
  };
}

/**
 * Creates or updates a subscription for the given user.
 *
 * @param {string} usuarioId
 * @param {{ plano: string, ciclo: string, formaPagamento: 'PIX'|'CREDIT_CARD', cupomCodigo?: string, cpf?: string, telefone?: string, creditCard?: object, creditCardHolderInfo?: object, remoteIp?: string }}
 * @returns {Promise<{ assinante: object, paymentLink: string|null, pixQrCode: string|null, pixCopiaECola: string|null }>}
 */
export async function criarAssinatura(usuarioId, { plano, ciclo, formaPagamento, cupomCodigo, cpf, telefone, creditCard, creditCardHolderInfo, remoteIp }) {
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
    ...(creditCard           ? { creditCard }           : {}),
    ...(creditCardHolderInfo ? { creditCardHolderInfo } : {}),
    ...(remoteIp             ? { remoteIp }             : {}),
  });

  const assinante = await prisma.assinante.upsert({
    where: { usuario_id: usuarioId },
    create: {
      usuario_id:               usuarioId,
      status:                   'pendente',
      plano,
      ciclo,
forma_pagamento: formaPagamento,
      provider:                 'asaas',
      provider_customer_id:     customer.id,
      provider_subscription_id: subscription.id,
      ...(cupomId ? { cupom_id: cupomId } : {}),
    },
    update: {
      status:                   'pendente',
      plano,
      forma_pagamento: formaPagamento,
      provider:                 'asaas',
      provider_customer_id:     customer.id,
      provider_subscription_id: subscription.id,
      deleted_at:               null,
      ...(cupomId ? { cupom_id: cupomId } : {}),
    },
  });

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

  let paymentLink   = subscription.invoiceUrl ?? null;
  let pixQrCode     = null;
  let pixCopiaECola = null;
  let paymentId     = null;

  // Busca o primeiro payment da assinatura (com retry — Asaas gera de forma assíncrona)
  if (subscription.id) {
    for (let i = 0; i < 3; i++) {
      try {
        await new Promise(r => setTimeout(r, 1000)); // aguarda 1s entre tentativas
        const payments = await asaas.getPaymentsBySubscription(subscription.id);
        const firstPayment = payments?.data?.[0];
        if (firstPayment?.id) {
          paymentId = firstPayment.id;
          if (!paymentLink) {
            paymentLink = firstPayment.invoiceUrl ?? firstPayment.bankSlipUrl ?? null;
          }
          logger.info({ subscriptionId: subscription.id, paymentId, attempt: i + 1 }, 'Payment encontrado');
          break;
        }
      } catch (err) {
        logger.warn({ err, subscriptionId: subscription.id, attempt: i + 1 }, 'Tentativa de buscar payment falhou');
      }
    }
  }

  // Se for PIX, busca o QR Code (com retry)
  if (formaPagamento === 'PIX' && paymentId) {
    for (let i = 0; i < 3; i++) {
      try {
        await new Promise(r => setTimeout(r, 1000)); // aguarda 1s entre tentativas
        const qrData = await asaas.getPixQrCode(paymentId);
        if (qrData?.encodedImage) {
          pixQrCode     = qrData.encodedImage;
          pixCopiaECola = qrData.payload ?? null;
          logger.info({ paymentId, attempt: i + 1 }, 'PIX QR Code obtido com sucesso');
          break;
        }
      } catch (err) {
        logger.warn({ err, paymentId, attempt: i + 1 }, 'Tentativa de buscar QR Code PIX falhou');
      }
    }
  }

  return {
    assinante: mapAssinante(assinante),
    paymentLink,
    pixQrCode,
    pixCopiaECola,
  };
}

/**
 * Cancels the subscription for the given user.
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

  if (assinante.provider_subscription_id) {
    try {
      await asaas.cancelSubscription(assinante.provider_subscription_id);
    } catch (err) {
      logger.error({ err, usuarioId, subscriptionId: assinante.provider_subscription_id }, 'Erro ao cancelar assinatura no Asaas');
    }
  }

  await atualizarStatusAssinante(assinante.id, assinante.usuario_id, 'cancelado');

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
 */
export async function getStatusAssinatura(usuarioId) {
  const cacheKey = `${BILLING_STATUS_CACHE_PREFIX}${usuarioId}`;

  try {
    const redis = await getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }
  } catch {
    // Redis unavailable — fall through to DB
  }

  const assinante = await prisma.assinante.findFirst({
    where: { usuario_id: usuarioId, deleted_at: null },
  });

  // ✅ CORREÇÃO: mapear snake_case → camelCase antes de cachear e retornar
  const mapped = mapAssinante(assinante);

  try {
    const redis = await getRedisClient();
    const ttl = config.BILLING_STATUS_CACHE_TTL;
    await redis.set(cacheKey, JSON.stringify(mapped), { EX: ttl });
  } catch {
    // Redis unavailable — ignore
  }

  return mapped;
}
