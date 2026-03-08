import React, { useState, useRef, useEffect } from 'react';
import { LogoMark, LockIcon } from '../common/Icons';

const CORRECT_PIN = '77953';
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function PinAuth({ onAuthenticated }) {
  const [digits, setDigits] = useState(['', '', '', '', '']);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [slideOut, setSlideOut] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setCountdown(0);
        setAttempts(0);
        setError('');
        clearInterval(interval);
      } else {
        setCountdown(remaining);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const isLocked = lockedUntil && Date.now() < lockedUntil;

  const handleDigitChange = (index, value) => {
    if (isLocked) return;
    const cleaned = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleaned;
    setDigits(newDigits);
    setError('');

    if (cleaned && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullPin = newDigits.join('');
    if (fullPin.length === 5 && !newDigits.includes('')) {
      verifyPin(fullPin, newDigits);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      const newDigits = [...digits];
      if (digits[index]) {
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        newDigits[index - 1] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 5);
    if (pasted.length === 5) {
      const newDigits = pasted.split('');
      setDigits(newDigits);
      verifyPin(pasted, newDigits);
    }
  };

  const verifyPin = (pin, currentDigits) => {
    if (pin === CORRECT_PIN) {
      sessionStorage.setItem('recruitai_auth', 'true');
      setSlideOut(true);
      setTimeout(() => onAuthenticated(), 600);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
        setError(`Too many attempts. Locked for ${LOCKOUT_SECONDS} seconds.`);
      } else {
        setError(`Incorrect PIN. Try again. (${MAX_ATTEMPTS - newAttempts} attempts remaining)`);
      }

      setShake(true);
      setTimeout(() => setShake(false), 600);
      setDigits(['', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0F1E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
      opacity: slideOut ? 0 : 1,
      transform: slideOut ? 'scale(0.97)' : 'scale(1)',
      transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Subtle background grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(59,130,246,0.07) 1px, transparent 1px)',
        backgroundSize: '32px 32px'
      }} />
      {/* Glow */}
      <div style={{
        position: 'absolute', width: '600px', height: '600px',
        borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%,-50%)'
      }} />

      <div style={{
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '48px 44px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        position: 'relative',
        zIndex: 1,
        animation: shake ? 'errorShake 0.5s ease' : 'none'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ display: 'inline-flex', marginBottom: '18px' }}>
            <LogoMark size={56} />
          </div>
          <h1 style={{
            color: '#F1F5F9', fontSize: '26px', fontWeight: 700,
            margin: '0 0 8px', letterSpacing: '-0.5px'
          }}>RecruitAI</h1>
          <p style={{ color: '#64748B', fontSize: '14px', margin: 0, fontWeight: 400 }}>
            Sign in to your workspace
          </p>
        </div>

        {/* PIN section */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{
            color: '#94A3B8', fontSize: '13px', textAlign: 'center',
            marginBottom: '20px', fontWeight: 500, letterSpacing: '0.01em'
          }}>
            Enter your 5-digit access PIN
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                disabled={isLocked}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                style={{
                  width: '52px',
                  height: '58px',
                  textAlign: 'center',
                  fontSize: '22px',
                  fontWeight: 700,
                  background: digit ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${digit ? 'rgba(59,130,246,0.7)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '12px',
                  color: '#F1F5F9',
                  outline: 'none',
                  transition: 'all 0.15s ease',
                  cursor: isLocked ? 'not-allowed' : 'text',
                  opacity: isLocked ? 0.5 : 1,
                  fontFamily: 'Inter, sans-serif'
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#3B82F6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = digit ? 'rgba(59,130,246,0.7)' : 'rgba(255,255,255,0.1)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            ))}
          </div>
        </div>

        {/* Error / Lockout message */}
        {isLocked ? (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '10px', padding: '12px 16px', textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
              <LockIcon size={14} style={{ color: '#FCA5A5' }} />
              <span style={{ color: '#FCA5A5', fontSize: '13px', fontWeight: 600 }}>Access Locked</span>
            </div>
            <p style={{ color: '#FCA5A5', fontSize: '13px', margin: 0 }}>
              Try again in <strong>{countdown}s</strong>
            </p>
          </div>
        ) : error ? (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '10px', padding: '10px 14px', textAlign: 'center'
          }}>
            <p style={{ color: '#FCA5A5', fontSize: '13px', margin: 0 }}>{error}</p>
          </div>
        ) : null}

        <p style={{
          color: '#334155', fontSize: '12px', textAlign: 'center',
          marginTop: '24px', marginBottom: 0, letterSpacing: '0.01em'
        }}>
          Session expires when the tab is closed
        </p>
      </div>
    </div>
  );
}
