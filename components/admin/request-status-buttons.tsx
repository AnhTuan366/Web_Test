"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RequestStatus } from "@/lib/mock-data";

export function RequestStatusButtons({
  requestId,
  status,
}: {
  requestId: string;
  status: RequestStatus;
}) {
  const router = useRouter();
  // Trạng thái đang gửi lên server, null = không có request nào đang chạy
  const [pending, setPending] = React.useState<RequestStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function updateStatus(nextStatus: RequestStatus) {
    setPending(nextStatus);
    setError(null);
    try {
      const res = await fetch("/api/admin/request-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status: nextStatus }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Cập nhật thất bại, thử lại sau.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được server, thử lại sau.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Duyệt"
          disabled={pending !== null || status === "da_duyet"}
          onClick={() => updateStatus("da_duyet")}
        >
          {pending === "da_duyet" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Từ chối"
          disabled={pending !== null || status === "tu_choi"}
          onClick={() => updateStatus("tu_choi")}
        >
          {pending === "tu_choi" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <X className="size-3.5" />
          )}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
