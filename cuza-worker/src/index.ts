// import { validateFormData, extractFormData, generateFilePath, uploadToR2AndGithub, isValidAuth, UploadEnv } from './upload';
import { handleFileList } from './handlers/files';
import { handleFileServe } from './handlers/serve';
import { handleFileSearch, handlePage } from './handlers/search';
import { corsHeaders } from './handlers/common';

// Environment interface
export interface Env {
    UPLOAD_PASSWORD: string;
    GITHUB_TOKEN: string;
    FILES: R2Bucket;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        
        if (request.method === 'OPTIONS') {
            return handleOptions();
        }

        // Route: GET /files?subject=X&page=Y - Search by subject and page
        if (request.method === 'GET' && url.pathname === '/files') {
            const subject = url.searchParams.get('subject');
            const page = url.searchParams.get('page');
            const query = url.searchParams.get('q');
            const yearsOnly = url.searchParams.get('years');
            
            if (subject && page) {
                if (yearsOnly === 'true') {
                    return handlePage(env, subject, page, true);
                }
                return handlePage(env, subject, page);
            }
            if (query) {
                return handleFileSearch(env, query);
            }
            return handleFileList(env);
        }

        // Route: GET /files/* - Serve individual files
        if (request.method === 'GET' && url.pathname.startsWith('/files/')) {
            const filePath = url.pathname.slice(1);
            return handleFileServe(env, filePath);
        }

        // Route: POST /upload - Upload new files
        if (request.method === 'POST' && url.pathname === '/upload') {
            return handleUpload(request, env);
        }

        return new Response('Not Found', { status: 404, headers: corsHeaders });
    }
};

function handleOptions(): Response {
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

async function handleUpload(request: Request, env: Env): Promise<Response> {
    try {
        const contentType = request.headers.get('Content-Type') || '';
        if (!contentType.includes('multipart/form-data')) {
            console.log('Invalid content type:', contentType);
            return new Response('Tip de conținut neacceptat', { status: 415, headers: corsHeaders });
        }

        const formData = await request.formData();
        await uploadToR2(env, formData.get('path') as string, formData.get('file') as unknown as File);

        return new Response(`Fișier încărcat cu succes: ${formData.get('path')}`, { status: 200, headers: corsHeaders });
    } catch (error) {
        console.log('Error uploading file:', error);
        return new Response('Eroare la încărcarea fișierului', { status: 500, headers: corsHeaders });
    }
}

function uploadToR2(env: Env, storagePath: string, file: File): Promise<void> {
    // Remove leading slash if it exists
    const normalizedPath = storagePath.startsWith('/') ? storagePath.slice(1) : storagePath;
    
    return env.FILES.put(normalizedPath, file.stream(), {
        httpMetadata: {
            contentType: 'application/pdf',
            contentDisposition: `inline; filename="${normalizedPath.split('/').pop()}"`
        }
    }).then(() => {
        console.log(`File uploaded to R2 at path: ${normalizedPath}`);
    }).catch((error) => {
        console.error('Error uploading to R2:', error);
        throw error;
    });
}
