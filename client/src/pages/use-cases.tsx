import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Home,
  ArrowLeft, 
  Play, 
  GraduationCap, 
  Video, 
  FileCheck, 
  BookOpen, 
  ClipboardList, 
  Shield, 
  Wrench,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Bot,
  Copy,
  FileType,
  Lightbulb
} from "lucide-react";
import { useCases, type UseCase } from "@/data/useCases";
import { VoiceGuide } from "@/components/voice-guide";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

import studyNotesImg from "@assets/stock_images/student_studying_wit_00bdeb8c.jpg";
import videoTranscriptImg from "@assets/stock_images/video_production_edi_9961d1b4.jpg";
import contractImg from "@assets/stock_images/legal_contract_docum_bb2186a1.jpg";
import invoiceImg from "@assets/stock_images/invoice_financial_do_1ffcac2c.jpg";
import researchImg from "@assets/stock_images/research_paper_acade_65cd4b34.jpg";
import meetingImg from "@assets/stock_images/business_meeting_tea_6d143411.jpg";
import complianceImg from "@assets/stock_images/security_shield_prot_77620c12.jpg";
import technicalDocsImg from "@assets/stock_images/technical_documentat_cf391744.jpg";

const videoMap: Record<string, string> = {};

const imageMap: Record<string, string> = {
  "university-notes-mcq": studyNotesImg,
  "video-transcript": videoTranscriptImg,
  "contract-obligations": contractImg,
  "invoice-reconciliation": invoiceImg,
  "research-paper-summary": researchImg,
  "meeting-action-items": meetingImg,
  "policy-compliance": complianceImg,
  "technical-docs-qa": technicalDocsImg,
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  GraduationCap,
  Video,
  FileCheck,
  BookOpen,
  ClipboardList,
  Shield,
  Wrench,
};

const categoryColors: Record<string, string> = {
  education: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  media: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  business: "bg-green-500/10 text-green-600 dark:text-green-400",
};

const categoryLabels: Record<string, string> = {
  education: "Education",
  media: "Media",
  business: "Business",
};

