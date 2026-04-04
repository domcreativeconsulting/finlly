/**
 * Reply builder — pure functions, no side effects.
 * All user-facing WhatsApp reply strings must be built here.
 *
 * @module whatsappReplyBuilder
 */

// ============================================================
// Internal helpers (not exported)
// ============================================================

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

/** Threshold below which a low-balance warning is added to expense replies (BRL) */
const SALDO_BAIXO_THRESHOLD = 100;

// ============================================================
// Confirmations — success
// ============================================================

/**
 * Reply for a successfully registered expense.
 *
 * @param {object} opts
 * @param {string} opts.nome
 * @param {number} opts.valor
 * @param {string} opts.descricao
 * @param {string} opts.conta
 * @param {string} opts.data         - YYYY-MM-DD
 * @param {number} opts.totalSemana  - Total spent in the last 7 days
 * @param {number} opts.saldo        - Current consolidated balance
 * @returns {string}
 */
export function replyDespesaRegistrada({ nome, valor, descricao, conta, data, totalSemana, saldo }) {
  let msg =
    `✅ Despesa registrada, ${nome}!\n\n` +
    `💸 Valor: R$ ${formatarMoeda(valor)}\n` +
    `📝 Descrição: ${descricao}\n` +
    `🏦 Conta: ${conta}\n` +
    `📅 Data: ${formatarData(data)}`;

  msg += `\n\n📈 Total gasto nesta semana: R$ ${formatarMoeda(totalSemana)}`;

  if (saldo < SALDO_BAIXO_THRESHOLD) {
    if (saldo < 0) {
      msg += `\n⚠️ Atenção: seu saldo está negativo (R$ ${formatarMoeda(saldo)}).`;
    } else {
      msg += `\n⚠️ Atenção: seu saldo está baixo (R$ ${formatarMoeda(saldo)}).`;
    }
  }

  return msg;
}

/**
 * Reply for a successfully registered income.
 *
 * @param {object} opts
 * @param {string} opts.nome
 * @param {number} opts.valor
 * @param {string} opts.descricao
 * @param {string} opts.conta
 * @param {string} opts.data  - YYYY-MM-DD
 * @returns {string}
 */
export function replyReceitaRegistrada({ nome, valor, descricao, conta, data }) {
  return (
    `✅ Receita registrada, ${nome}!\n\n` +
    `💰 Valor: R$ ${formatarMoeda(valor)}\n` +
    `📝 Descrição: ${descricao}\n` +
    `🏦 Conta: ${conta}\n` +
    `📅 Data: ${formatarData(data)}`
  );
}

/**
 * Reply for a successfully registered bill (conta a pagar).
 *
 * @param {object} opts
 * @param {string} opts.descricao
 * @param {number} opts.valor
 * @param {string} opts.dataVencimento  - YYYY-MM-DD
 * @returns {string}
 */
export function replyContaPagarRegistrada({ descricao, valor, dataVencimento }) {
  return (
    `📋 Conta a pagar registrada!\n\n` +
    `💸 Valor: R$ ${formatarMoeda(Number(valor))}\n` +
    `📝 Descrição: ${descricao}\n` +
    `📅 Vencimento: ${formatarData(dataVencimento)}\n\n` +
    `Para pagar, acesse o Finlly ou envie: "paguei a ${descricao}"`
  );
}

/**
 * Reply for a successfully paid bill.
 *
 * @param {object} opts
 * @param {string} opts.descricao
 * @param {number} opts.valor
 * @param {string} opts.data  - YYYY-MM-DD
 * @returns {string}
 */
export function replyContaPaga({ descricao, valor, data }) {
  return (
    `✅ Conta paga!\n\n` +
    `📝 ${descricao}\n` +
    `💸 Valor: R$ ${formatarMoeda(Number(valor))}\n` +
    `📅 Data: ${formatarData(data)}`
  );
}

/**
 * Reply when there are no pending bills.
 *
 * @returns {string}
 */
export function replySemContasPendentes() {
  return '✅ Você não tem contas pendentes no momento. Ótimo trabalho! 🎉';
}

/**
 * Reply for a balance enquiry.
 *
 * @param {object} opts
 * @param {string} opts.nome
 * @param {number} opts.saldo
 * @param {number} opts.entradas
 * @param {number} opts.saidas
 * @returns {string}
 */
export function replySaldo({ nome, saldo, entradas, saidas }) {
  return (
    `💰 Saldo de ${nome}\n\n` +
    `Saldo: R$ ${formatarMoeda(saldo)}\n` +
    `Entradas: R$ ${formatarMoeda(entradas)}\n` +
    `Saídas: R$ ${formatarMoeda(saidas)}`
  );
}

/**
 * Reply for a statement (extrato) with items.
 *
 * @param {object}   opts
 * @param {string}   opts.nome
 * @param {string}   opts.periodo      - e.g. "semana" or "mês"
 * @param {Array<{ type: string, description: string, amount: number }>} opts.items
 * @param {number}   opts.totalIn
 * @param {number}   opts.totalOut
 * @returns {string}
 */
