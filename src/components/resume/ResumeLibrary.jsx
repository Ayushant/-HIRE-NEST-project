import React, { useState, useEffect, useRef, useCallback } from 'react';
import { computeFileHash, extractTextFromFile, validateFile, formatFileSize } from '../../lib/fileProcessor';
import { parseResume, getResumeEmbedding, withRateLimit } from '../../lib/openai';
import { checkDuplicate, upsertCandidate, getCandidates } from '../../lib/supabase';
import CandidateDrawer from './CandidateDrawer';
import { exportCandidatesCSV } from '../../lib/csvExport';
import { UploadIcon, SearchIcon, DownloadIcon, CheckIcon, XIcon, AlertIcon, SpinnerIcon, FileTextIcon, PauseIcon } from '../common/Icons';

const BATCH_SIZE = 5;

const PROCESS_STATES = {
  PENDING: 'pending',
  EXTRACTING: 'extracting',
  PARSING: 'parsing',
  SAVING: 'saving',
  DONE: 'done',
  DUPLICATE: 'duplicate',
  FAILED: 'failed'
};

const progressLabel = {
  pending: { Icon: null, text: 'Waiting...', color: '#94A3B8' },
  extracting: { Icon: SpinnerIcon, text: 'Extracting text...', color: '#3B82F6', spin: true },
  parsing: { Icon: SpinnerIcon, text: 'Parsing with AI...', color: '#8B5CF6', pulse: true },
  saving: { Icon: SpinnerIcon, text: 'Saving to database...', color: '#10B981' },
  done: { Icon: CheckIcon, text: 'Complete', color: '#10B981' },
  duplicate: { Icon: AlertIcon, text: 'Duplicate — linked to existing', color: '#F59E0B' },
  failed: { Icon: XIcon, text: 'Failed', color: '#EF4444' }
};

