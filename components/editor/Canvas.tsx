'use client';

import { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '@/store/useEditorSotre';

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  // state로 했더니 useEffect에서 클로저 때문에 값이 초기화 되지 않아서 ref로 변경
  // const [isPanning, setIsPanning] = useState(false);
  // const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const { rooms, addRoom } = useEditorStore();

  const GRID_SIZE_SMALL = 30;
  const GRID_SIZE_BIG = 150;

  const [viewBox, setViewBox] = useState({
    x: 0,
    y: 0,
    w: 1920,
    h: 1080,
  });

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // 드롭을 허용하기 위해 필수
      e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("presetType") as 'square' | 'l-shape';
      if (!type || !svgRef.current) return;

      // 1. 브라우저 상의 마우스 위치 추출
      const rect = svgRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      // 2. SVG viewBox 좌표계로 변환
      const svgX = viewBox.x + (clientX - rect.left) * (viewBox.w / rect.width);
      const svgY = viewBox.y + (clientY - rect.top) * (viewBox.h / rect.height);

      // 3. 격자 스냅 적용 (예: 20px 단위)
      const snappedX = Math.round(svgX / 20) * 20;
      const snappedY = Math.round(svgY / 20) * 20;

      // 4. 해당 위치에 방 생성 (addRoom 함수 수정 필요)
      addRoom(type, snappedX, snappedY);
    };

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

      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const rect = svgElement.getBoundingClientRect();
      console.log(viewBox.w * zoomFactor, viewBox.h * zoomFactor);

      setViewBox((prev) => {
        // 줌을 할때의 현재 마우스 위치를 svg 기준좌표로 변환
        const relativeMousePosition = {
          x: prev.x + (e.clientX - rect.left) * (prev.w / rect.width),
          y: prev.y + (e.clientY - rect.top) * (prev.h / rect.height)
        };
        
        // x,y는 현재 마우스 위치를 기준으로 줌을 할때의 새로운 좌표를 계산
        // w,h는 줌을 할때의 새로운 크기를 계산
        return {
          x: relativeMousePosition.x - (relativeMousePosition.x - prev.x) * zoomFactor,
          y: relativeMousePosition.y - (relativeMousePosition.y - prev.y) * zoomFactor,
          w: prev.w * zoomFactor,
          h: prev.h * zoomFactor,
        };
      });
    }

    const handleClickWheel = (e : MouseEvent) =>{
      if(e.button === 1){
        e.preventDefault()
        console.log('마우스 클릭');
        isPanningRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY};
      }
    }

    const handleMoveWheel = (e: MouseEvent) =>{
      if (!isPanningRef.current) return;
      // 마우스 포인터의 디자인을 변경
      svgElement.style.cursor = 'grabbing';
      // 마우스 이동 거리
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      
      // 화면의 1픽셀이 도면의 몇단위 인지 배율 계산
      const rect = svgElement.getBoundingClientRect();
      const scaleX = viewBox.w / rect.width
      const scaleY = viewBox.h / rect.height

      setViewBox((prev) => ({
        ...prev,
        x: prev.x - dx * scaleX,
        y: prev.y - dy * scaleY,
      }));
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }

    // 마우스 뗌
    const handleMouseUp = () => {
      isPanningRef.current = false;
      svgElement.style.cursor = 'auto';
    };

    svgElement.addEventListener('wheel', onWheelZoomNative, { passive: false });
    svgElement.addEventListener('mousedown', handleClickWheel);
    svgElement.addEventListener('mousemove', handleMoveWheel);
    svgElement.addEventListener('mouseup', handleMouseUp);
    return () => {
      svgElement.removeEventListener('wheel', onWheelZoomNative);
      svgElement.removeEventListener('mousedown', handleClickWheel);
      svgElement.removeEventListener('mousemove', handleMoveWheel);
      svgElement.removeEventListener('mouseup', handleMouseUp);
    };
  }, [])


  return (
    <div ref={containerRef} className="w-full h-full bg-[#F1F3F8]">
      <svg 
        ref={svgRef}
        className="w-full h-full"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
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
              stroke="#E6E7EC"
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
              stroke="#E1E2E7"
              strokeWidth="2"
            ></path>
          </pattern>
        </defs>
        <rect 
          x={viewBox.x} 
          y={viewBox.y} 
          width={viewBox.w} 
          height={viewBox.h} 
          fill="url(#largeGrid)" 
        />
        <circle cx="0" cy="0" r="10" fill="red" />
        <text x="15" y="20" fontSize="20" fill="red">Origin (0,0)</text>
        {rooms.map((room) => (
          <g key={room.id} transform={`translate(${room.x}, ${room.y})`}>
            <polygon
              points={room.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill={room.color}
              stroke="#4A90E2"
              strokeWidth="2"
              style={{ fillOpacity: 0.5 }}
            />
            <text x="10" y="25" fill="#4A90E2" className="font-bold select-none">
              {room.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
