import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  File,
  Upload,
  Download,
  Edit2,
  Trash2,
  Move,
  X,
  Check,
  ChevronRight,
  Home,
  RotateCcw,
  MoreVertical,
  Search,
  Plus,
  FolderPlus,
} from 'lucide-react';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  lastModified?: string;
}

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface FileManagerProps {
  workerUrl?: string;
}

const FileManager: React.FC<FileManagerProps> = ({ 
  workerUrl = 'http://localhost:8787' 
}) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: ContextMenuPosition;
    item?: FileItem;
  }>({ visible: false, position: { x: 0, y: 0 } });
  
  // Modal states
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  
  // Operation states
  const [renameItem, setRenameItem] = useState<FileItem | null>(null);
  const [deleteItems, setDeleteItems] = useState<FileItem[]>([]);
  const [moveItems, setMoveItems] = useState<FileItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [moveDestination, setMoveDestination] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // File upload
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only set dragging to false if we're leaving the entire file manager
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setUploadFiles(files);
      setShowUploadModal(true);
    }
  };

  // Load files for current path
  const loadFiles = async (path: string = currentPath) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${workerUrl}/files/list?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        throw new Error(`Failed to load files: ${response.statusText}`);
      }
      
      const data = await response.json();
      setFiles(data.files || []);
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  // Navigate to folder
  const navigateToFolder = (folderPath: string) => {
    loadFiles(folderPath);
    setSelectedFiles(new Set());
  };

  // Navigate up one level
  const navigateUp = () => {
    if (currentPath) {
      const parentPath = currentPath.split('/').slice(0, -1).join('/');
      navigateToFolder(parentPath);
    }
  };

  // Get breadcrumb items
  const getBreadcrumbs = () => {
    if (!currentPath) return [{ name: 'Root', path: '' }];
    
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Root', path: '' }];
    
    let currentPathBuilder = '';
    for (const part of parts) {
      currentPathBuilder += (currentPathBuilder ? '/' : '') + part;
      breadcrumbs.push({ name: part, path: currentPathBuilder });
    }
    
    return breadcrumbs;
  };

  // Handle file selection
  const toggleFileSelection = (filePath: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(filePath)) {
      newSelection.delete(filePath);
    } else {
      newSelection.add(filePath);
    }
    setSelectedFiles(newSelection);
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, item?: FileItem) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
      item,
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu({ visible: false, position: { x: 0, y: 0 } });
  };

  // File operations
  const handleRename = (item: FileItem) => {
    setRenameItem(item);
    setNewName(item.name);
    setShowRenameModal(true);
    closeContextMenu();
  };

  const handleDelete = (items: FileItem[]) => {
    setDeleteItems(items);
    setShowDeleteModal(true);
    closeContextMenu();
  };

  const handleMove = (items: FileItem[]) => {
    setMoveItems(items);
    setMoveDestination(currentPath);
    setShowMoveModal(true);
    closeContextMenu();
  };

  const handleDownload = (item: FileItem) => {
    if (item.type === 'file') {
      const link = document.createElement('a');
      link.href = `${workerUrl}/${item.path}`;
      link.download = item.name;
      link.click();
    }
    closeContextMenu();
  };

  // Perform rename operation
  const performRename = async () => {
    if (!renameItem || !newName.trim()) return;
    
    try {
      const response = await fetch(`${workerUrl}/files/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPath: renameItem.path,
          newName: newName.trim(),
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Rename failed: ${response.statusText}`);
      }
      
      await loadFiles();
      setShowRenameModal(false);
      setRenameItem(null);
      setNewName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  // Perform delete operation
  const performDelete = async () => {
    if (deleteItems.length === 0) return;
    
    try {
      const response = await fetch(`${workerUrl}/files/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paths: deleteItems.map(item => item.path),
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }
      
      await loadFiles();
      setShowDeleteModal(false);
      setDeleteItems([]);
      setSelectedFiles(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Perform move operation
  const performMove = async () => {
    if (moveItems.length === 0 || !moveDestination) return;
    
    try {
      const response = await fetch(`${workerUrl}/files/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: moveItems.map(item => item.path),
          destination: moveDestination,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Move failed: ${response.statusText}`);
      }
      
      await loadFiles();
      setShowMoveModal(false);
      setMoveItems([]);
      setSelectedFiles(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move failed');
    }
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!uploadFiles) return;
    
    try {
      const files = Array.from(uploadFiles);
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', `${currentPath ? currentPath + '/' : ''}${file.name}`);
        
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        
        const response = await fetch(`${workerUrl}/upload`, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name}: ${response.statusText}`);
        }
        
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
      }
      
      await loadFiles();
      setShowUploadModal(false);
      setUploadFiles(null);
      setUploadProgress({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  // Create new folder
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const response = await fetch(`${workerUrl}/files/create-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `${currentPath ? currentPath + '/' : ''}${newFolderName.trim()}`,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Create folder failed: ${response.statusText}`);
      }
      
      await loadFiles();
      setShowCreateFolderModal(false);
      setNewFolderName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create folder failed');
    }
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Filter files based on search query
  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle click outside context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        closeContextMenu();
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu.visible]);

  // Load files on mount
  useEffect(() => {
    loadFiles('');
  }, []);

  const getSelectedItems = () => {
    return files.filter(file => selectedFiles.has(file.path));
  };

  return (
    <div 
      className={`file-manager ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="file-manager-header">
        <div className="file-manager-toolbar">
          <button onClick={() => navigateToFolder('')} className="toolbar-btn" title="Home">
            <Home />
          </button>
          <button onClick={() => loadFiles()} className="toolbar-btn" title="Refresh">
            <RotateCcw className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowUploadModal(true)} className="toolbar-btn" title="Upload Files">
            <Upload />
          </button>
          <button onClick={() => setShowCreateFolderModal(true)} className="toolbar-btn" title="Create Folder">
            <FolderPlus />
          </button>
          
          {selectedFiles.size > 0 && (
            <>
              <div className="toolbar-separator" />
              <button
                onClick={() => handleDelete(getSelectedItems())}
                className="toolbar-btn text-red-400 hover:text-red-300"
                title="Delete Selected"
              >
                <Trash2 />
              </button>
              <button
                onClick={() => handleMove(getSelectedItems())}
                className="toolbar-btn"
                title="Move Selected"
              >
                <Move />
              </button>
            </>
          )}
        </div>
        
        <div className="search-box">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="breadcrumbs">
        {getBreadcrumbs().map((crumb, index) => (
          <React.Fragment key={crumb.path}>
            {index > 0 && <ChevronRight className="breadcrumb-separator" />}
            <button
              onClick={() => navigateToFolder(crumb.path)}
              className={`breadcrumb ${index === getBreadcrumbs().length - 1 ? 'active' : ''}`}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-close">
            <X />
          </button>
        </div>
      )}

      {/* File list */}
      <div className="file-list">
        {loading ? (
          <div className="loading">Loading files...</div>
        ) : filteredFiles.length === 0 ? (
          <div className="empty-state">
            {searchQuery ? 'No files match your search' : 'This folder is empty'}
          </div>
        ) : (
          filteredFiles.map((file) => (
            <div
              key={file.path}
              className={`file-item ${selectedFiles.has(file.path) ? 'selected' : ''}`}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  toggleFileSelection(file.path);
                } else if (file.type === 'folder') {
                  navigateToFolder(file.path);
                } else {
                  setSelectedFiles(new Set([file.path]));
                }
              }}
              onContextMenu={(e) => handleContextMenu(e, file)}
            >
              <div className="file-icon">
                {file.type === 'folder' ? <Folder /> : <File />}
              </div>
              <div className="file-info">
                <div className="file-name">{file.name}</div>
                <div className="file-meta">
                  {file.type === 'file' && (
                    <>
                      <span>{formatFileSize(file.size)}</span>
                      {file.lastModified && (
                        <span>{new Date(file.lastModified).toLocaleDateString()}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <button
                className="file-actions"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e, file);
                }}
              >
                <MoreVertical />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            left: contextMenu.position.x,
            top: contextMenu.position.y,
          }}
        >
          {contextMenu.item && (
            <>
              <button
                onClick={() => handleRename(contextMenu.item!)}
                className="context-menu-item"
              >
                <Edit2 /> Rename
              </button>
              {contextMenu.item.type === 'file' && (
                <button
                  onClick={() => handleDownload(contextMenu.item!)}
                  className="context-menu-item"
                >
                  <Download /> Download
                </button>
              )}
              <button
                onClick={() => handleMove([contextMenu.item!])}
                className="context-menu-item"
              >
                <Move /> Move
              </button>
              <div className="context-menu-separator" />
              <button
                onClick={() => handleDelete([contextMenu.item!])}
                className="context-menu-item text-red-400 hover:text-red-300"
              >
                <Trash2 /> Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          setUploadFiles(e.target.files);
          setShowUploadModal(true);
        }}
      />

      {/* Modals */}
      {/* Rename Modal */}
      {showRenameModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Rename {renameItem?.type}</h3>
              <button onClick={() => setShowRenameModal(false)} className="modal-close">
                <X />
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="modal-input"
                placeholder="Enter new name"
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowRenameModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={performRename} className="btn btn-primary">
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Delete {deleteItems.length === 1 ? deleteItems[0].type : `${deleteItems.length} items`}</h3>
              <button onClick={() => setShowDeleteModal(false)} className="modal-close">
                <X />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete{' '}
                {deleteItems.length === 1 ? (
                  <strong>{deleteItems[0].name}</strong>
                ) : (
                  <strong>{deleteItems.length} items</strong>
                )}
                ? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={performDelete} className="btn btn-danger">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {showMoveModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Move {moveItems.length === 1 ? moveItems[0].type : `${moveItems.length} items`}</h3>
              <button onClick={() => setShowMoveModal(false)} className="modal-close">
                <X />
              </button>
            </div>
            <div className="modal-body">
              <p className="mb-4">
                Moving {moveItems.length === 1 ? (
                  <strong>{moveItems[0].name}</strong>
                ) : (
                  <strong>{moveItems.length} items</strong>
                )}
              </p>
              <input
                type="text"
                value={moveDestination}
                onChange={(e) => setMoveDestination(e.target.value)}
                className="modal-input"
                placeholder="Enter destination path (leave empty for root)"
              />
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowMoveModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={performMove} className="btn btn-primary">
                Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Upload Files</h3>
              <button onClick={() => setShowUploadModal(false)} className="modal-close">
                <X />
              </button>
            </div>
            <div className="modal-body">
              {!uploadFiles ? (
                <div
                  className="upload-zone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="upload-icon" />
                  <p>Click to select files or drag and drop</p>
                </div>
              ) : (
                <div className="upload-files">
                  {Array.from(uploadFiles).map((file) => (
                    <div key={file.name} className="upload-file">
                      <span>{file.name}</span>
                      <span>{formatFileSize(file.size)}</span>
                      {uploadProgress[file.name] !== undefined && (
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${uploadProgress[file.name]}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowUploadModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              {uploadFiles && (
                <button onClick={handleFileUpload} className="btn btn-primary">
                  Upload
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create Folder</h3>
              <button onClick={() => setShowCreateFolderModal(false)} className="modal-close">
                <X />
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="modal-input"
                placeholder="Enter folder name"
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateFolderModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={createFolder} className="btn btn-primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;