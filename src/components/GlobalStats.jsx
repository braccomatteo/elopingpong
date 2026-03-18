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

      <div className="gs-hero-row">
        <div className="gs-hero-card">
          <span className="gs-big-number">{stats.totalMatches}</span>
          <div className="gs-hero-detail">
            <span className="gs-hero-label">partite giocate</span>
            <span className="gs-hero-breakdown">{stats.totalSingles} singoli · {stats.totalDoubles} doppi</span>
          </div>
        </div>

        {stats.highestElo && (
          <div className="gs-hero-card gs-elo-card">
            <span className="gs-big-number">{stats.highestElo.elo}</span>
            <div className="gs-hero-detail">
              <span className="gs-hero-name">{stats.highestElo.name}</span>
              <span className="gs-hero-label">ELO più alto</span>
            </div>
          </div>
        )}

        <div className="gs-hero-card">
          <span className="gs-big-number">{stats.avgMargin}</span>
          <div className="gs-hero-detail">
            <span className="gs-hero-label">margine medio</span>
            <span className="gs-hero-breakdown">punti di scarto</span>
          </div>
        </div>
      </div>

      <div className="gs-highlights">
        {stats.mostActive && (
          <div className="gs-highlight">
            <div className="gs-highlight-content">
              <span className="gs-highlight-name">{stats.mostActive.name}</span>
              <span className="gs-highlight-desc">è il più attivo con <strong>{stats.mostActive.games}</strong> partite</span>
            </div>
          </div>
        )}

        {stats.longestStreak && stats.longestStreak.streak > 1 && (
          <div className="gs-highlight">
            <div className="gs-highlight-content">
              <span className="gs-highlight-name">{stats.longestStreak.name}</span>
              <span className="gs-highlight-desc">è in streak da <strong>{stats.longestStreak.streak}</strong> vittorie</span>
            </div>
          </div>
        )}

        {stats.biggestUpset && (
          <div className="gs-highlight">
            <div className="gs-highlight-content">
              <span className="gs-highlight-name">{stats.biggestUpset.underdog}</span>
              <span className="gs-highlight-desc">ha battuto <strong>{stats.biggestUpset.favorite}</strong> con Δ{stats.biggestUpset.eloDiff} di svantaggio</span>
            </div>
          </div>
        )}

        {stats.mostCommonMatchup && (
          <div className="gs-highlight">
            <div className="gs-highlight-content">
              <span className="gs-highlight-name">{stats.mostCommonMatchup.players}</span>
              <span className="gs-highlight-desc">la rivalità più accesa — <strong>{stats.mostCommonMatchup.times}</strong> scontri</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalStats;
