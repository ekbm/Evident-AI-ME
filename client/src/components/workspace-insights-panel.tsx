import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { 
  Newspaper,
  ExternalLink,
  Brain,
  TrendingUp,
  Shield,
  Zap,
  FileSearch,
  BarChart3,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { usePanelState } from "@/hooks/use-panel-state";

interface Insight {
  icon: typeof Brain;
  title: string;
  fact: string;
  source: string;
  color: string;
}

const AI_INSIGHTS: Insight[] = [
  {
    icon: Brain,
    title: "AI Document Processing",
    fact: "AI can reduce document processing time by up to 80%, enabling faster decision-making.",
    source: "McKinsey",
    color: "text-purple-500",
  },
  {
    icon: FileSearch,
    title: "Intelligent Search",
    fact: "Organizations using AI search find information 50% faster than traditional keyword search.",
    source: "Gartner",
    color: "text-blue-500",
  },
  {
    icon: TrendingUp,
    title: "Productivity Gains",
    fact: "Knowledge workers spend 20% of their time searching for information. AI reduces this by 75%.",
    source: "IDC Research",
    color: "text-green-500",
  },
  {
    icon: Shield,
    title: "Data Accuracy",
    fact: "AI-powered document analysis achieves 95%+ accuracy in data extraction tasks.",
    source: "Forrester",
    color: "text-cyan-500",
  },
  {
    icon: Zap,
    title: "Cost Efficiency",
    fact: "Automated document processing can reduce operational costs by 30-50%.",
    source: "Deloitte",
    color: "text-amber-500",
  },
  {
    icon: BarChart3,
    title: "Enterprise Adoption",
    fact: "85% of enterprises are expected to use AI for document processing by 2025.",
    source: "PwC",
    color: "text-pink-500",
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

export function WorkspaceInsightsPanel() {
  const { isExpanded, toggle } = usePanelState("workspace-insights");
  const [shuffledInsights, setShuffledInsights] = useState<Insight[]>([]);
  const [currentInsight, setCurrentInsight] = useState(0);

  useEffect(() => {
    setShuffledInsights(shuffleArray(AI_INSIGHTS));
  }, []);

  useEffect(() => {
    if (shuffledInsights.length === 0) return;
    const interval = setInterval(() => {
      setCurrentInsight((prev) => (prev + 1) % shuffledInsights.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [shuffledInsights]);

  if (shuffledInsights.length === 0) {
    return null;
  }

  const insight = shuffledInsights[currentInsight];
  const Icon = insight.icon;

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 border-slate-700" data-testid="workspace-insights-panel">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-800/30 transition-colors rounded-t-lg"
        onClick={toggle}
      >
        <h3 className="font-semibold text-base flex items-center gap-2 text-white">
          <Newspaper className="w-4 h-4 text-blue-400" />
          AI Insights
        </h3>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </div>
      
      {isExpanded && (
      <div className="px-5 pb-5 space-y-4">
      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-slate-700/50 ${insight.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium mb-1 text-white">{insight.title}</p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {insight.fact}
            </p>
            <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
              <ExternalLink className="w-2.5 h-2.5" />
              Source: {insight.source}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-1">
        {AI_INSIGHTS.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentInsight(index)}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              index === currentInsight ? "bg-emerald-400" : "bg-slate-600"
            }`}
            data-testid={`insight-dot-${index}`}
          />
        ))}
      </div>
      </div>
      )}
    </Card>
  );
}
