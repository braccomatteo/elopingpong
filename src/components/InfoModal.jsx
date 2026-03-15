import React from 'react';
import './InfoModal.css';

const InfoModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="info-overlay" onClick={onClose}>
      <div className="info-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>&times;</button>
        <h2>Come funziona il ranking</h2>

        <div className="info-content">
          <section>
            <h3>Sistema Elo</h3>
            <p>Il punteggio di ogni giocatore inizia a <strong>1000</strong>. Dopo ogni partita, i punti vengono ricalcolati in base alla forza dell'avversario: battere un giocatore più forte dà più punti, battere uno più debole ne dà meno.</p>
          </section>

          <section>
            <h3>Formula</h3>
            <p>Il risultato atteso è calcolato come:</p>
            <div className="formula">E = 1 / (1 + 10<sup>(Rating_avv - Rating_tuo) / 400</sup>)</div>
            <p>Il cambio di punteggio è:</p>
            <div className="formula">Δ = K × (risultato − E) × moltiplicatore</div>
          </section>

          <section>
            <h3>Fattore K</h3>
            <p>Il fattore K determina quanto velocemente cambia il tuo punteggio. Parte da <strong>32</strong> alla prima partita e scende di 1 per ogni partita giocata, fino a un minimo di <strong>16</strong>. Questo permette ai nuovi giocatori di posizionarsi rapidamente.</p>
            <p>Il K è <strong>globale</strong>: ogni partita giocata (singolo o doppio, 21 o 11) conta per il decadimento.</p>
          </section>

          <section>
            <h3>Moltiplicatore margine</h3>
            <p>Vincere con un margine più ampio dà un piccolo bonus (fino al <strong>+10%</strong>). Il calcolo è logaritmico, quindi la differenza tra 21-5 e 21-0 è minima.</p>
            <p>Il moltiplicatore si applica simmetricamente: chi perde con un margine ampio perde leggermente di più.</p>
          </section>

          <section>
            <h3>Doppio (2v2)</h3>
            <p>Nel doppio, il punteggio atteso è la media delle 4 combinazioni incrociate tra giocatori. Ogni giocatore usa il proprio K individuale — non viene mediato.</p>
          </section>

          <section>
            <h3>Classifica Overall</h3>
            <p>Il punteggio Overall è una media pesata delle 4 categorie:</p>
            <table className="weights-table">
              <thead>
                <tr><th>Categoria</th><th>Peso</th></tr>
              </thead>
              <tbody>
                <tr><td>1v1 (21 punti)</td><td><strong>40%</strong></td></tr>
                <tr><td>1v1 (11 punti)</td><td><strong>30%</strong></td></tr>
                <tr><td>2v2 (21 punti)</td><td><strong>20%</strong></td></tr>
                <tr><td>2v2 (11 punti)</td><td><strong>10%</strong></td></tr>
              </tbody>
            </table>
            <p>Le categorie non giocate restano a 1000 (neutre). Chi gioca più categorie e va bene in tutte ha un vantaggio nell'Overall.</p>
          </section>

          <section>
            <h3>Punteggio minimo</h3>
            <p>Il punteggio non può scendere sotto <strong>0</strong> in nessuna categoria.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
