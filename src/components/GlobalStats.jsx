import React, { useState, useEffect } from 'react';
import './GlobalStats.css';

const GlobalStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/matches/global-stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) return null;

  return (
    <div className="global-stats">
      <h2>Statistiche Globali</h2>

      <div className="gs-cards">
        <div className="gs-card">
          <span className="gs-card-label">Partite</span>
          <span className="gs-card-value">{stats.totalMatches}</span>
          <span className="gs-card-sub">{stats.totalSingles} singoli · {stats.totalDoubles} doppi</span>
        </div>

        <div className="gs-card">
          <span className="gs-card-label">Margine medio</span>
          <span className="gs-card-value">{stats.avgMargin}</span>
          <span className="gs-card-sub">punti di scarto</span>
        </div>

        <div className="gs-card">
          <span className="gs-card-label">Partite ravvicinate</span>
          <span className="gs-card-value">{stats.closeMatches}%</span>
          <span className="gs-card-sub">decise da ≤2 punti</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalStats;
