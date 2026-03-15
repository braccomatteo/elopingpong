const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const authRoutes = require('../lib/routes/authRoutes');
const matchRoutes = require('../lib/routes/matchRoutes');
const playerRoutes = require('../lib/routes/playerRoutes');
const teamMatchRoutes = require('../lib/routes/teamMatchRoutes');

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/team-matches', teamMatchRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Ping Pong Ranking API is running' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;
