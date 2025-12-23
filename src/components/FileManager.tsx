import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ArrowUpDown,
	Download,
	Folder,
	File as FileIcon,
	Loader2,
	Pencil,
	Plus,
	RefreshCcw,
	Trash2,
	UploadCloud,
	X
} from 'lucide-react';

type EntryType = 'file' | 'folder';

interface FileManagerEntry {
	type: EntryType;
	name: string;
	key: string;
	size: number | null;
	uploaded: string | null;
	contentType: string | null;
}

interface BreadcrumbItem {
	name: string;
	prefix: string;
}

interface ListResponse {
	prefix: string;
	parentPrefix: string | null;
	breadcrumbs: BreadcrumbItem[];
	entries: FileManagerEntry[];
}

type BannerState = { type: 'success' | 'error'; message: string } | null;
type ActionState = { message: string } | null;

const workerBaseUrl = import.meta.env.PUBLIC_WORKER_URL;
const managerEndpoint = `${workerBaseUrl}/file-manager`;

const formatSize = (value: number | null): string => {
	if (!value || value <= 0) {
		return '—';
	}
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let size = value;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex += 1;
	}
	return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
};

const formatUploaded = (value: string | null): string => {
	if (!value) {
		return '—';
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return '—';
	}
	const day = date.toLocaleDateString('ro-RO', {
		day: '2-digit',
		month: 'short'
	});
	const time = date.toLocaleTimeString('ro-RO', {
		hour: '2-digit',
		minute: '2-digit'
	});
	return `${day}, ${time}`;
};

const encodeKeyForUrl = (key: string): string => key.split('/').map(encodeURIComponent).join('/');

const ensureTrailingSlash = (prefix: string): string => {
	if (!prefix) {
		return '';
	}
	return prefix.endsWith('/') ? prefix : `${prefix}/`;
};

const getFolderName = (key: string): string => key.split('/').filter(Boolean).at(-1) ?? '';

