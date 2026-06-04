import { useEffect, useRef, useState } from 'react'
import { Network as NetworkIcon, Search, Loader2, Maximize2, Minimize2, RefreshCw, X } from 'lucide-react'
import { Network, DataSet } from 'vis-network/standalone'
import chatSessionService from '@/api/chatSessionService'

// Color palette per node label — aligned with Deep Space Terminal design tokens
const LABEL_COLORS = {
  default:  { background: '#00C896', border: '#00a07a', font: '#0C0C0E' },
  Person:   { background: '#9580ff', border: '#7358e8', font: '#0C0C0E' },
  Concept:  { background: '#00C896', border: '#00a07a', font: '#0C0C0E' },
  File:     { background: '#F59E0B', border: '#c47d08', font: '#0C0C0E' },
  Function: { background: '#F87171', border: '#c94f4f', font: '#0C0C0E' },
  Class:    { background: '#22d3ee', border: '#06b6d4', font: '#0C0C0E' },
  Module:   { background: '#a78bfa', border: '#7c5cc7', font: '#0C0C0E' },
}

function getLabelColor(label) {
  return LABEL_COLORS[label] || LABEL_COLORS.default
}

function buildVisData(graphData) {
  if (!graphData?.nodes?.length) return { nodes: new DataSet([]), edges: new DataSet([]) }

  const nodeItems = graphData.nodes.map((n) => {
    const color = getLabelColor(n.label)
    const name = n.properties?.name || n.properties?.title || n.label
    return {
      id: n.id,
      label: name.length > 25 ? name.slice(0, 24) + '…' : name,
      title: `<b>${n.label}</b><br/>${Object.entries(n.properties || {}).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join('<br/>')}`,
      color: { background: color.background, border: color.border, highlight: { background: color.border, border: color.background } },
      font: { color: color.font, size: 11, face: 'JetBrains Mono, monospace' },
      borderWidth: 1.5,
      shape: 'box',
      margin: 6,
    }
  })

  const edgeItems = graphData.edges.map((e, i) => ({
    id: `edge-${i}`,
    from: e.source,
    to: e.target,
    label: e.type || e.relationship_type || '',
    font: { size: 9, align: 'middle', color: '#55555E', strokeWidth: 0, face: 'JetBrains Mono, monospace' },
    color: { color: '#2a2a2e', highlight: '#00C896' },
    arrows: { to: { enabled: true, scaleFactor: 0.6 } },
    smooth: { type: 'cubicBezier', roundness: 0.3 },
  }))

  return { nodes: new DataSet(nodeItems), edges: new DataSet(edgeItems) }
}

const VIS_OPTIONS = {
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based',
    forceAtlas2Based: { gravitationalConstant: -50, springLength: 100 },
    stabilization: { iterations: 150 },
  },
  interaction: { hover: true, tooltipDelay: 150, navigationButtons: false },
  layout: { randomSeed: 42 },
}

