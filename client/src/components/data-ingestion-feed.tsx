import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Database,
  ChevronDown,
  ChevronRight,
  FileText,
  FileSpreadsheet,
  Image,
  CheckCircle2,
  Loader2,
  Clock,
  Building2,
  Plug,
  Filter,
  ArrowDownToLine,
  Zap,
  Lock,
  ShieldCheck,
  RefreshCw,
  Circle,
  Mail,
  ArrowLeft,
  X,
  Cloud,
} from "lucide-react";
import { SiGoogledrive, SiConfluence, SiSalesforce, SiDropbox, SiIcloud, SiBox } from "react-icons/si";

interface MockDoc {
  id: string;
  name: string;
  department: string;
  departmentColor: string;
  source: string;
  status: "ready" | "processing" | "queued";
  timestamp: string;
  type: "pdf" | "spreadsheet" | "image" | "doc";
  size: string;
}

const MOCK_DOCS: MockDoc[] = [
  { id: "ig-1", name: "Purchase Order PO-2026-4412.pdf", department: "Procurement", departmentColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", source: "SAP S/4HANA", status: "ready", timestamp: "1h ago", type: "pdf", size: "1.8 MB" },
  { id: "ig-2", name: "Customer Contracts Q1 Batch.pdf", department: "Legal", departmentColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", source: "Microsoft SharePoint", status: "processing", timestamp: "45m ago", type: "pdf", size: "8.1 MB" },
  { id: "ig-3", name: "Sales Pipeline Report Mar-26.xlsx", department: "Sales", departmentColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", source: "Salesforce CRM", status: "ready", timestamp: "2h ago", type: "spreadsheet", size: "3.4 MB" },
  { id: "ig-4", name: "Employee Onboarding Policy v4.pdf", department: "HR", departmentColor: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20", source: "Workday", status: "ready", timestamp: "3h ago", type: "doc", size: "1.2 MB" },
  { id: "ig-5", name: "Invoice Batch INV-2026-03.pdf", department: "Finance", departmentColor: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20", source: "Oracle NetSuite", status: "queued", timestamp: "4h ago", type: "pdf", size: "5.6 MB" },
  { id: "ig-6", name: "Vendor Risk Assessment 2026.pdf", department: "Compliance", departmentColor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", source: "ServiceNow GRC", status: "ready", timestamp: "Yesterday", type: "pdf", size: "2.9 MB" },
  { id: "ig-7", name: "Technical Architecture Spec.pdf", department: "Engineering", departmentColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20", source: "Atlassian Confluence", status: "ready", timestamp: "Yesterday", type: "pdf", size: "1.8 MB" },
  { id: "ig-8", name: "Board Meeting Minutes Mar-26.pdf", department: "Executive", departmentColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", source: "Google Workspace", status: "ready", timestamp: "2 days ago", type: "doc", size: "0.9 MB" },
  { id: "ig-9", name: "Marketing Campaign Results.xlsx", department: "Marketing", departmentColor: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20", source: "HubSpot", status: "ready", timestamp: "2 days ago", type: "spreadsheet", size: "2.1 MB" },
  { id: "ig-10", name: "Signed NDA - Acme Corp.pdf", department: "Legal", departmentColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", source: "DocuSign", status: "ready", timestamp: "3 days ago", type: "pdf", size: "0.4 MB" },
];

interface DemoSource {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: "connected" | "not_connected" | "coming_soon";
  docsSynced?: number;
  lastSync?: string;
}

const DEMO_SOURCES: DemoSource[] = [
  { id: "sharepoint", name: "SharePoint", icon: <ShieldCheck className="w-4 h-4 text-[#036C70]" />, status: "connected", docsSynced: 142, lastSync: "12 min ago" },
  { id: "google-drive", name: "Google Drive", icon: <SiGoogledrive className="w-4 h-4 text-[#4285F4]" />, status: "connected", docsSynced: 87, lastSync: "1h ago" },
  { id: "confluence", name: "Confluence", icon: <SiConfluence className="w-4 h-4 text-[#1868DB]" />, status: "not_connected" },
  { id: "crm", name: "CRM", icon: <SiSalesforce className="w-4 h-4 text-[#00A1E0]" />, status: "coming_soon" },
];

const PERSONAL_SOURCES: DemoSource[] = [
  { id: "google-drive-personal", name: "Google Drive", icon: <SiGoogledrive className="w-4 h-4 text-[#0F9D58]" />, status: "coming_soon" },
  { id: "onedrive-personal", name: "OneDrive", icon: <Cloud className="w-4 h-4 text-[#0078D4]" />, status: "coming_soon" },
  { id: "dropbox-personal", name: "Dropbox", icon: <SiDropbox className="w-4 h-4 text-[#0061FF]" />, status: "coming_soon" },
  { id: "icloud-personal", name: "iCloud Drive", icon: <SiIcloud className="w-4 h-4 text-[#3693F3]" />, status: "coming_soon" },
  { id: "box-personal", name: "Box", icon: <SiBox className="w-4 h-4 text-[#0061D5]" />, status: "coming_soon" },
  { id: "evident-mailbox", name: "Evident Mailbox", icon: <Mail className="w-4 h-4 text-[#EA4335]" />, status: "coming_soon" },
];

const TIME_FILTERS = ["Today", "Yesterday", "This Week", "All"] as const;

function getFileIcon(type: MockDoc["type"]) {
  switch (type) {
    case "pdf": return <FileText className="w-3.5 h-3.5 text-red-500" />;
    case "spreadsheet": return <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />;
    case "image": return <Image className="w-3.5 h-3.5 text-blue-500" />;
    case "doc": return <FileText className="w-3.5 h-3.5 text-blue-600" />;
  }
}

function getStatusBadge(status: MockDoc["status"]) {
  switch (status) {
    case "ready":
      return (
        <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 gap-1 text-[10px] px-1.5 py-0">
          <CheckCircle2 className="w-2.5 h-2.5" />Ready
        </Badge>
      );
    case "processing":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1 text-[10px] px-1.5 py-0">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />Processing
        </Badge>
      );
    case "queued":
      return (
        <Badge variant="outline" className="text-muted-foreground gap-1 text-[10px] px-1.5 py-0">
          <Clock className="w-2.5 h-2.5" />Queued
        </Badge>
      );
  }
}

function SourceCard({ source }: { source: DemoSource }) {
  const [expanded, setExpanded] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  const handleResync = (e: React.MouseEvent) => {
    e.stopPropagation();
    setResyncing(true);
    setTimeout(() => setResyncing(false), 2000);
  };

  const isConnected = source.status === "connected";
  const isComingSoon = source.status === "coming_soon";

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isConnected ? "bg-card hover:bg-accent/30 cursor-pointer" : "bg-muted/30"
      }`}
      data-testid={`source-card-${source.id}`}
    >
      <button
        className="flex items-center gap-2.5 w-full text-left p-2.5"
        onClick={() => isConnected && setExpanded(!expanded)}
        disabled={!isConnected}
        data-testid={`button-toggle-source-${source.id}`}
      >
        <div className="shrink-0">{source.icon}</div>
        <span className="text-sm font-medium flex-1">{source.name}</span>
        {isConnected && (
          <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-medium">
            <Circle className="w-2 h-2 fill-green-500 text-green-500" />
            Connected
          </span>
        )}
        {source.status === "not_connected" && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
            <Circle className="w-2 h-2 text-muted-foreground" />
            Not connected
          </span>
        )}
        {isComingSoon && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
            Coming soon
          </Badge>
        )}
        {isConnected && (
          expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && isConnected && (
        <div className="px-2.5 pb-2.5 pt-0 border-t mx-2.5 mt-0 pt-2">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="w-3 h-3" />
                <span><span className="font-medium text-foreground">{source.docsSynced}</span> documents synced</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Last sync: <span className="font-medium text-foreground">{source.lastSync}</span></span>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-2.5 gap-1"
              onClick={handleResync}
              disabled={resyncing}
              data-testid={`button-resync-${source.id}`}
            >
              <RefreshCw className={`w-3 h-3 ${resyncing ? "animate-spin" : ""}`} />
              {resyncing ? "Syncing..." : "Resync"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DocGroup({ title, docs, selectedIds, onToggle, defaultOpen = true }: { title: string; docs: MockDoc[]; selectedIds: Set<string>; onToggle: (id: string) => void; defaultOpen?: boolean }) {
  const [groupOpen, setGroupOpen] = useState(defaultOpen);
  if (docs.length === 0) return null;
  const selectedInGroup = docs.filter(d => selectedIds.has(d.id)).length;
  return (
    <Collapsible open={groupOpen} onOpenChange={setGroupOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full text-left py-1 px-0.5 hover:bg-accent/30 rounded transition-colors">
          {groupOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
          <div className="flex-1 h-px bg-border" />
          {selectedInGroup > 0 && (
            <span className="text-[9px] text-primary font-medium">{selectedInGroup} sel</span>
          )}
          <span className="text-[10px] text-muted-foreground">{docs.length}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 mt-1">
          {docs.map(doc => {
            const isSelected = selectedIds.has(doc.id);
            const isReady = doc.status === "ready";
            return (
              <div
                key={doc.id}
                className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${
                  isSelected
                    ? "border-primary/40 bg-primary/5"
                    : "bg-card/50 hover:bg-accent/30"
                } ${!isReady ? "opacity-60" : "cursor-pointer"}`}
                onClick={() => isReady && onToggle(doc.id)}
                data-testid={`ingestion-doc-${doc.id}`}
              >
                <Checkbox
                  checked={isSelected}
                  disabled={!isReady}
                  onCheckedChange={() => isReady && onToggle(doc.id)}
                  className="shrink-0"
                  data-testid={`checkbox-ingestion-${doc.id}`}
                />
                <div className="shrink-0">{getFileIcon(doc.type)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{doc.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <Badge className={`${doc.departmentColor} text-[9px] px-1 py-0 border`}>
                      {doc.department}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <Plug className="w-2.5 h-2.5" />{doc.source}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{doc.size}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  {getStatusBadge(doc.status)}
                  <span className="text-[9px] text-muted-foreground">{doc.timestamp}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DataIngestionFeed() {
  const [isOpen, setIsOpen] = useState(() => window.innerWidth < 1024);
  const [activeFilter, setActiveFilter] = useState<typeof TIME_FILTERS[number]>("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const readyDocs = MOCK_DOCS.filter(d => d.status === "ready");
  const todayDocs = MOCK_DOCS.filter(d => d.timestamp.includes("ago"));
  const yesterdayDocs = MOCK_DOCS.filter(d => d.timestamp === "Yesterday");
  const earlierDocs = MOCK_DOCS.filter(d => !d.timestamp.includes("ago") && d.timestamp !== "Yesterday");

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === readyDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(readyDocs.map(d => d.id)));
    }
  };

  const allSelected = readyDocs.length > 0 && selectedIds.size === readyDocs.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={`flex items-center gap-2 w-full text-left p-3 rounded-lg border transition-colors ${isOpen ? 'bg-blue-200 dark:bg-blue-800/50 border-blue-400 dark:border-blue-600 hover:bg-blue-300 dark:hover:bg-blue-800/60' : 'bg-blue-200/80 dark:bg-blue-800/40 border-blue-400 dark:border-blue-600 hover:bg-blue-300/80 dark:hover:bg-blue-800/50'}`}
          data-testid="button-toggle-external-integration"
        >
          <Database className="w-4 h-4 text-blue-700 dark:text-blue-300 shrink-0" />
          <span className="text-sm font-semibold flex-1 text-blue-900 dark:text-blue-100">Org Connectors</span>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0 gap-1">
            <Zap className="w-2.5 h-2.5" />
            Demo
          </Badge>
          {selectedIds.size > 0 && (
            <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
              {selectedIds.size} selected
            </Badge>
          )}
          <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0">
            {MOCK_DOCS.length}
          </Badge>
          {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border border-t-0 rounded-b-lg p-3 space-y-3">
          <div className="space-y-1.5" data-testid="section-demo-sources">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">Integrations</p>
            <div className="space-y-1.5">
              {DEMO_SOURCES.map(source => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="flex items-center gap-1.5 flex-wrap" data-testid="ingestion-time-filters">
            {TIME_FILTERS.map(filter => (
              <Button
                key={filter}
                size="sm"
                variant={activeFilter === filter ? "default" : "outline"}
                className="h-6 text-[11px] px-2.5 opacity-60 cursor-default"
                data-testid={`filter-${filter.toLowerCase().replace(" ", "-")}`}
              >
                {filter}
              </Button>
            ))}
            <div className="ml-auto">
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2 gap-1 opacity-60 cursor-default"
              >
                <Filter className="w-3 h-3" />
                Department
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1" data-testid="ingestion-select-all">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              data-testid="checkbox-ingestion-select-all"
            />
            <button
              onClick={handleSelectAll}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {allSelected ? "Deselect All" : `Select All Ready (${readyDocs.length})`}
            </button>
            {selectedIds.size > 0 && (
              <span className="text-[10px] text-primary font-medium ml-auto">
                {selectedIds.size} of {MOCK_DOCS.length} selected
              </span>
            )}
          </div>

          <div className="space-y-2">
            <DocGroup title="Today" docs={todayDocs} selectedIds={selectedIds} onToggle={handleToggle} defaultOpen={true} />
            <DocGroup title="Yesterday" docs={yesterdayDocs} selectedIds={selectedIds} onToggle={handleToggle} defaultOpen={true} />
            <DocGroup title="Earlier" docs={earlierDocs} selectedIds={selectedIds} onToggle={handleToggle} defaultOpen={false} />
          </div>

          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-2.5 flex items-start gap-2" data-testid="ingestion-privacy-note">
            <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-green-700 dark:text-green-300 leading-relaxed">
              Only metadata is indexed — your original documents stay intact at the source without any changes. Evident never modifies, moves, or deletes your files.
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3" data-testid="ingestion-coming-soon-note">
            <div className="flex items-start gap-2.5">
              <ArrowDownToLine className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium">Automated Document Ingestion</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Connect your enterprise systems via the Evident API to automatically ingest documents. Supported sources include SAP, Salesforce, SharePoint, Oracle NetSuite, Workday, ServiceNow, Google Workspace, Confluence, HubSpot, DocuSign, and more.
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                    <Lock className="w-2.5 h-2.5" />API Keys Required
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                    <Building2 className="w-2.5 h-2.5" />Enterprise Feature
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PersonalIntegrationsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onOpen}
      className="w-full text-xs h-7 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 border-emerald-600 dark:border-emerald-600 shadow-sm font-semibold"
      data-testid="button-open-my-sources"
    >
      <Plug className="w-3 h-3" />
      My Sources
    </Button>
  );
}

export function PersonalIntegrationsContent() {
  return (
    <div className="space-y-3 p-2">
      <div className="space-y-2">
        {PERSONAL_SOURCES.map(source => (
          <SourceCard key={source.id} source={source} />
        ))}
      </div>
      <div className="rounded-lg border border-dashed border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-900/20 p-3" data-testid="personal-integration-info-inline">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Connect your personal cloud storage or use your unique Evident Mailbox to forward emails — they'll be processed and searchable just like uploaded documents.
        </p>
      </div>
    </div>
  );
}

export function PersonalIntegrationsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
          onClick={onClose}
          data-testid="overlay-my-sources"
        />
      )}
      <div
        className={`fixed inset-y-0 right-0 z-50 bg-background flex flex-col transition-transform duration-300 ease-in-out w-full lg:w-[600px] lg:border-l lg:shadow-2xl ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ overscrollBehavior: 'contain' }}
        data-testid="panel-my-sources"
      >
        <div className="px-4 py-3 border-b" style={{ flexShrink: 0, paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-sm font-medium -ml-2" onClick={onClose} data-testid="button-close-my-sources">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Plug className="w-4 h-4 text-emerald-600" />
              <h3 className="text-base font-semibold">My Sources</h3>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} data-testid="button-close-my-sources-x">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="overflow-y-auto p-4 flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="max-w-lg mx-auto space-y-4">
            <div className="text-center space-y-1 mb-6">
              <h4 className="text-lg font-semibold text-foreground">Connect Your Personal Sources</h4>
              <p className="text-sm text-muted-foreground">Link your cloud storage or email to make your files searchable and ready for AI-powered insights.</p>
            </div>
            <div className="space-y-2">
              {PERSONAL_SOURCES.map(source => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
            <div className="rounded-lg border border-dashed border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-900/20 p-4" data-testid="personal-integration-info">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connect your personal cloud storage — Google Drive, OneDrive, Dropbox, iCloud Drive, or Box — to browse and select files directly. Or use your unique Evident Mailbox to forward emails — they'll be processed and searchable just like uploaded documents.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
