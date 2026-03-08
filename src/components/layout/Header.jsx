import React, { useState, useEffect } from 'react';
import { ClockIcon, LogOutIcon, DatabaseIcon } from '../common/Icons';

export default function Header({ onLogout, dbConnected }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDateTime = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    }) + ' · ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  return (
    <div style={{
      height: '60px',
      background: '#fff',
      borderBottom: '1px solid #E2E8F0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      fontFamily: 'Inter, sans-serif',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Left: Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div>
          <span style={{
            color: '#0F172A', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.4px'
          }}>
            HIRE NEST
          </span>
          <span style={{
            background: '#EFF6FF', color: '#3B82F6',
            fontSize: '11px', fontWeight: 600, padding: '2px 8px',
            borderRadius: '4px', border: '1px solid #BFDBFE', letterSpacing: '0.02em',
            marginLeft: '8px'
          }}>
            AI-POWERED
          </span>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 400, marginTop: '1px' }}>
            Powered by <span style={{ color: '#3B82F6', fontWeight: 600 }}>Atkind Pvt Ltd</span>
          </div>
        </div>
      </div>

      {/* Right: DateTime + DB Status + Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* DB Connection Status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: dbConnected ? '#F0FDF4' : '#FFF5F5',
          border: `1px solid ${dbConnected ? '#BBF7D0' : '#FECACA'}`,
          borderRadius: '6px', padding: '4px 10px',
          fontSize: '12px', fontWeight: 500,
          color: dbConnected ? '#065F46' : '#991B1B'
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
            background: dbConnected ? '#22C55E' : '#EF4444',
            boxShadow: dbConnected ? '0 0 0 2px rgba(34,197,94,0.2)' : '0 0 0 2px rgba(239,68,68,0.2)'
          }} />
          {dbConnected ? 'Database Connected' : 'Database Error'}
        </div>

        {/* Date/Time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13px', fontWeight: 500 }}>
          <ClockIcon size={14} />
          {formatDateTime(now)}
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'transparent',
            border: '1px solid #E2E8F0',
            borderRadius: '7px',
            padding: '6px 14px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#64748B',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontFamily: 'Inter, sans-serif'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#FEF2F2';
            e.currentTarget.style.color = '#DC2626';
            e.currentTarget.style.borderColor = '#FECACA';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#64748B';
            e.currentTarget.style.borderColor = '#E2E8F0';
          }}
        >
          <LogOutIcon size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
