import { create } from 'zustand';
import { FLOOR_PLAN_CONFIG, pxToCm } from '@/lib/floorPlanConstants';

export interface Point {
  x: number;
  y: number;
}

// 오브젝트 타입 정의 (방, 문, 창문 등)
export type ObjectType = 'room' | 'door' | 'window' | 'furniture';

// 각 타입별 프리셋 정의
export type RoomPreset = 'square' | 'l-shape' | 't-shape';
export type DoorPreset = 'single' | 'double' | 'sliding';
export type WindowPreset = 'small' | 'medium' | 'large';
export type FurniturePreset = 'sofa' | 'bed' | 'table' | 'chair';

// 공통 베이스 인터페이스
export interface FloorObject {
  id: string;
  type: ObjectType;
  name: string;
  x: number;      // 오브젝트의 기준점 (좌상단)
  y: number;
  points: Point[]; // 형상을 정의하는 꼭짓점 (상대 좌표)
  color: string;
  borderColor: string;
  textColor?: string; // 텍스트 색상
  rotation?: number;  // 회전 각도 (문, 창문용)
  width?: number;     // 너비 (문, 창문용)
  height?: number;    // 높이 (창문용)
  attachedTo?: string; // 부착된 오브젝트 ID (문, 창문이 벽에 붙을 때)
  edgeIndex?: number; // 부착된 벽의 edge 인덱스 (문용)
  positionOnWall?: number; // 벽 위의 위치 (0~1 사이의 비율, 문용)
  doorOpenDirection?: number; // 문 열리는 방향 (1: 방 안으로, -1: 방 밖으로)
}

interface EditorState {
  objects: FloorObject[];
  objectHistory: FloorObject[][];  // 히스토리 배열 (과거 상태들 저장)
  historyIndex: number;            // 현재 히스토리 위치 (undo/redo용)
  isUndoRedo: boolean;             // undo/redo 중인지 플래그 (무한루프 방지)
  isHistoryPaused: boolean;        // 드래그 중일 때 히스토리 저장 멈춤
  snapshotBeforeDrag: FloorObject[] | null;  // 드래그 시작 전 상태 저장
  selectedObject: FloorObject | null;
  setSelectedObject: (object: FloorObject | null) => void;
  setObjects: (objects: FloorObject[]) => void;
  addRoom: (preset: RoomPreset, x: number, y: number) => void;
  addDoor: (preset: DoorPreset, x: number, y: number, attachedTo?: string, rotation?: number, edgeIndex?: number, positionOnWall?: number) => void;
  addWindow: (preset: WindowPreset, x: number, y: number) => void;
  addFurniture: (preset: FurniturePreset, x: number, y: number) => void;
  changeObjectInfo: (key: keyof FloorObject, value: string | number | Point[]) => void;
  setObjectHistory: (history: FloorObject[][]) => void;
  undo: () => void;                // 실행 취소
  redo: () => void;                // 다시 실행
  startDrag: () => void;           // 드래그 시작 (히스토리 저장 멈춤)
  endDrag: () => void;             // 드래그 끝 (히스토리에 저장)
}

const MAX_HISTORY = 10; // 히스토리 최대 개수 (메모리 관리)

