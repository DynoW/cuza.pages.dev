export type BucketMode = 'off' | 'local' | 'remote';

export interface SiteConfig {
  bucket_mode: BucketMode;
  public_countdown: 'on' | 'off';
  files_dir: string;
}

export interface FileStructure {
  [key: string]: FileStructure | string;
}

export interface ApiResponse {
  content?: FileStructure;
  years?: number[];
}
