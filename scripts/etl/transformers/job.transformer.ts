import { MysqlBackgroundJob } from '../extractors/jobs.extractor';
import { toTimestamptz, parseJson } from './type-converter';

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

const VALID_JOB_STATUS = new Set(['pendente', 'processando', 'concluido', 'falhou']);

export function transformJob(row: MysqlBackgroundJob): PostgresJob {
  const rawStatus = String(row.status ?? 'pendente').toLowerCase();
  // status CHECK: IN ('pendente', 'processando', 'concluido', 'falhou')
  const status = VALID_JOB_STATUS.has(rawStatus) ? rawStatus : 'pendente';

  // tentativas CHECK: >= 0
  const tentativas = Math.max(0, Number(row.attempts ?? 0));

  // max_tentativas CHECK: > 0
  const max_tentativas = Math.max(1, Number(row.max_attempts ?? 3));

  return {
    tipo: String(row.type ?? ''),
    payload: parseJson(row.payload),
    status,
    tentativas,
    max_tentativas,
    erro: row.error ? String(row.error) : undefined,
    agendado_para: toTimestamptz(row.scheduled_at),
    iniciado_em: toTimestamptz(row.started_at),
    finalizado_em: toTimestamptz(row.finished_at),
    created_at: toTimestamptz(row.created_at) ?? new Date(),
    updated_at: toTimestamptz(row.updated_at) ?? new Date(),
  };
}
