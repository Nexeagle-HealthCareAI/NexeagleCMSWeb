import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './Login.css';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, isLoading, error } = useAuthStore();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            // Error is handled by context and displayed below
            console.error(err);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1 className="login-title">
                        Welcome Back
                    </h1>
                    <p className="login-subtitle">Sign in to access your CMS dashboard</p>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="input-group">
                        <Mail size={16} className="input-icon" />
                        <input
                            type="email"
                            placeholder="admin@cms.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="login-input"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="input-group">
                        <Lock size={16} className="input-icon" />
                        <input
                            type="password"
                            placeholder="admin"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="login-input"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={16} /> : 'Sign In'}
                    </button>
                </form>

                <div className="login-footer">
                    Default: admin@cms.com / admin
                </div>
            </div>
        </div>
    );
};

export default Login;
