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
  const [eloCategory, setEloCategory] = useState('overall');
  const [companyEloCategory, setCompanyEloCategory] = useState('overall');
  const [buEloCategory, setBuEloCategory] = useState('overall');

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
  const eloRaw = eloCategory === 'overall'
    ? charts.eloDistribution
    : (charts.eloDistributionByCategory?.[eloCategory] || []);
  const eloFiltered = eloRaw.map(d => ({
    range: `${d.bucket}–${d.bucket + 24}`,
    count: d.count,
  }));
  const eloData = eloFiltered.length > 0 ? eloFiltered : [{ range: '', count: 0 }];
  const eloColor = eloCategory === 'overall' ? COLORS.accent : (COLORS[eloCategory] || COLORS.accent);

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

  // Company avg ELO data
  const companyEloKey = companyEloCategory === 'overall' ? 'avgElo' : `avgElo_${companyEloCategory}`;
  const companyCountKey = companyEloCategory === 'overall' ? 'playerCount' : `playerCount_${companyEloCategory}`;
  const companyEloColor = companyEloCategory === 'overall' ? '#22c55e' : (COLORS[companyEloCategory] || '#22c55e');
  const companyEloFiltered = (charts.avgEloByCompany || [])
    .filter(d => d[companyEloKey] != null && d[companyEloKey] > 0)
    .map(d => ({ name: d.company, elo: d[companyEloKey], players: d[companyCountKey] }))
    .sort((a, b) => b.elo - a.elo);
  const companyEloData = companyEloFiltered.length > 0 ? companyEloFiltered : [{ name: '', elo: 0, players: 0 }];

  // BU avg ELO data
  const buEloKey = buEloCategory === 'overall' ? 'avgElo' : `avgElo_${buEloCategory}`;
  const buCountKey = buEloCategory === 'overall' ? 'playerCount' : `playerCount_${buEloCategory}`;
  const buEloColor = buEloCategory === 'overall' ? '#06b6d4' : (COLORS[buEloCategory] || '#06b6d4');
  const buEloFiltered = (charts.avgEloByBu || [])
    .filter(d => d[buEloKey] != null && d[buEloKey] > 0)
    .map(d => ({ name: d.bu, elo: d[buEloKey], players: d[buCountKey] }))
    .sort((a, b) => b.elo - a.elo);
  const buEloData = buEloFiltered.length > 0 ? buEloFiltered : [{ name: '', elo: 0, players: 0 }];

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
        {stats.mostConsistent && (
          <div className="gsp-card">
            <span className="gsp-card-label">Elo più Costante</span>
            <span className="gsp-card-value">±{stats.mostConsistent.stddev}</span>
            <span className="gsp-card-sub">{stats.mostConsistent.name}</span>
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
                  formatter={(v, name, props) => {
                    const i = catPieData.findIndex(d => d.name === name);
                    return [`${v} (${catPcts[i] ?? 0}%)`, name];
                  }}
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
          <div className="gsp-section-header">
            <h2>Distribuzione ELO</h2>
            <div className="gsp-elo-tabs">
              {['overall', '1v1_21', '1v1_11', '2v2_21', '2v2_11'].map(cat => (
                <button
                  key={cat}
                  className={`gsp-elo-tab${eloCategory === cat ? ' active' : ''}`}
                  style={eloCategory === cat ? { background: cat === 'overall' ? COLORS.accent : COLORS[cat] } : {}}
                  onClick={() => setEloCategory(cat)}
                >
                  {cat === 'overall' ? 'Overall' : CAT_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>
          <div className="gsp-chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={eloData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="range" stroke="var(--text-dim)" fontSize={11} />
                <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} domain={eloFiltered.length > 0 ? [0, 'auto'] : [0, 10]} />
                <Tooltip cursor={{ fill: 'transparent' }} {...tooltipStyle} />
                <Bar dataKey="count" fill={eloColor} radius={[3, 3, 0, 0]} name="Giocatori" background={{ fill: 'transparent' }} />
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
                    formatter={(v, name) => {
                      const i = companyData.findIndex(d => d.company === name);
                      return [`${v} (${companyPcts[i] ?? 0}%)`, name];
                    }}
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
                    formatter={(v, name) => {
                      const i = buData.findIndex(d => d.bu === name);
                      return [`${v} (${buPcts[i] ?? 0}%)`, name];
                    }}
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

      {/* Avg ELO by Company + BU */}
      <div className="gsp-charts-row">
        {(charts.avgEloByCompany || []).length > 0 && (
          <div className="gsp-section">
            <div className="gsp-section-header">
              <h2>ELO Medio per Azienda</h2>
              <div className="gsp-elo-tabs">
                {['overall', '1v1_21', '1v1_11', '2v2_21', '2v2_11'].map(cat => (
                  <button
                    key={cat}
                    className={`gsp-elo-tab${companyEloCategory === cat ? ' active' : ''}`}
                    style={companyEloCategory === cat ? { background: cat === 'overall' ? '#22c55e' : COLORS[cat] } : {}}
                    onClick={() => setCompanyEloCategory(cat)}
                  >
                    {cat === 'overall' ? 'Overall' : CAT_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>
            <div className="gsp-chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={companyEloData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-dim)" fontSize={11} domain={companyEloFiltered.length > 0 ? [800, 'dataMax + 30'] : [900, 1100]} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-dim)" fontSize={12} width={90} axisLine={{ stroke: 'var(--text-dim)' }} tickLine={false} />
                  <Tooltip
                    formatter={(v, name, props) => [`${v} ELO (${props.payload.players} giocatori)`, 'Media']}
                    cursor={{ fill: 'transparent' }}
                    {...tooltipStyle}
                  />
                  <Bar dataKey="elo" fill={companyEloColor} radius={[0, 3, 3, 0]} name="ELO Medio" background={{ fill: 'transparent' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {isDataCompany && (charts.avgEloByBu || []).length > 0 && (
          <div className="gsp-section">
            <div className="gsp-section-header">
              <h2>ELO Medio per BU</h2>
              <div className="gsp-elo-tabs">
                {['overall', '1v1_21', '1v1_11', '2v2_21', '2v2_11'].map(cat => (
                  <button
                    key={cat}
                    className={`gsp-elo-tab${buEloCategory === cat ? ' active' : ''}`}
                    style={buEloCategory === cat ? { background: cat === 'overall' ? '#06b6d4' : COLORS[cat] } : {}}
                    onClick={() => setBuEloCategory(cat)}
                  >
                    {cat === 'overall' ? 'Overall' : CAT_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>
            <div className="gsp-chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={buEloData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-dim)" fontSize={11} domain={buEloFiltered.length > 0 ? [800, 'dataMax + 30'] : [900, 1100]} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-dim)" fontSize={12} width={60} axisLine={{ stroke: 'var(--text-dim)' }} tickLine={false} />
                  <Tooltip
                    formatter={(v, name, props) => [`${v} ELO (${props.payload.players} giocatori)`, 'Media']}
                    cursor={{ fill: 'transparent' }}
                    {...tooltipStyle}
                  />
                  <Bar dataKey="elo" fill={buEloColor} radius={[0, 3, 3, 0]} name="ELO Medio" background={{ fill: 'transparent' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalStatsPage;
