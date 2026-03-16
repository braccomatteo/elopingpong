import React, { useState } from 'react';
import Pagination from './Pagination';

const LIMIT = 20;

const MatchHistory = ({ matches = [], showDate = false }) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(matches.length / LIMIT);
  const paginated = matches.slice((page - 1) * LIMIT, page * LIMIT);

  if (matches.length === 0) return <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.6 }}>Nessun match registrato.</div>;

  return (
    <div>
      <table>
        <thead>
          <tr>
            {showDate && <th>Data</th>}
            <th>Tipo</th>
            <th>Sfida</th>
            <th>Risultato</th>
          </tr>
        </thead>
        <tbody>
          {paginated.map(m => {
            const isDouble = m.match_type === 'doubles';
            const leftSide = isDouble ? `${m.p1_name} & ${m.p2_name}` : m.p1_name;
            const rightSide = isDouble ? `${m.op1_name} & ${m.op2_name}` : m.op1_name;
            return (
              <tr key={`${m.match_type}-${m.id}`}>
                {showDate && <td>{new Date(m.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>}
                <td>{isDouble ? '2v2' : '1v1'} {m.points_type}pt</td>
                <td>{leftSide} <span style={{ color: 'var(--accent-orange)' }}>vs</span> {rightSide}</td>
                <td className="score">{m.t1_score} - {m.t2_score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
};

export default MatchHistory;