export const useEditorStore = create<EditorState>((set, get) => ({
  objects: [],
  objectHistory: [],
  historyIndex: -1,      // -1이면 히스토리 없음
  isUndoRedo: false,     // undo/redo 중에는 히스토리 추가 안 함
  isHistoryPaused: false,         // 드래그 중이면 true
  snapshotBeforeDrag: null,       // 드래그 시작 전 objects 상태
  selectedObject: null,
  setSelectedObject: (object) => set({ selectedObject: object }),
  setObjects: (objects) => set({ objects }),
  setObjectHistory: (history) => set({ objectHistory: history }),
  
  // 드래그 시작할 때 호출 - 현재 상태 스냅샷 찍고 히스토리 저장 멈춤
  startDrag: () => {
    const { objects } = get();
    set({ 
      isHistoryPaused: true,
      snapshotBeforeDrag: JSON.parse(JSON.stringify(objects)), // 깊은 복사
    });
  },
  
  // 드래그 끝날 때 호출 - 스냅샷을 히스토리에 저장
  endDrag: () => {
    const { snapshotBeforeDrag, objectHistory, historyIndex, objects } = get();
    
    if (snapshotBeforeDrag) {
      let newHistory: FloorObject[][];
      
      // 첫 번째 변경인 경우 (historyIndex === -1), 초기 상태와 현재 상태 둘 다 저장
      if (historyIndex === -1) {
        newHistory = [
          snapshotBeforeDrag, // 드래그 시작 전 상태 (초기 상태)
          objects,            // 드래그 후 현재 상태
        ];
      } else {
        newHistory = [
          ...objectHistory.slice(0, historyIndex + 1),
          objects, // 드래그 후 현재 상태 저장
        ];
      }
      
      newHistory = newHistory.slice(-MAX_HISTORY);
      
      set({
        isHistoryPaused: false,
        snapshotBeforeDrag: null,
        objectHistory: newHistory,
        historyIndex: newHistory.length - 1,
      });
    } else {
      set({ isHistoryPaused: false });
    }
  },
  
  // 실행 취소 (Ctrl+Z)
  undo: () => {
    const { objectHistory, historyIndex, selectedObject } = get();
    if (historyIndex <= 0) return; // historyIndex가 0 이하면 더 이상 undo할 게 없음 (0은 초기 상태)
    
    const restoredObjects = objectHistory[historyIndex - 1]; // 이전 상태 복원
    // selectedObject도 복원된 objects에서 찾아서 업데이트 (InfoPanel 동기화)
    const restoredSelectedObject = selectedObject 
      ? restoredObjects.find(obj => obj.id === selectedObject.id) ?? null
      : null;
    
    set({ isUndoRedo: true }); // 플래그 켜서 subscribe에서 히스토리 추가 안 하게
    set({ 
      objects: restoredObjects,
      selectedObject: restoredSelectedObject,
      historyIndex: historyIndex - 1,
    });
    set({ isUndoRedo: false });
  },
  
  // 다시 실행 (Ctrl+Y / Ctrl+Shift+Z)
  redo: () => {
    const { objectHistory, historyIndex, selectedObject } = get();
    if (historyIndex >= objectHistory.length - 1) return; // 더 이상 redo할 게 없음
    
    const restoredObjects = objectHistory[historyIndex + 1];
    // selectedObject도 복원된 objects에서 찾아서 업데이트 (InfoPanel 동기화)
    const restoredSelectedObject = selectedObject 
      ? restoredObjects.find(obj => obj.id === selectedObject.id) ?? null
      : null;
    
    set({ isUndoRedo: true });
    set({ 
      objects: restoredObjects,
      selectedObject: restoredSelectedObject,
      historyIndex: historyIndex + 1,
    });
    set({ isUndoRedo: false });
  },
  // 방 추가
  addRoom: (preset, x, y) => {
    const id = crypto.randomUUID();
    let points: Point[] = [];
    let name = '';

    switch (preset) {
      case 'square':
      points = [
        { x: 0, y: 0 }, { x: FLOOR_PLAN_CONFIG.DEFAULT_ROOM_SIZE, y: 0 }, 
        { x: FLOOR_PLAN_CONFIG.DEFAULT_ROOM_SIZE, y: FLOOR_PLAN_CONFIG.DEFAULT_ROOM_SIZE }, 
        { x: 0, y: FLOOR_PLAN_CONFIG.DEFAULT_ROOM_SIZE }
      ];
        name = '정사각형 방';
        break;
      case 'l-shape':
      points = [
        { x: 0, y: 0 }, { x: FLOOR_PLAN_CONFIG.DEFAULT_ROOM_SIZE, y: 0 }, 
        { x: FLOOR_PLAN_CONFIG.DEFAULT_ROOM_SIZE, y: 100 }, 
        { x: 100, y: 100 }, 
        { x: 100, y: 200 }, 
        { x: 0, y: 200 }
      ];
        name = 'L자형 방';
        break;
      case 't-shape':
      points = [
        { x: 0, y: 0 }, { x: FLOOR_PLAN_CONFIG.DEFAULT_ROOM_SIZE, y: 0 }, 
        { x: FLOOR_PLAN_CONFIG.DEFAULT_ROOM_SIZE, y: 100 },
        { x: 150, y: 100 }, { x: 150, y: 200 }, { x: 50, y: 200 },
        { x: 50, y: 100 }, { x: 0, y: 100 }
      ];
        name = 'T자형 방';
        break;
    }

    const newObject: FloorObject = {
      id,
      type: 'room',
      name,
      x,
      y,
      points,
      color: '#BC916B',
      borderColor: '#000000',
      textColor: '#000000',
    };

    set((state) => ({ objects: [...state.objects, newObject] }));
  },

  // 문 추가
  addDoor: (preset, x, y, attachedTo?: string, rotation?: number, edgeIndex?: number, positionOnWall?: number) => {
    const id = crypto.randomUUID();
    let points: Point[] = [];
    let name = '';
    let width = 0;
    const doorHeight = pxToCm(FLOOR_PLAN_CONFIG.DRAG_SIZE_OFFSET); // 문 높이를 DRAG_SIZE_OFFSET로 설정

    switch (preset) {
      case 'single':
        points = [
          { x: 0, y: 0 }, { x: 80, y: 0 }, 
          { x: 80, y: doorHeight }, { x: 0, y: doorHeight }
        ];
        name = '단일문';
        width = 80;
        break;
      case 'double':
        points = [
          { x: 0, y: 0 }, { x: 160, y: 0 }, 
          { x: 160, y: doorHeight }, { x: 0, y: doorHeight }
        ];
        name = '양문';
        width = 160;
        break;
      case 'sliding':
        points = [
          { x: 0, y: 0 }, { x: 120, y: 0 }, 
          { x: 120, y: doorHeight }, { x: 0, y: doorHeight }
        ];
        name = '미닫이문';
        width = 120;
        break;
    }

    const newObject: FloorObject = {
      id,
      type: 'door',
      name,
      x,
      y,
      points,
      color: '#fff',
      width,
      rotation: rotation ?? 0,
      borderColor: '#fff',
      textColor: '#000000',
      attachedTo: attachedTo,
      edgeIndex: edgeIndex,
      positionOnWall: positionOnWall,
      doorOpenDirection: 1, // 기본값: 방 안으로 열림
    };

    set((state) => ({ objects: [...state.objects, newObject] }));
  },

  // 창문 추가
  addWindow: (preset, x, y) => {
    const id = crypto.randomUUID();
    let points: Point[] = [];
    let name = '';
    let width = 0;

    switch (preset) {
      case 'small':
        points = [
          { x: 0, y: 0 }, { x: 60, y: 0 }, 
          { x: 60, y: 8 }, { x: 0, y: 8 }
        ];
        name = '작은 창문';
        width = 60;
        break;
      case 'medium':
        points = [
          { x: 0, y: 0 }, { x: 100, y: 0 }, 
          { x: 100, y: 8 }, { x: 0, y: 8 }
        ];
        name = '중간 창문';
        width = 100;
        break;
      case 'large':
        points = [
          { x: 0, y: 0 }, { x: 150, y: 0 }, 
          { x: 150, y: 8 }, { x: 0, y: 8 }
        ];
        name = '큰 창문';
        width = 150;
        break;
    }

    const newObject: FloorObject = {
      id,
      type: 'window',
      name,
      x,
      y,
      points,
      color: '#A1C2F1',
      width,
      rotation: 0,
      borderColor: '#000000',
      textColor: '#000000',
    };

    set((state) => ({ objects: [...state.objects, newObject] }));
  },

  // 가구 추가
  addFurniture: (preset, x, y) => {
    const id = crypto.randomUUID();
    let points: Point[] = [];
    let name = '';

    switch (preset) {
      case 'sofa':
        points = [
          { x: 0, y: 0 }, { x: 180, y: 0 }, 
          { x: 180, y: 80 }, { x: 0, y: 80 }
        ];
        name = '소파';
        break;
      case 'bed':
        points = [
          { x: 0, y: 0 }, { x: 150, y: 0 }, 
          { x: 150, y: 200 }, { x: 0, y: 200 }
        ];
        name = '침대';
        break;
      case 'table':
        points = [
          { x: 0, y: 0 }, { x: 120, y: 0 }, 
          { x: 120, y: 80 }, { x: 0, y: 80 }
        ];
        name = '테이블';
        break;
      case 'chair':
        points = [
          { x: 0, y: 0 }, { x: 50, y: 0 }, 
          { x: 50, y: 50 }, { x: 0, y: 50 }
        ];
        name = '의자';
        break;
    }

    const newObject: FloorObject = {
      id,
      type: 'furniture',
      name,
      x,
      y,
      points,
      color: '#D2B48C',
      rotation: 0,
      borderColor: '#000000',
      textColor: '#000000',
    };

    set((state) => ({ objects: [...state.objects, newObject] }));
  },
  // 선택된 방 정보 수정 (selectedObject랑 objects 배열 둘 다 업데이트)
  changeObjectInfo: (key: keyof FloorObject, value: string | number | Point[]) => {
    set((state) => {
      if (!state.selectedObject) return state;
      
      const updatedObject = { ...state.selectedObject, [key]: value } as FloorObject;
      
      return {
        selectedObject: updatedObject,
        objects: state.objects.map(obj => 
          obj.id === state.selectedObject!.id ? updatedObject : obj
        ),
      };
    });
  },
}));

