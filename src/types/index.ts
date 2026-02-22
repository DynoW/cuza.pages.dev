export interface FileStructure {
  [key: string]: FileStructure | string;
}

export interface PageData {
  content: FileStructure;
  extra: FileStructure;
  years: number[];
}
