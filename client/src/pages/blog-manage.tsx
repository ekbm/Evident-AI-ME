import { useState, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Plus, Edit, Trash2, Eye, EyeOff, Calendar, Save, X, Loader2, AlertCircle, Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Link2, Minus, Type } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

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

function renderPreviewContent(content: string) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-xl font-bold mt-6 mb-2">{renderPreviewInline(line.replace("## ", ""))}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-lg font-semibold mt-4 mb-1.5">{renderPreviewInline(line.replace("### ", ""))}</h3>);
    } else if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      elements.push(
        <blockquote key={`bq-${i}`} className="border-l-4 border-primary/30 pl-4 my-3 italic text-muted-foreground">
          {quoteLines.map((l, j) => <p key={j} className="mb-1">{renderPreviewInline(l)}</p>)}
        </blockquote>
      );
      continue;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].replace(/^[-*]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-6 space-y-1 my-2">
          {items.map((item, j) => <li key={j} className="text-sm leading-relaxed">{renderPreviewInline(item)}</li>)}
        </ul>
      );
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal pl-6 space-y-1 my-2">
          {items.map((item, j) => <li key={j} className="text-sm leading-relaxed">{renderPreviewInline(item)}</li>)}
        </ol>
      );
      continue;
    } else if (line.trim() === "---") {
      elements.push(<hr key={i} className="my-6 border-border" />);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-sm leading-relaxed mb-2">{renderPreviewInline(line)}</p>);
    }
    i++;
  }
  return elements;
}

