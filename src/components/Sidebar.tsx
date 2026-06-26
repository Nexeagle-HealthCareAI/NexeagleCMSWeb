import { useAuthStore } from '../store/useAuthStore';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ChevronLeft, ChevronRight, Settings, LogOut, Building2, Handshake, Activity, MessageSquare, CreditCard, Coins, Users } from 'lucide-react';
import { useSupportStore } from '../store/useSupportStore';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  toggle: () => void;
  isMobile: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggle, isMobile }) => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const permissions = useAuthStore((state) => state.permissions);
  const { unreadCount, resetUnread } = useSupportStore();

  const can = (key: string) => permissions.includes(key);

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
            <img src="/Logo.png" alt="NexEagle Logo" style={{ height: '32px', width: 'auto', marginRight: (!collapsed || isMobile) ? '12px' : '0' }} />
            {(!collapsed || isMobile) && <span className="logo-text">CMS</span>}
          </div>
          {!isMobile && (
            <button onClick={toggle} className="toggle-btn" aria-label="Toggle Sidebar">
              {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          )}
          {isMobile && (
            <button onClick={toggle} className="toggle-btn" aria-label="Close Sidebar">
              <ChevronLeft size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          <ul>
            {can('dashboard.view') && (
              <li>
                <NavLink
                  to="/"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed && !isMobile ? "Dashboard" : ""}
                  onClick={isMobile ? toggle : undefined}
                  end
                >
                  <LayoutDashboard size={22} />
                  {(!collapsed || isMobile) && <span>Dashboard</span>}
                </NavLink>
              </li>
            )}
            {can('onboarded-hospitals.view') && (
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
            )}
            <li>
              <NavLink
                to="/partners"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={collapsed && !isMobile ? "Partner Network" : ""}
                onClick={isMobile ? toggle : undefined}
              >
                <Handshake size={22} />
                {(!collapsed || isMobile) && <span>Partner Network</span>}
              </NavLink>
            </li>
            {can('subscriptions.view') && (
              <li>
                <NavLink
                  to="/subscriptions"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed && !isMobile ? "Verify Payments" : ""}
                  onClick={isMobile ? toggle : undefined}
                >
                  <CreditCard size={22} />
                  {(!collapsed || isMobile) && <span>Verify Payments</span>}
                </NavLink>
              </li>
            )}
            {can('subscriptions.view') && (
              <li>
                <NavLink
                  to="/manage-plans"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed && !isMobile ? "Manage Plans" : ""}
                  onClick={isMobile ? toggle : undefined}
                >
                  <Coins size={22} />
                  {(!collapsed || isMobile) && <span>Manage Plans</span>}
                </NavLink>
              </li>
            )}
            {can('application-health.view') && (
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
            )}
            {can('radai-cost.view') && (
              <li>
                <NavLink
                  to="/radai-cost"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed && !isMobile ? "RadAI Cost" : ""}
                  onClick={isMobile ? toggle : undefined}
                >
                  <Coins size={22} />
                  {(!collapsed || isMobile) && <span>RadAI Cost</span>}
                </NavLink>
              </li>
            )}
            {can('live-support.view') && (
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
            )}
            {can('user-management.view') && (
              <li>
                <NavLink
                  to="/users"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed && !isMobile ? "Users & Access" : ""}
                  onClick={isMobile ? toggle : undefined}
                >
                  <Users size={22} />
                  {(!collapsed || isMobile) && <span>Users &amp; Access</span>}
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        <div className="sidebar-footer">
          {can('settings.view') && (
            <NavLink
              to="/settings"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={collapsed && !isMobile ? "Settings" : ""}
            >
              <Settings size={22} />
              {(!collapsed || isMobile) && <span>Settings</span>}
            </NavLink>
          )}
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
