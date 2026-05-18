-- ============================================================
-- Run this in Supabase SQL Editor
-- ============================================================

-- Allow 'split' payment method
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash','card','bank_transfer','loyalty_points','split'));

-- Store split payment breakdown + surcharge
ALTER TABLE sales ADD COLUMN IF NOT EXISTS surcharge_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_details  JSONB;

-- Item-level notes on sale_items
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS note TEXT;
