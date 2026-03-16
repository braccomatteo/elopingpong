const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');

const register = async (req, res) => {
  const { name, bu, password } = req.body;

  if (!name || !bu || !password) {
    return res.status(400).json({ error: 'Name, BU, and password are required' });
  }

  try {
    // Check if name is taken by an active or soft-deleted player
    const existing = await db.query('SELECT id, deleted_at FROM players WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Questo nome è già in uso.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO players (name, bu, password, role) VALUES ($1, $2, $3, \'player\') RETURNING id, name, bu, role',
      [name, bu, hashedPassword]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user, token });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'User already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

const login = async (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.status(400).json({ error: 'Name and password are required' });
  }

  try {
    const result = await db.query('SELECT * FROM players WHERE name = $1 AND deleted_at IS NULL', [name]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: { id: user.id, name: user.name, bu: user.bu, role: user.role },
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, bu, role FROM players WHERE id = $1 AND deleted_at IS NULL', [req.user.id]);
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { register, login, getMe };
