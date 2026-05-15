import { useState } from "react";
import { ArrowLeft, MessageCircle, Camera, FolderOpen, BarChart3, User, Mic, Send, FileText, Sparkles, List, GitCompare, ChevronRight, Plus, Settings, HelpCircle, LogOut, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Screen = "home" | "ask" | "workspace" | "readiness" | "menu";

export default function MobilePreview() {
  const [activeScreen, setActiveScreen] = useState<Screen>("home");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto bg-background min-h-screen relative pb-20">
        {activeScreen === "home" && <HomeScreen onNavigate={setActiveScreen} />}
        {activeScreen === "ask" && <AskScreen onBack={() => setActiveScreen("home")} />}
        {activeScreen === "workspace" && <WorkspaceScreen onBack={() => setActiveScreen("home")} />}
        {activeScreen === "readiness" && <ReadinessScreen onBack={() => setActiveScreen("home")} />}
        {activeScreen === "menu" && <MenuScreen onBack={() => setActiveScreen("home")} />}
        
        <BottomNavPreview active={activeScreen} onNavigate={setActiveScreen} />
      </div>
    </div>
  );
}

function HomeScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="p-6 space-y-6">
      <div className="text-center pt-8 pb-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          Evident
        </h1>
        <p className="text-muted-foreground mt-2">Your AI-powered assistant</p>
      </div>

      <button
        onClick={() => onNavigate("ask")}
        className="w-full p-6 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-xl shadow-fuchsia-500/30 active:scale-[0.98] transition-transform"
        data-testid="button-ask-anything"
      >
        <div className="flex items-center justify-center gap-3">
          <MessageCircle className="w-8 h-8" />
          <span className="text-xl font-semibold">Ask Anything</span>
        </div>
      </button>

      <button
        className="w-full p-5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white shadow-xl shadow-orange-500/30 active:scale-[0.98] transition-transform"
        data-testid="button-scan-document"
      >
        <div className="flex items-center justify-center gap-3">
          <Camera className="w-7 h-7" />
          <span className="text-lg font-semibold">Scan Document</span>
        </div>
      </button>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Recent Documents</h2>
        
        <div className="space-y-3">
          <DocumentCard 
            title="Company Policy 2024"
            color="from-fuchsia-500 to-pink-500"
            pages={12}
          />
          <DocumentCard 
            title="Training Manual"
            color="from-cyan-400 to-blue-500"
            pages={45}
          />
          <DocumentCard 
            title="Safety Guidelines"
            color="from-lime-400 to-emerald-500"
            pages={8}
          />
        </div>
      </div>
    </div>
  );
}

function DocumentCard({ title, color, pages }: { title: string; color: string; pages: number }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border active:bg-muted/50 transition-colors">
      <div className={cn("w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center", color)}>
        <FileText className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{title}</p>
        <p className="text-sm text-muted-foreground">{pages} pages</p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </div>
  );
}

function AskScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="p-6 space-y-6">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground active:text-foreground"
        data-testid="button-back"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back</span>
      </button>

      <div className="pt-4">
        <h1 className="text-2xl font-bold text-foreground">What would you like to know?</h1>
      </div>

      <div className="relative">
        <textarea
          placeholder="Type your question..."
          className="w-full h-32 p-4 text-lg rounded-2xl border-2 border-border bg-background resize-none focus:border-blue-500 focus:outline-none"
          data-testid="input-question"
        />
      </div>

      <div className="flex justify-center gap-6">
        <button className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform" data-testid="button-mic">
          <Mic className="w-7 h-7" />
        </button>
        <button className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform" data-testid="button-camera">
          <Camera className="w-7 h-7" />
        </button>
        <button className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform" data-testid="button-send">
          <Send className="w-7 h-7" />
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          <QuickChip icon={Sparkles} label="Summarize" color="from-purple-500 to-pink-500" />
          <QuickChip icon={List} label="Explain" color="from-blue-500 to-cyan-500" />
          <QuickChip icon={GitCompare} label="Compare" color="from-orange-500 to-red-500" />
          <QuickChip icon={FileText} label="Extract" color="from-green-500 to-cyan-500" />
        </div>
      </div>
    </div>
  );
}

function QuickChip({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <button className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium shadow active:scale-95 transition-transform bg-gradient-to-r",
      color
    )} data-testid={`chip-${label.toLowerCase()}`}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function WorkspaceScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Workspace</h1>
        <button className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform" data-testid="button-new-folder">
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-4">
        <FolderCard 
          name="Recent"
          count={12}
          color="from-purple-500 to-pink-500"
        />
        <FolderCard 
          name="Work"
          count={8}
          color="from-blue-500 to-cyan-500"
        />
        <FolderCard 
          name="Personal"
          count={5}
          color="from-green-500 to-emerald-500"
        />
        <FolderCard 
          name="Archived"
          count={23}
          color="from-gray-400 to-gray-500"
        />
      </div>
    </div>
  );
}

