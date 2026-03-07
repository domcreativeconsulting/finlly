import 'dotenv/config';
import { parseArguments } from './cli';
import { ETLOrchestrator } from './orchestrator';

async function main(): Promise<void> {
  // Parse and validate CLI arguments via yargs
  const options = parseArguments(process.argv);

  // Show execution plan before starting the ETL pipeline
  const orchestrator = new ETLOrchestrator();
  orchestrator.validateSince(options.since);
  orchestrator.printExecutionPlan(options);

  // Forward dry-run flag to the ETL engine (config.ts reads ETL_DRY_RUN env var)
  if (options.dryRun) {
    process.env['ETL_DRY_RUN'] = 'true';
  }

  // config.ts uses --force as the safety flag for --reset.
  // Map --confirm → --force so the existing ETL pipeline gets the signal it expects.
  if (options.confirm && !process.argv.includes('--force')) {
    process.argv.push('--force');
  }

  // Delegate to the ETL pipeline (etl.ts reads config.ts which parses process.argv).
  // Using require() ensures config.ts reads the updated process.argv synchronously.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./etl');
}

main().catch((err) => {
  console.error('❌ ETL failed:', err);
  process.exit(1);
});
