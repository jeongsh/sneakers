'use client';

import { useState, useRef, useEffect } from 'react'
import { FloorObject, Point, RoomPreset, DoorPreset, useEditorStore } from '@/store/useEditorSotre';
import { FLOOR_PLAN_CONFIG, pxToCm } from '@/lib/floorPlanConstants';

// 변 드래그할 때 필요한 정보 담아두려고 만든 인터페이스
interface DraggingEdge {
  obj: FloorObject;      // 지금 드래그하는 오브젝트
  edgeIndex: number;     // 지금 드래그하는 변 인덱스
  isHorizontal: boolean; // 수평선이면 true
  isVertical: boolean;   // 수직선이면 true
}

export default function Canvas() {
  const { objects, selectedObject, addRoom, addDoor, setObjects, setSelectedObject, startDrag, endDrag } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  
  // 어떤 오브젝트 드래그 중인지 저장하는 ref
  const draggingObjectRef = useRef<FloorObject | null>(null);
  const dragStartPosRef = useRef({ x: 0, y: 0 }); // 클릭 오프셋
  const dragInitialPosRef = useRef({ x: 0, y: 0 }); // 드래그 시작 시 오브젝트 위치 (Shift 제한용)
  
  // 어떤 변 드래그 중인지 저장하는 ref
  const draggingEdgeRef = useRef<DraggingEdge | null>(null);
  
  // state로 했더니 useEffect에서 클로저 때문에 값이 초기화 되지 않아서 ref로 변경
  // const [isPanning, setIsPanning] = useState(false);
  // const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isEdgeDragging, setIsEdgeDragging] = useState(false);

  const GRID_SIZE_SMALL = FLOOR_PLAN_CONFIG.GRID_SIZE_SMALL;
  const GRID_SIZE_BIG = FLOOR_PLAN_CONFIG.GRID_SIZE_BIG;
  const DRAG_SIZE_OFFSET = FLOOR_PLAN_CONFIG.DRAG_SIZE_OFFSET;
  const EDGE_SNAP_SIZE = DRAG_SIZE_OFFSET; // 변 드래그할 때 스냅되는 크기
  const MIN_WIDTH = FLOOR_PLAN_CONFIG.MIN_WIDTH;  // 오브젝트 최소 너비 (50px = 1.1m)
  const MIN_HEIGHT = FLOOR_PLAN_CONFIG.MIN_HEIGHT;  // 오브젝트 최소 높이 (50px = 1.1m)
  const SNAP_THRESHOLD = 10; // 벽 찾기 임계값 (px)

  const [viewBox, setViewBox] = useState({
    x: 0,
    y: 0,
    w: 1920,
    h: 1080,
  });

  // 오브젝트의 좌상단 좌표 계산하는 함수 (텍스트 위치 잡을 때 씀)
  const getObjectTopLeft = (points: { x: number, y: number }[]) => {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
    };
  };

  // 오브젝트의 중심 좌표 계산하는 함수 (회전 기준점으로 씀)
  const getObjectCenter = (points: { x: number, y: number }[]) => {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  };

  // borderColor를 기반으로 활성화 시 더 눈에 띄는 색상 계산
  const getActiveBorderColor = (borderColor: string): string => {
    // hex 색상을 RGB로 변환
    const hex = borderColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // 밝기 계산 (0~255)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // 밝기가 어두우면 밝게, 밝으면 어둡게 조정
    // 채도도 높여서 더 눈에 띄게
    let newR = r;
    let newG = g;
    let newB = b;
    
    if (brightness < 128) {
      // 어두운 색상이면 밝게 (최대 255까지)
      newR = Math.min(255, r + 80);
      newG = Math.min(255, g + 80);
      newB = Math.min(255, b + 80);
    } else {
      // 밝은 색상이면 어둡게 (최소 0까지)
      newR = Math.max(0, r - 80);
      newG = Math.max(0, g - 80);
      newB = Math.max(0, b - 80);
    }
    
    // RGB를 hex로 변환
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  };

  // 마우스 좌표 > SVG 좌표 변환 함수
  const clientToSvg = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: viewBox.x + (clientX - rect.left) * (viewBox.w / rect.width),
      y: viewBox.y + (clientY - rect.top) * (viewBox.h / rect.height),
    };
  };

  // 두 점 사이의 거리 계산
  const distance = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  // 점에서 선분까지의 최단 거리 계산
  const pointToLineDistance = (point: { x: number, y: number }, line: { p1: { x: number, y: number }, p2: { x: number, y: number } }) => {
    const { p1, p2 } = line;
    const A = point.x - p1.x;
    const B = point.y - p1.y;
    const C = p2.x - p1.x;
    const D = p2.y - p1.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = p1.x;
      yy = p1.y;
    } else if (param > 1) {
      xx = p2.x;
      yy = p2.y;
    } else {
      xx = p1.x + param * C;
      yy = p1.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 가장 가까운 벽(edge) 찾기
  type NearestWall = {
    obj: FloorObject;
    edgeIndex: number;
    edge: { p1: { x: number, y: number }, p2: { x: number, y: number } };
    distance: number;
  };

  // roomId를 지정하면 해당 방의 벽만 검색, 없으면 모든 방 검색
  const findNearestWall = (point: { x: number, y: number }, maxDistance?: number, roomId?: string): NearestWall | null => {
    let nearestWall: NearestWall | null = null;
    let minDistance = Infinity;

    objects.forEach(obj => {
      if (obj.type !== 'room') return; // 방만 벽으로 인식
      
      // roomId가 지정되었으면 해당 방만 검색
      if (roomId && obj.id !== roomId) return;

      // room의 중심점 계산
      const roomCenter = getObjectCenter(obj.points);
      const roomCenterX = obj.x + roomCenter.x;
      const roomCenterY = obj.y + roomCenter.y;

      for (let i = 0; i < obj.points.length; i++) {
        const p1 = { x: obj.x + obj.points[i].x, y: obj.y + obj.points[i].y };
        const p2 = { x: obj.x + obj.points[(i + 1) % obj.points.length].x, y: obj.y + obj.points[(i + 1) % obj.points.length].y };
        const edge = { p1, p2 };
        const dist = pointToLineDistance(point, edge);

        // 거리 제한이 있으면 체크
        if (maxDistance !== undefined && dist > maxDistance) continue;

        // 4분할: 드롭 위치가 room 중심점 기준으로 어느 사분면에 있는지 확인
        // 해당 사분면의 벽만 고려
        const dx = point.x - roomCenterX;
        const dy = point.y - roomCenterY;
        
        // 벽의 중점 계산
        const edgeCenterX = (p1.x + p2.x) / 2;
        const edgeCenterY = (p1.y + p2.y) / 2;
        const edgeDx = edgeCenterX - roomCenterX;
        const edgeDy = edgeCenterY - roomCenterY;

        // 같은 사분면인지 확인 (부호가 같으면 같은 사분면)
        const sameQuadrant = 
          (dx >= 0 && edgeDx >= 0) || (dx < 0 && edgeDx < 0) || // X축 같은 방향
          (dy >= 0 && edgeDy >= 0) || (dy < 0 && edgeDy < 0);   // Y축 같은 방향

        // 더 정확한 사분면 체크: 벡터의 내적을 사용
        const pointDir = { x: dx, y: dy };
        const edgeDir = { x: edgeDx, y: edgeDy };
        const dotProduct = pointDir.x * edgeDir.x + pointDir.y * edgeDir.y;
        
        // 같은 방향이면 (내적이 양수) 같은 사분면
        if (dotProduct < 0) continue; // 반대 방향이면 스킵

        if (dist < minDistance) {
          minDistance = dist;
          nearestWall = { obj, edgeIndex: i, edge, distance: dist };
        }
      }
    });

    return nearestWall;
  };

  // 벽 위의 점을 벽의 시작점 기준으로 정규화 (0~1 사이 값)
  const getPositionOnWall = (point: { x: number, y: number }, wall: { p1: { x: number, y: number }, p2: { x: number, y: number } }) => {
    const { p1, p2 } = wall;
    const wallLength = distance(p1, p2);
    const pointToP1 = distance(point, p1);
    return pointToP1 / wallLength;
  };

  // 오브젝트 드래그 시 커서모양 변경
  const handleObjectDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // 드롭을 허용하기 위해 필수
    e.dataTransfer.dropEffect = "move";
  };

  // 오브젝트 드래그 시 드롭 이벤트 처리
  const handleObjectDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const presetType = e.dataTransfer.getData("presetType");
    if (!presetType || !svgRef.current) return;

    // SVG viewBox 좌표계로 변환
    const { x: svgX, y: svgY } = clientToSvg(e.clientX, e.clientY);
    const dropPoint = { x: svgX, y: svgY };

    // 문인 경우 모든 곳에 생성 가능 (가장 가까운 벽에 생성)
    if (presetType === 'single' || presetType === 'double' || presetType === 'sliding') {
      // 거리 제한 없이 가장 가까운 벽 찾기 (4분할 적용)
      const nearestWall = findNearestWall(dropPoint);
      
      if (!nearestWall) {
        // 벽을 찾지 못하면 생성하지 않음
        return;
      }

      const wallLength = distance(nearestWall.edge.p1, nearestWall.edge.p2);
      const doorWidth = presetType === 'single' ? 80 : presetType === 'double' ? 160 : 120;
      const doorHeight = DRAG_SIZE_OFFSET;
      
      // 벽의 각도 계산
      const wallAngle = Math.atan2(
        nearestWall.edge.p2.y - nearestWall.edge.p1.y,
        nearestWall.edge.p2.x - nearestWall.edge.p1.x
      ) * (180 / Math.PI);
      
      // 문을 벽의 가운데에 배치 (문의 중심점 기준)
      const halfDoorWidth = doorWidth / 2;
      const minPosition = halfDoorWidth / wallLength;
      const maxPosition = 1 - (halfDoorWidth / wallLength);
      // 벽의 가운데 위치 (0.5), 단 문이 벽을 벗어나지 않도록 제한
      const centerPosition = 0.5;
      const clampedPosition = Math.max(minPosition, Math.min(maxPosition, centerPosition));
      
      // 벽의 가운데 위치 계산
      const finalCenterX = nearestWall.edge.p1.x + (nearestWall.edge.p2.x - nearestWall.edge.p1.x) * clampedPosition;
      const finalCenterY = nearestWall.edge.p1.y + (nearestWall.edge.p2.y - nearestWall.edge.p1.y) * clampedPosition;
      
      // 문의 기준점 (0, 0)을 벽의 edge 위에 직접 배치
      // 문의 points는 { x: 0, y: 0 }부터 시작하므로, 기준점을 벽의 edge 위에 두면 됨
      const doorBaseX = finalCenterX - (doorWidth / 2);
      const doorBaseY = finalCenterY - pxToCm(EDGE_SNAP_SIZE / 2); // 벽의 edge 위에서 1px 위에 배치

      // 문의 상대적 위치 정보 저장 (room 이동 시 함께 이동하기 위해)
      addDoor(presetType as DoorPreset, doorBaseX, doorBaseY, nearestWall.obj.id, wallAngle, nearestWall.edgeIndex, clampedPosition);
      return;
    }

    // 방인 경우 기존 로직
    const preset = presetType as RoomPreset;
    // 격자 스냅 적용
    const snappedX = Math.round(svgX / DRAG_SIZE_OFFSET) * DRAG_SIZE_OFFSET;
    const snappedY = Math.round(svgY / DRAG_SIZE_OFFSET) * DRAG_SIZE_OFFSET;

    addRoom(preset, snappedX, snappedY);
  };

  // 오브젝트 클릭 시 드래그 시작
  const handleObjectMouseDown = (e: React.MouseEvent, obj: FloorObject) => {
    if (e.buttons !== 1) return;
    e.stopPropagation(); // 캔버스 패닝 방지
    
    startDrag(); // 드래그 시작 - 히스토리 저장 멈춤
    draggingObjectRef.current = obj;
    setSelectedObject(obj);
    
    // 드래그 시작 시점의 마우스 위치 저장 (오브젝트 내부에서 클릭한 오프셋)
    const svgPos = clientToSvg(e.clientX, e.clientY);
    dragStartPosRef.current = {
      x: svgPos.x - obj.x,
      y: svgPos.y - obj.y,
    };
    
    // 드래그 시작 시점의 오브젝트 위치 저장 (Shift 제한용)
    dragInitialPosRef.current = {
      x: obj.x,
      y: obj.y,
    };
  };

  // =====================================================
  // 변(Edge) 드래그 관련 함수들
  // =====================================================
  
  // 변 클릭하면 드래그 시작하는 함수
  // 수평선인지 수직선인지 판단해서 ref에 저장해둠
  const handleEdgeMouseDown = (e: React.MouseEvent, obj: FloorObject, edgeIndex: number) => {
    e.stopPropagation(); // 이거 안하면 오브젝트 전체가 드래그됨
    e.preventDefault();
    
    startDrag(); // 드래그 시작 - 히스토리 저장 멈춤
    
    // 클릭한 변의 두 점 가져옴
    const p1 = obj.points[edgeIndex];
    const p2 = obj.points[(edgeIndex + 1) % obj.points.length];
    
    // Y좌표가 같으면 수평선, X좌표가 같으면 수직선
    const isHorizontal = p1.y === p2.y;
    const isVertical = p1.x === p2.x;
    
    // 드래그 상태 저장해둠
    draggingEdgeRef.current = {
      obj,
      edgeIndex,
      isHorizontal,
      isVertical,
    };
    
    setIsEdgeDragging(true);
  };

  // 변 드래그 중일 때 마우스 움직이면 호출되는 함수
  // 수평선은 위아래로만, 수직선은 좌우로만 움직이게 해서 형태 유지함
  const handleEdgeMouseMove = (svgPos: { x: number, y: number }) => {
    if (!draggingEdgeRef.current) return;
    
    const { obj, edgeIndex, isHorizontal, isVertical } = draggingEdgeRef.current;
    const nextIndex = (edgeIndex + 1) % obj.points.length;
    
    // 원본 배열 직접 수정하면 안돼서 복사함
    const newPoints = obj.points.map(p => ({ ...p }));

    if (isHorizontal) {
      // 수평선이면 Y축으로만 이동시킴
      const newY = Math.round((svgPos.y - obj.y) / EDGE_SNAP_SIZE) * EDGE_SNAP_SIZE;
      // 새로운 점으로 바꿔보고 크기 체크
      
      newPoints[edgeIndex].y = newY;
      newPoints[nextIndex].y = newY; // 두 점 다 같이 움직여야 선이 유지됨

      // bounding box 계산해서 높이 체크
      const ys = newPoints.map(p => p.y);
      const height = Math.max(...ys) - Math.min(...ys);
      // 최소 높이보다 작아지면 적용 안함
      if(height <= MIN_HEIGHT) return;
      // 오브젝트 높이
    } else if (isVertical) {
      // 수직선이면 X축으로만 이동시킴
      const newX = Math.round((svgPos.x - obj.x) / EDGE_SNAP_SIZE) * EDGE_SNAP_SIZE;
      newPoints[edgeIndex].x = newX;
      newPoints[nextIndex].x = newX; // 두 점 다 같이 움직여야 선이 유지됨

      // bounding box 계산해서 너비 체크
      const xs = newPoints.map(p => p.x);
      const width = Math.max(...xs) - Math.min(...xs);
      // 최소 너비보다 작아지면 적용 안함
      if(width <= MIN_WIDTH) return;
      // 오브젝트 너비
    }
    
    // room 크기 조절 시 부착된 door들의 크기와 위치 조정
    let updatedObjects = objects.map(o => 
      o.id === obj.id ? { ...o, points: newPoints } : o
    );
    
    // room인 경우, 부착된 door들 확인 및 조정
    if (obj.type === 'room') {
      const updatedRoom = updatedObjects.find(r => r.id === obj.id);
      if (updatedRoom) {
        // 해당 room에 부착된 모든 door 찾기
        const attachedDoors = updatedObjects.filter(door => 
          door.type === 'door' && door.attachedTo === updatedRoom.id && 
          door.edgeIndex !== undefined && door.positionOnWall !== undefined
        );
        
        // 각 door의 크기와 위치 조정
        updatedObjects = updatedObjects.map(doorObj => {
          if (doorObj.type === 'door' && doorObj.attachedTo === updatedRoom.id && 
              doorObj.edgeIndex !== undefined && doorObj.positionOnWall !== undefined) {
            // door가 부착된 edge의 길이 계산
            const edgeIndex = doorObj.edgeIndex;
            const p1 = { 
              x: updatedRoom.x + updatedRoom.points[edgeIndex].x, 
              y: updatedRoom.y + updatedRoom.points[edgeIndex].y 
            };
            const p2 = { 
              x: updatedRoom.x + updatedRoom.points[(edgeIndex + 1) % updatedRoom.points.length].x, 
              y: updatedRoom.y + updatedRoom.points[(edgeIndex + 1) % updatedRoom.points.length].y 
            };
            
            const wallLength = distance(p1, p2);
            const doorWidth = doorObj.width || 80;
            
            // door의 width가 edge 길이보다 크면 edge 길이로 줄임
            if (doorWidth > wallLength) {
              const newDoorWidth = wallLength;
              const doorHeight = FLOOR_PLAN_CONFIG.DRAG_SIZE_OFFSET; // px 단위로 유지
              
              // door의 points 업데이트 (width만 변경)
              const newDoorPoints: Point[] = [
                { x: 0, y: 0 }, 
                { x: newDoorWidth, y: 0 }, 
                { x: newDoorWidth, y: doorHeight }, 
                { x: 0, y: doorHeight }
              ];
              
              // 벽의 각도 계산
              const wallAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
              
              // door의 positionOnWall을 벽 중앙으로 조정 (door가 벽 안에 있도록)
              const halfDoorWidth = newDoorWidth / 2;
              const minPosition = halfDoorWidth / wallLength;
              const maxPosition = 1 - (halfDoorWidth / wallLength);
              const clampedPosition = Math.max(minPosition, Math.min(maxPosition, 0.5)); // 중앙으로
              
              // 벽 위의 중심점 계산
              const finalCenterX = p1.x + (p2.x - p1.x) * clampedPosition;
              const finalCenterY = p1.y + (p2.y - p1.y) * clampedPosition;
              
              // 문의 기준점 계산
              const doorBaseX = finalCenterX - (newDoorWidth / 2);
              const doorBaseY = finalCenterY - 1; // 벽의 edge 위에서 1px 위에 배치
              
              return {
                ...doorObj,
                width: newDoorWidth,
                points: newDoorPoints,
                x: doorBaseX,
                y: doorBaseY,
                rotation: wallAngle,
                positionOnWall: clampedPosition,
              };
            } else {
              // door의 width가 edge 길이보다 작거나 같으면 위치만 업데이트
              const wallAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
              
              // door의 현재 positionOnWall 유지하되, 벽 안에 있도록 조정
              const halfDoorWidth = doorWidth / 2;
              const minPosition = halfDoorWidth / wallLength;
              const maxPosition = 1 - (halfDoorWidth / wallLength);
              const clampedPosition = Math.max(minPosition, Math.min(maxPosition, doorObj.positionOnWall));
              
              // 벽 위의 중심점 계산
              const finalCenterX = p1.x + (p2.x - p1.x) * clampedPosition;
              const finalCenterY = p1.y + (p2.y - p1.y) * clampedPosition;
              
              // 문의 기준점 계산
              const doorBaseX = finalCenterX - (doorWidth / 2);
              const doorBaseY = finalCenterY - 1; // 벽의 edge 위에서 1px 위에 배치
              
              return {
                ...doorObj,
                x: doorBaseX,
                y: doorBaseY,
                rotation: wallAngle,
                positionOnWall: clampedPosition,
              };
            }
          }
          return doorObj;
        });
      }
    }
    
    // store에 있는 objects 업데이트
    setObjects(updatedObjects);
    
    // 오른쪽 위 디버그 패널에도 반영되게 selectedObject도 업데이트
    if (selectedObject?.id === obj.id) {
      const updatedSelectedObj = updatedObjects.find(o => o.id === obj.id);
      if (updatedSelectedObj) {
        setSelectedObject({ ...obj, points: newPoints });
      }
    }
  };

  // 마우스 움직일 때 오브젝트 이동이랑 변 드래그 둘 다 여기서 처리함
  const handleMouseMove = (e: React.MouseEvent) => {
    const svgPos = clientToSvg(e.clientX, e.clientY);
    
    // 변 드래그 중이면 변 이동부터 처리하고 return
    if (draggingEdgeRef.current && e.buttons === 1) {
      handleEdgeMouseMove(svgPos);
      return;
    }
    
    // 오브젝트 드래그 처리
    if (!draggingObjectRef.current || e.buttons !== 1) return;

    const draggingObj = draggingObjectRef.current;

    // 문인 경우 벽을 따라 이동 (처음 붙은 방에서만 이동 가능)
    if (draggingObj.type === 'door' && draggingObj.attachedTo) {
      const attachedRoom = objects.find(obj => obj.id === draggingObj.attachedTo);
      if (!attachedRoom) return;

      // 드래그 중인 문의 중심점
      const doorCenter = { x: svgPos.x, y: svgPos.y };
      
      // 부착된 방의 벽만 검색 (다른 방으로 넘어가지 않도록)
      const nearestWall = findNearestWall(doorCenter, undefined, draggingObj.attachedTo);
      
      // 부착된 방의 벽 위에서만 이동 가능
      if (nearestWall) {
        // 벽 위의 위치 계산
        const positionOnWall = getPositionOnWall(doorCenter, nearestWall.edge);
        const wallLength = distance(nearestWall.edge.p1, nearestWall.edge.p2);
        const doorWidth = draggingObj.width || 80;
        const doorHeight = DRAG_SIZE_OFFSET;
        
        // 벽의 각도 계산
        const wallAngle = Math.atan2(
          nearestWall.edge.p2.y - nearestWall.edge.p1.y,
          nearestWall.edge.p2.x - nearestWall.edge.p1.x
        ) * (180 / Math.PI);
        
        // 문이 벽을 벗어나지 않도록 제한 (문의 중심점 기준)
        // 문이 room 밖으로 나가지 않도록 벽의 시작점과 끝점 내에서만 이동 가능
        const halfDoorWidth = doorWidth / 2;
        const minPosition = halfDoorWidth / wallLength;
        const maxPosition = 1 - (halfDoorWidth / wallLength);
        const clampedPosition = Math.max(minPosition, Math.min(maxPosition, positionOnWall));
        
        // 벽의 가운데 위치 계산
        const finalCenterX = nearestWall.edge.p1.x + (nearestWall.edge.p2.x - nearestWall.edge.p1.x) * clampedPosition;
        const finalCenterY = nearestWall.edge.p1.y + (nearestWall.edge.p2.y - nearestWall.edge.p1.y) * clampedPosition;
        
        // 문의 기준점 (0, 0)을 벽의 edge 위에 직접 배치
        // 문의 points는 { x: 0, y: 0 }부터 시작하므로, 기준점을 벽의 edge 위에 두면 됨
        const doorBaseX = finalCenterX - (doorWidth / 2);
        const doorBaseY = finalCenterY - pxToCm(EDGE_SNAP_SIZE / 2); // 벽의 edge 위에서 1px 위에 배치

        // 문의 상대적 위치 정보 업데이트 (room 이동 시 함께 이동하기 위해)
        setObjects(objects.map(obj => 
          obj.id === draggingObj.id 
            ? { ...obj, x: doorBaseX, y: doorBaseY, rotation: wallAngle, edgeIndex: nearestWall.edgeIndex, positionOnWall: clampedPosition } 
            : obj
        ));
        setSelectedObject({ ...draggingObj, x: doorBaseX, y: doorBaseY, rotation: wallAngle, edgeIndex: nearestWall.edgeIndex, positionOnWall: clampedPosition });
        setIsDragging(true);
        return;
      }
      // room의 벽 위가 아니면 이동하지 않음 (room 밖으로 나가지 않도록)
    }

    // 일반 오브젝트 드래그 처리
    // 새 위치 계산 (클릭 오프셋 반영)
    let newX = svgPos.x - dragStartPosRef.current.x;
    let newY = svgPos.y - dragStartPosRef.current.y;
    
    // Shift 키가 눌려있으면 더 큰 변화량 방향으로만 이동
    if (e.shiftKey) {
      const deltaX = Math.abs(newX - dragInitialPosRef.current.x);
      const deltaY = Math.abs(newY - dragInitialPosRef.current.y);
      
      if (deltaX > deltaY) {
        // X 방향 이동이 더 크면 Y는 고정 (좌우 이동)
        newY = dragInitialPosRef.current.y;
      } else {
        // Y 방향 이동이 더 크면 X는 고정 (상하 이동)
        newX = dragInitialPosRef.current.x;
      }
    }
    
    // 격자 스냅
    const snappedX = Math.round(newX / DRAG_SIZE_OFFSET) * DRAG_SIZE_OFFSET;
    const snappedY = Math.round(newY / DRAG_SIZE_OFFSET) * DRAG_SIZE_OFFSET;
    
    // room 이동 시 부착된 문들의 위치도 함께 업데이트
    let updatedObjects = objects.map(obj => 
      obj.id === draggingObj.id 
        ? { ...obj, x: snappedX, y: snappedY } 
        : obj
    );
    
    // room이 이동한 경우, 부착된 문들의 위치 업데이트
    if (draggingObj.type === 'room') {
      const deltaX = snappedX - draggingObj.x;
      const deltaY = snappedY - draggingObj.y;
      
      // 해당 room에 부착된 모든 문 찾기
      const attachedDoors = updatedObjects.filter(obj => 
        obj.type === 'door' && obj.attachedTo === draggingObj.id && 
        obj.edgeIndex !== undefined && obj.positionOnWall !== undefined
      );
      
      // 각 문의 위치 업데이트
      updatedObjects = updatedObjects.map(obj => {
        if (obj.type === 'door' && obj.attachedTo === draggingObj.id && 
            obj.edgeIndex !== undefined && obj.positionOnWall !== undefined) {
          // 업데이트된 room 찾기
          const updatedRoom = updatedObjects.find(r => r.id === draggingObj.id);
          if (!updatedRoom) return obj;
          
          // 해당 edge의 새로운 위치 계산
          const edgeIndex = obj.edgeIndex;
          const p1 = { 
            x: updatedRoom.x + updatedRoom.points[edgeIndex].x, 
            y: updatedRoom.y + updatedRoom.points[edgeIndex].y 
          };
          const p2 = { 
            x: updatedRoom.x + updatedRoom.points[(edgeIndex + 1) % updatedRoom.points.length].x, 
            y: updatedRoom.y + updatedRoom.points[(edgeIndex + 1) % updatedRoom.points.length].y 
          };
          
          // 벽의 길이와 각도 계산
          const wallLength = distance(p1, p2);
          const wallAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
          
          // 문의 위치 계산 (positionOnWall 비율 사용)
          const doorWidth = obj.width || 80;
          const halfDoorWidth = doorWidth / 2;
          const minPosition = halfDoorWidth / wallLength;
          const maxPosition = 1 - (halfDoorWidth / wallLength);
          const clampedPosition = Math.max(minPosition, Math.min(maxPosition, obj.positionOnWall));
          
          // 벽 위의 중심점 계산
          const finalCenterX = p1.x + (p2.x - p1.x) * clampedPosition;
          const finalCenterY = p1.y + (p2.y - p1.y) * clampedPosition;
          
          // 문의 기준점 계산
          const doorBaseX = finalCenterX - (doorWidth / 2);
          const doorBaseY = finalCenterY - pxToCm(EDGE_SNAP_SIZE / 2); // 벽의 edge 위에서 1px 위에 배치
          
          return {
            ...obj,
            x: doorBaseX,
            y: doorBaseY,
            rotation: wallAngle,
          };
        }
        return obj;
      });
    }
    
    setObjects(updatedObjects);
    setSelectedObject({ ...draggingObj, x: snappedX, y: snappedY });
    setIsDragging(true);
  };

  // 마우스 떼면 드래그 종료
  const handleMouseUp = () => {
    // 드래그 중이었으면 히스토리에 저장
    if (draggingObjectRef.current || draggingEdgeRef.current) {
      endDrag();
    }
    
    draggingObjectRef.current = null;
    draggingEdgeRef.current = null;
    setIsDragging(false);
    setIsEdgeDragging(false);
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
      const { selectedObject, objects, setObjects, setSelectedObject, undo, redo } = useEditorStore.getState();
      
      // Ctrl+Z: 실행 취소 (Undo)
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      
      // Ctrl+Y 또는 Ctrl+Shift+Z: 다시 실행 (Redo)
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
        e.preventDefault();
        redo();
        return;
      }
      
      if (e.key === 'Delete') {
        // state로 하니까 클로져 때문에 또 안됨, zustand에 스테이트 값이 있어서 스테이트 값을 zustand에서 가져오기
        console.log(selectedObject);
        if (selectedObject) {
          setObjects(objects.filter(obj => obj.id !== selectedObject.id));
          setSelectedObject(null);
        }
        return;
      }
      
      // 방향키 입력시 오브젝트 DRAG_SIZE_OFFSET만큼 이동
      if (!selectedObject) return; // 선택된 오브젝트가 없으면 무시
      if(selectedObject.type === 'door') return;
      
      // room 이동 시 부착된 문들의 위치도 함께 업데이트하는 헬퍼 함수
      const updateObjectsWithDoors = (updatedRoom: FloorObject) => {
        let updatedObjects = objects.map(obj => 
          obj.id === selectedObject.id ? updatedRoom : obj
        );
        
        // 해당 room에 부착된 모든 문 찾기
        const attachedDoors = updatedObjects.filter(obj => 
          obj.type === 'door' && obj.attachedTo === selectedObject.id && 
          obj.edgeIndex !== undefined && obj.positionOnWall !== undefined
        );
        
        // 각 문의 위치 업데이트
        updatedObjects = updatedObjects.map(obj => {
          if (obj.type === 'door' && obj.attachedTo === selectedObject.id && 
              obj.edgeIndex !== undefined && obj.positionOnWall !== undefined) {
            // 해당 edge의 새로운 위치 계산
            const edgeIndex = obj.edgeIndex;
            const p1 = { 
              x: updatedRoom.x + updatedRoom.points[edgeIndex].x, 
              y: updatedRoom.y + updatedRoom.points[edgeIndex].y 
            };
            const p2 = { 
              x: updatedRoom.x + updatedRoom.points[(edgeIndex + 1) % updatedRoom.points.length].x, 
              y: updatedRoom.y + updatedRoom.points[(edgeIndex + 1) % updatedRoom.points.length].y 
            };
            
            // 벽의 길이와 각도 계산
            const wallLength = distance(p1, p2);
            const wallAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
            
            // 문의 위치 계산 (positionOnWall 비율 사용)
            const doorWidth = obj.width || 80;
            const halfDoorWidth = doorWidth / 2;
            const minPosition = halfDoorWidth / wallLength;
            const maxPosition = 1 - (halfDoorWidth / wallLength);
            const clampedPosition = Math.max(minPosition, Math.min(maxPosition, obj.positionOnWall));
            
            // 벽 위의 중심점 계산
            const finalCenterX = p1.x + (p2.x - p1.x) * clampedPosition;
            const finalCenterY = p1.y + (p2.y - p1.y) * clampedPosition;
            
            // 문의 기준점 계산
            const doorBaseX = finalCenterX - (doorWidth / 2);
            const doorBaseY = finalCenterY - pxToCm(EDGE_SNAP_SIZE / 2); // 벽의 edge 위에서 1px 위에 배치
            
            return {
              ...obj,
              x: doorBaseX,
              y: doorBaseY,
              rotation: wallAngle,
            };
          }
          return obj;
        });
        
        return updatedObjects;
      };
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const updatedRoom = { ...selectedObject, y: selectedObject.y - DRAG_SIZE_OFFSET };
        const updatedObjects = selectedObject.type === 'room' 
          ? updateObjectsWithDoors(updatedRoom)
          : objects.map(obj => obj.id === selectedObject.id ? updatedRoom : obj);
        setObjects(updatedObjects);
        setSelectedObject(updatedRoom);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const updatedRoom = { ...selectedObject, y: selectedObject.y + DRAG_SIZE_OFFSET };
        const updatedObjects = selectedObject.type === 'room' 
          ? updateObjectsWithDoors(updatedRoom)
          : objects.map(obj => obj.id === selectedObject.id ? updatedRoom : obj);
        setObjects(updatedObjects);
        setSelectedObject(updatedRoom);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const updatedRoom = { ...selectedObject, x: selectedObject.x - DRAG_SIZE_OFFSET };
        const updatedObjects = selectedObject.type === 'room' 
          ? updateObjectsWithDoors(updatedRoom)
          : objects.map(obj => obj.id === selectedObject.id ? updatedRoom : obj);
        setObjects(updatedObjects);
        setSelectedObject(updatedRoom);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const updatedRoom = { ...selectedObject, x: selectedObject.x + DRAG_SIZE_OFFSET };
        const updatedObjects = selectedObject.type === 'room' 
          ? updateObjectsWithDoors(updatedRoom)
          : objects.map(obj => obj.id === selectedObject.id ? updatedRoom : obj);
        setObjects(updatedObjects);
        setSelectedObject(updatedRoom);
      }
    }
    
    // svg 위에서 선택된 오브젝트가 아닌 곳 클릭하면 선택 해제
    const handleClickObjectOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      const { selectedObject, setSelectedObject } = useEditorStore.getState();
      
      // 클릭한 요소가 어떤 오브젝트에 속하는지 확인
      const clickedObjectElement = target.closest('g[id]');
      const clickedObjectId = clickedObjectElement?.getAttribute('id');
      
      // 선택된 오브젝트가 아닌 곳 클릭했으면 선택 해제
      // (다른 오브젝트 클릭하거나 빈 공간 클릭했을 때)
      if (!clickedObjectId || clickedObjectId !== selectedObject?.id) {
        setSelectedObject(null);
      }
    }
    // svg에서 드래그가 잘 안된다고 해서 마우스 이벤트로 직접 처리
    svgElement.addEventListener('wheel', onWheelZoomNative, { passive: false });
    svgElement.addEventListener('mousedown', handleClickWheel);
    svgElement.addEventListener('mousemove', handleMoveWheel);
    svgElement.addEventListener('mouseup', handleMouseUpNative);
    svgElement.addEventListener('click', handleClickObjectOutside); // svg에서만 동작
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      svgElement.removeEventListener('wheel', onWheelZoomNative);
      svgElement.removeEventListener('mousedown', handleClickWheel);
      svgElement.removeEventListener('mousemove', handleMoveWheel);
      svgElement.removeEventListener('mouseup', handleMouseUpNative);
      svgElement.removeEventListener('click', handleClickObjectOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [])


  return (
    <div ref={containerRef} className="w-full h-full bg-[#F1F3F8]">
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
        {/* 배경 격자 - 클릭하면 선택 해제 */}
        <rect 
          x={viewBox.x} 
          y={viewBox.y} 
          width={viewBox.w} 
          height={viewBox.h} 
          fill="url(#largeGrid)"
          onClick={() => setSelectedObject(null)}
        />
        <circle cx="0" cy="0" r="10" fill="red" />
        <text x="15" y="20" fontSize="20" fill="red">Origin (0,0)</text>
        
        {[...objects]
          .map((obj, index) => ({ obj, index })) // 원래 인덱스 저장
          .sort((a, b) => {
            // 선택한 오브젝트를 가장 위에 렌더링 (svg에서는 z-index가 안돼서 태그 순서로 처리)
            if (a.obj.id === selectedObject?.id) return 1;
            if (b.obj.id === selectedObject?.id) return -1;
            // 나머지는 원래 배열 순서 유지
            return a.index - b.index;
          })
          .map(({ obj }) => {
          // 문인 경우 rotation 적용
          const center = getObjectCenter(obj.points);
          const rotation = obj.rotation ?? 0;
          const transform = rotation !== 0 
            ? `translate(${obj.x}, ${obj.y}) rotate(${rotation}, ${center.x}, ${center.y})`
            : `translate(${obj.x}, ${obj.y})`;
          
          return (
            <g 
              id={obj.id}
              key={obj.id} 
              transform={transform}
              onMouseDown={(e) => handleObjectMouseDown(e, obj)}
              style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
            >
            {/* 오브젝트 본체 그리는 polygon */}
            <polygon
              points={obj.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill={obj.color}
              stroke={selectedObject?.id === obj.id ? getActiveBorderColor(obj.borderColor) : obj.borderColor}
              strokeWidth={ obj.type === 'door' ? 0 : pxToCm(5)}
            />
            
            {/* 문 열리는 영역 표시 */}
            {obj.type === 'door' && (() => {
              // points에서 문의 실제 크기와 위치 계산
              const xs = obj.points.map(p => p.x);
              const ys = obj.points.map(p => p.y);
              const minX = Math.min(...xs);
              const minY = Math.min(...ys);
              const doorWidth = Math.max(...xs) - minX;
              
              if (doorWidth <= 0) return null;
              
              const doorOpenDirection = obj.doorOpenDirection ?? 1;
              
              // 힌지 위치 (문의 왼쪽 상단, points의 실제 시작점)
              const pivotX = minX;
              const pivotY = minY;
              
              // 문의 로컬 좌표계에서 호를 그림 (transform의 rotation이 자동 적용됨)
              // - 문은 X+ 방향으로 뻗어있음 (시작 각도 = 0)
              // - doorOpenDirection=1: Y+ 방향 (아래로, 90도) → 방 안으로
              // - doorOpenDirection=-1: Y- 방향 (위로, -90도) → 방 밖으로
              
              const startAngleRad = 0; // 문이 닫힌 상태 (X+ 방향)
              const openAngleRad = (90 * Math.PI) / 180;
              const endAngleRad = doorOpenDirection > 0 ? openAngleRad : -openAngleRad;
              
              // 호의 시작점 (문 끝점)
              const startX = pivotX + doorWidth; // cos(0) = 1
              const startY = pivotY;              // sin(0) = 0
              
              // 호의 끝점 (문이 열린 상태)
              const endX = pivotX + doorWidth * Math.cos(endAngleRad);
              const endY = pivotY + doorWidth * Math.sin(endAngleRad);
              
              // large-arc-flag: 90도는 항상 0
              const largeArcFlag = 0;
              // sweep-flag: 시계방향(1), 반시계방향(0)
              const sweepFlag = doorOpenDirection > 0 ? 1 : 0;
              
              // 호 경로: 힌지 → 문 끝점 → 호 → 힌지
              const arcPath = `M ${pivotX} ${pivotY} L ${startX} ${startY} A ${doorWidth} ${doorWidth} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY} Z`;
              
              return (
                <path
                  d={arcPath}
                  fill="rgba(255, 255, 255, 1)"
                  stroke="rgba(0, 0, 0, 1)"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                  opacity="0.6"
                />
              );
            })()}
            
            {/* 
              선택된 오브젝트한테만 변 핸들 보여줌
              변 클릭해서 드래그하면 크기 조절됨
              수평선은 위아래로, 수직선은 좌우로 움직임
            */}
            {selectedObject?.id === obj.id && obj.points.map((point, i) => {
              // 다음 점 구함 (마지막 점 다음은 첫번째 점으로 연결)
              const nextPoint = obj.points[(i + 1) % obj.points.length];
              // Y좌표 같으면 수평선
              const isHorizontal = point.y === nextPoint.y;
              
              return (
                <line
                  key={`edge-${i}`}
                  x1={point.x}
                  y1={point.y}
                  x2={nextPoint.x}
                  y2={nextPoint.y}
                  stroke={getActiveBorderColor(obj.borderColor)}
                  strokeWidth={isEdgeDragging ? "8" : "6"}
                  strokeOpacity="0.4"
                  // 수평선이면 위아래 커서, 수직선이면 좌우 커서로 보여줌
                  style={{ cursor: isHorizontal ? 'ns-resize' : 'ew-resize' }}
                  onMouseDown={(e) => handleEdgeMouseDown(e, obj, i)}
                />
              );
            })}
            
            {/* 오브젝트 좌상단 기준 (20, 20) 위치에 텍스트 배치 (문 제외) */}
            {obj.type !== 'door' && (() => {
              const topLeft = getObjectTopLeft(obj.points);
              return (
                <text 
                  x={topLeft.x + 20} 
                  y={topLeft.y + 30} 
                  fill={obj.textColor ?? '#000000'} 
                  className="font-bold select-none"
                >
                  {obj.name}
                </text>
              );
            })()}
            </g>
          );
        })}
      </svg>
    </div>
  )
}
