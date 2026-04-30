-- Forms management system for vendors and customers
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('vendor', 'customer', 'general')),
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT DEFAULT 'application/pdf',
  description TEXT,
  states_covered TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  public_token TEXT UNIQUE,
  public_token_active BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS form_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES crm_vendors(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
  sent_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  delivery_method TEXT NOT NULL DEFAULT 'download' CHECK (delivery_method IN ('download', 'email', 'link', 'in-person')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_forms_category ON forms(category) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_forms_states ON forms USING GIN (states_covered);
CREATE INDEX IF NOT EXISTS idx_forms_public_token ON forms(public_token) WHERE public_token_active = true;
CREATE INDEX IF NOT EXISTS idx_form_delivery_vendor ON form_delivery_logs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_form_delivery_customer ON form_delivery_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_form_delivery_form ON form_delivery_logs(form_id);
CREATE INDEX IF NOT EXISTS idx_form_delivery_sent_at ON form_delivery_logs(sent_at DESC);
