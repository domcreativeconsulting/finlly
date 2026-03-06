import { MysqlUsuario } from '../extractors/usuarios.extractor';
import { mapId, mapIdOptional } from './id-mapper';
import { toTimestamptz, toBoolean } from './type-converter';

export interface PostgresUsuario {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
  telefone?: string;
  avatar_url?: string;
  email_verificado: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformUsuario(row: MysqlUsuario): PostgresUsuario {
  return {
    id: mapId(row.id, 'users'),
    nome: String(row.name ?? ''),
    email: String(row.email ?? '').toLowerCase().trim(),
    senha_hash: String(row.password ?? ''),
    telefone: row.phone ? String(row.phone) : undefined,
    avatar_url: row.avatar_url ? String(row.avatar_url) : undefined,
    email_verificado: toBoolean(row.email_verified),
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}

export { mapIdOptional };
