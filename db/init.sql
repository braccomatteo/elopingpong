-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Players table
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    company VARCHAR(100) DEFAULT '',
    bu VARCHAR(50) DEFAULT '',
    password VARCHAR(255),
    role VARCHAR(20) DEFAULT 'player',
    score_overall NUMERIC(8,2) DEFAULT 1000,
    score_1v1_21 NUMERIC(8,2) DEFAULT 1000,
    score_1v1_11 NUMERIC(8,2) DEFAULT 1000,
    score_2v2_21 NUMERIC(8,2) DEFAULT 1000,
    score_2v2_11 NUMERIC(8,2) DEFAULT 1000,
    games_1v1_21 INTEGER DEFAULT 0,
    games_1v1_11 INTEGER DEFAULT 0,
    games_2v2_21 INTEGER DEFAULT 0,
    games_2v2_11 INTEGER DEFAULT 0,
    last_delta_overall NUMERIC(8,2) DEFAULT 0,
    last_delta_1v1_21 NUMERIC(8,2) DEFAULT 0,
    last_delta_1v1_11 NUMERIC(8,2) DEFAULT 0,
    last_delta_2v2_21 NUMERIC(8,2) DEFAULT 0,
    last_delta_2v2_11 NUMERIC(8,2) DEFAULT 0,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID DEFAULT NULL,
    approved BOOLEAN DEFAULT FALSE
);

-- Create Matches table (singles only)
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    opponent_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    winner_id UUID REFERENCES players(id) ON DELETE SET NULL,
    creator_score INTEGER NOT NULL,
    opponent_score INTEGER NOT NULL,
    points_type INTEGER DEFAULT 21,
    status VARCHAR(20) DEFAULT 'verified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID DEFAULT NULL
);

-- Create Team Matches table (doubles)
CREATE TABLE IF NOT EXISTS team_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    p1_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    p2_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    op1_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    op2_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_score INTEGER NOT NULL,
    opponent_score INTEGER NOT NULL,
    points_type INTEGER DEFAULT 21,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID DEFAULT NULL
);

-- Indexes for fast player matches lookups
CREATE INDEX IF NOT EXISTS idx_team_matches_p1 ON team_matches(p1_id);
CREATE INDEX IF NOT EXISTS idx_team_matches_p2 ON team_matches(p2_id);
CREATE INDEX IF NOT EXISTS idx_team_matches_op1 ON team_matches(op1_id);
CREATE INDEX IF NOT EXISTS idx_team_matches_op2 ON team_matches(op2_id);

-- Unique name only for active (non-deleted) players
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name_active ON players(name) WHERE deleted_at IS NULL;

-- Create Companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    bus TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default companies
INSERT INTO companies (name, bus) VALUES
  ('DATA', ARRAY['BU1 - AIFR','BU2 - PFR','BU3 - AITE','BU4 - PTE','BU5 - AIBA','BU6 - PBA','BU7 - AIIN','BU8 - PIN','BU9 - QOA','BU10 - DGO']),
  ('NON-REPLYER', '{}')
ON CONFLICT (name) DO NOTHING;

-- Seed Admin only
INSERT INTO players (name, bu, role, score_overall, score_1v1_21, score_1v1_11, score_2v2_21, score_2v2_11, password, approved) VALUES 
('Admin', 'Management', 'admin', 1000, 1000, 1000, 1000, 1000, 'adminpassword', TRUE)
ON CONFLICT (name) DO NOTHING;
