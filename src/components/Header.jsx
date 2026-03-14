import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import ProfileModal from './ProfileModal';
import ThemeToggle from './ThemeToggle';
import './Header.css';

const Header = ({ activeTab, onTabChange }) => {
  const { user, logout } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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

          {user?.role === 'admin' && (
            <button
              className={`tab-btn admin-link ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => onTabChange('admin')}
            >
              Admin
            </button>
          )}
        </div>

        <div className="user-section">
          <ThemeToggle />
          {user ? (
            <div className="profile-badge">
              <span className="user-name">{user.name}</span>
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
    </>
  );
};

export default Header;
