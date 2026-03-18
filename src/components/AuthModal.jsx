import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import CustomSelect from './CustomSelect';
import './CustomSelect.css';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose }) => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', company: '', bu: '', password: '' });
  const [isNewCompany, setIsNewCompany] = useState(false);
  const [customCompany, setCustomCompany] = useState('');
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && !isLogin) {
      fetch('/api/companies').then(r => r.json()).then(data => {
        if (Array.isArray(data)) setCompanies(data);
      }).catch(() => {});
    }
  }, [isOpen, isLogin]);

  if (!isOpen) return null;

  const selectedCompany = companies.find(c => c.name === formData.company);
  const selectedCompanyBus = selectedCompany?.bus || [];

  const handleCompanyChange = (value) => {
    if (value === '__new__') {
      setIsNewCompany(true);
      setCustomCompany('');
      setFormData({ ...formData, company: '', bu: '' });
    } else {
      setIsNewCompany(false);
      setCustomCompany('');
      setFormData({ ...formData, company: value, bu: '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const company = isNewCompany ? customCompany.trim().toUpperCase() : formData.company;
    const bu = formData.bu;

    if (!isLogin && !company) {
      setError('Seleziona o inserisci una company.');
      return;
    }

    setLoading(true);

    try {
      const result = isLogin
        ? await login(formData.name, formData.password)
        : await register(formData.name, company, bu, formData.password);

      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Qualcosa \u00e8 andato storto. Riprova.');
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
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {!isLogin && (
            <>
              <div className="input-group">
                <label>Company</label>
                <CustomSelect
                  value={isNewCompany ? '__new__' : formData.company}
                  onChange={handleCompanyChange}
                  placeholder="Seleziona una company"
                  options={[
                    ...companies.map(c => ({ value: c.name, label: c.name })),
                    { value: '__new__', label: '+ Aggiungi Company...', special: true }
                  ]}
                />
              </div>

              {isNewCompany && (
                <div className="input-group slide-in">
                  <label>Nome Company</label>
                  <input
                    type="text"
                    placeholder="es. Acme Corp"
                    value={customCompany}
                    onChange={e => setCustomCompany(e.target.value)}
                    required
                  />
                </div>
              )}

              {formData.company && selectedCompanyBus.length > 0 && (
                <div className="input-group slide-in">
                  <label>Business Unit</label>
                  <CustomSelect
                    value={formData.bu}
                    onChange={v => setFormData({ ...formData, bu: v })}
                    placeholder="Seleziona una BU (opzionale)"
                    options={selectedCompanyBus.map(bu => ({ value: bu, label: bu }))}
                  />
                </div>
              )}
            </>
          )}

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Attendere...' : (isLogin ? 'Accedi' : 'Registrati')}
          </button>
        </form>

        <div className="switch-auth">
          {isLogin ? 'Non hai un account? ' : 'Hai gi\u00e0 un account? '}
          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Registrati' : 'Accedi'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
