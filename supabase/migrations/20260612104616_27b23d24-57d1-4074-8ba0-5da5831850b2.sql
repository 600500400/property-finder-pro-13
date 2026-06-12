
REVOKE EXECUTE ON FUNCTION public.is_premium(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_premium(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_premium(UUID) TO authenticated, service_role;
