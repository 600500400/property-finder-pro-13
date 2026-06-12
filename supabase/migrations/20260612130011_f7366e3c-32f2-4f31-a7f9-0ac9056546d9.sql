CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND plan IN ('premium_monthly','premium_yearly')
      AND status IN ('active','trialing')
      AND current_period_end IS NOT NULL
      AND current_period_end > now()
  );
$$;