-- Service-only billing coordination. No changes to listings, scanners or AI.
CREATE TABLE public.billing_operations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lock_token uuid, lock_until timestamptz, checkout_attempt jsonb
);
CREATE TABLE public.stripe_processed_events (
  event_id text PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_operations, public.stripe_processed_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.billing_operations, public.stripe_processed_events TO service_role;

-- Lease serializes Stripe reads per user; token fences late workers.
CREATE FUNCTION public.acquire_billing_operation(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.billing_operations;
BEGIN
  INSERT INTO public.billing_operations(user_id, lock_token, lock_until)
    VALUES (_user_id, gen_random_uuid(), now() + interval '120 seconds')
    ON CONFLICT (user_id) DO UPDATE
      SET lock_token = gen_random_uuid(), lock_until = now() + interval '120 seconds'
      WHERE public.billing_operations.lock_until IS NULL OR public.billing_operations.lock_until < now()
    RETURNING * INTO v;
  IF v.user_id IS NULL THEN RAISE EXCEPTION 'Billing operation in progress'; END IF;
  RETURN jsonb_build_object('token', v.lock_token, 'attempt', v.checkout_attempt);
END $$;

CREATE FUNCTION public.save_billing_attempt(_user_id uuid, _token uuid, _attempt jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.billing_operations SET checkout_attempt = _attempt
    WHERE user_id = _user_id AND lock_token = _token AND lock_until > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing lease expired'; END IF;
END $$;

CREATE FUNCTION public.release_billing_operation(_user_id uuid, _token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.billing_operations SET lock_token = NULL, lock_until = NULL
    WHERE user_id = _user_id AND lock_token = _token;
$$;

-- Fresh Stripe snapshot read under lease. Event and subscription write are atomic.
CREATE FUNCTION public.apply_stripe_subscription(
  _user_id uuid, _token uuid, _event_id text, _snapshot jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.subscriptions;
BEGIN
  PERFORM 1 FROM public.billing_operations
    WHERE user_id = _user_id AND lock_token = _token AND lock_until > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing lease expired'; END IF;
  INSERT INTO public.stripe_processed_events(event_id) VALUES (_event_id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO v FROM public.subscriptions WHERE user_id = _user_id FOR UPDATE;
  IF _snapshot->>'status' = 'canceled' AND v.stripe_subscription_id IS NOT NULL
    AND v.stripe_subscription_id <> _snapshot->>'id' THEN RETURN false; END IF;
  INSERT INTO public.subscriptions(
    user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end
  ) VALUES (
    _user_id, CASE WHEN _snapshot->>'status' = 'canceled' THEN 'free' ELSE _snapshot->>'plan' END,
    _snapshot->>'status', _snapshot->>'customer', _snapshot->>'id',
    (_snapshot->>'current_period_end')::timestamptz,
    coalesce((_snapshot->>'cancel_at_period_end')::boolean, false)
  ) ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan, status = EXCLUDED.status, stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    current_period_end = EXCLUDED.current_period_end, cancel_at_period_end = EXCLUDED.cancel_at_period_end;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.acquire_billing_operation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_billing_attempt(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_billing_operation(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_stripe_subscription(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_billing_operation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_billing_attempt(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_billing_operation(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription(uuid, uuid, text, jsonb) TO service_role;