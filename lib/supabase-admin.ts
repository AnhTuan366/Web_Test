import "server-only";

import { createAdminClient } from "@supabase/server/core";
import type { Database } from "@/lib/database.types";

// Client dùng secret key, bỏ qua RLS — CHỈ được import từ code chạy trên server
// (Route Handler, Server Component). `server-only` sẽ làm build lỗi ngay nếu file
// nào phía client lỡ import phải file này.
export function getSupabaseAdmin() {
  return createAdminClient<Database>();
}
