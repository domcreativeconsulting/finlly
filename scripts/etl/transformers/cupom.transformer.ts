import { MysqlCoupon } from '../extractors/cupons.extractor';
import { mapId } from './id-mapper';
import { toTimestamptz, toBoolean } from './type-converter';

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

  // Default valor to 1 when 0, undefined, or non-numeric — a zero-value discount is
  // meaningless and could cause ck_cupons_desconto violations if mishandled downstream.
  const rawValor = Number(row.valor ?? 0);
  const valor = rawValor !== 0 && !isNaN(rawValor) ? rawValor : 1;

  if (rawValor === 0 || isNaN(rawValor)) {
    console.warn(
      `   ⚠️  cupom id=${row.id}: valor=${row.valor} (zero/undefined/NaN) — defaulting to 1`
    );
  }

  // ck_cupons_desconto: exactly one of desconto_percentual or desconto_fixo must be set.
  // Default to percentual when tipo is unrecognised to avoid constraint violations.
  const isPercentual = tipo !== 'valor';
  const rawDescPerc = isPercentual ? valor : undefined;
  const rawDescFixo = !isPercentual ? valor : undefined;

  // desconto_percentual CHECK: BETWEEN 0 AND 100
  let desconto_percentual =
    rawDescPerc !== undefined
      ? Math.min(100, Math.max(0, rawDescPerc))
      : undefined;

  // desconto_fixo CHECK: >= 0
  let desconto_fixo =
    rawDescFixo !== undefined ? Math.max(0, rawDescFixo) : undefined;

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

  // Belt-and-suspenders: ensure exactly one discount field is always set (ck_cupons_desconto).
  if (desconto_percentual === undefined && desconto_fixo === undefined) {
    console.warn(
      `   ⚠️  cupom id=${row.id}: both discount fields would be null — defaulting to desconto_percentual=1`
    );
    desconto_percentual = 1;
  }

  // uso_maximo CHECK: > 0 — treat 0 as "unlimited" (NULL)
  const rawUsoMaximo = row.max_usos != null ? Number(row.max_usos) : undefined;
  const uso_maximo =
    rawUsoMaximo !== undefined && rawUsoMaximo > 0 ? rawUsoMaximo : undefined;

  // uso_atual CHECK: >= 0
  const uso_atual = Math.max(0, Number(row.usos ?? 0));

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
