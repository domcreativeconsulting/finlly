import { MysqlAttachment } from '../extractors/anexos.extractor';
import { mapId } from './id-mapper';
import { toTimestamptz, generateHash } from './type-converter';

export interface PostgresAnexo {
  id: string;
  usuario_id: string;
  nome_original: string;
  nome_arquivo: string;
  mime_type: string;
  tamanho_bytes: bigint;
  url: string;
  hash_sha256?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export function transformAnexo(row: MysqlAttachment): PostgresAnexo | null {
  if (row.user_id == null) {
    console.warn(`   ⚠️  Anexo id=${row.id} tem user_id=NULL — registro será ignorado`);
    return null;
  }
  return {
    id: mapId(row.id, 'attachments'),
    usuario_id: mapId(row.user_id, 'users'),
    nome_original: String(row.original_name ?? ''),
    nome_arquivo: String(row.file_name ?? ''),
    mime_type: String(row.mime_type ?? 'application/octet-stream'),
    // tamanho_bytes CHECK: > 0
    tamanho_bytes: BigInt(Math.max(1, Number(row.size_bytes ?? 1))),
    url: String(row.url ?? ''),
    // Generate SHA-256 hash from the URL as a proxy when the original hash is not stored
    hash_sha256: generateHash(String(row.url ?? row.file_name ?? '')),
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
    deleted_at: toTimestamptz(row.deleted_at),
  };
}
