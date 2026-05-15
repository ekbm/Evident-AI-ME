import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check, Sparkles, Gift, FileText, MessageSquare, HardDrive, FileVideo, Zap, Loader2, CreditCard, GraduationCap, Crown, Clock, Apple, ArrowLeft } from "lucide-react";
import { PLAN_LIMITS } from "@shared/models/auth";
import { useToast } from "@/hooks/use-toast";
import { useIOSDetection } from "@/hooks/use-ios-detection";

interface PlanSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSelectPlan: (plan: string) => void;
}

const TRIAL_DAYS = 30; // First month free

export function PlanSelectorModal({ open, onClose, onSelectPlan }: PlanSelectorModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [legalPreview, setLegalPreview] = useState<"terms" | "privacy" | null>(null);
  const { toast } = useToast();
  
  const isIOSApp = useIOSDetection();
  
  // iOS product ID mapping - must match App Store Connect and shared/models/auth.ts
  const IOS_PRODUCT_IDS: Record<string, string> = {
    "starter": "com.evident.assistant.sub.core.lite.monthly",
    "scholar": "com.evident.assistant.sub.core.scholar.monthly",
    "pro": "com.evident.assistant.sub.core.advanced.monthly",
    "pro_plus": "com.evident.assistant.sub.core.max.monthly",
  };
  
  // Handle iOS in-app purchase
  const handleIOSSubscribe = (planKey: string) => {
    const productId = IOS_PRODUCT_IDS[planKey] || `com.evident.assistant.sub.core.${planKey}.monthly`;
    console.log("[iOS] Requesting purchase for:", productId);
    try {
      if ((window as any).webkit?.messageHandlers?.subscribe) {
        (window as any).webkit.messageHandlers.subscribe.postMessage(productId);
        onClose();
      } else {
        console.error("iOS message handler 'subscribe' not available");
        toast({
          title: "Not available",
          description: "In-app purchase is not available. Please ensure you're using the iOS app.",
          variant: "destructive",
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

  // On iOS app, paid plans are available via in-app purchase
  // On web, paid plans show "coming soon" until Stripe is configured
  // Helper to format media limits nicely
  const formatMediaLimit = (monthlyMins: number, dailyMins: number) => {
    if (monthlyMins >= 60) {
      const hours = Math.round(monthlyMins / 60);
      if (dailyMins && dailyMins < monthlyMins) {
        const dailyDisplay = dailyMins >= 60 ? `${Math.round(dailyMins / 60)} hrs` : `${dailyMins} min`;
        return `${hours} hrs/mo (${dailyDisplay}/day)`;
      }
      return `${hours} hrs/mo audio/video`;
    }
    return `${monthlyMins} min/mo audio/video`;
  };

  const plans = [
    {
      id: "free",
      name: PLAN_LIMITS.free.name,
      price: 0,
      description: "Basic access to get started",
      features: [
        { icon: FileText, text: `${PLAN_LIMITS.free.maxDocuments} documents` },
        { icon: MessageSquare, text: `${PLAN_LIMITS.free.queriesPerMonth} questions/month` },
        { icon: HardDrive, text: `${Math.round(PLAN_LIMITS.free.storageBytes / (1024 * 1024))}MB storage` },
        { icon: FileVideo, text: formatMediaLimit(PLAN_LIMITS.free.mediaMinutesPerMonth, PLAN_LIMITS.free.mediaMinutesPerDay) },
      ],
      noBankInfo: true,
      requiresPayment: false,
      comingSoon: false,
    },
    {
      id: "starter",
      name: PLAN_LIMITS.starter.name,
      price: PLAN_LIMITS.starter.price,
      description: "Perfect for individuals",
      features: [
        { icon: FileText, text: `${PLAN_LIMITS.starter.maxDocuments} documents` },
        { icon: MessageSquare, text: `${PLAN_LIMITS.starter.queriesPerMonth} questions/month` },
        { icon: HardDrive, text: `${Math.round(PLAN_LIMITS.starter.storageBytes / (1024 * 1024))}MB storage` },
        { icon: FileVideo, text: formatMediaLimit(PLAN_LIMITS.starter.mediaMinutesPerMonth, PLAN_LIMITS.starter.mediaMinutesPerDay) },
      ],
      popular: true,
      requiresPayment: true,
      comingSoon: false,
      freeIntro: "First month free",
    },
    {
      id: "scholar",
      name: PLAN_LIMITS.scholar.name,
      price: PLAN_LIMITS.scholar.price,
      description: "For students & educators",
      features: [
        { icon: FileText, text: `${PLAN_LIMITS.scholar.maxDocuments} documents` },
        { icon: MessageSquare, text: `${PLAN_LIMITS.scholar.queriesPerMonth} questions/month` },
        { icon: HardDrive, text: `${Math.round(PLAN_LIMITS.scholar.storageBytes / (1024 * 1024 * 1024))}GB storage` },
        { icon: FileVideo, text: formatMediaLimit(PLAN_LIMITS.scholar.mediaMinutesPerMonth, PLAN_LIMITS.scholar.mediaMinutesPerDay) },
      ],
      educationOnly: true,
      requiresPayment: true,
      comingSoon: false,
      freeIntro: "First month free (60 days free for students)",
    },
    {
      id: "pro",
      name: PLAN_LIMITS.pro.name,
      price: PLAN_LIMITS.pro.price,
      description: "For power users",
      features: [
        { icon: FileText, text: `${PLAN_LIMITS.pro.maxDocuments.toLocaleString()} documents` },
        { icon: MessageSquare, text: `${PLAN_LIMITS.pro.queriesPerMonth} questions/month` },
        { icon: HardDrive, text: `${Math.round(PLAN_LIMITS.pro.storageBytes / (1024 * 1024 * 1024))}GB storage` },
        { icon: FileVideo, text: formatMediaLimit(PLAN_LIMITS.pro.mediaMinutesPerMonth, PLAN_LIMITS.pro.mediaMinutesPerDay) },
      ],
      requiresPayment: true,
      comingSoon: false,
    },
    {
      id: "pro_plus",
      name: "Evident Max",
      price: PLAN_LIMITS.pro_plus.price,
      description: "Full power for teams",
      features: [
        { icon: FileText, text: `${PLAN_LIMITS.pro_plus.maxDocuments.toLocaleString()} documents` },
        { icon: MessageSquare, text: `${PLAN_LIMITS.pro_plus.queriesPerMonth.toLocaleString()} questions/month` },
        { icon: HardDrive, text: `${Math.round(PLAN_LIMITS.pro_plus.storageBytes / (1024 * 1024 * 1024))}GB storage` },
        { icon: FileVideo, text: formatMediaLimit(PLAN_LIMITS.pro_plus.mediaMinutesPerMonth, PLAN_LIMITS.pro_plus.mediaMinutesPerDay) },
      ],
      requiresPayment: true,
      comingSoon: false,
    },
  ];

  const selectedPlanData = plans.find(p => p.id === selectedPlan);

  const handleContinue = async () => {
    if (!selectedPlan || !selectedPlanData) return;
    
    setIsSubmitting(true);
    try {
      // For iOS app, use in-app purchase
      if (isIOSApp && selectedPlanData.requiresPayment) {
        handleIOSSubscribe(selectedPlan);
        setIsSubmitting(false);
        return;
      }
      
      // For paid plans on web, redirect to Stripe checkout
      if (selectedPlanData.requiresPayment) {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            plan: selectedPlan, 
            trial: selectedPlan === "starter" || selectedPlan === "scholar"
          }),
        });
        const data = await response.json();
        
        if (data.url) {
          // Save plan selection before redirect
          onSelectPlan(selectedPlan);
          window.location.href = data.url;
          return;
        } else {
          throw new Error(data.message || "Failed to process");
        }
      }
      
      // For free plan, call API to update entitlements
      if (selectedPlan === "free") {
        const response = await fetch("/api/billing/select-free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        const data = await response.json();
        
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Failed to update plan");
        }
      }
      
      onSelectPlan(selectedPlan);
      onClose();
    } catch (error: any) {
      toast({
        title: "Something went wrong",
        description: error.message || "Please try again or select the free plan.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getButtonText = () => {
    if (!selectedPlan || !selectedPlanData) return "Select a plan";
    if (selectedPlan === "free") return "Continue with Free";
    if (isIOSApp && selectedPlanData.requiresPayment) return "Subscribe in App";
    if (selectedPlanData.freeIntro) return "Get Started Free";
    return `Continue to Checkout`;
  };

  const getHelperText = () => {
    if (!selectedPlan || !selectedPlanData) return "";
    if (selectedPlan === "free") return "You can upgrade or change your plan anytime from settings.";
    if (isIOSApp && selectedPlanData.requiresPayment) return "You'll be redirected to complete your purchase with Apple.";
    if (selectedPlanData.freeIntro) return `${selectedPlanData.freeIntro}. Cancel anytime.`;
    return `You'll be charged $${selectedPlanData.price}/month after checkout. Cancel anytime.`;
  };

  // Show legal document preview
  if (legalPreview) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLegalPreview(null)}
                data-testid="button-back-to-plans"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <DialogTitle>{legalPreview === "terms" ? "Terms of Use" : "Privacy Policy"}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch pr-4" style={{ maxHeight: 'calc(80vh - 100px)' }}>
            {legalPreview === "terms" ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <h2>Terms of Use</h2>
                <p><strong>Effective Date:</strong> January 2025</p>
                
                <h3>1. Acceptance of Terms</h3>
                <p>By accessing or using Evident ("the Service"), you agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use the Service.</p>
                
                <h3>2. Description of Service</h3>
                <p>Evident is an AI-powered document analysis and evidence-based assistant that helps users upload, process, and interact with various file types using advanced AI capabilities.</p>
                
                <h3>3. Subscription Plans</h3>
                <p>Evident offers the following subscription tiers:</p>
                <ul>
                  <li><strong>Free Tier:</strong> Limited access with basic features</li>
                  <li><strong>Evident Lite:</strong> Entry-level paid plan with expanded features</li>
                  <li><strong>Evident Scholar:</strong> Enhanced plan for academic and research use</li>
                  <li><strong>Evident Advanced:</strong> Professional plan with full feature access</li>
                  <li><strong>Evident Max:</strong> Premium plan with maximum capabilities</li>
                  <li><strong>Enterprise Plans:</strong> Custom solutions for organizations</li>
                </ul>
                <p>Current pricing is displayed at the time of purchase. Prices may vary by platform (App Store vs. web).</p>
                
                <h3>4. Auto-Renewal</h3>
                <p>Paid subscriptions automatically renew at the end of each billing period unless cancelled at least 24 hours before the renewal date. You can manage your subscription through your account settings or your device's subscription management.</p>
                
                <h3>5. User Responsibilities</h3>
                <p>You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.</p>
                
                <h3>6. Intellectual Property</h3>
                <p>All content, features, and functionality of the Service are owned by Evident and are protected by intellectual property laws.</p>
                
                <h3>7. Limitation of Liability</h3>
                <p>The Service is provided "as is" without warranties of any kind. Evident shall not be liable for any indirect, incidental, or consequential damages.</p>
                
                <h3>8. Contact</h3>
                <p>For questions about these terms, please contact us through the app's support features.</p>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <h2>Privacy Policy</h2>
                <p><strong>Effective Date:</strong> January 2025</p>
                
                <h3>1. Information We Collect</h3>
                <p>We collect information you provide directly, including:</p>
                <ul>
                  <li>Account information (email, name)</li>
                  <li>Documents and files you upload for analysis</li>
                  <li>Usage data and interaction patterns</li>
                </ul>
                
                <h3>2. How We Use Your Information</h3>
                <p>We use your information to:</p>
                <ul>
                  <li>Provide and improve our AI-powered document analysis services</li>
                  <li>Process your uploaded documents for analysis</li>
                  <li>Communicate with you about your account and our services</li>
                  <li>Ensure the security of your account</li>
                </ul>
                
                <h3>3. Data Storage and Security</h3>
                <p>Your documents and data are stored securely using industry-standard encryption. We implement appropriate security measures to protect your information.</p>
                
                <h3>4. Third-Party Services</h3>
                <p>We may use third-party services (such as AI providers and payment processors) to deliver our services. These providers have their own privacy policies.</p>
                
                <h3>5. Your Rights</h3>
                <p>You have the right to:</p>
                <ul>
                  <li>Access your personal data</li>
                  <li>Request deletion of your data</li>
                  <li>Export your uploaded documents</li>
                  <li>Opt out of marketing communications</li>
                </ul>
                
                <h3>6. Data Retention</h3>
                <p>We retain your data for as long as your account is active or as needed to provide services. You can delete your account and associated data at any time.</p>
                
                <h3>7. Changes to This Policy</h3>
                <p>We may update this policy from time to time. We will notify you of significant changes through the app or via email.</p>
                
                <h3>8. Contact</h3>
                <p>For privacy-related questions, please contact us through the app's support features.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-2">
          <DialogTitle className="text-2xl flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Welcome to Evident!
          </DialogTitle>
          <DialogDescription className="text-base">
            Choose a plan to get started. You can change this anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {plans.map((plan) => (
            <Card 
              key={plan.id}
              className={`transition-all relative ${
                plan.comingSoon 
                  ? "opacity-60 cursor-not-allowed" 
                  : "cursor-pointer hover:border-primary/50"
              } ${
                selectedPlan === plan.id && !plan.comingSoon ? "border-primary ring-2 ring-primary/20 bg-primary/5" : ""
              }`}
              onClick={() => !plan.comingSoon && setSelectedPlan(plan.id)}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.comingSoon && (
                <div className="absolute -top-3 left-4">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-0">
                    <Clock className="w-3 h-3 mr-1" />
                    Coming Soon
                  </Badge>
                </div>
              )}
              {plan.noBankInfo && !plan.comingSoon && (
                <div className="absolute -top-3 left-4">
                  <Badge variant="outline" className="bg-background border-muted-foreground/30">
                    No payment info needed
                  </Badge>
                </div>
              )}
              
              <div className="flex items-center p-4 gap-4">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedPlan === plan.id && !plan.comingSoon ? "border-primary bg-primary" : "border-muted-foreground/30"
                }`}>
                  {selectedPlan === plan.id && !plan.comingSoon && <Check className="w-4 h-4 text-primary-foreground" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    <span className="text-sm text-muted-foreground">
                      {plan.price === 0 ? "Free forever" : `$${plan.price}/month`}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  {plan.freeIntro && (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">{plan.freeIntro}</span>
                  )}
                </div>
                
                <div className="hidden sm:flex flex-wrap gap-2 max-w-[200px]">
                  {plan.features.slice(0, 2).map((feature, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      <feature.icon className="w-3 h-3 mr-1" />
                      {feature.text}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Subscription disclosure - shown when a paid plan is selected */}
        {selectedPlanData?.requiresPayment && (
          <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Subscription</span>
              <span className="font-medium">{selectedPlanData.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Price</span>
              <span className="font-medium">${selectedPlanData.price}/month</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Duration</span>
              <span className="font-medium">Monthly (auto-renews)</span>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t">
              {selectedPlanData?.freeIntro 
                ? `${selectedPlanData.freeIntro}. You won't be charged until the free period ends. Cancel anytime.`
                : "Your subscription will begin immediately after payment. Cancel anytime."}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <Button 
            onClick={handleContinue}
            disabled={!selectedPlan || isSubmitting}
            className="w-full"
            size="lg"
            data-testid="button-continue-plan"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : selectedPlanData?.requiresPayment ? (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                {getButtonText()}
              </>
            ) : (
              getButtonText()
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            {getHelperText()}
          </p>
          {/* Apple-required subscription disclosure for iOS */}
          {selectedPlanData?.requiresPayment && (
            <p className="text-xs text-center text-muted-foreground">
              Payment will be charged to your Apple ID account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
            </p>
          )}
          {/* Terms and Privacy links */}
          <div className="flex justify-center gap-4 text-xs pt-2">
            <button 
              type="button"
              onClick={() => setLegalPreview("terms")}
              className="text-primary hover:underline"
              data-testid="button-terms-plan-selector"
            >
              Terms of Use
            </button>
            <span className="text-muted-foreground">|</span>
            <button 
              type="button"
              onClick={() => setLegalPreview("privacy")}
              className="text-primary hover:underline"
              data-testid="button-privacy-plan-selector"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
