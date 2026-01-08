import { cn } from "@/lib/utils" // shadcn 설치시 기본 제공됨
import { ComponentPropsWithoutRef } from "react"

// button 태그가 가진 모든 속성을 상속받음
interface ToolbarButtonProps extends ComponentPropsWithoutRef<"button"> {
  children: React.ReactNode
  isActive?: boolean
}
export default function ToolbarButton({ 
  children, 
  className,
  isActive,
  ...props
}: ToolbarButtonProps) {
  return (
    <button 
      {...props}
      className={cn(
        // 기본 스타일 (공통)
        "bg-white flex flex-col items-center justify-center gap-1 w-15 h-15 text-xs rounded-sm font-semibold transition-colors hover:bg-blue-400 hover:text-white",
        isActive && "bg-blue-500 text-white",
        className // 외부에서 들어온 스타일로 덮어쓰기 가능
      )}
    >
      {children}
    </button>
  )
}