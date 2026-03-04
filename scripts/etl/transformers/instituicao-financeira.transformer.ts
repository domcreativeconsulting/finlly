import { MysqlBank } from '../extractors/instituicoes-financeiras.extractor.js';
import { mapId } from './id-mapper.js';
import { toTimestamptz } from './type-converter.js';

export interface PostgresInstituicaoFinanceira {
  id: string;
  nome: string;
  codigo_compensacao?: string;
  logo_url?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformInstituicaoFinanceira(row: MysqlBank): PostgresInstituicaoFinanceira {
  // Prefer compe (3-digit) over ispb; combine if both present
  const codigo = row.compe ?? row.ispb ?? undefined;
  return {
    id: mapId(row.id, 'banks'),
    nome: String(row.name ?? '').trim(),
    codigo_compensacao: codigo ? String(codigo) : undefined,
    logo_url: row.logo_url ? String(row.logo_url) : undefined,
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
