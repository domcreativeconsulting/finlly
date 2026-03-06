import { BaseExtractor, MysqlRow } from './base.extractor';

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
    return this.extractAll<MysqlGoalMovement>('metas_movimentos', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('metas_movimentos');
  }
}