export default function ResumeLibrary({ toast, settings }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [queue, setQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overallProgress, setOverallProgress] = useState({ done: 0, total: 0, dupes: 0, failed: 0 });
  const [rateLimitMsg, setRateLimitMsg] = useState('');
  const [pauseCount, setPauseCount] = useState(0);

  // Library
  const [candidates, setCandidates] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ location: '', workMode: '', minExp: '', maxExp: '' });
  const [loading, setLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const fileInputRef = useRef(null);
  const processingRef = useRef(false);

  const PAGE_SIZE = 25;

  useEffect(() => {
    loadCandidates();
  }, [page, search, filters]);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const filterParams = {
        location: filters.location || undefined,
        workMode: filters.workMode || undefined,
        minExp: filters.minExp !== '' ? Number(filters.minExp) : undefined,
        maxExp: filters.maxExp !== '' ? Number(filters.maxExp) : undefined
      };
      const { data, count } = await getCandidates({ search, page, pageSize: PAGE_SIZE, filters: filterParams });
      setCandidates(data);
      setTotalCount(count);
    } catch (e) {
      toast.error('Failed to load candidates: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, []);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    addFiles(files);
    e.target.value = '';
  };

  const addFiles = (files) => {
    const valid = [];
    const errors = [];
    files.forEach(f => {
      const err = validateFile(f);
      if (err) errors.push(err);
      else valid.push(f);
    });
    if (errors.length) toast.warning(errors.slice(0, 3).join('\n'));
    setSelectedFiles(prev => [...prev, ...valid]);
  };

  const startProcessing = async () => {
    if (!selectedFiles.length) return;
    if (!localStorage.getItem('groq_api_key') && !settings?.groqKey) {
      toast.error('Please set your Groq API key in Settings first.');
      return;
    }

    const newQueue = selectedFiles.map((file, i) => ({
      id: i,
      file,
      name: file.name,
      size: formatFileSize(file.size),
      state: PROCESS_STATES.PENDING,
      error: null
    }));

    setQueue(newQueue);
    setSelectedFiles([]);
    setIsProcessing(true);
    processingRef.current = true;
    setOverallProgress({ done: 0, total: newQueue.length, dupes: 0, failed: 0 });

    // Process in batches
    for (let i = 0; i < newQueue.length; i += BATCH_SIZE) {
      if (!processingRef.current) break;
      const batch = newQueue.slice(i, Math.min(i + BATCH_SIZE, newQueue.length));
      await Promise.all(batch.map(item => processFile(item)));
    }

    setIsProcessing(false);
    processingRef.current = false;
    setRateLimitMsg('');
    loadCandidates();
    toast.success(`Processing complete! Check results below.`);
  };

  const updateQueueItem = (id, updates) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const processFile = async (item) => {
    try {
      // Step 1: Extract text
      updateQueueItem(item.id, { state: PROCESS_STATES.EXTRACTING });
      const rawText = await extractTextFromFile(item.file);

      // Step 2: Check duplicate
      const fileHash = await computeFileHash(item.file);
      const existing = await checkDuplicate(fileHash);
      if (existing) {
        updateQueueItem(item.id, { state: PROCESS_STATES.DUPLICATE });
        setOverallProgress(prev => ({ ...prev, done: prev.done + 1, dupes: prev.dupes + 1 }));
        return;
      }

      // Step 3: Parse with AI
      updateQueueItem(item.id, { state: PROCESS_STATES.PARSING });
      let parsed = {};
      try {
        parsed = await withRateLimit(
          () => parseResume(rawText),
          (secs) => {
            setRateLimitMsg(`Rate limit pause — resuming in ${secs}s...`);
            setPauseCount(secs);
          }
        );
      } catch (e) {
        // Continue with empty parsed data
      }

      // Step 4: Get embedding
      let embedding = null;
      try {
        embedding = await withRateLimit(
          () => getResumeEmbedding(rawText),
          (secs) => setRateLimitMsg(`Rate limit pause — resuming in ${secs}s...`)
        );
      } catch (e) {
        // Continue without embedding
      }

      // Step 5: Save
      updateQueueItem(item.id, { state: PROCESS_STATES.SAVING });
      await upsertCandidate({
        file_hash: fileHash,
        full_name: parsed.full_name || null,
        email: parsed.email || null,
        phone: parsed.phone || null,
        location: parsed.location || null,
        current_title: parsed.current_title || null,
        years_experience: parsed.years_experience || null,
        skills: parsed.skills || [],
        notice_period_days: parsed.notice_period_days || null,
        work_mode_preference: parsed.work_mode_preference || null,
        expected_salary: parsed.expected_salary || null,
        raw_text: rawText,
        parsed_json: parsed,
        embedding: embedding
      });

      updateQueueItem(item.id, { state: PROCESS_STATES.DONE });
      setOverallProgress(prev => ({ ...prev, done: prev.done + 1 }));

    } catch (e) {
      updateQueueItem(item.id, { state: PROCESS_STATES.FAILED, error: e.message });
      setOverallProgress(prev => ({ ...prev, done: prev.done + 1, failed: prev.failed + 1 }));
    }
  };

  const skills = candidates.flatMap(c => Array.isArray(c.skills) ? c.skills : []);
  const uniqueSkills = [...new Set(skills)].slice(0, 30);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{
        padding: '24px 28px 20px',
        borderBottom: '1px solid #E2E8F0',
        background: '#fff'
      }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0F172A' }}>
          Resume Library
          <span style={{
            marginLeft: '12px', background: '#EFF6FF', color: '#3B82F6',
            fontSize: '14px', fontWeight: 600, padding: '2px 10px',
            borderRadius: '20px', border: '1px solid #BFDBFE'
          }}>
            {totalCount} Candidates
          </span>
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '14px' }}>
          Upload, process, and manage candidate resumes
        </p>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {/* Upload Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragOver ? '#3B82F6' : '#CBD5E1'}`,
            borderRadius: '14px',
            padding: '40px',
            textAlign: 'center',
            cursor: isProcessing ? 'default' : 'pointer',
            background: isDragOver ? '#EFF6FF' : '#F8FAFC',
            transition: 'all 0.2s ease',
            marginBottom: '20px'
          }}
        >
          <div style={{ marginBottom: '14px', color: isDragOver ? '#3B82F6' : '#94A3B8' }}>
            <UploadIcon size={40} />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
            {isDragOver ? 'Drop files here!' : 'Drop resumes here or click to browse'}
          </div>
          <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '12px' }}>
            Accepts: PDF, DOCX, TXT — Multiple files supported
          </div>
          {selectedFiles.length > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: '#3B82F6', color: '#fff', borderRadius: '6px',
              padding: '6px 16px', fontSize: '13px', fontWeight: 600
            }}>
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* Upload button + file list */}
        {selectedFiles.length > 0 && !isProcessing && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {selectedFiles.map((f, i) => (
                <div key={i} style={{
                  background: '#F1F5F9', borderRadius: '6px', padding: '4px 10px',
                  fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <FileTextIcon size={12} /> {f.name}
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedFiles(prev => prev.filter((_, j) => j !== i)); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0' }}
                  >✕</button>
                </div>
              ))}
            </div>
            <button
              onClick={startProcessing}
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                color: '#fff', border: 'none', borderRadius: '10px',
                padding: '12px 28px', fontSize: '15px', fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.2s ease',
                boxShadow: '0 4px 14px rgba(59,130,246,0.4)'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              Upload & Process All ({selectedFiles.length} files)
            </button>
          </div>
        )}

        {/* Processing Queue */}
        {queue.length > 0 && (
          <div style={{
            background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0',
            padding: '20px', marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            {/* Overall progress */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isProcessing && <SpinnerIcon size={14} style={{ color: '#3B82F6' }} />}
                  {isProcessing
                    ? `Processing ${overallProgress.done} of ${overallProgress.total} resumes...`
                    : `Processing complete — ${overallProgress.done} of ${overallProgress.total}`
                  }
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ background: '#D1FAE5', color: '#065F46', borderRadius: '5px', padding: '2px 10px', fontSize: '12px', fontWeight: 600 }}>
                    {overallProgress.done - overallProgress.dupes - overallProgress.failed} Done
                  </span>
                  {overallProgress.dupes > 0 && (
                    <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: '5px', padding: '2px 10px', fontSize: '12px', fontWeight: 600 }}>
                      {overallProgress.dupes} Duplicates
                    </span>
                  )}
                  {overallProgress.failed > 0 && (
                    <span style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: '5px', padding: '2px 10px', fontSize: '12px', fontWeight: 600 }}>
                      {overallProgress.failed} Failed
                    </span>
                  )}
                </div>
              </div>
              <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${overallProgress.total > 0 ? (overallProgress.done / overallProgress.total) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #3B82F6, #10B981)',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }} />
              </div>
            </div>

            {rateLimitMsg && (
              <div style={{
                background: '#FEF3C7', border: '1px solid #FCD34D',
                borderRadius: '8px', padding: '10px 14px',
                color: '#92400E', fontSize: '13px', marginBottom: '12px',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <PauseIcon size={13} /> {rateLimitMsg}
              </div>
            )}

            {/* File cards */}
            <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {queue.map(item => {
                const { Icon, text, color } = progressLabel[item.state];
                return (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: '#F8FAFC', borderRadius: '8px', padding: '10px 14px',
                    border: `1px solid ${color}33`
                  }}>
                    <span style={{ color, display: 'flex', alignItems: 'center' }}>
                      {Icon ? <Icon size={16} /> : <span style={{ width: 16, height: 16, display: 'inline-block', borderRadius: '50%', background: color, opacity: 0.4 }} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '13px', fontWeight: 600, color: '#1E293B',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '12px', color, marginTop: '2px' }}>
                        {item.error ? `Error: ${item.error}` : text}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: '#94A3B8', flexShrink: 0 }}>{item.size}</span>
                    {item.state === PROCESS_STATES.SAVING && (
                      <div style={{ width: '60px', height: '4px', background: '#E2E8F0', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ height: '100%', width: '70%', background: '#10B981', borderRadius: '2px', animation: 'progressPulse 1.5s ease-in-out infinite' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Library Table */}
        <div style={{
          background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden'
        }}>
          {/* Table Header with filters */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid #E2E8F0',
            display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center'
          }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', display: 'flex' }}><SearchIcon size={14} /></span>
              <input
                type="text"
                placeholder="Search candidates..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{
                  width: '100%', padding: '8px 12px 8px 32px',
                  border: '1px solid #E2E8F0', borderRadius: '8px',
                  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'Inter, sans-serif'
                }}
              />
            </div>
            <input
              type="text"
              placeholder="Location..."
              value={filters.location}
              onChange={e => { setFilters(p => ({ ...p, location: e.target.value })); setPage(1); }}
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '120px', fontFamily: 'Inter, sans-serif' }}
            />
            <select
              value={filters.workMode}
              onChange={e => { setFilters(p => ({ ...p, workMode: e.target.value })); setPage(1); }}
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}
            >
              <option value="">All Work Modes</option>
              <option value="Remote">Remote</option>
              <option value="Onsite">Onsite</option>
              <option value="Hybrid">Hybrid</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Exp:</span>
              <input
                type="number"
                placeholder="Min"
                value={filters.minExp}
                onChange={e => { setFilters(p => ({ ...p, minExp: e.target.value })); setPage(1); }}
                style={{ padding: '8px 8px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '60px', fontFamily: 'Inter, sans-serif' }}
              />
              <span style={{ color: '#94A3B8' }}>–</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxExp}
                onChange={e => { setFilters(p => ({ ...p, maxExp: e.target.value })); setPage(1); }}
                style={{ padding: '8px 8px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '60px', fontFamily: 'Inter, sans-serif' }}
              />
            </div>
            <button
              onClick={() => { setFilters({ location: '', workMode: '', minExp: '', maxExp: '' }); setSearch(''); setPage(1); }}
              style={{
                background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '8px',
                padding: '8px 14px', fontSize: '13px', cursor: 'pointer', color: '#64748B', fontFamily: 'Inter, sans-serif'
              }}
            >Clear</button>
            <button
              onClick={() => exportCandidatesCSV(candidates)}
              style={{
                background: '#10B981', color: '#fff', border: 'none', borderRadius: '8px',
                padding: '8px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: 500,
                fontFamily: 'Inter, sans-serif'
              }}
            >Export CSV</button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Name', 'Current Title', 'Experience', 'Top Skills', 'Location', 'Work Mode', 'Salary', 'Uploaded'].map(col => (
                    <th key={col} style={{
                      padding: '10px 14px', textAlign: 'left', fontWeight: 600,
                      color: '#64748B', fontSize: '12px', textTransform: 'uppercase',
                      letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0',
                      whiteSpace: 'nowrap'
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(8)].map((_, j) => (
                        <td key={j} style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                          <div style={{
                            height: '14px', background: '#E2E8F0', borderRadius: '4px',
                            width: `${60 + Math.random() * 40}%`,
                            animation: 'shimmer 1.5s ease-in-out infinite'
                          }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : candidates.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '60px 20px', textAlign: 'center' }}>
                      <div style={{ marginBottom: '12px', color: '#CBD5E1' }}><UploadIcon size={40} /></div>
                      <div style={{ color: '#64748B', fontSize: '15px', fontWeight: 600 }}>No candidates found</div>
                      <div style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px' }}>
                        Upload resumes above to get started
                      </div>
                    </td>
                  </tr>
                ) : (
                  candidates.map((c, i) => {
                    const skills = Array.isArray(c.skills) ? c.skills : [];
                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                          animation: `fadeInRow 0.3s ease ${i * 30}ms both`
                        }}
                        onClick={() => setSelectedCandidate(c)}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#1E293B' }}>{c.full_name || '—'}</div>
                          {c.email && <div style={{ color: '#94A3B8', fontSize: '12px' }}>{c.email}</div>}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#475569' }}>{c.current_title || '—'}</td>
                        <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {c.years_experience != null ? `${c.years_experience} yrs` : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {skills.slice(0, 3).map((s, j) => (
                              <span key={j} style={{
                                background: '#EFF6FF', color: '#3B82F6', border: '1px solid #BFDBFE',
                                borderRadius: '4px', padding: '1px 6px', fontSize: '11px', fontWeight: 500
                              }}>{s}</span>
                            ))}
                            {skills.length > 3 && (
                              <span style={{ color: '#94A3B8', fontSize: '11px' }}>+{skills.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#475569' }}>{c.location || '—'}</td>
                        <td style={{ padding: '12px 14px' }}>
                          {c.work_mode_preference ? (
                            <span style={{
                              background: c.work_mode_preference?.toLowerCase() === 'remote' ? '#F0FDF4' :
                                c.work_mode_preference?.toLowerCase() === 'onsite' ? '#FFF7ED' : '#F5F3FF',
                              color: c.work_mode_preference?.toLowerCase() === 'remote' ? '#065F46' :
                                c.work_mode_preference?.toLowerCase() === 'onsite' ? '#9A3412' : '#5B21B6',
                              borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: 500
                            }}>
                              {c.work_mode_preference}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {c.expected_salary ? `$${Number(c.expected_salary).toLocaleString()}` : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#94A3B8', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalCount > PAGE_SIZE && (
            <div style={{
              padding: '12px 20px', borderTop: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '13px', color: '#64748B' }}>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '6px 14px', border: '1px solid #E2E8F0', borderRadius: '6px',
                    background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer',
                    opacity: page === 1 ? 0.5 : 1, fontSize: '13px', fontFamily: 'Inter, sans-serif'
                  }}
                >← Prev</button>
                <span style={{ padding: '6px 14px', background: '#3B82F6', color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
                  {page}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * PAGE_SIZE >= totalCount}
                  style={{
                    padding: '6px 14px', border: '1px solid #E2E8F0', borderRadius: '6px',
                    background: '#fff', cursor: page * PAGE_SIZE >= totalCount ? 'not-allowed' : 'pointer',
                    opacity: page * PAGE_SIZE >= totalCount ? 0.5 : 1, fontSize: '13px', fontFamily: 'Inter, sans-serif'
                  }}
                >Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Candidate Drawer */}
      {selectedCandidate && (
        <CandidateDrawer candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} />
      )}
    </div>
  );
}
