import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  BookOpen, 
  FileCheck, 
  BarChart3, 
  Boxes, 
  Lightbulb, 
  Activity, 
  MessageSquare, 
  HelpCircle, 
  Eye, 
  Share2,
  GraduationCap,
  Minimize2,
  RotateCcw
} from "lucide-react";
import type { ViewPreferences } from "@/hooks/use-view-preferences";

interface CustomizeViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: ViewPreferences;
  onToggle: (key: keyof ViewPreferences) => void;
  onResetDefaults: () => void;
  onSetMinimal: () => void;
  onSetStudent: () => void;
}

interface SectionToggleProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onCheckedChange: () => void;
  testId: string;
}

function SectionToggle({ label, description, icon, checked, onCheckedChange, testId }: SectionToggleProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <Label className="text-sm font-medium cursor-pointer" onClick={onCheckedChange}>{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch 
        checked={checked} 
        onCheckedChange={onCheckedChange}
        data-testid={testId}
      />
    </div>
  );
}

export function CustomizeViewModal({ 
  open, 
  onOpenChange, 
  preferences, 
  onToggle,
  onResetDefaults,
  onSetMinimal,
  onSetStudent
}: CustomizeViewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Customize Your View
          </DialogTitle>
          <DialogDescription>
            Choose which sections to show on your workspace. Your preferences are saved automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSetStudent}
            className="gap-1.5"
            data-testid="button-preset-student"
          >
            <GraduationCap className="w-4 h-4" />
            Student Mode
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSetMinimal}
            className="gap-1.5"
            data-testid="button-preset-minimal"
          >
            <Minimize2 className="w-4 h-4" />
            Minimal
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onResetDefaults}
            className="gap-1.5"
            data-testid="button-preset-reset"
          >
            <RotateCcw className="w-4 h-4" />
            Show All
          </Button>
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Right Panel</p>
          
          <SectionToggle
            label="Research Mode Panel"
            description="Research topics with documents and external sources"
            icon={<Brain className="w-4 h-4 text-purple-500" />}
            checked={preferences.showLearningMode}
            onCheckedChange={() => onToggle("showLearningMode")}
            testId="toggle-learning-mode"
          />
          
          <SectionToggle
            label="Recent Learning"
            description="Your saved learning history"
            icon={<BookOpen className="w-4 h-4 text-blue-500" />}
            checked={preferences.showRecentLearning}
            onCheckedChange={() => onToggle("showRecentLearning")}
            testId="toggle-recent-learning"
          />
          
          <SectionToggle
            label="Obligations"
            description="Extracted obligations from documents"
            icon={<FileCheck className="w-4 h-4 text-amber-500" />}
            checked={preferences.showObligations}
            onCheckedChange={() => onToggle("showObligations")}
            testId="toggle-obligations"
          />
          
          <SectionToggle
            label="Usage Display"
            description="Your plan usage and limits"
            icon={<BarChart3 className="w-4 h-4 text-emerald-500" />}
            checked={preferences.showUsageDisplay}
            onCheckedChange={() => onToggle("showUsageDisplay")}
            testId="toggle-usage"
          />
          
          <SectionToggle
            label="Intelligence Packs"
            description="Specialized AI capabilities"
            icon={<Boxes className="w-4 h-4 text-indigo-500" />}
            checked={preferences.showIntelligencePacks}
            onCheckedChange={() => onToggle("showIntelligencePacks")}
            testId="toggle-intelligence-packs"
          />
          
          <SectionToggle
            label="AI Insights"
            description="Evident Insights panel"
            icon={<Lightbulb className="w-4 h-4 text-yellow-500" />}
            checked={preferences.showInsights}
            onCheckedChange={() => onToggle("showInsights")}
            testId="toggle-insights"
          />
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Left Sidebar</p>
          
          <SectionToggle
            label="Workspace Stats"
            description="Files, storage, and timer stats"
            icon={<Activity className="w-4 h-4 text-emerald-500" />}
            checked={preferences.showWorkspaceStats}
            onCheckedChange={() => onToggle("showWorkspaceStats")}
            testId="toggle-workspace-stats"
          />
          
          <SectionToggle
            label="Activity"
            description="Recent workspace activity"
            icon={<Activity className="w-4 h-4 text-blue-500" />}
            checked={preferences.showActivity}
            onCheckedChange={() => onToggle("showActivity")}
            testId="toggle-activity"
          />
          
          <SectionToggle
            label="Saved Threads"
            description="Bookmarked conversations"
            icon={<MessageSquare className="w-4 h-4 text-purple-500" />}
            checked={preferences.showBookmarks}
            onCheckedChange={() => onToggle("showBookmarks")}
            testId="toggle-bookmarks"
          />
          
          <SectionToggle
            label="Tips"
            description="Helpful tips and suggestions"
            icon={<HelpCircle className="w-4 h-4 text-cyan-500" />}
            checked={preferences.showTips}
            onCheckedChange={() => onToggle("showTips")}
            testId="toggle-tips"
          />
          
          <SectionToggle
            label="Workspace Insights"
            description="AI-powered workspace insights"
            icon={<Eye className="w-4 h-4 text-pink-500" />}
            checked={preferences.showWorkspaceInsights}
            onCheckedChange={() => onToggle("showWorkspaceInsights")}
            testId="toggle-workspace-insights"
          />
          
          <SectionToggle
            label="Share Buttons"
            description="Social sharing options"
            icon={<Share2 className="w-4 h-4 text-green-500" />}
            checked={preferences.showShare}
            onCheckedChange={() => onToggle("showShare")}
            testId="toggle-share"
          />
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Other</p>
          
          <SectionToggle
            label="Help Button"
            description="Floating help button for quick assistance"
            icon={<HelpCircle className="w-4 h-4 text-primary" />}
            checked={preferences.showHelpButton}
            onCheckedChange={() => onToggle("showHelpButton")}
            testId="toggle-help-button"
          />
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} data-testid="button-close-customize">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
