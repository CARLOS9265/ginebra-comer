alter table public.purchase_lots
  add column updated_by uuid references public.profiles (id);
