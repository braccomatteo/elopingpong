import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import CustomSelect from './CustomSelect';
import './CustomSelect.css';
import './MatchModal.css';

const emptyMatch = () => ({ creatorScore: '', opponentScore: '' });

const MatchModal = ({ isOpen, onClose, players, onMatchAdded }) => {
  const { user } = useAuth();
  // Single match state
  const [opponentId, setOpponentId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [opponent2Id, setOpponent2Id] = useState('');
  const [creatorScore, setCreatorScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  // Shared
  const [matchType, setMatchType] = useState('Singolo');
  const [pointsType, setPointsType] = useState('21');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [duplicatePending, setDuplicatePending] = useState(null); // payload to retry with force
  // Bulk
  const [showBulk, setShowBulk] = useState(false);
  const [matchCount, setMatchCount] = useState(2);
  const [bulkMatches, setBulkMatches] = useState([emptyMatch(), emptyMatch()]);

  useEffect(() => {
    if (isOpen) {
      setOpponentId('');
      setPartnerId('');
      setOpponent2Id('');
      setCreatorScore('');
      setOpponentScore('');
      setMatchType('Singolo');
      setPointsType('21');
      setError('');
      setShowBulk(false);
      setMatchCount(2);
      setBulkMatches([emptyMatch(), emptyMatch()]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMatchCountChange = (val) => {
    const n = Math.max(1, Math.min(val || 1, 20));
    setMatchCount(n);
    setBulkMatches(prev => {
      const arr = [...prev];
      while (arr.length < n) arr.push(emptyMatch());
      return arr.slice(0, n);
    });
  };

  const updateBulkMatch = (i, field, value) => {
    setBulkMatches(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isDoubles = matchType === 'Doppio';
    const endpoint = isDoubles ? '/api/team-matches' : '/api/matches';

    if (!showBulk) {
      if (isDoubles) {
        if (!opponentId || !partnerId || !opponent2Id || creatorScore === '' || opponentScore === '') {
          setError('Inserisci tutti i dati richiesti per entrambe le squadre.');
          return;
        }
      } else {
        if (!opponentId || creatorScore === '' || opponentScore === '') {
          setError('Inserisci tutti i dati richiesti.');
          return;
        }
      }
    } else {
      if (isDoubles) {
        if (!opponentId || !partnerId || !opponent2Id) {
          setError('Inserisci tutti i giocatori.');
          return;
        }
      } else {
        if (!opponentId) {
          setError('Seleziona un avversario.');
          return;
        }
      }
      for (let i = 0; i < bulkMatches.length; i++) {
        const m = bulkMatches[i];
        if (m.creatorScore === '' || m.opponentScore === '') {
          setError(`Inserisci il punteggio per il match #${i + 1}.`);
          return;
        }
      }
    }

    setLoading(true);
    setError('');

    try {
      const matches = showBulk
        ? bulkMatches
        : [{ creatorScore, opponentScore }];

      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        const payload = isDoubles ? {
          p1_id: user.id,
          p2_id: partnerId,
          op1_id: opponentId,
          op2_id: opponent2Id,
          team_score: parseInt(m.creatorScore),
          opponent_score: parseInt(m.opponentScore),
          points_type: parseInt(pointsType)
        } : {
          opponent_id: opponentId,
          creator_score: parseInt(m.creatorScore),
          opponent_score: parseInt(m.opponentScore),
          points_type: parseInt(pointsType)
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.status === 409 && data.duplicate) {
          setDuplicatePending({ endpoint, payload, index: i, total: matches.length });
          setLoading(false);
          return;
        }
        if (!response.ok) {
          throw new Error(data.error || `Errore al match #${i + 1}`);
        }
      }

      onMatchAdded();
      onClose();
      setOpponentId('');
      setPartnerId('');
      setOpponent2Id('');
      setCreatorScore('');
      setOpponentScore('');
      setMatchType('Singolo');
      setPointsType('21');
      setShowBulk(false);
      setMatchCount(2);
      setBulkMatches([emptyMatch(), emptyMatch()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForceSubmit = async () => {
    if (!duplicatePending) return;
    const { endpoint, payload, index, total } = duplicatePending;
    setDuplicatePending(null);
    setLoading(true);
    try {
      // Submit the duplicate match with force flag
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ ...payload, force: true })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Continue submitting remaining matches after the duplicate
      const matches = showBulk ? bulkMatches : [{ creatorScore, opponentScore }];
      const isDoubles = matchType === 'Doppio';
      for (let i = index + 1; i < total; i++) {
        const m = matches[i];
        const nextPayload = isDoubles ? {
          p1_id: user.id,
          p2_id: partnerId,
          op1_id: opponentId,
          op2_id: opponent2Id,
          team_score: parseInt(m.creatorScore),
          opponent_score: parseInt(m.opponentScore),
          points_type: parseInt(pointsType)
        } : {
          opponent_id: opponentId,
          creator_score: parseInt(m.creatorScore),
          opponent_score: parseInt(m.opponentScore),
          points_type: parseInt(pointsType)
        };

        const nextRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(nextPayload)
        });
        const nextData = await nextRes.json();
        if (nextRes.status === 409 && nextData.duplicate) {
          setDuplicatePending({ endpoint, payload: nextPayload, index: i, total });
          setLoading(false);
          return;
        }
        if (!nextRes.ok) throw new Error(nextData.error || `Errore al match #${i + 1}`);
      }

      onMatchAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipDuplicate = async () => {
    if (!duplicatePending) return;
    const { endpoint, index, total } = duplicatePending;
    setDuplicatePending(null);
    setLoading(true);
    try {
      const matches = showBulk ? bulkMatches : [{ creatorScore, opponentScore }];
      const isDoubles = matchType === 'Doppio';
      for (let i = index + 1; i < total; i++) {
        const m = matches[i];
        const nextPayload = isDoubles ? {
          p1_id: user.id,
          p2_id: partnerId,
          op1_id: opponentId,
          op2_id: opponent2Id,
          team_score: parseInt(m.creatorScore),
          opponent_score: parseInt(m.opponentScore),
          points_type: parseInt(pointsType)
        } : {
          opponent_id: opponentId,
          creator_score: parseInt(m.creatorScore),
          opponent_score: parseInt(m.opponentScore),
          points_type: parseInt(pointsType)
        };
        const nextRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(nextPayload)
        });
        const nextData = await nextRes.json();
        if (nextRes.status === 409 && nextData.duplicate) {
          setDuplicatePending({ endpoint, payload: nextPayload, index: i, total });
          setLoading(false);
          return;
        }
        if (!nextRes.ok) throw new Error(nextData.error || `Errore al match #${i + 1}`);
      }
      onMatchAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(p => p.id !== user?.id);

  return (
    <div className="match-overlay">
      <div className="match-modal">
        {duplicatePending && (
          <div className="duplicate-warning">
            <p>⚠️ Questo match sembra già esistere oggi. Registrarlo comunque?</p>
            <div className="duplicate-warning-actions">
              <button className="btn-confirm" onClick={handleForceSubmit}>Sì, registra</button>
              <button className="btn-cancel" onClick={handleSkipDuplicate}>Salta</button>
            </div>
          </div>
        )}
        <div className="modal-header">
          <h2>Aggiungi Match</h2>
          <div className="modal-header-actions">
            <button
              type="button"
              className={`bulk-toggle-btn${showBulk ? ' active' : ''}`}
              title="Aggiungi più match"
              onClick={() => setShowBulk(v => !v)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="1" y="5.5" fontSize="4.5" fontWeight="700" fill="currentColor" fontFamily="monospace">1</text>
                <line x1="5.5" y1="4" x2="15" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <text x="1" y="9.5" fontSize="4.5" fontWeight="700" fill="currentColor" fontFamily="monospace">2</text>
                <line x1="5.5" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <text x="1" y="13.5" fontSize="4.5" fontWeight="700" fill="currentColor" fontFamily="monospace">3</text>
                <line x1="5.5" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tipo</label>
            <CustomSelect
              value={matchType}
              onChange={(v) => {
                setMatchType(v);
                setOpponentId(''); setPartnerId(''); setOpponent2Id('');
                setBulkMatches(prev => prev.map(() => emptyMatch()));
              }}
              placeholder="Tipo"
              options={[{ value: 'Singolo', label: 'Singolo' }, { value: 'Doppio', label: 'Doppio' }]}
            />
          </div>

          <div className="form-group">
            <label>Punti</label>
            <CustomSelect
              value={pointsType}
              onChange={setPointsType}
              placeholder="Punti"
              options={[{ value: '21', label: '21' }, { value: '11', label: '11' }]}
            />
          </div>

          {!showBulk ? (
            <>
              {matchType === 'Singolo' ? (
                <div className="form-group">
                  <label>Avversario</label>
                  <CustomSelect
                    value={opponentId}
                    onChange={setOpponentId}
                    placeholder="Seleziona un giocatore"
                    options={filteredPlayers.map(p => ({ value: p.id, label: p.name }))}
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Tuo Compagno</label>
                    <CustomSelect
                      value={partnerId}
                      onChange={setPartnerId}
                      placeholder="Seleziona il tuo compagno"
                      options={filteredPlayers.filter(p => p.id !== opponentId && p.id !== opponent2Id).map(p => ({ value: p.id, label: p.name }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Avversario 1</label>
                    <CustomSelect
                      value={opponentId}
                      onChange={setOpponentId}
                      placeholder="Seleziona avversario 1"
                      options={filteredPlayers.filter(p => p.id !== partnerId && p.id !== opponent2Id).map(p => ({ value: p.id, label: p.name }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Avversario 2</label>
                    <CustomSelect
                      value={opponent2Id}
                      onChange={setOpponent2Id}
                      placeholder="Seleziona avversario 2"
                      options={filteredPlayers.filter(p => p.id !== partnerId && p.id !== opponentId).map(p => ({ value: p.id, label: p.name }))}
                    />
                  </div>
                </>
              )}
              <div className="form-group">
                <label>Punteggio ({matchType === 'Singolo' ? 'Tu vs Avversario' : 'Voi vs Loro'})</label>
                <div className="score-inputs">
                  <input
                    type="number"
                    placeholder="Tu"
                    value={creatorScore}
                    onChange={(e) => setCreatorScore(e.target.value)}
                    min="0"
                    required
                  />
                  <span>-</span>
                  <input
                    type="number"
                    placeholder="Lui"
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(e.target.value)}
                    min="0"
                    required
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bulk-count-row">
                <label>Numero match</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={matchCount}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { setMatchCount(''); return; }
                    handleMatchCountChange(parseInt(raw));
                  }}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value);
                    handleMatchCountChange(isNaN(n) ? 1 : n);
                  }}
                />
              </div>

              {matchType === 'Singolo' ? (
                <div className="form-group">
                  <label>Avversario</label>
                  <CustomSelect
                    value={opponentId}
                    onChange={setOpponentId}
                    placeholder="Seleziona un giocatore"
                    options={filteredPlayers.map(p => ({ value: p.id, label: p.name }))}
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Tuo Compagno</label>
                    <CustomSelect
                      value={partnerId}
                      onChange={setPartnerId}
                      placeholder="Seleziona il tuo compagno"
                      options={filteredPlayers.filter(p => p.id !== opponentId && p.id !== opponent2Id).map(p => ({ value: p.id, label: p.name }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Avversario 1</label>
                    <CustomSelect
                      value={opponentId}
                      onChange={setOpponentId}
                      placeholder="Seleziona avversario 1"
                      options={filteredPlayers.filter(p => p.id !== partnerId && p.id !== opponent2Id).map(p => ({ value: p.id, label: p.name }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Avversario 2</label>
                    <CustomSelect
                      value={opponent2Id}
                      onChange={setOpponent2Id}
                      placeholder="Seleziona avversario 2"
                      options={filteredPlayers.filter(p => p.id !== partnerId && p.id !== opponentId).map(p => ({ value: p.id, label: p.name }))}
                    />
                  </div>
                </>
              )}

              <div className="bulk-matches-list">
                {bulkMatches.map((m, i) => (
                  <div key={i} className="bulk-match-card">
                    <div className="bulk-match-num">#{i + 1}</div>
                    <div className="form-group">
                      <div className="score-inputs">
                        <input
                          type="number"
                          placeholder="Tu"
                          value={m.creatorScore}
                          onChange={(e) => updateBulkMatch(i, 'creatorScore', e.target.value)}
                          min="0"
                        />
                        <span>-</span>
                        <input
                          type="number"
                          placeholder="Lui"
                          value={m.opponentScore}
                          onChange={(e) => updateBulkMatch(i, 'opponentScore', e.target.value)}
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Salvataggio...' : showBulk ? `Salva ${matchCount} Match` : 'Salva Match'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MatchModal;
