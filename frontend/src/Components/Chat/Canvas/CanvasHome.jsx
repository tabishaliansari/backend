import { useState, useEffect } from 'react'
import { Network, FileText, ChevronRight, Info, RefreshCw } from 'lucide-react'
import docService from '@/api/docService'
import { getProgressStage } from '@/utils/docProgress'


const tools = [
  {
    id: 'graph',
    name: 'Graph View',
    description: 'Explore knowledge as an interactive network',
    icon: Network,
    iconColor: 'text-(--accent-cyan)',
    iconBg: 'bg-(--accent-cyan-dim)',
    available: true,
  },
  {
    id: 'docs',
    name: 'Docs',
    description: 'Generate structured documentation from sources',
    icon: FileText,
    iconColor: 'text-(--accent-cyan)',
    iconBg: 'bg-(--accent-cyan-dim)',
    available: true,
  },
]

export function CanvasHome({ 
  onSelectTool, 
  selectedSources = [], 
  currentSession, 
  onOpenDocsConfig,
  isGenerating,
  generationProgress,
  generationStatus,
  docRefreshTrigger
}) {
  const [existingDoc, setExistingDoc] = useState(null)
  const [loadingDocCheck, setLoadingDocCheck] = useState(false)

  const hasSelection = selectedSources.length > 0

  // Resolve selected sources details
  const selectedSourcesDetails = selectedSources.map(id =>
    currentSession?.sources?.find(s => s.id === id)
  ).filter(Boolean)

  const hasSingleGithub = selectedSourcesDetails.length === 1 && selectedSourcesDetails[0].type === 'github'
  const activeGithubSource = hasSingleGithub ? selectedSourcesDetails[0] : null

  // Fetch existing completed document for the checked source
  useEffect(() => {
    if (!activeGithubSource || !currentSession?.id) {
      setExistingDoc(null)
      return
    }

    let active = true
    async function checkDoc() {
      try {
        setLoadingDocCheck(true)
        const res = await docService.getBySource(currentSession.id, activeGithubSource.id)
        if (!active) return
        if (res.success && res.data && res.data.exists && res.data.status === 'completed') {
          setExistingDoc(res.data)
        } else {
          setExistingDoc(null)
        }
      } catch (err) {
        if (active) setExistingDoc(null)
      } finally {
        if (active) setLoadingDocCheck(false)
      }
    }

    checkDoc()
    return () => { active = false }
  }, [activeGithubSource, currentSession?.id, docRefreshTrigger])



  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Info banner — shown when nothing is selected */}
      {!hasSelection && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded bg-(--accent-amber-dim) border border-(--accent-amber)/30 mb-1">
          <Info className="w-3.5 h-3.5 text-(--accent-amber) shrink-0 mt-0.5" />
          <p className="text-xs text-(--accent-amber) leading-snug" style={{ fontFamily: 'var(--font-mono)' }}>
            Select at least one source from the left panel to enable Canvas tools.
          </p>
        </div>
      )}

      <p className="text-[10px] text-(--text-muted) font-medium uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
        Tools
      </p>
      <div className="space-y-3">
        {tools.map((tool) => {
          const isActive = tool.id === 'docs' 
            ? (hasSingleGithub && !isGenerating) 
            : (tool.available && hasSelection)
          const isDisabled = !isActive
          const disabledReason = tool.id === 'docs'
            ? (isGenerating ? 'Generating documentation...' : (!hasSelection ? 'Select sources to enable' : (!hasSingleGithub ? 'Requires exactly 1 GitHub source selected' : '')))
            : (!hasSelection ? 'Select sources to enable' : 'Coming soon')

          const handleToolClick = () => {
            if (!isActive) return
            if (tool.id === 'docs') {
              if (existingDoc) {
                onSelectTool('docs')
              } else {
                onOpenDocsConfig?.(false)
              }
            } else {
              onSelectTool(tool.id)
            }
          }

          return (
            <button
              key={tool.id}
              onClick={handleToolClick}
              disabled={isDisabled}
              title={disabledReason}
              className={`
                group relative w-full flex items-center gap-3 p-3 rounded border text-left transition-all duration-150
                ${isActive
                  ? 'bg-(--bg-elevated) border-(--border-default) hover:border-(--accent-cyan) hover:bg-(--bg-hover) cursor-pointer'
                  : 'bg-(--bg-surface) border-(--border-subtle) cursor-not-allowed opacity-50'
                }
              `}
            >
              <div className={`shrink-0 w-8 h-8 rounded flex items-center justify-center ${tool.iconBg}`}>
                {tool.id === 'docs' && isGenerating ? (
                  <RefreshCw className="w-4 h-4 text-(--accent-cyan) animate-spin" />
                ) : (
                  <tool.icon className={`w-4 h-4 ${tool.iconColor}`} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-(--text-primary)" style={{ fontFamily: 'var(--font-mono)' }}>
                    {tool.name}
                  </span>
                  {!tool.available && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-(--bg-hover) text-(--text-muted) uppercase tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>
                      Soon
                    </span>
                  )}
                  {tool.available && !hasSelection && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-(--accent-amber-dim) text-(--accent-amber) uppercase tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>
                      Select sources
                    </span>
                  )}
                  {tool.id === 'docs' && isGenerating && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-(--accent-cyan-dim) text-(--accent-cyan) uppercase tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>
                      Generating
                    </span>
                  )}
                  {tool.id === 'docs' && !isGenerating && hasSelection && !hasSingleGithub && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-(--accent-amber-dim) text-(--accent-amber) uppercase tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>
                      1 GitHub Required
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-(--text-muted) mt-0.5 truncate">
                  {tool.description}
                </p>
              </div>

              {isActive && (
                <ChevronRight className="shrink-0 w-3.5 h-3.5 text-(--text-muted) group-hover:text-(--accent-cyan) transition-colors" />
              )}
            </button>
          )
        })}
      </div>

      {/* Saved Artifacts Section */}
      {activeGithubSource && (existingDoc || isGenerating) && (
        <div className="mt-4 pt-4 border-t border-(--border-subtle) space-y-2.5">
          <p className="text-[10px] text-(--text-muted) font-medium uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>
            Saved Artifacts
          </p>
          {isGenerating ? (
            <div className="w-full p-3 rounded border bg-(--bg-elevated)/45 border-(--border-default) space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-(--text-primary) font-mono flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 text-(--accent-cyan) animate-spin" />
                  Generating {activeGithubSource.title} Docs...
                </span>
                <span className="text-[10px] text-(--accent-cyan) font-mono font-semibold">
                  {generationProgress}%
                </span>
              </div>
              <div className="relative w-full h-1 rounded bg-(--bg-hover) overflow-hidden border border-(--border-subtle)">
                <div
                  className="absolute left-0 top-0 h-full rounded bg-linear-to-r from-(--accent-cyan) to-emerald-500 transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                ></div>
              </div>
              <div className="text-[9px] text-(--text-muted) font-mono truncate">
                {getProgressStage(generationProgress)}
              </div>
            </div>
          ) : (
            <button
              onClick={() => onSelectTool('docs')}
              className="w-full flex items-center gap-3 p-3 rounded border text-left bg-(--bg-elevated) border-(--border-default) hover:border-(--accent-cyan) hover:bg-(--bg-hover) cursor-pointer transition-all duration-150 group"
            >
              <div className="shrink-0 w-8 h-8 rounded flex items-center justify-center bg-(--accent-cyan-dim) text-(--accent-cyan)">
                <FileText className="w-4 h-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-(--text-primary) font-mono truncate block">
                  {activeGithubSource.title} Documentation
                </span>
                <span className="text-[10px] text-(--text-muted) font-mono mt-0.5 block">
                  1 source · {existingDoc?.completed_at ? new Date(existingDoc.completed_at).toLocaleDateString() : 'Just now'}
                </span>
              </div>
              
              <ChevronRight className="shrink-0 w-3.5 h-3.5 text-(--text-muted) group-hover:text-(--accent-cyan) transition-colors" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