/**
 * Vue의 watch처럼 objects 변화를 감지하는 subscribe
 * 
 * subscribe(callback)는 상태가 바뀔 때마다 호출됨
 * - state: 새로운 상태
 * - prevState: 이전 상태
 * 
 * 이걸로 objects가 바뀔 때마다 이전 상태를 히스토리에 저장
 */
useEditorStore.subscribe((state, prevState) => {
  // undo/redo 중이거나 드래그 중이면 히스토리 추가 안 함
  if (state.isUndoRedo) return;
  if (state.isHistoryPaused) return;  // 드래그 중엔 저장 안 함
  
  // objects가 실제로 바뀌었는지 체크 (레퍼런스 비교)
  if (state.objects === prevState.objects) return;
  
  // 현재 상태를 히스토리에 저장
  // historyIndex + 1까지만 유지 (그 이후는 redo 히스토리이므로 버림)
  // 히스토리에는 [초기, 좌, 우, 위, 아래] 형태로 현재 상태들이 저장됨
  let newHistory: FloorObject[][];
  
  // 첫 번째 변경인 경우 (historyIndex === -1), 초기 상태(prevState)와 현재 상태 둘 다 저장
  if (state.historyIndex === -1) {
    newHistory = [
      prevState.objects, // 초기 상태 저장
      state.objects,     // 현재 상태 저장
    ];
  } else {
    newHistory = [
      ...state.objectHistory.slice(0, state.historyIndex + 1),
      state.objects, // 변경 후 현재 상태 저장
    ];
  }
  
  newHistory = newHistory.slice(-MAX_HISTORY); // 최대 개수 제한
  
  useEditorStore.setState({
    objectHistory: newHistory,
    historyIndex: newHistory.length - 1, // 현재 상태의 인덱스
  });
});
