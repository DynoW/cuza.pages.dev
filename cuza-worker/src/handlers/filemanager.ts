import { corsHeaders } from './common';
import { Env } from '../index';

export async function handleFileManagerList(env: Env, path: string = ''): Promise<Response> {
    try {
        const prefix = path ? `${path}/` : '';
        const objects = await env.FILES.list({ prefix });
        
        const files: any[] = [];
        const folders = new Set<string>();
        
        // Process objects to create file and folder structure
        for (const object of objects.objects) {
            const relativePath = object.key.slice(prefix.length);
            const pathParts = relativePath.split('/');
            
            if (pathParts.length === 1 && pathParts[0]) {
                // It's a file in the current directory
                files.push({
                    name: pathParts[0],
                    path: object.key,
                    type: 'file',
                    size: object.size,
                    lastModified: object.uploaded?.toISOString(),
                });
            } else if (pathParts.length > 1 && pathParts[0]) {
                // It's in a subdirectory
                folders.add(pathParts[0]);
            }
        }
        
        // Add folders to the files array
        for (const folder of folders) {
            files.unshift({
                name: folder,
                path: prefix + folder,
                type: 'folder',
            });
        }
        
        return new Response(JSON.stringify({ files }), {
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    } catch (error) {
        console.error('Error listing files:', error);
        return new Response(JSON.stringify({ error: 'Failed to list files' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    }
}

export async function handleFileManagerRename(env: Env, oldPath: string, newName: string): Promise<Response> {
    try {
        // Get the file from R2
        const object = await env.FILES.get(oldPath);
        if (!object) {
            return new Response(JSON.stringify({ error: 'File not found' }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            });
        }
        
        // Create new path
        const pathParts = oldPath.split('/');
        pathParts[pathParts.length - 1] = newName;
        const newPath = pathParts.join('/');
        
        // Copy to new location
        await env.FILES.put(newPath, object.body, {
            httpMetadata: object.httpMetadata,
            customMetadata: object.customMetadata,
        });
        
        // Delete old file
        await env.FILES.delete(oldPath);
        
        return new Response(JSON.stringify({ success: true, newPath }), {
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    } catch (error) {
        console.error('Error renaming file:', error);
        return new Response(JSON.stringify({ error: 'Failed to rename file' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    }
}

export async function handleFileManagerDelete(env: Env, paths: string[]): Promise<Response> {
    try {
        const results = [];
        
        for (const path of paths) {
            try {
                // Check if it's a folder by listing objects with this prefix
                const objects = await env.FILES.list({ prefix: path + '/' });
                
                if (objects.objects.length > 0) {
                    // It's a folder, delete all files in it
                    for (const object of objects.objects) {
                        await env.FILES.delete(object.key);
                    }
                }
                
                // Also try to delete the path itself (in case it's a file)
                await env.FILES.delete(path);
                
                results.push({ path, success: true });
            } catch (error) {
                console.error(`Error deleting ${path}:`, error);
                results.push({ 
                    path, 
                    success: false, 
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        
        return new Response(JSON.stringify({ results }), {
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    } catch (error) {
        console.error('Error deleting files:', error);
        return new Response(JSON.stringify({ error: 'Failed to delete files' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    }
}

export async function handleFileManagerMove(env: Env, items: string[], destination: string): Promise<Response> {
    try {
        const results = [];
        
        for (const itemPath of items) {
            try {
                // Get the file
                const object = await env.FILES.get(itemPath);
                if (!object) {
                    results.push({ path: itemPath, success: false, error: 'File not found' });
                    continue;
                }
                
                // Create new path
                const fileName = itemPath.split('/').pop();
                if (!fileName) {
                    results.push({ path: itemPath, success: false, error: 'Invalid file path' });
                    continue;
                }
                const newPath = destination ? `${destination}/${fileName}` : fileName;
                
                // Copy to new location
                await env.FILES.put(newPath, object.body, {
                    httpMetadata: object.httpMetadata,
                    customMetadata: object.customMetadata,
                });
                
                // Delete old file
                await env.FILES.delete(itemPath);
                
                results.push({ path: itemPath, success: true, newPath });
            } catch (error) {
                console.error(`Error moving ${itemPath}:`, error);
                results.push({ 
                    path: itemPath, 
                    success: false, 
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        
        return new Response(JSON.stringify({ results }), {
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    } catch (error) {
        console.error('Error moving files:', error);
        return new Response(JSON.stringify({ error: 'Failed to move files' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    }
}

export async function handleFileManagerCreateFolder(env: Env, path: string): Promise<Response> {
    try {
        // Create an empty file to represent the folder
        // R2 doesn't have actual folders, so we create a placeholder file
        const folderMarker = `${path}/.folder`;
        
        await env.FILES.put(folderMarker, new Uint8Array(0), {
            httpMetadata: {
                contentType: 'application/octet-stream',
            },
        });
        
        return new Response(JSON.stringify({ success: true, path }), {
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    } catch (error) {
        console.error('Error creating folder:', error);
        return new Response(JSON.stringify({ error: 'Failed to create folder' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    }
}