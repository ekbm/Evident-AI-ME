import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User, Users, Building2, Loader2 } from "lucide-react";

interface GovernanceOwner {
  id: string;
  ownerType: "SYSTEM" | "USER" | "TEAM";
  displayName: string;
  email: string | null;
  createdAt: string;
}

interface OwnerAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentIds: string[];
  documentName?: string;
  onSuccess?: () => void;
}

export function OwnerAssignmentModal({
  open,
  onOpenChange,
  documentIds,
  documentName,
  onSuccess,
}: OwnerAssignmentModalProps) {
  const { toast } = useToast();
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [newOwnerMode, setNewOwnerMode] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerType, setNewOwnerType] = useState<"USER" | "TEAM">("USER");

  const { data: owners, isLoading: loadingOwners } = useQuery<GovernanceOwner[]>({
    queryKey: ["/api/owners"],
    enabled: open,
  });

  const assignMutation = useMutation({
    mutationFn: async (data: { ownerId: string; ownerType: string; ownerDisplayName: string }) => {
      if (documentIds.length === 1) {
        const res = await apiRequest("POST", `/api/documents/${documentIds[0]}/assign-owner`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/documents/assign-owner-bulk`, {
          documentIds,
          ...data,
        });
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/readiness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owners"] });
      toast({
        title: "Owner Assigned",
        description: documentIds.length === 1 
          ? "Document owner has been updated." 
          : `${documentIds.length} documents have been assigned.`,
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Assignment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAssign = () => {
    if (newOwnerMode) {
      if (!newOwnerName.trim()) {
        toast({
          title: "Name Required",
          description: "Please enter a name for the new owner.",
          variant: "destructive",
        });
        return;
      }
      const newId = `new_${Date.now()}`;
      assignMutation.mutate({
        ownerId: newId,
        ownerType: newOwnerType,
        ownerDisplayName: newOwnerName.trim(),
      });
    } else {
      if (!selectedOwnerId) {
        toast({
          title: "Selection Required",
          description: "Please select an owner.",
          variant: "destructive",
        });
        return;
      }
      const owner = owners?.find((o) => o.id === selectedOwnerId);
      assignMutation.mutate({
        ownerId: selectedOwnerId,
        ownerType: owner?.ownerType || "USER",
        ownerDisplayName: owner?.displayName || selectedOwnerId,
      });
    }
  };

  useEffect(() => {
    if (!open) {
      setSelectedOwnerId("");
      setNewOwnerMode(false);
      setNewOwnerName("");
      setNewOwnerType("USER");
    }
  }, [open]);

  const getOwnerIcon = (type: string) => {
    switch (type) {
      case "SYSTEM":
        return <Building2 className="w-4 h-4" />;
      case "TEAM":
        return <Users className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const filteredOwners = owners?.filter((o) => o.ownerType !== "SYSTEM") || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Owner</DialogTitle>
          <DialogDescription>
            {documentIds.length === 1 && documentName
              ? `Assign an owner to "${documentName}"`
              : `Assign an owner to ${documentIds.length} document${documentIds.length > 1 ? "s" : ""}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!newOwnerMode ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="owner-select">Select Owner</Label>
                {loadingOwners ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading owners...
                  </div>
                ) : (
                  <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                    <SelectTrigger id="owner-select" data-testid="select-owner">
                      <SelectValue placeholder="Choose an owner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredOwners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id} data-testid={`option-owner-${owner.id}`}>
                          <div className="flex items-center gap-2">
                            {getOwnerIcon(owner.ownerType)}
                            <span>{owner.displayName}</span>
                            <Badge variant="outline" className="ml-auto text-xs">
                              {owner.ownerType}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="text-center text-sm text-muted-foreground">or</div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setNewOwnerMode(true)}
                data-testid="button-create-new-owner"
              >
                Create New Owner
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-owner-name">Owner Name</Label>
                <Input
                  id="new-owner-name"
                  placeholder="e.g., John Smith or Legal Team"
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  data-testid="input-new-owner-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-type">Owner Type</Label>
                <Select value={newOwnerType} onValueChange={(v) => setNewOwnerType(v as "USER" | "TEAM")}>
                  <SelectTrigger id="owner-type" data-testid="select-owner-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>Individual User</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="TEAM">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>Team / Department</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setNewOwnerMode(false)}
                data-testid="button-back-to-select"
              >
                Back to Select Existing
              </Button>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-assign">
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={assignMutation.isPending}
            data-testid="button-confirm-assign"
          >
            {assignMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Assign Owner
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
