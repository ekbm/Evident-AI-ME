import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Footer } from "@/components/Footer";
import { AppProvider, useAppContext } from "@/contexts/app-context";
import { ModeProvider } from "@/contexts/mode-context";
import { setStoredAuthToken } from "@/hooks/use-auth";
import { BottomNav } from "@/components/bottom-nav";
import { useAuth } from "@/hooks/use-auth";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { Loader2 } from "lucide-react";
import { IOSAppBanner } from "@/components/ios-app-banner";
import { PWAInstallBanner } from "@/components/pwa-install-banner";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { SessionExpiredDialog } from "@/components/session-expired-dialog";

// Handle auth token and iOS detection from URL (iOS WebView compatibility)
function AuthTokenHandler() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Detect iOS app via ?ios=1 parameter and persist to sessionStorage only
    // Using sessionStorage (not localStorage) to avoid persisting to desktop browser sessions
    if (urlParams.get('ios') === '1') {
      console.log("[iOS] Detected iOS app via URL parameter, saving to sessionStorage");
      try {
        sessionStorage.setItem('isIOSApp', 'true');
      } catch (e) {
        console.log("[iOS] Storage error:", e);
      }
    }
    
    const authToken = urlParams.get('auth_token');
    if (authToken) {
      console.log("[Auth] Found token in URL, storing...");
      setStoredAuthToken(authToken);
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      // Refresh user query
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    }
  }, []);
  return null;
}

// Scroll to top when route changes — targets #root since it's the scroll container
function ScrollToTop() {
  const [location] = useLocation();
  
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      root.scrollTo(0, 0);
    }
    window.scrollTo(0, 0);
  }, [location]);
  
  return null;
}

// Loading component for lazy-loaded pages
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

