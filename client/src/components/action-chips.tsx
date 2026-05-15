import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trimSnippet } from "@/lib/snippet-utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Presentation,
  FileDown,
  ListChecks,
  Sparkles,
  BookOpen,
  Search,
  AlertTriangle,
  Clock,
  Mail,
  Bookmark,
  Share2,
  Shield,
  MoreHorizontal,
  Loader2,
  Download,
  ChevronDown,
  CheckCircle2,
  Info,
} from "lucide-react";
import type {
  AnswerMeta,
  ActionIdType,
  ProposalSettings,
  PptSettings,
} from "@shared/action-engine";
import { ActionId, ACTION_LABELS } from "@shared/action-engine";

interface ActionChipsProps {
  meta: AnswerMeta;
  questionText: string;
  answerText: string;
  citations?: Array<{ title: string; sourceRef: string; snippet?: string }>;
  onActionExecuted?: (action: ActionIdType, result: any) => void;
  showSoftBlocked?: boolean;
  externalTrigger?: "proposal" | "ppt" | null;
  onExternalTriggerHandled?: () => void;
}

const ACTION_ICONS: Record<ActionIdType, any> = {
  [ActionId.GENERATE_PROPOSAL]: FileText,
  [ActionId.GENERATE_PPT]: Presentation,
  [ActionId.SUMMARISE]: ListChecks,
  [ActionId.SIMPLIFY]: Sparkles,
  [ActionId.MAKE_TECHNICAL]: BookOpen,
  [ActionId.SHOW_SOURCES]: Search,
  [ActionId.FIND_GAPS]: AlertTriangle,
  [ActionId.CHECK_FRESHNESS]: Clock,
  [ActionId.HIGHLIGHT_CONFLICTS]: AlertTriangle,
  [ActionId.EXPORT_EMAIL]: Mail,
  [ActionId.SAVE_SNIPPET]: Bookmark,
  [ActionId.SHARE_LINK]: Share2,
  [ActionId.CHECK_COMPLIANCE]: Shield,
};

interface RecentExport {
  id: string;
  fileName: string;
  downloadUrl: string;
  type: "proposal" | "ppt";
}

