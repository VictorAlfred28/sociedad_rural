import { useState } from 'react';

interface BlurImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderColor?: string;
}

/**
 * BlurImage — Progressive image loading with blur-up effect.
 * Renders a blurred placeholder while the full image loads, 
 * then fades in the HD version (Airbnb/Medium style).
 */
export default function BlurImage({ src, alt, className = '', placeholderColor = '#d6cfc0' }: BlurImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: placeholderColor }}>
      {/* Shimmer placeholder */}
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            background: `linear-gradient(90deg, ${placeholderColor} 25%, #ece7dc 50%, ${placeholderColor} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      )}

      {/* Full image with fade transition */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-500 ease-in-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
