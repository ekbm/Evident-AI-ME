import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  FolderOpen, Sparkles, Clock, Upload, Link2, FileText, 
  ChevronRight, AlertTriangle, Copy, Download, CheckCircle,
  ArrowLeft, Send, Loader2
} from "lucide-react";

type Tab = "knowledge" | "ask" | "activity";

interface Document {
  id: string;
  title: string;
  subtitle: string;
  date: string;
}

interface ActivityItem {
  id: string;
  question: string;
  answerPreview: string;
  date: string;
  isToday: boolean;
}

export default function MobileAppPreview() {
  const [activeTab, setActiveTab] = useState<Tab>("ask");
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

  const renderContent = () => {
    if (selectedDoc) {
      return <DocumentDetail doc={selectedDoc} onBack={() => setSelectedDoc(null)} />;
    }
    if (selectedActivity) {
      return <ActivityDetail item={selectedActivity} onBack={() => setSelectedActivity(null)} />;
    }

    switch (activeTab) {
      case "knowledge":
        return <KnowledgeTab onSelectDoc={setSelectedDoc} />;
      case "ask":
        return <AskTab />;
      case "activity":
        return <ActivityTab onSelectItem={setSelectedActivity} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto border-x border-border">
      <div className="flex-1 overflow-y-auto pb-20">
        {renderContent()}
      </div>

      {!selectedDoc && !selectedActivity && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-background border-t border-border">
          <div className="flex items-center justify-around h-16" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            <TabButton 
              icon={FolderOpen} 
              label="Knowledge" 
              isActive={activeTab === "knowledge"} 
              onClick={() => setActiveTab("knowledge")} 
            />
            <TabButton 
              icon={Sparkles} 
              label="Ask" 
              isActive={activeTab === "ask"} 
              onClick={() => setActiveTab("ask")} 
            />
            <TabButton 
              icon={Clock} 
              label="Activity" 
              isActive={activeTab === "activity"} 
              onClick={() => setActiveTab("activity")} 
            />
          </div>
        </nav>
      )}
    </div>
  );
}

function TabButton({ icon: Icon, label, isActive, onClick }: { 
  icon: React.ElementType; 
  label: string; 
  isActive: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 w-20 h-14 rounded-lg transition-colors",
        isActive ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="w-6 h-6" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function KnowledgeTab({ onSelectDoc }: { onSelectDoc: (doc: Document) => void }) {
  const { data: assets } = useQuery<any[]>({
    queryKey: ["/api/assets"],
  });

  const documents: Document[] = (assets || []).slice(0, 10).map((a: any) => ({
    id: a.id,
    title: a.filename,
    subtitle: a.status === "READY" ? "Processed" : a.status === "PROCESSING" ? "Processing..." : "Uploaded",
    date: a.createdAt,
  }));

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Knowledge</h1>

      <Card>
        <CardContent className="p-4 space-y-3">
          <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <Upload className="w-5 h-5 text-primary" />
            <span className="font-medium">Upload Files</span>
            <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
          </button>

          <button className="w-full flex items-center gap-3 p-3 rounded-lg opacity-50 cursor-not-allowed">
            <Link2 className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium text-muted-foreground">Connect Sources</span>
            <Badge variant="secondary" className="ml-auto text-xs">Soon</Badge>
          </button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground px-1">Recent Documents</h2>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {documents.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No documents yet. Upload some files to get started.
              </div>
            ) : (
              documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onSelectDoc(doc)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.title}</p>
                    <p className="text-sm text-muted-foreground">{doc.subtitle}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DocumentDetail({ doc, onBack }: { doc: Document; onBack: () => void }) {
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-bold">{doc.title}</h1>
        <p className="text-muted-foreground mt-1">Status: {doc.subtitle}</p>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <ActionChip icon={FileText} label="Summarise" />
          <ActionChip icon={AlertTriangle} label="Key Risks" />
          <ActionChip icon={Sparkles} label="Ask" />
        </div>
      </div>
    </div>
  );
}

function AskTab() {
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const suggestions = [
    "Summarise this document",
    "Find key risks",
    "Explain simply",
    "Generate a report"
  ];

  const handleAsk = () => {
    if (!question.trim()) return;
    setIsAsking(true);
    setTimeout(() => {
      setAnswer(`Here's a clear answer based on your uploaded documents.\n\nQuestion: "${question}"\n\nThis is where the AI response would appear with citations from your knowledge base.`);
      setIsAsking(false);
    }, 1500);
  };

  return (
    <div className="p-4 space-y-4">
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4 space-y-4">
          <h1 className="text-xl font-bold">Ask Evident</h1>
          
          <div className="relative">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about your documents..."
              className="pr-12 bg-background"
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            />
            <Button 
              size="icon" 
              className="absolute right-1 top-1 h-8 w-8"
              onClick={handleAsk}
              disabled={!question.trim() || isAsking}
            >
              {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Quick Suggestions</h2>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <Button 
              key={s} 
              variant="outline" 
              size="sm"
              onClick={() => setQuestion(s)}
              className="text-xs"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {answer && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <h2 className="font-semibold mb-2">Answer</h2>
              <p className="text-sm whitespace-pre-wrap">{answer}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Next Steps</h3>
              <div className="flex flex-wrap gap-2">
                <ActionChip icon={Copy} label="Copy" />
                <ActionChip icon={Download} label="Export PDF" />
                <ActionChip icon={CheckCircle} label="Check Readiness" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ActivityTab({ onSelectItem }: { onSelectItem: (item: ActivityItem) => void }) {
  const { data: history } = useQuery<any[]>({
    queryKey: ["/api/questions/history"],
  });

  const items: ActivityItem[] = (history || []).slice(0, 15).map((h: any, i: number) => ({
    id: h.id || String(i),
    question: h.question || "Question",
    answerPreview: h.answer?.substring(0, 100) || "Answer preview...",
    date: h.createdAt || new Date().toISOString(),
    isToday: new Date(h.createdAt).toDateString() === new Date().toDateString(),
  }));

  const todayItems = items.filter(i => i.isToday);
  const earlierItems = items.filter(i => !i.isToday);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Activity</h1>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground px-1">Today</h2>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {todayItems.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No activity today.
              </div>
            ) : (
              todayItems.map((item) => (
                <ActivityRow key={item.id} item={item} onClick={() => onSelectItem(item)} />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {earlierItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground px-1">Earlier</h2>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {earlierItems.map((item) => (
                <ActivityRow key={item.id} item={item} onClick={() => onSelectItem(item)} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {items.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No questions asked yet. Try asking something!
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ActivityRow({ item, onClick }: { item: ActivityItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium line-clamp-2">{item.question}</p>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.answerPreview}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function ActivityDetail({ item, onBack }: { item: ActivityItem; onBack: () => void }) {
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-1">Question</h2>
        <p className="font-medium">{item.question}</p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-1">Answer</h2>
        <p className="text-sm">{item.answerPreview}</p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <ActionChip icon={Copy} label="Copy" />
          <ActionChip icon={Download} label="Export" />
          <ActionChip icon={Sparkles} label="Follow-up" />
        </div>
      </div>
    </div>
  );
}

function ActionChip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <Button variant="outline" size="sm" className="gap-2">
      <Icon className="w-4 h-4" />
      {label}
    </Button>
  );
}
