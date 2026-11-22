-- KasKita MD 2026 — Supabase schema
-- Jalankan seluruh file ini di Supabase > SQL Editor.
-- Setelah akun Admin pertama terdaftar, lihat petunjuk bootstrap di README.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'bendahara', 'anggota');
create type public.transaction_type as enum ('income', 'expense');
create type public.payment_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Anggota',
  student_number text,
  role public.app_role not null default 'anggota',
  created_at timestamptz not null default now()
);

create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type public.transaction_type not null,
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  period text not null,
  amount numeric(14,2) not null check (amount > 0),
  proof_path text,
  status public.payment_status not null default 'pending',
  note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_user_id_idx on public.payments(user_id);
create index payments_status_idx on public.payments(status);
create index transactions_date_idx on public.cash_transactions(transaction_date desc);

-- Membuat profil otomatis. Role selalu anggota; metadata pengguna tidak dapat menetapkan role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, student_number, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Anggota'),
    nullif(new.raw_user_meta_data ->> 'student_number', ''),
    'anggota'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'bendahara')
  );
$$;

alter table public.profiles enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.payments enable row level security;

-- Profil dapat dibaca oleh pengguna yang login. Pengguna hanya boleh mengubah nama/NIM sendiri.
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, student_number) on public.profiles to authenticated;
create policy "profiles read authenticated" on public.profiles
for select to authenticated using (true);
create policy "profile update own basic fields" on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Transaksi bisa dilihat semua anggota login, hanya Admin/Bendahara yang dapat menulis.
grant select, insert, update, delete on public.cash_transactions to authenticated;
create policy "transactions read authenticated" on public.cash_transactions
for select to authenticated using (true);
create policy "manager insert transactions" on public.cash_transactions
for insert to authenticated with check (public.is_manager() and created_by = (select auth.uid()));
create policy "manager update transactions" on public.cash_transactions
for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "admin delete transactions" on public.cash_transactions
for delete to authenticated using (
  exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
);

-- Anggota hanya melihat/mengirim pembayaran miliknya. Pengelola melihat dan memverifikasi semuanya.
grant select, insert, update on public.payments to authenticated;
create policy "payments read own or manager" on public.payments
for select to authenticated using (user_id = (select auth.uid()) or public.is_manager());
create policy "member submit own payment" on public.payments
for insert to authenticated with check (
  user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null
);
create policy "manager review payment" on public.payments
for update to authenticated using (public.is_manager())
with check (public.is_manager());

-- Fungsi khusus Admin untuk mengubah role; anggota tidak dapat menaikkan role sendiri.
create or replace function public.admin_set_role(target_user uuid, new_role public.app_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'Hanya Admin yang dapat mengubah role';
  end if;
  update public.profiles set role = new_role where id = target_user;
end;
$$;
revoke all on function public.admin_set_role(uuid, public.app_role) from public;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;

-- Storage bucket privat untuk bukti pembayaran.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "member upload own proof folder" on storage.objects
for insert to authenticated with check (
  bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "owner or manager read proofs" on storage.objects
for select to authenticated using (
  bucket_id = 'payment-proofs' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or public.is_manager()
  )
);
create policy "manager delete proofs" on storage.objects
for delete to authenticated using (bucket_id = 'payment-proofs' and public.is_manager());

-- Catatan: jangan berikan service_role key ke browser/GitHub.
