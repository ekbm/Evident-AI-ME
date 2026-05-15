import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UploadSection } from "@/components/upload-section";
import { SelectedDocumentsBox } from "@/components/selected-documents-box";
import { DataIngestionFeed, PersonalIntegrationsButton, PersonalIntegrationsPanel, PersonalIntegrationsContent } from "@/components/data-ingestion-feed";
import { CompactUploadZone } from "@/components/compact-upload-zone";
import { ChatSection } from "@/components/chat-section";
import KnowledgeHealthTab from "@/components/knowledge-health-tab";
import { FinanceQuerySection } from "@/components/finance-query-section";
import { FinanceWorkspaceTabs } from "@/components/finance-workspace-tabs";
import { EnterpriseDocumentsSection } from "@/components/enterprise-documents-section";
import { ActionsSection } from "@/components/actions-section";
import { UsageDisplay } from "@/components/usage-display";
import { PremiumOrgFeatures } from "@/components/premium-org-features";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Link } from "wouter";
import { useAuth, getStoredAuthToken } from "@/hooks/use-auth";
import { useAnalytics } from "@/hooks/use-analytics";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useConversationFlow, ConversationIntent, FlowState } from "@/hooks/use-conversation-flow";
import { useToast } from "@/hooks/use-toast";
import { FileText, Sparkles, Shield, Zap, LogIn, LogOut, User, Users, Bot, Plug, Building2, CreditCard, Tag, Lightbulb, GraduationCap, Video, FileCheck, Receipt, BookOpen, ClipboardList, ChevronRight, ChevronLeft, ChevronDown, Boxes, Clock, ArrowLeft, HelpCircle, FolderKanban, Lock, Settings, Presentation, Loader2, FileSearch, Briefcase, Upload, FileUp, HardDrive, Play, X, Moon, Sun, MessageSquarePlus, AlertCircle, UserPlus, Smartphone, Brain, SlidersHorizontal, MessageCircle, HeartPulse, CircleCheck, MessagesSquare, CheckCircle2, FolderOpen, Info } from "lucide-react";
import { SiApple } from "react-icons/si";
import { ToastAction } from "@/components/ui/toast";
import { ReportIssueDialog } from "@/components/report-issue-dialog";
import { Badge } from "@/components/ui/badge";
import { PilotModeBadge } from "@/components/pilot-mode-badge";
import PilotReferralCard from "@/components/pilot-referral-card";
import { ActionId } from "@shared/action-engine";
import type { Asset, ChatResponse, ExtractObligationsResponse, ImageChatResponse, ExcelReportResponse } from "@shared/schema";
import heroImage from "@assets/stock_images/abstract_document_an_feedf19e.jpg";
const heroMockup = "/hero-mockup.png";
import { UseCasesPrompt } from "@/components/use-cases-prompt";
import { WelcomeModal } from "@/components/welcome-modal";
import { OnboardingTour } from "@/components/onboarding-tour";
import { LimitWarningBanner } from "@/components/limit-warning-banner";
import { useEntitlements } from "@/features/packs/useEntitlements";
import { Scale, DollarSign, FileSpreadsheet, BarChart3, Maximize2, Minimize2, Activity, MoreVertical } from "lucide-react";
import { SourceIcon } from "@/components/source-icon";
import type { PackIdType } from "@shared/packs";
import { useAppContext } from "@/contexts/app-context";
import { PlanSelectorModal } from "@/components/plan-selector-modal";
import { PlanBadge } from "@/components/plan-badge";
import { FeatureVotingModal } from "@/components/feature-voting-modal";
import { useIOSDetection } from "@/hooks/use-ios-detection";
import { WorkspaceStatsPanel } from "@/components/workspace-stats-panel";
import { WorkspaceTipsPanel } from "@/components/workspace-tips-panel";
import { WorkspaceActivityPanel } from "@/components/workspace-activity-panel";
import { WorkspaceInsightsPanel } from "@/components/workspace-insights-panel";
import { usePanelState } from "@/hooks/use-panel-state";
import { BookmarksPanel } from "@/components/bookmarks-panel";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ShareButtons } from "@/components/share-buttons";
import { StudyQuiz } from "@/components/study-quiz";
import { CVBuilder } from "@/components/cv-builder";
import { StudyDashboardPanel } from "@/components/study-dashboard-panel";
import { StudyNudgeBanner } from "@/components/study-nudge-banner";
import { LearningModePrompt, detectGenericAnswer, extractTopicFromQuestion } from "@/components/learning-mode-prompt";
import { RecentLearningWidget } from "@/components/recent-learning-widget";
import { CustomizeViewModal } from "@/components/customize-view-modal";
import { OnboardingHero } from "@/components/onboarding-hero";
import { useViewPreferences } from "@/hooks/use-view-preferences";
import { useMode } from "@/contexts/mode-context";
import { ModeSwitcher } from "@/components/mode-switcher";

interface ChatMessage {
  id: string;
  type: "question" | "answer";
  content: string;
  citations?: ChatResponse["citations"];
  evidencePreview?: ChatResponse["evidencePreview"];
  policyCitations?: ChatResponse["policyCitations"];
  standardCitations?: ChatResponse["standardCitations"];
  claims?: ChatResponse["claims"];
  imageUrl?: string;
  imageQuery?: string;
  learningSummary?: ChatResponse["learningSummary"];
  trustAudit?: ChatResponse["trustAudit"];
  versionUsed?: "original" | "prepared";
  isCompareMode?: boolean;
  compareLabel?: string;
}

// Maximum Q&A pairs to keep in session (10 pairs = 20 messages)
const MAX_MESSAGES = 20;

