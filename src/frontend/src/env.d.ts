/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base URL (SPEC 10.7). Build-time; defaults to `/api/v1` (same origin via nginx / Vite proxy). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
