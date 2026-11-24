-- Proposed PostgreSQL schema for a multi-user, server-backed RandWise.
-- Mirrors src/domain/types.ts. Money as numeric(12,2) in ZAR; quantities in grams/ml.

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  period_start_day smallint not null default 1 check (period_start_day between 1 and 28),
  household_size smallint not null default 1,
  diet text not null default 'none',
  dairy_free boolean not null default false,
  gluten_free boolean not null default false,
  kcal_target int not null default 2000,
  protein_target int not null default 120,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  name text not null,
  grp text not null check (grp in ('fixed','variable','savings')),
  color text not null,
  due_day smallint check (due_day between 1 and 31),
  pay_method text,
  role text,                       -- 'groceries'
  archived boolean not null default false
);

create table budgets (
  user_id uuid not null references users on delete cascade,
  period char(7) not null,         -- 'YYYY-MM' (month the period ends in)
  primary key (user_id, period)
);
create table income_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, period char(7) not null,
  name text not null, amount numeric(12,2) not null check (amount >= 0),
  foreign key (user_id, period) references budgets on delete cascade
);
create table allocations (
  user_id uuid not null, period char(7) not null,
  category_id uuid not null references categories on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  primary key (user_id, period, category_id),
  foreign key (user_id, period) references budgets on delete cascade
);

create table savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  name text not null, target numeric(12,2) not null, opening_balance numeric(12,2) not null default 0,
  target_date date not null, monthly_contribution numeric(12,2) not null default 0,
  category_id uuid references categories on delete set null, color text, created_at timestamptz default now()
);

create table stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,   -- null = shared/global store
  name text not null, color text, website text
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  date date not null, description text not null, amount numeric(12,2) not null,
  category_id uuid references categories on delete set null,
  method text not null, notes text,
  goal_id uuid references savings_goals on delete set null,
  store_id uuid references stores on delete set null,
  created_at timestamptz not null default now()
);
create index on transactions (user_id, date);

create table products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,   -- null = shared catalogue
  name text not null, category text not null, pack_size int not null,
  kcal numeric, protein numeric, carbs numeric, fat numeric,   -- per 100 g
  tags text[] not null default '{}', piece_grams int, piece_label text
);

create table prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  product_id uuid not null references products on delete cascade,
  store_id uuid not null references stores on delete cascade,
  price numeric(10,2) not null, pack_size int not null,
  is_special boolean not null default false, special_ends date, was_price numeric(10,2),
  verified_on date not null, source text not null,   -- manual | flyer | catalogue | sample | receipt | <integration id>
  label text
);
create index on prices (product_id, store_id, verified_on desc);

create table catalogues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  store_id uuid not null references stores on delete cascade,
  title text not null, url text, valid_from date, valid_to date, added_on date not null, item_count int default 0
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,   -- null = built-in
  name text not null, image_url text, emoji text, meal_types text[] not null,
  servings smallint not null, prep_minutes smallint not null, steps text[] not null default '{}', tags text[] default '{}'
);
create table recipe_ingredients (
  recipe_id uuid references recipes on delete cascade,
  product_id uuid references products on delete restrict,
  grams numeric not null,
  primary key (recipe_id, product_id)
);

create table meal_slots (
  user_id uuid not null references users on delete cascade,
  date date not null, meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  recipe_id uuid not null references recipes on delete cascade, servings smallint not null default 1,
  primary key (user_id, date, meal)
);

create table shopping_state (
  user_id uuid not null references users on delete cascade, week date not null,
  checked uuid[] not null default '{}', store_override jsonb not null default '{}', completed_on date,
  primary key (user_id, week)
);

create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  product_id uuid not null references products on delete cascade,
  quantity numeric not null, expiry date, added_on date not null
);
