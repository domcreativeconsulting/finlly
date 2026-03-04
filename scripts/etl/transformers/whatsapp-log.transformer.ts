import { MysqlWhatsappMessage } from '../extractors/whatsapp-logs.extractor.js';
import { mapIdOptional } from './id-mapper.js';
import { toTimestamptz } from './type-converter.js';

export interface PostgresWhatsappLog {
  usuario_id?: string;
  provider: string;
  telefone: string;
  direcao: string;
  tipo_mensagem: string;
  conteudo?: string;
  status?: string;
  provider_message_id?: string;
  created_at: Date;
  updated_at: Date;
}

export function transformWhatsappLog(row: MysqlWhatsappMessage): PostgresWhatsappLog {
  return {
    usuario_id: mapIdOptional(row.user_id as number | null | undefined, 'users'),
    provider: String(row.provider ?? ''),
    telefone: String(row.phone ?? ''),
    direcao: String(row.direction ?? 'outbound'),
    tipo_mensagem: String(row.message_type ?? 'text'),
    conteudo: row.content ? String(row.content) : undefined,
    status: row.status ? String(row.status) : undefined,
    provider_message_id: row.provider_message_id ? String(row.provider_message_id) : undefined,
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
  };
}
