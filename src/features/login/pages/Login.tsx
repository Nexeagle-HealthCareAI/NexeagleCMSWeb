import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Loader2, Lock, Mail, MessageSquare, Phone, RefreshCw, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import {
    requestOtp,
    requestForgotPasswordOtp,
    resetPasswordWithOtp,
    type OtpRequestResponse,
} from '../services/authService';
import './Login.css';

// ── helpers ────────────────────────────────────────────────────────────────
const looksLikeEmail = (s: string) => s.includes('@');
const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ── OTP digit strip ────────────────────────────────────────────────────────
const OtpDigits: React.FC<{ value: string[]; onChange: (v: string[]) => void; disabled: boolean }> = ({ value, onChange, disabled }) => {
    const refs = useRef<(HTMLInputElement | null)[]>([]);

    const handle = (i: number, raw: string) => {
        const digit = raw.replace(/\D/g, '').slice(-1);
        const next = [...value];
        next[i] = digit;
        onChange(next);
        if (digit && i < 5) refs.current[i + 1]?.focus();
    };

    const onKeyDown = (i: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
        if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
        if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
    };

    const onPaste = (e: React.ClipboardEvent) => {
        const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
        if (!digits.length) return;
        e.preventDefault();
        const next = ['', '', '', '', '', ''];
        digits.forEach((d, idx) => { next[idx] = d; });
        onChange(next);
        refs.current[Math.min(digits.length, 5)]?.focus();
    };

    return (
        <div className="lp-otp-digits">
            {value.map((d, i) => (
                <input
                    key={i}
                    ref={el => { refs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    disabled={disabled}
                    className={`lp-otp-digit ${d ? 'lp-otp-digit--filled' : ''}`}
                    onChange={e => handle(i, e.target.value)}
                    onKeyDown={e => onKeyDown(i, e)}
                    onPaste={onPaste}
                />
            ))}
        </div>
    );
};

// ── Main component ─────────────────────────────────────────────────────────
type Mode = 'password' | 'otp' | 'forgot';
type OtpStep = 'request' | 'verify';
type ForgotStep = 'request' | 'reset' | 'done';

const Login: React.FC = () => {
    const { login, isLoading, error } = useAuthStore();
    const navigate = useNavigate();

    // shared
    const [mode, setMode] = useState<Mode>('password');
    const [identifier, setIdentifier] = useState('');

    // password mode
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // otp mode
    const [otpStep, setOtpStep] = useState<OtpStep>('request');
    const [otpResp, setOtpResp] = useState<OtpRequestResponse | null>(null);
    const [digits, setDigits] = useState(['', '', '', '', '', '']);
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpError, setOtpError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(0);

    // forgot password mode
    const [forgotStep, setForgotStep] = useState<ForgotStep>('request');
    const [forgotResp, setForgotResp] = useState<OtpRequestResponse | null>(null);
    const [forgotDigits, setForgotDigits] = useState(['', '', '', '', '', '']);
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState<string | null>(null);
    const [forgotCountdown, setForgotCountdown] = useState(0);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // countdown ticker
    useEffect(() => {
        if (countdown <= 0) return;
        const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
        return () => clearInterval(id);
    }, [countdown]);

    useEffect(() => {
        if (forgotCountdown <= 0) return;
        const id = setInterval(() => setForgotCountdown(c => Math.max(0, c - 1)), 1000);
        return () => clearInterval(id);
    }, [forgotCountdown]);

    const switchMode = (m: Mode) => {
        setMode(m);
        setOtpStep('request');
        setOtpResp(null);
        setDigits(['', '', '', '', '', '']);
        setOtpError(null);
        setForgotStep('request');
        setForgotResp(null);
        setForgotDigits(['', '', '', '', '', '']);
        setForgotError(null);
        setNewPassword('');
        setConfirmPassword('');
    };

    // ── password submit ──
    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try { await login(identifier, password); navigate('/'); } catch { /* store holds error */ }
    };

    // ── otp step 1: request ──
    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setOtpError(null);
        setOtpLoading(true);
        try {
            const resp = await requestOtp(identifier);
            setOtpResp(resp);
            setOtpStep('verify');
            setCountdown(10 * 60);
        } catch (err: any) {
            setOtpError(err.message || 'Failed to send OTP');
        } finally {
            setOtpLoading(false);
        }
    };

    // ── otp step 2: verify ──
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = digits.join('');
        if (code.length < 6) { setOtpError('Please enter all 6 digits.'); return; }
        setOtpError(null);
        setOtpLoading(true);
        try {
            await useAuthStore.getState().applyOtpSession(identifier, code);
            navigate('/');
        } catch (err: any) {
            setOtpError(err.message || 'Invalid or expired OTP');
            setDigits(['', '', '', '', '', '']);
        } finally {
            setOtpLoading(false);
        }
    };

    const maskedTarget = identifier.includes('@')
        ? identifier.replace(/(.{2}).+(@.+)/, '$1•••$2')
        : identifier.replace(/(\+?\d{2})\d+(\d{3})/, '$1•••••$2');

    const isPhone = !looksLikeEmail(identifier) && identifier.length > 4;

    // ── forgot: step 1: request OTP ──
    const handleForgotRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotError(null);
        setForgotLoading(true);
        try {
            const resp = await requestForgotPasswordOtp(identifier);
            setForgotResp(resp);
            setForgotStep('reset');
            setForgotCountdown(10 * 60);
        } catch (err: any) {
            setForgotError(err.message || 'Failed to send OTP');
        } finally {
            setForgotLoading(false);
        }
    };

    // ── forgot: step 2: reset password ──
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = forgotDigits.join('');
        if (code.length < 6) { setForgotError('Please enter all 6 digits.'); return; }
        if (!newPassword) { setForgotError('Please enter a new password.'); return; }
        if (newPassword.length < 8) { setForgotError('Password must be at least 8 characters.'); return; }
        if (newPassword !== confirmPassword) { setForgotError('Passwords do not match.'); return; }
        setForgotError(null);
        setForgotLoading(true);
        try {
            await resetPasswordWithOtp(identifier, code, newPassword);
            setForgotStep('done');
        } catch (err: any) {
            setForgotError(err.message || 'Failed to reset password');
            setForgotDigits(['', '', '', '', '', '']);
        } finally {
            setForgotLoading(false);
        }
    };

    return (
        <div className="lp-root">

            {/* ── LEFT BANNER ── */}
            <div className="lp-banner">
                <div className="lp-banner-content">
                    <div className="lp-logo-wrap">
                        <div className="lp-logo-ring"><img src="/Logo.png" alt="NexEagle Logo" style={{ height: '50px', width: 'auto' }} /></div>
                    </div>
                    <p className="lp-brand-main">NexEagle</p>
                    <h1 className="lp-brand-sub">Central Management System</h1>
                    <p className="lp-tagline">
                        Secure Access to the NexEagle Network
                    </p>
                </div>
                <p className="lp-footer-text">© 2025 NexEagle</p>
            </div>

            {/* ── RIGHT FORM PANEL ── */}
            <div className="lp-form-panel">
                <div className="lp-form-wrap">

                    <div className="lp-mobile-logo">
                        <img src="/Logo.png" alt="NexEagle Logo" style={{ height: '28px', width: 'auto' }} /><span>NexEagle CMS</span>
                    </div>

                    <div className="lp-form-header">
                        <h1>Welcome back</h1>
                        <p>Sign in to your CMS account</p>
                    </div>

                    {/* ── Mode tabs (hidden in forgot mode) ── */}
                    {mode !== 'forgot' && (
                    <div className="lp-tabs">
                        <button
                            type="button"
                            className={`lp-tab ${mode === 'password' ? 'lp-tab--active' : ''}`}
                            onClick={() => switchMode('password')}
                        >
                            <Lock size={14} /> Password
                        </button>
                        <button
                            type="button"
                            className={`lp-tab ${mode === 'otp' ? 'lp-tab--active' : ''}`}
                            onClick={() => switchMode('otp')}
                        >
                            <MessageSquare size={14} /> OTP
                        </button>
                    </div>
                    )}

                    {/* ── PASSWORD MODE ── */}
                    {mode === 'password' && (
                        <>
                            {error && <div className="lp-error">{error}</div>}
                            <form onSubmit={handlePasswordLogin} className="lp-form" noValidate>
                                <label className="lp-field">
                                    <span>Email or Phone</span>
                                    <div className="lp-input-wrap">
                                        {isPhone
                                            ? <Phone size={15} className="lp-input-icon" />
                                            : <Mail size={15} className="lp-input-icon" />}
                                        <input
                                            type="text"
                                            placeholder="email@nexeagle.com or +91…"
                                            value={identifier}
                                            onChange={e => setIdentifier(e.target.value)}
                                            disabled={isLoading}
                                            autoComplete="username"
                                            required
                                        />
                                    </div>
                                </label>
                                <label className="lp-field">
                                    <span>Password</span>
                                    <div className="lp-input-wrap">
                                        <Lock size={15} className="lp-input-icon" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            disabled={isLoading}
                                            autoComplete="current-password"
                                            required
                                            style={{ paddingRight: '40px' }}
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPassword(!showPassword)} 
                                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </label>
                                <button type="submit" className="lp-submit" disabled={isLoading}>
                                    {isLoading ? <><Loader2 size={16} className="lp-spin" /> Signing in…</> : 'Sign In'}
                                </button>
                                <button type="button" className="lp-forgot-link" onClick={() => switchMode('forgot')}>
                                    Forgot password?
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── OTP MODE ── */}
                    {mode === 'otp' && (
                        <>
                            {otpError && <div className="lp-error">{otpError}</div>}

                            {/* Step 1 – request OTP */}
                            {otpStep === 'request' && (
                                <form onSubmit={handleRequestOtp} className="lp-form" noValidate>
                                    <label className="lp-field">
                                        <span>Email or Phone</span>
                                        <div className="lp-input-wrap">
                                            {isPhone
                                                ? <Phone size={15} className="lp-input-icon" />
                                                : <Mail size={15} className="lp-input-icon" />}
                                            <input
                                                type="text"
                                                placeholder="email@nexeagle.com or +91…"
                                                value={identifier}
                                                onChange={e => setIdentifier(e.target.value)}
                                                disabled={otpLoading}
                                                autoComplete="username"
                                                required
                                            />
                                        </div>
                                    </label>
                                    <button type="submit" className="lp-submit" disabled={otpLoading || !identifier.trim()}>
                                        {otpLoading
                                            ? <><Loader2 size={16} className="lp-spin" /> Sending…</>
                                            : <><KeyRound size={15} /> Send OTP</>}
                                    </button>
                                </form>
                            )}

                            {/* Step 2 – enter OTP */}
                            {otpStep === 'verify' && (
                                <form onSubmit={handleVerifyOtp} className="lp-form" noValidate>
                                    <div className="lp-otp-sent-to">
                                        OTP sent via <strong>{otpResp?.deliveryMethod}</strong> to <strong>{maskedTarget}</strong>
                                        <button type="button" className="lp-link" onClick={() => setOtpStep('request')}>Change</button>
                                    </div>

                                    {/* Dev hint */}
                                    {otpResp?.devOtp && (
                                        <div className="lp-dev-hint">
                                            <span>Dev OTP:</span> <strong>{otpResp.devOtp}</strong>
                                        </div>
                                    )}

                                    <OtpDigits value={digits} onChange={setDigits} disabled={otpLoading} />

                                    {/* Countdown */}
                                    <div className="lp-otp-timer">
                                        {countdown > 0
                                            ? <span>Expires in <strong>{fmtTime(countdown)}</strong></span>
                                            : <span className="lp-otp-expired">OTP expired —</span>}
                                        {' '}
                                        {countdown === 0 && (
                                            <button
                                                type="button"
                                                className="lp-link"
                                                onClick={e => { setDigits(['','','','','','']); handleRequestOtp(e as any); }}
                                            >
                                                Resend OTP
                                            </button>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        className="lp-submit"
                                        disabled={otpLoading || digits.join('').length < 6 || countdown === 0}
                                    >
                                        {otpLoading
                                            ? <><Loader2 size={16} className="lp-spin" /> Verifying…</>
                                            : 'Verify & Sign In'}
                                    </button>
                                </form>
                            )}
                        </>
                    )}

                    {/* ── FORGOT PASSWORD MODE ── */}
                    {mode === 'forgot' && (
                        <>
                            <div className="lp-forgot-header">
                                <button type="button" className="lp-back-btn" onClick={() => switchMode('password')}>
                                    <ArrowLeft size={15} /> Back to sign in
                                </button>
                                <h2 className="lp-forgot-title">Reset password</h2>
                            </div>

                            {forgotError && <div className="lp-error">{forgotError}</div>}

                            {/* Step 1 – enter identifier */}
                            {forgotStep === 'request' && (
                                <form onSubmit={handleForgotRequestOtp} className="lp-form" noValidate>
                                    <p className="lp-forgot-desc">
                                        Enter the email or phone number linked to your account and we'll send you a one-time code.
                                    </p>
                                    <label className="lp-field">
                                        <span>Email or Phone</span>
                                        <div className="lp-input-wrap">
                                            {isPhone
                                                ? <Phone size={15} className="lp-input-icon" />
                                                : <Mail size={15} className="lp-input-icon" />}
                                            <input
                                                type="text"
                                                placeholder="email@nexeagle.com or +91…"
                                                value={identifier}
                                                onChange={e => setIdentifier(e.target.value)}
                                                disabled={forgotLoading}
                                                autoComplete="username"
                                                required
                                            />
                                        </div>
                                    </label>
                                    <button type="submit" className="lp-submit" disabled={forgotLoading || !identifier.trim()}>
                                        {forgotLoading
                                            ? <><Loader2 size={16} className="lp-spin" /> Sending…</>
                                            : <><KeyRound size={15} /> Send Reset Code</>}
                                    </button>
                                </form>
                            )}

                            {/* Step 2 – enter OTP + new password */}
                            {forgotStep === 'reset' && (
                                <form onSubmit={handleResetPassword} className="lp-form" noValidate>
                                    <div className="lp-otp-sent-to">
                                        Code sent via <strong>{forgotResp?.deliveryMethod}</strong> to <strong>{maskedTarget}</strong>
                                        <button type="button" className="lp-link" onClick={() => setForgotStep('request')}>Change</button>
                                    </div>

                                    {forgotResp?.devOtp && (
                                        <div className="lp-dev-hint">
                                            <span>Dev OTP:</span> <strong>{forgotResp.devOtp}</strong>
                                        </div>
                                    )}

                                    <label className="lp-field"><span>One-time code</span></label>
                                    <OtpDigits value={forgotDigits} onChange={setForgotDigits} disabled={forgotLoading} />

                                    <div className="lp-otp-timer">
                                        {forgotCountdown > 0
                                            ? <span>Expires in <strong>{fmtTime(forgotCountdown)}</strong></span>
                                            : <span className="lp-otp-expired">Code expired —</span>}
                                        {' '}
                                        {forgotCountdown === 0 && (
                                            <button
                                                type="button"
                                                className="lp-link"
                                                onClick={e => { setForgotDigits(['','','','','','']); handleForgotRequestOtp(e as any); }}
                                            >
                                                <RefreshCw size={12} /> Resend
                                            </button>
                                        )}
                                    </div>

                                    <label className="lp-field">
                                        <span>New password</span>
                                        <div className="lp-input-wrap">
                                            <Lock size={15} className="lp-input-icon" />
                                            <input
                                                type="password"
                                                placeholder="Min. 8 characters"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                disabled={forgotLoading}
                                                autoComplete="new-password"
                                                required
                                            />
                                        </div>
                                    </label>
                                    <label className="lp-field">
                                        <span>Confirm new password</span>
                                        <div className="lp-input-wrap">
                                            <Lock size={15} className="lp-input-icon" />
                                            <input
                                                type="password"
                                                placeholder="Repeat password"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                disabled={forgotLoading}
                                                autoComplete="new-password"
                                                required
                                            />
                                        </div>
                                    </label>

                                    <button
                                        type="submit"
                                        className="lp-submit"
                                        disabled={forgotLoading || forgotDigits.join('').length < 6 || forgotCountdown === 0}
                                    >
                                        {forgotLoading
                                            ? <><Loader2 size={16} className="lp-spin" /> Resetting…</>
                                            : 'Reset Password'}
                                    </button>
                                </form>
                            )}

                            {/* Step 3 – success */}
                            {forgotStep === 'done' && (
                                <div className="lp-reset-success">
                                    <div className="lp-reset-success-icon"><ShieldCheck size={36} strokeWidth={1.5} /></div>
                                    <p className="lp-reset-success-msg">Password reset successfully!</p>
                                    <p className="lp-reset-success-sub">You can now sign in with your new password.</p>
                                    <button type="button" className="lp-submit" onClick={() => switchMode('password')}>
                                        Go to Sign In
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    <p className="lp-hint">Protected by NexEagle Security · All rights reserved</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
