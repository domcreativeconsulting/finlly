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
import {
  INTENT_CREATE_EXPENSE,
  INTENT_CREATE_INCOME,
  INTENT_GET_BALANCE,
  INTENT_GET_STATEMENT,
} from './nlpService.js';
import { normalizePhoneNumber } from '../lib/whatsapp/evolutionPayloadParser.js';

/**
 * Formats a number as Brazilian currency string (e.g. 1234.56 → "1.234,56").
 *
 * @param {number} value
 * @returns {string}
 */
function formatarMoeda(value) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formats a date string (YYYY-MM-DD) or Date object as dd/mm/yyyy.
 *
 * @param {string|Date} date
 * @returns {string}
 */
function formatarData(date) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00Z') : date;
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

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

/** Threshold below which a low-balance warning is added to expense replies (BRL) */
const SALDO_BAIXO_THRESHOLD = 100;

// ============================================================
// Private helpers
// ============================================================

/**
 * Builds the reply text for a successfully registered expense.
 *
 * Sections (in order):
 *  1. Confirmation line with user name
 *  2. Transaction details (value, description, account, date)
 *  3. Weekly spending summary (always included)
 *  4. Low-balance / negative-balance warning (only when saldo < SALDO_BAIXO_THRESHOLD)
 *
 * @param {object} usuario    - Resolved usuario (must have `nome`)
 * @param {object} mov        - Created movimentacao object (must have `valor`)
 * @param {object} conta      - Account used (must have `nome`)
 * @param {string} descricao  - Transaction description
 * @param {string} dataHoje   - Date string (YYYY-MM-DD)
 * @param {number} totalSemana - Total spent in the last 7 days (totalOut)
 * @param {number} saldoAtual  - Current consolidated balance
 * @returns {string}
 */
function construirRespostaDespesa(usuario, mov, conta, descricao, dataHoje, totalSemana, saldoAtual) {
  const valorFormatado = formatarMoeda(mov.valor ?? 0);
  const dataFormatada = formatarData(dataHoje);

  let msg =
    `✅ Despesa registrada, ${usuario.nome}!\n\n` +
    `💸 Valor: R$ ${valorFormatado}\n` +
    `📝 Descrição: ${descricao}\n` +
    `🏦 Conta: ${conta.nome}\n` +
    `📅 Data: ${dataFormatada}`;

  msg += `\n\n📈 Total gasto nesta semana: R$ ${formatarMoeda(totalSemana)}`;

  if (saldoAtual < SALDO_BAIXO_THRESHOLD) {
    if (saldoAtual < 0) {
      msg += `\n⚠️ Atenção: seu saldo está negativo (R$ ${formatarMoeda(saldoAtual)}).`;
    } else {
      msg += `\n⚠️ Atenção: seu saldo está baixo (R$ ${formatarMoeda(saldoAtual)}).`;
    }
  }

  return msg;
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

      const contas = await listContas(userId);
      if (!contas || contas.length === 0) {
        return '❌ Você não tem nenhuma conta cadastrada. Acesse o Finlly para criar uma conta primeiro.';
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
        const valorFormatado = formatarMoeda(mov.valor ?? params.valor);
        const dataFormatada = formatarData(dataHoje);
        return (
          `✅ Receita registrada, ${usuario.nome}!\n\n` +
          `💰 Valor: R$ ${valorFormatado}\n` +
          `📝 Descrição: ${descricao}\n` +
          `🏦 Conta: ${conta.nome}\n` +
          `📅 Data: ${dataFormatada}`
        );
      }

      // CREATE_EXPENSE: enrich with weekly summary and low-balance alert
      const [saldoResult, extratoResult] = await Promise.all([
        getSaldoConsolidado(userId),
        getExtrato(userId, { dateFrom: diasAtras(7), dateTo: hoje(), perPage: 100 }),
      ]);

      const totalSemana = extratoResult?.totals?.totalOut ?? 0;
      const saldoAtual = saldoResult?.saldo ?? 0;

      return construirRespostaDespesa(usuario, mov, conta, descricao, dataHoje, totalSemana, saldoAtual);
    }

    // -------------------------------------------------------
    // GET_BALANCE
    // -------------------------------------------------------
    if (intent === INTENT_GET_BALANCE) {
      const { saldo, entradas, saidas } = await getSaldoConsolidado(userId);

      return (
        `💰 Saldo de ${usuario.nome}\n\n` +
        `Saldo: R$ ${formatarMoeda(saldo)}\n` +
        `Entradas: R$ ${formatarMoeda(entradas)}\n` +
        `Saídas: R$ ${formatarMoeda(saidas)}`
      );
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
        return '📊 Nenhuma movimentação encontrada no período.';
      }

      const linhas = extrato.items.map((item) => {
        const emojiTipo = item.type === 'IN' ? '💚' : '🔴';
        return `${emojiTipo} ${item.description} — R$ ${formatarMoeda(item.amount)}`;
      });

      const { totalIn, totalOut } = extrato.totals;

      return (
        `📊 Extrato da ${labelPeriodo} — ${usuario.nome}\n\n` +
        linhas.join('\n') +
        '\n\n' +
        `Total de entradas: R$ ${formatarMoeda(totalIn)}\n` +
        `Total de saídas: R$ ${formatarMoeda(totalOut)}`
      );
    }

    // Fallback (should not happen as UNKNOWN is handled upstream)
    return '❓ Ação não reconhecida.';
  } catch (err) {
    logger.error({ err, userId, intent }, 'Erro ao executar ação WhatsApp Agent');
    return '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente.';
  }
}