// Lazy load all pages for code splitting
const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const AuthPage = lazy(() => import("@/pages/auth"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const PremiumDashboard = lazy(() => import("@/pages/premium-dashboard"));
const ConnectorsPage = lazy(() => import("@/pages/connectors"));
const VisualizePage = lazy(() => import("@/pages/visualize"));
const ReadinessPage = lazy(() => import("@/pages/readiness"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const PricingPage = lazy(() => import("@/pages/pricing"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const PrivacyPage = lazy(() => import("@/pages/legal/PrivacyPage"));
const TermsPage = lazy(() => import("@/pages/legal/TermsPage"));
const AIDisclaimerPage = lazy(() => import("@/pages/legal/AIDisclaimerPage"));
const SecurityPage = lazy(() => import("@/pages/legal/SecurityPage"));
const PilotHome = lazy(() => import("@/pages/pilot/pilot-home"));
const PilotDocuments = lazy(() => import("@/pages/pilot/pilot-documents"));
const PilotSettings = lazy(() => import("@/pages/pilot/pilot-settings"));
const AdminFeedbackPage = lazy(() => import("@/pages/admin/feedback"));
const AdminPromptTemplatesPage = lazy(() => import("@/pages/admin/prompt-templates"));
const AdminFeatureRequestsPage = lazy(() => import("@/pages/admin/feature-requests"));
const AdminRoadmapFeaturesPage = lazy(() => import("@/pages/admin/roadmap-features"));
const AdminErrorRewardsPage = lazy(() => import("@/pages/admin/error-rewards"));
const AdminLeadsPage = lazy(() => import("@/pages/admin/leads"));
const AdminScanLeadsPage = lazy(() => import("@/pages/admin/scan-leads"));
const AdminQueueManagementPage = lazy(() => import("@/pages/admin/queue-management"));
const AdminUserSurveysPage = lazy(() => import("@/pages/admin/user-surveys"));
const AdminPilotStudentsPage = lazy(() => import("@/pages/admin/pilot-students"));
const ExtractabilityPage = lazy(() => import("@/pages/extractability"));
const PolicySetupPage = lazy(() => import("@/pages/policy-setup"));
const PolicyOverviewPage = lazy(() => import("@/pages/policy-overview"));
const DemoPage = lazy(() => import("@/pages/demo"));
const AgentControlPage = lazy(() => import("@/pages/agent-control"));
const BillingPage = lazy(() => import("@/pages/billing"));
const BillingSuccessPage = lazy(() => import("@/pages/billing-success"));
const PlanLimitsPage = lazy(() => import("@/pages/plan-limits"));
const OrgFleetPage = lazy(() => import("@/pages/org/FleetPage"));
const OrgDeviceDetailPage = lazy(() => import("@/pages/org/DeviceDetailPage"));
const OrgPoliciesPage = lazy(() => import("@/pages/org/PoliciesPage"));
const OrgAuditPage = lazy(() => import("@/pages/org/AuditPage"));
const OrgSettingsPage = lazy(() => import("@/pages/org/SettingsPage"));
const OrgInvitesPage = lazy(() => import("@/pages/org/InvitesPage"));
const InviteAcceptPage = lazy(() => import("@/pages/invite-accept"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const AboutPage = lazy(() => import("@/pages/about"));
const UseCasesPage = lazy(() => import("@/pages/use-cases"));
const ReconciliationPage = lazy(() => import("@/pages/reconciliation"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const PacksPage = lazy(() => import("@/pages/packs"));
const PackDetailPage = lazy(() => import("@/pages/pack-detail"));
const SettingsPacksPage = lazy(() => import("@/pages/settings-packs"));
const LegalContractsPage = lazy(() => import("@/pages/legal-contracts"));
const HelpPage = lazy(() => import("@/pages/help"));
const FaqPage = lazy(() => import("@/pages/faq"));
const FeedbackPage = lazy(() => import("@/pages/feedback"));
const TutorialsPage = lazy(() => import("@/pages/tutorials"));
const AiReadinessQaPage = lazy(() => import("@/pages/ai-readiness-qa"));
const QuickScanPage = lazy(() => import("@/pages/quick-scan"));
const ScanReportPage = lazy(() => import("@/pages/scan-report"));
const MobilePreview = lazy(() => import("@/pages/mobile-preview"));
const MobileAppPreview = lazy(() => import("@/pages/mobile-app-preview"));
const LiveLanding = lazy(() => import("@/pages/live/LiveLanding"));
const LiveScan = lazy(() => import("@/pages/live/LiveScan"));
const LiveResults = lazy(() => import("@/pages/live/LiveResults"));
const LiveContact = lazy(() => import("@/pages/live/LiveContact"));
const SimpleLanding = lazy(() => import("@/pages/simple-landing"));
const MobileMenuPage = lazy(() => import("@/pages/mobile-menu"));
const CVScreenerPage = lazy(() => import("@/pages/cv-screener"));
const ServicesPage = lazy(() => import("@/pages/services"));
const LearningHistoryPage = lazy(() => import("@/pages/learning-history"));
const QuizScanPage = lazy(() => import("@/pages/quiz-scan"));
const BlogPage = lazy(() => import("@/pages/blog"));
const BlogPostPage = lazy(() => import("@/pages/blog-post"));
const BlogManagePage = lazy(() => import("@/pages/blog-manage"));
const VerticalLanding = lazy(() => import("@/pages/vertical-landing"));
const StudentsLanding = lazy(() => import("@/pages/students-landing"));
const FinanceLanding = lazy(() => import("@/pages/finance-landing"));
const EnterpriseLanding = lazy(() => import("@/pages/enterprise-landing"));
const StudyDashboard = lazy(() => import("@/pages/study-dashboard"));
const EducatorDashboard = lazy(() => import("@/pages/educator-dashboard"));
const StudentPilotFlyer = lazy(() => import("@/pages/student-pilot-flyer"));

const PUBLIC_ROUTES = ["/", "/full", "/onboarding", "/auth", "/privacy", "/terms", "/ai-disclaimer", "/security", "/pricing", "/demo", "/billing", "/plan-limits", "/about", "/use-cases", "/packs", "/help", "/faq", "/feedback", "/tutorials", "/ai-readiness/qa", "/scan", "/live", "/admin", "/settings", "/ipad-test", "/readiness", "/menu", "/workspace", "/premium", "/cv-screener", "/reconciliation", "/reports", "/legal", "/services", "/learning", "/quiz", "/blog", "/students", "/students-graduates", "/educators", "/finance", "/hr", "/legal-landing", "/professionals", "/study-dashboard", "/educator-dashboard", "/student-pilot", "/enterprise"];

function isPublicRoute(path: string): boolean {
  if (PUBLIC_ROUTES.some((route) => path === route || path.startsWith(route + "/"))) return true;
  if (path.startsWith("/invite/")) return true;
  return false;
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { hasCompletedOnboarding, setAppMode } = useAppContext();
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  console.log('[OnboardingGuard] location:', location, 'isPublic:', isPublicRoute(location), 'hasCompleted:', hasCompletedOnboarding);

  if (!hasCompletedOnboarding && isAuthenticated) {
    setAppMode("general");
    return <>{children}</>;
  }

  if (!hasCompletedOnboarding && !isPublicRoute(location)) {
    console.log('[OnboardingGuard] Redirecting to onboarding');
    return <Redirect to="/onboarding" />;
  }

  return <>{children}</>;
}

function AuthGuardedHome() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Redirect to="/auth" />;
  return <Home />;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/ipad-test">{() => <div style={{ padding: 40, backgroundColor: '#fef3c7', minHeight: '100vh' }}><h1 style={{ fontSize: 24 }}>iPad Test Page - TOP</h1><p>If you see this yellow page, routing works!</p><p>URL: {window.location.href}</p><a href="/">Go home</a></div>}</Route>
        <Route path="/" component={SimpleLanding} />
        <Route path="/students" component={StudentsLanding} />
        <Route path="/students-graduates" component={StudentsLanding} />
        <Route path="/educators">{() => <VerticalLanding vertical="educators" />}</Route>
        <Route path="/finance" component={FinanceLanding} />
        <Route path="/legal-landing">{() => <VerticalLanding vertical="legal" />}</Route>
        <Route path="/hr">{() => <VerticalLanding vertical="hr" />}</Route>
        <Route path="/professionals">{() => <VerticalLanding vertical="professionals" />}</Route>
        <Route path="/enterprise" component={EnterpriseLanding} />
        <Route path="/full" component={AuthGuardedHome} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/premium" component={PremiumDashboard} />
        <Route path="/connectors" component={ConnectorsPage} />
        <Route path="/visualize" component={VisualizePage} />
        <Route path="/readiness" component={ReadinessPage} />
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/menu" component={MobileMenuPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/ai-disclaimer" component={AIDisclaimerPage} />
        <Route path="/security" component={SecurityPage} />
        <Route path="/pilot" component={PilotHome} />
        <Route path="/pilot/documents" component={PilotDocuments} />
        <Route path="/pilot/settings" component={PilotSettings} />
        <Route path="/admin/feedback" component={AdminFeedbackPage} />
        <Route path="/admin/feature-requests" component={AdminFeatureRequestsPage} />
        <Route path="/admin/roadmap" component={AdminRoadmapFeaturesPage} />
        <Route path="/admin/error-rewards" component={AdminErrorRewardsPage} />
        <Route path="/admin/leads" component={AdminLeadsPage} />
        <Route path="/admin/scan-leads" component={AdminScanLeadsPage} />
        <Route path="/admin/queue" component={AdminQueueManagementPage} />
        <Route path="/admin/user-surveys" component={AdminUserSurveysPage} />
        <Route path="/admin/pilot-students" component={AdminPilotStudentsPage} />
        <Route path="/admin/prompt-templates" component={AdminPromptTemplatesPage} />
        <Route path="/dashboard/extractability" component={ExtractabilityPage} />
        <Route path="/policy" component={PolicyOverviewPage} />
        <Route path="/policy/:workspaceId" component={PolicySetupPage} />
        <Route path="/demo" component={DemoPage} />
        <Route path="/agent-control" component={AgentControlPage} />
        <Route path="/billing" component={BillingPage} />
        <Route path="/billing/success" component={BillingSuccessPage} />
        <Route path="/plan-limits" component={PlanLimitsPage} />
        <Route path="/org" component={OrgFleetPage} />
        <Route path="/org/agents" component={OrgFleetPage} />
        <Route path="/org/agents/:id" component={OrgDeviceDetailPage} />
        <Route path="/org/policies" component={OrgPoliciesPage} />
        <Route path="/org/audit" component={OrgAuditPage} />
        <Route path="/org/settings" component={OrgSettingsPage} />
        <Route path="/org/settings/agents" component={OrgSettingsPage} />
        <Route path="/org/invites" component={OrgInvitesPage} />
        <Route path="/invite/:token" component={InviteAcceptPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/use-cases" component={UseCasesPage} />
        <Route path="/reconciliation" component={ReconciliationPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/packs" component={PacksPage} />
        <Route path="/packs/:slug" component={PackDetailPage} />
        <Route path="/settings/packs" component={SettingsPacksPage} />
        <Route path="/legal/contracts" component={LegalContractsPage} />
        <Route path="/help" component={HelpPage} />
        <Route path="/faq" component={FaqPage} />
        <Route path="/feedback" component={FeedbackPage} />
        <Route path="/tutorials" component={TutorialsPage} />
        <Route path="/ai-readiness/qa" component={AiReadinessQaPage} />
        <Route path="/scan" component={QuickScanPage} />
        <Route path="/scan/report/:token" component={ScanReportPage} />
        <Route path="/live" component={LiveLanding} />
        <Route path="/live/scan" component={LiveScan} />
        <Route path="/live/results" component={LiveResults} />
        <Route path="/live/contact" component={LiveContact} />
        <Route path="/workspace">{() => <Redirect to="/premium" />}</Route>
        <Route path="/mobile-preview" component={MobilePreview} />
        <Route path="/mobile-app-preview" component={MobileAppPreview} />
        <Route path="/cv-screener" component={CVScreenerPage} />
        <Route path="/services" component={ServicesPage} />
        <Route path="/learning" component={LearningHistoryPage} />
        <Route path="/study-dashboard" component={StudyDashboard} />
        <Route path="/educator-dashboard" component={EducatorDashboard} />
        <Route path="/student-pilot" component={StudentPilotFlyer} />
        <Route path="/quiz/scan/:quizId/:studentNumber" component={QuizScanPage} />
        <Route path="/quiz/scan/:quizId" component={QuizScanPage} />
        <Route path="/blog" component={BlogPage} />
        <Route path="/blog/manage" component={BlogManagePage} />
        <Route path="/blog/:slug" component={BlogPostPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AppContent() {
  const [location] = useLocation();
  const { isAuthenticated, sessionExpired, dismissSessionExpired } = useAuth();
  useAutoRefresh();
  const hideBottomNav = location.startsWith("/auth") || location.startsWith("/onboarding") || location.startsWith("/live");

  return (
    <div className="min-h-screen flex flex-col">
      <IOSAppBanner />
      <PWAInstallBanner />
      <AuthTokenHandler />
      <ScrollToTop />
      <div className="flex-1 pb-20 sm:pb-0">
        <OnboardingGuard>
          <Router />
        </OnboardingGuard>
      </div>
      <Footer />
      {!hideBottomNav && <BottomNav />}
      {!location.startsWith("/auth") && (
        <SessionExpiredDialog open={sessionExpired} onDismiss={dismissSessionExpired} />
      )}
    </div>
  );
}

function usePointerEventsUnlock() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => {
      if (document.body.style.pointerEvents === "none") {
        const hasOpenOverlay =
          document.querySelector('[data-state="open"][role="dialog"]') ||
          document.querySelector('[data-state="open"][role="alertdialog"]');
        if (!hasOpenOverlay) {
          document.body.style.pointerEvents = "";
        }
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, []);
}

function App() {
  usePointerEventsUnlock();
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <ModeProvider>
          <TooltipProvider>
            <AppContent />
            <FeedbackPrompt />
            <Toaster />
          </TooltipProvider>
        </ModeProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
