import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { 
  Lightbulb, 
  TrendingUp,
  Target,
  Zap,
  BookOpen,
  Shield,
  Clock,
  Star,
  Sparkles,
  FileCheck,
  Search,
  MessageSquare,
  Wand2,
  Globe,
  GraduationCap,
  FileText,
  Briefcase,
  BarChart3,
  FolderOpen,
  Video,
  Mic,
  Settings,
  Users,
  Receipt,
  ClipboardList,
  Boxes,
  GitBranch,
  PenTool,
  Volume2,
  ImageIcon,
  Table,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { usePanelState } from "@/hooks/use-panel-state";
import { useMode } from "@/contexts/mode-context";

interface Tip {
  icon: typeof Lightbulb;
  title: string;
  description: string;
  color: string;
  studentOnly?: boolean;
  hideInStudentMode?: boolean;
}

const ALL_TIPS: Tip[] = [
  {
    icon: Target,
    title: "Ask Specific Questions",
    description: "Get better answers with detailed, focused questions about your documents",
    color: "text-purple-500",
  },
  {
    icon: Zap,
    title: "Cross-Reference Documents",
    description: "Select multiple documents to compare and find connections across sources",
    color: "text-amber-500",
  },
  {
    icon: MessageSquare,
    title: "Follow-up Questions",
    description: "Ask follow-ups to dive deeper - the AI remembers your conversation context",
    color: "text-orange-500",
  },
  {
    icon: Wand2,
    title: "Simplify Answers",
    description: "Tap 'Simplify' below any answer to get an easier-to-understand version",
    color: "text-cyan-500",
  },
  {
    icon: Globe,
    title: "External Insights",
    description: "Tap 'External Insights' to see what the web says about your topic",
    color: "text-blue-500",
  },
  {
    icon: PenTool,
    title: "Custom Prompts",
    description: "Use 'Custom Prompt' to reformat answers exactly how you need them",
    color: "text-violet-500",
  },
  {
    icon: Volume2,
    title: "Read Aloud",
    description: "Have any answer read aloud to you - great for learning on the go",
    color: "text-emerald-500",
  },
  {
    icon: GraduationCap,
    title: "Exam Prep & Grading",
    description: "Create practice questions and grade handwritten answers",
    color: "text-indigo-500",
    studentOnly: true,
  },
  {
    icon: ClipboardList,
    title: "Create Cheat Sheets",
    description: "Auto-generate comprehensive cheat sheets with key terms and formulas",
    color: "text-pink-500",
    studentOnly: true,
  },
  {
    icon: GitBranch,
    title: "Generate Diagrams",
    description: "Visualize document concepts with auto-generated Mermaid diagrams",
    color: "text-purple-500",
  },
  {
    icon: Target,
    title: "Study Fitness Tracker",
    description: "Track your study progress, weak topics, and exam readiness in one place",
    color: "text-violet-500",
    studentOnly: true,
  },
  {
    icon: Clock,
    title: "Study Cycles",
    description: "Start a new cycle for each exam. Your past performance is archived for reference",
    color: "text-cyan-500",
    studentOnly: true,
  },
  {
    icon: TrendingUp,
    title: "Track Weak Topics",
    description: "Study Fitness highlights your weakest topics so you know exactly what to revise",
    color: "text-rose-500",
    studentOnly: true,
  },
  {
    icon: BookOpen,
    title: "Study Journey",
    description: "Watch your documents move from Learn to Practice to Refine to Mastered",
    color: "text-emerald-500",
    studentOnly: true,
  },
  {
    icon: FileCheck,
    title: "Extract Obligations",
    description: "Pull out requirements, deadlines, and action items from contracts",
    color: "text-green-500",
    hideInStudentMode: true,
  },
  {
    icon: BarChart3,
    title: "Excel Reports",
    description: "Export extracted data to Excel spreadsheets for further analysis",
    color: "text-cyan-500",
    hideInStudentMode: true,
  },
  {
    icon: Table,
    title: "Table Extraction",
    description: "AI automatically extracts tables from PDFs and documents",
    color: "text-blue-500",
    hideInStudentMode: true,
  },
  {
    icon: Briefcase,
    title: "CV Interview Prep",
    description: "Upload your CV to generate likely interview questions and practice",
    color: "text-rose-500",
    hideInStudentMode: true,
  },
  {
    icon: FileText,
    title: "SOW Documents",
    description: "Generate professional Statement of Work documents from requirements",
    color: "text-amber-500",
    hideInStudentMode: true,
  },
  {
    icon: Sparkles,
    title: "Intelligence Packs",
    description: "Enable specialized AI for Finance, Legal, HR, or Engineering documents",
    color: "text-pink-500",
    hideInStudentMode: true,
  },
  {
    icon: Boxes,
    title: "Industry-Specific AI",
    description: "Each Intelligence Pack brings domain expertise to your questions",
    color: "text-violet-500",
    hideInStudentMode: true,
  },
  {
    icon: FolderOpen,
    title: "Organize Documents",
    description: "Create folders to keep your documents organized by project or topic",
    color: "text-yellow-500",
  },
  {
    icon: Search,
    title: "Deep Search",
    description: "AI searches across all your documents simultaneously for answers",
    color: "text-blue-500",
  },
  {
    icon: ImageIcon,
    title: "Image Analysis",
    description: "Upload images and ask questions about charts, diagrams, or photos",
    color: "text-orange-500",
  },
  {
    icon: Mic,
    title: "Voice Input",
    description: "Use the microphone to ask questions hands-free (Safari/Chrome)",
    color: "text-cyan-500",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your documents are encrypted and never shared with third parties",
    color: "text-cyan-500",
  },
  {
    icon: Settings,
    title: "Customize Experience",
    description: "Visit Settings to adjust theme, notifications, and preferences",
    color: "text-slate-400",
  },
  {
    icon: Users,
    title: "Enterprise Features",
    description: "Teams can collaborate with shared workspaces and admin controls",
    color: "text-indigo-500",
    hideInStudentMode: true,
  },
  {
    icon: MessageSquare,
    title: "Saved Threads",
    description: "Your conversations are saved automatically. Review any thread from the Threads tab",
    color: "text-cyan-500",
  },
  {
    icon: FolderOpen,
    title: "Mobile: Workspace Button",
    description: "On mobile, tap 'Workspace' at the top to access Threads, Bookmarks, and Stats",
    color: "text-cyan-500",
  },
  {
    icon: Star,
    title: "Bookmark Answers",
    description: "Save important insights for quick reference later",
    color: "text-yellow-500",
  },
  {
    icon: Receipt,
    title: "Usage Dashboard",
    description: "Track your questions, storage, and plan usage in the dashboard",
    color: "text-green-500",
    hideInStudentMode: true,
  },
  {
    icon: TrendingUp,
    title: "AI Readiness",
    description: "Use the AI Readiness Scanner to assess your document quality",
    color: "text-emerald-500",
    hideInStudentMode: true,
  },
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function WorkspaceTipsPanel() {
  const { isExpanded, toggle } = usePanelState("workspace-tips");
  const { mode: verticalMode } = useMode();
  const isStudentMode = verticalMode === "students" || verticalMode === "educators";

  const shuffledTips = useMemo(() => {
    const filtered = isStudentMode
      ? ALL_TIPS.filter(t => !t.hideInStudentMode)
      : ALL_TIPS.filter(t => !t.studentOnly);
    return shuffleArray(filtered);
  }, [isStudentMode]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    const startGroup = Math.floor(Math.random() * Math.ceil(ALL_TIPS.length / 3));
    return startGroup * 3;
  });

  // Auto-rotate tips every 8 seconds
  useEffect(() => {
    if (shuffledTips.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 3) % shuffledTips.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [shuffledTips.length]);

  const tips = useMemo((): Tip[] => {
    if (shuffledTips.length === 0) return [];
    const result: Tip[] = [];
    for (let i = 0; i < 3; i++) {
      result.push(shuffledTips[(currentIndex + i) % shuffledTips.length]);
    }
    return result;
  }, [shuffledTips, currentIndex]);

  const totalPages = Math.ceil(shuffledTips.length / 3);

  const currentPage = Math.floor(currentIndex / 3);

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 border-slate-700" data-testid="workspace-tips-panel">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-800/30 transition-colors rounded-t-lg"
        onClick={toggle}
      >
        <h3 className="font-semibold text-base flex items-center gap-2 text-white">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Discover Evident
        </h3>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </div>
      
      {isExpanded && (
      <div className="px-5 pb-5 space-y-4">
      <div className="space-y-3">
        {tips.map((tip, index) => (
          <div 
            key={`${currentIndex}-${index}`}
            className="flex items-start gap-3 p-2 rounded-lg bg-slate-800/50 animate-in fade-in duration-300"
            data-testid={`tip-${index}`}
          >
            <tip.icon className={`w-4 h-4 mt-0.5 ${tip.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white">{tip.title}</p>
              <p className="text-[11px] text-slate-400">{tip.description}</p>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5 pt-1">
          {Array.from({ length: Math.min(totalPages, 10) }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index * 3)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                index === currentPage ? "bg-amber-400" : "bg-slate-600 hover:bg-slate-500"
              }`}
              data-testid={`tip-dot-${index}`}
            />
          ))}
        </div>
      )}
      </div>
      )}
    </Card>
  );
}
