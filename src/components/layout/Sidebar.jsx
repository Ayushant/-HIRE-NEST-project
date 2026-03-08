import React from 'react';
import { LibraryIcon, MatchIcon, HistoryIcon, SettingsIcon, LogoMark } from '../common/Icons';

const NAV_ITEMS = [
  { id: 'resume', Icon: LibraryIcon, label: 'Resume Library' },
  { id: 'jd', Icon: MatchIcon, label: 'JD Matching' },
  { id: 'history', Icon: HistoryIcon, label: 'Match History' },
  { id: 'settings', Icon: SettingsIcon, label: 'Settings' }
];

export default function Sidebar({ activeTab, onTabChange }) {
  return (
    <div style={{
      width: '228px',
      minWidth: '228px',
      background: '#0A0F1E',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      position: 'sticky',
      top: 0,
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Brand */}
      <div style={{
        padding: '24px 20px 22px',
        borderBottom: '1px solid rgba(255,255,255,0.07)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
          <LogoMark size={36} />
          <div>
            <div style={{
              color: '#F1F5F9', fontWeight: 700, fontSize: '16px',
              letterSpacing: '-0.4px', lineHeight: 1.2
            }}>
              HIRE NEST
            </div>
            <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px', fontWeight: 500 }}>
              Workflow Pvt Ltd
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.map(({ id, Icon, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '11px',
                padding: '10px 12px',
                borderRadius: '9px',
                border: 'none',
                cursor: 'pointer',
                background: isActive ? 'rgba(59,130,246,0.14)' : 'transparent',
                color: isActive ? '#60A5FA' : '#64748B',
                fontWeight: isActive ? 600 : 500,
                fontSize: '14px',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                borderLeft: `2px solid ${isActive ? '#3B82F6' : 'transparent'}`,
                fontFamily: 'Inter, sans-serif',
                outline: 'none'
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = '#94A3B8';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#64748B';
                }
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '14px 20px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        fontSize: '11px',
        fontWeight: 500
      }}>
        <div style={{ color: '#475569' }}>HIRE NEST Workflow Pvt Ltd</div>
        <div style={{ marginTop: '3px', color: '#1E293B', fontSize: '10px' }}>Powered by <span style={{ color: '#3B82F6', fontWeight: 600 }}>Atkind Pvt Ltd</span></div>
      </div>
    </div>
  );
}
