import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPlan, type PlanInfo } from "@/lib/billing/plan.functions";

export function usePlan() {
  const fn = useServerFn(getMyPlan);
  return useQuery<PlanInfo>({
    queryKey: ["my-plan"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}
