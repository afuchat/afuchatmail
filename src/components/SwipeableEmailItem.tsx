import { useState, useRef, useCallback } from "react";
import { Archive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeableEmailItemProps {
  children: React.ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  leftLabel?: string;
  rightLabel?: string;
}

export const SwipeableEmailItem = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel = "Delete",
  rightLabel = "Archive",
}: SwipeableEmailItemProps) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isVertical = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const threshold = 100;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
    isVertical.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const diffX = e.touches[0].clientX - startX.current;
    const diffY = e.touches[0].clientY - startY.current;

    // Detect scroll vs swipe on first significant move
    if (Math.abs(diffX) < 5 && Math.abs(diffY) < 5) return;
    if (!isVertical.current && Math.abs(diffY) > Math.abs(diffX)) {
      isVertical.current = true;
      isDragging.current = false;
      return;
    }

    // Dampen the swipe
    const dampened = diffX * 0.5;
    setOffset(dampened);
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (offset > threshold) {
      onSwipeRight();
    } else if (offset < -threshold) {
      onSwipeLeft();
    }
    setOffset(0);
  }, [offset, onSwipeLeft, onSwipeRight]);

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      {/* Left background (swipe right = archive) */}
      <div className={cn(
        "absolute inset-y-0 left-0 flex items-center px-5 transition-opacity",
        offset > 30 ? "opacity-100" : "opacity-0",
        "bg-green-500"
      )} style={{ width: Math.max(Math.abs(offset), 0) }}>
        <Archive className="h-5 w-5 text-white" />
      </div>

      {/* Right background (swipe left = delete) */}
      <div className={cn(
        "absolute inset-y-0 right-0 flex items-center justify-end px-5 transition-opacity",
        offset < -30 ? "opacity-100" : "opacity-0",
        "bg-destructive"
      )} style={{ width: Math.max(Math.abs(offset), 0) }}>
        <Trash2 className="h-5 w-5 text-white" />
      </div>

      {/* Content */}
      <div
        className="relative bg-card transition-transform"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging.current ? "none" : "transform 0.2s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};