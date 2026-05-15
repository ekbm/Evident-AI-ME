# Evident - Design Patterns & Examples

This document provides practical code examples for common patterns used throughout the Evident codebase.

## Table of Contents
1. [Job Queue Patterns](#job-queue-patterns)
2. [API Endpoint Patterns](#api-endpoint-patterns)
3. [Database Patterns](#database-patterns)
4. [Frontend Patterns](#frontend-patterns)
5. [File Processing Patterns](#file-processing-patterns)
6. [Authentication Patterns](#authentication-patterns)
7. [Error Handling Patterns](#error-handling-patterns)

---

## Job Queue Patterns

### Creating a New Job Type

**Step 1: Add job type to schema**

```typescript
// shared/models/auth.ts
export const JOB_TYPES = {
  FILE_INGESTION: "file_ingestion",
  LLM_CHAT: "llm_chat",
  // Add your new job type
  MY_NEW_TASK: "my_new_task",
} as const;
```

**Step 2: Create the processor**

```typescript
// server/job-processors.ts
import { registerJobProcessor, JOB_TYPES } from "./job-queue";

interface MyTaskPayload {
  documentId: string;
  options: {
    mode: "fast" | "thorough";
  };
}

registerJobProcessor(JOB_TYPES.MY_NEW_TASK, async (payload: MyTaskPayload) => {
  const { documentId, options } = payload;
  
  try {
    // Your processing logic here
    const result = await processDocument(documentId, options);
    
    return {
      success: true,
      data: result
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Processing failed"
    };
  }
});
```

**Step 3: Queue the job from an endpoint**

```typescript
// server/routes.ts
import { createJob, getQueuePosition, JOB_TYPES } from "./job-queue";

app.post("/api/my-task", isAuthenticated, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { documentId, mode } = req.body;
  
  // Create the job
  const job = await createJob(
    JOB_TYPES.MY_NEW_TASK,
    { documentId, options: { mode } },
    userId
  );
  
  // Return job ID for polling
  const queuePosition = await getQueuePosition(job.id);
  
  res.json({
    jobId: job.id,
    status: job.status,
    queuePosition,
  });
}));
```

**Step 4: Poll from frontend**

```typescript
// client/src/components/MyComponent.tsx
import { useJobStatus } from "@/hooks/use-job-status";

function MyComponent({ jobId }: { jobId: string }) {
  const { job, isLoading, error } = useJobStatus(jobId, {
    pollInterval: 2000,
    enabled: !!jobId,
  });
  
  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  
  if (job?.status === "completed") {
    return <Result data={job.result} />;
  }
  
  if (job?.status === "failed") {
    return <Error message={job.error} />;
  }
  
  return (
    <div>
      Processing... Position in queue: {job?.queuePosition || "calculating"}
    </div>
  );
}
```

---

## API Endpoint Patterns

### Standard CRUD Endpoint

```typescript
// GET - List with ownership check
app.get("/api/items", isAuthenticated, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  
  const items = await getItemsByUser(userId);
  res.json(items);
}));

// POST - Create with validation
app.post("/api/items", isAuthenticated, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { name, description } = req.body;
  
  // Validate
  if (!name || typeof name !== "string") {
    res.status(400).json({ message: "name is required" });
    return;
  }
  
  // Check limits
  const limitCheck = await checkItemLimit(userId);
  if (!limitCheck.allowed) {
    res.status(429).json({ 
      message: limitCheck.reason,
      upgradeAvailable: true 
    });
    return;
  }
  
  const item = await createItem({ userId, name, description });
  res.status(201).json(item);
}));

// DELETE - With ownership verification
app.delete("/api/items/:id", isAuthenticated, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const item = await getItemByIdAndOwner(req.params.id, userId);
  
  if (!item) {
    res.status(404).json({ message: "Item not found" });
    return;
  }
  
  await deleteItem(req.params.id);
  res.json({ message: "Item deleted" });
}));
```

### Plan-Gated Endpoint

```typescript
app.post("/api/premium-feature", isAuthenticated, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  
  // Check if feature is allowed for user's plan
  const entitlement = await getUserEntitlement(userId);
  if (!entitlement?.workspacesAllowed) {
    res.status(403).json({
      message: "This feature requires a Premium plan",
      upgradeAvailable: true,
      requiredPlan: "pro_plus"
    });
    return;
  }
  
  // Feature logic here
  const result = await doPremiumThing(req.body);
  res.json(result);
}));
```

---

## Database Patterns

### PostgreSQL with Drizzle ORM

```typescript
// Query with joins
import { db } from "./auth-db";
import { users, entitlements, subscriptions } from "@shared/models/auth";
import { eq, and } from "drizzle-orm";

async function getUserWithPlan(userId: string) {
  const [result] = await db
    .select({
      user: users,
      entitlement: entitlements,
      subscription: subscriptions,
    })
    .from(users)
    .leftJoin(entitlements, eq(users.id, entitlements.userId))
    .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
    .where(eq(users.id, userId))
    .limit(1);
  
  return result;
}

// Insert with returning
async function createWorkspace(userId: string, name: string) {
  const [workspace] = await db
    .insert(workspaces)
    .values({ userId, name })
    .returning();
  
  return workspace;
}

// Update with conditions
async function updateEntitlement(userId: string, planKey: string) {
  await db
    .update(entitlements)
    .set({ 
      planKey, 
      updatedAt: new Date() 
    })
    .where(eq(entitlements.userId, userId));
}

// Atomic operations with raw SQL
async function claimNextJob() {
  const result = await db.execute(sql`
    UPDATE job_queue
    SET status = 'processing', started_at = NOW()
    WHERE id = (
      SELECT id FROM job_queue
      WHERE status = 'pending'
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  
  return result.rows[0];
}
```

### SQLite for Documents

```typescript
// server/db.ts
import Database from "better-sqlite3";

const db = new Database("./data/evident.db");

// Prepared statements for performance
const getAssetStmt = db.prepare(`
  SELECT * FROM assets WHERE id = ? AND owner_id = ?
`);

export function getAssetByIdAndOwner(id: string, ownerId: string) {
  return getAssetStmt.get(id, ownerId);
}

// Vector similarity search
export function searchChunks(embedding: number[], assetIds: string[], topK: number) {
  const chunks = db.prepare(`
    SELECT * FROM chunks 
    WHERE asset_id IN (${assetIds.map(() => '?').join(',')})
  `).all(...assetIds);
  
  // Compute cosine similarity in JavaScript
  return chunks
    .map(chunk => ({
      ...chunk,
      similarity: cosineSimilarity(embedding, JSON.parse(chunk.embedding))
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
```

---

## Frontend Patterns

### Data Fetching with TanStack Query

```typescript
// Fetching a list
import { useQuery } from "@tanstack/react-query";

function AssetList() {
  const { data: assets, isLoading, error } = useQuery({
    queryKey: ["/api/assets"],
  });
  
  if (isLoading) return <Skeleton />;
  if (error) return <Error message={error.message} />;
  
  return (
    <div>
      {assets?.map(asset => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  );
}

// Fetching with parameters
function AssetDetail({ id }: { id: string }) {
  const { data: asset } = useQuery({
    queryKey: ["/api/assets", id],
    enabled: !!id,
  });
  
  return <div>{asset?.filename}</div>;
}
```

### Mutations with Cache Invalidation

```typescript
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

function UploadForm() {
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiRequest("POST", "/api/assets", formData);
    },
    onSuccess: () => {
      // Invalidate cache to refetch list
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
    },
  });
  
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };
  
  return (
    <div>
      <input type="file" onChange={handleUpload} />
      {uploadMutation.isPending && <Spinner />}
      {uploadMutation.isError && <Error message={uploadMutation.error.message} />}
    </div>
  );
}
```

### Form with Validation

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
});

type FormData = z.infer<typeof formSchema>;

function ContactForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });
  
  const onSubmit = async (data: FormData) => {
    await apiRequest("POST", "/api/contact", data);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" data-testid="button-submit">
          Submit
        </Button>
      </form>
    </Form>
  );
}
```

---

## File Processing Patterns

### Creating a New File Processor

```typescript
// server/ingest/ingest-myformat.ts
import { insertChunk } from "../db";
import { embedText } from "../embeddings";
import { chunkText } from "./chunker";

export async function ingestMyFormat(
  assetId: string, 
  filePath: string, 
  mime: string
): Promise<void> {
  // 1. Extract text from file
  const rawText = await extractTextFromMyFormat(filePath);
  
  // 2. Chunk the text
  const chunks = chunkText(rawText, {
    chunkSize: 1200,
    overlap: 150,
  });
  
  // 3. Generate embeddings and store
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);
    
    insertChunk({
      id: `${assetId}_chunk_${i}`,
      assetId,
      text: chunks[i],
      embedding: JSON.stringify(embedding),
      chunkIndex: i,
    });
  }
}
```

### Registering with the Ingestion Router

```typescript
// server/ingest/index.ts
import { ingestMyFormat } from "./ingest-myformat";

export async function ingestFile(assetId: string, filePath: string, mime: string) {
  switch (mime) {
    case "application/pdf":
      return ingestPdf(assetId, filePath, mime);
    case "application/vnd.my-format":
      return ingestMyFormat(assetId, filePath, mime);
    // ... other formats
    default:
      return ingestUnsupported(assetId, filePath, mime);
  }
}
```

---

## Authentication Patterns

### Middleware Chain

```typescript
// Check authentication
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Check specific plan
function requirePlan(planKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getUserId(req);
    const entitlement = await getUserEntitlement(userId);
    
    if (entitlement?.planKey === planKey) {
      return next();
    }
    
    res.status(403).json({ 
      message: `${planKey} plan required`,
      upgradeAvailable: true 
    });
  };
}

// Check admin role
function isAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (ADMIN_USER_IDS.includes(userId)) {
    return next();
  }
  res.status(403).json({ message: "Admin access required" });
}

// Usage
app.get("/api/admin/metrics", isAuthenticated, isAdmin, getMetricsHandler);
app.post("/api/workspaces", isAuthenticated, requirePlan("pro_plus"), createWorkspaceHandler);
```

### Getting User ID Safely

```typescript
function getUserId(req: Request): string | null {
  // Replit Auth
  if (req.user?.id) return req.user.id;
  
  // API key auth
  if (req.apiUser?.id) return req.apiUser.id;
  
  // Session
  if (req.session?.userId) return req.session.userId;
  
  return null;
}
```

---

## Error Handling Patterns

### Async Handler Wrapper

```typescript
// Wraps async route handlers to catch errors
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage
app.get("/api/items", asyncHandler(async (req, res) => {
  const items = await getItems(); // Errors automatically forwarded
  res.json(items);
}));
```

### Structured Error Responses

```typescript
// Standard error format
interface ErrorResponse {
  message: string;
  code?: string;
  upgradeAvailable?: boolean;
  meta?: Record<string, any>;
}

// Usage examples
res.status(400).json({ 
  message: "Invalid file format",
  code: "INVALID_FORMAT"
});

res.status(429).json({ 
  message: "You've reached your monthly question limit",
  code: "LIMIT_QUESTIONS_REACHED",
  upgradeAvailable: true,
  meta: { limit: 50, used: 50 }
});

res.status(403).json({ 
  message: "This feature requires Premium",
  code: "PLAN_REQUIRED",
  upgradeAvailable: true,
  meta: { requiredPlan: "pro_plus" }
});
```

### Frontend Error Handling

```typescript
import { useToast } from "@/hooks/use-toast";

function MyComponent() {
  const { toast } = useToast();
  
  const handleAction = async () => {
    try {
      await apiRequest("POST", "/api/action", data);
      toast({ title: "Success!", description: "Action completed." });
    } catch (error: any) {
      const message = error?.message || "Something went wrong";
      const upgradeAvailable = error?.upgradeAvailable;
      
      toast({ 
        title: "Error",
        description: message,
        variant: "destructive",
        action: upgradeAvailable ? (
          <Button onClick={() => navigate("/pricing")}>Upgrade</Button>
        ) : undefined
      });
    }
  };
}
```

---

## Testing Patterns

### API Testing

```typescript
// Using curl for quick tests
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"assetId": "abc123", "question": "What is this document about?"}'

// Check job status
curl http://localhost:5000/api/jobs/job-id-here \
  -H "Cookie: session=..."
```

### Database Testing

```sql
-- Check job queue status
SELECT status, COUNT(*) FROM job_queue GROUP BY status;

-- View pending jobs
SELECT id, job_type, priority, created_at 
FROM job_queue 
WHERE status = 'pending' 
ORDER BY priority DESC, created_at ASC;

-- Check user entitlements
SELECT u.email, e.plan_key, e.has_legal_pack 
FROM users u 
JOIN entitlements e ON u.id = e.user_id;
```

---

## Component Patterns

### Card with Loading State

```typescript
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function DataCard({ title, isLoading, children }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
```

### Status Badge

```typescript
import { Badge } from "@/components/ui/badge";

const statusVariants = {
  pending: "secondary",
  processing: "default",
  completed: "success",
  failed: "destructive",
} as const;

function StatusBadge({ status }: { status: keyof typeof statusVariants }) {
  return (
    <Badge variant={statusVariants[status]} data-testid={`status-${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
```

---

*Last Updated: January 2026*
