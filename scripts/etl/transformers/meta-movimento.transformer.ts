import { MysqlGoalMovement } from '../extractors/metas-movimentos.extractor.js';
import { mapId, mapIdOptional } from './id-mapper.js';
import { toTimestamptz, toDateOnly } from './type-converter.js';

export interface PostgresMetaMovimento {
  id: string;
  meta_id: string;
  usuario_id: string;
  valor: number;
  data: Date;
  descricao?: string;
  movimentacao_id?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformMetaMovimento(row: MysqlGoalMovement): PostgresMetaMovimento {
  return {
    id: mapId(row.id, 'goal_movements'),
    meta_id: mapId(row.goal_id, 'goals'),
    usuario_id: mapId(row.user_id, 'usuarios'),
    valor: Number(row.amount ?? 0),
    data: toDateOnly(row.date) ?? new Date(),
    descricao: row.description ? String(row.description) : undefined,
    movimentacao_id: mapIdOptional(
      row.transaction_id as number | null | undefined,
      'transactions',
    ),
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
