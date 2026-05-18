-- ── Migration 004: Advanced Features ─────────────────────────────────────────
-- Run in Supabase SQL Editor

-- ── 1. Promotions / Automatic Discounts ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS promotions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  applies_to    TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'category', 'product')),
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  min_purchase  NUMERIC(10,2) NOT NULL DEFAULT 0,
  start_date    DATE,
  end_date      DATE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated users can read promotions"
  ON promotions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Managers can manage promotions"
  ON promotions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager','admin')));

-- ── 2. Customer House Accounts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_accounts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id   UUID NOT NULL REFERENCES customers(id) UNIQUE,
  balance       NUMERIC(10,2) NOT NULL DEFAULT 0,  -- positive = customer owes money
  credit_limit  NUMERIC(10,2) NOT NULL DEFAULT 500,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_transactions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id   UUID NOT NULL REFERENCES customers(id),
  sale_id       UUID REFERENCES sales(id),
  amount        NUMERIC(10,2) NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('charge', 'payment')),
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can access customer_accounts"
  ON customer_accounts FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Authenticated users can access account_transactions"
  ON account_transactions FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── 3. Add 'account' to payment_method ───────────────────────────────────────
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'loyalty_points', 'split', 'account'));

-- ── 4. Product Variants ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  sku               TEXT,
  barcode           TEXT,
  price_override    NUMERIC(10,2),   -- NULL = use parent price
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can read variants"
  ON product_variants FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Managers can manage variants"
  ON product_variants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager','admin')));

-- ── 5. Product Bundles ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_bundles (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id),
  quantity             INTEGER NOT NULL DEFAULT 1,
  UNIQUE (bundle_product_id, component_product_id)
);

ALTER TABLE product_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can read bundles"
  ON product_bundles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Managers can manage bundles"
  ON product_bundles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager','admin')));

-- Add is_bundle flag to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 6. New Settings ───────────────────────────────────────────────────────────
INSERT INTO settings (key, value) VALUES
  ('tax_inclusive', 'false'),
  ('vat_number', ''),
  ('receipt_header', ''),
  ('business_address', ''),
  ('business_phone', ''),
  ('business_email', '')
ON CONFLICT (key) DO NOTHING;
