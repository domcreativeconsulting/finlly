/**
 * WhatsApp Agent Service — User resolution and action orchestration.
 *
 * Isolated module that resolves the user from their WhatsApp number and
 * executes the appropriate financial action based on the detected NLP intent.
 * This module must NOT be mixed with whatsappService.js (Evolution API I/O).
 *
 * @module whatsappAgentService
 */

import prisma from '../utils/database.js';
import logger from '../logger.js';
import { createMovimentacao, getSaldoConsolidado } from './movimentacoesService.js';
import { getExtrato } from './extratoService.js';
import { listContas } from './contaService.js';
import { createContaPagar, listContasPagar, pagarContaPagar } from './contasPagarService.js';
import {
  INTENT_CREATE_EXPENSE,
  INTENT_CREATE_INCOME,
  INTENT_GET_BALANCE,
  INTENT_GET_STATEMENT,
  INTENT_CREATE_BILL,
  INTENT_PAY_BILL,
  INTENT_CREATE_INVESTMENT,
} from './nlpService.js';
import { normalizePhoneNumber } from '../lib/whatsapp/evolutionPayloadParser.js';
import {
  replyDespesaRegistrada,
  replyReceitaRegistrada,
  replyContaPagarRegistrada,
  replyContaPaga,
  replySemContasPendentes,
  replySaldo,
  replyExtrato,
  replyExtratoVazio,
  replyInvestimentoRegistrado,
  replyErroSemConta,
  replyErroGenerico,
  replyValorNaoIdentificado,
} from '../lib/whatsapp/whatsappReplyBuilder.js';

/**
 * Returns today's date in YYYY-MM-DD format (UTC).
 *
 * @returns {string}
 */
function hoje() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns the first day of the current month in YYYY-MM-DD format (UTC).
 *
 * @returns {string}
 */
function primeiroDiaDoMes() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Returns the date N days ago in YYYY-MM-DD format (UTC).
 *
 * @param {number} dias
 * @returns {string}
 */
function diasAtras(dias) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// Public API
// ============================================================

/**
 * Finds a user by their whatsapp number.
 * Strips all non-digit characters before comparing.
 *
 * @param {string} telefone - Raw phone number from webhook (e.g. "5511999999999")
 * @returns {Promise<object|null>} usuario or null if not found
 */
export async function resolverUsuarioPorWhatsapp(telefone) {
  const telNormalizado = normalizePhoneNumber(telefone);

  // Fast path: try exact match first
  const exato = await prisma.usuario.findFirst({
    where: { whatsapp: telefone, status: 'ativo', deleted_at: null },
  });
  if (exato) return exato;

  // Slow path: fetch all active users with whatsapp set and filter in memory
  const usuarios = await prisma.usuario.findMany({
    where: { whatsapp: { not: null }, status: 'ativo', deleted_at: null },
  });

  return usuarios.find((u) => normalizePhoneNumber(u.whatsapp) === telNormalizado) ?? null;
}

/**
 * Executes the action corresponding to the detected intent.
 * Returns a string reply to be sent back to the user.
 *
 * @param {object} usuario - Resolved usuario object (must have id)
 * @param {string} intent  - Intent constant from nlpService
 * @param {object} params  - Extracted params from nlpService
 * @returns {Promise<string>} Reply text
 */
