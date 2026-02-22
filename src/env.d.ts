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

  readonly WORKER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
