import { Router, Request, Response } from "express";
import { db } from "./auth-db";
import { blogPosts, users } from "@shared/models/auth";
import { eq, desc, and, sql } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";

const router = Router();

const ADMIN_EMAILS = [
  'owner@evident.demo',
  'admin@evident.ai',
  'moses@evident-ai.net',
  'mosesekbote@yahoo.com'
];

const getUserId = (req: Request): string | null => {
  const session = (req as any).session;
  if (session?.userId && session?.authProvider === "email") return session.userId;
  if ((req as any).tokenUserId) return (req as any).tokenUserId;
  const user = req.user as any;
  return user?.claims?.sub || user?.id || null;
};

async function isAdminUser(req: Request): Promise<boolean> {
  const userId = getUserId(req);
  if (!userId) return false;
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.email) return false;
    return ADMIN_EMAILS.includes(user.email.toLowerCase());
  } catch {
    return false;
  }
}

function blogAdminOnly(req: Request, res: Response, next: any) {
  isAdminUser(req).then(isAdmin => {
    if (!isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  }).catch(() => {
    res.status(403).json({ message: "Admin access required" });
  });
}

router.get("/api/blog/admin-check", isAuthenticated, async (req: Request, res: Response) => {
  const isAdmin = await isAdminUser(req);
  res.json({ isAdmin });
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

router.get("/api/blog", async (req: Request, res: Response) => {
  try {
    const isAdmin = await isAdminUser(req);
    let posts;
    if (isAdmin) {
      posts = await db
        .select()
        .from(blogPosts)
        .orderBy(desc(blogPosts.createdAt));
    } else {
      posts = await db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.published, true))
        .orderBy(desc(blogPosts.createdAt));
    }

    res.json(posts);
  } catch (error: any) {
    console.error("[Blog] Error fetching posts:", error);
    res.status(500).json({ message: "Failed to fetch blog posts" });
  }
});

router.get("/api/blog/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);

    if (!post) {
      res.status(404).json({ message: "Blog post not found" });
      return;
    }

    const userId = getUserId(req);
    if (!post.published && !userId) {
      res.status(404).json({ message: "Blog post not found" });
      return;
    }

    res.json(post);
  } catch (error: any) {
    console.error("[Blog] Error fetching post:", error);
    res.status(500).json({ message: "Failed to fetch blog post" });
  }
});

router.post("/api/blog", isAuthenticated, blogAdminOnly, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const { title, content, excerpt, coverImage, tags, published } = req.body;

    if (!title || !content) {
      res.status(400).json({ message: "Title and content are required" });
      return;
    }

    let slug = slugify(title);
    const existing = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);
    if (existing.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    const session = (req as any).session;
    const authorName = "Evident Team";

    const [post] = await db
      .insert(blogPosts)
      .values({
        title,
        slug,
        content,
        excerpt: excerpt || null,
        coverImage: coverImage || null,
        tags: tags || [],
        authorId: userId,
        authorName,
        published: published || false,
      })
      .returning();

    res.status(201).json(post);
  } catch (error: any) {
    console.error("[Blog] Error creating post:", error);
    res.status(500).json({ message: "Failed to create blog post" });
  }
});

router.post("/api/blog/fix-author-names", async (req: Request, res: Response) => {
  try {
    const result = await db.update(blogPosts)
      .set({ authorName: "Evident Team" })
      .where(sql`${blogPosts.authorName} LIKE '%@%'`)
      .returning({ id: blogPosts.id, authorName: blogPosts.authorName });
    res.json({ updated: result.length, posts: result });
  } catch (error: any) {
    console.error("[Blog] Error fixing author names:", error);
    res.status(500).json({ message: "Failed to fix author names" });
  }
});

