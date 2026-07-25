import React, { useEffect, useRef, useState } from 'react';

export default function AnimatedNumber({ value, duration = 800, format, className = '' }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef(null);
  const startRef = useRef(null);
  const changedRef = useRef(false);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    changedRef.current = true;
    setTimeout(() => { changedRef.current = false; }, 300);

    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = null;

    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = to;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  const formatted = format ? format(display) : display.toLocaleString();

  return (
    <span className={`animated-number ${changedRef.current ? 'animated-number-pulse' : ''} ${className}`}>
      {formatted}
    </span>
  );
}
