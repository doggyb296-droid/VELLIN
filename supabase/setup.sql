create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  is_pro boolean not null default false,
  daily_goal_seconds integer not null default 7200,
  notifications_enabled boolean not null default true,
  sound_enabled boolean not null default false,
  break_reminder_mins integer not null default 25,
  is_dark_mode boolean not null default true,
  distraction_apps text[] not null default '{}'::text[],
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.handle_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists on_profiles_updated on public.profiles;

create trigger on_profiles_updated
before update on public.profiles
for each row
execute procedure public.handle_profiles_updated_at();

create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.handle_user_app_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists on_user_app_state_updated on public.user_app_state;

create trigger on_user_app_state_updated
before update on public.user_app_state
for each row
execute procedure public.handle_user_app_state_updated_at();

alter table public.user_app_state enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own app state" on public.user_app_state;
create policy "Users can read their own app state"
on public.user_app_state
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own app state" on public.user_app_state;
create policy "Users can insert their own app state"
on public.user_app_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own app state" on public.user_app_state;
create policy "Users can update their own app state"
on public.user_app_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null default '',
  avatar_url text,
  public_hours_saved numeric(8, 1) not null default 0,
  public_screen_time_hours numeric(8, 1) not null default 0,
  public_streak integer not null default 0,
  public_sessions integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists social_profiles_username_lower_idx
on public.social_profiles ((lower(username)));

create or replace function public.handle_social_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  new.username = lower(new.username);
  return new;
end;
$$;

drop trigger if exists on_social_profiles_updated on public.social_profiles;

create trigger on_social_profiles_updated
before update on public.social_profiles
for each row
execute procedure public.handle_social_profiles_updated_at();

create table if not exists public.friend_links (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, friend_user_id),
  constraint no_self_friend check (user_id <> friend_user_id)
);

alter table public.social_profiles enable row level security;
alter table public.friend_links enable row level security;

drop policy if exists "Authenticated users can read social profiles" on public.social_profiles;
create policy "Authenticated users can read social profiles"
on public.social_profiles
for select
to authenticated
using (true);

drop policy if exists "Users can insert their own social profile" on public.social_profiles;
create policy "Users can insert their own social profile"
on public.social_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own social profile" on public.social_profiles;
create policy "Users can update their own social profile"
on public.social_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own friend links" on public.friend_links;
create policy "Users can read their own friend links"
on public.friend_links
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own friend links" on public.friend_links;
create policy "Users can insert their own friend links"
on public.friend_links
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own friend links" on public.friend_links;
create policy "Users can delete their own friend links"
on public.friend_links
for delete
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.handle_rate_limit_buckets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists on_rate_limit_buckets_updated on public.rate_limit_buckets;

create trigger on_rate_limit_buckets_updated
before update on public.rate_limit_buckets
for each row
execute procedure public.handle_rate_limit_buckets_updated_at();

alter table public.rate_limit_buckets enable row level security;

create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
as $$
declare
  now_ts timestamptz := timezone('utc'::text, now());
  next_reset timestamptz := now_ts + make_interval(secs => greatest(p_window_seconds, 1));
  updated_count integer;
  updated_reset timestamptz;
begin
  insert into public.rate_limit_buckets (bucket_key, count, reset_at)
  values (p_bucket_key, 1, next_reset)
  on conflict (bucket_key)
  do update set
    count = case
      when public.rate_limit_buckets.reset_at <= now_ts then 1
      else public.rate_limit_buckets.count + 1
    end,
    reset_at = case
      when public.rate_limit_buckets.reset_at <= now_ts then next_reset
      else public.rate_limit_buckets.reset_at
    end,
    updated_at = now_ts
  returning public.rate_limit_buckets.count, public.rate_limit_buckets.reset_at
  into updated_count, updated_reset;

  allowed := updated_count <= p_max_attempts;
  remaining := greatest(0, p_max_attempts - least(updated_count, p_max_attempts));
  reset_at := updated_reset;

  return next;
end;
$$;

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null default 'manual_preview',
  provider_customer_id text,
  provider_subscription_id text unique,
  plan_code text not null default 'pro_monthly',
  status text not null default 'inactive',
  currency text not null default 'USD',
  amount_minor integer not null default 699,
  billing_country text,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint subscriptions_provider_check check (provider in ('manual_preview', 'apple', 'google')),
  constraint subscriptions_status_check check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'expired'))
);

create index if not exists subscriptions_status_idx
on public.subscriptions (status);

create or replace function public.handle_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists on_subscriptions_updated on public.subscriptions;

create trigger on_subscriptions_updated
before update on public.subscriptions
for each row
execute procedure public.handle_subscriptions_updated_at();

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their own subscription"
on public.subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);
