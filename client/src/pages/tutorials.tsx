import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Play, 
  Sparkles, 
  Globe, 
  GraduationCap, 
  FileText, 
  Zap,
  Clock,
  CheckCircle2,
  X,
  LogIn
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/hooks/use-auth";

interface TutorialVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  icon: React.ReactNode;
  category: "getting-started" | "features" | "advanced";
  youtubeId?: string;
  thumbnail?: string;
}

function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

const tutorials: TutorialVideo[] = [
  {
    id: "overview-buttons",
    title: "Evident Overview: Important Buttons",
    description: "A quick tour of Evident's key buttons and controls — learn what each one does so you can navigate the workspace with confidence.",
    duration: "2:48",
    icon: <Sparkles className="w-6 h-6" />,
    category: "getting-started",
    youtubeId: "2eSvpYmOL14",
  },
  {
    id: "getting-started",
    title: "Contract Analysis with Evident",
    description: "Learn how to analyze contracts and legal documents: Select files, ask questions, use Simplify for complex legal language, and leverage External Insights for additional context.",
    duration: "2:00",
    icon: <FileText className="w-6 h-6" />,
    category: "getting-started",
    youtubeId: "coC6_MNcads",
  },
  {
    id: "simplify",
    title: "Simplify Complex Content",
    description: "Transform technical jargon, legal language, or complex documents into clear, easy-to-understand explanations with one click.",
    duration: "0:30",
    icon: <Sparkles className="w-6 h-6" />,
    category: "features",
    youtubeId: "3h293ttDrvc",
  },
  {
    id: "external-insights",
    title: "External Insights",
    description: "Go beyond your uploaded documents. Combine your internal data with external research to get comprehensive answers.",
    duration: "0:30",
    icon: <Globe className="w-6 h-6" />,
    category: "features",
    youtubeId: "yLPGOp-sEcs",
  },
  {
    id: "study-tools",
    title: "Study Tools for Students",
    description: "Generate flashcards, exam focus guides, and practice questions from your lecture materials and textbooks.",
    duration: "2:00",
    icon: <GraduationCap className="w-6 h-6" />,
    category: "features",
    youtubeId: "KfvWI0QJ7Do",
  },
  {
    id: "study-tips",
    title: "Quick Study Tips",
    description: "Quick tips and tricks for getting the most out of Evident's study features in under a minute.",
    duration: "0:30",
    icon: <GraduationCap className="w-6 h-6" />,
    category: "features",
    youtubeId: "YTpiQa2Tjt4",
  },
  {
    id: "ppt-qa-simplify",
    title: "Q&A from Presentations",
    description: "Ask questions about PowerPoint files, simplify complex slides, and enrich answers with External Insights for deeper understanding.",
    duration: "5:31",
    icon: <FileText className="w-6 h-6" />,
    category: "features",
    youtubeId: "gEL2ytoDizE",
  },
  {
    id: "exam-focus-deepsearch",
    title: "Exam Focus with Deep Search",
    description: "Generate targeted exam focus guides with Deep Search enabled for comprehensive, research-backed study preparation.",
    duration: "3:29",
    icon: <GraduationCap className="w-6 h-6" />,
    category: "features",
    youtubeId: "wIHEFVghNZA",
  },
  {
    id: "flashcards-deepsearch",
    title: "Flashcards with Deep Search",
    description: "Generate flashcards from your documents with Deep Search mode enabled for richer, research-enhanced study material.",
    duration: "4:05",
    icon: <GraduationCap className="w-6 h-6" />,
    category: "features",
    youtubeId: "5VMhkjwIFc8",
  },
  {
    id: "qa-quiz-3phase",
    title: "Q&A and Quiz: 3-Phase Study",
    description: "Learn the 3-phase study approach: generate Q&A from your documents, take quizzes, and track your progress through each phase.",
    duration: "2:35",
    icon: <GraduationCap className="w-6 h-6" />,
    category: "features",
    youtubeId: "C70-CZC3HUs",
  },
  {
    id: "quick-actions",
    title: "Quick Actions & Prompts",
    description: "Use built-in prompts to summarize, explain, or extract key points from any document instantly.",
    duration: "0:30",
    icon: <Zap className="w-6 h-6" />,
    category: "advanced",
    youtubeId: "JxmOuVu7IB8",
  },
];

const categoryLabels: Record<string, string> = {
  "getting-started": "Getting Started",
  "features": "Key Features",
  "advanced": "Pro Tips",
};

