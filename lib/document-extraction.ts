// Cấu hình cho tính năng trích xuất thông tin giấy tờ học viên bằng Gemini tại cổng /portal,
// dùng bởi app/api/portal/documents/route.ts. Sửa prompt/schema/quy tắc hợp lệ thì sửa ở đây.
//
// Lưu ý: Gemini CHỈ làm nhiệm vụ đọc thông tin từ file (trường nào không đọc được thì trả null).
// Việc kết luận giấy tờ hợp lệ hay cần nộp lại (thiếu trường nào, chứng chỉ hết hạn...) do
// validateExtraction() tính bằng code thường phía server — không hỏi AI.

export type PortalDocType = "bang_diem" | "ielts" | "tuy_than";

export const portalDocTypes: PortalDocType[] = ["bang_diem", "ielts", "tuy_than"];

export const docTypeLabels: Record<PortalDocType, string> = {
  bang_diem: "Bảng điểm",
  ielts: "Chứng chỉ IELTS",
  tuy_than: "CMND/CCCD hoặc hộ chiếu",
};

// Loại file chấp nhận cho từng loại giấy tờ (bảng điểm là PDF, còn lại là ảnh).
export const docTypeAllowedMimes: Record<PortalDocType, string[]> = {
  bang_diem: ["application/pdf"],
  ielts: ["image/jpeg", "image/png"],
  tuy_than: ["image/jpeg", "image/png"],
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // khớp file_size_limit của bucket portal-documents

// Thông tin trích xuất từ bảng điểm
export interface TranscriptExtraction {
  fullName: string | null;
  dateOfBirth: string | null; // ISO YYYY-MM-DD
  gpa: number | null; // điểm học tập tổng kết, thang 10
}

// Thông tin trích xuất từ chứng chỉ IELTS
export interface IeltsExtraction {
  fullName: string | null;
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  overall: number | null;
  expiryDate: string | null; // ISO YYYY-MM-DD
}

// Thông tin trích xuất từ CMND/CCCD/hộ chiếu
export interface IdentityExtraction {
  fullName: string | null;
  dateOfBirth: string | null; // ISO YYYY-MM-DD
  documentNumber: string | null;
}

export interface ExtractionByDocType {
  bang_diem: TranscriptExtraction;
  ielts: IeltsExtraction;
  tuy_than: IdentityExtraction;
}

const sharedExtractionRules = `Bạn là công cụ trích xuất dữ liệu (data extraction) từ giấy tờ, không phải chatbot trò chuyện.

QUY TẮC CHUNG:
- Chỉ dùng thông tin thực sự đọc được trong file. Không suy đoán, không bịa thêm.
- Trường nào không đọc được (mờ, bị che, không xuất hiện trong file) thì để null.
- Ngày tháng luôn trả về theo định dạng ISO: YYYY-MM-DD.
- Điểm số trả về dạng số (number), không kèm chữ.
- Chỉ trả về JSON đúng theo schema được cung cấp, không thêm chữ nào khác.`;

export const extractionSystemInstructions: Record<PortalDocType, string> = {
  bang_diem: `${sharedExtractionRules}

Bạn nhận được BẢNG ĐIỂM của học sinh/sinh viên (file PDF). Hãy trích xuất:
- fullName: họ tên đầy đủ của học sinh ghi trên bảng điểm.
- dateOfBirth: ngày sinh của học sinh (nếu bảng điểm có ghi).
- gpa: điểm học tập tổng kết/trung bình chung, theo thang điểm 10. Nếu bảng điểm dùng thang khác (ví dụ thang 4), quy đổi tuyến tính về thang 10.`,
  ielts: `${sharedExtractionRules}

Bạn nhận được ẢNH CHỨNG CHỈ IELTS (Test Report Form). Hãy trích xuất:
- fullName: họ tên trên chứng chỉ.
- listening / reading / writing / speaking: điểm từng kỹ năng Nghe / Đọc / Viết / Nói.
- overall: điểm tổng (Overall Band Score).
- expiryDate: ngày hết hạn chứng chỉ. Nếu chứng chỉ chỉ ghi ngày thi (test date), tính ngày hết hạn = ngày thi + 2 năm.`,
  tuy_than: `${sharedExtractionRules}

Bạn nhận được ẢNH GIẤY TỜ TÙY THÂN (CMND, CCCD hoặc hộ chiếu). Hãy trích xuất:
- fullName: họ tên đầy đủ.
- dateOfBirth: ngày sinh.
- documentNumber: số CMND/CCCD hoặc số hộ chiếu.`,
};

// Schema structured output cho Gemini (định dạng REST API, type viết hoa).
export const extractionResponseSchemas: Record<PortalDocType, object> = {
  bang_diem: {
    type: "OBJECT",
    properties: {
      fullName: { type: "STRING", nullable: true, description: "Họ tên học sinh trên bảng điểm" },
      dateOfBirth: { type: "STRING", nullable: true, description: "Ngày sinh, định dạng YYYY-MM-DD" },
      gpa: { type: "NUMBER", nullable: true, description: "Điểm học tập tổng kết theo thang 10" },
    },
    required: ["fullName", "dateOfBirth", "gpa"],
  },
  ielts: {
    type: "OBJECT",
    properties: {
      fullName: { type: "STRING", nullable: true, description: "Họ tên trên chứng chỉ" },
      listening: { type: "NUMBER", nullable: true, description: "Điểm kỹ năng Nghe" },
      reading: { type: "NUMBER", nullable: true, description: "Điểm kỹ năng Đọc" },
      writing: { type: "NUMBER", nullable: true, description: "Điểm kỹ năng Viết" },
      speaking: { type: "NUMBER", nullable: true, description: "Điểm kỹ năng Nói" },
      overall: { type: "NUMBER", nullable: true, description: "Điểm tổng (Overall Band Score)" },
      expiryDate: {
        type: "STRING",
        nullable: true,
        description: "Ngày hết hạn chứng chỉ, định dạng YYYY-MM-DD",
      },
    },
    required: ["fullName", "listening", "reading", "writing", "speaking", "overall", "expiryDate"],
  },
  tuy_than: {
    type: "OBJECT",
    properties: {
      fullName: { type: "STRING", nullable: true, description: "Họ tên đầy đủ" },
      dateOfBirth: { type: "STRING", nullable: true, description: "Ngày sinh, định dạng YYYY-MM-DD" },
      documentNumber: { type: "STRING", nullable: true, description: "Số CMND/CCCD hoặc số hộ chiếu" },
    },
    required: ["fullName", "dateOfBirth", "documentNumber"],
  },
};

// Nhãn tiếng Việt của từng trường bắt buộc — dùng để ghép câu báo lỗi "không đọc được ...".
const requiredFieldLabels: Record<PortalDocType, Record<string, string>> = {
  bang_diem: {
    fullName: "họ tên",
    dateOfBirth: "ngày sinh",
    gpa: "điểm học tập tổng kết",
  },
  ielts: {
    fullName: "họ tên",
    listening: "điểm Nghe",
    reading: "điểm Đọc",
    writing: "điểm Viết",
    speaking: "điểm Nói",
    overall: "điểm tổng",
    expiryDate: "ngày hết hạn",
  },
  tuy_than: {
    fullName: "họ tên",
    dateOfBirth: "ngày sinh",
    documentNumber: "số giấy tờ",
  },
};

export interface DocValidation {
  status: "hop_le" | "can_nop_lai";
  reason: string | null;
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateVi(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate;
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Kiểm tra kết quả trích xuất bằng code thường (không hỏi AI): đủ trường bắt buộc chưa,
// chứng chỉ IELTS còn hạn không. Trả về trạng thái + lý do cụ thể để hiển thị cho học viên.
export function validateExtraction(
  docType: PortalDocType,
  extracted: Record<string, unknown>,
): DocValidation {
  const labels = requiredFieldLabels[docType];
  const missing = Object.keys(labels).filter((field) => {
    const value = extracted[field];
    return value === null || value === undefined || value === "";
  });

  if (missing.length > 0) {
    const missingLabels = missing.map((field) => labels[field]).join(", ");
    return {
      status: "can_nop_lai",
      reason: `Không đọc được ${missingLabels} từ file. File có thể bị mờ hoặc không đúng loại giấy tờ — hãy nộp lại bản rõ nét hơn.`,
    };
  }

  if (docType === "ielts") {
    const expiry = parseIsoDate(String(extracted.expiryDate));
    if (!expiry) {
      return {
        status: "can_nop_lai",
        reason: "Ngày hết hạn trên chứng chỉ không đọc được rõ — hãy nộp lại ảnh rõ nét hơn.",
      };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expiry < today) {
      return {
        status: "can_nop_lai",
        reason: `Chứng chỉ IELTS đã hết hạn ngày ${formatDateVi(String(extracted.expiryDate))} — hãy nộp chứng chỉ còn hạn.`,
      };
    }
  }

  return { status: "hop_le", reason: null };
}
