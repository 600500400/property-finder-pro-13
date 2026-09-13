CREATE TABLE public.manual_premium_grants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  manual_premium_until timestamptz,
  granted_by uuid REFERENCES auth.users(id),
  granted_by_email text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  note text
);

GRANT SELECT ON public.manual_premium_grants TO authenticated;
GRANT ALL ON public.manual_premium_grants TO service_role;

ALTER TABLE public.manual_premium_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY manual_premium_self_read ON public.manual_premium_grants
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY manual_premium_admin_read ON public.manual_premium_grants
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND plan IN ('premium_monthly','premium_yearly')
      AND status IN ('active','trialing')
      AND current_period_end IS NOT NULL
      AND current_period_end > now()
  ) OR EXISTS (
    SELECT 1 FROM public.manual_premium_grants
    WHERE user_id = _user_id
      AND revoked_at IS NULL
      AND (manual_premium_until IS NULL OR manual_premium_until > now())
  );
$function$;