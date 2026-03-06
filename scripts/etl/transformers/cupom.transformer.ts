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
  const valor = Number(row.valor ?? 0);

  // ck_cupons_desconto: exactly one of desconto_percentual or desconto_fixo must be set.
  // Default to percentual when tipo is unrecognised to avoid constraint violations.
  const isPercentual = tipo !== 'valor';
  const rawDescPerc = isPercentual ? valor : undefined;
  const rawDescFixo = !isPercentual ? valor : undefined;

  // desconto_percentual CHECK: BETWEEN 0 AND 100
  const desconto_percentual =
    rawDescPerc !== undefined
      ? Math.min(100, Math.max(0, rawDescPerc))
      : undefined;

  // desconto_fixo CHECK: >= 0
  const desconto_fixo =
    rawDescFixo !== undefined ? Math.max(0, rawDescFixo) : undefined;

  // uso_maximo CHECK: > 0 — treat 0 as "unlimited" (NULL)
  const rawUsoMaximo = row.max_usos != null ? Number(row.max_usos) : undefined;
  const uso_maximo =
    rawUsoMaximo !== undefined && rawUsoMaximo > 0 ? rawUsoMaximo : undefined;

  // uso_atual CHECK: >= 0
  const uso_atual = Math.max(0, Number(row.usos ?? 0));

  if (rawDescPerc !== undefined && rawDescPerc !== desconto_percentual) {
    console.warn(
      `   ⚠️  cupom id=${row.id}: desconto_percentual=${rawDescPerc} clamped to ${desconto_percentual}`
    );
  }
  if (rawDescFixo !== undefined && rawDescFixo !== desconto_fixo) {
    console.warn(
      `   ⚠️  cupom id=${row.id}: desconto_fixo=${rawDescFixo} clamped to ${desconto_fixo}`
    );
  }

  return {
    id: mapId(row.id, 'cupons'),
    codigo: String(row.codigo ?? '')
      .trim()
      .toUpperCase(),
    desconto_percentual,
    desconto_fixo,
    valido_ate: toTimestamptz(row.data_expiracao),
    uso_maximo,
    uso_atual,
    ativo: toBoolean(row.ativo),
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
