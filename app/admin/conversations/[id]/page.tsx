import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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
    return { conversation, messages: [] };
  }

  return { conversation, messages };
}

export default async function AdminConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getConversationDetail(id);

  if (!result) notFound();
  const { conversation, messages } = result;

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
