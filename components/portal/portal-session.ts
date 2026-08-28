// Token ẩn danh lưu trên trình duyệt chỉ để server nhận diện đúng hồ sơ của trình duyệt
// đó (chưa có hệ thống auth, dự kiến Tuần 6) — không phải credential Supabase, và trình
// duyệt không bao giờ gọi Supabase trực tiếp: mọi đọc/ghi hồ sơ đi qua /api/portal/*.
// CHỈ gọi từ client component (dùng localStorage), trong event handler hoặc effect.

const SESSION_TOKEN_KEY = "duhoc24_portal_session";

export function getPortalSessionToken(): string {
  let token = localStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  return token;
}