export default function UseCasesPage() {
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const filteredUseCases = activeTab === "all" 
    ? useCases 
    : useCases.filter(uc => uc.category === activeTab);

  const IconComponent = selectedUseCase ? iconMap[selectedUseCase.icon] : null;

  const handleVoicePlay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  const copyPrompt = useCallback((prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast({
      title: "Copied!",
      description: "Prompt copied to clipboard. Paste it after uploading your file.",
    });
  }, [toast]);

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
              <p className="text-xs text-muted-foreground hidden sm:block">Use Cases</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild data-testid="button-home">
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Home
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild data-testid="button-workspace">
              <Link href={isAuthenticated ? "/full" : "/"}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go to Workspace
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="text-use-cases-title">See Evident in Action</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore real-world examples of how Evident can help you extract insights, 
            generate content, and get answers from your documents.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-4">
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="education" data-testid="tab-education">Education</TabsTrigger>
            <TabsTrigger value="media" data-testid="tab-media">Media</TabsTrigger>
            <TabsTrigger value="business" data-testid="tab-business">Business</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUseCases.map((useCase) => {
            const Icon = iconMap[useCase.icon];
            const videoSrc = videoMap[useCase.id];
            const imageSrc = imageMap[useCase.id];
            
            return (
              <Card 
                key={useCase.id} 
                className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
                onClick={() => setSelectedUseCase(useCase)}
                data-testid={`card-use-case-${useCase.id}`}
              >
                <div className="relative aspect-video bg-muted overflow-hidden rounded-t-lg">
                  {videoSrc ? (
                    <video 
                      src={videoSrc} 
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                  ) : imageSrc ? (
                    <img 
                      src={imageSrc} 
                      alt={useCase.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                      {Icon && <Icon className="w-12 h-12 text-primary/50" />}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                      <ChevronRight className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className="w-5 h-5 text-primary" />}
                      <CardTitle className="text-lg">{useCase.title}</CardTitle>
                    </div>
                    <Badge variant="secondary" className={categoryColors[useCase.category]}>
                      {categoryLabels[useCase.category]}
                    </Badge>
                  </div>
                  <CardDescription>{useCase.subtitle}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{useCase.description}</p>
                  <Button variant="ghost" size="sm" className="mt-3 w-full">
                    View Details
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Card className="inline-block p-6 max-w-lg">
            <h3 className="text-lg font-semibold mb-2">Ready to try it yourself?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload your own documents and experience the power of evidence-based AI answers.
            </p>
            <Button asChild data-testid="button-get-started">
              <Link href="/auth">
                Get Started
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </Card>
        </div>
      </main>

      <Dialog open={!!selectedUseCase} onOpenChange={(open) => !open && setSelectedUseCase(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedUseCase && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {IconComponent && <IconComponent className="w-6 h-6 text-primary" />}
                  <div>
                    <DialogTitle className="text-xl">{selectedUseCase.title}</DialogTitle>
                    <DialogDescription>{selectedUseCase.subtitle}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-6">
                {videoMap[selectedUseCase.id] ? (
                  <div className="aspect-video rounded-lg overflow-hidden bg-black">
                    <video 
                      ref={videoRef}
                      src={videoMap[selectedUseCase.id]} 
                      className="w-full h-full object-contain"
                      controls
                      autoPlay
                      loop
                      muted
                    />
                  </div>
                ) : imageMap[selectedUseCase.id] && (
                  <div className="aspect-video rounded-lg overflow-hidden">
                    <img 
                      src={imageMap[selectedUseCase.id]} 
                      alt={selectedUseCase.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {selectedUseCase.voiceScript && (
                  <VoiceGuide 
                    sectionId={selectedUseCase.id}
                    narrations={{ [selectedUseCase.id]: selectedUseCase.voiceScript }}
                    onPlay={handleVoicePlay}
                  />
                )}

                <p className="text-muted-foreground">{selectedUseCase.description}</p>

                {selectedUseCase.supportedFileTypes && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileType className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Supported:</span>
                    {selectedUseCase.supportedFileTypes.map((type, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                )}

                {selectedUseCase.suggestedPrompts && (
                  <div className="border rounded-lg p-4 bg-primary/5">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-primary" />
                      Try These Prompts
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      After uploading your file, copy and paste one of these prompts:
                    </p>
                    <div className="space-y-2">
                      {selectedUseCase.suggestedPrompts.map((prompt, i) => (
                        <div 
                          key={i} 
                          className="flex items-center gap-2 bg-background rounded-md p-2 border cursor-pointer hover-elevate"
                          onClick={() => copyPrompt(prompt)}
                          data-testid={`button-copy-prompt-${i}`}
                        >
                          <span className="flex-1 text-sm">{prompt}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-3">How it works</h4>
                  <div className="space-y-3">
                    {selectedUseCase.steps.map((step) => (
                      <div key={step.step} className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                          {step.step}
                        </div>
                        <div>
                          <p className="font-medium">{step.title}</p>
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Benefits</h4>
                  <ul className="space-y-2">
                    {selectedUseCase.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedUseCase.examplePrompt && selectedUseCase.exampleResponse && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b">
                      <h4 className="font-semibold flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        Example Conversation
                      </h4>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <MessageSquare className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1">You ask:</p>
                          <div className="bg-primary/5 rounded-lg p-3 text-sm">
                            {selectedUseCase.examplePrompt}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-accent" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Evident responds:</p>
                          <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-line font-mono text-xs leading-relaxed max-h-64 overflow-y-auto">
                            {selectedUseCase.exampleResponse}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button asChild className="flex-1" data-testid="button-try-use-case">
                    <Link href="/auth">
                      Get Started
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedUseCase(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
