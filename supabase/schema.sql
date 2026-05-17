-- ============================================================
-- INDULGE POS — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- LOCATIONS
-- ============================================================
CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS (mirrors auth.users)
-- ============================================================
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('cashier','supervisor','manager','admin')),
  location_id UUID REFERENCES locations(id),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create user profile on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'cashier')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  sku         TEXT UNIQUE,
  barcode     TEXT UNIQUE,
  category_id UUID REFERENCES categories(id),
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost        NUMERIC(10,2),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE TABLE inventory (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id         UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity            INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, location_id)
);

CREATE TABLE inventory_adjustments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id),
  location_id     UUID NOT NULL REFERENCES locations(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  quantity_change INTEGER NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name      TEXT NOT NULL,
  email          TEXT UNIQUE,
  phone          TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  total_spent    NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SALES
-- ============================================================
CREATE TABLE sales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id     UUID NOT NULL REFERENCES locations(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  customer_id     UUID REFERENCES customers(id),
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method  TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','card','bank_transfer','loyalty_points','split')),
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','refunded','partial_refund','voided')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sale_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  quantity        INTEGER NOT NULL,
  unit_price      NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL
);

-- ============================================================
-- REFUNDS
-- ============================================================
CREATE TABLE refunds (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id     UUID NOT NULL REFERENCES sales(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  amount      NUMERIC(10,2) NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refund_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  refund_id    UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id),
  product_id   UUID NOT NULL REFERENCES products(id),
  quantity     INTEGER NOT NULL,
  amount       NUMERIC(10,2) NOT NULL
);

-- ============================================================
-- LOYALTY TRANSACTIONS
-- ============================================================
CREATE TABLE loyalty_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id     UUID REFERENCES sales(id),
  points      INTEGER NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('earn','redeem','adjustment')),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Z-REPORTS (end of day closures)
-- ============================================================
CREATE TABLE z_reports (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id           UUID NOT NULL REFERENCES locations(id),
  opened_by             UUID NOT NULL REFERENCES users(id),
  closed_by             UUID REFERENCES users(id),
  report_date           DATE NOT NULL,
  total_sales           NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_transactions    INTEGER NOT NULL DEFAULT 0,
  total_refunds         NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_sales             NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_discount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_tax             NUMERIC(10,2) NOT NULL DEFAULT 0,
  cash_sales            NUMERIC(10,2) NOT NULL DEFAULT 0,
  card_sales            NUMERIC(10,2) NOT NULL DEFAULT 0,
  bank_transfer_sales   NUMERIC(10,2) NOT NULL DEFAULT 0,
  loyalty_sales         NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS — inventory deduction on sale
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory
  SET quantity = quantity - NEW.quantity,
      updated_at = NOW()
  WHERE product_id = NEW.product_id
    AND location_id = (SELECT location_id FROM sales WHERE id = NEW.sale_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_deduct_inventory
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION deduct_inventory_on_sale();

-- Restore inventory on refund
CREATE OR REPLACE FUNCTION restore_inventory_on_refund()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory
  SET quantity = quantity + NEW.quantity,
      updated_at = NOW()
  WHERE product_id = NEW.product_id
    AND location_id = (SELECT location_id FROM sales WHERE id = (SELECT sale_id FROM refunds WHERE id = NEW.refund_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_restore_inventory
  AFTER INSERT ON refund_items
  FOR EACH ROW EXECUTE FUNCTION restore_inventory_on_refund();

-- Update customer total_spent on sale
CREATE OR REPLACE FUNCTION update_customer_total_spent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE customers
    SET total_spent = total_spent + NEW.total
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_customer_total_spent
  AFTER INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION update_customer_total_spent();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE locations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds             ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE z_reports           ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: get current user location
CREATE OR REPLACE FUNCTION get_my_location()
RETURNS UUID AS $$
  SELECT location_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Authenticated users can read locations
CREATE POLICY "locations_read" ON locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "locations_write" ON locations FOR ALL TO authenticated USING (get_my_role() = 'admin');

-- Users: anyone can read, admin can write
CREATE POLICY "users_read" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_write" ON users FOR ALL TO authenticated USING (get_my_role() = 'admin');

-- Categories: all read, manager+ write
CREATE POLICY "categories_read" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_write" ON categories FOR ALL TO authenticated USING (get_my_role() IN ('manager','admin'));

-- Products: all read, manager+ write
CREATE POLICY "products_read" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_write" ON products FOR ALL TO authenticated USING (get_my_role() IN ('manager','admin'));

-- Inventory: all read, supervisor+ write
CREATE POLICY "inventory_read" ON inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_write" ON inventory FOR ALL TO authenticated USING (get_my_role() IN ('supervisor','manager','admin'));

-- Inventory adjustments: all read, supervisor+ write
CREATE POLICY "inv_adj_read" ON inventory_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "inv_adj_write" ON inventory_adjustments FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('supervisor','manager','admin'));

-- Customers: all authenticated
CREATE POLICY "customers_all" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sales: all authenticated (location filtering in app layer)
CREATE POLICY "sales_all" ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sale_items_all" ON sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Refunds: supervisor+
CREATE POLICY "refunds_read" ON refunds FOR SELECT TO authenticated USING (true);
CREATE POLICY "refunds_write" ON refunds FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('supervisor','manager','admin'));
CREATE POLICY "refund_items_read" ON refund_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "refund_items_write" ON refund_items FOR INSERT TO authenticated WITH CHECK (true);

-- Loyalty
CREATE POLICY "loyalty_all" ON loyalty_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Z-Reports: supervisor+
CREATE POLICY "z_reports_read" ON z_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "z_reports_write" ON z_reports FOR ALL TO authenticated USING (get_my_role() IN ('supervisor','manager','admin'));

-- ============================================================
-- SEED DATA — Default Location
-- ============================================================
INSERT INTO locations (name, address) VALUES ('Indulge - Main Branch', 'Main Branch Address');

-- Default categories
INSERT INTO categories (name, color) VALUES
  ('Food', '#f97316'),
  ('Beverages', '#3b82f6'),
  ('Retail', '#8b5cf6'),
  ('Services', '#10b981'),
  ('Other', '#6b7280');
