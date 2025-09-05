import { corsHeaders, filterFilesByPath, extractYearsFromObjects } from './common';

export async function handleYearsOnlySearch(env: { FILES: R2Bucket }, subject: string, page: string): Promise<Response> {
    try {
        const objects = await env.FILES.list();
        const matchingObjects = filterFilesByPath(objects.objects, subject, page);
        const sortedYears = extractYearsFromObjects(matchingObjects);
        
        return new Response(JSON.stringify({ years: sortedYears }, null, 2), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=600' // Cache for 10 minutes
            }
        });
    } catch (error) {
        console.error('Error searching years:', error);
        return new Response('Error searching years', { 
            status: 500, 
            headers: corsHeaders 
        });
    }
}
