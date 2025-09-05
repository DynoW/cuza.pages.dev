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

export async function handleFileSearch(env: { FILES: R2Bucket }, query: string): Promise<Response> {
    try {
        const objects = await env.FILES.list();
        const queryLower = query.toLowerCase();
        
        // Filter files in a single pass
        const matchingFiles = objects.objects
            .filter(obj => !obj.key.toLowerCase().includes('ignore'))
            .filter(obj => obj.key.toLowerCase().includes(queryLower))
            .map(obj => obj.key);
        
        return new Response(JSON.stringify({ 
            query, 
            files: matchingFiles 
        }, null, 2), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300'
            }
        });
    } catch (error) {
        console.error('Error searching files:', error);
        return new Response('Error searching files', { 
            status: 500, 
            headers: corsHeaders 
        });
    }
}
