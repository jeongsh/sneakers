"use client";
import { useState } from "react";
import BuildPanel from "./BuildPanel";
import FurniturePanel from "./FurniturePanel";
import ToolbarButton from "./ToolbarButton";
import { HousePlusIcon, ArmchairIcon } from "lucide-react";

const PANELS = {
  build: <BuildPanel />,
  furniture: <FurniturePanel />,
}
type ToolType = keyof typeof PANELS;

export default function Toolbar() {
  const [activeTool, setActiveTool] = useState<ToolType>("build");

  return (
    <div className="absolute top-0 left-0 h-full">
      <div className="relative flex items-start h-full">
        <div className="bg-(--sidebar) border-l border-gray-200 shadow-lg p-2 h-full">
          <ToolbarButton isActive={activeTool === "build"} onClick={() => setActiveTool("build")} className="mb-1">
            <HousePlusIcon className="size-6"/>
            빌드
          </ToolbarButton>
          <ToolbarButton isActive={activeTool === "furniture"} onClick={() => setActiveTool("furniture")}>
            <ArmchairIcon className="size-6"/>
            가구
          </ToolbarButton>
        </div>
        {PANELS[activeTool]}
      </div>
    </div>
  )
}