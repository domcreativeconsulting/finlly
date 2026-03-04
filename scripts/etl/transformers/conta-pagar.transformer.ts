import { MysqlBill } from '../extractors/contas-pagar.extractor.js';
import { mapId, mapIdOptional } from './id-mapper.js';
import { toTimestamptz, toDateOnly, toStatusPagamento, toTipoRecorrencia, toBoolean } from './type-converter.js';

export interface PostgresContaPagar {
  id: string;
  usuario_id: string;
  descricao: string;
  valor: number;
  data_vencimento: Date;
  data_pagamento?: Date;
  status: 'pendente' | 'pago' | 'cancelado' | 'estornado' | 'falhou';
  categoria_id?: string;
  conta_id?: string;
  recorrente: boolean;
  recorrencia?: 'diario' | 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
  parcela_atual?: number;
  total_parcelas?: number;
  grupo_recorrencia_id?: string;
  observacoes?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformContaPagar(row: MysqlBill): PostgresContaPagar {
  return {
    id: mapId(row.id, 'bills'),
    usuario_id: mapId(row.user_id, 'users'),
    descricao: String(row.description ?? ''),
    valor: Number(row.amount ?? 0),
    data_vencimento: toDateOnly(row.due_date) ?? new Date(),
    data_pagamento: toDateOnly(row.payment_date),
    status: toStatusPagamento(row.status),
    categoria_id: mapIdOptional(row.category_id as number | null | undefined, 'categories'),
    conta_id: mapIdOptional(row.account_id as number | null | undefined, 'accounts'),
    recorrente: toBoolean(row.recurring),
    recorrencia: toTipoRecorrencia(row.recurrence as string | undefined),
    parcela_atual: undefined,
    total_parcelas: undefined,
    grupo_recorrencia_id: undefined,
    observacoes: row.notes ? String(row.notes) : undefined,
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
