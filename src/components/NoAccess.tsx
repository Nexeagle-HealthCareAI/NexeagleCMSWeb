import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NoAccess: React.FC = () => {
    const navigate = useNavigate();
    return (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#475569' }}>
            <ShieldAlert size={56} color="#ef4444" />
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '16px 0 6px' }}>No access</h1>
            <p style={{ maxWidth: '420px', lineHeight: 1.6 }}>
                You don't have permission to view this page. If you think this is a mistake, ask an administrator to grant you access.
            </p>
            <button
                onClick={() => navigate('/')}
                style={{ marginTop: '18px', padding: '10px 18px', borderRadius: '8px', border: '1px solid #0f52ba', background: '#0f52ba', color: 'white', fontWeight: 700, cursor: 'pointer' }}
            >
                Back to Dashboard
            </button>
        </div>
    );
};

export default NoAccess;
