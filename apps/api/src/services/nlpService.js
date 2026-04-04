/**
 * NLP Service — Basic intent identification and entity extraction.
 *
 * Implements a regex-based NLP layer that identifies user intent and
 * extracts relevant parameters from Portuguese natural language messages.
 *
 * @module nlpService
 */

// ============================================================
// Intent constants
// ============================================================

/** User wants to register an expense */
export const INTENT_CREATE_EXPENSE = 'CREATE_EXPENSE';

/** User wants to register an income */
export const INTENT_CREATE_INCOME = 'CREATE_INCOME';

/** User wants to check their balance */
export const INTENT_GET_BALANCE = 'GET_BALANCE';

/** User wants to see a statement/summary */
export const INTENT_GET_STATEMENT = 'GET_STATEMENT';

/** User wants to register a future bill to pay */
export const INTENT_CREATE_BILL = 'CREATE_BILL';

/** User wants to pay/settle a pending bill */
export const INTENT_PAY_BILL = 'PAY_BILL';

/** User wants to register an investment contribution */
export const INTENT_CREATE_INVESTMENT = 'CREATE_INVESTMENT';

/** Message not recognised */
export const INTENT_UNKNOWN = 'UNKNOWN';

// ============================================================
// Regex patterns
// ============================================================

const EXPENSE_PATTERN =
  /\b(gastei|paguei|comprei|saiu|gasto\s+de|gasto)\b/i;

const INCOME_PATTERN =
  /\b(recebi|entrou|ganhei|entrada\s+de)\b/i;

const BALANCE_PATTERN =
  /\b(saldo|quanto\s+tenho|caixa|dispon[ií]vel)\b/i;

const STATEMENT_PATTERN =
  /\b(extrato|gastos|movimenta[çc][oõ]es|resumo)\b/i;

// PAY_BILL — payment/settlement of a pending bill; must match before CREATE_EXPENSE
// to capture "paguei a conta de luz" (PAY_BILL) vs "paguei 50 no almoço" (CREATE_EXPENSE)
const PAY_BILL_PATTERN =
  /\b(paguei|quitei|liquidei)\b.*\b(conta|boleto|fatura|cobran[çc]a)\b|\b(conta|boleto|fatura)\b.*\b(paga|quitada|liquidada)\b/i;

// CREATE_BILL — registering a future bill to pay
const CREATE_BILL_PATTERN =
  /\b(tenho\s+(uma\s+)?conta|vence|vencimento|conta\s+a\s+pagar|boleto|fatura)\b/i;

// CREATE_INVESTMENT — recording an investment contribution
const INVESTMENT_PATTERN =
  /\b(investi|apliquei|aportei|coloquei)\b.*\b(tesouro|poupan[çc]a|a[çc][õo]es?|fundo|renda\s+fixa|cdb|lci|lca|cripto|bitcoin|eth)\b|\b(investi|apliquei|aportei)\b/i;

/** Matches a monetary value such as 50, 120.50 or 120,50 */
const VALUE_PATTERN = /(\d+(?:[.,]\d+)?)/;

/** Prepositions to strip from extracted descriptions */
const PREPOSITION_PATTERN = /^(no|na|do|da|de|em|o|a|os|as)\s+/i;

// ============================================================
// Helpers
// ============================================================

/**
 * Parses a monetary string into a float, normalising commas to dots.
 *
 * @param {string} raw - Raw string such as "120,50" or "2000"
 * @returns {number}
 */
function parseValor(raw) {
  return parseFloat(raw.replaceAll(',', '.'));
}

/**
 * Extracts a description from the text that appears after the monetary value.
 * Strips leading prepositions for cleaner output.
 *
 * @param {string} text  - Full message text (lowercase)
 * @param {string} value - Raw value string already extracted
 * @returns {string}
 */
function extrairDescricao(text, value) {
  const idx = text.indexOf(value);
  if (idx === -1) return '';
  const after = text.slice(idx + value.length).trim();
  return after.replace(PREPOSITION_PATTERN, '').trim();
}

/**
 * Extracts a bill description from a PAY_BILL message.
 * Looks for keywords like conta, boleto, fatura and returns the words after them.
 *
 * @param {string} text - Full message text (lowercase)
 * @returns {string}
 */
function extrairDescricaoConta(text) {
  const match = text.match(/\b(?:conta|boleto|fatura|cobran[çc]a)\b\s+(?:de\s+|do\s+|da\s+)?(.+)/i);
  if (match) return match[1].trim();
  return '';
}

/**
 * Extracts the period keyword (semana / mes) from a statement query.
 *
 * @param {string} text - Full message text (lowercase)
 * @returns {string} 'semana' | 'mes' | ''
 */
function extrairPeriodo(text) {
  if (/\bsemana\b/.test(text)) return 'semana';
  if (/\bm[eê]s\b/.test(text)) return 'mes';
  return '';
}

