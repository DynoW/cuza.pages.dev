import { corsHeaders, filterFilesByPath } from './common';
import { FileStructure } from '../types';

export async function handleSubjectPageSearch(env: { FILES: R2Bucket }, subject: string, page: string): Promise<Response> {
    try {
        const objects = await env.FILES.list();
        const matchingObjects = filterFilesByPath(objects.objects, subject, page);
        
        // Build hierarchical structure for the matching files, but only the relevant part
        const targetStructure: FileStructure = {};
        const subjectLower = subject.toLowerCase();
        const pageLower = page.toLowerCase();
        
        for (const obj of matchingObjects) {
            const pathParts = obj.key.split('/');
            let relevantParts: string[] = [];
            
            if (subjectLower === 'admitere') {
                // For admitere: start from after the admitere type (admitere/extra)
                let admitereTypeIndex = -1;
                for (let i = pathParts.length - 1; i >= 0; i--) {
                    if (pathParts[i] === 'admitere' || pathParts[i] === 'extra') {
                        admitereTypeIndex = i;
                        break;
                    }
                }
                if (admitereTypeIndex !== -1 && admitereTypeIndex + 1 < pathParts.length) {
                    relevantParts = pathParts.slice(admitereTypeIndex + 1);
                }
            } else if (pageLower === 'extra') {
                // For extra pages: start from after "extra"
                const extraIndex = pathParts.indexOf('extra');
                if (extraIndex !== -1 && extraIndex + 1 < pathParts.length) {
                    relevantParts = pathParts.slice(extraIndex + 1);
                }
            } else {
                // For other subjects: start from after the page
                const pageIndex = pathParts.indexOf(pageLower);
                if (pageIndex !== -1 && pageIndex + 1 < pathParts.length) {
                    relevantParts = pathParts.slice(pageIndex + 1);
                }
            }
            
            if (relevantParts.length > 0) {
                let current = targetStructure;
                
                // Navigate through the relevant path parts, creating nested objects
                for (let i = 0; i < relevantParts.length - 1; i++) {
                    const part = relevantParts[i];
                    if (!current[part]) {
                        current[part] = {};
                    }
                    current = current[part] as FileStructure;
                }
                
                // Add the file to the final directory
                const fileName = relevantParts[relevantParts.length - 1];
                current[fileName] = obj.key; // Store the full path for downloading
            }
        }
        
        // Build structured response
        const structuredResponse = {
            content: targetStructure
        };
        
        return new Response(JSON.stringify(structuredResponse, null, 2), {
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
