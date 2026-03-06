import { MysqlTransaction } from '../extractors/movimentacoes-caixa.extractor.js';
import { mapId, mapIdOptional } from './id-mapper.js';
import { toTimestamptz, toDateOnly, toTipoMovimentacao } from './type-converter.js';

export interface PostgresMovimentacaoCaixa {
  id: string;
  usuario_id: string;
  conta_id: string;
  tipo: 'entrada' | 'saida' | 'transferencia';
  valor: number;
  descricao: string;
  data: Date;
  categoria_id?: string;
  conta_destino_id?: string;
  conta_pagar_id?: string;
  conta_receber_id?: string;
  observacoes?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformMovimentacaoCaixa(row: MysqlTransaction): PostgresMovimentacaoCaixa {
  return {
    id: mapId(row.id, 'transactions'),
    usuario_id: mapId(row.user_id, 'users'),
    conta_id: mapId(row.account_id, 'accounts'),
    tipo: toTipoMovimentacao(row.type),
    // valor CHECK: > 0 — use absolute value to handle sign-encoded direction in legacy data
    valor: Math.max(0.01, Math.abs(Number(row.amount ?? 0.01))),
    descricao: String(row.description ?? ''),
    data: toDateOnly(row.date) ?? new Date(),
    categoria_id: mapIdOptional(row.category_id as number | null | undefined, 'categories'),
    conta_destino_id: mapIdOptional(
      row.destination_account_id as number | null | undefined,
      'accounts',
    ),
    conta_pagar_id: mapIdOptional(row.bill_id as number | null | undefined, 'bills'),
    conta_receber_id: mapIdOptional(row.receivable_id as number | null | undefined, 'receivables'),
    observacoes: row.notes ? String(row.notes) : undefined,
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
