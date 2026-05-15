import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, useSearch } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  HelpCircle, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  DollarSign, 
  Scale, 
  Settings, 
  FileText,
  Loader2,
  CheckCircle2,
  ExternalLink,
  GraduationCap
} from "lucide-react";
import type { HelpTopic, HelpTopicsResponse, HelpAskResult } from "@shared/help";
import { useEntitlements } from "@/features/packs/useEntitlements";
import { useAuth } from "@/hooks/use-auth";
import { AuthRequiredMessage } from "@/components/auth-required-message";
import { useDocumentTitle } from "@/hooks/use-document-title";

function useEnabledPacksSet() {
  const { entitlements } = useEntitlements();
  const enabledPacks = new Set<string>();
  if (entitlements?.finance) enabledPacks.add("finance");
  if (entitlements?.legal) enabledPacks.add("legal");
  return enabledPacks;
}

const areaLabels: Record<string, string> = {
  core: "Getting Started",
  finance: "Finance Pack",
  legal: "Legal Pack",
  packs: "Intelligence Packs",
  account: "Account & Settings"
};

const areaIcons: Record<string, React.ReactNode> = {
  core: <FileText className="h-4 w-4" />,
  finance: <DollarSign className="h-4 w-4" />,
  legal: <Scale className="h-4 w-4" />,
  packs: <HelpCircle className="h-4 w-4" />,
  account: <Settings className="h-4 w-4" />
};

export default function HelpPage() {
  useDocumentTitle("Help Center");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const enabledPacks = useEnabledPacksSet();

  const { prefillQuery, prefillTopicId } = useMemo(() => {
    const urlParams = new URLSearchParams(searchString);
    return {
      prefillQuery: urlParams.get("q"),
      prefillTopicId: urlParams.get("topic")
    };
  }, [searchString]);

  useEffect(() => {
    if (prefillQuery) {
      setSearchQuery(prefillQuery);
    }
  }, [prefillQuery]);

  const { data: topicsData, isLoading: topicsLoading } = useQuery<HelpTopicsResponse>({
    queryKey: ["/api/help/topics"],
  });

  useEffect(() => {
    if (prefillTopicId && topicsData) {
      const allTopics = Object.values(topicsData.areas).flat();
      const topic = allTopics.find(t => t.id === prefillTopicId);
      if (topic) {
        setSelectedTopic(topic);
      }
    }
  }, [prefillTopicId, topicsData]);

  const askMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/help/ask", { query });
      return res.json() as Promise<HelpAskResult>;
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      askMutation.mutate(searchQuery.trim());
    }
  };

  const hasFinance = enabledPacks.has("finance");
  const hasLegal = enabledPacks.has("legal");


  const areas = topicsData?.areas || { core: [], finance: [], legal: [], packs: [], account: [] };
  const visibleAreas = Object.entries(areas).filter(([key, topics]) => {
    if (topics.length === 0) return false;
    if (key === "finance" && !hasFinance) return false;
    if (key === "legal" && !hasLegal) return false;
    return true;
  });

  if (authLoading || topicsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Skeleton className="h-10 w-48 mb-8" />
          <Skeleton className="h-12 w-full mb-8" />
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-home">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Home
              </Button>
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center py-24">
            <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-4">Help Center</h1>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Access help topics, ask questions, and get guidance on using Evident.
            </p>
            <AuthRequiredMessage />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Home
            </Button>
          </Link>
        </div>

        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <HelpCircle className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Help</h1>
          </div>
          <p className="text-muted-foreground">
            Find answers to common questions or browse help topics
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Ask a question</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Ask how to use a feature... (e.g., 'How do I reconcile an invoice?')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
              data-testid="input-help-search"
            />
            <Button type="submit" disabled={askMutation.isPending || !searchQuery.trim()} data-testid="button-help-search">
              {askMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Search</span>
            </Button>
          </form>

          {askMutation.data && (
            <Card className="mt-4" data-testid="card-help-result">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  {askMutation.data.answer.title}
                </CardTitle>
                <CardDescription>{askMutation.data.answer.body}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Steps:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    {askMutation.data.answer.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
                <div className="flex flex-wrap gap-2">
                  {askMutation.data.answer.routes.map((route, i) => (
                    <Link key={i} href={route.path}>
                      <Button variant="outline" size="sm" data-testid={`link-help-route-${i}`}>
                        {route.label}
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  ))}
                </div>

                {askMutation.data.matches.length > 1 && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">Other related topics:</h4>
                    <div className="flex flex-wrap gap-2">
                      {askMutation.data.matches.slice(1).map((match) => {
                        const allTopics = Object.values(areas).flat();
                        const topic = allTopics.find(t => t.id === match.topicId);
                        if (!topic) return null;
                        return (
                          <Button
                            key={match.topicId}
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTopic(topic)}
                            data-testid={`button-related-${match.topicId}`}
                          >
                            {topic.title}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Can't find what you're looking for?{" "}
                    <button 
                      onClick={() => window.location.href = "/faq"} 
                      className="text-primary hover:underline font-medium" 
                      data-testid="link-help-to-faq"
                    >
                      Check our FAQ
                      <ExternalLink className="h-3 w-3 inline ml-1" />
                    </button>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Getting Started</h2>
          <Link href="/ai-readiness/qa">
            <Card className="hover-elevate cursor-pointer" data-testid="card-ai-readiness-guide">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">AI Readiness Guide</h3>
                  <p className="text-sm text-muted-foreground">Learn how to prepare your documents for AI-powered analysis</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </CardContent>
            </Card>
          </Link>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Browse by area</h2>
          <Accordion type="multiple" className="space-y-2">
            {visibleAreas.map(([areaKey, topics]) => (
              <AccordionItem key={areaKey} value={areaKey} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline" data-testid={`accordion-${areaKey}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      {areaIcons[areaKey]}
                    </div>
                    <span className="font-medium">{areaLabels[areaKey]}</span>
                    <Badge variant="secondary" className="ml-2">{topics.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pb-2">
                    {topics.map((topic) => (
                      <button
                        key={topic.id}
                        onClick={() => setSelectedTopic(topic)}
                        className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
                        data-testid={`button-topic-${topic.id}`}
                      >
                        <h4 className="font-medium text-sm">{topic.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">{topic.description}</p>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <Card className="mt-6 bg-muted/30">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-sm">Still have questions?</p>
                <p className="text-xs text-muted-foreground">Check our FAQ for more detailed answers</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                data-testid="button-browse-faq"
                onClick={() => window.location.href = "/faq"}
              >
                View FAQ
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </section>

        <Dialog open={!!selectedTopic} onOpenChange={(open) => !open && setSelectedTopic(null)}>
          <DialogContent className="max-w-lg">
            {selectedTopic && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedTopic.title}</DialogTitle>
                  <DialogDescription>{selectedTopic.description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Steps:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      {selectedTopic.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedTopic.routes.map((route, i) => (
                      <Link key={i} href={route.path}>
                        <Button size="sm" data-testid={`dialog-route-${i}`}>
                          {route.label}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
