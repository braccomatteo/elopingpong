import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './MatchModal.css';

const MatchModal = ({ isOpen, onClose, players, onMatchAdded }) => {
  const { user } = useAuth();
  const [opponentId, setOpponentId] = useState('');
  const [creatorScore, setCreatorScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!opponentId || creatorScore === '' || opponentScore === '') {
      setError('Inserisci tutti i dati richiesti.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3000/api/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          opponent_id: opponentId,
          creator_score: parseInt(creatorScore),
          opponent_score: parseInt(opponentScore)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante il salvataggio');
      }

      onMatchAdded();
      onClose();
      // Reset form
      setOpponentId('');
      setCreatorScore('');
      setOpponentScore('');
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
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Avversario</label>
            <select value={opponentId} onChange={(e) => setOpponentId(e.target.value)} required>
              <option value="">Seleziona un giocatore</option>
              {filteredPlayers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Punteggio (Tu vs Avversario)</label>
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
            {loading ? 'Salvataggio...' : 'Salva Match'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MatchModal;
