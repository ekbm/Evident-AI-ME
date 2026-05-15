import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useLocation } from "wouter";
import { 
  FileSpreadsheet, 
  BarChart3, 
  ArrowLeft,
  Lock,
  Sparkles,
  TrendingUp,
  Lightbulb,
  Calendar,
  Database,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Files,
  GitCompare,
  PieChart
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AuthRequiredMessage } from "@/components/auth-required-message";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useEntitlements } from "@/features/packs/useEntitlements";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { ExcelReportResponse } from "@shared/schema";

export default function ServicesPage() {
  useDocumentTitle("Evident Insights");
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isAdvancedPlan, isLoading: entitlementsLoading } = useEntitlements();
  const { toast } = useToast();
  
  const hasAdvancedPlan = isAdvancedPlan();
  const [activeTab, setActiveTab] = useState("create-report");

  if (authLoading || entitlementsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-10 bg-muted rounded w-1/3" />
            <div className="h-6 bg-muted rounded w-2/3" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="mb-6">
            <Button variant="ghost" size="sm" onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }} data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Close & Return to Knowledge Space
            </Button>
          </div>
          <div className="flex flex-col items-center justify-center py-24">
            <h1 className="text-2xl font-bold mb-4">Evident Insights</h1>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Create reports you can actually use from your data.
            </p>
            <AuthRequiredMessage />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12 pb-24 sm:pb-12">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Close & Return to Knowledge Space
            </Button>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Evident Insights</h1>
              <p className="text-sm text-muted-foreground">
                Create reports you can actually use
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="create-report" className="text-xs" data-testid="tab-create-report">
              <FileSpreadsheet className="w-3 h-3 mr-1 hidden sm:inline" />
              Create Report
            </TabsTrigger>
            <TabsTrigger value="bulk-upload" className="text-xs" data-testid="tab-bulk-upload">
              <Files className="w-3 h-3 mr-1 hidden sm:inline" />
              Bulk Upload
            </TabsTrigger>
            <TabsTrigger value="custom-workflows" className="text-xs" data-testid="tab-custom-workflows">
              <Sparkles className="w-3 h-3 mr-1 hidden sm:inline" />
              Workflows
            </TabsTrigger>
            <TabsTrigger value="scheduled-reports" className="text-xs" data-testid="tab-scheduled-reports">
              <Calendar className="w-3 h-3 mr-1 hidden sm:inline" />
              Scheduled
            </TabsTrigger>
            <TabsTrigger value="training-export" className="text-xs" data-testid="tab-training-export">
              <Database className="w-3 h-3 mr-1 hidden sm:inline" />
              Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create-report">
            <CreateReportTab hasAdvancedPlan={hasAdvancedPlan} />
          </TabsContent>

          <TabsContent value="bulk-upload">
            <BulkUploadTab hasAdvancedPlan={hasAdvancedPlan} />
          </TabsContent>

          <TabsContent value="custom-workflows">
            <CustomWorkflowsTab hasAdvancedPlan={hasAdvancedPlan} />
          </TabsContent>

          <TabsContent value="scheduled-reports">
            <ScheduledReportsTab hasAdvancedPlan={hasAdvancedPlan} />
          </TabsContent>

          <TabsContent value="training-export">
            <TrainingExportTab hasAdvancedPlan={hasAdvancedPlan} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CreateReportTab({ hasAdvancedPlan }: { hasAdvancedPlan: boolean }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedAssetId, setUploadedAssetId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedReportType, setSelectedReportType] = useState<string>("summary");
  const [report, setReport] = useState<ExcelReportResponse | null>(null);

  // Fetch existing Excel assets
  const { data: assetsData, isLoading: assetsLoading } = useQuery<Array<{ id: string; filename: string; createdAt: string }>>({
    queryKey: ["/api/assets"],
  });
  
  const assets = (assetsData || []).filter((asset) => 
    asset.filename?.match(/\.(xlsx|xls|csv)$/i)
  );

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setUploadedAssetId(data.id);
      setSelectedAssetId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "File uploaded",
        description: "Your Excel file is ready for analysis.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async ({ assetId, reportType }: { assetId: string; reportType: string }) => {
      const response = await fetch("/api/actions/excel-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assetId, reportType }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Report generation failed");
      }
      
      return response.json() as Promise<ExcelReportResponse>;
    },
    onSuccess: (data) => {
      setReport(data);
      toast({
        title: "Report generated",
        description: "Your report is ready to view.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Report generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv"
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel file (.xlsx, .xls) or CSV file.",
        variant: "destructive",
      });
      return;
    }
    
    setUploadedFile(file);
    setReport(null);
    uploadMutation.mutate(file);
  }, [toast, uploadMutation]);

  const handleGenerateReport = useCallback(() => {
    if (!selectedAssetId) return;
    reportMutation.mutate({ assetId: selectedAssetId, reportType: selectedReportType });
  }, [selectedAssetId, selectedReportType, reportMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv"
      ];
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
        toast({
          title: "Invalid file type",
          description: "Please upload an Excel file (.xlsx, .xls) or CSV file.",
          variant: "destructive",
        });
        return;
      }
      
      setUploadedFile(file);
      setReport(null);
      uploadMutation.mutate(file);
    }
  }, [toast, uploadMutation]);

  if (!hasAdvancedPlan) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Available in Advanced & Max Plans</h3>
          <p className="text-muted-foreground mb-4">
            Upgrade to create reports from your Excel data.
          </p>
          <Link href="/pricing">
            <Button className="gap-2" data-testid="button-upgrade-create-report">
              <Sparkles className="w-4 h-4" />
              View Plans
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-500" />
            Upload Excel File
          </CardTitle>
          <CardDescription>
            Upload a new file or select from your existing documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-excel-upload"
          />
          
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            data-testid="dropzone-excel"
          >
            {uploadMutation.isPending ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="font-medium text-sm">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Drop your Excel file here</p>
                  <p className="text-xs text-muted-foreground">or click to browse (.xlsx, .xls, .csv)</p>
                </div>
              </div>
            )}
          </div>

          {/* Existing Files */}
          {assets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Or select from your files:</p>
                {selectedAssetId && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setSelectedAssetId(null);
                      setReport(null);
                    }}
                    data-testid="button-clear-selection"
                  >
                    Clear selection
                  </Button>
                )}
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {assets.map((asset) => (
                  <label
                    key={asset.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAssetId === asset.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`file-option-${asset.id}`}
                  >
                    <input
                      type="radio"
                      name="selected-file"
                      value={asset.id}
                      checked={selectedAssetId === asset.id}
                      onChange={() => {
                        setSelectedAssetId(asset.id);
                        setReport(null);
                      }}
                      className="w-4 h-4 text-primary"
                    />
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm truncate flex-1">{asset.filename}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {assetsLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Type Selection - Always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Type</CardTitle>
          <CardDescription>
            Choose what kind of analysis you want
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div
              onClick={() => setSelectedReportType("summary")}
              className={`cursor-pointer rounded-xl p-4 flex flex-col items-center gap-2 transition-all border-2 ${
                selectedReportType === "summary"
                  ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/25"
                  : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:border-blue-400"
              }`}
              data-testid="button-report-summary"
            >
              <BarChart3 className={`w-6 h-6 ${selectedReportType === "summary" ? "text-white" : "text-blue-500"}`} />
              <span className={`text-sm font-medium ${selectedReportType === "summary" ? "text-white" : "text-blue-700 dark:text-blue-300"}`}>Summary</span>
            </div>
            <div
              onClick={() => setSelectedReportType("trends")}
              className={`cursor-pointer rounded-xl p-4 flex flex-col items-center gap-2 transition-all border-2 ${
                selectedReportType === "trends"
                  ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                  : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400"
              }`}
              data-testid="button-report-trends"
            >
              <TrendingUp className={`w-6 h-6 ${selectedReportType === "trends" ? "text-white" : "text-emerald-500"}`} />
              <span className={`text-sm font-medium ${selectedReportType === "trends" ? "text-white" : "text-emerald-700 dark:text-emerald-300"}`}>Trends</span>
            </div>
            <div
              onClick={() => setSelectedReportType("comparison")}
              className={`cursor-pointer rounded-xl p-4 flex flex-col items-center gap-2 transition-all border-2 ${
                selectedReportType === "comparison"
                  ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/25"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:border-amber-400"
              }`}
              data-testid="button-report-comparison"
            >
              <GitCompare className={`w-6 h-6 ${selectedReportType === "comparison" ? "text-white" : "text-amber-500"}`} />
              <span className={`text-sm font-medium ${selectedReportType === "comparison" ? "text-white" : "text-amber-700 dark:text-amber-300"}`}>Comparison</span>
            </div>
            <div
              onClick={() => setSelectedReportType("charts")}
              className={`cursor-pointer rounded-xl p-4 flex flex-col items-center gap-2 transition-all border-2 ${
                selectedReportType === "charts"
                  ? "bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/25"
                  : "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 hover:border-purple-400"
              }`}
              data-testid="button-report-charts"
            >
              <PieChart className={`w-6 h-6 ${selectedReportType === "charts" ? "text-white" : "text-purple-500"}`} />
              <span className={`text-sm font-medium ${selectedReportType === "charts" ? "text-white" : "text-purple-700 dark:text-purple-300"}`}>Charts</span>
            </div>
          </div>

          <div className="pt-3 border-t border-dashed">
            <p className="text-xs text-muted-foreground mb-2">Need custom visualizations for management reporting?</p>
            <Link href="/visualize">
              <Button variant="outline" size="sm" className="w-full gap-2" data-testid="button-custom-charts">
                <BarChart3 className="w-4 h-4" />
                Create Custom Charts (Bar, Line, Pie, Area)
              </Button>
            </Link>
          </div>

          <Button 
            onClick={handleGenerateReport}
            disabled={reportMutation.isPending || !selectedAssetId}
            className="w-full gap-2"
            data-testid="button-generate-report"
          >
            {reportMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Report...
              </>
            ) : !selectedAssetId ? (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                Select a file first
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Report Results */}
      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Report Generated
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.charts && report.charts.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Charts</p>
                <div className="flex flex-wrap gap-2">
                  {report.charts.map((chart, i) => (
                    <Badge key={i} variant="secondary">{chart.title}</Badge>
                  ))}
                </div>
              </div>
            )}
            {report.insights && report.insights.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  Key Insights
                </p>
                <div className="space-y-2">
                  {report.insights.map((insight, i) => (
                    <div key={i} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{typeof insight === 'string' ? insight : insight.title}</p>
                      {typeof insight !== 'string' && insight.description && (
                        <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{insight.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-medium mb-2">Summary</p>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                {report.report}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {reportMutation.error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {reportMutation.error.message}
        </div>
      )}
    </div>
  );
}

function BulkUploadTab({ hasAdvancedPlan }: { hasAdvancedPlan: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Files className="w-5 h-5 text-blue-500" />
              Bulk Upload & Analysis
            </CardTitle>
            <CardDescription>
              Process multiple files at once for combined insights
            </CardDescription>
          </div>
          <Badge variant="secondary">Coming Soon</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center opacity-50 cursor-not-allowed"
        >
          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Drop multiple Excel files here</p>
          <p className="text-sm text-muted-foreground">Upload up to 10 files at once</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload multiple Excel files and get comprehensive cross-file analysis.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              Upload 10+ files at once for batch processing
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              Cross-file comparison and consolidated insights
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              Perfect for quarterly reviews and multi-project analysis
            </li>
          </ul>
        </div>

        {!hasAdvancedPlan && (
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 text-center">
            <Lock className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Available in Advanced & Max Plans
            </p>
            <Link href="/pricing">
              <Button size="sm" className="gap-2" data-testid="button-upgrade-bulk">
                <Sparkles className="w-3 h-3" />
                View Plans
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CustomWorkflowsTab({ hasAdvancedPlan }: { hasAdvancedPlan: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Custom Analysis Workflows
            </CardTitle>
            <CardDescription>
              Create templates for reusable analysis
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary">Coming Soon</Badge>
            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-0 text-xs">Max Only</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center opacity-50 cursor-not-allowed"
        >
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Create a new workflow template</p>
          <p className="text-sm text-muted-foreground">Define custom analysis steps</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Build reusable analysis templates for recurring reports.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              Save analysis templates for one-click reuse
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              Chain multiple analysis steps together
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              Share workflows with your team
            </li>
          </ul>
        </div>

        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-4 text-center">
          <Lock className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            Exclusive to Max Plan
          </p>
          <Link href="/pricing">
            <Button size="sm" className="gap-2" data-testid="button-upgrade-workflows">
              <Sparkles className="w-3 h-3" />
              View Plans
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduledReportsTab({ hasAdvancedPlan }: { hasAdvancedPlan: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Scheduled Reports
            </CardTitle>
            <CardDescription>
              Automated insights delivered on your schedule
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary">Coming Soon</Badge>
            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-0 text-xs">Max Only</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center opacity-50 cursor-not-allowed"
        >
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Schedule a new report</p>
          <p className="text-sm text-muted-foreground">Set up automated report delivery</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Set up automated reports that run on your schedule.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              Daily, weekly, or monthly report schedules
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              Email delivery with PDF attachments
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              Track changes and trends over time automatically
            </li>
          </ul>
        </div>

        <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-lg p-4 text-center">
          <Lock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            Exclusive to Max Plan
          </p>
          <Link href="/pricing">
            <Button size="sm" className="gap-2" data-testid="button-upgrade-scheduled">
              <Sparkles className="w-3 h-3" />
              View Plans
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TrainingExportTab({ hasAdvancedPlan }: { hasAdvancedPlan: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-500" />
              Training Data Export
            </CardTitle>
            <CardDescription>
              Export your data for AI model training
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary">Coming Soon</Badge>
            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-0 text-xs">Max Only</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center opacity-50 cursor-not-allowed"
        >
          <Database className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Configure data export</p>
          <p className="text-sm text-muted-foreground">Select data format and schema</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Export structured data for training your own AI models.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
              Export Q&A pairs in training-ready formats
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
              JSONL, CSV, and custom schema exports
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
              Fine-tune models with your organization's knowledge
            </li>
          </ul>
        </div>

        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-4 text-center">
          <Lock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            Exclusive to Max Plan
          </p>
          <Link href="/pricing">
            <Button size="sm" className="gap-2" data-testid="button-upgrade-export">
              <Sparkles className="w-3 h-3" />
              View Plans
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
