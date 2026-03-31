-- ── Store Seed Data ───────────────────────────────────────────────────────────
-- Run AFTER stores_extended_fields.sql migration.
-- Sources: data/stores.csv + data/Online Store Rules.xlsx

-- Ensure store_id is unique so ON CONFLICT works
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_store_id_unique'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT stores_store_id_unique UNIQUE (store_id);
  END IF;
END $$;

-- ── Step 1: Upsert all stores from stores.csv ─────────────────────────────────

INSERT INTO stores (
  store_id, store_name, domain, status, in_production,
  launch_date, takedown_date, last_order_at, is_active
) VALUES
  ('2266', '838 Coatings',                    '838.shop-arcon.com',                     'Active', true,  NULL,         NULL,         '2026-03-05 09:31:21+00', true),
  ('2443', 'AAA Auto Parts',                  'aaa.shop-arcon.com',                     'Active', true,  NULL,         NULL,         '2026-03-26 12:02:49+00', true),
  ('2529', 'Akers Online Store',              'akers.shop-arcon.com',                   'Active', true,  NULL,         NULL,         '2026-03-18 21:05:49+00', true),
  ('2300', 'Arcon Demo',                      'arcondemo.shop-arcon.com',               'Active', false, NULL,         NULL,         '2025-10-20 13:59:57+00', true),
  ('2308', 'Barrett Distribution Centers',    'barrett.shop-arcon.com',                 'Active', true,  NULL,         NULL,         '2026-03-24 12:13:14+00', true),
  ('2258', 'Bolton & Menk',                   'bolton-menk.shop-arcon.com',             'Active', true,  NULL,         NULL,         '2026-03-27 09:28:47+00', true),
  ('2570', 'Bolton & Menk Safety Store',      'bolton-menksafety.shop-arcon.com',       'Active', true,  NULL,         NULL,         '2026-03-26 16:55:44+00', true),
  ('2389', 'Braun Intertec Corporate',        'braunintertec-corp.shop-arcon.com',      'Active', true,  NULL,         NULL,         '2026-03-25 15:48:08+00', true),
  ('2331', 'Braun Intertec Employee Store',   'braunintertec.shop-arcon.com',           'Active', true,  '2025-01-27', NULL,         '2026-03-27 08:55:08+00', true),
  ('2554', 'Cannon & Wendt Employee Store',   'cw.shop-arcon.com',                      'Active', true,  '2025-09-16', NULL,         '2026-03-09 00:21:35+00', true),
  ('2718', 'DFDG Online Store',               'dfdg.shop-arcon.com',                    'Active', false, NULL,         NULL,         NULL,                      true),
  ('2719', 'Edina Community Ed Online Store', 'edinacommunityed.shop-arcon.com',        'Active', false, NULL,         NULL,         NULL,                      true),
  ('2611', 'Edwards Pitman Corporate',        'edwardspitman-corp.shop-arcon.com',      'Active', true,  '2025-10-30', NULL,         '2026-03-02 10:25:09+00', true),
  ('2603', 'Edwards Pitman Employee',         'edwardpitman.shop-arcon.com',            'Active', true,  '2025-10-23', NULL,         '2026-03-20 15:40:04+00', true),
  ('2348', 'Ergotron',                        'ergotron.shop-arcon.com',                'Active', true,  NULL,         NULL,         '2026-03-26 17:16:40+00', true),
  ('2590', 'Ergotron Apparel Store',          'ergotron-apparel.shop-arcon.com',        'Active', true,  NULL,         NULL,         '2026-03-23 11:06:02+00', true),
  ('2314', 'Hall Threads',                    'hallthreads.shop-arcon.com',             'Active', true,  NULL,         NULL,         '2026-03-26 17:22:12+00', true),
  ('2332', 'HealthEZ',                        'healthez.shop-arcon.com',                'Active', true,  NULL,         NULL,         '2026-03-25 14:59:08+00', true),
  ('2633', 'HealthEZ Employee Store',         'healthez-emp.shop-arcon.com',            'Active', true,  NULL,         NULL,         '2026-03-27 07:57:08+00', true),
  ('2307', 'ISG',                             'isg.estoreplatform.com',                 'Active', true,  NULL,         NULL,         '2026-03-26 10:02:58+00', true),
  ('2515', 'Kraemer Rewards',                 'kraemerrewards.shop-arcon.com',          'Active', true,  '2025-07-03', NULL,         '2026-03-27 09:17:01+00', true),
  ('2329', 'Kraemer Safety',                  'kraemer.shop-arcon.com',                 'Active', true,  NULL,         NULL,         '2026-03-03 16:18:47+00', true),
  ('2543', 'Marion Body Works',               'marion.shop-arcon.com',                  'Active', true,  NULL,         NULL,         '2026-03-25 11:10:44+00', true),
  ('2530', 'McNamara',                        'mcnamara.shop-arcon.com',                'Active', true,  NULL,         NULL,         '2026-03-12 22:22:50+00', true),
  ('2361', 'Medtronic',                       'medtronic.shop-arcon.com',               'Active', true,  NULL,         NULL,         '2026-02-26 13:44:54+00', true),
  ('2542', 'Modigent',                        'modigent.shop-arcon.com',                'Active', true,  NULL,         NULL,         '2026-03-26 15:11:29+00', true),
  ('2268', 'OMG, Inc',                        'omg.shop-arcon.com',                     'Active', true,  '2024-10-09', NULL,         '2026-03-26 08:30:30+00', true),
  ('2708', 'Premise One Corporate',           'premiseonecorp.shop-arcon.com',          'Active', true,  '2026-03-09', NULL,         NULL,                      true),
  ('2235', 'Raceway',                         'raceway.shop-arcon.com',                 'Active', true,  NULL,         NULL,         '2026-03-26 13:33:21+00', true),
  ('2658', 'Raceway Rewards',                 'racewayrewards.shop-arcon.com',          'Active', true,  NULL,         NULL,         '2026-03-17 20:54:21+00', true),
  ('2725', 'Rotary Club of Eagan',            'eagnrotary.shop-arcon.com',              'Active', true,  '2026-03-23', '2026-04-15', '2026-03-25 14:02:12+00', true),
  ('2368', 'Sagent Behavioral Health',        'sagentbh.shop-arcon.com',                'Active', true,  NULL,         NULL,         '2026-03-26 15:52:37+00', true),
  ('2421', 'Schafer Richardson Online Store', 'schaferrichardsononline.shop-arcon.com', 'Active', true,  NULL,         NULL,         '2026-03-19 16:45:18+00', true),
  ('2679', 'SEOPS',                           'seops.shop-arcon.com',                   'Active', true,  '2026-01-29', NULL,         '2026-03-23 14:17:12+00', true),
  ('2502', 'SFE',                             'sfe.shop-arcon.com',                     'Active', true,  '2025-07-01', '2026-10-31', '2025-07-21 16:24:48+00', true),
  ('2622', 'Silver King',                     'silverking.shop-arcon.com',              'Active', true,  '2025-11-11', NULL,         '2026-03-25 17:34:11+00', true),
  ('2419', 'SLA Management',                  'sla.shop-arcon.com',                     'Active', true,  NULL,         NULL,         '2026-03-27 06:48:20+00', true),
  ('2521', 'TA Dedicated',                    'tadedicated.shop-arcon.com',             'Active', true,  '2025-07-14', NULL,         '2026-03-02 09:38:22+00', true),
  ('2465', 'Thies & Talle',                   'thiestalle.shop-arcon.com',              'Active', true,  NULL,         NULL,         '2026-03-23 09:37:33+00', true),
  ('2538', 'UFG Online',                      'ufg.shop-arcon.com',                     'Active', true,  NULL,         NULL,         '2026-03-16 09:14:18+00', true),
  ('2474', 'US Cargo',                        'uscargo.shop-arcon.com',                 'Active', true,  NULL,         NULL,         '2026-03-24 17:23:34+00', true),
  ('2724', 'Vertex Company Store',            'vertex.shop-arcon.com',                  'Active', true,  '2026-03-19', NULL,         NULL,                      true),
  ('2669', 'Vet Sec Online',                  'vetsec.shop-arcon.com',                  'Active', true,  NULL,         NULL,         '2026-03-12 16:24:04+00', true),
  ('2694', 'Warners'' Stellian Online Store', 'wsea.shop-arcon.com',                    'Active', true,  NULL,         NULL,         '2026-03-27 01:02:27+00', true),
  ('2294', 'Wheeler',                         'wheeler.shop-arcon.com',                 'Active', true,  NULL,         NULL,         '2026-03-17 13:30:12+00', true),
  ('2653', 'Wider Circle',                    'widercircle.shop-arcon.com',             'Active', true,  NULL,         NULL,         '2026-03-05 16:54:01+00', true),
  ('2353', 'Yrefy',                           'yrefy.shop-arcon.com',                   'Active', true,  '2025-05-05', NULL,         '2026-03-26 12:10:55+00', true)
