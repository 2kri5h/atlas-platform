import React, { useState, useEffect, useRef } from 'react'
import {
  Folder,
  FolderPlus,
  FolderUp,
  RefreshCw,
  MoreVertical,
  ExternalLink,
  Calendar,
  Edit2,
  Trash2,
  FolderInput,
  FileText,
  FileSpreadsheet,
  Film,
  Music,
  HardDrive,
  ChevronRight,
  AlertCircle,
  X,
  File,
  Upload,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react'
import {
  googleDriveAPI,
  googleIntegrationsAPI,
  DriveFolderContent,
  DriveItem,
} from '../../utils/api'

interface DriveNavigatorProps {
  onOpenTaskModal: (fileData: { title: string; url?: string; course_code?: string; file_id?: string }) => void
  onConnectGoogle: () => void
  onToast: (message: string) => void
}

export interface UploadFileCandidate {
  file: File
  relativePath: string
}

interface UploadingFileItem {
  id: string
  name: string
  relativePath?: string
  size: number
  progress: number
  status: 'uploading' | 'completed' | 'error'
  error?: string
}

export const DriveNavigator: React.FC<DriveNavigatorProps> = ({
  onOpenTaskModal,
  onConnectGoogle,
  onToast,
}) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined)
  const [content, setContent] = useState<DriveFolderContent | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Uploads state
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadQueue, setUploadQueue] = useState<UploadingFileItem[]>([])
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false)
  const [isUploadDrawerMinimized, setIsUploadDrawerMinimized] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const dragCounter = useRef(0)

  // Modals state
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const [itemToRename, setItemToRename] = useState<DriveItem | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [itemToMove, setItemToMove] = useState<DriveItem | null>(null)
  const [destinationFolderId, setDestinationFolderId] = useState('')

  const [actionLoading, setActionLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    checkGoogleStatus()
  }, [])

  useEffect(() => {
    if (isConnected) {
      fetchFolder(currentFolderId)
    }
  }, [isConnected, currentFolderId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const checkGoogleStatus = async () => {
    try {
      const status = await googleIntegrationsAPI.getStatus()
      setIsConnected(status.is_connected)
      setUserEmail(status.email || null)
      if (!status.is_connected) {
        setLoading(false)
      }
    } catch (err) {
      console.error('Failed to check Google status', err)
      setIsConnected(false)
      setLoading(false)
    }
  }

  const fetchFolder = async (folderId?: string) => {
    try {
      setLoading(true)
      setError(null)
      const data = await googleDriveAPI.browse(folderId)
      setContent(data)
    } catch (err: any) {
      console.error('Failed to browse Google Drive', err)
      setError(err.response?.data?.detail || 'Failed to load Google Drive contents.')
    } finally {
      setLoading(false)
    }
  }

  // Recursive directory scanner for HTML5 drag-and-drop
  const scanFileSystemEntry = async (entry: any, path = ''): Promise<UploadFileCandidate[]> => {
    if (!entry) return []
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file(
          (file: File) => {
            resolve([{ file, relativePath: path ? `${path}/${file.name}` : file.name }])
          },
          () => resolve([])
        )
      })
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader()
      const readEntriesBatch = (): Promise<any[]> =>
        new Promise((resolve) => {
          dirReader.readEntries(
            (entries: any[]) => resolve(entries),
            () => resolve([])
          )
        })

      let allEntries: any[] = []
      let batch: any[] = []
      do {
        batch = await readEntriesBatch()
        allEntries = allEntries.concat(batch)
      } while (batch.length > 0)

      const nextPath = path ? `${path}/${entry.name}` : entry.name
      const subResults = await Promise.all(
        allEntries.map((e) => scanFileSystemEntry(e, nextPath))
      )
      return subResults.flat()
    }
    return []
  }

  const handleUploadFiles = async (
    filesList: FileList | File[] | UploadFileCandidate[]
  ) => {
    const rawItems = Array.from(filesList as any[])
    if (!rawItems.length) return

    const normalizedItems: UploadFileCandidate[] = rawItems.map((item) => {
      if (item && typeof item === 'object' && 'file' in item && item.file instanceof File) {
        return item as UploadFileCandidate
      }
      const f = item as File
      const rel = (f as any).webkitRelativePath || f.name
      return { file: f, relativePath: rel }
    })

    const targetFolderId = content?.current_folder_id
    const newItems: UploadingFileItem[] = normalizedItems.map((item) => ({
      id: `upl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      name: item.file.name,
      relativePath: item.relativePath !== item.file.name ? item.relativePath : undefined,
      size: item.file.size,
      progress: 0,
      status: 'uploading',
    }))

    setUploadQueue((prev) => [...prev, ...newItems])
    setIsUploadDrawerOpen(true)
    setIsUploadDrawerMinimized(false)

    let completedCount = 0
    const topFolders = new Set<string>()
    normalizedItems.forEach((it) => {
      if (it.relativePath && it.relativePath.includes('/')) {
        topFolders.add(it.relativePath.split('/')[0])
      }
    })

    for (let i = 0; i < normalizedItems.length; i++) {
      const candidate = normalizedItems[i]
      const item = newItems[i]

      try {
        await googleDriveAPI.uploadFile(
          candidate.file,
          targetFolderId,
          candidate.relativePath,
          (pct) => {
            setUploadQueue((prev) =>
              prev.map((q) => (q.id === item.id ? { ...q, progress: pct } : q))
            )
          }
        )

        setUploadQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, progress: 100, status: 'completed' } : q))
        )
        completedCount++
      } catch (err: any) {
        const msg = err.response?.data?.detail || err.message || 'Upload failed'
        setUploadQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'error', error: msg } : q))
        )
      }
    }

    if (completedCount > 0) {
      if (topFolders.size === 1) {
        const folderName = Array.from(topFolders)[0]
        onToast(`Uploaded folder "${folderName}" (${completedCount} items) to Google Drive`)
      } else {
        onToast(
          completedCount === 1
            ? `Uploaded "${normalizedItems[0].file.name}" to Google Drive`
            : `Uploaded ${completedCount} files to Google Drive`
        )
      }
      fetchFolder(targetFolderId)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files)
    }
    e.target.value = ''
  }

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files)
    }
    e.target.value = ''
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current += 1
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      setIsDraggingOver(false)
      dragCounter.current = 0
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    dragCounter.current = 0

    const items = e.dataTransfer.items
    if (items && items.length > 0) {
      const candidates: UploadFileCandidate[] = []
      const entryPromises: Promise<UploadFileCandidate[]>[] = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null
        if (entry) {
          entryPromises.push(scanFileSystemEntry(entry))
        } else {
          const file = item.getAsFile()
          if (file) {
            candidates.push({ file, relativePath: file.name })
          }
        }
      }

      const scanned = await Promise.all(entryPromises)
      const allFiles = [...candidates, ...scanned.flat()]
      if (allFiles.length > 0) {
        handleUploadFiles(allFiles)
        return
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files)
    }
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    try {
      setActionLoading(true)
      await googleDriveAPI.createFolder(newFolderName.trim(), content?.current_folder_id)
      onToast(`Folder "${newFolderName}" created in Google Drive`)
      setNewFolderName('')
      setIsNewFolderModalOpen(false)
      fetchFolder(content?.current_folder_id)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create folder')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemToRename || !renameValue.trim()) return
    try {
      setActionLoading(true)
      await googleDriveAPI.rename(itemToRename.id, renameValue.trim())
      onToast(`Renamed to "${renameValue}"`)
      setItemToRename(null)
      fetchFolder(content?.current_folder_id)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to rename item')
    } finally {
      setActionLoading(false)
    }
  }

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemToMove || !destinationFolderId) return
    try {
      setActionLoading(true)
      await googleDriveAPI.move(itemToMove.id, destinationFolderId)
      onToast(`Moved "${itemToMove.name}" successfully`)
      setItemToMove(null)
      fetchFolder(content?.current_folder_id)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to move item')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (item: DriveItem) => {
    if (!confirm(`Trash "${item.name}" in Google Drive?`)) return
    try {
      setActionLoading(true)
      await googleDriveAPI.deleteFile(item.id)
      onToast(`Moved "${item.name}" to Google Drive trash`)
      fetchFolder(content?.current_folder_id)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to trash item')
    } finally {
      setActionLoading(false)
    }
  }

  const getFileIcon = (mime: string, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    if (mime.includes('pdf') || ext === 'pdf') {
      return <FileText size={20} className="text-red-500" />
    }
    if (mime.includes('spreadsheet') || mime.includes('excel') || ext === 'xlsx' || ext === 'csv') {
      return <FileSpreadsheet size={20} className="text-emerald-500" />
    }
    if (mime.includes('video') || ext === 'mp4' || ext === 'mkv') {
      return <Film size={20} className="text-purple-500" />
    }
    if (mime.includes('audio') || ext === 'mp3' || ext === 'wav') {
      return <Music size={20} className="text-pink-500" />
    }
    if (ext === 'url' || ext === 'lnk') {
      return <ExternalLink size={20} className="text-amber-500" />
    }
    return <File size={20} className="text-blue-400" />
  }

  const formatFileSize = (bytesStr?: string) => {
    if (!bytesStr || bytesStr === '0') return ''
    const b = parseInt(bytesStr, 10)
    if (isNaN(b) || b <= 0) return ''
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }

  const guessCourseCode = (): string | undefined => {
    if (!content?.breadcrumbs) return undefined
    for (const b of content.breadcrumbs) {
      const match = b.name.match(/^[A-Za-z]{2,4}\d{3,4}$/)
      if (match) return match[0].toUpperCase()
    }
    return undefined
  }

  if (isConnected === false) {
    return (
      <div className="drive-connect-card">
        <div className="drive-connect-icon">
          <HardDrive size={38} className="text-primary" />
        </div>
        <h3>Google Drive Academic Hierarchy</h3>
        <p>
          Connect your Google account to browse course folders (<code>ATLAS-Academics/Year/Semester/Courses</code>),
          access class lecture notes, and convert Drive files into planner deadlines with real-time 2-way sync.
        </p>
        <button className="btn-primary" onClick={onConnectGoogle}>
          Connect Google Account
        </button>
      </div>
    )
  }

  return (
    <div
      className="drive-navigator-surface"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input for Direct Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        style={{ display: 'none' }}
      />
      {/* Hidden Folder Input for Direct Directory Upload */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderInputChange}
        style={{ display: 'none' }}
        {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
      />

      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="drive-drag-overlay">
          <div className="drag-overlay-card">
            <Upload size={44} className="text-primary animate-bounce mb-2" />
            <h4>Drop files or folders to upload directly to Google Drive</h4>
            <p>
              Target folder: <strong>{content?.current_folder_name || 'Academic Directory'}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Top Header & Breadcrumb Bar */}
      <div className="drive-header-bar">
        <div className="drive-breadcrumbs">
          {content?.breadcrumbs?.map((b, idx) => {
            const isLast = idx === content.breadcrumbs.length - 1
            return (
              <React.Fragment key={b.id}>
                <button
                  className={`breadcrumb-item-btn ${isLast ? 'current' : ''}`}
                  onClick={() => setCurrentFolderId(b.id)}
                  disabled={isLast || loading}
                >
                  {idx === 0 && <HardDrive size={15} className="mr-1 inline" />}
                  <span>{b.name}</span>
                </button>
                {!isLast && <ChevronRight size={14} className="breadcrumb-separator" />}
              </React.Fragment>
            )
          })}
        </div>

        <div className="drive-top-actions">
          {userEmail && (
            <div className="drive-sync-indicator" title={`Live sync with ${userEmail}`}>
              <span className="pulsing-green-dot" />
              <span className="sync-email">{userEmail}</span>
            </div>
          )}

          <button
            className="btn-subtle"
            onClick={() => fetchFolder(content?.current_folder_id)}
            title="Refresh folder contents"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            className="btn-accent"
            onClick={() => setIsNewFolderModalOpen(true)}
            disabled={loading}
          >
            <FolderPlus size={15} />
            <span>New Folder</span>
          </button>

          <button
            className="btn-primary upload-files-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="Upload individual files directly to this Google Drive folder"
          >
            <Upload size={15} />
            <span>Add Files</span>
          </button>

          <button
            className="btn-primary upload-folder-btn"
            onClick={() => folderInputRef.current?.click()}
            disabled={loading}
            title="Upload an entire directory folder with all subfolders to Google Drive"
          >
            <FolderUp size={15} />
            <span>Add Folder</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="drive-error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => fetchFolder(content?.current_folder_id)}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="drive-loading-state">
          <RefreshCw size={28} className="animate-spin text-primary" />
          <p>Syncing academic directory with Google Drive...</p>
        </div>
      ) : (
        <div className="drive-folder-body">
          {/* Subfolders Section */}
          {content && content.folders.length > 0 && (
            <div className="drive-section">
              <h5 className="section-title">Folders ({content.folders.length})</h5>
              <div className="drive-folders-grid">
                {content.folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="drive-folder-tile"
                    onClick={() => setCurrentFolderId(folder.id)}
                  >
                    <div className="folder-icon-wrap">
                      <Folder size={22} className="text-amber-400 fill-amber-400/20" />
                    </div>
                    <span className="folder-name" title={folder.name}>
                      {folder.name}
                    </span>

                    <div
                      className="folder-actions-wrap"
                      onClick={(e) => e.stopPropagation()}
                      ref={activeMenuId === folder.id ? menuRef : null}
                    >
                      <button
                        className="icon-action-btn"
                        onClick={() => setActiveMenuId(activeMenuId === folder.id ? null : folder.id)}
                      >
                        <MoreVertical size={14} />
                      </button>

                      {activeMenuId === folder.id && (
                        <div className="action-popover-menu">
                          <button
                            className="popover-menu-item"
                            onClick={() => {
                              setActiveMenuId(null)
                              setItemToRename(folder)
                              setRenameValue(folder.name)
                            }}
                          >
                            <Edit2 size={14} className="menu-icon" />
                            <span>Rename Folder</span>
                          </button>
                          <button
                            className="popover-menu-item popover-danger"
                            onClick={() => {
                              setActiveMenuId(null)
                              handleDelete(folder)
                            }}
                          >
                            <Trash2 size={14} className="menu-icon" />
                            <span>Delete Folder</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files Section */}
          <div className="drive-section">
            <h5 className="section-title">
              Files {content && `(${content.files.length})`}
            </h5>

            {content && content.files.length === 0 ? (
              <div className="drive-empty-folder">
                <Folder size={40} className="text-muted" />
                <p>No files in this folder yet.</p>
                <span className="subtext">
                  Files and folders uploaded or synced to Google Drive will appear here with live 2-way sync.
                </span>
                <div className="empty-actions-row">
                  <button
                    className="btn-primary empty-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    <Upload size={15} />
                    <span>Upload Files</span>
                  </button>
                  <button
                    className="btn-primary upload-folder-btn empty-upload-btn"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={loading}
                  >
                    <FolderUp size={15} />
                    <span>Upload Folder</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="drive-files-grid">
                {content?.files.map((file) => (
                  <div key={file.id} className="drive-file-card">
                    <div className="file-header">
                      <div className="file-type-icon">
                        {getFileIcon(file.mimeType, file.name)}
                      </div>
                      <div
                        className="file-menu-wrap"
                        ref={activeMenuId === file.id ? menuRef : null}
                      >
                        <button
                          className="icon-action-btn"
                          onClick={() => setActiveMenuId(activeMenuId === file.id ? null : file.id)}
                        >
                          <MoreVertical size={16} />
                        </button>

                        {activeMenuId === file.id && (
                          <div className="action-popover-menu">
                            <button
                              className="popover-menu-item"
                              onClick={() => {
                                setActiveMenuId(null)
                                onOpenTaskModal({
                                  title: file.name.replace(/\.[^/.]+$/, ''),
                                  url: file.webViewLink,
                                  course_code: guessCourseCode(),
                                  file_id: file.id,
                                })
                              }}
                            >
                              <Calendar size={14} className="menu-icon text-accent" />
                              <span>Add to Deadlines & Tasks</span>
                            </button>

                            <button
                              className="popover-menu-item"
                              onClick={() => {
                                setActiveMenuId(null)
                                setItemToRename(file)
                                setRenameValue(file.name)
                              }}
                            >
                              <Edit2 size={14} className="menu-icon" />
                              <span>Rename File</span>
                            </button>

                            <button
                              className="popover-menu-item"
                              onClick={() => {
                                setActiveMenuId(null)
                                setItemToMove(file)
                                setDestinationFolderId('')
                              }}
                            >
                              <FolderInput size={14} className="menu-icon" />
                              <span>Move to Folder</span>
                            </button>

                            <button
                              className="popover-menu-item popover-danger"
                              onClick={() => {
                                setActiveMenuId(null)
                                handleDelete(file)
                              }}
                            >
                              <Trash2 size={14} className="menu-icon" />
                              <span>Move to Trash</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="file-info">
                      <h6 className="file-name" title={file.name}>
                        {file.name}
                      </h6>
                      <div className="file-meta">
                        {file.size && <span>{formatFileSize(file.size)}</span>}
                        {file.modifiedTime && (
                          <span>
                            {new Date(file.modifiedTime).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="file-footer">
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="open-drive-btn"
                          title="Open directly in Google Drive"
                        >
                          <span>Open in Drive</span>
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <button
                        className="schedule-file-btn"
                        onClick={() =>
                          onOpenTaskModal({
                            title: file.name.replace(/\.[^/.]+$/, ''),
                            url: file.webViewLink,
                            course_code: guessCourseCode(),
                            file_id: file.id,
                          })
                        }
                        title="Add to Deadlines & Tasks"
                      >
                        <Calendar size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {isNewFolderModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsNewFolderModalOpen(false)}>
          <div className="modal-card mini-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Folder</h3>
              <button className="close-btn" onClick={() => setIsNewFolderModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateFolder}>
              <div className="form-group">
                <label>Folder Name *</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. CS316, Labs, Cheatsheets"
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsNewFolderModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {itemToRename && (
        <div className="modal-backdrop" onClick={() => setItemToRename(null)}>
          <div className="modal-card mini-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rename {itemToRename.is_folder ? 'Folder' : 'File'}</h3>
              <button className="close-btn" onClick={() => setItemToRename(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRename}>
              <div className="form-group">
                <label>New Name *</label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setItemToRename(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Renaming...' : 'Rename'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {itemToMove && (
        <div className="modal-backdrop" onClick={() => setItemToMove(null)}>
          <div className="modal-card mini-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Move "{itemToMove.name}"</h3>
              <button className="close-btn" onClick={() => setItemToMove(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleMove}>
              <div className="form-group">
                <label>Select Destination Folder *</label>
                <select
                  value={destinationFolderId}
                  onChange={(e) => setDestinationFolderId(e.target.value)}
                  required
                >
                  <option value="">-- Select Destination Folder --</option>
                  {content?.folders?.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                  {content?.breadcrumbs && content.breadcrumbs.length > 1 && (
                    <option value={content.breadcrumbs[content.breadcrumbs.length - 2].id}>
                      ⬆️ Parent: {content.breadcrumbs[content.breadcrumbs.length - 2].name}
                    </option>
                  )}
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setItemToMove(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading || !destinationFolderId}
                >
                  {actionLoading ? 'Moving...' : 'Move Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Floating Google Drive Upload Manager Drawer */}
      {isUploadDrawerOpen && uploadQueue.length > 0 && (
        <div className={`drive-upload-drawer ${isUploadDrawerMinimized ? 'minimized' : ''}`}>
          <div className="drawer-header" onClick={() => setIsUploadDrawerMinimized(!isUploadDrawerMinimized)}>
            <div className="drawer-title">
              <Upload size={15} className="mr-1 inline text-primary" />
              <span>
                {uploadQueue.some((i) => i.status === 'uploading')
                  ? `Uploading ${uploadQueue.filter((i) => i.status === 'uploading').length} file(s)...`
                  : `Uploads complete (${uploadQueue.filter((i) => i.status === 'completed').length}/${uploadQueue.length})`}
              </span>
            </div>
            <div className="drawer-controls" onClick={(e) => e.stopPropagation()}>
              <button
                className="drawer-icon-btn"
                onClick={() => setIsUploadDrawerMinimized(!isUploadDrawerMinimized)}
                title={isUploadDrawerMinimized ? 'Expand' : 'Minimize'}
              >
                {isUploadDrawerMinimized ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              <button
                className="drawer-icon-btn"
                onClick={() => setIsUploadDrawerOpen(false)}
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {!isUploadDrawerMinimized && (
            <div className="drawer-body">
              {uploadQueue.map((item) => (
                <div key={item.id} className="drawer-item">
                  <div className="item-details">
                    <div className="item-name-row">
                      <span className="item-name" title={item.name}>
                        {item.name}
                      </span>
                      {item.relativePath && item.relativePath.includes('/') && (
                        <span
                          className="item-folder-badge"
                          title={`Folder path: ${item.relativePath}`}
                        >
                          {item.relativePath.substring(0, item.relativePath.lastIndexOf('/'))}
                        </span>
                      )}
                    </div>
                    <span className="item-meta">
                      {formatFileSize(item.size.toString())}
                      {item.status === 'uploading' && ` • ${item.progress}%`}
                      {item.status === 'completed' && ' • Completed'}
                      {item.status === 'error' && ` • ${item.error || 'Failed'}`}
                    </span>
                  </div>
                  <div className="item-status">
                    {item.status === 'uploading' && (
                      <Loader2 size={16} className="animate-spin text-primary" />
                    )}
                    {item.status === 'completed' && (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    )}
                    {item.status === 'error' && (
                      <span title={item.error}>
                        <AlertTriangle size={16} className="text-rose-400" />
                      </span>
                    )}
                  </div>
                  {item.status === 'uploading' && (
                    <div className="item-progress-bar">
                      <div
                        className="item-progress-fill"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DriveNavigator
