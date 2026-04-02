import { sendText } from '../lib/evolution/evolutionClient.js';
import logger from '../logger.js';
import { identificarIntent, INTENT_UNKNOWN } from './nlpService.js';
import { resolverUsuarioPorWhatsapp, executarAcao } from './whatsappAgentService.js';

/** Reply sent when the user's number is not linked to any Finlly account */
const RESPOSTA_NUMERO_NAO_VINCULADO =
  '⚠️ Seu número não está vinculado a nenhuma conta no Finlly.\n\n' +
  'Acesse o Finlly e cadastre seu número de WhatsApp no perfil para usar o agente.';

/** Reply sent for unrecognised messages */
const RESPOSTA_UNKNOWN =
  'Não entendi sua mensagem. 🤔\n\n' +
  'Você pode tentar:\n' +
  "• 'gastei 50 no almoço'\n" +
  "• 'recebi 2000 do cliente'\n" +
  "• 'quanto tenho em caixa?'\n" +
  "• 'me mostra meus gastos da semana'";

/**
 * Processes an incoming WhatsApp webhook payload from the Evolution API.
 *
 * Extracts message data, runs NLP intent detection, resolves the user by
 * phone number and delegates to the agent service for action execution.
 * Messages sent by the bot itself (`fromMe === true`) are silently ignored.
 * Unknown intents receive a help menu without touching the database.
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

  // Unknown intent: reply with help menu, no user lookup needed
  if (intent === INTENT_UNKNOWN) {
    try {
      await enviarMensagem(from, RESPOSTA_UNKNOWN);
    } catch (err) {
      logger.error({ err, from, intent }, 'Erro ao enviar resposta WhatsApp');
    }
    return { from, name, text, fromMe };
  }

  // Resolve user by WhatsApp number
  const usuario = await resolverUsuarioPorWhatsapp(from);
  if (!usuario) {
    logger.warn({ from }, 'Número WhatsApp não vinculado a nenhum usuário');
    try {
      await enviarMensagem(from, RESPOSTA_NUMERO_NAO_VINCULADO);
    } catch (err) {
      logger.error({ err, from }, 'Erro ao enviar resposta de número não vinculado');
    }
    return { from, name, text, fromMe };
  }

  // Execute the action and send the reply
  const resposta = await executarAcao(usuario, intent, params);

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
