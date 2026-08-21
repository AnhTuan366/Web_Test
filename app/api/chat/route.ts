import { withSupabase } from "@supabase/server";
import type { SupabaseContext } from "@supabase/server";
import { chatbotSystemInstruction } from "@/lib/chatbot-knowledge";
import type { Database } from "@/lib/database.types";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const SESSION_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 2000;

interface GeminiPart {
  text?: string;
}

function isValidSessionToken(value: unknown): value is string {
  return typeof value === "string" && SESSION_TOKEN_RE.test(value);
}

// Chỉ chạy phía server: dùng supabaseAdmin (secret key, bỏ qua RLS) để đọc/ghi
// hội thoại. Trình duyệt không bao giờ có credential Supabase — mọi truy cập
// đi qua route này. auth: "none" vì khách chưa đăng nhập (chưa có hệ thống auth).
async function getOrCreateConversation(
  ctx: SupabaseContext<Database>,
  sessionToken: string,
) {
  const { data: existing } = await ctx.supabaseAdmin
    .from("chat_conversations")
    .select("id")
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await ctx.supabaseAdmin
    .from("chat_conversations")
    .insert({ session_token: sessionToken })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Không tạo được hội thoại: ${error?.message}`);
  }
  return created.id;
}

export const GET = withSupabase<Database>(
  { auth: "none", cors: "disabled" },
  async (request, ctx) => {
    const sessionToken = new URL(request.url).searchParams.get("sessionToken");
    if (!isValidSessionToken(sessionToken)) {
      return Response.json({ messages: [] });
    }

    const { data: conversation } = await ctx.supabaseAdmin
      .from("chat_conversations")
      .select("id")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (!conversation) {
      return Response.json({ messages: [] });
    }

    const { data: rows, error } = await ctx.supabaseAdmin
      .from("chat_messages")
      .select("sender, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Lỗi tải hội thoại từ Supabase", error);
      return Response.json({ messages: [] });
    }

    const messages = rows.map((row) => ({
      from: row.sender === "user" ? "user" : "bot",
      text: row.content,
    }));
    return Response.json({ messages });
  },
);

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
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const sessionToken = body?.sessionToken;

    if (!isValidSessionToken(sessionToken)) {
      return Response.json({ error: "Thiếu hoặc sai định dạng sessionToken." }, { status: 400 });
    }
    if (!message || message.length > MAX_MESSAGE_LENGTH) {
      return Response.json({ error: "Thiếu nội dung câu hỏi." }, { status: 400 });
    }

    let conversationId: string;
    try {
      conversationId = await getOrCreateConversation(ctx, sessionToken);
    } catch (error) {
      console.error("Lỗi tạo/tìm hội thoại", error);
      return Response.json({ error: "Không kết nối được database, thử lại sau." }, { status: 500 });
    }

    const { data: history, error: historyError } = await ctx.supabaseAdmin
      .from("chat_messages")
      .select("sender, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (historyError) {
      console.error("Lỗi tải lịch sử hội thoại", historyError);
      return Response.json({ error: "Không đọc được lịch sử hội thoại, thử lại sau." }, { status: 500 });
    }

    const { error: insertUserError } = await ctx.supabaseAdmin
      .from("chat_messages")
      .insert({ conversation_id: conversationId, sender: "user", content: message });

    if (insertUserError) {
      console.error("Lỗi lưu tin nhắn người dùng", insertUserError);
      return Response.json({ error: "Không lưu được câu hỏi, thử lại sau." }, { status: 500 });
    }

    const contents = [
      ...history.map((item) => ({
        role: item.sender === "user" ? "user" : "model",
        parts: [{ text: item.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    let geminiRes: Response;
    try {
      geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: chatbotSystemInstruction }] },
          contents,
        }),
      });
    } catch (error) {
      console.error("Gemini API request failed", error);
      return Response.json(
        { error: "Không kết nối được đến Gemini API, thử lại sau." },
        { status: 502 },
      );
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error("Gemini API error", geminiRes.status, errText);
      return Response.json({ error: "Gemini API trả lỗi, thử lại sau." }, { status: 502 });
    }

    const data = await geminiRes.json();
    const reply: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((part: GeminiPart) => part.text ?? "")
      .join("")
      .trim();

    if (!reply) {
      return Response.json(
        { error: "Gemini không trả lời được câu hỏi này, thử lại sau." },
        { status: 502 },
      );
    }

    const now = new Date().toISOString();
    const { error: insertBotError } = await ctx.supabaseAdmin
      .from("chat_messages")
      .insert({ conversation_id: conversationId, sender: "bot", content: reply, created_at: now });
    if (insertBotError) {
      console.error("Lỗi lưu câu trả lời", insertBotError);
    }

    await ctx.supabaseAdmin
      .from("chat_conversations")
      .update({ last_message_at: now })
      .eq("id", conversationId);

    return Response.json({ reply });
  },
);
