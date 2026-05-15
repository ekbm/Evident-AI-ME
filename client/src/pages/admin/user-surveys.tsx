import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, MessageSquare, TrendingUp, Users, GraduationCap, ThumbsUp } from "lucide-react";
import { format } from "date-fns";

interface FeedbackEntry {
  id: string;
  userId: string;
  email: string | null;
  surveyType: string;
  rating: number | null;
  mostUsedFeature: string | null;
  missingFeature: string | null;
  studyImpact: string | null;
  wouldRecommend: boolean | null;
  upgradeInterest: string | null;
  freeformComment: string | null;
  daysSinceSignup: number | null;
  trialDaysRemaining: number | null;
  isStudent: boolean;
  createdAt: string;
}

interface FeedbackStats {
  totalResponses: number;
  averageRating: number;
  studentResponses: number;
  wouldRecommend: number;
}

const featureLabels: Record<string, string> = {
  document_qa: "Document Q&A",
  deep_research: "Research Mode",
  exam_prep: "Exam Prep",
  knowledge_base: "Knowledge Base",
  grading: "Grading",
  community: "Community Knowledge",
  other: "Other",
};

const studyImpactLabels: Record<string, string> = {
  very_helpful: "Very helpful",
  somewhat_helpful: "Somewhat helpful",
  neutral: "Neutral",
  not_helpful: "Not helpful yet",
};

const upgradeLabels: Record<string, string> = {
  very_likely: "Very likely",
  likely: "Likely",
  maybe: "Maybe",
  unlikely: "Unlikely",
  need_more_info: "Need more info",
};

const surveyTypeBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  periodic: { label: "Periodic", variant: "secondary" },
  student: { label: "Student", variant: "default" },
  conversion: { label: "Conversion", variant: "outline" },
};

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`}
        />
      ))}
    </div>
  );
}

export default function AdminUserSurveys() {
  const { data, isLoading } = useQuery<{
    feedback: FeedbackEntry[];
    stats: FeedbackStats;
    pagination: { page: number; limit: number; total: number };
  }>({
    queryKey: ["/api/admin/feedback"],
  });

  const feedback = data?.feedback || [];
  const stats = data?.stats;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild data-testid="button-back-admin">
          <Link href="/admin">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">User Surveys</h1>
          <p className="text-sm text-muted-foreground">Periodic feedback from users (collected every 10 days)</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Total Responses</p>
              </div>
              <p className="text-2xl font-bold" data-testid="text-total-responses">{stats.totalResponses}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-4 h-4 text-amber-400" />
                <p className="text-sm text-muted-foreground">Avg Rating</p>
              </div>
              <p className="text-2xl font-bold" data-testid="text-avg-rating">{stats.averageRating}/5</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Student Responses</p>
              </div>
              <p className="text-2xl font-bold" data-testid="text-student-responses">{stats.studentResponses}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <ThumbsUp className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Would Recommend</p>
              </div>
              <p className="text-2xl font-bold" data-testid="text-would-recommend">
                {stats.totalResponses > 0 ? Math.round((stats.wouldRecommend / stats.totalResponses) * 100) : 0}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading surveys...</div>
      )}

      {!isLoading && feedback.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No survey responses yet. Surveys appear after users have been active for at least 3 days.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {feedback.map((entry) => {
          const badge = surveyTypeBadge[entry.surveyType] || surveyTypeBadge.periodic;
          return (
            <Card key={entry.id} data-testid={`card-feedback-${entry.id}`}>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    {entry.isStudent && (
                      <Badge variant="secondary" className="text-amber-600 dark:text-amber-400 bg-amber-500/10">
                        <GraduationCap className="w-3 h-3 mr-1" />
                        Student
                      </Badge>
                    )}
                    {entry.rating && <StarDisplay rating={entry.rating} />}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {entry.createdAt ? format(new Date(entry.createdAt), "MMM d, yyyy h:mm a") : ""}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {entry.email && (
                    <div>
                      <span className="text-muted-foreground">Email: </span>
                      <span className="font-medium">{entry.email}</span>
                    </div>
                  )}
                  {entry.mostUsedFeature && (
                    <div>
                      <span className="text-muted-foreground">Most used: </span>
                      <span>{featureLabels[entry.mostUsedFeature] || entry.mostUsedFeature}</span>
                    </div>
                  )}
                  {entry.studyImpact && (
                    <div>
                      <span className="text-muted-foreground">Study impact: </span>
                      <span>{studyImpactLabels[entry.studyImpact] || entry.studyImpact}</span>
                    </div>
                  )}
                  {entry.wouldRecommend !== null && (
                    <div>
                      <span className="text-muted-foreground">Would recommend: </span>
                      <span>{entry.wouldRecommend ? "Yes" : "Not yet"}</span>
                    </div>
                  )}
                  {entry.upgradeInterest && (
                    <div>
                      <span className="text-muted-foreground">Upgrade interest: </span>
                      <span>{upgradeLabels[entry.upgradeInterest] || entry.upgradeInterest}</span>
                    </div>
                  )}
                  {entry.daysSinceSignup !== null && (
                    <div>
                      <span className="text-muted-foreground">Day {entry.daysSinceSignup}</span>
                      {entry.trialDaysRemaining !== null && (
                        <span className="text-muted-foreground"> ({entry.trialDaysRemaining}d trial left)</span>
                      )}
                    </div>
                  )}
                </div>

                {entry.missingFeature && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Missing feature: </span>
                    <span>{entry.missingFeature}</span>
                  </div>
                )}
                {entry.freeformComment && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Comment: </span>
                    <span>{entry.freeformComment}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
