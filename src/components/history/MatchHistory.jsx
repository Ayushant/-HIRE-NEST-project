import React, { useState, useEffect, useCallback } from 'react';
import { getMatchHistory, getMatchesForJD, getCandidates, deleteJDSession, clearAllJDSessions } from '../../lib/supabase';
import CandidateDrawer from '../resume/CandidateDrawer';
import { exportMatchesCSV } from '../../lib/csvExport';
import { ClipboardIcon, UsersIcon, TrendingUpIcon, StarIcon, SpinnerIcon, DownloadIcon, XIcon, MapPinIcon, BriefcaseIcon, DatabaseIcon, ChevronDownIcon, TrashIcon, AlertIcon } from '../common/Icons';

function StatCard({ icon, label, value, color = '#3B82F6' }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '20px',
      border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: '8px'
    }}>
      <div style={{ color: '#94A3B8', display: 'flex' }}>{icon}</div>
      <div style={{ fontSize: '24px', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function ScoreBar({ score }) {
  const color = score >= 8 ? '#10B981' : score >= 6 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(score / 10) * 100}%`, background: color, borderRadius: '3px' }} />
      </div>
      <span style={{ color, fontWeight: 700, fontSize: '13px', minWidth: '32px' }}>
        {Number(score).toFixed(1)}
      </span>
    </div>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 8 ? '#10B981' : score >= 6 ? '#F59E0B' : '#EF4444';
  const bg   = score >= 8 ? '#F0FDF4' : score >= 6 ? '#FFFBEB' : '#FEF2F2';
  const bd   = score >= 8 ? '#BBF7D0' : score >= 6 ? '#FDE68A' : '#FECACA';
  return (
    <span style={{ background: bg, color, border: `1px solid ${bd}`, borderRadius: '6px', padding: '2px 8px', fontSize: '13px', fontWeight: 700 }}>
      {Number(score).toFixed(1)}/10
    </span>
  );
}

export default function MatchHistory({ toast }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  // Map of jdId -> { matches, loading, loaded }
  const [jdData, setJdData] = useState({});
  // Set of expanded jdIds
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [viewingCandidate, setViewingCandidate] = useState(null);
  const [dbReady, setDbReady] = useState(true);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  // jdId -> 'confirm' | 'deleting'
  const [deleteState, setDeleteState] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    try {
      const local = JSON.parse(localStorage.getItem('match_sessions') || '[]');
      if (local.length > 0) setHistory(local);
    } catch { /* ignore */ }

    try {
      const dbHist = await getMatchHistory();
      if (dbHist.length > 0) {
        const local = JSON.parse(localStorage.getItem('match_sessions') || '[]');
        const dbIds = new Set(dbHist.map(j => j.id));
        const localOnly = local.filter(j => !dbIds.has(j.id));
        setHistory([...dbHist, ...localOnly]);
      }
    } catch {
      setDbReady(false);
    }

    try {
      const { count } = await getCandidates({ pageSize: 1 });
      setTotalCandidates(count || 0);
    } catch {
      setTotalCandidates(0);
    }

    setLoading(false);
  };

  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      await clearAllJDSessions();
    } catch { /* DB may be offline, continue */ }
    localStorage.removeItem('match_sessions');
    setHistory([]);
    setJdData({});
    setExpandedIds(new Set());
    setConfirmClearAll(false);
    setClearingAll(false);
    toast?.('All JD sessions cleared.', 'success');
  };

  const handleDeleteJD = async (jd) => {
    const id = jd.id;
    setDeleteState(prev => ({ ...prev, [id]: 'deleting' }));
    try {
      await deleteJDSession(id);
    } catch { /* soft fail */ }
    // Remove from localStorage
    try {
      const local = JSON.parse(localStorage.getItem('match_sessions') || '[]');
      localStorage.setItem('match_sessions', JSON.stringify(local.filter(j => j.id !== id)));
    } catch { /* ignore */ }
    setHistory(prev => prev.filter(j => j.id !== id));
    setJdData(prev => { const n = { ...prev }; delete n[id]; return n; });
    setExpandedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    setDeleteState(prev => { const n = { ...prev }; delete n[id]; return n; });
    toast?.(`"${jd.role_title || 'JD'}" session deleted.`, 'success');
  };

  const toggleJD = useCallback(async (jd) => {
    const id = jd.id;
    const isOpen = expandedIds.has(id);

    if (isOpen) {
      setExpandedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      return;
    }

    // Expand
    setExpandedIds(prev => new Set([...prev, id]));

    // Already loaded
    if (jdData[id]?.loaded) return;

    // Mark as loading
    setJdData(prev => ({ ...prev, [id]: { matches: [], loading: true, loaded: false } }));

    try {
      let matches = [];
      if (jd.matches && jd.matches.length > 0 && jd.matches[0].candidates) {
        matches = jd.matches;
      } else {
        const db = await getMatchesForJD(id);
        matches = db.length > 0 ? db : (jd.matches || []);
      }
      setJdData(prev => ({ ...prev, [id]: { matches, loading: false, loaded: true } }));
    } catch {
      setJdData(prev => ({ ...prev, [id]: { matches: jd.matches || [], loading: false, loaded: true } }));
    }
  }, [expandedIds, jdData]);

  // Stats
  const totalJDs = history.length;
  const allScores = history.flatMap(j => j.matches || []).map(m => Number(m.final_score || 0)).filter(s => s > 0);
  const avgScore = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : '-';
  const bestEver = allScores.length > 0 ? Math.max(...allScores).toFixed(1) : '-';

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Page Header */}
      <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #E2E8F0', background: '#fff' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0F172A' }}>Match History</h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '14px' }}>
          Browse each JD session and view its shortlisted candidates
        </p>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <StatCard icon={<ClipboardIcon size={22} />} label="Total JDs Processed"  value={totalJDs}                                        color="#3B82F6" />
          <StatCard icon={<UsersIcon size={22} />}     label="Total Resumes in DB"  value={totalCandidates}                                  color="#8B5CF6" />
          <StatCard icon={<TrendingUpIcon size={22} />} label="Avg Match Score"     value={avgScore !== '-' ? avgScore + '/10' : '-'}         color="#F59E0B" />
          <StatCard icon={<StarIcon size={22} />}       label="Best Match Ever"     value={bestEver !== '-' ? bestEver + '/10' : '-'}         color="#10B981" />
        </div>

        {/* JD Card List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Section heading */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
              JD Sessions
              {totalJDs > 0 && (
                <span style={{ marginLeft: '8px', background: '#EFF6FF', color: '#3B82F6', border: '1px solid #BFDBFE', borderRadius: '20px', padding: '1px 10px', fontSize: '12px', fontWeight: 700 }}>
                  {totalJDs}
                </span>
              )}
            </h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {expandedIds.size > 0 && (
                <button
                  onClick={() => setExpandedIds(new Set())}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '13px', cursor: 'pointer', padding: '4px 8px', fontFamily: 'Inter, sans-serif' }}
                >
                  Collapse all
                </button>
              )}
              {history.length > 0 && !confirmClearAll && (
                <button
                  onClick={() => setConfirmClearAll(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                    borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif'
                  }}
                >
                  <TrashIcon size={13} /> Clear All
                </button>
              )}
            </div>
          </div>

          {/* Clear-all confirmation banner */}
          {confirmClearAll && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px',
              padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'
            }}>
              <span style={{ display: 'flex', color: '#DC2626' }}><AlertIcon size={16} /></span>
              <span style={{ flex: 1, fontSize: '13.5px', color: '#7F1D1D', fontWeight: 500 }}>
                This will permanently delete all <strong>{totalJDs}</strong> JD session{totalJDs !== 1 ? 's' : ''} and their match records. This cannot be undone.
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setConfirmClearAll(false)}
                  disabled={clearingAll}
                  style={{
                    background: '#fff', color: '#64748B', border: '1px solid #E2E8F0',
                    borderRadius: '7px', padding: '6px 14px', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif'
                  }}
                >Cancel</button>
                <button
                  onClick={handleClearAll}
                  disabled={clearingAll}
                  style={{
                    background: '#DC2626', color: '#fff', border: 'none',
                    borderRadius: '7px', padding: '6px 14px', fontSize: '13px', fontWeight: 600,
                    cursor: clearingAll ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '6px',
                    opacity: clearingAll ? 0.7 : 1
                  }}
                >
                  {clearingAll ? <><SpinnerIcon size={13} /> Clearing…</> : <><TrashIcon size={13} /> Delete All</>}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            // Skeleton
            [...Array(3)].map((_, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px 24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                {[100, 160, 80, 60].map((w, j) => (
                  <div key={j} style={{ height: '14px', background: '#E2E8F0', borderRadius: '4px', width: w, flexShrink: 0, animation: 'shimmer 1.4s ease infinite' }} />
                ))}
                <div style={{ marginLeft: 'auto', height: '32px', background: '#E2E8F0', borderRadius: '8px', width: '80px', animation: 'shimmer 1.4s ease infinite' }} />
              </div>
            ))
          ) : history.length === 0 ? (
            <div style={{
              background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0',
              padding: '56px', textAlign: 'center'
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: '#CBD5E1' }}>
                {!dbReady ? <DatabaseIcon size={40} /> : <ClipboardIcon size={40} />}
              </div>
              <div style={{ color: '#475569', fontWeight: 600, fontSize: '15px' }}>
                {!dbReady ? 'Database not set up yet' : 'No JD sessions yet'}
              </div>
              <div style={{ color: '#94A3B8', fontSize: '13px', marginTop: '6px' }}>
                {!dbReady
                  ? 'Go to Settings → Copy SQL → run it in Supabase SQL Editor'
                  : 'Go to JD Matching to run your first analysis'}
              </div>
            </div>
          ) : (
            history.map((jd) => {
              const id = jd.id;
              const isOpen = expandedIds.has(id);
              const data = jdData[id] || {};
              const matchList = isOpen && data.loaded ? data.matches : (jd.matches || []);
              const jdScores = matchList.map(m => Number(m.final_score || 0)).filter(Boolean);
              const topScore = jdScores.length > 0 ? Math.max(...jdScores) : null;
              const countStr = jd.matches?.length > 0
                ? `${jd.matches.length} candidate${jd.matches.length !== 1 ? 's' : ''}`
                : isOpen && data.loaded
                  ? `${data.matches.length} candidate${data.matches.length !== 1 ? 's' : ''}`
                  : null;

              return (
                <div
                  key={id}
                  style={{
                    background: '#fff',
                    borderRadius: '12px',
                    border: `1px solid ${isOpen ? '#BFDBFE' : '#E2E8F0'}`,
                    boxShadow: isOpen ? '0 4px 16px rgba(59,130,246,0.08)' : '0 2px 6px rgba(0,0,0,0.04)',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.2s ease, border-color 0.2s ease'
                  }}
                >
                  {/* Card Header Row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto auto',
                    gap: '16px',
                    alignItems: 'center',
                    padding: '18px 22px',
                    cursor: 'pointer'
                  }}
                    onClick={() => toggleJD(jd)}
                  >
                    {/* Title + meta */}
                    <div>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '15px', marginBottom: '4px' }}>
                        {jd.role_title || 'Untitled JD'}
                      </div>
                      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {jd.location && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B', fontSize: '13px' }}>
                            <MapPinIcon size={12} /> {jd.location}
                          </span>
                        )}
                        {jd.created_at && (
                          <span style={{ color: '#94A3B8', fontSize: '13px' }}>
                            {new Date(jd.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                        {countStr && (
                          <span style={{ background: '#F1F5F9', color: '#64748B', borderRadius: '20px', padding: '1px 9px', fontSize: '12px', fontWeight: 600 }}>
                            {countStr}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Top score badge */}
                    {topScore != null && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Score</div>
                        <ScoreBadge score={topScore} />
                      </div>
                    )}

                    {/* Export CSV */}
                    {isOpen && data.loaded && data.matches.length > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); exportMatchesCSV(data.matches, jd.role_title); }}
                        style={{
                          background: '#10B981', color: '#fff', border: 'none', borderRadius: '8px',
                          padding: '7px 13px', fontSize: '12px', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                          display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap'
                        }}
                      >
                        <DownloadIcon size={13} /> Export CSV
                      </button>
                    )}

                    {/* Expand/Collapse chevron + View label */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      color: isOpen ? '#3B82F6' : '#64748B',
                      background: isOpen ? '#EFF6FF' : '#F8FAFC',
                      border: `1px solid ${isOpen ? '#BFDBFE' : '#E2E8F0'}`,
                      borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: 600,
                      userSelect: 'none', transition: 'all 0.15s ease'
                    }}>
                      {data.loading ? (
                        <SpinnerIcon size={14} />
                      ) : (
                        <span style={{ display: 'flex', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                          <ChevronDownIcon size={14} />
                        </span>
                      )}
                      {isOpen ? 'Collapse' : 'View'}
                    </div>

                    {/* Per-JD delete */}
                    {deleteState[id] === 'confirm' ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: 500, whiteSpace: 'nowrap' }}>Delete?</span>
                        <button
                          onClick={() => setDeleteState(prev => { const n = { ...prev }; delete n[id]; return n; })}
                          style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                        >Cancel</button>
                        <button
                          onClick={() => handleDeleteJD(jd)}
                          style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}
                        ><TrashIcon size={12} /> Delete</button>
                      </div>
                    ) : deleteState[id] === 'deleting' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94A3B8', fontSize: '13px' }} onClick={e => e.stopPropagation()}>
                        <SpinnerIcon size={13} /> Deleting…
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteState(prev => ({ ...prev, [id]: 'confirm' })); }}
                        title="Delete this JD session"
                        style={{
                          background: 'none', border: '1px solid #E2E8F0', color: '#CBD5E1',
                          borderRadius: '7px', padding: '6px 8px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = '#FECACA'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#CBD5E1'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
                      >
                        <TrashIcon size={14} />
                      </button>
                    )}
                  </div>

                  {/* Expanded Candidate Panel */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #EFF6FF' }}>
                      {data.loading ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <SpinnerIcon size={22} />
                          <span style={{ fontSize: '13px' }}>Loading candidates…</span>
                        </div>
                      ) : (data.matches || []).length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                          No match records saved for this JD.
                        </div>
                      ) : (
                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* Candidates header */}
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                            {data.matches.length} Candidate{data.matches.length !== 1 ? 's' : ''} Shortlisted
                          </div>
                          {data.matches.map((match, i) => {
                            const candidate = match.candidates || {};
                            const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
                            const score = Number(match.final_score || 0);
                            return (
                              <div
                                key={match.id || i}
                                style={{
                                  padding: '14px 16px',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  transition: 'background 0.12s ease, border-color 0.12s ease'
                                }}
                                onClick={() => setViewingCandidate(candidate)}
                                onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#BFDBFE'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = '#E2E8F0'; }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{
                                      background: '#F1F5F9', color: '#64748B',
                                      borderRadius: '6px', padding: '1px 8px', fontSize: '12px', fontWeight: 700
                                    }}>#{i + 1}</span>
                                    <span style={{ fontWeight: 600, color: '#1E293B', fontSize: '14px' }}>
                                      {candidate.full_name || 'Unknown'}
                                    </span>
                                  </div>
                                  <ScoreBadge score={score} />
                                </div>
                                <div style={{ marginBottom: '7px' }}>
                                  <ScoreBar score={score} />
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                                  {candidate.current_title && <span>{candidate.current_title}</span>}
                                  {candidate.location && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <MapPinIcon size={10} /> {candidate.location}
                                    </span>
                                  )}
                                  {candidate.years_experience != null && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <BriefcaseIcon size={10} /> {candidate.years_experience}y exp
                                    </span>
                                  )}
                                </div>
                                {skills.length > 0 && (
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '7px' }}>
                                    {skills.slice(0, 5).map((s, j) => (
                                      <span key={j} style={{ background: '#F1F5F9', color: '#475569', borderRadius: '4px', padding: '1px 7px', fontSize: '11px' }}>{s}</span>
                                    ))}
                                  </div>
                                )}
                                {match.reason && (
                                  <div style={{
                                    marginTop: '9px', fontSize: '12px', color: '#64748B',
                                    background: '#F8FAFC', borderRadius: '6px', padding: '7px 10px',
                                    borderLeft: '2px solid #3B82F6', fontStyle: 'italic', lineHeight: 1.5
                                  }}>
                                    {match.reason}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {viewingCandidate && (
        <CandidateDrawer candidate={viewingCandidate} onClose={() => setViewingCandidate(null)} />
      )}
    </div>
  );
}
