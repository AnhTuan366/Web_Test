import { withSupabase } from "@supabase/server";
import type { SupabaseContext } from "@supabase/server";
import type { Database } from "@/lib/database.types";
import type { IeltsExtraction, TranscriptExtraction } from "@/lib/document-extraction";
import {
  LOOKUP_SCHOLARSHIPS_FN,
  scholarshipSystemInstruction,
  scholarshipToolDeclarations,
} from "@/lib/scholarship-suggestion";
import { getSchools } from "@/lib/schools";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const SESSION_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Giới hạn số vòng gọi công cụ để không lặp vô hạn nếu AI cứ tra cứu mãi.
const MAX_TOOL_TURNS = 5;

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
}

function isValidSessionToken(value: unknown): value is string {
  return typeof value === "string" && SESSION_TOKEN_RE.test(value);
}

// Thực thi công cụ tra_cuu_hoc_bong khi Gemini yêu cầu: tìm trường theo tên rồi trả
// danh sách học bổng của trường đó (đọc bảng scholarships — dữ liệu công khai).
async function lookupScholarships(ctx: SupabaseContext<Database>, schoolName: string) {
  const { data: schoolRows, error: schoolError } = await ctx.supabaseAdmin
    .from("schools")
    .select("id, name")
    .ilike("name", `%${schoolName}%`)
    .limit(1);

  if (schoolError) throw new Error(schoolError.message);
  const school = schoolRows[0];
  if (!school) {
    return { schoolName, found: false, scholarships: [] };
  }

  const { data: rows, error } = await ctx.supabaseAdmin
    .from("scholarships")
    .select("name, min_gpa, min_ielts, support")
    .eq("school_id", school.id)
    .order("name");

  if (error) throw new Error(error.message);

  return {
    schoolName: school.name,
    found: true,
    scholarships: rows.map((row) => ({
      name: row.name,
      minGpa: row.min_gpa,
      minIelts: row.min_ielts,
      support: row.support,
    })),
  };
}

