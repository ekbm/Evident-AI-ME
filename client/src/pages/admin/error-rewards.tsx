import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gift, CheckCircle2, Clock, AlertTriangle, TrendingDown, Plus, Percent } from "lucide-react";
import { format } from "date-fns";

interface ErrorReward {
  id: string;
  userId: string | null;
  sessionId: string | null;
  rewardType: 'bonus_uploads' | 'discount_code';
  rewardValue: string;
  errorType: string;
  errorMessage: string | null;
  claimed: boolean;
  claimedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

interface RewardStats {
  total: number;
  claimed: number;
  bonusUploads: number;
  discountCodes: number;
  byErrorType: { errorType: string; count: number }[];
}

const errorTypeLabels: Record<string, { label: string; color: string }> = {
  file_size: { label: "File Size", color: "text-amber-600" },
  file_format: { label: "File Format", color: "text-blue-600" },
  network: { label: "Network Error", color: "text-red-600" },
  protected_file: { label: "Protected File", color: "text-purple-600" },
  processing_error: { label: "Processing Error", color: "text-orange-600" },
};

export default function AdminErrorRewardsPage() {
  const { data: rewards = [], isLoading } = useQuery<ErrorReward[]>({
    queryKey: ["/api/error-rewards"],
  });

  const { data: stats } = useQuery<RewardStats>({
    queryKey: ["/api/error-rewards/stats"],
  });

  const claimRate = stats && stats.total > 0 
    ? ((stats.claimed / stats.total) * 100).toFixed(1) 
    : "0";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="self-start" data-testid="button-back-admin">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Admin Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">Error Rewards</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Track rewards given for errors - reduce errors to reduce rewards
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-bold" data-testid="text-total-rewards">{stats?.total || 0}</div>
              </div>
              <div className="text-sm text-muted-foreground">Total Rewards</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div className="text-2xl font-bold text-green-600" data-testid="text-claimed">{stats?.claimed || 0}</div>
              </div>
              <div className="text-sm text-muted-foreground">Claimed ({claimRate}%)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                <div className="text-2xl font-bold text-blue-600" data-testid="text-bonus-uploads">{stats?.bonusUploads || 0}</div>
              </div>
              <div className="text-sm text-muted-foreground">Bonus Uploads</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-amber-600" />
                <div className="text-2xl font-bold text-amber-600" data-testid="text-discount-codes">{stats?.discountCodes || 0}</div>
              </div>
              <div className="text-sm text-muted-foreground">Discount Codes</div>
            </CardContent>
          </Card>
        </div>

        {stats && stats.byErrorType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="h-4 w-4" />
                Errors to Fix (Most Common First)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.byErrorType.map((item) => {
                  const config = errorTypeLabels[item.errorType] || { label: item.errorType, color: "text-muted-foreground" };
                  const percentage = ((item.count / stats.total) * 100).toFixed(0);
                  return (
                    <div key={item.errorType} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`h-4 w-4 ${config.color}`} />
                        <div>
                          <span className="font-medium">{config.label}</span>
                          <p className="text-xs text-muted-foreground">
                            Fix this to reduce {percentage}% of rewards
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-lg px-3">
                        {item.count}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Rewards</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : rewards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No rewards issued yet - that's a good thing!
              </div>
            ) : (
              <div className="space-y-3">
                {rewards.slice(0, 50).map((reward) => {
                  const config = errorTypeLabels[reward.errorType] || { label: reward.errorType, color: "text-muted-foreground" };
                  const isExpired = new Date(reward.expiresAt) < new Date();

                  return (
                    <div
                      key={reward.id}
                      className={`p-3 rounded-lg border ${reward.claimed ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-card'}`}
                      data-testid={`card-reward-${reward.id}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          {reward.rewardType === 'bonus_uploads' ? (
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                              <Plus className="w-4 h-4 text-blue-600" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                              <Percent className="w-4 h-4 text-amber-600" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {reward.rewardType === 'bonus_uploads' 
                                  ? `+${reward.rewardValue} Uploads` 
                                  : reward.rewardValue}
                              </span>
                              {reward.claimed ? (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Claimed
                                </Badge>
                              ) : isExpired ? (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Expired
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span className={config.color}>{config.label}</span>
                              <span>-</span>
                              <span>{format(new Date(reward.createdAt), "MMM d, h:mm a")}</span>
                            </div>
                          </div>
                        </div>
                        {reward.userId && (
                          <div className="text-xs text-muted-foreground">
                            User: {reward.userId.slice(0, 8)}...
                          </div>
                        )}
                      </div>
                      {reward.errorMessage && (
                        <p className="text-xs text-muted-foreground mt-2 pl-11 truncate">
                          {reward.errorMessage}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
