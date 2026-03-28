import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import ProfileModal from './ProfileModal';
import InfoModal from './InfoModal';
import ThemeToggle from './ThemeToggle';
import './Header.css';

const Header = ({ activeTab, onTabChange, onStatsClick }) => {
  const { user, logout } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'admin') { setPendingCount(0); return; }
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/players/pending', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPendingCount(data.length); })
      .catch(() => {});
  }, [user]);

  return (
    <>
      <nav className="header-nav">
        <div className="logo-container">
          <span className="logo-text">ELOPINGPONG</span>
        </div>

        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === 'overall' ? 'active' : ''}`}
            onClick={() => onTabChange('overall')}
          >
            Overall
          </button>
          <button
            className={`tab-btn ${activeTab === '1v1_21' ? 'active' : ''}`}
            onClick={() => onTabChange('1v1_21')}
          >
            1v1 (21)
          </button>
          <button
            className={`tab-btn ${activeTab === '1v1_11' ? 'active' : ''}`}
            onClick={() => onTabChange('1v1_11')}
          >
            1v1 (11)
          </button>
          <button
            className={`tab-btn ${activeTab === '2v2_21' ? 'active' : ''}`}
            onClick={() => onTabChange('2v2_21')}
          >
            2v2 (21)
          </button>
          <button
            className={`tab-btn ${activeTab === '2v2_11' ? 'active' : ''}`}
            onClick={() => onTabChange('2v2_11')}
          >
            2v2 (11)
          </button>

          {user && (
            <button
              className={`tab-btn ${activeTab === 'global-stats' ? 'active' : ''}`}
              onClick={() => onTabChange('global-stats')}
            >
              Stats
            </button>
          )}

          {user?.role === 'admin' && (
            <button
              className={`tab-btn admin-link ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => onTabChange('admin')}
            >
              Admin
              {pendingCount > 0 && <span className="admin-badge">{pendingCount}</span>}
            </button>
          )}
        </div>

        <div className="user-section">
          <ThemeToggle />
          <button className="info-btn" onClick={() => setIsInfoOpen(true)} title="Come funziona il ranking">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </button>
          {user ? (
            <div className="profile-badge">
              <span className="user-name clickable" onClick={() => onStatsClick(user.id)}>{user.name}</span>
              <button className="profile-menu-btn" onClick={() => setIsProfileOpen(true)}>Profilo</button>
              <button className="logout-btn" onClick={logout}>Logout</button>
            </div>
          ) : (
            <button className="profile-btn" onClick={() => setIsAuthOpen(true)}>
              Accedi
            </button>
          )}
        </div>
      </nav>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </>
  );
};

export default Header;
