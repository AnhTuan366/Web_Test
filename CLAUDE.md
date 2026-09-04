# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> Lưu ý quan trọng: file `AGENTS.md` ở trên (được `next dev` tự sinh/ghi lại) yêu cầu đọc tài liệu
> trong `node_modules/next/dist/docs/` trước khi viết code, vì đây là bản Next.js có breaking changes
> so với kiến thức huấn luyện của bạn. Luôn tuân theo yêu cầu đó trước.

## Giới thiệu dự án

**DuHoc24** — website mẫu "Cổng Tiếp Nhận Hồ Sơ Du Học", dùng cho khoá lập trình 6 tuần, phát triển
dần theo roadmap trong [README.md](README.md). Một phần dữ liệu vẫn là mock cứng trong
[`lib/mock-data.ts`](lib/mock-data.ts) — trang `/admin/profiles` **chưa** nối database, và toàn site
**chưa** có authentication thật (dự kiến magic link ở Tuần 6). Ngoại lệ đã hoàn thành: (1) khung
chat QnA ở trang chủ đã nối **Gemini API thật** (Tuần 2) và lưu hội thoại thật trong **Supabase
Postgres** (bảng `chat_conversations`/`chat_messages`, chỉ server truy cập được) — xem mục "Chatbot
QnA" bên dưới; `/admin/conversations` đọc trực tiếp từ 2 bảng này, không còn dùng mock. (2) Form
báo giá trên trang chủ đã hoạt động thật: `POST /api/quote` tính giá phía server và lưu vào bảng
`quote_requests` (cùng mô hình chỉ-server), `/admin/requests` đọc trực tiếp từ bảng này — xem mục
"Form báo giá" bên dưới. (3) Danh sách trường tham chiếu là dữ liệu thật trong bảng `schools`
(công khai — RLS có policy cho đọc), dùng bởi `/admin/schools` và phần đối chiếu điểm chuẩn ở
`/portal` — xem mục "Trường tham chiếu" bên dưới. (4) Cổng `/portal` đã nhận upload giấy tờ thật:
Gemini đọc file và trích xuất thông tin, lưu vào bảng `portal_profiles`/`portal_documents` + bucket
`portal-documents` (riêng tư, chỉ server truy cập được) — xem mục "Cổng hồ sơ /portal" bên dưới.
Không tự ý thêm logic gọi API/DB thật khác (auth...) trừ khi được yêu cầu rõ ràng.

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

**App Router, không có backend riêng ngoài chatbot** — phần lớn trang là Server Component đọc trực
tiếp từ `lib/mock-data.ts` (mảng/object hardcode), trừ các component tương tác (form, chat,
dropdown...) được đánh dấu `"use client"` ở đầu file. Khi thêm dữ liệu mock mới, thêm vào
`lib/mock-data.ts` theo đúng shape các type đã khai báo ở đó (`School`, `AdmissionRequest`,
`StudentProfile`, `DocStatus`, `RequestStatus`...) thay vì tạo nguồn dữ liệu song song. Riêng dữ liệu
hội thoại chatbot (`chat_conversations`/`chat_messages`) nằm trong Supabase thật — xem mục "Chatbot
QnA" bên dưới, type tương ứng ở [`lib/database.types.ts`](lib/database.types.ts) (sinh tự động, xem
comment đầu file để biết cách sinh lại).

Ba khu vực chính, mỗi khu vực có bộ component riêng trong `components/<khu-vực>/`:

| Route | Khu vực | Mô tả |
|---|---|---|
| `/` | `components/landing/` | Landing page: hero, form báo giá (gọi `POST /api/quote` thật, giá tính phía server, lưu bảng `quote_requests` — xem mục "Form báo giá" bên dưới), chatbot QnA gọi Gemini API thật + lưu Supabase (xem mục "Chatbot QnA" bên dưới), 3 điểm nổi bật |
| `/portal` | `components/portal/` | Cổng hồ sơ học viên demo: upload 3 loại giấy tờ thật (Gemini trích xuất, lưu Supabase — xem mục "Cổng hồ sơ /portal" bên dưới), đối chiếu điểm chuẩn với bảng `schools` thật |
| `/admin/*` | `components/admin/` | Dashboard nội bộ, dùng chung `AdminLayout` (`app/admin/layout.tsx`) với `AdminSidebar`/`AdminMobileNav` (`components/admin/sidebar.tsx`) — điều hướng khai báo tập trung trong mảng `adminNavItems`. `/admin` redirect sang `/admin/requests`. Các trang con: `schools`, `profiles` (mock), `requests`, `conversations` (Supabase thật) |

