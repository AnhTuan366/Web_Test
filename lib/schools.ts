import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { School } from "@/lib/mock-data";

// Đọc danh sách trường tham chiếu từ bảng `schools` (Supabase, dữ liệu công khai),
// map về shape `School` mà các component đang dùng. Chỉ gọi được từ Server Component /
// Route Handler vì đi qua getSupabaseAdmin (import "server-only").
export async function getSchools(): Promise<School[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("schools")
    .select("id, name, country, min_gpa, min_ielts")
    .order("country", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Lỗi tải danh sách trường từ Supabase", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    country: row.country,
    minGpa: row.min_gpa,
    minIelts: row.min_ielts,
  }));
}
