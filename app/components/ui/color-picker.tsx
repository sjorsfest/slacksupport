import { useState, useRef, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  description?: string;
  className?: string;
}

export function ColorPicker({ value, onChange, label, description, className }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-sm font-medium leading-none">{label}</label>}
      
      <div className="flex gap-3 items-center">
        {/* Color Swatch Trigger */}
        <div className="relative">
          <div
            ref={triggerRef}
            onClick={() => setIsOpen(!isOpen)}
            className="w-14 h-14 rounded-2xl shadow-lg ring-4 ring-white hover:scale-110 hover:rotate-3 transition-all duration-300 cursor-pointer relative"
            style={{ backgroundColor: value }}
          >
            <div className="absolute inset-0 rounded-2xl ring-1 ring-black/10" />
          </div>

          {/* Popover */}
          {isOpen && (
            <div
              ref={popoverRef}
              className="absolute top-full left-0 mt-2 z-[100] animate-in fade-in-0 zoom-in-95 duration-200"
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-border/50 p-4 space-y-4">
                {/* Color Picker */}
                <HexColorPicker color={value} onChange={onChange} />
                
                {/* Preset Colors */}
                <div className="flex flex-wrap gap-2">
                  {[
                    "#FF4FA3", "#e6c13b", "#36c5f0", "#f59e0b", 
                    "#10b981", "#8b5cf6", "#ef4444", "#1f2937"
                  ].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => onChange(preset)}
                      className={cn(
                        "w-7 h-7 rounded-lg transition-all hover:scale-110 ring-2",
                        value.toLowerCase() === preset.toLowerCase() 
                          ? "ring-secondary shadow-md" 
                          : "ring-transparent hover:ring-border"
                      )}
                      style={{ backgroundColor: preset }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hex Input */}
        <div className="flex-1 space-y-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="font-mono uppercase text-sm bg-muted/30"
            maxLength={7}
          />
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
