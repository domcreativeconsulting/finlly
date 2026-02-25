const requiredVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'REFRESH_SECRET',
];

function loadConfig() {
  const errors = [];

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
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
    JWT_SECRET: process.env.JWT_SECRET,
    REFRESH_SECRET: process.env.REFRESH_SECRET,
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
  };
}

export const config = loadConfig();
