import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, TrendingUp, ArrowLeft, FileSpreadsheet, Columns, Hash, Type, AlertCircle, Download, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend } from "recharts";
import { apiRequest } from "@/lib/queryClient";
import type { ChartData } from "@shared/schema";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface ColumnInfo {
  sheet: string;
  name: string;
  index: number;
  type: "text" | "numeric";
  sampleValues: (string | number)[];
  uniqueCount: number;
}

interface SheetInfo {
  name: string;
  rowCount: number;
  colCount: number;
}

interface VisualizeData {
  assetId: string;
  filename: string;
  sheets: SheetInfo[];
  columns: ColumnInfo[];
}

interface ChartResponse {
  chart: ChartData;
}

export default function VisualizePage() {
  const [, setLocation] = useLocation();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [labelColumn, setLabelColumn] = useState<string>("");
  const [valueColumn, setValueColumn] = useState<string>("");
  const [chartType, setChartType] = useState<"bar" | "line" | "pie" | "area">("bar");
  const [aggregation, setAggregation] = useState<"count" | "sum">("count");

  const assetsQuery = useQuery<{ id: string; filename: string; status: string; mime: string }[]>({
    queryKey: ["/api/assets"],
  });

  const excelAssets = useMemo(() => {
    if (!assetsQuery.data) return [];
    const excelExtensions = [".xlsx", ".xls", ".xlsm", ".csv"];
    return assetsQuery.data.filter(a => 
      a.status === "READY" && 
      excelExtensions.some(ext => a.filename.toLowerCase().endsWith(ext))
    );
  }, [assetsQuery.data]);

  const visualizeQuery = useQuery<VisualizeData>({
    queryKey: ["/api/visualize", selectedAssetId],
    queryFn: async () => {
      const res = await fetch(`/api/visualize/${selectedAssetId}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to load data");
      }
      return res.json();
    },
    enabled: !!selectedAssetId,
  });

  const chartMutation = useMutation({
    mutationFn: async (params: {
      assetId: string;
      sheetName: string;
      labelColumn: number;
      valueColumn: number | null;
      chartType: string;
      aggregation: string;
    }) => {
      const res = await apiRequest("POST", "/api/visualize/chart", params);
      return res.json() as Promise<ChartResponse>;
    },
  });

  const filteredColumns = useMemo(() => {
    if (!visualizeQuery.data) return [];
    if (!selectedSheet) return visualizeQuery.data.columns;
    return visualizeQuery.data.columns.filter(c => c.sheet === selectedSheet);
  }, [visualizeQuery.data, selectedSheet]);

  const labelColumns = useMemo(() => {
    return filteredColumns.filter(c => c.type === "text" && c.uniqueCount >= 2 && c.uniqueCount <= 100 && c.name);
  }, [filteredColumns]);

  const numericColumns = useMemo(() => {
    return filteredColumns.filter(c => c.type === "numeric" && c.name);
  }, [filteredColumns]);

  const handleGenerateChart = () => {
    if (!selectedAssetId || !labelColumn) return;
    
    const labelCol = filteredColumns.find(c => c.name === labelColumn);
    const valueCol = valueColumn ? filteredColumns.find(c => c.name === valueColumn) : null;
    
    if (!labelCol) return;

    chartMutation.mutate({
      assetId: selectedAssetId,
      sheetName: selectedSheet,
      labelColumn: labelCol.index,
      valueColumn: valueCol?.index ?? null,
      chartType,
      aggregation: valueCol ? "sum" : "count",
    });
  };

  const handleAssetSelect = (assetId: string) => {
    setSelectedAssetId(assetId);
    setSelectedSheet("");
    setLabelColumn("");
    setValueColumn("");
    chartMutation.reset();
  };

  const handleSheetSelect = (sheet: string) => {
    setSelectedSheet(sheet);
    setLabelColumn("");
    setValueColumn("");
    chartMutation.reset();
  };

  // Auto-select first sheet when data loads
  const validSheets = (visualizeQuery.data?.sheets || []).filter(s => s.name);
  if (visualizeQuery.data && !selectedSheet && validSheets.length > 0) {
    setSelectedSheet(validSheets[0].name);
  }

  const chartData = chartMutation.data?.chart;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="self-start"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-chart-1 to-chart-2 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              Visualization Tool
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Create custom charts from your Excel data
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-chart-1" />
                Data Source
              </CardTitle>
              <CardDescription>Select an Excel file to visualize</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Excel File</Label>
                <Select
                  value={selectedAssetId || ""}
                  onValueChange={handleAssetSelect}
                  data-testid="select-asset"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a file..." />
                  </SelectTrigger>
                  <SelectContent>
                    {excelAssets.map(asset => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.filename}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {excelAssets.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No Excel files found. Upload an Excel file first.
                  </p>
                )}
              </div>

              {visualizeQuery.isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-chart-1" />
                </div>
              )}

              {visualizeQuery.isError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{(visualizeQuery.error as Error).message}</span>
                </div>
              )}

              {visualizeQuery.data && (
                <>
                  <div className="space-y-2">
                    <Label>Sheet</Label>
                    <Select
                      value={selectedSheet}
                      onValueChange={handleSheetSelect}
                      data-testid="select-sheet"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a sheet..." />
                      </SelectTrigger>
                      <SelectContent>
                        {visualizeQuery.data.sheets.filter(s => s.name).map(sheet => (
                          <SelectItem key={sheet.name} value={sheet.name}>
                            {sheet.name} ({sheet.rowCount} rows)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Type className="w-4 h-4" />
                      Category Column (X-axis)
                    </Label>
                    <Select
                      value={labelColumn}
                      onValueChange={setLabelColumn}
                      data-testid="select-label-column"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {labelColumns.map(col => (
                          <SelectItem key={`${col.sheet}-${col.name}`} value={col.name}>
                            <div className="flex items-center gap-2">
                              <span>{col.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {col.uniqueCount} unique
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {labelColumns.length === 0 && selectedSheet && (
                      <p className="text-xs text-muted-foreground">
                        No suitable text columns found in this sheet.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Hash className="w-4 h-4" />
                      Value Column (Y-axis, optional)
                    </Label>
                    <Select
                      value={valueColumn || "__count__"}
                      onValueChange={(val) => setValueColumn(val === "__count__" ? "" : val)}
                      data-testid="select-value-column"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Count occurrences (default)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__count__">Count occurrences</SelectItem>
                        {numericColumns.map(col => (
                          <SelectItem key={`${col.sheet}-${col.name}`} value={col.name}>
                            Sum: {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Chart Type</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { type: "bar", icon: BarChart3, label: "Bar" },
                        { type: "line", icon: LineChartIcon, label: "Line" },
                        { type: "pie", icon: PieChartIcon, label: "Pie" },
                        { type: "area", icon: TrendingUp, label: "Area" },
                      ].map(({ type, icon: Icon, label }) => (
                        <Button
                          key={type}
                          variant={chartType === type ? "default" : "outline"}
                          size="sm"
                          onClick={() => setChartType(type as typeof chartType)}
                          className="flex flex-col gap-1 h-auto py-2"
                          data-testid={`button-chart-${type}`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-xs">{label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateChart}
                    disabled={!labelColumn || chartMutation.isPending}
                    className="w-full bg-gradient-to-r from-chart-1 to-chart-2"
                    data-testid="button-generate-chart"
                  >
                    {chartMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Generate Chart
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Columns className="w-5 h-5 text-chart-2" />
                Chart Preview
              </CardTitle>
              <CardDescription>
                {chartData ? chartData.title : "Select columns and generate a chart"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartMutation.isError && (
                <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <span>{(chartMutation.error as Error).message}</span>
                </div>
              )}

              {!chartData && !chartMutation.isPending && !chartMutation.isError && (
                <div className="h-80 flex flex-col items-center justify-center text-muted-foreground">
                  <BarChart3 className="w-16 h-16 mb-4 opacity-30" />
                  <p>Your chart will appear here</p>
                  <p className="text-sm">Select a file and columns, then click Generate</p>
                </div>
              )}

              {chartMutation.isPending && (
                <div className="h-80 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-chart-1" />
                </div>
              )}

              {chartData && (
                <div className="space-y-4">
                  <div className="h-80" data-testid="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartData.type === "bar" ? (
                        <BarChart data={chartData.data.map(d => ({ name: d.label, value: d.value }))}>
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 11 }} 
                            angle={-45} 
                            textAnchor="end" 
                            height={80} 
                          />
                          <YAxis tick={{ fontSize: 11 }} width={60} />
                          <Tooltip formatter={(value: number) => value.toLocaleString()} />
                          <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      ) : chartData.type === "line" ? (
                        <LineChart data={chartData.data.map(d => ({ name: d.label, value: d.value }))}>
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                          <YAxis tick={{ fontSize: 11 }} width={60} />
                          <Tooltip formatter={(value: number) => value.toLocaleString()} />
                          <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-2))" }} />
                        </LineChart>
                      ) : chartData.type === "area" ? (
                        <AreaChart data={chartData.data.map(d => ({ name: d.label, value: d.value }))}>
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                          <YAxis tick={{ fontSize: 11 }} width={60} />
                          <Tooltip formatter={(value: number) => value.toLocaleString()} />
                          <Area type="monotone" dataKey="value" fill="hsl(var(--chart-3))" stroke="hsl(var(--chart-3))" fillOpacity={0.3} />
                        </AreaChart>
                      ) : (
                        <PieChart>
                          <Pie
                            data={chartData.data.map(d => ({ name: d.label, value: d.value }))}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {chartData.data.map((_, idx) => (
                              <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => value.toLocaleString()} />
                          <Legend />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
                    <span>
                      {chartData.xAxisLabel} vs {chartData.yAxisLabel}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateChart}
                        disabled={chartMutation.isPending}
                        data-testid="button-refresh-chart"
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {visualizeQuery.data && filteredColumns.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Available Columns</CardTitle>
              <CardDescription>
                Columns detected in {selectedSheet || "all sheets"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredColumns.slice(0, 12).map(col => (
                  <div
                    key={`${col.sheet}-${col.index}`}
                    className="p-3 rounded-lg border bg-card/50 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{col.name}</span>
                      <Badge variant={col.type === "numeric" ? "default" : "secondary"}>
                        {col.type === "numeric" ? <Hash className="w-3 h-3 mr-1" /> : <Type className="w-3 h-3 mr-1" />}
                        {col.type}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {col.uniqueCount} unique values
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Sample: {col.sampleValues.slice(0, 3).join(", ")}
                    </div>
                  </div>
                ))}
              </div>
              {filteredColumns.length > 12 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  And {filteredColumns.length - 12} more columns...
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
