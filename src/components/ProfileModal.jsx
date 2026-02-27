import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './ProfileModal.css';

const ProfileModal = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [bu, setBu] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name && !bu && !password) {
      setError('Modifica almeno un campo.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const body = {};
      if (name) body.name = name;
      if (bu) body.bu = bu;
      if (password) body.password = password;

      const result = await updateProfile(body);
      if (result.success) {
        setSuccess('Profilo aggiornato!');
        setName('');
        setBu('');
        setPassword('');
        setTimeout(() => {
          setSuccess('');
          onClose();
        }, 1200);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Errore durante l\'aggiornamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>&times;</button>
        <h2>Modifica Profilo</h2>
        <p className="subtitle">Modifica solo i campi che vuoi aggiornare</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Nome</label>
            <input 
              type="text" 
              placeholder={user.name}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Business Unit</label>
            <input 
              type="text" 
              placeholder={user.bu || 'La tua BU'}
              value={bu}
              onChange={e => setBu(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Nuova Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Aggiornamento...' : 'Salva Modifiche'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;
