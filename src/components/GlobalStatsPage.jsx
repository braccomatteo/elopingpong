import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  CartesianGrid
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import './GlobalStatsPage.css';

const COLORS = {
  '1v1_21': '#3b82f6',
  '1v1_11': '#8b5cf6',
  '2v2_21': '#f59e0b',
  '2v2_11': '#ec4899',
  accent: '#FF6600',
};

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#22c55e', '#ef4444', '#06b6d4', '#f97316'];

const CAT_LABELS = {
  '1v1_21': '1v1 (21)',
  '1v1_11': '1v1 (11)',
  '2v2_21': '2v2 (21)',
  '2v2_11': '2v2 (11)',
};

const GlobalStatsPage = () => {
  const { user } = useAuth();
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

  // Company pie (top 5)
  const companyData = (charts.top5Company || []).filter(d => d.count > 0);
  const companyTotal = companyData.reduce((a, c) => a + c.count, 0);
  const companyPcts = (() => {
    if (companyTotal === 0) return companyData.map(() => 0);
    const raw = companyData.map(d => (d.count / companyTotal) * 100);
    const floored = raw.map(Math.floor);
    let rem = 100 - floored.reduce((a, b) => a + b, 0);
    const rems = raw.map((v, i) => ({ i, r: v - floored[i] }));
    rems.sort((a, b) => b.r - a.r);
    for (let j = 0; j < rem; j++) floored[rems[j].i]++;
    return floored;
  })();

  // BU pie (Data only)
  const isDataCompany = user?.company?.toUpperCase() === 'DATA';
  const buData = isDataCompany ? (charts.buDistribution || []).filter(d => d.count > 0) : [];
  const buTotal = buData.reduce((a, c) => a + c.count, 0);
  const buPcts = (() => {
    if (buTotal === 0) return buData.map(() => 0);
    const raw = buData.map(d => (d.count / buTotal) * 100);
    const floored = raw.map(Math.floor);
    let rem = 100 - floored.reduce((a, b) => a + b, 0);
    const rems = raw.map((v, i) => ({ i, r: v - floored[i] }));
    rems.sort((a, b) => b.r - a.r);
    for (let j = 0; j < rem; j++) floored[rems[j].i]++;
    return floored;
  })();

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
        {stats.weeklyTop && (
          <div className="gsp-card">
            <span className="gsp-card-label">Top della Settimana</span>
            <span className="gsp-card-value" style={{ color: '#22c55e' }}>▲{stats.weeklyTop.gain}</span>
            <span className="gsp-card-sub">{stats.weeklyTop.name}</span>
          </div>
        )}
        {stats.biggestUpset && (
          <div className="gsp-card">
            <span className="gsp-card-label">Upset più Grande</span>
            <span className="gsp-card-value" style={{ color: '#22c55e', fontSize: '1.1rem' }}>{stats.biggestUpset.underdog}</span>
            <span className="gsp-card-sub">ha battuto <strong style={{ color: '#ef4444' }}>{stats.biggestUpset.favorite}</strong> con {stats.biggestUpset.eloDiff} ELO di svantaggio</span>
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

      {/* Charts row: Company + BU */}
      <div className="gsp-charts-row">
        {companyData.length > 0 && (
          <div className="gsp-section">
            <h2>Top 5 per Azienda</h2>
            <div className="gsp-chart-container gsp-cat-row">
              <ResponsiveContainer width="55%" height={250}>
                <PieChart>
                  <Pie
                    data={companyData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={90}
                    paddingAngle={3} dataKey="count" nameKey="company" strokeWidth={0}
                  >
                    {companyData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, name, _p, idx) => [`${v} (${companyPcts[idx]}%)`, name]}
                    {...tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="gsp-cat-legend">
                {companyData.map((entry, idx) => (
                  <div className="gsp-cat-legend-item" key={idx}>
                    <span className="legend-dot" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <span>{entry.company}</span>
                    <span className="gsp-cat-pct">{companyPcts[idx]}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isDataCompany && buData.length > 0 && (
          <div className="gsp-section">
            <h2>Divisione per BU</h2>
            <div className="gsp-chart-container gsp-cat-row">
              <ResponsiveContainer width="55%" height={250}>
                <PieChart>
                  <Pie
                    data={buData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={90}
                    paddingAngle={3} dataKey="count" nameKey="bu" strokeWidth={0}
                  >
                    {buData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, name, _p, idx) => [`${v} (${buPcts[idx]}%)`, name]}
                    {...tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="gsp-cat-legend">
                {buData.map((entry, idx) => (
                  <div className="gsp-cat-legend-item" key={idx}>
                    <span className="legend-dot" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <span>{entry.bu}</span>
                    <span className="gsp-cat-pct">{buPcts[idx]}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalStatsPage;
