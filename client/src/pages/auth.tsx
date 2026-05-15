import { useState, useMemo, useRef, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, User, Eye, EyeOff, ArrowLeft, GraduationCap, Home, Ticket } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { setStoredAuthToken, useAuth } from "@/hooks/use-auth";

function CodeInputGroup({ value, onChange, disabled, autoFocus }: { value: string; onChange: (v: string) => void; disabled?: boolean; autoFocus?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6);
    onChange(cleaned);
  };

  return (
    <div className="flex flex-col items-center gap-2" data-testid="code-input-group">
      <Input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        placeholder="000000"
        className="w-48 h-14 text-center text-2xl font-mono font-semibold tracking-[0.5em]"
        data-testid="input-verification-code"
      />
      <p className="text-xs text-muted-foreground">6-digit code</p>
    </div>
  );
}

export default function AuthPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const defaultTab = useMemo(() => (params.get("tab") === "register" || params.get("coupon")) ? "register" : "login", [params]);
  const isStudentFlow = useMemo(() => params.get("student") === "true", [params]);
  const urlCoupon = useMemo(() => params.get("coupon") || "", [params]);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");
  const [registerCouponCode, setRegisterCouponCode] = useState(urlCoupon);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const isEduEmail = registerEmail.toLowerCase().endsWith(".edu");

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [showPasswordFlow, setShowPasswordFlow] = useState(false);
  const [codeEmail, setCodeEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [isStudentCode, setIsStudentCode] = useState(isStudentFlow);
  const isCodeEduEmail = codeEmail.toLowerCase().endsWith(".edu");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      setLocation("/full");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const navigateToApp = (data: any) => {
    if (data.authToken) {
      setStoredAuthToken(data.authToken);
    }
    queryClient.clear();
    fetch("/api/email/welcome", {
      method: "POST",
      credentials: "include",
      headers: data.authToken ? { "X-Auth-Token": data.authToken } : undefined,
    }).catch(() => {});
    const isIOSWebView = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOSWebView && data.authToken) {
      window.location.href = `/full?auth_token=${data.authToken}`;
    } else {
      window.location.href = "/full";
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/send-code", { email: codeEmail });
      const data = await response.json();
      setIsExistingAccount(!!data.isExistingAccount);
      setCodeSent(true);
      setTimeout(() => { const r = document.getElementById('root'); if (r) r.scrollTo({ top: 0, behavior: "smooth" }); window.scrollTo({ top: 0, behavior: "smooth" }); }, 100);
      toast({
        title: data.isExistingAccount ? "Welcome back!" : "Code sent",
        description: data.isExistingAccount
          ? `We found your account. Enter the code sent to ${codeEmail} to sign in.`
          : `We've sent a 6-digit code to ${codeEmail} to create your account.`,
      });
    } catch (error: any) {
      toast({
        title: "Could not send code",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) return;
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/verify-code", {
        email: codeEmail,
        code: verificationCode,
        isStudent: isStudentCode,
        couponCode: urlCoupon || undefined,
      });
      const data = await response.clone().json();

      if (data.couponApplied) {
        toast({
          title: "Welcome to Evident Scholar!",
          description: `Your ${data.trialDays}-day complimentary access has been activated.`,
        });
      } else if (data.scholarApplied) {
        toast({
          title: "Welcome to Evident Scholar!",
          description: "Your 60-day complimentary access has been activated.",
        });
      }

      navigateToApp(data);
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid or expired code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        email: loginEmail,
        password: loginPassword,
      });
      const data = await response.clone().json();
      navigateToApp(data);
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/auth/forgot-password", {
        email: forgotPasswordEmail,
      });
      const data = await response.json();
      
      toast({
        title: "Check your email",
        description: data.message,
      });
      
      setShowForgotPassword(false);
      setForgotPasswordEmail("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset link",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/auth/register", {
        email: registerEmail,
        password: registerPassword,
        firstName: registerFirstName,
        lastName: registerLastName,
        couponCode: registerCouponCode || undefined,
      });
      const data = await response.clone().json();
      
      if (data.couponApplied) {
        toast({
          title: "Welcome to Evident Scholar!",
          description: `Your ${data.trialDays}-day complimentary access has been activated.`,
        });
      }

      navigateToApp(data);
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showPasswordFlow) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
        <div className="w-full max-w-md space-y-3">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-home">
              <Home className="w-4 h-4 mr-1" />
              Home
            </Button>
          </Link>
          <Card className="w-full">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Sign in with password</CardTitle>
              <CardDescription>Use your email and password to sign in or create an account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login" data-testid="tab-login">Sign In</TabsTrigger>
                  <TabsTrigger value="register" data-testid="tab-register">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-4 mt-4">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="you@example.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-10"
                          required
                          data-testid="input-login-email"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type={showLoginPassword ? "text" : "password"}
                          placeholder="Your password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-10 pr-10"
                          required
                          data-testid="input-login-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          data-testid="button-toggle-login-password"
                        >
                          {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login-submit">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Sign In
                    </Button>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotPasswordEmail(loginEmail);
                          setShowForgotPassword(true);
                        }}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="button-forgot-password"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="register" className="space-y-4 mt-4">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="register-firstname">First Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="register-firstname"
                            type="text"
                            placeholder="John"
                            value={registerFirstName}
                            onChange={(e) => setRegisterFirstName(e.target.value)}
                            className="pl-10"
                            data-testid="input-register-firstname"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-lastname">Last Name</Label>
                        <Input
                          id="register-lastname"
                          type="text"
                          placeholder="Doe"
                          value={registerLastName}
                          onChange={(e) => setRegisterLastName(e.target.value)}
                          data-testid="input-register-lastname"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="you@example.com"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          className="pl-10"
                          required
                          data-testid="input-register-email"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="register-password"
                          type={showRegisterPassword ? "text" : "password"}
                          placeholder="At least 6 characters"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          className="pl-10 pr-10"
                          required
                          minLength={6}
                          data-testid="input-register-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          data-testid="button-toggle-register-password"
                        >
                          {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {urlCoupon && (
                    <div className="space-y-2">
                      <Label htmlFor="register-coupon">Voucher Code</Label>
                      <div className="relative">
                        <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="register-coupon"
                          type="text"
                          value={registerCouponCode}
                          readOnly
                          className="pl-10 font-mono tracking-wider bg-muted"
                          data-testid="input-register-coupon"
                        />
                      </div>
                    </div>
                    )}
                    <div className="space-y-2">
                      {isEduEmail ? (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                          <GraduationCap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <p className="text-sm text-amber-700 dark:text-amber-300 flex-1">
                            {registerCouponCode ? "Your voucher code will be applied at signup" : "60-day free Evident Scholar access will be applied to your .edu account"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-register-submit">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Create Account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <button
                type="button"
                onClick={() => { setShowPasswordFlow(false); setIsStudentCode(true); setCodeSent(false); setVerificationCode(""); setIsExistingAccount(false); }}
                className="w-full text-sm text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-amber-500/10 border border-amber-500/20"
                data-testid="button-student-signup-password"
              >
                <GraduationCap className="w-4 h-4" />
                Student? Get 60 days free with your .edu email
              </button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => { setShowPasswordFlow(false); setCodeSent(false); setVerificationCode(""); setIsExistingAccount(false); }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                  data-testid="button-back-to-code"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Sign in with email code instead
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  className="pl-10"
                  required
                  data-testid="input-forgot-email"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForgotPassword(false)}
                data-testid="button-forgot-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} data-testid="button-forgot-submit">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send Reset Link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-md space-y-3">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-home-code">
            <Home className="w-4 h-4 mr-1" />
            Home
          </Button>
        </Link>
        <Card className="w-full">
          <CardHeader className="text-center">
            {urlCoupon ? (
              <>
                <div className="flex justify-center mb-2">
                  <div className="p-3 rounded-full bg-amber-500/10">
                    <GraduationCap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl" data-testid="text-code-title">Student Pilot Program</CardTitle>
                <CardDescription data-testid="text-code-description">
                  Sign up with your .edu email to activate your 12-month Scholar access
                </CardDescription>
              </>
            ) : isStudentCode ? (
              <>
                <div className="flex justify-center mb-2">
                  <div className="p-3 rounded-full bg-amber-500/10">
                    <GraduationCap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl" data-testid="text-code-title">Student Access</CardTitle>
                <CardDescription data-testid="text-code-description">
                  Enter your .edu email for 60 days free Evident Scholar access
                </CardDescription>
              </>
            ) : (
              <>
                <div className="flex justify-center mb-2">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl" data-testid="text-code-title">Welcome to Evident</CardTitle>
                <CardDescription data-testid="text-code-description">
                  Enter your email and we'll send you a verification code to sign in
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!codeSent ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="code-email"
                      type="email"
                      placeholder={isStudentCode ? "you@university.edu" : "you@example.com"}
                      value={codeEmail}
                      onChange={(e) => setCodeEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoFocus
                      data-testid="input-code-email"
                    />
                  </div>
                  {isStudentCode && codeEmail && !isCodeEduEmail && codeEmail.includes("@") && (
                    <p className="text-sm text-muted-foreground" data-testid="text-edu-hint">
                      Use your university .edu email for free Scholar access
                    </p>
                  )}
                  {isStudentCode && isCodeEduEmail && (
                    <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                      <GraduationCap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        60-day Evident Scholar access will be activated
                      </p>
                    </div>
                  )}
                </div>
                {urlCoupon && (
                  <div className="space-y-2">
                    <Label>Voucher Code</Label>
                    <div className="relative">
                      <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="text"
                        value={urlCoupon}
                        readOnly
                        className="pl-10 font-mono tracking-wider bg-muted"
                        data-testid="input-code-flow-coupon"
                      />
                    </div>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-send-code">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Send Verification Code
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                {isExistingAccount ? (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center space-y-1" data-testid="text-existing-account">
                    <p className="text-sm font-medium text-foreground">Welcome back!</p>
                    <p className="text-xs text-muted-foreground">
                      We found an account for <span className="font-medium text-foreground">{codeEmail}</span>.
                      Enter the code to sign in.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-center space-y-1" data-testid="text-new-account">
                    <p className="text-sm font-medium text-foreground">Creating your account</p>
                    <p className="text-xs text-muted-foreground">
                      Enter the code sent to <span className="font-medium text-foreground">{codeEmail}</span> to set up your new account.
                    </p>
                  </div>
                )}
                <CodeInputGroup
                  value={verificationCode}
                  onChange={setVerificationCode}
                  disabled={isLoading}
                  autoFocus
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || verificationCode.length !== 6}
                  data-testid="button-verify-code"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Verify & Sign In
                </Button>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        await apiRequest("POST", "/api/auth/send-code", { email: codeEmail });
                        setVerificationCode("");
                        toast({ title: "Code resent", description: `A new code has been sent to ${codeEmail}` });
                      } catch {
                        toast({ title: "Could not resend", description: "Please try again", variant: "destructive" });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-resend-code"
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCodeSent(false); setVerificationCode(""); setIsExistingAccount(false); }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-change-email"
                  >
                    Change email
                  </button>
                </div>
              </form>
            )}

            {!isStudentCode && (
              <button
                type="button"
                onClick={() => { setIsStudentCode(true); setCodeSent(false); setVerificationCode(""); setIsExistingAccount(false); }}
                className="w-full text-sm text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-amber-500/10 border border-amber-500/20"
                data-testid="button-student-signup-link"
              >
                <GraduationCap className="w-4 h-4" />
                Student? Get 60 days free with your .edu email
              </button>
            )}

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { setShowPasswordFlow(true); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                data-testid="button-sign-in-with-password"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to password sign in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
