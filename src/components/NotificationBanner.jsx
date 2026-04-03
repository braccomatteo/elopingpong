import React from 'react';
import './NotificationBanner.css';

const NotificationBanner = ({ notifications, onDismiss }) => {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="notif-banner">
      <div className="notif-header">
        <span className="notif-title">🔔 Notifiche ({notifications.length})</span>
      </div>
      <div className="notif-list">
        {notifications.map(n => (
          <div key={n.id} className="notif-item">
            <span className="notif-message">{n.message}</span>
            <button className="notif-dismiss" onClick={() => onDismiss(n.id)} title="Chiudi">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationBanner;
