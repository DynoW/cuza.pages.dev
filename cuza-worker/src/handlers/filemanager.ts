import { corsHeaders } from './common';

interface FileManagerEnv {
	FILES: R2Bucket;
}

interface ListResponse {
	prefix: string;
	parentPrefix: string | null;
	breadcrumbs: Array<{ name: string; prefix: string }>;
	entries: FileManagerEntry[];
}

interface FileManagerEntry {
	type: 'file' | 'folder';
	name: string;
	key: string;
	size: number | null;
	uploaded: string | null;
	contentType: string | null;
}

interface MoveItem {
	key: string;
	type: 'file' | 'folder';
}

function parseItems(value: unknown): MoveItem[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.map((candidate) => {
			if (!candidate || typeof candidate !== 'object') {
				return null;
			}
			const record = candidate as Record<string, unknown>;
			const key = typeof record.key === 'string' ? record.key : null;
			if (!key) {
				return null;
			}
			const type = record.type === 'folder' ? 'folder' : 'file';
			return { key, type };
		})
		.filter((entry): entry is MoveItem => entry !== null);
}

function ensureTrailingSlash(prefix: string): string {
	if (!prefix) {
		return '';
	}
	return prefix.endsWith('/') ? prefix : `${prefix}/`;
}

function buildBreadcrumbs(prefix: string): Array<{ name: string; prefix: string }> {
	const trail = [{ name: 'Drive', prefix: '' }];
	if (!prefix) {
		return trail;
	}

	const parts = prefix.split('/').filter(Boolean);
	let current = '';
	for (const part of parts) {
		current = ensureTrailingSlash(`${current}${part}`);
		trail.push({ name: part, prefix: current });
	}
	return trail;
}

async function listDirectory(env: FileManagerEnv, prefix: string): Promise<ListResponse> {
	const normalizedPrefix = ensureTrailingSlash(prefix);

	const { objects, delimitedPrefixes } = await env.FILES.list({
		prefix: normalizedPrefix,
		delimiter: '/',
		limit: 1000
	});

	const folderEntries: FileManagerEntry[] = delimitedPrefixes
		.map((folderPrefix) => {
			const name = folderPrefix.slice(normalizedPrefix.length).replace(/\/$/, '');
			return {
				type: 'folder' as const,
				name,
				key: ensureTrailingSlash(folderPrefix),
				size: null,
				uploaded: null,
				contentType: null
			};
		})
		.filter((entry) => entry.name.length > 0);

	const fileEntries: FileManagerEntry[] = objects
		.filter((object) => object.key !== normalizedPrefix && !object.key.endsWith('/'))
		.map((object) => ({
			type: 'file' as const,
			name: object.key.slice(normalizedPrefix.length),
			key: object.key,
			size: object.size,
			uploaded: object.uploaded ? object.uploaded.toISOString() : null,
			contentType: object.httpMetadata?.contentType || null
		}));

	const entries = [...folderEntries, ...fileEntries].sort((a, b) => {
		if (a.type === b.type) {
			return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
		}
		return a.type === 'folder' ? -1 : 1;
	});

	const breadcrumbs = buildBreadcrumbs(prefix);
	const parentPrefix = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].prefix : null;

	return {
		prefix: normalizedPrefix,
		parentPrefix,
		breadcrumbs,
		entries
	};
}

async function createFolder(env: FileManagerEnv, prefix: string, name: string): Promise<void> {
	const folderName = name.trim();
	if (!folderName) {
		throw new Error('Folder name cannot be empty');
	}
	const parentPrefix = ensureTrailingSlash(prefix);
	const folderKey = ensureTrailingSlash(`${parentPrefix}${folderName}`);

	// Store a zero-length object as folder placeholder
	await env.FILES.put(folderKey, new ArrayBuffer(0), {
		httpMetadata: {
			contentType: 'application/x-directory'
		}
	});
}

async function deleteFolder(env: FileManagerEnv, folderKey: string): Promise<void> {
	const normalized = ensureTrailingSlash(folderKey);
	let cursor: string | undefined = undefined;
	do {
		const listed = await env.FILES.list({
			prefix: normalized,
			limit: 1000,
			cursor
		});
		const { objects, truncated } = listed;
		if (objects.length) {
			await env.FILES.delete(objects.map((obj) => obj.key));
		}
		cursor = truncated ? (listed as unknown as { cursor?: string }).cursor : undefined;
	} while (cursor);
	// Remove folder placeholder if it exists
	await env.FILES.delete(normalized);
}

async function moveFolder(env: FileManagerEnv, sourcePrefix: string, destinationPrefix: string): Promise<void> {
	const source = ensureTrailingSlash(sourcePrefix);
	const destination = ensureTrailingSlash(destinationPrefix);
	if (destination.startsWith(source)) {
		throw new Error('Cannot move a folder inside itself');
	}

	let cursor: string | undefined = undefined;
	do {
		const listed = await env.FILES.list({
			prefix: source,
			limit: 1000,
			cursor
		});
		const { objects, truncated } = listed;

		for (const object of objects) {
			const relativePath = object.key.slice(source.length);
			const targetKey = `${destination}${relativePath}`;
			await copyObject(env, object.key, targetKey);
		}

		if (objects.length) {
			await env.FILES.delete(objects.map((obj) => obj.key));
		}
		cursor = truncated ? (listed as unknown as { cursor?: string }).cursor : undefined;
	} while (cursor);

	// Remove the original folder placeholder if present
	await env.FILES.delete(source);
}

