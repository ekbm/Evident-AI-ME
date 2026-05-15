import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Clock, User, Share2, ExternalLink, Copy, Check } from "lucide-react";
import { SiLinkedin, SiX, SiFacebook, SiWhatsapp, SiTelegram, SiReddit, SiPinterest } from "react-icons/si";
import { Mail } from "lucide-react";
import { useState } from "react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  tags: string[] | null;
  authorName: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

function estimateReadTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function renderContent(content: string) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-xl sm:text-2xl font-bold mt-8 mb-3">
          {renderInlineFormatting(line.replace("## ", ""))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-lg sm:text-xl font-semibold mt-6 mb-2">
          {renderInlineFormatting(line.replace("### ", ""))}
        </h3>
      );
    } else if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      elements.push(
        <blockquote key={`bq-${i}`} className="border-l-4 border-primary/30 pl-4 my-4 italic text-muted-foreground">
          {quoteLines.map((l, j) => (
            <p key={j} className="text-base leading-relaxed mb-1">{renderInlineFormatting(l)}</p>
          ))}
        </blockquote>
      );
      continue;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        listItems.push(lines[i].replace(/^[-*]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-6 space-y-1.5 my-3">
          {listItems.map((item, j) => (
            <li key={j} className="text-base leading-relaxed">{renderInlineFormatting(item)}</li>
          ))}
        </ul>
      );
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal pl-6 space-y-1.5 my-3">
          {listItems.map((item, j) => (
            <li key={j} className="text-base leading-relaxed">{renderInlineFormatting(item)}</li>
          ))}
        </ol>
      );
      continue;
    } else if (line.trim() === "---") {
      elements.push(<hr key={i} className="my-8 border-border" />);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-3" />);
    } else {
      elements.push(
        <p key={i} className="text-base leading-relaxed mb-3">
          {renderInlineFormatting(line)}
        </p>
      );
    }
    i++;
  }

  return elements;
}

function renderInlineFormatting(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /(\*\*(.+?)\*\*)|(_(.+?)_)|(\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={match.index} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index} className="italic">{match[4]}</em>);
    } else if (match[5]) {
      parts.push(
        <a key={match.index} href={match[7]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {match[6]}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data: post, isLoading, error } = useQuery<BlogPost>({
    queryKey: ["/api/blog", slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/${slug}`, { credentials: "include" });
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: !!slug,
  });

  useDocumentTitle(post?.title || "Blog Post");

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = post?.title || "";

  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(currentUrl);
  const encodedTitle = encodeURIComponent(shareTitle);

  const shareToLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const shareToX = () => {
    window.open(`https://x.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const shareToWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`, "_blank", "noopener,noreferrer");
  };

  const shareToTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`, "_blank", "noopener,noreferrer");
  };

  const shareToReddit = () => {
    window.open(`https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const shareToPinterest = () => {
    window.open(`https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const shareViaEmail = () => {
    window.location.href = `mailto:?subject=${encodedTitle}&body=Check out this article: ${encodedUrl}`;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center">
            <Skeleton className="h-8 w-32" />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-5 w-48 mb-8" />
          <Skeleton className="h-64 w-full mb-6" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Post not found</h2>
          <p className="text-muted-foreground mb-4">This blog post doesn't exist or has been removed.</p>
          <Button asChild variant="outline" data-testid="button-back-to-blog">
            <Link href="/blog">Back to Blog</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur w-full">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 w-full">
          <Button variant="ghost" size="sm" asChild className="shrink-0" data-testid="button-back-blog">
            <Link href="/blog">
              <ArrowLeft className="w-4 h-4 mr-2" />
              All Posts
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-share-post">
                <Share2 className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={shareToLinkedIn} data-testid="button-share-linkedin">
                <SiLinkedin className="w-4 h-4 mr-2 text-[#0A66C2]" />
                LinkedIn
              </DropdownMenuItem>
              <DropdownMenuItem onClick={shareToX} data-testid="button-share-x">
                <SiX className="w-4 h-4 mr-2" />
                X (Twitter)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={shareToFacebook} data-testid="button-share-facebook">
                <SiFacebook className="w-4 h-4 mr-2 text-[#1877F2]" />
                Facebook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={shareToWhatsApp} data-testid="button-share-whatsapp">
                <SiWhatsapp className="w-4 h-4 mr-2 text-[#25D366]" />
                WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={shareToTelegram} data-testid="button-share-telegram">
                <SiTelegram className="w-4 h-4 mr-2 text-[#26A5E4]" />
                Telegram
              </DropdownMenuItem>
              <DropdownMenuItem onClick={shareToReddit} data-testid="button-share-reddit">
                <SiReddit className="w-4 h-4 mr-2 text-[#FF4500]" />
                Reddit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={shareToPinterest} data-testid="button-share-pinterest">
                <SiPinterest className="w-4 h-4 mr-2 text-[#E60023]" />
                Pinterest
              </DropdownMenuItem>
              <DropdownMenuItem onClick={shareViaEmail} data-testid="button-share-email">
                <Mail className="w-4 h-4 mr-2" />
                Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyLink} data-testid="button-copy-link">
                {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copied!" : "Copy Link"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {!post.published && (
          <div className="mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
              This post is a draft and only visible to you.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mb-4">
          {post.tags?.map(tag => (
            <Badge key={tag} variant="secondary" className="no-default-active-elevate">
              {tag}
            </Badge>
          ))}
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 leading-tight" data-testid="text-post-title">
          {post.title}
        </h1>

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6 pb-6 border-b flex-wrap">
          {post.authorName && (
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              {post.authorName}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {new Date(post.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {estimateReadTime(post.content)} min read
          </span>
        </div>

        {post.coverImage && (
          <div className="rounded-lg overflow-hidden mb-8">
            <img 
              src={post.coverImage} 
              alt={post.title}
              className="w-full h-auto object-cover max-h-[400px]"
            />
          </div>
        )}

        <article className="prose-evident" data-testid="text-post-content">
          {renderContent(post.content)}
        </article>

        <div className="mt-10 pt-6 border-t flex items-center justify-between gap-3 flex-wrap">
          <Button variant="outline" size="sm" asChild data-testid="button-back-blog-bottom">
            <Link href="/blog">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              All Posts
            </Link>
          </Button>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={shareToLinkedIn} data-testid="button-share-linkedin-bottom">
              <SiLinkedin className="w-4 h-4 mr-1.5 text-[#0A66C2]" />
              LinkedIn
            </Button>
            <Button variant="outline" size="sm" onClick={shareToX} data-testid="button-share-x-bottom">
              <SiX className="w-4 h-4 mr-1.5" />
              X
            </Button>
            <Button variant="outline" size="sm" onClick={shareToFacebook} data-testid="button-share-facebook-bottom">
              <SiFacebook className="w-4 h-4 mr-1.5 text-[#1877F2]" />
              Facebook
            </Button>
            <Button variant="outline" size="sm" onClick={shareToWhatsApp} data-testid="button-share-whatsapp-bottom">
              <SiWhatsapp className="w-4 h-4 mr-1.5 text-[#25D366]" />
              WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={copyLink} data-testid="button-copy-link-bottom">
              {copied ? <Check className="w-4 h-4 mr-1.5 text-green-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
