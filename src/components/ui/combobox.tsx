import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
  options: Array<{ value: string; label: string; description?: string }>
  value?: string
  onSelect: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
}

// Função para normalizar texto (remover acentos e caracteres especiais)
const normalizeText = (text: string | null | undefined) => {
  return String(text ?? '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9\s]/g, "") // Remove caracteres especiais
    .trim()
}

// Função de busca flexível
const flexibleSearch = (searchTerm: string, targetText: string, description?: string) => {
  const normalizedSearch = normalizeText(searchTerm)
  const normalizedTarget = normalizeText(targetText)
  const normalizedDescription = description ? normalizeText(description) : ""
  
  if (normalizedSearch === "") return true
  
  // Busca por palavras individuais
  const searchWords = normalizedSearch.split(/\s+/)
  
  return searchWords.every(word => 
    normalizedTarget.includes(word) || 
    normalizedDescription.includes(word)
  )
}

export function Combobox({
  options,
  value,
  onSelect,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum resultado encontrado.",
  className,
  disabled = false
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)

  const MAX_OPTIONS_NO_SEARCH = 60
  const MAX_OPTIONS_WITH_SEARCH = 100

  const filteredAll = options.filter((option) =>
    flexibleSearch(searchValue, option.label, option.description)
  )
  const limit = searchValue.trim() ? MAX_OPTIONS_WITH_SEARCH : MAX_OPTIONS_NO_SEARCH
  const filteredOptions = filteredAll.slice(0, limit)
  const hasMoreResults = filteredAll.length > filteredOptions.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onSelect(option.value === value ? "" : option.value)
                    setOpen(false)
                    setSearchValue("")
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            {hasMoreResults && (
              <p className="px-3 py-2 text-xs text-muted-foreground border-t">
                Mostrando {filteredOptions.length} de {filteredAll.length}. Refine a busca para ver mais.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}