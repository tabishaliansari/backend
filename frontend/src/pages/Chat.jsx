import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, PanelLeftOpen, PanelRightOpen, GitBranch, Sparkles, X, BookOpen, AlertTriangle, Play, RefreshCw } from 'lucide-react'
import { useChatStore } from '@/store'
import sourceService from '@/api/sourceService'
import docService from '@/api/docService'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels"
import { toast } from 'sonner'

// Import our new panel components
import SourcesPanel from '@/Components/Chat/SourcesPanel'
import ChatPanel from '@/Components/Chat/ChatPanel'
import StudioPanel from '@/Components/Chat/StudioPanel'
import AddSourceModal from '@/Components/Chat/AddSourceModal'

function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()

  const FileIcon = ({ filename, className }) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <img src="/fileIcons/file-pdf.svg" alt="PDF" className={className} />;
    if (ext === 'doc' || ext === 'docx') return <img src="/fileIcons/file-docx.svg" alt="Word" className={className} />;
    if (ext === 'md' || ext === 'markdown') return <img src="/fileIcons/file-code.svg" alt="Markdown" className={className} />;
    return <img src="/fileIcons/file-text-dark.svg" alt="Text" className={className} />;
  };

  const { sessions, fetchSessions, fetchMessages } = useChatStore()

  // Make sure sessions are loaded
  useEffect(() => {
    if (!sessions.length) {
      fetchSessions()
    }
  }, [sessions.length, fetchSessions])

  useEffect(() => {
    if (id) {
      fetchMessages(id)
    }
  }, [id, fetchMessages])

  const currentSession = useMemo(() => {
    return sessions.find(s => s.id === id)
  }, [sessions, id])

  const [sourceProgress, setSourceProgress] = useState({})

  // ── Selected-sources for Canvas scoping ──────────────────────────────
  // Defaults to all source IDs (all selected) every time a session is opened.
  const [selectedSources, setSelectedSources] = useState([])

  useEffect(() => {
    if (currentSession?.sources) {
      setSelectedSources(currentSession.sources.map(s => s.id))
    }
  }, [currentSession?.id])

  // Panel refs and state
  const studioPanelRef = useRef(null)
  const [isSourcesOpen, setIsSourcesOpen] = useState(true)
  const [isStudioOpen, setIsStudioOpen] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [activeCanvasTool, setActiveCanvasTool] = useState(null)

  // Documentation Generation States
  const [showDocsConfigModal, setShowDocsConfigModal] = useState(false)
  const [isRegenMode, setIsRegenMode] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStatus, setGenerationStatus] = useState('pending')
  const [generationDocId, setGenerationDocId] = useState(null)
  const [docRefreshTrigger, setDocRefreshTrigger] = useState(0)

  // Config Form State
  const [config, setConfig] = useState({
    model: 'gpt-4o-mini',
    style: 'technical',
    detail_level: 'comprehensive',
    include_apis: true,
    include_examples: true,
    include_architecture_diagram: true
  })

  const selectedGithubSource = useMemo(() => {
    if (selectedSources.length !== 1) return null
    const source = currentSession?.sources?.find(s => s.id === selectedSources[0])
    return source?.type === 'github' ? source : null
  }, [selectedSources, currentSession?.sources])

  const sseRef = useRef(null)

  const cleanupSSE = () => {
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
    }
  }

  const connectSSE = (docGenId) => {
    cleanupSSE()
    if (!id) return
    const streamUrl = docService.getStreamUrl(id, docGenId)
    const es = new EventSource(streamUrl, { withCredentials: true })
    sseRef.current = es

    es.addEventListener('snapshot', (e) => {
      const data = JSON.parse(e.data)
      setGenerationProgress(data.progress_percent || 0)
      setGenerationStatus(data.status || 'pending')
    })

    es.addEventListener('doc_gen_status_changed', (e) => {
      const data = JSON.parse(e.data)
      setGenerationProgress(data.progress_percent || 0)
      setGenerationStatus(data.status || 'generating')
    })

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data)
      cleanupSSE()
      if (data.status === 'completed') {
        toast.success('Documentation generated successfully!')
        setIsGenerating(false)
        setGenerationProgress(100)
        setGenerationStatus('completed')
        setDocRefreshTrigger(prev => prev + 1)
      } else {
        toast.error(data.error_message || 'Generation failed.')
        setIsGenerating(false)
        setGenerationStatus('failed')
      }
    })

    es.onerror = (err) => {
      console.error('SSE connection error:', err)
      cleanupSSE()
      setIsGenerating(false)
      setGenerationStatus('failed')
    }
  }

  // Effect to auto-reconnect to SSE on load or selection change if already generating
  useEffect(() => {
    if (!selectedGithubSource || !id) {
      setIsGenerating(false)
      cleanupSSE()
      return
    }

    let active = true
    async function checkActiveDoc() {
      try {
        const res = await docService.getBySource(id, selectedGithubSource.id)
        if (!active) return
        if (res.success && res.data && res.data.exists) {
          const data = res.data
          if (data.status === 'generating' || data.status === 'pending') {
            setIsGenerating(true)
            setGenerationProgress(data.progress_percent || 0)
            setGenerationStatus(data.status)
            setGenerationDocId(data.doc_gen_id)
            connectSSE(data.doc_gen_id)
          } else {
            setIsGenerating(false)
            cleanupSSE()
          }
        } else {
          setIsGenerating(false)
          cleanupSSE()
        }
      } catch (err) {
        if (active) {
          setIsGenerating(false)
          cleanupSSE()
        }
      }
    }

    checkActiveDoc()

    return () => {
      active = false
      cleanupSSE()
    }
  }, [selectedGithubSource, id])

  const handleStartGeneration = async () => {
    if (!selectedGithubSource || !id) return
    try {
      setIsGenerating(true)
      setGenerationProgress(0)
      setGenerationStatus('pending')
      setShowDocsConfigModal(false)
      setActiveCanvasTool(null) // Return to Canvas Home to see progress

      const payload = {
        source_id: selectedGithubSource.id,
        config: {
          ...config,
          force_regenerate: isRegenMode
        }
      }
      const res = await docService.generateDocs(id, payload)
      if (res.success && res.data) {
        const docGenId = res.data.id
        setGenerationDocId(docGenId)
        setGenerationProgress(res.data.progress_percent || 0)
        setGenerationStatus(res.data.status || 'pending')
        connectSSE(docGenId)
        setDocRefreshTrigger(prev => prev + 1)
      } else {
        setIsGenerating(false)
      }
    } catch (err) {
      toast.error('Failed to initiate documentation generation.')
      setIsGenerating(false)
    }
  }

  const handleOpenDocsConfig = (isRegen = false) => {
    if (isGenerating) return
    setIsRegenMode(isRegen)
    setShowDocsConfigModal(true)
  }

  const handleDocDeleted = () => {
    setDocRefreshTrigger(prev => prev + 1)
    setActiveCanvasTool(null)
  }



  const handleOpenSource = (source) => {
    const meta = source.metadata || source.source_metadata || {};
    const url = meta.repo_url || meta.file_url || meta.cloudinary_url || meta.local_path;

    if (url) {
      // Create an anchor tag to bypass async popup blockers
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      toast.error('No URL available for this source.');
    }
  };

  // Subscribe to SSE for active indexing sources
  useEffect(() => {
    if (!currentSession || !currentSession.sources) return;

    const activeSources = currentSession.sources.filter(s => s.status !== 'indexed' && s.status !== 'failed');
    if (activeSources.length === 0) return;

    const eventSources = [];

    activeSources.forEach(source => {
      const es = sourceService.subscribeToSourceStatus(source.id, {
        onSnapshot: (data) => {
          setSourceProgress(prev => ({
            ...prev,
            [source.id]: {
              vector_indexed: data.vector?.indexed || false,
              graph_indexed: data.graph?.indexed || false
            }
          }));
        },
        onIndexChanged: (data) => {
          setSourceProgress(prev => {
            const prevProgress = prev[source.id] || {};
            const nextVectorIndexed = data.vector_indexed !== undefined ? data.vector_indexed : (prevProgress.vector_indexed || false);
            const nextGraphIndexed = data.graph_indexed !== undefined ? data.graph_indexed : (prevProgress.graph_indexed || false);
            return {
              ...prev,
              [source.id]: {
                vector_indexed: nextVectorIndexed,
                graph_indexed: nextGraphIndexed
              }
            };
          });
        },
        onComplete: () => {
          fetchSessions(); // Refresh session to get updated sources status
        }
      }, source.title);
      eventSources.push(es);
    });

    return () => {
      eventSources.forEach(es => es.close());
    };
  }, [currentSession, fetchSessions]);

  const isVectorIndexing = useMemo(() => {
    if (!currentSession || !currentSession.sources) return false;
    // Chat is disabled if any source is currently indexing and its vector is not yet indexed
    return currentSession.sources.some(s => {
      if (s.status === 'indexed' || s.status === 'failed') return false;
      const progress = sourceProgress[s.id];
      // If we haven't received a snapshot yet, assume it's indexing and block
      if (!progress) return true;
      return !progress.vector_indexed;
    });
  }, [currentSession, sourceProgress]);

  // Programmatically auto-resize the Studio Panel width when opening/closing Docs
  useEffect(() => {
    if (studioPanelRef.current) {
      if (activeCanvasTool === 'docs') {
        studioPanelRef.current.resize(40)
      } else {
        studioPanelRef.current.resize(30)
      }
    }
  }, [activeCanvasTool])

  const sessionDate = currentSession?.created_at
    ? new Date(currentSession.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Today'

  return (
    <div className="flex h-full min-h-0 flex-col bg-(--bg-base)">
      {/* Top Header */}
      <div className="border-b border-(--border-subtle) px-4 py-2 flex items-center justify-between bg-(--bg-surface) shrink-0">
        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-1.5 rounded text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover) transition-colors shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex flex-col min-w-0">
            <h1 className="text-sm font-semibold text-(--text-primary) leading-tight truncate" style={{ fontFamily: 'var(--font-mono)' }}>
              {currentSession?.title || 'Loading session...'}
            </h1>
            <span className="text-[11px] text-(--text-muted) font-mono">
              {currentSession?.sources?.length || 0} source{currentSession?.sources?.length !== 1 ? 's' : ''} · {sessionDate}
            </span>
          </div>
        </div>

        {/* Right: panel toggles */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsSourcesOpen(v => !v)}
            title={isSourcesOpen ? 'Collapse Sources' : 'Open Sources'}
            className={`p-1.5 rounded transition-colors ${isSourcesOpen ? 'text-(--text-primary) bg-(--bg-hover)' : 'text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover)'}`}
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsStudioOpen(v => !v)}
            title={isStudioOpen ? 'Collapse Canvas' : 'Open Canvas'}
            className={`p-1.5 rounded transition-colors ${isStudioOpen ? 'text-(--text-primary) bg-(--bg-hover)' : 'text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover)'}`}
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex">
        {/* Collapsed Sources Toolbar */}
        {!isSourcesOpen && (
          <div className="w-14 shrink-0 h-full bg-(--bg-surface) border-r border-(--border-subtle) flex flex-col items-center py-3 gap-3">
            <button
              onClick={() => setIsSourcesOpen(true)}
              className="group relative p-2 rounded text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover) transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
              <div className="absolute left-full ml-3 px-2 py-1 bg-(--bg-elevated) text-(--text-primary) text-xs rounded border border-(--border-default) opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none" style={{ fontFamily: 'var(--font-mono)' }}>
                Open Sources
              </div>
            </button>
            <div className="flex flex-col gap-2 w-full px-2">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="group relative p-2 rounded bg-(--bg-elevated) text-(--text-muted) hover:text-(--accent-cyan) hover:bg-(--accent-cyan-dim) flex items-center justify-center transition-colors"
              >
                <span className="text-base leading-none">+</span>
                <div className="absolute left-full ml-3 px-2 py-1 bg-(--bg-elevated) text-(--text-primary) text-xs rounded border border-(--border-default) opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none" style={{ fontFamily: 'var(--font-mono)' }}>
                  Add Source
                </div>
              </button>
              {currentSession?.sources?.map(s => (
                <div
                  key={s.id}
                  onClick={() => handleOpenSource(s)}
                  className="group relative w-full aspect-square rounded bg-(--bg-elevated) flex items-center justify-center cursor-pointer hover:bg-(--bg-hover) transition-colors"
                >
                  {s.type === 'github' ? (
                    <GitBranch className="w-4 h-4 text-(--text-muted)" />
                  ) : (
                    <FileIcon filename={s.title} className="w-4 h-4" />
                  )}
                  <div className="absolute left-full ml-3 px-2 py-1 bg-(--bg-elevated) text-(--text-primary) text-xs rounded border border-(--border-default) opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none" style={{ fontFamily: 'var(--font-mono)' }}>
                    {s.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <PanelGroup direction="horizontal">
            {/* Panel 1: Sources */}
            {isSourcesOpen && (
              <>
                <Panel defaultSize="20" minSize="15" maxSize="40">
                  <SourcesPanel
                    currentSession={currentSession}
                    sourceProgress={sourceProgress}
                    onCollapse={() => setIsSourcesOpen(false)}
                    onOpenAddModal={() => setIsAddModalOpen(true)}
                    handleOpenSource={handleOpenSource}
                    selectedSources={selectedSources}
                    onSelectionChange={setSelectedSources}
                    isGraphViewOpen={activeCanvasTool === 'graph'}
                  />
                </Panel>
                <PanelResizeHandle className="w-px bg-(--border-subtle) hover:bg-(--accent-cyan) active:bg-(--accent-cyan) transition-colors cursor-col-resize z-10" />
              </>
            )}

            {/* Panel 2: Chat */}
            <Panel defaultSize="50" minSize="30">
              <ChatPanel
                currentSession={currentSession}
                isVectorIndexing={isVectorIndexing}
                selectedSources={selectedSources}
              />
            </Panel>

            {/* Panel 3: Studio */}
            {isStudioOpen && (
              <>
                <PanelResizeHandle className="w-px bg-(--border-subtle) hover:bg-(--accent-cyan) active:bg-(--accent-cyan) transition-colors cursor-col-resize z-10" />
                <Panel ref={studioPanelRef} defaultSize="30" minSize="20" maxSize="50">
                  <StudioPanel
                    onCollapse={() => setIsStudioOpen(false)}
                    currentSession={currentSession}
                    selectedSources={selectedSources}
                    onActiveToolChange={setActiveCanvasTool}
                    activeTool={activeCanvasTool}
                    onOpenDocsConfig={handleOpenDocsConfig}
                    isGenerating={isGenerating}
                    generationProgress={generationProgress}
                    generationStatus={generationStatus}
                    docRefreshTrigger={docRefreshTrigger}
                    onDocDeleted={handleDocDeleted}
                  />
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>

        {/* Collapsed Studio Toolbar */}
        {!isStudioOpen && (
          <div className="w-14 shrink-0 h-full bg-(--bg-surface) border-l border-(--border-subtle) flex flex-col items-center py-3 gap-3">
            <button
              onClick={() => setIsStudioOpen(true)}
              className="group relative p-2 rounded text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover) transition-colors"
            >
              <PanelRightOpen className="w-4 h-4" />
              <div className="absolute right-full mr-3 px-2 py-1 bg-(--bg-elevated) text-(--text-primary) text-xs rounded border border-(--border-default) opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none" style={{ fontFamily: 'var(--font-mono)' }}>
                Open Studio
              </div>
            </button>
            <div className="flex flex-col gap-2 w-full px-2">
              <div className="group relative w-full aspect-square rounded bg-(--bg-elevated) flex items-center justify-center text-(--accent-cyan) cursor-pointer hover:bg-(--accent-cyan-dim) transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5" /><path d="M21 3 9 15" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>
                <div className="absolute right-full mr-3 px-2 py-1 bg-(--bg-elevated) text-(--text-primary) text-xs rounded border border-(--border-default) opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none" style={{ fontFamily: 'var(--font-mono)' }}>
                  Graph Tools
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AddSourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        currentSession={currentSession}
      />

      {/* Centralized Documentation Config Modal */}
      {showDocsConfigModal && (
        <div 
          onClick={() => setShowDocsConfigModal(false)}
          className="fixed inset-0 bg-(--bg-surface)/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs p-5 rounded border border-(--border-strong) bg-(--bg-elevated) flex flex-col gap-4 shadow-2xl animate-fade-in max-h-full overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-(--border-subtle) pb-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-(--accent-cyan)" />
                <span className="text-xs font-semibold uppercase tracking-wider text-(--text-primary) font-mono">
                  {isRegenMode ? 'Regenerate Documentation' : 'Configure Docs'}
                </span>
              </div>
              <button
                onClick={() => setShowDocsConfigModal(false)}
                className="text-(--text-muted) hover:text-(--text-primary) p-0.5 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3.5 min-h-0 overflow-y-auto pr-0.5">
              {selectedGithubSource && (
                <div className="p-2.5 rounded bg-(--bg-surface) border border-(--border-subtle)">
                  <h4 className="text-[11px] font-semibold text-(--text-primary) font-mono flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3 text-(--accent-cyan)" />
                    {selectedGithubSource.title}
                  </h4>
                </div>
              )}

              {isRegenMode && (
                <div className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-(--accent-amber-dim) border border-(--accent-amber)/20 text-[9px] text-(--accent-amber) font-mono leading-normal">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Warning: Existing documentation will be overwritten.</span>
                </div>
              )}

              {/* Model selection */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-(--text-muted) tracking-wider font-mono">
                  AI Pipeline Model
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, model: 'gpt-4o-mini' }))}
                    className={`p-2 rounded border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                      config.model === 'gpt-4o-mini'
                        ? 'bg-(--accent-cyan-dim) border-(--accent-cyan) text-(--accent-cyan)'
                        : 'bg-(--bg-surface) border-(--border-subtle) text-(--text-secondary) hover:border-(--border-strong)'
                    }`}
                  >
                    <span className="text-[10px] font-medium font-mono">gpt-4o-mini</span>
                    <span className="text-[8px] opacity-75 leading-tight">Standard, balanced.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, model: 'o1-mini' }))}
                    className={`p-2 rounded border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                      config.model === 'o1-mini'
                        ? 'bg-(--accent-cyan-dim) border-(--accent-cyan) text-(--accent-cyan)'
                        : 'bg-(--bg-surface) border-(--border-subtle) text-(--text-secondary) hover:border-(--border-strong)'
                    }`}
                  >
                    <span className="text-[10px] font-medium font-mono">o1-mini</span>
                    <span className="text-[8px] opacity-75 leading-tight">Deep reasoning.</span>
                  </button>
                </div>
                {config.model === 'o1-mini' && (
                  <div className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-(--accent-amber-dim) border border-(--accent-amber)/20 text-[8px] text-(--accent-amber) font-mono leading-normal">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>Notice: o1-mini will take 2-3 minutes.</span>
                  </div>
                )}
              </div>

              {/* Style Selection */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-(--text-muted) tracking-wider font-mono">
                  Style
                </label>
                <select
                  value={config.style}
                  onChange={(e) => setConfig(prev => ({ ...prev, style: e.target.value }))}
                  className="w-full bg-(--bg-surface) border border-(--border-subtle) focus:border-(--accent-cyan) rounded px-2 py-1.5 text-[11px] text-(--text-primary) font-mono outline-none cursor-pointer"
                >
                  <option value="technical">Technical Reference</option>
                  <option value="beginner-friendly">Beginner Friendly</option>
                  <option value="executive">Executive Summary</option>
                </select>
              </div>

              {/* Detail selection */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-(--text-muted) tracking-wider font-mono">
                  Detail Level
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {['minimal', 'medium', 'comprehensive'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, detail_level: lvl }))}
                      className={`py-1 rounded border text-center text-[10px] font-mono capitalize cursor-pointer transition-all ${
                        config.detail_level === lvl
                          ? 'bg-(--accent-cyan-dim) border-(--accent-cyan) text-(--accent-cyan)'
                          : 'bg-(--bg-surface) border-(--border-subtle) text-(--text-secondary) hover:border-(--border-strong)'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-1.5 pt-2 border-t border-(--border-subtle)">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-[10px] text-(--text-secondary) group-hover:text-(--text-primary) font-mono">API References</span>
                  <input
                    type="checkbox"
                    checked={config.include_apis}
                    onChange={(e) => setConfig(prev => ({ ...prev, include_apis: e.target.checked }))}
                    className="rounded border-(--border-default) bg-(--bg-surface) accent-(--accent-cyan) w-3.5 h-3.5 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-[10px] text-(--text-secondary) group-hover:text-(--text-primary) font-mono">Code Examples</span>
                  <input
                    type="checkbox"
                    checked={config.include_examples}
                    onChange={(e) => setConfig(prev => ({ ...prev, include_examples: e.target.checked }))}
                    className="rounded border-(--border-default) bg-(--bg-surface) accent-(--accent-cyan) w-3.5 h-3.5 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-[10px] text-(--text-secondary) group-hover:text-(--text-primary) font-mono">Architecture Diagrams</span>
                  <input
                    type="checkbox"
                    checked={config.include_architecture_diagram}
                    onChange={(e) => setConfig(prev => ({ ...prev, include_architecture_diagram: e.target.checked }))}
                    className="rounded border-(--border-default) bg-(--bg-surface) accent-(--accent-cyan) w-3.5 h-3.5 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-(--border-subtle) shrink-0">
              <button
                onClick={handleStartGeneration}
                className="w-full h-8 flex items-center justify-center gap-1.5 bg-(--accent-cyan) hover:bg-(--accent-cyan)/90 text-(--bg-base) rounded text-[11px] font-bold font-mono cursor-pointer transition-colors"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isRegenMode ? 'Regenerate' : 'Start Generation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Chat
