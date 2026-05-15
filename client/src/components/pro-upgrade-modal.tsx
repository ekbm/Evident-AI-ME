import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useIOSDetection } from "@/hooks/use-ios-detection";
import { Loader2, Sparkles, CheckCircle2, Apple, ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planKey?: string; // Optional: specify which plan to subscribe to
}

export function ProUpgradeModal({ open, onOpenChange, planKey = "pro" }: ProUpgradeModalProps) {
  // ALL HOOKS MUST BE AT THE TOP - no hooks after conditional returns!
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [legalPreview, setLegalPreview] = useState<"terms" | "privacy" | null>(null);
  const isIOSApp = useIOSDetection();
  
  // iOS product ID mapping - must match App Store Connect and shared/models/auth.ts
  const IOS_PRODUCT_IDS: Record<string, string> = {
    "starter": "com.evident.assistant.sub.core.lite.monthly",
    "scholar": "com.evident.assistant.sub.core.scholar.monthly",
    "pro": "com.evident.assistant.sub.core.advanced.monthly",
    "pro_plus": "com.evident.assistant.sub.core.max.monthly",
  };
  
  // Handle iOS in-app purchase
  const handleIOSSubscribe = () => {
    const productId = IOS_PRODUCT_IDS[planKey] || `com.evident.assistant.sub.core.${planKey}.monthly`;
    console.log("[iOS] Requesting purchase for:", productId);
    try {
      if ((window as any).webkit?.messageHandlers?.subscribe) {
        (window as any).webkit.messageHandlers.subscribe.postMessage(productId);
        onOpenChange(false);
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

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/assessment-requests", {
        fullName: "Early Access Request",
        email,
        organisation: "Individual",
        assessmentTarget: "UPLOADS",
        message: "Requesting early access to Pro subscription",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to submit request");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowSuccess(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate();
  };

  const handleClose = () => {
    setEmail("");
    setShowSuccess(false);
    setLegalPreview(null);
    onOpenChange(false);
  };

  if (showSuccess) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-6 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogHeader className="text-center">
              <DialogTitle>You're on the list!</DialogTitle>
              <DialogDescription className="text-center">
                We'll notify you as soon as Pro subscriptions are available.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={handleClose} className="mt-4" data-testid="button-close-success">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // iOS subscription details - required by Apple App Store guidelines
  const IOS_PLAN_DETAILS: Record<string, { name: string; price: string; period: string; description: string }> = {
    "starter": { 
      name: "Evident Lite", 
      price: "$4.99", 
      period: "month",
      description: "50 questions/month, 500MB storage, media transcription"
    },
    "scholar": { 
      name: "Evident Scholar", 
      price: "$28.99", 
      period: "month",
      description: "200 questions/month, 3GB storage, 20hrs media/month, lecture video support"
    },
    "pro": { 
      name: "Evident Advanced", 
      price: "$38.99", 
      period: "month",
      description: "500 questions/month, 4GB storage, 30hrs media/month, external search"
    },
    "pro_plus": { 
      name: "Evident Max", 
      price: "$98.99", 
      period: "month",
      description: "2,000 questions/month, 10GB storage, 75hrs media/month, Excel reports"
    },
  };

  const planDetails = IOS_PLAN_DETAILS[planKey] || { 
    name: planKey.charAt(0).toUpperCase() + planKey.slice(1), 
    price: "See App Store", 
    period: "month",
    description: "Premium subscription features"
  };

  // iOS users get the in-app purchase flow with full subscription disclosure
  if (isIOSApp) {
    // Show legal document preview
    if (legalPreview) {
      return (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setLegalPreview(null)}
                  data-testid="button-back-to-subscribe"
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
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <DialogTitle>{planDetails.name}</DialogTitle>
            </div>
            <DialogDescription>
              Auto-renewable subscription
            </DialogDescription>
          </DialogHeader>

          {/* Apple-required subscription information */}
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Subscription</span>
                <span className="font-medium">{planDetails.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Price</span>
                <span className="font-medium">{planDetails.price}/{planDetails.period}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Duration</span>
                <span className="font-medium">Monthly (auto-renews)</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2 border-t">
                {planDetails.description}
              </p>
            </div>

            <Button onClick={handleIOSSubscribe} className="w-full" size="lg" data-testid="button-ios-subscribe">
              <Apple className="w-4 h-4 mr-2" />
              Subscribe with Apple
            </Button>

            {/* Apple-required legal links - now open inline preview */}
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Payment will be charged to your Apple ID account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
              </p>
              <div className="flex justify-center gap-4 text-xs">
                <button 
                  type="button"
                  onClick={() => setLegalPreview("terms")}
                  className="text-primary hover:underline"
                  data-testid="button-terms-ios"
                >
                  Terms of Use
                </button>
                <span className="text-muted-foreground">|</span>
                <button 
                  type="button"
                  onClick={() => setLegalPreview("privacy")}
                  className="text-primary hover:underline"
                  data-testid="button-privacy-ios"
                >
                  Privacy Policy
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} data-testid="button-cancel-ios">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Web users go to Stripe checkout
  const handleStripeCheckout = async () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to subscribe to a plan.",
      });
      onOpenChange(false);
      setLocation("/auth");
      return;
    }
    
    setIsCheckoutLoading(true);
    try {
      const response = await apiRequest("POST", "/api/billing/checkout", {
        plan: planKey,
        trial: planKey === "starter" || planKey === "scholar"
      });
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: data.error || data.message || "Failed to start checkout",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckoutLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <DialogTitle>Upgrade to {planKey === "pro_plus" ? "Evident Max" : planKey === "pro" ? "Evident Advanced" : planKey === "scholar" ? "Evident Scholar" : planKey === "starter" ? "Evident Lite" : planKey.charAt(0).toUpperCase() + planKey.slice(1)}</DialogTitle>
          </div>
          <DialogDescription>
            {(planKey === "starter" || planKey === "scholar")
              ? "First month free. Cancel anytime."
              : "Subscribe to unlock premium features. Cancel anytime."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isIOSApp ? (
            <Button 
              onClick={handleIOSSubscribe} 
              className="w-full" 
              size="lg"
              data-testid="button-ios-subscribe"
            >
              <Apple className="w-4 h-4 mr-2" />
              Subscribe with Apple
            </Button>
          ) : (
            <Button 
              onClick={handleStripeCheckout} 
              className="w-full" 
              size="lg" 
              disabled={isCheckoutLoading}
              data-testid="button-stripe-checkout"
            >
              {isCheckoutLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  {(planKey === "starter" || planKey === "scholar") ? "Get Started Free" : "Continue to Checkout"}
                </>
              )}
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose} data-testid="button-cancel">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