function renderPreviewInline(text: string): (string | JSX.Element)[] {
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
      parts.push(<a key={match.index} href={match[7]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{match[6]}</a>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

export default function BlogManagePage() {
  useDocumentTitle("Manage Blog Posts");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: adminData, isLoading: adminLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/blog/admin-check"],
    enabled: isAuthenticated,
  });
  const isAdmin = adminData?.isAdmin ?? false;

  const [editPost, setEditPost] = useState<BlogPost | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formExcerpt, setFormExcerpt] = useState("");
  const [formCoverImage, setFormCoverImage] = useState("");
  const [formTags, setFormTags] = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const insertFormat = useCallback((prefix: string, suffix: string = "", placeholder: string = "") => {
    const textarea = contentRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formContent.substring(start, end);
    const textToInsert = selectedText || placeholder;
    const newText = formContent.substring(0, start) + prefix + textToInsert + suffix + formContent.substring(end);
    setFormContent(newText);
    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + prefix.length + textToInsert.length + suffix.length;
      textarea.setSelectionRange(
        selectedText ? cursorPos : start + prefix.length,
        selectedText ? cursorPos : start + prefix.length + textToInsert.length
      );
    }, 0);
  }, [formContent]);

  const insertLine = useCallback((prefix: string, placeholder: string = "") => {
    const textarea = contentRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const beforeCursor = formContent.substring(0, start);
    const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith("\n");
    const insertion = (needsNewline ? "\n" : "") + prefix + placeholder;
    const newText = beforeCursor + insertion + formContent.substring(start);
    setFormContent(newText);
    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + insertion.length;
      textarea.setSelectionRange(cursorPos - placeholder.length, cursorPos);
    }, 0);
  }, [formContent]);

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog", "manage"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/blog?includeUnpublished=true", { credentials: "include" });
        if (!res.ok) {
          console.log("[BlogManage] API response not ok:", res.status, res.statusText);
          return [];
        }
        const data = await res.json();
        console.log("[BlogManage] Loaded posts:", data?.length || 0);
        return data;
      } catch (err) {
        console.error("[BlogManage] Failed to fetch:", err);
        return [];
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; excerpt: string; coverImage: string; tags: string[]; published: boolean }) => {
      const res = await fetch("/api/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create post");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      resetForm();
      toast({ title: "Post created", description: "Your blog post has been saved." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; content?: string; excerpt?: string; coverImage?: string; tags?: string[]; published?: boolean }) => {
      const res = await fetch(`/api/blog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update post");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      resetForm();
      toast({ title: "Post updated", description: "Your changes have been saved." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/blog/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete post");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      setDeleteConfirm(null);
      toast({ title: "Post deleted", description: "The blog post has been removed." });
    },
  });

  const resetForm = () => {
    setShowEditor(false);
    setEditPost(null);
    setFormTitle("");
    setFormContent("");
    setFormExcerpt("");
    setFormCoverImage("");
    setFormTags("");
  };

  const openNewPost = () => {
    resetForm();
    setShowEditor(true);
  };

  const openEditPost = (post: BlogPost) => {
    setEditPost(post);
    setFormTitle(post.title);
    setFormContent(post.content);
    setFormExcerpt(post.excerpt || "");
    setFormCoverImage(post.coverImage || "");
    setFormTags(post.tags?.join(", ") || "");
    setShowEditor(true);
  };

  const handleSave = (published: boolean) => {
    const tags = formTags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    if (editPost) {
      updateMutation.mutate({
        id: editPost.id,
        title: formTitle,
        content: formContent,
        excerpt: formExcerpt || undefined,
        coverImage: formCoverImage || undefined,
        tags,
        published,
      });
    } else {
      createMutation.mutate({
        title: formTitle,
        content: formContent,
        excerpt: formExcerpt,
        coverImage: formCoverImage,
        tags,
        published,
      });
    }
  };

  const togglePublish = (post: BlogPost) => {
    updateMutation.mutate({ id: post.id, published: !post.published });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const drafts = posts?.filter(p => !p.published) || [];
  const published = posts?.filter(p => p.published) || [];

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground text-center max-w-md">Only administrators can manage blog posts.</p>
        <Button variant="outline" asChild>
          <Link href="/blog">Back to Blog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" asChild className="shrink-0" data-testid="button-back-blog">
              <Link href="/blog">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Blog
              </Link>
            </Button>
          </div>
          <Button size="sm" onClick={openNewPost} data-testid="button-create-post">
            <Plus className="w-4 h-4 mr-1.5" />
            New Post
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h2 className="text-xl font-bold mb-6" data-testid="text-manage-title">Manage Blog Posts</h2>

        {drafts.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Drafts ({drafts.length})</h3>
            <div className="space-y-3">
              {drafts.map(post => (
                <Card key={post.id} data-testid={`card-draft-${post.id}`}>
                  <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium truncate">{post.title}</h4>
                        <Badge variant="outline" className="text-xs no-default-active-elevate">Draft</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(post.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/blog/${post.slug}`)} data-testid={`button-preview-${post.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEditPost(post)} data-testid={`button-edit-${post.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => togglePublish(post)} data-testid={`button-publish-${post.id}`}>
                        <Eye className="w-4 h-4 text-green-500" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm(post.id)} data-testid={`button-delete-${post.id}`}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {published.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Published ({published.length})</h3>
            <div className="space-y-3">
              {published.map(post => (
                <Card key={post.id} data-testid={`card-published-${post.id}`}>
                  <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium truncate">{post.title}</h4>
                        <Badge variant="secondary" className="text-xs no-default-active-elevate bg-green-500/10 text-green-700 dark:text-green-400">Published</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(post.createdAt).toLocaleDateString()}
                        {post.tags && post.tags.length > 0 && (
                          <span className="ml-2">{post.tags.join(", ")}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/blog/${post.slug}`)} data-testid={`button-view-${post.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEditPost(post)} data-testid={`button-edit-pub-${post.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => togglePublish(post)} data-testid={`button-unpublish-${post.id}`}>
                        <EyeOff className="w-4 h-4 text-amber-500" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm(post.id)} data-testid={`button-delete-pub-${post.id}`}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!isLoading && (!posts || posts.length === 0) && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Edit className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No blog posts yet</h3>
            <p className="text-muted-foreground mb-4">Create your first post to share insights with your audience.</p>
            <Button onClick={openNewPost} data-testid="button-create-first-post">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Your First Post
            </Button>
          </div>
        )}
      </main>

      <Dialog open={showEditor} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPost ? "Edit Post" : "New Blog Post"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Your blog post title"
                data-testid="input-post-title"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Excerpt (short summary)</label>
              <Textarea
                value={formExcerpt}
                onChange={e => setFormExcerpt(e.target.value)}
                placeholder="A brief description shown on the blog listing..."
                rows={2}
                data-testid="input-post-excerpt"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Content</label>
              <Tabs defaultValue="write">
                <TabsList className="mb-2">
                  <TabsTrigger value="write" data-testid="tab-write">
                    <Type className="w-3.5 h-3.5 mr-1.5" />
                    Write
                  </TabsTrigger>
                  <TabsTrigger value="preview" data-testid="tab-preview">
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    Preview
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="write" className="mt-0">
                  <div className="flex items-center gap-0.5 p-1.5 border border-b-0 rounded-t-md bg-muted/50 flex-wrap">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => insertLine("## ", "Heading")} data-testid="button-format-h2">
                          <Heading2 className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Heading</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => insertLine("### ", "Subheading")} data-testid="button-format-h3">
                          <Heading3 className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Subheading</TooltipContent>
                    </Tooltip>
                    <div className="w-px h-5 bg-border mx-1" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => insertFormat("**", "**", "bold text")} data-testid="button-format-bold">
                          <Bold className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Bold</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => insertFormat("_", "_", "italic text")} data-testid="button-format-italic">
                          <Italic className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Italic</TooltipContent>
                    </Tooltip>
                    <div className="w-px h-5 bg-border mx-1" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => insertLine("- ", "List item")} data-testid="button-format-ul">
                          <List className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Bullet list</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => insertLine("1. ", "List item")} data-testid="button-format-ol">
                          <ListOrdered className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Numbered list</TooltipContent>
                    </Tooltip>
                    <div className="w-px h-5 bg-border mx-1" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => insertLine("> ", "Quote")} data-testid="button-format-quote">
                          <Quote className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Block quote</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => insertFormat("[", "](https://)", "link text")} data-testid="button-format-link">
                          <Link2 className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Link</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => insertLine("---")} data-testid="button-format-hr">
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Divider</TooltipContent>
                    </Tooltip>
                  </div>
                  <Textarea
                    ref={contentRef}
                    value={formContent}
                    onChange={e => setFormContent(e.target.value)}
                    placeholder="Write your post content here..."
                    rows={14}
                    className="font-mono text-sm rounded-t-none border-t-0"
                    data-testid="input-post-content"
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-0">
                  <div className="border rounded-md p-4 min-h-[350px] bg-background">
                    {formContent ? (
                      <div>{renderPreviewContent(formContent)}</div>
                    ) : (
                      <p className="text-muted-foreground text-sm italic">Start writing to see a preview here...</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Cover Image URL (optional)</label>
                <Input
                  value={formCoverImage}
                  onChange={e => setFormCoverImage(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  data-testid="input-post-cover"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Tags (comma-separated)</label>
                <Input
                  value={formTags}
                  onChange={e => setFormTags(e.target.value)}
                  placeholder="AI, Documents, Study, Research"
                  data-testid="input-post-tags"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={resetForm} disabled={isSaving} data-testid="button-cancel-post">
              Cancel
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleSave(false)} 
              disabled={!formTitle || !formContent || isSaving}
              data-testid="button-save-draft"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save as Draft
            </Button>
            <Button 
              onClick={() => handleSave(true)} 
              disabled={!formTitle || !formContent || isSaving}
              data-testid="button-publish-post"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Eye className="w-4 h-4 mr-1.5" />}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Delete Post
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this blog post? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
