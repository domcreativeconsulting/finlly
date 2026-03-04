import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlGoalMovement extends MysqlRow {
  id: number;
  goal_id: number;
  user_id: number;
  amount: number;
  date: Date | string;
  description?: string | null;
  transaction_id?: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class MetasMovimentosExtractor extends BaseExtractor {
  async extract(): Promise<MysqlGoalMovement[]> {
    return this.extractAll<MysqlGoalMovement>('goal_movements', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('goal_movements');
  }
}
