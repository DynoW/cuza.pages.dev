export interface FileStructure {
    [key: string]: FileStructure | string;
}

export interface UploadEnv {
    UPLOAD_PASSWORD?: string;
    GITHUB_TOKEN?: string;
}
