/* eslint-disable react-refresh/only-export-components -- Test-only service and router mocks. */
export function usePlan() {
  return { data: { tier: "premium", free_ai_sample_used: false } };
}
export function useNavigate() {
  return () => {};
}
export function Link({
  to,
  children,
  ...props
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a href={to} {...props}>
      {children}
    </a>
  );
}
export function useServerFn<T>(fn: T) {
  return fn;
}
export async function analyzeListing() {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return {
    ok: false,
    error: "ai_failed",
    message: "Testovací odpověď. Okno musí zůstat na místě a jít zavřít i při načítání.",
  };
}
