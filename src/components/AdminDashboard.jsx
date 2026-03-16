import React, { useState, useEffect } from 'react';
import Pagination from './Pagination';
import './AdminDashboard.css';

const LIMIT = 50;
const token = () => localStorage.getItem('token');
const headers = () => ({ 'Authorization': `Bearer ${token()}` });
const jsonHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` });

const AdminDashboard = ({ players, onUpdate }) => {
  const [adminTab, setAdminTab] = useState('players');

  /* ---- Players state ---- */
  const [playerList, setPlayerList] = useState([]);

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

  /* ---- Trash state ---- */
  const [trashData, setTrashData] = useState({ players: [], matches: [], teamMatches: [] });
  const [trashLoading, setTrashLoading] = useState(false);

  const [loading, setLoading] = useState(true);

  /* ---- Fetch functions ---- */
  const fetchPlayers = async () => {
    try {
      const res = await fetch('/api/players');
      setPlayerList(await res.json());
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

  useEffect(() => {
    Promise.all([fetchPlayers(), fetchHistory()]).finally(() => setLoading(false));
  }, []);

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
                <tr><th>Nome</th><th>BU</th><th>Overall</th><th>1v1 21</th><th>1v1 11</th><th>2v2 21</th><th>2v2 11</th><th>Azioni</th></tr>
              </thead>
              <tbody>
                {playerList.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.bu}</td>
                    <td className="score">{Math.round(p.score_overall)}</td>
                    <td className="score">{Math.round(p.score_1v1_21)}</td>
                    <td className="score">{Math.round(p.score_1v1_11)}</td>
                    <td className="score">{Math.round(p.score_2v2_21)}</td>
                    <td className="score">{Math.round(p.score_2v2_11)}</td>
                    <td><button className="delete-btn" onClick={() => deletePlayer(p.id)}>Elimina</button></td>
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
                <select value={sCreatorId} onChange={e => setSCreatorId(e.target.value)} required>
                  <option value="">Giocatore 1</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <span>VS</span>
                <select value={sOpponentId} onChange={e => setSOpponentId(e.target.value)} required>
                  <option value="">Giocatore 2</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <input type="number" placeholder="Punti G1" value={sCreatorScore} onChange={e => setSCreatorScore(e.target.value)} min="0" required />
                <input type="number" placeholder="Punti G2" value={sOpponentScore} onChange={e => setSOpponentScore(e.target.value)} min="0" required />
                <select value={sPointsType} onChange={e => setSPointsType(e.target.value)} style={{ width: 'auto' }}>
                  <option value="21">21 pt</option>
                  <option value="11">11 pt</option>
                </select>
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
                <select value={dP1} onChange={e => setDP1(e.target.value)} required>
                  <option value="">Team 1 - G1</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={dP2} onChange={e => setDP2(e.target.value)} required>
                  <option value="">Team 1 - G2</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <span style={{ display: 'block', textAlign: 'center', fontWeight: 'bold', margin: '0.5rem 0', color: 'var(--accent-orange)' }}>VS</span>
              <div className="form-row">
                <select value={dP3} onChange={e => setDP3(e.target.value)} required>
                  <option value="">Team 2 - G1</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={dP4} onChange={e => setDP4(e.target.value)} required>
                  <option value="">Team 2 - G2</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <input type="number" placeholder="Punti Team 1" value={dScore1} onChange={e => setDScore1(e.target.value)} min="0" required />
                <input type="number" placeholder="Punti Team 2" value={dScore2} onChange={e => setDScore2(e.target.value)} min="0" required />
                <select value={dPointsType} onChange={e => setDPointsType(e.target.value)} style={{ width: 'auto' }}>
                  <option value="21">21 pt</option>
                  <option value="11">11 pt</option>
                </select>
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
                    const leftSide = isDouble ? `${m.p1_name} & ${m.p2_name}` : m.p1_name;
                    const rightSide = isDouble ? `${m.op1_name} & ${m.op2_name}` : m.op1_name;
                    return (
                      <tr key={m.id}>
                        <td>{new Date(m.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{m.points_type} pt</td>
                        <td>{leftSide} <span style={{ color: 'var(--accent-orange)' }}>vs</span> {rightSide}</td>
                        <td className="score">{m.t1_score} - {m.t2_score}</td>
                        <td><button className="delete-btn" onClick={() => deleteMatch(m.id, isDouble)}>Elimina</button></td>
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
                      <tr><th>Nome</th><th>BU</th><th>Eliminato il</th><th>Eliminato da</th><th>Azioni</th></tr>
                    </thead>
                    <tbody>
                      {trashData.players.map(p => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{p.bu}</td>
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
    </div>
  );
};

export default AdminDashboard;