/**
 * Extracts a due-date from the text and returns it as YYYY-MM-DD.
 * Supported formats:
 *  - "dia 15"  → day 15 of current month (or next month if already past)
 *  - "15/04"   → day 15 of month 04 of current year
 *
 * @param {string} text - Full message text (may be original casing)
 * @returns {string|null} ISO date string or null if no date found
 */
function extrairDataVencimento(text) {
  const now = new Date();
  const anoAtual = now.getUTCFullYear();
  const mesAtual = now.getUTCMonth() + 1; // 1-based
  const diaAtual = now.getUTCDate();

  // "dia 15" or "dia 5"
  const matchDia = text.match(/\bdia\s+(\d{1,2})\b/i);
  if (matchDia) {
    const dia = parseInt(matchDia[1], 10);
    if (dia >= 1 && dia <= 31) {
      let mes = mesAtual;
      let ano = anoAtual;
      if (dia < diaAtual) {
        // Day already passed this month — use next month
        mes += 1;
        if (mes > 12) {
          mes = 1;
          ano += 1;
        }
      }
      return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }

  // "15/04" or "15/4"
  const matchSlash = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (matchSlash) {
    const dia = parseInt(matchSlash[1], 10);
    const mes = parseInt(matchSlash[2], 10);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      // Validate the date is real (e.g. reject "30/02")
      const dateCandidate = new Date(`${anoAtual}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T12:00:00Z`);
      if (dateCandidate.getUTCMonth() + 1 === mes && dateCandidate.getUTCDate() === dia) {
        return `${anoAtual}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      }
    }
  }

  return null;
}

// ============================================================
// Public API
// ============================================================

/**
 * Identifies the user's intent from a natural language message and
 * extracts relevant parameters.
 *
 * Supported intents (in detection priority order):
 * - `PAY_BILL`          — params: `{ descricao: string|null, valor: number|null, data_vencimento: string|null }`
 * - `CREATE_BILL`       — params: `{ valor: number, descricao: string, data_vencimento: string|null }`
 * - `CREATE_INVESTMENT` — params: `{ valor: number, descricao: string }`
 * - `CREATE_EXPENSE`    — params: `{ valor: number, descricao: string }`
 * - `CREATE_INCOME`     — params: `{ valor: number, descricao: string }`
 * - `GET_BALANCE`       — params: `{}`
 * - `GET_STATEMENT`     — params: `{ periodo: string }`
 * - `UNKNOWN`           — params: `{}`
 *
 * @param {string} texto - Raw message text from the user
 * @returns {{ intent: string, params: object }}
 */
export function identificarIntent(texto) {
  const lower = texto.toLowerCase();

  // PAY_BILL must come before CREATE_EXPENSE to capture "paguei a conta"
  if (PAY_BILL_PATTERN.test(lower)) {
    const matchValor = lower.match(VALUE_PATTERN);
    const rawValor = matchValor ? matchValor[1] : null;
    return {
      intent: INTENT_PAY_BILL,
      params: {
        descricao: extrairDescricaoConta(lower),
        valor: rawValor ? parseValor(rawValor) : null,
        data_vencimento: extrairDataVencimento(texto),
      },
    };
  }

  if (CREATE_BILL_PATTERN.test(lower)) {
    const match = lower.match(VALUE_PATTERN);
    const rawValor = match ? match[1] : null;
    return {
      intent: INTENT_CREATE_BILL,
      params: {
        valor: rawValor ? parseValor(rawValor) : 0,
        descricao: rawValor ? extrairDescricao(lower, rawValor) : '',
        data_vencimento: extrairDataVencimento(texto),
      },
    };
  }

  if (INVESTMENT_PATTERN.test(lower)) {
    const match = lower.match(VALUE_PATTERN);
    if (match) {
      const rawValor = match[1];
      return {
        intent: INTENT_CREATE_INVESTMENT,
        params: {
          valor: parseValor(rawValor),
          descricao: extrairDescricao(lower, rawValor),
        },
      };
    }
    return { intent: INTENT_CREATE_INVESTMENT, params: { valor: 0, descricao: '' } };
  }

  if (EXPENSE_PATTERN.test(lower)) {
    const match = lower.match(VALUE_PATTERN);
    if (match) {
      const rawValor = match[1];
      return {
        intent: INTENT_CREATE_EXPENSE,
        params: {
          valor: parseValor(rawValor),
          descricao: extrairDescricao(lower, rawValor),
        },
      };
    }
  }

  if (INCOME_PATTERN.test(lower)) {
    const match = lower.match(VALUE_PATTERN);
    if (match) {
      const rawValor = match[1];
      return {
        intent: INTENT_CREATE_INCOME,
        params: {
          valor: parseValor(rawValor),
          descricao: extrairDescricao(lower, rawValor),
        },
      };
    }
  }

  if (BALANCE_PATTERN.test(lower)) {
    return { intent: INTENT_GET_BALANCE, params: {} };
  }

  if (STATEMENT_PATTERN.test(lower)) {
    return {
      intent: INTENT_GET_STATEMENT,
      params: { periodo: extrairPeriodo(lower) },
    };
  }

  return { intent: INTENT_UNKNOWN, params: {} };
}
