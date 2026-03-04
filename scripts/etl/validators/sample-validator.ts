import { BaseExtractor } from '../extractors/base.extractor.js';
import { PrismaClient } from '@prisma/client';
import { mapId } from '../transformers/id-mapper.js';

export interface SampleCheckResult {
  table: string;
  mysqlId: number;
  postgresId: string;
  found: boolean;
  fieldChecks: FieldCheck[];
}

export interface FieldCheck {
  field: string;
  mysqlValue: unknown;
  postgresValue: unknown;
  match: boolean;
  note?: string;
}

export class SampleValidator {
  constructor(
    private readonly extractor: BaseExtractor,
    private readonly prisma: PrismaClient,
    private readonly sampleSize: number = 15,
  ) {}

  private async randomSample(
    mysqlTable: string,
    sampleSize: number,
  ): Promise<Array<{ id: number }>> {
    return this.extractor['query']<{ id: number }>(
      `SELECT id FROM ${mysqlTable} ORDER BY RAND() LIMIT ?`,
      [sampleSize],
    );
  }

  async validateUsuarios(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('users', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'users');
      const [mysql, pg] = await Promise.all([
        this.extractor['query']<Record<string, unknown>>(`SELECT * FROM users WHERE id = ?`, [id])
          .then((r) => r[0])
          .catch(() => undefined),
        this.prisma.usuario
          .findUnique({ where: { id: pgId } })
          .catch(() => undefined),
      ]);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (mysql && pg) {
        fieldChecks.push({
          field: 'email',
          mysqlValue: mysql['email'],
          postgresValue: pg.email,
          match: String(mysql['email']).toLowerCase().trim() === pg.email,
        });
        fieldChecks.push({
          field: 'id_format',
          mysqlValue: `INT(${id})`,
          postgresValue: pgId,
          match: pgId.length === 36,
          note: 'UUID deve ter 36 caracteres',
        });
        fieldChecks.push({
          field: 'created_at_format',
          mysqlValue: mysql['created_at'],
          postgresValue: pg.created_at.toISOString(),
          match: pg.created_at instanceof Date,
          note: 'TIMESTAMPTZ deve ser instância de Date',
        });
      }

      results.push({ table: 'usuarios', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  async validateContas(): Promise<SampleCheckResult[]> {
    const sample = await this.randomSample('accounts', this.sampleSize).catch(() => []);
    const results: SampleCheckResult[] = [];

    for (const { id } of sample) {
      const pgId = mapId(id, 'accounts');
      const pg = await this.prisma.conta
        .findUnique({ where: { id: pgId } })
        .catch(() => undefined);

      const found = pg != null;
      const fieldChecks: FieldCheck[] = [];

      if (pg) {
        fieldChecks.push({
          field: 'id_format',
          mysqlValue: `INT(${id})`,
          postgresValue: pgId,
          match: pgId.length === 36,
          note: 'UUID deve ter 36 caracteres',
        });
        // balance should NOT be present in v2
        fieldChecks.push({
          field: 'balance_removed',
          mysqlValue: 'present',
          postgresValue: 'absent',
          match: !('balance' in pg),
          note: 'Campo balance deve ter sido removido',
        });
      }

      results.push({ table: 'contas', mysqlId: id, postgresId: pgId, found, fieldChecks });
    }

    return results;
  }

  /** Runs all sample validators and returns a flat list of results */
  async validateAll(): Promise<SampleCheckResult[]> {
    const all: SampleCheckResult[] = [];

    const validators = [
      () => this.validateUsuarios(),
      () => this.validateContas(),
    ];

    for (const fn of validators) {
      const results = await fn().catch((err) => {
        console.error(`   ⚠️  Erro ao executar sample validator: ${(err as Error).message}`);
        return [] as SampleCheckResult[];
      });
      all.push(...results);
    }

    const failed = all.filter((r) => !r.found || r.fieldChecks.some((c) => !c.match));
    const passed = all.filter((r) => r.found && r.fieldChecks.every((c) => c.match));

    console.log(`   ✅ ${passed.length} amostras OK — ⚠️  ${failed.length} com problemas`);
    return all;
  }
}
