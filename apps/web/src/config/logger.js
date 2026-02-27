const isDevelopment = import.meta.env.DEV;

const clientLogger = {
  debug: isDevelopment ? console.debug.bind(console) : () => {},
  info: isDevelopment ? console.info.bind(console) : () => {},
  warn: isDevelopment ? console.warn.bind(console) : console.warn.bind(console),
  error: console.error.bind(console),
};

export default clientLogger;
