import { withSupabase } from "@supabase/server";
import type { SupabaseContext } from "@supabase/server";
import type { Database } from "@/lib/database.types";
import {
  MAX_UPLOAD_BYTES,
  docTypeAllowedMimes,
  docTypeLabels,
  extractionResponseSchemas,
  extractionSystemInstructions,
  validateExtraction,
  type PortalDocType,
  portalDocTypes,
} from "@/lib/document-extraction";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const SESSION_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_BUCKET = "portal-documents";

const extensionByMime: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

interface GeminiPart {
  text?: string;
}

function isValidSessionToken(value: unknown): value is string {
  return typeof value === "string" && SESSION_TOKEN_RE.test(value);
}

function isPortalDocType(value: unknown): value is PortalDocType {
  return (portalDocTypes as string[]).includes(value as string);
}

// Chuyển row trong DB (snake_case) sang shape trả cho client (camelCase).
function toClientDocument(row: {
  doc_type: string;
  file_name: string;
  status: string;
  reason: string | null;
  extracted: unknown;
  uploaded_at: string;
}) {
  return {
    docType: row.doc_type,
    fileName: row.file_name,
    status: row.status,
    reason: row.reason,
    extracted: row.extracted,
    uploadedAt: row.uploaded_at,
  };
}

// Chỉ chạy phía server: hồ sơ học viên là dữ liệu riêng tư, bảng portal_profiles /
// portal_documents và bucket portal-documents đều RLS bật + không có policy, nên
// trình duyệt không thể truy cập Supabase trực tiếp — mọi truy cập đi qua route này
// bằng ctx.supabaseAdmin (secret key). auth: "none" vì cổng /portal chưa có hệ thống
// auth (dự kiến Tuần 6) — trình duyệt nhận diện hồ sơ bằng sessionToken như chatbot.
async function getOrCreateProfile(ctx: SupabaseContext<Database>, sessionToken: string) {
  const { data: existing } = await ctx.supabaseAdmin
    .from("portal_profiles")
    .select("id")
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await ctx.supabaseAdmin
    .from("portal_profiles")
    .insert({ session_token: sessionToken })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Không tạo được hồ sơ học viên: ${error?.message}`);
  }
  return created.id;
}

// GET ?sessionToken= — trả lại toàn bộ giấy tờ đã nộp để hydrate trang /portal khi mở lại.
export const GET = withSupabase<Database>(
  { auth: "none", cors: "disabled" },
  async (request, ctx) => {
    const sessionToken = new URL(request.url).searchParams.get("sessionToken");
    if (!isValidSessionToken(sessionToken)) {
      return Response.json({ documents: [] });
    }

    const { data: profile } = await ctx.supabaseAdmin
      .from("portal_profiles")
      .select("id")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (!profile) {
      return Response.json({ documents: [] });
    }

    const { data: rows, error } = await ctx.supabaseAdmin
      .from("portal_documents")
      .select("doc_type, file_name, status, reason, extracted, uploaded_at")
      .eq("profile_id", profile.id);

    if (error) {
      console.error("Lỗi tải giấy tờ hồ sơ từ Supabase", error);
      return Response.json({ documents: [] });
    }

    return Response.json({ documents: rows.map(toClientDocument) });
  },
);

// POST multipart/form-data { file, docType, sessionToken } — nhận 1 file giấy tờ:
// upload vào bucket riêng tư, nhờ Gemini đọc thông tin theo schema cố định, rồi kiểm tra
// hợp lệ bằng code thường (validateExtraction) và lưu kết quả vào portal_documents.
export const POST = withSupabase<Database>(
  { auth: "none", cors: "disabled" },
  async (request, ctx) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Chưa cấu hình GEMINI_API_KEY trên server (xem .env)." },
        { status: 500 },
      );
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return Response.json({ error: "Yêu cầu phải gửi dạng multipart/form-data." }, { status: 400 });
    }

    const sessionToken = formData.get("sessionToken");
    const docType = formData.get("docType");
    const file = formData.get("file");

    if (!isValidSessionToken(sessionToken)) {
      return Response.json({ error: "Thiếu hoặc sai định dạng sessionToken." }, { status: 400 });
    }
    if (!isPortalDocType(docType)) {
      return Response.json({ error: "Loại giấy tờ không hợp lệ." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Chưa chọn file để nộp." }, { status: 400 });
    }
    if (!docTypeAllowedMimes[docType].includes(file.type)) {
      const accepted = docType === "bang_diem" ? "PDF" : "JPG hoặc PNG";
      return Response.json(
        { error: `${docTypeLabels[docType]} chỉ chấp nhận file ${accepted}.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "File vượt quá giới hạn 10MB." }, { status: 400 });
    }

    let profileId: string;
    try {
      profileId = await getOrCreateProfile(ctx, sessionToken);
    } catch (error) {
      console.error("Lỗi tạo/tìm hồ sơ học viên", error);
      return Response.json({ error: "Không kết nối được database, thử lại sau." }, { status: 500 });
    }

    const fileBytes = Buffer.from(await file.arrayBuffer());

    // Nhờ Gemini đọc thông tin từ file (structured output theo schema của từng loại giấy tờ).
    let geminiRes: Response;
    try {
      geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: extractionSystemInstructions[docType] }] },
          contents: [
            {
              role: "user",
              parts: [
                { inline_data: { mime_type: file.type, data: fileBytes.toString("base64") } },
                { text: "Trích xuất thông tin từ giấy tờ trong file đính kèm theo đúng schema." },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: extractionResponseSchemas[docType],
          },
        }),
      });
    } catch (error) {
      console.error("Gemini API request failed (portal documents)", error);
      return Response.json(
        { error: "Không kết nối được đến Gemini API, thử lại sau." },
        { status: 502 },
      );
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error("Gemini API error (portal documents)", geminiRes.status, errText);
      return Response.json({ error: "Gemini API trả lỗi, thử lại sau." }, { status: 502 });
    }

    const data = await geminiRes.json();
    const rawText: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((part: GeminiPart) => part.text ?? "")
      .join("");

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(rawText);
    } catch (error) {
      console.error("Không parse được JSON trích xuất từ Gemini", error, rawText);
      return Response.json(
        { error: "Gemini trả về dữ liệu không hợp lệ, thử lại sau." },
        { status: 502 },
      );
    }

    // Kết luận hợp lệ / cần nộp lại bằng code thường — xem lib/document-extraction.ts.
    const validation = validateExtraction(docType, extracted);

    // Lưu file gốc vào bucket riêng tư (1 file / loại giấy tờ, nộp lại thì ghi đè).
    const storagePath = `${profileId}/${docType}.${extensionByMime[file.type]}`;
    const { error: uploadError } = await ctx.supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBytes, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("Lỗi upload file vào Supabase Storage", uploadError);
      return Response.json({ error: "Không lưu được file, thử lại sau." }, { status: 500 });
    }

    const { data: savedRow, error: saveError } = await ctx.supabaseAdmin
      .from("portal_documents")
      .upsert(
        {
          profile_id: profileId,
          doc_type: docType,
          file_name: file.name,
          mime_type: file.type,
          storage_path: storagePath,
          status: validation.status,
          reason: validation.reason,
          extracted: extracted as never,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: "profile_id,doc_type" },
      )
      .select("doc_type, file_name, status, reason, extracted, uploaded_at")
      .single();

    if (saveError || !savedRow) {
      console.error("Lỗi lưu giấy tờ vào Supabase", saveError);
      return Response.json(
        { error: "Không lưu được kết quả vào database, thử lại sau." },
        { status: 500 },
      );
    }

    return Response.json({ document: toClientDocument(savedRow) });
  },
);
