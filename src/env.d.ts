/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly WORKER_URL?: string;
  readonly LOCAL_WORKER_URL?: string;
  readonly PUBLIC_BUCKET_MODE?: 'off' | 'local' | 'remote';
  readonly PUBLIC_COUNTDOWN?: 'on' | 'off';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
