# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> Lưu ý quan trọng: file `AGENTS.md` ở trên (được `next dev` tự sinh/ghi lại) yêu cầu đọc tài liệu
> trong `node_modules/next/dist/docs/` trước khi viết code, vì đây là bản Next.js có breaking changes
> so với kiến thức huấn luyện của bạn. Luôn tuân theo yêu cầu đó trước.

## Giới thiệu dự án

**DuHoc24** — website mẫu "Cổng Tiếp Nhận Hồ Sơ Du Học", dùng cho khoá lập trình 6 tuần, phát triển
dần theo roadmap trong [README.md](README.md). Phần lớn dữ liệu vẫn là mock cứng trong
[`lib/mock-data.ts`](lib/mock-data.ts) — form báo giá, cổng hồ sơ (`/portal`) và toàn bộ `/admin/*`
**chưa** nối database/authentication thật (dự kiến Supabase ở Tuần 3, magic link ở Tuần 6). Ngoại lệ
đã hoàn thành: khung chat QnA ở trang chủ đã nối **Gemini API thật** (Tuần 2) — xem mục "Chatbot QnA"
bên dưới. Không tự ý thêm logic gọi API/DB thật khác (Supabase, upload file, auth...) trừ khi được
yêu cầu rõ ràng.

## Lệnh thường dùng

```bash
npm install       # cài dependencies
npm run dev       # chạy dev server tại http://localhost:3000
npm run build     # build production
npm run start     # chạy bản đã build
npm run lint      # eslint (eslint-config-next core-web-vitals + typescript)
```

Chưa có test suite / test script nào trong repo.

Thêm shadcn/ui component mới qua CLI shadcn (không tự viết tay component UI cơ bản):

```bash
npx shadcn add <component>
```

Registry riêng `@tailark-oss` (xem `components.json`) dùng cho các khối landing page dựng sẵn
(`https://oss.tailark.com/r/{name}.json`) — khối hero hiện tại là biến thể tuỳ chỉnh từ
`@tailark-oss/dusk-landing-2`.

## Kiến trúc tổng quan

**App Router, không có backend riêng** — mọi trang là Server Component đọc trực tiếp từ
`lib/mock-data.ts` (mảng/object hardcode), trừ các component tương tác (form, chat, dropdown...)
được đánh dấu `"use client"` ở đầu file. Khi thêm dữ liệu mới, thêm vào `lib/mock-data.ts` theo
đúng shape các type đã khai báo ở đó (`School`, `AdmissionRequest`, `StudentProfile`,
`Conversation`, `DocStatus`, `RequestStatus`...) thay vì tạo nguồn dữ liệu song song.

Ba khu vực chính, mỗi khu vực có bộ component riêng trong `components/<khu-vực>/`:

| Route | Khu vực | Mô tả |
|---|---|---|
| `/` | `components/landing/` | Landing page: hero, form báo giá (UI tĩnh, chưa nối DB), chatbot QnA gọi Gemini API thật (xem mục "Chatbot QnA" bên dưới), 3 điểm nổi bật |
| `/portal` | `components/portal/` | Cổng hồ sơ học viên demo (dữ liệu từ `currentStudent` trong mock-data): upload giấy tờ, thông tin trích xuất, đối chiếu điểm chuẩn |
| `/admin/*` | `components/admin/` | Dashboard nội bộ, dùng chung `AdminLayout` (`app/admin/layout.tsx`) với `AdminSidebar`/`AdminMobileNav` (`components/admin/sidebar.tsx`) — điều hướng khai báo tập trung trong mảng `adminNavItems`. `/admin` redirect sang `/admin/requests`. Các trang con: `requests`, `schools`, `profiles`, `conversations` |

Component dùng chung nằm ngoài 3 thư mục trên: `site-header.tsx`, `site-footer.tsx`, `logo.tsx`,
`status-badge.tsx` (định nghĩa tone màu + nhãn tiếng Việt cho `DocStatus`/`RequestStatus`, dùng
chung giữa `/portal` và `/admin`).

`components/ui/` là các primitive shadcn/ui (style **base-nova**, nền Base UI — KHÔNG phải
Radix), không sửa tay trừ khi cần thiết; ưu tiên thêm qua CLI shadcn ở trên.

### Chatbot QnA (Gemini) — điểm nối API thật duy nhất hiện tại

- [`app/api/chat/route.ts`](app/api/chat/route.ts): Route Handler `POST` duy nhất trong dự án, gọi
  REST API Gemini (model `gemini-3.5-flash-lite`) bằng `GEMINI_API_KEY` đọc từ `.env` — chỉ chạy
  phía server, không lộ ra client. Nhận `{ message, history }` từ client, trả `{ reply }` hoặc
  `{ error }`.
- [`lib/chatbot-knowledge.ts`](lib/chatbot-knowledge.ts): nguồn duy nhất cho bộ câu hỏi/trả lời
  chuẩn (`chatbotQna`) và system instruction (`chatbotSystemInstruction`) ép Gemini chỉ trả lời
  trong đúng phạm vi này. Muốn sửa/thêm QnA thì sửa ở đây — **không** hardcode câu trả lời trong
  component hay trong route handler.
- [`components/landing/chat-widget.tsx`](components/landing/chat-widget.tsx): client component gọi
  `/api/chat`, gửi kèm lịch sử hội thoại (`history`, bỏ câu chào mở đầu) để giữ ngữ cảnh nhiều lượt;
  4 nút gợi ý nhanh lấy trực tiếp từ `chatbotQna.slice(0, 4)` thay vì hardcode riêng.

### Quy ước cần theo

- **Alias import**: dùng `@/*` (map tới root — xem `tsconfig.json`), ví dụ `@/lib/mock-data`,
  `@/components/ui/button`.
- **Class name**: luôn gộp qua `cn()` (`lib/utils.ts`, wrap `clsx` + `tailwind-merge`), không nối
  chuỗi class thủ công khi có class động/điều kiện.
- **Ngôn ngữ giao diện**: toàn bộ text hiển thị, tên biến miền nghiệp vụ (status, route labels) đều
  bằng tiếng Việt (`"Chờ duyệt"`, `"Hợp lệ"`, `"Cần nộp lại"`...) — giữ nguyên văn phong này khi
  thêm nội dung mới, kể cả comment mô tả dữ liệu mock.
- **Tailwind v4**: cấu hình qua CSS variables trong `app/globals.css` (không có `tailwind.config`
  riêng — `components.json` khai báo `"config": ""`).
- **Icon**: dùng `lucide-react`, đồng bộ kích thước theo class `size-*` đã dùng trong codebase
  (không hardcode `width`/`height`).

## Quy tắc Git

- Luôn hỏi xác nhận trước khi push lên Github
- Không bao giờ commit file `.env` hoặc bất kỳ file chứa API key
