
import React from "react";
import { SelectTextOverlay } from "./select-text-overlay";

export const TextOverlaysPanel: React.FC = () => {
  return (
    <div className="p-2 h-full bg-background">
      <SelectTextOverlay setLocalOverlay={() => {}} />
    </div>
  );
};
