import { FileStructure } from '../types';

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

export function filterFilesByPage(objects: R2Object[], subject: string, page: string, yearsOnly?: boolean): FileStructure {
    const subjectLower = subject.toLowerCase();
    const pageLower = page.toLowerCase();

    // Determine the target path prefix based on filestructure.md rules
    let targetPrefix: string;

    // Rule 1: Special Case - Admitere Subject
    if (subjectLower === 'admitere') {
        if (pageLower.includes('/extra')) {
            // Handle cases like "fizica/extra", "mate/extra", "info/extra"
            const subsubject = pageLower.replace('/extra', '');
            targetPrefix = `files/admitere/${subsubject}/extra/`;
        } else {
            // Regular admitere pages like "fizica", "mate", "info"
            targetPrefix = `files/admitere/${pageLower}/admitere/`;
        }
    }
    // Rule 2: Regular Subjects with Extra Pages
    else if (pageLower === 'extra') {
        targetPrefix = `files/${subjectLower}/extra/`;
    }
    // Rule 3: Regular Subjects with Regular Pages
    else {
        targetPrefix = `files/${subjectLower}/pages/${pageLower}/`;
    }

    // Filter objects that match the target prefix
    const filteredObjects = objects.filter(obj => {
        // Skip files containing "ignore"
        if (obj.key.toLowerCase().includes('ignore')) {
            return false;
        }
        
        return obj.key.startsWith(targetPrefix);
    });

    // Build structure manually to preserve original file paths
    const targetStructure: FileStructure = {};

    for (const obj of filteredObjects) {
        // Remove the prefix to get the relative path within the target directory
        const relativePath = obj.key.slice(targetPrefix.length);
        if (!relativePath) continue; // Skip if it's just the directory itself
        
        const pathParts = relativePath.split('/').filter(part => part !== '');
        let current = targetStructure;

        // Navigate through the path, creating nested objects
        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part] as FileStructure;
        }

        // Add the file to the final directory with original full path
        if (pathParts.length > 0) {
            const fileName = pathParts[pathParts.length - 1];
            if (!current[fileName]) {
                current[fileName] = obj.key; // Keep the original full file path
            }
        }
    }

    return targetStructure;
}

export function extractYears(fileStructure: FileStructure): number[] {
    const years = new Set<number>();

    function traverse(structure: FileStructure) {
        for (const key in structure) {
            if (typeof structure[key] === 'string') {
                // It's a file, check for year patterns in the path
                const pathParts = (structure[key] as string).split('/');
                for (const part of pathParts) {
                    if (/^20\d{2}$/.test(part)) {
                        years.add(parseInt(part, 10));
                    }
                }
            } else {
                // It's a directory, recurse into it
                traverse(structure[key] as FileStructure);
            }
        }
    }

    traverse(fileStructure);
    return Array.from(years).sort((a, b) => b - a);
}