router.post("/api/blog/seed-evident-posts", async (req: Request, res: Response) => {
  try {
    const seedPosts = [
      {
        title: "How Evident Transforms Document Q&A with AI-Powered Citations",
        slug: "evident-document-qa-ai-citations",
        content: `## The Problem with Traditional Document Review\n\nEvery day, professionals and students spend hours manually searching through documents for specific information. Whether it's a legal contract, research paper, or study material, finding the exact answer you need can feel like searching for a needle in a haystack.\n\n## How Evident Changes Everything\n\nEvident uses advanced AI to understand your documents at a deep level. When you upload a file — whether it's a PDF, Word document, spreadsheet, or even an image — Evident processes and indexes every piece of content.\n\n### Ask Questions in Plain Language\n\nNo need for complex search queries. Simply ask your question the way you'd ask a colleague:\n\n- "What are the payment terms in this contract?"\n- "Summarize the key findings from this research paper"\n- "What does section 4.2 say about data privacy?"\n\n### Citations You Can Trust\n\nEvery answer comes with precise citations pointing back to the exact section of your document. You can verify each claim, building confidence in the AI's responses.\n\n### Multiple Response Formats\n\nChoose how you want your answers structured:\n\n- **Executive** — Focused on decisions, impact, and risk assessment\n- **Student** — Step-by-step explanations with examples\n- **Technical** — Precise, detailed analysis with assumptions noted\n\n## Works With Any File Type\n\nEvident supports a wide range of file formats:\n\n- PDF documents (including scanned pages with OCR)\n- Word documents (.docx)\n- Spreadsheets (.xlsx, .csv)\n- PowerPoint presentations\n- Images (with text extraction)\n- Audio and video files (with transcription)\n\n## Getting Started\n\nUpload your first document and start asking questions. It's that simple. Evident handles all the processing in the background, and your documents are ready for Q&A within moments.\n\nThe future of document intelligence is here — and it's as easy as having a conversation.`,
        excerpt: "Discover how Evident's AI-powered Q&A system lets you ask questions about any document and get precise answers backed by real citations from your files.",
        tags: ["AI", "Documents", "Citations", "Q&A"],
        authorName: "Evident Team",
        published: false,
      },
      {
        title: "Study Smarter: How Evident's Study & Revision Tools Help You Ace Your Exams",
        slug: "study-revision-tools-ace-exams",
        content: `## Turn Your Notes Into Exam-Ready Materials\n\nStudying effectively isn't about reading your notes over and over. Research shows that active recall and practice testing are far more effective learning strategies. That's exactly what Evident's Study & Revision tools deliver.\n\n## Study Mode: Your Personal Exam Prep Assistant\n\nWhen you activate Study Mode in Evident, your documents transform into interactive learning materials.\n\n### Auto-Generated Quizzes\n\nUpload your lecture notes, textbook chapters, or study guides, and Evident will automatically generate:\n\n- **Multiple choice questions** to test your understanding\n- **Short answer questions** for deeper recall\n- **True/false questions** for quick concept checks\n\n### Smart Question Generation\n\nEvident doesn't just pull random facts from your documents. It identifies key concepts, relationships, and important details that are likely to appear on exams.\n\n### Instant Feedback\n\nAfter each quiz attempt, you get:\n\n- Detailed feedback on each answer\n- Explanations of why the correct answer is right\n- References back to the specific section in your notes\n\n## Focus Mode for Deep Study\n\nWhen you need to concentrate, Focus Mode removes distractions and gives you a clean, full-screen study environment.\n\n## Track Your Progress\n\nEvery quiz attempt is saved so you can see how you're improving over time. Identify weak areas and focus your revision where it matters most.\n\n## Works With Your Existing Materials\n\nNo need to create new study materials from scratch. Upload what you already have:\n\n- Lecture slides and handouts\n- Textbook chapters (PDF)\n- Your own handwritten notes (photographed or scanned)\n- Past exam papers for practice\n\n## Tips for Getting the Most Out of Study Mode\n\n- Upload all materials for a subject together for comprehensive quizzes\n- Use the different response formats — Student mode gives the clearest explanations\n- Review incorrect answers carefully and re-read the cited sections\n- Take quizzes multiple times to reinforce learning\n\nStart studying smarter today with Evident.`,
        excerpt: "From automatic quiz generation to flashcards and practice tests, learn how Evident's Study Mode turns your notes and textbooks into powerful revision tools.",
        tags: ["Study", "Revision", "Exams", "Education"],
        authorName: "Evident Team",
        published: false,
      },
      {
        title: "Deep Research: How to Build Your Personal Knowledge Base with Evident",
        slug: "deep-research-personal-knowledge-base",
        content: `## Beyond Document Q&A: Building Knowledge That Grows\n\nWhile document Q&A is powerful, sometimes you need information that goes beyond what's in your files. That's where Evident's Deep Research feature comes in.\n\n## What is Deep Research?\n\nDeep Research is Evident's built-in web research capability. When activated, it searches the web for the latest information on your topic and combines it with your uploaded documents to give you comprehensive, well-rounded answers.\n\n### How It Works\n\n- **Documents + Web Research** — When you have documents selected and Deep Research is on, Evident combines your document knowledge with fresh web insights\n- **Pure Research Mode** — With no documents selected, Deep Research gives you thorough web-based answers on any topic\n- **Always Learning** — Every research session is saved to your personal knowledge base for future reference\n\n## Your Personal Knowledge Base\n\nEverything you research with Deep Research is automatically saved. This means:\n\n- Past research enhances future answers without re-searching\n- You build a growing library of knowledge over time\n- Repeated queries use cached knowledge, saving time and resources\n\n### Manual Learning\n\nYou can also manually add topics for Evident to learn about:\n\n- "Solar energy from tesla.com" — learns specifically from Tesla's site\n- "Latest AI regulations" — learns from any relevant source\n- "Machine learning basics from coursera.org" — targeted learning\n\n## My Learning: Your Knowledge Hub\n\nAccess all your accumulated knowledge from the My Learning section. Here you'll find:\n\n- Research from Deep Research sessions\n- Manually added topics\n- Community shared knowledge from other users\n\n## Community Knowledge Base\n\nShare what you've learned with other users anonymously. When you find a particularly useful piece of research, share it to help others — and benefit from what they've shared too.\n\n## Getting Started with Deep Research\n\n1. Toggle on Deep Research in the Q&A section\n2. Ask any question — with or without documents selected\n3. Review the sources and citations provided\n4. Find your research saved in My Learning\n\nDeep Research transforms Evident from a document tool into a comprehensive research assistant that gets smarter every time you use it.`,
        excerpt: "Learn how Evident's Deep Research feature combines web research with your documents to create a growing personal knowledge base you can always refer back to.",
        tags: ["Research", "Knowledge Base", "Learning", "AI"],
        authorName: "Evident Team",
        published: false,
      },
      {
        title: "Privacy First: How Evident Keeps Your Documents Safe and Secure",
        slug: "privacy-first-document-security",
        content: `## Your Documents, Your Control\n\nIn a world where data breaches make headlines regularly, trusting an AI platform with your sensitive documents requires strong security foundations. At Evident, privacy isn't an afterthought — it's a core design principle.\n\n## How We Protect Your Data\n\n### Secure File Storage\n\nAll uploaded documents are stored in enterprise-grade cloud storage with encryption at rest. Your files are isolated and accessible only through your authenticated account.\n\n### No Training on Your Data\n\nYour documents are never used to train AI models. The AI processes your files to answer your questions, but your content remains private and is never shared with other users or used to improve general AI models.\n\n### Content Protection System\n\nEvident employs a multi-layer content protection system:\n\n- **Content Moderation** — Screens for harmful or inappropriate content\n- **Prompt Injection Detection** — Prevents attempts to manipulate the AI\n- **Answer Quality Validation** — Ensures responses are relevant and accurate\n- **Source Verification** — Cross-references answers with your actual documents\n- **Audit Logging** — Tracks all interactions for accountability\n\n## User-Level Isolation\n\nEvery user's data is completely separated:\n\n- Documents are stored in user-specific directories\n- Embeddings and search indices are scoped to individual users\n- Learning history and research are private by default\n- Community sharing is opt-in and anonymous\n\n## Enterprise Security Features\n\nFor organizations, Evident offers additional security capabilities:\n\n- **Role-Based Access Control** — Define who can access what\n- **Audit Trails** — Complete logs of all document interactions\n- **Policy Enforcement** — Set organizational rules for AI usage\n- **Agent Management** — Control and monitor AI agent deployments\n\n## Transparency in AI\n\nEvery answer Evident provides includes:\n\n- Clear citations to source documents\n- Confidence indicators\n- The ability to verify claims against original text\n- An AI disclaimer accessible from every page\n\n## Your Data Rights\n\nYou maintain full control over your data at all times:\n\n- Download your documents whenever you want\n- Delete files permanently with one click\n- Export your research and learning history\n- Close your account and all data is removed\n\nWe believe AI should enhance your work without compromising your privacy. That's the Evident promise.`,
        excerpt: "Understanding Evident's approach to data privacy, document security, and why your files are always under your control.",
        tags: ["Privacy", "Security", "Enterprise", "Trust"],
        authorName: "Evident Team",
        published: false,
      },
    ];

    const results = [];
    for (const post of seedPosts) {
      const existing = await db.select().from(blogPosts).where(eq(blogPosts.slug, post.slug)).limit(1);
      if (existing.length > 0) {
        results.push({ slug: post.slug, status: "already exists" });
        continue;
      }
      const [created] = await db.insert(blogPosts).values(post).returning();
      results.push({ slug: created.slug, status: "created" });
    }
    res.json({ results });
  } catch (error: any) {
    console.error("[Blog] Error seeding posts:", error);
    res.status(500).json({ message: "Failed to seed posts" });
  }
});

