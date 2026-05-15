import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsPage() {
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
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Terms and Conditions</h1>
            <p className="text-sm text-muted-foreground">Last updated: January 2026</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Description of Service</h2>
              <p className="text-muted-foreground">
                Evident is an AI-powered document assistant that helps users upload files, ask questions, and receive answers with citations. The service uses artificial intelligence to analyze and summarize content from user-provided documents.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Account Responsibilities</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li>You are responsible for maintaining the security of your account credentials</li>
                <li>You must provide accurate information when creating an account</li>
                <li>You are responsible for all activity that occurs under your account</li>
                <li>You must be at least 18 years old to use this service</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Acceptable Use</h2>
              <p className="text-muted-foreground mb-3">You agree not to:</p>
              <ul className="space-y-2 text-muted-foreground">
                <li>Upload illegal, harmful, or malicious content</li>
                <li>Attempt to circumvent usage limits or security measures</li>
                <li>Use the service for unauthorized data collection</li>
                <li>Interfere with the service or other users' access</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Subscription Plans and Limits</h2>
              <p className="text-muted-foreground mb-3">
                Evident offers multiple subscription tiers with varying features. Current pricing is available on the Pricing page within the app. Plans include:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li><strong>Free:</strong> Limited storage and queries per month</li>
                <li><strong>Evident Lite:</strong> Extended storage, more queries, media support</li>
                <li><strong>Evident Scholar:</strong> For students and educators with study features</li>
                <li><strong>Evident Advanced:</strong> Higher limits, priority processing</li>
                <li><strong>Evident Max:</strong> Heavy usage with unlimited exports</li>
                <li><strong>Enterprise Plans:</strong> Team features, custom integrations, dedicated support</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                Usage beyond plan limits may result in temporary service restrictions until the next billing cycle. Subscriptions automatically renew unless cancelled before the renewal date.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Disclaimers</h2>
              <p className="text-muted-foreground">
                Evident is provided "as is" without warranties of any kind. AI-generated responses may contain errors or inaccuracies. Users should verify important information independently. Evident does not provide legal, medical, financial, or professional advice.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Limitation of Liability</h2>
              <p className="text-muted-foreground">
                To the maximum extent permitted by law, Evident shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Termination</h2>
              <p className="text-muted-foreground">
                We may suspend or terminate your account if you violate these terms. You may cancel your subscription at any time through your account settings.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the new terms.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-3">Contact</h2>
              <p className="text-muted-foreground">
                For questions about these terms, please contact us through your account settings or our support channels.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
