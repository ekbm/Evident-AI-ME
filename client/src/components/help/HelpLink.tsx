import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

interface HelpLinkProps {
  topicId?: string;
  queryPreset?: string;
  label?: string;
  variant?: "icon" | "text" | "button";
  className?: string;
}

export function HelpLink({ 
  topicId, 
  queryPreset, 
  label = "Help", 
  variant = "icon",
  className 
}: HelpLinkProps) {
  const href = topicId 
    ? `/help?topic=${encodeURIComponent(topicId)}`
    : queryPreset 
      ? `/help?q=${encodeURIComponent(queryPreset)}`
      : "/help";

  if (variant === "icon") {
    return (
      <Link href={href}>
        <Button 
          variant="ghost" 
          size="icon" 
          className={className}
          data-testid="button-help-link"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </Link>
    );
  }

  if (variant === "text") {
    return (
      <Link href={href} className={`text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ${className || ""}`}>
        <HelpCircle className="h-3 w-3" />
        {label}
      </Link>
    );
  }

  return (
    <Link href={href}>
      <Button variant="outline" size="sm" className={className} data-testid="button-help-link">
        <HelpCircle className="h-4 w-4 mr-2" />
        {label}
      </Button>
    </Link>
  );
}
