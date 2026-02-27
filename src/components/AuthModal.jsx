import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose }) => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', bu: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = isLogin 
        ? await login(formData.name, formData.password)
        : await register(formData.name, formData.bu, formData.password);

      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Qualcosa è andato storto. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>&times;</button>
        <h2>{isLogin ? 'Bentornato!' : 'Unisciti alla Lega'}</h2>
        <p className="subtitle">
          {isLogin ? 'Inserisci le credenziali per continuare' : 'Crea il tuo profilo per iniziare'}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Nome</label>
            <input 
              type="text" 
              placeholder="es. Marco S." 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              required 
            />
          </div>

          {!isLogin && (
            <div className="input-group">
              <label>Business Unit</label>
              <input 
                type="text" 
                placeholder="es. Engineering" 
                value={formData.bu}
                onChange={e => setFormData({...formData, bu: e.target.value})}
                required 
              />
            </div>
          )}

          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              required 
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Attendere...' : (isLogin ? 'Accedi' : 'Registrati')}
          </button>
        </form>

        <div className="switch-auth">
          {isLogin ? 'Non hai un account? ' : 'Hai già un account? '}
          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Registrati' : 'Accedi'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
