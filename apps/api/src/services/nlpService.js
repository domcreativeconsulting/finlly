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

// ============================================================
// Public API
// ============================================================

/**
 * Identifies the user's intent from a natural language message and
 * extracts relevant parameters.
 *
 * Supported intents:
 * - `CREATE_EXPENSE` — params: `{ valor: number, descricao: string }`
 * - `CREATE_INCOME`  — params: `{ valor: number, descricao: string }`
 * - `GET_BALANCE`    — params: `{}`
 * - `GET_STATEMENT`  — params: `{ periodo: string }`
 * - `UNKNOWN`        — params: `{}`
 *
 * @param {string} texto - Raw message text from the user
 * @returns {{ intent: string, params: object }}
 */
export function identificarIntent(texto) {
  const lower = texto.toLowerCase();

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
