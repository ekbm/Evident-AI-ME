import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, HelpCircle, FileText, FolderOpen, Clock, Brain, Sparkles, Settings, Upload, MessageCircle, Bookmark, BarChart3, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HelpItem {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: "documents" | "folders" | "timer" | "learning" | "qa" | "settings" | "general";
}

const helpContent: HelpItem[] = [
  {
    id: "upload",
    question: "How do I upload documents?",
    answer: "Click the upload area in the center of your workspace or drag and drop files directly. Evident supports PDFs, Word documents, images, audio, and video files. Your files are processed automatically for AI-powered Q&A.",
    keywords: ["upload", "add", "file", "document", "drag", "drop", "pdf", "import"],
    category: "documents"
  },
  {
    id: "ask-question",
    question: "How do I ask questions about my documents?",
    answer: "Type your question in the Q&A box below the upload area. Make sure you have documents selected (checked) - Evident will search through your selected documents to find answers with citations.",
    keywords: ["ask", "question", "query", "answer", "search", "find", "qa"],
    category: "qa"
  },
  {
    id: "select-documents",
    question: "How do I select documents for Q&A?",
    answer: "Click the checkbox next to any document to select it. Selected documents appear in the 'Selected Documents' section at the top. Only selected documents are searched when you ask questions.",
    keywords: ["select", "choose", "checkbox", "pick", "selected"],
    category: "documents"
  },
  {
    id: "folders",
    question: "How do I organize my files into folders?",
    answer: "Go to the Knowledge Vault tab to see your folders. Click on a date folder (like 'January 2025') to open it, then click 'New Folder' to create a custom subfolder. You can drag files or use the Move option to organize them.",
    keywords: ["folder", "organize", "move", "vault", "subfolder", "create folder"],
    category: "folders"
  },
  {
    id: "move-files",
    question: "How do I move files to a folder?",
    answer: "Click the menu (three dots) on any file and select 'Move to Folder'. To move multiple files at once, select them using checkboxes, then click the 'Move' button that appears in the header.",
    keywords: ["move", "transfer", "folder", "bulk", "multiple", "relocate"],
    category: "folders"
  },
  {
    id: "timer",
    question: "How does the study timer work?",
    answer: "The timer tracks your active study time. Click the play button to start, pause to take breaks. Your daily and weekly study time is shown in the Workspace Stats panel. You can earn achievement badges for consistent studying!",
    keywords: ["timer", "clock", "study", "time", "track", "pomodoro", "focus"],
    category: "timer"
  },
  {
    id: "achievements",
    question: "What are the timer achievements?",
    answer: "Study achievements reward consistent effort: Bronze badge for 2+ hours daily, Silver for 3+ hours, and Gold for 4+ hours. Your current streak shows consecutive days of studying.",
    keywords: ["achievement", "badge", "reward", "gold", "silver", "bronze", "streak"],
    category: "timer"
  },
  {
    id: "learning-mode",
    question: "What is Research Mode?",
    answer: "Research Mode searches the web for additional information beyond your documents. Toggle it on in the Q&A section. You can also paste a specific URL (webpage or YouTube) as an additional source. Check 'Documents + Source Only' to restrict answers to your docs and the pasted link.",
    keywords: ["learning", "research", "deep", "web", "external", "perplexity", "internet"],
    category: "learning"
  },
  {
    id: "my-learning",
    question: "Where can I see what I've learned?",
    answer: "Go to Menu → My Learning to see all topics you've researched. This includes Research Mode Q&A results and knowledge Evi has learned.",
    keywords: ["my learning", "history", "saved", "topics", "knowledge"],
    category: "learning"
  },
  {
    id: "customize-view",
    question: "How do I customize what I see?",
    answer: "Click your profile picture, then select 'Customize View'. You can toggle different panels on/off, or use preset modes like 'Student Mode' (simplified) or 'Minimal View' (just the essentials).",
    keywords: ["customize", "hide", "show", "toggle", "panels", "preferences", "settings", "view"],
    category: "settings"
  },
  {
    id: "bookmarks",
    question: "How do I save conversations?",
    answer: "Your Q&A conversations are automatically saved. Find them in the Bookmarks panel on the left sidebar. Click any saved conversation to reload it and continue where you left off.",
    keywords: ["bookmark", "save", "conversation", "history", "saved"],
    category: "general"
  },
  {
    id: "workspace-stats",
    question: "What do the workspace stats show?",
    answer: "Workspace Stats shows your document count, questions asked, study time (today and this week), and your study streak. It gives you a quick overview of your activity.",
    keywords: ["stats", "statistics", "overview", "dashboard", "activity", "usage"],
    category: "general"
  },
  {
    id: "active-vs-vault",
    question: "What's the difference between Active Files and Knowledge Vault?",
    answer: "Active Files shows your recent uploads and frequently used documents. Knowledge Vault is for long-term storage, organized by date and custom folders. Move files between them as needed.",
    keywords: ["active", "vault", "archive", "recent", "storage", "difference"],
    category: "documents"
  },
  {
    id: "file-preview",
    question: "How do I preview a document?",
    answer: "Click the eye icon on any document to open a preview. For PDFs and images, you'll see the content directly. For other files, you'll see metadata and extracted text.",
    keywords: ["preview", "view", "open", "see", "look", "eye"],
    category: "documents"
  },
  {
    id: "delete-file",
    question: "How do I delete a file?",
    answer: "Click the menu (three dots) on any file and select 'Delete'. This permanently removes the file and its contents from your workspace.",
    keywords: ["delete", "remove", "trash", "discard"],
    category: "documents"
  },
  {
    id: "rename-folder",
    question: "How do I rename a folder?",
    answer: "Open a folder, then click the menu (three dots) next to the folder name. Select 'Rename' to change the folder name.",
    keywords: ["rename", "folder", "name", "change", "edit"],
    category: "folders"
  },
  {
    id: "citations",
    question: "How do citations work?",
    answer: "When Evident answers your question, it shows citations linking to the exact source in your documents. Click a citation to see where the information came from.",
    keywords: ["citation", "source", "reference", "where", "proof"],
    category: "qa"
  },
  {
    id: "hide-help",
    question: "How do I hide this help button?",
    answer: "Go to your profile → Customize View, and toggle off 'Help Button'. You can always re-enable it from the same menu.",
    keywords: ["hide", "help", "button", "remove", "disable"],
    category: "settings"
  },
  {
    id: "obligations",
    question: "What are Obligations?",
    answer: "Obligations are requirements, duties, or action items extracted from your legal documents, contracts, or policies. Evident's AI automatically identifies 'must do' items like deadlines, compliance requirements, and responsibilities. View them in the Obligations panel.",
    keywords: ["obligation", "requirement", "duty", "contract", "legal", "compliance", "must", "shall"],
    category: "documents"
  },
  {
    id: "vault-explained",
    question: "What is the Knowledge Vault?",
    answer: "The Knowledge Vault is your long-term document storage organized by date and custom folders. Files are automatically sorted by upload month/year. Create custom subfolders (up to 3 levels deep) to organize by subject, project, or any system you prefer.",
    keywords: ["vault", "knowledge vault", "storage", "archive", "long-term", "organize"],
    category: "folders"
  },
  {
    id: "intelligence-packs",
    question: "What are Intelligence Packs?",
    answer: "Intelligence Packs are specialized AI capabilities for different fields like Finance, Legal, HR, or Healthcare. They enhance Evident's understanding of industry-specific terminology and provide more accurate answers for specialized documents.",
    keywords: ["intelligence", "pack", "specialized", "finance", "legal", "hr", "healthcare", "industry"],
    category: "learning"
  },
  {
    id: "file-types",
    question: "What file types can I upload?",
    answer: "Evident supports: PDFs, Word documents (.doc, .docx), images (JPG, PNG), audio files (MP3, WAV, M4A), and video files (MP4, MOV). Audio and video are transcribed automatically. Images are analyzed using AI vision.",
    keywords: ["file type", "format", "pdf", "word", "image", "audio", "video", "supported", "accept"],
    category: "documents"
  },
  {
    id: "transcription",
    question: "How does audio/video transcription work?",
    answer: "When you upload audio or video files, Evident automatically transcribes the speech to text using AI. The transcription becomes searchable and can be used for Q&A just like any document.",
    keywords: ["transcribe", "transcription", "audio", "video", "speech", "text", "voice"],
    category: "documents"
  },
  {
    id: "dark-mode",
    question: "How do I switch to dark mode?",
    answer: "Click the sun/moon icon in the top header to toggle between light and dark mode. Your preference is saved automatically.",
    keywords: ["dark", "light", "mode", "theme", "night", "sun", "moon"],
    category: "settings"
  },
  {
    id: "profile-menu",
    question: "Where is the profile menu?",
    answer: "Click your profile picture or avatar in the top-right corner. From there you can access Settings, Customize View, My Learning, Feedback, and sign out.",
    keywords: ["profile", "menu", "avatar", "settings", "account", "sign out", "logout"],
    category: "settings"
  },
  {
    id: "feedback",
    question: "How do I give feedback or report issues?",
    answer: "Click your profile picture → Feedback to share suggestions, report bugs, or request new features. We read every piece of feedback and use it to improve Evident.",
    keywords: ["feedback", "report", "bug", "issue", "suggestion", "request", "feature", "problem"],
    category: "general"
  },
  {
    id: "plans-pricing",
    question: "What plans are available?",
    answer: "Evident offers Free, Student, and Pro plans. Each plan has different limits for file uploads, questions, and storage. Check the Plans section in Settings to see details and upgrade options.",
    keywords: ["plan", "pricing", "free", "student", "pro", "upgrade", "subscription", "cost", "price"],
    category: "general"
  },
  {
    id: "file-limit",
    question: "What are the file size limits?",
    answer: "File size limits depend on your plan. Free users can upload files up to 10MB, Student plan allows 50MB, and Pro plan supports up to 200MB per file.",
    keywords: ["limit", "size", "mb", "megabyte", "maximum", "file size", "too large"],
    category: "documents"
  },
  {
    id: "reprocess",
    question: "What does Reprocess mean?",
    answer: "Reprocess re-analyzes a file using Evident's AI. Use this if a file wasn't processed correctly the first time, or after Evident updates its processing capabilities.",
    keywords: ["reprocess", "reanalyze", "retry", "process again", "refresh"],
    category: "documents"
  },
  {
    id: "selected-documents-box",
    question: "What is the Selected Documents box?",
    answer: "The Selected Documents box at the top shows all files you've checked for Q&A. Only these documents are searched when you ask questions. Uncheck documents to exclude them from searches.",
    keywords: ["selected", "documents", "box", "checked", "active"],
    category: "documents"
  },
  {
    id: "folder-colors",
    question: "Can I change folder colors?",
    answer: "Yes! When creating a new folder, you can choose from several colors (pink, blue, green, amber, etc.). This helps visually distinguish different subjects or categories.",
    keywords: ["color", "folder", "pink", "blue", "green", "customize", "theme"],
    category: "folders"
  },
  {
    id: "folder-depth",
    question: "How deep can folders be nested?",
    answer: "Folders can be nested up to 3 levels deep. For example: Year → Month → Subject → Topic. This keeps your organization clean and easy to navigate.",
    keywords: ["nested", "depth", "level", "subfolder", "hierarchy", "deep"],
    category: "folders"
  },
  {
    id: "bulk-operations",
    question: "How do I move multiple files at once?",
    answer: "Select multiple files using their checkboxes, then click the 'Move' dropdown button that appears in the header. Choose a destination folder to move all selected files at once.",
    keywords: ["bulk", "multiple", "move", "batch", "several", "many", "mass"],
    category: "folders"
  },
  {
    id: "what-is-evident",
    question: "What is Evident?",
    answer: "Evident is an AI-powered document assistant for students. Upload your study materials, lecture notes, and readings, then ask questions to get answers with citations. Track your study time, organize files in folders, and build your personal knowledge base.",
    keywords: ["evident", "what", "about", "app", "purpose", "overview"],
    category: "general"
  },
  {
    id: "privacy",
    question: "Is my data private and secure?",
    answer: "Yes! Your documents are stored securely and only accessible by you. Evident uses encryption for data transfer and storage. Your files are never shared with other users.",
    keywords: ["privacy", "private", "secure", "security", "data", "safe", "encryption"],
    category: "general"
  },
  {
    id: "ai-answers",
    question: "How accurate are AI answers?",
    answer: "Evident's AI provides answers based on the content in your selected documents. Always verify important information, especially for academic or professional use. Citations help you check the original source.",
    keywords: ["accurate", "accuracy", "correct", "reliable", "trust", "ai", "wrong"],
    category: "qa"
  },
  {
    id: "no-answer",
    question: "Why can't Evident answer my question?",
    answer: "Evident can only answer based on your selected documents. If no answer is found: 1) Make sure relevant documents are selected 2) Try rephrasing your question 3) The information might not be in your documents - try Research Mode to search the web.",
    keywords: ["no answer", "cannot", "can't", "unable", "not found", "missing"],
    category: "qa"
  },
  {
    id: "natural-mode",
    question: "What is Natural Mode?",
    answer: "Natural Mode gives you more conversational, free-flowing AI responses. When ON, Evident skips its built-in prompts for a simpler chat experience. Toggle it using the 'Natural' switch in the Q&A area. Try it if structured answers aren't quite what you need.",
    keywords: ["natural", "mode", "conversational", "simple", "free", "chat", "toggle", "switch"],
    category: "qa"
  },
  {
    id: "intent-modes",
    question: "What are the different Intent Modes?",
    answer: "Intent Modes help Evident understand your goal: General (balanced answers), Personal (tailored to you), Study (learning-focused), Research (academic style), Engineering (technical), Service (customer support), and Finance (financial document analysis with optional live SEC data). Choose based on what you're working on.",
    keywords: ["intent", "mode", "general", "personal", "study", "research", "engineering", "service", "finance"],
    category: "qa"
  },
  {
    id: "quick-actions",
    question: "What are the quick action buttons?",
    answer: "Quick action buttons appear below the Q&A box and change based on your Intent Mode. They offer one-click prompts like 'Summarize', 'Key Points', 'Compare', or 'Create Quiz' to help you get answers faster without typing.",
    keywords: ["quick", "action", "button", "summarize", "key points", "compare", "quiz", "prompt"],
    category: "qa"
  },
  {
    id: "conversation-flow",
    question: "How do conversations work?",
    answer: "Your Q&A sessions are saved as conversations. Each conversation remembers context, so follow-up questions work naturally. View past conversations in the Bookmarks panel. Start fresh by clicking 'New Conversation'.",
    keywords: ["conversation", "flow", "context", "follow-up", "history", "session"],
    category: "qa"
  },
  {
    id: "study-streak",
    question: "What is a study streak?",
    answer: "Your study streak shows how many consecutive days you've used the timer. Keep your streak alive by studying at least a little each day. It's a great way to build consistent study habits!",
    keywords: ["streak", "consecutive", "days", "habit", "consistent", "daily"],
    category: "timer"
  },
  {
    id: "timer-reset",
    question: "Does the timer reset?",
    answer: "Daily study time resets at midnight. Weekly totals reset on Monday. Your achievements and streak are preserved as long as you maintain daily activity.",
    keywords: ["reset", "midnight", "weekly", "daily", "timer"],
    category: "timer"
  },
  {
    id: "upload-processing",
    question: "How long does file processing take?",
    answer: "Most files process in seconds. Large PDFs (50+ pages) or audio/video files may take 1-2 minutes. You'll see a progress indicator while processing. Once complete, the file is ready for Q&A.",
    keywords: ["processing", "time", "slow", "loading", "progress", "wait"],
    category: "documents"
  },
  {
    id: "enterprise-docs",
    question: "What are Enterprise Documents?",
    answer: "Enterprise Documents is a dedicated tab for larger files (up to 200MB) with enhanced processing. It's designed for organizations needing to handle extensive documentation. Requires Enterprise entitlement.",
    keywords: ["enterprise", "large", "200mb", "organization", "business"],
    category: "documents"
  },
  {
    id: "keyboard-shortcuts",
    question: "Are there keyboard shortcuts?",
    answer: "Yes! Press Ctrl+K (or Cmd+K on Mac) to focus the search/Q&A box. Press Escape to close dialogs. Press Enter to submit questions.",
    keywords: ["keyboard", "shortcut", "ctrl", "cmd", "hotkey", "quick"],
    category: "general"
  },
  {
    id: "mobile-app",
    question: "Is there a mobile app?",
    answer: "Yes! Evident has an iOS app that syncs with your web account. Download it from the App Store. Your documents, learning history, and preferences sync across devices.",
    keywords: ["mobile", "app", "ios", "iphone", "ipad", "phone", "sync"],
    category: "general"
  },
  {
    id: "logout",
    question: "How do I sign out?",
    answer: "Click your profile picture in the top-right corner, then select 'Sign Out' from the menu. Your data remains saved and will be there when you sign back in.",
    keywords: ["logout", "sign out", "signout", "exit", "leave"],
    category: "settings"
  }
];

