import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import './Layout.css';

const Layout: React.FC = () => {
    // State for sidebar open/close
    // Default: open on desktop, closed on mobile
    const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

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

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleSidebar = () => {
        setSidebarOpen(!isSidebarOpen);
    };

    return (
        <div className="app-layout">
            <Sidebar isOpen={isSidebarOpen} toggle={toggleSidebar} isMobile={isMobile} />

            <div className="content-wrapper">
                {/* Mobile Header */}
                {isMobile && (
                    <header className="mobile-header">
                        <button onClick={toggleSidebar} className="menu-btn">
                            <Menu size={24} color="#1e3a8a" />
                        </button>
                        <span className="mobile-logo">CMS</span>
                    </header>
                )}

                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
