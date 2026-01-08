import Canvas from "@/components/editor/Canvas";
import Toolbar from "@/components/editor/Toolbar";

export default function Editor() {
  return (
    <div className="w-screen h-screen relative">
      <Canvas />
      <Toolbar />
    </div>
  )
}