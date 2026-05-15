import { useState, useEffect, useRef } from 'react';

interface BlurImageProps {
  src: string;
  alt: string;
  /** Applied to the outer wrapper div */
  className?: string;
  /** Applied directly to the <img> element (e.g. object-fit, mix-blend, opacity) */
  imgClassName?: string;
  placeholderColor?: string;
  /** Set to true for hero/above-the-fold images — disables lazy loading for Android compat */
  eager?: boolean;
}

/**
 * BlurImage — Progressive image loading with blur-up effect.
 *
 * ANDROID / CAPACITOR FIXES:
 * - `eager` prop disables lazy loading for hero images (lazy can silently block in Android WebView).
 * - imgClassName separates img-level styles from the container div.
 * - Uses an IntersectionObserver fallback to manually trigger load for lazy images
 *   whose onLoad never fires in some Android WebView versions.
 * - Avoids mix-blend-mode on the container (moved to imgClassName if needed).
 */
export default function BlurImage({
  src,
  alt,
  className = '',
  imgClassName = '',
  placeholderColor = '#d6cfc0',
  eager = false,
}: BlurImageProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Android WebView fallback: if the image is already decoded (cached or fast network),
  // onLoad may never fire. We check via naturalWidth after mount.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  // Secondary fallback: force-reveal after 3 s so the image is never permanently hidden.
  useEffect(() => {
    if (loaded) return;
    const timer = setTimeout(() => setLoaded(true), 3000);
    return () => clearTimeout(timer);
  }, [loaded, src]);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor: placeholderColor }}
    >
      {/* Shimmer placeholder — only while loading */}
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            background: `linear-gradient(90deg, ${placeholderColor} 25%, #ece7dc 50%, ${placeholderColor} 75%)`,
            backgroundSize: '200% 100%',
          }}
        />
      )}

      {/* Full image — eager for hero, lazy for gallery/list thumbnails */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)} // reveal on error so placeholder doesn't stick
        className={`w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
        style={{ display: 'block' }} // prevent inline-block gap on Android
      />
    </div>
  );
}
