import { registrarEvento } from '../services/auditoria.service.js';

/**
 * Middleware factory para auditar ações críticas após resposta enviada ao cliente.
 *
 * @param {string} tipo - Tipo do evento de auditoria (ex: 'login', 'conta_criada')
 * @param {((req: import('express').Request, res: import('express').Response) => object) | undefined} getDetalhes - Função opcional para gerar detalhes adicionais
 * @returns {import('express').RequestHandler}
 */
export function auditarAcao(tipo, getDetalhes) {
  return (req, res, next) => {
    res.on('finish', () => {
      const sucesso = res.statusCode < 400;
      const usuarioId = req.user?.sub || req.user?.id || undefined;
      const ip = req.ip || req.socket?.remoteAddress || undefined;
      const userAgent = req.headers['user-agent'] || undefined;
      const detalhes = typeof getDetalhes === 'function' ? getDetalhes(req, res) : undefined;

      registrarEvento({ usuarioId, tipo, detalhes, ip, userAgent, sucesso });
    });
    next();
  };
}
