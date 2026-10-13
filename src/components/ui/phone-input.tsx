"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface Country {
  code: string
  name: string
  dialCode: string
  flag: string
}

export const COUNTRIES: Country[] = [
  { code: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩" },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾" },
  { code: "SG", name: "Singapura", dialCode: "+65", flag: "🇸🇬" },
  { code: "BN", name: "Brunei", dialCode: "+673", flag: "🇧🇳" },
  { code: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭" },
  { code: "PH", name: "Filipina", dialCode: "+63", flag: "🇵🇭" },
  { code: "VN", name: "Vietnam", dialCode: "+84", flag: "🇻🇳" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "US", name: "Amerika Serikat", dialCode: "+1", flag: "🇺🇸" },
  { code: "GB", name: "Inggris (UK)", dialCode: "+44", flag: "🇬🇧" },
  { code: "JP", name: "Jepang", dialCode: "+81", flag: "🇯🇵" },
  { code: "KR", name: "Korea Selatan", dialCode: "+82", flag: "🇰🇷" },
  { code: "SA", name: "Arab Saudi", dialCode: "+966", flag: "🇸🇦" },
  { code: "AE", name: "Uni Emirat Arab", dialCode: "+971", flag: "🇦🇪" },
  { code: "DE", name: "Jerman", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "Prancis", dialCode: "+33", flag: "🇫🇷" },
  { code: "NL", name: "Belanda", dialCode: "+31", flag: "🇳🇱" },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "TR", name: "Turki", dialCode: "+90", flag: "🇹🇷" },
]

export interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onValueChange?: (value: string, country: Country) => void
  defaultCountry?: string
}

function parsePhoneNumber(
  value: string | undefined,
  defaultCountryCode = "ID"
): { country: Country; number: string } {
  const defaultCountry =
    COUNTRIES.find((c) => c.code === defaultCountryCode) || COUNTRIES[0]

  if (!value) {
    return { country: defaultCountry, number: "" }
  }

  const trimmed = value.trim()

  if (trimmed.startsWith("+")) {
    const sorted = [...COUNTRIES].sort(
      (a, b) => b.dialCode.length - a.dialCode.length
    )
    for (const c of sorted) {
      if (trimmed.startsWith(c.dialCode)) {
        return {
          country: c,
          number: trimmed.slice(c.dialCode.length).trim(),
        }
      }
    }
  }

  if (trimmed.startsWith("08")) {
    return { country: defaultCountry, number: trimmed.slice(1) }
  }

  return { country: defaultCountry, number: trimmed }
}

