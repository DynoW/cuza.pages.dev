/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module '*.css' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly DEV: boolean;
  readonly MODE: string;
  readonly PROD: boolean;
  readonly SSR: boolean;

  readonly WORKER_URL?: string;
  readonly LOCAL_WORKER_URL?: string;
  readonly PUBLIC_WORKER_URL: string;
  readonly BUCKET_MODE: 'off' | 'local' | 'remote' = "off";
  readonly PUBLIC_COUNTDOWN: 'on' | 'off' = "on";
  readonly FILES_DIR: string = "files";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
