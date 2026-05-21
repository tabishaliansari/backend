import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, UploadCloud, Library, FileUp, Loader2, GitBranch, File, CheckCircle2 } from 'lucide-react';
import useSourceStore from '@/store/sourceStore';
import useChatStore from '@/store/chatStore';

export default function AddSourceModal({ isOpen, onClose, currentSession }) {
  const { attachSources } = useChatStore();
  const [activeTab, setActiveTab] = useState('upload');

  const FileIcon = ({ filename, className }) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <img src="/fileIcons/file-pdf.svg" alt="PDF" className={className} />;
    if (ext === 'doc' || ext === 'docx') return <img src="/fileIcons/file-docx.svg" alt="Word" className={className} />;
    if (ext === 'md' || ext === 'markdown') return <img src="/fileIcons/file-code.svg" alt="Markdown" className={className} />;
    return <img src="/fileIcons/file-text-dark.svg" alt="Text" className={className} />;
  };

  const { uploadDocument, addGithub, fetchSources, sources, isLoadingSources, isUploading, autoAttach, setAutoAttach } = useSourceStore();

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [repoUrl, setRepoUrl] = useState('');
  const [repoTitle, setRepoTitle] = useState('');
  const [branch, setBranch] = useState('main');

  useEffect(() => {
    if (isOpen && activeTab === 'library') fetchSources(0, 50);
  }, [isOpen, activeTab, fetchSources]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setUploadTitle('');
      setRepoUrl('');
      setRepoTitle('');
      setBranch('main');
      setActiveTab('upload');
      setIsDragging(false);
    }
  }, [isOpen]);

  const applyFile = (file) => {
    if (!file) return;
    setSelectedFile(file);
    if (!uploadTitle) setUploadTitle(file.name);
  };

  const handleFileChange = (e) => applyFile(e.target.files[0]);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    applyFile(e.dataTransfer.files[0]);
  }, [uploadTitle]);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    try {
      const res = await uploadDocument(selectedFile, uploadTitle || selectedFile.name);
      if (autoAttach && currentSession) {
        const sourceId = res.data?.source_id || res.source_id;
        if (sourceId) await attachSources(currentSession.id, [sourceId]);
      }
      onClose();
    } catch { }
  };

  const handleGithubSubmit = async (e) => {
    e.preventDefault();
    if (!repoUrl) return;
    try {
      let finalTitle = repoTitle;
      if (!finalTitle) {
        const parts = repoUrl.split('/');
        finalTitle = parts[parts.length - 1] || 'GitHub Repo';
      }
      const res = await addGithub(repoUrl, finalTitle, branch, []);
      if (autoAttach && currentSession) {
        const sourceId = res.data?.source_id || res.source_id;
        if (sourceId) await attachSources(currentSession.id, [sourceId]);
      }
      onClose();
    } catch { }
  };

  if (!isOpen) return null;

  const TABS = [
    { id: 'upload', label: 'Upload', icon: <FileUp className="w-3.5 h-3.5" /> },
    { id: 'github', label: 'GitHub', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { id: 'library', label: 'Library', icon: <Library className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-(--bg-elevated) border border-(--border-strong) rounded-lg overflow-hidden flex flex-col shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--border-subtle) bg-(--bg-surface)">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-(--accent-cyan-dim) text-(--accent-cyan) rounded-lg flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-(--text-primary)" style={{ fontFamily: 'var(--font-mono)' }}>Add Knowledge Source</h2>
              <p className="text-[11px] text-(--text-muted)">Connect documents and repositories to the graph</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-(--text-muted) hover:text-(--text-primary) rounded hover:bg-(--bg-hover) transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tabs + Auto-attach ── */}
        <div className="flex items-center justify-between px-5 border-b border-(--border-subtle) bg-(--bg-surface)">
          <div className="flex">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-(--accent-cyan) text-(--accent-cyan)'
                    : 'border-transparent text-(--text-muted) hover:text-(--text-secondary)'
                }`}
                style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-[11px] text-(--text-secondary) hover:text-(--text-primary) transition-colors" style={{ fontFamily: 'var(--font-mono)' }}>
            <input
              type="checkbox"
              checked={autoAttach}
              onChange={(e) => setAutoAttach(e.target.checked)}
              className="rounded border-(--border-default) bg-(--bg-elevated) accent-(--accent-cyan)"
            />
            Auto-attach
          </label>
        </div>

        {/* ── Content ── */}
        <div className="p-5 bg-(--bg-elevated) min-h-70 flex flex-col">

          {/* TAB: UPLOAD */}
          {activeTab === 'upload' && (
            <form onSubmit={handleUploadSubmit} className="flex flex-col flex-1 gap-4 animate-in slide-in-from-right-4 duration-300">
              {!selectedFile ? (
                <div
                  className={`flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 transition-all cursor-pointer group ${
                    isDragging
                      ? 'border-(--accent-cyan) bg-(--accent-cyan-dim)'
                      : 'border-(--border-default) hover:border-(--accent-cyan) hover:bg-(--accent-cyan-dim)'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${isDragging ? 'bg-(--accent-cyan-dim)' : 'bg-(--bg-surface) group-hover:bg-(--accent-cyan-dim)'}`}>
                    <UploadCloud className={`w-6 h-6 transition-colors ${isDragging ? 'text-(--accent-cyan)' : 'text-(--text-muted) group-hover:text-(--accent-cyan)'}`} />
                  </div>
                  <h3 className="text-sm font-medium text-(--text-primary) mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                    {isDragging ? 'Drop to upload' : 'Click or drag file to upload'}
                  </h3>
                  <div className="flex gap-1.5 flex-wrap justify-center">
                    {['PDF', 'DOCX', 'TXT', 'MD'].map(fmt => (
                      <span key={fmt} className="px-2 py-0.5 rounded text-[10px] font-mono bg-(--bg-elevated) border border-(--border-default) text-(--text-muted)">
                        {fmt}
                      </span>
                    ))}
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono text-(--text-muted)">· max 50MB</span>
                  </div>
                  <input type="file" className="hidden" ref={fileInputRef} accept=".pdf,.docx,.txt,.md" onChange={handleFileChange} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-3">
                  {/* Selected file preview */}
                  <div className="p-4 border border-(--accent-cyan)/30 bg-(--accent-cyan-dim) rounded-lg flex items-center gap-4">
                    <div className="p-2 bg-(--bg-elevated) rounded-lg border border-(--border-default) flex items-center justify-center shrink-0">
                      <FileIcon filename={selectedFile.name} className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-(--text-primary) font-medium truncate">{selectedFile.name}</p>
                      <p className="text-[11px] text-(--text-muted) font-mono mt-0.5">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedFile(null); setUploadTitle(''); }} className="text-(--text-muted) hover:text-(--accent-red) transition-colors shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Title override input */}
                  <div>
                    <label className="field-label">Title</label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder={selectedFile.name}
                      className="field-input"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-(--border-subtle)">
                <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={!selectedFile || isUploading} className="btn-primary">
                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                  {isUploading ? 'Uploading…' : 'Upload & Index'}
                </button>
              </div>
            </form>
          )}

          {/* TAB: GITHUB */}
          {activeTab === 'github' && (
            <form onSubmit={handleGithubSubmit} className="flex flex-col flex-1 gap-4 animate-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="field-label">Repository URL</label>
                  <div className="relative">
                    <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted)" />
                    <input
                      type="url"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      className="field-input pl-10!"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="field-label">Title <span className="text-(--text-muted) normal-case font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={repoTitle}
                      onChange={(e) => setRepoTitle(e.target.value)}
                      placeholder="Custom name"
                      className="field-input"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="field-label">Branch</label>
                    <div className="relative">
                      <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--text-muted)" />
                      <input
                        type="text"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        placeholder="main"
                        className="field-input pl-9!"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-(--border-subtle) mt-auto">
                <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={!repoUrl || isUploading} className="btn-primary">
                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
                  {isUploading ? 'Connecting…' : 'Connect Repository'}
                </button>
              </div>
            </form>
          )}

          {/* TAB: LIBRARY */}
          {activeTab === 'library' && (
            <div className="flex flex-col flex-1 animate-in slide-in-from-right-4 duration-300 overflow-hidden">
              {isLoadingSources ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-(--accent-cyan) animate-spin" />
                </div>
              ) : sources.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-xl bg-(--accent-cyan-dim) flex items-center justify-center mb-4">
                    <Library className="w-6 h-6 text-(--accent-cyan)" />
                  </div>
                  <h3 className="text-sm font-medium text-(--text-primary) mb-1" style={{ fontFamily: 'var(--font-mono)' }}>Library is empty</h3>
                  <p className="text-xs text-(--text-muted) max-w-xs">Upload a document or connect a repo first.</p>
                </div>
              ) : (
                <div className="overflow-y-auto space-y-1.5 max-h-80 pr-1">
                  {sources.map(source => {
                    const isAttached = currentSession?.sources?.some(s => s.id === source.id);
                    return (
                      <div key={source.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isAttached
                          ? 'bg-(--accent-cyan-dim) border-(--accent-cyan)/30'
                          : 'bg-(--bg-surface) border-(--border-subtle) hover:border-(--border-default)'
                      }`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-1.5 bg-(--bg-elevated) rounded-lg border border-(--border-subtle) shrink-0">
                            {source.type === 'github'
                              ? <GitBranch className="w-4 h-4 text-(--text-secondary)" />
                              : <File className="w-4 h-4 text-(--accent-cyan)" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-(--text-primary) truncate" style={{ fontFamily: 'var(--font-mono)' }}>{source.title}</p>
                            <p className="text-[10px] text-(--text-muted) capitalize font-mono">{source.type} · {source.status}</p>
                          </div>
                        </div>

                        {isAttached ? (
                          <div className="flex items-center gap-1 text-(--accent-cyan) text-[10px] font-mono shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Attached
                          </div>
                        ) : (
                          <button
                            onClick={async () => {
                              if (currentSession) {
                                await attachSources(currentSession.id, [source.id]);
                                onClose();
                              }
                            }}
                            className="px-3 py-1 text-[10px] font-medium rounded border border-(--accent-cyan)/40 text-(--accent-cyan) hover:bg-(--accent-cyan-dim) transition-colors shrink-0"
                            style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                          >
                            Attach
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