function VideoCard({ tutorial, onPlay }: { tutorial: TutorialVideo; onPlay: (tutorial: TutorialVideo) => void }) {
  const hasVideo = !!tutorial.youtubeId;
  const thumbnailUrl = tutorial.youtubeId 
    ? `https://img.youtube.com/vi/${tutorial.youtubeId}/maxresdefault.jpg`
    : tutorial.thumbnail;
  
  return (
    <Card 
      className={`group transition-all ${hasVideo ? 'hover-elevate cursor-pointer' : 'opacity-90'}`}
      data-testid={`card-tutorial-${tutorial.id}`}
      onClick={() => hasVideo && onPlay(tutorial)}
    >
      <div className="relative aspect-video bg-gradient-to-br from-slate-900 to-slate-800 rounded-t-lg overflow-hidden">
        {thumbnailUrl ? (
          <img 
            src={thumbnailUrl} 
            alt={tutorial.title}
            className="w-full h-full object-cover opacity-80"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (tutorial.youtubeId) {
                target.src = `https://img.youtube.com/vi/${tutorial.youtubeId}/hqdefault.jpg`;
              }
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${hasVideo ? 'bg-black/50 group-hover:bg-black/70' : 'bg-primary/20 group-hover:bg-primary/30'}`}>
            {hasVideo ? (
              <Play className="w-8 h-8 text-white ml-1" fill="white" />
            ) : (
              <div className="text-primary">{tutorial.icon}</div>
            )}
          </div>
        </div>
        <div className="absolute bottom-2 right-2">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
            <Clock className="w-3 h-3 mr-1" />
            {tutorial.duration}
          </Badge>
        </div>
        {!hasVideo && (
          <div className="absolute top-2 left-2">
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-xs">
              Coming Soon
            </Badge>
          </div>
        )}
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          {tutorial.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {tutorial.description}
        </p>
      </CardContent>
    </Card>
  );
}

export default function TutorialsPage() {
  useDocumentTitle("Video Tutorials");
  const [selectedVideo, setSelectedVideo] = useState<TutorialVideo | null>(null);
  const { isAuthenticated, isLoading } = useAuth();
  
  const groupedTutorials = tutorials.reduce((acc, tutorial) => {
    if (!acc[tutorial.category]) {
      acc[tutorial.category] = [];
    }
    acc[tutorial.category].push(tutorial);
    return acc;
  }, {} as Record<string, TutorialVideo[]>);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/apple-touch-icon.png?v=3" 
              alt="Evident" 
              className="w-10 h-10 rounded-xl shadow-lg"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Evident
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Video Tutorials</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild data-testid="button-back-home">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Workspace
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Sign up prompt for non-authenticated users */}
        {!isLoading && !isAuthenticated && (
          <Card className="mb-6 border-accent/30 bg-accent/5">
            <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Free Plan
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Sign up free to save your work and unlock more features
                </span>
              </div>
              <Button asChild size="sm" data-testid="button-tutorials-signup">
                <a href="/auth">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign Up Free
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
        
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            <Play className="w-3 h-3 mr-1" />
            Video Tutorials
          </Badge>
          <h1 className="text-4xl font-bold mb-4" data-testid="text-tutorials-title">
            Learn How to Use Evident
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Quick video guides to help you get the most out of Evident. 
            From uploading your first document to advanced features like External Insights.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-12 p-6 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border border-primary/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Evidence-Based Answers</h3>
              <p className="text-xs text-muted-foreground">Every answer includes citations to your source documents</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Simplify Anything</h3>
              <p className="text-xs text-muted-foreground">Transform complex content into clear explanations</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-chart-2" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">External Research</h3>
              <p className="text-xs text-muted-foreground">Combine your documents with external insights</p>
            </div>
          </div>
        </div>

        {Object.entries(groupedTutorials).map(([category, categoryTutorials]) => (
          <section key={category} className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              {categoryLabels[category]}
              <Badge variant="outline" className="ml-2 text-xs font-normal">
                {categoryTutorials.length} {categoryTutorials.length === 1 ? 'video' : 'videos'}
              </Badge>
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {categoryTutorials.map((tutorial) => (
                <VideoCard key={tutorial.id} tutorial={tutorial} onPlay={setSelectedVideo} />
              ))}
            </div>
          </section>
        ))}

        <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 py-8">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-bold mb-2">Ready to try Evident?</h3>
              <p className="text-muted-foreground">
                Upload your first document and see evidence-based AI in action.
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild data-testid="button-get-started">
                <Link href="/">
                  Get Started Free
                </Link>
              </Button>
              <Button variant="outline" asChild data-testid="button-view-pricing">
                <Link href="/pricing">
                  View Pricing
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img 
                src="/apple-touch-icon.png?v=3" 
                alt="Evident" 
                className="w-6 h-6 rounded"
              />
              <span className="text-sm text-muted-foreground">
                Evident - Evidence-Based AI Assistant
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                About
              </Link>
              <Link href="/help" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Help Center
              </Link>
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-w-6xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              {selectedVideo?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedVideo?.youtubeId && (
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${selectedVideo.youtubeId}?autoplay=1&rel=0&modestbranding=1&showinfo=0`}
                title={selectedVideo.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
