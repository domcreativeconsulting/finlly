const requiredVars = ['VITE_API_BASE_URL'];

function loadConfig() {
  const errors = [];

  for (const key of requiredVars) {
    if (!import.meta.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  if (errors.length > 0) {
    console.error('[ERROR] Configuration validation failed:');
    errors.forEach((err) => console.error(`- ${err}`));
    console.error(
      '\nPlease check your .env file and ensure all required variables are set.',
    );
    throw new Error('Missing required environment variables');
  }

  return {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  };
}

export const config = loadConfig();
