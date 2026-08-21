import { withSupabase } from "@supabase/server";
import type { Database } from "@/lib/database.types";
import {
  leadExtractionResponseSchema,
  leadExtractionSystemInstruction,
  type ExtractedLead,
} from "@/lib/lead-extraction";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface GeminiPart {
  text?: string;
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// Chỉ chạy phía server, kích hoạt thủ công từ admin dashboard (nút "Trích xuất thông tin
// lead" trong app/admin/conversations/[id]/page.tsx). Đọc hội thoại từ Supabase, nhờ Gemini
// trích xuất thông tin lead theo schema cố định, rồi lưu (upsert) vào bảng chat_leads.
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
    const conversationId = body?.conversationId;
    if (!isValidUuid(conversationId)) {
      return Response.json({ error: "Thiếu hoặc sai định dạng conversationId." }, { status: 400 });
    }

    const { data: messages, error: messagesError } = await ctx.supabaseAdmin
      .from("chat_messages")
      .select("sender, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Lỗi tải hội thoại để trích xuất lead", messagesError);
      return Response.json({ error: "Không đọc được hội thoại, thử lại sau." }, { status: 500 });
    }
    if (!messages || messages.length === 0) {
      return Response.json(
        { error: "Hội thoại chưa có tin nhắn nào để trích xuất." },
        { status: 400 },
      );
    }

    const transcript = messages
      .map((message) => `${message.sender === "user" ? "Khách" : "Bot"}: ${message.content}`)
      .join("\n");

    let geminiRes: Response;
    try {
      geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: leadExtractionSystemInstruction }] },
          contents: [{ role: "user", parts: [{ text: transcript }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: leadExtractionResponseSchema,
          },
        }),
      });
    } catch (error) {
      console.error("Gemini API request failed (extract-lead)", error);
      return Response.json(
        { error: "Không kết nối được đến Gemini API, thử lại sau." },
        { status: 502 },
      );
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error("Gemini API error (extract-lead)", geminiRes.status, errText);
      return Response.json({ error: "Gemini API trả lỗi, thử lại sau." }, { status: 502 });
    }

    const data = await geminiRes.json();
    const rawText: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((part: GeminiPart) => part.text ?? "")
      .join("");

    let extracted: ExtractedLead;
    try {
      extracted = JSON.parse(rawText);
    } catch (error) {
      console.error("Không parse được JSON lead từ Gemini", error, rawText);
      return Response.json(
        { error: "Gemini trả về dữ liệu không hợp lệ, thử lại sau." },
        { status: 502 },
      );
    }

    const now = new Date().toISOString();
    const { data: savedLead, error: saveError } = await ctx.supabaseAdmin
      .from("chat_leads")
      .upsert(
        {
          conversation_id: conversationId,
          name: extracted.name ?? null,
          email: extracted.email ?? null,
          phone: extracted.phone ?? null,
          country: extracted.country ?? null,
          education_level: extracted.educationLevel ?? null,
          major: extracted.major ?? null,
          availability: extracted.availability ?? null,
          has_booked_consultation: extracted.hasBookedConsultation ?? false,
          notes: extracted.notes ?? null,
          quality: extracted.quality ?? "ok",
          extracted_at: now,
          updated_at: now,
        },
        { onConflict: "conversation_id" },
      )
      .select()
      .single();

    if (saveError || !savedLead) {
      console.error("Lỗi lưu lead vào Supabase", saveError);
      return Response.json({ error: "Không lưu được lead vào database, thử lại sau." }, { status: 500 });
    }

    return Response.json({ lead: savedLead });
  },
);
