import React from 'react';
import { User, Bell, Monitor, Shield } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './Settings.css';

const Settings: React.FC = () => {
    const { user } = useAuthStore();
    const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
    const [notifications, setNotifications] = React.useState({
        email: true,
        push: false
    });

    return (
        <div className="settings-container">
            <header className="settings-header">
                <h1 className="settings-title">Settings</h1>
                <p className="settings-subtitle">Manage your account preferences and application settings.</p>
            </header>

            {/* Profile Section */}
            <section className="settings-section">
                <h2 className="section-title">
                    <User size={20} />
                    Profile Information
                </h2>
                <div className="profile-grid">
                    <div className="profile-field">
                        <span className="profile-label">Name</span>
                        <span className="profile-value">{user?.name || 'User'}</span>
                    </div>
                    <div className="profile-field">
                        <span className="profile-label">Email</span>
                        <span className="profile-value">{user?.email || 'N/A'}</span>
                    </div>
                    <div className="profile-field">
                        <span className="profile-label">Role</span>
                        <span className="profile-value" style={{ textTransform: 'capitalize' }}>
                            {user?.role || 'User'}
                        </span>
                    </div>
                    <div className="profile-field">
                        <span className="profile-label">User ID</span>
                        <span className="profile-value">{user?.id || 'N/A'}</span>
                    </div>
                </div>
            </section>

            {/* Appearance Section */}
            <section className="settings-section">
                <h2 className="section-title">
                    <Monitor size={20} />
                    Appearance
                </h2>
                <div className="setting-item">
                    <div className="setting-info">
                        <h4>Theme</h4>
                        <p>Customize how the application looks properly.</p>
                    </div>
                    <div className="setting-control">
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                        >
                            <option value="light">Light Mode</option>
                            <option value="dark">Dark Mode</option>
                        </select>
                    </div>
                </div>
            </section>

            {/* Notifications Section */}
            <section className="settings-section">
                <h2 className="section-title">
                    <Bell size={20} />
                    Notifications
                </h2>
                <div className="setting-item">
                    <div className="setting-info">
                        <h4>Email Notifications</h4>
                        <p>Receive daily summaries and critical alerts via email.</p>
                    </div>
                    <div className="setting-control">
                        <input
                            type="checkbox"
                            checked={notifications.email}
                            onChange={(e) => setNotifications(prev => ({ ...prev, email: e.target.checked }))}
                        />
                    </div>
                </div>
                <div className="setting-item">
                    <div className="setting-info">
                        <h4>Push Notifications</h4>
                        <p>Receive real-time alerts on your desktop.</p>
                    </div>
                    <div className="setting-control">
                        <input
                            type="checkbox"
                            checked={notifications.push}
                            onChange={(e) => setNotifications(prev => ({ ...prev, push: e.target.checked }))}
                        />
                    </div>
                </div>
            </section>

            {/* Security Section (Placeholder) */}
            <section className="settings-section">
                <h2 className="section-title">
                    <Shield size={20} />
                    Security
                </h2>
                <div className="setting-item">
                    <div className="setting-info">
                        <h4>Password</h4>
                        <p>Change your account password.</p>
                    </div>
                    <div className="setting-control">
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white' }}>
                            Change Password
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Settings;