Component dùng chung nằm ngoài 3 thư mục trên: `site-header.tsx`, `site-footer.tsx`, `logo.tsx`,
`status-badge.tsx` (định nghĩa tone màu + nhãn tiếng Việt cho `DocStatus`/`RequestStatus`, dùng
chung giữa `/portal` và `/admin`).

`components/ui/` là các primitive shadcn/ui (style **base-nova**, nền Base UI — KHÔNG phải
Radix), không sửa tay trừ khi cần thiết; ưu tiên thêm qua CLI shadcn ở trên.

### Chatbot QnA (Gemini + Supabase)

- [`app/api/chat/route.ts`](app/api/chat/route.ts): Route Handler `GET`/`POST` chính của chatbot
  (các route handler khác: `app/api/admin/extract-lead/route.ts` bên dưới và `app/api/quote/route.ts`
  ở mục "Form báo giá"). `POST` nhận `{ message, sessionToken }`, gọi REST API Gemini (model `gemini-3.5-flash-lite`) bằng
  `GEMINI_API_KEY`, đồng thời đọc/ghi hội thoại vào Supabase (bảng `chat_conversations` /
  `chat_messages`) qua `ctx.supabaseAdmin` (`withSupabase({ auth: "none" })` từ gói `@supabase/server`
  — xem SKILL `supabase-server`). `GET ?sessionToken=` trả lại lịch sử hội thoại để hydrate widget.
  Lịch sử gửi cho Gemini được đọc lại từ DB phía server, **không** nhận từ client nữa.
- [`lib/supabase-admin.ts`](lib/supabase-admin.ts): helper `getSupabaseAdmin()` tạo admin client
  (secret key, bỏ qua RLS), có `import "server-only"` để build lỗi ngay nếu code phía client lỡ
  import. Đây là cách DUY NHẤT được phép đọc/ghi 2 bảng chat — không tạo Supabase client khác truy
  cập 2 bảng này, và không expose publishable key cho tính năng này (RLS bật, không có policy nào,
  nên trình duyệt dù có publishable key cũng không đọc/ghi được).
- [`lib/chatbot-knowledge.ts`](lib/chatbot-knowledge.ts): nguồn duy nhất cho `chatbotSystemInstruction`
  (persona, luồng hội thoại thu thập lead theo từng bước, quy tắc trả lời) và `chatbotQna` (bộ câu
  hỏi gợi ý nhanh cho 4 nút trong widget — không còn ràng buộc phạm vi trả lời của Gemini). Muốn
  sửa persona/luồng hội thoại hoặc bộ câu hỏi gợi ý thì sửa ở đây — **không** hardcode trong
  component hay trong route handler.
- [`components/landing/chat-widget.tsx`](components/landing/chat-widget.tsx): client component chỉ
  gọi `/api/chat` (không bao giờ gọi Supabase trực tiếp). Tự sinh `sessionToken` (UUID) lưu
  `localStorage` để server nhận diện đúng hội thoại của trình duyệt đó, nạp lại lịch sử qua `GET`
  khi mount; 4 nút gợi ý nhanh lấy trực tiếp từ `chatbotQna.slice(0, 4)`.
- [`app/admin/conversations/page.tsx`](app/admin/conversations/page.tsx): Server Component, đọc
  danh sách hội thoại + đếm số tin nhắn trực tiếp từ Supabase qua `getSupabaseAdmin()`; mỗi dòng có
  nút "Xem chi tiết" dẫn tới `/admin/conversations/[id]`.
- [`app/admin/conversations/[id]/page.tsx`](app/admin/conversations/%5Bid%5D/page.tsx): Server
  Component trang chi tiết một hội thoại, đọc toàn bộ tin nhắn (`chat_messages`) theo `conversation_id`
  qua `getSupabaseAdmin()`, hiển thị dạng bong bóng chat (khách phải/bot trái). `id` không tồn tại thì
  gọi `notFound()` (`next/navigation`) trả 404 chuẩn. Các nút/link điều hướng trong 2 trang này dùng
  `<Button render={<Link .../>} nativeButton={false} />` — bắt buộc set `nativeButton={false}` khi
  `render` không phải `<button>` thật, nếu không Base UI sẽ log warning ở console. Trang này cũng đọc
  bảng `chat_leads` (nếu có) và hiển thị Card "Thông tin lead" phía trên khung tin nhắn.
