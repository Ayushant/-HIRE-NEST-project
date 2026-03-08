import React, { useState, useEffect, useRef } from 'react';
import { parseJD, getJDEmbedding, scoreCandidate, withRateLimit } from '../../lib/openai';
import { getCandidates as getCandidatesAll } from '../../lib/supabase';
import {
  saveJD, callMatchCandidates, getCandidatesByIds, saveMatches,
  getJDs, getMatchesForJD
} from '../../lib/supabase';
import CandidateDrawer from '../resume/CandidateDrawer';
import { exportMatchesCSV } from '../../lib/csvExport';
import { SearchIcon, DownloadIcon, MapPinIcon, BriefcaseIcon, DollarIcon, HomeIcon, ClockIcon, CheckIcon, XIcon, HistoryIcon, SpinnerIcon, ZapIcon } from '../common/Icons';

const SCAN_MESSAGES = [
  'Parsing job requirements...',
  'Scanning candidate profiles...',
  'Running vector similarity search...',
  'Scoring top candidates...',
  'Ranking complete'
];

const EXAMPLE_JD = `Senior Python Engineer — Remote

We are looking for a Senior Python Engineer to join our growing team.

Requirements:
- 5+ years of Python development experience
- Strong experience with AWS (EC2, Lambda, S3, RDS)
- Docker and containerization
- FastAPI or Django framework experience
- PostgreSQL / database design
- Experience with CI/CD pipelines

Nice to have:
- Kubernetes / Terraform
- Machine Learning / ML pipelines
- Apache Kafka

Location: Remote (US preferred)
Budget: $140,000 - $170,000/year
Work Mode: Remote`;

function ScoreBar({ score }) {
  const color = score >= 8 ? '#10B981' : score >= 6 ? '#F59E0B' : '#EF4444';
  const width = `${(score / 10) * 100}%`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width, background: color, borderRadius: '4px', transition: 'width 0.8s ease' }} />
      </div>
      <span style={{ color, fontWeight: 700, fontSize: '15px', minWidth: '40px' }}>
        {Number(score).toFixed(1)}
      </span>
    </div>
  );
}

