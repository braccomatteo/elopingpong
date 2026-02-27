import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import MatchModal from './components/MatchModal'
import AdminDashboard from './components/AdminDashboard'
import { useAuth } from './context/AuthContext'
import './Rankings.css'

function App() {
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('singles21')
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false)
  const { user } = useAuth()

  const fetchData = async () => {
    try {
      const [playersRes, teamsRes] = await Promise.all([
        fetch('/api/players'),
        fetch('/api/team-matches/teams')
      ])
      const playersData = await playersRes.json()
      const teamsData = await teamsRes.json()
      setPlayers(playersData)
      setTeams(teamsData)
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

  const players21 = [...players].sort((a, b) => b.score_21 - a.score_21)
  const sortedTeams = [...teams].sort((a, b) => b.score_21 - a.score_21)

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
          {activeTab === 'singles21' && (
            <section className="ranking-card full-width">
              <h2>Singles (21 pts)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>ELO</th>
                  </tr>
                </thead>
                <tbody>
                  {players21.length > 0 ? players21.map((p, i) => (
                    <tr key={p.id}>
                      <td><span className="rank-pill">{i + 1}</span></td>
                      <td>
                        <span className="player-name">{p.name} {p.id === user?.id && <span style={{ fontSize: '0.7rem', background: 'var(--accent-orange)', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>TU</span>}</span>
                        <span className="player-bu">{p.bu}</span>
                      </td>
                      <td className="score">{p.score_21}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nessun giocatore registrato</td></tr>}
                </tbody>
              </table>
            </section>
          )}

          {activeTab === 'doubles' && (
            <section className="ranking-card full-width">
              <h2>Doubles (21 pts)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>ELO</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeams.length > 0 ? sortedTeams.map((t, i) => (
                    <tr key={t.id}>
                      <td><span className="rank-pill">{i + 1}</span></td>
                      <td>
                        <div className="player-name">{t.p1_name} & {t.p2_name}</div>
                      </td>
                      <td className="score">{t.score_21}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nessun team registrato</td></tr>}
                </tbody>
              </table>
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
