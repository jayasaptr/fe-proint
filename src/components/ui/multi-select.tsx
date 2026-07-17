import { Check, ChevronDown, X } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Option {
  label: string;
  value: string;
}

export interface OptionGroup {
  heading: string;
  options: Option[];
}

interface MultiSelectProps {
  options?: Option[];
  groups?: OptionGroup[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxCount?: number;
  maxSelection?: number;
}

export function MultiSelect({
  options: optionsProp = [],
  groups,
  selected,
  onChange,
  placeholder = "Pilih opsi...",
  className,
  disabled = false,
  maxCount = 1,
  maxSelection,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const safeSelected = Array.isArray(selected) ? selected : [];

  // Flatten semua opsi untuk badge rendering
  const allOptions: Option[] = groups
    ? groups.flatMap((g) => g.options)
    : optionsProp;

  const handleUnselect = (item: string) => {
    onChange(safeSelected.filter((i) => i !== item));
  };

  const renderItems = (opts: Option[]) =>
    opts.map((option) => {
      const isSelected = safeSelected.includes(option.value);
      const isDisabled =
        !isSelected &&
        maxSelection !== undefined &&
        safeSelected.length >= maxSelection;
      return (
        <CommandItem
          key={option.value}
          disabled={isDisabled}
          className={cn(isDisabled && "opacity-50 cursor-not-allowed")}
          onSelect={() => {
            if (isDisabled) return;
            onChange(
              isSelected
                ? safeSelected.filter((item) => item !== option.value)
                : [...safeSelected, option.value],
            );
          }}
        >
          <div
            className={cn(
              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
              isSelected
                ? "bg-slate-900 text-white"
                : "opacity-50 [&_svg]:invisible",
            )}
          >
            <Check className={cn("h-4 w-4")} />
          </div>
          {option.label}
        </CommandItem>
      );
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex w-full h-10 items-center justify-between gap-2 rounded-md border-0 bg-white dark:bg-slate-900 px-3 py-2 text-sm shadow-none transition-all outline-none focus:ring-2 focus:ring-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <div className="flex flex-1 items-center gap-1.5 min-w-0 overflow-hidden">
            {safeSelected.length === 0 && (
              <span className="text-slate-500 dark:text-slate-400 truncate font-normal">
                {placeholder}
              </span>
            )}
            {safeSelected.slice(0, maxCount).map((item) => {
              const option = allOptions.find((o) => o.value === item);
              return (
                <Badge
                  key={item}
                  variant="secondary"
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 font-medium px-2 py-0.5 h-6 flex items-center shrink-0 max-w-[120px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnselect(item);
                  }}
                >
                  <span className="truncate">{option?.label}</span>
                  <div
                    role="button"
                    tabIndex={0}
                    className="ml-1 rounded-full outline-none cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUnselect(item);
                    }}
                  >
                    <X className="h-3 w-3 text-slate-500 hover:text-slate-800 dark:text-slate-400" />
                  </div>
                </Badge>
              );
            })}
            {safeSelected.length > maxCount && (
              <Badge
                variant="secondary"
                className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium px-2 py-0.5 h-6 flex items-center shrink-0"
              >
                +{safeSelected.length - maxCount}
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50 text-slate-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari..." />
          <CommandList>
            <CommandEmpty>Tidak ada hasil.</CommandEmpty>
            {groups ? (
              groups.map((group) => (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {renderItems(group.options)}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>
                {!maxSelection && (
                  <CommandItem
                    onSelect={() => {
                      if (safeSelected.length === allOptions.length) {
                        onChange([]);
                      } else {
                        onChange(allOptions.map((o) => o.value));
                      }
                    }}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        safeSelected.length === allOptions.length
                          ? "bg-slate-900 text-white"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    Pilih Semua
                  </CommandItem>
                )}
                {renderItems(allOptions)}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
