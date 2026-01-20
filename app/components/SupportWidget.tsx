import { useEffect } from "react";

interface SupportWidgetProps {
  accountId: string;
  baseUrl?: string;
  email?: string;
  name?: string;
  metadata?: Record<string, any>;
  primaryColor?: string;
}

declare global {
  interface Window {
    SupportWidget?: {
      accountId: string;
      email?: string;
      name?: string;
      metadata?: Record<string, any>;
      primaryColor?: string;
    };
  }
}

export function SupportWidget({
  accountId,
  baseUrl,
  email,
  name,
  metadata,
  primaryColor,
}: SupportWidgetProps) {
  useEffect(() => {
    // Set global configuration
    window.SupportWidget = {
      accountId,
      email,
      name,
      metadata,
      primaryColor,
    };

    // Check if script is already loaded
    const scriptId = "support-widget-loader";
    if (document.getElementById(scriptId)) {
      // If script exists, we might need to re-initialize if the loader supports it.
      // Most loaders just run once on load. If it doesn't re-run, 
      // we might need to manually trigger it or remove/re-add.
      // For now, let's assume it's a fresh load or the script handles it.
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `${baseUrl}/widget/loader.js`;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup if necessary. 
      // Note: Removing the script won't stop the execution or remove the widget 
      // if it's already injected into the DOM by the loader.
    };
  }, [accountId, baseUrl, email, name, metadata, primaryColor]);

  return null;
}
