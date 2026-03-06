import { MysqlGoal } from '../extractors/metas.extractor.js';
import { mapId } from './id-mapper.js';
import { toTimestamptz, toDateOnly, toStatusMeta, toTipoMeta, toHexColor } from './type-converter.js';

export interface PostgresMeta {
  id: string;
  usuario_id: string;
  nome: string;
  tipo: 'economia' | 'despesa' | 'investimento';
  valor_alvo: number;
  data_inicio: Date;
  data_fim?: Date;
  status: 'ativa' | 'concluida' | 'cancelada';
  icone?: string;
  cor?: string;
  observacoes?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformMeta(row: MysqlGoal): PostgresMeta {
  // NOTE: `current_amount` is intentionally removed — computed via metas_movimentos
  return {
    id: mapId(row.id, 'goals'),
    usuario_id: mapId(row.user_id, 'users'),
    nome: String(row.name ?? '').trim(),
    tipo: toTipoMeta(row.type),
    // valor_alvo CHECK: > 0
    valor_alvo: Math.max(0.01, Number(row.target_amount ?? 0.01)),
    data_inicio: toDateOnly(row.start_date) ?? new Date(),
    data_fim: toDateOnly(row.end_date),
    status: toStatusMeta(row.status),
    icone: row.icon ? String(row.icon) : undefined,
    cor: toHexColor(row.color as string | undefined),
    observacoes: row.notes ? String(row.notes) : undefined,
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
