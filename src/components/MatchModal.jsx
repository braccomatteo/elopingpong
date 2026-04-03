import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import CustomSelect from './CustomSelect';
import './CustomSelect.css';
import './MatchModal.css';

const MatchModal = ({ isOpen, onClose, players, onMatchAdded }) => {
  const { user } = useAuth();
  const [opponentId, setOpponentId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [opponent2Id, setOpponent2Id] = useState('');
  const [creatorScore, setCreatorScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  const [matchType, setMatchType] = useState('Singolo');
  const [pointsType, setPointsType] = useState('21');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [matchCount, setMatchCount] = useState(1);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (matchType === 'Singolo') {
      if (!opponentId || creatorScore === '' || opponentScore === '') {
        setError('Inserisci tutti i dati richiesti.');
        return;
      }
    } else {
      if (!opponentId || !partnerId || !opponent2Id || creatorScore === '' || opponentScore === '') {
        setError('Inserisci tutti i dati richiesti per entrambe le squadre.');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const isDoubles = matchType === 'Doppio';
      const endpoint = isDoubles ? '/api/team-matches' : '/api/matches';

      const payload = isDoubles ? {
        p1_id: user.id,
        p2_id: partnerId,
        op1_id: opponentId,
        op2_id: opponent2Id,
        team_score: parseInt(creatorScore),
        opponent_score: parseInt(opponentScore),
        points_type: parseInt(pointsType)
      } : {
        opponent_id: opponentId,
        creator_score: parseInt(creatorScore),
        opponent_score: parseInt(opponentScore),
        points_type: parseInt(pointsType)
      };

      const count = showBulk ? Math.max(1, Math.min(matchCount, 50)) : 1;

      for (let i = 0; i < count; i++) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Errore al match ${i + 1} di ${count}`);
        }
      }

      onMatchAdded();
      onClose();
      // Reset form
      setOpponentId('');
      setPartnerId('');
      setOpponent2Id('');
      setCreatorScore('');
      setOpponentScore('');
      setMatchType('Singolo');
      setPointsType('21');
      setShowBulk(false);
      setMatchCount(1);
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
        <div className="modal-header">
          <h2>Aggiungi Match</h2>
          <div className="modal-header-actions">
            <button
              type="button"
              className={`bulk-toggle-btn${showBulk ? ' active' : ''}`}
              title="Aggiungi più match"
              onClick={() => { setShowBulk(v => !v); setMatchCount(1); }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="2" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/>
                <rect x="5" y="6" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/>
              </svg>
            </button>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
        </div>

        {showBulk && (
          <div className="bulk-input-row">
            <label>Numero match</label>
            <input
              type="number"
              min="1"
              max="50"
              value={matchCount}
              onChange={(e) => setMatchCount(parseInt(e.target.value) || 1)}
            />
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tipo</label>
            <CustomSelect
              value={matchType}
              onChange={(v) => { setMatchType(v); setOpponentId(''); setPartnerId(''); setOpponent2Id(''); }}
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

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Salvataggio...' : showBulk && matchCount > 1 ? `Salva ${matchCount} Match` : 'Salva Match'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MatchModal;
