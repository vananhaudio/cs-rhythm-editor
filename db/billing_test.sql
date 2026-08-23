-- =====================================================================
-- TEST — Billing Foundation (BƯỚC 8A — PHA B)
-- CHẠY TRONG TRANSACTION (begin + test + rollback) — KHÔNG để lại gì
-- trên DB thật. Chạy SAU db/billing_setup.sql.
--
-- Bao phủ A→Q theo đặc tả PHA B mục 16:
--   A. Seed 4 billing products đúng giá/trial
--   B. Tạo billing customer độc lập provider (không có cột provider)
--   C. Provider identity tách riêng (billing_provider_customers)
--   D. Tạo subscription pending
--   E. PAYMENT_METHOD_CONFIRMED → trialing
--   F. trial_started_at/ends đúng chính sách 1 tháng
--   G. PAYMENT_SUCCEEDED → payment record + subscription state đúng
--   H. PAYMENT_FAILED → lưu failed, không mất lịch sử
--   I. Retry mới → payment record mới, failed cũ không đổi
--   J. SUBSCRIPTION_CANCELLED → state đúng
--   K. Duplicate external_event_id → không apply lần hai
--   L. Invalid transition → bị từ chối/audit failed
--   M. anon không đọc/ghi billing
--   N. authenticated thường không tự set active/succeeded
--   O. lead/student/packages/entitlement cũ không đổi
--   P. Leads hiện có (134+) không bị migration làm thay đổi
--   Q. Không card/CVV/PCI data trong schema
-- =====================================================================
begin;

-- ── Chuẩn bị: mô phỏng caller là Thầy ──
select set_config('request.jwt.claims',
  json_build_object('sub', (select u.id from public.app_users u where u.role in ('teacher','admin') limit 1))::text,
  true);

do $$
declare
  v_teacher     uuid := (select id from public.app_users where role in ('teacher','admin') limit 1);
  v_student_uid uuid := (select user_id from public.edu_students where user_id is not null limit 1);
  v_cust        bigint;
  v_pc          bigint;
  v_sub_trial   bigint;
  v_pay1        bigint;
  v_pay2        bigint;
  v_sub_active  bigint;
  v_sub_manual  bigint;
  v_cust2       bigint;
  v_ev          jsonb;
  v_r           record;
  v_fail_caught text;
  v_counts_before jsonb;
  v_counts_after  jsonb;
  v_anon_n int;
  v_pay_before int;
  v_pay_after  int;
  v_evt_before int;
  v_evt_after  int;
