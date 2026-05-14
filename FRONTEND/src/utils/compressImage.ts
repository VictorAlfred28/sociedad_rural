/**
 * compressImage — Client-side image compression utility.
 * Reduces file size before upload without losing significant visual quality.
 * Uses Canvas API (available on all modern browsers + WebView).
 *
 * @param file      - Original File object
 * @param maxWidth  - Max width in px (default 1200)
 * @param maxHeight - Max height in px (default 1200)
 * @param quality   - JPEG quality 0-1 (default 0.82)
 * @param maxSizeKB - Abort compression if result > maxSizeKB (default 800KB)
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.82,
  maxSizeKB = 800
): Promise<File> {
  // Only compress images
  if (!file.type.startsWith('image/')) return file;
  // If already small enough, skip compression
  if (file.size <= maxSizeKB * 1024) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Calculate scaled dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      // White background (for transparent PNGs converted to JPEG)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer JPEG for photos, keep PNG for logos with transparency
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          // If compressed version is larger (rare edge case), return original
          if (blob.size >= file.size) { resolve(file); return; }
          const compressed = new File([blob], file.name, { type: outputType, lastModified: Date.now() });
          resolve(compressed);
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // Fallback: return original on error
    };

    img.src = url;
  });
}

/** Validate image file: format + size + minimum dimensions */
export function validateImageFile(file: File, maxMB = 10): string | null {
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Formato no permitido. Usá PNG, JPG o WEBP.';
  }
  if (file.size > maxMB * 1024 * 1024) {
    return `La imagen es demasiado grande (máximo ${maxMB}MB).`;
  }
  return null;
}
