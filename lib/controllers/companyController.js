const db = require('../db');

exports.getAllCompanies = async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, bus FROM companies ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createCompany = async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Il nome della company è obbligatorio.' });
  }

  const normalized = name.trim().toUpperCase();

  try {
    const result = await db.query(
      'INSERT INTO companies (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id, name, bus',
      [normalized]
    );

    if (result.rows.length === 0) {
      const existing = await db.query('SELECT id, name, bus FROM companies WHERE name = $1', [normalized]);
      return res.json(existing.rows[0]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
