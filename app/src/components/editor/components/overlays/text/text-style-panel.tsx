import React from "react";
import { TextOverlay } from "../../../types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ColorPicker from "react-best-gradient-color-picker";

const fonts = [
  { value: "font-sans", label: "Inter" },
  { value: "font-serif", label: "Merriweather" },
  { value: "font-mono", label: "Roboto Mono" },
  { value: "font-retro", label: "VT323" },
];

interface TextStylePanelProps {
  localOverlay: TextOverlay;
  handleInputChange: (field: keyof TextOverlay, value: string) => void;
  handleStyleChange: (field: keyof TextOverlay["styles"], value: any) => void;
}

export const TextStylePanel: React.FC<TextStylePanelProps> = ({
  localOverlay,
  handleStyleChange,
}) => {
  return (
    <div className="space-y-3">
      {/* Font */}
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">Font</span>
        <Select
          value={localOverlay.styles.fontFamily}
          onValueChange={(value) => handleStyleChange("fontFamily", value)}
        >
          <SelectTrigger className="h-8 text-xs w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fonts.map((font) => (
              <SelectItem key={font.value} value={font.value} className={`${font.value} text-xs`}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Font Size */}
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">Size</span>
        <div className="flex items-center gap-2 w-[140px]">
          <Slider
            value={[parseInt(localOverlay.styles.fontSize) || 48]}
            min={12}
            max={200}
            step={1}
            onValueChange={([v]) => handleStyleChange("fontSize", `${v}px`)}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-7 text-right tabular-nums">
            {parseInt(localOverlay.styles.fontSize) || 48}
          </span>
        </div>
      </div>

      {/* Alignment */}
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">Align</span>
        <ToggleGroup
          type="single"
          className="gap-1"
          value={localOverlay.styles.textAlign}
          onValueChange={(value) => {
            if (value) handleStyleChange("textAlign", value);
          }}
        >
          <ToggleGroupItem value="left" aria-label="Align left" className="h-8 w-8">
            <AlignLeft className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Align center" className="h-8 w-8">
            <AlignCenter className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Align right" className="h-8 w-8">
            <AlignRight className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Colors */}
      {!localOverlay.styles.WebkitBackgroundClip ? (
        <>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm text-muted-foreground">Color</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="h-7 w-7 rounded-md border border-border cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                  style={{ backgroundColor: localOverlay.styles.color }}
                />
              </PopoverTrigger>
              <PopoverContent className="w-[280px] bg-popover border border-border" side="left">
                <ColorPicker
                  value={localOverlay.styles.color}
                  onChange={(color) => handleStyleChange("color", color)}
                  hideInputs hideHue hideControls hideColorTypeBtns hideAdvancedSliders hideColorGuide hideInputType
                  height={180}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm text-muted-foreground">Background</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="h-7 w-7 rounded-md border border-border cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                  style={{ backgroundColor: localOverlay.styles.backgroundColor }}
                />
              </PopoverTrigger>
              <PopoverContent className="w-[280px] bg-popover border border-border" side="left">
                <ColorPicker
                  value={localOverlay.styles.backgroundColor}
                  onChange={(color) => handleStyleChange("backgroundColor", color)}
                  hideInputs hideHue hideControls hideColorTypeBtns hideAdvancedSliders hideColorGuide hideInputType
                  height={180}
                />
              </PopoverContent>
            </Popover>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Colors unavailable for gradient text
        </p>
      )}
    </div>
  );
};
