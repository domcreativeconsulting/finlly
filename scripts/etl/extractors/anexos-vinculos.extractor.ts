import { BaseExtractor, MysqlRow } from './base.extractor.js';

export interface MysqlAttachmentRelation extends MysqlRow {
  id: number;
  attachment_id: number;
  entity_type: string;
  entity_id: number;
  created_at: Date | string;
}

export class AnexosVinculosExtractor extends BaseExtractor {
  async extract(): Promise<MysqlAttachmentRelation[]> {
    return this.extractAll<MysqlAttachmentRelation>('anexos_vinculos', '*', 'id');
  }
  async getCount(): Promise<number> {
    return this.count('anexos_vinculos');
  }
}
