"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocStatusBadge } from "@/components/status-badge";
import type { DocStatus } from "@/lib/mock-data";

interface DocumentUploadCardProps {
  icon: LucideIcon;
  title: string;
  accept: string; // giá trị cho thuộc tính accept của input file, ví dụ "application/pdf"
  acceptLabel: string; // mô tả hiển thị, ví dụ "Chấp nhận PDF"
  fileName: string | null;
  status: DocStatus;
  reason: string | null; // lý do cần nộp lại (server tính), hiển thị màu đỏ
  uploading: boolean;
  errorMessage: string | null; // lỗi khi gửi file (mạng, server...), khác với reason
  onSelectFile: (file: File) => void;
}

// Card upload cho 1 loại giấy tờ tại /portal: chọn file là nộp ngay (gọi từ portal-dashboard).
export function DocumentUploadCard({
  icon: Icon,
  title,
  accept,
  acceptLabel,
  fileName,
  status,
  reason,
  uploading,
  errorMessage,
  onSelectFile,
}: DocumentUploadCardProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div>
      <Card className="flex aspect-video flex-col items-center justify-center gap-2 border-none bg-foreground/5 p-6 shadow-none ring-0">
        <Icon className="size-7 text-muted-foreground" />
        <span className="max-w-full truncate px-4 text-xs text-muted-foreground">
          {fileName ?? "Chưa có file nào"}
        </span>
      </Card>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <DocStatusBadge status={uploading ? "dang_xu_ly" : status} />
        </div>

        <p className="mt-3 text-balance text-muted-foreground">
          {status === "can_nop_lai" && reason && !uploading ? (
            <>
              Cần nộp lại: <span className="text-red-600">{reason}</span>
            </>
          ) : (
            acceptLabel
          )}
        </p>
        {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSelectFile(file);
            // Reset để chọn lại cùng 1 file vẫn kích hoạt onChange
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          className="mt-3"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Đang đọc giấy tờ...
            </>
          ) : (
            <>
              <Upload className="size-4" />
              {status === "chua_nop" ? "Chọn file để nộp" : "Nộp lại file khác"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
