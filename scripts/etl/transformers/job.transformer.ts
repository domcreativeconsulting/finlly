import { MysqlBackgroundJob } from '../extractors/jobs.extractor.js';
import { toTimestamptz, parseJson } from './type-converter.js';

export interface PostgresJob {
  tipo: string;
  payload?: unknown;
  status: string;
  tentativas: number;
  max_tentativas: number;
  erro?: string;
  agendado_para?: Date;
  iniciado_em?: Date;
  finalizado_em?: Date;
  created_at: Date;
  updated_at: Date;
}

export function transformJob(row: MysqlBackgroundJob): PostgresJob {
  return {
    tipo: String(row.type ?? ''),
    payload: parseJson(row.payload),
    status: String(row.status ?? 'pendente'),
    tentativas: Number(row.attempts ?? 0),
    max_tentativas: Number(row.max_attempts ?? 3),
    erro: row.error ? String(row.error) : undefined,
    agendado_para: toTimestamptz(row.scheduled_at),
    iniciado_em: toTimestamptz(row.started_at),
    finalizado_em: toTimestamptz(row.finished_at),
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
  };
}