- [`lib/lead-extraction.ts`](lib/lead-extraction.ts): nguồn duy nhất cho system instruction +
  JSON schema (structured output) dùng để nhờ Gemini trích xuất thông tin lead (tên, email, SĐT,
  quốc gia, bậc học, ngành học, availability, đã đặt lịch tư vấn, ghi chú, đánh giá chất lượng
  `good`/`ok`/`spam`) từ nội dung một hội thoại.
- [`app/api/admin/extract-lead/route.ts`](app/api/admin/extract-lead/route.ts): Route Handler `POST`
  thứ hai trong dự án (`withSupabase({ auth: "none" })`, cùng mô hình bảo mật như `/api/chat` — chỉ
  server có secret key mới đọc/ghi được, chưa có auth cho `/admin/*` nên endpoint này cũng chưa có
  auth). Nhận `{ conversationId }`, đọc toàn bộ tin nhắn của hội thoại đó, gọi Gemini
  (`gemini-3.5-flash-lite`) với schema ở `lib/lead-extraction.ts`, rồi `upsert` kết quả vào bảng
  `chat_leads` (unique theo `conversation_id`, gọi lại sẽ ghi đè lần trích xuất trước). Được kích hoạt
  thủ công từ nút trong [`components/admin/extract-lead-button.tsx`](components/admin/extract-lead-button.tsx)
  (client component, gọi `router.refresh()` sau khi lưu xong) — **không** tự động chạy khi khách
  nhắn tin, chỉ chạy khi admin bấm nút trong trang chi tiết hội thoại.
- [`chat_leads`](lib/database.types.ts): bảng Supabase lưu kết quả trích xuất lead, RLS bật và không
  có policy nào (cùng mô hình với `chat_conversations`/`chat_messages`) — chỉ `getSupabaseAdmin()`
  phía server mới đọc/ghi được.

### Form báo giá (Supabase)

- [`app/api/quote/route.ts`](app/api/quote/route.ts): Route Handler `POST` nhận
  `{ name, country, educationLevel, servicePackage, email, phone }` từ form trang chủ, validate từng
  trường, **tính giá phía server** từ `servicePackages` trong `lib/mock-data.ts` (không tin giá do
  client gửi lên), lưu vào bảng `quote_requests` qua `ctx.supabaseAdmin`
  (`withSupabase({ auth: "none" })` — khách vãng lai chưa có auth). Muốn đổi bảng giá thì sửa `price`
  trong `servicePackages` — đó là nguồn giá duy nhất, dùng chung cho cả card hiển thị trên form lẫn
  giá server tính. Sau khi lưu thành công vào Supabase, route gọi `notifyQuoteWebhook()` (hàm nội bộ
  trong cùng file) để `POST` `{ name, email, servicePackage, price }` (tên gói ở dạng nhãn tiếng
  Việt, không phải id) tới webhook Make.com ở biến môi trường `QUOTE_WEBHOOK_URL` — hàm này trả về
  `true`/`false` dựa trên `res.ok` của webhook (bắt lỗi mạng thì cũng trả `false`), **không** ném lỗi
  nên không làm hỏng luồng báo giá của khách (khách vẫn nhận được giá dù webhook lỗi). Route trả về
  `{ price, emailSent }` cho client — `emailSent` phản ánh đúng kết quả gọi webhook ở trên.
  [`components/landing/quote-form.tsx`](components/landing/quote-form.tsx) dùng `emailSent` để hiển
  thị 1 trong 2 thông báo sau khi submit: gửi email thành công, hoặc đã ghi nhận yêu cầu nhưng gửi
  email thất bại (đội ngũ vẫn sẽ liên hệ trực tiếp) — **không** hiển thị "đã gửi email thành công"
  trừ khi webhook thực sự trả 200.
- [`quote_requests`](lib/database.types.ts): bảng Supabase lưu yêu cầu báo giá (dữ liệu khách hàng),
  RLS bật và không có policy nào — chỉ server (secret key) đọc/ghi được, cùng mô hình với các bảng
  chat. Cột `status` (`cho_duyet` mặc định / `da_duyet` / `tu_choi`) khớp type `RequestStatus`.
