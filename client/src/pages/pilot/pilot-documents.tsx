import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Shield,
  FlaskConical,
  ScanLine,
  UserCheck,
  Sparkles,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OwnerAssignmentModal } from "@/components/owner-assignment-modal";

interface PilotDocument {
  id: string;
  filename: string;
  sizeBytes: number;
  status: string;
  addedAt: string;
  readinessScore: number | null;
  readinessStatus: string | null;
  lastScannedAt: string | null;
  ownerDisplayName: string;
  ownerBucket: "ASSIGNED" | "INTAKE_UNASSIGNED";
}

export default function PilotDocuments() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery<PilotDocument[]>({
    queryKey: ["/api/pilot/documents"],
  });

  const scanMutation = useMutation({
    mutationFn: async (assetIds: string[]) => {
      const results = await Promise.all(
        assetIds.map(id => 
          apiRequest("POST", "/api/readiness/scan", { assetId: id })
            .then(r => r.json())
            .catch(() => null)
        )
      );
      return results.filter(Boolean);
    },
    onSuccess: (results) => {
      toast({ title: "Scans completed", description: `Scanned ${results.length} documents` });
      queryClient.invalidateQueries({ queryKey: ["/api/pilot/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pilot"] });
      setSelectedIds([]);
    },
  });

  const filteredDocs = documents.filter(doc => {
    if (statusFilter !== "all") {
      if (statusFilter === "NOT_SCANNED" && doc.readinessStatus !== null) return false;
      if (statusFilter !== "NOT_SCANNED" && doc.readinessStatus !== statusFilter) return false;
    }
    if (ownerFilter === "intake" && doc.ownerBucket !== "INTAKE_UNASSIGNED") return false;
    if (ownerFilter === "assigned" && doc.ownerBucket !== "ASSIGNED") return false;
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredDocs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDocs.map(d => d.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getStatusBadge = (doc: PilotDocument) => {
    if (doc.readinessStatus === null) {
      return <Badge variant="outline">NOT SCANNED</Badge>;
    }
    if (doc.readinessStatus === "READY") {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">READY</Badge>;
    }
    if (doc.readinessStatus === "NEEDS_PREP") {
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">NEEDS PREP</Badge>;
    }
    return <Badge variant="destructive">MANUAL</Badge>;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
          <Button variant="ghost" size="sm" asChild className="self-start" data-testid="button-back">
            <Link href="/pilot">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-chart-4 shrink-0" />
              <h1 className="text-xl sm:text-2xl font-bold">Pilot Documents</h1>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage documents in your AI pilot scope
            </p>
          </div>
        </div>

        <Alert className="mb-6 border-chart-4/30 bg-chart-4/5">
          <Shield className="h-4 w-4 text-chart-4" />
          <AlertDescription>
            This pilot is isolated. Documents here are not used outside this pilot.
          </AlertDescription>
        </Alert>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="NOT_SCANNED">Not Scanned</SelectItem>
                    <SelectItem value="READY">Ready</SelectItem>
                    <SelectItem value="NEEDS_PREP">Needs Prep</SelectItem>
                    <SelectItem value="MANUAL">Manual</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="w-40" data-testid="select-owner-filter">
                    <SelectValue placeholder="Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Owners</SelectItem>
                    <SelectItem value="intake">Intake (Unassigned)</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => scanMutation.mutate(selectedIds)}
                    disabled={scanMutation.isPending}
                    data-testid="button-bulk-scan"
                  >
                    <ScanLine className="w-4 h-4 mr-2" />
                    Run Scan
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setShowOwnerModal(true)}
                    data-testid="button-bulk-assign-owner"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Assign Owner
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No documents in pilot</p>
                <Button asChild className="mt-4">
                  <Link href="/">Upload Documents</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground border-b">
                  <Checkbox 
                    checked={selectedIds.length === filteredDocs.length && filteredDocs.length > 0}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                  <span className="flex-1">Document</span>
                  <span className="w-24 text-center">Score</span>
                  <span className="w-28 text-center">Status</span>
                  <span className="w-40">Owner</span>
                </div>

                {filteredDocs.map(doc => (
                  <div 
                    key={doc.id} 
                    className="flex items-center gap-3 px-3 py-3 rounded-md hover-elevate"
                    data-testid={`row-document-${doc.id}`}
                  >
                    <Checkbox 
                      checked={selectedIds.includes(doc.id)}
                      onCheckedChange={() => toggleSelect(doc.id)}
                      data-testid={`checkbox-${doc.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(doc.sizeBytes)}</p>
                    </div>
                    <div className="w-24 text-center">
                      {doc.readinessScore !== null ? (
                        <span className="font-medium">{doc.readinessScore}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                    <div className="w-28 text-center">
                      {getStatusBadge(doc)}
                    </div>
                    <div className="w-40 truncate text-sm">
                      {doc.ownerBucket === "INTAKE_UNASSIGNED" ? (
                        <span className="text-muted-foreground">{doc.ownerDisplayName}</span>
                      ) : (
                        <span>{doc.ownerDisplayName}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/pilot">Overview</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/pilot/settings">Settings</Link>
          </Button>
        </div>
      </div>

      <OwnerAssignmentModal
        open={showOwnerModal}
        onOpenChange={setShowOwnerModal}
        documentIds={selectedIds}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/pilot/documents"] });
          setSelectedIds([]);
        }}
      />
    </div>
  );
}
