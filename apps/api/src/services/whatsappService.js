import { sendText } from '../lib/evolution/evolutionClient.js';
import logger from '../logger.js';
import { identificarIntent, INTENT_CREATE_EXPENSE, INTENT_CREATE_INCOME, INTENT_GET_BALANCE, INTENT_GET_STATEMENT } from './nlpService.js';

/**
 * Builds a contextual reply text for the given intent and params.
 *
 * @param {string} intent - Detected intent constant
 * @param {object} params - Extracted parameters
 * @returns {string}
 */
function gerarResposta(intent, params) {
  switch (intent) {
    case INTENT_CREATE_EXPENSE:
      return `✅ Despesa de R$ ${params.valor} (${params.descricao}) registrada!`;
    case INTENT_CREATE_INCOME:
      return `✅ Receita de R$ ${params.valor} (${params.descricao}) registrada!`;
    case INTENT_GET_BALANCE:
      return '💰 Consultando seu saldo...';
    case INTENT_GET_STATEMENT:
      return '📊 Consultando seu extrato...';
    default:
      return (
        'Não entendi sua mensagem. 🤔\n\n' +
        'Você pode tentar:\n' +
        "• 'gastei 50 no almoço'\n" +
        "• 'recebi 2000 do cliente'\n" +
        "• 'quanto tenho em caixa?'\n" +
        "• 'me mostra meus gastos da semana'"
      );
  }
}

/**
 * Processes an incoming WhatsApp webhook payload from the Evolution API.
 *
 * Extracts message data, runs NLP intent detection, logs the result and
 * sends a contextual reply to the user via `enviarMensagem`.
 * Messages sent by the bot itself (`fromMe === true`) are silently ignored.
 *
 * @param {object} payload - Parsed webhook payload from Evolution API
 * @returns {Promise<{ from: string, name: string, text: string, fromMe: boolean }>}
 */
export async function processarMensagemRecebida(payload) {
  const { data } = payload;
  const from = data.key.remoteJid.replace(/@.*$/, '');
  const fromMe = data.key.fromMe ?? false;
  const name = data.pushName ?? from;
  const text = data.message?.conversation ?? data.message?.extendedTextMessage?.text ?? '';

  logger.info({ from, name, fromMe, text }, 'Mensagem WhatsApp recebida');

  if (fromMe) {
    return { from, name, text, fromMe };
  }

  const { intent, params } = identificarIntent(text);
  logger.info({ from, intent, params }, 'Intent WhatsApp detectada');

  const resposta = gerarResposta(intent, params);

  try {
    await enviarMensagem(from, resposta);
  } catch (err) {
    logger.error({ err, from, intent }, 'Erro ao enviar resposta WhatsApp');
  }

  return { from, name, text, fromMe };
}

/**
 * Sends a text message to the given WhatsApp number via the Evolution API.
 *
 * @param {string} number - Destination phone number (digits only, e.g. "5511999999999")
 * @param {string} text   - Message text to send
 * @returns {Promise<object>} Response from Evolution API
 */
export async function enviarMensagem(number, text) {
  logger.info({ number, text }, 'Enviando mensagem WhatsApp');
  try {
    const result = await sendText(number, text);
    logger.info({ number, result }, 'Mensagem WhatsApp enviada com sucesso');
    return result;
  } catch (err) {
    logger.error({ err, number }, 'Falha ao enviar mensagem WhatsApp');
    throw err;
  }
}