export function replyExtrato({ nome, periodo, items, totalIn, totalOut }) {
  const linhas = items.map((item) => {
    const emoji = item.type === 'IN' ? '💚' : '🔴';
    return `${emoji} ${item.description} — R$ ${formatarMoeda(item.amount)}`;
  });

  return (
    `📊 Extrato da ${periodo} — ${nome}\n\n` +
    linhas.join('\n') +
    '\n\n' +
    `Total de entradas: R$ ${formatarMoeda(totalIn)}\n` +
    `Total de saídas: R$ ${formatarMoeda(totalOut)}`
  );
}

/**
 * Reply when no transactions are found in the period.
 *
 * @returns {string}
 */
export function replyExtratoVazio() {
  return '📊 Nenhuma movimentação encontrada no período.';
}

/**
 * Reply for a successfully registered investment.
 *
 * @param {object} opts
 * @param {string} opts.nome
 * @param {number} opts.valor
 * @param {string} opts.descricao
 * @param {string} opts.conta
 * @param {string} opts.data  - YYYY-MM-DD
 * @returns {string}
 */
export function replyInvestimentoRegistrado({ nome, valor, descricao, conta, data }) {
  return (
    `📈 Investimento registrado, ${nome}!\n\n` +
    `💰 Valor: R$ ${formatarMoeda(valor)}\n` +
    `📝 Descrição: ${descricao}\n` +
    `🏦 Conta debitada: ${conta}\n` +
    `📅 Data: ${formatarData(data)}\n\n` +
    `💡 Para detalhes dos seus investimentos, acesse o Finlly.`
  );
}

// ============================================================
// Errors — business
// ============================================================

/**
 * Reply when the user has no bank account registered.
 *
 * @returns {string}
 */
export function replyErroSemConta() {
  return (
    '❌ Você ainda não tem uma conta bancária cadastrada no Finlly.\n\n' +
    '🔗 Acesse o Finlly → Contas para criar uma antes de registrar movimentações.'
  );
}

/**
 * Reply for generic infrastructure / DB errors.
 *
 * @returns {string}
 */
export function replyErroGenerico() {
  return '❌ Não conseguimos processar sua solicitação agora. Tente novamente em alguns instantes.';
}

// ============================================================
// Alerts / edge cases
// ============================================================

/**
 * Reply when the phone number has exceeded the rate limit.
 *
 * @returns {string}
 */
export function replyRateLimitExcedido() {
  return '⏳ Você enviou muitas mensagens em pouco tempo. Aguarde um momento e tente novamente.';
}

/**
 * Reply when no monetary value could be extracted from the user's message.
 *
 * @returns {string}
 */
export function replyValorNaoIdentificado() {
  return (
    '🤔 Não consegui identificar o valor na sua mensagem.\n\n' +
    'Tente novamente com o valor explícito, ex: "gastei 50 no almoço"'
  );
}

/**
 * Reply when the user's Finlly account is suspended.
 *
 * @returns {string}
 */
export function replyContaSuspensa() {
  return (
    '⛔ Sua conta no Finlly está suspensa.\n\n' +
    '📧 Entre em contato: suporte@finlly.com.br'
  );
}

// ============================================================
// Information / system
// ============================================================

/**
 * Reply when the WhatsApp number is not linked to any Finlly account.
 *
 * @returns {string}
 */
export function replyNumeroNaoVinculado() {
  return (
    '👋 Olá! Parece que você ainda não vinculou seu WhatsApp ao Finlly.\n\n' +
    'Para usar o agente financeiro, acesse seu perfil no Finlly e cadastre este número de WhatsApp.\n\n' +
    'Após isso, você poderá:\n' +
    '• Registrar despesas: "gastei 50 no almoço"\n' +
    '• Registrar receitas: "recebi 2000 do cliente"\n' +
    '• Consultar saldo: "quanto tenho em caixa?"\n' +
    '• Ver extrato: "me mostra meus gastos da semana"'
  );
}

/**
 * Reply for unrecognised messages (intent = UNKNOWN).
 *
 * @returns {string}
 */
export function replyUnknown() {
  return (
    '🤖 Não entendi sua mensagem.\n\n' +
    'Tente um destes comandos:\n' +
    '• "gastei 50 no almoço" → registra despesa\n' +
    '• "recebi 2000 do cliente X" → registra receita\n' +
    '• "quanto tenho em caixa?" → consulta saldo\n' +
    '• "me mostra meus gastos da semana" → extrato\n' +
    '• "tenho boleto de 150 vencendo dia 20" → registra conta a pagar\n' +
    '• "paguei a conta de luz" → marca conta como paga\n' +
    '• "investi 500 na poupança" → registra investimento\n\n' +
    '💡 Dica: você pode escrever naturalmente!'
  );
}
