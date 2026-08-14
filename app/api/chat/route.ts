import { chatbotSystemInstruction } from "@/lib/chatbot-knowledge";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface ChatHistoryItem {
  from: "bot" | "user";
  text: string;
}

interface GeminiPart {
  text?: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Chưa cấu hình GEMINI_API_KEY trên server (xem .env)." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const history: ChatHistoryItem[] = Array.isArray(body?.history) ? body.history : [];

  if (!message) {
    return Response.json({ error: "Thiếu nội dung câu hỏi." }, { status: 400 });
  }

  const contents = [
    ...history.map((item) => ({
      role: item.from === "user" ? "user" : "model",
      parts: [{ text: item.text }],
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
    return Response.json(
      { error: "Gemini API trả lỗi, thử lại sau." },
      { status: 502 },
    );
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

  return Response.json({ reply });
}