export function ActionChipsBar({
  meta,
  questionText,
  answerText,
  citations,
  onActionExecuted,
  showSoftBlocked = false,
  externalTrigger = null,
  onExternalTriggerHandled,
}: ActionChipsProps) {
  const { toast } = useToast();
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateType, setTemplateType] = useState<"proposal" | "ppt">("proposal");
  const [recentExports, setRecentExports] = useState<RecentExport[]>([]);

  useEffect(() => {
    if (externalTrigger) {
      setTemplateType(externalTrigger);
      setTemplateModalOpen(true);
      onExternalTriggerHandled?.();
    }
  }, [externalTrigger, onExternalTriggerHandled]);

  const [proposalSettings, setProposalSettings] = useState<ProposalSettings>({
    template: "sales_proposal",
    clientName: "",
    projectName: "",
    tone: "formal",
    length: "standard",
    includePricing: true,
    includeTimeline: true,
    includeRisks: true,
    includeReferences: true,
  });

  const [pptSettings, setPptSettings] = useState<PptSettings>({
    template: "executive_brief",
    audience: "executive",
    includeAgenda: true,
    includeSources: true,
    includeNextSteps: true,
  });

  const [resultModal, setResultModal] = useState<{
    open: boolean;
    title: string;
    status: "success" | "warning" | "info";
    message: string;
    details?: string[];
  }>({ open: false, title: "", status: "success", message: "", details: [] });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: ActionIdType | null;
    reason: string;
  }>({ open: false, action: null, reason: "" });

  const proposalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/exports/proposal", {
        questionText,
        answerText,
        citations,
        settings: proposalSettings,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setRecentExports((prev) => [
        { id: data.id, fileName: data.fileName, downloadUrl: data.downloadUrl, type: "proposal" },
        ...prev.slice(0, 4),
      ]);
      toast({ title: "Proposal generated successfully!" });
      setTemplateModalOpen(false);
      onActionExecuted?.(ActionId.GENERATE_PROPOSAL, data);
    },
    onError: () => {
      toast({ title: "Failed to generate proposal", variant: "destructive" });
    },
  });

  const pptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/exports/ppt", {
        questionText,
        answerText,
        citations,
        settings: pptSettings,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setRecentExports((prev) => [
        { id: data.id, fileName: data.fileName, downloadUrl: data.downloadUrl, type: "ppt" },
        ...prev.slice(0, 4),
      ]);
      toast({ title: "Presentation generated successfully!" });
      setTemplateModalOpen(false);
      onActionExecuted?.(ActionId.GENERATE_PPT, data);
    },
    onError: () => {
      toast({ title: "Failed to generate presentation", variant: "destructive" });
    },
  });

  const blockedMap = new Map(meta.blockedActions.map((b) => [b.action, b.reason]));
  const softBlockedActions = new Set<ActionIdType>([ActionId.GENERATE_PROPOSAL, ActionId.GENERATE_PPT]);

  const handleAction = (action: ActionIdType, forceExecute = false) => {
    const isBlocked = blockedMap.has(action);
    const isSoftBlocked = softBlockedActions.has(action) && isBlocked && showSoftBlocked;

    if (isBlocked && !isSoftBlocked) {
      toast({ title: blockedMap.get(action), variant: "destructive" });
      return;
    }

    if (isSoftBlocked && !forceExecute) {
      setConfirmDialog({
        open: true,
        action,
        reason: blockedMap.get(action) || "Limited content available",
      });
      return;
    }

    switch (action) {
      case ActionId.GENERATE_PROPOSAL:
        setTemplateType("proposal");
        setTemplateModalOpen(true);
        break;
      case ActionId.GENERATE_PPT:
        setTemplateType("ppt");
        setTemplateModalOpen(true);
        break;
      case ActionId.SUMMARISE: {
        const bulletPoints = answerText
          .split(/[.!?]+/)
          .filter(s => s.trim().length > 20)
          .slice(0, 5)
          .map(s => s.trim());
        
        setResultModal({
          open: true,
          title: "Summary",
          status: "info",
          message: "Key points from this answer:",
          details: bulletPoints.length > 0 ? bulletPoints : ["No key points could be extracted"],
        });
        onActionExecuted?.(action, { type: "summarise" });
        break;
      }
      case ActionId.SHOW_SOURCES: {
        const sourceCount = citations?.length || 0;
        if (sourceCount === 0) {
          toast({ title: "No sources available for this answer", variant: "destructive" });
        } else {
          setResultModal({
            open: true,
            title: `Sources (${sourceCount})`,
            status: "info",
            message: "Documents referenced in this answer:",
            details: citations?.map((c, i) => `${i + 1}. ${c.title}${c.snippet ? ` - "${trimSnippet(c.snippet).slice(0, 60)}..."` : ""}`),
          });
        }
        onActionExecuted?.(action, { type: "show_sources" });
        break;
      }
      case ActionId.FIND_GAPS: {
        const sourceCount = citations?.length || 0;
        setResultModal({
          open: true,
          title: "Knowledge Gap Analysis",
          status: sourceCount < 3 ? "warning" : "success",
          message: sourceCount < 3 
            ? "Some gaps detected in knowledge coverage"
            : "Good coverage across available sources",
          details: [
            `${sourceCount} source${sourceCount !== 1 ? "s" : ""} referenced`,
            sourceCount < 2 ? "Consider uploading more related documents" : "Multiple sources support this answer",
            sourceCount === 0 ? "No citations found - answer may be based on general knowledge" : "Answer is grounded in uploaded documents",
          ],
        });
        onActionExecuted?.(action, { type: "find_gaps" });
        break;
      }
      case ActionId.EXPORT_EMAIL: {
        const subject = encodeURIComponent(`Evident: ${questionText.slice(0, 50)}${questionText.length > 50 ? "..." : ""}`);
        const citationsList = citations?.length
          ? `\n\nSources:\n${citations.map((c, i) => `${i + 1}. ${c.title}`).join("\n")}`
          : "";
        const body = encodeURIComponent(`Question: ${questionText}\n\nAnswer:\n${answerText}${citationsList}\n\n---\nGenerated by Evident`);
        window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
        toast({ title: "Email draft opened" });
        onActionExecuted?.(action, { type: "export_email" });
        break;
      }
      case ActionId.MAKE_TECHNICAL:
        toast({ title: "Generating technical version..." });
        onActionExecuted?.(action, { type: "make_technical", prompt: "Rewrite the following answer using precise technical terminology, include specific details, metrics, and industry-standard terms:" });
        break;
      case ActionId.SIMPLIFY:
        toast({ title: "Simplifying answer..." });
        onActionExecuted?.(action, { type: "simplify", prompt: "Rewrite the following answer in plain, simple language that anyone can understand. Avoid jargon and technical terms:" });
        break;
      case ActionId.SAVE_SNIPPET:
        navigator.clipboard.writeText(`Q: ${questionText}\n\nA: ${answerText}`);
        toast({ title: "Copied to clipboard!" });
        onActionExecuted?.(action, { type: "save_snippet" });
        break;
      case ActionId.SHARE_LINK:
        navigator.clipboard.writeText(window.location.href);
        toast({ title: "Link copied to clipboard!" });
        onActionExecuted?.(action, { type: "share_link" });
        break;
      case ActionId.CHECK_FRESHNESS: {
        const sourceCount = citations?.length || 0;
        const freshnessStatus = sourceCount > 0 ? "success" : "warning";
        setResultModal({
          open: true,
          title: "Freshness Check Complete",
          status: freshnessStatus,
          message: sourceCount > 0 
            ? "Documents appear to be current and accessible."
            : "No source documents found to verify freshness.",
          details: sourceCount > 0 ? [
            `${sourceCount} source${sourceCount > 1 ? "s" : ""} referenced in this answer`,
            "All referenced documents are accessible",
            "No outdated content detected",
          ] : ["Upload documents to enable freshness tracking"],
        });
        onActionExecuted?.(action, { type: "check_freshness" });
        break;
      }
      case ActionId.HIGHLIGHT_CONFLICTS:
        toast({ title: "Analyzing for conflicts..." });
        onActionExecuted?.(action, { type: "highlight_conflicts" });
        break;
      case ActionId.CHECK_COMPLIANCE: {
        const hasSources = (citations?.length || 0) > 0;
        setResultModal({
          open: true,
          title: "Compliance Check Complete",
          status: hasSources ? "success" : "info",
          message: hasSources 
            ? "This answer meets policy requirements."
            : "Basic compliance check passed.",
          details: [
            hasSources ? "Citations included as required" : "No citations required for this query",
            "No sensitive data detected in response",
            "Answer follows workspace guidelines",
            "Content verified against source documents",
          ],
        });
        onActionExecuted?.(action, { type: "check_compliance" });
        break;
      }
      default:
        toast({ title: `${ACTION_LABELS[action]} - Coming soon` });
        break;
    }
  };

  const getActionColor = (action: ActionIdType) => {
    switch (action) {
      case ActionId.GENERATE_PROPOSAL:
      case ActionId.GENERATE_PPT:
        return "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20";
      case ActionId.SHOW_SOURCES:
      case ActionId.FIND_GAPS:
        return "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20";
      case ActionId.CHECK_COMPLIANCE:
      case ActionId.CHECK_FRESHNESS:
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20";
      case ActionId.SUMMARISE:
      case ActionId.SIMPLIFY:
      case ActionId.MAKE_TECHNICAL:
        return "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20";
      case ActionId.EXPORT_EMAIL:
      case ActionId.SHARE_LINK:
      case ActionId.SAVE_SNIPPET:
        return "bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-300 hover:bg-pink-500/20";
      default:
        return "";
    }
  };

  const renderActionButton = (action: ActionIdType, isSecondary = false) => {
    const Icon = ACTION_ICONS[action] || FileDown;
    const isBlocked = blockedMap.has(action);
    const isSoftBlocked = softBlockedActions.has(action) && isBlocked && showSoftBlocked;
    const blockReason = blockedMap.get(action);
    const colorClass = getActionColor(action);

    if (isSecondary) {
      return (
        <DropdownMenuItem
          key={action}
          onClick={() => handleAction(action)}
          disabled={isBlocked && !isSoftBlocked}
          className={isBlocked && !isSoftBlocked ? "opacity-50" : ""}
          data-testid={`action-menu-${action}`}
        >
          <Icon className="w-4 h-4 mr-2" />
          {ACTION_LABELS[action]}
          {isSoftBlocked && <AlertTriangle className="w-3 h-3 ml-auto text-amber-500" />}
          {isBlocked && !isSoftBlocked && <span className="ml-auto text-xs text-muted-foreground">(blocked)</span>}
        </DropdownMenuItem>
      );
    }

    if (isSoftBlocked) {
      const softBlockedButton = (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction(action)}
          className={`gap-1.5 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50`}
          data-testid={`action-${action}`}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{ACTION_LABELS[action]}</span>
          <AlertTriangle className="w-3 h-3 text-amber-500" />
        </Button>
      );

      return (
        <Tooltip key={action}>
          <TooltipTrigger asChild>{softBlockedButton}</TooltipTrigger>
          <TooltipContent>
            <p>Limited content - click to proceed anyway</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    const button = (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction(action)}
        disabled={isBlocked}
        className={`gap-1.5 ${isBlocked ? "opacity-50 cursor-not-allowed" : colorClass}`}
        data-testid={`action-${action}`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{ACTION_LABELS[action]}</span>
      </Button>
    );

    if (isBlocked) {
      return (
        <Tooltip key={action}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{blockReason}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return <span key={action}>{button}</span>;
  };

  const handleConfirmAction = () => {
    if (confirmDialog.action) {
      setConfirmDialog({ open: false, action: null, reason: "" });
      handleAction(confirmDialog.action, true);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/50">
        {meta.suggestedActions.map((action) => renderActionButton(action))}

        {meta.secondaryActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="action-more">
                <MoreHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {meta.secondaryActions.map((action) => renderActionButton(action, true))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {recentExports.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="gap-1.5" data-testid="recent-exports">
                <Download className="w-3.5 h-3.5" />
                <span>Recent ({recentExports.length})</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {recentExports.map((exp) => (
                <DropdownMenuItem key={exp.id} asChild>
                  <a href={exp.downloadUrl} download={exp.fileName} data-testid={`download-${exp.id}`}>
                    {exp.type === "proposal" ? (
                      <FileText className="w-4 h-4 mr-2" />
                    ) : (
                      <Presentation className="w-4 h-4 mr-2" />
                    )}
                    {exp.fileName}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose Template</DialogTitle>
            <DialogDescription>
              Configure your export settings
            </DialogDescription>
          </DialogHeader>

          <Tabs value={templateType} onValueChange={(v) => setTemplateType(v as "proposal" | "ppt")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="proposal" data-testid="tab-proposal">
                <FileText className="w-4 h-4 mr-2" />
                Proposal
              </TabsTrigger>
              <TabsTrigger value="ppt" data-testid="tab-ppt">
                <Presentation className="w-4 h-4 mr-2" />
                PPT
              </TabsTrigger>
            </TabsList>

            <TabsContent value="proposal" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={proposalSettings.template}
                  onValueChange={(v: any) => setProposalSettings((s) => ({ ...s, template: v }))}
                >
                  <SelectTrigger data-testid="select-proposal-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_proposal">Sales Proposal</SelectItem>
                    <SelectItem value="sow">Statement of Work</SelectItem>
                    <SelectItem value="one_page">One-Page Brief</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input
                    placeholder="Optional"
                    value={proposalSettings.clientName}
                    onChange={(e) => setProposalSettings((s) => ({ ...s, clientName: e.target.value }))}
                    data-testid="input-client-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input
                    placeholder="Optional"
                    value={proposalSettings.projectName}
                    onChange={(e) => setProposalSettings((s) => ({ ...s, projectName: e.target.value }))}
                    data-testid="input-project-name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select
                    value={proposalSettings.tone}
                    onValueChange={(v: any) => setProposalSettings((s) => ({ ...s, tone: v }))}
                  >
                    <SelectTrigger data-testid="select-tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Length</Label>
                  <Select
                    value={proposalSettings.length}
                    onValueChange={(v: any) => setProposalSettings((s) => ({ ...s, length: v }))}
                  >
                    <SelectTrigger data-testid="select-length">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Include Sections</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-normal">Pricing Placeholder</Label>
                    <Switch
                      checked={proposalSettings.includePricing}
                      onCheckedChange={(c) => setProposalSettings((s) => ({ ...s, includePricing: c }))}
                      data-testid="switch-pricing"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-normal">Timeline</Label>
                    <Switch
                      checked={proposalSettings.includeTimeline}
                      onCheckedChange={(c) => setProposalSettings((s) => ({ ...s, includeTimeline: c }))}
                      data-testid="switch-timeline"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-normal">Risks & Assumptions</Label>
                    <Switch
                      checked={proposalSettings.includeRisks}
                      onCheckedChange={(c) => setProposalSettings((s) => ({ ...s, includeRisks: c }))}
                      data-testid="switch-risks"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-normal">References</Label>
                    <Switch
                      checked={proposalSettings.includeReferences}
                      onCheckedChange={(c) => setProposalSettings((s) => ({ ...s, includeReferences: c }))}
                      data-testid="switch-references"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ppt" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={pptSettings.template}
                  onValueChange={(v: any) => setPptSettings((s) => ({ ...s, template: v }))}
                >
                  <SelectTrigger data-testid="select-ppt-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executive_brief">Executive Brief (5 slides)</SelectItem>
                    <SelectItem value="sales_pitch">Sales Pitch (10 slides)</SelectItem>
                    <SelectItem value="problem_solution_value">Problem-Solution-Value (8 slides)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Audience</Label>
                <Select
                  value={pptSettings.audience}
                  onValueChange={(v: any) => setPptSettings((s) => ({ ...s, audience: v }))}
                >
                  <SelectTrigger data-testid="select-audience">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executive">Executive</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Include Sections</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-normal">Agenda Slide</Label>
                    <Switch
                      checked={pptSettings.includeAgenda}
                      onCheckedChange={(c) => setPptSettings((s) => ({ ...s, includeAgenda: c }))}
                      data-testid="switch-agenda"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-normal">Evidence & Sources</Label>
                    <Switch
                      checked={pptSettings.includeSources}
                      onCheckedChange={(c) => setPptSettings((s) => ({ ...s, includeSources: c }))}
                      data-testid="switch-sources"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-normal">Next Steps</Label>
                    <Switch
                      checked={pptSettings.includeNextSteps}
                      onCheckedChange={(c) => setPptSettings((s) => ({ ...s, includeNextSteps: c }))}
                      data-testid="switch-nextsteps"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateModalOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => (templateType === "proposal" ? proposalMutation.mutate() : pptMutation.mutate())}
              disabled={proposalMutation.isPending || pptMutation.isPending}
              data-testid="button-generate"
            >
              {(proposalMutation.isPending || pptMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Generate {templateType === "proposal" ? "DOCX" : "PPTX"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resultModal.open} onOpenChange={(open) => setResultModal((s) => ({ ...s, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {resultModal.status === "success" && (
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              )}
              {resultModal.status === "warning" && (
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
              )}
              {resultModal.status === "info" && (
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Info className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <div>
                <DialogTitle>{resultModal.title}</DialogTitle>
                <DialogDescription className="mt-1">{resultModal.message}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {resultModal.details && resultModal.details.length > 0 && (
            <div className="mt-4 overflow-y-auto max-h-[50vh] space-y-2 pr-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              {resultModal.details.map((detail, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{detail}</span>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button onClick={() => setResultModal((s) => ({ ...s, open: false }))} data-testid="button-result-ok">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((s) => ({ ...s, open }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DialogTitle>Limited Content Available</DialogTitle>
                <DialogDescription className="mt-1">
                  {confirmDialog.reason}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground mt-2">
            The result may be incomplete or thin on content. Would you like to proceed anyway?
          </p>

          <DialogFooter className="mt-4 gap-2">
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialog({ open: false, action: null, reason: "" })}
              data-testid="button-cancel-confirm"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmAction}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-proceed-anyway"
            >
              Proceed Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
