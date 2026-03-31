import { config } from '../config/env.js';
import { localDriver } from './localDriver.js';
import { s3Driver } from './s3Driver.js';

/**
 * Retorna o provider de storage correto conforme a configuração STORAGE_DRIVER.
 * @returns {typeof localDriver | typeof s3Driver}
 */
export function getStorageProvider() {
  if (config.STORAGE_DRIVER === 's3') return s3Driver;
  return localDriver;
}
