-- =====================================================================
-- BILLING FOUNDATION — Class 2.0 (BƯỚC 8A — PHA B)
-- Project Supabase: wojmdilyflffvdtpovmq · chạy trong SQL Editor (khi được duyệt)
--
-- MỤC ĐÍCH: billing state chính xác, provider-neutral, sẵn sàng nối provider
-- thật sau này. KHÔNG tích hợp provider. KHÔNG entitlement. KHÔNG đụng flow
-- đang chạy (leads/class2-site vẫn hoạt động y nguyên).
--
-- NGUYÊN TẮC:
--   • Additive + idempotent: chỉ CREATE bảng/hàm + SEED. Không DROP, không sửa
--     dữ liệu cũ, không đụng packages/student_packages/edu_course_access.
--   • 4 domain tách biệt: Billing (đây) ≠ Payment (billing_payments) ≠
--     Entitlement (packages/student_packages) ≠ Student (edu_students).
--   • Manual fallback và webhook tương lai đi qua CÙNG Billing Core.
--   • KHÔNG lưu card/CVV/PCI data — billing_events.payload được sanitize.
--
-- ⚠️ 'billing_customers', 'billing_provider_customers', 'billing_products',
--    'billing_subscriptions', 'billing_payments', 'billing_events' ĐÃ được
--    thêm vào self_managed trong db/rls_setup.sql → chạy lại rls_setup
--    KHÔNG xoá policy hẹp dưới đây.
-- =====================================================================

-- ── 1) billing_customers — danh tính billing NỘI BỘ, độc lập provider ──
-- Một khách có thể dùng NHIỀU provider/phương thức thanh toán.
-- Provider identity nằm ở billing_provider_customers (bảng riêng).
create table if not exists public.billing_customers (
  id          bigint generated always as identity primary key,
  lead_id     bigint references public.leads(id)        on delete set null,
  student_id  uuid   references public.edu_students(id) on delete set null,
  name        text,
  email       text,
  phone       text,
  metadata    jsonb      not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists bc_lead_idx    on public.billing_customers (lead_id);
create index if not exists bc_student_idx on public.billing_customers (student_id);
create index if not exists bc_email_idx   on public.billing_customers (lower(email));

-- ── 2) billing_provider_customers — định danh bên provider (metadata ngoài) ──
create table if not exists public.billing_provider_customers (
  id                   bigint generated always as identity primary key,
  billing_customer_id  bigint not null references public.billing_customers(id) on delete cascade,
  provider             text   not null,          -- 'pending' khi chưa chốt; 'manual'; provider thật sau này
  provider_customer_id text   not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (provider, provider_customer_id),
  unique (billing_customer_id, provider)
);
create index if not exists bpc_customer_idx on public.billing_provider_customers (billing_customer_id);

