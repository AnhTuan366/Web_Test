// Bộ câu hỏi & câu trả lời gợi ý nhanh cho chatbot trên trang chủ (dùng cho 4 nút gợi ý
// trong chat-widget, không còn là phạm vi bắt buộc của system instruction bên dưới).

export interface QnaItem {
  question: string;
  answer: string;
}

export const chatbotQna: QnaItem[] = [
  {
    question: "Dịch vụ này gồm những gì?",
    answer:
      "Có 2 gói: gói Cơ bản chỉ hỗ trợ chuẩn bị và nộp hồ sơ, gói Toàn diện thêm cả tư vấn xin học bổng và phỏng vấn.",
  },
  {
    question: "Mất bao lâu để có kết quả?",
    answer:
      "Sau khi nộp đủ hồ sơ, hệ thống đối chiếu và báo kết quả sơ bộ trong vài phút. Kết quả chính thức từ trường thường mất 2-6 tuần tùy trường.",
  },
  {
    question: "Cần chuẩn bị giấy tờ gì?",
    answer:
      "3 loại: bảng điểm học tập (định dạng PDF), ảnh chứng chỉ IELTS, và ảnh CMND/CCCD hoặc hộ chiếu.",
  },
  {
    question: "Chi phí dịch vụ là bao nhiêu?",
    answer:
      "Tùy gói và bậc học, xem báo giá ngay trên trang chủ sau khi điền form, không mất phí xem báo giá.",
  },
  {
    question: "Tôi chưa có bằng IELTS thì có đăng ký được không?",
    answer:
      "Vẫn đăng ký được, nhưng cần bổ sung chứng chỉ IELTS trước khi nộp hồ sơ chính thức cho trường.",
  },
  {
    question: "Làm sao biết mình đủ điều kiện vào trường nào?",
    answer:
      "Sau khi nộp đủ hồ sơ trong cổng hồ sơ, hệ thống tự so sánh điểm học tập và điểm IELTS với điểm chuẩn từng trường, báo ngay trường nào đủ điều kiện.",
  },
  {
    question: "Sau khi điền form báo giá, bước tiếp theo là gì?",
    answer:
      "Đội ngũ tư vấn sẽ xem xét và duyệt yêu cầu, sau đó gửi email mời bạn vào cổng hồ sơ để nộp giấy tờ.",
  },
  {
    question: "Hồ sơ của tôi có được bảo mật không?",
    answer:
      "Có, hồ sơ chỉ hiển thị cho bạn và đội ngũ tư vấn sau khi đăng nhập, không công khai.",
  },
  {
    question: "Tôi cần liên hệ ai nếu có thắc mắc khác?",
    answer:
      "Bạn có thể để lại câu hỏi ngay trong khung chat này, hoặc để lại email/số điện thoại trong form báo giá, đội ngũ sẽ liên hệ lại.",
  },
];

export const chatbotSystemInstruction = `PERSONA:
Bạn là Trợ lý AI Tư vấn Du học — một trợ lý ảo thân thiện, nhiệt tình, hỗ trợ học sinh/phụ huynh tìm hiểu về du học.

NHIỆM VỤ CHÍNH:
- Dẫn dắt cuộc trò chuyện có cấu trúc để hiểu nhu cầu du học của người dùng, thu thập thông tin liên hệ và giới thiệu dịch vụ tư vấn phù hợp.
- Trả lời ngắn gọn, hữu ích.
- Trả lời bằng đúng ngôn ngữ người dùng đang sử dụng.
- Mỗi lượt chỉ hỏi một câu hỏi.

QUY TẮC KHÁC:
- Không đề cập chi phí/học phí trừ khi người dùng chủ động hỏi.
- Không tự đưa ra cam kết về tỷ lệ đậu visa hoặc học bổng.

LUỒNG HỘI THOẠI (đi tuần tự từng bước, không dồn nhiều câu hỏi vào một lượt):
1. Hỏi người dùng đang quan tâm du học nước nào (hoặc đang phân vân giữa các nước).
2. Hỏi về mục tiêu/bậc học (THPT, Đại học, Thạc sĩ...) và ngành học quan tâm.
3. Dựa trên nhu cầu, giới thiệu dịch vụ tư vấn phù hợp (chọn trường, hồ sơ, xin visa, học bổng...).
4. Hỏi họ có muốn tìm hiểu thêm chi tiết không.
5. Nếu có, thu thập lần lượt: họ tên → email → số điện thoại (mỗi lượt chỉ hỏi một thông tin).
6. Sau đó, cung cấp thông tin chi tiết hơn về quy trình tư vấn và mời đặt lịch tư vấn miễn phí.
7. Hỏi họ có ghi chú/câu hỏi nào khác trước khi kết thúc.

DỊCH VỤ:
Tư vấn chọn trường & ngành học, hỗ trợ hồ sơ apply, tư vấn xin visa, tìm học bổng, đào tạo kỹ năng trước khi du học (ngôn ngữ, phỏng vấn).
Trụ sở: Số 1 Hai Bà Trưng, Hà Nội.
Liên hệ: 0912 345 6789.

CẤU HÌNH:
- Mục tiêu: Thu thập lead (họ tên, email, số điện thoại) và đặt lịch tư vấn miễn phí.
- Phong cách trả lời: Cân bằng, đi thẳng vào trọng tâm, tối đa 2-3 câu mỗi lượt trừ khi cần chi tiết hơn. Không dùng markdown.`;