const FileManager: React.FC = () => {
	const [entries, setEntries] = useState<FileManagerEntry[]>([]);
	const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ name: 'Drive', prefix: '' }]);
	const [currentPrefix, setCurrentPrefix] = useState<string>('');
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [searchTerm, setSearchTerm] = useState<string>('');
	const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
	const [toast, setToast] = useState<BannerState>(null);
	const [actionState, setActionState] = useState<ActionState>(null);
	const [highlightedFolder, setHighlightedFolder] = useState<string | null>(null);
	const [highlightedBreadcrumb, setHighlightedBreadcrumb] = useState<string | null>(null);
	const [isDropActive, setIsDropActive] = useState<boolean>(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const showBanner = useCallback((state: BannerState) => {
		setToast(state);
		if (state) {
			window.setTimeout(() => setToast(null), 4000);
		}
	}, []);

	const fetchEntries = useCallback(
		async (prefix: string, options?: { showLoadingToast?: boolean; loadingMessage?: string }) => {
			const showLoadingToast = options?.showLoadingToast ?? false;
			const loadingMessage = options?.loadingMessage ?? 'Se încarcă fișierele...';
			if (showLoadingToast) {
				setToast(null);
				setActionState({ message: loadingMessage });
			}
			setIsLoading(true);
			try {
				const url = new URL(managerEndpoint);
				if (prefix) {
					url.searchParams.set('prefix', prefix);
				}
				const response = await fetch(url.toString());
				if (!response.ok) {
					throw new Error(`Nu pot încărca conținutul (status ${response.status})`);
				}
				const data = (await response.json()) as ListResponse;
				setEntries(data.entries);
				setBreadcrumbs(data.breadcrumbs);
				setCurrentPrefix(data.prefix ?? prefix ?? '');
				setSelectedKeys(new Set());
			} catch (error) {
				console.error(error);
				showBanner({ type: 'error', message: 'Nu am reușit să obțin lista de fișiere.' });
			} finally {
				if (showLoadingToast) {
					setActionState(null);
				}
				setIsLoading(false);
			}
		},
		[showBanner]
	);

	useEffect(() => {
			void fetchEntries('', { showLoadingToast: true });
	}, [fetchEntries]);

	const filteredEntries = useMemo(() => {
		if (!searchTerm.trim()) {
			return entries;
		}
		const term = searchTerm.toLowerCase();
		return entries.filter((entry) => entry.name.toLowerCase().includes(term));
	}, [entries, searchTerm]);

	const toggleSelection = useCallback(
		(entry: FileManagerEntry, multi: boolean) => {
			setSelectedKeys((prev) => {
				const next = new Set(prev);
				if (!multi) {
					next.clear();
				}
				if (next.has(entry.key)) {
					next.delete(entry.key);
				} else {
					next.add(entry.key);
				}
				return next;
			});
		},
		[]
	);

	const selectedEntries = useMemo(() => {
		if (!selectedKeys.size) {
			return [] as FileManagerEntry[];
		}
		return entries.filter((entry) => selectedKeys.has(entry.key));
	}, [entries, selectedKeys]);

	const openEntry = useCallback(
		(entry: FileManagerEntry) => {
			if (entry.type === 'folder') {
				fetchEntries(entry.key);
				return;
			}
			const url = `${workerBaseUrl}/files/${encodeKeyForUrl(entry.key)}`;
			window.open(url, '_blank');
		},
		[fetchEntries]
	);

	const handleCreateFolder = useCallback(async () => {
		const name = window.prompt('Numele noului folder');
		if (!name) {
			return;
		}
		try {
			const response = await fetch(managerEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'create-folder', prefix: currentPrefix, name })
			});
			if (!response.ok) {
				throw new Error('Nu pot crea folderul');
			}
			showBanner({ type: 'success', message: `Folderul „${name}” a fost creat.` });
			await fetchEntries(currentPrefix);
		} catch (error) {
			console.error(error);
			showBanner({ type: 'error', message: 'Crearea folderului a eșuat.' });
		}
	}, [currentPrefix, fetchEntries, showBanner]);

	const handleRename = useCallback(async (entry?: FileManagerEntry) => {
		const target = entry ?? selectedEntries[0];
		if (!target) {
			return;
		}
		const proposed = window.prompt('Numele nou', target.name);
		if (!proposed || proposed === target.name) {
			return;
		}
		try {
			const response = await fetch(managerEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'rename', key: target.key, newName: proposed, type: target.type })
			});
			if (!response.ok) {
				throw new Error('Nu pot redenumi elementul');
			}
			showBanner({ type: 'success', message: `„${target.name}” a devenit „${proposed}”.` });
			await fetchEntries(currentPrefix);
		} catch (error) {
			console.error(error);
			showBanner({ type: 'error', message: 'Redenumirea a eșuat.' });
		}
	}, [currentPrefix, fetchEntries, selectedEntries, showBanner]);

const handleDelete = useCallback(async (entry?: FileManagerEntry) => {
	const targets = entry
		? [entry]
		: selectedEntries;
	if (!targets.length) {
		return;
	}
	const confirmation = window.confirm(
		targets.length === 1
			? `Sigur vrei să ștergi „${targets[0].name}”?`
			: 'Sigur vrei să ștergi elementele selectate?'
	);
		if (!confirmation) {
			return;
		}
		try {
			const response = await fetch(managerEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete',
				items: targets.map((item) => ({ key: item.key, type: item.type }))
				})
			});
			if (!response.ok) {
				throw new Error('Nu pot șterge elementele');
			}
		showBanner({
			type: 'success',
			message: targets.length === 1 ? 'Elementul a fost șters.' : 'Elementele au fost șterse.'
		});
			await fetchEntries(currentPrefix);
		} catch (error) {
			console.error(error);
			showBanner({ type: 'error', message: 'Ștergerea a eșuat.' });
		}
	}, [currentPrefix, fetchEntries, selectedEntries, showBanner]);

