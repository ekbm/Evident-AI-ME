import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiX, SiLinkedin, SiFacebook, SiWhatsapp } from "react-icons/si";
import { useAuth } from "@/hooks/use-auth";

interface ShareButtonsProps {
  className?: string;
  showLabel?: boolean;
}

const SHARE_URL = "https://evident-ai.net";
const SHARE_TITLE = "Evident - AI Document Assistant";

const SHARE_MESSAGES = {
  general: [
    "Evident helps you ask questions across your documents and get clear, trustworthy answers from your own files. Available on web and iOS!",
    "Ask your documents questions. Evident finds the answers. Try it free!",
  ],
  student: [
    "I'm using Evident to turn notes, PDFs, and slides into clear answers — it makes studying a lot easier. Try it free!",
    "Evident helps me study smarter by answering questions from my own notes and readings. Available on web and iOS!",
  ],
  professional: [
    "Evident helps me get reliable answers directly from my documents, making it easier to work with reports and policies. Try it!",
    "This answer was generated using Evident from the original documents, with context you can trust. Check it out!",
  ],
};

export function ShareButtons({ className = "", showLabel = true }: ShareButtonsProps) {
  const { user } = useAuth();
  
  const getShareMessage = () => {
    // Try to detect user type from their profile or usage patterns
    let messagePool = SHARE_MESSAGES.general;
    
    if (user?.email) {
      const email = user.email.toLowerCase();
      // Student indicators: .edu emails or common student domains
      if (email.includes('.edu') || email.includes('student') || email.includes('uni') || email.includes('college')) {
        messagePool = SHARE_MESSAGES.student;
      } else {
        // Professional users (default for non-student authenticated users)
        messagePool = SHARE_MESSAGES.professional;
      }
    }
    
    // Pick a random message from the pool
    const randomIndex = Math.floor(Math.random() * messagePool.length);
    return messagePool[randomIndex];
  };
  
  const handleShare = async () => {
    const shareText = getShareMessage();
    
    // Use native share sheet if available (iOS, Android, some desktop browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: SHARE_TITLE,
          text: shareText,
          url: SHARE_URL,
        });
      } catch (err) {
        // User cancelled or share failed - that's ok
        console.log('Share cancelled or failed:', err);
      }
    } else {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(`${shareText} ${SHARE_URL}`);
        alert('Link copied to clipboard!');
      } catch (err) {
        // Final fallback: prompt to copy
        prompt('Copy this link to share:', SHARE_URL);
      }
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {showLabel && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Share2 className="w-3 h-3" />
          <span>Share Evident</span>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleShare}
        data-testid="button-share"
        className="gap-2"
      >
        <div className="flex items-center gap-1">
          <SiWhatsapp className="w-3.5 h-3.5 text-green-500" />
          <SiX className="w-3.5 h-3.5" />
          <SiLinkedin className="w-3.5 h-3.5 text-blue-600" />
          <SiFacebook className="w-3.5 h-3.5 text-blue-500" />
        </div>
        <span className="text-xs">& more</span>
      </Button>
    </div>
  );
}
