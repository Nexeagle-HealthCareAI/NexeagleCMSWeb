import { useAuthStore } from '../store/useAuthStore';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ChevronLeft, ChevronRight, Settings, LogOut, Building2, Handshake, Activity, MessageSquare } from 'lucide-react';
import { useSupportStore } from '../store/useSupportStore';
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
  const logout = useAuthStore((state) => state.logout);
  const { unreadCount, resetUnread } = useSupportStore();

  const handleLogout = () => {
    logout();
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
                end // Use end to only match exact path for dashboard home
              >
                <LayoutDashboard size={22} />
                {(!collapsed || isMobile) && <span>Dashboard</span>}
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/onboarded-hospitals"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={collapsed && !isMobile ? "Onboarded Hospitals" : ""}
                onClick={isMobile ? toggle : undefined}
              >
                <Building2 size={22} />
                {(!collapsed || isMobile) && <span>Onboarded Hospitals</span>}
              </NavLink>
            </li>
            <li>
              <div className="nav-item disabled" title={collapsed && !isMobile ? "Partners (Coming Soon)" : ""}>
                <Handshake size={22} />
                {(!collapsed || isMobile) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span>Partners</span>
                    <span style={{ fontSize: '10px', background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>Upcoming</span>
                  </div>
                )}
              </div>
            </li>
            <li>
              <NavLink
                to="/application-health"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={collapsed && !isMobile ? "Application Health" : ""}
                onClick={isMobile ? toggle : undefined}
              >
                <Activity size={22} />
                {(!collapsed || isMobile) && <span>Application Health</span>}
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/support"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={collapsed && !isMobile ? "Live Support" : ""}
                onClick={() => {
                  resetUnread();
                  if (isMobile) toggle();
                }}
              >
                <div style={{ position: 'relative' }}>
                  <MessageSquare size={22} />
                  {unreadCount > 0 && (
                    <span className="unread-badge">{unreadCount}</span>
                  )}
                </div>
                {(!collapsed || isMobile) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span>Live Support</span>
                    <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px' }}>Live</span>
                  </div>
                )}
              </NavLink>
            </li>
            {/* Add more nav items here */}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={collapsed && !isMobile ? "Settings" : ""}
          >
            <Settings size={22} />
            {(!collapsed || isMobile) && <span>Settings</span>}
          </NavLink>
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
