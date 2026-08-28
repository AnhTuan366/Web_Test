"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, FileText, IdCard, LogOut, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentUploadCard } from "@/components/portal/document-upload-card";
import { getPortalSessionToken } from "@/components/portal/portal-session";
import { ExtractedInfo } from "@/components/portal/extracted-info";
import { ScholarshipSuggestion } from "@/components/portal/scholarship-suggestion";
import { SchoolMatch } from "@/components/portal/school-match";
import {
  MAX_UPLOAD_BYTES,
  docTypeAllowedMimes,
  docTypeLabels,
  portalDocTypes,
  type IdentityExtraction,
  type IeltsExtraction,
  type PortalDocType,
  type TranscriptExtraction,
} from "@/lib/document-extraction";
import type { School } from "@/lib/mock-data";

interface PortalDocument {
  docType: PortalDocType;
  fileName: string;
  status: "hop_le" | "can_nop_lai";
  reason: string | null;
  extracted: Record<string, unknown>;
  uploadedAt: string;
}

const uploadCardConfig = [
  {
    docType: "bang_diem" as const,
    icon: FileText,
    title: "Bảng điểm (PDF)",
    accept: "application/pdf",
    acceptLabel: "Chấp nhận PDF",
  },
  {
    docType: "ielts" as const,
    icon: Medal,
    title: "Ảnh chứng chỉ IELTS",
    accept: "image/jpeg,image/png",
    acceptLabel: "Chấp nhận JPG, PNG",
  },
  {
    docType: "tuy_than" as const,
    icon: IdCard,
    title: "Ảnh CMND/CCCD hoặc hộ chiếu",
    accept: "image/jpeg,image/png",
    acceptLabel: "Chấp nhận JPG, PNG",
  },
];

const fallbackUploadError = "Không gửi được file, kiểm tra kết nối rồi thử lại nhé.";

