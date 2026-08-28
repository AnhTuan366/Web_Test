import { SiteHeader } from "@/components/site-header";
import { PortalDashboard } from "@/components/portal/portal-dashboard";
import { getSchools } from "@/lib/schools";

export const dynamic = "force-dynamic";

// Trang Server Component chỉ lo phần dữ liệu công khai (danh sách trường tham chiếu);
// toàn bộ phần hồ sơ riêng tư của học viên do PortalDashboard (client) gọi qua
// /api/portal/documents — trình duyệt không bao giờ truy cập Supabase trực tiếp.
export default async function PortalPage() {
  const schools = await getSchools();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-32">
        <PortalDashboard schools={schools} />
      </main>
    </>
  );
}
