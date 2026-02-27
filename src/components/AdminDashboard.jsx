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
  const [matches, setMatches] = useState([]);
  const [matchPage, setMatchPage] = useState(1);
  const [matchTotalPages, setMatchTotalPages] = useState(1);
  const [sCreatorId, setSCreatorId] = useState('');
  const [sOpponentId, setSOpponentId] = useState('');
  const [sCreatorScore, setSCreatorScore] = useState('');
  const [sOpponentScore, setSOpponentScore] = useState('');
  const [singlesError, setSinglesError] = useState('');

  /* ---- Doubles state ---- */
  const [teamMatches, setTeamMatches] = useState([]);
  const [tmPage, setTmPage] = useState(1);
  const [tmTotalPages, setTmTotalPages] = useState(1);
  const [dP1, setDP1] = useState('');
  const [dP2, setDP2] = useState('');
  const [dP3, setDP3] = useState('');
  const [dP4, setDP4] = useState('');
  const [dScore1, setDScore1] = useState('');
  const [dScore2, setDScore2] = useState('');
  const [doublesError, setDoublesError] = useState('');

  const [loading, setLoading] = useState(true);

  /* ---- Fetch functions ---- */
  const fetchPlayers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/players');
      setPlayerList(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchMatches = async (page = 1) => {
    try {
      const res = await fetch(`http://localhost:3000/api/matches/all?page=${page}&limit=${LIMIT}`, { headers: headers() });
      const data = await res.json();
      setMatches(data.matches || []);
      setMatchTotalPages(data.totalPages || 1);
      setMatchPage(data.page || 1);
    } catch (err) { console.error(err); }
  };

  const fetchTeamMatches = async (page = 1) => {
    try {
      const res = await fetch(`http://localhost:3000/api/team-matches/all?page=${page}&limit=${LIMIT}`, { headers: headers() });
      const data = await res.json();
      setTeamMatches(data.matches || []);
      setTmTotalPages(data.totalPages || 1);
      setTmPage(data.page || 1);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    Promise.all([fetchPlayers(), fetchMatches(), fetchTeamMatches()]).finally(() => setLoading(false));
  }, []);

  /* ---- Delete handlers ---- */
  const deletePlayer = async (id) => {
    if (!window.confirm('Eliminare questo giocatore e tutti i suoi match?')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/players/${id}`, { method: 'DELETE', headers: headers() });
      if (res.ok) { fetchPlayers(); onUpdate(); }
    } catch (err) { console.error(err); }
  };

  const deleteMatch = async (id) => {
    if (!window.confirm('Eliminare questo match? I punteggi verranno ricalcolati.')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/matches/${id}`, { method: 'DELETE', headers: headers() });
      if (res.ok) { fetchMatches(matchPage); onUpdate(); }
    } catch (err) { console.error(err); }
  };

  const deleteTeamMatch = async (id) => {
    if (!window.confirm('Eliminare questo match doppio? I punteggi verranno ricalcolati.')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/team-matches/${id}`, { method: 'DELETE', headers: headers() });
      if (res.ok) { fetchTeamMatches(tmPage); onUpdate(); }
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
      const res = await fetch('http://localhost:3000/api/matches/admin', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ creator_id: sCreatorId, opponent_id: sOpponentId, creator_score: parseInt(sCreatorScore), opponent_score: parseInt(sOpponentScore) })
      });
      if (res.ok) {
        setSCreatorId(''); setSOpponentId(''); setSCreatorScore(''); setSOpponentScore(''); setSinglesError('');
        fetchMatches(1); onUpdate();
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
      const res = await fetch('http://localhost:3000/api/team-matches', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          p1_id: dP1, p2_id: dP2,
          op1_id: dP3, op2_id: dP4,
          team_score: parseInt(dScore1), opponent_score: parseInt(dScore2)
        })
      });
      if (res.ok) {
        setDP1(''); setDP2(''); setDP3(''); setDP4(''); setDScore1(''); setDScore2(''); setDoublesError('');
        fetchTeamMatches(1); onUpdate();
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
          Partite 21
        </button>
        <button className={`admin-tab-btn ${adminTab === 'doubles' ? 'active' : ''}`} onClick={() => setAdminTab('doubles')}>
          Partite Doppie
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
                <tr><th>Nome</th><th>BU</th><th>ELO</th><th>Azioni</th></tr>
              </thead>
              <tbody>
                {playerList.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.bu}</td>
                    <td className="score">{p.score_21}</td>
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
              </div>
              <button type="submit" className="submit-btn">Registra Match</button>
            </form>
          </section>

          <section className="ranking-card" style={{ marginTop: '1.5rem' }}>
            <h2>Storico Partite Singolo</h2>
            {matches.length === 0 ? (
              <div className="empty-state">Nessuna partita registrata.</div>
            ) : (
              <>
                <table className="admin-table">
                  <thead>
                    <tr><th>Data</th><th>Giocatori</th><th>Risultato</th><th>Azioni</th></tr>
                  </thead>
                  <tbody>
                    {matches.map(m => (
                      <tr key={m.id}>
                        <td>{new Date(m.created_at).toLocaleDateString()}</td>
                        <td>{m.creator_name} vs {m.opponent_name}</td>
                        <td className="score">{m.creator_score} - {m.opponent_score}</td>
                        <td><button className="delete-btn" onClick={() => deleteMatch(m.id)}>Elimina</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={matchPage} totalPages={matchTotalPages} onPageChange={(p) => fetchMatches(p)} />
              </>
            )}
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
              </div>
              <button type="submit" className="submit-btn">Registra Match Doppio</button>
            </form>
          </section>

          <section className="ranking-card" style={{ marginTop: '1.5rem' }}>
            <h2>Storico Partite Doppie</h2>
            {teamMatches.length === 0 ? (
              <div className="empty-state">Nessuna partita doppia registrata.</div>
            ) : (
              <>
                <table className="admin-table">
                  <thead>
                    <tr><th>Data</th><th>Team 1</th><th>Team 2</th><th>Risultato</th><th>Azioni</th></tr>
                  </thead>
                  <tbody>
                    {teamMatches.map(m => (
                      <tr key={m.id}>
                        <td>{new Date(m.created_at).toLocaleDateString()}</td>
                        <td>{m.t1_p1_name} & {m.t1_p2_name}</td>
                        <td>{m.t2_p1_name} & {m.t2_p2_name}</td>
                        <td className="score">{m.team_score} - {m.opponent_score}</td>
                        <td><button className="delete-btn" onClick={() => deleteTeamMatch(m.id)}>Elimina</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={tmPage} totalPages={tmTotalPages} onPageChange={(p) => fetchTeamMatches(p)} />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
