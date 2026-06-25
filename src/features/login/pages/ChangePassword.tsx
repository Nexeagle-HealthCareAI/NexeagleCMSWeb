import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';

const ChangePassword: React.FC = () => {
    const navigate = useNavigate();
    const changePassword = useAuthStore((s) => s.changePassword);
    const mustChange = useAuthStore((s) => s.mustChangePassword);

    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (next.length < 8) { setError('New password must be at least 8 characters.'); return; }
        if (next !== confirm) { setError('New password and confirmation do not match.'); return; }
        setBusy(true);
        try {
            await changePassword(current, next);
            navigate('/', { replace: true });
        } catch (err: any) {
            setError(err.message || 'Password change failed.');
        } finally {
            setBusy(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px',
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
            <form onSubmit={submit} style={{ width: '380px', background: 'white', padding: '28px', borderRadius: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <KeyRound size={24} color="#0f52ba" />
                    <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Change password</h1>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '18px' }}>
                    {mustChange ? 'You must set a new password before continuing.' : 'Update your account password.'}
                </p>

                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Current password
                    <input style={inputStyle} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginTop: '14px' }}>New password
                    <input style={inputStyle} type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginTop: '14px' }}>Confirm new password
                    <input style={inputStyle} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                </label>

                {error && <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '12px' }}>{error}</div>}

                <button type="submit" disabled={busy}
                    style={{ width: '100%', marginTop: '20px', padding: '11px', borderRadius: '8px', border: 'none', background: busy ? '#94a3b8' : '#0f52ba', color: 'white', fontWeight: 700, fontSize: '14px', cursor: busy ? 'default' : 'pointer' }}>
                    {busy ? 'Saving…' : 'Set new password'}
                </button>
            </form>
        </div>
    );
};

export default ChangePassword;
