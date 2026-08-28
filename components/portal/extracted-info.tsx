import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDateVi,
  type IdentityExtraction,
  type IeltsExtraction,
  type TranscriptExtraction,
} from "@/lib/document-extraction";

interface ExtractedInfoProps {
  transcript: TranscriptExtraction | null;
  ielts: IeltsExtraction | null;
  identity: IdentityExtraction | null;
}

function formatScore(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(1) : null;
}

function formatDate(value: string | null | undefined) {
  return value ? formatDateVi(value) : null;
}

function FieldGrid({ fields }: { fields: { label: string; value: string | null }[] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <div key={field.label} className="rounded-lg bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">{field.label}</dt>
          <dd className="mt-1 text-base font-medium">
            {field.value ?? <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Hiển thị toàn bộ thông tin Gemini đọc được từ từng loại giấy tờ đã nộp.
// Trường không đọc được (null) hiển thị "—".
export function ExtractedInfo({ transcript, ielts, identity }: ExtractedInfoProps) {
  const hasAnyDoc = Boolean(transcript || ielts || identity);

  const sections = [
    transcript && {
      title: "Từ bảng điểm",
      fields: [
        { label: "Họ tên", value: transcript.fullName },
        { label: "Ngày sinh", value: formatDate(transcript.dateOfBirth) },
        { label: "Điểm học tập (GPA)", value: formatScore(transcript.gpa) },
      ],
    },
    ielts && {
      title: "Từ chứng chỉ IELTS",
      fields: [
        { label: "Họ tên trên chứng chỉ", value: ielts.fullName },
        { label: "Nghe", value: formatScore(ielts.listening) },
        { label: "Đọc", value: formatScore(ielts.reading) },
        { label: "Viết", value: formatScore(ielts.writing) },
        { label: "Nói", value: formatScore(ielts.speaking) },
        { label: "Điểm tổng", value: formatScore(ielts.overall) },
        { label: "Hết hạn ngày", value: formatDate(ielts.expiryDate) },
      ],
    },
    identity && {
      title: "Từ CMND/CCCD/hộ chiếu",
      fields: [
        { label: "Họ tên", value: identity.fullName },
        { label: "Ngày sinh", value: formatDate(identity.dateOfBirth) },
        { label: "Số giấy tờ", value: identity.documentNumber },
      ],
    },
  ].filter((section) => section !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin đã trích xuất</CardTitle>
        <p className="text-sm text-muted-foreground">
          Đây là thông tin đọc được từ giấy tờ bạn đã nộp, kiểm tra lại xem có đúng không nhé.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasAnyDoc && (
          <p className="text-sm text-muted-foreground">
            Chưa có giấy tờ nào được nộp — nộp giấy tờ ở trên để hệ thống trích xuất thông tin.
          </p>
        )}
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">{section.title}</h3>
            <FieldGrid fields={section.fields} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
