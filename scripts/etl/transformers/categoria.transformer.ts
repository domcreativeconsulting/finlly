import { MysqlCategory } from '../extractors/categorias.extractor.js';
import { mapId, mapIdOptional } from './id-mapper.js';
import { toTimestamptz, toTipoMovimentacao, toHexColor } from './type-converter.js';

export interface PostgresCategoria {
  id: string;
  usuario_id?: string;
  nome: string;
  tipo: 'entrada' | 'saida' | 'transferencia';
  icone?: string;
  cor?: string;
  pai_id?: string;
  is_sistema: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformCategoria(row: MysqlCategory): PostgresCategoria {
  return {
    id: mapId(row.id, 'categories'),
    usuario_id: mapIdOptional(row.user_id as number | null | undefined, 'users'),
    nome: String(row.name ?? '').trim(),
    tipo: toTipoMovimentacao(row.type),
    icone: row.icon ? String(row.icon) : undefined,
    cor: toHexColor(row.color as string | undefined),
    pai_id: undefined, // TODO: legacy MySQL had no category hierarchy; future import could map parent categories
    is_sistema: row.user_id == null,
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
