"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallPlatform = "ios" | "android" | "mac-safari" | "desktop" | "firefox" | "other";

function getPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  if (/iPhone|iPad|iPod/i.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) return "mac-safari";
  if (/Firefox/i.test(ua)) return "firefox";
  if (/Windows|Macintosh|Linux/i.test(ua)) return "desktop";
  return "other";
}

export function PwaInstall() {
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    setPlatform(getPlatform());
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setVisible(!standalone);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
        console.error("Unable to register the offline app shell", error);
      });
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setShowHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || installed) return null;

  const install = async () => {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setVisible(false);
    }
    setInstallPrompt(null);
  };

  const steps: Record<InstallPlatform, string[]> = {
    ios: ["Open the browser’s Share menu and choose Add to Home Screen.", "If that option is not available, open this site in Safari and repeat.", "Tap Add to place Sajha Cafe on your home screen."],
    android: ["Open your browser menu.", "Choose Install app or Add to Home screen, then confirm."],
    "mac-safari": ["In Safari, choose File, then Add to Dock."],
    desktop: ["Choose the install icon in the address bar, or open the browser menu and choose Install Sajha Cafe."],
    firefox: ["This desktop browser does not offer PWA installation. Open Sajha Cafe in Chrome, Edge, or Safari to install it as an app."],
    other: ["Open this site’s browser menu and look for Install app or Add to Home Screen. Installation options vary by browser and device."],
  };

  return (
    <>
      <button aria-haspopup="dialog" className="pwa-install-trigger" onClick={() => void install()} type="button">
        <span aria-hidden="true">↓</span> Install app
      </button>
      {showHelp && <div className="pwa-install-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowHelp(false); }}>
        <section aria-labelledby="pwa-install-title" aria-modal="true" className="pwa-install-dialog" role="dialog">
          <button aria-label="Close install instructions" className="pwa-install-close" onClick={() => setShowHelp(false)} type="button">×</button>
          <p className="eyebrow">SAJHA CAFE APP</p>
          <h2 id="pwa-install-title">Install on this device</h2>
          <ol>{steps[platform].map((step) => <li key={step}>{step}</li>)}</ol>
          <div className="pwa-install-note"><strong>Printing</strong><span>Pair or add your printer in the device’s Bluetooth or printer settings. Choose it in the browser’s Print dialog. Silent one-tap printing depends on the printer and browser and is not available everywhere.</span></div>
          <p className="pwa-install-footnote">Keep an internet connection for live orders, checkout, and bills. Only the app shell and offline screen are cached on this device.</p>
          <button className="pwa-install-dismiss" onClick={() => setShowHelp(false)} type="button">Got it</button>
        </section>
      </div>}
    </>
  );
}
