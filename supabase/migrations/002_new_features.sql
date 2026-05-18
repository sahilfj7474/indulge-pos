-- ============================================================
-- Run this in Supabase SQL Editor
-- ============================================================

-- Product images
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ── REGISTERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id    UUID NOT NULL REFERENCES locations(id),
  user_id        UUID NOT NULL REFERENCES users(id),
  opening_float  NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_float  NUMERIC(10,2),
  cash_in        NUMERIC(10,2) NOT NULL DEFAULT 0,
  cash_out       NUMERIC(10,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at      TIMESTAMPTZ
);
ALTER TABLE registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registers_all" ON registers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── HELD ORDERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS held_orders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  label       TEXT NOT NULL DEFAULT 'Hold',
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE held_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "held_orders_all" ON held_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── SUPPLIERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_read"  ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_write" ON suppliers FOR ALL TO authenticated USING (get_my_role() IN ('manager','admin'));

-- ── PURCHASE ORDERS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','received','cancelled')),
  notes       TEXT,
  total       NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id  UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES products(id),
  quantity_ordered   INTEGER NOT NULL DEFAULT 0,
  quantity_received  INTEGER NOT NULL DEFAULT 0,
  unit_cost          NUMERIC(10,2) NOT NULL DEFAULT 0,
  total              NUMERIC(10,2) NOT NULL DEFAULT 0
);
ALTER TABLE purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_read"  ON purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "po_write" ON purchase_orders FOR ALL TO authenticated USING (get_my_role() IN ('manager','admin'));
CREATE POLICY "poi_all"  ON purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── STOCK TAKES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_takes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id  UUID NOT NULL REFERENCES locations(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS stock_take_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  expected_qty  INTEGER NOT NULL DEFAULT 0,
  counted_qty   INTEGER NOT NULL DEFAULT 0,
  variance      INTEGER GENERATED ALWAYS AS (counted_qty - expected_qty) STORED
);
ALTER TABLE stock_takes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "st_all"  ON stock_takes      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sti_all" ON stock_take_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── STOCK TRANSFERS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transfers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_location_id UUID NOT NULL REFERENCES locations(id),
  to_location_id   UUID NOT NULL REFERENCES locations(id),
  user_id          UUID NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_transfer_id  UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES products(id),
  quantity           INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE stock_transfers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "str_all"  ON stock_transfers      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "stri_all" ON stock_transfer_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── LAYBYS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS laybys (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  total       NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_due  NUMERIC(10,2) GENERATED ALWAYS AS (total - deposit_paid) STORED,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS layby_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  layby_id   UUID NOT NULL REFERENCES laybys(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total      NUMERIC(10,2) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS layby_payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  layby_id       UUID NOT NULL REFERENCES laybys(id) ON DELETE CASCADE,
  amount         NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE laybys         ENABLE ROW LEVEL SECURITY;
ALTER TABLE layby_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE layby_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "layby_all"    ON laybys         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lbi_all"      ON layby_items    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lbp_all"      ON layby_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
