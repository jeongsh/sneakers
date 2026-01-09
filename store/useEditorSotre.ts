import { create } from 'zustand';

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
  rotation?: number;  // 회전 각도 (문, 창문용)
  width?: number;     // 너비 (문, 창문용)
  height?: number;    // 높이 (창문용)
  attachedTo?: string; // 부착된 오브젝트 ID (문, 창문이 벽에 붙을 때)
}

interface EditorState {
  objects: FloorObject[];
  selectedObject: FloorObject | null;
  setSelectedObject: (object: FloorObject | null) => void;
  setObjects: (objects: FloorObject[]) => void;
  addRoom: (preset: RoomPreset, x: number, y: number) => void;
  addDoor: (preset: DoorPreset, x: number, y: number) => void;
  addWindow: (preset: WindowPreset, x: number, y: number) => void;
  addFurniture: (preset: FurniturePreset, x: number, y: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  objects: [],
  selectedObject: null,
  setSelectedObject: (object) => set({ selectedObject: object }),
  setObjects: (objects) => set({ objects }),

  // 방 추가
  addRoom: (preset, x, y) => {
    const id = crypto.randomUUID();
    let points: Point[] = [];
    let name = '';

    switch (preset) {
      case 'square':
        points = [
          { x: 0, y: 0 }, { x: 200, y: 0 }, 
          { x: 200, y: 200 }, { x: 0, y: 200 }
        ];
        name = '정사각형 방';
        break;
      case 'l-shape':
        points = [
          { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 },
          { x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 }
        ];
        name = 'L자형 방';
        break;
      case 't-shape':
        points = [
          { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 },
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
      color: '#E2E8F0',
    };

    set((state) => ({ objects: [...state.objects, newObject] }));
  },

  // 문 추가
  addDoor: (preset, x, y) => {
    const id = crypto.randomUUID();
    let points: Point[] = [];
    let name = '';
    let width = 0;

    switch (preset) {
      case 'single':
        points = [
          { x: 0, y: 0 }, { x: 80, y: 0 }, 
          { x: 80, y: 10 }, { x: 0, y: 10 }
        ];
        name = '단일문';
        width = 80;
        break;
      case 'double':
        points = [
          { x: 0, y: 0 }, { x: 160, y: 0 }, 
          { x: 160, y: 10 }, { x: 0, y: 10 }
        ];
        name = '양문';
        width = 160;
        break;
      case 'sliding':
        points = [
          { x: 0, y: 0 }, { x: 120, y: 0 }, 
          { x: 120, y: 10 }, { x: 0, y: 10 }
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
      color: '#8B4513',
      width,
      rotation: 0,
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
      color: '#87CEEB',
      width,
      rotation: 0,
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
      color: '#DEB887',
      rotation: 0,
    };

    set((state) => ({ objects: [...state.objects, newObject] }));
  },
}));
