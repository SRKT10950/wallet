-- Initialization script for PostgreSQL container
-- Database 'wallet' is created by environment variable POSTGRES_DB

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set standard timezone
SET timezone = 'UTC';
