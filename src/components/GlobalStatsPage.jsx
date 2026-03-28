import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  CartesianGrid
} from 'recharts';
import './GlobalStatsPage.css';

const COLORS = {
  '1v1_21': '#3b82f6',
  '1v1_11': '#8b5cf6',
  '2v2_21': '#f59e0b',
  '2v2_11': '#ec4899',
  accent: '#FF6600',
};

const CAT_LABELS = {
  '1v1_21': '1v1 (21)',
  '1v1_11': '1v1 (11)',
  '2v2_21': '2v2 (21)',
  '2v2_11': '2v2 (11)',
};

const GlobalStatsPage = () => {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/matches/global-stats').then(r => r.json()),
      fetch('/api/matches/global-charts').then(r => r.json()),
    ])
      .then(([statsData, chartsData]) => {
        setStats(statsData);
        setCharts(chartsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="gsp-loading">Caricamento statistiche...</div>;
  if (!stats || !charts) return <div className="gsp-loading">Errore nel caricamento.</div>;

  // Category pie data
  const catPieData = Object.entries(charts.categoryDistribution)
    .map(([key, value]) => ({ name: CAT_LABELS[key], value, color: COLORS[key] }))
    .filter(d => d.value > 0);
  const catTotal = catPieData.reduce((a, c) => a + c.value, 0);

  // Compute percentages that sum to exactly 100 (largest remainder method)
  const catPcts = (() => {
    if (catTotal === 0) return catPieData.map(() => 0);
    const raw = catPieData.map(d => (d.value / catTotal) * 100);
    const floored = raw.map(Math.floor);
    let remainder = 100 - floored.reduce((a, b) => a + b, 0);
    const remainders = raw.map((v, i) => ({ i, r: v - floored[i] }));
    remainders.sort((a, b) => b.r - a.r);
    for (let j = 0; j < remainder; j++) floored[remainders[j].i]++;
    return floored;
  })();

  // ELO distribution
  const eloData = charts.eloDistribution.map(d => ({
    range: `${d.bucket}`,
    count: d.count,
  }));

  const tooltipStyle = {
    contentStyle: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '6px' },
    itemStyle: { color: 'var(--text-color)' },
    labelStyle: { color: 'var(--text-color)' },
  };

  return (
    <div className="gsp-page">
      <h1 className="gsp-title">Statistiche Globali</h1>

      {/* Summary cards */}
      <div className="gsp-cards">
        <div className="gsp-card">
          <span className="gsp-card-label">Partite Totali</span>
          <span className="gsp-card-value">{stats.totalMatches}</span>
          <span className="gsp-card-sub">{stats.totalSingles} singoli · {stats.totalDoubles} doppi</span>
        </div>
        <div className="gsp-card">
          <span className="gsp-card-label">Margine Medio</span>
          <span className="gsp-card-value">{stats.avgMargin}</span>
          <span className="gsp-card-sub">punti di scarto</span>
        </div>
        <div className="gsp-card">
          <span className="gsp-card-label">Partite Ravvicinate</span>
          <span className="gsp-card-value">{stats.closeMatches}%</span>
          <span className="gsp-card-sub">decise da ≤2 punti</span>
        </div>
        {stats.longestStreak && (
          <div className="gsp-card">
            <span className="gsp-card-label">Streak Attiva</span>
            <span className="gsp-card-value">{stats.longestStreak.streak}W</span>
            <span className="gsp-card-sub">{stats.longestStreak.name}</span>
          </div>
        )}
        {stats.mostImproved && (
          <div className="gsp-card">
            <span className="gsp-card-label">Più Migliorato</span>
            <span className="gsp-card-value">+{stats.mostImproved.gain}</span>
            <span className="gsp-card-sub">{stats.mostImproved.name}</span>
          </div>
        )}
        {stats.biggestUpset && (
          <div className="gsp-card">
            <span className="gsp-card-label">Upset più Grande</span>
            <span className="gsp-card-value">{stats.biggestUpset.eloDiff} pts</span>
            <span className="gsp-card-sub">{stats.biggestUpset.underdog} vs {stats.biggestUpset.favorite}</span>
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="gsp-charts-row">
        <div className="gsp-section">
          <h2>Per Categoria</h2>
          <div className="gsp-chart-container gsp-cat-row">
            <ResponsiveContainer width="55%" height={250}>
              <PieChart>
                <Pie
                  data={catPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {catPieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name, _p, idx) => [`${v} (${catPcts[idx]}%)`, name]}
                  {...tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="gsp-cat-legend">
              {catPieData.map((entry, idx) => (
                <div className="gsp-cat-legend-item" key={idx}>
                  <span className="legend-dot" style={{ background: entry.color }} />
                  <span>{entry.name}</span>
                  <span className="gsp-cat-pct">{catPcts[idx]}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="gsp-section">
          <h2>Distribuzione ELO</h2>
          <div className="gsp-chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={eloData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="range" stroke="var(--text-dim)" fontSize={11} />
                <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill={COLORS.accent} radius={[3, 3, 0, 0]} name="Giocatori" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalStatsPage;
