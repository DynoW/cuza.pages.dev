import { loadEnv } from 'vite';
import { existsSync } from 'fs';
import type { SiteConfig } from '../types';
import { normalizeUrl } from './data';

// Validate SiteConfig values
export function validateSiteConfig(config: SiteConfig): void {
  if (!['off', 'local', 'remote'].includes(config.bucket_mode)) {
    throw new Error(`Invalid bucket_mode: ${config.bucket_mode}`);
  }
  if (!['on', 'off'].includes(config.public_countdown)) {
    throw new Error(`Invalid public_countdown: ${config.public_countdown}`);
  }
  if (typeof config.files_dir !== 'string' || config.files_dir.trim() === '') {
    throw new Error(`Invalid files_dir: ${config.files_dir}`);
  }
  if (config.bucket_mode === 'off' && !existsSync(config.files_dir)) {
    throw new Error(`Files directory does not exist: ${config.files_dir}`);
  }
}

// Covert SiteConfig to import.meta.env.* defines for Astro
export function buildPublicDefines(
  config: SiteConfig
): Record<string, string> {
  const defines = Object.entries(config).reduce((acc: Record<string, string>, [key, value]) => {
    if (value !== undefined) {
      acc[`import.meta.env.${key.toUpperCase()}`] = JSON.stringify(value);
    }
    return acc;
  }, {});

  const mode = process.env.NODE_ENV ?? 'development';
  const rawEnv = loadEnv(mode, process.cwd(), '');

  const workerUrl = config.bucket_mode === 'local' 
    ? normalizeUrl(rawEnv.LOCAL_WORKER_URL) 
    : normalizeUrl(rawEnv.WORKER_URL);

  defines['import.meta.env.PUBLIC_WORKER_URL'] = JSON.stringify(workerUrl);
  
  return defines;
}