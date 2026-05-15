import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  GraduationCap,
  Upload,
  MessageCircle,
  Printer,
  ArrowLeft,
  Ticket,
  Sparkles,
  Users,
  Copy,
  Check,
} from "lucide-react";
import QRCode from "qrcode";
import { useDocumentTitle } from "@/hooks/use-document-title";

const VOUCHER_CODE = "UNI-STUDENT-2026";

export default function StudentPilotFlyer() {
  useDocumentTitle("Evident Student Pilot - Printable Flyer");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const signupUrl = `${window.location.origin}/auth?mode=students&coupon=${VOUCHER_CODE}`;

  useEffect(() => {
    QRCode.toDataURL(signupUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#090e1a", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setQrDataUrl);
  }, [signupUrl]);

  const handlePrint = () => window.print();

  const handleCopy = () => {
    navigator.clipboard.writeText(VOUCHER_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-student-pilot-flyer">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur print:hidden" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" data-testid="link-back-home">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
          </div>
          <Button onClick={handlePrint} className="gap-2" data-testid="button-print-flyer">
            <Printer className="w-4 h-4" />
            Print Flyer
          </Button>
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 print:px-0 print:py-0 print:max-w-none">
        <div className="text-center mb-8 print:hidden">
          <h1 className="text-2xl font-bold mb-2">Student Pilot Flyer</h1>
          <p className="text-muted-foreground text-sm">Print this flyer to share with university students. Cut along the dotted line for front and back cards.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 print:px-8">
          <Card className="overflow-hidden border-2 print:border print:shadow-none print:break-inside-avoid" data-testid="card-flyer-front">
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-[#090e1a] to-[#1a2744] text-white p-8 sm:p-10 min-h-[28rem] flex flex-col justify-between print:min-h-[24rem] print:p-8">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <img
                      src="/apple-touch-icon.png?v=3"
                      alt="Evident"
                      className="w-10 h-10 rounded-xl shadow-lg"
                      data-testid="img-flyer-logo"
                    />
                    <span className="text-lg font-bold tracking-tight">Evident</span>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-sm font-medium mb-5">
                    <GraduationCap className="w-4 h-4" />
                    Student Pilot Program
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold mb-2 leading-tight print:text-2xl">
                    Evident Student Pilot
                  </h2>

                  <p className="text-lg text-white/90 font-medium mb-2 print:text-base">
                    AI that answers from your study materials.
                  </p>

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 text-sm font-semibold mb-4">
                    <Sparkles className="w-3.5 h-3.5" />
                    12 months free Scholar access
                  </div>

                  <div className="space-y-2.5 mb-6">
                    <div className="flex items-start gap-2.5">
                      <Upload className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
                      <span className="text-sm text-white/80">Upload lecture slides, notes or PDFs</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <MessageCircle className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
                      <span className="text-sm text-white/80">Ask questions and get cited answers instantly</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
                      <span className="text-sm text-white/80">Generate flashcards, practice questions & summaries</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Scan to try it</p>
                    <p className="text-[10px] text-white/40">Use your university email to sign up</p>
                  </div>
                  {qrDataUrl && (
                    <div className="bg-white p-1.5 rounded-lg shrink-0" data-testid="img-qr-code">
                      <img src={qrDataUrl} alt="QR Code" className="w-28 h-28 print:w-24 print:h-24" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-2 print:border print:shadow-none print:break-inside-avoid" data-testid="card-flyer-back">
            <CardContent className="p-0">
              <div className="bg-card p-8 sm:p-10 min-h-[28rem] flex flex-col justify-between print:min-h-[24rem] print:p-8">
                <div>
                  <div className="flex items-center gap-2 mb-8">
                    <img
                      src="/apple-touch-icon.png?v=3"
                      alt="Evident"
                      className="w-8 h-8 rounded-lg"
                    />
                    <span className="text-sm font-semibold text-muted-foreground">Evident Student Pilot</span>
                  </div>

                  <h3 className="text-xl font-bold mb-6">12 months free for university students.</h3>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <GraduationCap className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Sign up with your .edu email</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Use the voucher code below during registration</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Ticket className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Get 12 months of Evident Scholar</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Full access to AI study tools, flashcards, practice questions & more</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Invite up to 3 classmates</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Generate your own referral code after signing up — each gets 60 days free</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Your Voucher Code</p>
                  <div
                    className="flex items-center justify-between gap-3 px-5 py-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors print:hover:bg-primary/5"
                    onClick={handleCopy}
                    data-testid="voucher-code-box"
                  >
                    <code className="text-xl sm:text-2xl font-mono font-bold tracking-wider text-primary print:text-xl">
                      {VOUCHER_CODE}
                    </code>
                    <Button variant="ghost" size="sm" className="shrink-0 print:hidden" data-testid="button-copy-voucher">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    Requires a university (.edu) email address · Limited to 20 students
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-6 print:hidden">
          <p className="text-xs text-muted-foreground">
            Tip: Print on card stock and cut for best results. The front (dark) and back (light) are designed to be printed double-sided.
          </p>
        </div>
      </main>

      <style>{`
        @media print {
          @page {
            margin: 0.5in;
            size: A4 landscape;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, footer, .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
