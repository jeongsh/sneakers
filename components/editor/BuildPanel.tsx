import Image from "next/image";
import { useEditorStore } from "@/store/useEditorSotre";

export default function BuildPanel() {
  const handleDragStart = (e: React.DragEvent, type: string) => {
    // 드래그하는 데이터의 타입을 저장
    e.dataTransfer.setData("presetType", type);
  };
  return (
    <div className="bg-white h-full p-4 w-56">
      <h2 className="text-lg font-bold mb-4">빌드</h2>
      <div className="grid grid-col gap-2">
        <div className="mb-6">
          <p className="text-sm font-medium mb-4">방 그리기</p>
          <div className="grid grid-cols-3 gap-2">
            <button 
              className="flex items-center justify-center gap-2 flex-col"
              onDragStart={(e) => handleDragStart(e, "square")}
              draggable={true}
            >
              <Image src="/images/room-s.svg" alt="square" width={32} height={32} />
              <span className="text-xs font-medium text-gray-600">사각형</span>
            </button>
            <button 
              className="flex items-center justify-center gap-2 flex-col"
              onDragStart={(e) => handleDragStart(e, "l-shape")}
              draggable={true}
            >
              <Image src="/images/room-l.svg" alt="l-shape" width={32} height={32} />
              <span className="text-xs font-medium text-gray-600">L자형</span>
            </button>
            <button 
              className="flex items-center justify-center gap-2 flex-col"
              onDragStart={(e) => handleDragStart(e, "t-shape")}
              draggable={true}
            >
              <Image src="/images/room-t.svg" alt="t-shape" width={32} height={32} />
              <span className="text-xs font-medium text-gray-600">T자형</span>
            </button>
          </div>
        </div>
        <div className="mb-6">
          <p className="text-sm font-medium mb-4">문 그리기</p>
          <div className="grid grid-cols-3 gap-2">
            <button 
              className="flex items-center justify-center gap-2 flex-col"
              onDragStart={(e) => handleDragStart(e, "single")}
              draggable={true}
            >
              <Image src="/images/room-s.svg" alt="square" width={32} height={32} />
              <span className="text-xs font-medium text-gray-600">문</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}