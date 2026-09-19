
import { createClient } from '@supabase/supabase-js';

/**
 * كود إنشاء الجداول وتفعيل الصلاحيات في Supabase SQL Editor:
 * 
 * -- 1. إنشاء جدول الطلبات
 * create table if not exists orders (
 *   id uuid default gen_random_uuid() primary key,
 *   order_number text not null,
 *   customer_name text not null,
 *   customer_phone text not null,
 *   order_type text default 'Normal',
 *   items jsonb default '[]'::jsonb,
 *   subtotal float8 default 0,
 *   tax float8 default 0,
 *   total float8 default 0,
 *   custom_adjustment float8 default 0,
 *   is_paid boolean default false,
 *   payment_method text default 'Cash',
 *   status text default 'Received',
 *   notified_1h boolean default false,
 *   notified_24h boolean default false,
 *   notified_48h boolean default false,
 *   created_at timestamp with time zone default now(),
 *   updated_at timestamp with time zone default now()
 * );
 * 
 * -- 2. إنشاء جدول الإعدادات
 * create table if not exists settings (
 *   id uuid default gen_random_uuid() primary key,
 *   key text unique not null,
 *   value jsonb not null,
 *   updated_at timestamp with time zone default now()
 * );
 * 
 * -- 3. إنشاء جدول المخزون
 * create table if not exists inventory (
 *   id uuid default gen_random_uuid() primary key,
 *   name text not null,
 *   stock float8 default 0,
 *   unit text default 'كجم',
 *   threshold float8 default 1
 * );
 * 
 * -- 4. إنشاء جدول الملفات الشخصية (Profiles) لإدارة الصلاحيات
 * create table if not exists profiles (
 *   id uuid references auth.users on delete cascade primary key,
 *   email text,
 *   role text default 'staff' check (role in ('admin', 'manager', 'staff')),
 *   full_name text,
 *   laundry_id uuid,
 *   laundry_name text,
 *   saas_plan text,
 *   saas_expiry timestamp with time zone,
 *   saas_status text default 'active',
 *   updated_at timestamp with time zone default now()
 * );
 * 
 * -- 4.1 إنشاء جدول المغاسل (Laundries) لإدارة تعدد المغاسل وساس (Multi-tenant SaaS)
 * create table if not exists laundries (
 *   id uuid default gen_random_uuid() primary key,
 *   name text not null,
 *   owner_id uuid,
 *   subscription_plan text default 'trial', -- 'trial', 'silver', 'gold', 'platinum'
 *   subscription_expiry timestamp with time zone default (now() + interval '14 days'),
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- 4.2 كود تحديث الجداول الحالية لإضافة عمود laundry_id (تعدد المغاسل السحابي):
 * alter table profiles add column if not exists laundry_id uuid;
 * alter table profiles add column if not exists laundry_name text;
 * alter table profiles add column if not exists saas_plan text default 'trial';
 * alter table profiles add column if not exists saas_expiry timestamp with time zone default (now() + interval '14 days');
 * alter table profiles add column if not exists saas_status text default 'active';
 * 
 * alter table orders add column if not exists laundry_id uuid;
 * alter table settings add column if not exists laundry_id uuid;
 * alter table inventory add column if not exists laundry_id uuid;
 * alter table subscription_packages add column if not exists laundry_id uuid;
 * alter table subscriptions add column if not exists laundry_id uuid;
 * alter table categories add column if not exists laundry_id uuid;
 * 
 * -- تعطيل الحماية أو السماح بالوصول العام للجداول (للتجربة السريعة):
 * alter table orders disable row level security;
 * alter table settings disable row level security;
 * alter table inventory disable row level security;
 * alter table profiles disable row level security;
 * alter table laundries disable row level security;
 * 
 * -- وظيفة تلقائية لإنشاء ملف شخصي عند التسجيل
 * create or replace function public.handle_new_user()
 * returns trigger as $$
 * begin
 *   insert into public.profiles (id, email, role)
 *   values (new.id, new.email, 'staff');
 *   return new;
 * end;
 * $$ language plpgsql security definer;
 * 
 * create trigger on_auth_user_created
 *   after insert on auth.users
 *   for each row execute procedure public.handle_new_user();
 * 
 * -- 5. إنشاء جدول باقات الاشتراكات
 * create table if not exists subscription_packages (
 *   id text primary key,
 *   name text not null,
 *   total_items integer not null,
 *   price float8 not null,
 *   duration_days integer not null,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- 6. إنشاء جدول اشتراكات العملاء
 * create table if not exists subscriptions (
 *   id text primary key,
 *   customer_name text not null,
 *   customer_phone text not null,
 *   package_id text references subscription_packages(id),
 *   items_remaining integer not null,
 *   total_items integer not null,
 *   expiry_date timestamp with time zone not null,
 *   is_active boolean default true,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- 7. إنشاء جدول الأصناف (Categories)
 * create table if not exists categories (
 *   id uuid default gen_random_uuid() primary key,
 *   name text not null,
 *   price float8 not null,
 *   icon text default '👕',
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- تعطيل الحماية للجداول الجديدة
 * alter table subscription_packages disable row level security;
 * alter table subscriptions disable row level security;
 * alter table categories disable row level security;
 */

const supabaseUrl = 'https://hoeealjgmfjbojjyodql.supabase.co';
const supabaseKey = 'sb_publishable_Vq7v3naqK8moAXa-L8EwOw_Rpjc55mw';

export const supabase = createClient(supabaseUrl, supabaseKey);
