"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import { InstallInstructionsModal } from "./InstallInstructionsModal";

/**
 * Orange "Install app" button for the desktop topbar (hidden on mobile, where
 * the avatar menu carries it instead). Only renders when the app is actually
 * installable. Native → browser install dialog; iOS → instructions modal.
 */
export function InstallAppButton() {
  const { mode, promptInstall } = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);

  if (mode === "hidden") return null;

  async function handleClick() {
    if (mode === "native") {
      await promptInstall();
    } else {
      setIosOpen(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="hidden items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 md:inline-flex"
      >
        <Download size={16} />
        Install app
      </button>
      {iosOpen && (
        <InstallInstructionsModal onClose={() => setIosOpen(false)} />
      )}
    </>
  );
}
