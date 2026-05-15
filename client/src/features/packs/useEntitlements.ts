import { useQuery } from "@tanstack/react-query";
import type { PackDefinition, PackEntitlements, PackIdType } from "@shared/packs";
import { useAuth } from "@/hooks/use-auth";

interface EntitlementsResponse {
  orgId: string;
  packs: PackEntitlements;
  packDefinitions: PackDefinition[];
  isTestingUser?: boolean; // enterpriseTestMode flag
  planKey?: string; // User's current plan key
}

// Plans that qualify for Intelligence Pack access (Evident Max only)
const PACK_ELIGIBLE_PLANS = ["pro_plus", "premium_org", "admin"];

// Plans that qualify for Advanced features (Evident Insights, all modes, etc.)
const ADVANCED_ELIGIBLE_PLANS = ["pro", "pro_plus", "premium_org", "admin"];

export function useEntitlements() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const query = useQuery<EntitlementsResponse>({
    queryKey: ["/api/entitlements"],
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: isAuthenticated && !authLoading,
  });

  const isPackEnabled = (packId: PackIdType): boolean => {
    if (!query.data) return false;
    return query.data.packs[packId] === true;
  };

  const getEnabledPacks = (): PackDefinition[] => {
    if (!query.data) return [];
    return query.data.packDefinitions.filter(
      (pack) => query.data.packs[pack.id as keyof PackEntitlements] === true
    );
  };

  // Check if user has Evident Max plan (for Intelligence Packs)
  const isPackEligiblePlan = (): boolean => {
    const planKey = query.data?.planKey;
    if (!planKey) return false;
    return PACK_ELIGIBLE_PLANS.includes(planKey);
  };

  // Check if user has Evident Advanced+ plan (for Insights, all modes, etc.)
  const isAdvancedPlan = (): boolean => {
    const planKey = query.data?.planKey;
    if (!planKey) return false;
    return ADVANCED_ELIGIBLE_PLANS.includes(planKey);
  };

  return {
    ...query,
    entitlements: query.data?.packs,
    packDefinitions: query.data?.packDefinitions || [],
    isPackEnabled,
    getEnabledPacks,
    isTestingUser: query.data?.isTestingUser || false,
    planKey: query.data?.planKey,
    isPackEligiblePlan,
    isAdvancedPlan,
  };
}