const handleDownload = useCallback((entry?: FileManagerEntry) => {
	const files = entry ? (entry.type === 'file' ? [entry] : []) : selectedEntries.filter((item) => item.type === 'file');
	files.forEach((file) => {
			const url = `${workerBaseUrl}/files/${encodeKeyForUrl(file.key)}`;
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = file.name;
			anchor.rel = 'noopener';
			anchor.click();
		});
	}, [selectedEntries]);

	const refresh = useCallback(() => {
		fetchEntries(currentPrefix);
	}, [currentPrefix, fetchEntries]);

	const uploadFiles = useCallback(
		async (files: FileList | File[] | null, targetPrefix: string) => {
			if (!files || (files instanceof FileList && files.length === 0)) {
				return;
			}
			const workingSet = files instanceof FileList ? Array.from(files) : files;
			if (!workingSet.length) {
				return;
			}
			const formData = new FormData();
			formData.append('prefix', targetPrefix);
			workingSet.forEach((file) => formData.append('files', file));
			try {
				const response = await fetch(managerEndpoint, {
					method: 'POST',
					body: formData
				});
				if (!response.ok) {
					throw new Error('Nu pot încărca fișierele');
				}
				showBanner({ type: 'success', message: `${workingSet.length} fișier(e) încărcate.` });
				await fetchEntries(currentPrefix);
			} catch (error) {
				console.error(error);
				showBanner({ type: 'error', message: 'Încărcarea a eșuat.' });
			}
		},
		[currentPrefix, fetchEntries, showBanner]
	);

	const handleFileInput = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			uploadFiles(event.target.files, currentPrefix);
			event.target.value = '';
		},
		[currentPrefix, uploadFiles]
	);

	const performMove = useCallback(
		async (items: Array<{ key: string; type: EntryType }>, destination: string) => {
			if (!items.length) {
				return;
			}
			const destinationBase = ensureTrailingSlash(destination);
			let selfMoveAttempt = false;
			const movableItems = items.filter((item) => {
				if (item.type === 'folder') {
					const sourcePrefix = ensureTrailingSlash(item.key);
					const folderName = getFolderName(item.key);
					if (!folderName) {
						return false;
					}
					const destPrefix = destinationBase + ensureTrailingSlash(folderName);
					if (destPrefix === sourcePrefix) {
						return false;
					}
					if (destPrefix.startsWith(sourcePrefix)) {
						selfMoveAttempt = true;
						return false;
					}
					return true;
				}
				const fileName = item.key.split('/').pop() || item.key;
				const targetKey = `${destinationBase}${fileName}`;
				return targetKey !== item.key;
			});

			if (!movableItems.length) {
				if (selfMoveAttempt) {
					showBanner({ type: 'error', message: 'Nu poți muta un folder în interiorul său.' });
				}
				return;
			}
			try {
				setToast(null);
				setActionState({ message: 'Mut elementele selectate...' });
				const response = await fetch(managerEndpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'move', destination, items: movableItems })
				});
				if (!response.ok) {
					throw new Error('Nu pot muta elementele');
				}
				setActionState(null);
				showBanner({ type: 'success', message: 'Elementele au fost mutate.' });
				await fetchEntries(currentPrefix);
			} catch (error) {
				console.error(error);
				setActionState(null);
				showBanner({ type: 'error', message: 'Mutarea a eșuat.' });
			} finally {
				setActionState(null);
			}
		},
		[currentPrefix, fetchEntries, showBanner]
	);

	const collectDraggedItems = useCallback(
		(anchor: FileManagerEntry): Array<{ key: string; type: EntryType }> => {
			if (selectedKeys.has(anchor.key)) {
				return entries
					.filter((entry) => selectedKeys.has(entry.key))
					.map((entry) => ({ key: entry.key, type: entry.type }));
			}
			return [{ key: anchor.key, type: anchor.type }];
		},
		[entries, selectedKeys]
	);

	const handleDragStart = useCallback(
		(event: React.DragEvent<HTMLDivElement>, entry: FileManagerEntry) => {
			const items = collectDraggedItems(entry);
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('application/x-filemanager-items', JSON.stringify(items));
		},
		[collectDraggedItems]
	);

	const handleRowDrop = useCallback(
		async (event: React.DragEvent<HTMLDivElement>, target: FileManagerEntry) => {
			event.preventDefault();
			setHighlightedFolder(null);
			setIsDropActive(false);
			setHighlightedBreadcrumb(null);
			const raw = event.dataTransfer.getData('application/x-filemanager-items');
			if (raw) {
				try {
					const items = JSON.parse(raw) as Array<{ key: string; type: EntryType }>;
					await performMove(items, target.key);
				} catch (error) {
					console.error(error);
					showBanner({ type: 'error', message: 'Nu pot muta elementele.' });
				}
				return;
			}
			if (event.dataTransfer.files?.length) {
				uploadFiles(event.dataTransfer.files, target.key);
			}
		},
		[performMove, showBanner, uploadFiles]
	);

	const handleBackgroundDrop = useCallback(
		async (event: React.DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			setIsDropActive(false);
			setHighlightedFolder(null);
			setHighlightedBreadcrumb(null);
			const raw = event.dataTransfer.getData('application/x-filemanager-items');
			if (raw) {
				try {
					const items = JSON.parse(raw) as Array<{ key: string; type: EntryType }>;
					await performMove(items, currentPrefix);
				} catch (error) {
					console.error(error);
					showBanner({ type: 'error', message: 'Nu pot muta elementele.' });
				}
				return;
			}
			const files = event.dataTransfer.files;
			if (files?.length) {
				uploadFiles(files, currentPrefix);
			}
		},
		[currentPrefix, performMove, showBanner, uploadFiles]
	);

	return (
		<>
			<div className="drive-shell">
			<input ref={fileInputRef} type="file" multiple hidden onChange={handleFileInput} />
			<div className="drive-header">
				<div className="drive-header-left">
					<div className="drive-title">Contul meu Drive</div>
					<div className="drive-breadcrumbs">
						{breadcrumbs.map((crumb, index) => {
							const crumbPrefix = crumb.prefix ?? '';
							const isActiveDrop = highlightedBreadcrumb === crumbPrefix;
							return (
								<button
									key={crumb.prefix + index}
									className={`drive-breadcrumb ${isActiveDrop ? 'drive-breadcrumb-drop' : ''}`}
									onClick={() => fetchEntries(crumb.prefix)}
									onDragOver={(event) => {
										if (event.dataTransfer.types.includes('application/x-filemanager-items') || event.dataTransfer.types.includes('Files')) {
											event.preventDefault();
											event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/x-filemanager-items') ? 'move' : 'copy';
											setHighlightedBreadcrumb(crumbPrefix);
										}
									}}
									onDragLeave={() => {
										setHighlightedBreadcrumb((current) => (current === crumbPrefix ? null : current));
									}}
									onDrop={(event) => {
										event.preventDefault();
										setHighlightedBreadcrumb(null);
										setIsDropActive(false);
										setHighlightedFolder(null);
										const raw = event.dataTransfer.getData('application/x-filemanager-items');
										if (raw) {
											try {
												const items = JSON.parse(raw) as Array<{ key: string; type: EntryType }>;
												void performMove(items, crumbPrefix);
											} catch (error) {
												console.error(error);
												showBanner({ type: 'error', message: 'Nu pot muta elementele.' });
											}
											return;
										}
										const files = event.dataTransfer.files;
										if (files?.length) {
											uploadFiles(files, crumbPrefix);
										}
									}}
								>
									{crumb.name}
									{index < breadcrumbs.length - 1 ? <span className="drive-breadcrumb-separator">›</span> : null}
								</button>
							);
						})}
					</div>
				</div>
				<div className="drive-header-right">
					<div className="drive-search">
						<input
							value={searchTerm}
							placeholder="Caută în Drive"
							onChange={(event) => setSearchTerm(event.target.value)}
						/>
					</div>
					<div className="drive-main-actions">
						<button className="drive-action" onClick={handleCreateFolder}>
							<Plus size={16} />
							Nou
						</button>
						<button className="drive-action" onClick={() => fileInputRef.current?.click()}>
							<UploadCloud size={16} />
							Încarcă
						</button>
						<button className="drive-icon-button" onClick={refresh} title="Reîncarcă">
							<RefreshCcw size={16} />
						</button>
					</div>
				</div>
			</div>

			<div
				className={`drive-content ${isDropActive ? 'drive-content-drop' : ''}`}
				onDragOver={(event) => {
					if (event.dataTransfer.types.includes('application/x-filemanager-items') || event.dataTransfer.types.includes('Files')) {
						event.preventDefault();
						event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/x-filemanager-items') ? 'move' : 'copy';
						setIsDropActive(true);
					}
				}}
				onDragLeave={(event) => {
					if (event.currentTarget === event.target) {
						setIsDropActive(false);
						setHighlightedFolder(null);
						setHighlightedBreadcrumb(null);
					}
				}}
				onDrop={handleBackgroundDrop}
			>
				<div className="drive-table-header">
					<div className="drive-col-name">
						<ArrowUpDown size={16} />
						Nume
					</div>
					<div className="drive-col-owner">Proprietar</div>
					<div className="drive-col-modified">Data modificării</div>
					<div className="drive-col-size">Dimensiune</div>
				</div>

				<div className={`drive-table-body ${isLoading ? 'drive-loading' : ''}`}>
					{isLoading && <div className="drive-spinner">Se încarcă...</div>}
					{!isLoading && filteredEntries.length === 0 && (
						<div className="drive-empty">Nu există elemente în acest director.</div>
					)}
					{!isLoading &&
						filteredEntries.map((entry) => {
							const isSelected = selectedKeys.has(entry.key);
							const isFolder = entry.type === 'folder';
							const isHighlight = highlightedFolder === entry.key;
							return (
								<div
									key={entry.key}
									className={`drive-row ${isSelected ? 'drive-row-selected' : ''} ${isFolder ? 'drive-row-folder' : ''} ${isHighlight ? 'drive-row-highlight' : ''}`}
									draggable
									onDragStart={(event) => handleDragStart(event, entry)}
									onDragOver={isFolder ? (event) => {
										if (event.dataTransfer.types.includes('application/x-filemanager-items') || event.dataTransfer.types.includes('Files')) {
											event.preventDefault();
											event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/x-filemanager-items') ? 'move' : 'copy';
											setHighlightedFolder(entry.key);
										}
									} : undefined}
									onDragLeave={isFolder ? () => setHighlightedFolder(null) : undefined}
									onDrop={isFolder ? (event) => handleRowDrop(event, entry) : undefined}
									onClick={(event) => toggleSelection(entry, event.metaKey || event.ctrlKey)}
									onDoubleClick={() => openEntry(entry)}
								>
									<div className="drive-cell-name">
										<span className="drive-icon-wrapper">
											{isFolder ? <Folder size={18} /> : <FileIcon size={18} />}
										</span>
										<span className="drive-name">{entry.name}</span>
									</div>
									<div className="drive-cell-owner">eu</div>
									<div className="drive-cell-modified">{formatUploaded(entry.uploaded)}</div>
									<div className="drive-cell-size">
										<span className="drive-size-label">{formatSize(entry.size)}</span>
										<span className="drive-row-actions">
											{entry.type === 'file' && (
												<button
													className="drive-row-action-button"
													title="Descarcă"
													onClick={(event) => {
														event.stopPropagation();
														handleDownload(entry);
													}}
												>
													<Download size={16} />
												</button>
											)}
											<button
												className="drive-row-action-button"
												title="Redenumește"
												onClick={(event) => {
													event.stopPropagation();
													void handleRename(entry);
												}}
											>
												<Pencil size={16} />
											</button>
											<button
												className="drive-row-action-button"
												title="Șterge"
												onClick={(event) => {
													event.stopPropagation();
													void handleDelete(entry);
												}}
											>
												<Trash2 size={16} />
											</button>
										</span>
									</div>
								</div>
							);
						})}
				</div>
			</div>
			</div>
			{(actionState || toast) && (
				<div className="drive-toast-container">
					{actionState && (
						<div className="drive-toast drive-toast-loading">
							<span className="drive-toast-icon">
								<Loader2 size={16} />
							</span>
							<span>{actionState.message}</span>
						</div>
					)}
					{toast && (
						<div className={`drive-toast drive-toast-${toast.type}`}>
							<span>{toast.message}</span>
							<button className="drive-toast-dismiss" onClick={() => setToast(null)}>
								<X size={16} />
							</button>
						</div>
					)}
				</div>
			)}
		</>
	);
};

export default FileManager;
