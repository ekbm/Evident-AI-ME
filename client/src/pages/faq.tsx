import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HelpCircle, LogIn, Sparkles } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

export default function FaqPage() {
  useDocumentTitle("FAQ - Frequently Asked Questions");
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Sign up prompt for non-authenticated users */}
        {!isLoading && !isAuthenticated && (
          <Card className="mb-6 border-accent/30 bg-accent/5">
            <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Free Plan
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Sign up free to save your work and unlock more features
                </span>
              </div>
              <Button asChild size="sm" data-testid="button-faq-signup">
                <a href="/auth">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign Up Free
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
        
        <div className="flex flex-col gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="self-start" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          
          <div className="flex items-center gap-3">
            <HelpCircle className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Frequently Asked Questions</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Common questions about Evident</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Why doesn't Evident always give an answer?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Evident is designed to answer questions only when the information is supported by your documents or cited sources. Some questions require assumptions, missing values, or methods that are not explicitly stated in the material. Instead of guessing, Evident will flag these gaps and explain what's missing. This helps you understand not just what the answer is, but whether the answer is actually defensible based on your data.</p>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How is Evident different from general AI chat tools?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>General AI tools are designed to generate helpful answers by drawing on broad training knowledge, even when some details are missing. Evident takes a different approach: it prioritises accuracy, traceability, and transparency. It answers from your documents and clearly distinguishes between supported information and assumptions, making it better suited for work where trust and accountability matter.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How do storage limits work?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Storage limits are based on files currently stored. When you delete a document, that space becomes available again. Your storage resets if you delete files, not monthly.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How do audio/video limits work?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Audio/video limits count <strong>total minutes transcribed</strong> each month. Once a video is processed, those minutes are used even if you delete the file. This resets on the 1st of each month.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Why doesn't the daily cap times 30 equal my monthly limit?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Daily caps are designed as <strong>burst protection</strong>, not to add up to your monthly total. They prevent you from using your entire month's allowance in one or two days.</p>
              <p className="mt-2">If you skip a day, that time isn't lost - it stays in your monthly pool. For example, with 5 hours monthly and a 20-minute daily cap, you can spread usage across 15+ days instead of exhausting everything on day one.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What counts as a "question"?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Each message you send in the chat counts as one question. Follow-up questions in the same conversation each count separately. Question limits reset monthly.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How does conversation memory work?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>When you ask follow-up questions, Evident remembers your recent conversation to give more relevant answers. The AI keeps track of your <strong>last 10 messages</strong> (5 question-answer pairs) within each conversation.</p>
              <p className="mt-2">This means you can ask "What about the second clause?" and Evident will understand you're referring to something from your earlier discussion. For longer research sessions, consider starting a new conversation to keep context focused.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Can I upgrade or downgrade anytime?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Yes! You can change your plan at any time. Upgrades take effect immediately. Downgrades apply at the end of your current billing period.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How does .edu verification work for Scholar?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>To access Scholar pricing, sign up with a valid .edu email address. We'll verify your student or educator status. Faculty and staff also qualify.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What happens if I hit my limit?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>You'll see a notification when approaching limits. Once reached, you can upgrade your plan or wait for the monthly reset. Your existing documents remain accessible.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How do document and storage limits work together?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p><strong>Both limits must be satisfied.</strong> For example, with 500MB storage and 25 documents: you could store 10 files of 10MB each (100MB total), or 25 smaller files totaling under 500MB. You cannot exceed either limit.</p>
              <p className="mt-2">Deleting files frees up both your storage space and document count immediately, so you can upload new files right away.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What are "indexed documents"?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Indexed documents are files that have been processed and made searchable by our AI. When you upload a document, we extract the text, understand its structure, and create a searchable index so you can ask questions about it.</p>
              <p className="mt-2">Enterprise plans support tens of thousands of indexed documents, enabling organization-wide knowledge search across all your content.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What are "knowledge chunks"?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Knowledge chunks are small, meaningful segments of your documents (typically a few paragraphs each). We break documents into chunks so the AI can find and cite the most relevant sections when answering your questions.</p>
              <p className="mt-2">More chunks means more granular search capability. Enterprise plans support millions of chunks for deep, precise answers across large document libraries.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What are Intelligence Packs?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Intelligence Packs are specialized AI capabilities tailored for specific industries and job functions. Each pack includes domain-specific prompts, document understanding, and workflows designed by experts.</p>
              <p className="mt-2"><strong>Available packs include:</strong> HR (hiring, onboarding), Sales, Service, Finance, Legal, Procurement, Construction, and Compliance.</p>
              <p className="mt-2"><strong>Currently in beta:</strong> Intelligence Packs are in early access with limited workflows that expand based on user requests. We're actively building features that users ask for — early contributors who help shape the product receive a free subscription!</p>
              <p className="mt-2"><strong>How to get access:</strong> Advanced and Max plan users can request free access. Free, Lite, and Scholar users can join our waitlist.</p>
              <p className="mt-2">Visit <Link href="/packs" className="text-primary hover:underline">Intelligence Packs</Link> to explore available packs, or <Link href="/packs/hr" className="text-primary hover:underline">express your interest</Link> to request access and tell us what workflows you need.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What do AI Agents do?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>AI Agents automatically sync and index content from your existing tools like SharePoint, Google Drive, Slack, Confluence, and more. They run in the background, keeping your knowledge base up-to-date without manual uploads.</p>
              <p className="mt-2">Enterprise plans include multiple AI Agents so your team can connect all their content sources and search across everything in one place.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What is Training Data Export?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Training Data Export lets you download your Q&A conversations as structured JSON or CSV files. This data can be used to fine-tune custom AI models on your organization's specific knowledge.</p>
              <p className="mt-2">For example, if your team asks hundreds of questions about company policies, you can export those Q&A pairs to train a private AI that "knows" your policies. Available on Evident Max and Enterprise plans.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What is AI Readiness Scanning?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>AI Readiness Scanning analyzes your documents to identify potential issues before you use them with AI tools. It checks for things like scanned images without text, complex tables, and formatting problems that could affect AI understanding.</p>
              <p className="mt-2">The scan helps you prepare your documents so AI can give you better, more accurate answers.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Why did my question get blocked?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Evident uses a Content Protection System to keep the AI safe and reliable. Your question may be blocked if it:</p>
              <p className="mt-2"><strong>Looks like a prompt injection:</strong> Phrases like "ignore all instructions", "forget your training", "pretend to be", or "jailbreak" are blocked to prevent manipulation of the AI. You'll see: "This query format is not supported."</p>
              <p className="mt-2"><strong>Contains harmful content:</strong> Questions involving hate speech, harassment, self-harm instructions, or violence are blocked. You'll see: "This question violates our content policy."</p>
              <p className="mt-2">This protection ensures the AI stays focused on helping you with your documents and can't be tricked into producing harmful or misleading responses.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What do the confidence levels mean?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>When you ask a question, Evident shows how confident it is in the answer:</p>
              <p className="mt-2"><strong>High confidence:</strong> Strong matches found in your documents. The answer is well-supported by your sources.</p>
              <p className="mt-2"><strong>Medium confidence:</strong> Some relevant content found, but the match isn't perfect. You may see: "This answer is based on limited matching content."</p>
              <p className="mt-2"><strong>Low confidence:</strong> Limited relevant information in your documents. Consider uploading more related files or rephrasing your question.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What file types are supported?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Evident supports PDFs, Word documents (.doc, .docx), Excel spreadsheets (.xls, .xlsx), PowerPoint presentations (.ppt, .pptx), images (for OCR), and audio/video files (for transcription).</p>
              <p className="mt-2">We're constantly adding support for more file types.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Why do some answers show more action options than others?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>The action options (like Generate Proposal, Generate PPT, Email) depend on two factors:</p>
              <p className="mt-2"><strong>1. Your question keywords:</strong> Asking about "proposals", "presentations", "summaries", or "policies" will show relevant action buttons. For example, asking "create a proposal based on this" shows proposal generation options.</p>
              <p className="mt-2"><strong>2. Number of sources:</strong> Actions like Generate PPT and Generate Proposal require at least 3 source documents with good text coverage. With fewer sources, these options may be limited to ensure quality output.</p>
              <p className="mt-2">To see more options: upload more relevant documents and use keywords like "proposal", "presentation", or "summary" in your questions.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How long does it take to process different file types?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Processing times depend on file type and size:</p>
              <p className="mt-2"><strong>Text documents (PDF, Word, TXT):</strong> 5-30 seconds for most files. Large PDFs (50+ pages) may take 1-2 minutes.</p>
              <p className="mt-2"><strong>Spreadsheets (Excel, CSV):</strong> 10-60 seconds depending on the number of sheets and data complexity.</p>
              <p className="mt-2"><strong>Presentations (PowerPoint):</strong> 10-45 seconds depending on slide count and embedded content.</p>
              <p className="mt-2"><strong>Images:</strong> 5-20 seconds. Images with text are processed with OCR to extract readable content.</p>
              <p className="mt-2"><strong>Audio/Video:</strong> Roughly 1 minute of processing per 1 minute of media. A 10-minute video takes about 10 minutes to transcribe.</p>
              <p className="mt-2"><strong>Scanned PDFs:</strong> 1-3 minutes as they require OCR (text recognition) to extract content from images.</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How does Evident protect against misuse?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Evident uses a <strong>multi-layer protection system</strong> to ensure safe and appropriate use:</p>
              <ul className="list-disc list-inside ml-2 mt-2 space-y-1">
                <li><strong>Content Moderation:</strong> All questions are screened using AI moderation to block harmful or inappropriate content</li>
                <li><strong>Prompt Protection:</strong> Detection systems prevent AI manipulation attempts and prompt injection</li>
                <li><strong>Answer Quality Validation:</strong> Responses are scored for relevance and confidence to ensure accurate answers</li>
                <li><strong>Source Verification:</strong> Answers are grounded in your uploaded documents with clear citations</li>
                <li><strong>Audit Logging:</strong> Flagged content is logged for security review</li>
              </ul>
              <p className="mt-2">These protections work together to maintain a secure, trustworthy platform while respecting your privacy.</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Is my data secure?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p><strong>Yes.</strong> Your documents are:</p>
              <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                <li>Encrypted in transit (TLS 1.2+) and at rest (AES-256)</li>
                <li>Only accessible to you (not shared across users)</li>
                <li>Processed securely using enterprise-grade AI</li>
                <li>Never used to train AI models</li>
              </ul>
              <p className="mt-2">See our <a href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</a> for full details.</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Where are my documents stored?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Your files are stored on <strong>enterprise-grade Google Cloud infrastructure</strong>. All data is:</p>
              <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                <li>Encrypted at rest using AES-256 encryption</li>
                <li>Encrypted in transit using TLS 1.2+</li>
                <li>Stored in secure, redundant cloud storage with regular backups</li>
                <li>Isolated per account — no shared storage between users</li>
              </ul>
              <p className="mt-2">Your documents never leave secure cloud storage. Structured data (search indexes, metadata, conversation history) is stored in a managed PostgreSQL database with the same encryption standards.</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How is Evident protected from hacking and vulnerabilities?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Evident uses <strong>multiple layers of security</strong> to protect your data:</p>
              <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                <li><strong>Passwordless authentication:</strong> Email verification codes eliminate password-based attacks</li>
                <li><strong>Rate limiting:</strong> Server-side throttling prevents brute force and abuse</li>
                <li><strong>Prompt injection detection:</strong> Guards against AI manipulation attempts</li>
                <li><strong>Content moderation:</strong> All inputs are screened for harmful content</li>
                <li><strong>Audit logging:</strong> Every action is logged for security review</li>
                <li><strong>Encrypted connections:</strong> All data in transit uses HTTPS/TLS</li>
                <li><strong>Session management:</strong> Secure token-based sessions with automatic expiry</li>
              </ul>
              <p className="mt-2">These protections work together so that even if one layer is bypassed, others remain active to keep your data safe.</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Can other users or organisations see my documents?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p><strong>No.</strong> Every account has complete data isolation:</p>
              <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                <li>Your documents, AI answers, and conversation history are only visible to you</li>
                <li>There is no cross-user access — even administrators cannot view your content</li>
                <li>Organisation features (when enabled) only share data with team members you explicitly invite</li>
                <li>Deleting a document removes all associated data (file, search index, and AI-generated content)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What are the file upload limits?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p><strong>Per-plan limits (Quick):</strong></p>
              <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                <li>Free: 15MB per file</li>
                <li>Evident Lite: 10MB per file</li>
                <li>Evident Scholar: 20MB per file</li>
                <li>Evident Advanced: 25MB per file</li>
                <li>Evident Max: 50MB per file</li>
                <li>Enterprise: 100MB per file</li>
              </ul>
              <p className="mt-2"><strong>Large option:</strong> Up to 500MB for all paid plans. Use the "Large" button for videos and large documents.</p>
              <p className="mt-2"><strong>Via cloud storage link:</strong> Up to 100MB. Upload your file to Google Drive, Dropbox, or OneDrive, then share the link with Evident.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How long does it take to upload large files?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p><strong>Upload time</strong> depends on your internet speed:</p>
              <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                <li>100MB file: ~1-3 minutes</li>
                <li>200MB file: ~2-5 minutes</li>
                <li>500MB file: ~5-15 minutes</li>
              </ul>
              <p className="mt-2 text-amber-600 dark:text-amber-400"><strong>Important:</strong> Please keep the page open until upload completes. Navigating away will cancel the upload.</p>
              <p className="mt-2"><strong>Processing time</strong> (after upload) happens in the background:</p>
              <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                <li>Documents: ~30 seconds per 10MB</li>
                <li>Video/Audio: ~1-2 minutes per minute of media</li>
              </ul>
              <p className="mt-2">Once upload completes, you can leave the page. We'll process your file in the background and notify you when it's ready.</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">Still have questions?</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/feedback">
              <Button variant="outline" data-testid="button-feedback">
                Send Feedback
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
