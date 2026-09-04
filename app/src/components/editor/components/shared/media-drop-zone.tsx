import { useCallback, useRef, useState } from "react";
import { Upload, Loader2, CloudUpload, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const MAX_MEDIA_UPLOADS = 10;
export const FILE_UPLOAD_LIMIT_MB = 100;

/** Categorize a file by its MIME type / extension */
export function getMediaType(file: File): 'image' | 'video' | 'audio' | 'unknown' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) return 'audio';
  return 'unknown';
}

/** Format MB for display: e.g. 50 → "50 MB", 1024 → "1 GB" */
export function formatSizeLimit(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
  return `${mb} MB`;
}

interface MediaDropZoneProps {
  accept: string;
  label?: string;
  onFileSelected: (file: File) => void;
  onFilesSelected?: (files: File[]) => void;
  /** Max size in MB — defaults to FILE_UPLOAD_LIMIT_MB */
  maxSizeMB?: number;
  isLoading?: boolean;
  multiple?: boolean;
  /** Called when a file exceeds the limit so the parent can show a toast */
  onOverLimit?: (filename: string, fileSizeMb: number, limitMb: number) => void;
  /** Optional label shown in the drop zone, e.g. "50 MB · Hobby" */
  sizeLabel?: string;
}

export const MediaDropZone: React.FC<MediaDropZoneProps> = ({
  accept,
  label = "Drop or browse",
  onFileSelected,
  onFilesSelected,
  maxSizeMB = FILE_UPLOAD_LIMIT_MB,
  isLoading = false,
  multiple = false,
  onOverLimit,
  sizeLabel,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverLimit, setDragOverLimit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const valid: File[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const fileSizeMb = file.size / 1024 / 1024;
        if (maxSizeMB && fileSizeMb > maxSizeMB) {
          onOverLimit?.(file.name, Math.round(fileSizeMb), maxSizeMB);
          continue;
        }
        valid.push(file);
      }
      if (multiple && onFilesSelected && valid.length > 0) {
        onFilesSelected(valid);
      } else if (valid.length > 0) {
        onFileSelected(valid[0]);
      }
    },
    [onFileSelected, onFilesSelected, maxSizeMB, multiple, onOverLimit]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      setDragOverLimit(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
      // Check if any dragged file exceeds the limit
      if (maxSizeMB && e.dataTransfer.items) {
        let hasOverLimit = false;
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];
          // File.size is not available during dragover — just show active state
          if (item.kind === "file") hasOverLimit = false;
        }
        setDragOverLimit(hasOverLimit);
      }
    },
    [maxSizeMB]
  );

  const onDragLeave = useCallback(() => {
    setIsDragOver(false);
    setDragOverLimit(false);
  }, []);

  const displaySizeLabel = sizeLabel ?? `up to ${formatSizeLimit(maxSizeMB)}`;

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => !isLoading && inputRef.current?.click()}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1.5 px-3 py-4 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-150 select-none",
        isLoading
          ? "cursor-default opacity-80 border-border"
          : dragOverLimit
          ? "border-destructive bg-destructive/5"
          : isDragOver
          ? "border-primary bg-primary/10 scale-[1.01]"
          : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          e.target.value = "";
        }}
        disabled={isLoading}
      />

      {/* Icon */}
      <div className={cn(
        "flex items-center justify-center rounded-full w-8 h-8 transition-colors",
        isLoading
          ? "bg-muted"
          : isDragOver
          ? "bg-primary/20"
          : "bg-muted/60"
      )}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : isDragOver ? (
          <CloudUpload className="h-4 w-4 text-primary" />
        ) : (
          <Upload className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Label */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs font-medium text-muted-foreground">
          {isLoading ? "Uploading..." : label}
        </span>

        {/* Size limit badge — hide during loading or when label is empty */}
        {!isLoading && displaySizeLabel && (
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full border transition-colors",
            isDragOver
              ? "border-primary/30 text-primary/70 bg-primary/5"
              : "border-border/60 text-muted-foreground/50 bg-transparent"
          )}>
            {displaySizeLabel}
          </span>
        )}
      </div>

      {/* Drag-over-limit overlay */}
      {dragOverLimit && (
        <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-destructive/10 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-destructive text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            File too large
          </div>
        </div>
      )}
    </div>
  );
};
