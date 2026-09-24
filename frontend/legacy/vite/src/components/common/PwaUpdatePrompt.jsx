import { useEffect, useState } from "react";

const PWA_UPDATE_READY_EVENT = "pwa:update-ready";

export default function PwaUpdatePrompt() {
  const [registration, setRegistration] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isApplyingUpdate, setApplyingUpdate] = useState(false);

  useEffect(() => {
    const onUpdateReady = (event) => {
      const nextRegistration = event?.detail?.registration;
      if (!nextRegistration?.waiting) {
        return;
      }

      setRegistration(nextRegistration);
      setVisible(true);
      setApplyingUpdate(false);
    };

    window.addEventListener(PWA_UPDATE_READY_EVENT, onUpdateReady);

    return () => {
      window.removeEventListener(PWA_UPDATE_READY_EVENT, onUpdateReady);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return undefined;
    }

    const onControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const handleUpdateNow = () => {
    if (!registration?.waiting) {
      return;
    }

    setApplyingUpdate(true);
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  const handleLater = () => {
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <aside aria-live="polite" className="pwa-update-toast" role="status">
      <p className="pwa-update-title">Update available</p>
      <p className="pwa-update-text">
        A newer version of Sajha Karobar is ready. Refresh to apply the latest improvements.
      </p>
      <div className="pwa-update-actions">
        <button className="pwa-update-btn secondary" onClick={handleLater} type="button">
          Later
        </button>
        <button
          className="pwa-update-btn primary"
          disabled={isApplyingUpdate}
          onClick={handleUpdateNow}
          type="button"
        >
          {isApplyingUpdate ? "Updating..." : "Refresh now"}
        </button>
      </div>
    </aside>
  );
}
