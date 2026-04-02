import { sendText } from '../lib/evolution/evolutionClient.js';
import logger from '../logger.js';
import { identificarIntent, INTENT_UNKNOWN } from './nlpService.js';
import { resolverUsuarioPorWhatsapp, executarAcao } from './whatsappAgentService.js';
import {
  checkRateLimitPorNumero,
  registrarLogWhatsapp,
  validarUsuarioAtivo,
} from './whatsappSecurityService.js';

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

  // Ignore empty messages silently (no log, no response)
  if (!text.trim()) {
    return { from, name, text, fromMe };
  }

  // Rate limit by phone number
  if (!checkRateLimitPorNumero(from)) {
    logger.warn({ from }, 'Rate limit WhatsApp excedido por número');
    await registrarLogWhatsapp({ usuario_id: null, telefone: from, direcao: 'entrada', conteudo: text, status: 'rate_limited' });
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
    await registrarLogWhatsapp({ usuario_id: null, telefone: from, direcao: 'entrada', conteudo: text });
    await registrarLogWhatsapp({ usuario_id: null, telefone: from, direcao: 'saida', conteudo: RESPOSTA_UNKNOWN });
    return { from, name, text, fromMe };
  }

  // Resolve user by WhatsApp number
  const usuario = await resolverUsuarioPorWhatsapp(from);
  if (!usuario) {
    logger.warn({ from }, 'Número WhatsApp não vinculado a nenhum usuário');
    await registrarLogWhatsapp({ usuario_id: null, telefone: from, direcao: 'entrada', conteudo: text, status: 'sem_usuario' });
    try {
      await enviarMensagem(from, RESPOSTA_NUMERO_NAO_VINCULADO);
    } catch (err) {
      logger.error({ err, from }, 'Erro ao enviar resposta de número não vinculado');
    }
    return { from, name, text, fromMe };
  }

  // Validate that the user account is active
  const { valido, mensagem: mensagemBloqueio } = validarUsuarioAtivo(usuario);
  if (!valido) {
    logger.warn({ from, usuarioId: usuario.id }, 'Usuário inativo tentou usar WhatsApp');
    await registrarLogWhatsapp({ usuario_id: usuario.id, telefone: from, direcao: 'entrada', conteudo: text, status: 'usuario_inativo' });
    try {
      await enviarMensagem(from, mensagemBloqueio);
    } catch (err) {
      logger.error({ err, from }, 'Erro ao enviar resposta de usuário inativo');
    }
    await registrarLogWhatsapp({ usuario_id: usuario.id, telefone: from, direcao: 'saida', conteudo: mensagemBloqueio, status: 'usuario_inativo' });
    return { from, name, text, fromMe };
  }

  // Log the incoming message
  await registrarLogWhatsapp({ usuario_id: usuario.id, telefone: from, direcao: 'entrada', conteudo: text });

  // Execute the action and send the reply
  const resposta = await executarAcao(usuario, intent, params);

  try {
    await enviarMensagem(from, resposta);
  } catch (err) {
    logger.error({ err, from, intent }, 'Erro ao enviar resposta WhatsApp');
  }

  // Log the outgoing response
  await registrarLogWhatsapp({ usuario_id: usuario.id, telefone: from, direcao: 'saida', conteudo: resposta });

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
