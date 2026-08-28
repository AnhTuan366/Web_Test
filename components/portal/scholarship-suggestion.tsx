"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPortalSessionToken } from "@/components/portal/portal-session";

const fallbackError = "Không lấy được gợi ý học bổng, thử lại sau nhé.";

// Card "Gợi ý học bổng": bấm nút thì nhờ AI phía server tra cứu (function calling)
// và tư vấn học bổng phù hợp. Chỉ gọi /api/portal/scholarship-suggestions — điểm số
// và danh sách trường đạt yêu cầu do server tự đọc/tính lại, không gửi từ client.
export function ScholarshipSuggestion({
  ready,
}: {
  ready: boolean; // đã có bảng điểm + IELTS hợp lệ chưa
}) {
  const [loading, setLoading] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function requestSuggestion() {
    if (loading) return;
    const sessionToken = getPortalSessionToken();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/scholarship-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && typeof data?.suggestion === "string") {
        setSuggestion(data.suggestion);
      } else {
        setError(typeof data?.error === "string" ? data.error : fallbackError);
      }
    } catch {
      setError(fallbackError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gợi ý học bổng</CardTitle>
        <p className="text-sm text-muted-foreground">
          AI sẽ tra cứu danh sách học bổng của các trường bạn đạt yêu cầu và gợi ý học bổng
          phù hợp với điểm của bạn.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!ready && (
          <p className="text-sm text-muted-foreground">
            Cần bảng điểm hợp lệ và chứng chỉ IELTS hợp lệ thì mới gợi ý học bổng được.
          </p>
        )}

        {suggestion && (
          <div className="whitespace-pre-line rounded-xl bg-muted/40 p-4 text-sm">
            {suggestion}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={requestSuggestion} disabled={!ready || loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              AI đang tra cứu học bổng...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              {suggestion ? "Gợi ý lại" : "Nhờ AI gợi ý học bổng"}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
