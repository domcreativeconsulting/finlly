import { MysqlInvestmentEvent } from '../extractors/investimentos-eventos.extractor.js';
import { mapId } from './id-mapper.js';
import { toTimestamptz, toDateOnly, toTipoEventoInvestimento } from './type-converter.js';

export interface PostgresInvestimentoEvento {
  id: string;
  investimento_id: string;
  usuario_id: string;
  tipo: 'aporte' | 'resgate' | 'rendimento' | 'taxa' | 'dividendo';
  valor: number;
  data: Date;
  descricao?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformInvestimentoEvento(row: MysqlInvestmentEvent): PostgresInvestimentoEvento {
  return {
    id: mapId(row.id, 'investment_events'),
    investimento_id: mapId(row.investment_id, 'investments'),
    usuario_id: mapId(row.user_id, 'usuarios'),
    tipo: toTipoEventoInvestimento(row.type),
    valor: Number(row.amount ?? 0),
    data: toDateOnly(row.date) ?? new Date(),
    descricao: row.description ? String(row.description) : undefined,
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
