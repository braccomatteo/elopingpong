import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
  CartesianGrid, ReferenceLine
} from 'recharts';
import CustomSelect from './CustomSelect';
import Pagination from './Pagination';
import './CustomSelect.css';
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

// Elo expected win probability (same formula as backend)
function computeExpected(e1, e2) {
  return 1 / (1 + Math.pow(10, (e2 - e1) / 400));
}

const PlayerStats = ({ playerId, players = [], onClose }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eloCategory, setEloCategory] = useState('overall');
  const [winLossCategory, setWinLossCategory] = useState('overall');
  const [openPopup, setOpenPopup] = useState(null);
  const [predictOpponent, setPredictOpponent] = useState(null);
  const [compareOppHistory, setCompareOppHistory] = useState(null);
  const [compareOppName, setCompareOppName] = useState('');
  const [h2hSort, setH2hSort] = useState('total');
  const [h2hSortDir, setH2hSortDir] = useState('desc');
  const [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState({ matches: [], total: 0 });

  useEffect(() => {
    if (!playerId) return;
    fetch(`/api/matches/history/player/${playerId}?page=${historyPage}&limit=10`)
      .then(r => r.json())
      .then(data => setHistory(data))
      .catch(() => {});
  }, [playerId, historyPage]);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    fetch(`/api/players/stats/${playerId}`)
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [playerId]);

  useEffect(() => {
    if (!predictOpponent) { setCompareOppHistory(null); setCompareOppName(''); return; }
    fetch(`/api/players/stats/${predictOpponent}`)
      .then(r => r.json())
      .then(data => {
        setCompareOppHistory(data.eloHistory?.overall || []);
        setCompareOppName(data.player?.name || '');
      })
      .catch(() => { setCompareOppHistory(null); });
  }, [predictOpponent]);

  if (loading) return <div className="stats-loading">Caricamento statistiche...</div>;
  if (!stats) return <div className="stats-loading">Errore nel caricamento.</div>;

  const { player, rank, totalPlayers, companyRank, companyTotal, buRank, buTotal, eloHistory, winLoss, streak, h2h, extremes } = stats;
  const totalGames = Object.values(winLoss).reduce((a, c) => a + c.w + c.l, 0);
  const totalWins = Object.values(winLoss).reduce((a, c) => a + c.w, 0);
  const totalLosses = Object.values(winLoss).reduce((a, c) => a + c.l, 0);
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  const isOwnProfile = user?.id === playerId;

  // Shared blended win probability — used by both "Avversari Consigliati" and "Predizione Vittoria"
  const CAT_WEIGHTS = { '1v1_21': 0.4, '1v1_11': 0.3, '2v2_21': 0.2, '2v2_11': 0.1 };
  const computeBlendedProb = (opp) => {
    const eloProb = Object.entries(CAT_WEIGHTS).reduce((sum, [cat, w]) =>
      sum + w * computeExpected(player[`score_${cat}`], opp[`score_${cat}`]), 0
    );
    const h2hRecord = h2h.find(o => o.name === opp.name);
    if (!h2hRecord) return { blendedProb: eloProb, eloProb, h2hRecord: null, h2hWeight: 0, h2hPct: null };
    const h2hWeight = Math.min(0.4, h2hRecord.total * 0.1);
    const h2hPct = h2hRecord.wins / h2hRecord.total;
    const blendedProb = (1 - h2hWeight) * eloProb + h2hWeight * h2hPct;
    return { blendedProb, eloProb, h2hRecord, h2hWeight, h2hPct };
  };

  // Comparison data for other players
  let comparison = null;
  if (!isOwnProfile && players.length > 0) {
    const activeSorted = [...players]
      .filter(p => (p.games_1v1_21 || 0) + (p.games_1v1_11 || 0) + (p.games_2v2_21 || 0) + (p.games_2v2_11 || 0) > 0)
      .sort((a, b) => b.score_overall - a.score_overall);
    const viewerPlayer = players.find(p => p.id === user?.id);
    const viewerRank = activeSorted.findIndex(p => p.id === user?.id) + 1;
    const targetRank = activeSorted.findIndex(p => p.id === playerId) + 1;
    if (viewerPlayer) {
      comparison = {
        rankGap: targetRank - viewerRank,
        eloGap: Math.round(player.score_overall - viewerPlayer.score_overall),
      };
    }
  }

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
  const pieWins = winLossCategory === 'overall'
    ? totalWins
    : (winLoss[winLossCategory]?.w || 0);
  const pieLosses = winLossCategory === 'overall'
    ? totalLosses
    : (winLoss[winLossCategory]?.l || 0);
  const pieTotal = pieWins + pieLosses;
  const pieWinRate = pieTotal > 0 ? Math.round((pieWins / pieTotal) * 100) : 0;
  const pieData = pieTotal > 0
    ? [{ name: 'Vittorie', value: pieWins }, { name: 'Sconfitte', value: pieLosses }]
    : [{ name: 'Nessuna partita', value: 1 }];

  // Per-category distribution data
  const categoryDistData = Object.entries(winLoss)
    .map(([cat, v]) => ({ name: CAT_LABELS[cat], value: v.w + v.l, color: COLORS[cat] }))
    .filter(d => d.value > 0);
  const categoryDistTotal = categoryDistData.reduce((a, c) => a + c.value, 0);

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
          <span className="stats-player-bu">{user?.company === 'DATA' ? (player.bu || player.company) : player.company}</span>
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
        {isOwnProfile ? (
          <div className="stat-card">
            <span className="stat-label">Partite</span>
            <span className="stat-value">{totalGames}</span>
          </div>
        ) : comparison && (
          <div className="stat-card comparison-card">
            <span className="stat-label">vs Te</span>
            <span className={`stat-value ${comparison.rankGap < 0 ? 'comparison-better' : comparison.rankGap > 0 ? 'comparison-worse' : ''}`}>
              {comparison.rankGap === 0 ? '=' : comparison.rankGap < 0 ? `▲${Math.abs(comparison.rankGap)}` : `▼${comparison.rankGap}`}
            </span>
            <span className={`stat-sub ${comparison.eloGap > 0 ? 'comparison-better' : comparison.eloGap < 0 ? 'comparison-worse' : ''}`}>
              {comparison.eloGap > 0 ? '+' : ''}{comparison.eloGap} ELO
            </span>
          </div>
        )}
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
        const predaList = h2h.filter(o => (o.wins - o.losses) >= 2 && o.wins / o.total >= 0.7);
        const incuboList = h2h.filter(o => (o.losses - o.wins) >= 2 && o.losses / o.total >= 0.7);
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
                <span
                  className="extreme-detail extreme-popup-trigger"
                  onClick={() => setOpenPopup(openPopup === 'preda' ? null : 'preda')}
                >
                  {predaList.length} giocator{predaList.length === 1 ? 'e' : 'i'}
                  {openPopup === 'preda' && (
                    <div className="extreme-popup">
                      {predaList.map(o => <span key={o.name} className="extreme-popup-name">{o.name}</span>)}
                    </div>
                  )}
                </span>
              </div>
            </div>
          )}
          {incuboList.length > 0 && (
            <div className="extreme-card extreme-down">
              <span className="extreme-icon">{"\u{1F407}"}</span>
              <div className="extreme-info">
                <span className="extreme-title">Preda di</span>
                <span
                  className="extreme-detail extreme-popup-trigger"
                  onClick={() => setOpenPopup(openPopup === 'incubo' ? null : 'incubo')}
                >
                  {incuboList.length} giocator{incuboList.length === 1 ? 'e' : 'i'}
                  {openPopup === 'incubo' && (
                    <div className="extreme-popup">
                      {incuboList.map(o => <span key={o.name} className="extreme-popup-name">{o.name}</span>)}
                    </div>
                  )}
                </span>
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
              {isOwnProfile && <span className="elo-mini-games">{games} partite</span>}
            </div>
          );
        })}
      </div>

      {/* Top 3 Recommended Opponents */}
      {isOwnProfile && totalGames > 0 && (() => {
        const myK = Math.max(32 - totalGames, 16);
        const candidates = players
          .filter(p =>
            p.id !== playerId &&
            ((p.games_1v1_21 || 0) + (p.games_1v1_11 || 0) + (p.games_2v2_21 || 0) + (p.games_2v2_11 || 0)) > 0
          )
          .map(opp => {
            const { blendedProb, eloProb } = computeBlendedProb(opp);
            const pointsIfWin = myK * (1 - eloProb);
            const expectedGain = blendedProb * pointsIfWin;
            return { opp, winProb: blendedProb, pointsIfWin, expectedGain };
          });

        if (candidates.length === 0) return null;

        const modes = [
          { key: 'facile',    label: 'Facile',    color: '#22c55e', sort: (a, b) => b.winProb - a.winProb },
          { key: 'normale',   label: 'Normale',   color: '#FF6600', sort: (a, b) => b.expectedGain - a.expectedGain },
          { key: 'difficile', label: 'Difficile', color: '#ef4444', sort: (a, b) => b.pointsIfWin - a.pointsIfWin },
        ];
        const usedPrimaryIds = new Set();
        const picks = modes.map(mode => {
          const sorted = [...candidates].sort(mode.sort);
          const pick = sorted.find(c => !usedPrimaryIds.has(c.opp.id));
          if (!pick) return null;
          usedPrimaryIds.add(pick.opp.id);
          return { ...pick, mode, sorted };
        }).filter(Boolean);

        // Now compute alternatives, excluding ALL primary picks
        const finalPicks = picks.map(({ sorted, ...pick }) => {
          const alternatives = sorted.filter(c => !usedPrimaryIds.has(c.opp.id)).slice(0, 2);
          return { ...pick, alternatives };
        });

        return (
          <div className="stats-section">
            <h2>Avversari Consigliati</h2>
            <div className="recommend-grid">
              {finalPicks.map(({ opp, winProb, pointsIfWin, mode, alternatives }) => {
                const pct = Math.round(winProb * 100);
                const pts = Math.round(pointsIfWin);
                const ringDeg = pct * 3.6;
                return (
                  <div className="recommend-card" key={opp.id} style={{ '--rc-color': mode.color }}>
                    <span className="recommend-mode-label">{mode.label}</span>
                    <div
                      className="recommend-ring"
                      style={{ background: `conic-gradient(${mode.color} ${ringDeg}deg, var(--border-color) 0deg)` }}
                    >
                      <div className="recommend-ring-inner">
                        <span className="recommend-pct">{pct}%</span>
                      </div>
                    </div>
                    <span className="recommend-name">{opp.name}</span>
                    <span className="recommend-pts">+{pts} pts</span>
                    {alternatives.length > 0 && (
                      <div className="recommend-alternatives">
                        {alternatives.map(a => (
                          <span key={a.opp.id} className="recommend-alt-name">{a.opp.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Win Prediction */}
      {isOwnProfile && totalGames > 0 && (() => {
        const opponents = players.filter(p =>
          p.id !== playerId &&
          ((p.games_1v1_21 || 0) + (p.games_1v1_11 || 0) + (p.games_2v2_21 || 0) + (p.games_2v2_11 || 0)) > 0
        ).sort((a, b) => a.name.localeCompare(b.name));

        if (opponents.length === 0) return null;

        const opp = predictOpponent ? opponents.find(o => o.id === predictOpponent) : null;

        // Compute per-category predictions
        const categories = ['1v1_21', '1v1_11', '2v2_21', '2v2_11'];
        let predictions = null;
        if (opp) {
          const catPreds = categories.map(cat => {
            const myElo = player[`score_${cat}`];
            const oppElo = opp[`score_${cat}`];
            const myGames = player[`games_${cat}`] || 0;
            const oppGames = opp[`games_${cat}`] || 0;
            const eloPct = computeExpected(myElo, oppElo);
            const played = myGames > 0 && oppGames > 0;
            return { cat, eloPct, played, label: CAT_LABELS[cat] };
          });

          const { blendedProb, h2hRecord, h2hWeight, h2hPct } = computeBlendedProb(opp);
          predictions = { overall: blendedProb, categories: catPreds, h2hPct, h2hRecord, h2hWeight };
        }

        return (
          <div className="stats-section predict-section">
            <h2>Predizione Vittoria</h2>
            <div className="predict-select-row">
              <CustomSelect
                value={predictOpponent || ''}
                onChange={v => setPredictOpponent(v || null)}
                placeholder="Scegli avversario..."
                options={opponents.map(o => ({ value: o.id, label: o.name }))}
              />
            </div>

            {predictions && (
              <div className="predict-result">
                {/* Main gauge */}
                <div className="predict-gauge-wrap">
                  <div className="predict-gauge">
                    <svg viewBox="0 0 120 70" className="predict-gauge-svg">
                      <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke="var(--border-color)" strokeWidth="8" strokeLinecap="round" />
                      <path d="M10 65 A50 50 0 0 1 110 65" fill="none"
                        stroke={predictions.overall >= 0.5 ? '#22c55e' : '#ef4444'}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${predictions.overall * 157} 157`}
                      />
                    </svg>
                    <div className="predict-gauge-label">
                      <span className="predict-gauge-pct" style={{ color: predictions.overall >= 0.5 ? '#22c55e' : '#ef4444' }}>
                        {Math.round(predictions.overall * 100)}%
                      </span>
                      <span className="predict-gauge-text">prob. vittoria</span>
                    </div>
                  </div>
                  <div className="predict-vs-names">
                    <span className="predict-vs-you">{player.name}</span>
                    <span className="predict-vs-sep">vs</span>
                    <span className="predict-vs-opp">{opp.name}</span>
                  </div>
                </div>

                {/* Per-category bars */}
                <div className="predict-cats">
                  {predictions.categories.map(({ cat, eloPct, played, label }) => (
                    <div className={`predict-cat-row${!played ? ' predict-cat-unplayed' : ''}`} key={cat}>
                      <span className="predict-cat-label">{label}</span>
                      <div className="predict-cat-bar-bg">
                        <div className="predict-cat-bar" style={{
                          width: `${Math.round(eloPct * 100)}%`,
                          background: COLORS[cat]
                        }} />
                      </div>
                      <span className="predict-cat-pct">{Math.round(eloPct * 100)}%</span>
                    </div>
                  ))}
                </div>

                {/* H2H bonus info */}
                {predictions.h2hRecord && (
                  <div className="predict-h2h-note">
                    <span className="predict-h2h-icon">{"\u{1F93C}"}</span>
                    H2H: {predictions.h2hRecord.wins}V - {predictions.h2hRecord.losses}S (win rate {Math.round(predictions.h2hPct * 100)}%)
                  </div>
                )}

                {/* ELO comparison chart */}
                {compareOppHistory && compareOppHistory.length > 0 && (() => {
                  const myRaw = [{ pct: 0, elo: 1000 }, ...(eloHistory.overall || []).map((p, i) => ({ pct: Math.round(((i + 1) / (eloHistory.overall.length)) * 100), elo: p.elo }))];
                  const oppRaw = [{ pct: 0, elo: 1000 }, ...compareOppHistory.map((p, i) => ({ pct: Math.round(((i + 1) / compareOppHistory.length) * 100), elo: p.elo }))];
                  // Merge into a single dataset by pct index 0-100
                  const merged = Array.from({ length: 101 }, (_, pct) => {
                    const me = [...myRaw].reverse().find(p => p.pct <= pct);
                    const op = [...oppRaw].reverse().find(p => p.pct <= pct);
                    return { pct, me: me?.elo, opp: op?.elo };
                  }).filter((_, i) => i % 2 === 0); // ogni 2% per alleggerire

                  const CompareTooltip = ({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="stats-tooltip">
                        {payload.map(p => (
                          <span key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}</span>
                        ))}
                      </div>
                    );
                  };

                  return (
                    <div className="predict-compare-chart">
                      <div className="predict-compare-legend">
                        <span style={{ color: COLORS.overall }}>— {player.name}</span>
                        <span style={{ color: '#8b5cf6' }}>— {compareOppName}</span>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={merged}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                          <XAxis dataKey="pct" hide />
                          <YAxis stroke="var(--text-dim)" fontSize={11} domain={['dataMin - 20', 'dataMax + 20']} width={40} />
                          <Tooltip content={<CompareTooltip />} />
                          <Line type="monotone" dataKey="me" name={player.name} stroke={COLORS.overall} strokeWidth={2} dot={false} connectNulls />
                          <Line type="monotone" dataKey="opp" name={compareOppName} stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })()}

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
              {isOwnProfile ? (
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
              ) : (
              <AreaChart data={eloData}>
                <defs>
                  <linearGradient id="eloGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS[eloCategory] || COLORS.overall} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={COLORS[eloCategory] || COLORS.overall} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="game" hide />
                <YAxis stroke="var(--text-dim)" fontSize={12} domain={['dataMin - 20', 'dataMax + 20']} />
                <ReferenceLine y={1000} stroke="var(--text-dim)" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Area
                  type="monotone"
                  dataKey="elo"
                  stroke={COLORS[eloCategory] || COLORS.overall}
                  strokeWidth={3}
                  fill="url(#eloGradient)"
                  dot={false}
                  activeDot={false}
                />
              </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Win/Loss Charts Row */}
      {totalGames > 0 && (
        <div className="stats-charts-row">
          {/* Pie Chart */}
          <div className="stats-section stats-section-half">
            <div className="stats-section-header">
              <h2>Vittorie / Sconfitte</h2>
              <div className="pie-cat-select">
                <CustomSelect
                  value={winLossCategory}
                  onChange={setWinLossCategory}
                  placeholder="Overall"
                  options={[
                    { value: 'overall', label: 'Overall' },
                    ...Object.entries(CAT_LABELS).map(([k, v]) => ({ value: k, label: v }))
                  ]}
                />
              </div>
            </div>
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
                    activeShape={(props) => <Sector {...props} outerRadius={85} strokeWidth={0} />}
                  >
                    <Cell fill={COLORS.win} />
                    <Cell fill={COLORS.loss} />
                  </Pie>
                  <Tooltip formatter={(v, name) => [isOwnProfile ? `${v}` : `${Math.round((v / pieTotal) * 100)}%`, name]} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '6px' }} itemStyle={{ color: 'var(--text-color)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-center-label">
                <span className="pie-center-value">{pieWinRate}%</span>
                <span className="pie-center-text">win</span>
              </div>
              <div className="pie-legend">
                <span className="pie-legend-item"><span className="legend-dot" style={{ background: COLORS.win }} />{isOwnProfile ? `${pieWins}V` : `${pieWinRate}%`}</span>
                <span className="pie-legend-item"><span className="legend-dot" style={{ background: COLORS.loss }} />{isOwnProfile ? `${pieLosses}S` : `${100 - pieWinRate}%`}</span>
              </div>
            </div>
          </div>

          {/* Per-category Donut Chart */}
          {categoryDistData.length > 0 && (
            <div className="stats-section stats-section-half">
              <h2>Per Categoria</h2>
              <div className="chart-container category-pie-row">
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie
                      data={categoryDistData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                      activeShape={(props) => <Sector {...props} outerRadius={85} strokeWidth={0} />}
                    >
                      {categoryDistData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${Math.round((v / categoryDistTotal) * 100)}%`, name]} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '6px' }} itemStyle={{ color: 'var(--text-color)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="category-pie-legend">
                  {categoryDistData.map((entry, idx) => (
                    <div className="category-pie-legend-item" key={idx}>
                      <span className="legend-dot" style={{ background: entry.color }} />
                      <span>{entry.name}</span>
                      <span className="category-pie-pct">{Math.round((entry.value / categoryDistTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Head to Head */}
      {h2h.length > 0 && (
        <div className="stats-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ margin: 0 }}>Head to Head</h2>
            <div className="elo-chart-tabs">
              {[['total', 'Più giocate'], ['winrate', 'Win%'], ['recent', 'Recenti']].map(([key, label]) => (
              <button
                key={key}
                className={`elo-tab${h2hSort === key ? ' active' : ''}`}
                style={h2hSort === key ? { background: '#FF6600', display: 'inline-flex', alignItems: 'center', gap: '2px' } : { display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                onClick={() => {
                  if (h2hSort === key) setH2hSortDir(d => d === 'desc' ? 'asc' : 'desc');
                  else { setH2hSort(key); setH2hSortDir('desc'); }
                }}
              >
                {label}{h2hSort === key ? <span style={{ lineHeight: 1, marginTop: '-1px' }}>{h2hSortDir === 'desc' ? '↓' : '↑'}</span> : ''}
              </button>
            ))}
            </div>
          </div>
          <div className="h2h-grid">
            {[...h2h].sort((a, b) => {
              let diff;
              if (h2hSort === 'winrate') diff = (b.wins / b.total) - (a.wins / a.total);
              else if (h2hSort === 'recent') diff = new Date(b.lastPlayed || 0) - new Date(a.lastPlayed || 0);
              else diff = b.total - a.total;
              return h2hSortDir === 'asc' ? -diff : diff;
            }).map((opp, i) => {
              const oppWinRate = Math.round((opp.wins / opp.total) * 100);
              const isPreda = (opp.wins - opp.losses) >= 2 && opp.wins / opp.total >= 0.7;
              const isIncubo = (opp.losses - opp.wins) >= 2 && opp.losses / opp.total >= 0.7;
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
                  {isOwnProfile && (
                    <div className="h2h-stats">
                      <span className="h2h-w">{opp.wins}V</span>
                      <span className="h2h-total">{opp.total} partite</span>
                      <span className="h2h-l">{opp.losses}S</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isOwnProfile && history.total > 0 && (
        <div className="stats-section storico-section">
          <h2>Storico Partite</h2>
          <table className="storico-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Sfida</th>
                <th>Risultato</th>
              </tr>
            </thead>
            <tbody>
              {history.matches.map(m => {
                const isDouble = m.match_type === 'doubles';
                const leftSide = isDouble ? `${m.p1_name} & ${m.p2_name}` : m.p1_name;
                const rightSide = isDouble ? `${m.op1_name} & ${m.op2_name}` : m.op1_name;
                return (
                  <tr key={`${m.match_type}-${m.id}`}>
                    <td>{new Date(m.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{isDouble ? '2v2' : '1v1'} {m.points_type}pt</td>
                    <td>{leftSide} <span style={{ color: 'var(--accent-orange)' }}>vs</span> {rightSide}</td>
                    <td className="score">{m.t1_score} - {m.t2_score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            page={historyPage}
            totalPages={Math.ceil(history.total / 10)}
            onPageChange={setHistoryPage}
          />
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
