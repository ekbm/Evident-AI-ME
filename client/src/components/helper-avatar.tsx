import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb, HelpCircle, Sparkles, FileText, MessageSquare, CheckSquare, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type ContextType = 
  | "welcome"
  | "no-files"
  | "file-uploaded"
  | "files-selected"
  | "chat-ready"
  | "first-question"
  | "obligations"
  | "external-search"
  | "premium-features";

interface Tip {
  title: string;
  message: string;
  icon: typeof Lightbulb;
}

const CONTEXTUAL_TIPS: Record<ContextType, Tip[]> = {
  welcome: [
    {
      title: "Welcome to Evident",
      message: "I'm here to help you get the most out of your documents. Upload a file to get started!",
      icon: Sparkles,
    },
  ],
  "no-files": [
    {
      title: "Upload Your First File",
      message: "Drag and drop a PDF, Word doc, image, or audio file to begin analyzing your evidence.",
      icon: FileText,
    },
    {
      title: "Supported Formats",
      message: "I can process PDFs, DOCX, TXT, images (for OCR), and even audio/video files for transcription.",
      icon: HelpCircle,
    },
  ],
  "file-uploaded": [
    {
      title: "File Processing",
      message: "Your file is being analyzed. I'm extracting text and creating searchable chunks for accurate answers.",
      icon: Sparkles,
    },
  ],
  "files-selected": [
    {
      title: "Ready to Answer",
      message: "Great! Now you can ask questions about your selected documents. I'll find relevant passages and cite my sources.",
      icon: MessageSquare,
    },
  ],
  "chat-ready": [
    {
      title: "Ask Anything",
      message: "Type a question in natural language. I'll search through your documents and provide cited answers.",
      icon: MessageSquare,
    },
    {
      title: "Be Specific",
      message: "The more specific your question, the better I can help. Try asking about dates, names, or specific topics.",
      icon: Lightbulb,
    },
  ],
  "first-question": [
    {
      title: "Citations Matter",
      message: "Each answer includes citations showing exactly where the information came from. Click to see the source text.",
      icon: FileText,
    },
  ],
  obligations: [
    {
      title: "Extract Obligations",
      message: "For contracts and policies, I can extract a checklist of obligations with who, what, and when details.",
      icon: CheckSquare,
    },
  ],
  "external-search": [
    {
      title: "Need More Context?",
      message: "If your documents don't have the answer, I can search the web to augment my response.",
      icon: HelpCircle,
    },
  ],
  "premium-features": [
    {
      title: "Unlock More Power",
      message: "Upgrade to access workspaces, scheduled reports, and AI training data exports.",
      icon: Sparkles,
    },
  ],
};

interface HelperAvatarProps {
  context: ContextType;
  hasFiles?: boolean;
  hasSelectedFiles?: boolean;
  hasMessages?: boolean;
  className?: string;
}

const WELCOME_SHOWN_KEY = "evident_welcome_shown";
const HELPER_DISABLED_KEY = "evident_helper_disabled";

