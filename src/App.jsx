import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import MatchModal from './components/MatchModal'
import MatchHistory from './components/MatchHistory'
import AdminDashboard from './components/AdminDashboard'
import PlayerStats from './components/PlayerStats'
import GlobalStats from './components/GlobalStats'
import GlobalStatsPage from './components/GlobalStatsPage'
import NotificationBanner from './components/NotificationBanner'
import { useAuth } from './context/AuthContext'
import './Rankings.css'

function App() {
  const [players, setPlayers] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overall')
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false)
  const [showAllPlayers, setShowAllPlayers] = useState(false)
  const [statsPlayerId, setStatsPlayerId] = useState(null)
  const [notifications, setNotifications] = useState([])
  const { user, justLoggedIn, setJustLoggedIn } = useAuth()

  const fetchNotifications = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const fresh = await res.json()
        setNotifications(prev => {
          const prevIds = new Set(prev.map(n => n.id))
          const freshIds = new Set(fresh.map(n => n.id))
          // keep prev entries still on server, add new ones
          const merged = prev.filter(n => freshIds.has(n.id))
          fresh.forEach(n => { if (!prevIds.has(n.id)) merged.push(n) })
          return merged
        })
      }
    } catch {}
  }

  const dismissNotification = async (id) => {
    const token = localStorage.getItem('token')
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    } catch {}
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  // Switch to stats tab when user freshly logs in
  useEffect(() => {
    if (justLoggedIn && user) {
      setStatsPlayerId(user.id)
      setActiveTab('stats')
      setJustLoggedIn(false)
    }
  }, [justLoggedIn, user])

  // Fetch notifications whenever user becomes available (login or auto-auth from token)
  useEffect(() => {
    if (user) fetchNotifications()
  }, [user?.id])

  const fetchData = async () => {
    try {
      const [playersRes, historyRes] = await Promise.all([
        fetch('/api/players'),
        fetch('/api/matches/history?limit=200')
      ])
      const playersData = await playersRes.json()
      const historyData = await historyRes.json()
      setPlayers(Array.isArray(playersData) ? playersData : [])
      setMatches(Array.isArray(historyData.matches) ? historyData.matches : [])
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

  const totalGames = (p) => (p.games_1v1_21 || 0) + (p.games_1v1_11 || 0) + (p.games_2v2_21 || 0) + (p.games_2v2_11 || 0)

  const filterAndSort = (sortKey, gamesKey) => {
    const sorted = [...players].sort((a, b) => b[sortKey] - a[sortKey])
    if (showAllPlayers) return sorted
    return sorted.filter(p => (gamesKey ? (p[gamesKey] || 0) : totalGames(p)) > 0)
  }

  const isInactive = (p, gamesKey) => (gamesKey ? (p[gamesKey] || 0) : totalGames(p)) === 0

  const DeltaBadge = ({ value }) => {
    if (!value || Math.round(value) === 0) return null
    const rounded = Math.round(value)
    const isPositive = rounded > 0
    return (
      <span className={`delta-badge ${isPositive ? 'delta-up' : 'delta-down'}`}>
        {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{rounded}
      </span>
    )
  }

  // Compute rank position changes by comparing current vs previous (score - delta) rankings
  // Only considers active players (with games > 0) to avoid phantom changes from inactive ties
  const computeRankChanges = (currentList, scoreKey, deltaKey, gamesKey) => {
    // Filter to only active players for rank computation
    const activeList = currentList.filter(p => gamesKey ? (p[gamesKey] || 0) > 0 : totalGames(p) > 0)
    const withPrev = activeList.map(p => ({
      id: p.id,
      currentScore: p[scoreKey],
      prevScore: p[scoreKey] - (p[deltaKey] || 0),
      delta: p[deltaKey] || 0
    }))
    const prevSorted = [...withPrev].sort((a, b) => b.prevScore - a.prevScore)
    const prevRankMap = {}
    prevSorted.forEach((p, i) => { prevRankMap[p.id] = i + 1 })
    const currRankMap = {}
    activeList.forEach((p, i) => { currRankMap[p.id] = i + 1 })
    const changes = {}
    withPrev.forEach(p => {
      // Only show rank change if the player actually had an ELO change
      if (p.delta === 0) return
      const prev = prevRankMap[p.id] || currRankMap[p.id]
      const curr = currRankMap[p.id]
      changes[p.id] = prev - curr // positive = climbed
    })
    return changes
  }

  const RankDeltaBadge = ({ value }) => {
    if (!value || value === 0) return null
    const isPositive = value > 0
    return (
      <span className={`delta-badge ${isPositive ? 'delta-up' : 'delta-down'}`}>
        {isPositive ? '▲' : '▼'}{Math.abs(value)}
      </span>
    )
  }

  const EloDeltaBadge = ({ value }) => {
    if (!value || Math.round(value) === 0) return null
    const rounded = Math.round(value)
    const isPositive = rounded > 0
    return (
      <span className="delta-badge delta-elo">
        {isPositive ? '▲' : '▼'}{isPositive ? '+' : ''}{rounded}
      </span>
    )
  }

  const playersOverall = filterAndSort('score_overall', null)
  const players1v1_21 = filterAndSort('score_1v1_21', 'games_1v1_21')
  const players1v1_11 = filterAndSort('score_1v1_11', 'games_1v1_11')
  const players2v2_21 = filterAndSort('score_2v2_21', 'games_2v2_21')
  const players2v2_11 = filterAndSort('score_2v2_11', 'games_2v2_11')

  const rankChangesOverall = computeRankChanges(playersOverall, 'score_overall', 'last_delta_overall', null)
  const rankChanges1v1_21 = computeRankChanges(players1v1_21, 'score_1v1_21', 'last_delta_1v1_21', 'games_1v1_21')
  const rankChanges1v1_11 = computeRankChanges(players1v1_11, 'score_1v1_11', 'last_delta_1v1_11', 'games_1v1_11')
  const rankChanges2v2_21 = computeRankChanges(players2v2_21, 'score_2v2_21', 'last_delta_2v2_21', 'games_2v2_21')
  const rankChanges2v2_11 = computeRankChanges(players2v2_11, 'score_2v2_11', 'last_delta_2v2_11', 'games_2v2_11')

  const playerLabel = (p) => {
    if (!user) return ''
    if (user.company === 'DATA') return p.bu || p.company || ''
    return p.company || ''
  }

  const toggleIcon = (
    <button
      onClick={() => setShowAllPlayers(!showAllPlayers)}
      title={showAllPlayers ? 'Mostra solo giocatori attivi' : 'Mostra tutti i giocatori'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'inline-flex', alignItems: 'center', marginLeft: '8px', opacity: showAllPlayers ? 1 : 0.5 }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-dim)' }}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    </button>
  )

  const matchesAll = matches
  const matches1v1_21 = matches.filter(m => m.match_type === 'singles' && m.points_type === 21)
  const matches1v1_11 = matches.filter(m => m.match_type === 'singles' && m.points_type === 11)
  const matches2v2_21 = matches.filter(m => m.match_type === 'doubles' && m.points_type === 21)
  const matches2v2_11 = matches.filter(m => m.match_type === 'doubles' && m.points_type === 11)

  return (
    <div className="app-wrapper">
      <Header activeTab={activeTab} onTabChange={setActiveTab} onStatsClick={(id) => { setStatsPlayerId(id); setActiveTab('stats'); }} />

      <NotificationBanner notifications={notifications} onDismiss={dismissNotification} />

      <div className="container">
        {!user && (
          <div className="welcome-banner">
            Benvenuto! Accedi o registrati per visualizzare statistiche, storico partite e inserire i tuoi match.
          </div>
        )}

        {user && !user.approved && user.role !== 'admin' && (
          <div className="pending-banner">
            {"\u23F3"} Il tuo account è in attesa di approvazione da parte di un admin. Puoi inserire fino a 5 partite. Il tuo nome non apparirà in classifica fino all'approvazione.
          </div>
        )}

        {user && activeTab !== 'admin' && (
          <div className="actions-header" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ margin: 0 }}>Classifica</h1>
            <button
              onClick={() => setIsMatchModalOpen(true)}
              className="submit-btn"
              style={{ width: 'auto' }}
            >
              + Aggiungi Match
            </button>
            <div />
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
              <h2>Overall Ranking {toggleIcon}</h2>
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
                    <tr key={p.id} className={isInactive(p, null) ? 'inactive-player' : ''}>
                      <td><span className="rank-pill">{i + 1}</span></td>
                      <td>
                        <span className={`player-name${user ? ' clickable' : ''}`} onClick={user ? () => { setStatsPlayerId(p.id); setActiveTab('stats'); } : undefined}>{p.name} {p.id === user?.id && <span style={{ fontSize: '0.7rem', background: 'var(--accent-orange)', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>TU</span>}</span>
                        <RankDeltaBadge value={rankChangesOverall[p.id]} />
                        <EloDeltaBadge value={p.last_delta_overall} />
                        <span className="player-bu">{playerLabel(p)}</span>
                      </td>
                      <td className="score">{Math.round(p.score_overall)}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nessun giocatore registrato</td></tr>}
                </tbody>
              </table>
              {user && <><GlobalStats />
              <h2 style={{ marginTop: '2rem' }}>Ultime Partite</h2>
              <MatchHistory matches={matchesAll.slice(0, 5)} /></>}
            </section>
          )}

          {activeTab === '1v1_21' && (
            <section className="ranking-card full-width">
              <h2>1v1 (21 Punti) {toggleIcon}</h2>
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
                    <tr key={p.id} className={isInactive(p, 'games_1v1_21') ? 'inactive-player' : ''}>
                      <td><span className="rank-pill">{i + 1}</span></td>
                      <td>
                        <span className={`player-name${user ? ' clickable' : ''}`} onClick={user ? () => { setStatsPlayerId(p.id); setActiveTab('stats'); } : undefined}>{p.name} {p.id === user?.id && <span style={{ fontSize: '0.7rem', background: 'var(--accent-orange)', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>TU</span>}</span>
                        <RankDeltaBadge value={rankChanges1v1_21[p.id]} />
                        <EloDeltaBadge value={p.last_delta_1v1_21} />
                        <span className="player-bu">{playerLabel(p)}</span>
                      </td>
                      <td className="score">{Math.round(p.score_1v1_21)}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nessun giocatore registrato</td></tr>}
                </tbody>
              </table>
              {user && <><h2 style={{ marginTop: '2rem' }}>Storico 1v1 (21)</h2>
              <MatchHistory matches={matches1v1_21.slice(0, 5)} /></>}
            </section>
          )}

          {activeTab === '1v1_11' && (
            <section className="ranking-card full-width">
              <h2>1v1 (11 Punti) {toggleIcon}</h2>
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
                    <tr key={p.id} className={isInactive(p, 'games_1v1_11') ? 'inactive-player' : ''}>
                      <td><span className="rank-pill">{i + 1}</span></td>
                      <td>
                        <span className={`player-name${user ? ' clickable' : ''}`} onClick={user ? () => { setStatsPlayerId(p.id); setActiveTab('stats'); } : undefined}>{p.name} {p.id === user?.id && <span style={{ fontSize: '0.7rem', background: 'var(--accent-orange)', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>TU</span>}</span>
                        <RankDeltaBadge value={rankChanges1v1_11[p.id]} />
                        <EloDeltaBadge value={p.last_delta_1v1_11} />
                        <span className="player-bu">{playerLabel(p)}</span>
                      </td>
                      <td className="score">{Math.round(p.score_1v1_11)}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nessun giocatore registrato</td></tr>}
                </tbody>
              </table>
              {user && <><h2 style={{ marginTop: '2rem' }}>Storico 1v1 (11)</h2>
              <MatchHistory matches={matches1v1_11.slice(0, 5)} /></>}
            </section>
          )}

          {activeTab === '2v2_21' && (
            <section className="ranking-card full-width">
              <h2>2v2 (21 Punti) {toggleIcon}</h2>
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
                    <tr key={p.id} className={isInactive(p, 'games_2v2_21') ? 'inactive-player' : ''}>
                      <td><span className="rank-pill">{i + 1}</span></td>
                      <td>
                        <span className={`player-name${user ? ' clickable' : ''}`} onClick={user ? () => { setStatsPlayerId(p.id); setActiveTab('stats'); } : undefined}>{p.name} {p.id === user?.id && <span style={{ fontSize: '0.7rem', background: 'var(--accent-orange)', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>TU</span>}</span>
                        <RankDeltaBadge value={rankChanges2v2_21[p.id]} />
                        <EloDeltaBadge value={p.last_delta_2v2_21} />
                        <span className="player-bu">{playerLabel(p)}</span>
                      </td>
                      <td className="score">{Math.round(p.score_2v2_21)}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nessun giocatore registrato</td></tr>}
                </tbody>
              </table>
              {user && <><h2 style={{ marginTop: '2rem' }}>Storico 2v2 (21)</h2>
              <MatchHistory matches={matches2v2_21.slice(0, 5)} /></>}
            </section>
          )}

          {activeTab === '2v2_11' && (
            <section className="ranking-card full-width">
              <h2>2v2 (11 Punti) {toggleIcon}</h2>
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
                    <tr key={p.id} className={isInactive(p, 'games_2v2_11') ? 'inactive-player' : ''}>
                      <td><span className="rank-pill">{i + 1}</span></td>
                      <td>
                        <span className={`player-name${user ? ' clickable' : ''}`} onClick={user ? () => { setStatsPlayerId(p.id); setActiveTab('stats'); } : undefined}>{p.name} {p.id === user?.id && <span style={{ fontSize: '0.7rem', background: 'var(--accent-orange)', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>TU</span>}</span>
                        <RankDeltaBadge value={rankChanges2v2_11[p.id]} />
                        <EloDeltaBadge value={p.last_delta_2v2_11} />
                        <span className="player-bu">{playerLabel(p)}</span>
                      </td>
                      <td className="score">{Math.round(p.score_2v2_11)}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center' }}>Nessun giocatore registrato</td></tr>}
                </tbody>
              </table>
              {user && <><h2 style={{ marginTop: '2rem' }}>Storico 2v2 (11)</h2>
              <MatchHistory matches={matches2v2_11.slice(0, 5)} /></>}
            </section>
          )}

          {activeTab === 'stats' && statsPlayerId && user && (
            <PlayerStats playerId={statsPlayerId} players={players} onClose={() => { setStatsPlayerId(null); setActiveTab('overall'); }} />
          )}

          {activeTab === 'global-stats' && user && (
            <GlobalStatsPage />
          )}

          {activeTab === 'admin' && user?.role === 'admin' && (
            <AdminDashboard players={players} onUpdate={() => { fetchData(); fetchNotifications(); }} />
          )}
        </div>
      </div>

      <MatchModal
        isOpen={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
        players={players}
        onMatchAdded={() => { fetchData(); fetchNotifications(); }}
      />
    </div>
  )
}

export default App