// POST { sessionToken } — nhờ Gemini gợi ý học bổng cho hồ sơ của trình duyệt này.
// Điểm GPA/IELTS và danh sách trường đạt yêu cầu được đọc/tính lại phía server từ
// database (không tin dữ liệu client gửi lên). Việc ĐẠT/CHƯA ĐẠT điểm chuẩn vẫn là
// phép so sánh số bằng code thường; Gemini chỉ lo phần tra cứu + tư vấn học bổng
// qua function calling (xem lib/scholarship-suggestion.ts).
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

    const body = await request.json().catch(() => null);
    if (!isValidSessionToken(body?.sessionToken)) {
      return Response.json({ error: "Thiếu hoặc sai định dạng sessionToken." }, { status: 400 });
    }

    const { data: profile } = await ctx.supabaseAdmin
      .from("portal_profiles")
      .select("id")
      .eq("session_token", body.sessionToken)
      .maybeSingle();

    if (!profile) {
      return Response.json(
        { error: "Chưa có hồ sơ nào — hãy nộp giấy tờ trước." },
        { status: 400 },
      );
    }

    const { data: docs, error: docsError } = await ctx.supabaseAdmin
      .from("portal_documents")
      .select("doc_type, status, extracted")
      .eq("profile_id", profile.id);

    if (docsError) {
      console.error("Lỗi tải giấy tờ để gợi ý học bổng", docsError);
      return Response.json({ error: "Không đọc được hồ sơ, thử lại sau." }, { status: 500 });
    }

    // Chỉ dùng điểm từ giấy tờ hợp lệ — cùng quy tắc với phần đối chiếu điểm chuẩn.
    const transcriptDoc = docs.find((d) => d.doc_type === "bang_diem" && d.status === "hop_le");
    const ieltsDoc = docs.find((d) => d.doc_type === "ielts" && d.status === "hop_le");
    const gpa = (transcriptDoc?.extracted as TranscriptExtraction | undefined)?.gpa ?? null;
    const ielts = (ieltsDoc?.extracted as IeltsExtraction | undefined)?.overall ?? null;

    if (gpa === null || ielts === null) {
      return Response.json(
        {
          error:
            "Cần bảng điểm hợp lệ và chứng chỉ IELTS hợp lệ thì mới gợi ý học bổng được — hãy hoàn thiện hồ sơ trước.",
        },
        { status: 400 },
      );
    }

    // Đạt/chưa đạt điểm chuẩn: phép so sánh số bình thường, giống SchoolMatch trên UI.
    const schools = await getSchools();
    const passedSchools = schools.filter((s) => gpa >= s.minGpa && ielts >= s.minIelts);
    const failedSchools = schools.filter((s) => !(gpa >= s.minGpa && ielts >= s.minIelts));

    const profileSummary = `Hồ sơ học viên:
- Điểm học tập (GPA thang 10): ${gpa}
- Điểm IELTS (điểm tổng): ${ielts}

Các trường học viên ĐẠT yêu cầu điểm chuẩn: ${
      passedSchools.length > 0 ? passedSchools.map((s) => s.name).join(", ") : "(không có trường nào)"
    }.
Các trường học viên CHƯA đạt yêu cầu: ${
      failedSchools.length > 0 ? failedSchools.map((s) => s.name).join(", ") : "(không có)"
    }.

Hãy tra cứu và gợi ý học bổng phù hợp cho học viên.`;

    const contents: unknown[] = [{ role: "user", parts: [{ text: profileSummary }] }];

    // Vòng lặp function calling: gọi Gemini, nếu AI yêu cầu tra cứu thì thực thi và
    // gửi kết quả lại, lặp đến khi AI trả lời bằng text.
    for (let turn = 0; turn <= MAX_TOOL_TURNS; turn++) {
      let geminiRes: Response;
      try {
        geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: scholarshipSystemInstruction }] },
            contents,
            tools: [{ functionDeclarations: scholarshipToolDeclarations }],
          }),
        });
      } catch (error) {
        console.error("Gemini API request failed (scholarship)", error);
        return Response.json(
          { error: "Không kết nối được đến Gemini API, thử lại sau." },
          { status: 502 },
        );
      }

      if (!geminiRes.ok) {
        const errText = await geminiRes.text().catch(() => "");
        console.error("Gemini API error (scholarship)", geminiRes.status, errText);
        return Response.json({ error: "Gemini API trả lỗi, thử lại sau." }, { status: 502 });
      }

      const data = await geminiRes.json();
      const modelContent = data?.candidates?.[0]?.content;
      const parts: GeminiPart[] = modelContent?.parts ?? [];
      const functionCalls = parts.filter((part) => part.functionCall);

      if (functionCalls.length === 0) {
        const suggestion = parts
          .map((part) => part.text ?? "")
          .join("")
          .trim();
        if (!suggestion) {
          return Response.json(
            { error: "Gemini không đưa ra được gợi ý, thử lại sau." },
            { status: 502 },
          );
        }
        return Response.json({ suggestion });
      }

      // AI yêu cầu tra cứu — thực thi từng lệnh rồi nối kết quả vào hội thoại.
      contents.push(modelContent);
      const responseParts = [];
      for (const part of functionCalls) {
        const call = part.functionCall!;
        if (call.name !== LOOKUP_SCHOLARSHIPS_FN) {
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { error: `Không có công cụ tên ${call.name}.` },
            },
          });
          continue;
        }
        try {
          const result = await lookupScholarships(ctx, String(call.args?.schoolName ?? ""));
          responseParts.push({
            functionResponse: { name: call.name, response: result },
          });
        } catch (error) {
          console.error("Lỗi tra cứu học bổng", error);
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { error: "Không đọc được dữ liệu học bổng." },
            },
          });
        }
      }
      contents.push({ role: "user", parts: responseParts });
    }

    return Response.json(
      { error: "Gemini tra cứu quá nhiều vòng mà chưa chốt được gợi ý, thử lại sau." },
      { status: 502 },
    );
  },
);
