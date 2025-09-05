import { FileStructure } from '../types';

export const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://cuza.pages.dev, http://localhost:4321',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export function buildFileStructure(objects: R2Object[]): FileStructure {
    const structure: FileStructure = {};

    for (const obj of objects) {
        // Skip files containing "ignore"
        if (obj.key.toLowerCase().includes('ignore')) {
            continue;
        }

        const pathParts = obj.key.split('/');
        let current = structure;

        // Navigate through the path, creating nested objects
        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part] as FileStructure;
        }

        // Add the file to the final directory
        const fileName = pathParts[pathParts.length - 1];
        
        if (!current[fileName]) {
            current[fileName] = pathParts.join('/');
        }
    }

    return structure;
}

export function filterFilesByPath(objects: R2Object[], subject: string, page: string): R2Object[] {
    const subjectLower = subject.toLowerCase();
    const pageLower = page.toLowerCase();
    
    return objects.filter(obj => {
        const key = obj.key.toLowerCase();
        if (key.includes('ignore')) return false;
        
        const pathParts = key.split('/');
        
        // Check if subject is in the second position (index 1) of the path
        if (pathParts.length < 2 || pathParts[1] !== subjectLower) {
            return false;
        }
        
        // Handle different path patterns based on subject
        if (subjectLower === 'admitere') {
            const pageLowerParts = pageLower.split('/');
            const admitereSubject = pageLowerParts[0];
            const admitereType = pageLowerParts[1] || 'admitere';

            return admitereSubject === pathParts[2] && admitereType === pathParts[3];
        } else {
            // Handle "extra" pages that come directly after subject
            if (pageLower === 'extra') {
                return pathParts.length > 2 && pathParts[2] === 'extra';
            }
            
            // For other pages: look for /pages/ in the path
            const pagesIndex = pathParts.indexOf('pages');
            if (pagesIndex === -1) return false;
            
            // Check if page appears after /pages/
            const pageIndex = pathParts.indexOf(pageLower, pagesIndex);
            return pageIndex !== -1 && pageIndex > pagesIndex;
        }
    });
}

export function extractYearsFromObjects(objects: R2Object[]): number[] {
    const years = new Set<number>();
    
    for (const obj of objects) {
        const pathParts = obj.key.split('/');
        
        // Look for year patterns (4 digit numbers starting with 20)
        for (const part of pathParts) {
            if (/^20\d{2}$/.test(part)) {
                const year = parseInt(part, 10);
                years.add(year);
            }
        }
    }
    
    return Array.from(years).sort((a, b) => b - a);
}
