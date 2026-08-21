"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExtractLeadButton({
  conversationId,
  hasExistingLead,
}: {
  conversationId: string;
  hasExistingLead: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/extract-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Trích xuất thất bại, thử lại sau.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được server, thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button size="sm" onClick={handleClick} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {loading ? "Đang trích xuất..." : hasExistingLead ? "Trích xuất lại" : "Trích xuất thông tin lead"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
