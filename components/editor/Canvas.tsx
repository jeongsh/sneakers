'use client';

import { useState, useRef, useEffect } from 'react'

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef(null)
  const GRID_SIZE_SMALL = 20;
  const GRID_SIZE_BIG = 100;

  const [viewBox, setViewBox] = useState({
    x: 0,
    y: 0,
    w: 1920,
    h: 1080,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setViewBox(prev => ({
        ...prev,
        w: container.clientWidth,
        h: container.clientHeight,
      }));
    };

    // 초기 크기 설정
    updateSize();

    const svgElement = svgRef.current;
    if(!svgElement) return

    const onWheelZoomNative = (e: WheelEvent) => {
      e.preventDefault();
      console.log('휠 델타값 :', e.deltaY);
      console.log('현재 마우스 위치 :', e.clientX, e.clientY);
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      
    }

    (svgElement as SVGSVGElement).addEventListener('wheel', onWheelZoomNative, { passive: false });

    return () => {
      (svgElement as SVGSVGElement).removeEventListener('wheel', onWheelZoomNative);
    };
  }, [])


  return (
    <div ref={containerRef} className="w-full h-full bg-gray-100">
      <svg 
        ref={svgRef}
        className="w-full h-full"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      >
        {/* defs는 데이터만 갖고 있고 실제로 보여주지는 않는 영역 */}
        <defs>
          {/* 작은 격자 패턴 */}
          <pattern 
            id="smallGrid"
            width={GRID_SIZE_SMALL}
            height={GRID_SIZE_SMALL}
            patternUnits="userSpaceOnUse"
          >
            <path 
              d={`M ${GRID_SIZE_SMALL} 0 L 0 0 0 ${GRID_SIZE_SMALL}`}
              fill="none"
              stroke="#e0e0e0"
              strokeWidth="2"
            ></path>
          </pattern>
          {/* 큰 격자 패턴 */}
          <pattern 
            id="largeGrid"
            width={GRID_SIZE_BIG}
            height={GRID_SIZE_BIG}
            patternUnits="userSpaceOnUse"
          >
            {/* 큰 격자 안에 작은 격자를 넣기 */}
            <rect width={GRID_SIZE_BIG} height={GRID_SIZE_BIG} fill="url(#smallGrid)"/>
            {/* 큰 격자 선 */}
            <path 
              d={`M ${GRID_SIZE_BIG} 0 L 0 0 0 ${GRID_SIZE_BIG}`}
              fill="none"
              stroke="#999"
              strokeWidth="2"
            ></path>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#largeGrid)" />
        <circle cx="0" cy="0" r="10" fill="red" />
        <text x="15" y="20" fontSize="20" fill="red">Origin (0,0)</text>
      </svg>
    </div>
  )
}