- [`app/api/admin/request-status/route.ts`](app/api/admin/request-status/route.ts): Route Handler
  `POST` nhận `{ requestId, status }` để admin đổi trạng thái một yêu cầu (cùng mô hình
  `auth: "none"` như `/api/admin/extract-lead` — chưa có auth cho `/admin/*`). Kích hoạt từ nút
  Duyệt/Từ chối trong [`components/admin/request-status-buttons.tsx`](components/admin/request-status-buttons.tsx)
  (client component, gọi `router.refresh()` sau khi lưu; nút của trạng thái hiện tại bị disable).
  Khi status đổi thành `da_duyet`, route gọi `notifyApprovalWebhook()` (hàm nội bộ trong cùng file)
  để `POST` `{ name, email, loginLink }` tới webhook Make.com ở biến môi trường
  `APPROVAL_WEBHOOK_URL` — `loginLink` hiện chỉ là link mẫu tới `NEXT_PUBLIC_SITE_URL` + `/login`
  (trang `/login` và magic link thật chưa làm, dự kiến Tuần 6), **chưa** dùng để đăng nhập thật. Lỗi
  gọi webhook chỉ log lại, không làm hỏng luồng duyệt của admin (không trả `emailSent` cho hành động
  này vì admin không cần biết kết quả gửi ngay trên UI).
- [`components/landing/quote-form.tsx`](components/landing/quote-form.tsx): client component chỉ gọi
  `/api/quote`, hiển thị giá server trả về (state `quotedPrice`), có loading/error state.
- [`app/admin/requests/page.tsx`](app/admin/requests/page.tsx): Server Component đọc danh sách yêu
  cầu báo giá trực tiếp từ Supabase qua `getSupabaseAdmin()` — không còn dùng mock
  `admissionRequests` (mảng này vẫn còn trong `lib/mock-data.ts` nhưng hiện không nơi nào dùng).

### Trường tham chiếu (bảng `schools`)

- [`schools`](lib/database.types.ts): bảng Supabase lưu trường tham chiếu (tên, quốc gia, GPA tối
  thiểu, IELTS tối thiểu). Khác các bảng còn lại: đây là dữ liệu **công khai** — RLS bật nhưng CÓ
  policy cho phép `select` với anon/authenticated; ghi (insert/update/delete) vẫn chỉ server làm
  được. Mảng mock `schools` trong `lib/mock-data.ts` không còn nơi nào dùng.
- [`lib/schools.ts`](lib/schools.ts): helper `getSchools()` đọc bảng này qua `getSupabaseAdmin()`
  và map về shape `School` (camelCase) mà các component dùng. Là nguồn duy nhất để đọc danh sách
  trường — [`app/admin/schools/page.tsx`](app/admin/schools/page.tsx),
  [`app/portal/page.tsx`](app/portal/page.tsx) (truyền xuống `SchoolMatch`) và trang công khai
  [`app/diem-chuan/page.tsx`](app/diem-chuan/page.tsx) ("Điểm chuẩn trường" trên menu chính +
  footer) đều gọi hàm này.
  Muốn thêm/sửa trường thì sửa trực tiếp trong bảng `schools` (SQL), chưa có UI ghi — nút
  Thêm/Sửa/Xoá ở `/admin/schools` vẫn là mock.
- [`scholarships`](lib/database.types.ts): bảng Supabase lưu học bổng theo từng trường
  (FK `school_id` → `schools`, xoá trường thì cascade). Cột `min_gpa`/`min_ielts` nullable —
  học bổng chỉ xét điều kiện nào có giá trị; `support` là text mô tả mức hỗ trợ. Cùng mô hình
  công khai với `schools`: RLS bật + policy cho `select`, ghi chỉ server làm được, sửa dữ liệu
  bằng SQL trực tiếp. Bảng này dành cho AI tra cứu khi gợi ý học bổng — xem mục "/portal" bên dưới.

### Cổng hồ sơ /portal (upload giấy tờ + Gemini trích xuất)

- Mô hình dữ liệu: mỗi trình duyệt = một hồ sơ demo, nhận diện bằng `sessionToken` (UUID trong
  `localStorage`, key `duhoc24_portal_session`) — cùng cách làm với chatbot, chờ auth thật ở Tuần 6.
  Bảng [`portal_profiles`](lib/database.types.ts) (1 dòng/hồ sơ) và
  [`portal_documents`](lib/database.types.ts) (1 dòng/loại giấy tờ/hồ sơ, unique
  `(profile_id, doc_type)`, nộp lại thì upsert ghi đè). Dữ liệu **riêng tư**: RLS bật, không có
  policy — chỉ `getSupabaseAdmin()` phía server đọc/ghi được. File gốc lưu trong bucket Storage
  `portal-documents` (private, 10MB, chỉ nhận PDF/JPG/PNG, không có storage policy).
