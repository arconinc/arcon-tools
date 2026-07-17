CREATE TABLE IF NOT EXISTS public.crm_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.crm_vendors(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  contact_name_snapshot text,
  contact_email_snapshot text,
  activity_type text NOT NULL DEFAULT 'call',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  duration_minutes integer,
  outcome text,
  notes text,
  next_steps text,
  logged_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_call_logs_one_parent_check CHECK (
    ((customer_id IS NOT NULL)::int + (vendor_id IS NOT NULL)::int + (opportunity_id IS NOT NULL)::int) = 1
  ),
  CONSTRAINT crm_call_logs_duration_check CHECK (
    duration_minutes IS NULL OR (duration_minutes >= 0 AND duration_minutes <= 1440)
  ),
  CONSTRAINT crm_call_logs_activity_type_check CHECK (
    activity_type IN ('call', 'email', 'meeting', 'text', 'other')
  )
);

CREATE INDEX IF NOT EXISTS idx_crm_call_logs_customer
  ON public.crm_call_logs(customer_id, occurred_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_call_logs_vendor
  ON public.crm_call_logs(vendor_id, occurred_at DESC)
  WHERE vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_call_logs_opportunity
  ON public.crm_call_logs(opportunity_id, occurred_at DESC)
  WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_call_logs_contact
  ON public.crm_call_logs(contact_id)
  WHERE contact_id IS NOT NULL;