export function GraphView({ currentSession, graphData, syncMode, onSetSyncMode, selectedSources = [] }) {
  const containerRef = useRef(null)
  const networkRef = useRef(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const mode = syncMode ? 'sync' : 'explore'

  // Helper: filter graph data to only include nodes whose source_id is in selectedSources,
  // then drop any edges whose endpoints were removed.
  const filterToSelection = (data) => {
    if (!selectedSources.length || !data?.nodes?.length) return data
    const allowedSet = new Set(selectedSources)
    const filteredNodes = data.nodes.filter(n => {
      const sid = n.properties?.source_id
      return !sid || allowedSet.has(sid)
    })
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id))
    const filteredEdges = (data.edges || []).filter(
      e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    )
    return { ...data, nodes: filteredNodes, edges: filteredEdges }
  }

  // Render/update graph when graphData changes
  useEffect(() => {
    if (!containerRef.current || !graphData) return
    setErrorMsg('')

    const { nodes, edges } = buildVisData(graphData)
    setNodeCount(nodes.length)
    setEdgeCount(edges.length)
    setIsEmpty(nodes.length === 0)

    if (networkRef.current) {
      networkRef.current.setData({ nodes, edges })
    } else {
      networkRef.current = new Network(containerRef.current, { nodes, edges }, VIS_OPTIONS)
    }
  }, [graphData])

  // Re-fetch full graph when selected sources change or mode changes (explore mode only)
  useEffect(() => {
    if (!currentSession || syncMode) return
    handleLoadFullGraph()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id, selectedSources, syncMode])

  const handleLoadFullGraph = async () => {
    if (!currentSession) return
    setIsLoading(true)
    setErrorMsg('')
    try {
      // Extract source IDs from selectedSources
      const sourceIds = selectedSources.map(s => s.id || s);
      const res = await chatSessionService.getFullGraph(currentSession.id, sourceIds)
      const raw = res.data
      // Backend now handles source filtering, but keep as safety check
      const data = filterToSelection(raw)
      if (!data?.nodes?.length) {
        setIsEmpty(true)
      } else {
        const { nodes, edges } = buildVisData(data)
        setNodeCount(nodes.length)
        setEdgeCount(edges.length)
        setIsEmpty(nodes.length === 0)
        if (networkRef.current) {
          networkRef.current.setData({ nodes, edges })
        } else if (containerRef.current) {
          networkRef.current = new Network(containerRef.current, { nodes, edges }, VIS_OPTIONS)
        }
      }
    } catch (err) {
      setErrorMsg('Failed to load graph. Make sure sources are indexed.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExploreQuery = async (e) => {
    e.preventDefault()
    if (!query.trim() || !currentSession) return
    setIsLoading(true)
    setErrorMsg('')
    try {
      const queryData = {
        query: query.trim(),
        // Pass selected source IDs to scope the backend Cypher query
        ...(selectedSources.length ? { source_ids: selectedSources } : {}),
      }
      const res = await chatSessionService.queryGraph(currentSession.id, queryData)
      const data = res.data
      if (!data?.nodes?.length) {
        setIsEmpty(true)
        setErrorMsg('No nodes found for that query.')
      } else {
        const { nodes, edges } = buildVisData(data)
        setNodeCount(nodes.length)
        setEdgeCount(edges.length)
        setIsEmpty(false)
        if (networkRef.current) {
          networkRef.current.setData({ nodes, edges })
        } else if (containerRef.current) {
          networkRef.current = new Network(containerRef.current, { nodes, edges }, VIS_OPTIONS)
        }
      }
    } catch {
      setErrorMsg('Query failed. Try a different phrase.')
    } finally {
      setIsLoading(false)
    }
  }

  const graphContent = (
    <div className="relative flex-1 min-h-0">
      {/* Graph canvas */}
      <div
        ref={containerRef}
        className="w-full h-full rounded bg-(--bg-surface)"
        style={{ minHeight: 300 }}
      />

      {/* Overlay: loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded bg-white/80 dark:bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-(--text-muted)">
            <Loader2 className="w-6 h-6 animate-spin text-(--accent-cyan)" />
            <span className="text-xs" style={{ fontFamily: 'var(--font-mono)' }}>Building graph…</span>
          </div>
        </div>
      )}

      {/* Overlay: empty / error */}
      {!isLoading && isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
          <div className="w-10 h-10 rounded bg-(--accent-cyan-dim) flex items-center justify-center">
            <NetworkIcon className="w-5 h-5 text-(--accent-cyan)" />
          </div>
          <p className="text-xs font-medium text-(--text-secondary)" style={{ fontFamily: 'var(--font-mono)' }}>
            {errorMsg || (mode === 'sync' ? 'Graph updates from chat will appear here' : 'No graph data yet')}
          </p>
          {mode === 'explore' && !errorMsg && (
            <p className="text-xs text-(--text-muted)" style={{ fontFamily: 'var(--font-mono)' }}>
              Enter a query below or load the full graph
            </p>
          )}
        </div>
      )}

      {/* Node/edge counter badge */}
      {!isEmpty && (
        <div className="absolute bottom-2 right-2 flex gap-1.5">
          <span className="text-[10px] px-2 py-0.5 rounded bg-(--bg-elevated)/80 backdrop-blur text-(--text-muted) border border-(--border-default)" style={{ fontFamily: 'var(--font-mono)' }}>
            {nodeCount}N · {edgeCount}E
          </span>
        </div>
      )}

      {/* Load full graph button (explore) */}
      {mode === 'explore' && !isEmpty && (
        <button
          onClick={handleLoadFullGraph}
          title="Reload full graph"
          className="absolute top-2 right-2 p-1.5 rounded bg-(--bg-elevated)/80 backdrop-blur border border-(--border-default) text-(--text-muted) hover:text-(--accent-cyan) hover:border-(--accent-cyan) transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-(--bg-base)">
        {/* Fullscreen header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--border-subtle)">
          <span className="text-xs font-semibold text-(--text-secondary) uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>Graph View — Fullscreen</span>
          <button onClick={() => setIsFullscreen(false)} className="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-muted) hover:text-(--text-primary) transition-colors">
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 p-4 flex flex-col">
          {graphContent}
        </div>
        {/* Query bar in fullscreen explore mode */}
        {mode === 'explore' && (
          <form onSubmit={handleExploreQuery} className="px-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--text-muted)" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search the graph…"
                className="w-full pl-9 pr-12 py-2 text-xs border border-(--border-default) rounded-full bg-(--bg-elevated) text-(--text-primary) focus:outline-none focus:border-(--accent-cyan) placeholder:text-(--text-muted)"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              <button type="submit" disabled={!query.trim() || isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-(--accent-cyan) text-(--text-inverse) disabled:opacity-40 hover:bg-[#00b588] transition-colors">
                <Search className="w-3 h-3" />
              </button>
            </div>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Mode toggle + fullscreen */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-(--border-subtle)">
        {/* Sync / Explore toggle */}
        <div className="flex items-center gap-0.5 bg-(--bg-elevated) rounded p-0.5">
          {['sync', 'explore'].map(m => (
            <button
              key={m}
              onClick={() => onSetSyncMode(m === 'sync')}
              className={`px-3 py-1 text-[10px] font-medium rounded transition-colors capitalize ${
                mode === m
                  ? 'bg-(--accent-cyan-dim) text-(--accent-cyan)'
                  : 'text-(--text-muted) hover:text-(--text-secondary)'
              }`}
              style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
            >
              {m === 'sync' ? '⟳ Sync' : '⌕ Explore'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {/* Reload full graph */}
          <button
            onClick={handleLoadFullGraph}
            title="Load full graph"
            className="p-1.5 rounded text-(--text-muted) hover:text-(--accent-cyan) hover:bg-(--bg-hover) transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(true)}
            title="Expand graph"
            className="p-1.5 rounded text-(--text-muted) hover:text-(--accent-cyan) hover:bg-(--bg-hover) transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Graph area */}
      <div className="flex-1 min-h-0 p-3 flex flex-col gap-2">
        {graphContent}
      </div>

      {/* Explore mode query bar */}
      {mode === 'explore' && (
        <form onSubmit={handleExploreQuery} className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-(--text-muted)" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search the knowledge graph…"
              className="w-full pl-7 pr-9 py-1.5 text-xs border border-(--border-default) rounded-full bg-(--bg-elevated) text-(--text-primary) focus:outline-none focus:border-(--accent-cyan) placeholder:text-(--text-muted) transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-(--accent-cyan) text-(--text-inverse) disabled:opacity-40 hover:bg-[#00b588] transition-colors"
            >
              <Search className="w-2.5 h-2.5" />
            </button>
          </div>
        </form>
      )}

      {/* Sync mode hint */}
      {mode === 'sync' && (
        <p className="px-4 pb-3 text-[10px] text-center text-(--text-muted)" style={{ fontFamily: 'var(--font-mono)' }}>
          Graph will auto-update as you chat
        </p>
      )}
    </div>
  )
}
