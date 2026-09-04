/**
 * Local media probing.
 *
 * Ported from `utils/media-upload.ts`, with the server upload removed. The
 * browser still does the work it always did: read duration, draw a thumbnail.
 */

export type ProbedKind = "video" | "image" | "audio";

export function kindFromMime(mime: string): ProbedKind | null {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

export async function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
      return;
    }

    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      const objectUrl = URL.createObjectURL(file);
      const timeoutId = setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        resolve("");
      }, 5000);

      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, video.duration / 2);
      };
      video.onseeked = () => {
        clearTimeout(timeoutId);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 180;
          canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        } catch {
          resolve("");
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      video.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);
        resolve("");
      };
      video.src = objectUrl;
      return;
    }

    resolve("");
  });
}

export async function getMediaDuration(file: File): Promise<number | undefined> {
  if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) return undefined;

  return new Promise((resolve) => {
    const media = file.type.startsWith("audio/")
      ? document.createElement("audio")
      : document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      resolve(undefined);
    }, 5000);

    media.preload = "metadata";
    media.onloadedmetadata = () => {
      clearTimeout(timeoutId);
      const value = isFinite(media.duration) ? media.duration : undefined;
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };
    media.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
      resolve(undefined);
    };
    media.src = objectUrl;
  });
}

export async function getImageSize(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith("image/")) return {};
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(objectUrl);
      resolve(size);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({});
    };
    img.src = objectUrl;
  });
}
