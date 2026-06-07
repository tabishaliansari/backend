import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Settings,
  User,
  GitBranch,
  FileText,
  Database,
  Cpu,
  Shield,
  Trash2,
  LogOut,
  Key,
  Sun,
  Moon,
  Monitor,
  Search,
  Camera,
  Check,
  Loader2,
  Server,
  Code2
} from 'lucide-react'
import { toast } from 'sonner'
import userService from '@/api/userService'
import authService from '@/api/authService'
import useAuthStore from '@/store/authStore'
import { useThemeStore, useSourceStore, useChatStore } from '@/store'

const DEFAULT_AVATAR_URL = 'https://placehold.co/600x400'

export default function SettingsModal({ open, onClose }) {
  const { user, logout } = useAuthStore()
  const { theme, resolvedTheme, setTheme } = useThemeStore()
  const { sources, fetchSources, deleteSource } = useSourceStore()
  const { sessions, fetchSessions, deleteSession } = useChatStore()

  // State
  const [activeTab, setActiveTab] = useState('general')
  const [tabSearch, setTabSearch] = useState('')
  const [sourceSearch, setSourceSearch] = useState('')
  const [sessionSearch, setSessionSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  // Profile Form State
  const [fullname, setFullname] = useState('')
  const [username, setUsername] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [resetSending, setResetSending] = useState(false)

  const fileInputRef = useRef(null)

  // Load user data on open
  useEffect(() => {
    if (open && user) {
      setFullname(user.fullname || user.firstName || '')
      setUsername(user.username || '')
      setSelectedFile(null)
      setPreviewUrl(null)
    }
  }, [open, user])

  // Fetch sources and sessions when open or switching tabs
  useEffect(() => {
    if (open) {
      fetchSources(0, 100)
      fetchSessions()
    }
  }, [open, fetchSources, fetchSessions])

  // Revoke object URL on unmount or preview update
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleSelectFile = (file) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setSelectedFile(file)
    setPreviewUrl(url)
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0]
    handleSelectFile(file)
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    let updatedUser = { ...user }

    try {
      // 1. Handle Avatar Upload
      if (selectedFile) {
        const avatarRes = await userService.uploadAvatar(selectedFile)
        updatedUser.avatar = avatarRes?.data ?? avatarRes
      }

      // 2. Handle Details Update
      const isNameChanged = fullname !== (user.fullname || user.firstName || '')
      const isUsernameChanged = username !== (user.username || '')

      if (isNameChanged || isUsernameChanged) {
        const updatePayload = {}
        if (isNameChanged) updatePayload.fullname = fullname
        if (isUsernameChanged) updatePayload.username = username

        const profileRes = await userService.updateProfile(updatePayload)
        const updatedProfile = profileRes?.data ?? profileRes
        updatedUser = { ...updatedUser, ...updatedProfile }
      }

      useAuthStore.setState({ user: updatedUser })
      toast.success('Profile updated successfully')
      setSelectedFile(null)
      setPreviewUrl(null)
    } catch (err) {
      console.error(err)
      toast.error(err?.response?.data?.message || 'Profile update failed')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleTriggerPasswordReset = async () => {
    if (!user?.email) return
    setResetSending(true)
    try {
      await authService.forgotPassword(user.email)
      toast.success(`Password reset email sent to ${user.email}`)
    } catch (err) {
      console.error(err)
      toast.error(err?.response?.data?.message || 'Failed to send reset email')
    } finally {
      setResetSending(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out successfully')
      onClose()
      window.location.href = '/auth'
    } catch (err) {
      toast.error('Logout failed')
    }
  }

  const handleDeleteSource = async (sourceId) => {
    console.log("handleDeleteSource called with sourceId:", sourceId)
    try {
      await deleteSource(sourceId)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    try {
      await deleteSession(sessionId)
    } catch (err) {
      console.error(err)
    }
  }

  // File Icon helper
  const FileIcon = ({ filename, className }) => {
    const ext = filename?.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return <img src="/fileIcons/file-pdf.svg" alt="PDF" className={className} />
    if (ext === 'doc' || ext === 'docx') return <img src="/fileIcons/file-docx.svg" alt="Word" className={className} />
    if (ext === 'md' || ext === 'markdown') return <img src="/fileIcons/file-code.svg" alt="Markdown" className={className} />
    return <img src="/fileIcons/file-text-dark.svg" alt="Text" className={className} />
  }

  // Sidebar Tab Configuration
  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'connectors', label: 'Connectors', icon: GitBranch },
    { id: 'dataControls', label: 'Data Controls', icon: Trash2 },
    { id: 'capabilities', label: 'Capabilities', icon: Cpu },
    { id: 'account', label: 'Account', icon: User }
  ]

  // Filter tabs by search
  const filteredTabs = useMemo(() => {
    if (!tabSearch.trim()) return tabs
    const lowerQuery = tabSearch.toLowerCase()
    return tabs.filter(t => t.label.toLowerCase().includes(lowerQuery))
  }, [tabSearch])

  // Filter sources by search
  const filteredSources = useMemo(() => {
    if (!sourceSearch.trim()) return sources
    const lowerQuery = sourceSearch.toLowerCase()
    return sources.filter(s => s.title?.toLowerCase().includes(lowerQuery))
  }, [sources, sourceSearch])

  // Filter sessions by search
  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) return sessions
    const lowerQuery = sessionSearch.toLowerCase()
    return sessions.filter(s => s.title?.toLowerCase().includes(lowerQuery))
  }, [sessions, sessionSearch])

  if (!open) return null

  const avatarUrl = user?.avatar?.url || DEFAULT_AVATAR_URL
  const displayName = user?.fullname || user?.firstName || 'User'

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
      <div className="w-full max-w-3xl h-[520px] rounded-lg border border-(--border-strong) bg-(--bg-elevated) flex relative overflow-hidden shadow-2xl animate-fade-in">

        {/* Left Sidebar Column */}
        <div className="w-52 shrink-0 border-r border-(--border-subtle) bg-(--bg-surface) flex flex-col p-4">
          <div className="mb-4">
            <h2 className="text-xs font-semibold text-(--text-primary) uppercase tracking-widest font-mono">Settings</h2>
          </div>

          {/* Search box */}
          <div className="relative mb-4">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--text-muted)" />
            <input
              type="text"
              value={tabSearch}
              onChange={(e) => setTabSearch(e.target.value)}
              placeholder="Search options..."
              className="w-full bg-(--bg-elevated) border border-(--border-subtle) focus:border-(--accent-cyan) rounded pl-8 pr-2 py-1 text-xs text-(--text-primary) outline-none font-mono"
            />
          </div>

          {/* Sidebar Tabs list */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredTabs.map((t) => {
              const Icon = t.icon
              const isActive = activeTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setActiveTab(t.id)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-mono rounded transition-colors text-left ${isActive
                    ? 'bg-(--accent-cyan-dim) text-(--accent-cyan) font-medium'
                    : 'text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-hover)'
                    }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {t.label}
                </button>
              )
            })}
            {filteredTabs.length === 0 && (
              <p className="text-[10px] text-(--text-muted) text-center mt-4 font-mono">No settings found</p>
            )}
          </div>
        </div>

        {/* Right Content Pane Column */}
        <div className="flex-1 min-w-0 bg-(--bg-surface) flex flex-col relative">

          {/* Header & Close Action */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-(--border-subtle) shrink-0">
            <h3 className="text-sm font-semibold text-(--text-primary) uppercase tracking-wider font-mono">
              {activeTab.replace(/([A-Z])/g, ' $1')}
            </h3>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClose()
              }}
              className="p-1 rounded text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover) transition-colors text-sm"
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>

          {/* Scrollable Tab Pane Body */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0 space-y-6">

            {/* GENERAL TAB CONTENT */}
            {activeTab === 'general' && (
              <div className="space-y-6">

                {/* Profile Form */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-(--text-secondary) uppercase tracking-widest font-mono">Profile Details</h4>

                  <div className="flex items-center gap-6">
                    <div className="relative group cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()}>
                      <div className="h-16 w-16 overflow-hidden rounded-full border border-(--border-default) relative">
                        {previewUrl ? (
                          <img src={previewUrl} alt="preview" className="h-full w-full object-cover" />
                        ) : (
                          <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-colors rounded-full">
                          <Camera className="w-4 h-4 text-(--accent-cyan)" />
                        </div>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                    </div>

                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">Display Name</label>
                        <input
                          type="text"
                          value={fullname}
                          onChange={(e) => setFullname(e.target.value)}
                          className="field-input h-9 text-xs"
                        />
                      </div>
                      <div>
                        <label className="field-label">Username</label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="field-input h-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="btn-primary h-8 px-4 text-xs font-mono"
                    >
                      {savingProfile ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                </div>

                <div className="border-t border-(--border-subtle) my-4" />

                {/* Preferences Form (Theme) */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-(--text-secondary) uppercase tracking-widest font-mono">Preferences</h4>
                  <div>
                    <label className="field-label">Theme / Appearance</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'light', label: 'Light', icon: Sun },
                        { value: 'dark', label: 'Dark', icon: Moon },
                        { value: 'system', label: 'System', icon: Monitor }
                      ].map((tOption) => {
                        const Icon = tOption.icon
                        const isSelected = theme === tOption.value
                        return (
                          <button
                            key={tOption.value}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setTheme(tOption.value)
                            }}
                            className={`flex items-center justify-center gap-2 py-2 border rounded text-xs font-mono transition-all cursor-pointer ${isSelected
                              ? 'bg-(--accent-cyan-dim) border-(--accent-cyan) text-(--accent-cyan)'
                              : 'bg-(--bg-elevated) border-(--border-subtle) text-(--text-secondary) hover:border-(--border-strong)'
                              }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {tOption.label}
                            {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONNECTORS TAB CONTENT */}
            {activeTab === 'connectors' && (
              <div className="space-y-4 flex flex-col h-full min-h-0">
                <div className="flex items-center justify-between shrink-0">
                  <h4 className="text-xs font-semibold text-(--text-secondary) uppercase tracking-widest font-mono">Data Sources Manager</h4>
                  <div className="relative w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--text-muted)" />
                    <input
                      type="text"
                      value={sourceSearch}
                      onChange={(e) => setSourceSearch(e.target.value)}
                      placeholder="Search sources..."
                      className="w-full bg-(--bg-elevated) border border-(--border-subtle) focus:border-(--accent-cyan) rounded pl-8 pr-2 py-1 text-[11px] text-(--text-primary) outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0 border border-(--border-subtle) rounded bg-(--bg-elevated) overflow-y-auto">
                  <div className="divide-y divide-(--border-subtle)">
                    {filteredSources.map((source) => {
                      const isGithub = source.type === 'github'
                      const statusClass =
                        source.status === 'indexed'
                          ? 'badge-indexed'
                          : source.status === 'indexing'
                            ? 'badge-indexing'
                            : source.status === 'failed'
                              ? 'badge-failed'
                              : 'badge-uploaded'

                      return (
                        <div key={source.id} className="flex items-center justify-between p-3 bg-(--bg-surface) hover:bg-(--bg-hover)/20 transition-colors">
                          <div className="flex items-center gap-3 overflow-hidden mr-2">
                            {isGithub ? (
                              <GitBranch className="w-4 h-4 text-(--text-muted) shrink-0" />
                            ) : (
                              <FileIcon filename={source.title} className="w-4 h-4 shrink-0" />
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-mono font-medium text-(--text-primary) truncate">{source.title}</span>
                              <span className="text-[9px] text-(--text-muted) font-mono">
                                {isGithub ? `Branch: ${source.metadata?.branch || 'main'}` : source.metadata?.file_type?.toUpperCase() || 'FILE'} · {new Date(source.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`badge text-[9px] py-0.5 px-1.5 ${statusClass}`}>
                              {source.status}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                console.log("Delete button clicked in DOM for source:", source.id)
                                e.preventDefault()
                                e.stopPropagation()
                                setPendingDelete({
                                  type: 'source',
                                  id: source.id,
                                  title: source.title
                                })
                              }}
                              className="p-1 rounded text-(--accent-red) hover:bg-(--accent-red-dim) transition-colors"
                              title="Delete source and clean up indexes"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {filteredSources.length === 0 && (
                      <div className="p-8 text-center text-xs text-(--text-muted) font-mono">
                        No sources found
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* DATA CONTROLS TAB CONTENT */}
            {activeTab === 'dataControls' && (
              <div className="space-y-4 flex flex-col h-full min-h-0">
                <div className="flex items-center justify-between shrink-0">
                  <h4 className="text-xs font-semibold text-(--text-secondary) uppercase tracking-widest font-mono">Active Chat Sessions</h4>
                  <div className="relative w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--text-muted)" />
                    <input
                      type="text"
                      value={sessionSearch}
                      onChange={(e) => setSessionSearch(e.target.value)}
                      placeholder="Search sessions..."
                      className="w-full bg-(--bg-elevated) border border-(--border-subtle) focus:border-(--accent-cyan) rounded pl-8 pr-2 py-1 text-[11px] text-(--text-primary) outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0 border border-(--border-subtle) rounded bg-(--bg-elevated) overflow-y-auto">
                  <div className="divide-y divide-(--border-subtle)">
                    {filteredSessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-(--bg-surface) hover:bg-(--bg-hover)/20 transition-colors">
                        <div className="flex flex-col min-w-0 mr-2">
                          <span className="text-xs font-mono font-medium text-(--text-primary) truncate">{session.title}</span>
                          <span className="text-[9px] text-(--text-muted) font-mono">
                            ID: {session.id.slice(0, 8)}... · {session.sources?.length || 0} source(s) · {new Date(session.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setPendingDelete({
                              type: 'session',
                              id: session.id,
                              title: session.title
                            })
                          }}
                          className="p-1.5 rounded text-(--accent-red) hover:bg-(--accent-red-dim) transition-colors shrink-0"
                          title="Delete chat session and vector history"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {filteredSessions.length === 0 && (
                      <div className="p-8 text-center text-xs text-(--text-muted) font-mono">
                        No active sessions found
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CAPABILITIES TAB CONTENT */}
            {activeTab === 'capabilities' && (
              <div className="space-y-6">

                {/* Datastore Status */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-(--text-secondary) uppercase tracking-widest font-mono">Knowledge Engine Connections</h4>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Qdrant connection */}
                    <div className="p-4 rounded border border-(--border-subtle) bg-(--bg-elevated) flex items-start gap-3">
                      <Server className="w-5 h-5 text-(--accent-cyan) shrink-0 mt-0.5" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold font-mono text-(--text-primary)">Qdrant Vector DB</span>
                        <span className="text-[10px] text-(--text-secondary) mt-1 font-mono">Status: Connected</span>
                        <span className="text-[9px] text-(--text-muted) mt-0.5 leading-normal">
                          Stores vector embeddings and runs fast semantic semantic search of document chunks.
                        </span>
                      </div>
                    </div>

                    {/* Neo4j connection */}
                    <div className="p-4 rounded border border-(--border-subtle) bg-(--bg-elevated) flex items-start gap-3">
                      <Database className="w-5 h-5 text-(--accent-cyan) shrink-0 mt-0.5" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold font-mono text-(--text-primary)">Neo4j Graph DB</span>
                        <span className="text-[10px] text-(--text-secondary) mt-1 font-mono">Status: Connected</span>
                        <span className="text-[9px] text-(--text-muted) mt-0.5 leading-normal">
                          Stores entities and relationships extracted from chunks to visualize context graphs.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-(--border-subtle) my-4" />

                {/* Pipeline Models */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-(--text-secondary) uppercase tracking-widest font-mono">AI Models & Transformers</h4>

                  <div className="space-y-3.5">
                    {/* Model 1: gpt-4o-mini */}
                    <div className="flex items-start gap-3">
                      <Code2 className="w-4 h-4 text-(--text-secondary) shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold font-mono text-(--text-primary)">gpt-4o-mini</span>
                        <span className="text-[10px] text-(--text-secondary) font-mono">Default conversation and extraction model. Balanced latency/accuracy.</span>
                      </div>
                    </div>

                    {/* Model 2: o1-mini */}
                    <div className="flex items-start gap-3">
                      <Cpu className="w-4 h-4 text-(--text-secondary) shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold font-mono text-(--text-primary)">o1-mini</span>
                        <span className="text-[10px] text-(--text-secondary) font-mono">Advanced reasoning model. Best for traversing complex subgraphs.</span>
                      </div>
                    </div>

                    {/* Transformer: LLMGraphTransformer */}
                    <div className="flex items-start gap-3">
                      <Shield className="w-4 h-4 text-(--text-secondary) shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold font-mono text-(--text-primary)">LangChain LLMGraphTransformer</span>
                        <span className="text-[10px] text-(--text-secondary) font-mono">Runs as a background process to extract entities and construct semantic graph structures.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ACCOUNT TAB CONTENT */}
            {activeTab === 'account' && (
              <div className="space-y-6">

                {/* Account Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-(--text-secondary) uppercase tracking-widest font-mono">User Credentials</h4>
                  <div className="p-4 rounded border border-(--border-subtle) bg-(--bg-elevated) space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-(--text-secondary)">Email ID</span>
                      <span className="text-(--text-primary) font-semibold">{user?.email || 'Not available'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono border-t border-(--border-subtle) pt-2">
                      <span className="text-(--text-secondary)">User ID</span>
                      <span className="text-(--text-muted)">{user?.id || 'Not available'}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-(--border-subtle) my-4" />

                {/* Actions */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-(--text-secondary) uppercase tracking-widest font-mono">Security Actions</h4>

                  <div className="flex gap-4">
                    {/* Password reset trigger */}
                    <button
                      type="button"
                      onClick={handleTriggerPasswordReset}
                      disabled={resetSending}
                      className="flex-1 flex items-center justify-center gap-2 border border-(--border-strong) py-2.5 rounded text-xs font-mono hover:bg-(--bg-hover) text-(--text-primary) cursor-pointer"
                    >
                      {resetSending ? (
                        <Loader2 className="w-4 h-4 animate-spin text-(--accent-cyan)" />
                      ) : (
                        <Key className="w-4 h-4 text-(--text-secondary)" />
                      )}
                      <span>Reset Password via Email</span>
                    </button>

                    {/* Log out trigger */}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex-1 flex items-center justify-center gap-2 border border-(--accent-red) py-2.5 rounded text-xs font-mono bg-(--accent-red-dim) hover:bg-(--accent-red) hover:text-(--bg-base) text-(--accent-red) transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out Account</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            {pendingDelete && (
              <div className="absolute inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-6">
                <div className="w-full max-w-sm rounded-lg border border-(--border-strong) bg-(--bg-elevated) p-6 shadow-2xl space-y-4 font-mono">
                  <h3 className="text-xs font-bold text-(--text-primary) uppercase tracking-wider">
                    Confirm Deletion
                  </h3>
                  <p className="text-xs text-(--text-secondary) leading-relaxed">
                    Are you sure you want to delete the {pendingDelete.type} <span className="text-(--accent-cyan) font-bold">"{pendingDelete.title}"</span>? 
                    {pendingDelete.type === 'source' 
                      ? ' This will permanently wipe its vector and graph indexes.'
                      : ' This will clear its database records and vector memory.'}
                  </p>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setPendingDelete(null)
                      }}
                      className="flex-1 border border-(--border-strong) py-2 rounded text-xs font-semibold hover:bg-(--bg-hover) text-(--text-primary) transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const { type, id } = pendingDelete
                        setPendingDelete(null)
                        if (type === 'source') {
                          await handleDeleteSource(id)
                        } else {
                          await handleDeleteSession(id)
                        }
                      }}
                      className="flex-1 bg-(--accent-red-dim) border border-(--accent-red) py-2 rounded text-xs font-semibold hover:bg-(--accent-red) hover:text-(--bg-base) text-(--accent-red) transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
