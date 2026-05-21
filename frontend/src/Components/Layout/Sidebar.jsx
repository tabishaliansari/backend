import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  ChevronRight,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  User as UserIcon,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  MoreHorizontal,
  Edit2,
  Trash2,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import useAuthStore from '@/store/authStore'
import { useThemeStore, useChatStore } from '@/store'
import AvatarUploadModal from '../Common/Modals/AvatarUploadModal'
import GraphLMLogo from '../Common/GraphLMLogo'

const getDisplayName = (user) => user?.firstName || user?.username || 'User'
const DEFAULT_AVATAR_URL = 'https://placehold.co/600x400'

function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: currentSessionId } = useParams()

  const { user, logout } = useAuthStore()
  const { theme, resolvedTheme, setTheme } = useThemeStore()
  const { sessions, fetchSessions, createSession, deleteSession, renameSession } = useChatStore()

  // Default to collapsed when viewing a specific chat session
  const [isCollapsed, setIsCollapsed] = useState(true)

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [themeSubmenuOpen, setThemeSubmenuOpen] = useState(false)
  const [topLogoHovered, setTopLogoHovered] = useState(false)
  const [recentMenuOpen, setRecentMenuOpen] = useState(false)

  // States for session 3-dot menus
  const [openMenuId, setOpenMenuId] = useState(null)
  const [modalConfig, setModalConfig] = useState({ type: null, session: null })
  const [renameInput, setRenameInput] = useState('')

  const menuRootRef = useRef(null)
  const sessionMenuRef = useRef(null)
  const recentMenuRef = useRef(null)

  const avatarUrl = user?.avatar?.url || DEFAULT_AVATAR_URL
  const displayName = useMemo(() => getDisplayName(user), [user])

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]
  const selectedThemeValue = ['light', 'dark', 'system'].includes(theme) ? theme : 'light'

  // Fetch sessions on mount if not already populated
  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    setUserMenuOpen(false)
    setThemeSubmenuOpen(false)
    setRecentMenuOpen(false)
  }, [location.pathname])

  // Handle outside clicks for user menu
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRootRef.current && !menuRootRef.current.contains(event.target)) {
        setUserMenuOpen(false)
        setThemeSubmenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Handle outside clicks for recent chats popover
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (recentMenuRef.current && !recentMenuRef.current.contains(event.target)) {
        setRecentMenuOpen(false)
      }
    }
    if (recentMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [recentMenuOpen])

  // Handle outside clicks for session 3-dot menus
  useEffect(() => {
    const handleOutsideMenuClick = (e) => {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
    }
    if (openMenuId) {
      document.addEventListener('mousedown', handleOutsideMenuClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideMenuClick)
    }
  }, [openMenuId])

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out successfully')
      navigate('/auth')
    } catch (error) {
      toast.error('Logout failed')
    }
  }

  const handleThemeChange = (nextTheme) => {
    setTheme(nextTheme)
    setThemeSubmenuOpen(false)
  }

  const [avatarModalOpen, setAvatarModalOpen] = useState(false)

  const handleManageAccount = () => {
    setAvatarModalOpen(true)
    setUserMenuOpen(false)
  }

  const handleSettings = () => {
    toast.info('Settings coming soon')
    setUserMenuOpen(false)
  }

  const handleNewChat = async () => {
    try {
      const newSession = await createSession({ title: 'New Chat' })
      navigate(`/chat/${newSession.id}`)
    } catch (err) {
      // error handled in store
    }
  }

  const openRenameModal = (e, session) => {
    e.stopPropagation()
    setRenameInput(session.title || '')
    setModalConfig({ type: 'rename', session })
    setOpenMenuId(null)
  }

  const openDeleteModal = (e, session) => {
    e.stopPropagation()
    setModalConfig({ type: 'delete', session })
    setOpenMenuId(null)
  }

  const closeModals = () => {
    setModalConfig({ type: null, session: null })
  }

  const confirmRename = async () => {
    if (modalConfig.session && renameInput.trim()) {
      await renameSession(modalConfig.session.id, renameInput.trim())
    }
    closeModals()
  }

  const confirmDelete = async () => {
    if (modalConfig.session) {
      await deleteSession(modalConfig.session.id)
      if (currentSessionId === modalConfig.session.id) {
        navigate('/dashboard')
      }
    }
    closeModals()
  }

  const handleLogoClick = () => {
    if (user && user.id) {
      navigate('/dashboard')
    } else {
      navigate('/landing')
    }
  }

  const isDark = resolvedTheme === 'dark'
  const sidebarWidth = isCollapsed ? 'w-[56px]' : 'w-[240px]'

  return (
    <aside
      className={`h-screen flex flex-col shrink-0 border-r border-(--border-subtle) bg-(--bg-surface) transition-all duration-300 ease-in-out ${sidebarWidth}`}
      ref={menuRootRef}
    >
      {/* Top Header / Collapse Toggle */}
      <div className="p-3 flex items-center justify-between">
        {isCollapsed ? (
          <button
            onMouseEnter={() => setTopLogoHovered(true)}
            onMouseLeave={() => setTopLogoHovered(false)}
            onClick={() => {
              setIsCollapsed(false)
              setTopLogoHovered(false)
            }}
            className="w-9 h-9 flex items-center justify-center rounded hover:bg-(--bg-hover) text-(--text-muted) hover:text-(--text-primary) transition-colors mx-auto"
            title="Expand Sidebar"
          >
            {topLogoHovered ? <PanelLeftOpen className="w-4 h-4" /> : <GraphLMLogo variant="icon" height={22} />}
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 ml-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleLogoClick} title="Go to Dashboard">
              <GraphLMLogo variant="full" height={22} />
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-muted) hover:text-(--text-primary) transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* New Chat Button Area */}
      {isCollapsed ? (
        <div className="px-3 pb-2 flex justify-center">
          <button
            onClick={handleNewChat}
            className="w-9 h-9 flex items-center justify-center rounded hover:bg-(--bg-hover) text-(--text-muted) hover:text-(--accent-cyan) transition-colors"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="px-3 pb-2">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded border border-(--border-default) hover:border-(--accent-cyan) hover:bg-(--accent-cyan-dim) text-(--text-secondary) hover:text-(--accent-cyan) transition-colors text-xs font-medium"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <Plus className="w-4 h-4" />
            New chat
          </button>
        </div>
      )}

      {/* Main Chat List Area */}
      <div className={`flex-1 px-2 py-1 ${isCollapsed ? '' : 'overflow-y-auto overflow-x-hidden'}`}>
        {!isCollapsed && (
          <>
            <div className="text-[10px] font-medium px-2 py-2 mb-1 uppercase tracking-widest text-(--text-muted)" style={{ fontFamily: 'var(--font-mono)' }}>
              Recent Chats
            </div>

            <div className="space-y-0.5 pb-10">
              {sessions.map(session => (
                <div key={session.id} className="relative group">
                  <button
                    onClick={() => navigate(`/chat/${session.id}`)}
                    className={`flex items-center gap-2 w-full p-2 rounded transition-colors text-xs truncate pr-7 ${session.id === currentSessionId
                        ? 'bg-(--accent-cyan-dim) text-(--accent-cyan)'
                        : 'text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)'
                      }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate flex-1 text-left" style={{ fontFamily: 'var(--font-mono)' }}>{session.title || 'Untitled Chat'}</span>
                  </button>

                  {/* 3-dot menu button, visible on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === session.id ? null : session.id); }}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity ${openMenuId === session.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary)`}
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {/* Dropdown Menu */}
                  {openMenuId === session.id && (
                    <div
                      ref={sessionMenuRef}
                      className="absolute right-0 top-full mt-1 w-32 rounded border border-(--border-strong) bg-(--bg-elevated) shadow-xl py-1 z-50 overflow-hidden"
                    >
                      <button
                        onClick={(e) => openRenameModal(e, session)}
                        className="w-full text-left px-3 py-2 text-xs text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary) flex items-center gap-2 transition-colors"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Rename
                      </button>
                      <button
                        onClick={(e) => openDeleteModal(e, session)}
                        className="w-full text-left px-3 py-2 text-xs text-(--accent-red) hover:bg-(--accent-red-dim) flex items-center gap-2 transition-colors"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {isCollapsed && (
          <div className="flex flex-col items-center gap-2 mt-2 relative">
            <button
              onClick={() => setRecentMenuOpen(!recentMenuOpen)}
              className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${recentMenuOpen ? 'bg-(--accent-cyan-dim) text-(--accent-cyan)' : 'hover:bg-(--bg-hover) text-(--text-muted) hover:text-(--text-primary)'}`}
              title="Recent Chats"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {recentMenuOpen && (
              <div
                ref={recentMenuRef}
                className="absolute left-full top-0 ml-3 w-60 rounded border border-(--border-strong) py-2 z-50 flex flex-col bg-(--bg-elevated) shadow-xl"
              >
                <div className="px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-(--text-muted)" style={{ fontFamily: 'var(--font-mono)' }}>
                  Recents
                </div>

                <div className="space-y-0.5 pb-2">
                  {sessions.slice(0, 10).map(session => (
                    <div key={session.id} className="relative group px-2">
                      <button
                        onClick={() => navigate(`/chat/${session.id}`)}
                        className={`flex items-center gap-2 w-full p-2 rounded transition-colors text-xs truncate pr-8 ${session.id === currentSessionId
                            ? 'bg-(--accent-cyan-dim) text-(--accent-cyan)'
                            : 'text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)'
                          }`}
                      >
                        <span className="truncate flex-1 text-left" style={{ fontFamily: 'var(--font-mono)' }}>{session.title || 'Untitled Chat'}</span>
                      </button>

                      {/* 3-dot menu button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === session.id ? null : session.id); }}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity ${openMenuId === session.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary)`}
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown Menu inside Recents Popover */}
                      {openMenuId === session.id && (
                        <div
                          ref={sessionMenuRef}
                          className="absolute right-8 top-full -mt-2 w-32 rounded border border-(--border-strong) bg-(--bg-elevated) shadow-xl py-1 z-60 overflow-hidden"
                        >
                          <button
                            onClick={(e) => openRenameModal(e, session)}
                            className="w-full text-left px-3 py-2 text-xs text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary) flex items-center gap-2 transition-colors"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Rename
                          </button>
                          <button
                            onClick={(e) => openDeleteModal(e, session)}
                            className="w-full text-left px-3 py-2 text-xs text-(--accent-red) hover:bg-(--accent-red-dim) flex items-center gap-2 transition-colors"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom User Menu */}
      <div className="p-2 border-t border-(--border-subtle)">
        <div className="relative w-full">
          {/* Dropdown Menu (Opens Upward) */}
          {userMenuOpen && (
            <div className={`absolute bottom-full mb-2 rounded border border-(--border-strong) py-1 z-50 bg-(--bg-elevated) shadow-xl ${isCollapsed ? 'left-full ml-3 w-56' : 'left-0 w-56'
              }`}>

              {/* Email Display */}
              <div className="px-4 py-3 text-xs truncate border-b border-(--border-subtle) text-(--text-muted)" style={{ fontFamily: 'var(--font-mono)' }}>
                {user?.email || 'No email available'}
              </div>

              {/* Settings */}
              <button
                onClick={handleSettings}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary) transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>

              {/* Profile */}
              <button
                onClick={handleManageAccount}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary) transition-colors"
              >
                <UserIcon className="w-4 h-4" />
                Profile
              </button>

              {/* Theme Submenu Toggle */}
              <div
                className="relative w-full flex items-center justify-between px-4 py-2.5 text-sm text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary) transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  setThemeSubmenuOpen(!themeSubmenuOpen)
                }}
              >
                <div className="flex items-center gap-3">
                  <Sun className="w-4 h-4" />
                  Theme
                </div>
                <ChevronRight className="w-4 h-4" />

                {/* Theme Submenu */}
                {themeSubmenuOpen && (
                  <div className={`absolute bottom-0 rounded border border-(--border-strong) py-1 z-50 w-36 bg-(--bg-elevated) shadow-xl ${isCollapsed ? 'left-full ml-1' : 'left-full ml-1'
                    }`}>
                    {themeOptions.map((option) => {
                      const Icon = option.icon
                      const isSelected = selectedThemeValue === option.value
                      return (
                        <button
                          key={option.value}
                          onClick={() => handleThemeChange(option.value)}
                          className="w-full flex items-center justify-between px-4 py-2 text-sm text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary) transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4" />
                            {option.label}
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-(--accent-cyan)" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-(--accent-red) border-t border-(--border-subtle) hover:bg-(--accent-red-dim) transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>
          )}

          {/* User Button (Avatar & Name) */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`w-full flex items-center gap-2 p-1.5 rounded hover:bg-(--bg-hover) transition-colors ${isCollapsed ? 'justify-center' : 'justify-start'}`}
          >
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-(--border-default)">
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            {!isCollapsed && (
              <>
                <span className="text-xs font-medium truncate flex-1 text-left text-(--text-secondary)" style={{ fontFamily: 'var(--font-mono)' }}>
                  {displayName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-(--text-muted)" />
              </>
            )}
          </button>
        </div>
      </div>

      <AvatarUploadModal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        avatarUrl={avatarUrl}
        displayName={displayName}
      />

      {/* Rename / Delete Modals */}
      {modalConfig.type && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="flex items-center justify-between px-6 py-4 border-b border-(--border-subtle)">
              <h3 className="text-sm font-semibold text-(--text-primary)" style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {modalConfig.type === 'rename' ? 'Rename Chat' : 'Delete Chat'}
              </h3>
              <button onClick={closeModals} className="text-(--text-muted) hover:text-(--text-primary) transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              {modalConfig.type === 'rename' ? (
                <div>
                  <label className="field-label">Chat Title</label>
                  <input
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                    className="field-input"
                    placeholder="Enter chat title..."
                  />
                </div>
              ) : (
                <p className="text-(--text-secondary) text-sm">
                  Are you sure you want to delete <span className="font-semibold text-(--text-primary)">"{modalConfig.session.title}"</span>? This action cannot be undone.
                </p>
              )}
            </div>

            <div className="px-6 py-4 bg-(--bg-surface) border-t border-(--border-subtle) flex justify-end gap-3">
              <button
                onClick={closeModals}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={modalConfig.type === 'rename' ? confirmRename : confirmDelete}
                className={modalConfig.type === 'rename' ? 'btn-primary' : 'btn-danger'}
              >
                {modalConfig.type === 'rename' ? 'Save' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

export default Sidebar
