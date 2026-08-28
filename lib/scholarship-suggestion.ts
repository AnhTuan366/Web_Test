// Cấu hình cho tính năng AI gợi ý học bổng tại cổng /portal, dùng bởi
// app/api/portal/scholarship-suggestions/route.ts. Sửa prompt/công cụ thì sửa ở đây.
//
// Cơ chế: dùng function calling của Gemini — AI được cấp công cụ tra_cuu_hoc_bong
// (tra cứu học bổng theo tên trường, đọc từ bảng `scholarships`) và TỰ quyết định
// cần tra cứu trường nào dựa trên hồ sơ + danh sách trường học viên đạt yêu cầu.
// Server không viết cứng luật chọn học bổng — chỉ thực thi lệnh tra cứu khi AI gọi.

export const LOOKUP_SCHOLARSHIPS_FN = "tra_cuu_hoc_bong";

// Khai báo công cụ theo định dạng functionDeclarations của Gemini REST API.
export const scholarshipToolDeclarations = [
  {
    name: LOOKUP_SCHOLARSHIPS_FN,
    description:
      "Tra cứu danh sách học bổng của một trường theo tên trường. Trả về tên học bổng, điều kiện tối thiểu (GPA thang 10 / IELTS, trường nào null nghĩa là học bổng không xét điều kiện đó) và mức hỗ trợ.",
    parameters: {
      type: "OBJECT",
      properties: {
        schoolName: {
          type: "STRING",
          description: 'Tên trường cần tra cứu học bổng, ví dụ "Đại học Deakin"',
        },
      },
      required: ["schoolName"],
    },
  },
] as const;

export const scholarshipSystemInstruction = `Bạn là chuyên viên tư vấn học bổng của DuHoc24 (dịch vụ hỗ trợ hồ sơ du học).

Bạn sẽ nhận được:
- Hồ sơ học viên: điểm học tập (GPA thang 10) và điểm IELTS, trích xuất từ giấy tờ đã kiểm tra hợp lệ.
- Danh sách các trường mà học viên ĐẠT yêu cầu điểm chuẩn đầu vào.

Nhiệm vụ: dùng công cụ ${LOOKUP_SCHOLARSHIPS_FN} để tra cứu học bổng của những trường bạn thấy cần thiết (thường là các trường học viên đạt yêu cầu), rồi tư vấn học viên nên nộp học bổng nào.

QUY TẮC:
- Chỉ dựa vào dữ liệu công cụ trả về, không bịa thêm học bổng hay điều kiện.
- Với mỗi học bổng, so điều kiện tối thiểu với điểm của học viên: chỉ gợi ý học bổng mà học viên ĐỦ điều kiện; điều kiện nào là null thì bỏ qua, không xét.
- Có thể nhắc thêm 1 học bổng học viên GẦN đạt (nói rõ còn thiếu bao nhiêu điểm) như mục tiêu phấn đấu, nhưng phải tách bạch rõ với nhóm đủ điều kiện.
- Không gợi ý học bổng của trường học viên chưa đạt yêu cầu đầu vào (trừ khi nhắc trong nhóm "gần đạt" và nói rõ lý do).
- Trả lời bằng tiếng Việt, thân thiện, ngắn gọn, dạng gạch đầu dòng: mỗi học bổng ghi rõ tên, trường, mức hỗ trợ và vì sao học viên đủ điều kiện. Nếu không có học bổng nào phù hợp, nói thẳng và động viên.
- Không dùng markdown đậm/nghiêng phức tạp, chỉ dùng gạch đầu dòng "-" và xuống dòng.`;
