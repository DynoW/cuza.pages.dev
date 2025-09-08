import { corsHeaders, filterFilesByPage, extractYears } from './common';
import { FileStructure } from '../types';

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


export async function handlePage(env: { FILES: R2Bucket }, subject: string, page: string, yearsOnly?: boolean): Promise<Response> {
    try {
        const objects = await env.FILES.list();

        const filteredData = filterFilesByPage(objects.objects, subject, page);

        if (yearsOnly) {
            const sortedYears = extractYears(filteredData);
            return new Response(JSON.stringify({ years: sortedYears }, null, 2), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=600'
            }
        });
        }

        return new Response(JSON.stringify({ content: filteredData }, null, 2), {
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
