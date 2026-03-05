import { MysqlAccount } from '../extractors/contas.extractor.js';
import { mapId, mapIdOptional } from './id-mapper.js';
import { toTimestamptz, toTipoConta, toStatusConta, toHexColor, toBoolean } from './type-converter.js';

export interface PostgresConta {
  id: string;
  usuario_id: string;
  nome: string;
  tipo: 'corrente' | 'poupanca' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'investimento' | 'outro';
  instituicao_financeira_id?: string;
  cor?: string;
  icone?: string;
  incluir_total: boolean;
  status: 'ativa' | 'inativa' | 'arquivada';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformConta(row: MysqlAccount): PostgresConta {
  // NOTE: `balance` is intentionally removed — it will be computed from movimentacoes_caixa
  return {
    id: mapId(row.id, 'accounts'),
    usuario_id: mapId(row.user_id, 'usuarios'),
    nome: String(row.name ?? '').trim(),
    tipo: toTipoConta(row.type),
    instituicao_financeira_id: mapIdOptional(row.bank_id as number | null | undefined, 'banks'),
    cor: toHexColor(row.color as string | undefined),
    icone: row.icon ? String(row.icon) : undefined,
    incluir_total: toBoolean(row.include_in_total),
    status: toStatusConta(row.status),
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
