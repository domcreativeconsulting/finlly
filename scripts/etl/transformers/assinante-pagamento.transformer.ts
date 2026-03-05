import { MysqlPayment } from '../extractors/assinantes-pagamentos.extractor.js';
import { mapId } from './id-mapper.js';
import { toTimestamptz, toStatusPagamento } from './type-converter.js';

export interface PostgresAssinantePagamento {
  id: string;
  assinante_id: string;
  usuario_id: string;
  status: 'pendente' | 'pago' | 'cancelado' | 'estornado' | 'falhou';
  valor: number;
  provider?: string;
  provider_payment_id?: string;
  descricao?: string;
  data_pagamento?: Date;
  data_vencimento?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformAssinantePagamento(row: MysqlPayment): PostgresAssinantePagamento {
  return {
    id: mapId(row.id, 'assinantes_pagamentos'),
    assinante_id: mapId(row.subscription_id, 'plans'),
    usuario_id: mapId(row.user_id, 'users'),
    status: toStatusPagamento(row.status),
    valor: Number(row.amount ?? 0),
    provider: row.provider ? String(row.provider) : undefined,
    provider_payment_id: row.provider_payment_id ? String(row.provider_payment_id) : undefined,
    descricao: row.description ? String(row.description) : undefined,
    data_pagamento: toTimestamptz(row.paid_at),
    data_vencimento: toTimestamptz(row.due_date),
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
