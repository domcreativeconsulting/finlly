/**
 * Evolution Payload Factory
 * Task 16.2.1 — Harness com payloads reais
 *
 * Provides utilities to load, clone and mutate Evolution webhook payload
 * fixtures for use in integration and unit tests.
 *
 * @module evolutionPayloadFactory
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../fixtures/evolution');

/**
 * Loads a fixture JSON file and returns a deep clone.
 * @param {string} name - Fixture filename without .json extension
 * @returns {object}
 */
export function loadFixture(name) {
  const raw = readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw);
}

/**
 * Returns a unique message ID for test payloads.
 * @param {string} [tag='']
 * @returns {string}
 */
export function uid(tag = '') {
  return `${tag}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates an Evolution webhook payload for a text message.
 * All fields match the real Evolution API contract.
 *
 * @param {object} opts
 * @param {string} [opts.phone='5511999990001']        - Digits-only phone number
 * @param {string} [opts.text='']                      - Message text
 * @param {string|null} [opts.messageId]               - Provider message ID (auto-generated if null)
 * @param {string} [opts.instance='finlly-prod']       - Evolution instance name
 * @param {string} [opts.pushName='Teste Integration'] - Contact display name
 * @param {boolean} [opts.fromMe=false]                - Whether the message was sent by the bot
 * @param {number|null} [opts.timestamp]               - Unix timestamp (now if null)
 * @returns {object} Valid Evolution webhook payload
 */
export function makeTextPayload({
  phone = '5511999990001',
  text = '',
  messageId = null,
  instance = 'finlly-prod',
  pushName = 'Teste Integration',
  fromMe = false,
  timestamp = null,
} = {}) {
  return {
    event: 'messages.upsert',
    instance,
    data: {
      key: {
        remoteJid: `${phone}@s.whatsapp.net`,
        fromMe,
        id: messageId ?? uid('msg_'),
      },
      messageTimestamp: timestamp ?? Math.floor(Date.now() / 1000),
      pushName,
      message: { conversation: text },
    },
  };
}

/**
 * Creates a payload using extendedTextMessage format (reply/formatted text).
 * @param {object} opts - Same as makeTextPayload
 * @returns {object}
 */
export function makeExtendedTextPayload({ text = '', ...rest } = {}) {
  const payload = makeTextPayload({ text: '', ...rest });
  payload.data.message = { extendedTextMessage: { text } };
  return payload;
}

/**
 * Creates a payload with an audio message (no text content).
 * @param {object} opts
 * @param {string} [opts.phone]
 * @param {string|null} [opts.messageId]
 * @returns {object}
 */
export function makeAudioPayload({ phone = '5511999990008', messageId = null, ...rest } = {}) {
  const payload = makeTextPayload({ phone, messageId, text: '', ...rest });
  payload.data.message = {
    audioMessage: {
      url: 'https://mmg.whatsapp.net/v/fake-audio',
      mimetype: 'audio/ogg; codecs=opus',
      seconds: 5,
    },
  };
  return payload;
}

/**
 * Creates a payload with an image message.
 * @param {object} opts
 * @param {string} [opts.phone]
 * @param {string} [opts.caption]
 * @returns {object}
 */
export function makeImagePayload({
  phone = '5511999990009',
  caption = 'nota fiscal',
  messageId = null,
  ...rest
} = {}) {
  const payload = makeTextPayload({ phone, messageId, text: '', ...rest });
  payload.data.message = {
    imageMessage: {
      url: 'https://mmg.whatsapp.net/v/fake-image',
      mimetype: 'image/jpeg',
      caption,
    },
  };
  return payload;
}

/**
 * Creates a payload with no message field (empty message).
 * @param {object} opts
 * @returns {object}
 */
export function makeEmptyMessagePayload({ phone = '5511999990010', messageId = null, ...rest } = {}) {
  const payload = makeTextPayload({ phone, messageId, text: '', ...rest });
  delete payload.data.message;
  return payload;
}

/**
 * Creates a payload from a named fixture and applies overrides.
 * Useful for loading a real fixture and tweaking phone/text/messageId.
 *
 * @param {string} fixtureName - Fixture name without .json extension
 * @param {object} [overrides] - Deep partial overrides merged into the fixture
 * @returns {object}
 */
export function fromFixture(fixtureName, overrides = {}) {
  const base = loadFixture(fixtureName);
  return deepMerge(base, overrides);
}

/**
 * Applies a deep merge of overrides into the target object.
 * Arrays are replaced, not merged.
 *
 * @param {object} target
 * @param {object} overrides
 * @returns {object}
 */
function deepMerge(target, overrides) {
  const result = { ...target };
  for (const key of Object.keys(overrides)) {
    if (
      overrides[key] !== null &&
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key]) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

/**
 * Pre-built payload scenarios for common test cases.
 * Each scenario is a factory function that returns a fresh payload.
 */
export const scenarios = {
  /** CREATE_EXPENSE: "gastei 50 no almoço" */
  expense: (phone = '5511999990001') =>
    makeTextPayload({ phone, text: 'gastei 50 no almoço' }),

  /** CREATE_INCOME: "recebi 2000 do cliente" */
  income: (phone = '5511999990002') =>
    makeTextPayload({ phone, text: 'recebi 2000 do cliente' }),

  /** GET_BALANCE: "quanto tenho em caixa" */
  balance: (phone = '5511999990003') =>
    makeTextPayload({ phone, text: 'quanto tenho em caixa' }),

  /** GET_STATEMENT: "extrato do mês" */
  statement: (phone = '5511999990003') =>
    makeTextPayload({ phone, text: 'extrato do mês' }),

  /** CREATE_BILL: "tenho uma conta de luz de 150 vencendo dia 15" */
  createBill: (phone = '5511999990004') =>
    makeTextPayload({ phone, text: 'tenho uma conta de luz de 150 vencendo dia 15' }),

  /** PAY_BILL: "paguei a conta de luz" */
  payBill: (phone = '5511999990004') =>
    makeTextPayload({ phone, text: 'paguei a conta de luz' }),

  /** CREATE_INVESTMENT: "investi 500 no tesouro direto" */
  investment: (phone = '5511999990005') =>
    makeTextPayload({ phone, text: 'investi 500 no tesouro direto' }),

  /** UNKNOWN: "oi tudo bem" */
  unknown: (phone = '5511999990006') =>
    makeTextPayload({ phone, text: 'oi tudo bem' }),

  /** Ambiguous (EXPENSE without value): "gastei ontem" */
  ambiguous: (phone = '5511999990007') =>
    makeTextPayload({ phone, text: 'gastei ontem' }),

  /** fromMe=true — bot's own outbound message, must be ignored */
  fromMe: (phone = '5511999990001') =>
    makeTextPayload({ phone, text: '✅ Despesa registrada!', fromMe: true }),

  /** Audio message — no text, agent should not process */
  audio: (phone = '5511999990008') =>
    makeAudioPayload({ phone }),

  /** Image message — no text, agent should not process */
  image: (phone = '5511999990009') =>
    makeImagePayload({ phone }),

  /** Empty message (no message field) — agent should ignore silently */
  emptyMessage: (phone = '5511999990010') =>
    makeEmptyMessagePayload({ phone }),

  /** extendedTextMessage format (reply) */
  extendedText: (phone = '5511999990001', text = 'gastei 80 no supermercado') =>
    makeExtendedTextPayload({ phone, text }),

  /** Duplicate: same messageId sent twice */
  duplicate: (phone = '5511999990001', messageId = 'DUPLICATE_MSG_ID_001') =>
    makeTextPayload({ phone, text: 'gastei 50 no almoço', messageId }),
};
