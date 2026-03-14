import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import MatchModal from './components/MatchModal'
import MatchHistory from './components/MatchHistory'
import AdminDashboard from './components/AdminDashboard'
import { useAuth } from './context/AuthContext'
import './Rankings.css'

function App() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overall')
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false)
  const { user } = useAuth()

  const fetchData = async () => {
    try {
      const [playersRes] = await Promise.all([
        fetch('/api/players')
      ])
      const playersData = await playersRes.json()
      setPlayers(Array.isArray(playersData) ? playersData : [])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) return <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><h1>Loading rankings...</h1></div>

  const playersOverall = [...players].sort((a, b) => b.score_overall - a.score_overall)
  const players1v1_21 = [...players].sort((a, b) => b.score_1v1_21 - a.score_1v1_21)
  const players1v1_11 = [...players].sort((a, b) => b.score_1v1_11 - a.score_1v1_11)

  const players2v2_21 = [...players].sort((a, b) => b.score_2v2_21 - a.score_2v2_21)
  const players2v2_11 = [...players].sort((a, b) => b.score_2v2_11 - a.score_2v2_11)

  return (
    <div className="app-wrapper">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="container">
        {!user && (
          <div className="welcome-banner">
            Benvenuto! Accedi o registrati per inserire le tue partite.
          </div>
        )}

        {user && activeTab !== 'admin' && (
          <div className="actions-header" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ margin: 0 }}>Classifica</h1>
            <button
              onClick={() => setIsMatchModalOpen(true)}
              className="submit-btn"
            >
              + Aggiungi Match
            </button>
          </div>
        )}

        {!user && activeTab !== 'admin' && (
          <div className="actions-header" style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ margin: 0 }}>Classifica</h1>
          </div>
        )}

        <div className="tab-content">
          {activeTab === 'overall' && (
            <section className="ranking-card full-width">
              <h2>Overall Ranking</h2>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>ELO</th>
                  </tr>
                </thead>
                <tbody>
                  {playersOverall.length > 0 ? playersOverall.map((p, i) => (
                    <tr key={p.id}>
                      <td><span className="rank-pill">{i + 1}</span></td>
                      <td>
                        <span className="player-name">{p.name} {p.id === user?.id && <span style={{ fontSize: '0.7rem', background: 'var(--accent-orange)', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>TU</span>}</span>
                        <span className="player-bu">{p.bu}</span>
                      </td>
                      <td className="score">{p.score_overall}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nessun giocatore registrato</td></tr>}
                </tbody>
              </table>
              <h2 style={{ marginTop: '2rem' }}>Storico Partite</h2>
              <MatchHistory />
            </section>
          )}

          {activeTab === '1v1_21' && (
            <section className="ranking-card full-width">
              <h2>1v1 (21 Punti)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>ELO</th>
                  </tr>
                </thead>
                <tbody>
                  {players1v1_21.length > 0 ? players1v1_21.map((p, i) => (
                    <tr key={p.id}>
                      <td><span className="rank-pill">{i + 1}</span></td>
                      <td>
                        <span className="player-name">{p.name} {p.id === user?.id && <span style={{ fontSize: '0.7rem', background: 'var(--accent-orange)', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>TU</span>}</span>
                        <span className="player-bu">{p.bu}</span>
                      </td>
                      <td className="score">{p.score_1v1_21}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nessun giocatore registrato</td></tr>}
                </tbody>
              </table>
              <h2 style={{ marginTop: '2rem' }}>Storico 1v1 (21)</h2>
              <MatchHistory matchType="singles" pointsType={21} />
            </section>
          )}

          {activeTab === '1v1_11' && (
            <section className="ranking-card full-width">
              <h2>1v1 (11 Punti)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>ELO</th>
                  </tr>
                </thead>
                <tbody>
                  {players1v1_11.length > 0 ? players1v1_11.map((p, i) => (
                    <tr key={p.id}>
                      <td><span className="rank-pill">{i + 1}</span></td>
                      <td>
                        <span className="player-name">{p.name} {p.id === user?.id && <span style={{ fontSize: '0.7rem', background: 'var(--accent-orange)', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>TU</span>}</span>
                        <span className="player-bu">{p.bu}</span>
                      </td>
                      <td className="score">{p.score_1v1_11}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nessun giocatore registrato</td></tr>}
                </tbody>
              </table>
              <h2 style={{ marginTop: '2rem' }}>Storico 1v1 (11)</h2>
              <MatchHistory matchType="singles" pointsType={11} />
            </section>
          )}

          {activeTab === '2v2_21' && (
            <section className="ranking-card full-width">
              <h2>2v2 (21 Punti)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>ELO</th>
                  </tr>
                </thead>
                <tbody>
                  {players2v2_21.length > 0 ? players2v2_21.map((p, i) => (
                    <tr key={p.id}>
                      <td><span className="rank-pill">{i + 1}</span></td>
                      <td>
                        <span className="player-name">{p.name} {p.id === user?.id && <span style={{ fontSize: '0.7rem', background: 'var(--accent-orange)', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>TU</span>}</span>
                        <span className="player-bu">{p.bu}</span>
                      </td>
                      <td className="score">{p.score_2v2_21}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nessun giocatore registrato</td></tr>}
                </tbody>
              </table>
              <h2 style={{ marginTop: '2rem' }}>Storico 2v2 (21)</h2>
              <MatchHistory matchType="doubles" pointsType={21} />
            </section>
          )}

          {activeTab === '2v2_11' && (
            <section className="ranking-card full-width">
              <h2>2v2 (11 Punti)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>ELO</th>
                  </tr>
                </thead>
                <tbody>
                  {players2v2_11.length > 0 ? players2v2_11.map((p, i) => (
                    <tr key={p.id}>
                      <td><span className="rank-pill">{i + 1}</span></td>
                      <td>
                        <span className="player-name">{p.name} {p.id === user?.id && <span style={{ fontSize: '0.7rem', background: 'var(--accent-orange)', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>TU</span>}</span>
                        <span className="player-bu">{p.bu}</span>
                      </td>
                      <td className="score">{p.score_2v2_11}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nessun giocatore registrato</td></tr>}
                </tbody>
              </table>
              <h2 style={{ marginTop: '2rem' }}>Storico 2v2 (11)</h2>
              <MatchHistory matchType="doubles" pointsType={11} />
            </section>
          )}

          {activeTab === 'admin' && user?.role === 'admin' && (
            <AdminDashboard players={players} onUpdate={fetchData} />
          )}
        </div>
      </div>

      <MatchModal
        isOpen={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
        players={players}
        onMatchAdded={fetchData}
      />
    </div>
  )
}

export default App
