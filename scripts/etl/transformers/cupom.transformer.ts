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
  const discountType = String(row.discount_type ?? 'percent').toLowerCase();
  return {
    id: mapId(row.id, 'coupons'),
    codigo: String(row.code ?? '').trim().toUpperCase(),
    desconto_percentual: discountType === 'percent' ? Number(row.discount) : undefined,
    desconto_fixo: discountType === 'fixed' ? Number(row.discount) : undefined,
    valido_ate: toTimestamptz(row.valid_until),
    uso_maximo: row.max_uses != null ? Number(row.max_uses) : undefined,
    uso_atual: Number(row.current_uses ?? 0),
    ativo: toBoolean(row.active),
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
