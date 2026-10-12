import React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TableInfoProps } from "./types";

export const TableInfo = ({
  list = [10, 15, 20, 25],
  total = 0,
  displayed = 10,
  onChangeDisplayed = () => {},
  className,
  label = "Menampilkan",
}: TableInfoProps) => {
  const handleValueChange = (value: string) => {
    if (typeof onChangeDisplayed === "function") {
      onChangeDisplayed(Number(value));
    }
  };

  return (
    <div className={cn("flex items-center space-x-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-nunito", className)}>
      <span>{label}</span>
      <Select value={String(displayed)} onValueChange={handleValueChange}>
        <SelectTrigger className="!h-8 w-[68px] text-xs font-semibold py-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus-visible:ring-1 focus-visible:ring-teal-600/40 rounded-lg">
          <SelectValue placeholder={String(displayed)} />
        </SelectTrigger>
        <SelectContent className="w-fit min-w-fit bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
          {list.map((num) => (
            <SelectItem key={num} value={String(num)} className="text-xs cursor-pointer">
              {num}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span>
        dari <span className="font-semibold text-slate-800 dark:text-slate-200">{total}</span> data
      </span>
    </div>
  );
};

export default TableInfo;