begin
  if v_teacher is null then raise exception 'KHÔNG CÓ TEACHER ĐỂ TEST (is_teacher)'; end if;

  -- Snapshot trước (O + P)
  select jsonb_build_object(
    'leads',              (select count(*) from public.leads),
    'edu_students',       (select count(*) from public.edu_students),
    'packages',           (select count(*) from public.packages),
    'student_packages',   (select count(*) from public.student_packages),
    'edu_course_access',  (select count(*) from public.edu_course_access),
    'edu_enrollments',    (select count(*) from public.edu_enrollments)
  ) into v_counts_before;

  -- ═══ A. Seed 4 products đúng giá/trial ═══
  if (select count(*) from public.billing_products) < 4 then
    raise exception 'FAIL A: thiếu seed billing_products';
  end if;
  if (select amount from public.billing_products where package_code = 'khoi_dau_99')   <> 99000   then raise exception 'FAIL A: giá 99K'; end if;
  if (select amount from public.billing_products where package_code = 'can_ban_396')   <> 396000  then raise exception 'FAIL A: giá 396K'; end if;
  if (select amount from public.billing_products where package_code = 'nang_cao_499')  <> 499000  then raise exception 'FAIL A: giá 499K'; end if;
  if (select amount from public.billing_products where package_code = 'hanh_trinh_9990') <> 9990000 then raise exception 'FAIL A: giá 9.990K'; end if;
  if (select count(*) from public.billing_products where trial_eligibility) <> 3 then raise exception 'FAIL A: trial eligibility'; end if;
  if (select trial_eligibility from public.billing_products where package_code = 'hanh_trinh_9990') then raise exception 'FAIL A: 9.990K có trial'; end if;
  if (select interval_months from public.billing_products where package_code = 'hanh_trinh_9990') <> 12 then raise exception 'FAIL A: interval 12'; end if;

  -- ═══ B. Customer độc lập provider ═══
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'billing_customers'
               and column_name in ('provider','provider_customer_id')) then
    raise exception 'FAIL B: billing_customers có cột provider';
  end if;
  select public.billing_ensure_customer(null, 'Tester Billing', 'tester@example.com', '0900000001') into v_cust;
  if v_cust is null then raise exception 'FAIL B: không tạo được customer'; end if;

  -- ═══ C. Provider identity riêng ═══
  insert into public.billing_provider_customers (billing_customer_id, provider, provider_customer_id)
    values (v_cust, 'test_provider', 'pc_test_1') returning id into v_pc;
  -- unique(billing_customer_id, provider): provider thứ 2 khác OK; trùng provider → lỗi
  insert into public.billing_provider_customers (billing_customer_id, provider, provider_customer_id)
    values (v_cust, 'test_provider_2', 'pc_test_2');
  begin
    insert into public.billing_provider_customers (billing_customer_id, provider, provider_customer_id)
      values (v_cust, 'test_provider', 'pc_test_3');
    raise exception 'FAIL C: unique(billing_customer_id, provider) không chặn trùng';
  exception when unique_violation then null;
  end;
  begin
    -- customer KHÁC + cùng (provider, provider_customer_id) → vi phạm
    declare v_cust2 bigint;
    begin
      select public.billing_ensure_customer(null, 'Tester 2', 'tester2@example.com', '0900000002') into v_cust2;
      insert into public.billing_provider_customers (billing_customer_id, provider, provider_customer_id)
        values (v_cust2, 'test_provider', 'pc_test_1');
      raise exception 'FAIL C: unique(provider, provider_customer_id) không chặn trùng';
    exception when unique_violation then null;
    end;
  end;

  -- ═══ D. Subscription pending ═══
  insert into public.billing_subscriptions (customer_id, package_code, provider, provider_subscription_id, status)
    values (v_cust, 'can_ban_396', 'test_provider', 'sub_trial_1', 'pending')
    returning id into v_sub_trial;
  if (select status from public.billing_subscriptions where id = v_sub_trial) <> 'pending' then
    raise exception 'FAIL D: subscription không ở pending';
  end if;

  -- ═══ E. PAYMENT_METHOD_CONFIRMED → trialing ═══
  v_ev := public.billing_ingest_event('test_provider', 'evt_confirm_1', 'payment_method.attached',
            'PAYMENT_METHOD_CONFIRMED', '{}'::jsonb, v_cust, v_sub_trial, null);
  if v_ev ->> 'status' <> 'processed' then raise exception 'FAIL E: %', v_ev; end if;
  if (select status from public.billing_subscriptions where id = v_sub_trial) <> 'trialing' then
    raise exception 'FAIL E: subscription không trialing';
  end if;

  -- ═══ F. trial 1 tháng ═══
  select * into v_r from public.billing_subscriptions where id = v_sub_trial;
  if v_r.trial_started_at is null or v_r.trial_ends_at is null then raise exception 'FAIL F: thiếu trial timestamps'; end if;
  if v_r.trial_ends_at <> v_r.trial_started_at + interval '1 month' then raise exception 'FAIL F: trial không đúng 1 tháng'; end if;
  if v_r.current_period_start <> v_r.trial_ends_at then raise exception 'FAIL F: period start <> trial end'; end if;
  if v_r.current_period_end <> v_r.trial_ends_at + interval '1 month' then raise exception 'FAIL F: period end sai'; end if;

  -- ═══ G. PAYMENT_SUCCEEDED (lần charge đầu sau trial) ═══
  insert into public.billing_payments (customer_id, subscription_id, package_code, amount, currency, provider, provider_payment_id, status)
    values (v_cust, v_sub_trial, 'can_ban_396', 396000, 'VND', 'test_provider', 'pay_1', 'pending')
    returning id into v_pay1;
  v_ev := public.billing_ingest_event('test_provider', 'evt_pay_ok_1', 'payment.succeeded',
            'PAYMENT_SUCCEEDED', jsonb_build_object('paid_at', now()::text), v_cust, v_sub_trial, v_pay1);
  if v_ev ->> 'status' <> 'processed' then raise exception 'FAIL G: %', v_ev; end if;
  select * into v_r from public.billing_payments where id = v_pay1;
  if v_r.status <> 'succeeded' or v_r.paid_at is null then raise exception 'FAIL G: payment chưa succeeded'; end if;
  if (select status from public.billing_subscriptions where id = v_sub_trial) <> 'trialing' then
    raise exception 'FAIL G: subscription trialing bị đổi trạng thái';
  end if;

  -- ═══ H. PAYMENT_FAILED → lưu failed + sub active → past_due ═══
  -- Chuyển khoản (manual): hàm tự tạo customer + subscription + payment; KHÔNG trial.
  v_ev := public.billing_record_manual_payment('khoi_dau_99', 'CK_TEST_1', null, 99000, 'chuyển khoản test');
  if v_ev ->> 'status' <> 'processed' then raise exception 'FAIL H: manual payment fail %', v_ev; end if;
  select subscription_id, customer_id into v_sub_manual, v_cust2
    from public.billing_payments where provider_payment_id = 'CK_TEST_1';
  if (select status from public.billing_subscriptions where id = v_sub_manual) <> 'active' then
    raise exception 'FAIL H: manual subscription chưa active';
  end if;
  if (select trial_started_at from public.billing_subscriptions where id = v_sub_manual) is not null then
    raise exception 'FAIL H: chuyển khoản KHÔNG được có trial';
  end if;
  if (select provider from public.billing_subscriptions where id = v_sub_manual) <> 'manual' then
    raise exception 'FAIL H: provider subscription không phải manual';
  end if;
  -- payment failed trên sub manual active:
  insert into public.billing_payments (customer_id, subscription_id, package_code, amount, currency, provider, provider_payment_id, status)
    values (v_cust2, v_sub_manual, 'khoi_dau_99', 99000, 'VND', 'test_provider', 'pay_fail_1', 'pending')
    returning id into v_pay2;
  v_ev := public.billing_ingest_event('test_provider', 'evt_pay_fail_1', 'payment.failed',
            'PAYMENT_FAILED', jsonb_build_object('failure_reason', 'insufficient_funds'), v_cust2, v_sub_manual, v_pay2);
  if v_ev ->> 'status' <> 'processed' then raise exception 'FAIL H: %', v_ev; end if;
  select * into v_r from public.billing_payments where id = v_pay2;
  if v_r.status <> 'failed' or v_r.failed_at is null or v_r.failure_reason is null then
    raise exception 'FAIL H: payment failed không lưu đủ';
  end if;
  if (select status from public.billing_subscriptions where id = v_sub_manual) <> 'past_due' then
    raise exception 'FAIL H: subscription không past_due sau failed';
  end if;

  -- ═══ I. Retry mới → payment record MỚI, failed cũ không đổi ═══
  declare v_pay3 bigint;
  begin
    insert into public.billing_payments (customer_id, subscription_id, package_code, amount, currency, provider, provider_payment_id, status)
      values (v_cust2, v_sub_manual, 'khoi_dau_99', 99000, 'VND', 'test_provider', 'pay_retry_2', 'pending')
      returning id into v_pay3;
    v_ev := public.billing_ingest_event('test_provider', 'evt_pay_ok_2', 'payment.succeeded',
              'PAYMENT_SUCCEEDED', '{}'::jsonb, v_cust2, v_sub_manual, v_pay3);
    if v_ev ->> 'status' <> 'processed' then raise exception 'FAIL I: %', v_ev; end if;
    select * into v_r from public.billing_payments where id = v_pay2;
    if v_r.status <> 'failed' then raise exception 'FAIL I: failed record cũ bị overwrite'; end if;
    if (select status from public.billing_payments where id = v_pay3) <> 'succeeded' then
      raise exception 'FAIL I: payment mới chưa succeeded';
    end if;
    if (select status from public.billing_subscriptions where id = v_sub_manual) <> 'active' then
      raise exception 'FAIL I: subscription chưa về active sau retry';
    end if;
  end;

  -- ═══ J. SUBSCRIPTION_CANCELLED ═══
  v_ev := public.billing_ingest_event('test_provider', 'evt_cancel_1', 'subscription.cancelled',
            'SUBSCRIPTION_CANCELLED', '{}'::jsonb, v_cust2, v_sub_manual, null);
  if v_ev ->> 'status' <> 'processed' then raise exception 'FAIL J: %', v_ev; end if;
  if (select status from public.billing_subscriptions where id = v_sub_manual) <> 'cancelled' then
    raise exception 'FAIL J: subscription chưa cancelled';
  end if;

  -- ═══ K. Duplicate external_event_id → không apply lần hai ═══
  select count(*) into v_pay_before from public.billing_payments;
  v_ev := public.billing_ingest_event('test_provider', 'evt_pay_ok_1', 'payment.succeeded',
            'PAYMENT_SUCCEEDED', '{}'::jsonb, v_cust, v_sub_trial, v_pay1);
  if v_ev ->> 'status' <> 'skipped_duplicate' then raise exception 'FAIL K: không báo duplicate %', v_ev; end if;
  select count(*) into v_pay_after from public.billing_payments;
  if v_pay_after <> v_pay_before then raise exception 'FAIL K: duplicate làm thay đổi dữ liệu'; end if;

  -- ═══ L. Invalid transition → event failed + audit ═══
  v_ev := public.billing_ingest_event('test_provider', 'evt_invalid_1', 'payment.succeeded',
            'PAYMENT_SUCCEEDED', '{}'::jsonb, v_cust, v_sub_trial, v_pay1);  -- v_pay1 đã succeeded
  if v_ev ->> 'status' <> 'failed' then raise exception 'FAIL L: invalid transition không bị chặn %', v_ev; end if;
  if (v_ev ->> 'error') !~* 'invalid transition' then raise exception 'FAIL L: thiếu error audit'; end if;
  if (select status from public.billing_events where provider = 'test_provider' and external_event_id = 'evt_invalid_1') <> 'failed' then
    raise exception 'FAIL L: event không ở trạng thái failed';
  end if;
  -- invalid: SUBSCRIPTION_CANCELLED trên sub đã cancelled
  v_ev := public.billing_ingest_event('test_provider', 'evt_invalid_2', 'subscription.cancelled',
            'SUBSCRIPTION_CANCELLED', '{}'::jsonb, v_cust2, v_sub_manual, null);
  if v_ev ->> 'status' <> 'failed' then raise exception 'FAIL L2: cancel trên cancelled không bị chặn'; end if;
  -- invalid: trial cho gói không trial (9.990K)
  declare v_sub_ht bigint;
  begin
    insert into public.billing_subscriptions (customer_id, package_code, provider, provider_subscription_id, status)
      values (v_cust, 'hanh_trinh_9990', 'test_provider', 'sub_ht_1', 'pending')
      returning id into v_sub_ht;
    v_ev := public.billing_ingest_event('test_provider', 'evt_invalid_3', 'payment_method.attached',
              'PAYMENT_METHOD_CONFIRMED', '{}'::jsonb, v_cust, v_sub_ht, null);
    -- gói 9.990K trial_eligibility=false → PAYMENT_METHOD_CONFIRMED → active (không trial), KHÔNG phải lỗi
    if v_ev ->> 'status' <> 'processed' then raise exception 'FAIL L3: %', v_ev; end if;
    if (select status from public.billing_subscriptions where id = v_sub_ht) <> 'active' then
      raise exception 'FAIL L3: 9.990K confirm phải active thẳng (không trial)';
    end if;
    if (select trial_started_at from public.billing_subscriptions where id = v_sub_ht) is not null then
      raise exception 'FAIL L3: 9.990K có trial — sai chính sách';
    end if;
    -- nhưng SUBSCRIPTION_TRIAL_STARTED cho gói không trial → invalid
    v_ev := public.billing_ingest_event('test_provider', 'evt_invalid_4', 'subscription.trial_started',
              'SUBSCRIPTION_TRIAL_STARTED', '{}'::jsonb, v_cust, v_sub_ht, null);
    -- (sub_ht đã active nên cũng invalid; vẫn phải failed)
    if v_ev ->> 'status' <> 'failed' then raise exception 'FAIL L4: trial trên 9.990K không bị chặn'; end if;
  end;

  -- ═══ M. anon không đọc/ghi ═══
  set local role anon;
  select count(*) into v_anon_n from public.billing_customers;
  if v_anon_n <> 0 then raise exception 'FAIL M: anon đọc được billing_customers'; end if;
  begin
    insert into public.billing_customers (name) values ('hacker');
    raise exception 'FAIL M: anon INSERT được billing_customers';
  exception when others then null;
  end;
  -- UPDATE: anon không có policy → 0 rows → state KHÔNG được đổi
  update public.billing_subscriptions set status = 'active' where id = v_sub_trial;
  if (select status from public.billing_subscriptions where id = v_sub_trial) <> 'trialing' then
    raise exception 'FAIL M: anon UPDATE được billing_subscriptions';
  end if;
  reset role;

  -- ═══ N. authenticated thường không tự set active/succeeded ═══
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_uid)::text, true);
  update public.billing_subscriptions set status = 'active' where id = v_sub_trial;
  if (select status from public.billing_subscriptions where id = v_sub_trial) <> 'trialing' then
    raise exception 'FAIL N: học viên tự set subscription active';
  end if;
  begin
    insert into public.billing_payments (customer_id, package_code, amount, currency, provider, status)
      values (v_cust, 'can_ban_396', 99000, 'VND', 'hack', 'succeeded');
    raise exception 'FAIL N: học viên tự tạo payment thành công';
  exception when others then null;
  end;
  reset role;
  -- khôi phục claim teacher
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_teacher)::text, true);

  -- ═══ O + P. Dữ liệu cũ không đổi ═══
  select jsonb_build_object(
    'leads',              (select count(*) from public.leads),
    'edu_students',       (select count(*) from public.edu_students),
    'packages',           (select count(*) from public.packages),
    'student_packages',   (select count(*) from public.student_packages),
    'edu_course_access',  (select count(*) from public.edu_course_access),
    'edu_enrollments',    (select count(*) from public.edu_enrollments)
  ) into v_counts_after;
  if v_counts_before <> v_counts_after then
    raise exception 'FAIL O: dữ liệu cũ bị thay đổi % → %', v_counts_before, v_counts_after;
  end if;
  if (v_counts_before ->> 'leads')::int < 1 then raise exception 'FAIL P: không có lead để kiểm tra'; end if;

  -- ═══ Q. Không card/CVV/PCI data trong schema ═══
  if exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name in ('billing_customers','billing_provider_customers','billing_products',
                           'billing_subscriptions','billing_payments','billing_events')
      and c.column_name ~* 'card|cvv|cvc|expiry|exp_|pan|iban|account_number|pin|password|secret'
  ) then
    raise exception 'FAIL Q: schema chứa cột nhạy cảm (card/CVV/PCI)';
  end if;

  -- sanitize payload: key nhạy cảm bị loại
  if public.billing_sanitize_payload('{"card_number":"4242","note":"ok"}'::jsonb) ? 'card_number' then
    raise exception 'FAIL Q: sanitize không loại card_number';
  end if;
  if not public.billing_sanitize_payload('{"note":"ok"}'::jsonb) ? 'note' then
    raise exception 'FAIL Q: sanitize loại nhầm key thường';
  end if;

  raise notice '════ BILLING TEST A→Q: ALL PASS ════';
end; $$;

rollback;
