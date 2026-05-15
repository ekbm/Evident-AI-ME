import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle2, Sparkles, Building2, FileSearch, BarChart3, Shield, Bot, Users, Zap, DollarSign, Scale, ShoppingCart, HardHat, GraduationCap, ExternalLink, Loader2, HelpCircle, FileVideo, Clock, LogIn, ChevronDown, Mail, Lock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PACKS } from "@shared/packs";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { ProUpgradeModal } from "@/components/pro-upgrade-modal";
import { AssessmentRequestModal } from "@/components/assessment-request-modal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useIOSDetection } from "@/hooks/use-ios-detection";
import { useQuery } from "@tanstack/react-query";
import { useEntitlements } from "@/features/packs/useEntitlements";

export default function PricingPage() {
  // ALL HOOKS MUST BE AT THE TOP - DO NOT SCATTER HOOKS
  useDocumentTitle("Plans and Pricing");
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { planKey: userPlanKey } = useEntitlements();
  const [, setLocation] = useLocation();
  
  // All useState calls grouped together - ALL HOOKS AT TOP
  const [showProModal, setShowProModal] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>("pro");
  const [loadingAddon, setLoadingAddon] = useState<string | null>(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentTarget, setAssessmentTarget] = useState<string>("");
  const isIOSApp = useIOSDetection();
  
  // Fetch user's active storage add-ons
  const { data: storageAddonsData } = useQuery<{
    addons: Array<{
      id: string;
      addonKey: string;
      name: string;
      storageBytes: number;
      status: string;
      daysRemaining: number | null;
      isIOSPurchase: boolean;
      expiresAt: string | null;
    }>;
  }>({
    queryKey: ["/api/billing/storage-addons"],
    enabled: isAuthenticated,
  });

  const activeAddons = storageAddonsData?.addons?.filter(a => a.status === "active") || [];

  // Functions come AFTER all hooks
  const openPlanModal = (planKey: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in first to subscribe to a plan.",
      });
      setLocation("/auth");
      return;
    }
    setSelectedPlanKey(planKey);
    setShowProModal(true);
  };

  const handleIOSSubscribe = (planKey: string, period: "monthly" | "yearly" = "monthly") => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in first to subscribe to a plan.",
      });
      setLocation("/auth");
      return;
    }
    // Map plan keys to App Store Connect product IDs
    const planToProductId: Record<string, string> = {
      "starter": "com.evident.assistant.sub.core.lite.monthly",
      "scholar": "com.evident.assistant.sub.core.scholar.monthly",
      "pro": "com.evident.assistant.sub.core.advanced.monthly",
      "pro_plus": "com.evident.assistant.sub.core.max.monthly",
      "proplus": "com.evident.assistant.sub.core.max.monthly",  // alias
    };
    const productId = planToProductId[planKey] || `com.evident.assistant.sub.core.${planKey}.${period}`;
    console.log("[iOS] Requesting purchase for:", productId);
    try {
      if ((window as any).webkit?.messageHandlers?.subscribe) {
        (window as any).webkit.messageHandlers.subscribe.postMessage(productId);
      } else {
        toast({
          title: "In-App Purchase",
          description: "Please use the Subscribe button in your iOS app settings.",
        });
      }
    } catch (error) {
      console.error("iOS subscribe error:", error);
      toast({
        title: "Error",
        description: "Unable to start in-app purchase. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStorageAddonCheckout = async (addonKey: string) => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please sign in to purchase storage upgrades." });
      setLocation("/auth");
      return;
    }
    
    setLoadingAddon(addonKey);
    try {
      const response = await apiRequest("POST", "/api/billing/storage-addon/checkout", { addonKey });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Error", description: data.error || "Failed to start checkout", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to start checkout. Please try again.", variant: "destructive" });
    } finally {
      setLoadingAddon(null);
    }
  };

  const handleIOSStorageAddon = (addonKey: string) => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please sign in to purchase storage upgrades." });
      setLocation("/auth");
      return;
    }
    // Map addon keys to App Store Connect product IDs (non-renewing subscriptions)
    const addonToProductId: Record<string, string> = {
      "storage_5gb": "com.evident.assistant.storage.5gb.pack",
      "storage_10gb": "com.evident.assistant.storage.10gb.pack",
      "storage_25gb": "com.evident.assistant.storage.25gb.pack",
    };
    const productId = addonToProductId[addonKey] || `com.evident.assistant.storage.${addonKey}.pack`;
    console.log("[iOS] Requesting storage addon purchase for:", productId);
    try {
      if ((window as any).webkit?.messageHandlers?.subscribe) {
        (window as any).webkit.messageHandlers.subscribe.postMessage(productId);
      } else {
        toast({
          title: "In-App Purchase",
          description: "Please use the Subscribe button in your iOS app.",
        });
      }
    } catch (error) {
      console.error("iOS storage addon error:", error);
      toast({
        title: "Error",
        description: "Unable to start in-app purchase. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRequestAssessment = () => {
    setAssessmentTarget("NOT_SURE");
    setShowAssessmentModal(true);
  };

  const handleTalkToUs = () => {
    setAssessmentTarget("NAS_SMB");
    setShowAssessmentModal(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-8">
          <Button variant="ghost" size="sm" asChild className="self-start" data-testid="button-back">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Plans and Pricing</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Choose a path that fits how you use Evident.</p>
          </div>
        </div>

        {/* Sign up prompt for non-authenticated users */}
        {!isAuthenticated && (
          <Card className="mb-6 border-accent/30 bg-accent/5">
            <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Free Plan
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Sign up free to save your work and unlock more features
                </span>
              </div>
              <Button asChild size="sm" data-testid="button-pricing-signup">
                <a href="/auth">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign Up Free
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Limited-time bonus storage banner */}
        <Card className="mb-6 border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-500">Limited-Time Bonus Storage for Early Users</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground line-through">500 MB</span>
                <span className="text-green-500 font-bold">1 GB</span>
                <span className="text-xs text-muted-foreground">Lite</span>
              </span>
              <span className="text-amber-500/50">|</span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground line-through">3 GB</span>
                <span className="text-green-500 font-bold">5 GB</span>
                <span className="text-xs text-muted-foreground">Scholar</span>
              </span>
              <span className="text-amber-500/50">|</span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground line-through">5 GB</span>
                <span className="text-green-500 font-bold">7 GB</span>
                <span className="text-xs text-muted-foreground">Advanced</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <section id="personal" className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Personal / Team</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-gradient-to-br from-slate-500/5 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Free</CardTitle>
                  {(!isAuthenticated || userPlanKey === "free" || !userPlanKey) && (
                    <Badge variant="secondary" className="text-xs">Current</Badge>
                  )}
                </div>
                <CardDescription className="text-xs">Try Evident risk-free</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-xs text-muted-foreground border-b pb-2 mb-2">
                  <p>100 MB storage</p>
                  <p>10 documents</p>
                  <p>10 questions / month</p>
                  <p>5 MB max file size</p>
                  <p>10 min audio / video</p>
                </div>

                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>General mode only</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Audio/video transcription</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                    <span>1 export each (Word, PPT, Email)</span>
                  </li>
                </ul>
                <div className="border-t pt-2 mt-2 space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">Unlock with upgrade</p>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/50 list-none">
                    <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>All modes (Finance, Legal, HR)</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/50 list-none">
                    <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Unlimited exports</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/50 list-none">
                    <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Evident Insights</span>
                  </li>
                </div>

                <p className="text-xl font-bold">$0</p>

                {(!isAuthenticated || userPlanKey === "free" || !userPlanKey) ? (
                  <Button variant="secondary" className="w-full" size="sm" disabled data-testid="button-current-plan">
                    Current plan
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" size="sm" disabled data-testid="button-free-plan">
                    Free tier
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-emerald-500" />
                      Evident Lite
                    </CardTitle>
                    {userPlanKey === "starter" && (
                      <Badge variant="secondary" className="text-xs">Current</Badge>
                    )}
                  </div>
                  {userPlanKey !== "starter" && (
                    <Badge className="text-[10px] w-fit bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">First Month Free</Badge>
                  )}
                </div>
                <CardDescription className="text-xs">For light users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-xs text-muted-foreground border-b pb-2 mb-2">
                  <p>
                    <span className="line-through text-muted-foreground/60 mr-1">500 MB</span>
                    <span className="font-bold text-green-500">1 GB storage</span>
                    <span className="text-amber-500 ml-1">(BONUS)</span>
                  </p>
                  <p>25 documents</p>
                  <p>50 questions / month</p>
                  <p>10 MB max file size</p>
                  <p className="font-medium text-emerald-500">5 hrs/mo audio/video (20 min/day)</p>
                </div>

                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>General mode only</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Audio/video transcription</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>10 exports each / month (Word, PPT, Email)</span>
                  </li>
                </ul>
                <div className="border-t pt-2 mt-2 space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">Unlock with upgrade</p>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/50 list-none">
                    <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>All modes (Finance, Legal, HR)</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/50 list-none">
                    <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Unlimited exports</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/50 list-none">
                    <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Evident Insights</span>
                  </li>
                </div>

                <p className="text-xl font-bold">$5<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                <p className="text-xs text-muted-foreground">Payment details required</p>

                {userPlanKey === "starter" ? (
                  <Button variant="secondary" className="w-full" size="sm" disabled data-testid="button-current-starter">
                    Current plan
                  </Button>
                ) : (
                  <Button onClick={() => openPlanModal("starter")} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" size="sm" data-testid="button-upgrade-starter">
                    Get Evident Lite
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-blue-500" />
                      Evident Scholar
                    </CardTitle>
                    {userPlanKey === "scholar" && (
                      <Badge variant="secondary" className="text-xs">Current</Badge>
                    )}
                  </div>
                  {userPlanKey !== "scholar" && (
                    <Badge className="text-[10px] w-fit bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">First Month Free</Badge>
                  )}
                </div>
                <CardDescription className="text-xs">For students & educators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-xs text-muted-foreground border-b pb-2 mb-2">
                  <p>
                    <span className="line-through text-muted-foreground/60 mr-1">3 GB</span>
                    <span className="font-bold text-green-500">5 GB storage</span>
                    <span className="text-amber-500 ml-1">(BONUS)</span>
                  </p>
                  <p>100 documents</p>
                  <p>200 questions / month</p>
                  <p>100 MB max file size</p>
                  <p className="font-medium text-blue-500">20 hrs/mo audio/video (no daily cap)</p>
                </div>

                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span className="font-medium">General, Students & Educators modes</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Lecture transcription</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Study Q&A prep</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Simplify answers</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>External insights with citations</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>25 exports each / month (Word, PPT, Email)</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>.edu email verified</span>
                  </li>
                </ul>
                <div className="border-t pt-2 mt-2 space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">Unlock with Advanced</p>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/50 list-none">
                    <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>All modes (Finance, Legal, HR)</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/50 list-none">
                    <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Unlimited exports</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/50 list-none">
                    <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Evident Insights</span>
                  </li>
                </div>

                <p className="text-xl font-bold">$29<span className="text-xs font-normal text-muted-foreground">/mo</span></p>

                {userPlanKey === "scholar" ? (
                  <Button variant="secondary" className="w-full" size="sm" disabled data-testid="button-current-scholar">
                    Current plan
                  </Button>
                ) : (
                  <Button onClick={() => openPlanModal("scholar")} className="w-full bg-blue-600 hover:bg-blue-700 text-white" size="sm" data-testid="button-upgrade-scholar">
                    Get Evident Scholar
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Evident Advanced
                  </CardTitle>
                  {userPlanKey === "pro" && (
                    <Badge variant="secondary" className="text-xs">Current</Badge>
                  )}
                </div>
                <CardDescription className="text-xs">For power users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-xs text-muted-foreground border-b pb-2 mb-2">
                  <p>
                    <span className="line-through text-muted-foreground/60 mr-1">5 GB</span>
                    <span className="font-bold text-green-500">7 GB storage</span>
                    <span className="text-amber-500 ml-1">(BONUS)</span>
                  </p>
                  <p>1,000 documents</p>
                  <p>500 questions / month</p>
                  <p>25 MB max file size</p>
                  <p className="font-medium text-primary">30 hrs/mo audio/video (60 min/day)</p>
                </div>

                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span className="font-medium text-primary">All modes (Finance, Legal, HR & more)</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Audio/video transcription</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Simplify answers</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>External insights with citations</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Evident Insights - Create reports you can actually use from your Excel data</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span className="font-medium text-primary">Unlimited exports</span>
                  </li>
                </ul>

                <p className="text-xl font-bold">$39<span className="text-xs font-normal text-muted-foreground">/mo</span></p>

                {userPlanKey === "pro" ? (
                  <Button variant="secondary" className="w-full" size="sm" disabled data-testid="button-current-pro">
                    Current plan
                  </Button>
                ) : (
                  <Button onClick={() => openPlanModal("pro")} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" size="sm" data-testid="button-upgrade-pro">
                    Get Evident Advanced
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-chart-2/30 bg-gradient-to-br from-chart-2/10 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-chart-2" />
                    Evident Max
                  </CardTitle>
                  {userPlanKey === "pro_plus" && (
                    <Badge variant="secondary" className="text-xs">Current</Badge>
                  )}
                </div>
                <CardDescription className="text-xs">For heavy usage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-xs text-muted-foreground border-b pb-2 mb-2">
                  <p className="font-medium text-chart-2">10 GB storage</p>
                  <p>5,000 documents</p>
                  <p>2,000 questions / month</p>
                  <p>200 MB max file size</p>
                  <p className="font-medium text-chart-2">75 hrs/mo audio/video (2 hrs/day)</p>
                </div>

                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span className="font-medium text-chart-2">All modes (Finance, Legal, HR & more)</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Audio/video transcription</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Simplify answers</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>External insights with citations</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Evident Insights - Create reports you can actually use from your Excel data</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span className="font-medium text-chart-2">Unlimited exports</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span className="font-medium text-chart-2">OneDrive connection <span className="text-muted-foreground">(Coming Soon)</span></span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Custom workflows <span className="text-muted-foreground">(Coming Soon)</span></span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Scheduled reports <span className="text-muted-foreground">(Coming Soon)</span></span>
                  </li>
                  <li className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>Training data export <span className="text-muted-foreground">(Coming Soon)</span></span>
                  </li>
                </ul>

                <p className="text-xl font-bold">$99<span className="text-xs font-normal text-muted-foreground">/mo</span></p>

                {userPlanKey === "pro_plus" ? (
                  <Button variant="secondary" className="w-full" size="sm" disabled data-testid="button-current-proplus">
                    Current plan
                  </Button>
                ) : (
                  <Button onClick={() => openPlanModal("pro_plus")} className="w-full bg-chart-2 hover:bg-chart-2/90 text-white" size="sm" data-testid="button-upgrade-premium">
                    Get Evident Max
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Plan Comparison Summary */}
          <Collapsible className="mt-6" defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full group" data-testid="button-toggle-comparison">
              <div className="text-left">
                <h3 className="text-lg font-semibold">Compare Plans at a Glance</h3>
                <p className="text-sm text-muted-foreground">See what's included in each plan side by side</p>
              </div>
              <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 shrink-0 ml-2" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs border-collapse" data-testid="table-plan-comparison">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground min-w-[120px]">Feature</th>
                      <th className="text-center py-2 px-2 font-medium min-w-[70px]">Free</th>
                      <th className="text-center py-2 px-2 font-medium text-emerald-600 dark:text-emerald-400 min-w-[70px]">Lite</th>
                      <th className="text-center py-2 px-2 font-medium text-blue-600 dark:text-blue-400 min-w-[70px]">Scholar</th>
                      <th className="text-center py-2 px-2 font-medium text-primary min-w-[70px]">Advanced</th>
                      <th className="text-center py-2 px-2 font-medium text-chart-2 min-w-[70px]">Max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 px-2 font-medium">Price</td>
                      <td className="py-2 px-2 text-center">$0</td>
                      <td className="py-2 px-2 text-center">$5/mo</td>
                      <td className="py-2 px-2 text-center">$29/mo</td>
                      <td className="py-2 px-2 text-center">$39/mo</td>
                      <td className="py-2 px-2 text-center">$99/mo</td>
                    </tr>
                    <tr className="bg-muted/30">
                      <td className="py-2 px-2 font-medium">Storage</td>
                      <td className="py-2 px-2 text-center">100 MB</td>
                      <td className="py-2 px-2 text-center">1 GB</td>
                      <td className="py-2 px-2 text-center">5 GB</td>
                      <td className="py-2 px-2 text-center">7 GB</td>
                      <td className="py-2 px-2 text-center">10 GB</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2 font-medium">Documents</td>
                      <td className="py-2 px-2 text-center">10</td>
                      <td className="py-2 px-2 text-center">25</td>
                      <td className="py-2 px-2 text-center">100</td>
                      <td className="py-2 px-2 text-center">1,000</td>
                      <td className="py-2 px-2 text-center">5,000</td>
                    </tr>
                    <tr className="bg-muted/30">
                      <td className="py-2 px-2 font-medium">Questions / mo</td>
                      <td className="py-2 px-2 text-center">10</td>
                      <td className="py-2 px-2 text-center">50</td>
                      <td className="py-2 px-2 text-center">200</td>
                      <td className="py-2 px-2 text-center">500</td>
                      <td className="py-2 px-2 text-center">2,000</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2 font-medium">Max file size</td>
                      <td className="py-2 px-2 text-center">5 MB</td>
                      <td className="py-2 px-2 text-center">10 MB</td>
                      <td className="py-2 px-2 text-center">100 MB</td>
                      <td className="py-2 px-2 text-center">25 MB</td>
                      <td className="py-2 px-2 text-center">200 MB</td>
                    </tr>
                    <tr className="bg-muted/30">
                      <td className="py-2 px-2 font-medium">Audio / Video</td>
                      <td className="py-2 px-2 text-center">10 min</td>
                      <td className="py-2 px-2 text-center">5 hrs/mo</td>
                      <td className="py-2 px-2 text-center">20 hrs/mo</td>
                      <td className="py-2 px-2 text-center">30 hrs/mo</td>
                      <td className="py-2 px-2 text-center">75 hrs/mo</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2 font-medium">Modes</td>
                      <td className="py-2 px-2 text-center">General</td>
                      <td className="py-2 px-2 text-center">General</td>
                      <td className="py-2 px-2 text-center">General + Study</td>
                      <td className="py-2 px-2 text-center font-medium text-primary">All modes</td>
                      <td className="py-2 px-2 text-center font-medium text-chart-2">All modes</td>
                    </tr>
                    <tr className="bg-muted/30">
                      <td className="py-2 px-2 font-medium">Exports (Word, PPT, Email)</td>
                      <td className="py-2 px-2 text-center">1 each</td>
                      <td className="py-2 px-2 text-center">10/mo each</td>
                      <td className="py-2 px-2 text-center">25/mo each</td>
                      <td className="py-2 px-2 text-center font-medium">Unlimited</td>
                      <td className="py-2 px-2 text-center font-medium">Unlimited</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2 font-medium">External insights</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-center"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" /></td>
                      <td className="py-2 px-2 text-center"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" /></td>
                      <td className="py-2 px-2 text-center"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" /></td>
                    </tr>
                    <tr className="bg-muted/30">
                      <td className="py-2 px-2 font-medium">Evident Insights</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-center"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" /></td>
                      <td className="py-2 px-2 text-center"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2 font-medium">OneDrive connection</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-center"><span className="text-muted-foreground text-[10px]">Soon</span></td>
                    </tr>
                    <tr className="bg-muted/30">
                      <td className="py-2 px-2 font-medium">First month free</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-center"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" /></td>
                      <td className="py-2 px-2 text-center"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" /></td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Video Storage Info Note */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <FileVideo className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Video & Audio Storage Tips</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Use compressed formats (MP3 for audio, MP4 H.264 for video) to maximize your storage. 
                  After transcription, consider deleting original media files to free up space for your monthly limit. 
                  The transcribed text is preserved and fully searchable.
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  <span className="font-medium">About daily caps:</span> Daily limits prevent using your entire monthly allowance in one day. 
                  Unused daily time stays in your monthly pool - skip a day, and that time is still available later in the month.
                </p>
              </div>
            </div>
          </div>

          <Collapsible className="mt-8" id="addons">
            <CollapsibleTrigger className="flex items-center justify-between w-full group" data-testid="button-toggle-upgrade-packs">
              <div className="text-left">
                <h3 className="text-lg font-semibold">Upgrade Packs</h3>
                <p className="text-sm text-muted-foreground">Need more storage or questions? Add extra capacity anytime without changing your plan.</p>
              </div>
              <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 shrink-0 ml-2" />
            </CollapsibleTrigger>
            <CollapsibleContent>
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    Lite Pack
                  </CardTitle>
                  <CardDescription className="text-xs">For light expansion</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      +5 GB extra storage
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      +10 bonus questions/month
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      +2 hrs audio/video
                    </li>
                  </ul>
                  <p className="text-xl font-bold">$5<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                  <Button 
                    className="w-full" 
                    size="sm" 
                    variant="secondary"
                    disabled
                    data-testid="button-addon-5gb"
                  >
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      Standard Pack
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">Best Value</Badge>
                  </div>
                  <CardDescription className="text-xs">Most popular choice</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      +10 GB extra storage
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      +25 bonus questions/month
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      +5 hrs audio/video
                    </li>
                  </ul>
                  <p className="text-xl font-bold">$10<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                  <Button 
                    className="w-full" 
                    size="sm" 
                    variant="secondary"
                    disabled
                    data-testid="button-addon-10gb"
                  >
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-500" />
                    Power Pack
                  </CardTitle>
                  <CardDescription className="text-xs">For power users</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      +25 GB extra storage
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      +50 bonus questions/month
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      +10 hrs audio/video
                    </li>
                  </ul>
                  <p className="text-xl font-bold">$15<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                  <Button 
                    className="w-full" 
                    size="sm" 
                    variant="secondary"
                    disabled
                    data-testid="button-addon-25gb"
                  >
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Upgrade packs coming soon.
            </p>

            {activeAddons.length > 0 && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Your Active Upgrade Packs
                </h4>
                <div className="space-y-2">
                  {activeAddons.map(addon => (
                    <div key={addon.id} className="flex items-center justify-between text-sm bg-background rounded-md px-3 py-2">
                      <span className="font-medium">{addon.name}</span>
                      {addon.isIOSPurchase && addon.daysRemaining !== null && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {addon.daysRemaining} {addon.daysRemaining === 1 ? "day" : "days"} left
                        </Badge>
                      )}
                      {!addon.isIOSPurchase && (
                        <Badge variant="secondary">Auto-renews</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            </CollapsibleContent>
          </Collapsible>

          <CollapsibleIntelligencePacksSection />
        </section>

        <Separator className="my-8" />

        <section id="enterprise" className="mb-12">
          <div className="p-6 rounded-xl bg-gradient-to-r from-primary/5 via-accent/5 to-chart-4/5 border border-primary/10">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-base">Enterprise</h3>
                  <Badge variant="secondary" className="text-[10px]">Launching Soon</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Evident is expanding to support teams, private deployments, and compliance-first workflows.
                </p>
                <p className="text-sm text-muted-foreground">
                  Launching soon. <button onClick={handleTalkToUs} className="text-primary hover:underline inline-flex items-center gap-1 font-medium" data-testid="button-enterprise-contact"><Mail className="w-3.5 h-3.5" />Talk to us</button> to learn more or get early access.
                </p>
              </div>
            </div>
          </div>
        </section>

        <Separator className="my-8" />

        <Collapsible className="mb-12" id="org">
          <CollapsibleTrigger className="flex items-center justify-between w-full group" data-testid="button-toggle-services">
            <h2 className="text-xl font-semibold text-left">Services</h2>
            <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 shrink-0 ml-2" />
          </CollapsibleTrigger>
          <CollapsibleContent>
          <div className="grid md:grid-cols-2 gap-6 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <FileSearch className="w-5 h-5 text-primary" />
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700">Coming Soon</Badge>
                </div>
                <CardTitle className="text-lg">AI Readiness Assessment</CardTitle>
                <CardDescription>One-off</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  A structured, one-time assessment of your document environment: readiness scores, folder heatmap, key risks, and a practical improvement roadmap.
                </p>

                <Button onClick={handleRequestAssessment} className="w-full" data-testid="button-request-assessment">
                  Request an assessment
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700">Coming Soon</Badge>
                </div>
                <CardTitle className="text-lg">Pilot Monitoring</CardTitle>
                <CardDescription>Subscription</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Continuous readiness monitoring for a small pilot scope: scheduled scans, auto preparation, and trends—designed to start safely with real data.
                </p>

                <p className="text-lg font-medium">By scope</p>

                <Button onClick={handleTalkToUs} variant="outline" className="w-full" data-testid="button-talk-to-us">
                  Talk to us
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Services are scoped to your folders and governance needs. We'll help you start small.
          </p>
          </CollapsibleContent>
        </Collapsible>

        <Separator className="my-8" />

        <section id="faq" className="mb-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-lg bg-muted/50 border">
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-semibold">Have questions?</h2>
              <p className="text-sm text-muted-foreground mt-1">Find answers about plans, limits, features, and more.</p>
            </div>
            <Button 
              variant="outline" 
              data-testid="button-view-faq"
              onClick={() => {
                window.location.href = "/faq";
              }}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              View FAQ
            </Button>
          </div>
        </section>

        {/* Apple-required subscription disclosure for iOS users */}
        {isIOSApp && (
          <section id="subscription-disclosure" className="mb-8">
            <div className="p-4 rounded-lg bg-muted/30 border text-center space-y-3">
              <h3 className="font-medium text-sm">Subscription Information</h3>
              <div className="text-xs text-muted-foreground space-y-2">
                <p>
                  All subscriptions are auto-renewable and billed monthly through your Apple ID account.
                  Payment will be charged at confirmation of purchase.
                </p>
                <p>
                  Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
                  Your account will be charged for renewal within 24 hours prior to the end of the current period.
                </p>
                <p>
                  You can manage and cancel your subscriptions by going to your App Store account settings after purchase.
                </p>
              </div>
              <div className="flex justify-center gap-4 text-xs pt-2">
                <Link href="/terms" className="text-primary hover:underline" data-testid="link-terms-pricing">
                  Terms of Use
                </Link>
                <span className="text-muted-foreground">|</span>
                <Link href="/privacy" className="text-primary hover:underline" data-testid="link-privacy-pricing">
                  Privacy Policy
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>

      {showProModal && (
        <ProUpgradeModal open={showProModal} onOpenChange={setShowProModal} planKey={selectedPlanKey} />
      )}
      
      {showAssessmentModal && (
        <AssessmentRequestModal 
          open={showAssessmentModal} 
          onOpenChange={setShowAssessmentModal}
          contextData={{ currentScore: undefined, issuesSummary: undefined, documentCount: undefined }}
        />
      )}
      
    </div>
  );
}

const packIcons: Record<string, any> = {
  DollarSign,
  Scale,
  Users,
  ShoppingCart,
  HardHat,
  Shield,
};

function CollapsibleIntelligencePacksSection() {
  return (
    <Collapsible className="mt-8">
      <CollapsibleTrigger className="flex items-center justify-between w-full group" data-testid="button-toggle-intelligence-packs">
        <div className="flex items-center gap-2 text-left">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <div>
            <h3 className="text-lg font-semibold">Intelligence Packs</h3>
            <p className="text-sm text-muted-foreground">Specialized AI assistants for specific document types</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Badge variant="secondary">Coming Soon</Badge>
          <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Add specialized analysis capabilities for Finance, Legal, HR, Procurement, and more. Each pack unlocks AI-powered features for specific document types.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PACKS.slice(0, 6).map((pack) => {
              const Icon = packIcons[pack.icon] || Sparkles;
              return (
                <div 
                  key={pack.id}
                  className="p-3 rounded-lg border bg-muted/30 opacity-75"
                  data-testid={`pack-card-${pack.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-muted-foreground truncate">
                        {pack.title.replace(" Intelligence Pack", "").replace(" Pack", "")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