router.patch("/api/blog/:id", isAuthenticated, blogAdminOnly, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const { id } = req.params;
    const [existing] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Blog post not found" });
      return;
    }

    const { title, content, excerpt, coverImage, tags, published } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) {
      updates.title = title;
      if (title !== existing.title) {
        let newSlug = slugify(title);
        const slugConflict = await db
          .select()
          .from(blogPosts)
          .where(eq(blogPosts.slug, newSlug))
          .limit(1);
        if (slugConflict.length > 0 && slugConflict[0].id !== id) {
          newSlug = `${newSlug}-${Date.now()}`;
        }
        updates.slug = newSlug;
      }
    }
    if (content !== undefined) updates.content = content;
    if (excerpt !== undefined) updates.excerpt = excerpt;
    if (coverImage !== undefined) updates.coverImage = coverImage;
    if (tags !== undefined) updates.tags = tags;
    if (published !== undefined) updates.published = published;

    const [updated] = await db
      .update(blogPosts)
      .set(updates)
      .where(eq(blogPosts.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    console.error("[Blog] Error updating post:", error);
    res.status(500).json({ message: "Failed to update blog post" });
  }
});

router.delete("/api/blog/:id", isAuthenticated, blogAdminOnly, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const { id } = req.params;
    const [existing] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Blog post not found" });
      return;
    }

    await db.delete(blogPosts).where(eq(blogPosts.id, id));
    res.json({ message: "Blog post deleted" });
  } catch (error: any) {
    console.error("[Blog] Error deleting post:", error);
    res.status(500).json({ message: "Failed to delete blog post" });
  }
});

export default router;
