import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function formatStartedAt(isoDate: string) {
  return new Date(isoDate).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function getConversations() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("chat_conversations")
    .select("id, channel, started_at, chat_messages(count)")
    .order("last_message_at", { ascending: false });

  if (error) {
    console.error("Lỗi tải danh sách hội thoại từ Supabase", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    channel: row.channel,
    startedAt: row.started_at,
    messageCount: row.chat_messages[0]?.count ?? 0,
  }));
}

export default async function AdminConversationsPage() {
  const conversations = await getConversations();

  return (
    <>
      <AdminPageHeader
        title="Hội thoại"
        description="Lịch sử hội thoại của khách với chatbot hỏi đáp trên trang chủ."
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kênh</TableHead>
              <TableHead>Số tin nhắn</TableHead>
              <TableHead>Thời gian bắt đầu</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Chưa có hội thoại nào.
                </TableCell>
              </TableRow>
            )}
            {conversations.map((conv) => (
              <TableRow key={conv.id}>
                <TableCell className="font-medium">{conv.channel}</TableCell>
                <TableCell>{conv.messageCount} tin nhắn</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatStartedAt(conv.startedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link href={`/admin/conversations/${conv.id}`}>
                        Xem chi tiết
                        <ChevronRight className="size-3.5" />
                      </Link>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
