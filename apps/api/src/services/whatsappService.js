import { sendText } from '../lib/evolution/evolutionClient.js';
import logger from '../logger.js';
import { identificarIntent, INTENT_UNKNOWN } from './nlpService.js';
import { resolverUsuarioPorWhatsapp, executarAcao } from './whatsappAgentService.js';
import {
  checkRateLimitPorNumero,
  registrarLogWhatsapp,
  validarUsuarioAtivo,
  isDuplicateMensagem,
} from './whatsappSecurityService.js';
import { normalizeEvolutionPayload } from '../lib/whatsapp/evolutionPayloadParser.js';
import { sendTextMessage } from './whatsappSenderService.js';

/** Reply sent when the user's number is not linked to any Finlly account */
const RESPOSTA_NUMERO_NAO_VINCULADO =
  '👋 Olá! Parece que você ainda não vinculou seu WhatsApp ao Finlly.\n\n' +
  'Para usar o agente financeiro, acesse seu perfil no Finlly e cadastre este número de WhatsApp.\n\n' +
  'Após isso, você poderá:\n' +
  '• Registrar despesas: "gastei 50 no almoço"\n' +
  '• Registrar receitas: "recebi 2000 do cliente"\n' +
  '• Consultar saldo: "quanto tenho em caixa?"\n' +
  '• Ver extrato: "me mostra meus gastos da semana"';

/** Reply sent for unrecognised messages */
const RESPOSTA_UNKNOWN =
  '🤖 Não entendi sua mensagem.\n\n' +
  'Tente um destes comandos:\n' +
  '• "gastei 50 no almoço" → registra despesa\n' +
  '• "recebi 2000 do cliente X" → registra receita\n' +
  '• "quanto tenho em caixa?" → consulta saldo\n' +
  '• "me mostra meus gastos da semana" → extrato\n' +
  '• "tenho boleto de 150 vencendo dia 20" → registra conta a pagar\n' +
  '• "paguei a conta de luz" → marca conta como paga\n' +
  '• "investi 500 na poupança" → registra investimento\n\n' +
  '💡 Dica: você pode escrever naturalmente!';

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
  const msg = normalizeEvolutionPayload(payload);
  const { phoneNormalized: from, contactName, fromMe, messageText: text, messageType,
          providerMessageId: provider_message_id, eventTimestamp: received_at,
          instanceName: instance_name, payloadRaw: payload_raw } = msg;
  const name = contactName ?? from;

  logger.info({ from, name, fromMe, text }, 'Mensagem WhatsApp recebida');

  if (fromMe) {
    return { from, name, text, fromMe };
  }

  // Ignore empty messages silently (no log, no response)
  if (!text.trim()) {
    return { from, name, text, fromMe };
  }

  // Deduplication check (Gap 7): skip if this message was already processed
  if (provider_message_id) {
    const duplicate = await isDuplicateMensagem(provider_message_id);
    if (duplicate) {
      logger.info({ from, provider_message_id }, 'Mensagem WhatsApp duplicada ignorada');
      return { from, name, text, fromMe };
    }
  }

  // Rate limit by phone number
  if (!checkRateLimitPorNumero(from)) {
    logger.warn({ from }, 'Rate limit WhatsApp excedido por número');
    await registrarLogWhatsapp({
      usuario_id: null,
      telefone: from,
      direcao: 'entrada',
      conteudo: text,
      status: 'rate_limited',
      tipo_mensagem: messageType,
      provider_message_id,
      received_at,
      payload_raw,
      instance_name,
    });
    return { from, name, text, fromMe };
  }

  const { intent, params } = identificarIntent(text);
  logger.info({ from, intent, params }, 'Intent WhatsApp detectada');

  // Unknown intent: reply with help menu, no user lookup needed
  if (intent === INTENT_UNKNOWN) {
    await sendTextMessage({ telefone: from, texto: RESPOSTA_UNKNOWN, usuarioId: null });
    await registrarLogWhatsapp({
      usuario_id: null,
      telefone: from,
      direcao: 'entrada',
      conteudo: text,
      tipo_mensagem: messageType,
      provider_message_id,
      received_at,
      payload_raw,
      instance_name,
    });
    return { from, name, text, fromMe };
  }

  // Resolve user by WhatsApp number
  const usuario = await resolverUsuarioPorWhatsapp(from);
  if (!usuario) {
    logger.warn({ from }, 'Número WhatsApp não vinculado a nenhum usuário');
    await registrarLogWhatsapp({
      usuario_id: null,
      telefone: from,
      direcao: 'entrada',
      conteudo: text,
      status: 'sem_usuario',
      tipo_mensagem: messageType,
      provider_message_id,
      received_at,
      payload_raw,
      instance_name,
    });
    await sendTextMessage({ telefone: from, texto: RESPOSTA_NUMERO_NAO_VINCULADO, usuarioId: null });
    return { from, name, text, fromMe };
  }

  // Validate that the user account is active
  const { valido, mensagem: mensagemBloqueio } = validarUsuarioAtivo(usuario);
  if (!valido) {
    logger.warn({ from, usuarioId: usuario.id }, 'Usuário inativo tentou usar WhatsApp');
    await registrarLogWhatsapp({
      usuario_id: usuario.id,
      telefone: from,
      direcao: 'entrada',
      conteudo: text,
      status: 'usuario_inativo',
      tipo_mensagem: messageType,
      provider_message_id,
      received_at,
      payload_raw,
      instance_name,
    });
    await sendTextMessage({ telefone: from, texto: mensagemBloqueio, usuarioId: usuario.id });
    return { from, name, text, fromMe };
  }

  // Log the incoming message
  await registrarLogWhatsapp({
    usuario_id: usuario.id,
    telefone: from,
    direcao: 'entrada',
    conteudo: text,
    tipo_mensagem: messageType,
    provider_message_id,
    received_at,
    payload_raw,
    instance_name,
  });

  // Execute the action and send the reply
  const resposta = await executarAcao(usuario, intent, params);

  await sendTextMessage({ telefone: from, texto: resposta, usuarioId: usuario.id });

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
