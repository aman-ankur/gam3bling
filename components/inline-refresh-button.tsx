"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type InlineRefreshActionResult = {
  ok: boolean;
  message: string;
  status: string;
};

type InlineRefreshButtonProps = {
  action: () => Promise<InlineRefreshActionResult>;
  children: React.ReactNode;
  className?: string;
  messageClassName?: string;
  pendingLabel: string;
};

export function InlineRefreshButton({
  action,
  children,
  className = "secondary-button",
  messageClassName = "inline-refresh-message",
  pendingLabel
}: InlineRefreshButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<InlineRefreshActionResult | null>(null);

  async function runAction() {
    setPending(true);
    setResult(null);

    try {
      const nextResult = await action();
      setResult(nextResult);
      router.refresh();
    } catch {
      setResult({
        ok: false,
        message: "Refresh failed. Try again in a few minutes.",
        status: "error"
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="inline-refresh-control">
      <button aria-busy={pending} className={className} disabled={pending} onClick={runAction} type="button">
        {pending ? pendingLabel : children}
      </button>
      {result ? (
        <span className={result.ok ? `${messageClassName} success` : messageClassName} role="status">
          {result.message}
        </span>
      ) : null}
    </div>
  );
}
