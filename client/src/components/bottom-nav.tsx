import { Link, useLocation } from "wouter";
import { Plug, User, FolderOpen, MessageCircle, Moon, Sun, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useIOSDetection } from "@/hooks/use-ios-detection";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

type NavTarget = "chat" | "knowledge" | "sources" | "threads" | "menu" | "other";

interface BottomNavProps {
  className?: string;
}

export function BottomNav({ className }: BottomNavProps) {
  const [location, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const isIOSApp = useIOSDetection();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });
  const isSuperAdmin = adminCheck?.isAdmin;

  const getInitialNav = (): NavTarget => {
    if (sessionStorage.getItem("pending-open-sources")) return "sources";
    const returnTab = sessionStorage.getItem("evident_return_tab");
    if (returnTab === "threads") return "threads";
    if (location === "/full") return "chat";
    if (location === "/menu" || location === "/auth") return "menu";
    return "other";
  };
  const [activeNav, setActiveNavState] = useState<NavTarget>(getInitialNav);
  const activeNavRef = useRef<NavTarget>(activeNav);
  const setActiveNav = (val: NavTarget) => {
    activeNavRef.current = val;
    setActiveNavState(val);
  };

  useEffect(() => {
    if (location === "/menu" || location === "/auth") {
      setActiveNav("menu");
    } else if (location !== "/full") {
      setActiveNav("other");
    }
  }, [location]);

  const navBeforeSourcesRef = useRef<NavTarget>("knowledge");

  useEffect(() => {
    const onSourcesOpen = () => {
      navBeforeSourcesRef.current = activeNavRef.current;
      setActiveNav("sources");
    };
    const onSourcesClose = () => {
      const restoreTo = navBeforeSourcesRef.current === "sources" ? "knowledge" : navBeforeSourcesRef.current;
      setActiveNav(restoreTo);
    };
    const onTabChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (activeNavRef.current === "sources") return;
      if (detail === "chat") setActiveNav("chat");
      else if (detail === "knowledge") setActiveNav("knowledge");
      else if (detail === "threads") setActiveNav("threads");
    };
    window.addEventListener("sources-panel-opened", onSourcesOpen);
    window.addEventListener("sources-panel-closed", onSourcesClose);
    window.addEventListener("tab-changed", onTabChange);
    return () => {
      window.removeEventListener("sources-panel-opened", onSourcesOpen);
      window.removeEventListener("sources-panel-closed", onSourcesClose);
      window.removeEventListener("tab-changed", onTabChange);
    };
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    const darkBg = "#090e1a";
    const lightBg = "#eceff2";
    if (newIsDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.backgroundColor = darkBg;
      document.documentElement.style.colorScheme = "dark";
      document.body.style.backgroundColor = darkBg;
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute("content", darkBg);
      const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
      if (colorSchemeMeta) colorSchemeMeta.setAttribute("content", "dark");
      localStorage.setItem("evidentTheme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.backgroundColor = lightBg;
      document.documentElement.style.colorScheme = "light";
      document.body.style.backgroundColor = lightBg;
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute("content", lightBg);
      const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
      if (colorSchemeMeta) colorSchemeMeta.setAttribute("content", "light");
      localStorage.setItem("evidentTheme", "light");
    }
  };

  const handleChatTap = () => {
    if (!isAuthenticated) { navigate("/auth"); return; }
    setActiveNav("chat");
    if (location === "/full") {
      window.dispatchEvent(new CustomEvent("close-browse-sources"));
      window.dispatchEvent(new CustomEvent("switch-tab", { detail: "chat" }));
    } else {
      sessionStorage.setItem("evident_return_tab", "chat");
      navigate("/full");
    }
  };

  const handleWorkspaceTap = () => {
    if (!isAuthenticated) { navigate("/auth"); return; }
    setActiveNav("knowledge");
    if (location === "/full") {
      window.dispatchEvent(new CustomEvent("close-browse-sources"));
      window.dispatchEvent(new CustomEvent("switch-tab", { detail: "knowledge" }));
    } else {
      sessionStorage.setItem("evident_return_tab", "knowledge");
      navigate("/full");
    }
  };

  const handleSourcesTap = () => {
    if (!isAuthenticated) { navigate("/auth"); return; }
    setActiveNav("sources");
    if (location !== "/full") {
      sessionStorage.setItem("pending-open-sources", "1");
      navigate("/full");
    } else {
      window.dispatchEvent(new CustomEvent("open-browse-sources"));
    }
  };

  const handleThreadsTap = () => {
    if (!isAuthenticated) { navigate("/auth"); return; }
    setActiveNav("threads");
    if (location === "/full") {
      window.dispatchEvent(new CustomEvent("close-browse-sources"));
      window.dispatchEvent(new CustomEvent("switch-tab", { detail: "threads" }));
    } else {
      sessionStorage.setItem("evident_return_tab", "threads");
      navigate("/full");
    }
  };

  const navItemStyle = {
    WebkitTapHighlightColor: "transparent" as const,
    touchAction: "manipulation" as const,
  };
  const navItemClass = (active: boolean) => cn(
    "flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-lg transition-colors no-underline",
    "active:bg-muted/70",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
  );

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border",
        "flex items-center justify-around px-2 pt-2 pb-2",
        isIOSApp ? "" : "sm:hidden",
        className
      )}
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      data-testid="nav-bottom"
    >
      <button onClick={handleChatTap} className={navItemClass(activeNav === "chat")} style={navItemStyle} data-testid="nav-chat">
        <MessageCircle className={cn("w-6 h-6", activeNav === "chat" && "text-primary")} />
        <span className="text-xs font-medium">Chat</span>
      </button>
      <button onClick={handleWorkspaceTap} className={navItemClass(activeNav === "knowledge")} style={navItemStyle} data-testid="nav-workspace">
        <FolderOpen className={cn("w-6 h-6", activeNav === "knowledge" && "text-primary")} />
        <span className="text-xs font-medium">Knowledge</span>
      </button>
      {isSuperAdmin && (
        <button onClick={handleSourcesTap} className={navItemClass(activeNav === "sources")} style={navItemStyle} data-testid="nav-sources">
          <Plug className={cn("w-6 h-6", activeNav === "sources" && "text-primary")} />
          <span className="text-xs font-medium">Integrate</span>
        </button>
      )}
      <button onClick={handleThreadsTap} className={navItemClass(activeNav === "threads")} style={navItemStyle} data-testid="nav-threads">
        <MessagesSquare className={cn("w-6 h-6", activeNav === "threads" && "text-primary")} />
        <span className="text-xs font-medium">Threads</span>
      </button>
      <Link
        href={isAuthenticated ? "/menu" : "/auth"}
        className={navItemClass(activeNav === "menu")}
        style={navItemStyle}
        data-testid="nav-menu"
      >
        <User className={cn("w-6 h-6", activeNav === "menu" && "text-primary")} />
        <span className="text-xs font-medium">{isAuthenticated ? "Menu" : "Sign In"}</span>
      </Link>
      <button
        onClick={toggleTheme}
        className={cn(
          "flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-lg transition-colors",
          "active:bg-muted/70 text-muted-foreground hover:text-foreground"
        )}
        style={navItemStyle}
        data-testid="button-theme-toggle"
      >
        {isDark ? (
          <Sun className="w-6 h-6 text-amber-400" />
        ) : (
          <Moon className="w-6 h-6 text-indigo-500" />
        )}
        <span className="text-xs font-medium">{isDark ? "Light" : "Dark"}</span>
      </button>
    </nav>
  );
}
