/**
 * Client-side image compression helper (Trick #1: Compress Images).
 * Downscales oversized receipt/evidence uploads before Base64 or multipart transmission,
 * preserving alpha channels via WebP when supported and falling back gracefully.
 */

const DEFAULT_OPTIONS = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.82,
  mimeType: "image/webp",
};

const loadImageElement = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });

const canvasToBlob = (canvas, mimeType, quality) =>
  new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      mimeType,
      quality,
    );
  });

/**
 * Compress an uploaded image File/Blob cleanly on the client before network transfer.
 * Non-image files (e.g. PDFs) or SVGs are returned untouched.
 */
export const compressImageFile = async (file, options = {}) => {
  if (!file || typeof file.type !== "string" || !file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  const { maxWidth, maxHeight, quality, mimeType } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  try {
    const img = await loadImageElement(file);
    const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
    const targetWidth = Math.max(1, Math.round(img.width * scale));
    const targetHeight = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    let compressed = await canvasToBlob(canvas, mimeType, quality);
    let finalType = mimeType;

    // Fallback to JPEG if browser canvas fails to produce requested WebP blob
    if (!compressed || compressed.type !== mimeType) {
      compressed = await canvasToBlob(canvas, "image/jpeg", quality);
      finalType = "image/jpeg";
    }

    if (!compressed || compressed.size >= file.size) {
      return file;
    }

    const ext = finalType === "image/webp" ? ".webp" : ".jpg";
    const baseName = (file.name || "upload").replace(/\.[^/.]+$/, "");
    return new File([compressed], `${baseName}${ext}`, {
      type: finalType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
};

export default compressImageFile;

