import { MysqlInvestmentType } from '../extractors/tipos-investimento.extractor';
import { mapId } from './id-mapper';
import { toTimestamptz } from './type-converter';

export interface PostgresTipoInvestimento {
  id: string;
  nome: string;
  descricao?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformTipoInvestimento(row: MysqlInvestmentType): PostgresTipoInvestimento {
  return {
    id: mapId(row.id, 'investment_types'),
    nome: String(row.name ?? '').trim(),
    descricao: row.description ? String(row.description) : undefined,
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
