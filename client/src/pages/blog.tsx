import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Clock, User, PenSquare, Plus } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/hooks/use-auth";

function useIsAdmin() {
  const { isAuthenticated } = useAuth();
  const { data } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/blog/admin-check"],
    enabled: isAuthenticated,
  });
  return data?.isAdmin ?? false;
}

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

export default function BlogPage() {
  useDocumentTitle("Blog");
  const [, navigate] = useLocation();
  const isAdmin = useIsAdmin();

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
  });

  const hasDrafts = isAdmin && posts?.some(p => !p.published);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur w-full">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img 
              src="/apple-touch-icon.png?v=3" 
              alt="Evident" 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl shadow-lg shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate">
                Evident Blog
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Insights, tips, and updates</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" asChild data-testid="button-new-post">
                <Link href="/blog/manage">
                  <PenSquare className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Manage Posts</span>
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild className="shrink-0" data-testid="button-back-workspace">
              <Link href="/">
                <ArrowLeft className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-blog-title">Latest from Evident</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Discover how to get the most out of your documents with AI-powered analysis, study tools, and research capabilities.
          </p>
        </div>

        {hasDrafts && (
          <div className="mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              You have unpublished drafts waiting for review.
            </p>
            <Button variant="outline" size="sm" asChild data-testid="button-view-drafts">
              <Link href="/blog/manage">View Drafts</Link>
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-0">
                  <Skeleton className="h-48 w-full rounded-t-lg" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <Card className="overflow-hidden hover-elevate cursor-pointer h-full" data-testid={`card-blog-${post.id}`}>
                  <CardContent className="p-0 flex flex-col h-full">
                    {post.coverImage ? (
                      <div className="relative h-48 overflow-hidden">
                        <img 
                          src={post.coverImage} 
                          alt={post.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 flex items-center justify-center">
                        <span className="text-4xl font-bold text-primary/30">{post.title.charAt(0)}</span>
                      </div>
                    )}
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {!post.published && (
                          <Badge variant="outline" className="text-xs no-default-active-elevate border-amber-500/50 text-amber-600 dark:text-amber-400">
                            Draft
                          </Badge>
                        )}
                        {post.tags?.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs no-default-active-elevate">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <h3 className="font-semibold text-base mb-2 line-clamp-2" data-testid={`text-blog-title-${post.id}`}>
                        {post.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
                        {post.excerpt || post.content.substring(0, 150) + "..."}
                      </p>
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {estimateReadTime(post.content)} min read
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <PenSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground mb-4">Check back soon for articles about Evident's features and tips.</p>
          </div>
        )}
      </main>
    </div>
  );
}
