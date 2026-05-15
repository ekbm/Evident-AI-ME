import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { PackGate } from "@/features/packs/PackGate";
import { 
  Upload, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Download, 
  Trash2, 
  Play,
  ArrowLeft,
  FileSpreadsheet,
  RefreshCw,
  Info,
  FolderSearch,
  Database,
  FileUp,
  Check,
  X,
  Eye,
  MessageSquare,
  Edit,
  Save,
  MapPin
} from "lucide-react";
import type { 
  InvoiceDocument, 
  InvoiceLineItem, 
  TimeEntry,
  ReconciliationRun,
  ReconciliationResult
} from "@shared/schema";

type ReferenceSource = "uploaded" | "documents" | "all";

interface ExtractedInvoiceReview {
  invoice: InvoiceDocument;
  lineItems: InvoiceLineItem[];
  warning?: { code: string; message: string };
  anchors?: Record<string, { page: number; bbox: number[] }>;
  meta?: { isScannedLikely?: boolean; pages?: number };
}

function ReconciliationContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("setup");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [hoursTolerance, setHoursTolerance] = useState(0.25);
  const [isUploading, setIsUploading] = useState(false);
  const [referenceSource, setReferenceSource] = useState<ReferenceSource>("uploaded");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [extractedReview, setExtractedReview] = useState<ExtractedInvoiceReview | null>(null);
  const [editedFields, setEditedFields] = useState<{
    vendorName: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: string;
    currency: string;
  }>({ vendorName: "", invoiceNumber: "", invoiceDate: "", dueDate: "", totalAmount: "", currency: "USD" });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery<InvoiceDocument[]>({
    queryKey: ["/api/reconciliation/invoices"],
  });

  const { data: timeEntries = [], isLoading: loadingTimeEntries } = useQuery<TimeEntry[]>({
    queryKey: ["/api/reconciliation/time-entries"],
  });

  const { data: runs = [], isLoading: loadingRuns } = useQuery<ReconciliationRun[]>({
    queryKey: ["/api/reconciliation/runs"],
  });

  const { data: selectedInvoice } = useQuery<{ invoice: InvoiceDocument; lineItems: InvoiceLineItem[] }>({
    queryKey: ["/api/reconciliation/invoices", selectedInvoiceId],
    enabled: !!selectedInvoiceId,
  });

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data: selectedRun } = useQuery<ReconciliationResult>({
    queryKey: ["/api/reconciliation/runs", selectedRunId],
    enabled: !!selectedRunId,
  });

  async function handleInvoiceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/reconciliation/invoices/extract", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      const result = await response.json() as ExtractedInvoiceReview;
      
      setExtractedReview(result);
      setEditedFields({
        vendorName: result.invoice.vendorName || "",
        invoiceNumber: result.invoice.invoiceNumber || "",
        invoiceDate: result.invoice.invoiceDate || "",
        dueDate: result.invoice.dueDate || "",
        totalAmount: result.invoice.totalAmount?.toString() || "",
        currency: result.invoice.currency || "USD",
      });
      setReviewDialogOpen(true);

      await queryClient.invalidateQueries({ queryKey: ["/api/reconciliation/invoices"] });
      toast({ title: "Invoice extracted", description: "Please review the extracted data before saving." });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  async function handleSaveReviewedInvoice() {
    if (!extractedReview) return;

    try {
      const res = await apiRequest("PATCH", `/api/reconciliation/invoices/${extractedReview.invoice.id}`, {
        vendorName: editedFields.vendorName || null,
        invoiceNumber: editedFields.invoiceNumber || null,
        invoiceDate: editedFields.invoiceDate || null,
        dueDate: editedFields.dueDate || null,
        totalAmount: editedFields.totalAmount ? parseFloat(editedFields.totalAmount) : null,
        currency: editedFields.currency || "USD",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Save failed");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/reconciliation/invoices"] });
      setReviewDialogOpen(false);
      setExtractedReview(null);
      toast({ title: "Invoice saved", description: "Extracted data has been confirmed and saved." });
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    }
  }

  async function handleTimeEntriesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("clearExisting", "true");

    try {
      const response = await fetch("/api/reconciliation/time-entries/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import failed");
      }

      const result = await response.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/reconciliation/time-entries"] });
      toast({ title: "Time entries imported", description: `${result.imported} entries imported successfully.` });
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  const runReconciliation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("POST", "/api/reconciliation/runs", { 
        invoiceId, 
        hoursTolerance,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        referenceSource,
      });
      return await res.json() as ReconciliationResult;
    },
    onSuccess: (result: ReconciliationResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reconciliation/runs"] });
      setSelectedRunId(result.runId);
      setActiveTab("results");
      toast({ title: "Reconciliation complete", description: `Found ${result.summary.discrepancyCount} discrepancies.` });
    },
    onError: (error: any) => {
      toast({ title: "Reconciliation failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/reconciliation/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reconciliation/invoices"] });
      setSelectedInvoiceId(null);
      toast({ title: "Invoice deleted" });
    },
  });

  const clearTimeEntries = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/reconciliation/time-entries");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reconciliation/time-entries"] });
      toast({ title: "Time entries cleared" });
    },
  });

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const resolveDiscrepancy = useMutation({
    mutationFn: async ({ id, status, notes, adjustedValue }: { id: string; status: string; notes?: string; adjustedValue?: string }) => {
      const res = await apiRequest("POST", `/api/reconciliation/discrepancies/${id}/resolve`, {
        status,
        resolutionNotes: notes,
        adjustedValue,
      });
      return await res.json();
    },
    onSuccess: () => {
      if (selectedRunId) {
        queryClient.invalidateQueries({ queryKey: ["/api/reconciliation/runs", selectedRunId] });
      }
      setResolvingId(null);
      setResolutionNotes("");
      toast({ title: "Discrepancy updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to resolve discrepancy", description: error.message, variant: "destructive" });
    },
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case "OPEN": return <Badge variant="secondary">Open</Badge>;
      case "REVIEW_PENDING": return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Review Pending</Badge>;
      case "APPROVED": return <Badge variant="default" className="bg-green-600">Approved</Badge>;
      case "REJECTED": return <Badge variant="destructive">Rejected</Badge>;
      case "ACCEPTED_AS_IS": return <Badge variant="outline" className="border-blue-500 text-blue-600">Accepted As-Is</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case "HIGH": return "destructive";
      case "MEDIUM": return "secondary";
      case "LOW": return "outline";
      default: return "outline";
    }
  }

  function getDiscrepancyIcon(type: string) {
    switch (type) {
      case "MISSING_TIME_ENTRY": return <XCircle className="h-4 w-4 text-destructive" />;
      case "MISSING_INVOICE_LINE": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "HOURS_MISMATCH": return <Clock className="h-4 w-4 text-blue-500" />;
      case "RATE_MISMATCH": return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default: return <Info className="h-4 w-4" />;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }}
              data-testid="button-close-tool"
              className="self-start shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Close & Return to Knowledge Space
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">Invoice Reconciliation</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Automate the verification of vendor invoices against your internal time tracking records. 
                Evident analyzes line items, identifies discrepancies in hours, rates, and amounts, 
                and provides a detailed reconciliation report for your review.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="setup" data-testid="tab-setup">
              <FolderSearch className="h-4 w-4 mr-2" />
              1. Setup
            </TabsTrigger>
            <TabsTrigger value="invoices" data-testid="tab-invoices">
              <FileText className="h-4 w-4 mr-2" />
              2. Invoices ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="time-entries" data-testid="tab-time-entries">
              <Clock className="h-4 w-4 mr-2" />
              3. Time Entries ({timeEntries.length})
            </TabsTrigger>
            <TabsTrigger value="reconcile" data-testid="tab-reconcile">
              <RefreshCw className="h-4 w-4 mr-2" />
              4. Reconcile
            </TabsTrigger>
            <TabsTrigger value="results" data-testid="tab-results">
              <CheckCircle className="h-4 w-4 mr-2" />
              5. Results ({runs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Date Range</CardTitle>
                <CardDescription>
                  Specify the billing period to extract and compare invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date-from">From Date</Label>
                    <Input
                      id="date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      data-testid="input-date-from"
                    />
                  </div>
                  <div>
                    <Label htmlFor="date-to">To Date</Label>
                    <Input
                      id="date-to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      data-testid="input-date-to"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Leave empty to include all available invoices and time entries
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderSearch className="h-5 w-5" />
                  Reference Source
                </CardTitle>
                <CardDescription>
                  Select where Evident should look for time entries to match against invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  value={referenceSource} 
                  onValueChange={(v) => setReferenceSource(v as ReferenceSource)}
                  className="grid md:grid-cols-3 gap-4"
                >
                  <div className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${referenceSource === "uploaded" ? "border-primary bg-primary/5" : "hover-elevate"}`}>
                    <RadioGroupItem value="uploaded" id="ref-uploaded" className="mt-1" />
                    <Label htmlFor="ref-uploaded" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2 font-medium">
                        <FileUp className="h-4 w-4" />
                        Uploaded CSV
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Use time entries from an uploaded CSV file (Harvest, Toggl, or custom format)
                      </p>
                    </Label>
                  </div>
                  <div className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${referenceSource === "documents" ? "border-primary bg-primary/5" : "hover-elevate"}`}>
                    <RadioGroupItem value="documents" id="ref-documents" className="mt-1" />
                    <Label htmlFor="ref-documents" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2 font-medium">
                        <Database className="h-4 w-4" />
                        Evident Documents
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Extract time data from documents already uploaded to your Evident workspace
                      </p>
                    </Label>
                  </div>
                  <div className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${referenceSource === "all" ? "border-primary bg-primary/5" : "hover-elevate"}`}>
                    <RadioGroupItem value="all" id="ref-all" className="mt-1" />
                    <Label htmlFor="ref-all" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2 font-medium">
                        <FolderSearch className="h-4 w-4" />
                        All Sources
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Search across both uploaded CSV files and existing Evident documents
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Matching Settings</CardTitle>
                <CardDescription>Configure tolerance levels for the reconciliation process</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-xs">
                  <Label htmlFor="hours-tolerance-setup">Hours Tolerance</Label>
                  <Input
                    id="hours-tolerance-setup"
                    type="number"
                    step="0.25"
                    min="0"
                    max="2"
                    value={hoursTolerance}
                    onChange={(e) => setHoursTolerance(parseFloat(e.target.value) || 0.25)}
                    data-testid="input-hours-tolerance-setup"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Allow hour differences up to this amount (e.g., 0.25 = 15 minutes)
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => setActiveTab("invoices")} data-testid="button-next-invoices">
                Next: Upload Invoices
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Invoice</CardTitle>
                <CardDescription>Upload PDF or document invoices to extract line items</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <Input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={handleInvoiceUpload}
                    disabled={isUploading}
                    className="max-w-xs mx-auto"
                    data-testid="input-invoice-upload"
                  />
                  <p className="text-sm text-muted-foreground mt-2">Supports PDF, DOCX, TXT files</p>
                </div>
              </CardContent>
            </Card>

            {loadingInvoices ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">Loading invoices...</CardContent>
              </Card>
            ) : invoices.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No invoices uploaded yet. Upload an invoice to get started.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Uploaded Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                          <TableCell className="font-medium">{inv.vendorName || "Unknown"}</TableCell>
                          <TableCell>{inv.invoiceNumber || "-"}</TableCell>
                          <TableCell>{inv.invoiceDate || "-"}</TableCell>
                          <TableCell>{inv.totalAmount ? `$${inv.totalAmount.toLocaleString()}` : "-"}</TableCell>
                          <TableCell>
                            <Badge variant={inv.status === "EXTRACTED" ? "default" : inv.status === "ERROR" ? "destructive" : "secondary"}>
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedInvoiceId(inv.id)}
                                data-testid={`button-view-invoice-${inv.id}`}
                              >
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteInvoice.mutate(inv.id)}
                                data-testid={`button-delete-invoice-${inv.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {selectedInvoice && (
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Line Items: {selectedInvoice.invoice.vendorName}</CardTitle>
                  <CardDescription>{selectedInvoice.lineItems.length} line items extracted</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.lineItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.projectName || "-"}</TableCell>
                          <TableCell>{item.quantity} {item.unitType}</TableCell>
                          <TableCell>{item.rate ? `$${item.rate}/hr` : "-"}</TableCell>
                          <TableCell>${item.amount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setActiveTab("setup")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Setup
              </Button>
              <Button onClick={() => setActiveTab("time-entries")} data-testid="button-next-time-entries">
                Next: Import Time Entries
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="time-entries" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Import Time Entries</CardTitle>
                <CardDescription>Upload a CSV file with your time tracking data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleTimeEntriesUpload}
                    disabled={isUploading}
                    className="max-w-xs mx-auto"
                    data-testid="input-time-entries-upload"
                  />
                  <p className="text-sm text-muted-foreground mt-2">CSV with Project, Date, Hours columns</p>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Your CSV should have columns for: Project (or Client/Matter), Date, Hours, and optionally Rate and Description.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {loadingTimeEntries ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">Loading time entries...</CardContent>
              </Card>
            ) : timeEntries.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No time entries imported yet. Upload a CSV file to get started.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle>Imported Time Entries</CardTitle>
                    <CardDescription>{timeEntries.length} entries loaded</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => clearTimeEntries.mutate()}
                    data-testid="button-clear-time-entries"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeEntries.slice(0, 50).map((entry) => (
                        <TableRow key={entry.id} data-testid={`row-time-entry-${entry.id}`}>
                          <TableCell>{entry.entryDate}</TableCell>
                          <TableCell className="font-medium">{entry.projectName}</TableCell>
                          <TableCell>{entry.taskName || "-"}</TableCell>
                          <TableCell>{entry.hours}</TableCell>
                          <TableCell>{entry.rate ? `$${entry.rate}/hr` : "-"}</TableCell>
                          <TableCell>{entry.amount ? `$${entry.amount.toLocaleString()}` : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {timeEntries.length > 50 && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      Showing 50 of {timeEntries.length} entries
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setActiveTab("invoices")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Invoices
              </Button>
              <Button onClick={() => setActiveTab("reconcile")} data-testid="button-next-reconcile">
                Next: Compare & Reconcile
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="reconcile" className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Review the data below before running reconciliation. Evident will compare invoice line items against your time entries to identify discrepancies.
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Comparison Summary</CardTitle>
                  <CardDescription>Data that will be compared</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <span className="font-medium">Invoices</span>
                        <p className="text-xs text-muted-foreground">
                          {dateFrom || dateTo ? `${dateFrom || "Start"} to ${dateTo || "End"}` : "All dates"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{invoices.filter(i => i.status === "EXTRACTED").length}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <span className="font-medium">Time Entries</span>
                        <p className="text-xs text-muted-foreground">
                          Source: {referenceSource === "uploaded" ? "CSV Upload" : referenceSource === "documents" ? "Evident Documents" : "All Sources"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{timeEntries.length}</Badge>
                  </div>

                  {invoices.length === 0 || timeEntries.length === 0 ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Upload at least one invoice and import time entries before running reconciliation.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reconciliation Settings</CardTitle>
                  <CardDescription>Current matching configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Hours Tolerance</span>
                    <span className="font-medium">{hoursTolerance} hours ({hoursTolerance * 60} min)</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Date Range</span>
                    <span className="font-medium">
                      {dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : dateFrom || dateTo || "All dates"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Reference Source</span>
                    <span className="font-medium">
                      {referenceSource === "uploaded" ? "CSV Upload" : referenceSource === "documents" ? "Evident Docs" : "All"}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setActiveTab("setup")}>
                    Modify Settings
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Select Invoices to Reconcile</CardTitle>
                <CardDescription>Choose which invoices to compare against time entries</CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.filter(inv => inv.status === "EXTRACTED").length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No processed invoices available</p>
                    <Button variant="outline" className="mt-4" onClick={() => setActiveTab("invoices")}>
                      Upload Invoices
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoices.filter(inv => inv.status === "EXTRACTED").map((inv) => (
                      <div
                        key={inv.id}
                        className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                          selectedInvoiceIds.has(inv.id) ? "border-primary bg-primary/5" : "hover-elevate"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={selectedInvoiceIds.has(inv.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedInvoiceIds);
                              if (e.target.checked) {
                                newSet.add(inv.id);
                              } else {
                                newSet.delete(inv.id);
                              }
                              setSelectedInvoiceIds(newSet);
                            }}
                            className="h-4 w-4 rounded border-gray-300"
                            data-testid={`checkbox-invoice-${inv.id}`}
                          />
                          <div>
                            <p className="font-medium">{inv.vendorName || inv.filename}</p>
                            <p className="text-sm text-muted-foreground">
                              {inv.invoiceNumber ? `#${inv.invoiceNumber} • ` : ""}
                              {inv.invoiceDate || "No date"} • ${inv.totalAmount?.toLocaleString() || "0"}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedInvoiceId(inv.id);
                            setActiveTab("invoices");
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setActiveTab("time-entries")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Time Entries
              </Button>
              <Button
                size="lg"
                disabled={invoices.filter(inv => inv.status === "EXTRACTED").length === 0 || timeEntries.length === 0 || runReconciliation.isPending}
                onClick={() => {
                  const invoicesToProcess = selectedInvoiceIds.size > 0 
                    ? Array.from(selectedInvoiceIds) 
                    : invoices.filter(inv => inv.status === "EXTRACTED").map(inv => inv.id);
                  if (invoicesToProcess.length > 0) {
                    runReconciliation.mutate(invoicesToProcess[0]);
                  }
                }}
                data-testid="button-run-reconciliation"
              >
                <Play className="h-4 w-4 mr-2" />
                {runReconciliation.isPending ? "Running Reconciliation..." : "Run Reconciliation"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            {loadingRuns ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">Loading results...</CardContent>
              </Card>
            ) : runs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No reconciliation runs yet. Select an invoice and run reconciliation.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Reconciliations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {runs.map((run) => (
                        <div
                          key={run.id}
                          className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedRunId === run.id ? "border-primary bg-primary/5" : "hover-elevate"
                          }`}
                          onClick={() => setSelectedRunId(run.id)}
                          data-testid={`row-run-${run.id}`}
                        >
                          <div>
                            <p className="font-medium">Run {run.id.slice(0, 8)}</p>
                            <p className="text-sm text-muted-foreground">
                              {run.matchedCount} matched • {run.discrepancyCount} discrepancies
                            </p>
                          </div>
                          <Badge variant={run.status === "COMPLETED" ? "default" : run.status === "ERROR" ? "destructive" : "secondary"}>
                            {run.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {selectedRun && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Reconciliation Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-muted rounded-lg text-center">
                            <p className="text-2xl font-bold">{selectedRun.summary.totalInvoiceLines}</p>
                            <p className="text-sm text-muted-foreground">Invoice Lines</p>
                          </div>
                          <div className="p-4 bg-muted rounded-lg text-center">
                            <p className="text-2xl font-bold">{selectedRun.summary.totalTimeEntries}</p>
                            <p className="text-sm text-muted-foreground">Time Entries</p>
                          </div>
                          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                            <p className="text-2xl font-bold text-green-600">{selectedRun.summary.matchedCount}</p>
                            <p className="text-sm text-muted-foreground">Matched</p>
                          </div>
                          <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg text-center">
                            <p className="text-2xl font-bold text-red-600">{selectedRun.summary.discrepancyCount}</p>
                            <p className="text-sm text-muted-foreground">Discrepancies</p>
                          </div>
                        </div>

                        <div className="mt-6">
                          <div className="flex justify-between text-sm mb-2">
                            <span>Match Rate</span>
                            <span>
                              {selectedRun.summary.totalInvoiceLines > 0
                                ? Math.round((selectedRun.summary.matchedCount / selectedRun.summary.totalInvoiceLines) * 100)
                                : 0}%
                            </span>
                          </div>
                          <Progress
                            value={
                              selectedRun.summary.totalInvoiceLines > 0
                                ? (selectedRun.summary.matchedCount / selectedRun.summary.totalInvoiceLines) * 100
                                : 0
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {selectedRun.discrepancies.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Discrepancies</CardTitle>
                          <CardDescription>Review and resolve these issues</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Accordion type="single" collapsible className="w-full">
                            {selectedRun.discrepancies.map((disc, idx) => (
                              <AccordionItem key={disc.id} value={disc.id}>
                                <AccordionTrigger className="hover:no-underline">
                                  <div className="flex items-center gap-3 text-left">
                                    {getDiscrepancyIcon(disc.discrepancyType)}
                                    <span className="flex-1">{disc.description}</span>
                                    <Badge variant={getSeverityColor(disc.severity) as any} className="ml-2">
                                      {disc.severity}
                                    </Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="pl-7 space-y-4 text-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-muted-foreground">Status:</span>
                                      {getStatusBadge(disc.status || "OPEN")}
                                      {disc.resolvedAt && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                          Resolved {new Date(disc.resolvedAt).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-muted-foreground">Invoice Value</p>
                                        <p className="font-mono">{disc.invoiceValue || "N/A"}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">Time Entry Value</p>
                                        <p className="font-mono">{disc.timeEntryValue || "N/A"}</p>
                                      </div>
                                    </div>
                                    {disc.difference !== null && (
                                      <div>
                                        <p className="text-muted-foreground">Difference</p>
                                        <p className={`font-mono ${disc.difference > 0 ? "text-green-600" : "text-red-600"}`}>
                                          {disc.difference > 0 ? "+" : ""}${disc.difference.toFixed(2)}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {disc.resolutionNotes && (
                                      <div className="p-3 bg-muted rounded-lg">
                                        <p className="text-muted-foreground text-xs mb-1">Resolution Notes</p>
                                        <p>{disc.resolutionNotes}</p>
                                      </div>
                                    )}

                                    {resolvingId === disc.id ? (
                                      <div className="space-y-3 p-4 border rounded-lg bg-card">
                                        <Label>Resolution Notes (optional)</Label>
                                        <Textarea
                                          value={resolutionNotes}
                                          onChange={(e) => setResolutionNotes(e.target.value)}
                                          placeholder="Add notes about this resolution..."
                                          className="resize-none"
                                          data-testid="textarea-resolution-notes"
                                        />
                                        <div className="flex flex-wrap gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => resolveDiscrepancy.mutate({ id: disc.id, status: "APPROVED", notes: resolutionNotes })}
                                            disabled={resolveDiscrepancy.isPending}
                                            data-testid="button-approve"
                                          >
                                            <Check className="h-4 w-4 mr-1" />
                                            Approve
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => resolveDiscrepancy.mutate({ id: disc.id, status: "REJECTED", notes: resolutionNotes })}
                                            disabled={resolveDiscrepancy.isPending}
                                            data-testid="button-reject"
                                          >
                                            <X className="h-4 w-4 mr-1" />
                                            Reject
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => resolveDiscrepancy.mutate({ id: disc.id, status: "ACCEPTED_AS_IS", notes: resolutionNotes })}
                                            disabled={resolveDiscrepancy.isPending}
                                            data-testid="button-accept-as-is"
                                          >
                                            Accept As-Is
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => { setResolvingId(null); setResolutionNotes(""); }}
                                            data-testid="button-cancel-resolve"
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex gap-2 pt-2">
                                        {(!disc.status || disc.status === "OPEN" || disc.status === "REVIEW_PENDING") && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setResolvingId(disc.id)}
                                            data-testid={`button-resolve-${disc.id}`}
                                          >
                                            <MessageSquare className="h-4 w-4 mr-1" />
                                            Resolve
                                          </Button>
                                        )}
                                        {disc.status === "OPEN" && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => resolveDiscrepancy.mutate({ id: disc.id, status: "REVIEW_PENDING" })}
                                            disabled={resolveDiscrepancy.isPending}
                                            data-testid={`button-flag-review-${disc.id}`}
                                          >
                                            <Eye className="h-4 w-4 mr-1" />
                                            Flag for Review
                                          </Button>
                                        )}
                                        {(disc.status === "APPROVED" || disc.status === "REJECTED" || disc.status === "ACCEPTED_AS_IS") && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => resolveDiscrepancy.mutate({ id: disc.id, status: "OPEN" })}
                                            disabled={resolveDiscrepancy.isPending}
                                            data-testid={`button-reopen-${disc.id}`}
                                          >
                                            <RefreshCw className="h-4 w-4 mr-1" />
                                            Reopen
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </CardContent>
                      </Card>
                    )}

                    {selectedRun.matches.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Matched Items</CardTitle>
                          <CardDescription>{selectedRun.matches.length} items matched successfully</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Invoice Line</TableHead>
                                <TableHead>Time Entry</TableHead>
                                <TableHead>Hours</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Confidence</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedRun.matches.map((match, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{match.invoiceLine.description}</p>
                                      <p className="text-xs text-muted-foreground">{match.invoiceLine.projectName}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{match.timeEntry.projectName}</p>
                                      <p className="text-xs text-muted-foreground">{match.timeEntry.entryDate}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {match.invoiceLine.quantity} / {match.timeEntry.hours}
                                  </TableCell>
                                  <TableCell>
                                    ${match.invoiceLine.amount.toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={match.matchConfidence > 0.8 ? "default" : "secondary"}>
                                      {Math.round(match.matchConfidence * 100)}%
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <PackGate packId="finance">
      <ReconciliationContent />
    </PackGate>
  );
}
