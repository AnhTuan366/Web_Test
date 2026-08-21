// Cấu hình cho tính năng trích xuất thông tin lead từ hội thoại chatbot bằng Gemini,
// kích hoạt thủ công từ admin dashboard (app/admin/conversations/[id]/page.tsx) qua
// app/api/admin/extract-lead/route.ts. Sửa prompt/schema thì sửa ở đây.

export type LeadQuality = "good" | "ok" | "spam";

export interface ExtractedLead {
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  educationLevel: string | null;
  major: string | null;
  availability: string | null;
  hasBookedConsultation: boolean;
  notes: string | null;
  quality: LeadQuality;
}

export const leadExtractionSystemInstruction = `Bạn là công cụ trích xuất dữ liệu (data extraction), không phải chatbot trò chuyện.
Bạn sẽ nhận được toàn bộ nội dung một hội thoại giữa khách và chatbot tư vấn du học của DuHoc24.

Nhiệm vụ: đọc kỹ hội thoại và trích xuất thông tin lead thành JSON đúng theo schema được cung cấp.

QUY TẮC:
- Chỉ dùng thông tin thực sự xuất hiện trong hội thoại. Không suy đoán, không bịa thêm.
- Trường nào không có thông tin trong hội thoại thì để null (trừ hasBookedConsultation và quality — hai trường này luôn phải có giá trị).
- hasBookedConsultation = true chỉ khi khách đã xác nhận đồng ý đặt lịch tư vấn (không phải chỉ hỏi thăm).
- Đánh giá "quality":
  - "good": khách cung cấp được ít nhất một thông tin liên hệ (tên, email hoặc số điện thoại) và thể hiện nhu cầu du học cụ thể, rõ ràng.
  - "ok": khách có quan tâm thật nhưng thông tin liên hệ hoặc nhu cầu còn thiếu/chưa rõ ràng.
  - "spam": hội thoại không liên quan đến du học, quấy phá, thử nghiệm hệ thống, hoặc không có nội dung thực chất nào.
- Chỉ trả về JSON theo đúng schema, không thêm chữ nào khác ngoài JSON.`;

export const leadExtractionResponseSchema = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", nullable: true, description: "Họ tên của khách" },
    email: { type: "STRING", nullable: true, description: "Email liên hệ của khách" },
    phone: { type: "STRING", nullable: true, description: "Số điện thoại liên hệ của khách" },
    country: { type: "STRING", nullable: true, description: "Quốc gia du học khách đang quan tâm" },
    educationLevel: {
      type: "STRING",
      nullable: true,
      description: "Bậc học khách quan tâm, ví dụ THPT, Đại học, Thạc sĩ",
    },
    major: { type: "STRING", nullable: true, description: "Ngành học khách quan tâm" },
    availability: {
      type: "STRING",
      nullable: true,
      description: "Thời gian khách rảnh để được tư vấn, ví dụ 'cuối tuần buổi chiều'",
    },
    hasBookedConsultation: {
      type: "BOOLEAN",
      description: "Khách đã xác nhận đặt lịch tư vấn miễn phí hay chưa",
    },
    notes: { type: "STRING", nullable: true, description: "Ghi chú/thông tin đáng chú ý khác" },
    quality: { type: "STRING", enum: ["good", "ok", "spam"], description: "Đánh giá chất lượng lead" },
  },
  required: ["hasBookedConsultation", "quality"],
} as const;
