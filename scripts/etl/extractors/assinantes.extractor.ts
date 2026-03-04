import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlPlan extends MysqlRow {
  id: number;
  user_id: number;
  status: string;
  plan: string;
  provider?: string;
  provider_customer_id?: string;
  provider_subscription_id?: string;
  coupon_id?: number | null;
  trial_start?: Date | string | null;
  trial_end?: Date | string | null;
  next_billing?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class AssinantesExtractor extends BaseExtractor {
  async extract(): Promise<MysqlPlan[]> {
    return this.extractAll<MysqlPlan>('plans', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('plans');
  }
}
