import { useState, useEffect, useMemo, useRef } from 'react'
import {
  FileText,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Play,
  Check,
  CheckCircle2,
  Menu,
  BookOpen,
  Coins,
  Clock,
  Cpu,
  Eye,
  Copy
} from 'lucide-react'
import docService from '@/api/docService'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getProgressStage } from '@/utils/docProgress'

export function DocsView({ 
  currentSession, 
  selectedSources = [], 
  onRequestRegen, 
  onDocDeleted, 
  docRefreshTrigger,
  isGenerating = false,
  generationProgress = 0,
}) {
  // --- STATE ---
  const [viewState, setViewState] = useState('checking') // checking, generating, cross_session, completed, failed
  const [activeSource, setActiveSource] = useState(null)
  const [docGenId, setDocGenId] = useState(null)
  const [docData, setDocData] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [crossSessionDocs, setCrossSessionDocs] = useState([])
  const [isTocOpen, setIsTocOpen] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const docContainerRef = useRef(null)

  // --- RESOLVE SELECTED GITHUB SOURCE ---
  const resolvedSource = useMemo(() => {
    if (selectedSources.length !== 1) return null
    const sourceId = selectedSources[0]
    const source = currentSession?.sources?.find(s => s.id === sourceId)
    return source?.type === 'github' ? source : null
  }, [selectedSources, currentSession?.sources])

  // Sync resolved source state
  useEffect(() => {
    setActiveSource(resolvedSource)
    if (!resolvedSource) {
      setViewState('checking')
    }
  }, [resolvedSource])

  // --- SYNC GENERATING STATE FROM PARENT SSE ---
  useEffect(() => {
    if (isGenerating) {
      setViewState('generating')
    }
  }, [isGenerating])

  // --- ON LOAD / SOURCE CHANGE: FETCH BY-SOURCE ---
  useEffect(() => {
    if (!activeSource || !currentSession?.id) return

    let active = true

    async function checkDocStatus() {
      try {
        setViewState('checking')
        const res = await docService.getBySource(currentSession.id, activeSource.id)
        
        if (!active) return

        if (res.success && res.data) {
          const data = res.data
          if (!data.exists) {
            // Fallback: If no doc exists, open configuration modal
            onRequestRegen?.()
            setViewState('failed')
            setErrorMessage('No documentation exists yet. Please configure and generate documentation.')
          } else if (data.owned_by_this_session) {
            setDocGenId(data.doc_gen_id)
            if (data.status === 'completed') {
              fetchFullDoc(data.doc_gen_id)
            } else if (data.status === 'failed') {
              setErrorMessage(data.error_message || 'Generation failed.')
              setViewState('failed')
            } else {
              setViewState('checking')
            }
          } else {
            // Document exists in another session! Show cross-session dialog
            setCrossSessionDocs(data.sessions_with_doc || [])
            setViewState('cross_session')
          }
        } else {
          setViewState('failed')
          setErrorMessage('Could not load documentation details.')
        }
      } catch (err) {
        if (active) {
          setViewState('failed')
          setErrorMessage('Could not load documentation details.')
        }
      }
    }

    checkDocStatus()

    return () => {
      active = false
    }
  }, [activeSource, currentSession?.id, docRefreshTrigger])

  // --- FETCH COMPLETED DOCUMENT DATA ---
  const fetchFullDoc = async (id) => {
    try {
      setViewState('checking')
      const res = await docService.getStatus(currentSession.id, id)
      if (res.success && res.data) {
        setDocData(res.data)
        setDocGenId(id)
        setViewState('completed')
      }
    } catch (err) {
      toast.error('Failed to load documentation content.')
      setViewState('failed')
      setErrorMessage('Failed to fetch full documentation markdown.')
    }
  }

  // --- TRIGGER CROSS-SESSION REUSE (COPY) ---
  const handleReuseDoc = async (targetDocGenId) => {
    try {
      setViewState('checking')
      const payload = {
        source_id: activeSource.id,
        reuse_from_doc_gen_id: targetDocGenId,
        config: {}
      }
      const res = await docService.generateDocs(currentSession.id, payload)
      if (res.success && res.data) {
        toast.success('Documentation linked to this session successfully!')
        setDocData(res.data)
        setDocGenId(res.data.id)
        setViewState('completed')
      }
    } catch (err) {
      toast.error('Failed to reuse documentation.')
      setViewState('cross_session')
    }
  }

  const confirmDeleteDocs = async () => {
    setShowDeleteConfirm(false)
    try {
      setViewState('checking')
      await docService.deleteDocs(currentSession.id, docGenId)
      toast.success('Documentation cleared successfully.')
      onDocDeleted?.()
    } catch (err) {
      console.error("Error deleting docs:", err)
      toast.error('Failed to clear documentation.')
      setViewState('completed')
    }
  }

  // --- SCROLL TO HEADING HELPER ---
  const scrollToHeading = (title) => {
    if (!docContainerRef.current) return
    // Match heading elements containing the text
    const headings = docContainerRef.current.querySelectorAll('h1, h2, h3, h4')
    for (let h of headings) {
      if (h.textContent.toLowerCase().includes(title.toLowerCase())) {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' })
        break
      }
    }
  }

  // --- WARNING STATE: NO SINGLE GITHUB SOURCE ---
  if (!activeSource) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center bg-(--bg-surface)">
        <div className="w-12 h-12 rounded bg-(--accent-amber-dim) border border-(--accent-amber)/20 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-(--accent-amber)" />
        </div>
        <h3 className="text-xs font-semibold text-(--text-primary) uppercase tracking-widest mb-1.5 font-mono">
          GitHub Source Required
        </h3>
        <p className="text-xs text-(--text-secondary) max-w-xs leading-relaxed mb-4">
          Documentation generation is restricted to exactly <strong>one</strong> selected GitHub repository source.
        </p>
        <div className="px-3.5 py-2.5 rounded bg-(--bg-elevated) border border-(--border-subtle) max-w-sm text-[11px] text-(--text-muted) font-mono leading-relaxed">
          Please check exactly one GitHub repository in the left <strong>Sources</strong> panel to use this feature.
        </div>
      </div>
    )
  }

  // --- 1. VIEW STATE: CHECKING / LOADING ---
  if (viewState === 'checking') {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-(--bg-surface)">
        <RefreshCw className="w-6 h-6 text-(--accent-cyan) animate-spin mb-3" />
        <p className="text-xs text-(--text-muted) font-mono uppercase tracking-wider">
          Querying documentation status...
        </p>
      </div>
    )
  }

  // --- 1b. VIEW STATE: GENERATING (LIVE SSE PROGRESS) ---
  if (viewState === 'generating') {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-(--bg-surface) p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-(--accent-cyan) animate-spin" />
            <h3 className="text-xs font-semibold text-(--text-primary) uppercase tracking-widest font-mono">
              Generating Documentation
            </h3>
          </div>

          <div className="p-4 rounded border bg-(--bg-elevated)/45 border-(--border-default) space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-(--text-secondary) font-mono">
                {activeSource?.title || 'Repository'}
              </span>
              <span className="text-xs text-(--accent-cyan) font-mono font-semibold">
                {generationProgress}%
              </span>
            </div>
            <div className="relative w-full h-1.5 rounded bg-(--bg-hover) overflow-hidden border border-(--border-subtle)">
              <div
                className="absolute left-0 top-0 h-full rounded bg-linear-to-r from-(--accent-cyan) to-emerald-500 transition-all duration-500"
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-(--text-muted) font-mono">
              {getProgressStage(generationProgress)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // --- 2. VIEW STATE: CROSS-SESSION REUSE ---
  if (viewState === 'cross_session') {
    return (
      <div className="flex flex-col h-full bg-(--bg-surface) p-4 justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-(--border-subtle)">
            <FileText className="w-4 h-4 text-(--accent-cyan)" />
            <h3 className="text-xs font-medium uppercase tracking-widest text-(--text-primary) font-mono">
              Documentation Exists
            </h3>
          </div>

          <div className="p-3.5 rounded bg-(--bg-elevated) border border-(--border-subtle) text-xs text-(--text-secondary) leading-relaxed">
            Completed documentation already exists for repository <strong>{activeSource.title}</strong> from your other chat sessions. You can instantly link it to this session or generate a fresh copy.
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase font-bold text-(--text-muted) tracking-wider font-mono">
              Reuse Existing Document
            </p>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {crossSessionDocs.map((item) => (
                <div
                  key={item.doc_gen_id}
                  className="p-3 rounded border border-(--border-subtle) bg-(--bg-elevated) hover:border-(--accent-cyan)/50 flex flex-col gap-2 transition-all"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-(--text-primary) truncate font-mono">
                      {item.session_title || 'Untitled Session'}
                    </span>
                    <span className="text-[10px] text-(--text-muted) font-mono">
                      Completed: {new Date(item.completed_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleReuseDoc(item.doc_gen_id)}
                    className="h-7 w-full bg-(--bg-surface) border border-(--border-default) hover:border-(--accent-cyan) hover:text-(--accent-cyan) flex items-center justify-center gap-1.5 text-[10px] font-medium font-mono rounded cursor-pointer transition-all"
                  >
                    <Check className="w-3 h-3" />
                    <span>Link to Current Session</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-(--border-subtle)">
          <button
            onClick={() => onRequestRegen?.()}
            className="w-full h-9 flex items-center justify-center gap-2 bg-(--bg-elevated) border border-(--border-default) hover:border-(--border-strong) hover:bg-(--bg-hover) text-(--text-primary) rounded text-xs font-semibold font-mono cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Fresh Document</span>
          </button>
        </div>
      </div>
    )
  }

  // --- 3. VIEW STATE: COMPLETED (DISPLAY) ---
  if (viewState === 'completed' && docData) {
    const sections = docData.sections_metadata?.sections || []
    const meta = docData.sections_metadata || {}

    return (
      <div className="flex flex-col h-full bg-(--bg-surface) relative">
        {/* Custom Deletion Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-(--bg-surface)/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xs p-5 rounded border border-(--border-subtle) bg-(--bg-elevated) flex flex-col gap-4 shadow-2xl">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-(--accent-red) shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-(--text-primary) uppercase tracking-widest font-mono">
                    Clear Cache
                  </h4>
                  <p className="text-[11px] text-(--text-secondary) mt-1.5 leading-relaxed font-sans">
                    Are you sure you want to clear the generated documentation cache for <strong>{activeSource.title}</strong>? This action is permanent.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 h-8 rounded border border-(--border-default) hover:border-(--border-strong) bg-(--bg-surface) text-[11px] font-medium font-mono cursor-pointer transition-colors text-(--text-secondary) hover:text-(--text-primary)"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteDocs}
                  className="flex-1 h-8 rounded bg-(--accent-red) hover:bg-(--accent-red)/90 text-(--bg-base) text-[11px] font-bold font-mono cursor-pointer transition-colors"
                >
                  Clear Docs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header Action Bar */}
        <div className="px-4 py-3.5 border-b border-(--border-subtle) flex items-center justify-between shrink-0 bg-(--bg-surface) z-10">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-(--accent-cyan)" />
            <h3 className="text-xs font-medium uppercase tracking-widest text-(--text-primary) font-mono truncate max-w-[150px]">
              {activeSource.title} Documentation
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Table of Contents Toggle */}
            {sections.length > 0 && (
              <button
                onClick={() => setIsTocOpen(v => !v)}
                className={`p-1.5 rounded border transition-colors cursor-pointer ${
                  isTocOpen
                    ? 'border-(--accent-cyan) bg-(--accent-cyan-dim) text-(--accent-cyan)'
                    : 'border-(--border-subtle) text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover)'
                }`}
                title="Toggle Table of Contents"
              >
                <Menu className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Regenerate Trigger */}
            <button
              onClick={() => onRequestRegen?.()}
              className="p-1.5 rounded border border-(--border-subtle) text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover) transition-colors cursor-pointer"
              title="Regenerate documentation"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Clear Trigger */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded border border-(--border-subtle) text-(--text-muted) hover:text-(--accent-red) hover:bg-(--accent-red-dim) transition-colors cursor-pointer"
              title="Clear documentation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Double-Pane Split Content View */}
        <div className="flex-1 min-h-0 flex">
          {/* Collapsible Left Pane: Table of Contents */}
          {isTocOpen && sections.length > 0 && (
            <div className="w-48 border-r border-(--border-subtle) bg-(--bg-surface) shrink-0 flex flex-col min-h-0">
              <div className="px-3 py-2 border-b border-(--border-subtle) bg-(--bg-elevated)/40">
                <span className="text-[9px] font-bold uppercase tracking-wider text-(--text-muted) font-mono flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-(--accent-cyan)" />
                  Outline
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
                {sections.map((sec, idx) => (
                  <button
                    key={idx}
                    onClick={() => scrollToHeading(sec.title)}
                    className="w-full text-left p-1.5 text-[11px] font-mono text-(--text-secondary) hover:text-(--accent-cyan) rounded hover:bg-(--bg-hover) transition-all truncate block"
                    style={{ paddingLeft: `${(sec.level || 1) * 6}px` }}
                    title={sec.title}
                  >
                    {sec.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Right Pane: Markdown Content rendering */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {/* Metadata Stats Pill Bar */}
            <div className="px-4 py-2 border-b border-(--border-subtle) bg-(--bg-elevated)/30 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-(--text-secondary) font-mono shrink-0 select-none">
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-(--accent-cyan)" />
                {meta.generated_model || 'gpt-4o-mini'}
              </span>
              {meta.estimated_cost_usd > 0 && (
                <span className="flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-(--accent-cyan)" />
                  ${meta.estimated_cost_usd.toFixed(4)}
                </span>
              )}
              {meta.generation_time_seconds > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-(--accent-cyan)" />
                  {meta.generation_time_seconds.toFixed(1)}s
                </span>
              )}
              {docData.completed_at && (
                <span className="text-(--text-muted) ml-auto">
                  Updated: {new Date(docData.completed_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Scrollable Markdown Area */}
            <div
              ref={docContainerRef}
              className="flex-1 overflow-y-auto p-5 scrollbar-thin space-y-4"
              style={{ contentVisibility: 'auto' }}
            >
              <article className="prose prose-sm max-w-none text-(--text-primary) font-sans leading-relaxed selection:bg-(--accent-cyan-dim) selection:text-(--accent-cyan)">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node, ...props }) => <h1 className="text-lg font-bold border-b border-(--border-subtle) pb-1 text-(--text-primary) font-mono mt-6 mb-3 uppercase tracking-wider" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-sm font-semibold text-(--accent-cyan) font-mono mt-5 mb-2.5 uppercase tracking-wide" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-xs font-semibold text-(--text-primary) font-mono mt-4 mb-2" {...props} />,
                    p: ({ node, ...props }) => <p className="text-xs text-(--text-secondary) leading-relaxed mb-3.5" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-1 mb-3.5 text-xs text-(--text-secondary)" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-1 mb-3.5 text-xs text-(--text-secondary)" {...props} />,
                    li: ({ node, ...props }) => <li className="pl-0.5 leading-relaxed" {...props} />,
                    a: ({ node, ...props }) => <a className="text-(--accent-cyan) underline hover:opacity-80 font-mono transition-opacity" target="_blank" rel="noopener noreferrer" {...props} />,
                    pre: ({ node, ...props }) => <pre className="p-3 bg-(--bg-elevated) border border-(--border-subtle) rounded font-mono text-[11px] text-(--text-secondary) overflow-x-auto my-3 scrollbar-thin leading-normal" style={{ backgroundColor: 'var(--bg-elevated)' }} {...props} />,
                    code: ({ node, inline, ...props }) => (
                      inline
                        ? <code className="px-1.5 py-0.5 bg-(--bg-elevated) border border-(--border-subtle) rounded font-mono text-[11px] text-(--text-secondary)" {...props} />
                        : <code {...props} />
                    ),
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto w-full my-3 border border-(--border-subtle) rounded scrollbar-thin">
                        <table className="w-full text-[11px] font-mono text-left border-collapse" {...props} />
                      </div>
                    ),
                    thead: ({ node, ...props }) => <thead className="bg-(--bg-elevated) border-b border-(--border-strong) text-(--text-primary)" {...props} />,
                    th: ({ node, ...props }) => <th className="px-3 py-1.5 font-semibold" {...props} />,
                    td: ({ node, ...props }) => <td className="px-3 py-1.5 border-b border-(--border-subtle) text-(--text-secondary)" {...props} />,
                    blockquote: ({ node, ...props }) => (
                      <blockquote className="pl-3.5 border-l-2 border-(--accent-cyan) italic text-(--text-secondary) my-3" {...props} />
                    )
                  }}
                >
                  {docData.generated_markdown}
                </ReactMarkdown>
              </article>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- 4. VIEW STATE: FAILED (ERROR VIEW) ---
  if (viewState === 'failed') {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center bg-(--bg-surface)">
        <div className="w-12 h-12 rounded bg-(--accent-red-dim) border border-(--accent-red)/20 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-(--accent-red)" />
        </div>
        <h3 className="text-xs font-semibold text-(--text-primary) uppercase tracking-widest mb-1.5 font-mono">
          Documentation Unavailable
        </h3>
        
        <div className="px-3.5 py-2.5 rounded bg-(--bg-elevated) border border-(--accent-red-dim) max-w-sm text-[11px] text-(--text-secondary) font-mono leading-relaxed mb-5 wrap-break-word">
          {errorMessage || 'Failed to retrieve completed documentation.'}
        </div>

        <button
          onClick={() => onRequestRegen?.()}
          className="h-9 px-5 flex items-center justify-center gap-2 bg-(--accent-cyan) hover:bg-(--accent-cyan)/90 text-(--bg-base) rounded text-xs font-semibold font-mono cursor-pointer transition-colors shadow-lg shadow-(--accent-cyan)/10"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Configure & Generate Docs</span>
        </button>
      </div>
    )
  }

  return null
}
