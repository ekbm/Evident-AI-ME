import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Send, ArrowLeft, Sparkles, FlaskConical, Gift, ListPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link, useLocation } from "wouter";
import type { PackIdType } from "@shared/packs";
import { PACKS } from "@shared/packs";

const requestFormSchema = z.object({
  industry: z.string().min(1, "Please select your industry"),
  painPoints: z.string().min(20, "Please describe your challenges in at least 20 characters"),
  useCase: z.string().optional(),
});

type RequestFormValues = z.infer<typeof requestFormSchema>;

interface RequestAccessFormProps {
  packId: PackIdType;
  isWaitlist?: boolean; // True for Free/Elite/Scholar users (waitlisted, not immediate access)
}

const INDUSTRIES = [
  "Technology / Software",
  "Financial Services",
  "Healthcare",
  "Manufacturing",
  "Retail / E-commerce",
  "Professional Services",
  "Education",
  "Real Estate",
  "Hospitality",
  "Telecommunications",
  "Energy / Utilities",
  "Transportation / Logistics",
  "Government / Public Sector",
  "Non-profit",
  "Other",
];

export function RequestAccessForm({ packId, isWaitlist = false }: RequestAccessFormProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const packDef = PACKS.find(p => p.id === packId);
  
  const { data: requestStatus, isLoading: checkingStatus } = useQuery<{ hasRequest: boolean; request: any }>({
    queryKey: [`/api/pack-requests/check/${packId}`],
  });

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      industry: "",
      painPoints: "",
      useCase: "",
    },
  });

  const submitRequest = useMutation({
    mutationFn: async (values: RequestFormValues) => {
      return apiRequest("POST", "/api/pack-requests", {
        packId,
        ...values,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pack-requests/check/${packId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/pack-requests"] });
    },
  });

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-3/4 mx-auto" />
            <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
            <div className="h-48 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (requestStatus?.hasRequest) {
    const status = requestStatus.request?.status;
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-lg mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" className="mb-6" onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Close & Return to Knowledge Space
          </Button>
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                {status === "approved" ? (
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                ) : status === "pending" ? (
                  <Clock className="h-8 w-8 text-amber-600" />
                ) : (
                  <Sparkles className="h-8 w-8 text-primary" />
                )}
              </div>
              <CardTitle>{packDef?.title || "Intelligence Pack"}</CardTitle>
              <CardDescription>
                {status === "approved" ? (
                  "Your access has been approved!"
                ) : status === "pending" ? (
                  "Your request is being reviewed"
                ) : (
                  "Request status"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Badge 
                variant={status === "approved" ? "default" : status === "pending" ? "secondary" : "outline"}
                className="mb-4"
              >
                {status === "approved" ? "Approved" : status === "pending" ? (isWaitlist ? "On Waitlist" : "Pending Review") : status}
              </Badge>
              {status === "pending" && (
                <p className="text-sm text-muted-foreground mb-6">
                  {isWaitlist 
                    ? "You're on our early access waitlist! We'll notify you when this pack is ready for you. Want immediate access? Upgrade to Evident Max."
                    : "We're reviewing your request and will notify you once it's been processed. This usually takes 1-2 business days."
                  }
                </p>
              )}
              {status === "pending" && isWaitlist && (
                <Link href="/pricing">
                  <Button variant="outline" className="mb-4" data-testid="button-upgrade-waitlist">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Upgrade for Immediate Access
                  </Button>
                </Link>
              )}
              {status === "approved" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-6">
                    You now have access to this Intelligence Pack. Start using it now!
                  </p>
                  <Link href={packDef?.routes.primaryPath || "/"}>
                    <Button className="w-full" data-testid="button-use-pack">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start Using {packDef?.title?.replace(" Intelligence Pack", "") || "Pack"}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Close & Return to Knowledge Space
        </Button>
        
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>{packDef?.title || "Intelligence Pack"}</CardTitle>
            <div className="flex items-center justify-center gap-2 mt-2">
              {isWaitlist ? (
                <Badge variant="outline" className="border-blue-500/50 text-blue-600 dark:text-blue-400">
                  <ListPlus className="h-3 w-3 mr-1" />
                  Join Waitlist
                </Badge>
              ) : (
                <Badge variant="secondary">Free Access</Badge>
              )}
              <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
                <FlaskConical className="h-3 w-3 mr-1" />
                Beta
              </Badge>
            </div>
            <CardDescription className="mt-4">
              {packDef?.shortDescription || "Specialized AI analysis for your industry"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isWaitlist ? (
              <Alert className="mb-6 border-blue-500/20 bg-blue-500/5">
                <ListPlus className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm">
                  <strong>Join Our Early Access Waitlist:</strong> These packs are in beta with limited workflows. 
                  Tell us what you need — if it's not on our list, we'll build it for you (free!). 
                  As an early contributor, you'll receive a <strong>free subscription</strong> when we launch. 
                  <Link href="/pricing" className="text-primary hover:underline ml-1">
                    Upgrade to Evident Max for immediate access.
                  </Link>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="mb-6 border-primary/20 bg-primary/5">
                <Gift className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  <strong>Early Access Benefit:</strong> These packs are in beta with limited workflows available. 
                  If your requirement isn't in the list, let us know and we'll create it for you — for free! 
                  As an early contributor, you'll receive a <strong>free subscription</strong> going forward.
                </AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit((values) => submitRequest.mutate(values))} className="space-y-6">
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Industry</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-industry">
                            <SelectValue placeholder="Select your industry" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INDUSTRIES.map((industry) => (
                            <SelectItem key={industry} value={industry}>
                              {industry}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="painPoints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What challenges are you trying to solve?</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the problems you face with document analysis in your work..."
                          className="min-h-[100px] resize-none"
                          data-testid="input-pain-points"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Help us understand your specific needs so we can better serve you
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="useCase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specific use case (optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Analyzing customer contracts, reviewing SLAs..."
                          data-testid="input-use-case"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitRequest.isPending}
                  data-testid="button-submit-request"
                >
                  {submitRequest.isPending ? (
                    "Submitting..."
                  ) : isWaitlist ? (
                    <>
                      <ListPlus className="h-4 w-4 mr-2" />
                      Join Waitlist
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Request Free Access
                    </>
                  )}
                </Button>

                {submitRequest.isError && (
                  <p className="text-sm text-destructive text-center">
                    Failed to submit request. Please try again.
                  </p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}