function FolderCard({ name, count, color }: { name: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border active:bg-muted/50 transition-colors" data-testid={`folder-${name.toLowerCase()}`}>
      <div className={cn("w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center", color)}>
        <FolderOpen className="w-7 h-7 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-lg font-semibold text-foreground">{name}</p>
        <p className="text-sm text-muted-foreground">{count} documents</p>
      </div>
      <ChevronRight className="w-6 h-6 text-muted-foreground" />
    </div>
  );
}

function ReadinessScreen({ onBack }: { onBack: () => void }) {
  const score = 78;
  
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">AI Readiness</h1>

      <div className="flex flex-col items-center py-8">
        <div className="relative w-48 h-48">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              className="text-muted"
            />
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="url(#gradient)"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 553} 553`}
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold text-foreground">{score}%</span>
            <span className="text-sm text-muted-foreground">Ready</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Next Steps</h2>
        
        <div className="space-y-2">
          <ChecklistItem done label="Upload company policies" />
          <ChecklistItem done label="Add training materials" />
          <ChecklistItem label="Review 3 more documents" />
          <ChecklistItem label="Complete AI safety check" />
        </div>
      </div>

      <button
        className="w-full p-5 rounded-2xl bg-gradient-to-r from-orange-400 to-yellow-400 text-white shadow-lg active:scale-[0.98] transition-transform"
        data-testid="button-scan-new"
      >
        <div className="flex items-center justify-center gap-3">
          <Camera className="w-6 h-6" />
          <span className="text-lg font-semibold">Scan New Document</span>
        </div>
      </button>
    </div>
  );
}

function ChecklistItem({ done, label }: { done?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
      <div className={cn(
        "w-6 h-6 rounded-full border-2 flex items-center justify-center",
        done ? "bg-green-500 border-green-500" : "border-muted-foreground"
      )}>
        {done && <span className="text-white text-sm">✓</span>}
      </div>
      <span className={cn(
        "text-base",
        done ? "text-muted-foreground line-through" : "text-foreground"
      )}>{label}</span>
    </div>
  );
}

function MenuScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col items-center pt-8 pb-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
          JD
        </div>
        <h1 className="text-2xl font-bold text-foreground mt-4">Hi, John!</h1>
        <p className="text-muted-foreground">john@example.com</p>
      </div>

      <div className="space-y-2">
        <MenuItem icon={User} label="Profile" color="text-blue-500" />
        <MenuItem icon={Settings} label="Settings" color="text-gray-500" />
        <MenuItem icon={Crown} label="Upgrade to Pro" color="text-purple-500" highlight />
        <MenuItem icon={HelpCircle} label="Help & Support" color="text-green-500" />
        <MenuItem icon={LogOut} label="Sign Out" color="text-red-500" />
      </div>

      <div className="text-center pt-8">
        <p className="text-sm text-muted-foreground">Evident v1.0</p>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, color, highlight }: { icon: any; label: string; color: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-xl active:bg-muted/50 transition-colors",
      highlight && "bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20"
    )} data-testid={`menu-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <Icon className={cn("w-6 h-6", color)} />
      <span className="text-lg font-medium text-foreground">{label}</span>
      <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
    </div>
  );
}

function BottomNavPreview({ active, onNavigate }: { active: Screen; onNavigate: (screen: Screen) => void }) {
  const items = [
    { id: "home" as Screen, icon: MessageCircle, label: "Home", color: "from-blue-500 to-purple-500" },
    { id: "workspace" as Screen, icon: FolderOpen, label: "Workspace", color: "from-purple-500 to-pink-500" },
    { id: "readiness" as Screen, icon: BarChart3, label: "Readiness", color: "from-green-500 to-cyan-500" },
    { id: "menu" as Screen, icon: User, label: "Menu", color: "from-orange-500 to-yellow-500" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="flex flex-col items-center justify-center gap-1 w-20 h-14 rounded-lg transition-all"
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <div className={cn(
              "p-2 rounded-xl transition-all",
              active === item.id && `bg-gradient-to-r ${item.color}`
            )}>
              <item.icon className={cn(
                "w-5 h-5",
                active === item.id ? "text-white" : "text-muted-foreground"
              )} />
            </div>
            <span className={cn(
              "text-xs font-medium",
              active === item.id ? "text-foreground" : "text-muted-foreground"
            )}>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
