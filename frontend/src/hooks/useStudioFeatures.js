import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { FEATURE_GATES } from "../constants/studioPlans.js";

export function useStudioUsage() {
  return useQuery({
    queryKey: ["studio-usage"],
    queryFn: async () => (await api.get("/api/studio/usage")).data,
  });
}

export function useStudioFeatures() {
  const { data: usage } = useStudioUsage();
  const tier = usage?.tier || "free";
  const gates = usage?.featureGates || FEATURE_GATES[tier] || FEATURE_GATES.free;

  return {
    tier,
    gates,
    videoAllowed: gates.videoAllowed,
    ttsAllowed: gates.ttsAllowed,
    studioCredits: usage?.studioCredits ?? 0,
    studioCreditPool: usage?.studioCreditPool ?? 15,
    creditsExhausted: (usage?.studioCredits ?? 0) <= 0,
    usageResetAt: usage?.usageResetAt,
  };
}
