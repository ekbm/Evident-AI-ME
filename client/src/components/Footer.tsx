import { Link } from "wouter";
import { FeedbackModal } from "./FeedbackModal";
import { Globe, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Footer() {
  const { isAuthenticated } = useAuth();

  return (
    <footer className="border-t bg-muted/30 mt-auto pb-20 sm:pb-0">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="text-muted-foreground text-center sm:text-left">
            <p>Evident — Answers from your files, with evidence.</p>
            <p className="flex items-center justify-center sm:justify-start gap-1 mt-1">
              <Globe className="w-3 h-3" />
              <span>Also available at</span>
              <a 
                href="https://evident-ai.net" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                data-testid="link-web-app"
              >
                evident-ai.net
              </a>
            </p>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-4">
            <FeedbackModal />
            {isAuthenticated ? (
              <Link 
                href="/help" 
                className="text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-help"
              >
                Help
              </Link>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link 
                    href="/auth" 
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-help"
                  >
                    Help
                    <Lock className="w-3 h-3" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Sign in required</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Link 
              href="/blog" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-blog-footer"
            >
              Blog
            </Link>
            <Link 
              href="/about" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-about"
            >
              About
            </Link>
            <Link 
              href="/use-cases" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-use-cases-footer"
            >
              Use Cases
            </Link>
            <button 
              onClick={() => window.location.href = "/faq"}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-faq-footer"
            >
              FAQ
            </button>
            <Link 
              href="/privacy" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-privacy"
            >
              Privacy
            </Link>
            <Link 
              href="/terms" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-terms"
            >
              Terms
            </Link>
            <Link 
              href="/ai-disclaimer" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-ai-disclaimer"
            >
              AI Disclaimer
            </Link>
            <Link 
              href="/security" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-security"
            >
              Security & Trust
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
