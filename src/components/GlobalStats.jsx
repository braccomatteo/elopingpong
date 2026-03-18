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
      <div className="global-stats-grid">
        <div className="global-stat-card">
          <span className="global-stat-value">{stats.totalMatches}</span>
          <span className="global-stat-label">Partite Totali</span>
          <span className="global-stat-sub">{stats.totalSingles} singoli · {stats.totalDoubles} doppi</span>
        </div>

        {stats.mostActive && (
          <div className="global-stat-card">
            <span className="global-stat-value">{stats.mostActive.name}</span>
            <span className="global-stat-label">Più Attivo</span>
            <span className="global-stat-sub">{stats.mostActive.games} partite</span>
          </div>
        )}

        {stats.highestElo && (
          <div className="global-stat-card">
            <span className="global-stat-value">{stats.highestElo.name}</span>
            <span className="global-stat-label">ELO Più Alto</span>
            <span className="global-stat-sub">{stats.highestElo.elo} punti</span>
          </div>
        )}

        {stats.longestStreak && stats.longestStreak.streak > 1 && (
          <div className="global-stat-card">
            <span className="global-stat-value">{stats.longestStreak.name}</span>
            <span className="global-stat-label">Streak Attiva 🔥</span>
            <span className="global-stat-sub">{stats.longestStreak.streak} vittorie consecutive</span>
          </div>
        )}

        {stats.biggestUpset && (
          <div className="global-stat-card">
            <span className="global-stat-value">{stats.biggestUpset.underdog}</span>
            <span className="global-stat-label">Upset più Grande</span>
            <span className="global-stat-sub">ha battuto {stats.biggestUpset.favorite} (Δ{stats.biggestUpset.eloDiff})</span>
          </div>
        )}

        <div className="global-stat-card">
          <span className="global-stat-value">{stats.avgMargin}</span>
          <span className="global-stat-label">Margine Medio</span>
          <span className="global-stat-sub">punti di scarto</span>
        </div>

        {stats.mostCommonMatchup && (
          <div className="global-stat-card">
            <span className="global-stat-value matchup">{stats.mostCommonMatchup.players}</span>
            <span className="global-stat-label">Sfida più Frequente</span>
            <span className="global-stat-sub">{stats.mostCommonMatchup.times} volte</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalStats;
