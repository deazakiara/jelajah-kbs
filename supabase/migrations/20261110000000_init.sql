-- ============================================================
-- Jelajah KBS · skema Supabase (Postgres)
-- Satu project bisa melayani banyak destinasi (kolom destination_id).
-- Data publik (zona, satwa, status, jadwal, pengumuman) bisa dibaca siapa saja.
-- Perubahan operasional hanya oleh akun ber-role 'pengelola' untuk destinasinya.
-- ============================================================

-- ---------- destinasi & profil ----------
create table if not exists public.destinations (
  id          text primary key,
  name        text not null,
  plan        text not null default 'standard' check (plan in ('basic', 'standard', 'premium')),
  max_points  int  not null default 100,
  data_as_of  text,
  tickets     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text,
  name           text not null default '',
  role           text not null default 'pengunjung' check (role in ('pengunjung', 'pengelola')),
  destination_id text references public.destinations (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ---------- konten destinasi ----------
create table if not exists public.zones (
  destination_id text not null references public.destinations (id) on delete cascade,
  id             text not null,
  name           text not null,
  short_name     text,
  cat            text not null check (cat in ('satwa', 'wahana', 'layanan', 'staf')),
  icon           text,
  price          text,
  status         text not null default 'buka' check (status in ('buka', 'cek', 'tutup')),
  dwell          int  not null default 0,
  tags           text[] not null default '{}',
  description    text,
  tips           text,
  pos            double precision[] not null,
  verified       boolean not null default false,
  plan           jsonb not null default '{}'::jsonb, -- atribut perencana itinerary (usia, kategori, akses); lihat src/data.js
  updated_at     timestamptz not null default now(),
  primary key (destination_id, id)
);

create table if not exists public.pois (
  destination_id text not null references public.destinations (id) on delete cascade,
  id             text not null,
  name           text not null,
  type           text not null,
  pos            double precision[] not null,
  verified       boolean not null default false,
  updated_at     timestamptz not null default now(),
  primary key (destination_id, id)
);

create table if not exists public.animals (
  destination_id text not null references public.destinations (id) on delete cascade,
  id             text not null,
  name           text not null,
  name_en        text,
  latin          text,
  iucn           text,
  zone_id        text,
  fact           text,
  updated_at     timestamptz not null default now(),
  primary key (destination_id, id)
);

create table if not exists public.qr_points (
  destination_id text not null references public.destinations (id) on delete cascade,
  id             text not null,
  name           text not null,
  hint           text,
  pos            double precision[] not null,
  primary key (destination_id, id)
);

create table if not exists public.schedules (
  id             bigint generated always as identity primary key,
  destination_id text not null references public.destinations (id) on delete cascade,
  t              time not null,
  dur            int  not null default 20,
  title          text not null,
  zone_id        text,
  note           text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists schedules_dest_t on public.schedules (destination_id, t);

-- ---------- status operasional (diubah pengelola, tampil realtime) ----------
-- key: 'z:<zona>' | 'p:<fasilitas>' | 'e:<jalur>'
create table if not exists public.item_status (
  destination_id text not null references public.destinations (id) on delete cascade,
  key            text not null check (key ~ '^[zpe]:[a-z0-9-]+$'),
  closed         boolean not null default false,
  verified       boolean,
  updated_at     timestamptz not null default now(),
  updated_by     uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (destination_id, key)
);

create table if not exists public.announcements (
  id             bigint generated always as identity primary key,
  destination_id text not null references public.destinations (id) on delete cascade,
  text           text not null check (char_length(text) between 1 and 300),
  level          text not null default 'info' check (level in ('info', 'penting')),
  auto           boolean not null default false,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists announcements_dest_created on public.announcements (destination_id, created_at desc);

create table if not exists public.change_log (
  id             bigint generated always as identity primary key,
  destination_id text not null references public.destinations (id) on delete cascade,
  what           text not null check (char_length(what) <= 300),
  who_name       text,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists change_log_dest_created on public.change_log (destination_id, created_at desc);

-- ---------- data milik pengunjung ----------
create table if not exists public.favorites (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  destination_id text not null references public.destinations (id) on delete cascade,
  item_key       text not null,
  created_at     timestamptz not null default now(),
  primary key (user_id, destination_id, item_key)
);

create table if not exists public.passport_stamps (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  destination_id text not null references public.destinations (id) on delete cascade,
  animal_id      text not null,
  created_at     timestamptz not null default now(),
  primary key (user_id, destination_id, animal_id)
);

create table if not exists public.visit_plans (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  destination_id text not null references public.destinations (id) on delete cascade,
  title          text not null,
  stops          text[] not null,
  saved_label    text,
  created_at     timestamptz not null default now()
);
create index if not exists visit_plans_user on public.visit_plans (user_id, destination_id, created_at desc);

-- ---------- analitik (Key Metric lean canvas) ----------
create table if not exists public.qr_scans (
  id             bigint generated always as identity primary key,
  destination_id text not null references public.destinations (id) on delete cascade,
  qr_id          text not null,
  source         text not null default 'url' check (source in ('url', 'menu')),
  user_id        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists qr_scans_dest_created on public.qr_scans (destination_id, created_at);

create table if not exists public.surveys (
  id             bigint generated always as identity primary key,
  destination_id text not null references public.destinations (id) on delete cascade,
  user_id        uuid default auth.uid() references auth.users (id) on delete set null,
  rating         smallint not null check (rating between 1 and 5),
  comment        text check (char_length(comment) <= 500),
  created_at     timestamptz not null default now()
);

-- kuota harian Kobi (hanya diakses edge function lewat service role)
create table if not exists public.kobi_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, day)
);

-- ============================================================
-- Fungsi bantu
-- ============================================================
create or replace function public.is_manager(dest text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'pengelola' and (destination_id = dest or destination_id is null)
  );
$$;

-- profil otomatis setiap ada akun baru (role default: pengunjung)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- jadikan sebuah akun pengelola destinasi (jalankan dari SQL Editor / service role)
create or replace function public.promote_to_manager(user_email text, dest text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set role = 'pengelola', destination_id = dest where lower(email) = lower(user_email);
  if not found then raise exception 'Akun % belum terdaftar', user_email; end if;
end;
$$;

-- ganti seluruh jadwal destinasi sekaligus (dipakai konsol pengelola)
create or replace function public.replace_schedule(dest text, items jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager(dest) then raise exception 'Hanya pengelola' using errcode = '42501'; end if;
  delete from public.schedules where destination_id = dest;
  insert into public.schedules (destination_id, t, dur, title, zone_id, note)
  select dest, (i ->> 't')::time, coalesce((i ->> 'dur')::int, 20), left(coalesce(i ->> 'title', 'Acara'), 120), i ->> 'zone', left(coalesce(i ->> 'note', ''), 200)
  from jsonb_array_elements(items) as i;
end;
$$;

-- angka dasbor pengelola: akses QR per hari, titik terpopuler, rata-rata survei
create or replace function public.dashboard_stats(dest text, days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since date := (now() at time zone 'Asia/Jakarta')::date - (days - 1);
  since_ts timestamptz := since::timestamp at time zone 'Asia/Jakarta';
  result jsonb;
begin
  if not public.is_manager(dest) then raise exception 'Hanya pengelola' using errcode = '42501'; end if;
  select jsonb_build_object(
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('d', g.day::text, 'v', coalesce(c.n, 0)) order by g.day), '[]'::jsonb)
      from (select gs::date as day from generate_series(since::timestamp, (now() at time zone 'Asia/Jakarta')::date::timestamp, interval '1 day') as gs) g
      left join (
        select (created_at at time zone 'Asia/Jakarta')::date as day, count(*) as n
        from public.qr_scans where destination_id = dest and created_at >= since_ts
        group by 1
      ) c on c.day = g.day
    ),
    'top', (
      select coalesce(jsonb_agg(jsonb_build_object('qr', qr_id, 'v', n) order by n desc), '[]'::jsonb)
      from (select qr_id, count(*) as n from public.qr_scans where destination_id = dest and created_at >= since_ts group by qr_id order by n desc limit 5) t
    ),
    'survey', (select jsonb_build_object('avg', round(avg(rating)::numeric, 1), 'n', count(*)) from public.surveys where destination_id = dest)
  ) into result;
  return result;
end;
$$;

-- kuota Kobi: +1 untuk hari ini (WIB), kembalikan true bila masih di bawah batas
create or replace function public.kobi_hit(uid uuid, lim int)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.kobi_usage as k (user_id, day, count)
  values (uid, (now() at time zone 'Asia/Jakarta')::date, 1)
  on conflict (user_id, day) do update set count = k.count + 1
  returning k.count into n;
  return n <= lim;
end;
$$;

revoke execute on function public.promote_to_manager(text, text) from public, anon, authenticated;
revoke execute on function public.kobi_hit(uuid, int) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.destinations    enable row level security;
alter table public.profiles        enable row level security;
alter table public.zones           enable row level security;
alter table public.pois            enable row level security;
alter table public.animals         enable row level security;
alter table public.qr_points       enable row level security;
alter table public.schedules       enable row level security;
alter table public.item_status     enable row level security;
alter table public.announcements   enable row level security;
alter table public.change_log      enable row level security;
alter table public.favorites       enable row level security;
alter table public.passport_stamps enable row level security;
alter table public.visit_plans     enable row level security;
alter table public.qr_scans        enable row level security;
alter table public.surveys         enable row level security;
alter table public.kobi_usage      enable row level security;

-- konten publik: semua orang boleh baca
create policy "baca publik" on public.destinations  for select using (true);
create policy "baca publik" on public.zones         for select using (true);
create policy "baca publik" on public.pois          for select using (true);
create policy "baca publik" on public.animals       for select using (true);
create policy "baca publik" on public.qr_points     for select using (true);
create policy "baca publik" on public.schedules     for select using (true);
create policy "baca publik" on public.item_status   for select using (true);
create policy "baca publik" on public.announcements for select using (true);

-- pengelola mengubah konten & status destinasinya
create policy "pengelola ubah" on public.zones         for all to authenticated using (public.is_manager(destination_id)) with check (public.is_manager(destination_id));
create policy "pengelola ubah" on public.pois          for all to authenticated using (public.is_manager(destination_id)) with check (public.is_manager(destination_id));
create policy "pengelola ubah" on public.animals       for all to authenticated using (public.is_manager(destination_id)) with check (public.is_manager(destination_id));
create policy "pengelola ubah" on public.qr_points     for all to authenticated using (public.is_manager(destination_id)) with check (public.is_manager(destination_id));
create policy "pengelola ubah" on public.schedules     for all to authenticated using (public.is_manager(destination_id)) with check (public.is_manager(destination_id));
create policy "pengelola ubah" on public.item_status   for all to authenticated using (public.is_manager(destination_id)) with check (public.is_manager(destination_id));
create policy "pengelola kirim" on public.announcements for insert to authenticated with check (public.is_manager(destination_id));
create policy "pengelola hapus" on public.announcements for delete to authenticated using (public.is_manager(destination_id));
create policy "pengelola baca"  on public.change_log    for select to authenticated using (public.is_manager(destination_id));
create policy "pengelola tulis" on public.change_log    for insert to authenticated with check (public.is_manager(destination_id));

-- profil: hanya milik sendiri; kolom yang boleh diubah dibatasi lewat GRANT di bawah
create policy "profil sendiri" on public.profiles for select to authenticated using (id = auth.uid());
create policy "ubah profil sendiri" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (name) on public.profiles to authenticated;

-- data pribadi pengunjung
create policy "milik sendiri" on public.favorites       for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "milik sendiri" on public.passport_stamps for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "milik sendiri" on public.visit_plans     for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- analitik: siapa pun boleh mencatat, hanya pengelola yang membaca
create policy "catat scan" on public.qr_scans for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
create policy "pengelola baca" on public.qr_scans for select to authenticated using (public.is_manager(destination_id));
create policy "isi survei" on public.surveys for insert to authenticated with check (user_id = auth.uid());
create policy "baca survei" on public.surveys for select to authenticated using (user_id = auth.uid() or public.is_manager(destination_id));
-- kobi_usage: tanpa policy = tertutup untuk anon/authenticated (service role tetap bisa)

-- ============================================================
-- Realtime: perubahan status, pengumuman, dan jadwal langsung sampai ke pengunjung
-- ============================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.item_status;   exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.announcements; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.schedules;     exception when duplicate_object then null; end;
  end if;
end $$;
