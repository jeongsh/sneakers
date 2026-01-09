'use client';

import { useState, useRef, useEffect } from 'react'
import { FloorObject, RoomPreset, useEditorStore } from '@/store/useEditorSotre';

export default function Canvas() {
  const { objects, selectedObject, addRoom, setObjects, setSelectedObject } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  
  // 드래그 상태 관리 (어떤 오브젝트를 드래그 중인지)
  const draggingObjectRef = useRef<FloorObject | null>(null);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  
  // state로 했더니 useEffect에서 클로저 때문에 값이 초기화 되지 않아서 ref로 변경
  // const [isPanning, setIsPanning] = useState(false);
  // const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const GRID_SIZE_SMALL = 30;
  const GRID_SIZE_BIG = 150;
  const DRAG_SIZE_OFFSET = 3;

  const [viewBox, setViewBox] = useState({
    x: 0,
    y: 0,
    w: 1920,
    h: 1080,
  });

  // 마우스 좌표 > SVG 좌표 변환 함수
  const clientToSvg = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: viewBox.x + (clientX - rect.left) * (viewBox.w / rect.width),
      y: viewBox.y + (clientY - rect.top) * (viewBox.h / rect.height),
    };
  };

  // 오브젝트 드래그 시 커서모양 변경
  const handleObjectDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // 드롭을 허용하기 위해 필수
    e.dataTransfer.dropEffect = "move";
  };

  // 오브젝트 드래그 시 드롭 이벤트 처리
  const handleObjectDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const preset = e.dataTransfer.getData("presetType") as RoomPreset;
    if (!preset || !svgRef.current) return;

    // SVG viewBox 좌표계로 변환
    const { x: svgX, y: svgY } = clientToSvg(e.clientX, e.clientY);

    // 격자 스냅 적용
    const snappedX = Math.round(svgX / DRAG_SIZE_OFFSET) * DRAG_SIZE_OFFSET;
    const snappedY = Math.round(svgY / DRAG_SIZE_OFFSET) * DRAG_SIZE_OFFSET;

    // 해당 위치에 방 생성 (TODO: 다른 타입도 지원 필요)
    addRoom(preset, snappedX, snappedY);
  };

  // 오브젝트 클릭 시 드래그 시작
  const handleObjectMouseDown = (e: React.MouseEvent, obj: FloorObject) => {
    if (e.buttons !== 1) return;
    e.stopPropagation(); // 캔버스 패닝 방지
    
    draggingObjectRef.current = obj;
    setSelectedObject(obj);
    
    // 드래그 시작 시점의 마우스 위치 저장 (오브젝트 내부에서 클릭한 오프셋)
    const svgPos = clientToSvg(e.clientX, e.clientY);
    dragStartPosRef.current = {
      x: svgPos.x - obj.x,
      y: svgPos.y - obj.y,
    };
  };

  // 마우스 이동 시 오브젝트 위치 업데이트
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingObjectRef.current || e.buttons !== 1) return;

    const svgPos = clientToSvg(e.clientX, e.clientY);
    
    // 새 위치 계산 (클릭 오프셋 반영)
    const newX = svgPos.x - dragStartPosRef.current.x;
    const newY = svgPos.y - dragStartPosRef.current.y;
    
    // 격자 스냅
    const snappedX = Math.round(newX / DRAG_SIZE_OFFSET) * DRAG_SIZE_OFFSET;
    const snappedY = Math.round(newY / DRAG_SIZE_OFFSET) * DRAG_SIZE_OFFSET;

    setObjects(objects.map(obj => 
      obj.id === draggingObjectRef.current!.id 
        ? { ...obj, x: snappedX, y: snappedY } 
        : obj
    ));
    setIsDragging(true);
  };

  // 마우스 떼면 드래그 종료
  const handleMouseUp = () => {
    draggingObjectRef.current = null;
    setIsDragging(false);
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
      // console.log(viewBox.w * zoomFactor, viewBox.h * zoomFactor);

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
    const handleMouseUpNative = () => {
      isPanningRef.current = false;
      svgElement.style.cursor = 'auto';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete') {
        // state로 하니까 클로져 때문에 또 안됨, zustand에 스테이트 값이 있어서 스테이트 값을 zustand에서 가져오기
        const { selectedObject, objects, setObjects, setSelectedObject } = useEditorStore.getState();
        if (selectedObject) {
          setObjects(objects.filter(obj => obj.id !== selectedObject.id));
          setSelectedObject(null);
        }
      }
    }
    
    const handleClickObjectOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      
      // 클릭한 요소가 object 내부인지 확인 (g 태그나 그 자식들)
      const clickedObject = target.closest('g[id]');
      
      // object가 아닌 곳을 클릭했으면 선택 해제
      if (!clickedObject) {
        const { setSelectedObject } = useEditorStore.getState();
        setSelectedObject(null);
      }
    }
    // svg에서 드래그가 잘 안된다고 해서 마우스 이벤트로 직접 처리
    svgElement.addEventListener('wheel', onWheelZoomNative, { passive: false });
    svgElement.addEventListener('mousedown', handleClickWheel);
    svgElement.addEventListener('mousemove', handleMoveWheel);
    svgElement.addEventListener('mouseup', handleMouseUpNative);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClickObjectOutside);
    
    return () => {
      svgElement.removeEventListener('wheel', onWheelZoomNative);
      svgElement.removeEventListener('mousedown', handleClickWheel);
      svgElement.removeEventListener('mousemove', handleMoveWheel);
      svgElement.removeEventListener('mouseup', handleMouseUpNative);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClickObjectOutside);
    };
  }, [])


  return (
    <div ref={containerRef} className="w-full h-full bg-[#F1F3F8]">
      <pre style={{ 
        position: 'fixed', 
        top: 10, 
        right: 10, 
        background: '#1e1e1e', 
        color: '#fff',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '12px',
        maxWidth: '300px',
        overflow: 'auto'
      }}>
        {JSON.stringify(selectedObject, null, 2)}
      </pre>
      <svg 
        ref={svgRef}
        className="w-full h-full"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onDragOver={handleObjectDragOver}
        onDrop={handleObjectDrop}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
        
        {/* 선택한 오브젝트를 가장 위에 랜더링 하려고 했는데 svg에서는 z-index가 안돼서 태그 순서를 변경 */}
        {[...objects].sort((a, b) => {
          // 선택된 오브젝트를 맨 뒤로 (가장 위에 렌더링)
          if (a.id === selectedObject?.id) return 1;
          if (b.id === selectedObject?.id) return -1;
          return 0;
        }).map((obj) => (
          <g 
            id={obj.id}
            key={obj.id} 
            transform={`translate(${obj.x}, ${obj.y})`} 
            onMouseDown={(e) => handleObjectMouseDown(e, obj)}
            style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
          >
            <polygon
              points={obj.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill={obj.color}
              stroke={selectedObject?.id === obj.id ? 'blue' : 'black'}
              strokeWidth="3"
              style={{ fillOpacity: 0.5}}
            />
            <text x="10" y="25" fill="#4A90E2" className="font-bold select-none">
              {obj.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
