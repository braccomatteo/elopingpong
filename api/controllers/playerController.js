const db = require('../db');

exports.getAllPlayers = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, bu, role, score_21 FROM players WHERE role != 'admin' ORDER BY score_21 DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePlayer = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.query('SELECT role FROM players WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Giocatore non trovato.' });
    }
    if (check.rows[0].role === 'admin') {
      return res.status(403).json({ error: 'Non puoi eliminare un admin.' });
    }
    await db.query('DELETE FROM players WHERE id = $1', [id]);
    res.json({ message: 'Giocatore eliminato.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, bu, password } = req.body;

  if (!name && !bu && !password) {
    return res.status(400).json({ error: 'Nessun dato da aggiornare.' });
  }

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }
    if (bu) {
      fields.push(`bu = $${idx++}`);
      values.push(bu);
    }
    if (password) {
      fields.push(`password = $${idx++}`);
      values.push(password);
    }

    values.push(userId);

    const result = await db.query(
      `UPDATE players SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, bu, role`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato.' });
    }

    res.json({ user: result.rows[0], message: 'Profilo aggiornato.' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Questo nome è già in uso.' });
    }
    res.status(500).json({ error: err.message });
  }
};
