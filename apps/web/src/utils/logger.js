const isDev = import.meta.env.DEV;

const logger = {
  info: isDev ? (...args) => console.warn('[INFO]', ...args) : () => {},
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

export default logger;