export default function Home() {
  useDocumentTitle();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [financeMessages, setFinanceMessages] = useState<ChatMessage[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [activeLearningSessionId, setActiveLearningSessionId] = useState<string | null>(null);
  const [showLearningPrompt, setShowLearningPrompt] = useState(false);
  const [showAnswerLearningPrompt, setShowAnswerLearningPrompt] = useState(false);
  const [suggestedLearningTopic, setSuggestedLearningTopic] = useState("");
  
  // Learning Mode toggle state - ON by default, persisted in localStorage
  const [learningModeEnabled, setLearningModeEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem("evident_learning_mode_enabled");
      return stored !== "false"; // Default to true (ON) if not set
    } catch {
      return true; // Default to ON if localStorage unavailable
    }
  });
  const [researchUrls, setResearchUrls] = useState<string[]>([""]);
  const [sourceOnly, setSourceOnly] = useState(false);
  const [usePreparedVersion, setUsePreparedVersion] = useState(false);

  // Natural Mode: Skip built-in prompts for more conversational responses
  const [naturalModeEnabled, setNaturalModeEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem("evident_natural_mode_enabled");
      return stored === "true"; // Default to OFF
    } catch {
      return false;
    }
  });
  
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  
  // Left sidebar collapse state - persisted in localStorage
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("evident_left_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  
  const toggleLeftSidebar = useCallback(() => {
    setLeftSidebarCollapsed(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem("evident_left_sidebar_collapsed", String(newValue));
      } catch {}
      return newValue;
    });
  }, []);
  const [hasAcceptedLearningMode, setHasAcceptedLearningMode] = useState(() => {
    try {
      return localStorage.getItem("evident_learning_mode_accepted") === "true";
    } catch {
      return false;
    }
  });
  // Flag to show acceptance modal on first question with learning mode enabled
  const [showLearningAcceptModal, setShowLearningAcceptModal] = useState(false);
  const [obligations, setObligations] = useState<ExtractObligationsResponse["obligations"]>([]);
  const [hasAttemptedExtraction, setHasAttemptedExtraction] = useState(false);
  const [excelReport, setExcelReport] = useState<ExcelReportResponse | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [pendingEmailAddress, setPendingEmailAddress] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState<"proposal" | "ppt" | null>(null);
  const [financePrompt, setFinancePrompt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const hash = window.location.hash.replace("#", "");
    const stored = sessionStorage.getItem("evident_return_tab");
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const pendingSources = sessionStorage.getItem("pending-open-sources");
    if (pendingSources) {
      return "knowledge";
    }
    if (hash === "knowledge" || hash === "health") {
      window.history.replaceState(null, "", window.location.pathname);
      return hash;
    }
    if (stored) {
      sessionStorage.removeItem("evident_return_tab");
      return stored;
    }
    return tab === "knowledge" || tab === "health" ? tab : "chat";
  });
  const [mobileChatView, setMobileChatView] = useState<"list" | "conversation">("list");
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const { trackFileUpload, trackChatMessage, trackChatResponse, trackExtraction, trackError, identifyUser } = useAnalytics();
  const { toast } = useToast();
  const conversationFlow = useConversationFlow();
  const searchString = useSearch();
  const { hasSelectedPlan, setSelectedPlan } = useAppContext();
  const { preferences: viewPrefs, updatePreference, togglePreference, resetToDefaults, setMinimalView, setStudentView } = useViewPreferences();
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [showFeatureVoting, setShowFeatureVoting] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const { mode: verticalMode, config: modeConfig } = useMode();
  const isStudentMode = verticalMode === "students" || verticalMode === "educators";
  const [examPrepEnabled, setExamPrepEnabled] = useState(false);
  const [showExamPrepSheet, setShowExamPrepSheet] = useState(false);
  const [financeQueryEnabled, setFinanceQueryEnabled] = useState(false);
  const [showFinanceQuerySheet, setShowFinanceQuerySheet] = useState(false);
  const [financeQueryExpanded, setFinanceQueryExpanded] = useState(false);
  const [examPrepExpanded, setExamPrepExpanded] = useState(false);
  const [showStudyDashboardSheet, setShowStudyDashboardSheet] = useState(false);
  const [studyDashboardExpanded, setStudyDashboardExpanded] = useState(false);
  const [showEviNudge, setShowEviNudge] = useState(false);
  const [eviNudgeDismissed, setEviNudgeDismissed] = useState(false);
  const [showKsNudge, setShowKsNudge] = useState(false);
  const [ksNudgeDismissed, setKsNudgeDismissed] = useState(false);
  const [showCVBuilderSheet, setShowCVBuilderSheet] = useState(false);
  const [cvBuilderExpanded, setCvBuilderExpanded] = useState(false);
  const [onboardingHeroDismissed, setOnboardingHeroDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem("evident_onboarding_hero_dismissed") === "true"; } catch { return false; }
  });
  const dismissOnboardingHero = () => {
    setOnboardingHeroDismissed(true);
    try { localStorage.setItem("evident_onboarding_hero_dismissed", "true"); } catch {}
  };
  const reopenOnboardingHero = () => {
    setOnboardingHeroDismissed(false);
    try { localStorage.removeItem("evident_onboarding_hero_dismissed"); } catch {}
  };

  useEffect(() => {
    const openStudyFitness = sessionStorage.getItem("evident_open_study_fitness");
    if (openStudyFitness) {
      sessionStorage.removeItem("evident_open_study_fitness");
      setShowStudyDashboardSheet(true);
    }
  }, []);

  const eviNudgeMessage = (() => {
    switch (verticalMode) {
      case "students":
        return { text: "Need help studying? I can explain topics, create flashcards, or quiz you.", cta: "Chat with Evi" };
      case "educators":
        return { text: "Need help with teaching materials? I can create quizzes, lesson plans, or summaries.", cta: "Chat with Evi" };
      case "finance":
        return { text: "Need help with financial analysis? I can review documents, extract data, or answer questions.", cta: "Chat with Evi" };
      case "legal":
        return { text: "Need help with legal documents? I can review contracts, extract clauses, or flag risks.", cta: "Chat with Evi" };
      case "healthcare":
        return { text: "Need help reviewing clinical or policy documents? I can summarise, extract, or compare.", cta: "Chat with Evi" };
      default:
        return { text: "I can help you search documents, answer questions, or create summaries.", cta: "Chat with Evi" };
    }
  })();

  useEffect(() => {
    setShowEviNudge(false);
    setEviNudgeDismissed(false);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "chat" || eviNudgeDismissed) {
      setShowEviNudge(false);
      return;
    }
    const INACTIVITY_DELAY = 180000;
    let lastActivity = Date.now();
    let timer = setTimeout(() => setShowEviNudge(true), INACTIVITY_DELAY);
    const resetTimer = () => {
      const now = Date.now();
      if (now - lastActivity < 1000) return;
      lastActivity = now;
      setShowEviNudge(false);
      clearTimeout(timer);
      timer = setTimeout(() => setShowEviNudge(true), INACTIVITY_DELAY);
    };
    const events = ["click", "scroll", "touchstart", "keydown", "mousemove", "pointerdown", "focusin"];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [activeTab, eviNudgeDismissed]);

  useEffect(() => {
    if (activeTab !== "chat" || ksNudgeDismissed) {
      setShowKsNudge(false);
      return;
    }
    const questionCount = messages.filter(m => m.type === "question").length;
    if (questionCount >= 5 && !ksNudgeDismissed) {
      const timer = setTimeout(() => setShowKsNudge(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, messages, ksNudgeDismissed]);

  useEffect(() => {
    if (modeConfig.defaultTool === "examPrep") {
      setExamPrepEnabled(true);
      setFinanceQueryEnabled(false);
    } else if (modeConfig.defaultTool === "financeQuery") {
      setFinanceQueryEnabled(true);
      setExamPrepEnabled(false);
    } else {
      setExamPrepEnabled(false);
      setFinanceQueryEnabled(false);
    }
  }, [verticalMode]);
  useEffect(() => {
    const handleOpen = () => {
      setActiveTab("knowledge");
      setShowMobileIngestionPanel(true);
    };
    const handleClose = () => {
      setShowMobileIngestionPanel(false);
    };
    const handleSwitchTab = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab === "chat" || tab === "knowledge" || tab === "threads") {
        setActiveTab(tab);
        setShowMobileIngestionPanel(false);
      }
    };
    window.addEventListener("open-browse-sources", handleOpen);
    window.addEventListener("close-browse-sources", handleClose);
    window.addEventListener("switch-tab", handleSwitchTab);
    if (sessionStorage.getItem("pending-open-sources")) {
      sessionStorage.removeItem("pending-open-sources");
    }
    return () => {
      window.removeEventListener("open-browse-sources", handleOpen);
      window.removeEventListener("close-browse-sources", handleClose);
      window.removeEventListener("switch-tab", handleSwitchTab);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("tab-changed", { detail: activeTab }));
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (tabsRef.current) {
        tabsRef.current.scrollTop = 0;
      }
      const mainEl = tabsRef.current?.closest('main');
      if (mainEl) {
        mainEl.scrollTop = 0;
      }
      const scrollContainers = document.querySelectorAll('[class*="overflow-y"]');
      scrollContainers.forEach(el => { el.scrollTop = 0; });
    };
    scrollToTop();
    requestAnimationFrame(scrollToTop);
    setTimeout(scrollToTop, 50);
    setTimeout(scrollToTop, 150);
  }, [activeTab]);
  useEffect(() => {
    const anyPanelOpen = showExamPrepSheet || (showFinanceQuerySheet && financeQueryEnabled) || showStudyDashboardSheet || showCVBuilderSheet;
    if (anyPanelOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      const rootEl = document.getElementById('root');
      if (rootEl) rootEl.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      const rootEl = document.getElementById('root');
      if (rootEl) rootEl.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      const rootEl = document.getElementById('root');
      if (rootEl) rootEl.style.overflow = '';
    };
  }, [showExamPrepSheet, showFinanceQuerySheet, financeQueryEnabled, showStudyDashboardSheet, showCVBuilderSheet]);

  const [showMobileWorkspacePanel, setShowMobileWorkspacePanel] = useState(false);
  const [showMobileDocsPanel, setShowMobileDocsPanel] = useState(false);
  const [mobileSelectedDocsExpanded, setMobileSelectedDocsExpanded] = useState(false);
  const [showMySourcesPanel, setShowMySourcesPanel] = useState(false);
  const [showMobileIngestionPanel, setShowMobileIngestionPanelRaw] = useState(() => !!sessionStorage.getItem("pending-open-sources"));
  const setShowMobileIngestionPanel = (val: boolean) => {
    setShowMobileIngestionPanelRaw(val);
    window.dispatchEvent(new CustomEvent(val ? "sources-panel-opened" : "sources-panel-closed"));
  };
  const [uploadSectionOpen, setUploadSectionOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  

  const toggleTheme = () => {
    const newIsDark = !isDarkMode;
    setIsDarkMode(newIsDark);
    const darkBg = '#090e1a';
    const lightBg = '#eceff2';
    
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = darkBg;
      document.documentElement.style.colorScheme = 'dark';
      document.body.style.backgroundColor = darkBg;
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', darkBg);
      const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
      if (colorSchemeMeta) colorSchemeMeta.setAttribute('content', 'dark');
      localStorage.setItem('evidentTheme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.backgroundColor = lightBg;
      document.documentElement.style.colorScheme = 'light';
      document.body.style.backgroundColor = lightBg;
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', lightBg);
      const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
      if (colorSchemeMeta) colorSchemeMeta.setAttribute('content', 'light');
      localStorage.setItem('evidentTheme', 'light');
    }
  };
  const isIOSApp = useIOSDetection();
  const [selectedVideo, setSelectedVideo] = useState<{ id: string; title: string } | null>(null);

  // Handle ?tab= query parameter to switch tabs on navigation
  useEffect(() => {
    if (searchString) {
      const params = new URLSearchParams(searchString);
      const tab = params.get("tab");
      if (tab === "knowledge" || tab === "health") {
        setActiveTab(tab);
      }
    }
  }, [searchString]);

  // Check if ?view=landing is set to show landing page for authenticated users
  const showLandingView = useMemo(() => {
    if (searchString) {
      const params = new URLSearchParams(searchString);
      return params.get("view") === "landing";
    }
    return false;
  }, [searchString]);

  // Handle ?asset= query parameter to auto-select an asset from citation links
  useEffect(() => {
    if (searchString) {
      const params = new URLSearchParams(searchString);
      const assetId = params.get("asset");
      if (assetId && !selectedAssetIds.includes(assetId)) {
        setSelectedAssetIds((prev) => prev.includes(assetId) ? prev : [...prev, assetId]);
      }
    }
  }, [searchString]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      identifyUser(user.id, { email: user.email || "" });
    }
  }, [isAuthenticated, user, identifyUser]);


  // Clear conversation handler - starts a new thread
  const handleClearConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    toast({
      title: "New Thread Started",
      description: "Your conversation has been cleared.",
    });
  };


  const handlePlanSelect = (plan: string) => {
    setSelectedPlan(plan);
    setShowPlanSelector(false);
    // Refresh usage and entitlements data after plan change
    queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
    queryClient.invalidateQueries({ queryKey: ["/api/entitlements"] });
    queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
    toast({
      title: (plan === "starter" || plan === "scholar") ? "Welcome! Your first month is free" : "Plan selected",
      description: (plan === "starter" || plan === "scholar") 
        ? "Enjoy your free month. You can cancel anytime from settings."
        : "You can upgrade or change your plan anytime from settings.",
    });
  };

  const { data: usage } = useQuery<{
    plan: string;
    planDetails: { name: string; externalSearchAllowed: boolean; excelReportsAllowed: boolean; maxFileSizeBytes: number };
    monthly: { queriesUsed: number; queriesLimit: number; storageBytes: number; storageLimit: number };
  }>({
    queryKey: ["/api/usage"],
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  // Check if user is an org admin (OWNER or ADMIN role)
  const { data: orgContext } = useQuery<{
    hasOrg: boolean;
    role: string | null;
    capabilities: { can_view_all_devices: boolean } | null;
  }>({
    queryKey: ["/api/me/org"],
    enabled: isAuthenticated,
  });
  
  const isOrgAdmin = orgContext?.hasOrg && orgContext?.capabilities?.can_view_all_devices;

  // Check if user is a super admin (for platform administration)
  const { data: adminCheck } = useQuery<{ isAdmin: boolean; hasHealthAccess?: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });
  const isSuperAdmin = adminCheck?.isAdmin;
  const canAccessHealth = isSuperAdmin || adminCheck?.hasHealthAccess;

  // Check if enterprise mode is enabled for this user
  const { data: enterpriseModeData } = useQuery<{ enabled: boolean; maxFileSizeMB: number }>({
    queryKey: ["/api/enterprise-mode"],
    enabled: isAuthenticated,
  });
  const isEnterpriseMode = enterpriseModeData?.enabled ?? false;

  // Get current user info including their group (external vs local)
  const { data: meData } = useQuery<{ userId: string; userGroup: string; hasSeenWelcome: boolean }>({
    queryKey: ["/api/me"],
    enabled: isAuthenticated,
  });
  const isLocalUser = meData?.userGroup === "local" || meData?.userGroup === "evident";

  // Show plan selector for first-time EXTERNAL users only (not admins or local users)
  // Admin can enable plan selector for local users via toggle in Plan Rules tab
  useEffect(() => {
    if (isAuthenticated && !authLoading && !hasSelectedPlan) {
      // Admins get admin plan automatically - no selection needed
      if (isSuperAdmin) {
        setSelectedPlan("admin");
        return;
      }
      // User already has a paid plan - no selection needed
      if (usage?.plan && usage.plan !== "free") {
        setSelectedPlan(usage.plan);
        return;
      }
      // Local users (admin-created) - check if plan selector is enabled for them
      if (isLocalUser) {
        const planSelectorForLocal = localStorage.getItem("planSelectorForLocalUsers") === "true";
        if (planSelectorForLocal) {
          setShowPlanSelector(true);
        } else {
          setSelectedPlan(usage?.plan || "free");
        }
        return;
      }
      // Show plan selector for external users
      if (meData?.userGroup === "external") {
        setShowPlanSelector(true);
      }
    }
  }, [isAuthenticated, authLoading, hasSelectedPlan, isSuperAdmin, isLocalUser, meData?.userGroup, usage?.plan, setSelectedPlan]);

  const { getEnabledPacks: getEntitlementPacks, isLoading: entitlementsLoading } = useEntitlements();
  const enabledPackIds = getEntitlementPacks().map(p => p.id) as PackIdType[];

  const { data: serverAssets = [], isLoading: assetsLoading, refetch: refetchAssets } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    refetchInterval: isAuthenticated ? 15000 : false,
    enabled: isAuthenticated,
    staleTime: 10000,
  });

  const allAssets = serverAssets;

  const readyAssets = allAssets.filter((a) => a.status === "READY");
  const selectedAssets = allAssets.filter((a) => selectedAssetIds.includes(a.id));

  // Called when the user confirms which discovered docs to use after auto-discovery suggested them.
  const handleConfirmDiscoveredDocs = (docIds: string[], question: string) => {
    if (!docIds.length || !question) return;
    setSelectedAssetIds((prev) => Array.from(new Set([...prev, ...docIds])));
    chatMutation.mutate({
      question,
      assetIds: docIds,
      intentMode,
      conversationId: currentConversationId,
      learningSessionId: activeLearningSessionId,
      useLearningMode: learningModeEnabled,
      useNaturalMode: naturalModeEnabled,
      responseFormat: undefined,
      financeQueryEnabled: false,
      researchUrls,
      sourceOnly,
      usePreparedVersion,
    } as any);
  };

  const [fileSizeError, setFileSizeError] = useState<{ message: string; tips: string[] } | null>(null);
  
  const uploadMutation = useMutation({
    mutationFn: async ({ file, options }: { file: File; options?: { extractAudioOnly?: boolean } }) => {
      setFileSizeError(null);
      const formData = new FormData();
      formData.append("file", file);
      if (options?.extractAudioOnly) {
        formData.append("extractAudioOnly", "true");
      }
      
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        // Check if response is HTML (proxy error) instead of JSON
        const contentType = response.headers.get("content-type") || "";
        const responseText = await response.text();
        
        if (contentType.includes("text/html") || responseText.trim().startsWith("<")) {
          // Proxy/server returned HTML error page - likely file too large for production infrastructure
          const isVideo = file.type.startsWith("video/");
          const fileSizeMB = Math.round(file.size / 1024 / 1024);
          const tips = isVideo 
            ? [
                "For large video files, use the 'Paste video link' option instead",
                "Upload the video to Google Drive, Dropbox, or S3 and share the link",
                "Videos are processed for audio transcription only"
              ]
            : [
                "Try compressing the file or splitting it into smaller parts",
                "For videos, use the 'Paste video link' option"
              ];
          setFileSizeError({ 
            message: `File upload failed (${fileSizeMB}MB). The file may be too large for direct upload.`, 
            tips 
          });
          throw new Error(`Upload failed - file may be too large for direct upload. Try using a video link instead.`);
        }
        
        // Parse JSON error response
        try {
          const error = JSON.parse(responseText);
          if (error.tips) {
            setFileSizeError({ message: error.message, tips: error.tips });
          }
          throw new Error(error.message || "Upload failed");
        } catch (parseError) {
          throw new Error("Upload failed - server error");
        }
      }
      const fileType = file.name.split(".").pop() || "unknown";
      trackFileUpload(fileType, file.size);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      
      // Show toast for duplicate files with option to select the existing document
      if (data.reused && data.assetId) {
        const docName = data.filename || "this document";
        const assetId = data.assetId;
        toast({
          title: "Document already saved",
          description: `"${docName.length > 40 ? docName.slice(0, 40) + '...' : docName}" is already in your library. Would you like to select it?`,
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedAssetIds((prev) => prev.includes(assetId) ? prev : [...prev, assetId]);
                toast({ title: "Document selected", description: `"${docName.length > 30 ? docName.slice(0, 30) + '...' : docName}" is ready to search.` });
              }}
              data-testid="button-select-duplicate"
            >
              Select
            </Button>
          ),
        });
      }
      
      // Show learning mode prompt if not already in learning mode
      if (!activeLearningSessionId && !showLearningPrompt) {
        setShowLearningPrompt(true);
      }
    },
    onError: (error) => {
      trackError("upload_error", error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      await apiRequest("DELETE", `/api/assets/${assetId}`);
    },
    onSuccess: (_, assetId) => {
      setSelectedAssetIds((prev) => prev.filter((id) => id !== assetId));
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message || "Could not delete this document. Please try again.", variant: "destructive" });
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: async (assetId: string) => {
      await apiRequest("POST", `/api/assets/${assetId}/reprocess`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
    },
  });

  const chatMutation = useMutation({
    onMutate: ({ question, displayQuestion }) => {
      // Add question immediately for smoother UX (no layout jerk)
      // Use displayQuestion if provided (for intent rewrites), otherwise use the actual question
      const questionId = `q-${Date.now()}`;
      const shownQuestion = displayQuestion || question;
      setMessages((prev) => [...prev, { id: questionId, type: "question" as const, content: shownQuestion }].slice(-MAX_MESSAGES));
      return { questionId };
    },
    mutationFn: async ({ question, assetIds, intentMode, conversationId, displayQuestion, learningSessionId, useLearningMode, useNaturalMode, responseFormat, financeQueryEnabled, researchUrls: rUrls, sourceOnly: sOnly, usePreparedVersion: uPrepared }: { question: string; assetIds: string[]; intentMode?: "general" | "personal" | "study" | "educator" | "research" | "engineering" | "service" | "comparison" | "finance" | null; conversationId?: string | null; displayQuestion?: string; learningSessionId?: string | null; useLearningMode?: boolean; useNaturalMode?: boolean; responseFormat?: string; financeQueryEnabled?: boolean; researchUrls?: string[]; sourceOnly?: boolean; usePreparedVersion?: boolean }) => {
      trackChatMessage(assetIds.length > 0);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      
      const authToken = getStoredAuthToken();
      if (authToken) {
        headers["X-Auth-Token"] = authToken;
      }
      
      // Create a new conversation if authenticated and none exists
      let activeConversationId = conversationId;
      if (isAuthenticated && !activeConversationId) {
        try {
          const authToken = getStoredAuthToken();
          const convController = new AbortController();
          const convTimeoutId = setTimeout(() => convController.abort(), 15000);
          const createRes = await fetch("/api/conversations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(authToken ? { "X-Auth-Token": authToken } : {}),
            },
            credentials: "include",
            signal: convController.signal,
            body: JSON.stringify({ documentIds: assetIds }),
          });
          clearTimeout(convTimeoutId);
          if (createRes.ok) {
            const convData = await createRes.json();
            activeConversationId = convData.id;
            console.log('[Chat] Created new conversation:', activeConversationId);
          }
        } catch (err) {
          console.error('[Chat] Failed to create conversation:', err);
        }
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);
      
      let response: Response;
      try {
        response = await fetch("/api/chat", {
          method: "POST",
          headers,
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            assetIds,
            question,
            topK: 5,
            intentMode,
            conversationId: activeConversationId,
            learningSessionId: learningSessionId || undefined,
            useLearningMode: useLearningMode || false,
            useNaturalMode: useNaturalMode || false,
            responseFormat: responseFormat || undefined,
            financeQueryEnabled: financeQueryEnabled || false,
            researchUrls: rUrls?.filter(u => u.trim()) || [],
            sourceOnly: sOnly || false,
            usePreparedVersion: uPrepared || false,
          }),
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          throw new Error("Request timed out. Please try again.");
        }
        throw new Error("Network error. Please check your connection and try again.");
      }
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errMsg = "Failed to get answer";
        try {
          const err = await response.json();
          errMsg = err.message || errMsg;
        } catch { }
        throw new Error(errMsg);
      }
      const data = await response.json() as ChatResponse & { conversationId?: string; messageId?: string; version_used?: string; discoveredDocuments?: Array<{ id: string; filename: string }>; autoDiscovered?: boolean; pendingDocumentSelection?: boolean; pendingQuestion?: string };
      return { ...data, conversationId: data.conversationId || activeConversationId, messageId: data.messageId, version_used: data.version_used, discoveredDocuments: data.discoveredDocuments, autoDiscovered: data.autoDiscovered, pendingDocumentSelection: data.pendingDocumentSelection, pendingQuestion: data.pendingQuestion };
    },
    onSuccess: (data, { question }) => {
      const hasCitations = (data.citations?.length || 0) > 0;
      trackChatResponse(hasCitations, data.citations?.length || 0);
      
      // Save the conversation ID for follow-up questions
      if (data.conversationId) {
        setCurrentConversationId(data.conversationId);
        // Refresh conversations list
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      }
      
      // Use database messageId for enrichment, fallback to generated ID
      // Question was already added optimistically in onMutate, just add the answer
      const answerId = data.messageId || `a-${Date.now()}`;
      setMessages((prev) => {
        const newMessages = [
          ...prev,
          {
            id: answerId,
            type: "answer" as const,
            content: data.answer,
            citations: data.citations,
            evidencePreview: data.evidencePreview,
            policyCitations: data.policyCitations,
            standardCitations: data.standardCitations,
            claims: data.claims,
            learningSummary: data.learningSummary,
            trustAudit: data.trustAudit,
            financialData: data.financialData,
            versionUsed: (data.version_used === "prepared" ? "prepared" : "original") as "original" | "prepared",
            discoveredDocuments: data.discoveredDocuments,
            autoDiscovered: data.autoDiscovered,
            pendingDocumentSelection: data.pendingDocumentSelection,
            pendingQuestion: data.pendingQuestion,
          },
        ];
        return newMessages.slice(-MAX_MESSAGES);
      });

      // If the server is asking the user to confirm which docs to use, do not
      // auto-select or treat this as a final answer. The user will pick docs
      // and the chat-section will call onConfirmDiscoveredDocs to re-ask.
      if (data.pendingDocumentSelection) {
        return;
      }

      // Detect generic answers and suggest Learning Mode
      if (!activeLearningSessionId && data.answer) {
        const isGeneric = detectGenericAnswer(data.answer);
        if (isGeneric) {
          const suggestedTopic = extractTopicFromQuestion(question, data.answer);
          setSuggestedLearningTopic(suggestedTopic);
          setShowAnswerLearningPrompt(true);
        }
      }
    },
    onError: (error) => {
      trackError("chat_error", error.message);
      const errorMsg = error.message?.includes("timed out")
        ? "The response took too long. This can happen with large documents. Please try a more specific question."
        : error.message?.includes("Network error")
        ? "Connection lost. Please check your internet and try again."
        : error.message || "Something went wrong. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          type: "answer" as const,
          content: `⚠️ ${errorMsg}`,
        },
      ].slice(-MAX_MESSAGES));
    },
  });

  const financeMutation = useMutation({
    onMutate: ({ question }: { question: string; assetIds: string[] }) => {
      const questionId = `fq-${Date.now()}`;
      setFinanceMessages((prev) => [...prev, { id: questionId, type: "question" as const, content: question }].slice(-MAX_MESSAGES));
      return { questionId };
    },
    mutationFn: async ({ question, assetIds }: { question: string; assetIds: string[] }) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const authToken = getStoredAuthToken();
      if (authToken) {
        headers["X-Auth-Token"] = authToken;
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          assetIds,
          question,
          topK: 5,
          intentMode: "finance",
          financeQueryEnabled: true,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to get financial data");
      }
      return await response.json();
    },
    onSuccess: (data: any) => {
      const answerId = data.messageId || `fa-${Date.now()}`;
      setFinanceMessages((prev) => [
        ...prev,
        {
          id: answerId,
          type: "answer" as const,
          content: data.answer,
          citations: data.citations,
          evidencePreview: data.evidencePreview,
          financialData: data.financialData,
        },
      ].slice(-MAX_MESSAGES));
    },
    onError: (error: any) => {
      trackError("finance_error", error.message);
    },
  });

  const handleAskFinance = useCallback((question: string) => {
    if (!question.trim()) return;
    const readyIds = selectedAssetIds.filter((id) => {
      const asset = allAssets.find((a: any) => a.id === id);
      return asset && asset.status === "READY";
    });
    financeMutation.mutate({ question: question.trim(), assetIds: readyIds });
  }, [selectedAssetIds, allAssets, financeMutation]);

  // Diagram analysis mode type
  type DiagramAnalysisMode = 'default' | 'simple' | 'steps' | 'terms' | 'quiz';
  
  const imageChatMutation = useMutation({
    mutationFn: async ({ image, prompt, assetIds, analysisMode }: { image: File; prompt?: string; assetIds: string[]; analysisMode?: DiagramAnalysisMode }) => {
      if (assetIds.length === 0) {
        throw new Error("Please select at least one ready document first");
      }
      
      const formData = new FormData();
      formData.append("image", image);
      formData.append("assetIds", JSON.stringify(assetIds));
      if (prompt) formData.append("prompt", prompt);
      if (analysisMode) formData.append("analysisMode", analysisMode);
      
      const imageAuthToken = getStoredAuthToken();
      const imageHeaders: Record<string, string> = {};
      if (imageAuthToken) {
        imageHeaders["X-Auth-Token"] = imageAuthToken;
      }
      const imgController = new AbortController();
      const imgTimeoutId = setTimeout(() => imgController.abort(), 120000);
      let response: Response;
      try {
        response = await fetch("/api/chat/image", {
          method: "POST",
          headers: imageHeaders,
          credentials: "include",
          signal: imgController.signal,
          body: formData,
        });
      } catch (fetchErr: any) {
        clearTimeout(imgTimeoutId);
        if (fetchErr.name === 'AbortError') throw new Error("Request timed out. Please try again.");
        throw new Error("Network error. Please check your connection and try again.");
      }
      clearTimeout(imgTimeoutId);
      if (!response.ok) {
        let errMsg = "Failed to analyze image";
        try { const err = await response.json(); errMsg = err.message || errMsg; } catch { }
        throw new Error(errMsg);
      }
      const result = await response.json() as ImageChatResponse;
      
      const reader = new FileReader();
      const imageDataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(image);
      });
      
      return { result, imageDataUrl, prompt, analysisMode };
    },
    onSuccess: ({ result, imageDataUrl, prompt }) => {
      const questionId = `qi-${Date.now()}`;
      const answerId = `ai-${Date.now()}`;
      setMessages((prev) => {
        const newMessages = [
          ...prev,
          { 
            id: questionId, 
            type: "question" as const, 
            content: prompt || "Image search",
            imageUrl: imageDataUrl,
          },
          {
            id: answerId,
            type: "answer" as const,
            content: result.answer,
            citations: result.citations,
            evidencePreview: result.evidencePreview,
            imageQuery: result.imageQuery,
            standardCitations: (result as any).standardCitations,
            claims: (result as any).claims,
          },
        ];
        return newMessages.slice(-MAX_MESSAGES);
      });
    },
  });

  // External search mutation - uses web search augmentation
  const externalChatMutation = useMutation({
    mutationFn: async (question: string) => {
      const externalHeaders: Record<string, string> = { "Content-Type": "application/json" };
      const externalAuthToken = getStoredAuthToken();
      if (externalAuthToken) {
        externalHeaders["X-Auth-Token"] = externalAuthToken;
      }
      const extController = new AbortController();
      const extTimeoutId = setTimeout(() => extController.abort(), 120000);
      let response: Response;
      try {
        response = await fetch("/api/chat/external", {
          method: "POST",
          headers: externalHeaders,
          credentials: "include",
          signal: extController.signal,
          body: JSON.stringify({ question }),
        });
      } catch (fetchErr: any) {
        clearTimeout(extTimeoutId);
        if (fetchErr.name === 'AbortError') throw new Error("Request timed out. Please try again.");
        throw new Error("Network error. Please check your connection and try again.");
      }
      clearTimeout(extTimeoutId);
      if (!response.ok) {
        let errMsg = "Failed to search external sources";
        try { const err = await response.json(); errMsg = err.message || errMsg; } catch { }
        throw new Error(errMsg);
      }
      return { result: await response.json() as ChatResponse, question };
    },
    onMutate: (question) => {
      // Add question immediately
      const questionId = `qe-${Date.now()}`;
      setMessages((prev) => [...prev, { id: questionId, type: "question" as const, content: `🌐 ${question}` }].slice(-MAX_MESSAGES));
    },
    onSuccess: ({ result }) => {
      const answerId = `ae-${Date.now()}`;
      setMessages((prev) => {
        const newMessages = [
          ...prev,
          {
            id: answerId,
            type: "answer" as const,
            content: result.answer,
            citations: result.citations,
            evidencePreview: result.evidencePreview,
            standardCitations: (result as any).standardCitations,
            claims: (result as any).claims,
          },
        ];
        return newMessages.slice(-MAX_MESSAGES);
      });
    },
  });

  const extractMutation = useMutation({
    mutationFn: async () => {
      trackExtraction("obligations");
      const readyIds = selectedAssetIds.filter((id) => {
        const asset = allAssets.find((a) => a.id === id);
        return asset && asset.status === "READY";
      });
      const response = await fetch("/api/actions/extract-obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: readyIds[0] }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to extract obligations");
      }
      return response.json() as Promise<ExtractObligationsResponse>;
    },
    onSuccess: (data) => {
      setObligations(data.obligations);
    },
    onError: (error) => {
      trackError("extraction_error", error.message);
    },
  });

  const excelReportMutation = useMutation({
    mutationFn: async (reportType: string) => {
      const readyIds = selectedAssetIds.filter((id) => {
        const asset = allAssets.find((a) => a.id === id);
        return asset && asset.status === "READY";
      });
      const excelAsset = readyIds.find((id) => {
        const asset = allAssets.find((a) => a.id === id);
        return asset && /\.(xlsx|xls|csv)$/i.test(asset.filename);
      });
      if (!excelAsset) {
        throw new Error("No Excel file selected");
      }
      const response = await fetch("/api/actions/excel-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: excelAsset, reportType }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to generate report");
      }
      return response.json() as Promise<ExcelReportResponse>;
    },
    onSuccess: (data) => {
      setExcelReport(data);
    },
  });

  const handleUpload = useCallback((file: File, options?: { extractAudioOnly?: boolean }) => {
    if (!isAuthenticated || !user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to upload documents.",
        variant: "default",
      });
      return;
    }
    uploadMutation.reset();
    setFileSizeError(null);
    uploadMutation.mutate({ file, options });
  }, [uploadMutation, isAuthenticated, user, toast]);

  const handleAsk = useCallback(async (question: string, intentMode?: "general" | "personal" | "study" | "educator" | "research" | "engineering" | "service" | "comparison" | "finance" | null, responseFormat?: string, skipIntentResolution?: boolean) => {
    const readyIds = selectedAssetIds.filter((id) => {
      const asset = allAssets.find((a) => a.id === id);
      return asset && asset.status === "READY";
    });
    
    // Allow document-free learning mode (external research only)
    const isDocumentFreeLearning = readyIds.length === 0 && learningModeEnabled && hasAcceptedLearningMode;
    // Allow document-free finance mode when Finance Query toggle is ON
    const isDocumentFreeFinance = readyIds.length === 0 && intentMode === "finance" && financeQueryEnabled;
    // Allow owner-wide search when authenticated with no docs selected
    const isOwnerWideSearch = readyIds.length === 0 && isAuthenticated;
    
    if (readyIds.length === 0 && !isDocumentFreeLearning && !isDocumentFreeFinance && !isOwnerWideSearch) return;

    const lastAnswer = messages.filter(m => m.type === "answer").at(-1);
    const lastQuestion = messages.filter(m => m.type === "question").at(-1);
    
    if (lastAnswer && !skipIntentResolution) {
      try {
        const intentResult = await conversationFlow.resolveIntent(
          question,
          lastQuestion?.content,
          lastAnswer.content,
          lastAnswer.evidencePreview?.map(e => ({ assetId: e.n.toString(), title: e.sourceRef }))
        );

        if (intentResult && conversationFlow.isActionIntent(intentResult.intent)) {
          // For SUMMARIZE/SIMPLIFY, we'll use chatMutation which handles adding the question
          // For other action intents, add the question manually since they don't call chatMutation
          const skipManualQuestion = intentResult.intent === ConversationIntent.SUMMARIZE || 
                                     intentResult.intent === ConversationIntent.SIMPLIFY;
          if (!skipManualQuestion) {
            const userMsgId = `q-${Date.now()}`;
            setMessages(prev => [...prev, { id: userMsgId, type: "question", content: question }]);
          }
          
          if (intentResult.intent === ConversationIntent.GENERATE_PRESENTATION) {
            setShowTemplateModal("ppt");
            if (intentResult.suggestedResponse) {
              setMessages(prev => [...prev, 
                { id: `ai-${Date.now()}`, type: "answer", content: intentResult.suggestedResponse! }
              ]);
            }
            return;
          }
          if (intentResult.intent === ConversationIntent.GENERATE_PROPOSAL) {
            setShowTemplateModal("proposal");
            if (intentResult.suggestedResponse) {
              setMessages(prev => [...prev,
                { id: `ai-${Date.now()}`, type: "answer", content: intentResult.suggestedResponse! }
              ]);
            }
            return;
          }
          if (intentResult.intent === ConversationIntent.SEND_EMAIL) {
            if (intentResult.slots.emailAddress) {
              setMessages(prev => [...prev,
                { id: `ai-${Date.now()}`, type: "answer", content: `I'll prepare this to send to ${intentResult.slots.emailAddress}. (Email sending coming soon!)` }
              ]);
            } else if (intentResult.suggestedResponse) {
              setMessages(prev => [...prev,
                { id: `ai-${Date.now()}`, type: "answer", content: intentResult.suggestedResponse! }
              ]);
            }
            return;
          }
          if ((intentResult.intent === ConversationIntent.SUMMARIZE || 
              intentResult.intent === ConversationIntent.SIMPLIFY) && 
              intentResult.confidence >= 0.8) {
            // Query the CURRENTLY selected documents for a summary
            // This ensures switching documents and asking "summarize" works correctly
            // Use displayQuestion to show user's original request while sending optimized prompt to AI
            const summaryPrompt = intentResult.intent === ConversationIntent.SIMPLIFY
              ? "Please provide a simple, easy-to-understand explanation of what these documents are about. Use plain language."
              : "Please provide a concise summary of the key points from these documents.";
            chatMutation.mutate({ question: summaryPrompt, assetIds: readyIds, intentMode, conversationId: currentConversationId, displayQuestion: question, learningSessionId: activeLearningSessionId, useLearningMode: learningModeEnabled, useNaturalMode: naturalModeEnabled, responseFormat, researchUrls, sourceOnly, usePreparedVersion });
            return;
          }
        }
        
        if (intentResult?.intent === ConversationIntent.CONFIRM_NO) {
          setMessages(prev => [...prev,
            { id: `q-${Date.now()}`, type: "question", content: question }
          ]);
          if (intentResult.suggestedResponse) {
            setMessages(prev => [...prev,
              { id: `ai-${Date.now()}`, type: "answer", content: intentResult.suggestedResponse! }
            ]);
          }
          return;
        }
        if (intentResult?.intent === ConversationIntent.PROVIDE_EMAIL) {
          setMessages(prev => [...prev,
            { id: `q-${Date.now()}`, type: "question", content: question }
          ]);
          if (intentResult.suggestedResponse) {
            setMessages(prev => [...prev,
              { id: `ai-${Date.now()}`, type: "answer", content: intentResult.suggestedResponse! }
            ]);
          }
          return;
        }
        if (intentResult?.intent === ConversationIntent.CONFIRM_YES) {
          // User confirmed "yes" — send the original question to the AI for a real answer
          // instead of returning a canned response that dead-ends the conversation
          const originalQuestion = lastQuestion?.content || question;
          chatMutation.mutate({ question: originalQuestion, assetIds: readyIds, intentMode, conversationId: currentConversationId, displayQuestion: question, learningSessionId: activeLearningSessionId, useLearningMode: learningModeEnabled, useNaturalMode: naturalModeEnabled, responseFormat, researchUrls, sourceOnly, usePreparedVersion });
          return;
        }
      } catch (error) {
        console.error("Intent resolution failed, falling back to Q&A:", error);
      }
    }

    setShowAnswerLearningPrompt(false);
    chatMutation.mutate({ 
      question, 
      assetIds: readyIds, 
      intentMode, 
      conversationId: currentConversationId, 
      learningSessionId: activeLearningSessionId,
      useLearningMode: learningModeEnabled,
      useNaturalMode: naturalModeEnabled,
      responseFormat,
      financeQueryEnabled: intentMode === "finance" ? financeQueryEnabled : false,
      researchUrls,
      sourceOnly,
      usePreparedVersion,
    });
  }, [selectedAssetIds, allAssets, chatMutation, messages, conversationFlow, currentConversationId, activeLearningSessionId, learningModeEnabled, naturalModeEnabled, financeQueryEnabled, researchUrls, sourceOnly, isAuthenticated, usePreparedVersion]);


  const handleCompareVersions = useCallback(async (question: string) => {
    const readyIds = selectedAssetIds.filter((id) => {
      const asset = allAssets.find((a) => a.id === id);
      return asset && asset.status === "READY";
    });
    if (readyIds.length === 0) return;

    const questionId = `q-${Date.now()}`;
    setMessages((prev) => [...prev, { id: questionId, type: "question" as const, content: `[Compare] ${question}` }].slice(-MAX_MESSAGES));

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const authToken = getStoredAuthToken();
    if (authToken) headers["X-Auth-Token"] = authToken;

    try {
      const [origRes, prepRes] = await Promise.all([
        fetch("/api/chat", {
          method: "POST", headers, credentials: "include",
          body: JSON.stringify({ assetIds: readyIds, question, topK: 5, usePreparedVersion: false }),
        }),
        fetch("/api/chat", {
          method: "POST", headers, credentials: "include",
          body: JSON.stringify({ assetIds: readyIds, question, topK: 5, usePreparedVersion: true }),
        }),
      ]);

      const origData = origRes.ok ? await origRes.json() : null;
      const prepData = prepRes.ok ? await prepRes.json() : null;

      if (origData) {
        setMessages((prev) => [...prev, {
          id: `cmp-orig-${Date.now()}`, type: "answer" as const, content: origData.answer,
          citations: origData.citations, evidencePreview: origData.evidencePreview,
          versionUsed: "original", isCompareMode: true, compareLabel: "Original Document Answer",
        }].slice(-MAX_MESSAGES));
      }
      if (prepData) {
        const actualVersion = prepData.version_used === "prepared" ? "prepared" : "original";
        const label = actualVersion === "prepared" 
          ? "Prepared Version Answer" 
          : "Prepared Version Answer (fell back to original — no prepared version available)";
        setMessages((prev) => [...prev, {
          id: `cmp-prep-${Date.now()}`, type: "answer" as const, content: prepData.answer,
          citations: prepData.citations, evidencePreview: prepData.evidencePreview,
          versionUsed: actualVersion, isCompareMode: true, compareLabel: label,
        }].slice(-MAX_MESSAGES));
      }
    } catch (err) {
      console.error("Compare versions error:", err);
    }
  }, [selectedAssetIds, allAssets]);

  const handleAskImage = useCallback((image: File, prompt?: string, analysisMode?: 'default' | 'simple' | 'steps' | 'terms' | 'quiz') => {
    const readyIds = selectedAssetIds.filter((id) => {
      const asset = allAssets.find((a) => a.id === id);
      return asset && asset.status === "READY";
    });
    if (readyIds.length === 0) return;
    imageChatMutation.mutate({ image, prompt, assetIds: readyIds, analysisMode });
  }, [selectedAssetIds, allAssets, imageChatMutation]);

  const handleAskExternal = useCallback((question: string) => {
    externalChatMutation.mutate(question);
  }, [externalChatMutation]);

  // Load a saved conversation into the chat
  const handleLoadConversation = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load conversation");
      const data = await response.json();
      
      // Convert to ChatMessage format
      const loadedMessages: ChatMessage[] = (data.messages || []).map((msg: any) => ({
        id: msg.id,
        type: msg.role === "user" ? "question" : "answer",
        content: msg.content,
        citations: msg.citations,
      }));
      
      setMessages(loadedMessages);
      setCurrentConversationId(conversationId);
      
      if (data.conversation?.documentIds?.length > 0) {
        const unique: string[] = [];
        const seen = new Set<string>();
        for (const id of data.conversation.documentIds) {
          if (!seen.has(id)) { seen.add(id); unique.push(id); }
        }
        const stillExist = unique.filter(id => allAssets.some(a => a.id === id));
        const missingCount = unique.length - stillExist.length;
        setSelectedAssetIds(stillExist);

        if (missingCount > 0 && stillExist.length > 0) {
          toast({
            title: "Thread loaded",
            description: `${missingCount} document${missingCount > 1 ? 's' : ''} from this conversation ${missingCount > 1 ? 'are' : 'is'} no longer available. The remaining ${stillExist.length} document${stillExist.length > 1 ? 's have' : ' has'} been re-selected.`,
          });
        } else if (missingCount > 0 && stillExist.length === 0) {
          toast({
            title: "Thread loaded",
            description: "The documents from this conversation are no longer available. You can review the previous answers but won't be able to ask follow-up questions about those documents.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Thread loaded",
            description: `${stillExist.length} document${stillExist.length > 1 ? 's' : ''} re-selected — you can continue this conversation.`,
          });
        }
      } else {
        toast({
          title: "Thread loaded",
          description: "You can review this conversation.",
        });
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
      toast({
        title: "Error",
        description: "Could not load the conversation",
        variant: "destructive",
      });
    }
  }, [toast, allAssets]);

  const handleExtractObligations = useCallback(() => {
    const readyIds = selectedAssetIds.filter((id) => {
      const asset = allAssets.find((a) => a.id === id);
      return asset && asset.status === "READY";
    });
    if (readyIds.length === 0) return;
    setHasAttemptedExtraction(true);
    extractMutation.mutate();
  }, [selectedAssetIds, allAssets, extractMutation]);

  const handleGenerateExcelReport = useCallback((reportType: string) => {
    excelReportMutation.mutate(reportType);
  }, [excelReportMutation]);

  const hasExcelFile = selectedAssets.some((a) => 
    a.status === "READY" && /\.(xlsx|xls|csv)$/i.test(a.filename)
  );

  const handleToggleAsset = useCallback((assetId: string) => {
    setSelectedAssetIds((prev) => 
      prev.includes(assetId) 
        ? prev.filter((id) => id !== assetId) 
        : [...prev, assetId]
    );
  }, []);

  const handleSelectAll = useCallback((assetIds: string[]) => {
    setSelectedAssetIds(assetIds);
  }, []);

  const handleDeleteAsset = useCallback((assetId: string) => {
    deleteMutation.mutate(assetId);
  }, [deleteMutation]);

  const handleReprocessAsset = useCallback((assetId: string) => {
    reprocessMutation.mutate(assetId);
  }, [reprocessMutation]);

  const latestCitations = messages.filter((m) => m.type === "answer").at(-1)?.citations || [];
  const latestEvidence = messages.filter((m) => m.type === "answer").at(-1)?.evidencePreview || [];

  const hasReadySelectedAssets = selectedAssetIds.some((id) => {
    const asset = allAssets.find((a) => a.id === id);
    return asset && asset.status === "READY";
  });


  const recentQuestions = useMemo(() => {
    const qaPairs: { id: string; text: string; answer: string; timestamp: Date }[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.type === "question") {
        const nextMsg = messages[i + 1];
        if (nextMsg && nextMsg.type === "answer") {
          qaPairs.push({
            id: `qa-${msg.id}`,
            text: msg.content,
            answer: nextMsg.content,
            timestamp: new Date(),
          });
        }
      }
    }
    return qaPairs.slice(-10).reverse();
  }, [messages]);

  const handleReaskQuestion = useCallback((question: string) => {
    if (!hasReadySelectedAssets) {
      toast({
        title: "No documents selected",
        description: "Please select at least one ready document to ask questions.",
        variant: "destructive",
      });
      return;
    }
    handleAsk(question);
  }, [hasReadySelectedAssets, handleAsk, toast]);

  const learningModeMutation = useMutation({
    mutationFn: async (data: { topic: string; assetIds: string[]; customUrls?: string[] }) => {
      const response = await apiRequest("POST", "/api/learning-mode/start", data);
      return response.json();
    },
    onSuccess: (data) => {
      setShowLearningPrompt(false);
      setShowAnswerLearningPrompt(false);
      toast({
        title: "Learning Started",
        description: `I'm studying "${data.session.topic}" to give you better answers...`,
      });
    },
  });

  const handleEnableLearningMode = useCallback((topic: string) => {
    const readyIds = selectedAssets.filter(a => a.status === "READY").map(a => a.id);
    learningModeMutation.mutate({ topic, assetIds: readyIds });
  }, [selectedAssets, learningModeMutation]);

  // Learning Mode toggle handlers
  const handleLearningModeToggle = useCallback((enabled: boolean) => {
    // If turning ON and user hasn't accepted yet, show the info modal
    if (enabled && !hasAcceptedLearningMode) {
      setShowLearningAcceptModal(true);
      return; // Don't enable yet - wait for acceptance
    }
    
    setLearningModeEnabled(enabled);
    try {
      localStorage.setItem("evident_learning_mode_enabled", String(enabled));
    } catch {}
  }, [hasAcceptedLearningMode]);

  // Natural Mode toggle handler - simpler, persisted
  const handleNaturalModeToggle = useCallback((enabled: boolean) => {
    setNaturalModeEnabled(enabled);
    try {
      localStorage.setItem("evident_natural_mode_enabled", String(enabled));
    } catch {}
  }, []);

  const handleLearningModeAccepted = useCallback(() => {
    setHasAcceptedLearningMode(true);
    setShowLearningAcceptModal(false);
    // Enable the toggle since user accepted
    setLearningModeEnabled(true);
    try {
      localStorage.setItem("evident_learning_mode_accepted", "true");
      localStorage.setItem("evident_learning_mode_enabled", "true");
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <WelcomeModal isAuthenticated={isAuthenticated} hasSeenWelcomeServer={meData?.hasSeenWelcome} />
      {isAuthenticated && <OnboardingTour />}

      {/* Learning Mode Acceptance Modal */}
      <Dialog open={showLearningAcceptModal} onOpenChange={setShowLearningAcceptModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Enable Research Mode?
            </DialogTitle>
            <DialogDescription>
              Research Mode enhances your answers with web research and lets you paste specific URLs as sources.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                Automatic research from trusted external sources
              </span>
            </div>
            <div className="flex items-start gap-3">
              <BookOpen className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                Clear separation between document evidence and external insights
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Brain className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                Save learnings to your personal knowledge history
              </span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                // Just close modal - toggle stays OFF since we haven't enabled it yet
                setShowLearningAcceptModal(false);
              }}
              data-testid="button-learning-mode-decline"
            >
              No Thanks
            </Button>
            <Button
              onClick={handleLearningModeAccepted}
              data-testid="button-learning-mode-accept"
            >
              Enable Learning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <PlanSelectorModal 
        open={showPlanSelector} 
        onClose={() => setShowPlanSelector(false)}
        onSelectPlan={handlePlanSelect}
      />
      <FeatureVotingModal 
        open={showFeatureVoting} 
        onOpenChange={setShowFeatureVoting}
      />
      <ReportIssueDialog
        open={showFeedbackDialog}
        onOpenChange={setShowFeedbackDialog}
        defaultType="improvement"
      />
      <UseCasesPrompt userId={user?.id} isAuthenticated={isAuthenticated} />
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:bg-background dark:backdrop-blur-none" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3">
            <img 
              src="/apple-touch-icon.png?v=3" 
              alt="Evident" 
              className="w-10 h-10 rounded-xl shadow-lg"
              data-testid="img-app-logo"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Evident
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Evidence-Based Assistant</p>
            </div>
            <PilotModeBadge />
            {isAuthenticated && usage?.plan && (
              <PlanBadge planKey={usage.plan} compact />
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {selectedAssets.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium" data-testid="text-current-filename">
                  {selectedAssets.length} document{selectedAssets.length > 1 ? "s" : ""} selected
                </span>
              </div>
            )}
            {isAuthenticated && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2"
                  data-testid="button-upgrade-header"
                  onClick={() => window.location.href = "/pricing"}
                >
                  <Tag className="w-4 h-4" />
                  <span className="hidden sm:inline">Upgrade</span>
                </Button>
              </>
            )}
            {authLoading ? (
              <div className="w-9 h-9 rounded-full bg-muted animate-pulse hidden sm:block" />
            ) : isAuthenticated && user ? (
              <DropdownMenu modal={false} open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
                <DropdownMenuTrigger asChild className="hidden sm:flex">
                  <button 
                    type="button"
                    className="rounded-full w-14 h-14 min-w-[56px] min-h-[56px] p-0 relative cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center justify-center bg-transparent border-0 hover:bg-muted/50 active:bg-muted/70 transition-colors"
                    style={{ 
                      WebkitTapHighlightColor: 'rgba(0,0,0,0.1)',
                      touchAction: 'manipulation'
                    }}
                    data-testid="button-user-menu"
                    aria-label="User menu"
                  >
                    <Avatar className="w-9 h-9 sm:w-10 sm:h-10 pointer-events-none">
                      <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
                      <AvatarFallback>
                        <User className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-2 py-1.5 text-sm">
                    <p className="font-medium">{user.firstName} {user.lastName}</p>
                    <p className="text-muted-foreground text-xs">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {/* Evident/Internal users see full menu - Premium/Admin users see all buttons unlocked */}
                  {isLocalUser && (
                    <>
                      <div className="px-2 py-2">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Usage This Month</p>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Documents</span>
                            <span className="font-medium" data-testid="text-docs-count">{allAssets.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Questions</span>
                            <span className="font-medium" data-testid="text-questions-count">
                              {usage?.monthly?.queriesUsed ?? 0} / {usage?.monthly?.queriesLimit ?? 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Plan</span>
                            <span className="font-medium" data-testid="text-plan-name">{usage?.planDetails?.name ?? "Free"}</span>
                          </div>
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                      {isOrgAdmin && (
                        <Link href="/org/agents">
                          <DropdownMenuItem className="cursor-pointer" data-testid="link-org-admin">
                            <Building2 className="w-4 h-4 mr-2" />
                            Org Admin Console
                          </DropdownMenuItem>
                        </Link>
                      )}
                      <Link href="/use-cases">
                        <DropdownMenuItem className="cursor-pointer" data-testid="link-use-cases">
                          <Lightbulb className="w-4 h-4 mr-2" />
                          Use Cases
                        </DropdownMenuItem>
                      </Link>
                      {/* Intelligence Packs menu item hidden */}
                      {/* Policy Settings - only shown for premium users */}
                      {(usage?.plan === "premium_org" || usage?.plan === "pro_plus" || usage?.plan === "admin" || isSuperAdmin) && (
                        <Link href="/policy">
                          <DropdownMenuItem className="cursor-pointer" data-testid="link-policy">
                            <FolderKanban className="w-4 h-4 mr-2" />
                            Policy Settings
                          </DropdownMenuItem>
                        </Link>
                      )}
                      <Link href="/ai-readiness/qa">
                        <DropdownMenuItem className="cursor-pointer" data-testid="link-ai-readiness-qa">
                          <HelpCircle className="w-4 h-4 mr-2" />
                          AI Readiness Guide
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/readiness">
                        <DropdownMenuItem className="cursor-pointer" data-testid="link-ai-readiness-scanner">
                          <FileSearch className="w-4 h-4 mr-2" />
                          AI Readiness Scanner
                        </DropdownMenuItem>
                      </Link>
                      {!isStudentMode && (
                        <Link href="/services">
                          <DropdownMenuItem className="cursor-pointer" data-testid="link-create-report">
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            Evident Insights
                          </DropdownMenuItem>
                        </Link>
                      )}
                    </>
                  )}
                  {/* Super Admin access - shown to all super admins regardless of user group */}
                  {isSuperAdmin && (
                    <Link href="/admin">
                      <DropdownMenuItem className="cursor-pointer" data-testid="link-super-admin">
                        <Shield className="w-4 h-4 mr-2" />
                        Admin Panel
                      </DropdownMenuItem>
                    </Link>
                  )}
                  {/* All users see these core items */}
                  <DropdownMenuItem 
                    className="cursor-pointer" 
                    data-testid="link-pricing"
                    onClick={() => window.location.href = "/pricing"}
                  >
                    <Tag className="w-4 h-4 mr-2" />
                    Plans and Pricing
                  </DropdownMenuItem>
                  <Link href="/billing">
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-billing">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Billing
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/settings">
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-settings">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem 
                    className="cursor-pointer" 
                    data-testid="link-customize-view"
                    onSelect={(e) => {
                      e.preventDefault();
                      setShowCustomizeModal(true);
                    }}
                  >
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Customize View
                  </DropdownMenuItem>
                  <Link href="/learning">
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-my-learning">
                      <GraduationCap className="w-4 h-4 mr-2" />
                      My Learning
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/blog/manage">
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-blog-manage">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Blog Management
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/help">
                    <DropdownMenuItem className="cursor-pointer" data-testid="link-help">
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Help
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem 
                    className="cursor-pointer" 
                    data-testid="link-feedback"
                    onSelect={(e) => {
                      e.preventDefault();
                      setShowFeedbackDialog(true);
                    }}
                  >
                    <MessageSquarePlus className="w-4 h-4 mr-2" />
                    Send Feedback
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="cursor-pointer" 
                    data-testid="link-tutorials"
                    onClick={() => window.location.href = "/tutorials"}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Video Tutorials
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5">
                    <ShareButtons showLabel={true} />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      toggleTheme();
                    }}
                    className="cursor-pointer"
                    data-testid="button-theme-toggle"
                  >
                    {isDarkMode ? <Sun className="w-4 h-4 mr-2 text-amber-400" /> : <Moon className="w-4 h-4 mr-2 text-indigo-500" />}
                    {isDarkMode ? "Light mode" : "Dark mode"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={async (e) => {
                      e.preventDefault();
                      console.log("[Logout] Sign out clicked");
                      // Clear auth token from localStorage first
                      try {
                        localStorage.removeItem("evident_auth_token");
                      } catch {}
                      // Direct logout without mutation to ensure it fires
                      try {
                        console.log("[Logout] Calling logout API...");
                        await fetch("/api/auth/logout", {
                          method: "POST",
                          credentials: "include",
                        });
                        console.log("[Logout] API call complete, redirecting...");
                        window.location.href = "/";
                      } catch (err) {
                        console.error("[Logout] Error:", err);
                        window.location.href = "/";
                      }
                    }} 
                    className="cursor-pointer" 
                    data-testid="link-logout"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </header>

      {((!authLoading && !isAuthenticated) || showLandingView) && (
        <div className="relative">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-10 dark:opacity-5"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12 text-center">
            {/* Mobile-first: CTA visible immediately */}
            {!isAuthenticated && (
              <div className="flex flex-col items-center mb-6">
                {/* Compact headline for mobile */}
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Get trusted answers
                  </span>
                  <br className="sm:hidden" />
                  <span className="hidden sm:inline"> </span>
                  from your documents
                </h2>
                
                {/* Primary CTA - Immediately visible */}
                <Button 
                  asChild
                  size="lg" 
                  className="text-lg sm:text-2xl px-8 sm:px-16 py-6 sm:py-10 h-auto font-bold shadow-2xl shadow-primary/40 bg-gradient-to-r from-primary to-accent hover:opacity-90 transform hover:scale-105 transition-all animate-pulse mb-3"
                  data-testid="button-main-get-started"
                >
                  <a href="/auth">
                    <Sparkles className="w-5 h-5 sm:w-7 sm:h-7 mr-2 sm:mr-3" />
                    Get Started
                  </a>
                </Button>
                
                <div className="flex flex-col items-center gap-1 mb-4">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Sign in with just your email — no password needed
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
                    <Shield className="w-3 h-3 text-chart-2" />
                    <span>Your files stay private</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Secondary content - below the fold on mobile */}
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto mb-6">
              Upload any document, image, or media file. Ask questions and get AI-powered answers 
              backed by direct evidence from your source material.
            </p>
            
            {/* App Store Links - smaller, less prominent */}
            {!isAuthenticated && (
              <div className="flex flex-row items-center justify-center gap-3 mb-6">
                <a 
                  href="https://apps.apple.com/us/app/evidentai/id6758041735" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black/80 text-white hover:bg-black transition-colors text-sm"
                  data-testid="link-appstore-hero"
                >
                  <SiApple className="w-4 h-4" />
                  <span className="font-medium">iOS App</span>
                </a>
                <span className="text-xs text-muted-foreground">Android coming soon</span>
              </div>
            )}

            <Link href="/live" className="block max-w-2xl mx-auto mb-8" data-testid="link-ai-readiness-banner">
              <div className="relative overflow-visible rounded-xl p-[2px] bg-gradient-to-r from-cyan-500 via-blue-500 via-purple-500 to-pink-500 hover-elevate">
                <div className="relative rounded-[10px] bg-background/95 backdrop-blur-sm px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                          AI Readiness Check
                        </span>
                        <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0 text-xs font-bold">
                          FREE
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Scan your files locally. Get an instant readiness score. No upload required.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            </Link>
            
            <div className="w-full max-w-3xl mx-auto mb-8 px-4 sm:px-0">
              <div className="rounded-xl overflow-hidden shadow-lg border border-border/50 bg-card">
                <img
                  src={heroMockup}
                  alt="Evident AI document analysis dashboard"
                  className="w-full h-auto object-contain mx-auto"
                  data-testid="img-hero-mockup"
                />
                <div className="p-6 space-y-4 border-t border-border/30">
                  <p className="text-lg font-bold text-foreground text-center">
                    AI is everywhere — but most company knowledge isn't ready for it.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                      <p className="font-semibold text-foreground">The Problem</p>
                      <p className="text-muted-foreground">Documents are messy. Policies conflict. AI tools guess. That's why answers can't always be trusted.</p>
                    </div>
                    
                    <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                      <p className="font-semibold text-foreground">What Evident Does</p>
                      <p className="text-muted-foreground">Prepares your organisation's knowledge for AI. Reads documents where they live, cleans and structures them, checks AI-readiness, and remembers where every fact comes from.</p>
                    </div>
                    
                    <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                      <p className="font-semibold text-foreground">Key Differentiation</p>
                      <p className="text-muted-foreground">Evident doesn't replace your AI tools — it makes them trustworthy. Copilot, internal agents, and future AI systems all get better answers with evidence.</p>
                    </div>
                    
                    <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                      <p className="font-semibold text-foreground">Trust & Compliance</p>
                      <p className="text-muted-foreground">Every answer includes sources. Preview the exact section. Open the original document when you need full context. No guessing. No hallucinations.</p>
                    </div>
                  </div>
                  
                  <div className="text-center pt-2 border-t border-border/30">
                    <p className="text-base font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      Evident — the knowledge layer beneath AI
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Prepare once. Trust every answer.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm mb-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-4 h-4 text-chart-2" />
                <span>Citation-backed answers</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Zap className="w-4 h-4 text-chart-4" />
                <span>Multi-format support</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="w-4 h-4 text-accent" />
                <span>Obligations extraction</span>
              </div>
              
            </div>

            <div className="mb-10">
              <div className="text-center mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-chart-2 mb-2">Quick Demos</p>
                <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  See It In Action
                </h3>
                <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
                  Watch 30-second demos to see how Evident helps with real tasks
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto mb-4">
                <button
                  onClick={() => setSelectedVideo({ id: "KSFwqvUjNyA", title: "Contract Analysis" })}
                  className="relative overflow-visible rounded-lg bg-card border border-border/50 hover-elevate active-elevate-2 aspect-video"
                  data-testid="video-preview-contracts"
                >
                  <img 
                    src="https://img.youtube.com/vi/KSFwqvUjNyA/hqdefault.jpg" 
                    alt="Contract Analysis"
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-5 h-5 text-black ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
                    <p className="text-white text-xs font-medium truncate">Contract Analysis</p>
                  </div>
                </button>
                <button
                  onClick={() => setSelectedVideo({ id: "RVB0GQsxSqY", title: "Study Tools" })}
                  className="relative overflow-visible rounded-lg bg-card border border-border/50 hover-elevate active-elevate-2 aspect-video"
                  data-testid="video-preview-study"
                >
                  <img 
                    src="https://img.youtube.com/vi/RVB0GQsxSqY/hqdefault.jpg" 
                    alt="Study Tools"
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-5 h-5 text-black ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
                    <p className="text-white text-xs font-medium truncate">Study Tools</p>
                  </div>
                </button>
                <button
                  onClick={() => setSelectedVideo({ id: "FhPeNgvKDGM", title: "Quick Study Tips" })}
                  className="relative overflow-visible rounded-lg bg-card border border-border/50 hover-elevate active-elevate-2 aspect-video"
                  data-testid="video-preview-tips"
                >
                  <img 
                    src="https://img.youtube.com/vi/FhPeNgvKDGM/hqdefault.jpg" 
                    alt="Quick Study Tips"
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-5 h-5 text-black ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
                    <p className="text-white text-xs font-medium truncate">Quick Study Tips</p>
                  </div>
                </button>
                <button
                  onClick={() => setSelectedVideo({ id: "BXHRr0_TfKQ", title: "Simplify" })}
                  className="relative overflow-visible rounded-lg bg-card border border-border/50 hover-elevate active-elevate-2 aspect-video"
                  data-testid="video-preview-simplify"
                >
                  <img 
                    src="https://img.youtube.com/vi/BXHRr0_TfKQ/hqdefault.jpg" 
                    alt="Simplify"
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-5 h-5 text-black ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
                    <p className="text-white text-xs font-medium truncate">Simplify</p>
                  </div>
                </button>
              </div>
              <div className="text-center">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  data-testid="button-all-tutorials"
                  onClick={() => window.location.href = "/tutorials"}
                >
                  View All Tutorials
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            <div className="mb-10">
              <div className="text-center mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500 mb-2">What You Can Do</p>
                <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  Popular Use Cases
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl mx-auto mb-6">
                <Link href="/use-cases" className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 hover-elevate transition-colors" data-testid="link-usecase-contracts">
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <FileCheck className="w-5 h-5 text-violet-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">Contract Analysis</p>
                    <p className="text-xs text-muted-foreground truncate">Clauses, risks & negotiation</p>
                  </div>
                </Link>
                <Link href="/use-cases" className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 hover-elevate transition-colors" data-testid="link-usecase-invoices">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">Invoice Reconciliation</p>
                    <p className="text-xs text-muted-foreground truncate">Match invoices to time entries</p>
                  </div>
                </Link>
                <Link href="/use-cases" className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 hover-elevate transition-colors" data-testid="link-usecase-video">
                  <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                    <Video className="w-5 h-5 text-rose-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">Video Transcription</p>
                    <p className="text-xs text-muted-foreground truncate">Searchable text from videos</p>
                  </div>
                </Link>
                <Link href="/use-cases" className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 hover-elevate transition-colors" data-testid="link-usecase-meetings">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">Meeting Action Items</p>
                    <p className="text-xs text-muted-foreground truncate">Auto-extract follow-ups</p>
                  </div>
                </Link>
                <Link href="/use-cases" className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 hover-elevate transition-colors" data-testid="link-usecase-research">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">Research Summaries</p>
                    <p className="text-xs text-muted-foreground truncate">Plain-language insights</p>
                  </div>
                </Link>
              </div>
              <div className="text-center flex flex-wrap justify-center gap-3">
                <Button asChild variant="outline" size="sm" data-testid="button-view-all-use-cases">
                  <Link href="/use-cases">
                    View All Use Cases
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  data-testid="button-video-tutorials"
                  onClick={() => window.location.href = "/tutorials"}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Video Tutorials
                </Button>
              </div>
            </div>

            <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
              <DialogContent className="max-w-4xl p-0 bg-black border-0 overflow-hidden">
                <DialogHeader className="flex flex-row items-center justify-between gap-2 p-3 pb-0">
                  <DialogTitle className="text-white text-sm font-medium">
                    {selectedVideo?.title || "Video Tutorial"}
                  </DialogTitle>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8" 
                    onClick={() => setSelectedVideo(null)}
                    data-testid="button-close-video"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </DialogHeader>
                <DialogDescription className="sr-only">Tutorial video preview</DialogDescription>
                {selectedVideo && (
                  <div className="relative w-full aspect-[9/16] md:aspect-video">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${selectedVideo.id}?autoplay=1&modestbranding=1&rel=0`}
                      title={selectedVideo.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* AI Agent Integrations section hidden */}

            {!authLoading && !isAuthenticated && (
              <div className="flex flex-col items-center gap-6">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button 
                    asChild
                    size="lg" 
                    className="text-base sm:text-xl px-6 sm:px-12 py-4 sm:py-8 h-auto font-bold shadow-xl shadow-accent/30 bg-accent hover:bg-accent/90 text-accent-foreground transform hover:scale-105 transition-transform"
                    data-testid="button-hero-get-started"
                  >
                    <a href="/auth">
                      <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                      Get Started
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="ghost" data-testid="button-hero-login">
                    <a href="/auth">
                      <LogIn className="w-4 h-4 mr-2" />
                      Already have an account?
                    </a>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Sign in with just your email — no password needed</p>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="text-sm">Share with others:</span>
                  <ShareButtons showLabel={false} />
                </div>
              </div>
            )}
            {isAuthenticated && showLandingView && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button asChild size="lg" data-testid="button-go-to-workspace">
                  <Link href="/">
                    <FileText className="w-4 h-4 mr-2" />
                    Go to Workspace
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customize View Modal */}
      <CustomizeViewModal
        open={showCustomizeModal}
        onOpenChange={setShowCustomizeModal}
        preferences={viewPrefs}
        onToggle={togglePreference}
        onResetDefaults={resetToDefaults}
        onSetMinimal={setMinimalView}
        onSetStudent={setStudentView}
      />


      {(isAuthenticated && !showLandingView) && (
        <main className="w-full mx-auto px-4 md:px-6 py-3 md:py-8">
          
          <Tabs ref={tabsRef} value={activeTab} onValueChange={setActiveTab} className="mb-2 md:mb-4">
            <TabsList className={`w-full grid ${canAccessHealth ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} hidden sm:grid h-auto min-h-[3rem] mb-4`} data-testid="tabs-main">
              <TabsTrigger value="chat" className="gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium py-2 whitespace-normal text-center hidden sm:flex" data-testid="tab-chat">
                <MessageSquarePlus className="w-4 h-4 shrink-0" />
                <span>Chat with Evi</span>
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium py-2 whitespace-normal text-center hidden sm:flex" data-testid="tab-knowledge">
                <FolderKanban className="w-4 h-4 shrink-0" />
                <span>Knowledge Space</span>
              </TabsTrigger>
              {canAccessHealth && (
                <TabsTrigger value="health" className="gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium py-2 whitespace-normal text-center hidden sm:flex" data-testid="tab-health">
                  <HeartPulse className="w-4 h-4 shrink-0" />
                  <span>Knowledge Health</span>
                </TabsTrigger>
              )}
            </TabsList>
            
            {/* ===== CHAT WITH EVI TAB ===== */}
            <TabsContent value="chat" className="mt-0 overflow-hidden max-w-7xl mx-auto w-full">
              {/* Onboarding hero — shown to brand new users (0 docs) and to users
                  who have docs but haven't asked anything yet. Disappears as soon
                  as they start chatting with their own content. */}
              {(() => {
                if (onboardingHeroDismissed) return null;
                const hasAnyDocuments = readyAssets.length > 0;
                const hasAskedAnything = messages.length > 0;
                if (hasAnyDocuments && hasAskedAnything) return null;
                const firstDoc = readyAssets[0];
                return (
                  <OnboardingHero
                    hasAnyDocuments={hasAnyDocuments}
                    hasAskedAnything={hasAskedAnything}
                    firstDocumentName={firstDoc?.filename}
                    firstDocumentId={firstDoc?.id}
                    onAsk={(question, assetIds) => {
                      // Don't mutate persistent selection — sample questions are
                      // one-shot. We pass assetIds directly so this single chat
                      // turn targets the sample without locking future turns.
                      chatMutation.mutate({
                        question,
                        assetIds: assetIds && assetIds.length > 0 ? assetIds : selectedAssetIds,
                      } as any);
                    }}
                    onUploadClick={() => setShowMobileDocsPanel(true)}
                    onDismiss={dismissOnboardingHero}
                    onOpenCVBuilder={isStudentMode ? () => setShowCVBuilderSheet(true) : undefined}
                    onOpenStudyQuiz={isStudentMode ? () => { setExamPrepEnabled(true); setShowExamPrepSheet(true); } : undefined}
                  />
                );
              })()}
              {/* Mobile/tablet: Upload & Manage + My Sources + Org Connectors boxes */}
              <div className="md:hidden mb-3 space-y-2">
                <div className={`p-2.5 rounded-lg border ${hasReadySelectedAssets ? 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-500/30' : 'bg-card'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      onClick={() => hasReadySelectedAssets && setMobileSelectedDocsExpanded(!mobileSelectedDocsExpanded)}
                      data-testid="button-expand-selected-docs-chat"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      {hasReadySelectedAssets ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-medium text-cyan-700 dark:text-cyan-300 whitespace-nowrap">Chatting with ({selectedAssets.filter(a => a.status === "READY").length})</span>
                          {mobileSelectedDocsExpanded ? <ChevronDown className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" /> : <ChevronRight className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />}
                        </div>
                      ) : readyAssets.length > 0 ? (
                        <span className="text-xs text-muted-foreground">Searching all {readyAssets.length} documents</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No documents yet</span>
                      )}
                    </button>
                    <Button
                      size="sm"
                      onClick={() => setShowMobileDocsPanel(true)}
                      className="text-xs h-7 px-3 gap-1.5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold"
                      data-testid="button-upload-docs-mobile-chat"
                    >
                      <FolderOpen className="w-3 h-3" />
                      Upload & Manage
                    </Button>
                  </div>
                  {hasReadySelectedAssets && mobileSelectedDocsExpanded && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {selectedAssets.filter(a => a.status === "READY").map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center gap-2 px-2 py-1.5 bg-background/80 rounded border border-border/50"
                          data-testid={`expanded-doc-chat-${asset.id}`}
                        >
                          <SourceIcon source={(asset as any).source} className="w-3 h-3 shrink-0" />
                          <span className="text-xs flex-1 min-w-0 truncate">{asset.displayName || asset.filename}</span>
                          <button
                            onClick={() => handleToggleAsset(asset.id)}
                            className="shrink-0 p-0.5"
                            data-testid={`button-unselect-chat-${asset.id}`}
                          >
                            <X className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => setShowMySourcesPanel(true)}
                    className="flex-1 text-[11px] h-7 gap-1 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm font-semibold"
                    data-testid="button-my-sources-mobile-chat"
                  >
                    <Plug className="w-3 h-3" />
                    My Sources
                  </Button>
                  {isSuperAdmin && (
                    <Button
                      size="sm"
                      onClick={() => setShowMobileIngestionPanel(true)}
                      className="flex-1 text-[11px] h-7 gap-1 bg-blue-600 text-white hover:bg-blue-700 shadow-sm font-semibold"
                      data-testid="button-org-connectors-mobile-chat"
                    >
                      <Plug className="w-3 h-3" />
                      Org Connectors
                    </Button>
                  )}
                  {canAccessHealth && (
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("health")}
                      className="flex-1 text-[11px] h-7 gap-1 bg-amber-600 text-white hover:bg-amber-700 shadow-sm font-semibold"
                      data-testid="button-health-mobile-chat"
                    >
                      <Activity className="w-3 h-3" />
                      Health
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                {/* Selected documents sidebar - desktop */}
                <div className="hidden md:flex flex-col w-44 lg:w-56 xl:w-64 shrink-0 border rounded-lg bg-card overflow-hidden h-[calc(100vh-8rem)]">
                  <div className="p-3 border-b space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5" data-testid="text-selected-docs-heading">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      Documents
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => setShowMobileDocsPanel(true)}
                      className="w-full text-xs h-7 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold"
                      data-testid="button-upload-docs"
                    >
                      <Upload className="w-3 h-3" />
                      Upload & Manage
                    </Button>
                    <PersonalIntegrationsButton onOpen={() => setShowMySourcesPanel(true)} />
                    {isSuperAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMobileIngestionPanel(true)}
                        className="w-full text-xs h-7 gap-1.5 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 border-blue-600 dark:border-blue-500 shadow-sm font-semibold"
                        data-testid="button-org-connectors-chat"
                      >
                        <Plug className="w-3 h-3" />
                        Org Connectors
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {hasReadySelectedAssets ? (
                      <div className="p-2 space-y-0.5">
                        {selectedAssets.filter(a => a.status === "READY").map((asset) => (
                          <div
                            key={asset.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-foreground/80"
                            data-testid={`text-selected-doc-${asset.id}`}
                          >
                            <SourceIcon source={(asset as any).source} className="w-3 h-3 shrink-0" />
                            <span className="truncate">{(asset as any).displayName || asset.filename}</span>
                          </div>
                        ))}
                      </div>
                    ) : readyAssets.length > 0 ? (
                      <div className="p-3 text-center">
                        <p className="text-xs text-muted-foreground">Searching all {readyAssets.length} documents</p>
                      </div>
                    ) : (
                      <div className="p-3 text-center">
                        <p className="text-xs text-muted-foreground">No documents yet — <button className="text-primary underline underline-offset-2 font-medium" onClick={() => setShowMobileDocsPanel(true)} data-testid="link-upload-docs-desktop">upload files</button></p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chat window */}
                <div className="flex-1 min-w-0">
                  <ChatSection
                    messages={messages}
                    onAsk={handleAsk}
                    onAskImage={handleAskImage}
                    isAsking={chatMutation.isPending}
                    isAskingImage={imageChatMutation.isPending}
                    askError={chatMutation.error?.message || imageChatMutation.error?.message || externalChatMutation.error?.message}
                    disabled={false}
                    hasDocumentsSelected={hasReadySelectedAssets}
                    selectedDocumentNames={hasReadySelectedAssets ? selectedAssets.filter(a => a.status === "READY").map(a => a.filename) : []}
                    selectedAssetIds={hasReadySelectedAssets ? selectedAssets.filter(a => a.status === "READY").map(a => a.id) : []}
                    selectedAssets={hasReadySelectedAssets ? selectedAssets.filter(a => a.status === "READY") : []}
                    isSearchingAllDocs={!hasReadySelectedAssets && readyAssets.length > 0}
                    totalDocCount={readyAssets.length}
                    userPlan={usage?.plan}
                    onClearConversation={handleClearConversation}
                    onOpenThreads={() => {
                      const isMobile = window.innerWidth < 1024;
                      if (isMobile) {
                        setActiveTab("threads");
                      } else {
                        setActiveTab("knowledge");
                        setTimeout(() => {
                          const threadsSection = document.querySelector('[data-testid="section-threads-desktop"]');
                          if (threadsSection) {
                            const trigger = threadsSection.querySelector('[data-testid="button-toggle-threads-desktop"]');
                            if (trigger && !trigger.closest('[data-state="open"]')) trigger.click();
                            threadsSection.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                        }, 100);
                      }
                    }}
                    usePreparedVersion={usePreparedVersion}
                    onPreparedVersionToggle={setUsePreparedVersion}
                    onCompareVersions={handleCompareVersions}
                    isAdmin={!!isSuperAdmin}
                    onOpenKnowledgeSpace={() => setActiveTab("knowledge")}
                    onConfirmDiscoveredDocs={handleConfirmDiscoveredDocs}
                    onExploreTools={() => setActiveTab("knowledge")}
                    onOpenUpload={() => setShowMobileDocsPanel(true)}
                    onAskExternal={(q: string) => externalChatMutation.mutate(q)}
                    isAskingExternal={externalChatMutation.isPending}
                    webSearchEnabled={webSearchEnabled}
                    onWebSearchToggle={setWebSearchEnabled}
                    externalSearchAllowed={!!usage?.planDetails?.externalSearchAllowed}
                    onOpenExamPrep={() => { setExamPrepEnabled(true); setShowExamPrepSheet(true); }}
                    onOpenFinanceQuery={() => { setFinanceQueryEnabled(true); setShowFinanceQuerySheet(true); }}
                    chatOnly
                  />
                </div>
              </div>
              {/* Floating "Tips" pill — only shown when the user dismissed
                  the onboarding hero. One-tap to bring it back. */}
              {onboardingHeroDismissed && (
                <button
                  onClick={reopenOnboardingHero}
                  className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3.5 py-2 text-xs font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                  data-testid="button-reopen-onboarding-hero"
                  aria-label="Show tips"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  Tips
                </button>
              )}
            </TabsContent>
            
            {/* ===== KNOWLEDGE SPACE TAB ===== */}
            <TabsContent value="knowledge" className="mt-0">
              <LimitWarningBanner />

              {/* === DESKTOP: Two-column workspace layout === */}
              <div className="hidden md:flex gap-3" data-testid="knowledge-workspace-desktop">
                {/* LEFT: Upload + Documents + FAQ (same layout as mobile) */}
                <div className="w-72 lg:w-[20rem] xl:w-[380px] shrink-0 border rounded-lg bg-card overflow-y-auto flex flex-col">
                  {allAssets && allAssets.length > 0 && (
                    <div className="mx-3 mt-3 mb-1">
                      <SelectedDocumentsBox
                        selectedAssets={selectedAssets}
                        selectedAssetIds={selectedAssetIds}
                        onToggleAsset={handleToggleAsset}
                      />
                    </div>
                  )}
                  {allAssets && allAssets.length > 0 && (() => {
                    const readyCount = allAssets.filter(a => a.status === "READY").length;
                    const readiness = Math.round((readyCount / allAssets.length) * 100);
                    const sourceSet = new Set(allAssets.map(a => (a as any).source || "upload"));
                    return (
                      <div className="mx-3 mb-2 px-2 py-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground" data-testid="workspace-summary-line">
                        <span>{allAssets.length} document{allAssets.length !== 1 ? 's' : ''}</span>
                        <span className="text-muted-foreground/30">|</span>
                        <span>{sourceSet.size} source{sourceSet.size !== 1 ? 's' : ''}</span>
                        <span className="text-muted-foreground/30">|</span>
                        <span className={readiness === 100 ? 'text-emerald-600 dark:text-emerald-400' : ''}>{readiness}% AI-ready</span>
                      </div>
                    );
                  })()}
                  <div className="mx-3 mt-3 mb-1">
                    <Collapsible open={uploadSectionOpen} onOpenChange={setUploadSectionOpen}>
                      <CollapsibleTrigger asChild>
                        <button
                          className={`flex items-center gap-2 w-full text-left p-3 rounded-lg border transition-colors ${uploadSectionOpen ? 'bg-primary/20 dark:bg-primary/30 border-primary/40 dark:border-primary/50 hover:bg-primary/25 dark:hover:bg-primary/35' : 'bg-primary/15 dark:bg-primary/25 border-primary/30 dark:border-primary/40 hover:bg-primary/20 dark:hover:bg-primary/30'}`}
                          data-testid="button-toggle-upload-section"
                        >
                          <Upload className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-sm font-semibold flex-1 text-foreground">Upload & Manage</span>
                          {selectedAssetIds.length > 0 && (
                            <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                              {selectedAssetIds.length} selected
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {allAssets?.length ?? 0}
                          </span>
                          {uploadSectionOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border border-t-0 rounded-b-lg overflow-hidden">
                          <UploadSection
                            onUpload={handleUpload}
                            isUploading={uploadMutation.isPending}
                            uploadError={uploadMutation.error?.message}
                            fileSizeError={fileSizeError}
                            onDismissFileSizeError={() => setFileSizeError(null)}
                            assets={allAssets}
                            selectedAssetIds={selectedAssetIds}
                            onToggleAsset={handleToggleAsset}
                            onSelectAll={handleSelectAll}
                            onDeleteAsset={handleDeleteAsset}
                            onReprocessAsset={handleReprocessAsset}
                            isLoading={assetsLoading}
                            enabledPackIds={enabledPackIds}
                            entitlementsLoading={entitlementsLoading}
                            recentQuestions={recentQuestions}
                            onReaskQuestion={handleReaskQuestion}
                            userPlan={usage?.plan}
                            maxFileSizeMB={usage?.planDetails?.maxFileSizeBytes ? Math.round(usage.planDetails.maxFileSizeBytes / 1024 / 1024) : undefined}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>


                  {isSuperAdmin && (
                  <div className="mx-3 mb-3 mt-2">
                    <DataIngestionFeed />
                  </div>
                  )}

                  <div className="mx-3 mb-3 mt-2">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <button
                          className="flex items-center gap-2 w-full text-left p-3 rounded-lg border transition-colors bg-emerald-200/80 dark:bg-emerald-800/40 border-emerald-400 dark:border-emerald-600 hover:bg-emerald-300/80 dark:hover:bg-emerald-800/50 group"
                          data-testid="button-toggle-my-sources-desktop"
                        >
                          <Plug className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
                          <span className="text-sm font-semibold flex-1 text-emerald-900 dark:text-emerald-100">My Sources</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600 dark:text-amber-400">Coming Soon</Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border border-t-0 border-emerald-300 dark:border-emerald-700 rounded-b-lg overflow-hidden">
                          <PersonalIntegrationsContent />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  <div className="mx-3 mb-3 mt-2" data-testid="section-threads-desktop">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 w-full text-left p-3 rounded-lg border transition-colors bg-muted/30 hover:bg-muted/50 group" data-testid="button-toggle-threads-desktop">
                          <MessagesSquare className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-sm font-semibold flex-1 text-foreground">Evident Threads</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <p className="text-[11px] text-muted-foreground px-1 mt-1.5 mb-1 leading-relaxed" data-testid="text-threads-tip">
                          Your conversations with Evi are saved here. Toggle <span className="font-medium text-primary">Saved Only</span> to quickly find bookmarked threads and saved answers.
                        </p>
                        <div className="rounded-lg border bg-card overflow-hidden" style={{ height: '360px' }}>
                          <ConversationSidebar
                            currentConversationId={currentConversationId}
                            onSelectConversation={(id) => {
                              if (id) {
                                handleLoadConversation(id);
                              } else {
                                handleClearConversation();
                              }
                              setActiveTab("chat");
                            }}
                            onNewConversation={() => {
                              handleClearConversation();
                              setActiveTab("chat");
                            }}
                            isAuthenticated={isAuthenticated}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  <div className="mx-3 mb-4 mt-2" data-testid="section-faq-desktop">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 w-full text-left p-3 rounded-lg border transition-colors bg-muted/30 hover:bg-muted/50 group" data-testid="button-toggle-faq-desktop">
                          <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-semibold flex-1 text-muted-foreground">Frequently Asked Questions</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {[
                            { q: "What file types can I upload?", a: "PDFs, Word docs, images, audio, video, Excel, PowerPoint, and text files." },
                            { q: "How does Evi search documents?", a: "Select documents, ask a question — Evi finds relevant sections with citations." },
                            { q: "Do I need to select documents?", a: "For document answers, yes. Without selection, Evi acts as a platform guide." },
                            { q: "What are the different modes?", a: "Modes tailor Evi for students, finance, legal, HR, and more. Switch anytime." },
                            { q: "Is my data private?", a: "Yes. Your documents are secure and never shared or used to train AI." },
                            { q: "Where are my documents stored?", a: "Files are stored on enterprise-grade Google Cloud infrastructure with encryption at rest (AES-256) and in transit (TLS 1.2+). Your data never leaves secure cloud storage." },
                            { q: "How is my data protected from hacking?", a: "We use passwordless authentication, server-side rate limiting, prompt injection detection, content moderation, audit logging, and encrypted connections throughout." },
                            { q: "Can other users see my documents?", a: "No. Documents are isolated per account. There is no cross-user access — your data is only visible to you and any team members you explicitly invite." },
                            { q: "What is Research Mode?", a: "Combines your documents with web research for more comprehensive answers." },
                            { q: "How to get the best answers?", a: "Be specific — e.g. 'key requirements in section 3' instead of 'tell me about this'." },
                            { q: "What happens after upload?", a: "Documents are processed into searchable chunks. Delete anytime from Knowledge Space." },
                          ].map((faq, i) => (
                            <details
                              key={i}
                              className="group border rounded-lg bg-card/50 hover:bg-card transition-colors"
                              data-testid={`faq-desktop-item-${i}`}
                            >
                              <summary className="flex items-center justify-between cursor-pointer px-3 py-2.5 text-sm font-medium text-foreground list-none [&::-webkit-details-marker]:hidden">
                                <span className="leading-snug">{faq.q}</span>
                                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform group-open:rotate-180" />
                              </summary>
                              <div className="px-3 pb-3 text-sm text-muted-foreground leading-relaxed">
                                {faq.a}
                              </div>
                            </details>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>

                {/* MIDDLE: Full Ask Evi (Mode header hidden at xl, lives in right rail) */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="lg:hidden shrink-0 px-3 py-2 border-b flex items-center gap-3 bg-card rounded-t-lg border border-b-0">
                    <h3 className="text-sm font-semibold text-muted-foreground">Mode</h3>
                    <ModeSwitcher />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="ml-auto gap-1.5 text-xs" data-testid="button-desktop-more-menu">
                          <MoreVertical className="w-3.5 h-3.5" />
                          More
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setShowMobileWorkspacePanel(true)} data-testid="menu-item-workspace-stats">
                          <BarChart3 className="w-4 h-4" />
                          Workspace Stats
                        </DropdownMenuItem>
                        {isAuthenticated && verticalMode === "students" && (
                          <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setStudyDashboardExpanded(true)} data-testid="menu-item-study-fitness">
                            <Activity className="w-4 h-4" />
                            Study Fitness
                          </DropdownMenuItem>
                        )}
                        {isAuthenticated && verticalMode === "educators" && (
                          <DropdownMenuItem className="cursor-pointer gap-2" asChild data-testid="menu-item-educator-dashboard">
                            <a href="/educator-dashboard">
                              <GraduationCap className="w-4 h-4" />
                              Educator Dashboard
                            </a>
                          </DropdownMenuItem>
                        )}
                        {viewPrefs.showUsageDisplay && (
                          <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setShowMobileWorkspacePanel(true)} data-testid="menu-item-usage">
                            <Activity className="w-4 h-4" />
                            Usage
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5">
                          <ShareButtons showLabel={true} className="flex-row items-center" />
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <ModeAwarenessTip />
                  <div className="flex-1 min-h-0 overflow-y-auto">
                  {verticalMode === "students" && isSuperAdmin && (
                    <div className="p-3 border-b">
                      <PilotReferralCard />
                    </div>
                  )}
                  {verticalMode === "finance" && (
                    <div className="p-3 border-b">
                      <FinanceWorkspaceTabs
                        onPromptSelect={(prompt) => setFinancePrompt(prompt)}
                        hasDocumentsSelected={hasReadySelectedAssets}
                      />
                    </div>
                  )}
                  <ChatSection
                    messages={messages}
                    onAsk={handleAsk}
                    onAskImage={handleAskImage}
                    onAskExternal={handleAskExternal}
                    isAsking={chatMutation.isPending}
                    isAskingImage={imageChatMutation.isPending}
                    isAskingExternal={externalChatMutation.isPending}
                    askError={chatMutation.error?.message || imageChatMutation.error?.message || externalChatMutation.error?.message}
                    disabled={false}
                    hasDocumentsSelected={hasReadySelectedAssets}
                    selectedDocumentNames={selectedAssets.filter(a => a.status === "READY").map(a => a.filename)}
                    selectedAssetIds={selectedAssets.filter(a => a.status === "READY").map(a => a.id)}
                    selectedAssets={selectedAssets.filter(a => a.status === "READY")}
                    isSearchingAllDocs={!hasReadySelectedAssets && readyAssets.length > 0}
                    totalDocCount={readyAssets.length}
                    userPlan={usage?.plan}
                    onClearConversation={handleClearConversation}
                    learningModeEnabled={learningModeEnabled}
                    onLearningModeToggle={handleLearningModeToggle}
                    naturalModeEnabled={naturalModeEnabled}
                    onNaturalModeToggle={handleNaturalModeToggle}
                    researchUrls={researchUrls}
                    onResearchUrlsChange={setResearchUrls}
                    sourceOnly={sourceOnly}
                    onSourceOnlyChange={setSourceOnly}
                    examPrepEnabled={examPrepEnabled}
                    onExamPrepToggle={(enabled) => { setExamPrepEnabled(enabled); if (enabled) setShowExamPrepSheet(true); }}
                    onOpenExamPrep={() => setShowExamPrepSheet(true)}
                    onOpenCVBuilder={() => setShowCVBuilderSheet(true)}
                    financeQueryEnabled={financeQueryEnabled}
                    onFinanceQueryToggle={(enabled) => { setFinanceQueryEnabled(enabled); if (enabled) setShowFinanceQuerySheet(true); }}
                    onOpenFinanceQuery={() => setShowFinanceQuerySheet(true)}
                    title="Ask Evi"
                    onChatWithEvi={() => { setActiveTab("chat"); setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior }), 0); }}
                    onOpenThreads={() => {
                      const isMobile = window.innerWidth < 1024;
                      if (isMobile) {
                        setActiveTab("threads");
                      } else {
                        setActiveTab("knowledge");
                        setTimeout(() => {
                          const threadsSection = document.querySelector('[data-testid="section-threads-desktop"]');
                          if (threadsSection) {
                            const trigger = threadsSection.querySelector('[data-testid="button-toggle-threads-desktop"]');
                            if (trigger && !trigger.closest('[data-state="open"]')) trigger.click();
                            threadsSection.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                        }, 100);
                      }
                    }}
                    showLearningPrompt={showAnswerLearningPrompt && !activeLearningSessionId}
                    suggestedLearningTopic={suggestedLearningTopic}
                    onEnableLearningMode={handleEnableLearningMode}
                    onDismissLearningPrompt={() => setShowAnswerLearningPrompt(false)}
                    onLearningModeAccepted={handleLearningModeAccepted}
                    hasAcceptedLearningMode={hasAcceptedLearningMode}
                    externalTrigger={showTemplateModal}
                    onExternalTriggerHandled={() => setShowTemplateModal(null)}
                    externalPrompt={financePrompt}
                    onExternalPromptHandled={() => setFinancePrompt(null)}
                    usePreparedVersion={usePreparedVersion}
                    onPreparedVersionToggle={setUsePreparedVersion}
                    onCompareVersions={handleCompareVersions}
                    isAdmin={!!isSuperAdmin}
                    onOpenKnowledgeSpace={() => setActiveTab("knowledge")}
                    onConfirmDiscoveredDocs={handleConfirmDiscoveredDocs}
                  />
                  {messages.length > 0 && messages.some(m => m.type === "answer") && (
                    <div
                      className="mt-3 p-3 rounded-lg border border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => { setActiveTab("chat"); setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior }), 0); }}
                      data-testid="button-chat-with-evi-ks-desktop"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <MessageCircle className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">Continue in Chat</p>
                            <p className="text-xs text-muted-foreground">
                              Want to dig deeper? Chat with Evi to cross-question and explore further
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  )}
                  </div>
                </div>

                {/* RIGHT RAIL (lg+ only): Mode + Tools — keeps the Q&A column clean */}
                <aside className="hidden lg:flex w-[300px] xl:w-[360px] shrink-0 flex-col border rounded-lg bg-card overflow-y-auto" data-testid="knowledge-tools-rail">
                  <div className="px-3 py-2 border-b bg-muted/30">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mode &amp; Tools</div>
                  </div>
                  <div className="p-3 space-y-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground/70 mb-1.5">Mode</div>
                      <ModeSwitcher />
                    </div>
                    {(verticalMode === "students" || verticalMode === "educators" || verticalMode === "finance" || verticalMode === "legal") && (
                      <div>
                        <div className="text-[10px] font-semibold uppercase text-muted-foreground/70 mb-1.5">Tools for this mode</div>
                        <div className="space-y-1.5">
                          {(verticalMode === "students" || verticalMode === "educators") && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start gap-2 border-cyan-300/60 hover:bg-cyan-50 dark:border-cyan-800/50 dark:hover:bg-cyan-950/30"
                                onClick={() => { setExamPrepEnabled(true); setShowExamPrepSheet(true); }}
                                data-testid="rail-tool-exam-prep"
                              >
                                <GraduationCap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                <span className="flex-1 text-left">Exam Prep</span>
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start gap-2 border-blue-300/60 hover:bg-blue-50 dark:border-blue-800/50 dark:hover:bg-blue-950/30"
                                onClick={() => setShowCVBuilderSheet(true)}
                                data-testid="rail-tool-cv-builder"
                              >
                                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span className="flex-1 text-left">CV Builder</span>
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </>
                          )}
                          {verticalMode === "finance" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start gap-2 border-emerald-300/60 hover:bg-emerald-50 dark:border-emerald-800/50 dark:hover:bg-emerald-950/30"
                              onClick={() => { setFinanceQueryEnabled(true); setShowFinanceQuerySheet(true); }}
                              data-testid="rail-tool-finance-query"
                            >
                              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="flex-1 text-left">Finance Query</span>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          )}
                          {verticalMode === "legal" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start gap-2 border-purple-300/60 hover:bg-purple-50 dark:border-purple-800/50 dark:hover:bg-purple-950/30"
                              onClick={() => { handleAsk?.("Extract all obligations from the selected documents as a structured checklist."); }}
                              data-testid="rail-tool-extract-obligations"
                            >
                              <Scale className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              <span className="flex-1 text-left">Extract Obligations</span>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground/70 mb-1.5">Workspace</div>
                      <div className="space-y-1.5">
                        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setShowMobileWorkspacePanel(true)} data-testid="rail-workspace-stats">
                          <BarChart3 className="w-4 h-4" /> Workspace Stats
                        </Button>
                        {isAuthenticated && verticalMode === "students" && (
                          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setStudyDashboardExpanded(true)} data-testid="rail-study-fitness">
                            <Activity className="w-4 h-4" /> Study Fitness
                          </Button>
                        )}
                        {isAuthenticated && verticalMode === "educators" && (
                          <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild data-testid="rail-educator-dashboard">
                            <a href="/educator-dashboard"><GraduationCap className="w-4 h-4" /> Educator Dashboard</a>
                          </Button>
                        )}
                        {viewPrefs.showUsageDisplay && (
                          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setShowMobileWorkspacePanel(true)} data-testid="rail-usage">
                            <Activity className="w-4 h-4" /> Usage
                          </Button>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground/70 mb-1.5">Threads</div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2"
                        data-testid="rail-recent-threads"
                        onClick={() => {
                          const threadsSection = document.querySelector('[data-testid="section-threads-desktop"]');
                          if (threadsSection) {
                            const trigger = threadsSection.querySelector('[data-testid="button-toggle-threads-desktop"]') as HTMLElement | null;
                            if (trigger && !trigger.closest('[data-state="open"]')) trigger.click();
                            threadsSection.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                        }}
                      >
                        <MessagesSquare className="w-4 h-4" /> Recent Threads
                      </Button>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground/70 mb-1.5">Share</div>
                      <ShareButtons showLabel={true} className="flex-row items-center" />
                    </div>
                  </div>
                </aside>
              </div>



              {/* === MOBILE: Compact stacked layout === */}
              <div className="md:hidden space-y-3" data-testid="knowledge-workspace-mobile">
                {/* Mode + Quick Actions row */}
                <div className="flex items-center gap-2">
                  <ModeSwitcher />
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setShowMobileWorkspacePanel(true)}
                      data-testid="button-open-stats"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      Stats
                    </Button>
                    {isAuthenticated && verticalMode === "students" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setShowStudyDashboardSheet(true)}
                        data-testid="button-open-study-fitness-mobile"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        Fitness
                      </Button>
                    )}
                    {isAuthenticated && verticalMode === "educators" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        asChild
                        data-testid="button-open-educator-dashboard-mobile"
                      >
                        <a href="/educator-dashboard">
                          <GraduationCap className="w-3.5 h-3.5" />
                          Dashboard
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                <ModeAwarenessTip />

                {/* Selected Documents card */}
                <Card className="border border-cyan-300 dark:border-cyan-700 bg-cyan-50/50 dark:bg-cyan-900/20 shadow-sm" data-testid="mobile-docs-card">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        className="flex items-center gap-2 text-left"
                        onClick={() => selectedAssetIds.length > 0 && setMobileSelectedDocsExpanded(!mobileSelectedDocsExpanded)}
                        data-testid="button-expand-selected-docs-ks"
                      >
                        <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">Selected Documents</span>
                        {selectedAssetIds.length > 0 && (
                          <Badge variant="secondary" className="text-xs">{selectedAssetIds.length}</Badge>
                        )}
                        {selectedAssetIds.length > 0 && (
                          mobileSelectedDocsExpanded ? <ChevronDown className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> : <ChevronRight className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        )}
                      </button>
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-3"
                        onClick={() => setShowMobileDocsPanel(true)}
                        data-testid="button-upload-docs-mobile"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Upload & Manage
                      </Button>
                    </div>
                    {selectedAssetIds.length > 0 ? (
                      mobileSelectedDocsExpanded ? (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {selectedAssets.map(a => (
                            <div
                              key={a.id}
                              className="flex items-center gap-2 px-2 py-1.5 bg-background/80 rounded border border-border/50"
                              data-testid={`expanded-doc-ks-${a.id}`}
                            >
                              <SourceIcon source={(a as any).source} className="w-3 h-3 shrink-0" />
                              <span className="text-xs flex-1 min-w-0 truncate">{a.displayName || a.filename}</span>
                              <button
                                onClick={() => handleToggleAsset(a.id)}
                                className="shrink-0 p-0.5"
                                data-testid={`button-unselect-ks-${a.id}`}
                              >
                                <X className="w-3 h-3 text-muted-foreground" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedAssets.slice(0, 4).map(a => (
                            <Badge
                              key={a.id}
                              variant={a.status === "READY" ? "default" : "secondary"}
                              className="text-xs max-w-[160px] cursor-pointer gap-1"
                              onClick={() => handleToggleAsset(a.id)}
                              data-testid={`badge-selected-doc-${a.id}`}
                            >
                              <SourceIcon source={(a as any).source} className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{a.displayName || a.filename}</span>
                              <X className="w-3 h-3 ml-0.5 shrink-0" />
                            </Badge>
                          ))}
                          {selectedAssetIds.length > 4 && (
                            <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setMobileSelectedDocsExpanded(true)}>
                              +{selectedAssetIds.length - 4} more
                            </Badge>
                          )}
                        </div>
                      )
                    ) : allAssets.length > 0 ? (
                      <p className="text-xs text-muted-foreground">No documents selected — <button className="text-primary underline underline-offset-2 font-medium" onClick={() => setShowMobileDocsPanel(true)} data-testid="link-select-docs">select documents</button></p>
                    ) : (
                      <p className="text-xs text-muted-foreground">No documents yet — <button className="text-primary underline underline-offset-2 font-medium" onClick={() => setShowMobileDocsPanel(true)} data-testid="link-upload-docs">upload your first file</button></p>
                    )}
                  </CardContent>
                </Card>

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button
                      className="flex items-center gap-2 w-full text-left p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors group"
                      data-testid="button-toggle-more-actions-mobile-ks"
                    >
                      <SlidersHorizontal className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-xs font-semibold flex-1 text-foreground">More actions</span>
                      <span className="text-[10px] text-muted-foreground">Sources, Health{isSuperAdmin ? ', Admin' : ''}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => setShowMySourcesPanel(true)}
                        className="flex-1 text-[11px] h-7 gap-1 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm font-semibold"
                        data-testid="button-my-sources-mobile-ks"
                      >
                        <Plug className="w-3 h-3" />
                        My Sources
                      </Button>
                      {isSuperAdmin && (
                        <Button
                          size="sm"
                          onClick={() => setShowMobileIngestionPanel(true)}
                          className="flex-1 text-[11px] h-7 gap-1 bg-blue-600 text-white hover:bg-blue-700 shadow-sm font-semibold"
                          data-testid="button-org-connectors-mobile-ks"
                        >
                          <Plug className="w-3 h-3" />
                          Org Connectors
                        </Button>
                      )}
                      {canAccessHealth && (
                        <Button
                          size="sm"
                          onClick={() => setActiveTab("health")}
                          className="flex-1 text-[11px] h-7 gap-1 bg-amber-600 text-white hover:bg-amber-700 shadow-sm font-semibold"
                          data-testid="button-health-mobile-ks"
                        >
                          <Activity className="w-3 h-3" />
                          Health
                        </Button>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {showLearningPrompt && !activeLearningSessionId && hasReadySelectedAssets && (
                  <LearningModePrompt
                    variant="upload"
                    onEnable={handleEnableLearningMode}
                    onDismiss={() => setShowLearningPrompt(false)}
                  />
                )}

                {isAuthenticated && verticalMode === "students" && selectedAssetIds.length > 0 && (
                  <StudyNudgeBanner
                    selectedAssets={selectedAssets.filter(a => a.status === "READY").map(a => ({ id: a.id, filename: a.filename }))}
                    onStartQuiz={() => { setExamPrepEnabled(true); setShowExamPrepSheet(true); }}
                    onReselectDocument={(docId) => {
                      setSelectedAssetIds(prev => prev.includes(docId) ? prev : [...prev, docId]);
                    }}
                  />
                )}

                {verticalMode === "students" && isSuperAdmin && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button
                        className="flex items-center gap-2 w-full text-left p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors group"
                        data-testid="button-toggle-pilot-referral-mobile"
                      >
                        <GraduationCap className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold flex-1">Student Pilot & Referrals</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <PilotReferralCard />
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {verticalMode === "finance" && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button
                        className="flex items-center gap-2 w-full text-left p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors group"
                        data-testid="button-toggle-finance-tools-mobile"
                      >
                        <Receipt className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold flex-1">Finance Tools & Templates</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <FinanceWorkspaceTabs
                        onPromptSelect={(prompt) => setFinancePrompt(prompt)}
                        hasDocumentsSelected={hasReadySelectedAssets}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Chat section takes main focus on mobile */}
                <div id="mobile-ask-evi" />
                <ChatSection
                  messages={messages}
                  onAsk={handleAsk}
                  onAskImage={handleAskImage}
                  onAskExternal={handleAskExternal}
                  isAsking={chatMutation.isPending}
                  isAskingImage={imageChatMutation.isPending}
                  isAskingExternal={externalChatMutation.isPending}
                  askError={chatMutation.error?.message || imageChatMutation.error?.message || externalChatMutation.error?.message}
                  disabled={false}
                  hasDocumentsSelected={hasReadySelectedAssets}
                  selectedDocumentNames={selectedAssets.filter(a => a.status === "READY").map(a => a.filename)}
                  selectedAssetIds={selectedAssets.filter(a => a.status === "READY").map(a => a.id)}
                  selectedAssets={selectedAssets.filter(a => a.status === "READY")}
                  isSearchingAllDocs={!hasReadySelectedAssets && readyAssets.length > 0}
                  totalDocCount={readyAssets.length}
                  externalTrigger={showTemplateModal}
                  onExternalTriggerHandled={() => setShowTemplateModal(null)}
                  externalPrompt={financePrompt}
                  onExternalPromptHandled={() => setFinancePrompt(null)}
                  userPlan={usage?.plan}
                  onClearConversation={handleClearConversation}
                  showLearningPrompt={showAnswerLearningPrompt && !activeLearningSessionId}
                  suggestedLearningTopic={suggestedLearningTopic}
                  onEnableLearningMode={handleEnableLearningMode}
                  onDismissLearningPrompt={() => setShowAnswerLearningPrompt(false)}
                  learningModeEnabled={learningModeEnabled}
                  onLearningModeToggle={handleLearningModeToggle}
                  onLearningModeAccepted={handleLearningModeAccepted}
                  hasAcceptedLearningMode={hasAcceptedLearningMode}
                  naturalModeEnabled={naturalModeEnabled}
                  onNaturalModeToggle={handleNaturalModeToggle}
                  researchUrls={researchUrls}
                  onResearchUrlsChange={setResearchUrls}
                  sourceOnly={sourceOnly}
                  onSourceOnlyChange={setSourceOnly}
                  examPrepEnabled={examPrepEnabled}
                  onExamPrepToggle={(enabled) => { setExamPrepEnabled(enabled); if (enabled) setShowExamPrepSheet(true); }}
                  onOpenExamPrep={() => setShowExamPrepSheet(true)}
                  onOpenCVBuilder={() => setShowCVBuilderSheet(true)}
                  financeQueryEnabled={financeQueryEnabled}
                  onFinanceQueryToggle={(enabled) => { setFinanceQueryEnabled(enabled); if (enabled) setShowFinanceQuerySheet(true); }}
                  onOpenFinanceQuery={() => setShowFinanceQuerySheet(true)}
                  title="Ask Evi"
                  onChatWithEvi={() => { setActiveTab("chat"); setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior }), 0); }}
                  onOpenThreads={() => {
                    const isMobile = window.innerWidth < 1024;
                    if (isMobile) {
                      setActiveTab("threads");
                    } else {
                      setActiveTab("knowledge");
                      setTimeout(() => {
                        const threadsSection = document.querySelector('[data-testid="section-threads-desktop"]');
                        if (threadsSection) {
                          const trigger = threadsSection.querySelector('[data-testid="button-toggle-threads-desktop"]');
                          if (trigger && !trigger.closest('[data-state="open"]')) trigger.click();
                          threadsSection.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }, 100);
                    }
                  }}
                  usePreparedVersion={usePreparedVersion}
                  onPreparedVersionToggle={setUsePreparedVersion}
                  onCompareVersions={handleCompareVersions}
                  isAdmin={!!isSuperAdmin}
                  onOpenKnowledgeSpace={() => setActiveTab("knowledge")}
                  onConfirmDiscoveredDocs={handleConfirmDiscoveredDocs}
                />

                {messages.length > 0 && messages.some(m => m.type === "answer") && (
                  <div
                    className="p-3 rounded-lg border border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => { setActiveTab("chat"); setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior }), 0); }}
                    data-testid="button-chat-with-evi-ks"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <MessageCircle className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Continue in Chat</p>
                          <p className="text-xs text-muted-foreground">
                            Want to dig deeper? Chat with Evi to cross-question and explore further
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                )}

                {/* FAQ Section */}
                <div className="mt-4" data-testid="section-faq">
                  <div className="flex items-center gap-2 mb-3">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Frequently Asked Questions</h3>
                  </div>
                  <div className="space-y-2">
                    {[
                      { q: "What file types can I upload?", a: "Evident supports PDFs, Word documents (.doc, .docx), images (JPG, PNG), audio files (MP3, WAV, M4A), video files (MP4), Excel spreadsheets (.xlsx, .xls), PowerPoint (.pptx), and plain text files." },
                      { q: "How does Evi search my documents?", a: "First, select the documents you want to ask about in Knowledge Space. Then ask your question — Evi uses AI-powered similarity search to find the most relevant sections and provides answers with citations so you can verify the source." },
                      { q: "Do I need to select documents before asking?", a: "For document-based answers, yes — select the documents you want to query in Knowledge Space. Without documents selected, Evi acts as a platform guide and can help with account questions, how things work, and general assistance." },
                      { q: "What are the different modes?", a: "Modes tailor Evi's behaviour to your needs. Students mode adds exam prep and CV tools. Finance mode enables SEC filings and market data. Legal, HR, and other modes optimise Evi for those industries. Switch modes anytime from Knowledge Space." },
                      { q: "Is my data private and secure?", a: "Yes. Your documents are stored securely and only accessible to you. Evi processes your files to create searchable content, but your data is never shared with other users or used to train AI models." },
                      { q: "Where are my documents stored?", a: "Your files are stored on enterprise-grade Google Cloud infrastructure. All data is encrypted at rest using AES-256 encryption and encrypted in transit using TLS 1.2+. Your documents never leave secure cloud storage and are backed up regularly." },
                      { q: "How is my data protected from hacking?", a: "Evident uses multiple layers of security: passwordless email authentication (no passwords to steal), server-side rate limiting to prevent abuse, prompt injection detection to guard against AI manipulation, content moderation, full audit logging of all actions, and encrypted connections throughout the platform." },
                      { q: "Can other users see my documents?", a: "No. Every account has complete data isolation. There is no cross-user access to documents or AI-generated answers. Your data is only visible to you, and to any team members you explicitly invite to your organisation." },
                      { q: "What is Research Mode?", a: "Research Mode lets Evi combine your document knowledge with web research. When enabled, Evi can search the internet alongside your documents to give you more comprehensive answers." },
                      { q: "How do I get the best answers from Evi?", a: "Be specific in your questions. Instead of asking 'tell me about this', try 'what are the key compliance requirements in section 3?' The more context you give, the better Evi can help." },
                      { q: "What happens to my documents after I upload them?", a: "Documents are processed into searchable chunks using AI. The original file is stored securely. You can delete any document at any time from Knowledge Space, which also removes all processed data." },
                    ].map((faq, i) => (
                      <details
                        key={i}
                        className="group border rounded-lg bg-card/50 hover:bg-card transition-colors"
                        data-testid={`faq-item-${i}`}
                      >
                        <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-sm font-medium text-foreground list-none [&::-webkit-details-marker]:hidden">
                          <span>{faq.q}</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed">
                          {faq.a}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </div>

              {examPrepEnabled && (
                <>
                  {showExamPrepSheet && (
                    <div
                      className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
                      onClick={() => setShowExamPrepSheet(false)}
                      onTouchMove={(e) => e.preventDefault()}
                      data-testid="overlay-exam-prep"
                    />
                  )}
                  <div
                    className={`fixed inset-y-0 right-0 z-50 bg-background border-l shadow-lg flex flex-col transition-all duration-300 ease-in-out ${
                      showExamPrepSheet ? 'translate-x-0' : 'translate-x-full'
                    } ${examPrepExpanded ? 'left-0 right-0 mx-auto max-w-5xl border-x' : 'w-full sm:max-w-lg'}`}
                    style={{ overscrollBehavior: 'contain' }}
                    data-testid="panel-exam-prep"
                  >
                    <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3 border-b shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-sm font-medium -ml-1 sm:hidden"
                        onClick={() => { setShowExamPrepSheet(false); setExamPrepExpanded(false); }}
                        data-testid="button-back-exam-prep"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <div className="flex items-center gap-2 min-w-0">
                        <GraduationCap className="w-5 h-5 text-cyan-500 shrink-0" />
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-foreground">Exam Prep & Grading</h3>
                          <p className="text-xs text-muted-foreground line-clamp-1 hidden sm:block">Create practice questions, take quizzes, get graded</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setExamPrepExpanded(prev => !prev)}
                          className="hidden sm:flex"
                          data-testid="button-expand-exam-prep"
                        >
                          {examPrepExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setShowExamPrepSheet(false); setExamPrepExpanded(false); }}
                          className="hidden sm:flex"
                          data-testid="button-close-exam-prep"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 sm:px-6 sm:py-4">
                    <StudyQuiz
                      assets={allAssets}
                      selectedAssetIds={selectedAssets.filter(a => a.status === "READY").map(a => a.id)}
                      isVisible={true}
                    />
                    </div>
                  </div>
                </>
              )}

              {isStudentMode && (
                <>
                  {showCVBuilderSheet && (
                    <div
                      className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
                      onClick={() => setShowCVBuilderSheet(false)}
                      onTouchMove={(e) => e.preventDefault()}
                      data-testid="overlay-cv-builder"
                    />
                  )}
                  <div
                    className={`fixed inset-y-0 right-0 z-[51] bg-background border-l shadow-lg flex flex-col transition-all duration-300 ease-in-out ${
                      showCVBuilderSheet ? 'translate-x-0' : 'translate-x-full'
                    } ${cvBuilderExpanded ? 'left-0 right-0 mx-auto max-w-5xl border-x' : 'w-full sm:max-w-lg'}`}
                    style={{ overscrollBehavior: 'contain' }}
                    data-testid="panel-cv-builder"
                  >
                    <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3 border-b shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-sm font-medium -ml-1 sm:hidden"
                        onClick={() => { setShowCVBuilderSheet(false); setCvBuilderExpanded(false); }}
                        data-testid="button-back-cv-builder"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-5 h-5 text-cyan-500 shrink-0" />
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-foreground">Graduate CV Builder</h3>
                          <p className="text-xs text-muted-foreground line-clamp-1 hidden sm:block">Build a professional CV from your documents</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCvBuilderExpanded(prev => !prev)}
                          className="hidden sm:flex"
                          data-testid="button-expand-cv-builder"
                        >
                          {cvBuilderExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setShowCVBuilderSheet(false); setCvBuilderExpanded(false); }}
                          className="hidden sm:flex"
                          data-testid="button-close-cv-builder"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="h-0 flex-grow overflow-y-scroll px-3 py-2 sm:px-6 sm:py-4">
                      <CVBuilder
                        assets={allAssets}
                        selectedAssetIds={selectedAssets.filter(a => a.status === "READY").map(a => a.id)}
                        isVisible={true}
                      />
                    </div>
                  </div>
                </>
              )}

              {financeQueryEnabled && (
                <>
                  {showFinanceQuerySheet && (
                    <div
                      className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
                      onClick={() => setShowFinanceQuerySheet(false)}
                      onTouchMove={(e) => e.preventDefault()}
                      data-testid="overlay-finance-query"
                    />
                  )}
                  <div
                    className={`fixed inset-y-0 right-0 z-50 bg-background border-l shadow-lg flex flex-col transition-all duration-300 ease-in-out ${
                      showFinanceQuerySheet ? 'translate-x-0' : 'translate-x-full'
                    } ${financeQueryExpanded ? 'left-0 right-0 mx-auto max-w-5xl border-x' : 'w-full sm:max-w-lg'}`}
                    style={{ overscrollBehavior: 'contain' }}
                    data-testid="panel-finance-query"
                  >
                    <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3 border-b shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-sm font-medium -ml-1 sm:hidden"
                        onClick={() => { setShowFinanceQuerySheet(false); setFinanceQueryExpanded(false); }}
                        data-testid="button-back-finance-query"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <div className="flex items-center gap-2 min-w-0">
                        <DollarSign className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-foreground">Finance Query</h3>
                          <p className="text-xs text-muted-foreground line-clamp-1 hidden sm:block">Live SEC filings and financial data</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setFinanceQueryExpanded(prev => !prev)}
                          className="hidden sm:flex"
                          data-testid="button-expand-finance-query"
                        >
                          {financeQueryExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setShowFinanceQuerySheet(false); setFinanceQueryExpanded(false); }}
                          className="hidden sm:flex"
                          data-testid="button-close-finance-query"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden px-3 py-2 sm:px-6 sm:py-4">
                      <FinanceQuerySection
                        onAskFinance={handleAskFinance}
                        isAsking={financeMutation.isPending}
                        messages={financeMessages}
                        askError={financeMutation.error?.message}
                        hasDocumentsSelected={hasReadySelectedAssets}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Mobile Workspace Stats Panel - persistent sliding panel */}
              <>
                {showMobileWorkspacePanel && (
                  <div
                    className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
                    onClick={() => setShowMobileWorkspacePanel(false)}
                    data-testid="overlay-mobile-workspace"
                  />
                )}
                <div
                  className={`fixed inset-y-0 left-0 z-50 w-full sm:max-w-[400px] bg-background border-r shadow-lg flex flex-col transition-transform duration-300 ease-in-out ${
                    showMobileWorkspacePanel ? 'translate-x-0' : '-translate-x-full'
                  }`}
                  style={{ overscrollBehavior: 'contain' }}
                  data-testid="panel-mobile-workspace"
                >
                  <div className="flex items-center justify-between p-4 border-b shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-sm font-medium -ml-1"
                      onClick={() => setShowMobileWorkspacePanel(false)}
                      data-testid="button-back-top-mobile-workspace"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-500" />
                      <h3 className="text-lg font-semibold text-foreground">Workspace Stats</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowMobileWorkspacePanel(false)}
                      className="shrink-0"
                      data-testid="button-close-mobile-workspace"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
                    {viewPrefs.showWorkspaceStats && <WorkspaceStatsPanel />}
                    {viewPrefs.showActivity && <WorkspaceActivityPanel />}
                    {viewPrefs.showBookmarks && <BookmarksPanel onSelectConversation={(conv) => { setShowMobileWorkspacePanel(false); handleLoadConversation(conv); }} />}
                    {viewPrefs.showTips && <WorkspaceTipsPanel />}
                    {viewPrefs.showWorkspaceInsights && <WorkspaceInsightsPanel />}
                    {viewPrefs.showShare && (
                      <Card className="p-3">
                        <ShareButtons showLabel={true} />
                      </Card>
                    )}
                  </div>
                  <div className="shrink-0 p-4 bg-background border-t" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
                    <Button
                      variant="outline"
                      className="gap-2 text-sm font-medium w-full"
                      onClick={() => setShowMobileWorkspacePanel(false)}
                      data-testid="button-back-mobile-workspace"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                  </div>
                </div>
              </>


              

              {/* Mobile Study Fitness slide panel */}
              {isAuthenticated && verticalMode === "students" && (
                <>
                  {showStudyDashboardSheet && (
                    <div
                      className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
                      onClick={() => setShowStudyDashboardSheet(false)}
                      onTouchMove={(e) => e.preventDefault()}
                      data-testid="overlay-study-fitness"
                    />
                  )}
                  <div
                    className={`fixed inset-y-0 right-0 z-50 bg-background border-l shadow-lg flex flex-col transition-all duration-300 ease-in-out ${
                      showStudyDashboardSheet ? 'translate-x-0' : 'translate-x-full'
                    } w-full sm:max-w-lg`}
                    style={{ overscrollBehavior: 'contain' }}
                    data-testid="panel-study-fitness-mobile"
                  >
                    <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3 border-b shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-sm font-medium -ml-1 sm:hidden"
                        onClick={() => setShowStudyDashboardSheet(false)}
                        data-testid="button-back-study-fitness-mobile"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-md bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
                          <Activity className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-foreground">Study Fitness</h3>
                          <p className="text-xs text-muted-foreground line-clamp-1 hidden sm:block">Track your exam readiness and progress</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowStudyDashboardSheet(false)}
                        className="hidden sm:flex"
                        data-testid="button-close-study-fitness-mobile"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 sm:px-6 sm:py-4">
                      <StudyDashboardPanel
                        selectedAssetIds={selectedAssets.filter(a => a.status === "READY").map(a => a.id)}
                        expanded={true}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Desktop Study Fitness expanded slide panel */}
              {isAuthenticated && verticalMode === "students" && (
                <>
                  {studyDashboardExpanded && (
                    <div
                      className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
                      onClick={() => setStudyDashboardExpanded(false)}
                      data-testid="overlay-study-fitness-desktop"
                    />
                  )}
                  <div
                    className={`fixed inset-y-0 right-0 z-50 bg-background border-l shadow-lg flex flex-col transition-all duration-300 ease-in-out ${
                      studyDashboardExpanded ? 'translate-x-0' : 'translate-x-full'
                    } w-full sm:max-w-2xl`}
                    style={{ overscrollBehavior: 'contain' }}
                    data-testid="panel-study-fitness-desktop-expanded"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-md bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
                          <Activity className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-foreground">Study Fitness</h3>
                          <p className="text-xs text-muted-foreground">Track your exam readiness and progress</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setStudyDashboardExpanded(false)}
                        data-testid="button-close-study-fitness-desktop"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
                      <StudyDashboardPanel
                        selectedAssetIds={selectedAssets.filter(a => a.status === "READY").map(a => a.id)}
                        expanded={true}
                        onToggleExpand={() => setStudyDashboardExpanded(false)}
                      />
                    </div>
                  </div>
                </>
              )}

            </TabsContent>

            <TabsContent value="threads" className="mt-0">
              <div
                className="flex items-start gap-2 px-3 py-2 mb-3 rounded-md bg-primary/5 border border-primary/15"
                data-testid="threads-tip-mobile"
              >
                <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground flex-1 leading-snug">
                  <span className="font-medium text-foreground">Threads</span> keep your past chats with Evi so you can revisit answers and continue any conversation. Tap one to pick up where you left off.
                </p>
              </div>
              <div className="rounded-xl border bg-card" style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}>
                <ConversationSidebar
                  currentConversationId={currentConversationId}
                  onSelectConversation={(id) => {
                    if (id) {
                      handleLoadConversation(id);
                    } else {
                      handleClearConversation();
                    }
                    setActiveTab("chat");
                  }}
                  onNewConversation={() => {
                    handleClearConversation();
                    setActiveTab("chat");
                  }}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            </TabsContent>

            {canAccessHealth && (
              <TabsContent value="health" className="mt-0">
                <div className="flex items-center gap-2 mb-3 sm:hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-sm font-medium -ml-1"
                    onClick={() => setActiveTab("chat")}
                    data-testid="button-back-from-health"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Chat
                  </Button>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Activity className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold">Knowledge Health</span>
                  </div>
                </div>
                <KnowledgeHealthTab assets={allAssets} />
              </TabsContent>
            )}
          </Tabs>

          <PersonalIntegrationsPanel isOpen={showMySourcesPanel} onClose={() => setShowMySourcesPanel(false)} />

          {isSuperAdmin && (
            <>
              {showMobileIngestionPanel && (
                <div
                  className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
                  onClick={() => setShowMobileIngestionPanel(false)}
                  data-testid="overlay-org-connectors"
                />
              )}
              <div
                className={`fixed inset-y-0 right-0 z-50 bg-background flex flex-col transition-transform duration-300 ease-in-out w-full lg:w-[600px] lg:border-l lg:shadow-2xl ${
                  showMobileIngestionPanel ? 'translate-x-0' : 'translate-x-full'
                }`}
                style={{ overscrollBehavior: 'contain' }}
                data-testid="panel-org-connectors"
              >
                <div className="px-4 py-3 border-b" style={{ flexShrink: 0, paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-sm font-medium -ml-2"
                      onClick={() => setShowMobileIngestionPanel(false)}
                      data-testid="button-back-org-connectors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <div className="flex items-center gap-2">
                      <Plug className="w-4 h-4 text-blue-600" />
                      <h3 className="text-base font-semibold">Org Connectors</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setShowMobileIngestionPanel(false)}
                      data-testid="button-close-org-connectors"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="overflow-y-auto p-4 flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <DataIngestionFeed />
                </div>
              </div>
            </>
          )}

          {/* Mobile Documents Panel — full slide-over for upload & management (accessible from any tab) */}
          <>
            {showMobileDocsPanel && (
              <div
                className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
                onClick={() => setShowMobileDocsPanel(false)}
                data-testid="overlay-mobile-docs"
              />
            )}
            <div
              className={`fixed inset-y-0 right-0 z-50 bg-background flex flex-col transition-transform duration-300 ease-in-out w-full lg:w-[600px] lg:border-l lg:shadow-2xl ${
                showMobileDocsPanel ? 'translate-x-0' : 'translate-x-full'
              }`}
              style={{ overscrollBehavior: 'contain' }}
              data-testid="panel-mobile-docs"
            >
              <div className="px-4 py-3 border-b" style={{ flexShrink: 0, paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
                <div className="flex items-center justify-between mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-sm font-medium -ml-2"
                    onClick={() => setShowMobileDocsPanel(false)}
                    data-testid="button-back-mobile-docs"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" />
                    <h3 className="text-base font-semibold">Upload & Manage</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowMobileDocsPanel(false)}
                    data-testid="button-close-mobile-docs"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 h-10 text-sm font-semibold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => { setShowMobileDocsPanel(false); setActiveTab("chat"); }}
                    data-testid="button-chat-with-evi"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Chat with Evi
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-10 text-sm font-semibold gap-2"
                    onClick={() => { setShowMobileDocsPanel(false); setActiveTab("knowledge"); }}
                    data-testid="button-explore-tools"
                  >
                    <Sparkles className="w-4 h-4" />
                    Knowledge Space
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-1">Tap <span className="font-medium">Back</span> to return to all navigation options</p>
              </div>
              <div className="overflow-y-auto p-4" style={{ flex: '1 1 0%', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
                <UploadSection
                  onUpload={handleUpload}
                  isUploading={uploadMutation.isPending}
                  uploadError={uploadMutation.error?.message}
                  fileSizeError={fileSizeError}
                  onDismissFileSizeError={() => setFileSizeError(null)}
                  assets={allAssets}
                  selectedAssetIds={selectedAssetIds}
                  onToggleAsset={handleToggleAsset}
                  onSelectAll={handleSelectAll}
                  onDeleteAsset={handleDeleteAsset}
                  onReprocessAsset={handleReprocessAsset}
                  isLoading={assetsLoading}
                  enabledPackIds={enabledPackIds}
                  entitlementsLoading={entitlementsLoading}
                  recentQuestions={recentQuestions}
                  onReaskQuestion={handleReaskQuestion}
                  userPlan={usage?.plan}
                  maxFileSizeMB={usage?.planDetails?.maxFileSizeBytes ? Math.round(usage.planDetails.maxFileSizeBytes / 1024 / 1024) : undefined}
                />
              </div>
            </div>
          </>
        </main>
      )}


      {showEviNudge && activeTab !== "chat" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500" data-testid="evi-nudge-global">
          <div className="bg-card border rounded-2xl shadow-lg px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                <MessageCircle className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Everything OK?</p>
                <p className="text-xs text-muted-foreground mt-0.5">{eviNudgeMessage.text}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 -mt-0.5"
                onClick={() => { setShowEviNudge(false); setEviNudgeDismissed(true); }}
                data-testid="button-dismiss-nudge"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <Button
              size="sm"
              className="w-full mt-2.5"
              onClick={() => {
                setShowStudyDashboardSheet(false);
                setStudyDashboardExpanded(false);
                setShowEviNudge(false);
                setEviNudgeDismissed(true);
                setActiveTab("chat");
              }}
              data-testid="button-chat-with-evi-nudge"
            >
              <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
              {eviNudgeMessage.cta}
            </Button>
          </div>
        </div>
      )}

      {showKsNudge && activeTab === "chat" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500" data-testid="ks-nudge-global">
          <div className="bg-card border border-primary/20 rounded-2xl shadow-lg px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shrink-0 shadow-sm">
                <FolderKanban className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Try Knowledge Space</p>
                <p className="text-xs text-muted-foreground mt-0.5">Get answers with citations, use industry-specific prompts, and manage your documents all in one place.</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 -mt-0.5"
                onClick={() => { setShowKsNudge(false); setKsNudgeDismissed(true); }}
                data-testid="button-dismiss-ks-nudge"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <Button
              size="sm"
              className="w-full mt-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white"
              onClick={() => {
                setShowKsNudge(false);
                setKsNudgeDismissed(true);
                setActiveTab("knowledge");
              }}
              data-testid="button-explore-ks-nudge"
            >
              <FolderKanban className="w-3.5 h-3.5 mr-1.5" />
              Explore Knowledge Space
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t mt-8 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img 
                src="/apple-touch-icon.png?v=3" 
                alt="Evident" 
                className="w-6 h-6 rounded"
              />
              <span className="text-sm text-muted-foreground">
                Evident - Evidence-Based AI Assistant
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <button 
                onClick={() => window.location.href = "/tutorials"}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1" 
                data-testid="link-footer-tutorials"
              >
                <Play className="w-3 h-3" />
                Video Tutorials
              </button>
              <button 
                onClick={() => window.location.href = "/pricing"}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors" 
                data-testid="link-footer-pricing"
              >
                Pricing
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ModeAwarenessTip() {
  const { mode, config } = useMode();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [mode]);

  if (dismissed) return null;

  const IconComponent = config.icon;

  return (
    <div
      className="flex items-start gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/15 animate-in fade-in slide-in-from-top-1 duration-300"
      data-testid="mode-awareness-tip"
    >
      <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
      <p className="text-xs text-muted-foreground flex-1">
        <span className="font-medium text-foreground">
          <IconComponent className={`w-3 h-3 inline-block mr-1 -mt-0.5 ${config.color}`} />
          {config.label}
        </span>{" "}
        mode is active. Tap <span className="font-medium text-foreground">Mode</span> above to switch and get tailored prompts for your industry.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
        data-testid="button-dismiss-mode-tip"
        aria-label="Dismiss"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function IntelligencePacksCard() {
  const { isExpanded, toggle } = usePanelState("intelligence-packs");
  const { getEnabledPacks } = useEntitlements();
  const enabledPacks = getEnabledPacks();
  const enabledPackIds = enabledPacks.map(p => p.id);
  
  const packLinks = [
    { id: "finance", title: "Finance", path: "/reconciliation", icon: DollarSign },
    { id: "legal", title: "Legal", path: "/legal/contracts", icon: Scale },
    { id: "hr", title: "HR", path: "/cv-screener", icon: Users },
  ];
  
  const activePacks = packLinks.filter(p => enabledPackIds.includes(p.id as any));
  
  return (
    <Card className="border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-800/30 transition-colors rounded-t-lg"
        onClick={toggle}
      >
        <h3 className="font-semibold text-sm flex items-center gap-2 text-white">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Intelligence Packs
          {activePacks.length > 0 && (
            <Badge variant="default" className="text-xs bg-green-600 ml-1">{activePacks.length} Active</Badge>
          )}
        </h3>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </div>
      
      {isExpanded && (
      <div className="px-4 pb-4 space-y-2">
        {activePacks.length > 0 ? (
          <div className="space-y-1">
            {activePacks.map(pack => (
              <Link key={pack.id} href={pack.path}>
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-xs text-slate-200 hover:text-white hover:bg-slate-700" data-testid={`link-pack-${pack.id}`}>
                  <pack.icon className="w-3 h-3 mr-2" />
                  {pack.title}
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </Button>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Specialized AI tools for Finance, Legal, HR available.
          </p>
        )}
        <Link href="/packs" className="block">
          <Button variant="outline" size="sm" className="w-full h-7 text-xs border-slate-600 text-slate-200 hover:bg-slate-700" data-testid="link-all-packs">
            View All Packs
          </Button>
        </Link>
      </div>
      )}
    </Card>
  );
}

function EnabledPacksGrid() {
  const { getEnabledPacks, isLoading, packDefinitions } = useEntitlements();
  const enabledPacks = getEnabledPacks();
  
  const iconMap: Record<string, typeof Scale> = {
    Scale,
    DollarSign,
  };
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-12 w-12 bg-muted rounded-lg mb-4" />
              <div className="h-5 bg-muted rounded w-2/3 mb-2" />
              <div className="h-4 bg-muted rounded w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (enabledPacks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Boxes className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Intelligence Packs Enabled</h3>
          <p className="text-muted-foreground mb-4">
            Intelligence packs provide specialized AI capabilities for your industry.
          </p>
          <Button asChild variant="outline">
            <Link href="/packs" data-testid="link-explore-packs-empty">
              Explore Packs
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {enabledPacks.map((pack) => {
          const IconComponent = iconMap[pack.icon] || Boxes;
          const features = pack.features || [];
          return (
            <Card key={pack.id} className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <IconComponent className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{pack.title}</CardTitle>
                    <CardDescription className="text-xs">{pack.shortDescription}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {features.map((feature, idx) => (
                    <Link key={idx} href={feature.path}>
                      <div className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer">
                        <div>
                          <p className="font-medium text-sm">{feature.name}</p>
                          <p className="text-xs text-muted-foreground">{feature.description}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                  {features.length === 0 && (
                    <Link href={`/packs/${pack.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer">
                        <span className="text-sm">Open Pack</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <div className="text-center">
        <Button asChild variant="outline">
          <Link href="/packs" data-testid="link-view-all-packs">
            View All Packs
          </Link>
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string; icon: JSX.Element }> = {
    UPLOADED: {
      label: "Uploaded",
      className: "bg-muted text-muted-foreground",
      icon: <span className="w-2 h-2 rounded-full bg-muted-foreground" />,
    },
    PROCESSING: {
      label: "Processing",
      className: "bg-chart-4/20 text-chart-4",
      icon: <span className="w-2 h-2 rounded-full bg-chart-4 animate-pulse" />,
    },
    READY: {
      label: "Ready",
      className: "bg-chart-2/20 text-chart-2",
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ),
    },
    ERROR: {
      label: "Error",
      className: "bg-destructive/20 text-destructive",
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
    },
    UNSUPPORTED: {
      label: "Unsupported",
      className: "bg-muted text-muted-foreground",
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
    },
  };

  const config = statusConfig[status] || statusConfig.UPLOADED;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.className}`}
      data-testid={`badge-status-${status.toLowerCase()}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
