import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlBackgroundJob extends MysqlRow {
  id: number;
  type: string;
  payload?: string | object | null;
  status: string;
  attempts: number;
  max_attempts: number;
  error?: string | null;
  scheduled_at?: Date | string | null;
  started_at?: Date | string | null;
  finished_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class JobsExtractor extends BaseExtractor {
  async extract(): Promise<MysqlBackgroundJob[]> {
    return this.extractAll<MysqlBackgroundJob>('background_jobs', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('background_jobs');
  }
}
