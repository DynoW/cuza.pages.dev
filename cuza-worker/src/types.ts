export interface FileStructure {
    [key: string]: FileStructure | string;
}

export interface UploadEnv {
    UPLOAD_PASSWORD?: string;
    GITHUB_TOKEN?: string;
    GITHUB_OWNER?: string;
    GITHUB_REPO?: string;
    GITHUB_BRANCH?: string;
}
