-- Samphone Intelligence
-- Jalankan seluruh berkas ini sekali di Supabase SQL Editor.
-- Aman dijalankan ulang: tabel memakai IF NOT EXISTS, policy dibuat ulang.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  target_profit numeric(14,2) not null default 500000 check (target_profit >= 0),
  risk_reserve numeric(14,2) not null default 300000 check (risk_reserve >= 0),
  operational_cost numeric(14,2) not null default 150000 check (operational_cost >= 0),
  preferred_cities text[] not null default array['Surabaya','Sidoarjo','Gresik','Malang','Mojokerto','Kediri','Jombang']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_platform text not null default 'facebook_marketplace'
    check (source_platform in ('facebook_marketplace', 'facebook_group', 'other')),
  listing_url text,
  normalized_url text,
  title text,
  description text,
  asking_price numeric(14,2) check (asking_price is null or asking_price >= 0),
  listing_date date,
  collected_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active', 'negotiating', 'sold', 'unavailable', 'archived')),
  province text not null default 'Jawa Timur',
  city text,
  district text,
  seller_notes text,
  internal_notes text,
  negotiation_notes text,
  actual_purchase_price numeric(14,2) check (actual_purchase_price is null or actual_purchase_price >= 0),
  actual_resale_price numeric(14,2) check (actual_resale_price is null or actual_resale_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_specs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings (id) on delete cascade,
  model text,
  storage text,
  color text,
  region text,
  battery_health integer check (battery_health is null or (battery_health >= 0 and battery_health <= 100)),
  battery_replaced boolean,
  face_id text,
  true_tone text,
  carrier_lock text,
  imei_status text,
  icloud_status text,
  parts_history text,
  physical_condition text,
  functional_condition text,
  repair_history text,
  missing_fields text[] not null default '{}',
  uncertain_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listing_specs add column if not exists icloud_status text;
alter table public.listing_specs add column if not exists missing_fields text[] not null default '{}';
alter table public.listing_specs add column if not exists uncertain_fields text[] not null default '{}';

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  kind text not null check (kind in ('screenshot', 'product')),
  created_at timestamptz not null default now()
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  asking_price numeric(14,2) check (asking_price is null or asking_price >= 0),
  status text not null,
  note text,
  recorded_at timestamptz not null default now()
);

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model text,
  storage text,
  region text,
  filters jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  sample_size integer not null default 0 check (sample_size >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists listings_user_normalized_url_uidx
  on public.listings (user_id, normalized_url)
  where normalized_url is not null and normalized_url <> '';

create index if not exists listings_user_collected_idx on public.listings (user_id, collected_at desc);
create index if not exists listings_user_status_idx on public.listings (user_id, status);
create index if not exists listing_specs_model_storage_idx on public.listing_specs (model, storage);
create index if not exists listing_images_listing_idx on public.listing_images (listing_id);
create index if not exists price_history_listing_idx on public.price_history (listing_id, recorded_at desc);
create index if not exists market_snapshots_user_idx on public.market_snapshots (user_id, created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

drop trigger if exists listing_specs_set_updated_at on public.listing_specs;
create trigger listing_specs_set_updated_at
  before update on public.listing_specs
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_specs enable row level security;
alter table public.listing_images enable row level security;
alter table public.price_history enable row level security;
alter table public.market_snapshots enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists listings_owner_all on public.listings;
create policy listings_owner_all on public.listings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists listing_specs_owner_all on public.listing_specs;
create policy listing_specs_owner_all on public.listing_specs
  for all using (
    exists (select 1 from public.listings where listings.id = listing_specs.listing_id and listings.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.listings where listings.id = listing_specs.listing_id and listings.user_id = auth.uid())
  );

drop policy if exists listing_images_owner_all on public.listing_images;
create policy listing_images_owner_all on public.listing_images
  for all using (
    exists (select 1 from public.listings where listings.id = listing_images.listing_id and listings.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.listings where listings.id = listing_images.listing_id and listings.user_id = auth.uid())
  );

drop policy if exists price_history_owner_all on public.price_history;
create policy price_history_owner_all on public.price_history
  for all using (
    exists (select 1 from public.listings where listings.id = price_history.listing_id and listings.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.listings where listings.id = price_history.listing_id and listings.user_id = auth.uid())
  );

drop policy if exists market_snapshots_owner_all on public.market_snapshots;
create policy market_snapshots_owner_all on public.market_snapshots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.profiles from anon;
revoke all on public.listings from anon;
revoke all on public.listing_specs from anon;
revoke all on public.listing_images from anon;
revoke all on public.price_history from anon;
revoke all on public.market_snapshots from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.listings to authenticated;
grant select, insert, update, delete on public.listing_specs to authenticated;
grant select, insert, update, delete on public.listing_images to authenticated;
grant select, insert, update, delete on public.price_history to authenticated;
grant select, insert, update, delete on public.market_snapshots to authenticated;

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', false)
on conflict (id) do update set public = false;

drop policy if exists listing_images_storage_select on storage.objects;
drop policy if exists listing_images_storage_insert on storage.objects;
drop policy if exists listing_images_storage_update on storage.objects;
drop policy if exists listing_images_storage_delete on storage.objects;

create policy listing_images_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy listing_images_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy listing_images_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy listing_images_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
