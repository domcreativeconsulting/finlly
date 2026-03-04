import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlGoal extends MysqlRow {
  id: number;
  user_id: number;
  name: string;
  type?: string;
  target_amount: number;
  current_amount: number;
  start_date: Date | string;
  end_date?: Date | string | null;
  status: string;
  icon?: string;
  color?: string;
  notes?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class MetasExtractor extends BaseExtractor {
  async extract(): Promise<MysqlGoal[]> {
    return this.extractAll<MysqlGoal>('goals', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('goals');
  }
}
