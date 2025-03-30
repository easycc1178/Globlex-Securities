import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SimpleImageSliderProps {
  images: string[];
  autoSlideInterval?: number;
  className?: string;
}

export default function SimpleImageSlider({ 
  images, 
  autoSlideInterval = 5000, 
  className = ""
}: SimpleImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Auto slide effect
  useEffect(() => {
    if (images.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, autoSlideInterval);
    
    return () => clearInterval(interval);
  }, [images.length, autoSlideInterval]);

  // Preload all images at start and current image when changing
  useEffect(() => {
    // Preload all images initially
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [images]);

  // Handle loading state for current image
  useEffect(() => {
    setIsLoading(true);
    
    // Use a timeout to avoid flickering
    const loadingTimeout = setTimeout(() => {
      const img = new Image();
      const imageSrc = images[currentIndex];
      
      // Add cache busting parameter if one doesn't exist
      const src = imageSrc.includes('?') ? imageSrc : `${imageSrc}?t=${Date.now()}`;
      img.src = src;
      
      img.onload = () => setIsLoading(false);
      img.onerror = () => {
        console.error(`Failed to load image: ${src}`);
        setIsLoading(false);
      };
    }, 100);
    
    return () => clearTimeout(loadingTimeout);
  }, [currentIndex, images]);

  if (images.length === 0) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center`}>
        <p className="text-gray-500">ไม่มีรูปภาพ</p>
      </div>
    );
  }

  // Function to navigate to next slide
  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  // Function to navigate to previous slide
  const prevSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="h-10 w-10 border-4 border-t-primary rounded-full animate-spin"></div>
        </div>
      )}
      
      {/* Current Image */}
      <img 
        src={images[currentIndex].includes('?') ? images[currentIndex] : `${images[currentIndex]}?t=${Date.now()}`} 
        alt={`Slide ${currentIndex + 1}`} 
        className="w-full h-full object-cover rounded-lg"
        onError={(e) => {
          // If image fails to load, add fallback and retry
          console.log(`Retrying image load for ${currentIndex}`);
          const target = e.target as HTMLImageElement;
          if (!target.src.includes('retry=true')) {
            target.src = `${images[currentIndex]}?retry=true&t=${Date.now()}`;
          }
        }}
      />
      
      {/* Navigation Controls - Only show if more than one image */}
      {images.length > 1 && (
        <>
          <button 
            onClick={prevSlide}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-2 backdrop-blur-sm transition"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6 text-white drop-shadow-md" />
          </button>
          
          <button 
            onClick={nextSlide}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-2 backdrop-blur-sm transition"
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6 text-white drop-shadow-md" />
          </button>
          
          {/* Indicator dots */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-2 w-2 rounded-full transition ${
                  index === currentIndex ? 'bg-white' : 'bg-white/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}