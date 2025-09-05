import { corsHeaders, buildFileStructure } from './common';

export async function handleFileList(env: { FILES: R2Bucket }): Promise<Response> {
    try {
        const objects = await env.FILES.list();
        const fileStructure = buildFileStructure(objects.objects);
        
        return new Response(JSON.stringify(fileStructure, null, 2), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            }
        });
    } catch (error) {
        console.error('Error listing files:', error);
        return new Response('Error listing files', { 
            status: 500, 
            headers: corsHeaders 
        });
    }
}