-- ── 3) billing_products — catalog giá (nguồn sự thật duy nhất của giá) ──
-- KHÔNG hardcode giá rải rác ngoài catalog này.
create table if not exists public.billing_products (
  package_code       text primary key,
  name               text not null,
  amount             integer not null check (amount > 0),        -- đơn vị: VND
  currency           text    not null default 'VND',
  interval_months    integer not null default 1 check (interval_months > 0),
  trial_eligibility  boolean not null default false,
  status             text    not null default 'active' check (status in ('draft','active','archived')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- SEED 4 gói Class 2.0 (chính sách BƯỚC 7.2)
insert into public.billing_products
  (package_code, name, amount, currency, interval_months, trial_eligibility, status)
values
  ('khoi_dau_99',   'Khởi đầu — 99K/tháng',            99000,   'VND', 1,  true,  'active'),
  ('can_ban_396',   'Căn bản — 396K/tháng',            396000,  'VND', 1,  true,  'active'),
  ('nang_cao_499',  'Nâng cao — 499K/tháng',           499000,  'VND', 1,  true,  'active'),
  ('hanh_trinh_9990', 'Hành trình cùng Thầy — 9.990K/năm', 9990000, 'VND', 12, false, 'active')
on conflict (package_code) do nothing;

-- ── 4) billing_subscriptions — vòng đời subscription (internal status) ──
create table if not exists public.billing_subscriptions (
  id                        bigint generated always as identity primary key,
  customer_id               bigint not null references public.billing_customers(id) on delete restrict,
  package_code              text   not null check (package_code in
                              ('khoi_dau_99','can_ban_396','nang_cao_499','hanh_trinh_9990')),
  provider                  text   not null default 'pending',  -- 'pending'|'manual'|provider thật
  provider_subscription_id  text,
  status                    text   not null default 'pending' check (status in
                              ('pending','trialing','active','past_due','cancelled','expired')),
  trial_started_at          timestamptz,
  trial_ends_at             timestamptz,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  cancel_at_period_end      boolean not null default false,
  cancelled_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);
create index if not exists bs_customer_idx  on public.billing_subscriptions (customer_id);
create index if not exists bs_status_idx    on public.billing_subscriptions (status);

-- ── 5) billing_payments — từng giao dịch tiền THẬT (tách khỏi subscription) ──
-- Mỗi attempt/giao dịch mới = 1 record MỚI. KHÔNG overwrite lịch sử thất bại.
create table if not exists public.billing_payments (
  id                   bigint generated always as identity primary key,
  customer_id          bigint not null references public.billing_customers(id) on delete restrict,
  subscription_id      bigint references public.billing_subscriptions(id) on delete set null,
  package_code         text check (package_code is null or package_code in
                         ('khoi_dau_99','can_ban_396','nang_cao_499','hanh_trinh_9990')),
  amount               integer not null check (amount > 0),
  currency             text    not null default 'VND',
  provider             text    not null,       -- 'manual' = chuyển khoản
  provider_payment_id  text,
  status               text    not null default 'pending' check (status in
                         ('pending','succeeded','failed','refunded')),
  paid_at              timestamptz,
  failed_at            timestamptz,
  failure_reason       text,
  note                 text,                    -- ghi chú admin / mã giao dịch ngân hàng
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index if not exists bp_customer_idx     on public.billing_payments (customer_id);
create index if not exists bp_subscription_idx on public.billing_payments (subscription_id);
create index if not exists bp_status_idx       on public.billing_payments (status);

-- ── 6) billing_events — audit + idempotency layer ──
create table if not exists public.billing_events (
  id                bigint generated always as identity primary key,
  provider          text not null,
  external_event_id text not null,
  event_type        text not null,          -- raw event type của provider (hoặc manual)
  business_event    text,                   -- internal event đã map
  payload           jsonb not null default '{}'::jsonb,   -- sanitized — KHÔNG card data
  customer_id       bigint references public.billing_customers(id)     on delete set null,
  subscription_id   bigint references public.billing_subscriptions(id) on delete set null,
  payment_id        bigint references public.billing_payments(id)      on delete set null,
  status            text not null default 'received' check (status in
                      ('received','processed','skipped_duplicate','failed')),
  processed_at      timestamptz,
  error             text,
  created_at        timestamptz not null default now(),
  unique (provider, external_event_id)
);
create index if not exists be_created_idx on public.billing_events (created_at);

-- =====================================================================
-- RLS — 6 bảng billing: KHÔNG policy cho anon (không đọc/ghi gì).
-- authenticated CHỈ ĐƯỢC ĐỌC khi là teacher (xem Billing trên Admin).
-- KHÔNG có policy INSERT/UPDATE/DELETE → mọi write business state phải
-- đi qua SECURITY DEFINER functions dưới đây.
-- =====================================================================
alter table public.billing_customers enable row level security;
alter table public.billing_provider_customers enable row level security;
alter table public.billing_products enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_events enable row level security;

drop policy if exists billing_customers_read          on public.billing_customers;
drop policy if exists billing_provider_customers_read on public.billing_provider_customers;
drop policy if exists billing_products_read           on public.billing_products;
drop policy if exists billing_subscriptions_read      on public.billing_subscriptions;
drop policy if exists billing_payments_read           on public.billing_payments;
drop policy if exists billing_events_read             on public.billing_events;

create policy billing_customers_read          on public.billing_customers
  for select to authenticated using (public.is_teacher());
create policy billing_provider_customers_read on public.billing_provider_customers
  for select to authenticated using (public.is_teacher());
create policy billing_products_read           on public.billing_products
  for select to authenticated using (public.is_teacher());
create policy billing_subscriptions_read      on public.billing_subscriptions
  for select to authenticated using (public.is_teacher());
