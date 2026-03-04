import { MysqlAttachmentRelation } from '../extractors/anexos-vinculos.extractor.js';
import { mapId } from './id-mapper.js';
import { toTimestamptz } from './type-converter.js';

/**
 * Maps legacy MySQL entity_type strings to the allowed Postgres CHECK constraint values.
 * v2 allows: contas_pagar | contas_receber | investimentos | metas | movimentacoes_caixa
 */
const ENTITY_TYPE_MAP: Record<string, string> = {
  bill: 'contas_pagar',
  bills: 'contas_pagar',
  contas_pagar: 'contas_pagar',
  receivable: 'contas_receber',
  receivables: 'contas_receber',
  contas_receber: 'contas_receber',
  investment: 'investimentos',
  investments: 'investimentos',
  investimentos: 'investimentos',
  goal: 'metas',
  goals: 'metas',
  metas: 'metas',
  transaction: 'movimentacoes_caixa',
  transactions: 'movimentacoes_caixa',
  movimentacoes_caixa: 'movimentacoes_caixa',
};

/**
 * Maps a legacy MySQL entity_id (integer) to the corresponding Postgres UUID
 * based on the entity type.
 */
const ENTITY_TABLE_MAP: Record<string, string> = {
  contas_pagar: 'bills',
  contas_receber: 'receivables',
  investimentos: 'investments',
  metas: 'goals',
  movimentacoes_caixa: 'transactions',
};

export interface PostgresAnexoVinculo {
  id: string;
  anexo_id: string;
  entidade_tipo: string;
  entidade_id: string;
  created_at: Date;
}

export function transformAnexoVinculo(row: MysqlAttachmentRelation): PostgresAnexoVinculo | null {
  const entidadeTipo = ENTITY_TYPE_MAP[String(row.entity_type ?? '').toLowerCase()];
  if (!entidadeTipo) {
    // Skip unknown entity types
    return null;
  }
  const mysqlTable = ENTITY_TABLE_MAP[entidadeTipo] ?? entidadeTipo;
  return {
    id: mapId(row.id, 'attachment_relations'),
    anexo_id: mapId(row.attachment_id, 'attachments'),
    entidade_tipo: entidadeTipo,
    entidade_id: mapId(row.entity_id, mysqlTable),
    created_at: toTimestamptz(row.created_at) ?? new Date(),
  };
}
