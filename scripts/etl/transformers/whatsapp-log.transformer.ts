import { MysqlWhatsappMessage } from '../extractors/whatsapp-logs.extractor';
import { mapIdOptional } from './id-mapper';
import { toTimestamptz } from './type-converter';

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

const DIRECAO_MAP: Record<string, string> = {
  inbound: 'entrada',
  entrada: 'entrada',
  received: 'entrada',
  outbound: 'saida',
  saida: 'saida',
  sent: 'saida',
};

export function transformWhatsappLog(row: MysqlWhatsappMessage): PostgresWhatsappLog {
  const rawDirecao = String(row.direction ?? 'saida').toLowerCase();
  // direcao CHECK: IN ('entrada', 'saida')
  const direcao = DIRECAO_MAP[rawDirecao] ?? 'saida';

  return {
    usuario_id: mapIdOptional(row.user_id as number | null | undefined, 'users'),
    provider: String(row.provider ?? ''),
    telefone: String(row.phone ?? ''),
    direcao,
    tipo_mensagem: String(row.message_type ?? 'text'),
    conteudo: row.content ? String(row.content) : undefined,
    status: row.status ? String(row.status) : undefined,
    provider_message_id: row.provider_message_id ? String(row.provider_message_id) : undefined,
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
  };
}
