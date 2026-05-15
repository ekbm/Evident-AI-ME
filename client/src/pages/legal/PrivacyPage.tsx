import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="flex gap-2 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Home
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" size="sm" data-testid="button-pricing">
              Back to Pricing
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: January 2026</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">What We Collect</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li>Account information (email, name) when you sign up</li>
                <li>Files you upload for analysis</li>
                <li>Questions you ask and answers generated</li>
                <li>Conversation history to enable follow-up questions and context continuity</li>
                <li>Usage logs to improve our service</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">How We Use Your Data</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li>To provide document analysis and question answering features</li>
                <li>To generate citations and evidence references</li>
                <li>To create reports and exports you request</li>
                <li>To improve our AI models and service quality</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Conversation History</h2>
              <p className="text-muted-foreground mb-3">
                When you ask questions, we store your conversation history to enable follow-up questions and provide context for better answers. Each conversation remembers the last 10 messages to maintain context while keeping responses relevant.
              </p>
              <p className="text-muted-foreground">
                You can view, bookmark, and delete your conversations at any time through the Evident Threads panel. Deleting a conversation permanently removes all associated messages.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Storage and Retention</h2>
              <p className="text-muted-foreground mb-3">
                Your files and data are stored securely using industry-standard encryption. You can delete your files and conversations at any time through the application interface.
              </p>
              <p className="text-muted-foreground">
                We retain your data for as long as your account is active. Upon account deletion, your data is permanently removed within 30 days.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Sharing</h2>
              <p className="text-muted-foreground">
                We share data only with service providers necessary to operate Evident, including hosting infrastructure and AI processing services. We do not sell your data to third parties.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Analytics & Crash Reporting</h2>
              <p className="text-muted-foreground mb-3">
                We use Firebase Analytics to understand how users interact with Evident and improve our service. This includes anonymous usage data such as feature usage, session duration, and app performance metrics.
              </p>
              <p className="text-muted-foreground">
                We also use Firebase Crashlytics to collect crash reports and diagnose technical issues. This helps us identify and fix problems quickly to provide a better experience.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Your Controls</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li>Delete individual files at any time</li>
                <li>Delete conversations and their associated messages</li>
                <li>Request full account deletion</li>
                <li>Export your data upon request</li>
                <li>Contact us with privacy questions</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Contact</h2>
              <p className="text-muted-foreground">
                For privacy-related inquiries, please contact us through your account settings or our support channels.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
