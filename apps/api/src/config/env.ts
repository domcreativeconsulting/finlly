const requiredVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'REFRESH_SECRET',
] as const;

function loadConfig() {
  const errors: string[] = [];

  for (const key of requiredVars) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  if (errors.length > 0) {
    console.error('[ERROR] Configuration validation failed:');
    errors.forEach((err) => console.error(`- ${err}`));
    console.error(
      '\nPlease check your .env file and ensure all required variables are set.',
    );
    process.exit(1);
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL as string,
    REDIS_URL: process.env.REDIS_URL as string,
    PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
    JWT_SECRET: process.env.JWT_SECRET as string,
    REFRESH_SECRET: process.env.REFRESH_SECRET as string,
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
  };
}

export const config = loadConfig();
