import { MysqlPlan } from '../extractors/assinantes.extractor.js';
import { mapId, mapIdOptional } from './id-mapper.js';
import { toTimestamptz, toStatusAssinante } from './type-converter.js';

export interface PostgresAssinante {
  id: string;
  usuario_id: string;
  status: 'trial' | 'ativo' | 'inativo' | 'cancelado' | 'inadimplente';
  plano: string;
  provider?: string;
  provider_customer_id?: string;
  provider_subscription_id?: string;
  cupom_id?: string;
  trial_inicio?: Date;
  trial_fim?: Date;
  proxima_cobranca?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformAssinante(row: MysqlPlan): PostgresAssinante {
  return {
    id: mapId(row.id, 'plans'),
    usuario_id: mapId(row.user_id, 'users'),
    status: toStatusAssinante(row.status),
    plano: String(row.plan ?? 'free'),
    provider: row.provider ? String(row.provider) : undefined,
    provider_customer_id: row.provider_customer_id ? String(row.provider_customer_id) : undefined,
    provider_subscription_id: row.provider_subscription_id
      ? String(row.provider_subscription_id)
      : undefined,
    cupom_id: mapIdOptional(row.coupon_id as number | null | undefined, 'coupons'),
    trial_inicio: toTimestamptz(row.trial_start),
    trial_fim: toTimestamptz(row.trial_end),
    proxima_cobranca: toTimestamptz(row.next_billing),
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
