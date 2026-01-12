'use client';

import Canvas from "@/components/editor/Canvas";
import Toolbar from "@/components/editor/Toolbar";
import InfoPanel from "@/components/editor/InfoPanel";

import { useEditorStore } from "@/store/useEditorSotre";

export default function Editor() {
  const { selectedObject } = useEditorStore();
  return (
    <div className="w-screen h-screen relative">
      <Canvas />
      <Toolbar />
      {selectedObject && <InfoPanel />}
    </div>
  )
}