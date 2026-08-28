import { withSupabase } from "@supabase/server";
import type { RequestStatus } from "@/lib/mock-data";
import type { Database } from "@/lib/database.types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_STATUSES: RequestStatus[] = ["cho_duyet", "da_duyet", "tu_choi"];

function isRequestStatus(value: unknown): value is RequestStatus {
  return REQUEST_STATUSES.includes(value as RequestStatus);
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
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Lỗi cập nhật trạng thái yêu cầu báo giá", error);
      return Response.json({ error: "Không cập nhật được trạng thái, thử lại sau." }, { status: 500 });
    }
    if (!updated) {
      return Response.json({ error: "Không tìm thấy yêu cầu báo giá này." }, { status: 404 });
    }

    return Response.json({ status });
  },
);
