import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Maximize2, 
  Download, 
  RefreshCw,
  AlertCircle 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MermaidDiagramProps {
  code: string;
  title?: string;
}

export function MermaidDiagram({ code, title }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code) return;
      
      setIsLoading(true);
      setError("");
      
      try {
        const mermaid = (await import("mermaid")).default;
        
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
          fontFamily: "Inter, sans-serif",
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: "basis",
          },
          mindmap: {
            useMaxWidth: true,
            padding: 10,
          },
          sequence: {
            useMaxWidth: true,
            diagramMarginX: 10,
            diagramMarginY: 10,
          },
        });

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, code.trim());
        setSvg(renderedSvg);
      } catch (err: any) {
        console.error("Mermaid rendering error:", err);
        setError(err.message || "Failed to render diagram");
      } finally {
        setIsLoading(false);
      }
    };

    renderDiagram();
  }, [code, retryCount]);

  const handleDownload = () => {
    if (!svg) return;
    
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "diagram"}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  if (error) {
    return (
      <Card className="p-4 border-destructive/50 bg-destructive/5" data-testid="card-diagram-error">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive" data-testid="text-diagram-error">Failed to render diagram</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <div className="mt-3 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
              <pre className="whitespace-pre-wrap">{code}</pre>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="mt-3 gap-1"
              data-testid="button-retry-diagram"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden" ref={containerRef} data-testid="card-mermaid-diagram">
        {title && (
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
            <span className="text-sm font-medium" data-testid="text-diagram-title">{title}</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleDownload}
                disabled={!svg}
                data-testid="button-download-diagram"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsFullscreen(true)}
                disabled={!svg}
                data-testid="button-fullscreen-diagram"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        <div className="p-4 bg-white dark:bg-slate-900 min-h-[200px] flex items-center justify-center">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Rendering diagram...</span>
            </div>
          ) : (
            <div 
              className="w-full overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: svg }}
              data-testid="container-diagram-svg"
            />
          )}
        </div>
      </Card>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{title || "Diagram"}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-1"
                  data-testid="button-download-diagram-fullscreen"
                >
                  <Download className="w-4 h-4" />
                  Download SVG
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div 
            className="p-4 bg-white dark:bg-slate-900 rounded-lg overflow-auto [&_svg]:max-w-full [&_svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function extractMermaidBlocks(text: string): Array<{ code: string; title?: string }> {
  const blocks: Array<{ code: string; title?: string }> = [];
  const regex = /```mermaid\s*([\s\S]*?)```/gi;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const code = match[1].trim();
    if (code) {
      const titleMatch = code.match(/^%%\s*(.+)$/m);
      blocks.push({
        code,
        title: titleMatch ? titleMatch[1].trim() : undefined,
      });
    }
  }
  
  return blocks;
}
