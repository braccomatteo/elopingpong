import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, LineChart, Line,
  ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import Pagination from './Pagination';
import CustomSelect from './CustomSelect';
import './CustomSelect.css';
import './AdminDashboard.css';

const LIMIT = 50;
const token = () => localStorage.getItem('token');
const headers = () => ({ 'Authorization': `Bearer ${token()}` });
const jsonHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` });

const computeTrend = (data) => {
  const n = data.length;
  if (n < 2) return [];
  const sumX = data.reduce((s, d) => s + d.games, 0);
  const sumY = data.reduce((s, d) => s + d.elo, 0);
  const sumXY = data.reduce((s, d) => s + d.games * d.elo, 0);
  const sumX2 = data.reduce((s, d) => s + d.games * d.games, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return [];
  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;
  const minX = Math.min(...data.map(d => d.games));
  const maxX = Math.max(...data.map(d => d.games));
  return [{ games: minX, elo: Math.round(m * minX + b) }, { games: maxX, elo: Math.round(m * maxX + b) }];
};

const AdminDashboard = ({ players, onUpdate }) => {
  const [adminTab, setAdminTab] = useState('players');

  /* ---- Players state ---- */
  const [playerList, setPlayerList] = useState([]);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', company: '', bu: '' });
  const [editNewCompany, setEditNewCompany] = useState(false);
  const [editCustomCompany, setEditCustomCompany] = useState('');
  const [companies, setCompanies] = useState([]);

  /* ---- Singles state ---- */
  const [sCreatorId, setSCreatorId] = useState('');
  const [sOpponentId, setSOpponentId] = useState('');
  const [sCreatorScore, setSCreatorScore] = useState('');
  const [sOpponentScore, setSOpponentScore] = useState('');
  const [sPointsType, setSPointsType] = useState('21');
  const [singlesError, setSinglesError] = useState('');

  /* ---- Doubles state ---- */
  const [dP1, setDP1] = useState('');
  const [dP2, setDP2] = useState('');
  const [dP3, setDP3] = useState('');
  const [dP4, setDP4] = useState('');
  const [dScore1, setDScore1] = useState('');
  const [dScore2, setDScore2] = useState('');
  const [dPointsType, setDPointsType] = useState('21');
  const [doublesError, setDoublesError] = useState('');

  /* ---- Unified History state ---- */
  const [historyMatches, setHistoryMatches] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [editingMatch, setEditingMatch] = useState(null); // { id, isDouble, form }
  const [matchEditError, setMatchEditError] = useState('');

  /* ---- Trash state ---- */
  const [trashData, setTrashData] = useState({ players: [], matches: [], teamMatches: [] });
  const [trashLoading, setTrashLoading] = useState(false);

  /* ---- Pending state ---- */
  const [pendingPlayers, setPendingPlayers] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  /* ---- Stats charts state ---- */
  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [showBuTrend, setShowBuTrend] = useState(false);
  const [showPlayerTrend, setShowPlayerTrend] = useState(false);

  const [loading, setLoading] = useState(true);

  /* ---- Fetch functions ---- */
  const fetchPlayers = async () => {
    try {
      const res = await fetch('/api/players');
      setPlayerList(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      if (Array.isArray(data)) setCompanies(data);
    } catch (err) { console.error(err); }
  };

  const fetchHistory = async (page = 1) => {
    try {
      const res = await fetch(`/api/matches/history?page=${page}&limit=${LIMIT}`, { headers: headers() });
      const data = await res.json();
      setHistoryMatches(data.matches || []);
      setHistoryTotalPages(data.totalPages || 1);
      setHistoryPage(data.page || 1);
    } catch (err) { console.error(err); }
  };

  const fetchTrash = async () => {
    setTrashLoading(true);
    try {
      const res = await fetch('/api/players/trash', { headers: headers() });
      const data = await res.json();
      setTrashData(data);
    } catch (err) { console.error(err); }
    setTrashLoading(false);
  };

  const fetchPending = async () => {
    setPendingLoading(true);
    try {
      const res = await fetch('/api/players/pending', { headers: headers() });
      const data = await res.json();
      if (Array.isArray(data)) setPendingPlayers(data);
    } catch (err) { console.error(err); }
    setPendingLoading(false);
  };

  const fetchChartData = async () => {
    setChartLoading(true);
    try {
      const res = await fetch('/api/matches/global-charts');
      const data = await res.json();
      setChartData(data);
    } catch (err) { console.error(err); }
    setChartLoading(false);
  };

  const approvePlayer = async (id) => {
    try {
      const res = await fetch(`/api/players/approve/${id}`, { method: 'POST', headers: headers() });
      if (res.ok) { fetchPending(); fetchPlayers(); onUpdate(); }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    Promise.all([fetchPlayers(), fetchHistory(), fetchCompanies(), fetchPending()]).finally(() => setLoading(false));
  }, []);

  /* ---- Match edit handlers ---- */
  const startEditMatch = (m) => {
    const isDouble = m.match_type === 'doubles';
    setMatchEditError('');
    if (isDouble) {
      setEditingMatch({ id: m.id, isDouble: true, form: {
        p1_id: m.p1_id, p2_id: m.p2_id, op1_id: m.op1_id, op2_id: m.op2_id,
        team_score: String(m.t1_score), opponent_score: String(m.t2_score),
        points_type: String(m.points_type)
      }});
    } else {
      setEditingMatch({ id: m.id, isDouble: false, form: {
        creator_id: m.p1_id, opponent_id: m.op1_id,
        creator_score: String(m.t1_score), opponent_score: String(m.t2_score),
        points_type: String(m.points_type)
      }});
    }
  };

  const saveEditMatch = async () => {
    if (!editingMatch) return;
    setMatchEditError('');
    const { id, isDouble, form } = editingMatch;
    const endpoint = isDouble ? `/api/team-matches/${id}` : `/api/matches/${id}`;
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) { setMatchEditError(data.error || 'Errore'); return; }
      setEditingMatch(null);
      fetchHistory(historyPage);
      onUpdate();
    } catch (err) { setMatchEditError(err.message); }
  };

  /* ---- Delete handlers ---- */
  const deletePlayer = async (id) => {
    if (!window.confirm('Eliminare questo giocatore e tutti i suoi match?')) return;
    try {
      const res = await fetch(`/api/players/${id}`, { method: 'DELETE', headers: headers() });
      if (res.ok) { fetchPlayers(); onUpdate(); }
    } catch (err) { console.error(err); }
  };

  const deleteMatch = async (id, isDouble) => {
    if (!window.confirm('Eliminare questo match? I punteggi verranno ricalcolati.')) return;
    try {
      const endpoint = isDouble ? `/api/team-matches/${id}` : `/api/matches/${id}`;
      const res = await fetch(endpoint, { method: 'DELETE', headers: headers() });
      if (res.ok) { fetchHistory(historyPage); onUpdate(); }
    } catch (err) { console.error(err); }
  };

  /* ---- Restore handlers ---- */
  const restorePlayer = async (id) => {
    if (!window.confirm('Ripristinare questo giocatore e tutti i suoi match?')) return;
    try {
      const res = await fetch(`/api/players/restore/${id}`, { method: 'POST', headers: headers() });
      if (res.ok) { fetchTrash(); fetchPlayers(); fetchHistory(1); onUpdate(); }
    } catch (err) { console.error(err); }
  };

  const restoreMatch = async (id, isDouble) => {
    if (!window.confirm('Ripristinare questo match? I punteggi verranno ricalcolati.')) return;
    try {
      const endpoint = isDouble ? `/api/team-matches/restore/${id}` : `/api/matches/restore/${id}`;
      const res = await fetch(endpoint, { method: 'POST', headers: headers() });
      if (res.ok) { fetchTrash(); fetchHistory(1); onUpdate(); }
    } catch (err) { console.error(err); }
  };

  /* ---- Permanent delete handlers ---- */
  const permDeletePlayer = async (id) => {
    if (!window.confirm('Eliminare DEFINITIVAMENTE questo giocatore? Questa azione è irreversibile.')) return;
    try {
      const res = await fetch(`/api/players/trash/player/${id}`, { method: 'DELETE', headers: headers() });
      if (res.ok) fetchTrash();
    } catch (err) { console.error(err); }
  };

  const permDeleteMatch = async (id, isDouble) => {
    if (!window.confirm('Eliminare DEFINITIVAMENTE questo match? Questa azione è irreversibile.')) return;
    try {
      const endpoint = isDouble ? `/api/players/trash/team-match/${id}` : `/api/players/trash/match/${id}`;
      const res = await fetch(endpoint, { method: 'DELETE', headers: headers() });
      if (res.ok) fetchTrash();
    } catch (err) { console.error(err); }
  };

  /* ---- Edit player ---- */
  const startEdit = (p) => {
    setEditingPlayer(p.id);
    const knownCompany = companies.find(c => c.name === (p.company || ''));
    if (knownCompany) {
      setEditForm({ name: p.name, company: p.company || '', bu: p.bu || '' });
      setEditNewCompany(false);
      setEditCustomCompany('');
    } else if (p.company) {
      setEditForm({ name: p.name, company: '', bu: p.bu || '' });
      setEditNewCompany(true);
      setEditCustomCompany(p.company);
    } else {
      setEditForm({ name: p.name, company: '', bu: '' });
      setEditNewCompany(false);
      setEditCustomCompany('');
    }
  };

  const cancelEdit = () => {
    setEditingPlayer(null);
    setEditForm({ name: '', company: '', bu: '' });
    setEditNewCompany(false);
    setEditCustomCompany('');
  };

  const handleEditCompanyChange = (value) => {
    if (value === '__new__') {
      setEditNewCompany(true);
      setEditCustomCompany('');
      setEditForm({ ...editForm, company: '', bu: '' });
    } else {
      setEditNewCompany(false);
      setEditCustomCompany('');
      setEditForm({ ...editForm, company: value, bu: '' });
    }
  };

  const saveEdit = async (id) => {
    try {
      const company = editNewCompany ? editCustomCompany.trim().toUpperCase() : editForm.company;
      const bu = editForm.bu;
      const payload = { name: editForm.name, company, bu };
      const res = await fetch(`/api/players/${id}`, {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setEditingPlayer(null);
        fetchPlayers();
        fetchCompanies();
        onUpdate();
      } else {
        const data = await res.json();
        alert(data.error || 'Errore durante il salvataggio.');
      }
    } catch (err) { console.error(err); }
  };

  /* ---- Create singles ---- */
  const handleSinglesSubmit = async (e) => {
    e.preventDefault();
    if (!sCreatorId || !sOpponentId || sCreatorScore === '' || sOpponentScore === '') {
      setSinglesError('Tutti i campi sono obbligatori.');
      return;
    }
    try {
      const res = await fetch('/api/matches/admin', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ creator_id: sCreatorId, opponent_id: sOpponentId, creator_score: parseInt(sCreatorScore), opponent_score: parseInt(sOpponentScore), points_type: parseInt(sPointsType) })
      });
      if (res.ok) {
        setSCreatorId(''); setSOpponentId(''); setSCreatorScore(''); setSOpponentScore(''); setSinglesError('');
        fetchHistory(1); onUpdate();
      } else {
        const data = await res.json();
        setSinglesError(data.error || 'Errore durante la creazione.');
      }
    } catch { setSinglesError('Errore di connessione.'); }
  };

  /* ---- Create doubles ---- */
  const handleDoublesSubmit = async (e) => {
    e.preventDefault();
    if (!dP1 || !dP2 || !dP3 || !dP4 || dScore1 === '' || dScore2 === '') {
      setDoublesError('Tutti i campi sono obbligatori.');
      return;
    }
    const unique = new Set([dP1, dP2, dP3, dP4]);
    if (unique.size < 4) { setDoublesError('Seleziona 4 giocatori diversi.'); return; }
    try {
      const res = await fetch('/api/team-matches', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          p1_id: dP1, p2_id: dP2,
          op1_id: dP3, op2_id: dP4,
          team_score: parseInt(dScore1), opponent_score: parseInt(dScore2),
          points_type: parseInt(dPointsType)
        })
      });
      if (res.ok) {
        setDP1(''); setDP2(''); setDP3(''); setDP4(''); setDScore1(''); setDScore2(''); setDoublesError('');
        fetchHistory(1); onUpdate();
      } else {
        const data = await res.json();
        setDoublesError(data.error || 'Errore durante la creazione.');
      }
    } catch { setDoublesError('Errore di connessione.'); }
  };

  if (loading) return <div className="empty-state">Caricamento dashboard...</div>;

  return (
    <div className="admin-dashboard">
      <div className="admin-tabs">
        <button className={`admin-tab-btn ${adminTab === 'players' ? 'active' : ''}`} onClick={() => setAdminTab('players')}>
          Giocatori
        </button>
        <button className={`admin-tab-btn ${adminTab === 'singles' ? 'active' : ''}`} onClick={() => setAdminTab('singles')}>
          Ins. Singolo
        </button>
        <button className={`admin-tab-btn ${adminTab === 'doubles' ? 'active' : ''}`} onClick={() => setAdminTab('doubles')}>
          Ins. Doppio
        </button>
        <button className={`admin-tab-btn ${adminTab === 'history' ? 'active' : ''}`} onClick={() => setAdminTab('history')}>
          Storico Match
        </button>
        <button className={`admin-tab-btn ${adminTab === 'trash' ? 'active' : ''}`} onClick={() => { setAdminTab('trash'); fetchTrash(); }}>
          Cestino
        </button>
        <button className={`admin-tab-btn ${adminTab === 'pending' ? 'active' : ''}`} onClick={() => { setAdminTab('pending'); fetchPending(); }}>
          In Attesa {pendingPlayers.length > 0 && <span style={{ background: 'var(--accent-red)', color: '#fff', borderRadius: '50%', padding: '1px 6px', fontSize: '0.7rem', marginLeft: '4px' }}>{pendingPlayers.length}</span>}
        </button>
        <button className={`admin-tab-btn ${adminTab === 'stats' ? 'active' : ''}`} onClick={() => { setAdminTab('stats'); if (!chartData) fetchChartData(); }}>
          Stats
        </button>
      </div>

      {/* ===================== TAB: GIOCATORI ===================== */}
      {adminTab === 'players' && (
        <section className="ranking-card">
          <h2>Gestione Giocatori</h2>
          {playerList.length === 0 ? (
            <div className="empty-state">Nessun giocatore registrato.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Nome</th><th>Company</th><th>BU</th><th>Overall</th><th>1v1 21</th><th>1v1 11</th><th>2v2 21</th><th>2v2 11</th><th>Azioni</th></tr>
              </thead>
              <tbody>
                {playerList.map(p => (
                  <tr key={p.id}>
                    {editingPlayer === p.id ? (
                      (() => {
                        const editCompanyObj = companies.find(c => c.name === editForm.company);
                        const editBus = editCompanyObj?.bus || [];
                        return (
                      <>
                        <td><input className="edit-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></td>
                        <td>
                          <CustomSelect
                            value={editNewCompany ? '__new__' : editForm.company}
                            onChange={handleEditCompanyChange}
                            placeholder="--"
                            options={[
                              ...companies.map(c => ({ value: c.name, label: c.name })),
                              { value: '__new__', label: '+ Nuova...', special: true }
                            ]}
                          />
                          {editNewCompany && <input className="edit-input" style={{ marginTop: 4 }} placeholder="Nome company" value={editCustomCompany} onChange={e => setEditCustomCompany(e.target.value)} />}
                        </td>
                        <td>
                          {editBus.length > 0 ? (
                            <CustomSelect
                              value={editForm.bu}
                              onChange={v => setEditForm({ ...editForm, bu: v })}
                              placeholder="--"
                              options={editBus.map(bu => ({ value: bu, label: bu }))}
                            />
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{'\u2014'}</span>
                          )}
                        </td>
                        <td className="score">{Math.round(p.score_overall)}</td>
                        <td className="score">{Math.round(p.score_1v1_21)}</td>
                        <td className="score">{Math.round(p.score_1v1_11)}</td>
                        <td className="score">{Math.round(p.score_2v2_21)}</td>
                        <td className="score">{Math.round(p.score_2v2_11)}</td>
                        <td>
                          <div className="trash-actions">
                            <button className="trash-btn restore" onClick={() => saveEdit(p.id)}>Salva</button>
                            <button className="trash-btn perm-delete" onClick={cancelEdit}>Annulla</button>
                          </div>
                        </td>
                      </>
                        );
                      })()
                    ) : (
                      <>
                        <td>{p.name}</td>
                        <td>{p.company || '\u2014'}</td>
                        <td>{p.bu || '\u2014'}</td>
                        <td className="score">{Math.round(p.score_overall)}</td>
                        <td className="score">{Math.round(p.score_1v1_21)}</td>
                        <td className="score">{Math.round(p.score_1v1_11)}</td>
                        <td className="score">{Math.round(p.score_2v2_21)}</td>
                        <td className="score">{Math.round(p.score_2v2_11)}</td>
                        <td>
                          <div className="trash-actions">
                            <button className="edit-btn" onClick={() => startEdit(p)}>Modifica</button>
                            <button className="delete-btn" onClick={() => deletePlayer(p.id)}>Elimina</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* ===================== TAB: PARTITE 21 ===================== */}
      {adminTab === 'singles' && (
        <>
          <section className="ranking-card">
            <h2>Inserisci Partita Singolo</h2>
            {singlesError && <div className="error-message">{singlesError}</div>}
            <form onSubmit={handleSinglesSubmit} className="admin-match-form">
              <div className="form-row">
                <CustomSelect value={sCreatorId} onChange={setSCreatorId} placeholder="Giocatore 1" options={players.map(p => ({ value: p.id, label: p.name }))} />
                <span>VS</span>
                <CustomSelect value={sOpponentId} onChange={setSOpponentId} placeholder="Giocatore 2" options={players.map(p => ({ value: p.id, label: p.name }))} />
              </div>
              <div className="form-row">
                <input type="number" placeholder="Punti G1" value={sCreatorScore} onChange={e => setSCreatorScore(e.target.value)} min="0" required />
                <input type="number" placeholder="Punti G2" value={sOpponentScore} onChange={e => setSOpponentScore(e.target.value)} min="0" required />
                <CustomSelect value={sPointsType} onChange={setSPointsType} placeholder="Punti" options={[{ value: '21', label: '21 pt' }, { value: '11', label: '11 pt' }]} />
              </div>
              <button type="submit" className="submit-btn">Registra Match</button>
            </form>
          </section>
        </>
      )}

      {/* ===================== TAB: PARTITE DOPPIE ===================== */}
      {adminTab === 'doubles' && (
        <>
          <section className="ranking-card">
            <h2>Inserisci Partita Doppio</h2>
            {doublesError && <div className="error-message">{doublesError}</div>}
            <form onSubmit={handleDoublesSubmit} className="admin-match-form">
              <div className="form-row">
                <CustomSelect value={dP1} onChange={setDP1} placeholder="Team 1 - G1" options={players.map(p => ({ value: p.id, label: p.name }))} />
                <CustomSelect value={dP2} onChange={setDP2} placeholder="Team 1 - G2" options={players.map(p => ({ value: p.id, label: p.name }))} />
              </div>
              <span style={{ display: 'block', textAlign: 'center', fontWeight: 'bold', margin: '0.5rem 0', color: 'var(--accent-orange)' }}>VS</span>
              <div className="form-row">
                <CustomSelect value={dP3} onChange={setDP3} placeholder="Team 2 - G1" options={players.map(p => ({ value: p.id, label: p.name }))} />
                <CustomSelect value={dP4} onChange={setDP4} placeholder="Team 2 - G2" options={players.map(p => ({ value: p.id, label: p.name }))} />
              </div>
              <div className="form-row">
                <input type="number" placeholder="Punti Team 1" value={dScore1} onChange={e => setDScore1(e.target.value)} min="0" required />
                <input type="number" placeholder="Punti Team 2" value={dScore2} onChange={e => setDScore2(e.target.value)} min="0" required />
                <CustomSelect value={dPointsType} onChange={setDPointsType} placeholder="Punti" options={[{ value: '21', label: '21 pt' }, { value: '11', label: '11 pt' }]} />
              </div>
              <button type="submit" className="submit-btn">Registra Match Doppio</button>
            </form>
          </section>
        </>
      )}

      {/* ===================== TAB: STORICO UNIFICATO ===================== */}
      {adminTab === 'history' && (
        <section className="ranking-card">
          <h2>Storico Partite (Singoli e Doppi)</h2>
          {historyMatches.length === 0 ? (
            <div className="empty-state">Nessun match registrato.</div>
          ) : (
            <>
              <table className="admin-table">
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Sfida</th><th>Risultato</th><th>Azioni</th></tr>
                </thead>
                <tbody>
                  {historyMatches.map(m => {
                    const isDouble = m.match_type === 'doubles';
                    const isEditing = editingMatch?.id === m.id;
                    const pOpts = playerList.map(p => ({ value: p.id, label: p.name }));

                    if (isEditing) {
                      const f = editingMatch.form;
                      return (
                        <tr key={m.id} className="match-edit-row">
                          <td colSpan={5}>
                            <div className="match-edit-form">
                              {isDouble ? (
                                <>
                                  <div className="match-edit-group">
                                    <label>Team 1</label>
                                    <CustomSelect value={f.p1_id} onChange={v => setEditingMatch(e => ({ ...e, form: { ...e.form, p1_id: v } }))} options={pOpts} placeholder="Giocatore 1" />
                                    <CustomSelect value={f.p2_id} onChange={v => setEditingMatch(e => ({ ...e, form: { ...e.form, p2_id: v } }))} options={pOpts} placeholder="Giocatore 2" />
                                  </div>
                                  <div className="match-edit-group">
                                    <label>Team 2</label>
                                    <CustomSelect value={f.op1_id} onChange={v => setEditingMatch(e => ({ ...e, form: { ...e.form, op1_id: v } }))} options={pOpts} placeholder="Giocatore 3" />
                                    <CustomSelect value={f.op2_id} onChange={v => setEditingMatch(e => ({ ...e, form: { ...e.form, op2_id: v } }))} options={pOpts} placeholder="Giocatore 4" />
                                  </div>
                                  <div className="match-edit-group">
                                    <label>Risultato</label>
                                    <input className="edit-input match-score-input" type="number" min="0" value={f.team_score} onChange={e => setEditingMatch(em => ({ ...em, form: { ...em.form, team_score: e.target.value } }))} />
                                    <span style={{ color: 'var(--text-dim)' }}>-</span>
                                    <input className="edit-input match-score-input" type="number" min="0" value={f.opponent_score} onChange={e => setEditingMatch(em => ({ ...em, form: { ...em.form, opponent_score: e.target.value } }))} />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="match-edit-group">
                                    <label>Giocatori</label>
                                    <CustomSelect value={f.creator_id} onChange={v => setEditingMatch(e => ({ ...e, form: { ...e.form, creator_id: v } }))} options={pOpts} placeholder="Giocatore 1" />
                                    <CustomSelect value={f.opponent_id} onChange={v => setEditingMatch(e => ({ ...e, form: { ...e.form, opponent_id: v } }))} options={pOpts} placeholder="Giocatore 2" />
                                  </div>
                                  <div className="match-edit-group">
                                    <label>Risultato</label>
                                    <input className="edit-input match-score-input" type="number" min="0" value={f.creator_score} onChange={e => setEditingMatch(em => ({ ...em, form: { ...em.form, creator_score: e.target.value } }))} />
                                    <span style={{ color: 'var(--text-dim)' }}>-</span>
                                    <input className="edit-input match-score-input" type="number" min="0" value={f.opponent_score} onChange={e => setEditingMatch(em => ({ ...em, form: { ...em.form, opponent_score: e.target.value } }))} />
                                  </div>
                                </>
                              )}
                              <div className="match-edit-group">
                                <label>Punti</label>
                                <select className="edit-input" value={f.points_type} onChange={e => setEditingMatch(em => ({ ...em, form: { ...em.form, points_type: e.target.value } }))}>
                                  <option value="21">21</option>
                                  <option value="11">11</option>
                                </select>
                              </div>
                              {matchEditError && <span className="match-edit-error">{matchEditError}</span>}
                              <div className="match-edit-actions">
                                <button className="trash-btn restore" onClick={saveEditMatch}>Salva</button>
                                <button className="trash-btn perm-delete" onClick={() => { setEditingMatch(null); setMatchEditError(''); }}>Annulla</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    const leftSide = isDouble ? `${m.p1_name} & ${m.p2_name}` : m.p1_name;
                    const rightSide = isDouble ? `${m.op1_name} & ${m.op2_name}` : m.op1_name;
                    return (
                      <tr key={m.id}>
                        <td>{new Date(m.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{m.points_type} pt</td>
                        <td>{leftSide} <span style={{ color: 'var(--accent-orange)' }}>vs</span> {rightSide}</td>
                        <td className="score">{m.t1_score} - {m.t2_score}</td>
                        <td>
                          <div className="trash-actions">
                            <button className="edit-btn" onClick={() => startEditMatch(m)}>Modifica</button>
                            <button className="delete-btn" onClick={() => deleteMatch(m.id, isDouble)}>Elimina</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={historyPage} totalPages={historyTotalPages} onPageChange={(p) => fetchHistory(p)} />
            </>
          )}
        </section>
      )}

      {/* ===================== TAB: CESTINO ===================== */}
      {adminTab === 'trash' && (
        <section className="ranking-card">
          <h2>Cestino</h2>
          {trashLoading ? (
            <div className="empty-state">Caricamento...</div>
          ) : (trashData.players.length === 0 && trashData.matches.length === 0 && trashData.teamMatches.length === 0) ? (
            <div className="empty-state">Il cestino è vuoto.</div>
          ) : (
            <>
              {trashData.players.length > 0 && (
                <>
                  <h3 style={{ marginTop: '1rem' }}>Giocatori eliminati</h3>
                  <table className="admin-table">
                    <thead>
                      <tr><th>Nome</th><th>Company</th><th>BU</th><th>Eliminato il</th><th>Eliminato da</th><th>Azioni</th></tr>
                    </thead>
                    <tbody>
                      {trashData.players.map(p => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{p.company || '\u2014'}</td>
                          <td>{p.bu || '\u2014'}</td>
                          <td>{new Date(p.deleted_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{p.deleted_by_name || '—'}</td>
                          <td>
                            <div className="trash-actions">
                              <button className="trash-btn restore" onClick={() => restorePlayer(p.id)}>Ripristina</button>
                              <button className="trash-btn perm-delete" onClick={() => permDeletePlayer(p.id)}>Elimina</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {(trashData.matches.length > 0 || trashData.teamMatches.length > 0) && (
                <>
                  <h3 style={{ marginTop: '1rem' }}>Match eliminati</h3>
                  <table className="admin-table">
                    <thead>
                      <tr><th>Data</th><th>Tipo</th><th>Sfida</th><th>Risultato</th><th>Eliminato il</th><th>Eliminato da</th><th>Azioni</th></tr>
                    </thead>
                    <tbody>
                      {trashData.matches.map(m => (
                        <tr key={`s-${m.id}`}>
                          <td>{new Date(m.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{m.points_type} pt</td>
                          <td>{m.creator_name} <span style={{ color: 'var(--accent-orange)' }}>vs</span> {m.opponent_name}</td>
                          <td className="score">{m.creator_score} - {m.opponent_score}</td>
                          <td>{new Date(m.deleted_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{m.deleted_by_name || '—'}</td>
                          <td>
                            <div className="trash-actions">
                              <button className="trash-btn restore" onClick={() => restoreMatch(m.id, false)}>Ripristina</button>
                              <button className="trash-btn perm-delete" onClick={() => permDeleteMatch(m.id, false)}>Elimina</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {trashData.teamMatches.map(m => (
                        <tr key={`d-${m.id}`}>
                          <td>{new Date(m.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{m.points_type} pt</td>
                          <td>{m.p1_name} & {m.p2_name} <span style={{ color: 'var(--accent-orange)' }}>vs</span> {m.op1_name} & {m.op2_name}</td>
                          <td className="score">{m.team_score} - {m.opponent_score}</td>
                          <td>{new Date(m.deleted_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{m.deleted_by_name || '—'}</td>
                          <td>
                            <div className="trash-actions">
                              <button className="trash-btn restore" onClick={() => restoreMatch(m.id, true)}>Ripristina</button>
                              <button className="trash-btn perm-delete" onClick={() => permDeleteMatch(m.id, true)}>Elimina</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </section>
      )}

      {/* ===================== TAB: IN ATTESA ===================== */}
      {adminTab === 'pending' && (
        <section className="ranking-card">
          <h2>Giocatori in Attesa di Approvazione</h2>
          {pendingLoading ? (
            <div className="empty-state">Caricamento...</div>
          ) : pendingPlayers.length === 0 ? (
            <div className="empty-state">Nessun giocatore in attesa.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Nome</th><th>Company</th><th>BU</th><th>Match</th><th>Azioni</th></tr>
              </thead>
              <tbody>
                {pendingPlayers.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.company || '\u2014'}</td>
                    <td>{p.bu || '\u2014'}</td>
                    <td>{p.match_count}/5</td>
                    <td>
                      <div className="trash-actions">
                        <button className="trash-btn restore" onClick={() => approvePlayer(p.id)}>Approva</button>
                        <button className="delete-btn" onClick={() => deletePlayer(p.id)}>Rifiuta</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* ===================== TAB: STATS ===================== */}
      {adminTab === 'stats' && (
        <section className="ranking-card">
          <h2>Statistiche Temporali</h2>
          {chartLoading || !chartData ? (
            <div className="empty-state">Caricamento...</div>
          ) : (() => {
            const tooltipStyle = {
              contentStyle: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '6px' },
              itemStyle: { color: 'var(--text-color)' },
              labelStyle: { color: 'var(--text-color)' },
            };
            const weekData = chartData.matchesPerWeek.map(w => ({
              week: new Date(w.week).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
              count: w.count,
            }));
            const hourData = chartData.matchesByHour.map(h => ({
              hour: `${h.hour}:00`,
              count: h.count,
            }));
            return (
              <>
              <div className="gsp-charts-row" style={{ marginTop: '1rem' }}>
                <div className="gsp-section">
                  <h3>Attività Settimanale</h3>
                  <div className="gsp-chart-container">
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={weekData}>
                        <defs>
                          <linearGradient id="adminWeekGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FF6600" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#FF6600" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="week" stroke="var(--text-dim)" fontSize={11} />
                        <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} />
                        <Tooltip {...tooltipStyle} />
                        <Area type="monotone" dataKey="count" stroke="#FF6600" strokeWidth={2.5} fill="url(#adminWeekGrad)" name="Partite" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="gsp-section">
                  <h3>Orari di Gioco</h3>
                  <div className="gsp-chart-container">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={hourData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="hour" stroke="var(--text-dim)" fontSize={11} />
                        <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} />
                        <Tooltip {...tooltipStyle} />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Partite" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Avg ELO over time */}
              {chartData.avgEloByDay && chartData.avgEloByDay.length > 0 && (() => {
                const eloData = chartData.avgEloByDay.map(d => ({
                  date: new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
                  avg: d.avg,
                }));
                return (
                  <div className="gsp-section" style={{ marginTop: '1rem' }}>
                    <h3>Elo Medio nel Tempo</h3>
                    <div className="gsp-chart-container">
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={eloData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                          <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={11} />
                          <YAxis stroke="var(--text-dim)" fontSize={12} domain={['dataMin - 20', 'dataMax + 20']} />
                          <Tooltip {...tooltipStyle} />
                          <Line type="monotone" dataKey="avg" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} name="Elo Medio" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}

              {/* ELO Trajectories per player */}
              {chartData.eloTrajectories && chartData.eloTrajectories.length > 0 && (() => {
                const TRAJ_COLORS = ['#FF6600','#8b5cf6','#22c55e','#ef4444','#3b82f6','#f59e0b','#ec4899','#14b8a6','#a855f7','#6366f1','#f97316','#06b6d4','#e11d48','#84cc16','#0ea5e9','#d946ef','#fb923c','#2dd4bf','#c084fc','#fbbf24'];
                // Build unified data: array of { match, [playerName]: elo }
                const matchMap = {};
                chartData.eloTrajectories.forEach(p => {
                  p.data.forEach(d => {
                    if (!matchMap[d.match]) matchMap[d.match] = { match: d.match };
                    matchMap[d.match][p.name] = d.elo;
                  });
                });
                const trajData = Object.values(matchMap).sort((a, b) => a.match - b.match);
                const playerNames = chartData.eloTrajectories.map(p => p.name);
                return (
                  <div className="gsp-section" style={{ marginTop: '1rem' }}>
                    <h3>Traiettorie Elo</h3>
                    <div className="gsp-chart-container">
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={trajData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                          <XAxis type="number" dataKey="match" stroke="var(--text-dim)" fontSize={11} domain={[0, 'dataMax']} label={{ value: 'Partita #', position: 'insideBottom', offset: -5, style: { fill: 'var(--text-dim)', fontSize: 11 } }} />
                          <YAxis stroke="var(--text-dim)" fontSize={12} domain={['dataMin - 30', 'dataMax + 30']} />
                          <Tooltip {...tooltipStyle} />
                          {playerNames.map((name, i) => (
                            <Line key={name} type="monotone" dataKey={name} stroke={TRAJ_COLORS[i % TRAJ_COLORS.length]} strokeWidth={1.5} dot={false} connectNulls />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}

              {/* Scatter: BU - partite vs ELO medio */}
              {(() => {
                const SC_COLORS = ['#FF6600','#8b5cf6','#22c55e','#ef4444','#3b82f6','#f59e0b','#ec4899','#14b8a6','#a855f7','#6366f1','#f97316','#06b6d4','#e11d48','#84cc16','#0ea5e9','#d946ef'];
                const buMap = {};
                players.forEach(p => {
                  if (!p.bu) return;
                  const games = (p.games_1v1_21||0)+(p.games_1v1_11||0)+(p.games_2v2_21||0)+(p.games_2v2_11||0);
                  if (!buMap[p.bu]) buMap[p.bu] = { games: 0, eloSum: 0, count: 0 };
                  buMap[p.bu].games += games;
                  buMap[p.bu].eloSum += p.score_overall || 1000;
                  buMap[p.bu].count++;
                });
                const buData = Object.entries(buMap).map(([bu, v], i) => ({
                  name: bu, games: v.games, elo: Math.round(v.eloSum / v.count), color: SC_COLORS[i % SC_COLORS.length],
                })).filter(d => d.games > 0).sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                if (buData.length < 2) return null;
                return (
                  <div className="gsp-section" style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0 }}>Partite totali vs ELO medio per BU</h3>
                      <button className={`elo-tab${showBuTrend ? ' active' : ''}`} style={showBuTrend ? { background: '#FF6600' } : {}} onClick={() => setShowBuTrend(v => !v)}>Tendenza</button>
                    </div>
                    <div className="gsp-chart-container">
                      <ResponsiveContainer width="100%" height={280}>
                        <ScatterChart margin={{ bottom: 20, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                          <XAxis type="number" dataKey="games" name="Partite" stroke="var(--text-dim)" fontSize={11} label={{ value: 'Partite giocate', position: 'insideBottom', offset: -5, style: { fill: 'var(--text-dim)', fontSize: 11 } }} />
                          <YAxis type="number" dataKey="elo" name="ELO medio" stroke="var(--text-dim)" fontSize={11} domain={['dataMin - 30', 'dataMax + 30']} label={{ value: 'ELO medio', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-dim)', fontSize: 11 } }} />
                          <ZAxis range={[60, 60]} />
                          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                            if (!payload?.length) return null;
                            const d = payload[0].payload;
                            return <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '8px 12px', fontSize: '0.8rem' }}><strong style={{ color: d.color }}>{d.name}</strong><br/>Partite: {d.games}<br/>ELO medio: {d.elo}</div>;
                          }} />
                          <Scatter data={buData}>
                            {buData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Scatter>
                          {showBuTrend && (() => {
                            const td = computeTrend(buData);
                            return td.length === 2 ? <Scatter data={td} line={{ stroke: 'rgba(255,255,255,0.4)', strokeDasharray: '6 4', strokeWidth: 2 }} shape={() => null} fill="transparent" /> : null;
                          })()}
                        </ScatterChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                        {buData.map(d => (
                          <span key={d.name} style={{ fontSize: '0.72rem', color: 'var(--text-dim)', background: 'var(--input-bg)', padding: '2px 8px', borderRadius: 3 }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: d.color, marginRight: 5, verticalAlign: 'middle' }} />
                            {d.name} — {d.games} pt, ELO {d.elo}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Scatter: Players - partite vs ELO */}
              {(() => {
                const SC_COLORS = ['#FF6600','#8b5cf6','#22c55e','#ef4444','#3b82f6','#f59e0b','#ec4899','#14b8a6','#a855f7','#6366f1','#f97316','#06b6d4','#e11d48','#84cc16','#0ea5e9','#d946ef'];
                const playerData = players.map((p, i) => ({
                  name: p.name,
                  games: (p.games_1v1_21||0)+(p.games_1v1_11||0)+(p.games_2v2_21||0)+(p.games_2v2_11||0),
                  elo: Math.round(p.score_overall || 1000),
                  color: SC_COLORS[i % SC_COLORS.length],
                })).filter(d => d.games > 0);
                if (playerData.length < 2) return null;
                return (
                  <div className="gsp-section" style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0 }}>Partite giocate vs ELO per giocatore</h3>
                      <button className={`elo-tab${showPlayerTrend ? ' active' : ''}`} style={showPlayerTrend ? { background: '#FF6600' } : {}} onClick={() => setShowPlayerTrend(v => !v)}>Tendenza</button>
                    </div>
                    <div className="gsp-chart-container">
                      <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart margin={{ bottom: 20, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                          <XAxis type="number" dataKey="games" name="Partite" stroke="var(--text-dim)" fontSize={11} label={{ value: 'Partite giocate', position: 'insideBottom', offset: -5, style: { fill: 'var(--text-dim)', fontSize: 11 } }} />
                          <YAxis type="number" dataKey="elo" name="ELO" stroke="var(--text-dim)" fontSize={11} domain={['dataMin - 30', 'dataMax + 30']} label={{ value: 'ELO', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-dim)', fontSize: 11 } }} />
                          <ZAxis range={[40, 40]} />
                          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                            if (!payload?.length) return null;
                            const d = payload[0].payload;
                            return <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '8px 12px', fontSize: '0.8rem' }}><strong style={{ color: d.color }}>{d.name}</strong><br/>Partite: {d.games}<br/>ELO: {d.elo}</div>;
                          }} />
                          <Scatter data={playerData}>
                            {playerData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Scatter>
                          {showPlayerTrend && (() => {
                            const td = computeTrend(playerData);
                            return td.length === 2 ? <Scatter data={td} line={{ stroke: 'rgba(255,255,255,0.4)', strokeDasharray: '6 4', strokeWidth: 2 }} shape={() => null} fill="transparent" /> : null;
                          })()}
                        </ScatterChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                        {[...playerData].sort((a,b) => b.elo - a.elo).map(d => (
                          <span key={d.name} style={{ fontSize: '0.72rem', color: 'var(--text-dim)', background: 'var(--input-bg)', padding: '2px 8px', borderRadius: 3 }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: d.color, marginRight: 5, verticalAlign: 'middle' }} />
                            {d.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          );
          })()}
        </section>
      )}
    </div>
  );
};

export default AdminDashboard;
