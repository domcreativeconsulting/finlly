import { BaseExtractor, MysqlRow } from './base.extractor';

export interface MysqlPayment extends MysqlRow {
  id: number;
  subscription_id: number;
  user_id: number;
  status: string;
  amount: number;
  provider?: string;
  provider_payment_id?: string;
  description?: string;
  paid_at?: Date | string | null;
  due_date?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
}

export class AssinantesPagamentosExtractor extends BaseExtractor {
  async extract(): Promise<MysqlPayment[]> {
    return this.extractAll<MysqlPayment>('assinantes_pagamentos', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('assinantes_pagamentos');
  }
}
