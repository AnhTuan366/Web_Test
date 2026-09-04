import { AdminPageHeader } from "@/components/admin/page-header";
import { RequestStatusButtons } from "@/components/admin/request-status-buttons";
import { RequestStatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { servicePackages, type RequestStatus } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

const educationLevelLabels: Record<string, string> = {
  thpt: "THPT",
  dai_hoc: "Đại học",
  thac_si: "Thạc sĩ",
};

function formatVnd(value: number) {
  return value.toLocaleString("vi-VN") + "₫";
}

function packageLabel(id: string) {
  return servicePackages.find((p) => p.id === id)?.name ?? id;
}

function formatCreatedAt(isoDate: string) {
  return new Date(isoDate).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function getQuoteRequests() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("quote_requests")
    .select("id, name, country, education_level, service_package, price, email, phone, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Lỗi tải danh sách yêu cầu báo giá từ Supabase", error);
    return [];
  }
  return data;
}

export default async function AdminRequestsPage() {
  const requests = await getQuoteRequests();

  return (
    <>
      <AdminPageHeader
        title="Yêu cầu"
        description="Danh sách yêu cầu báo giá khách gửi từ form trên trang chủ."
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên khách</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Số điện thoại</TableHead>
              <TableHead>Quốc gia</TableHead>
              <TableHead>Bậc học</TableHead>
              <TableHead>Gói dịch vụ</TableHead>
              <TableHead>Báo giá</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Chưa có yêu cầu báo giá nào.
                </TableCell>
              </TableRow>
            )}
            {requests.map((req) => (
              <TableRow key={req.id}>
                <TableCell className="font-medium">{req.name}</TableCell>
                <TableCell>{req.email}</TableCell>
                <TableCell>{req.phone}</TableCell>
                <TableCell>{req.country}</TableCell>
                <TableCell>
                  {educationLevelLabels[req.education_level] ?? req.education_level}
                </TableCell>
                <TableCell>{packageLabel(req.service_package)}</TableCell>
                <TableCell>{formatVnd(req.price)}</TableCell>
                <TableCell>
                  <RequestStatusBadge status={req.status as RequestStatus} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatCreatedAt(req.created_at)}
                </TableCell>
                <TableCell>
                  <RequestStatusButtons
                    requestId={req.id}
                    status={req.status as RequestStatus}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
