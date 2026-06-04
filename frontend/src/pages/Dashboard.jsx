import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '@/store'
import useAuthStore from '@/store/authStore'
import { Search, Grid, List, Plus, MoreHorizontal, Edit2, Trash2, X, MessageSquare, Layers } from 'lucide-react'

function Dashboard() {
  const navigate = useNavigate()
  const { sessions, fetchSessions, createSession, deleteSession, renameSession, isLoadingSessions } = useChatStore()
  const user = useAuthStore(state => state.user)

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedChats, setSelectedChats] = useState([])

  const [openMenuId, setOpenMenuId] = useState(null)
  const [modalConfig, setModalConfig] = useState({ type: null, session: null })
  const [renameInput, setRenameInput] = useState('')

  const menuRef = useRef(null)

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Handle clicking outside the 3-dot menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
    }
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuId])

  const handleCreateChat = async () => {
    try {
      const newSession = await createSession({ title: 'New Chat' })
      navigate(`/chat/${newSession.id}`)
    } catch (err) {
      console.error(err)
    }
  }

  const handleOpenChat = (id) => {
    navigate(`/chat/${id}`)
  }

  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value)
  }, [])

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const lowerQuery = searchQuery.toLowerCase()
    return sessions.filter(session =>
      session.title?.toLowerCase().includes(lowerQuery)
    )
  }, [sessions, searchQuery])

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
    }
    closeModals()
  }

  const confirmBulkDelete = async () => {
    // Delete all selected chats
    for (const id of selectedChats) {
      await deleteSession(id)
    }
    setIsSelectionMode(false)
    setSelectedChats([])
    closeModals()
  }

  const toggleSelectChat = (id) => {
    setSelectedChats(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id])
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">

      {/* ── Hero greeting ── */}
      <div className="mb-8">
        <p className="text-xs text-(--text-muted) font-mono uppercase tracking-widest mb-1">{greeting()}</p>
        <h1 className="text-2xl font-bold text-(--text-primary)" style={{ fontFamily: 'var(--font-mono)' }}>
          Welcome back
          {(user?.fullname || user?.username) && (
            <span>, <span className="text-(--accent-cyan)">{user?.fullname?.split(' ')[0] || user?.username}</span></span>
          )}
          <span className="text-(--accent-cyan)">.</span>
        </h1>
        <p className="text-sm text-(--text-secondary) mt-1">
          {sessions.length === 0
            ? 'Start your first knowledge graph session below.'
            : `You have ${sessions.length} chat session${sessions.length !== 1 ? 's' : ''}.`}
        </p>
      </div>

      {/* ── Top Filter Bar ── */}
      <div className="flex items-center justify-between mb-6 h-10">
        {isSearchOpen ? (
          <div className="flex-1 flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-(--bg-elevated) rounded border border-(--border-default) focus-within:border-(--accent-cyan) focus-within:shadow-[0_0_0_2px_var(--accent-cyan-dim)] transition-all">
              <Search className="w-4 h-4 text-(--text-muted) shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Search by chat title"
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-transparent border-none outline-none flex-1 text-sm text-(--text-primary) placeholder:text-(--text-muted)"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <button
              onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
              className="text-xs font-medium text-(--text-secondary) hover:text-(--text-primary) transition-colors px-2"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Cancel
            </button>
          </div>
        ) : isSelectionMode ? (
          <div className="flex items-center gap-4 text-sm animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                if (selectedChats.length === filteredSessions.length && filteredSessions.length > 0) {
                  setSelectedChats([])
                } else {
                  setSelectedChats(filteredSessions.map(s => s.id))
                }
              }}
              className="text-(--text-secondary) hover:text-(--text-primary) transition-colors flex items-center gap-2"
            >
              <input
                type="checkbox"
                checked={filteredSessions.length > 0 && selectedChats.length === filteredSessions.length}
                readOnly
                className="rounded border-(--border-default) bg-(--bg-elevated) text-(--accent-cyan) cursor-pointer w-4 h-4 accent-(--accent-cyan)"
              />
              Select All
            </button>
            {selectedChats.length > 0 && (
              <button
                onClick={() => setModalConfig({ type: 'deleteBulk' })}
                className="text-(--accent-red) hover:opacity-80 transition-opacity flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete ({selectedChats.length})
              </button>
            )}
            <button
              onClick={() => {
                setIsSelectionMode(false)
                setSelectedChats([])
              }}
              className="text-(--text-secondary) hover:text-(--text-primary) transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => setIsSelectionMode(true)}
              className="px-4 py-1.5 rounded border border-(--border-default) text-(--text-secondary) hover:border-(--border-strong) hover:text-(--text-primary) transition-colors"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              Select Chats
            </button>
          </div>
        )}

        <div className={`flex items-center gap-3 transition-all ${isSearchOpen ? 'ml-6' : ''}`}>
          {!isSearchOpen && (
            <button onClick={() => setIsSearchOpen(true)} className="p-2 rounded hover:bg-(--bg-hover) transition-colors">
              <Search className="w-4 h-4 text-(--text-secondary)" />
            </button>
          )}

          <div className="flex bg-(--bg-elevated) rounded overflow-hidden border border-(--border-default)">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-(--bg-hover) text-(--text-primary)' : 'text-(--text-muted) hover:text-(--text-secondary)'}`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-(--bg-hover) text-(--text-primary)' : 'text-(--text-muted) hover:text-(--text-secondary)'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button onClick={handleCreateChat} className="btn-primary flex items-center gap-2 px-4 py-1.5 h-auto text-xs shrink-0">
            <Plus className="w-4 h-4" />
            Create new
          </button>
        </div>
      </div>

      {/* Recent Chats Section */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xs font-medium text-(--text-muted) uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>Recent chats</h2>
        {!isLoadingSessions && sessions.length > 0 && (
          <span className="text-[11px] text-(--text-muted) font-mono">{filteredSessions.length}/{sessions.length}</span>
        )}
      </div>

      <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" : "flex flex-col gap-2"}>


        {/* Actual Chats */}
        {isLoadingSessions ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`rounded border border-(--border-subtle) bg-(--bg-surface) animate-pulse overflow-hidden ${viewMode === 'grid' ? 'h-44' : 'h-14'
              }`}>
              <div className="h-0.5 w-full" style={{ background: 'rgba(0,200,150,0.2)' }} />
            </div>
          ))
        ) : filteredSessions.length === 0 && searchQuery ? (
          <div className="col-span-full py-16 text-center">
            <Search className="w-8 h-8 text-(--text-muted) mx-auto mb-3 opacity-40" />
            <p className="text-sm text-(--text-muted) font-mono">No chats matching <span className="text-(--text-primary)">"{searchQuery}"</span></p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <div className="w-14 h-14 rounded-xl bg-(--accent-cyan-dim) flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-7 h-7 text-(--accent-cyan)" />
            </div>
            <p className="text-sm font-medium text-(--text-primary) mb-1 font-mono">No sessions yet</p>
            <p className="text-xs text-(--text-muted) mb-5">Create your first session to get started.</p>
            <button onClick={handleCreateChat} className="btn-primary">
              <Plus className="w-4 h-4" /> New session
            </button>
          </div>
        ) : (
          filteredSessions.map(chat => (
            <div
              key={chat.id}
              onClick={() => {
                if (isSelectionMode) {
                  toggleSelectChat(chat.id)
                } else {
                  handleOpenChat(chat.id)
                }
              }}
              className={`group relative flex cursor-pointer transition-all border rounded ${viewMode === 'grid'
                ? 'flex-col h-44 p-4'
                : 'items-center gap-4 p-3'
                } ${isSelectionMode && selectedChats.includes(chat.id)
                  ? 'border-(--accent-cyan) bg-(--accent-cyan-dim)'
                  : 'border-(--border-subtle) bg-(--bg-surface) hover:border-(--border-default) hover:bg-(--bg-elevated)'
                }`}
            >
              {/* 3-dot Menu Button or Checkbox */}
              <div className={`absolute ${viewMode === 'grid' ? 'top-3 right-3' : 'top-1/2 -translate-y-1/2 right-3'} z-10`}>
                {isSelectionMode ? (
                  <input
                    type="checkbox"
                    checked={selectedChats.includes(chat.id)}
                    readOnly
                    className="w-4 h-4 rounded border-(--border-default) pointer-events-none accent-(--accent-cyan)"
                  />
                ) : (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === chat.id ? null : chat.id); }}
                      className="p-1 rounded hover:bg-(--bg-hover) text-(--text-muted) hover:text-(--text-primary) transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuId === chat.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-full mt-1 w-40 rounded border border-(--border-strong) bg-(--bg-elevated) shadow-xl py-1 z-50 overflow-hidden"
                      >
                        <button
                          onClick={(e) => openRenameModal(e, chat)}
                          className="w-full text-left px-3 py-2 text-xs text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary) flex items-center gap-2 transition-colors"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Rename
                        </button>
                        <button
                          onClick={(e) => openDeleteModal(e, chat)}
                          className="w-full text-left px-3 py-2 text-xs text-(--accent-red) hover:bg-(--accent-red-dim) flex items-center gap-2 transition-colors"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Colour stripe — unique per chat */}
              {viewMode === 'grid' && (
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t opacity-60"
                  style={{ background: `hsl(${(chat.id?.charCodeAt(0) || 0) * 37 % 360}, 65%, 55%)` }} />
              )}

              {/* Icon */}
              <div className={viewMode === 'grid' ? 'mb-auto' : ''}>
                <div className="w-7 h-7 rounded bg-(--accent-cyan-dim) flex items-center justify-center text-(--accent-cyan)">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className={viewMode === 'list' ? 'flex-1 flex items-center justify-between pr-10' : ''}>
                <div className={viewMode === 'list' ? 'flex-1' : ''}>
                  <h3 className={`font-medium text-(--text-primary) line-clamp-2 ${viewMode === 'grid' ? 'text-sm mb-2 pr-6' : 'text-sm'}`}>
                    {chat.title}
                  </h3>
                  {viewMode === 'grid' && (
                    <p className="text-xs text-(--text-muted) flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)' }}>
                      {new Date(chat.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span>·</span>
                      {chat.sources?.length || 0} sources
                    </p>
                  )}
                </div>

                {viewMode === 'list' && (
                  <div className="text-xs text-(--text-muted) flex items-center gap-4 shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                    <span>{chat.sources?.length || 0} sources</span>
                    <span>{new Date(chat.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── About GraphLM ── */}
      <div className="mt-16 border-t border-(--border-subtle) pt-10 pb-6">
        <p className="text-[10px] font-mono text-(--text-muted) uppercase tracking-[0.18em] mb-10">About GraphLM</p>

        {/* Row 1 — 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">

          <div className="rounded-xl border border-(--border-subtle) bg-(--bg-elevated) p-6">
            <p className="text-[10px] font-mono text-(--accent-cyan) uppercase tracking-widest mb-3">The Product</p>
            <p className="text-sm text-(--text-secondary) leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
              GraphLM turns your documents into a living, queryable knowledge graph. Attach a PDF, a GitHub repository, or a URL — and instead of a flat search index, you get an intelligent structure where facts, entities, and relationships are first-class citizens. Ask it anything. It doesn't retrieve keywords; it understands context.
            </p>
          </div>

          <div className="rounded-xl border border-(--border-subtle) bg-(--bg-elevated) p-6">
            <p className="text-[10px] font-mono text-(--accent-cyan) uppercase tracking-widest mb-3">The Idea</p>
            <p className="text-sm text-(--text-secondary) leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
              Vanilla RAG retrieves semantically similar chunks — but documents aren't flat collections of facts. A research paper, a codebase, a legal brief — all carry rich relational structure that embeddings quietly flatten and discard. GraphLM was born from one question: what if an AI could navigate your documents the way a graph database navigates data, preserving every relationship, not just every sentence?
            </p>
          </div>

          <div className="rounded-xl border border-(--border-subtle) bg-(--bg-elevated) p-6">
            <p className="text-[10px] font-mono text-(--accent-cyan) uppercase tracking-widest mb-3">The Stack</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'FastAPI', 'PostgreSQL', 'SQLAlchemy', 'Alembic',
                'Qdrant', 'Neo4j', 'LlamaIndex', 'OpenAI GPT-4o-mini',
                'OpenAI Agents SDK', 'Mem0', 'React 19', 'Vite',
                'TailwindCSS v4', 'Zustand 5', 'vis-network',
                'Cloudinary', 'GitHub OAuth',
              ].map(t => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded border border-(--border-subtle) bg-(--bg-surface) text-(--text-muted)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2 — 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          <div className="rounded-xl border border-(--border-subtle) bg-(--bg-elevated) p-6">
            <p className="text-[10px] font-mono text-(--accent-cyan) uppercase tracking-widest mb-3">How It Works</p>
            <p className="text-sm text-(--text-secondary) leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
              Every document you attach is processed through a dual-index pipeline — a vector index in Qdrant for semantic similarity, and a knowledge graph in Neo4j where entities, concepts, and their relationships are extracted and stored as nodes and edges. At query time, both indexes are consulted simultaneously: the graph provides structured relational grounding while the vector index surfaces the most contextually relevant passages. The OpenAI Agents SDK orchestrates the retrieval-generation loop, and Mem0 gives the agent persistent memory across sessions so context doesn't evaporate between conversations.
            </p>
          </div>

          <div className="rounded-xl border border-(--border-subtle) bg-(--bg-elevated) p-6">
            <p className="text-[10px] font-mono text-(--accent-cyan) uppercase tracking-widest mb-3">How It Came to Life</p>
            <p className="text-sm text-(--text-secondary) leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
              GraphLM started as a final-year BE project — a deliberate attempt to build something at the genuine intersection of knowledge representation and generative AI, not just another wrapper around an LLM. The architecture was designed production-grade from the first commit: real-time indexing status via PostgreSQL <span className="font-mono text-(--text-primary) text-xs">LISTEN/NOTIFY</span>, JWT authentication with refresh tokens, GitHub OAuth, per-user rate limiting, and a streaming chat interface built with SSE. What began as a thesis became a system that can answer questions no flat-file search engine ever could — grounded, relational, honest about its sources.
            </p>
          </div>

        </div>

        <p className="mt-12 text-[11px] text-(--text-muted) font-mono text-center" style={{ opacity: 0.35, letterSpacing: '0.12em' }}>
          GRAPHLM · KNOWLEDGE GRAPH INTELLIGENCE · {new Date().getFullYear()}
        </p>
      </div>

      {/* Rename / Delete Modals */}
      {modalConfig.type && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="flex items-center justify-between px-6 py-4 border-b border-(--border-subtle)">
              <h3 className="text-sm font-semibold text-(--text-primary)" style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {modalConfig.type === 'rename' ? 'Rename Chat' : modalConfig.type === 'deleteBulk' ? 'Delete Selected Chats' : 'Delete Chat'}
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
              ) : modalConfig.type === 'deleteBulk' ? (
                <p className="text-(--text-secondary) text-sm">
                  Are you sure you want to delete <span className="font-semibold text-(--text-primary)">{selectedChats.length} selected chats</span>? This action cannot be undone.
                </p>
              ) : (
                <p className="text-(--text-secondary) text-sm">
                  Are you sure you want to delete <span className="font-semibold text-(--text-primary)">"{modalConfig.session?.title}"</span>? This action cannot be undone.
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
                onClick={modalConfig.type === 'rename' ? confirmRename : modalConfig.type === 'deleteBulk' ? confirmBulkDelete : confirmDelete}
                className={modalConfig.type === 'rename' ? 'btn-primary' : 'btn-danger'}
              >
                {modalConfig.type === 'rename' ? 'Save' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Dashboard
