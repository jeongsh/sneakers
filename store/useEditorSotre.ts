import { create } from 'zustand';

export interface Point {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  x: number;      // 전체 방 그룹의 기준점 (좌상단)
  y: number;
  points: Point[]; // 방의 형상을 정의하는 꼭짓점 (상대 좌표)
  color: string;
}

interface EditorState {
  rooms: Room[];
  addRoom: (presetType: 'square' | 'l-shape' | 't-shape', x: number, y: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  rooms: [],
  addRoom: (presetType, x, y) => {
    const id = crypto.randomUUID();
    let points: Point[] = [];

    if (presetType === 'square') {
      points = [
        { x: 0, y: 0 }, { x: 200, y: 0 }, 
        { x: 200, y: 200 }, { x: 0, y: 200 }
      ];
    } else if (presetType === 'l-shape') {
      points = [
        { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 },
        { x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 }
      ];
    } else if (presetType === 't-shape') {
      points = [
        { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 },
        { x: 150, y: 100 }, { x: 150, y: 200 }, { x: 50, y: 200 },
        { x: 50, y: 100 }, { x: 0, y: 100 }
      ];
    }

    const newRoom: Room = {
      id,
      name: presetType === 'square' ? '정사각형 방' : presetType === 'l-shape' ? 'L자형 방' : 'T자형 방',
      x,
      y,
      points,
      color: '#E2E8F0',
    };

    set((state) => ({ rooms: [...state.rooms, newRoom] }));
  },
}));