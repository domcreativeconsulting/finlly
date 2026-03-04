import { MysqlInvestment } from '../extractors/investimentos.extractor.js';
import { mapId, mapIdOptional } from './id-mapper.js';
import { toTimestamptz, toDateOnly, toStatusConta } from './type-converter.js';

export interface PostgresInvestimento {
  id: string;
  usuario_id: string;
  nome: string;
  tipo_id: string;
  instituicao_id?: string;
  valor_inicial: number;
  data_inicio: Date;
  data_vencimento?: Date;
  status: 'ativa' | 'inativa' | 'arquivada';
  observacoes?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformInvestimento(row: MysqlInvestment): PostgresInvestimento {
  // NOTE: `current_value` is intentionally removed — it will be computed via investimentos_eventos
  return {
    id: mapId(row.id, 'investments'),
    usuario_id: mapId(row.user_id, 'users'),
    nome: String(row.name ?? '').trim(),
    tipo_id: mapId(row.type_id, 'investment_types'),
    instituicao_id: mapIdOptional(row.bank_id as number | null | undefined, 'banks'),
    valor_inicial: Number(row.initial_value ?? 0),
    data_inicio: toDateOnly(row.start_date) ?? new Date(),
    data_vencimento: toDateOnly(row.maturity_date),
    status: toStatusConta(row.status),
    observacoes: row.notes ? String(row.notes) : undefined,
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
