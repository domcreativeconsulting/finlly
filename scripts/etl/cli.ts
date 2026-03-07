import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export interface ETLOptions {
  dryRun: boolean;
  tables?: string[];
  reset: boolean;
  confirm: boolean;
  since?: Date;
}

export function parseArguments(argv: string[]): ETLOptions {
  const parsed = yargs(hideBin(argv))
    .option('dry-run', {
      alias: 'd',
      type: 'boolean',
      describe: 'Preview changes without writing to Postgres (read-only mode)',
      default: false,
    })
    .option('tables', {
      alias: 't',
      type: 'string',
      describe: 'Comma-separated list of tables to migrate (e.g., usuarios,contas,metas)',
      default: undefined,
    })
    .option('reset', {
      alias: 'r',
      type: 'boolean',
      describe: 'DANGEROUS: Truncate destination tables before loading',
      default: false,
    })
    .option('confirm', {
      type: 'boolean',
      describe: 'Required with --reset to prevent accidental data loss',
      default: false,
    })
    .option('since', {
      alias: 's',
      type: 'string',
      describe: 'ISO date for incremental migration (e.g., 2024-01-15)',
      default: undefined,
    })
    .help()
    .strict()
    .parseSync() as unknown as {
      dryRun: boolean;
      tables?: string;
      reset: boolean;
      confirm: boolean;
      since?: string;
    };

  // Validate --reset requires --confirm
  if (parsed.reset && !parsed.confirm) {
    throw new Error(
      '⛔ --reset is DANGEROUS (truncates data). Use: npm run etl -- --reset --confirm'
    );
  }

  return {
    dryRun: parsed.dryRun,
    tables: parsed.tables ? parsed.tables.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    reset: parsed.reset,
    confirm: parsed.confirm,
    since: parsed.since ? new Date(parsed.since) : undefined,
  };
}