export async function executarAcao(usuario, intent, params) {
  const userId = usuario.id;

  try {
    // -------------------------------------------------------
    // CREATE_EXPENSE / CREATE_INCOME
    // -------------------------------------------------------
    if (intent === INTENT_CREATE_EXPENSE || intent === INTENT_CREATE_INCOME) {
      const tipo = intent === INTENT_CREATE_EXPENSE ? 'saida' : 'entrada';

      if (!params.valor || params.valor <= 0) {
        return replyValorNaoIdentificado();
      }

      const contas = await listContas(userId);
      if (!contas || contas.length === 0) {
        return replyErroSemConta();
      }

      const conta = contas[0];
      const dataHoje = hoje();
      const descricao = params.descricao || (tipo === 'saida' ? 'Despesa via WhatsApp' : 'Receita via WhatsApp');

      const mov = await createMovimentacao(userId, {
        conta_id: conta.id,
        tipo,
        valor: params.valor,
        descricao,
        data: dataHoje,
      });

      // CREATE_INCOME: simple formatted reply with user name
      if (tipo === 'entrada') {
        return replyReceitaRegistrada({
          nome: usuario.nome,
          valor: mov.valor ?? params.valor,
          descricao,
          conta: conta.nome,
          data: dataHoje,
        });
      }

      // CREATE_EXPENSE: enrich with weekly summary and low-balance alert
      const [saldoResult, extratoResult] = await Promise.all([
        getSaldoConsolidado(userId),
        getExtrato(userId, { dateFrom: diasAtras(7), dateTo: hoje(), perPage: 100 }),
      ]);

      const totalSemana = extratoResult?.totals?.totalOut ?? 0;
      const saldoAtual = saldoResult?.saldo ?? 0;

      return replyDespesaRegistrada({
        nome: usuario.nome,
        valor: mov.valor ?? 0,
        descricao,
        conta: conta.nome,
        data: dataHoje,
        totalSemana,
        saldo: saldoAtual,
      });
    }

    // -------------------------------------------------------
    // GET_BALANCE
    // -------------------------------------------------------
    if (intent === INTENT_GET_BALANCE) {
      const { saldo, entradas, saidas } = await getSaldoConsolidado(userId);
      return replySaldo({ nome: usuario.nome, saldo, entradas, saidas });
    }

    // -------------------------------------------------------
    // GET_STATEMENT
    // -------------------------------------------------------
    if (intent === INTENT_GET_STATEMENT) {
      const periodo = params.periodo || 'mes';
      const dateTo = hoje();
      const dateFrom = periodo === 'semana' ? diasAtras(7) : primeiroDiaDoMes();
      const labelPeriodo = periodo === 'semana' ? 'semana' : 'mês';

      const extrato = await getExtrato(userId, { dateFrom, dateTo, perPage: 5 });

      if (!extrato.items || extrato.items.length === 0) {
        return replyExtratoVazio();
      }

      const { totalIn, totalOut } = extrato.totals;

      return replyExtrato({
        nome: usuario.nome,
        periodo: labelPeriodo,
        items: extrato.items,
        totalIn,
        totalOut,
      });
    }

    // -------------------------------------------------------
    // CREATE_BILL
    // -------------------------------------------------------
    if (intent === INTENT_CREATE_BILL) {
      const descricao = params.descricao || 'Conta via WhatsApp';
      const dataVencimento = params.data_vencimento ?? hoje();

      const conta = await createContaPagar(userId, {
        descricao,
        valor: params.valor,
        data_vencimento: dataVencimento,
      });

      return replyContaPagarRegistrada({
        descricao,
        valor: conta.valor,
        dataVencimento,
      });
    }

    // -------------------------------------------------------
    // PAY_BILL
    // -------------------------------------------------------
    if (intent === INTENT_PAY_BILL) {
      const result = await listContasPagar(userId, { status: 'pendente', limit: 20 });
      const lista = result?.data ?? [];

      if (lista.length === 0) {
        return replySemContasPendentes();
      }

      const descricaoBusca = params.descricao?.toLowerCase().trim() || null;
      const valorBusca = params.valor ?? null;
      const dataBusca = params.data_vencimento ?? null;

      function scoreConta(conta) {
        let score = 0;

        if (descricaoBusca && conta.descricao) {
          const desc = conta.descricao.toLowerCase();
          if (desc.includes(descricaoBusca)) score += 3;
          if (desc.startsWith(descricaoBusca)) score += 2;
        }

        if (valorBusca !== null && valorBusca !== undefined) {
          const diff = Math.abs(Number(conta.valor) - valorBusca);
          if (diff < 0.01) score += 4;
        }

        if (dataBusca && conta.data_vencimento) {
          const diaAlvo = new Date(dataBusca).getUTCDate();
          const diaConta = new Date(conta.data_vencimento).getUTCDate();
          if (diaAlvo === diaConta) score += 3;
        }

        return score;
      }

      const scored = lista
        .map((c) => ({ conta: c, score: scoreConta(c) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return new Date(a.conta.data_vencimento) - new Date(b.conta.data_vencimento);
        });

      const contaAlvo = scored.length > 0 ? scored[0].conta : lista[0];

      const pago = await pagarContaPagar(contaAlvo.id, userId, { data_pagamento: hoje() });

      return replyContaPaga({
        descricao: contaAlvo.descricao,
        valor: pago.valor ?? contaAlvo.valor,
        data: hoje(),
      });
    }

    // -------------------------------------------------------
    // CREATE_INVESTMENT
    // -------------------------------------------------------
    if (intent === INTENT_CREATE_INVESTMENT) {
      if (!params.valor || params.valor <= 0) {
        return replyValorNaoIdentificado();
      }

      const contas = await listContas(userId);
      if (!contas || contas.length === 0) {
        return replyErroSemConta();
      }

      const conta = contas[0];
      const descricao = params.descricao ? `Investimento: ${params.descricao}` : 'Investimento via WhatsApp';

      const mov = await createMovimentacao(userId, {
        conta_id: conta.id,
        tipo: 'saida',
        valor: params.valor,
        descricao,
        data: hoje(),
      });

      return replyInvestimentoRegistrado({
        nome: usuario.nome,
        valor: mov.valor ?? params.valor,
        descricao,
        conta: conta.nome,
        data: hoje(),
      });
    }

    // Fallback (should not happen as UNKNOWN is handled upstream)
    return '❓ Ação não reconhecida.';
  } catch (err) {
    logger.error({ err, userId, intent }, 'Erro ao executar ação WhatsApp Agent');
    return replyErroGenerico();
  }
}
