import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Smartphone,
  Camera,
  Bell,
  ArrowRight,
  Fingerprint,
  Wifi,
  Download,
  MonitorSmartphone,
} from "lucide-react";
import { SiApple } from "react-icons/si";
import { usePWAInstallPrompt } from "./pwa-install-banner";

const APP_STORE_URL = "https://apps.apple.com/au/app/evidentai/id6758041735";

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function isIOSDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isAndroidDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

interface GetTheAppSectionProps {
  variant?: "default" | "compact";
}

export function GetTheAppSection({ variant = "default" }: GetTheAppSectionProps) {
  const mobile = isMobileDevice();
  const ios = isIOSDevice();
  const android = isAndroidDevice();
  const { canInstall, promptInstall } = usePWAInstallPrompt();

  const mobileAdvantages = [
    { icon: Camera, label: "Scan documents with your camera", desc: "Point, snap, and Evi reads it instantly" },
    { icon: Bell, label: "Always one tap away", desc: "Open Evident straight from your home screen" },
    { icon: Fingerprint, label: "Quick access with biometrics", desc: "Secure, instant sign-in" },
    { icon: Wifi, label: "Fast loading, even on slow networks", desc: "App shell loads instantly from cache" },
  ];

  const handleInstall = async () => {
    if (canInstall) {
      await promptInstall();
    }
  };

  function renderAndroidCTA() {
    return (
      <div className="flex flex-col items-center gap-3">
        {canInstall ? (
          <Button
            size={variant === "compact" ? "default" : "lg"}
            onClick={handleInstall}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8 font-semibold"
            data-testid="button-pwa-install-section"
          >
            <Download className="w-5 h-5" />
            Install Evident App
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              <MonitorSmartphone className="w-4 h-4 inline mr-1" />
              Open your browser menu and tap <span className="font-semibold text-foreground">"Add to Home Screen"</span>
            </p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Installs like an app — no app store needed, no storage used
        </p>
      </div>
    );
  }

  function renderIOSCTA() {
    return (
      <div className="flex flex-col items-center gap-2">
        <Button
          size={variant === "compact" ? "default" : "lg"}
          onClick={() => window.open(APP_STORE_URL, "_blank")}
          className="bg-black hover:bg-gray-900 text-white gap-2 px-8"
          data-testid="button-app-store"
        >
          <SiApple className="w-5 h-5" />
          Download on App Store
        </Button>
        <p className="text-[10px] text-muted-foreground">Free on the App Store</p>
      </div>
    );
  }

  function renderDesktopCTA() {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">
          <Smartphone className="w-4 h-4 inline mr-1.5" />
          Visit <span className="font-semibold text-foreground">evident-ai.net</span> on your phone to install
        </p>
        <div className="flex items-center gap-3">
          {canInstall && (
            <Button
              onClick={handleInstall}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              data-testid="button-pwa-install-desktop"
            >
              <Download className="w-4 h-4" />
              Install as Desktop App
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(APP_STORE_URL, "_blank")}
            className="gap-2"
            data-testid="button-app-store-link"
          >
            <SiApple className="w-3.5 h-3.5" />
            iOS App Store
          </Button>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <section className="py-10 px-4 sm:px-6" data-testid="section-get-app-compact">
        <div className="max-w-3xl mx-auto">
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="flex items-center gap-4 shrink-0">
                  <img
                    src="/icon-192.png"
                    alt="Evident"
                    className="w-16 h-16 rounded-2xl shadow-lg"
                  />
                  <div className="sm:hidden">
                    <p className="font-bold text-lg">Get Evident on Your Phone</p>
                    <p className="text-xs text-muted-foreground">
                      {android ? "Install free — no app store needed" : ios ? "Free on the App Store" : "Works on any device"}
                    </p>
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <p className="font-bold text-lg hidden sm:block mb-1">Get Evident on Your Phone</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    {android
                      ? "Install Evident directly from your browser — it works just like a native app, with push notifications and offline access."
                      : "Scan documents with your camera, get push notifications, and access Evi on the go."}
                  </p>

                  {mobile && android ? renderAndroidCTA() :
                   mobile && ios ? renderIOSCTA() :
                   renderDesktopCTA()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="py-14 px-4 sm:px-6 bg-muted/30" data-testid="section-get-app">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">
            Take Evident With You
          </p>
          <h3 className="text-3xl md:text-4xl font-bold mb-3">
            {android ? (
              <>
                Install the App.{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  No App Store Needed.
                </span>
              </>
            ) : (
              <>
                Better on Mobile.{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Best as an App.
                </span>
              </>
            )}
          </h3>
          <p className="text-muted-foreground max-w-lg mx-auto">
            {android
              ? "Evident installs directly from your browser — it's fast, free, and works just like a native app."
              : "Evident works great in your browser, but the mobile app gives you superpowers."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-10">
          {mobileAdvantages.map((item) => (
            <Card key={item.label} className="text-left">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-0.5">{item.label}</h4>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="flex items-center gap-4">
              <img
                src="/icon-192.png"
                alt="Evident"
                className="w-16 h-16 rounded-2xl shadow-lg"
              />
              <div className="text-left">
                <p className="font-bold text-lg">Evident AI</p>
                <p className="text-xs text-muted-foreground">Your AI Document Assistant</p>
                <p className="text-[10px] text-muted-foreground">
                  {android ? "Free — installs in seconds" : "Free on all platforms"}
                </p>
              </div>
            </div>

            {mobile && android ? renderAndroidCTA() :
             mobile && ios ? renderIOSCTA() :
             renderDesktopCTA()}

            {mobile && android && (
              <div className="mt-2 pt-3 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(APP_STORE_URL, "_blank")}
                  className="text-muted-foreground text-xs gap-1.5"
                  data-testid="button-also-on-ios"
                >
                  <SiApple className="w-3 h-3" />
                  Also available on iPhone
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
