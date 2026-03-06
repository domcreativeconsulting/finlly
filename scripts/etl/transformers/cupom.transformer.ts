import { MysqlCoupon } from '../extractors/cupons.extractor.js';
import { mapId } from './id-mapper.js';
import { toTimestamptz, toBoolean } from './type-converter.js';

export interface PostgresCupom {
  id: string;
  codigo: string;
  desconto_percentual?: number;
  desconto_fixo?: number;
  valido_ate?: Date;
  uso_maximo?: number;
  uso_atual: number;
  ativo: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformCupom(row: MysqlCoupon): PostgresCupom {
  const tipo = String(row.tipo ?? 'percentual').toLowerCase();
  return {
    id: mapId(row.id, 'cupons'),
    codigo: String(row.codigo ?? '')
      .trim()
      .toUpperCase(),
    desconto_percentual:
      tipo === 'percentual' ? Number(row.valor) : undefined,
    desconto_fixo: tipo === 'valor' ? Number(row.valor) : undefined,
    valido_ate: toTimestamptz(row.data_expiracao),
    uso_maximo: row.max_usos != null ? Number(row.max_usos) : undefined,
    uso_atual: Number(row.usos ?? 0),
    ativo: toBoolean(row.ativo),
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
