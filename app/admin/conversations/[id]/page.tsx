import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ExtractLeadButton } from "@/components/admin/extract-lead-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LeadQualityBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { LeadQuality } from "@/lib/lead-extraction";

export const dynamic = "force-dynamic";

function formatDateTime(isoDate: string) {
  return new Date(isoDate).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function getConversationDetail(id: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: conversation } = await supabaseAdmin
    .from("chat_conversations")
    .select("id, channel, started_at")
    .eq("id", id)
    .maybeSingle();

  if (!conversation) return null;

  const { data: messages, error } = await supabaseAdmin
    .from("chat_messages")
    .select("id, sender, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Lỗi tải tin nhắn hội thoại từ Supabase", error);
    return { conversation, messages: [], lead: null };
  }

  const { data: lead } = await supabaseAdmin
    .from("chat_leads")
    .select("*")
    .eq("conversation_id", id)
    .maybeSingle();

  return { conversation, messages, lead };
}

function LeadField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

export default async function AdminConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getConversationDetail(id);

  if (!result) notFound();
  const { conversation, messages, lead } = result;

  return (
    <>
      <AdminPageHeader
        title="Chi tiết hội thoại"
        description={`Kênh ${conversation.channel} · Bắt đầu lúc ${formatDateTime(conversation.started_at)}`}
        action={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link href="/admin/conversations">
                <ArrowLeft className="size-4" />
                Quay lại danh sách
              </Link>
            }
          />
        }
      />

      <Card className="mb-6 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Thông tin lead</h2>
            {lead ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Trích xuất lúc {formatDateTime(lead.extracted_at)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Chưa trích xuất — bấm nút để phân tích hội thoại bằng Gemini.
              </p>
            )}
          </div>
          <ExtractLeadButton conversationId={conversation.id} hasExistingLead={!!lead} />
        </div>

        {lead && (
          <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3">
            <LeadField label="Họ tên" value={lead.name} />
            <LeadField label="Email" value={lead.email} />
            <LeadField label="Số điện thoại" value={lead.phone} />
            <LeadField label="Quốc gia du học" value={lead.country} />
            <LeadField label="Bậc học" value={lead.education_level} />
            <LeadField label="Ngành học" value={lead.major} />
            <LeadField label="Thời gian rảnh" value={lead.availability} />
            <LeadField
              label="Đã đặt lịch tư vấn"
              value={
                lead.has_booked_consultation ? (
                  <span className="inline-flex items-center gap-1 text-green-700">
                    <CheckCircle2 className="size-3.5" /> Đã đặt lịch
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <XCircle className="size-3.5" /> Chưa đặt lịch
                  </span>
                )
              }
            />
            <LeadField
              label="Chất lượng lead"
              value={<LeadQualityBadge quality={lead.quality as LeadQuality} />}
            />
            <div className="col-span-2 sm:col-span-3">
              <LeadField label="Ghi chú" value={lead.notes} />
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có tin nhắn nào trong hội thoại này.
            </p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex", message.sender === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[75%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm",
                  message.sender === "user"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-muted text-foreground",
                )}
              >
                <p>{message.content}</p>
                <p className="mt-1 text-[11px] opacity-70">
                  {formatDateTime(message.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