ON CONFLICT (store_id) DO UPDATE SET
  store_name    = EXCLUDED.store_name,
  domain        = EXCLUDED.domain,
  status        = EXCLUDED.status,
  in_production = EXCLUDED.in_production,
  launch_date   = EXCLUDED.launch_date,
  takedown_date = EXCLUDED.takedown_date,
  last_order_at = COALESCE(EXCLUDED.last_order_at, stores.last_order_at),
  is_active     = EXCLUDED.is_active,
  updated_at    = now();


-- ── Step 2: Set store rules from Online Store Rules.xlsx ──────────────────────
-- Matched by store_id. Only updates stores that have xlsx data.

-- 838 Coatings (2266)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['On Demand'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2266';

-- AAA Auto Parts (2443)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock', 'On Demand'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2443';

-- Akers Online Store (2529)
UPDATE stores SET
  store_types = ARRAY['Corporate', 'Employee'], who_pays = ARRAY['Corporate', 'User'],
  payment_methods = ARRAY['Bill Corp', 'Credit Card', 'Budget'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['On Demand', 'Stock'],
  allowances = 'Budgets', mandatory_notes = ARRAY['Department']
WHERE store_id = '2529';

-- Barrett Distribution Centers (2308)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2308';

-- Bolton & Menk (2258)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['Corporate', 'User'],
  payment_methods = ARRAY['Credit Card', 'Bill Corp', 'Budget'], freight = ARRAY['Corporate Covers'],
  unique_incentives = 'Bolton pays for decoration. Bill Corp available for Amanda Hurias only.',
  product_types = ARRAY['On Demand', 'Stock'],
  allowances = 'Allowances', mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2258';

-- Bolton & Menk Safety Store (2570)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock'],
  allowances = NULL, mandatory_notes = ARRAY['Division']
WHERE store_id = '2570';

-- Braun Intertec Corporate (2389)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock', 'On Demand'],
  allowances = NULL, mandatory_notes = ARRAY['Tradeshow', 'Department', 'Location']
WHERE store_id = '2389';

-- Braun Intertec Employee Store (2331)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['User'],
  payment_methods = ARRAY['Credit Card'], freight = ARRAY['Corporate Covers'],
  unique_incentives = 'Corporate covers 40% of the sell price (discounted price shown on site).',
  product_types = ARRAY['Stock', 'On Demand'],
  allowances = 'Gift Codes', mandatory_notes = ARRAY['Department', 'Location']
WHERE store_id = '2331';

-- Cannon & Wendt Employee Store (2554)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['User'],
  payment_methods = ARRAY['Credit Card'], freight = ARRAY['$15 Flat Rate'],
  unique_incentives = NULL, product_types = ARRAY['On Demand'],
  allowances = 'Gift Codes', mandatory_notes = ARRAY['Department']
WHERE store_id = '2554';

-- Edwards Pitman Corporate (2611)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock', 'On Demand'],
  allowances = NULL, mandatory_notes = ARRAY['Department', 'Location']
WHERE store_id = '2611';

-- Edwards Pitman Employee (2603)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['User'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = 'Corporate covers 40% of the sell price (discounted price shown on site).',
  product_types = ARRAY['On Demand'],
  allowances = 'Gift Code', mandatory_notes = ARRAY['Department', 'Location']
WHERE store_id = '2603';

-- Ergotron — Corporate store (2348)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['On Demand', 'Stock'],
  allowances = 'Budget', mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2348';

-- Ergotron Apparel Store — Employee store (2590)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Credit Card'], freight = ARRAY['$15 Flat Rate'],
  unique_incentives = NULL, product_types = ARRAY['On Demand'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2590';

-- Hall Threads (2314)
UPDATE stores SET
  store_types = ARRAY['Corporate', 'Employee'], who_pays = ARRAY['Corporate', 'User'],
  payment_methods = ARRAY['Credit Card', 'Bill Corp'], freight = ARRAY['Tiered Rate'],
  unique_incentives = NULL, product_types = ARRAY['On Demand'],
  allowances = 'Budgets & Store Codes', mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2314';

-- HealthEZ — Corporate store (2332)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock'],
  allowances = NULL, mandatory_notes = ARRAY['Department', 'Add Card From']
WHERE store_id = '2332';

-- HealthEZ Employee Store (2633)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['User'],
  payment_methods = ARRAY['Credit Card', 'Budget'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['On Demand', 'Stock'],
  allowances = 'Allowances', mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2633';

-- ISG (2307)
UPDATE stores SET
  store_types = ARRAY['Corporate', 'Employee'], who_pays = ARRAY['Corporate', 'User'],
  payment_methods = ARRAY['Credit Card', 'Bill Corp'], freight = ARRAY['$15 Flat Rate'],
  unique_incentives = 'ISG covers decoration.',
  product_types = ARRAY['On Demand', 'Stock'],
  allowances = 'Allowances', mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2307';

-- Kraemer Rewards (2515)
UPDATE stores SET
  store_types = ARRAY['Corporate', 'Employee'], who_pays = ARRAY['Corporate', 'User'],
  payment_methods = ARRAY['Credit Card'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['On Demand', 'Stock'],
  allowances = 'Allowances', mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2515';

-- Kraemer Safety (2329)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2329';

-- Marion Body Works (2543)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['User'],
  payment_methods = ARRAY['Credit Card', 'Payroll Deduct'], freight = ARRAY['Corporate Covers'],
  unique_incentives = 'Marion covers decoration and freight.',
  product_types = ARRAY['On Demand'],
  allowances = 'Budget', mandatory_notes = ARRAY['Department', 'Attention']
WHERE store_id = '2543';

-- McNamara (2530)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['User'],
  payment_methods = ARRAY['Credit Card'], freight = ARRAY['$15 Flat Rate'],
  unique_incentives = NULL, product_types = ARRAY['On Demand'],
  allowances = 'Budget', mandatory_notes = ARRAY['PO Reason']
WHERE store_id = '2530';

-- Medtronic (2361)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['On Demand'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2361';

-- Modigent (2542)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['On Demand'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2542';

-- OMG, Inc (2268)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['On Demand'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2268';

-- Raceway (2235)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2235';

-- Raceway Rewards (2658)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2658';

-- Sagent Behavioral Health (2368)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['User'],
  payment_methods = ARRAY['Credit Card'], freight = ARRAY['$11 Flat Rate'],
  unique_incentives = NULL, product_types = ARRAY['On Demand'],
  allowances = 'Gift Codes', mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2368';

-- Schafer Richardson Online Store (2421)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['User'],
  payment_methods = ARRAY['Credit Card'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['On Demand'],
  allowances = 'Budget', mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2421';

-- SEOPS (2679)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['User'],
  payment_methods = ARRAY['Credit Card'], freight = ARRAY['$12 Flat Rate'],
  unique_incentives = NULL, product_types = ARRAY['Stock'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2679';

-- Silver King (2622)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['User'],
  payment_methods = ARRAY['Credit Card'], freight = ARRAY['Corporate Covers'],
  unique_incentives = 'Corporate covers 40% of the sell price.',
  product_types = ARRAY['On Demand'],
  allowances = 'Gift Codes', mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2622';

-- SLA Management (2419)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['On Demand', 'Stock'],
  allowances = NULL, mandatory_notes = ARRAY['School']
WHERE store_id = '2419';

-- TA Dedicated (2521)
UPDATE stores SET
  store_types = ARRAY['Corporate', 'Employee'], who_pays = ARRAY['Corporate', 'User'],
  payment_methods = ARRAY['Bill Corp', 'Credit Card'], freight = ARRAY['$15 Flat Rate'],
  unique_incentives = NULL, product_types = ARRAY['On Demand', 'Stock'],
  allowances = 'Budgets', mandatory_notes = ARRAY['Cost Center', 'Department']
WHERE store_id = '2521';

-- Thies & Talle (2465)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock', 'On Demand'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2465';

-- UFG Online (2538)
UPDATE stores SET
  store_types = ARRAY['Employee'], who_pays = ARRAY['User'],
  payment_methods = ARRAY['Credit Card'], freight = ARRAY['Corporate Covers'],
  unique_incentives = 'Corporate pays for decoration fees.',
  product_types = ARRAY['On Demand'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2538';

-- US Cargo (2474)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock'],
  allowances = NULL, mandatory_notes = ARRAY['Department']
WHERE store_id = '2474';

-- Vet Sec Online (2669)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock'],
  allowances = NULL, mandatory_notes = ARRAY['Divisions', 'Branches']
WHERE store_id = '2669';

-- Wheeler (2294)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock', 'On Demand'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2294';

-- Wider Circle (2653)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2653';

-- Yrefy (2353)
UPDATE stores SET
  store_types = ARRAY['Corporate'], who_pays = ARRAY['Corporate'],
  payment_methods = ARRAY['Bill Corp'], freight = ARRAY['Corporate Covers'],
  unique_incentives = NULL, product_types = ARRAY['Stock', 'On Demand'],
  allowances = NULL, mandatory_notes = ARRAY[]::TEXT[]
WHERE store_id = '2353';

-- Note: Navi Title, Velociti, Viaflex exist in xlsx but not in CSV — add manually when available.
-- Note: Vertex (2724) and SFE (2502) had empty xlsx sheets — rules can be added later.
