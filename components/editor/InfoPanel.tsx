'use client';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { useEditorStore } from "@/store/useEditorSotre";
import { useRef, useState, useEffect } from "react";
import { FLOOR_PLAN_CONFIG, pxToM, mToPx } from "@/lib/floorPlanConstants";
import { Button } from "../ui/button";
import { RotateCwSquareIcon, ArrowUpToLine, ArrowDownToLine } from "lucide-react";

const MIN_WIDTH_M = pxToM(FLOOR_PLAN_CONFIG.MIN_WIDTH);  // 오브젝트 최소 너비 (1.1m)
const MIN_HEIGHT_M = pxToM(FLOOR_PLAN_CONFIG.MIN_HEIGHT);  // 오브젝트 최소 높이 (1.1m)

export default function InfoPanel() {
  const { selectedObject, objects, setObjects, changeObjectInfo, startDrag, endDrag } = useEditorStore();
  const colorChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const borderColorChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textColorChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sizeChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 오브젝트의 바운딩 박스 크기 계산
  const getObjectSize = () => {
    if (!selectedObject) return { w: 0, h: 0 };
    const xs = selectedObject.points.map(p => p.x);
    const ys = selectedObject.points.map(p => p.y);
    return {
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  };

  const size = getObjectSize();
  
  // 입력 중인 크기 값을 관리하는 로컬 state (m 단위)
  const [widthInput, setWidthInput] = useState<string>(pxToM(size.w).toFixed(2));
  const [heightInput, setHeightInput] = useState<string>(pxToM(size.h).toFixed(2));
  
  // selectedObject가 변경되면 입력값도 업데이트
  useEffect(() => {
    if (!selectedObject) {
      setWidthInput('0');
      setHeightInput('0');
      return;
    }
    const currentSize = getObjectSize();
    setWidthInput(pxToM(currentSize.w).toFixed(2));
    setHeightInput(pxToM(currentSize.h).toFixed(2));
  }, [selectedObject?.id]);

  // 크기 변경 핸들러 (중심점 기준으로 스케일링) - m 단위로 받아서 px로 변환
  const handleSizeChange = (newWidthM: number, newHeightM: number) => {
    if (!selectedObject) return;
    
    // m를 px로 변환
    const newWidth = mToPx(newWidthM);
    const newHeight = mToPx(newHeightM);
    
    const currentSize = getObjectSize();
    if (currentSize.w === 0 || currentSize.h === 0) return; // 크기가 0이면 무시
    
    const { isHistoryPaused } = useEditorStore.getState();
    
    // 첫 번째 변경 시 드래그 시작
    if (!isHistoryPaused) {
      startDrag();
    }
    
    // 기존 타이머 클리어
    if (sizeChangeTimerRef.current) {
      clearTimeout(sizeChangeTimerRef.current);
    }
    
    const scaleX = newWidth / currentSize.w;
    const scaleY = newHeight / currentSize.h;
    
    // points의 중심점 계산
    const xs = selectedObject.points.map(p => p.x);
    const ys = selectedObject.points.map(p => p.y);
    const center = {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
    
    // 중심점 기준으로 스케일링
    const scaledPoints = selectedObject.points.map(point => ({
      x: center.x + (point.x - center.x) * scaleX,
      y: center.y + (point.y - center.y) * scaleY,
    }));
    
    changeObjectInfo('points', scaledPoints);
    
    // 마지막 변경 후 150ms 후에 드래그 종료 (히스토리 저장)
    sizeChangeTimerRef.current = setTimeout(() => {
      endDrag();
      sizeChangeTimerRef.current = null;
    }, 150);
  };

  // 색상 변경 핸들러 (debounce로 마지막 변경 후에만 히스토리 저장)
  const handleColorChange = (value: string, colorType: 'color' | 'borderColor' | 'textColor' = 'color') => {
    const { isHistoryPaused } = useEditorStore.getState();
    const timerRef = colorType === 'borderColor' 
      ? borderColorChangeTimerRef 
      : colorType === 'textColor'
      ? textColorChangeTimerRef
      : colorChangeTimerRef;
    
    // 첫 번째 변경 시 드래그 시작
    if (!isHistoryPaused) {
      startDrag();
    }
    
    // 기존 타이머 클리어
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // 색상 변경 적용
    changeObjectInfo(colorType, value);
    
    // 마지막 변경 후 150ms 후에 드래그 종료 (히스토리 저장)
    timerRef.current = setTimeout(() => {
      endDrag();
      timerRef.current = null;
    }, 150);
  };

  // 색상 피커 닫힐 때 (마우스 떼기)
  const handleColorPickerEnd = () => {
    if (colorChangeTimerRef.current) {
      clearTimeout(colorChangeTimerRef.current);
      colorChangeTimerRef.current = null;
    }
    if (borderColorChangeTimerRef.current) {
      clearTimeout(borderColorChangeTimerRef.current);
      borderColorChangeTimerRef.current = null;
    }
    if (textColorChangeTimerRef.current) {
      clearTimeout(textColorChangeTimerRef.current);
      textColorChangeTimerRef.current = null;
    }
    if (sizeChangeTimerRef.current) {
      clearTimeout(sizeChangeTimerRef.current);
      sizeChangeTimerRef.current = null;
    }
    endDrag();
  };

  return (
    <div className="absolute top-4 right-4 bg-white w-64 rounded-lg shadow-lg overflow-hidden text-sm">
      <h1 className="text-sm font-medium px-4 py-3 border-b border-gray-100">오브젝트 정보</h1>
      {/* 헤더 - 오브젝트 이름 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h5 className="text-xs text-gray-500 mb-2">이름</h5>
        <Input 
          type="text" 
          className="w-full h-8 text-sm font-medium" 
          placeholder="오브젝트 이름"
          value={selectedObject?.name ?? ''} 
          onChange={(e) => changeObjectInfo('name', e.target.value)} 
        />
      </div>

      {/* 위치 섹션 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h5 className="text-xs text-gray-500 mb-2">위치</h5>
        <div className="flex gap-2">
          <InputGroup className="flex-1">
            <InputGroupAddon align="inline-start" className="text-xs text-gray-400 w-6">
              X
            </InputGroupAddon>
            <InputGroupInput 
              type="number" 
              className="text-xs"
              value={selectedObject?.x ?? 0}
              onChange={(e) => changeObjectInfo('x', Number(e.target.value))}
            />
          </InputGroup>
          <InputGroup className="flex-1">
            <InputGroupAddon align="inline-start" className="text-xs text-gray-400 w-6">
              Y
            </InputGroupAddon>
            <InputGroupInput 
              type="number" 
              className="text-xs"
              value={selectedObject?.y ?? 0}
              onChange={(e) => changeObjectInfo('y', Number(e.target.value))}
            />
          </InputGroup>
        </div>
      </div>

      {/* 순서 섹션 (door 제외) */}
      {selectedObject && selectedObject.type !== 'door' && (
        <div className="px-4 py-3 border-b border-gray-100">
          <h5 className="text-xs text-gray-500 mb-2">순서</h5>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                // 맨 앞으로: 배열의 맨 뒤로 이동 (나중에 렌더링 = 위에 표시)
                const newObjects = objects.filter(obj => obj.id !== selectedObject.id);
                newObjects.push(selectedObject);
                setObjects(newObjects);
              }}
              title="맨 앞으로"
            >
              <ArrowUpToLine className="w-3 h-3 mr-1" />
              맨 앞
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                // 맨 뒤로: 배열의 맨 앞으로 이동 (먼저 렌더링 = 아래에 표시)
                const newObjects = objects.filter(obj => obj.id !== selectedObject.id);
                newObjects.unshift(selectedObject);
                setObjects(newObjects);
              }}
              title="맨 뒤로"
            >
              <ArrowDownToLine className="w-3 h-3 mr-1" />
              맨 뒤
            </Button>
          </div>
        </div>
      )}

      {/* 회전 섹션 */}
      {/* { selectedObject?.type !== 'room' && (
        <div className="px-4 py-3 border-b border-gray-100">
          <h5 className="text-xs text-gray-500 mb-2">회전</h5>
          <div className="flex gap-2">
            <InputGroup className="w-24">
              <InputGroupAddon align="inline-start" className="text-xs text-gray-400 w-6">
                °
              </InputGroupAddon>
              <InputGroupInput 
                type="number" 
                className="text-xs"
                value={selectedObject?.rotation ?? 0}
                onChange={(e) => changeObjectInfo('rotation', Number(e.target.value))}
                readOnly
              />
            </InputGroup>
            <Button variant="outline" size="icon" className="" onClick={handleClickRotation}>
              <RotateCwSquareIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )} */}

      {/* 문 열리는 방향 섹션 */}
      {selectedObject?.type === 'door' && (
        <div className="px-4 py-3 border-b border-gray-100">
          <h5 className="text-xs text-gray-500 mb-2">문 열리는 방향</h5>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 flex-1">
              현재: {selectedObject.doorOpenDirection === -1 ? '방 밖으로' : '방 안으로'}
            </span>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => {
                const currentDirection = selectedObject.doorOpenDirection ?? 1;
                changeObjectInfo('doorOpenDirection', currentDirection * -1);
              }}
              title="열리는 방향 바꾸기"
            >
              <RotateCwSquareIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 크기 섹션 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h5 className="text-xs text-gray-500 mb-2">크기 (m)</h5>
        <div className="flex gap-2">
          <InputGroup className="flex-1">
            <InputGroupAddon align="inline-start" className="text-xs text-gray-400 w-6">
              W
            </InputGroupAddon>
            <InputGroupInput 
              type="number" 
              className="text-xs"
              value={widthInput}
              min={MIN_WIDTH_M}
              step="0.1"
              onChange={(e) => {
                setWidthInput(e.target.value); // 입력 중인 값만 업데이트
              }}
              onFocus={() => startDrag()}
              onBlur={(e) => {
                const newWidthM = Number(e.target.value);
                const currentSize = getObjectSize();
                const currentWidthM = pxToM(currentSize.w);
                const currentHeightM = pxToM(currentSize.h);
                // 빈 값이거나 최소값 미만이면 현재 값으로 복원
                if (isNaN(newWidthM) || newWidthM < MIN_WIDTH_M) {
                  setWidthInput(currentWidthM.toFixed(2));
                } else {
                  // 유효한 값이면 크기 변경 적용 (m 단위로 전달)
                  handleSizeChange(newWidthM, currentHeightM);
                }
                handleColorPickerEnd();
                endDrag();
              }}
            />
          </InputGroup>
          <InputGroup className="flex-1">
            <InputGroupAddon align="inline-start" className="text-xs text-gray-400 w-6">
              H
            </InputGroupAddon>
            <InputGroupInput 
              type="number" 
              className="text-xs"
              value={heightInput}
              min={MIN_HEIGHT_M}
              step="0.1"
              readOnly={selectedObject?.type !== 'room'}
              onChange={(e) => {
                setHeightInput(e.target.value); // 입력 중인 값만 업데이트
              }}
              onFocus={() => startDrag()}
              onBlur={(e) => {
                const newHeightM = Number(e.target.value);
                const currentSize = getObjectSize();
                const currentWidthM = pxToM(currentSize.w);
                const currentHeightM = pxToM(currentSize.h);
                // 빈 값이거나 최소값 미만이면 현재 값으로 복원
                if (isNaN(newHeightM) || newHeightM < MIN_HEIGHT_M) {
                  setHeightInput(currentHeightM.toFixed(2));
                } else {
                  // 유효한 값이면 크기 변경 적용 (m 단위로 전달)
                  handleSizeChange(currentWidthM, newHeightM);
                }
                handleColorPickerEnd();
                endDrag();
              }}
            />
          </InputGroup>
        </div>
      </div>

      {/* 채우기 섹션 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h5 className="text-xs text-gray-500 mb-2">채우기</h5>
        <div className="flex items-center gap-2">
          <label 
            htmlFor="color"
            className="w-8 h-8 rounded-md border border-(--input) cursor-pointer p-1 relative"
          >
            <input 
              type="color" 
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              value={selectedObject?.color ?? '#BC916B'}
              onChange={(e) => handleColorChange(e.target.value, 'color')}
              onMouseUp={handleColorPickerEnd}
              onBlur={handleColorPickerEnd}
              id="color"
            />
            <div className="w-full h-full rounded-[3px]" style={{ backgroundColor: selectedObject?.color ?? '#BC916B' }}></div>
          </label>
          <Input 
            type="text" 
            className="flex-1 h-8 text-xs uppercase"
            value={selectedObject?.color?.replace('#', '') ?? 'BC916B'}
            onChange={(e) => handleColorChange(`#${e.target.value}`, 'color')}
            onFocus={() => startDrag()}
            onBlur={() => {
              handleColorPickerEnd();
              endDrag();
            }}
          />
        </div>
      </div>

      {/* 외곽선 섹션 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h5 className="text-xs text-gray-500 mb-2">외곽선</h5>
        <div className="flex items-center gap-2">
          <label 
            htmlFor="borderColor"
            className="w-8 h-8 rounded-md border border-(--input) cursor-pointer p-1 relative"
          >
            <input 
              type="color" 
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              value={selectedObject?.borderColor ?? '#000000'}
              onChange={(e) => handleColorChange(e.target.value, 'borderColor')}
              onMouseUp={handleColorPickerEnd}
              onBlur={handleColorPickerEnd}
              id="borderColor"
            />
            <div className="w-full h-full rounded-[3px]" style={{ backgroundColor: selectedObject?.borderColor ?? '#000000' }}></div>
          </label>
          <Input 
            type="text" 
            className="flex-1 h-8 text-xs uppercase"
            value={selectedObject?.borderColor?.replace('#', '') ?? '000000'}
            onChange={(e) => handleColorChange(`#${e.target.value}`, 'borderColor')}
            onFocus={() => startDrag()}
            onBlur={() => {
              handleColorPickerEnd();
              endDrag();
            }}
          />
        </div>
      </div>

      {/* 텍스트 색상 섹션 */}
      {selectedObject?.type === 'room' && (
        <div className="px-4 py-3">
          <h5 className="text-xs text-gray-500 mb-2">텍스트</h5>
          <div className="flex items-center gap-2">
            <label 
              htmlFor="textColor"
              className="w-8 h-8 rounded-md border border-(--input) cursor-pointer p-1 relative"
            >
              <input 
                type="color" 
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                value={selectedObject?.textColor ?? '#000000'}
                onChange={(e) => handleColorChange(e.target.value, 'textColor')}
                onMouseUp={handleColorPickerEnd}
                onBlur={handleColorPickerEnd}
                id="textColor"
              />
              <div className="w-full h-full rounded-[3px]" style={{ backgroundColor: selectedObject?.textColor ?? '#000000' }}></div>
            </label>
            <Input 
              type="text" 
              className="flex-1 h-8 text-xs uppercase"
              value={selectedObject?.textColor?.replace('#', '') ?? '000000'}
              onChange={(e) => handleColorChange(`#${e.target.value}`, 'textColor')}
              onFocus={() => startDrag()}
              onBlur={() => {
                handleColorPickerEnd();
                endDrag();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
