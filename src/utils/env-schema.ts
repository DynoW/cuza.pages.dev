// TODO: Remove this file

import { envField } from 'astro/config';
import type { BucketMode, SiteConfig } from '../types';
import { normalizeUrl } from './data';
// import { loadEnv } from 'vite';

export function buildEnvSchema(siteConfig: SiteConfig) {
    const mode = process.env.NODE_ENV ?? 'development';
    // const rawEnv = loadEnv(mode, process.cwd(), '');

    // const workerUrl = siteConfig.bucket_mode === 'local' 
    //   ? normalizeUrl(rawEnv.LOCAL_WORKER_URL) 
    //   : normalizeUrl(rawEnv.WORKER_URL);

    return {
    WORKER_URL: envField.string({
      context: 'server',
      access: 'public',
      optional: siteConfig.bucket_mode === 'off',
    }),
    LOCAL_WORKER_URL: envField.string({
      context: 'server',
      access: 'public',
      optional: siteConfig.bucket_mode !== 'local',
    }),
    // PUBLIC_WORKER_URL: envField.string({
    //   context: 'client',
    //   access: 'public',
    //   default: workerUrl,
    // }),
    BUCKET_MODE: envField.enum({
      context: 'server',
      access: 'public',
      default: siteConfig.bucket_mode,
      values: ['off', 'local', 'remote'],
    }),
    PUBLIC_COUNTDOWN: envField.enum({
      context: 'client',
      access: 'public',
      default: siteConfig.public_countdown,
      values: ['on', 'off'],
    }),
    FILES_DIR: envField.string({
      context: 'client',
      access: 'public',
      default: siteConfig.files_dir,
    }),
  };
}