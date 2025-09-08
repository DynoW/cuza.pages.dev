import { corsHeaders } from './common';

export async function handleFileServe(env: { FILES: R2Bucket }, filePath: string): Promise<Response> {
    try {
        const object = await env.FILES.get(filePath);
        console.log(`Fetching file: ${filePath}`);
        if (!object) {
            return new Response('File not found', { 
                status: 404, 
                headers: corsHeaders 
            });
        }

        const headers = new Headers(corsHeaders);
        headers.set('Content-Type', object.httpMetadata?.contentType || 'application/pdf');
        headers.set('Content-Length', object.size.toString());
        headers.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        
        if (object.httpMetadata?.contentDisposition) {
            headers.set('Content-Disposition', object.httpMetadata.contentDisposition);
        }

        console.log(`Serving file: ${filePath} (${object.size} bytes) - ${object.httpMetadata?.contentDisposition}`);

        return new Response(object.body, {
            status: 200,
            headers
        });
    } catch (error) {
        console.error('Error serving file:', error);
        return new Response('Error serving file', { 
            status: 500, 
            headers: corsHeaders 
        });
    }
}
