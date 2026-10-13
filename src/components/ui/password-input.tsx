"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export type PasswordInputProps = React.ComponentProps<"input">

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    return (
      <div className="relative w-full">
        <Input
          type={showPassword ? "text" : "password"}
          className={cn("pr-10", className)}
          ref={ref}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          onMouseDown={(e) => e.preventDefault()}
          disabled={disabled}
          className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-r-[inherit] transition-colors disabled:pointer-events-none disabled:opacity-50 flex items-center justify-center cursor-pointer select-none"
          tabIndex={-1}
          aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        >
          {showPassword ? (
            <EyeOff className="size-4 shrink-0 text-muted-foreground hover:text-foreground transition-colors" aria-hidden="true" />
          ) : (
            <Eye className="size-4 shrink-0 text-muted-foreground hover:text-foreground transition-colors" aria-hidden="true" />
          )}
          <span className="sr-only">
            {showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          </span>
        </button>
      </div>
    )
  }
)

PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
