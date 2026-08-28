// Cấu hình cho tính năng trích xuất thông tin giấy tờ học viên bằng Gemini tại cổng /portal,
// dùng bởi app/api/portal/documents/route.ts. Sửa prompt/schema/quy tắc hợp lệ thì sửa ở đây.
//
// Lưu ý: Gemini CHỈ làm nhiệm vụ đọc thông tin từ file (trường nào không đọc được thì trả null).
// Việc kết luận giấy tờ hợp lệ hay cần nộp lại (thiếu trường bắt buộc nào) do validateExtraction()
// tính bằng code thường phía server — không hỏi AI. Chứng chỉ IELTS hết hạn VẪN được chấp nhận
// (chỉ hiển thị ngày hết hạn cho học viên biết, không bắt nộp lại).

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
  testDate: string | null; // ngày thi, ISO YYYY-MM-DD
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
- Quét kỹ TOÀN BỘ file trước khi kết luận, kể cả vùng chữ nhỏ, chữ in nghiêng, vùng bị loá sáng
  hoặc hơi mờ. Ảnh chụp thực tế thường nghiêng, tối hoặc bóng nước — hãy cố đọc hết mức có thể.
- Chỉ dùng thông tin thực sự đọc được trong file. Không suy đoán, không bịa thêm; một trường chỉ
  để null khi đã tìm đúng vị trí của nó mà vẫn không đọc nổi (bị che, mất góc, quá mờ).
- Đọc được một phần thì vẫn KHÔNG trả về phần đó — ví dụ ngày sinh chỉ thấy năm, hoặc số giấy tờ
  mất vài chữ số, thì để null thay vì trả giá trị thiếu.
- Ngày tháng luôn trả về theo định dạng ISO: YYYY-MM-DD. Giấy tờ Việt Nam thường ghi dd/mm/yyyy —
  nhớ đổi đúng thứ tự ngày/tháng.
- Điểm số trả về dạng số (number), không kèm chữ.
- Chỉ trả về JSON đúng theo schema được cung cấp, không thêm chữ nào khác.`;

export const extractionSystemInstructions: Record<PortalDocType, string> = {
  bang_diem: `${sharedExtractionRules}

Bạn nhận được BẢNG ĐIỂM của học sinh/sinh viên (file PDF), thường là học bạ THPT hoặc bảng điểm
đại học của Việt Nam. Thông tin học sinh (họ tên, ngày sinh) thường nằm ở phần đầu trang hoặc
trong khung thông tin cá nhân, sau các nhãn như "Họ và tên", "Họ tên", "Học sinh", "Sinh viên",
"Ngày sinh", "Sinh ngày". Bảng điểm nhiều trang thì thông tin này hay ở trang đầu. Hãy trích xuất:
- fullName: họ tên đầy đủ của học sinh ghi trên bảng điểm.
- dateOfBirth: ngày sinh của học sinh (nếu bảng điểm có ghi).
- gpa: điểm học tập tổng kết/trung bình chung của TOÀN BỘ bảng điểm — tìm các nhãn như
  "Điểm trung bình", "ĐTB", "Trung bình chung", "TBC", "Điểm tổng kết", "GPA", thường nằm ở
  dòng cuối bảng điểm hoặc phần tổng kết cuối trang. Không lấy điểm của một môn riêng lẻ.
  Trả theo thang điểm 10; nếu bảng điểm dùng thang khác (ví dụ thang 4), quy đổi tuyến tính
  về thang 10.`,
  ielts: `${sharedExtractionRules}

Bạn nhận được ẢNH CHỨNG CHỈ IELTS — thường là Test Report Form (TRF): tờ giấy khổ A4 có logo
IELTS/British Council/IDP/Cambridge ở phía trên. Bố cục quen thuộc của TRF:
- Ngày thi nằm gần đầu phiếu, sau nhãn "Date" hoặc "Test Date", định dạng dd/mm/yyyy.
- Họ tên thí sinh sau nhãn "Family Name" + "First Name(s)" (ghép lại thành họ tên đầy đủ)
  hoặc "Candidate Name", thường viết IN HOA.
