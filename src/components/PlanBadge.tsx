import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";

export function PlanBadge() {
  const { data } = usePlan();
  if (!data) return null;
  if (data.is_premium) {
    return (
      <span className="hidden items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black sm:inline-flex">
        <Crown className="h-3 w-3" /> Premium
      </span>
    );
  }
  return (
    <Link
      to="/cenik"
      className="hidden items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 sm:inline-flex"
    >
      Free · Upgradovat
    </Link>
  );
}
