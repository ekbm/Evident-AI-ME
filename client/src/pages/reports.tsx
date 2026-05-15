import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth, getStoredAuthToken } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useQuery as useQueryEntitlements } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthRequiredMessage } from "@/components/auth-required-message";
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  BarChart3, 
  TrendingUp, 
  GitCompare, 
  PieChart,
  Loader2,
  AlertCircle,
  Crown,
  Lightbulb,
  CheckCircle2,
  FileText,
  Upload,
  Sparkles,
  Download
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart as RechartsPie, Pie, Cell, AreaChart, Area, CartesianGrid, Legend } from "recharts";
import type { Asset, ExcelReportResponse, ChartData } from "@shared/schema";

const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function ExcelChart({ chart, index }: { chart: ChartData; index: number }) {
  const data = chart.data || [];
  
  if (data.length === 0) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg text-center text-muted-foreground text-sm">
        No data available for chart
      </div>
    );
  }

  const axisStyle = { fontSize: 12, fontWeight: 600 };
  const tooltipStyle = { backgroundColor: '#ffffff', color: '#000000', border: '1px solid #d1d5db', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' };
  const gridStyle = { strokeDasharray: '3 3', stroke: '#e5e7eb' };

  const renderChart = () => {
    switch (chart.type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 30 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="label" tick={{ ...axisStyle, fill: '#000000' }} tickLine={{ stroke: '#6b7280' }} axisLine={{ stroke: '#6b7280', strokeWidth: 2 }} />
              <YAxis tick={{ ...axisStyle, fill: '#000000' }} tickLine={{ stroke: '#6b7280' }} axisLine={{ stroke: '#6b7280', strokeWidth: 2 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#000000', fontWeight: 700 }} itemStyle={{ color: '#000000' }} />
              <Legend wrapperStyle={{ color: '#000000' }} />
              <Bar dataKey="value" name="Value" fill={CHART_COLORS[index % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 30 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="label" tick={{ ...axisStyle, fill: '#000000' }} tickLine={{ stroke: '#6b7280' }} axisLine={{ stroke: '#6b7280', strokeWidth: 2 }} />
              <YAxis tick={{ ...axisStyle, fill: '#000000' }} tickLine={{ stroke: '#6b7280' }} axisLine={{ stroke: '#6b7280', strokeWidth: 2 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#000000', fontWeight: 700 }} itemStyle={{ color: '#000000' }} />
              <Legend wrapperStyle={{ color: '#000000' }} />
              <Line type="monotone" dataKey="value" name="Value" stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={3} dot={{ fill: CHART_COLORS[index % CHART_COLORS.length], r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <RechartsPie>
              <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={{ fontSize: 12, fontWeight: 600, fill: '#000000' }} labelLine={{ stroke: '#6b7280' }}>
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#ffffff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#000000', fontWeight: 700 }} itemStyle={{ color: '#000000' }} />
              <Legend wrapperStyle={{ color: '#000000' }} />
            </RechartsPie>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 30 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="label" tick={{ ...axisStyle, fill: '#000000' }} tickLine={{ stroke: '#6b7280' }} axisLine={{ stroke: '#6b7280', strokeWidth: 2 }} />
              <YAxis tick={{ ...axisStyle, fill: '#000000' }} tickLine={{ stroke: '#6b7280' }} axisLine={{ stroke: '#6b7280', strokeWidth: 2 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#000000', fontWeight: 700 }} itemStyle={{ color: '#000000' }} />
              <Legend wrapperStyle={{ color: '#000000' }} />
              <Area type="monotone" dataKey="value" name="Value" fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.4} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-5 rounded-lg border-2 border-gray-300 shadow-md" style={{ backgroundColor: '#ffffff' }}>
      {chart.title && <p className="text-base font-bold mb-4" style={{ color: '#000000' }}>{chart.title}</p>}
      <style>{`
        .recharts-text, .recharts-cartesian-axis-tick-value {
          fill: #000000 !important;
          font-weight: 600 !important;
        }
        .recharts-label, .recharts-legend-item-text {
          fill: #000000 !important;
          color: #000000 !important;
        }
        .recharts-default-legend {
          color: #000000 !important;
        }
      `}</style>
      <div>
        {renderChart()}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  useDocumentTitle("Create Report");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { data: usageData, isLoading: usageLoading } = useQueryEntitlements<{ planDetails?: { excelReportsAllowed?: boolean } }>({
    queryKey: ["/api/usage"],
    enabled: isAuthenticated,
  });
  const excelReportsAllowed = usageData?.planDetails?.excelReportsAllowed ?? false;
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [reportType, setReportType] = useState<string>("summary");
  const [report, setReport] = useState<ExcelReportResponse | null>(null);
  const [fileTab, setFileTab] = useState<string>("existing");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: assetsData, isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    enabled: isAuthenticated,
  });

  const excelFiles = (assetsData || []).filter(asset => {
    const ext = asset.filename.toLowerCase();
    return asset.status === "READY" && (ext.endsWith(".xlsx") || ext.endsWith(".xls") || ext.endsWith(".csv"));
  });

  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls") && !ext.endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel file (.xlsx, .xls) or CSV file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const authToken = getStoredAuthToken();
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: authToken ? { "X-Auth-Token": authToken } : undefined,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      
      if (result.asset?.id) {
        setSelectedAssetId(result.asset.id);
        setFileTab("existing");
        toast({
          title: "File uploaded",
          description: "Your file is being processed. Select it when ready.",
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const generateMutation = useMutation({
    mutationFn: async ({ assetId, type }: { assetId: string; type: string }) => {
      const response = await apiRequest("POST", "/api/actions/excel-report", {
        assetId,
        reportType: type,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setReport(data);
    },
  });

  const handleGenerate = () => {
    if (selectedAssetId) {
      setReport(null);
      generateMutation.mutate({ assetId: selectedAssetId, type: reportType });
    }
  };

  const selectedFile = excelFiles.find(f => f.id?.toString() === selectedAssetId);

  if (authLoading || (isAuthenticated && usageLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12 pb-32 sm:pb-12">
          <Skeleton className="h-10 w-48 mb-8" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12 pb-32 sm:pb-12">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-8">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Create Report</h1>
              <p className="text-muted-foreground">Generate insights from your Excel files</p>
            </div>
          </div>
          <AuthRequiredMessage />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-background to-blue-50/30 dark:from-emerald-950/20 dark:via-background dark:to-blue-950/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-44 sm:pb-12">
        <div className="mb-6">
          <Link href="/full">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Workspace
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Create Report</h1>
            <p className="text-muted-foreground">Generate insights from your Excel files</p>
          </div>
        </div>

        <Card className="mb-6 border-chart-1/20 bg-chart-1/5">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <Lightbulb className="w-5 h-5 text-chart-1 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">How this works</p>
                <p className="text-muted-foreground">
                  You can always upload Excel files and ask specific questions for free. Create Report is a premium feature that automatically analyzes your entire spreadsheet and generates a comprehensive report with charts, summaries, and key insights — no questions needed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {!excelReportsAllowed ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-8 text-center">
              <Crown className="w-12 h-12 text-chart-4 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Premium Feature</h3>
              <p className="text-muted-foreground mb-4">
                Excel Reports is available on Advanced and higher plans.
              </p>
              <Link href="/pricing">
                <Button data-testid="button-upgrade">
                  View Plans
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Direct Upload Section */}
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Upload Excel File</span>
                  <Badge variant="outline" className="text-xs">XLSX, XLS, CSV</Badge>
                </div>
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    data-testid="input-upload-excel"
                  />
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    {isUploading ? (
                      <>
                        <Loader2 className="h-8 w-8 mx-auto text-muted-foreground animate-spin mb-2" />
                        <p className="text-sm font-medium">Uploading...</p>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Drop Excel file here or tap to upload</p>
                        <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls, and .csv files</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Select from Existing */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Select Excel File</span>
                  {selectedAssetId && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">1 selected</Badge>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs"
                        onClick={() => setSelectedAssetId("")}
                        data-testid="button-clear-selection"
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Documents from your main workspace are also available here
                </p>
                {assetsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : excelFiles.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">No Excel files found. Upload above or in your main workspace.</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {excelFiles.map(file => (
                      <div
                        key={file.id}
                        onClick={() => setSelectedAssetId(file.id?.toString() || "")}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover-elevate ${
                          selectedAssetId === file.id?.toString() ? "bg-primary/10" : ""
                        }`}
                        data-testid={`file-item-${file.id}`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedAssetId === file.id?.toString() 
                            ? "border-primary bg-primary" 
                            : "border-muted-foreground/30"
                        }`}>
                          {selectedAssetId === file.id?.toString() && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="text-sm truncate flex-1">{file.filename}</span>
                        <span className="text-xs text-muted-foreground">
                          {(file.sizeBytes / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Report Type - Always visible */}
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
                    onClick={() => setReportType("summary")}
                    className={`cursor-pointer rounded-xl p-4 flex flex-col items-center gap-2 transition-all border-2 ${
                      reportType === "summary"
                        ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/25"
                        : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:border-blue-400"
                    }`}
                    data-testid="button-report-summary"
                  >
                    <BarChart3 className={`w-6 h-6 ${reportType === "summary" ? "text-white" : "text-blue-500"}`} />
                    <span className={`text-sm font-medium ${reportType === "summary" ? "text-white" : "text-blue-700 dark:text-blue-300"}`}>Summary</span>
                  </div>
                  <div
                    onClick={() => setReportType("trends")}
                    className={`cursor-pointer rounded-xl p-4 flex flex-col items-center gap-2 transition-all border-2 ${
                      reportType === "trends"
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                        : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400"
                    }`}
                    data-testid="button-report-trends"
                  >
                    <TrendingUp className={`w-6 h-6 ${reportType === "trends" ? "text-white" : "text-emerald-500"}`} />
                    <span className={`text-sm font-medium ${reportType === "trends" ? "text-white" : "text-emerald-700 dark:text-emerald-300"}`}>Trends</span>
                  </div>
                  <div
                    onClick={() => setReportType("comparison")}
                    className={`cursor-pointer rounded-xl p-4 flex flex-col items-center gap-2 transition-all border-2 ${
                      reportType === "comparison"
                        ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/25"
                        : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:border-amber-400"
                    }`}
                    data-testid="button-report-comparison"
                  >
                    <GitCompare className={`w-6 h-6 ${reportType === "comparison" ? "text-white" : "text-amber-500"}`} />
                    <span className={`text-sm font-medium ${reportType === "comparison" ? "text-white" : "text-amber-700 dark:text-amber-300"}`}>Comparison</span>
                  </div>
                  <div
                    onClick={() => setReportType("graph")}
                    className={`cursor-pointer rounded-xl p-4 flex flex-col items-center gap-2 transition-all border-2 ${
                      reportType === "graph"
                        ? "bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/25"
                        : "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 hover:border-purple-400"
                    }`}
                    data-testid="button-report-graph"
                  >
                    <PieChart className={`w-6 h-6 ${reportType === "graph" ? "text-white" : "text-purple-500"}`} />
                    <span className={`text-sm font-medium ${reportType === "graph" ? "text-white" : "text-purple-700 dark:text-purple-300"}`}>Charts</span>
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
                  className="w-full"
                  size="lg"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending || !selectedAssetId}
                  data-testid="button-generate-report"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Report...
                    </>
                  ) : !selectedAssetId ? (
                    <>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Select a file first
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {generateMutation.error && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">Error generating report</p>
                      <p className="text-sm text-muted-foreground">
                        {(generateMutation.error as any)?.message || "Please try again"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {report && !generateMutation.isPending && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Report Generated
                  </CardTitle>
                </CardHeader>
                
                {/* Download Actions - Prominent Section */}
                <div className="mx-4 mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm font-medium mb-3 text-foreground">Download Your Report</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                        variant="default"
                        size="sm"
                        className="flex-1 sm:flex-none"
                        onClick={() => {
                          const reportTitle = reportType === "summary" ? "Summary Report" : reportType === "trends" ? "Trends Report" : reportType === "comparison" ? "Comparison Report" : "Charts Report";
                          const insightsHtml = report.insights?.map((i) => `
                            <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
                              <p style="font-weight: 600; color: #92400e; margin: 0 0 4px 0;">${i.title}</p>
                              <p style="color: #78350f; margin: 0; font-size: 14px;">${i.description}</p>
                            </div>
                          `).join("") || "<p>No insights available</p>";
                          
                          const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - Evident</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1f2937; line-height: 1.6; }
    h1 { color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
    .summary { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; white-space: pre-wrap; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${reportTitle}</h1>
  <p class="meta">Generated on ${new Date().toLocaleDateString()} by Evident</p>
  
  <h2>Key Insights</h2>
  ${insightsHtml}
  
  <h2>Full Report</h2>
  <div class="summary">${report.report || "No summary available"}</div>
</body>
</html>`;
                          const blob = new Blob([html], { type: "text/html" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `report-${reportType}-${new Date().toISOString().split("T")[0]}.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        data-testid="button-download-html-top"
                      >
                        <Download className="w-4 h-4 mr-1.5" />
                        Download HTML
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none"
                        onClick={() => {
                          const reportTitle = reportType === "summary" ? "Summary Report" : reportType === "trends" ? "Trends Report" : reportType === "comparison" ? "Comparison Report" : "Charts Report";
                          const insightsText = report.insights?.map((i) => `• ${i.title}: ${i.description}`).join("\n") || "No insights available";
                          
                          const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - Evident</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1f2937; line-height: 1.6; }
    h1 { color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
    .insight { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
    .insight-title { font-weight: 600; color: #92400e; margin: 0 0 4px 0; }
    .insight-desc { color: #78350f; margin: 0; font-size: 14px; }
    .summary { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; white-space: pre-wrap; }
    @media print { 
      body { margin: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>${reportTitle}</h1>
  <p class="meta">Generated on ${new Date().toLocaleDateString()} by Evident</p>
  
  <h2>Key Insights</h2>
  ${report.insights?.map((i) => `<div class="insight"><p class="insight-title">${i.title}</p><p class="insight-desc">${i.description}</p></div>`).join("") || "<p>No insights available</p>"}
  
  <h2>Full Report</h2>
  <div class="summary">${report.report || "No summary available"}</div>
  
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
                          const printWindow = window.open('', '_blank');
                          if (printWindow) {
                            printWindow.document.write(printHtml);
                            printWindow.document.close();
                          }
                        }}
                        data-testid="button-print-pdf-top"
                      >
                        <FileText className="w-4 h-4 mr-1.5" />
                        Save as PDF
                      </Button>
                    </div>
                </div>
                
                <CardContent className="space-y-6">
                  {report.charts && report.charts.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <PieChart className="w-4 h-4 text-chart-2" />
                        Generated Charts
                      </div>
                      <div className="grid gap-4">
                        {report.charts.map((chart, i) => (
                          <ExcelChart key={i} chart={chart} index={i} />
                        ))}
                      </div>
                    </div>
                  )}

                  {report.insights && report.insights.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        Key Insights
                      </div>
                      <div className="space-y-2">
                        {report.insights.map((insight, i) => (
                          <div key={i} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{insight.title}</p>
                            <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{insight.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.report && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        Summary
                      </div>
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                        {report.report}
                      </div>
                    </div>
                  )}

                  {/* Export Options - visible at the bottom */}
                  <div className="pt-6 border-t space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Download className="w-4 h-4 text-primary" />
                      Export Report
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const reportTitle = reportType === "summary" ? "Summary Report" : reportType === "trends" ? "Trends Report" : reportType === "comparison" ? "Comparison Report" : "Charts Report";
                          const insightsHtml = report.insights?.map((i) => `
                            <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
                              <p style="font-weight: 600; color: #92400e; margin: 0 0 4px 0;">${i.title}</p>
                              <p style="color: #78350f; margin: 0; font-size: 14px;">${i.description}</p>
                            </div>
                          `).join("") || "<p>No insights available</p>";
                          
                          const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - Evident</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1f2937; line-height: 1.6; }
    h1 { color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
    .summary { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; white-space: pre-wrap; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${reportTitle}</h1>
  <p class="meta">Generated on ${new Date().toLocaleDateString()} by Evident</p>
  
  <h2>Key Insights</h2>
  ${insightsHtml}
  
  <h2>Full Report</h2>
  <div class="summary">${report.report || "No summary available"}</div>
</body>
</html>`;
                          const blob = new Blob([html], { type: "text/html" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `report-${reportType}-${new Date().toISOString().split("T")[0]}.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        data-testid="button-export-html-bottom"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download as HTML
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const reportTitle = reportType === "summary" ? "Summary Report" : reportType === "trends" ? "Trends Report" : reportType === "comparison" ? "Comparison Report" : "Charts Report";
                          const insightsText = report.insights?.map((i) => `• ${i.title}: ${i.description}`).join("\n") || "No insights available";
                          
                          const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - Evident</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1f2937; line-height: 1.6; }
    h1 { color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
    .insight { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
    .insight-title { font-weight: 600; color: #92400e; margin: 0 0 4px 0; }
    .insight-desc { color: #78350f; margin: 0; font-size: 14px; }
    .summary { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; white-space: pre-wrap; }
    @media print { 
      body { margin: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>${reportTitle}</h1>
  <p class="meta">Generated on ${new Date().toLocaleDateString()} by Evident</p>
  
  <h2>Key Insights</h2>
  ${report.insights?.map((i) => `<div class="insight"><p class="insight-title">${i.title}</p><p class="insight-desc">${i.description}</p></div>`).join("") || "<p>No insights available</p>"}
  
  <h2>Full Report</h2>
  <div class="summary">${report.report || "No summary available"}</div>
  
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
                          const printWindow = window.open('', '_blank');
                          if (printWindow) {
                            printWindow.document.write(printHtml);
                            printWindow.document.close();
                          }
                        }}
                        data-testid="button-print-pdf-bottom"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Print / Save as PDF
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tip: To save as PDF, use "Print" and select "Save as PDF" as your printer
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
