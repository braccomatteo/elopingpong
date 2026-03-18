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
      <div className="gs-section">
        <h2>Statistiche Globali</h2>

        <div className="gs-cards">
          <div className="gs-card gs-card-highlight">
            <span className="gs-card-label">Partite</span>
            <span className="gs-card-value gs-val-orange">{stats.totalMatches}</span>
            <span className="gs-card-sub">{stats.totalSingles} singoli · {stats.totalDoubles} doppi</span>
          </div>

          {stats.highestElo && (
            <div className="gs-card">
              <span className="gs-card-label">ELO più alto</span>
              <span className="gs-card-value gs-val-orange">{stats.highestElo.elo}</span>
              <span className="gs-card-sub">{stats.highestElo.name}</span>
            </div>
          )}

          <div className="gs-card">
            <span className="gs-card-label">Margine medio</span>
            <span className="gs-card-value">{stats.avgMargin}</span>
            <span className="gs-card-sub">punti di scarto</span>
          </div>

          {stats.bestWinRate && (
            <div className="gs-card">
              <span className="gs-card-label">Miglior Win Rate</span>
              <span className="gs-card-value gs-val-green">{stats.bestWinRate.winrate}%</span>
              <span className="gs-card-sub">{stats.bestWinRate.name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="gs-extremes">
        {stats.longestStreak && stats.longestStreak.streak > 1 && (
          <div className="gs-extreme gs-extreme-up">
            <div className="gs-extreme-info">
              <span className="gs-extreme-title">Streak attiva</span>
              <span className="gs-extreme-detail"><strong>{stats.longestStreak.name}</strong> — {stats.longestStreak.streak} vittorie consecutive</span>
            </div>
          </div>
        )}

        {stats.biggestUpset && (
          <div className="gs-extreme gs-extreme-up">
            <div className="gs-extreme-info">
              <span className="gs-extreme-title">Upset più grande</span>
              <span className="gs-extreme-detail"><strong>{stats.biggestUpset.underdog}</strong> ha battuto <strong>{stats.biggestUpset.favorite}</strong> con Δ{stats.biggestUpset.eloDiff} di svantaggio</span>
            </div>
          </div>
        )}

        {stats.mostImproved && (
          <div className="gs-extreme gs-extreme-up">
            <div className="gs-extreme-info">
              <span className="gs-extreme-title">Più migliorato</span>
              <span className="gs-extreme-detail"><strong>{stats.mostImproved.name}</strong> — +{stats.mostImproved.gain} ELO dal primo match</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalStats;