export function HelperAvatar({
  context,
  hasFiles = false,
  hasSelectedFiles = false,
  hasMessages = false,
  className = "",
}: HelperAvatarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [lastContext, setLastContext] = useState<ContextType>(context);
  const [isReady, setIsReady] = useState(false);
  const [permanentlyDisabled, setPermanentlyDisabled] = useState(() => {
    return localStorage.getItem(HELPER_DISABLED_KEY) === "true";
  });

  const tips = CONTEXTUAL_TIPS[context] || CONTEXTUAL_TIPS.welcome;
  const currentTip = tips[currentTipIndex];

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(WELCOME_SHOWN_KEY);
    let readyTimer: ReturnType<typeof setTimeout>;
    let fallbackTimer: ReturnType<typeof setTimeout>;
    
    if (hasSeenWelcome) {
      readyTimer = setTimeout(() => {
        setIsReady(true);
      }, 1500);
      return () => clearTimeout(readyTimer);
    } else {
      const handleWelcomeClosed = () => {
        clearTimeout(fallbackTimer);
        readyTimer = setTimeout(() => {
          setIsReady(true);
        }, 1000);
      };
      
      fallbackTimer = setTimeout(() => {
        setIsReady(true);
      }, 8000);
      
      window.addEventListener("welcome-modal-closed", handleWelcomeClosed);
      return () => {
        window.removeEventListener("welcome-modal-closed", handleWelcomeClosed);
        clearTimeout(readyTimer);
        clearTimeout(fallbackTimer);
      };
    }
  }, []);

  useEffect(() => {
    if (context !== lastContext && isReady) {
      setLastContext(context);
      setCurrentTipIndex(0);
      setDismissed(false);
      setIsOpen(true);
    }
  }, [context, lastContext, isReady]);

  useEffect(() => {
    if (!isReady) return;
    const timer = setTimeout(() => {
      if (!dismissed) {
        setIsOpen(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [dismissed, isReady]);

  const handleNextTip = () => {
    if (currentTipIndex < tips.length - 1) {
      setCurrentTipIndex(currentTipIndex + 1);
    } else {
      setIsOpen(false);
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    setDismissed(true);
  };

  const handleDisablePermanently = () => {
    localStorage.setItem(HELPER_DISABLED_KEY, "true");
    setPermanentlyDisabled(true);
    setIsOpen(false);
  };

  // Don't render if permanently disabled
  if (permanentlyDisabled) {
    return null;
  }

  const handleAvatarClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setDismissed(false);
    }
  };

  const TipIcon = currentTip?.icon || Lightbulb;

  return (
    <div className={`hidden sm:block fixed top-[40%] right-6 -translate-y-1/2 z-50 ${className}`}>
      <AnimatePresence>
        {isOpen && currentTip && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute right-16 top-1/2 -translate-y-1/2 w-72 bg-card border rounded-lg shadow-lg overflow-hidden mr-2"
          >
            <div className="bg-primary/10 p-3 flex items-center gap-2 border-b">
              <TipIcon className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">{currentTip.title}</span>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-6 w-6"
                onClick={handleDismiss}
                data-testid="button-dismiss-tip"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {currentTip.message}
              </p>
            </div>
            <div className="px-4 pb-3 flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDisablePermanently}
                className="text-xs text-muted-foreground hover:text-foreground"
                data-testid="button-disable-helper"
              >
                Don't show again
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {currentTipIndex + 1} / {tips.length}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleNextTip}
                  className="gap-1"
                  data-testid="button-next-tip"
                >
                  {currentTipIndex < tips.length - 1 ? "Next" : "Got it"}
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleAvatarClick}
        className="relative w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center cursor-pointer"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{
          boxShadow: isOpen
            ? "0 4px 20px rgba(0,0,0,0.15)"
            : [
                "0 4px 20px rgba(0,0,0,0.1)",
                "0 4px 30px rgba(0,0,0,0.2)",
                "0 4px 20px rgba(0,0,0,0.1)",
              ],
        }}
        transition={{
          boxShadow: {
            duration: 2,
            repeat: isOpen ? 0 : Infinity,
            ease: "easeInOut",
          },
        }}
        data-testid="button-helper-avatar"
      >
        <motion.div
          animate={{
            rotate: isOpen ? 0 : [0, -10, 10, -10, 0],
          }}
          transition={{
            duration: 0.5,
            repeat: isOpen ? 0 : Infinity,
            repeatDelay: 3,
          }}
        >
          <Sparkles className="w-6 h-6" />
        </motion.div>
        
        {!isOpen && !dismissed && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center"
          >
            <span className="text-[10px] text-destructive-foreground font-bold">
              {tips.length}
            </span>
          </motion.div>
        )}
      </motion.button>
    </div>
  );
}
