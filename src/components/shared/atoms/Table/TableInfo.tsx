import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PaginationInfoProps {
  total: number
  displayed: number
  onChangeDisplayed?: (value: number) => void
  className?: string
  list?: number[]
}

const PaginationInfo = ({
  list = [10, 15, 20, 25],
  total = 0,
  displayed = 10,
  onChangeDisplayed = () => { },
  className,
}: PaginationInfoProps) => {
  const handleValueChange = (value: string) => {
    if (typeof onChangeDisplayed === "function") {
      onChangeDisplayed(Number(value))
    }
  }

  return (
    <div className={cn("flex items-center space-x-2 w-full", className)}>
      <span className="text-sm text-neutral-800">Displaying</span>
      <Select value={String(displayed)} onValueChange={handleValueChange}>
        <SelectTrigger className="!h-10 w-[70px] text-sm py-0 focus-visible:border-border focus-visible:outline-0 focus-visible:ring-0 ">
          <SelectValue placeholder={String(displayed)} />
        </SelectTrigger>
        <SelectContent className="w-fit min-w-fit">
          {list.map((num) => (
            <SelectItem key={num} value={String(num)}>
              {num}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-sm text-neutral-800">
        of {total} {total === 1 ? "item" : "items"}
      </span>
    </div>
  )
}

export default PaginationInfo

