
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Image, Rainbow } from "lucide-react";
import { BackgroundConfig, GradientPreset, ImagePreset } from "../../../types";

interface BackgroundPanelProps {
  onBackgroundChange: (background: BackgroundConfig) => void;
  currentBackground?: BackgroundConfig;
}

export function BackgroundPanel({
  onBackgroundChange,
  currentBackground,
}: BackgroundPanelProps) {
  const [activeTab, setActiveTab] = useState<"color" | "gradient" | "image">(
    "color"
  );
  const [selectedColor, setSelectedColor] = useState(
    currentBackground?.color || "#111827"
  );
  const [gradientColors, setGradientColors] = useState(
    currentBackground?.gradient?.colors || ["#111827", "#374151"]
  );
  const [gradientDirection, setGradientDirection] = useState(
    currentBackground?.gradient?.direction || "to bottom"
  );
  const [imageConfig, setImageConfig] = useState(
    currentBackground?.image || { src: "", fit: "cover" as const }
  );

  const commonColors = [
    "#111827", // Dark gray (current default)
    "#000000", // Black
    "#ffffff", // White
    "#ef4444", // Red
    "#f97316", // Orange
    "#eab308", // Yellow
    "#22c55e", // Green
    "#06b6d4", // Cyan
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#f59e0b", // Amber
  ];

  const gradientPresets: GradientPreset[] = [
    {
      id: "dark-darker",
      name: "Dark to Darker",
      colors: ["#111827", "#000000"],
      direction: "to bottom",
    },
    {
      id: "blue-sunset",
      name: "Blue Sunset",
      colors: ["#1e3a8a", "#3730a3"],
      direction: "to bottom",
    },
    {
      id: "purple-dream",
      name: "Purple Dream",
      colors: ["#581c87", "#c084fc"],
      direction: "to bottom right",
    },
    {
      id: "ocean-breeze",
      name: "Ocean Breeze",
      colors: ["#0ea5e9", "#06b6d4"],
      direction: "to right",
    },
    {
      id: "warm-glow",
      name: "Warm Glow",
      colors: ["#dc2626", "#f97316"],
      direction: "to bottom",
    },
    {
      id: "forest",
      name: "Forest",
      colors: ["#166534", "#22c55e"],
      direction: "to top",
    },
    {
      id: "sunset-orange",
      name: "Sunset Orange",
      colors: ["#fb7185", "#f97316", "#facc15"],
      direction: "to bottom right",
    },
    {
      id: "midnight-blue",
      name: "Midnight Blue",
      colors: ["#1e1b4b", "#312e81", "#3730a3"],
      direction: "to bottom",
    },
    {
      id: "emerald-mint",
      name: "Emerald Mint",
      colors: ["#065f46", "#10b981", "#6ee7b7"],
      direction: "to top right",
    },
    {
      id: "rose-gold",
      name: "Rose Gold",
      colors: ["#be185d", "#ec4899", "#f9a8d4"],
      direction: "to right",
    },
    {
      id: "cosmic-purple",
      name: "Cosmic Purple",
      colors: ["#312e81", "#7c3aed", "#a855f7", "#c084fc"],
      direction: "to bottom",
    },
    {
      id: "arctic-blue",
      name: "Arctic Blue",
      colors: ["#0c4a6e", "#0284c7", "#0ea5e9", "#38bdf8"],
      direction: "to top",
    },
  ];

  const imagePresets: ImagePreset[] = [
    {
      id: "blue-gradient-abstract",
      name: "Blue Abstract",
      src: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1920&h=1080&fit=crop&auto=format",
      category: "abstract",
    },
    {
      id: "purple-waves",
      name: "Purple Waves",
      src: "https://images.unsplash.com/photo-1558244661-d248897f7bc4?w=1920&h=1080&fit=crop&auto=format",
      category: "abstract",
    },
    {
      id: "dark-geometric",
      name: "Dark Geometric",
      src: "https://images.unsplash.com/photo-1604076984203-a7c17dfe8391?w=1920&h=1080&fit=crop&auto=format",
      category: "geometric",
    },
    {
      id: "mountain-landscape",
      name: "Mountain View",
      src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop&auto=format",
      category: "nature",
    },
    {
      id: "ocean-sunset",
      name: "Ocean Sunset",
      src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop&auto=format",
      category: "nature",
    },
    {
      id: "forest-trees",
      name: "Forest Path",
      src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop&auto=format",
      category: "nature",
    },
    {
      id: "city-skyline",
      name: "City Lights",
      src: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1920&h=1080&fit=crop&auto=format",
      category: "urban",
    },
    {
      id: "gradient-mesh",
      name: "Gradient Mesh",
      src: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1920&h=1080&fit=crop&auto=format",
      category: "abstract",
    },
    {
      id: "space-stars",
      name: "Starry Space",
      src: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=1920&h=1080&fit=crop&auto=format",
      category: "space",
    },
    {
      id: "minimalist-lines",
      name: "Clean Lines",
      src: "https://images.unsplash.com/photo-1604076984203-a7c17dfe8391?w=1920&h=1080&fit=crop&auto=format",
      category: "minimal",
    },
    {
      id: "warm-texture",
      name: "Warm Texture",
      src: "https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&h=1080&fit=crop&auto=format",
      category: "texture",
    },
    {
      id: "dark-pattern",
      name: "Dark Pattern",
      src: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&h=1080&fit=crop&auto=format",
      category: "pattern",
    },
  ];

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    onBackgroundChange({ type: "color", color });
  };

  const handleGradientChange = (colors: string[], direction: string) => {
    setGradientColors(colors);
    setGradientDirection(direction);
    onBackgroundChange({ type: "gradient", gradient: { colors, direction } });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newImageConfig = { ...imageConfig, src: url };
      setImageConfig(newImageConfig);
      onBackgroundChange({ type: "image", image: newImageConfig });
    }
  };

  const handleImageFitChange = (fit: "cover" | "contain" | "fill") => {
    const newImageConfig = { ...imageConfig, fit };
    setImageConfig(newImageConfig);
    onBackgroundChange({ type: "image", image: newImageConfig });
  };

  return (
    <div className="p-4 space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as any)}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="color" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Color
          </TabsTrigger>
          <TabsTrigger value="gradient" className="flex items-center gap-2">
            <Rainbow className="h-4 w-4" />
            Gradient
          </TabsTrigger>
          <TabsTrigger value="image" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Image
          </TabsTrigger>
        </TabsList>

        <TabsContent value="color" className="space-y-4">
          <div>
            <Label htmlFor="color-picker">Background Color</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                id="color-picker"
                type="color"
                value={selectedColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-20 h-10 p-1 rounded cursor-pointer"
              />
              <Input
                type="text"
                value={selectedColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="flex-1"
                placeholder="#111827"
              />
            </div>
          </div>

          <div>
            <Label>Common Colors</Label>
            <div className="grid grid-cols-6 gap-2 mt-2">
              {commonColors.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className={`w-8 h-8 rounded border-2 ${
                    selectedColor === color
                      ? "border-primary"
                      : "border-gray-300"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="gradient" className="space-y-4">
          <div>
            <Label>Gradient Presets</Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {gradientPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() =>
                    handleGradientChange(preset.colors, preset.direction)
                  }
                  className="p-3 rounded border text-left hover:border-primary"
                  style={{
                    background: `linear-gradient(${
                      preset.direction
                    }, ${preset.colors.join(", ")})`,
                  }}
                >
                  <div className="text-white text-sm font-medium drop-shadow">
                    {preset.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Custom Gradient</Label>
            <div className="space-y-2 mt-2">
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={gradientColors[0]}
                  onChange={(e) => {
                    const newColors = [...gradientColors];
                    newColors[0] = e.target.value;
                    handleGradientChange(newColors, gradientDirection);
                  }}
                  className="w-20 h-10 p-1"
                />
                <Input
                  type="color"
                  value={gradientColors[1]}
                  onChange={(e) => {
                    const newColors = [...gradientColors];
                    newColors[1] = e.target.value;
                    handleGradientChange(newColors, gradientDirection);
                  }}
                  className="w-20 h-10 p-1"
                />
              </div>
              <select
                value={gradientDirection}
                onChange={(e) =>
                  handleGradientChange(gradientColors, e.target.value)
                }
                className="w-full p-2 border rounded"
              >
                <option value="to bottom">Top to Bottom</option>
                <option value="to top">Bottom to Top</option>
                <option value="to right">Left to Right</option>
                <option value="to left">Right to Left</option>
                <option value="to bottom right">
                  Top-Left to Bottom-Right
                </option>
                <option value="to bottom left">Top-Right to Bottom-Left</option>
              </select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="image" className="space-y-4">
          {imagePresets.length > 0 && (
            <div>
              <Label>Image Presets</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {imagePresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      const newImageConfig = {
                        src: preset.src,
                        fit: "cover" as const,
                      };
                      setImageConfig(newImageConfig);
                      onBackgroundChange({
                        type: "image",
                        image: newImageConfig,
                      });
                    }}
                    className="relative h-16 rounded border hover:border-primary overflow-hidden"
                  >
                    <img
                      src={preset.thumbnail || preset.src}
                      alt={preset.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                      {preset.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="image-upload">Upload Background Image</Label>
            <Input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="mt-2"
            />
          </div>

          {imageConfig.src && (
            <>
              <div>
                <Label>Image Preview</Label>
                <div className="mt-2 w-full h-24 border rounded overflow-hidden">
                  <img
                    src={imageConfig.src}
                    alt="Background preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div>
                <Label>Image Fit</Label>
                <select
                  value={imageConfig.fit}
                  onChange={(e) => handleImageFitChange(e.target.value as any)}
                  className="w-full p-2 border rounded mt-2"
                >
                  <option value="cover">Cover (fill frame, may crop)</option>
                  <option value="contain">
                    Contain (fit entirely, may have bars)
                  </option>
                  <option value="fill">Fill (stretch to fit)</option>
                </select>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
