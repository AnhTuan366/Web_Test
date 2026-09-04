import { withSupabase } from "@supabase/server";
import type { RequestStatus } from "@/lib/mock-data";
import type { Database } from "@/lib/database.types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_STATUSES: RequestStatus[] = ["cho_duyet", "da_duyet", "tu_choi"];

function isRequestStatus(value: unknown): value is RequestStatus {
  return REQUEST_STATUSES.includes(value as RequestStatus);
}

// Báo cho hệ thống ngoài (Make.com) biết một yêu cầu vừa được admin duyệt — lỗi
// ở đây chỉ log lại, không làm hỏng luồng duyệt của admin. Đường link đăng nhập
// hiện là link mẫu tới trang /login trên site (trang này/magic link thật làm ở
// Tuần 6) — chưa dùng để đăng nhập thật.
async function notifyApprovalWebhook(payload: { name: string; email: string; loginLink: string }) {
  const webhookUrl = process.env.APPROVAL_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (webhookError) {
    console.error("Lỗi gửi webhook duyệt yêu cầu báo giá", webhookError);
  }
}

// Cùng mô hình bảo mật với /api/admin/extract-lead: chỉ server có secret key mới
// đọc/ghi được bảng quote_requests (RLS bật, không policy); /admin/* chưa có auth
// nên endpoint này cũng chưa có auth.
export const POST = withSupabase<Database>(
  { auth: "none", cors: "disabled" },
  async (request, ctx) => {
    const body = await request.json().catch(() => null);
    const requestId = body?.requestId;
    const status = body?.status;

    if (typeof requestId !== "string" || !UUID_RE.test(requestId)) {
      return Response.json({ error: "Thiếu hoặc sai định dạng requestId." }, { status: 400 });
    }
    if (!isRequestStatus(status)) {
      return Response.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
    }

    const { data: updated, error } = await ctx.supabaseAdmin
      .from("quote_requests")
      .update({ status })
      .eq("id", requestId)
      .select("id, name, email")
      .maybeSingle();

    if (error) {
      console.error("Lỗi cập nhật trạng thái yêu cầu báo giá", error);
      return Response.json({ error: "Không cập nhật được trạng thái, thử lại sau." }, { status: 500 });
    }
    if (!updated) {
      return Response.json({ error: "Không tìm thấy yêu cầu báo giá này." }, { status: 404 });
    }

    if (status === "da_duyet") {
      const loginLink = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/login`;
      await notifyApprovalWebhook({ name: updated.name, email: updated.email, loginLink });
    }

    return Response.json({ status });
  },
);
