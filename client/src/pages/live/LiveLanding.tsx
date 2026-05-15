import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  FolderSearch,
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
  Bot,
  FileSearch,
  Brain,
  Home,
} from "lucide-react";

export default function LiveLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMjI4NDQiIGZpbGwtb3BhY2l0eT0iMC4yIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40" />
      
      <div className="relative container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 flex justify-end">
          <Link href="/">
            <Button variant="ghost" className="text-slate-400 hover:text-white" data-testid="button-home">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </Link>
        </div>

        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400 text-sm mb-6">
            <Brain className="h-4 w-4" />
            Evident Live Assessment
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            Check How AI-Ready<br />Your Documents Are
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            Get an instant AI readiness score for your files. No uploads required — 
            we analyze file attributes locally in your browser.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/live/scan">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 px-8"
                data-testid="button-start-scan"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Start Free Scan
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 flex items-center justify-center mx-auto mb-4">
                <FolderSearch className="h-7 w-7 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">1. Select Files</h3>
              <p className="text-slate-400 text-sm">
                Choose a folder or upload sample files. We analyze names, types, and metadata — not contents.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-7 w-7 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">2. Instant Analysis</h3>
              <p className="text-slate-400 text-sm">
                Our AI readiness algorithm scores your files across 5 key dimensions in seconds.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-7 w-7 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">3. Get Your Score</h3>
              <p className="text-slate-400 text-sm">
                See your AI readiness score with actionable recommendations to improve.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center mb-16">
          <div>
            <h2 className="text-3xl font-bold text-white mb-6">
              What We Analyze
            </h2>
            <div className="space-y-4">
              {[
                { icon: FileSearch, title: "Format Compatibility", desc: "PDF, DOCX, TXT work best with AI" },
                { icon: Bot, title: "Structure & Naming", desc: "Clear names help AI understand context" },
                { icon: BarChart3, title: "Version Clarity", desc: "Avoid duplicates and confusing versions" },
                { icon: Brain, title: "Metadata Signals", desc: "Dates, sizes, and organization patterns" },
                { icon: Sparkles, title: "Searchability", desc: "Text-friendly formats score higher" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{item.title}</h4>
                    <p className="text-sm text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-3xl" />
            <Card className="relative bg-slate-900/80 border-slate-700">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 mb-4">
                    <span className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                      87
                    </span>
                  </div>
                  <p className="text-lg font-medium text-white">Sample Score</p>
                  <p className="text-sm text-slate-400">AI Ready</p>
                </div>
                
                <div className="space-y-3">
                  {[
                    { label: "Format", value: 95, color: "from-green-500 to-emerald-500" },
                    { label: "Structure", value: 82, color: "from-cyan-500 to-blue-500" },
                    { label: "Duplicates", value: 78, color: "from-blue-500 to-indigo-500" },
                    { label: "Metadata", value: 90, color: "from-indigo-500 to-purple-500" },
                    { label: "Searchability", value: 88, color: "from-purple-500 to-pink-500" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-sm text-slate-400 w-24">{item.label}</span>
                      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-1000`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-white w-8">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="bg-gradient-to-r from-slate-900/80 to-slate-800/80 border-slate-700 mb-12">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Your Privacy is Protected</h3>
                <p className="text-slate-400">
                  When using folder selection, we analyze file names and basic attributes locally in your browser. 
                  File contents are never uploaded or stored. If you choose to upload files, 
                  they are processed temporarily and immediately discarded.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link href="/live/scan">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white shadow-lg shadow-purple-500/25 px-12"
              data-testid="button-start-scan-bottom"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Check Your Files Now
            </Button>
          </Link>
          <p className="text-slate-500 text-sm mt-4">
            Free • No sign-up required • Results in seconds
          </p>
        </div>
      </div>
    </div>
  );
}
