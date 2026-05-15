import { Link } from "wouter";
import { LogIn } from "lucide-react";

interface AuthRequiredMessageProps {
  className?: string;
}

export function AuthRequiredMessage({ className = "" }: AuthRequiredMessageProps) {
  return (
    <Link href="/auth">
      <div 
        className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-muted/50 border border-border hover-elevate cursor-pointer transition-colors ${className}`}
        data-testid="link-auth-required"
      >
        <LogIn className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Sign in required</span>
      </div>
    </Link>
  );
}
