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

      <div className="gs-top">
        <div className="gs-total">
          <span className="gs-number">{stats.totalMatches}</span>
          <span className="gs-label">partite</span>
          <span className="gs-detail">{stats.totalSingles} singoli / {stats.totalDoubles} doppi</span>
        </div>

        {stats.highestElo && (
          <div className="gs-featured">
            <span className="gs-featured-label">ELO più alto</span>
            <span className="gs-featured-name">{stats.highestElo.name}</span>
            <span className="gs-featured-value">{stats.highestElo.elo}</span>
          </div>
        )}

        <div className="gs-featured">
          <span className="gs-featured-label">Margine medio</span>
          <span className="gs-featured-value">{stats.avgMargin}</span>
          <span className="gs-detail">punti di scarto</span>
        </div>
      </div>

      <div className="gs-bottom">
        {stats.longestStreak && stats.longestStreak.streak > 1 && (
          <div className="gs-pill">
            <span className="gs-pill-name">{stats.longestStreak.name}</span>
            <span className="gs-pill-text">è in streak da</span>
            <span className="gs-pill-accent">{stats.longestStreak.streak}W</span>
          </div>
        )}

        {stats.biggestUpset && (
          <div className="gs-pill">
            <span className="gs-pill-name">{stats.biggestUpset.underdog}</span>
            <span className="gs-pill-text">ha battuto</span>
            <span className="gs-pill-name">{stats.biggestUpset.favorite}</span>
            <span className="gs-pill-dim">Δ{stats.biggestUpset.eloDiff}</span>
          </div>
        )}

        {stats.bestWinRate && (
          <div className="gs-pill">
            <span className="gs-pill-name">{stats.bestWinRate.name}</span>
            <span className="gs-pill-text">miglior win rate</span>
            <span className="gs-pill-accent">{stats.bestWinRate.winrate}%</span>
          </div>
        )}

        {stats.mostImproved && (
          <div className="gs-pill">
            <span className="gs-pill-name">{stats.mostImproved.name}</span>
            <span className="gs-pill-text">più migliorato</span>
            <span className="gs-pill-accent">+{stats.mostImproved.gain}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalStats;
