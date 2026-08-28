import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSchools } from "@/lib/schools";

export const dynamic = "force-dynamic";

// Trang công khai "Điểm chuẩn trường": hiển thị điểm chuẩn các trường tham chiếu từ
// bảng `schools` (Supabase, dữ liệu công khai) — cùng nguồn với /admin/schools và
// phần đối chiếu điểm chuẩn ở /portal.
export default async function DiemChuanPage() {
  const schools = await getSchools();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-32">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-medium tracking-tight">Điểm chuẩn trường</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Điểm học tập (GPA thang 10) và điểm IELTS tối thiểu của các trường DuHoc24 đang
            tham chiếu. Nộp giấy tờ tại Cổng hồ sơ để hệ thống tự đối chiếu điểm của bạn với
            từng trường.
          </p>
        </div>

        <Card className="mt-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên trường</TableHead>
                <TableHead>Quốc gia</TableHead>
                <TableHead>Điểm học tập tối thiểu</TableHead>
                <TableHead>Điểm IELTS tối thiểu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Chưa có trường tham chiếu nào.
                  </TableCell>
                </TableRow>
              )}
              {schools.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">{school.name}</TableCell>
                  <TableCell>{school.country}</TableCell>
                  <TableCell>{school.minGpa.toFixed(1)}</TableCell>
                  <TableCell>{school.minIelts.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="mt-8 flex justify-center">
          <Button render={<Link href="/portal" />} nativeButton={false}>
            Đối chiếu điểm của bạn tại Cổng hồ sơ
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
