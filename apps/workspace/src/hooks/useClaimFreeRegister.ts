"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEY = "claim_free_code";
/** Shown when leaving claim signup (in-app navigation only; tab close cannot use custom UI). */
export const CLAIM_FREE_EXIT_COPY = {
  title: "Leave claim signup?",
  message:
    "If you exit now, you will not be able to claim a free workspace again.",
  confirmLabel: "Leave",
  cancelLabel: "Stay",
} as const;

const PENDING_EXIT_BACK = "__back__";

export type claim_free_gate =
  | "loading"
  | "none"
  | "valid"
  | "invalid"
  | "waitlist";

export function useClaimFreeRegister(options: {
  exitGuardEnabled: boolean;
  email?: string;
  getAccessToken?: () => Promise<string | null>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [gate, setGate] = useState<claim_free_gate>("loading");
  const [gateMessage, setGateMessage] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpenState] = useState(false);
  const setExitConfirmOpen = useCallback((open: boolean) => {
    exitConfirmOpenRef.current = open;
    setExitConfirmOpenState(open);
  }, []);
  const pendingExitHref = useRef<string | null>(null);
  const forfeitInFlight = useRef(false);
  const exitGuardBypass = useRef(false);
  const exitConfirmOpenRef = useRef(false);

  useEffect(() => {
    const fromUrl = searchParams.get("claim_code")?.trim() ?? "";
    const fromStorage =
      typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY)?.trim() : "";
    const code = fromUrl || fromStorage || "";
    if (!code) {
      setGate("none");
      setClaimCode(null);
      return;
    }
    setClaimCode(code);
    if (fromUrl) {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/public/claim-free/validate?claim_code=${encodeURIComponent(code)}`
        );
        const json = (await res.json()) as { valid?: boolean; message?: string };
        if (cancelled) return;
        if (res.ok && json.valid) {
          setGate("valid");
          setGateMessage("");
          return;
        }
        const msg = json.message ?? "Your claim is not valid.";
        if (msg.toLowerCase().includes("no longer available")) {
          setGate("waitlist");
        } else {
          setGate("invalid");
        }
        setGateMessage(msg);
      } catch {
        if (!cancelled) {
          setGate("invalid");
          setGateMessage("Your claim is not valid.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const forfeitClaim = useCallback(async () => {
    if (!claimCode || forfeitInFlight.current) return;
    forfeitInFlight.current = true;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = options.getAccessToken ? await options.getAccessToken() : null;
      if (token) headers.Authorization = `Bearer ${token}`;

      await fetch("/api/public/claim-free/forfeit", {
        method: "POST",
        headers,
        body: JSON.stringify({
          claim_code: claimCode,
          email: options.email?.trim() || waitlistEmail.trim() || undefined,
        }),
      });
      sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      forfeitInFlight.current = false;
    }
  }, [claimCode, options.email, options.getAccessToken, waitlistEmail]);

  const confirmExit = useCallback(async () => {
    exitGuardBypass.current = true;
    await forfeitClaim();
    setExitConfirmOpen(false);
    const href = pendingExitHref.current;
    pendingExitHref.current = null;
    if (href === PENDING_EXIT_BACK) {
      window.history.back();
    } else if (href) {
      router.push(href);
    } else if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, [forfeitClaim, router]);

  useEffect(() => {
    if (!options.exitGuardEnabled || gate !== "valid" || !claimCode) return;

    const isGuarded = () =>
      options.exitGuardEnabled && gate === "valid" && Boolean(claimCode) && !exitGuardBypass.current;

    const onDocumentClick = (e: MouseEvent) => {
      if (!isGuarded() || exitConfirmOpenRef.current) return;
      const anchor = (e.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.dataset.skipClaimExit === "true") return;
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#") || anchor.target === "_blank") return;

      let url: URL;
      try {
        url = new URL(rawHref, window.location.href);
      } catch {
        return;
      }
      const current = new URL(window.location.href);
      if (
        url.origin === current.origin &&
        url.pathname === current.pathname &&
        url.search === current.search
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      pendingExitHref.current = `${url.pathname}${url.search}${url.hash}`;
      setExitConfirmOpen(true);
    };

    window.history.pushState({ claimFreeExitGuard: true }, "", window.location.href);

    const onPopState = () => {
      if (!isGuarded()) return;
      pendingExitHref.current = PENDING_EXIT_BACK;
      setExitConfirmOpen(true);
      window.history.pushState({ claimFreeExitGuard: true }, "", window.location.href);
    };

    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [options.exitGuardEnabled, gate, claimCode]);

  const requestClaimExit = useCallback((href?: string) => {
    pendingExitHref.current = href ?? null;
    setExitConfirmOpen(true);
  }, [setExitConfirmOpen]);

  const cancelClaimExit = useCallback(() => {
    pendingExitHref.current = null;
    setExitConfirmOpen(false);
  }, [setExitConfirmOpen]);

  /** Drop invalid/expired claim and show normal self-serve register (starter plan). */
  const abandonClaimOffer = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setClaimCode(null);
    setGate("none");
    setGateMessage("");
    router.replace("/register");
  }, [router]);

  const submitWaitlist = useCallback(async () => {
    const email = waitlistEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGateMessage("Enter a valid email.");
      return;
    }
    setWaitlistSubmitting(true);
    try {
      const res = await fetch("/api/public/claim-free/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "register" }),
      });
      if (res.ok) {
        setWaitlistDone(true);
        setGateMessage("");
      } else {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setGateMessage(json.error ?? "Could not join waitlist.");
      }
    } finally {
      setWaitlistSubmitting(false);
    }
  }, [waitlistEmail]);

  return {
    claimCode,
    gate,
    gateMessage,
    isClaimSignup: gate === "valid" && Boolean(claimCode),
    waitlistEmail,
    setWaitlistEmail,
    waitlistSubmitting,
    waitlistDone,
    submitWaitlist,
    exitConfirmOpen,
    setExitConfirmOpen,
    cancelClaimExit,
    requestClaimExit,
    confirmExit,
    forfeitClaim,
    abandonClaimOffer,
  };
}
