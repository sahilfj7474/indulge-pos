-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read"  ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_write" ON settings FOR ALL    TO authenticated USING (get_my_role() = 'admin');

INSERT INTO settings (key, value) VALUES
  ('store_name',      'Indulge'),
  ('tax_rate',        '9'),
  ('receipt_footer',  'Thank you for your purchase! Please come again.'),
  ('loyalty_rate',    '1'),
  ('currency',        'FJD')
ON CONFLICT (key) DO NOTHING;