function formatFullValue(country: Country, rawNumber: string): string {
  const cleaned = rawNumber.trim().replace(/[\s-]/g, "")
  if (!cleaned) return ""
  const national = cleaned.replace(/^0+/, "")
  return `${country.dialCode}${national}`
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      className,
      value,
      onChange,
      onValueChange,
      defaultCountry = "ID",
      disabled,
      placeholder,
      id,
      ...props
    },
    ref
  ) => {
    const initialParsed = React.useMemo(
      () => parsePhoneNumber(value, defaultCountry),
      [] // eslint-disable-line react-hooks/exhaustive-deps
    )

    const [selectedCountry, setSelectedCountry] = React.useState<Country>(
      initialParsed.country
    )
    const [phoneNumber, setPhoneNumber] = React.useState<string>(
      initialParsed.number
    )
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")
    const lastEmittedValue = React.useRef<string | undefined>(value)

    React.useEffect(() => {
      if (value !== undefined && value !== lastEmittedValue.current) {
        const parsed = parsePhoneNumber(value, defaultCountry)
        setSelectedCountry(parsed.country)
        setPhoneNumber(parsed.number)
        lastEmittedValue.current = value
      }
    }, [value, defaultCountry])

    const filteredCountries = React.useMemo(() => {
      const q = search.trim().toLowerCase()
      if (!q) return COUNTRIES
      return COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.dialCode.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q)
      )
    }, [search])

    const emitChange = (
      fullVal: string,
      country: Country,
      originalEvent?: React.ChangeEvent<HTMLInputElement>
    ) => {
      if (onChange) {
        const syntheticEvent = {
          ...(originalEvent || {}),
          target: {
            ...(originalEvent?.target || {}),
            value: fullVal,
            name: props.name,
            id,
          },
          currentTarget: {
            ...(originalEvent?.currentTarget || {}),
            value: fullVal,
            name: props.name,
            id,
          },
        } as React.ChangeEvent<HTMLInputElement>
        onChange(syntheticEvent)
      }
      onValueChange?.(fullVal, country)
    }

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value

      if (raw.trim().startsWith("+")) {
        const parsed = parsePhoneNumber(raw, selectedCountry.code)
        setSelectedCountry(parsed.country)
        setPhoneNumber(parsed.number)

        const fullVal = formatFullValue(parsed.country, parsed.number)
        lastEmittedValue.current = fullVal
        emitChange(fullVal, parsed.country, e)
        return
      }

      const filtered = raw.replace(/[^0-9\s-]/g, "")
      setPhoneNumber(filtered)

      const fullVal = formatFullValue(selectedCountry, filtered)
      lastEmittedValue.current = fullVal
      emitChange(fullVal, selectedCountry, e)
    }

    const handleCountrySelect = (country: Country) => {
      setSelectedCountry(country)
      setOpen(false)
      setSearch("")

      const fullVal = formatFullValue(country, phoneNumber)
      lastEmittedValue.current = fullVal

      const syntheticEvent = {
        target: { value: fullVal, name: props.name, id },
        currentTarget: { value: fullVal, name: props.name, id },
      } as React.ChangeEvent<HTMLInputElement>

      onChange?.(syntheticEvent)
      onValueChange?.(fullVal, country)
    }

    return (
      <div
        className={cn(
          "border-input dark:bg-input/30 relative flex h-9 w-full min-w-0 items-center rounded-md border bg-transparent text-base shadow-xs transition-[color,box-shadow] md:text-sm",
          "focus-within:border-primary focus-within:ring-primary/30 focus-within:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          "hover:border-primary/50 transition-all duration-200",
          disabled && "pointer-events-none opacity-50 cursor-not-allowed",
          className
        )}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="flex h-full items-center gap-1.5 border-r border-inherit bg-transparent px-2.5 py-0 text-xs sm:text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:bg-black/5 dark:focus-visible:bg-white/5 transition-colors shrink-0 cursor-pointer select-none rounded-l-[inherit] disabled:cursor-not-allowed"
              aria-label={`Pilih negara: ${selectedCountry.name} (${selectedCountry.dialCode})`}
            >
              <span className="text-base leading-none select-none">
                {selectedCountry.flag}
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 select-none">
                {selectedCountry.dialCode}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground opacity-60 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72 p-0 shadow-lg rounded-xl z-50 bg-popover text-popover-foreground border-border"
            align="start"
          >
            <div className="p-2 border-b border-border/60">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari negara atau kode (+62)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 rounded-md border border-input outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto p-1 text-xs">
              {filteredCountries.length === 0 ? (
                <div className="p-3 text-center text-muted-foreground text-xs">
                  Negara tidak ditemukan
                </div>
              ) : (
                filteredCountries.map((c) => {
                  const isSelected = c.code === selectedCountry.code
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleCountrySelect(c)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                        isSelected && "bg-accent/60 font-semibold text-primary"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base leading-none">{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        <span className="text-muted-foreground font-mono">
                          {c.dialCode}
                        </span>
                        {isSelected && <Check className="size-3.5 text-primary" />}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </PopoverContent>
        </Popover>

        <input
          ref={ref}
          id={id}
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneChange}
          placeholder={placeholder || "812 3456 7890"}
          disabled={disabled}
          className="flex-1 h-full w-full min-w-0 bg-transparent px-3 py-1 text-inherit shadow-none outline-none border-0 placeholder:text-foreground/40 disabled:cursor-not-allowed rounded-r-[inherit]"
          {...props}
        />
      </div>
    )
  }
)

PhoneInput.displayName = "PhoneInput"

export { PhoneInput }
