import React, { useEffect } from 'react';

export default function CandidateDrawer({ candidate, onClose }) {
  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          zIndex: 200, backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.2s ease'
        }}
      />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: '480px',
        background: '#fff', zIndex: 201, overflowY: 'auto',
        boxShadow: '-4px 0 40px rgba(0,0,0,0.15)',
        animation: 'slideInRight 0.3s cubic-bezier(0.4,0,0.2,1)',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
              {candidate.full_name || 'Candidate Profile'}
            </h2>
            {candidate.current_title && (
              <p style={{ margin: '2px 0 0', color: '#64748B', fontSize: '14px' }}>
                {candidate.current_title}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px', height: '36px', background: '#F1F5F9', border: '1px solid #E2E8F0',
              borderRadius: '8px', cursor: 'pointer', fontSize: '18px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#64748B', flexShrink: 0
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#EF4444'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#64748B'; }}
          >x</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            {[
              { icon: 'Location', label: 'Location', value: candidate.location },
              { icon: 'Experience', label: 'Experience', value: candidate.years_experience != null ? candidate.years_experience + ' years' : null },
              { icon: 'Salary', label: 'Expected Salary', value: candidate.expected_salary ? '$' + Number(candidate.expected_salary).toLocaleString() : null },
              { icon: 'Work', label: 'Work Mode', value: candidate.work_mode_preference },
              { icon: 'Notice', label: 'Notice Period', value: candidate.notice_period_days != null ? candidate.notice_period_days + ' days' : null },
              { icon: 'Uploaded', label: 'Uploaded', value: candidate.created_at ? new Date(candidate.created_at).toLocaleDateString() : null }
            ].filter(i => i.value).map(item => (
              <div key={item.label} style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px 14px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', marginTop: '2px' }}>{item.value}</div>
              </div>
            ))}
          </div>
          {(candidate.email || candidate.phone) && (
            <div style={{ marginBottom: '20px' }}>
              <ST>Contact Information</ST>
              {candidate.email && <div style={{ marginBottom: '6px', fontSize: '14px' }}>Email: <a href={'mailto:' + candidate.email} style={{ color: '#3B82F6' }}>{candidate.email}</a></div>}
              {candidate.phone && <div style={{ fontSize: '14px' }}>Phone: {candidate.phone}</div>}
            </div>
          )}
          {skills.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <ST>Skills ({skills.length})</ST>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {skills.map((s, i) => (
                  <span key={i} style={{ background: '#EFF6FF', color: '#3B82F6', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '4px 10px', fontSize: '13px', fontWeight: 500 }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {candidate.parsed_json && Object.keys(candidate.parsed_json).length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <ST>Parsed AI Data</ST>
              <pre style={{ background: '#F8FAFC', borderRadius: '10px', padding: '14px', fontSize: '12px', color: '#374151', overflowX: 'auto', border: '1px solid #E2E8F0', lineHeight: 1.6, maxHeight: '200px', overflowY: 'auto' }}>
                {JSON.stringify(candidate.parsed_json, null, 2)}
              </pre>
            </div>
          )}
          {candidate.raw_text && (
            <div style={{ marginBottom: '20px' }}>
              <ST>Resume Text Preview</ST>
              <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '14px', fontSize: '12px', color: '#475569', lineHeight: 1.7, border: '1px solid #E2E8F0', maxHeight: '250px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {candidate.raw_text.slice(0, 3000)}{candidate.raw_text.length > 3000 ? '\n...(truncated)' : ''}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ST({ children }) {
  return <h3 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</h3>;
}