create policy billing_payments_read           on public.billing_payments
  for select to authenticated using (public.is_teacher());
create policy billing_events_read             on public.billing_events
  for select to authenticated using (public.is_teacher());

-- =====================================================================
-- BILLING CORE (provider-neutral, SECURITY DEFINER)
-- =====================================================================

-- ── A) Sanitize payload: xoá key nhạy cảm (card/CVV/PCI) — phòng thủ thêm
--       trên đường biên; adapter thật sau này phải tự lọc trước khi gọi. ──
create or replace function public.billing_sanitize_payload(p jsonb)
returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  k text;
  v_sensitive text[] := array[
    'card', 'card_number', 'cvc', 'cvv', 'expiry', 'exp_month', 'exp_year',
    'pan', 'iban', 'account_number', 'pin', 'password', 'secret'
  ];
begin
  if p is null then return '{}'::jsonb; end if;
  for k in select key from jsonb_object_keys(p) as x(key) loop
    if exists (select 1 from unnest(v_sensitive) s where lower(k) like '%' || s || '%') then
      p := p - k;
    end if;
  end loop;
  return p;
end; $$;

-- ── B) Đảm bảo billing customer tồn tại từ lead (nội bộ) ──
create or replace function public.billing_ensure_customer(
  p_lead_id bigint default null,
  p_name    text   default null,
  p_email   text   default null,
  p_phone   text   default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
begin
  if p_lead_id is not null then
    select id into v_id from public.billing_customers where lead_id = p_lead_id limit 1;
  end if;
  if v_id is null then
    insert into public.billing_customers (lead_id, name, email, phone)
      values (p_lead_id, p_name, p_email, p_phone)
      returning id into v_id;
  else
    update public.billing_customers
      set name  = coalesce(p_name,  name),
          email = coalesce(p_email, email),
          phone = coalesce(p_phone, phone),
          updated_at = now()
      where id = v_id;
  end if;
  return v_id;
end; $$;

-- ── C) Áp business event → state transition (nội bộ, raise khi invalid) ──
-- Transition map (internal status — độc lập provider):
--   subscription:
--     pending --PAYMENT_METHOD_CONFIRMED--> trialing (trial_eligibility + không manual)
--     pending --PAYMENT_METHOD_CONFIRMED--> active    (không trial / manual)
--     pending --SUBSCRIPTION_TRIAL_STARTED-> trialing (provider báo trial thật)
--     pending --PAYMENT_SUCCEEDED---------> active    (không trial)
--     trialing --PAYMENT_SUCCEEDED--------> trialing  (period đã đặt từ lúc trial)
--     active   --PAYMENT_SUCCEEDED--------> active    (gia hạn period)
--     past_due --PAYMENT_SUCCEEDED--------> active    (trả nợ thành công)
--     active   --PAYMENT_FAILED-----------> past_due
--     pending/trialing/active/past_due --SUBSCRIPTION_CANCELLED--> cancelled
--     active + cancel_at_period_end=true --> giữ active, chờ hết period
--   payment:
--     pending --PAYMENT_SUCCEEDED--> succeeded (paid_at)
--     pending --PAYMENT_FAILED----> failed    (failed_at + reason)
create or replace function public.billing_apply_event_internal(
  p_business_event text,
  p_subscription_id bigint default null,
  p_payment_id      bigint default null,
  p_payload         jsonb  default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_sub        record;
  v_pay        record;
  v_product    record;
  v_trial_start timestamptz;
  v_interval   integer;
  v_now        timestamptz := now();
begin
  if p_subscription_id is not null then
    select * into v_sub from public.billing_subscriptions where id = p_subscription_id;
    if v_sub.id is null then raise exception 'subscription % không tồn tại', p_subscription_id; end if;
    select * into v_product from public.billing_products where package_code = v_sub.package_code;
    if v_product.package_code is null then raise exception 'package % không có trong catalog', v_sub.package_code; end if;
    v_interval := v_product.interval_months;
  end if;

  if p_payment_id is not null then
    select * into v_pay from public.billing_payments where id = p_payment_id;
    if v_pay.id is null then raise exception 'payment % không tồn tại', p_payment_id; end if;
  end if;

  case p_business_event
    -- ------------------------------------------------ trial / phương thức thanh toán
    when 'PAYMENT_METHOD_CONFIRMED' then
      if v_sub.status <> 'pending' then
        raise exception 'invalid transition: PAYMENT_METHOD_CONFIRMED từ status %', v_sub.status;
      end if;
      if v_product.trial_eligibility and v_sub.provider <> 'manual' then
        v_trial_start := coalesce((p_payload ->> 'confirmed_at')::timestamptz, v_now);
        update public.billing_subscriptions
          set status = 'trialing',
              trial_started_at = v_trial_start,
              trial_ends_at    = v_trial_start + make_interval(months => v_interval),
              current_period_start = v_trial_start + make_interval(months => v_interval),
              current_period_end   = v_trial_start + make_interval(months => v_interval * 2),
              updated_at = v_now
          where id = p_subscription_id;
        -- Sync legacy 1 chiều: leads.trial_started_at (giữ nguyên, không DROP)
        update public.leads l
          set trial_started_at = v_trial_start
          from public.billing_customers c
          where c.id = v_sub.customer_id and l.id = c.lead_id
            and (l.trial_started_at is null or l.trial_started_at <> v_trial_start);
      else
        update public.billing_subscriptions
          set status = 'active',
              current_period_start = v_now,
              current_period_end   = v_now + make_interval(months => v_interval),
              updated_at = v_now
          where id = p_subscription_id;
      end if;
      return jsonb_build_object('subscription_status',
        (select status from public.billing_subscriptions where id = p_subscription_id));

    when 'SUBSCRIPTION_TRIAL_STARTED' then
      if v_sub.status <> 'pending' then
        raise exception 'invalid transition: SUBSCRIPTION_TRIAL_STARTED từ status %', v_sub.status;
      end if;
      if not v_product.trial_eligibility or v_sub.provider = 'manual' then
        raise exception 'invalid transition: gói % không đủ điều kiện trial', v_sub.package_code;
      end if;
      v_trial_start := coalesce((p_payload ->> 'trial_started_at')::timestamptz, v_now);
      update public.billing_subscriptions
        set status = 'trialing',
            trial_started_at = v_trial_start,
            trial_ends_at    = v_trial_start + make_interval(months => v_interval),
            current_period_start = v_trial_start + make_interval(months => v_interval),
            current_period_end   = v_trial_start + make_interval(months => v_interval * 2),
            updated_at = v_now
        where id = p_subscription_id;
      update public.leads l
        set trial_started_at = v_trial_start
        from public.billing_customers c
        where c.id = v_sub.customer_id and l.id = c.lead_id
          and (l.trial_started_at is null or l.trial_started_at <> v_trial_start);
      return jsonb_build_object('subscription_status', 'trialing');

    -- ------------------------------------------------ thanh toán
    when 'PAYMENT_SUCCEEDED' then
      if v_pay.status <> 'pending' then
        raise exception 'invalid transition: PAYMENT_SUCCEEDED trên payment status %', v_pay.status;
      end if;
      update public.billing_payments
        set status = 'succeeded', paid_at = coalesce((p_payload ->> 'paid_at')::timestamptz, v_now),
            updated_at = v_now
        where id = p_payment_id;
      if v_sub.id is not null then
        if v_sub.status = 'pending' then
          update public.billing_subscriptions
            set status = 'active',
                current_period_start = v_now,
                current_period_end   = v_now + make_interval(months => v_interval),
                updated_at = v_now
            where id = p_subscription_id;
        elsif v_sub.status = 'past_due' then
          update public.billing_subscriptions
            set status = 'active',
                current_period_start = case when v_sub.current_period_end >= v_now
                                            then v_sub.current_period_start else v_now end,
                current_period_end = case when v_sub.current_period_end >= v_now
                                          then v_sub.current_period_end + make_interval(months => v_interval)
                                          else v_now + make_interval(months => v_interval) end,
                updated_at = v_now
            where id = p_subscription_id;
        elsif v_sub.status = 'active' then
          -- gia hạn (manual top-up giữa kỳ): nối tiếp từ cuối period hiện tại
          update public.billing_subscriptions
            set current_period_end = case when v_sub.current_period_end >= v_now
                                          then v_sub.current_period_end + make_interval(months => v_interval)
                                          else v_now + make_interval(months => v_interval) end,
                updated_at = v_now
            where id = p_subscription_id;
        elsif v_sub.status in ('cancelled','expired') then
          raise exception 'invalid transition: PAYMENT_SUCCEEDED trên subscription %', v_sub.status;
        end if; -- trialing: giữ nguyên — period đã đặt từ lúc trial
      end if;
      return jsonb_build_object('payment_status', 'succeeded',
        'subscription_status', (select status from public.billing_subscriptions where id = p_subscription_id));

    when 'PAYMENT_FAILED' then
      if v_pay.status <> 'pending' then
        raise exception 'invalid transition: PAYMENT_FAILED trên payment status %', v_pay.status;
      end if;
      update public.billing_payments
        set status = 'failed',
            failed_at = coalesce((p_payload ->> 'failed_at')::timestamptz, v_now),
            failure_reason = coalesce(p_payload ->> 'failure_reason', p_payload ->> 'reason'),
            updated_at = v_now
        where id = p_payment_id;
      if v_sub.id is not null and v_sub.status = 'active' then
        update public.billing_subscriptions set status = 'past_due', updated_at = v_now
          where id = p_subscription_id;
      end if;
      return jsonb_build_object('payment_status', 'failed',
        'subscription_status', (select status from public.billing_subscriptions where id = p_subscription_id));

    -- ------------------------------------------------ huỷ
    when 'SUBSCRIPTION_CANCELLED' then
      if v_sub.status = 'cancelled' then
        raise exception 'invalid transition: subscription đã cancelled';
      end if;
      if v_sub.status = 'active' and coalesce((p_payload ->> 'cancel_at_period_end')::boolean, false) then
        update public.billing_subscriptions
          set cancel_at_period_end = true, cancelled_at = v_now, updated_at = v_now
          where id = p_subscription_id;
      else
        update public.billing_subscriptions
          set status = 'cancelled', cancelled_at = v_now, updated_at = v_now
          where id = p_subscription_id;
      end if;
      return jsonb_build_object('subscription_status',
        (select status from public.billing_subscriptions where id = p_subscription_id));

    else
      raise exception 'unknown business event: %', p_business_event;
  end case;
end; $$;

-- ── D) INGEST EVENT — nhận event (webhook service-role HOẶC manual) ──
-- Idempotency: unique(provider, external_event_id).
--   • Trùng → trả skipped_duplicate, KHÔNG apply lần hai, KHÔNG overwrite cũ.
--   • Transition fail → event status failed + error (audit/retry).
--   • Chỉ đánh dấu processed SAU KHI transition thành công (cùng transaction).
create or replace function public.billing_ingest_event(
  p_provider          text,
  p_external_event_id text,
  p_event_type        text,
  p_business_event    text,
  p_payload           jsonb  default '{}'::jsonb,
  p_customer_id       bigint default null,
  p_subscription_id   bigint default null,
  p_payment_id        bigint default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_event_id bigint;
  v_result   jsonb;
begin
  if p_provider is null or btrim(p_provider) = '' then
    raise exception 'provider bắt buộc';
  end if;
  if p_external_event_id is null or btrim(p_external_event_id) = '' then
    raise exception 'external_event_id bắt buộc';
  end if;

  insert into public.billing_events
    (provider, external_event_id, event_type, business_event, payload,
     customer_id, subscription_id, payment_id, status)
  values
    (p_provider, p_external_event_id, p_event_type, p_business_event,
     public.billing_sanitize_payload(p_payload),
     p_customer_id, p_subscription_id, p_payment_id, 'received')
  on conflict (provider, external_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('event_id', null, 'status', 'skipped_duplicate',
                              'applied', false,
                              'message', 'external_event_id đã xử lý trước đó');
  end if;

  begin
    v_result := public.billing_apply_event_internal(
                  p_business_event, p_subscription_id, p_payment_id, p_payload);
    update public.billing_events
      set status = 'processed', processed_at = now(),
          subscription_id = coalesce(p_subscription_id, subscription_id),
          payment_id      = coalesce(p_payment_id, payment_id)
      where id = v_event_id;
    return jsonb_build_object('event_id', v_event_id, 'status', 'processed',
                              'applied', true, 'result', v_result);
  exception when others then
    update public.billing_events
      set status = 'failed', processed_at = now(), error = sqlerrm
      where id = v_event_id;
    return jsonb_build_object('event_id', v_event_id, 'status', 'failed',
                              'applied', false, 'error', sqlerrm);
  end;
end; $$;

-- ── E) MANUAL FALLBACK — Thầy xác nhận chuyển khoản (teacher only) ──
-- Chuyển khoản: KHÔNG trial (chính sách BƯỚC 7.2). Tạo payment record mới
-- cho MỖI lần xác nhận; mã giao dịch trùng bị chặn bởi unique(provider,
-- provider_payment_id). Đi qua CÙNG Billing Core (billing_ingest_event).
create or replace function public.billing_record_manual_payment(
  p_package_code    text,
  p_transaction_ref text,               -- mã giao dịch/số bút toán ngân hàng
  p_lead_id         bigint  default null,
  p_amount          integer default null,
  p_note            text    default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id bigint;
  v_product     record;
  v_sub_id      bigint;
  v_pay_id      bigint;
  v_name        text;
  v_email       text;
  v_phone       text;
begin
  if not public.is_teacher() then
    raise exception 'Chỉ Thầy mới được ghi nhận thanh toán';
  end if;
  if p_transaction_ref is null or btrim(p_transaction_ref) = '' then
    raise exception 'Mã giao dịch bắt buộc';
  end if;

  select * into v_product from public.billing_products
    where package_code = p_package_code and status = 'active';
  if v_product.package_code is null then
    raise exception 'Gói % không tồn tại hoặc chưa kích hoạt', p_package_code;
  end if;

  -- đảm bảo customer từ lead (không giả định lead tồn tại mãi)
  v_name := null; v_email := null; v_phone := null;
  if p_lead_id is not null then
    select name, email, phone into v_name, v_email, v_phone
      from public.leads where id = p_lead_id;
    if v_name is null and v_phone is null and v_email is null and not exists
       (select 1 from public.leads where id = p_lead_id) then
      raise exception 'Lead % không tồn tại', p_lead_id;
    end if;
  end if;
  v_customer_id := public.billing_ensure_customer(p_lead_id, v_name, v_email, v_phone);

  -- subscription manual: tìm đang mở, chưa có → tạo pending
  select id into v_sub_id from public.billing_subscriptions
    where customer_id = v_customer_id and package_code = p_package_code
      and provider = 'manual' and status in ('pending','trialing','active','past_due')
    order by id desc limit 1;
  if v_sub_id is null then
    insert into public.billing_subscriptions (customer_id, package_code, provider, status)
      values (v_customer_id, p_package_code, 'manual', 'pending')
      returning id into v_sub_id;
  end if;

  -- payment record MỚI cho giao dịch này (không overwrite lịch sử)
  insert into public.billing_payments
    (customer_id, subscription_id, package_code, amount, currency,
     provider, provider_payment_id, status, note)
  values
    (v_customer_id, v_sub_id, p_package_code,
     coalesce(p_amount, v_product.amount), v_product.currency,
     'manual', p_transaction_ref, 'pending', p_note)
  returning id into v_pay_id;

  -- đi qua CÙNG Billing Core như webhook tương lai
  return public.billing_ingest_event(
    'manual', 'manual:' || p_transaction_ref, 'payment.manual_confirmed',
    'PAYMENT_SUCCEEDED', jsonb_build_object('transaction_ref', p_transaction_ref),
    v_customer_id, v_sub_id, v_pay_id);
end; $$;

-- ── QUYỀN THỰC THI ──
-- ingest: chỉ service_role (webhook) + gọi nội bộ từ manual function.
revoke all on function public.billing_ingest_event(text, text, text, text, jsonb, bigint, bigint, bigint) from public, anon, authenticated;
-- manual: teacher (authenticated) gọi qua Admin; guard is_teacher bên trong.
revoke all on function public.billing_record_manual_payment(text, text, bigint, integer, text) from public, anon;
grant execute on function public.billing_record_manual_payment(text, text, bigint, integer, text) to authenticated;
-- nội bộ — không ai gọi trực tiếp ngoài owner/service_role
revoke all on function public.billing_apply_event_internal(text, bigint, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.billing_ensure_customer(bigint, text, text, text) from public, anon, authenticated;
revoke all on function public.billing_sanitize_payload(jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
