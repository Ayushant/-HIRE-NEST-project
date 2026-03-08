import React, { useState } from 'react';
import { testSupabaseConnection, SUPABASE_URL, SUPABASE_KEY, setupDatabase, DB_SETUP_SQL } from '../../lib/supabase';
import { testGroq, testJina } from '../../lib/openai';
import { DatabaseIcon, ZapIcon, SettingsIcon, LockIcon, KeyIcon, EyeIcon, EyeOffIcon, CopyIcon, CodeIcon, ToolIcon, SpinnerIcon, CheckIcon, XIcon } from '../common/Icons';

const CORRECT_PIN = '77953';

function FieldRow({ label, children, hint }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>{hint}</p>}
    </div>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: '20px', overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid #E2E8F0',
        fontWeight: 700, color: '#0F172A', fontSize: '15px',
        display: 'flex', alignItems: 'center', gap: '9px'
      }}>
        {icon && <span style={{ color: '#64748B', display: 'flex' }}>{icon}</span>} {title}
      </div>
      <div style={{ padding: '20px 24px' }}>
        {children}
      </div>
    </div>
  );
}

export default function Settings({ settings, updateSettings, updateWeights, toast }) {
  const [groqKey, setGroqKey] = useState(localStorage.getItem('groq_api_key') || '');
  const [jinaKey, setJinaKey] = useState(localStorage.getItem('jina_api_key') || '');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showJinaKey, setShowJinaKey] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [testingGroq, setTestingGroq] = useState(false);
  const [testingJina, setTestingJina] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState(null);
  const [groqStatus, setGroqStatus] = useState(null);
  const [jinaStatus, setJinaStatus] = useState(null);
  const [weights, setWeights] = useState(settings.weights || { skills: 40, experience: 25, location: 15, salary: 10, workMode: 10 });
  const [minScore, setMinScore] = useState(settings.minMatchScore || 4.0);
  const [maxResults, setMaxResults] = useState(settings.maxResults || 50);
  const [dbSetupLoading, setDbSetupLoading] = useState(false);
  const [showSQL, setShowSQL] = useState(false);

  // PIN change
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState(null);

  const totalWeight = Object.values(weights).reduce((a, b) => a + Number(b), 0);

  const handleWeightChange = (key, value) => {
    setWeights(prev => ({ ...prev, [key]: Number(value) }));
  };

  const saveWeights = () => {
    if (totalWeight !== 100) {
      toast.warning(`Weights must sum to 100% (currently ${totalWeight}%)`);
      return;
    }
    updateWeights(weights);
    toast.success('Scoring weights saved!');
  };

  const saveGeneralSettings = () => {
    localStorage.setItem('groq_api_key', groqKey);
    localStorage.setItem('jina_api_key', jinaKey);
    updateSettings({ groqKey, jinaKey, minMatchScore: minScore, maxResults });
    toast.success('Settings saved!');
  };

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    setSupabaseStatus(null);
    const result = await testSupabaseConnection();
    setSupabaseStatus(result);
    setTestingSupabase(false);
    toast[result.ok ? 'success' : 'error']('Supabase: ' + result.message);
  };

  const handleTestGroq = async () => {
    setTestingGroq(true);
    setGroqStatus(null);
    const result = await testGroq(groqKey);
    setGroqStatus(result);
    setTestingGroq(false);
    toast[result.ok ? 'success' : 'error']('Groq: ' + result.message);
  };

  const handleTestJina = async () => {
    setTestingJina(true);
    setJinaStatus(null);
    const result = await testJina(jinaKey);
    setJinaStatus(result);
    setTestingJina(false);
    toast[result.ok ? 'success' : 'error']('Jina: ' + result.message);
  };

  const handleSetupDB = async () => {
    setDbSetupLoading(true);
    toast.info('Setting up database tables...');
    try {
      // Try direct SQL via Supabase REST
      const result = await setupDatabase();
      toast[result.ok ? 'success' : 'warning'](result.message);
    } catch (e) {
      toast.error('DB setup failed: ' + e.message);
    } finally {
      setDbSetupLoading(false);
    }
  };

  const handleChangePin = () => {
    const storedPin = localStorage.getItem('recruitai_pin') || CORRECT_PIN;
    if (currentPin !== storedPin) {
      setPinMsg({ ok: false, text: 'Current PIN is incorrect.' });
      return;
    }
    if (newPin.length !== 5 || !/^\d{5}$/.test(newPin)) {
      setPinMsg({ ok: false, text: 'New PIN must be exactly 5 digits.' });
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg({ ok: false, text: 'PINs do not match.' });
      return;
    }
    localStorage.setItem('recruitai_pin', newPin);
    setPinMsg({ ok: true, text: 'PIN changed successfully!' });
    setCurrentPin(''); setNewPin(''); setConfirmPin('');
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0',
    borderRadius: '8px', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
    background: '#F8FAFC', color: '#374151'
  };

  const lockedInputStyle = {
    ...inputStyle,
    background: '#F1F5F9', color: '#64748B', cursor: 'not-allowed'
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #E2E8F0', background: '#fff' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0F172A' }}>Settings</h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '14px' }}>Configure connections, AI weights, and preferences</p>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: '800px' }}>

        {/* Database Connection section hidden — connection is pre-configured server-side */}

        {/* AI Providers section hidden — keys are managed server-side via Supabase Edge Function secrets */}

        {/* Scoring Weights */}
        <SectionCard title="Scoring Weights" icon={<SettingsIcon size={16} />}>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748B' }}>
            Adjust how each factor contributes to the final match score. Must sum to 100%.
            Current total: <strong style={{ color: totalWeight === 100 ? '#10B981' : '#EF4444' }}>{totalWeight}%</strong>
          </p>
          {[
            { key: 'skills', label: 'Skills Match', color: '#3B82F6' },
            { key: 'experience', label: 'Experience', color: '#8B5CF6' },
            { key: 'location', label: 'Location', color: '#10B981' },
            { key: 'salary', label: 'Salary', color: '#F59E0B' },
            { key: 'workMode', label: 'Work Mode', color: '#EF4444' }
          ].map(({ key, label, color }) => (
            <div key={key} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color }}>{weights[key]}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={weights[key]}
                onChange={e => handleWeightChange(key, e.target.value)}
                style={{ width: '100%', accentColor: color, cursor: 'pointer' }}
              />
            </div>
          ))}
          <button
            onClick={saveWeights}
            style={{
              background: totalWeight === 100 ? '#10B981' : '#94A3B8', color: '#fff',
              border: 'none', borderRadius: '8px', padding: '9px 18px',
              fontSize: '13px', cursor: totalWeight === 100 ? 'pointer' : 'not-allowed',
              fontWeight: 600, fontFamily: 'Inter, sans-serif'
            }}
          >
            {totalWeight === 100 ? 'Save Weights' : `Weights must sum to 100% (currently ${totalWeight}%)`}
          </button>
        </SectionCard>

        {/* Match Preferences */}
        <SectionCard title="Match Preferences" icon={<SettingsIcon size={16} />}>
          <FieldRow
            label={`Min Match Score Threshold: ${minScore.toFixed(1)}/10`}
            hint="Candidates below this score will be excluded from results."
          >
            <input
              type="range" min={0} max={10} step={0.5}
              value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#3B82F6', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
              <span>0 (Show all)</span><span>5 (Moderate)</span><span>10 (Strict)</span>
            </div>
          </FieldRow>
          <FieldRow
            label={`Max Results per JD: ${maxResults}`}
            hint="Maximum number of candidates to score per job description (1–100)."
          >
            <input
              type="range" min={10} max={100} step={10}
              value={maxResults}
              onChange={e => setMaxResults(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#8B5CF6', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
              <span>10</span><span>50</span><span>100</span>
            </div>
          </FieldRow>
          <button
            onClick={saveGeneralSettings}
            style={{
              background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '9px 18px', fontSize: '13px', cursor: 'pointer',
              fontWeight: 600, fontFamily: 'Inter, sans-serif'
            }}
          >Save Preferences</button>
        </SectionCard>

        {/* Change PIN */}
        <SectionCard title="Change Access PIN" icon={<LockIcon size={16} />}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <FieldRow label="Current PIN">
              <input
                type="password" inputMode="numeric" maxLength={5}
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="•••••"
                style={{ ...inputStyle, textAlign: 'center', letterSpacing: '6px', fontSize: '16px' }}
              />
            </FieldRow>
            <FieldRow label="New PIN">
              <input
                type="password" inputMode="numeric" maxLength={5}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="•••••"
                style={{ ...inputStyle, textAlign: 'center', letterSpacing: '6px', fontSize: '16px' }}
              />
            </FieldRow>
            <FieldRow label="Confirm New PIN">
              <input
                type="password" inputMode="numeric" maxLength={5}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="•••••"
                style={{ ...inputStyle, textAlign: 'center', letterSpacing: '6px', fontSize: '16px' }}
              />
            </FieldRow>
          </div>
          <button
            onClick={handleChangePin}
            style={{
              background: '#0F172A', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '9px 18px', fontSize: '13px', cursor: 'pointer',
              fontWeight: 600, fontFamily: 'Inter, sans-serif'
            }}
          >Change PIN</button>
          {pinMsg && (
            <div style={{
              marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
              background: pinMsg.ok ? '#F0FDF4' : '#FFF5F5',
              border: `1px solid ${pinMsg.ok ? '#BBF7D0' : '#FECACA'}`,
              color: pinMsg.ok ? '#065F46' : '#991B1B', fontSize: '13px', fontWeight: 500
            }}>
              {pinMsg.ok ? <CheckIcon size={13} style={{ flexShrink: 0 }} /> : <XIcon size={13} style={{ flexShrink: 0 }} />} {pinMsg.text}
            </div>
          )}
        </SectionCard>

      </div>
    </div>
  );
}