- [`lib/document-extraction.ts`](lib/document-extraction.ts): nguồn duy nhất cho 3 loại giấy tờ
  (`PortalDocType`: `bang_diem` PDF / `ielts` ảnh / `tuy_than` ảnh), system instruction + JSON
  schema (structured output) cho Gemini theo từng loại, và `validateExtraction()` — kiểm tra hợp lệ
  bằng **code thường, không hỏi AI**: thiếu trường bắt buộc nào thì báo đích danh trường đó
  (`can_nop_lai` + `reason`). Chứng chỉ IELTS hết hạn vẫn được chấp nhận (`hop_le`) — không có quy
  tắc bắt buộc nộp lại vì hết hạn. Chứng chỉ IELTS trích cả `testDate` (ngày thi) lẫn `expiryDate`
  (ngày hết hạn — Gemini tự tính = ngày thi + 2 năm nếu chứng chỉ không ghi, chỉ để hiển thị cho
  học viên biết, không dùng để chặn nộp). Gemini chỉ làm nhiệm vụ đọc thông tin từ file (trường
  không đọc được → null); system instruction mô tả kỹ bố cục thực tế của từng loại giấy tờ (CCCD,
  CMND, hộ chiếu, Test Report Form IELTS, bảng điểm/học bạ) để giảm tình trạng trích thiếu trường.
- [`app/api/portal/documents/route.ts`](app/api/portal/documents/route.ts): Route Handler
  (`withSupabase({ auth: "none" })`, cùng mô hình các route khác). `POST` nhận
  `multipart/form-data { file, docType, sessionToken }`: validate loại/kích thước file, gọi Gemini
  (`gemini-3.5-flash-lite`, file gửi dạng `inline_data` base64), chạy `validateExtraction()`, upload
  file vào bucket rồi upsert `portal_documents`. `GET ?sessionToken=` trả lại giấy tờ đã nộp để
  hydrate trang khi mở lại.
- [`components/portal/portal-dashboard.tsx`](components/portal/portal-dashboard.tsx): client
  component điều phối toàn trang — chỉ gọi `/api/portal/documents`, không bao giờ gọi Supabase
  trực tiếp. Tính phần "Tình trạng hồ sơ" (còn thiếu gì / file nào cần nộp lại và vì sao) bằng code
  thường phía client từ danh sách giấy tờ. Các component con:
  [`document-upload-card.tsx`](components/portal/document-upload-card.tsx) (card upload từng loại,
  file `document-features.tsx` cũ đã xoá), [`extracted-info.tsx`](components/portal/extracted-info.tsx)
  (hiện đầy đủ thông tin trích xuất theo từng giấy tờ, trường thiếu hiện "—"),
  [`school-match.tsx`](components/portal/school-match.tsx) (luôn hiển thị danh sách điểm chuẩn
  các trường; chỉ khi có đủ GPA + IELTS từ giấy tờ `hop_le` mới đánh dấu thêm đạt/chưa đạt — IELTS
  hết hạn vẫn tính vì `hop_le` không còn xét hạn (xem `validateExtraction()` ở trên), chưa đủ điểm
  thì từng trường hiện icon trung tính; đạt/chưa đạt là phép so sánh số bằng code thường, không
  hỏi AI). Token phiên nằm trong
  [`portal-session.ts`](components/portal/portal-session.ts) — client component gọi
  `getPortalSessionToken()` trong event handler/effect, không giữ token trong state.
- Gợi ý học bổng bằng **function calling** của Gemini:
  [`lib/scholarship-suggestion.ts`](lib/scholarship-suggestion.ts) là nguồn duy nhất cho system
  instruction + khai báo công cụ `tra_cuu_hoc_bong` (tra học bổng theo tên trường).
  [`app/api/portal/scholarship-suggestions/route.ts`](app/api/portal/scholarship-suggestions/route.ts)
  (`POST { sessionToken }`) đọc lại điểm từ giấy tờ hợp lệ trong DB (không tin client), tính danh
  sách trường đạt/chưa đạt bằng code thường (cùng luật với `SchoolMatch`), rồi chạy vòng lặp
  function calling: Gemini TỰ quyết tra cứu trường nào, server chỉ thực thi truy vấn bảng
  `scholarships` khi được gọi (tối đa `MAX_TOOL_TURNS` vòng) — không viết cứng luật chọn học bổng.
  Kích hoạt từ nút trong [`scholarship-suggestion.tsx`](components/portal/scholarship-suggestion.tsx)
  (client, chỉ bật khi đã có bảng điểm + IELTS hợp lệ); kết quả không lưu DB, mỗi lần bấm gọi lại.

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