- Điểm nằm trong dải ô "Test Results" xếp ngang: Listening, Reading, Writing, Speaking, và ô
  "Overall Band Score" (điểm tổng). Điểm IELTS là số từ 0 đến 9, bước 0.5 (ví dụ 6.0, 6.5, 7.0)
  — đọc ra giá trị khác dạng này thì kiểm tra lại ô đã đọc.
Hãy trích xuất:
- fullName: họ tên trên chứng chỉ.
- listening / reading / writing / speaking: điểm từng kỹ năng Nghe / Đọc / Viết / Nói.
- overall: điểm tổng (Overall Band Score).
- testDate: ngày thi (test date) ghi trên chứng chỉ.
- expiryDate: ngày hết hạn chứng chỉ. TRF thường KHÔNG in ngày hết hạn — khi đó tính ngày
  hết hạn = ngày thi + 2 năm. Chỉ để null khi không đọc được cả ngày thi.`,
  tuy_than: `${sharedExtractionRules}

Bạn nhận được ẢNH GIẤY TỜ TÙY THÂN — một trong ba loại, mỗi loại có bố cục cố định:

1. CCCD Việt Nam (thẻ nền xanh lá, có quốc huy): tiêu đề "CĂN CƯỚC CÔNG DÂN / Citizen Identity
   Card", ảnh chân dung bên trái. Các trường in song ngữ, giá trị nằm NGAY SAU nhãn:
   "Số / No.": số CCCD gồm ĐÚNG 12 chữ số. "Họ và tên / Full name": họ tên viết IN HOA có dấu,
   thường nằm ở dòng DƯỚI nhãn. "Ngày sinh / Date of birth": dd/mm/yyyy. Đừng nhầm với
   "Có giá trị đến / Date of expiry" (góc dưới trái) hay các trường khác (Giới tính, Quê quán,
   Nơi thường trú).
2. CMND cũ (thẻ nền xanh lá nhạt/trắng): "Số" gồm 9 chữ số, các nhãn "Họ tên", "Sinh ngày"
   chỉ có tiếng Việt.
3. Hộ chiếu (passport): trang thông tin có ảnh; "Họ và tên / Full name" viết IN HOA,
   "Số hộ chiếu / Passport No" thường 1 chữ cái + 7-8 chữ số, "Ngày sinh / Date of birth".
   Dưới cùng trang có 2 dòng mã MRZ (dãy ký tự và dấu "<") — nếu vùng thông tin chính bị mờ,
   có thể đối chiếu họ tên (không dấu), số hộ chiếu và ngày sinh từ MRZ.

Hãy trích xuất:
- fullName: họ tên đầy đủ, giữ nguyên chữ IN HOA và dấu tiếng Việt như trên giấy tờ.
- dateOfBirth: ngày sinh.
- documentNumber: số CCCD/CMND hoặc số hộ chiếu — chỉ trả khi đọc được TRỌN VẸN dãy số,
  đọc thiếu chữ số nào thì để null.`,
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
      testDate: {
        type: "STRING",
        nullable: true,
        description: "Ngày thi (test date), định dạng YYYY-MM-DD",
      },
      expiryDate: {
        type: "STRING",
        nullable: true,
        description: "Ngày hết hạn chứng chỉ, định dạng YYYY-MM-DD",
      },
    },
    required: [
      "fullName",
      "listening",
      "reading",
      "writing",
      "speaking",
      "overall",
      "testDate",
      "expiryDate",
    ],
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
    testDate: "ngày thi",
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

// Kiểm tra kết quả trích xuất bằng code thường (không hỏi AI): đủ trường bắt buộc chưa.
// Chứng chỉ IELTS hết hạn vẫn được chấp nhận — không kiểm tra hạn ở đây.
// Trả về trạng thái + lý do cụ thể để hiển thị cho học viên.
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

  return { status: "hop_le", reason: null };
}