async function copyObject(env: FileManagerEnv, sourceKey: string, targetKey: string): Promise<void> {
	if (sourceKey === targetKey) {
		return;
	}
	const sourceObject = await env.FILES.get(sourceKey);
	if (!sourceObject) {
		throw new Error(`Source not found: ${sourceKey}`);
	}
	const body = sourceObject.body;
	if (!body) {
		throw new Error('Source body is empty');
	}
	await env.FILES.put(targetKey, body, {
		httpMetadata: sourceObject.httpMetadata || undefined,
		customMetadata: sourceObject.customMetadata || undefined
	});
}

async function moveFile(env: FileManagerEnv, key: string, destinationPrefix: string): Promise<void> {
	const destination = ensureTrailingSlash(destinationPrefix);
	const fileName = key.split('/').pop() || key;
	const targetKey = `${destination}${fileName}`;
	if (targetKey === key) {
		return;
	}
	await copyObject(env, key, targetKey);
	await env.FILES.delete(key);
}

async function renameFile(env: FileManagerEnv, key: string, newName: string): Promise<void> {
	const trimmed = newName.trim();
	if (!trimmed) {
		throw new Error('New name cannot be empty');
	}
	const segments = key.split('/');
	segments[segments.length - 1] = trimmed;
	const targetKey = segments.join('/');
	if (targetKey === key) {
		return;
	}
	await copyObject(env, key, targetKey);
	await env.FILES.delete(key);
}

async function renameFolder(env: FileManagerEnv, folderKey: string, newName: string): Promise<void> {
	const trimmed = newName.trim();
	if (!trimmed) {
		throw new Error('New name cannot be empty');
	}
	const source = ensureTrailingSlash(folderKey);
	const parts = source.split('/').filter(Boolean);
	parts[parts.length - 1] = trimmed;
	const destination = ensureTrailingSlash(parts.join('/'));
	if (destination === source) {
		return;
	}
	await moveFolder(env, source, destination);
}

export async function handleFileManager(request: Request, env: FileManagerEnv): Promise<Response> {
	try {
		if (request.method === 'GET') {
			const url = new URL(request.url);
			const prefix = url.searchParams.get('prefix') || '';
			console.log('Listing directory:', prefix);
			const result = await listDirectory(env, prefix);
			return new Response(JSON.stringify(result), {
				status: 200,
				headers: {
					...corsHeaders,
					'Content-Type': 'application/json'
				}
			});
		}

		if (request.method === 'POST') {
			const contentType = request.headers.get('content-type') || '';
			if (contentType.includes('multipart/form-data')) {
				const formData = await request.formData();
				const prefix = formData.get('prefix')?.toString() || '';
				const normalizedPrefix = ensureTrailingSlash(prefix);
				const files = formData.getAll('files');
				if (!files.length) {
					throw new Error('No files provided');
				}

				for (const entry of files) {
					if (!(entry instanceof File)) {
						continue;
					}
					const targetKey = `${normalizedPrefix}${entry.name}`;
					await env.FILES.put(targetKey, entry.stream(), {
						httpMetadata: {
							contentType: entry.type || 'application/octet-stream',
							contentDisposition: `inline; filename="${entry.name}"`
						}
					});
				}

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json'
					}
				});
			}

			const payload = (await request.json()) as Record<string, unknown>;
			const actionValue = payload['action'];
			const action = typeof actionValue === 'string' ? actionValue : undefined;

			switch (action) {
				case 'create-folder': {
					await createFolder(
						env,
						typeof payload['prefix'] === 'string' ? payload['prefix'] : '',
						typeof payload['name'] === 'string' ? payload['name'] : ''
					);
					break;
				}
				case 'rename': {
					const key = typeof payload['key'] === 'string' ? payload['key'] : '';
					const newName = typeof payload['newName'] === 'string' ? payload['newName'] : '';
					const type = payload['type'] === 'folder' ? 'folder' : 'file';
					if (!key) {
						throw new Error('Missing key for rename');
					}
					if (type === 'folder') {
						await renameFolder(env, key, newName);
					} else {
						await renameFile(env, key, newName);
					}
					break;
				}
				case 'move': {
					const destination = typeof payload['destination'] === 'string' ? payload['destination'] : '';
					const items = parseItems(payload['items']);
					for (const item of items) {
						const destinationBase = ensureTrailingSlash(destination);
						if (item.type === 'folder') {
							const name = item.key.split('/').filter(Boolean).at(-1) || '';
							const sourcePrefix = ensureTrailingSlash(item.key);
							const destPrefix = destinationBase + ensureTrailingSlash(name);
							if (destPrefix === sourcePrefix) {
								continue;
							}
							if (destPrefix.startsWith(sourcePrefix)) {
								throw new Error('Nu poți muta un folder în interiorul său.');
							}
							await moveFolder(env, item.key, destPrefix);
						} else {
							const fileName = item.key.split('/').pop() || item.key;
							const targetKey = `${destinationBase}${fileName}`;
							if (targetKey === item.key) {
								continue;
							}
							await moveFile(env, item.key, destinationBase);
						}
					}
					break;
				}
				case 'delete': {
					const keys = parseItems(payload['items']);
					for (const item of keys) {
						if (item.type === 'folder') {
							await deleteFolder(env, item.key);
						} else {
							await env.FILES.delete(item.key);
						}
					}
					break;
				}
				default:
					throw new Error('Unsupported action');
			}

			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: {
					...corsHeaders,
					'Content-Type': 'application/json'
				}
			});
		}

		return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
	} catch (error) {
		console.error('File manager error:', error);
		const message = error instanceof Error ? error.message : 'Unexpected error';
		return new Response(JSON.stringify({ success: false, error: message }), {
			status: 500,
			headers: {
				...corsHeaders,
				'Content-Type': 'application/json'
			}
		});
	}
}

