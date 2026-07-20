import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, CreditCard, LifeBuoy, Settings, WifiOff, RefreshCw, Grid, Building2, Users, Wallet, Calculator, Activity, UserCheck, LogOut, Home, Download, X, Stethoscope } from 'lucide-react';
import Sidebar from './Sidebar';
import { useSupportStore } from '../store/useSupportStore';
import { useAuthStore } from '../store/useAuthStore';
import { Toaster } from 'sonner';
import { syncManager } from '../utils/syncManager';
import './Layout.css';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

const Layout: React.FC = () => {
    const location = useLocation();
    const logout = useAuthStore((s) => s.logout);
    const user = useAuthStore((s) => s.user);
    const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing'>('idle');
    const [isMenuOpen, setMenuOpen] = useState(false);
    const [isProfileOpen, setProfileOpen] = useState(false);

    // PWA Add to Home state
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);

    // Initial placeholder logic
    const initials = user?.name ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase() : 'U';

    // Click outside handler for profile dropdown
    useEffect(() => {
        const handleDocumentClick = () => {
            setProfileOpen(false);
        };
        if (isProfileOpen) {
            window.addEventListener('click', handleDocumentClick);
        }
        return () => window.removeEventListener('click', handleDocumentClick);
    }, [isProfileOpen]);

    // PWA install trigger listener
    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowInstallPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        if (window.matchMedia('(display-mode: standalone)').matches) {
            setShowInstallPrompt(false);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
    };

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (!mobile) {
                setSidebarOpen(true); // Auto expand on desktop
            } else {
                setSidebarOpen(false); // Auto collapse on mobile
            }
        };

        const handleOnline = () => {
            setIsOnline(true);
            syncManager.sync();
        };
        const handleOffline = () => setIsOnline(false);

        const handleQueueUpdate = (e: any) => {
            setPendingCount(e.detail.count);
        };
        const handleSyncStatus = (e: any) => {
            setSyncStatus(e.detail.status);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('sync-queue-updated', handleQueueUpdate);
        window.addEventListener('sync-status', handleSyncStatus);

        // Set initial pending count
        setPendingCount(syncManager.getQueue().length);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('sync-queue-updated', handleQueueUpdate);
            window.removeEventListener('sync-status', handleSyncStatus);
        };
    }, []);

    const initSupport = useSupportStore(state => state.initConnection);

    useEffect(() => {
        initSupport();
    }, [initSupport]);

    // Refresh the current user's permissions on app load so route/menu gating stays current.
    useEffect(() => {
        void useAuthStore.getState().fetchMe();
    }, []);

    const toggleSidebar = () => {
        setSidebarOpen(!isSidebarOpen);
    };

    // Card menu items in the bottom sheet (excluding onboarded hospitals, support)
    const cardMenuItems = [
        { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={22} /> },
        { path: '/doctors', label: 'Doctor Dekho', icon: <Stethoscope size={22} /> },
        { path: '/partners', label: 'Partners', icon: <Users size={22} /> },
        { path: '/subscriptions', label: 'Verify Payments', icon: <Wallet size={22} /> },
        { path: '/manage-plans', label: 'Manage Plans', icon: <Calculator size={22} /> },
        { path: '/hospital-subscriptions', label: 'Subscriptions', icon: <CreditCard size={22} /> },
        { path: '/application-health', label: 'App Health', icon: <Activity size={22} /> },
        { path: '/radai-cost', label: 'RadAI Cost', icon: <Calculator size={22} /> },
        { path: '/users', label: 'Users & Access', icon: <UserCheck size={22} /> },
    ];

    return (
        <div className="app-layout">
            <Toaster position="top-right" richColors />
            <Sidebar isOpen={isSidebarOpen} toggle={toggleSidebar} isMobile={isMobile} />

            <div className="content-wrapper">
                {/* Mobile Header (PWA Styled) */}
                {isMobile && (
                    <header className="mobile-header">
                        <div className="mobile-logo-container">
                            <img src="/Logo.png" alt="NexEagle Logo" className="mobile-logo-img" />
                            <span className="mobile-logo-text">
                                NexEagle <span className="mobile-logo-highlight">CMS</span>
                            </span>
                        </div>
                        <div className="mobile-profile-container" onClick={(e) => e.stopPropagation()}>
                            <button className="mobile-profile-avatar" onClick={() => setProfileOpen(!isProfileOpen)}>
                                <span>{initials}</span>
                            </button>
                            
                            {isProfileOpen && (
                                <div className="mobile-profile-dropdown">
                                    <div className="mobile-profile-dropdown-info">
                                        <div className="avatar-large">{initials}</div>
                                        <div className="info-text">
                                            <p className="user-name">{user?.name || 'User'}</p>
                                            <p className="user-email">{user?.email || 'email@example.com'}</p>
                                            <span className="user-role-badge">{user?.role || 'Admin'}</span>
                                        </div>
                                    </div>
                                    <div className="mobile-profile-dropdown-divider"></div>
                                    <button className="mobile-profile-logout-btn" onClick={() => { setProfileOpen(false); logout(); }}>
                                        <LogOut size={16} />
                                        <span>Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </header>
                )}

                {/* Offline status banners */}
                {!isOnline && (
                    <div className="network-status-banner offline">
                        <WifiOff size={16} />
                        <span>Offline Mode · {pendingCount > 0 ? `${pendingCount} updates pending sync` : 'Serving cached data'}</span>
                    </div>
                )}
                {isOnline && syncStatus === 'syncing' && (
                    <div className="network-status-banner syncing">
                        <RefreshCw size={16} className="spin" />
                        <span>Syncing local updates with cloud...</span>
                    </div>
                )}

                <main className="main-content">
                    <Outlet />
                </main>

                {/* PWA floating install prompt at bottom (above bottom nav) */}
                {isMobile && showInstallPrompt && (
                    <div className="pwa-install-banner">
                        <div className="pwa-install-info">
                            <div className="pwa-install-logo">
                                <Download size={16} />
                            </div>
                            <div className="pwa-install-text">
                                <h5>Add NexEagle CMS</h5>
                                <p>Install to your home screen for quick access</p>
                            </div>
                        </div>
                        <div className="pwa-install-actions">
                            <button className="pwa-install-btn" onClick={handleInstallClick}>
                                Add
                            </button>
                            <button className="pwa-close-btn" onClick={() => setShowInstallPrompt(false)} title="Dismiss">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Mobile Bottom Sheet Card Menu */}
                {isMobile && isMenuOpen && (
                    <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
                        <div className="mobile-menu-sheet" onClick={(e) => e.stopPropagation()}>
                            <div className="mobile-menu-header">
                                <div className="mobile-menu-drag-handle"></div>
                                <h4>CMS Features Menu</h4>
                            </div>
                            <div className="mobile-menu-grid">
                                {cardMenuItems.map((item) => (
                                    <Link 
                                        to={item.path} 
                                        key={item.path} 
                                        className={`mobile-menu-card ${location.pathname === item.path ? 'active' : ''}`}
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        <div className="mobile-menu-card-icon">
                                            {item.icon}
                                        </div>
                                        <span>{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Mobile Bottom Navigation (Android Native Style) */}
                {isMobile && (
                    <nav className="mobile-bottom-nav">
                        {/* 1. Home Link (Dashboard) */}
                        <Link 
                            to="/" 
                            className={`mobile-bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            <div className="mobile-bottom-nav-icon-wrapper">
                                <Home size={20} />
                            </div>
                            <span>Home</span>
                        </Link>

                        {/* 2. Onboarded Hospitals Link */}
                        <Link 
                            to="/onboarded-hospitals" 
                            className={`mobile-bottom-nav-item ${location.pathname === '/onboarded-hospitals' ? 'active' : ''}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            <div className="mobile-bottom-nav-icon-wrapper">
                                <Building2 size={20} />
                            </div>
                            <span>Hospitals</span>
                        </Link>

                        {/* 3. Menu Button (Centered) */}
                        <button 
                            className={`mobile-bottom-nav-item ${isMenuOpen ? 'active' : ''}`}
                            onClick={() => setMenuOpen(!isMenuOpen)}
                        >
                            <div className="mobile-bottom-nav-icon-wrapper">
                                <Grid size={20} />
                            </div>
                            <span>Menu</span>
                        </button>

                        {/* 4. Live Support Link */}
                        <Link 
                            to="/support" 
                            className={`mobile-bottom-nav-item ${location.pathname === '/support' ? 'active' : ''}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            <div className="mobile-bottom-nav-icon-wrapper">
                                <LifeBuoy size={20} />
                            </div>
                            <span>Support</span>
                        </Link>

                        {/* 5. Settings Link */}
                        <Link 
                            to="/settings" 
                            className={`mobile-bottom-nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            <div className="mobile-bottom-nav-icon-wrapper">
                                <Settings size={20} />
                            </div>
                            <span>Settings</span>
                        </Link>
                    </nav>
                )}
            </div>
        </div>
    );
};

export default Layout;
