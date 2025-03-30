import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageSliderProps {
  images: string[];
  autoSlideInterval?: number; // ms
  className?: string;
}

export default function ImageSlider({ 
  images, 
  autoSlideInterval = 5000, 
  className = ""
}: ImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState<boolean[]>(Array(images.length).fill(false));
  const [isPaused, setIsPaused] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLImageElement | null)[]>(Array(images.length).fill(null));
  
  // Preload images for better performance
  useEffect(() => {
    // Preload current image and next image
    const preloadImages = () => {
      const currentImg = new Image();
      currentImg.src = images[currentIndex];
      
      const nextIndex = (currentIndex + 1) % images.length;
      const nextImg = new Image();
      nextImg.src = images[nextIndex];
    };
    
    preloadImages();
  }, [currentIndex, images]);
  
  // Track which images are loaded
  const handleImageLoad = useCallback((index: number) => {
    console.log(`Image ${index} loaded successfully`);
    setImagesLoaded(prev => {
      const newState = [...prev];
      newState[index] = true;
      return newState;
    });
  }, []);
  
  const goToNext = useCallback(() => {
    setCurrentIndex(prevIndex => (prevIndex + 1) % images.length);
  }, [images.length]);
  
  const goToPrevious = useCallback(() => {
    setCurrentIndex(prevIndex => (prevIndex - 1 + images.length) % images.length);
  }, [images.length]);
  
  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < images.length) {
      setCurrentIndex(index);
    }
  }, [images.length]);
  
  // Handle automatic sliding
  useEffect(() => {
    if (!isPaused && images.length > 1) {
      const intervalId = setInterval(goToNext, autoSlideInterval);
      return () => clearInterval(intervalId);
    }
    return undefined;
  }, [goToNext, autoSlideInterval, isPaused, images.length]);
  
  // Reset loaded state when images change
  useEffect(() => {
    setImagesLoaded(Array(images.length).fill(false));
    imageRefs.current = Array(images.length).fill(null);
  }, [images]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === sliderRef.current || 
          sliderRef.current?.contains(document.activeElement)) {
        if (e.key === 'ArrowLeft') {
          goToPrevious();
        } else if (e.key === 'ArrowRight') {
          goToNext();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrevious]);

  // Handle touch events for mobile swipe
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true); // Pause auto-sliding during touch
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  
  const handleTouchEnd = () => {
    // Determine swipe direction
    const difference = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50; // Minimum swipe distance in pixels
    
    if (difference > minSwipeDistance) {
      // Swiped left, go to next
      goToNext();
    } else if (difference < -minSwipeDistance) {
      // Swiped right, go to previous
      goToPrevious();
    }
    
    // Reset values
    touchStartX.current = 0;
    touchEndX.current = 0;
    
    // Resume auto-sliding after touch
    setTimeout(() => setIsPaused(false), 1000);
  };
  
  // Safety check for empty images array
  if (images.length === 0) {
    return <div className={`${className} bg-gray-100 rounded-xl flex items-center justify-center`}>
      <p className="text-gray-500">ไม่มีรูปภาพสำหรับแสดง</p>
    </div>;
  }
  
  return (
    <div 
      ref={sliderRef}
      className={`relative overflow-hidden rounded-xl ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
    >
      {/* Full-page loading indicator */}
      {!imagesLoaded.some(loaded => loaded) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-30">
          <div className="h-10 w-10 border-4 border-t-primary rounded-full animate-spin"></div>
        </div>
      )}
      
      {/* Slider container with absolute positioning for fade transitions */}
      <div className="w-full h-full">
        {images.map((image, index) => (
          <div 
            key={index} 
            className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
              index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <img 
              ref={el => imageRefs.current[index] = el}
              src={image} 
              alt={`ภาพสไลด์ ${index + 1}`} 
              className="w-full h-full object-cover"
              onLoad={() => handleImageLoad(index)}
              onError={(e) => {
                console.error(`Failed to load image: ${image}`);
                e.currentTarget.src = "/img/logo.png"; // Fallback to logo if image fails to load
              }}
              loading={index === currentIndex || index === (currentIndex + 1) % images.length ? "eager" : "lazy"}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40"></div>
          </div>
        ))}
      </div>
      
      {/* Navigation arrows - only show if more than one image */}
      {images.length > 1 && (
        <>
          <button 
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-2 backdrop-blur-sm transition z-20"
            aria-label="ภาพก่อนหน้า"
          >
            <ChevronLeft className="h-6 w-6 text-white drop-shadow-md" />
          </button>
          
          <button 
            onClick={goToNext}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-2 backdrop-blur-sm transition z-20"
            aria-label="ภาพถัดไป"
          >
            <ChevronRight className="h-6 w-6 text-white drop-shadow-md" />
          </button>
          
          {/* Dots indicator */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === currentIndex 
                    ? 'bg-white w-4' 
                    : 'bg-white/50 hover:bg-white/80'
                }`}
                aria-label={`ไปที่ภาพสไลด์ ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
      
      {/* Pause indicator - only shown when hovering */}
      {isPaused && images.length > 1 && (
        <div className="absolute top-2 right-2 bg-black/30 rounded-full p-1 text-xs text-white backdrop-blur-sm z-20">
          หยุดชั่วคราว
        </div>
      )}
    </div>
  );
}