export function PortalDashboard({ schools }: { schools: School[] }) {
  const [docs, setDocs] = React.useState<Partial<Record<PortalDocType, PortalDocument>>>({});
  const [uploading, setUploading] = React.useState<Partial<Record<PortalDocType, boolean>>>({});
  const [uploadErrors, setUploadErrors] = React.useState<
    Partial<Record<PortalDocType, string | null>>
  >({});
  React.useEffect(() => {
    const sessionToken = getPortalSessionToken();

    // Nạp lại giấy tờ đã nộp từ database khi mở lại trang.
    fetch(`/api/portal/documents?sessionToken=${encodeURIComponent(sessionToken)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data?.documents)) return;
        const next: Partial<Record<PortalDocType, PortalDocument>> = {};
        for (const doc of data.documents as PortalDocument[]) {
          if (portalDocTypes.includes(doc.docType)) next[doc.docType] = doc;
        }
        setDocs(next);
      })
      .catch(() => {
        // Không tải được thì học viên vẫn nộp mới được như thường.
      });
  }, []);

  async function uploadDocument(docType: PortalDocType, file: File) {
    const sessionToken = getPortalSessionToken();
    if (uploading[docType]) return;

    // Kiểm tra nhanh phía client cho thân thiện — server vẫn kiểm tra lại đầy đủ.
    if (!docTypeAllowedMimes[docType].includes(file.type)) {
      const accepted = docType === "bang_diem" ? "PDF" : "JPG hoặc PNG";
      setUploadErrors((prev) => ({
        ...prev,
        [docType]: `${docTypeLabels[docType]} chỉ chấp nhận file ${accepted}.`,
      }));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadErrors((prev) => ({ ...prev, [docType]: "File vượt quá giới hạn 10MB." }));
      return;
    }

    setUploading((prev) => ({ ...prev, [docType]: true }));
    setUploadErrors((prev) => ({ ...prev, [docType]: null }));

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("docType", docType);
      formData.set("sessionToken", sessionToken);

      const res = await fetch("/api/portal/documents", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.document) {
        setDocs((prev) => ({ ...prev, [docType]: data.document as PortalDocument }));
      } else {
        setUploadErrors((prev) => ({
          ...prev,
          [docType]: typeof data?.error === "string" ? data.error : fallbackUploadError,
        }));
      }
    } catch {
      setUploadErrors((prev) => ({ ...prev, [docType]: fallbackUploadError }));
    } finally {
      setUploading((prev) => ({ ...prev, [docType]: false }));
    }
  }

  const transcript =
    docs.bang_diem ? (docs.bang_diem.extracted as unknown as TranscriptExtraction) : null;
  const ieltsDoc = docs.ielts ? (docs.ielts.extracted as unknown as IeltsExtraction) : null;
  const identity =
    docs.tuy_than ? (docs.tuy_than.extracted as unknown as IdentityExtraction) : null;

  // Chỉ lấy điểm từ giấy tờ HỢP LỆ để đối chiếu điểm chuẩn (giấy tờ cần nộp lại —
  // thiếu trường bắt buộc — không được tính).
  const gpa = docs.bang_diem?.status === "hop_le" ? (transcript?.gpa ?? null) : null;
  const ieltsOverall = docs.ielts?.status === "hop_le" ? (ieltsDoc?.overall ?? null) : null;

  const studentName = identity?.fullName ?? transcript?.fullName ?? null;

  // Tình trạng hồ sơ, tính bằng code thường: thiếu gì, file nào cần nộp lại và vì sao.
  const missingLabels = portalDocTypes
    .filter((docType) => !docs[docType])
    .map((docType) => docTypeLabels[docType]);
  const resubmitItems = portalDocTypes
    .map((docType) => docs[docType])
    .filter(
      (doc): doc is PortalDocument => doc !== undefined && doc.status === "can_nop_lai",
    );
  const isComplete = missingLabels.length === 0 && resubmitItems.length === 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div>
          <p className="text-sm text-muted-foreground">Xin chào,</p>
          <h1 className="text-2xl font-medium tracking-tight">
            {studentName ?? "Học viên DuHoc24"}
          </h1>
        </div>
        <Button variant="outline">
          <LogOut className="size-4" />
          Đăng xuất
        </Button>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Giấy tờ cần nộp</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nộp đủ 3 loại giấy tờ dưới đây, hệ thống sẽ tự trích xuất thông tin và đối chiếu điểm
          chuẩn giúp bạn.
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {uploadCardConfig.map((config) => {
            const doc = docs[config.docType];
            return (
              <DocumentUploadCard
                key={config.docType}
                icon={config.icon}
                title={config.title}
                accept={config.accept}
                acceptLabel={config.acceptLabel}
                fileName={doc?.fileName ?? null}
                status={doc?.status ?? "chua_nop"}
                reason={doc?.reason ?? null}
                uploading={uploading[config.docType] ?? false}
                errorMessage={uploadErrors[config.docType] ?? null}
                onSelectFile={(file) => uploadDocument(config.docType, file)}
              />
            );
          })}
        </div>
      </section>

      <section className="mt-12 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tình trạng hồ sơ</CardTitle>
          </CardHeader>
          <CardContent>
            {isComplete ? (
              <p className="flex items-start gap-2 text-sm text-green-700">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                Hồ sơ đã đủ 3 loại giấy tờ và tất cả đều hợp lệ.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {missingLabels.length > 0 && (
                  <li className="flex items-start gap-2 text-amber-700">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    Còn thiếu: {missingLabels.join(", ")}.
                  </li>
                )}
                {resubmitItems.map((doc) => (
                  <li key={doc.docType} className="flex items-start gap-2 text-red-600">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <span className="font-medium">{docTypeLabels[doc.docType]}</span> cần nộp
                      lại{doc.reason ? `: ${doc.reason}` : "."}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <ExtractedInfo transcript={transcript} ielts={ieltsDoc} identity={identity} />
        <SchoolMatch schools={schools} gpa={gpa} ielts={ieltsOverall} />
        <ScholarshipSuggestion ready={gpa !== null && ieltsOverall !== null} />
      </section>
    </>
  );
}
