import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
  CartesianGrid, Legend
} from 'recharts';
import './PlayerStats.css';

const COLORS = {
  win: '#22c55e',
  loss: '#ef4444',
  overall: '#FF6600',
  '1v1_21': '#3b82f6',
  '1v1_11': '#8b5cf6',
  '2v2_21': '#f59e0b',
  '2v2_11': '#ec4899'
};

const CAT_LABELS = {
  '1v1_21': '1v1 (21)',
  '1v1_11': '1v1 (11)',
  '2v2_21': '2v2 (21)',
  '2v2_11': '2v2 (11)'
};

const PlayerStats = ({ playerId, onClose }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eloCategory, setEloCategory] = useState('overall');

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    fetch(`/api/players/stats/${playerId}`)
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [playerId]);

  if (loading) return <div className="stats-loading">Caricamento statistiche...</div>;
  if (!stats) return <div className="stats-loading">Errore nel caricamento.</div>;

  const { player, rank, totalPlayers, eloHistory, winLoss, streak, h2h, extremes } = stats;
  const totalGames = Object.values(winLoss).reduce((a, c) => a + c.w + c.l, 0);
  const totalWins = Object.values(winLoss).reduce((a, c) => a + c.w, 0);
  const totalLosses = Object.values(winLoss).reduce((a, c) => a + c.l, 0);
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  // ELO chart data
  const eloKey = eloCategory === 'overall' ? 'overall' : `score_${eloCategory}`;
  const eloRaw = eloHistory[eloKey] || [];
  const eloData = [
    { game: 0, elo: 1000, opp: 'Baseline', score: '—' },
    ...eloRaw.map((p, i) => ({
      game: i + 1,
      elo: p.elo,
      opp: p.opp,
      score: p.score
    }))
  ];

  // Win/Loss pie data
  const pieData = totalGames > 0
    ? [{ name: 'Vittorie', value: totalWins }, { name: 'Sconfitte', value: totalLosses }]
    : [{ name: 'Nessuna partita', value: 1 }];

  // Per-category bar data
  const categoryBarData = Object.entries(winLoss)
    .filter(([, v]) => v.w + v.l > 0)
    .map(([cat, v]) => ({
      category: CAT_LABELS[cat],
      Vittorie: v.w,
      Sconfitte: v.l,
      'Win %': v.w + v.l > 0 ? Math.round((v.w / (v.w + v.l)) * 100) : 0
    }));

  // Custom tooltip for ELO chart
  const EloTooltip = ({ active, payload }) => {
    if (active && payload?.[0]) {
      const p = payload[0].payload;
      return (
        <div className="stats-tooltip">
          <span className="stats-tooltip-elo">{payload[0].value}</span>
          <span className="stats-tooltip-score">{p.score}</span>
          <span className="stats-tooltip-opp">vs {p.opp}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="stats-page">
      <div className="stats-header">
        <div className="stats-header-left">
          <h1 className="stats-player-name">{player.name}</h1>
          <span className="stats-player-bu">{player.bu}</span>
        </div>
        <button className="stats-close-btn" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="stats-cards">
        <div className="stat-card highlight">
          <span className="stat-label">Rank</span>
          <span className="stat-value rank-value">#{rank}</span>
          <span className="stat-sub">su {totalPlayers}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">ELO Overall</span>
          <span className="stat-value elo-value">{Math.round(player.score_overall)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Partite</span>
          <span className="stat-value">{totalGames}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Win Rate</span>
          <span className="stat-value winrate-value">{winRate}%</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Streak</span>
          <span className={`stat-value streak-value ${streak.type === 'W' ? 'streak-win' : 'streak-loss'}`}>
            {streak.count > 0 ? `${streak.count}${streak.type}` : '—'}
          </span>
        </div>
      </div>

      {/* Extremes */}
      {totalGames > 0 && extremes && (() => {
        const predaList = h2h.filter(o => o.wins >= 2 && o.wins > o.losses);
        const incuboList = h2h.filter(o => o.losses >= 2 && o.losses > o.wins);
        return (
        <div className="stats-extremes">
          {extremes.bestGain && (
            <div className="extreme-card extreme-up">
              <span className="extreme-icon">{"\u{1F525}"}</span>
              <div className="extreme-info">
                <span className="extreme-title">Miglior Guadagno</span>
                <span className="extreme-detail">+{extremes.bestGain.delta} pts vs {extremes.bestGain.opp} ({extremes.bestGain.score})</span>
              </div>
            </div>
          )}
          {extremes.worstLoss && (
            <div className="extreme-card extreme-down">
              <span className="extreme-icon">{"\u{1F480}"}</span>
              <div className="extreme-info">
                <span className="extreme-title">Peggior Perdita</span>
                <span className="extreme-detail">{extremes.worstLoss.delta} pts vs {extremes.worstLoss.opp} ({extremes.worstLoss.score})</span>
              </div>
            </div>
          )}
          {extremes.bestWin && (
            <div className="extreme-card extreme-up">
              <span className="extreme-icon">{"\u2B50"}</span>
              <div className="extreme-info">
                <span className="extreme-title">Miglior Vittoria</span>
                <span className="extreme-detail">vs {extremes.bestWin.opp} ({extremes.bestWin.score}) {"\u2014"} ELO avv. {extremes.bestWin.oppElo}</span>
              </div>
            </div>
          )}
          {extremes.worstDefeat && (
            <div className="extreme-card extreme-down">
              <span className="extreme-icon">{"\u{1F62C}"}</span>
              <div className="extreme-info">
                <span className="extreme-title">Peggior Sconfitta</span>
                <span className="extreme-detail">vs {extremes.worstDefeat.opp} ({extremes.worstDefeat.score}) {"\u2014"} ELO avv. {extremes.worstDefeat.oppElo}</span>
              </div>
            </div>
          )}
          {predaList.length > 0 && (
            <div className="extreme-card extreme-up">
              <span className="extreme-icon">{"\u{1F43A}"}</span>
              <div className="extreme-info">
                <span className="extreme-title">Incubo di</span>
                <span className="extreme-detail has-tooltip" data-tooltip={predaList.map(o => o.name).join(', ')}>{predaList.length} giocator{predaList.length === 1 ? 'e' : 'i'}</span>
              </div>
            </div>
          )}
          {incuboList.length > 0 && (
            <div className="extreme-card extreme-down">
              <span className="extreme-icon">{"\u{1F407}"}</span>
              <div className="extreme-info">
                <span className="extreme-title">Preda di</span>
                <span className="extreme-detail has-tooltip" data-tooltip={incuboList.map(o => o.name).join(', ')}>{incuboList.length} giocator{incuboList.length === 1 ? 'e' : 'i'}</span>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* ELO Scores Grid */}
      <div className="stats-elo-grid">
        {Object.entries(CAT_LABELS).map(([key, label]) => {
          const games = player[`games_${key}`] || 0;
          return (
            <div className={`elo-mini-card${games === 0 ? ' unplayed' : ''}`} key={key}>
              <span className="elo-mini-label">{label}</span>
              <span className="elo-mini-value" style={games > 0 ? { color: COLORS[key] } : undefined}>
                {Math.round(player[`score_${key}`])}
              </span>
              <span className="elo-mini-games">{games} partite</span>
            </div>
          );
        })}
      </div>

      {/* ELO Progression Chart */}
      {totalGames > 0 && (
        <div className="stats-section">
          <div className="stats-section-header">
            <h2>Progressione ELO</h2>
            <div className="elo-chart-tabs">
              {['overall', ...Object.keys(CAT_LABELS)].map(cat => (
                <button
                  key={cat}
                  className={`elo-tab ${eloCategory === cat ? 'active' : ''}`}
                  style={eloCategory === cat ? { background: COLORS[cat] || COLORS.overall } : {}}
                  onClick={() => setEloCategory(cat)}
                >
                  {cat === 'overall' ? 'Overall' : CAT_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={eloData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="game" stroke="var(--text-dim)" fontSize={12} label={{ value: 'Partita', position: 'insideBottom', offset: -5, fill: 'var(--text-dim)' }} />
                <YAxis stroke="var(--text-dim)" fontSize={12} domain={['dataMin - 20', 'dataMax + 20']} />
                <Tooltip content={<EloTooltip />} />
                <Line
                  type="monotone"
                  dataKey="elo"
                  stroke={COLORS[eloCategory] || COLORS.overall}
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                  dot={{ r: 4, fill: COLORS[eloCategory] || COLORS.overall, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Win/Loss Charts Row */}
      {totalGames > 0 && (
        <div className="stats-charts-row">
          {/* Pie Chart */}
          <div className="stats-section stats-section-half">
            <h2>Vittorie / Sconfitte</h2>
            <div className="chart-container pie-container">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill={COLORS.win} />
                    <Cell fill={COLORS.loss} />
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v}`, name]} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '6px' }} itemStyle={{ color: 'var(--text-color)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-center-label">
                <span className="pie-center-value">{winRate}%</span>
                <span className="pie-center-text">win</span>
              </div>
              <div className="pie-legend">
                <span className="pie-legend-item"><span className="legend-dot" style={{ background: COLORS.win }} />{totalWins}V</span>
                <span className="pie-legend-item"><span className="legend-dot" style={{ background: COLORS.loss }} />{totalLosses}S</span>
              </div>
            </div>
          </div>

          {/* Per-category Bar Chart */}
          {categoryBarData.length > 0 && (
            <div className="stats-section stats-section-half">
              <h2>Per Categoria</h2>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categoryBarData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="category" stroke="var(--text-dim)" fontSize={11} />
                    <YAxis stroke="var(--text-dim)" fontSize={12} />
                    <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '6px' }} itemStyle={{ color: 'var(--text-color)' }} labelStyle={{ color: 'var(--text-color)' }} />
                    <Legend wrapperStyle={{ color: 'var(--text-color)' }} />
                    <Bar dataKey="Vittorie" fill={COLORS.win} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Sconfitte" fill={COLORS.loss} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Head to Head */}
      {h2h.length > 0 && (
        <div className="stats-section">
          <h2>Head to Head</h2>
          <div className="h2h-grid">
            {h2h.map((opp, i) => {
              const oppWinRate = Math.round((opp.wins / opp.total) * 100);
              const isPreda = opp.wins >= 2 && opp.wins > opp.losses;
              const isIncubo = opp.losses >= 2 && opp.losses > opp.wins;
              const cardClass = `h2h-card${isIncubo ? ' h2h-incubo' : ''}${isPreda ? ' h2h-preda' : ''}`;
              return (
                <div className={cardClass} key={i}>
                  <div className="h2h-name-row">
                    <span className="h2h-name">{opp.name}</span>
                    {isIncubo && <span className="h2h-tag">{"\u{1F43A}"} Incubo</span>}
                    {isPreda && <span className="h2h-tag">{'\u{1F407}'} Preda</span>}
                  </div>
                  <div className="h2h-bar-container">
                    <div className="h2h-bar h2h-bar-win" style={{ width: `${oppWinRate}%` }} />
                    <div className="h2h-bar h2h-bar-loss" style={{ width: `${100 - oppWinRate}%` }} />
                  </div>
                  <div className="h2h-stats">
                    <span className="h2h-w">{opp.wins}V</span>
                    <span className="h2h-total">{opp.total} partite</span>
                    <span className="h2h-l">{opp.losses}S</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalGames === 0 && (
        <div className="stats-empty">
          <p>Nessuna partita giocata ancora. Gioca una partita per vedere le tue statistiche!</p>
        </div>
      )}
    </div>
  );
};

export default PlayerStats;
