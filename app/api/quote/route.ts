import { withSupabase } from "@supabase/server";
import { countries, servicePackages, type ServicePackage } from "@/lib/mock-data";
import type { Database } from "@/lib/database.types";

const EDUCATION_LEVELS = ["thpt", "dai_hoc", "thac_si"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\s.-]{8,20}$/;

function isServicePackage(value: unknown): value is ServicePackage {
  return servicePackages.some((pkg) => pkg.id === value);
}

// Báo cho hệ thống ngoài (Make.com) biết có yêu cầu báo giá mới — lỗi ở đây
// không được làm hỏng luồng báo giá của khách (vẫn trả giá bình thường), chỉ
// trả về true/false để client biết email xác nhận có gửi được hay không.
async function notifyQuoteWebhook(payload: {
  name: string;
  email: string;
  servicePackage: string;
  price: number;
}) {
  const webhookUrl = process.env.QUOTE_WEBHOOK_URL;
  if (!webhookUrl) return false;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (webhookError) {
    console.error("Lỗi gửi webhook yêu cầu báo giá", webhookError);
    return false;
  }
}

// Endpoint công khai cho khách vãng lai (chưa có hệ thống auth) — chỉ nhận và lưu
// yêu cầu báo giá, không đọc dữ liệu ra. Giá được tính phía server từ bảng giá
// trong lib/mock-data.ts, KHÔNG tin giá do trình duyệt gửi lên. Ghi vào bảng
// quote_requests qua ctx.supabaseAdmin (secret key) — RLS bật, không có policy,
// nên trình duyệt không thể đọc/ghi trực tiếp dữ liệu khách hàng này.
export const POST = withSupabase<Database>(
  { auth: "none", cors: "disabled" },
  async (request, ctx) => {
    const body = await request.json().catch(() => null);

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const country = typeof body?.country === "string" ? body.country.trim() : "";
    const educationLevel =
      typeof body?.educationLevel === "string" ? body.educationLevel : "";
    const servicePackage = body?.servicePackage;
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

    if (!name || name.length > 200) {
      return Response.json({ error: "Vui lòng nhập họ tên." }, { status: 400 });
    }
    if (!countries.includes(country)) {
      return Response.json({ error: "Vui lòng chọn quốc gia muốn du học." }, { status: 400 });
    }
    if (!(EDUCATION_LEVELS as readonly string[]).includes(educationLevel)) {
      return Response.json({ error: "Bậc học không hợp lệ." }, { status: 400 });
    }
    if (!isServicePackage(servicePackage)) {
      return Response.json({ error: "Gói dịch vụ không hợp lệ." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email) || email.length > 320) {
      return Response.json({ error: "Email liên hệ không hợp lệ." }, { status: 400 });
    }
    if (!PHONE_RE.test(phone)) {
      return Response.json({ error: "Số điện thoại không hợp lệ." }, { status: 400 });
    }

    const packageInfo = servicePackages.find((pkg) => pkg.id === servicePackage)!;
    const price = packageInfo.price;

    const { error } = await ctx.supabaseAdmin.from("quote_requests").insert({
      name,
      country,
      education_level: educationLevel,
      service_package: servicePackage,
      price,
      email,
      phone,
    });

    if (error) {
      console.error("Lỗi lưu yêu cầu báo giá vào Supabase", error);
      return Response.json({ error: "Không lưu được yêu cầu, thử lại sau." }, { status: 500 });
    }

    const emailSent = await notifyQuoteWebhook({
      name,
      email,
      servicePackage: packageInfo.name,
      price,
    });

    return Response.json({ price, emailSent });
  },
);
