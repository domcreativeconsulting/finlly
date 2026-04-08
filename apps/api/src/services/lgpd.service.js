import prisma from '../utils/database.js';
import logger from '../logger.js';
import { registrarEvento } from './auditoria.service.js';

/**
 * Lista de campos sensíveis que NUNCA devem ser exportados.
 * @type {Set<string>}
 */
const CAMPOS_SENSIVEIS = new Set(['senha_hash', 'refresh_token_hash', 'token_hash']);

/**
 * Retorna apenas os campos permitidos de um objeto.
 * @param {object} objeto
 * @param {string[]} camposPermitidos
 * @returns {object}
 */
export function minimizarDados(objeto, camposPermitidos) {
  if (!objeto || typeof objeto !== 'object') return objeto;
  return Object.fromEntries(
    camposPermitidos.filter((k) => Object.prototype.hasOwnProperty.call(objeto, k)).map((k) => [k, objeto[k]])
  );
}

/**
 * Remove campos sensíveis de um objeto recursivamente.
 * @param {unknown} value
 * @returns {unknown}
 */
function removerSensiveis(value) {
  if (Array.isArray(value)) return value.map(removerSensiveis);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !CAMPOS_SENSIVEIS.has(k))
        .map(([k, v]) => [k, removerSensiveis(v)])
    );
  }
  return value;
}

/**
 * Exporta todos os dados pessoais do usuário (direito de portabilidade LGPD).
 * Nunca retorna campos sensíveis como senha_hash ou refresh_token_hash.
 *
 * @param {string} usuarioId
 * @returns {Promise<object>}
 */
export async function exportarDadosUsuario(usuarioId) {
  const [
    usuario,
    sessoes,
    eventosAuth,
    contas,
    contasPagar,
    contasReceber,
    movimentacoes,
    investimentos,
    metas,
    assinante,
    auditoriaEventos,
  ] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        avatar_url: true,
        email_verificado: true,
        role: true,
        status: true,
        whatsapp: true,
        timezone: true,
        moeda: true,
        ultima_senha_troca: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
      },
    }),
    prisma.usuarioSessao.findMany({
      where: { usuario_id: usuarioId },
      select: {
        id: true,
        device_info: true,
        ip_address: true,
        data_criacao: true,
        data_expiracao: true,
        data_revogacao: true,
      },
    }),
    prisma.usuarioEventoAuth.findMany({
      where: { usuario_id: usuarioId },
      select: {
        id: true,
        tipo: true,
        sucesso: true,
        erro_msg: true,
        ip_address: true,
        user_agent: true,
        data_evento: true,
      },
    }),
    prisma.conta.findMany({
      where: { usuario_id: usuarioId, deleted_at: null },
      select: {
        id: true,
        nome: true,
        tipo: true,
        cor: true,
        icone: true,
        incluir_total: true,
        status: true,
        created_at: true,
      },
    }),
    prisma.contaPagar.findMany({
      where: { usuario_id: usuarioId, deleted_at: null },
      select: {
        id: true,
        descricao: true,
        valor: true,
        data_vencimento: true,
        status: true,
        created_at: true,
      },
    }),
    prisma.contaReceber.findMany({
      where: { usuario_id: usuarioId, deleted_at: null },
      select: {
        id: true,
        descricao: true,
        valor: true,
        data_vencimento: true,
        status: true,
        created_at: true,
      },
    }),
    prisma.movimentacaoCaixa.findMany({
      where: { usuario_id: usuarioId, deleted_at: null },
      select: {
        id: true,
        conta_id: true,
        tipo: true,
        valor: true,
        descricao: true,
        data: true,
        created_at: true,
      },
    }),
    prisma.investimento.findMany({
      where: { usuario_id: usuarioId, deleted_at: null },
      select: {
        id: true,
        nome: true,
        tipo_id: true,
        instituicao_id: true,
        valor_inicial: true,
        data_inicio: true,
        created_at: true,
      },
    }),
    prisma.meta.findMany({
      where: { usuario_id: usuarioId, deleted_at: null },
      select: {
        id: true,
        nome: true,
        tipo: true,
        valor_alvo: true,
        data_limite: true,
        status: true,
        created_at: true,
      },
    }),
    prisma.assinante.findUnique({
      where: { usuario_id: usuarioId },
      select: {
        id: true,
        status: true,
        plano: true,
        trial_inicio: true,
        trial_fim: true,
        proxima_cobranca: true,
        created_at: true,
      },
    }),
    prisma.auditoriaEvento.findMany({
      where: { usuario_id: usuarioId },
      select: {
        id: true,
        tipo: true,
        detalhes: true,
        ip_address: true,
        user_agent: true,
        sucesso: true,
        data_evento: true,
      },
    }),
  ]);

  return {
    usuario: removerSensiveis(usuario),
    sessoes,
    eventos_auth: eventosAuth,
    contas,
    contas_pagar: contasPagar,
    contas_receber: contasReceber,
    movimentacoes,
    investimentos,
    metas,
    assinante,
    auditoria_eventos: auditoriaEventos,
    exportado_em: new Date().toISOString(),
  };
}

/**
 * Anonimiza os dados pessoais do usuário para exclusão LGPD (soft-delete).
 * - Substitui nome, email e dados pessoais por valores genéricos
 * - Revoga todas as sessões ativas
 * - Registra evento de auditoria
 *
 * @param {string} usuarioId
 * @param {{ ip?: string, userAgent?: string }} meta
 */
export async function anonimizarUsuario(usuarioId, { ip, userAgent } = {}) {
  const anonEmail = `removed_${usuarioId}@finlly.deleted`;

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        nome: 'Usuário Removido',
        email: anonEmail,
        telefone: null,
        avatar_url: null,
        whatsapp: null,
        deleted_at: new Date(),
      },
    }),
    prisma.usuarioSessao.updateMany({
      where: { usuario_id: usuarioId, data_revogacao: null },
      data: { data_revogacao: new Date() },
    }),
  ]);

  await registrarEvento({
    usuarioId,
    tipo: 'conta_usuario_excluida',
    detalhes: { motivo: 'solicitacao_lgpd' },
    ip,
    userAgent,
    sucesso: true,
  });

  logger.info({ msg: 'Usuário anonimizado por solicitação LGPD', usuarioId });
}
