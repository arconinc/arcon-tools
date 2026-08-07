alter table public.spec_samples
  add column logo_artwork_id uuid references public.crm_artwork(id) on delete set null;
