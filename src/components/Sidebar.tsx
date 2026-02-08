import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ChevronLeft, ChevronRight, Settings, LogOut } from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  toggle: () => void;
  isMobile: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggle, isMobile }) => {
  // On mobile, if open, we show full width. If closed, we hide (width 0 or transform).
  // On desktop, if open, full width. If closed, mini width.
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  const collapsed = !isOpen;

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isMobile && isOpen && (
        <div
          className="sidebar-overlay"
          onClick={toggle}
        />
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : 'expanded'} ${isMobile ? 'mobile' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            {(!collapsed || isMobile) && <span className="logo-text">CMS</span>}
          </div>
          {/* On desktop, show toggle arrow. On mobile, we might hide this or change behavior */}
          {!isMobile && (
            <button onClick={toggle} className="toggle-btn" aria-label="Toggle Sidebar">
              {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          )}
          {/* On mobile close button */}
          {isMobile && (
            <button onClick={toggle} className="toggle-btn" aria-label="Close Sidebar">
              <ChevronLeft size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          <ul>
            <li>
              <NavLink
                to="/"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={collapsed && !isMobile ? "Dashboard" : ""}
                onClick={isMobile ? toggle : undefined} // Close sidebar on nav click in mobile
              >
                <LayoutDashboard size={22} />
                {(!collapsed || isMobile) && <span>Dashboard</span>}
              </NavLink>
            </li>
            {/* Add more nav items here */}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item">
            <Settings size={22} />
            {(!collapsed || isMobile) && <span>Settings</span>}
          </button>
          <button className="nav-item logout" onClick={handleLogout}>
            <LogOut size={22} />
            {(!collapsed || isMobile) && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
