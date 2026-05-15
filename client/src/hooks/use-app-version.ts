import { useState, useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { APP_VERSION, BUILD_NUMBER, BUILD_DATE, COPYRIGHT_YEAR } from "@shared/version";

interface AppVersionInfo {
  version: string;
  build: string;
  buildDate: string;
  copyrightYear: string;
  isNative: boolean;
}

export function useAppVersion(): AppVersionInfo {
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo>({
    version: APP_VERSION,
    build: BUILD_NUMBER,
    buildDate: BUILD_DATE,
    copyrightYear: COPYRIGHT_YEAR,
    isNative: false,
  });

  useEffect(() => {
    async function getVersionFromNative() {
      if (Capacitor.isNativePlatform()) {
        try {
          const info = await App.getInfo();
          setVersionInfo({
            version: info.version,
            build: info.build,
            buildDate: BUILD_DATE,
            copyrightYear: COPYRIGHT_YEAR,
            isNative: true,
          });
        } catch (error) {
          console.log("Could not get native app info, using fallback");
        }
      }
    }
    getVersionFromNative();
  }, []);

  return versionInfo;
}
