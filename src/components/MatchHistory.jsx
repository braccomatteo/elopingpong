import React, { useState, useEffect } from 'react';
import Pagination from './Pagination';

const LIMIT = 20;

const MatchHistory = ({ matchType, pointsType }) => {
  const [matches, setMatches] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async (p = 1) => {
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (matchType) params.set('match_type', matchType);
      if (pointsType) params.set('points_type', pointsType);

      const res = await fetch(`/api/matches/history?${params}`);
      const data = await res.json();
      setMatches(data.matches || []);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || 1);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchHistory(1);
  }, [matchType, pointsType]);

  if (loading) return <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.6 }}>Caricamento storico...</div>;

  if (matches.length === 0) return <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.6 }}>Nessun match registrato.</div>;

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Sfida</th>
            <th>Risultato</th>
          </tr>
        </thead>
        <tbody>
          {matches.map(m => {
            const isDouble = m.match_type === 'doubles';
            const leftSide = isDouble ? `${m.p1_name} & ${m.p2_name}` : m.p1_name;
            const rightSide = isDouble ? `${m.op1_name} & ${m.op2_name}` : m.op1_name;
            return (
              <tr key={`${m.match_type}-${m.id}`}>
                <td>{new Date(m.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{isDouble ? '2v2' : '1v1'} {m.points_type}pt</td>
                <td>{leftSide} <span style={{ color: 'var(--accent-orange)' }}>vs</span> {rightSide}</td>
                <td className="score">{m.t1_score} - {m.t2_score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} onPageChange={(p) => fetchHistory(p)} />
    </div>
  );
};

export default MatchHistory;