function CandidateMatchCard({ match, rank, selected, onSelect, onViewProfile, animDelay }) {
  const candidate = match.candidates || match._candidate || {};
  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const missingSkills = Array.isArray(match.missing_skills) ? match.missing_skills : [];
  const score = Number(match.final_score) || 0;
  const scoreColor = score >= 8 ? '#10B981' : score >= 6 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${selected ? '#3B82F6' : '#E2E8F0'}`,
      borderRadius: '12px',
      padding: '18px',
      marginBottom: '12px',
      transition: 'all 0.2s ease',
      animation: `slideUpFade 0.4s ease ${animDelay}ms both`,
      boxShadow: selected ? '0 0 0 3px rgba(59,130,246,0.15)' : '0 2px 6px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(match)}
          style={{ marginTop: '4px', cursor: 'pointer', accentColor: '#3B82F6', width: '16px', height: '16px' }}
        />

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row: rank + name + score */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: rank <= 3 ? 'linear-gradient(135deg, #F59E0B, #D97706)' : '#F1F5F9',
                color: rank <= 3 ? '#fff' : '#64748B',
                borderRadius: '8px', padding: '2px 10px', fontSize: '12px', fontWeight: 700
              }}>#{rank}</span>
              <span style={{ fontWeight: 700, fontSize: '16px', color: '#0F172A' }}>
                {candidate.full_name || 'Unknown'}
              </span>
              <span style={{ color: '#64748B', fontSize: '13px' }}>— {candidate.current_title || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
              <div style={{ flex: 1 }}>
                <ScoreBar score={score} />
              </div>
              <span style={{
                background: scoreColor + '18', color: scoreColor,
                border: `1px solid ${scoreColor}33`,
                borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: 600
              }}>
                {match.confidence || 'N/A'}
              </span>
            </div>
          </div>

          {/* Bio row */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '10px', fontSize: '13px', color: '#64748B' }}>
            {candidate.location && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPinIcon size={12} /> {candidate.location}</span>}
            {candidate.years_experience != null && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BriefcaseIcon size={12} /> {candidate.years_experience} yrs exp</span>}
            {candidate.expected_salary && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><DollarIcon size={12} /> ${Number(candidate.expected_salary).toLocaleString()}</span>}
            {candidate.work_mode_preference && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HomeIcon size={12} /> {candidate.work_mode_preference}</span>}
            {candidate.notice_period_days != null && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ClockIcon size={12} /> {candidate.notice_period_days}d notice</span>}
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {skills.slice(0, 6).map((s, i) => (
                <span key={i} style={{
                  background: '#EFF6FF', color: '#3B82F6', border: '1px solid #BFDBFE',
                  borderRadius: '5px', padding: '2px 7px', fontSize: '12px', fontWeight: 500
                }}>{s}</span>
              ))}
              {skills.length > 6 && (
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>+{skills.length - 6} more</span>
              )}
            </div>
          )}

          {/* Match / Missing */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {match.skill_match_score > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#065F46', background: '#F0FDF4', borderRadius: '6px', padding: '4px 8px' }}>
                <CheckIcon size={11} /> Skills: {Number(match.skill_match_score).toFixed(1)}/10
              </div>
            )}
            {match.experience_score > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#1E40AF', background: '#EFF6FF', borderRadius: '6px', padding: '4px 8px' }}>
                <BriefcaseIcon size={11} /> Exp: {Number(match.experience_score).toFixed(1)}/10
              </div>
            )}
            {missingSkills.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#991B1B', background: '#FFF5F5', borderRadius: '6px', padding: '4px 8px' }}>
                <XIcon size={11} /> Missing: {missingSkills.slice(0, 3).join(', ')}{missingSkills.length > 3 ? ` +${missingSkills.length - 3}` : ''}
              </div>
            )}
          </div>

          {/* Reason */}
          {match.reason && (
            <div style={{
              background: '#F8FAFC', borderRadius: '8px', padding: '10px 12px',
              fontSize: '13px', color: '#475569', borderLeft: '3px solid #3B82F6',
              marginBottom: '10px', lineHeight: 1.5, fontStyle: 'italic'
            }}>
              "{match.reason}"
            </div>
          )}

          {/* View Profile button */}
          <button
            onClick={() => onViewProfile(candidate)}
            style={{
              background: 'none', border: '1px solid #3B82F6', color: '#3B82F6',
              borderRadius: '8px', padding: '6px 14px', fontSize: '13px',
              cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s ease',
              fontFamily: 'Inter, sans-serif'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#3B82F6'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#3B82F6'; }}
          >
            View Full Profile →
          </button>
        </div>
      </div>
    </div>
  );
}

function RadarAnimation({ messages, currentMsgIndex }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.92)',
      zIndex: 50, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      borderRadius: '14px'
    }}>
      {/* Radar */}
      <div style={{
        width: '160px', height: '160px', borderRadius: '50%',
        border: '2px solid rgba(16,185,129,0.3)',
        background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, rgba(0,0,0,0) 70%)',
        position: 'relative', marginBottom: '24px',
        boxShadow: '0 0 30px rgba(16,185,129,0.2)'
      }}>
        {/* Radar rings */}
        {[40, 80, 120].map((size, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: size + 'px', height: size + 'px',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: '50%',
            top: `${(160 - size) / 2}px`,
            left: `${(160 - size) / 2}px`
          }} />
        ))}
        {/* Sweep line */}
        <div style={{
          position: 'absolute',
          width: '80px',
          height: '2px',
          background: 'linear-gradient(90deg, rgba(16,185,129,0), #10B981)',
          top: '78px',
          left: '80px',
          transformOrigin: 'left center',
          animation: 'radarSweep 2s linear infinite',
          boxShadow: '0 0 8px #10B981'
        }} />
        {/* Center dot */}
        <div style={{
          position: 'absolute', width: '8px', height: '8px', background: '#10B981',
          borderRadius: '50%', top: '76px', left: '76px',
          boxShadow: '0 0 8px #10B981'
        }} />
      </div>

      {/* Status messages */}
      <div style={{ textAlign: 'center', maxWidth: '300px' }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              color: i === currentMsgIndex ? '#10B981' : i < currentMsgIndex ? '#94A3B8' : '#475569',
              fontSize: i === currentMsgIndex ? '14px' : '13px',
              fontWeight: i === currentMsgIndex ? 600 : 400,
              marginBottom: '8px',
              transition: 'all 0.3s ease',
              animation: i === currentMsgIndex ? 'typewriter 0.5s ease' : 'none'
            }}
          >
            {i < currentMsgIndex ? '✓ ' : i === currentMsgIndex ? '▶ ' : '  '}{msg}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function JDMatching({ toast, settings, totalCandidates }) {
  const [jdText, setJdText] = useState(() => localStorage.getItem('jd_autosave') || '');
  const [jdTab, setJdTab] = useState('paste');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [parsedJD, setParsedJD] = useState(null);
  const [isMatching, setIsMatching] = useState(false);
  const [scanMsgIndex, setScanMsgIndex] = useState(0);
  const [matches, setMatches] = useState([]);
  const [currentJD, setCurrentJD] = useState(null);
  const [selectedMatches, setSelectedMatches] = useState(new Set());
  const [viewingCandidate, setViewingCandidate] = useState(null);
  const [jdHistory, setJdHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [shortlistName, setShortlistName] = useState('');

  const autoSaveRef = useRef(null);

  // Auto-save JD text every 30 seconds
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (jdText) localStorage.setItem('jd_autosave', jdText);
    }, 30000);
    return () => clearInterval(autoSaveRef.current);
  }, [jdText]);

  useEffect(() => {
    loadHistory();
  }, []);

  // Cycle through scan messages
  useEffect(() => {
    if (!isMatching) return;
    const interval = setInterval(() => {
      setScanMsgIndex(prev => Math.min(prev + 1, SCAN_MESSAGES.length - 1));
    }, 1600);
    return () => clearInterval(interval);
  }, [isMatching]);

  const loadHistory = async () => {
    try {
      const jds = await getJDs();
      // Get match counts
      setJdHistory(jds.map(j => ({ ...j, matchCount: j.matches?.[0]?.count || 0 })));
    } catch (e) {
      // Silently fail
    }
  };

  const getActiveJDText = () => {
    if (jdTab === 'email') return `${emailSubject}\n\n${emailBody}`;
    return jdText;
  };

  const handleFindMatches = async () => {
    const text = getActiveJDText().trim();
    if (!text || text.length < 50) {
      toast.error('Please paste a job description (at least 50 characters).');
      return;
    }

    if (!localStorage.getItem('groq_api_key') && !settings?.groqKey) {
      toast.error('Please set your Groq API key in Settings.');
      return;
    }

    setIsMatching(true);
    setScanMsgIndex(0);
    setMatches([]);
    setParsedJD(null);

    try {
      // Step 1: Parse JD
      const parsed = await withRateLimit(
        () => parseJD(text),
        () => { }
      );
      setParsedJD(parsed);

      // Step 2: Embed JD
      const embedding = await withRateLimit(
        () => getJDEmbedding(text),
        () => { }
      );

      // Step 3: Save JD to DB
      let savedJD = { id: crypto.randomUUID() };
      let jdSavedToDB = false;
      try {
        savedJD = await saveJD({
          role_title: parsed.role_title || 'Unknown Role',
          raw_text: text,
          parsed_json: parsed,
          required_skills: parsed.required_skills || [],
          min_experience_years: parsed.min_experience_years || null,
          location: parsed.location || null,
          work_mode: parsed.work_mode || null,
          budget_max: parsed.budget_max || null,
          embedding: embedding
        });
        jdSavedToDB = true;
      } catch (dbErr) {
        toast.warning(`JD not saved to DB: ${dbErr?.message || 'Unknown error'}`);
      }
      setCurrentJD(savedJD);

      // Step 4: Vector search (falls back to full scan if RPC not available)
      let candidateIds = [];
      let candidates = [];
      if (embedding) {
        try {
          const vectorMatches = await callMatchCandidates(
            embedding,
            settings?.maxResults || 50,
            0.4
          );
          candidateIds = vectorMatches.map(m => m.candidate_id);
          candidates = await getCandidatesByIds(candidateIds);
        } catch {
          // RPC not set up — fall through to full scan below
        }
      }

      if (candidates.length === 0) {
        // Fallback: get all candidates and score them
        const { data } = await getCandidatesAll({ pageSize: 100 });
        candidates = data || [];
      }

      // Step 5: Score each candidate
      const maxResults = settings?.maxResults || 50;
      const toScore = candidates.slice(0, maxResults);
      const scoredMatches = [];

      for (const candidate of toScore) {
        try {
          const score = await withRateLimit(
            () => scoreCandidate(candidate.parsed_json || candidate, parsed, settings?.weights),
            () => { }
          );
          scoredMatches.push({
            jd_id: savedJD.id,
            candidate_id: candidate.id,
            candidates: candidate,
            _candidate: candidate,
            final_score: score.final_score || 0,
            skill_match_score: score.skill_match_score || 0,
            experience_score: score.experience_score || 0,
            location_score: score.location_score || 0,
            salary_score: score.salary_score || 0,
            work_mode_score: score.work_mode_score || 0,
            missing_skills: score.missing_skills || [],
            reason: score.reason || '',
            confidence: score.confidence || 'MEDIUM'
          });
        } catch (e) {
          // Add with zero score
          scoredMatches.push({
            jd_id: savedJD.id,
            candidate_id: candidate.id,
            candidates: candidate,
            _candidate: candidate,
            final_score: 0,
            skill_match_score: 0,
            experience_score: 0,
            location_score: 0,
            salary_score: 0,
            work_mode_score: 0,
            missing_skills: [],
            reason: 'Scoring failed',
            confidence: 'LOW'
          });
        }
      }

      // Sort by score
      scoredMatches.sort((a, b) => b.final_score - a.final_score);

      // Filter by min score
      const minScore = settings?.minMatchScore || 4.0;
      const filtered = scoredMatches.filter(m => m.final_score >= minScore);

      setMatches(filtered);

      // Cache session locally so Match History tab always shows results
      try {
        const sessions = JSON.parse(localStorage.getItem('match_sessions') || '[]');
        const newSession = {
          id: savedJD.id || crypto.randomUUID(),
          role_title: parsed.role_title || 'Unknown Role',
          location: parsed.location || null,
          created_at: new Date().toISOString(),
          matches: filtered.map(m => ({
            final_score: m.final_score,
            candidate_id: m.candidate_id,
            skill_match_score: m.skill_match_score,
            experience_score: m.experience_score,
            location_score: m.location_score,
            salary_score: m.salary_score,
            work_mode_score: m.work_mode_score,
            missing_skills: m.missing_skills,
            reason: m.reason,
            confidence: m.confidence,
            candidates: m._candidate || m.candidates
          }))
        };
        sessions.unshift(newSession);
        localStorage.setItem('match_sessions', JSON.stringify(sessions.slice(0, 50)));
      } catch { /* ignore */ }

      // Step 6: Save matches to DB (only if JD was actually saved — avoids FK violation)
      if (jdSavedToDB && filtered.length > 0) {
        try {
          const toSave = filtered.map(m => ({
            jd_id: savedJD.id,
            candidate_id: m.candidate_id,
            final_score: m.final_score,
            skill_match_score: m.skill_match_score,
            experience_score: m.experience_score,
            location_score: m.location_score,
            salary_score: m.salary_score,
            work_mode_score: m.work_mode_score,
            missing_skills: m.missing_skills,
            reason: m.reason,
            confidence: m.confidence
          }));
          await saveMatches(toSave);
        } catch (me) {
          toast.warning(`Matches not saved: ${me?.message || 'Unknown error'}`);
        }
      }

      const bestScore = filtered[0]?.final_score || 0;
      const avgScore = filtered.length > 0
        ? (filtered.reduce((s, m) => s + m.final_score, 0) / filtered.length).toFixed(1)
        : 0;

      toast.success(`Top ${filtered.length} matches found for ${parsed.role_title || 'role'}! Best: ${bestScore.toFixed(1)}/10`);
      loadHistory();

    } catch (e) {
      toast.error('Matching failed: ' + e.message);
    } finally {
      setIsMatching(false);
    }
  };

  const handleSelectMatch = (match) => {
    setSelectedMatches(prev => {
      const next = new Set(prev);
      if (next.has(match.candidate_id)) next.delete(match.candidate_id);
      else next.add(match.candidate_id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedMatches.size === matches.length) {
      setSelectedMatches(new Set());
    } else {
      setSelectedMatches(new Set(matches.map(m => m.candidate_id)));
    }
  };

  const handleExportSelected = () => {
    const toExport = selectedMatches.size > 0
      ? matches.filter(m => selectedMatches.has(m.candidate_id))
      : matches;
    exportMatchesCSV(toExport, currentJD?.role_title);
    toast.success(`Exported ${toExport.length} candidates as CSV`);
  };

  const loadHistoryResults = async (jd) => {
    try {
      const matched = await getMatchesForJD(jd.id);
      setCurrentJD(jd);
      setParsedJD(jd.parsed_json || {});
      setMatches(matched);
    } catch (e) {
      toast.error('Failed to load history: ' + e.message);
    }
  };

  const avgScore = matches.length > 0
    ? (matches.reduce((s, m) => s + Number(m.final_score || 0), 0) / matches.length).toFixed(1)
    : null;
  const bestScore = matches.length > 0
    ? Math.max(...matches.map(m => Number(m.final_score || 0))).toFixed(1)
    : null;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', height: '100%' }}>
      {/* Page Header */}
      <div style={{
        padding: '24px 28px 20px',
        borderBottom: '1px solid #E2E8F0',
        background: '#fff'
      }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0F172A' }}>
          JD Matching
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '14px' }}>
          Paste a job description to find your best candidates using AI
        </p>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 145px)', overflow: 'hidden' }}>
        {/* JD History Sidebar */}
        {historyOpen && jdHistory.length > 0 && (
          <div style={{
            width: '220px',
            minWidth: '220px',
            background: '#F8FAFC',
            borderRight: '1px solid #E2E8F0',
            overflowY: 'auto',
            padding: '12px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', padding: '4px 4px' }}>
              Recent JDs
            </div>
            {jdHistory.map(jd => (
              <div
                key={jd.id}
                onClick={() => loadHistoryResults(jd)}
                style={{
                  padding: '10px', borderRadius: '8px', cursor: 'pointer',
                  marginBottom: '4px', transition: 'background 0.15s ease',
                  border: currentJD?.id === jd.id ? '1px solid #BFDBFE' : '1px solid transparent',
                  background: currentJD?.id === jd.id ? '#EFF6FF' : '#fff'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                onMouseLeave={e => e.currentTarget.style.background = currentJD?.id === jd.id ? '#EFF6FF' : '#fff'}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B', marginBottom: '3px' }}>
                  {jd.role_title || 'Untitled JD'}
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                  {jd.created_at ? new Date(jd.created_at).toLocaleDateString() : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Left Panel: JD Input */}
        <div style={{
          width: '380px',
          minWidth: '340px',
          borderRight: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff'
        }}>
          {/* Tab switcher */}
          <div style={{
            display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '0 16px'
          }}>
            {['paste', 'email'].map(tab => (
              <button
                key={tab}
                onClick={() => setJdTab(tab)}
                style={{
                  padding: '12px 16px', border: 'none', background: 'none',
                  cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  color: jdTab === tab ? '#3B82F6' : '#64748B',
                  borderBottom: jdTab === tab ? '2px solid #3B82F6' : '2px solid transparent',
                  transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif'
                }}
              >
                {tab === 'paste' ? 'Paste JD Text' : 'Email Format'}
              </button>
            ))}
          </div>

          {/* JD Text Area */}
          <div style={{ flex: 1, padding: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {jdTab === 'paste' ? (
              <>
              <textarea
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                placeholder={EXAMPLE_JD}
                style={{
                  flex: 1, width: '100%', border: '1px solid #E2E8F0', borderRadius: '10px',
                  padding: '14px', fontSize: '13px', resize: 'none', outline: 'none',
                  fontFamily: 'Inter, sans-serif', color: '#374151', lineHeight: 1.6,
                  boxSizing: 'border-box'
                }}
              />
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Email Subject: Senior Python Engineer Opportunity"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  style={{
                    padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px',
                    fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif'
                  }}
                />
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder="Email body with job description..."
                  style={{
                    flex: 1, border: '1px solid #E2E8F0', borderRadius: '10px',
                    padding: '14px', fontSize: '13px', resize: 'none', outline: 'none',
                    fontFamily: 'Inter, sans-serif', color: '#374151', lineHeight: 1.6
                  }}
                />
              </div>
            )}

            {/* Parsed JD chips */}
            {parsedJD && (
              <div style={{
                marginTop: '12px', padding: '12px', background: '#F0FDF4',
                borderRadius: '10px', border: '1px solid #BBF7D0'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#065F46', marginBottom: '8px' }}>
                  Parsed JD Fields:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {parsedJD.role_title && <Chip label="Role" value={parsedJD.role_title} />}
                  {parsedJD.min_experience_years && <Chip label="Min Exp" value={parsedJD.min_experience_years + ' yrs'} />}
                  {parsedJD.location && <Chip label="Location" value={parsedJD.location} />}
                  {parsedJD.work_mode && <Chip label="Mode" value={parsedJD.work_mode} />}
                  {parsedJD.budget_max && <Chip label="Budget" value={'$' + Number(parsedJD.budget_max).toLocaleString()} />}
                  {Array.isArray(parsedJD.required_skills) && parsedJD.required_skills.slice(0, 4).map((s, i) => (
                    <Chip key={i} label="Skill" value={s} color="#3B82F6" />
                  ))}
                </div>
              </div>
            )}

            {/* Find Matches Button */}
            <button
              onClick={handleFindMatches}
              disabled={isMatching}
              style={{
                marginTop: '12px',
                background: isMatching
                  ? '#94A3B8'
                  : 'linear-gradient(135deg, #3B82F6, #2563EB)',
                color: '#fff', border: 'none', borderRadius: '12px',
                padding: '14px', fontSize: '15px', fontWeight: 700,
                cursor: isMatching ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isMatching ? 'none' : '0 4px 20px rgba(59,130,246,0.4)',
                fontFamily: 'Inter, sans-serif'
              }}
              onMouseEnter={e => !isMatching && (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {isMatching ? <><SpinnerIcon size={15} /> Analyzing...</> : <><SearchIcon size={15} /> Find Matching Candidates</>}
            </button>
          </div>
        </div>

        {/* Right Panel: Results */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#F8FAFC', position: 'relative' }}>
          {/* Radar animation overlay */}
          {isMatching && (
            <RadarAnimation
              messages={SCAN_MESSAGES.map((m, i) => m.replace('247', String(totalCandidates || '...')))}
              currentMsgIndex={scanMsgIndex}
            />
          )}

          <div style={{ padding: '20px 24px' }}>
            {matches.length === 0 && !isMatching ? (
              /* Empty state */
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ marginBottom: '16px', color: '#CBD5E1' }}><SearchIcon size={52} /></div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  Ready to find your best candidates
                </div>
                <div style={{ color: '#94A3B8', fontSize: '14px' }}>
                  Paste a job description on the left and click "Find Matching Candidates"
                </div>
              </div>
            ) : (
              <>
                {/* Results Header */}
                <div style={{
                  background: '#fff', borderRadius: '12px', padding: '16px 20px',
                  marginBottom: '16px', border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                    Top {matches.length} Matches
                    {currentJD?.role_title && <span style={{ color: '#3B82F6' }}> for: {currentJD.role_title}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#64748B' }}>
                    <span>{matches.length} results</span>
                    {avgScore && <span>Avg Score: <strong>{avgScore}</strong>/10</span>}
                    {bestScore && <span>Best: <strong>{bestScore}</strong>/10</span>}
                    {currentJD?.created_at && (
                      <span>{new Date(currentJD.created_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {/* Bulk Actions */}
                <div style={{
                  display: 'flex', gap: '8px', marginBottom: '16px',
                  alignItems: 'center', flexWrap: 'wrap'
                }}>
                  <button
                    onClick={handleSelectAll}
                    style={{
                      background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px',
                      padding: '7px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: 500,
                      color: '#374151', fontFamily: 'Inter, sans-serif'
                    }}
                  >
                    {selectedMatches.size === matches.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedMatches.size > 0 && (
                    <span style={{ fontSize: '13px', color: '#3B82F6', fontWeight: 600 }}>
                      {selectedMatches.size} selected
                    </span>
                  )}
                  <button
                    onClick={handleExportSelected}
                    style={{
                      background: '#10B981', color: '#fff', border: 'none', borderRadius: '8px',
                      padding: '7px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: 500,
                      fontFamily: 'Inter, sans-serif'
                    }}
                    >Export {selectedMatches.size > 0 ? `${selectedMatches.size} Selected` : 'All'} as CSV
                  </button>
                </div>

                {/* Match Cards */}
                <div>
                  {matches.map((match, i) => (
                    <CandidateMatchCard
                      key={match.candidate_id || i}
                      match={match}
                      rank={i + 1}
                      selected={selectedMatches.has(match.candidate_id)}
                      onSelect={handleSelectMatch}
                      onViewProfile={setViewingCandidate}
                      animDelay={i * 50}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Candidate Drawer */}
      {viewingCandidate && (
        <CandidateDrawer candidate={viewingCandidate} onClose={() => setViewingCandidate(null)} />
      )}
    </div>
  );
}

function Chip({ label, value, color = '#10B981' }) {
  return (
    <span style={{
      background: color + '15', color, border: `1px solid ${color}30`,
      borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: 500,
      display: 'inline-flex', gap: '4px', alignItems: 'center'
    }}>
      <span style={{ opacity: 0.7 }}>{label}:</span> {value}
    </span>
  );
}
