import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { School } from "@/lib/mock-data";

interface SchoolMatchProps {
  schools: School[]; // danh sách trường tham chiếu thật, đọc từ bảng `schools` (Supabase)
  gpa: number | null; // điểm học tập từ bảng điểm HỢP LỆ (null nếu chưa có)
  ielts: number | null; // điểm tổng IELTS từ chứng chỉ HỢP LỆ (null nếu chưa có)
}

// Đối chiếu điểm của học viên với điểm chuẩn từng trường. Chỉ đối chiếu được khi
// đã có đủ điểm học tập + điểm IELTS từ giấy tờ hợp lệ.
export function SchoolMatch({ schools, gpa, ielts }: SchoolMatchProps) {
  const matches =
    gpa !== null && ielts !== null
      ? schools.map((school) => ({
          school,
          passed: gpa >= school.minGpa && ielts >= school.minIelts,
        }))
      : null;
  const canMatch = matches !== null;
  const passedCount = matches?.filter((m) => m.passed).length ?? 0;
  const summary =
    gpa !== null && ielts !== null
      ? `Với GPA ${gpa.toFixed(1)} và IELTS ${ielts.toFixed(1)}, bạn đạt yêu cầu ${passedCount}/${schools.length} trường.`
      : "So sánh điểm học tập và IELTS của bạn với điểm chuẩn từng trường.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đối chiếu điểm chuẩn</CardTitle>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!canMatch && (
          <p className="text-sm text-muted-foreground">
            Cần bảng điểm hợp lệ (để lấy điểm học tập) và chứng chỉ IELTS hợp lệ (để lấy điểm
            tổng) thì hệ thống mới đối chiếu được điểm chuẩn.
          </p>
        )}
        {canMatch && schools.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có trường tham chiếu nào.</p>
        )}
        {(matches ?? []).map(({ school, passed }) => (
          <div
            key={school.id}
            className={cn(
              "flex items-center justify-between gap-4 rounded-xl border p-4",
              passed ? "border-green-200 bg-green-50" : "border-border bg-muted/30",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  passed ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500",
                )}
              >
                {passed ? <Check className="size-4" /> : <X className="size-4" />}
              </span>
              <div>
                <p className="font-medium">{school.name}</p>
                <p className="text-sm text-muted-foreground">{school.country}</p>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Yêu cầu GPA ≥ {school.minGpa.toFixed(1)}</p>
              <p>IELTS ≥ {school.minIelts.toFixed(1)}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