const categoryIcons: Record<string, React.ReactNode> = {
  documents: <FileText className="w-4 h-4" />,
  folders: <FolderOpen className="w-4 h-4" />,
  timer: <Clock className="w-4 h-4" />,
  learning: <Brain className="w-4 h-4" />,
  qa: <MessageCircle className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
  general: <Sparkles className="w-4 h-4" />
};

const categoryColors: Record<string, string> = {
  documents: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  folders: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  timer: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  learning: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  qa: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  settings: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  general: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300"
};

interface HelpSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpSearchDialog({ open, onOpenChange }: HelpSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<HelpItem | null>(null);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return helpContent;
    }
    
    const query = searchQuery.toLowerCase();
    return helpContent.filter(item => 
      item.question.toLowerCase().includes(query) ||
      item.answer.toLowerCase().includes(query) ||
      item.keywords.some(k => k.toLowerCase().includes(query))
    ).sort((a, b) => {
      const aExact = a.keywords.some(k => k.toLowerCase() === query);
      const bExact = b.keywords.some(k => k.toLowerCase() === query);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });
  }, [searchQuery]);

  const handleClose = () => {
    setSearchQuery("");
    setSelectedItem(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[95vw] md:w-full max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            How can I help?
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search for help... (e.g., 'upload', 'folders', 'timer')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
              data-testid="input-help-search"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-4 pb-4 min-h-0 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 140px)', height: '500px' }}>
          {selectedItem ? (
            <div className="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedItem(null)}
                className="h-7 px-2 text-xs"
              >
                ← Back to results
              </Button>
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${categoryColors[selectedItem.category]}`}>
                    {categoryIcons[selectedItem.category]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">{selectedItem.question}</h3>
                    <Badge variant="outline" className="mt-1 text-xs capitalize">
                      {selectedItem.category}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedItem.answer}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No results found for "{searchQuery}"</p>
                  <p className="text-xs mt-2">Try different keywords like "upload", "folders", or "timer"</p>
                  <div className="mt-4 p-3 rounded-lg bg-muted/50 text-left">
                    <p className="text-xs font-medium mb-1">Can't find what you need?</p>
                    <p className="text-xs text-muted-foreground">
                      Click your profile picture → <span className="font-medium">Feedback</span> to ask a question or request information. We're here to help!
                    </p>
                  </div>
                </div>
              ) : (
                filteredItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-start gap-3"
                    data-testid={`help-item-${item.id}`}
                  >
                    <div className={`p-1.5 rounded ${categoryColors[item.category]}`}>
                      {categoryIcons[item.category]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.question}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.answer.substring(0, 80)}...
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface FloatingHelpButtonProps {
  onClick: () => void;
}

export function FloatingHelpButton({ onClick }: FloatingHelpButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className="fixed bottom-20 right-6 z-[9999] h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 sm:bottom-6 md:h-10 md:w-10 md:bottom-4 md:right-4"
      data-testid="button-floating-help"
    >
      <HelpCircle className="w-6 h-6 md:w-5 md:h-5" />
    </Button>
  );
}
