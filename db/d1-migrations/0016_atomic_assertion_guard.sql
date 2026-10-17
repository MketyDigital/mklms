-- Internal D1-only guard. A failed invariant aborts the enclosing D1 batch;
-- successful operations insert and delete their guard row in the same batch.
CREATE TABLE IF NOT EXISTS mklms_d1_atomic_assertions (
  id TEXT PRIMARY KEY,
  passed INTEGER NOT NULL CHECK (passed = 1)
);
