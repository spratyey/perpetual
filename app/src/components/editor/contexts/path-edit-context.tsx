import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type DrawingMode = 'none' | 'freehand' | 'pen' | 'line' | 'arrow-line';

interface PathEditContextProps {
  pathEditingId: number | null;
  setPathEditingId: (id: number | null) => void;
  selectedAnchorIndices: number[];
  setSelectedAnchorIndices: React.Dispatch<React.SetStateAction<number[]>>;
  enterPathEdit: (overlayId: number) => void;
  exitPathEdit: () => void;
  drawingMode: DrawingMode;
  setDrawingMode: (mode: DrawingMode) => void;
  cropEditingId: number | null;
  enterCropEdit: (overlayId: number) => void;
  exitCropEdit: () => void;
}

const PathEditContext = createContext<PathEditContextProps | undefined>(undefined);

export const PathEditProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pathEditingId, setPathEditingId] = useState<number | null>(null);
  const [selectedAnchorIndices, setSelectedAnchorIndices] = useState<number[]>([]);
  const [drawingMode, setDrawingModeState] = useState<DrawingMode>('none');
  const [cropEditingId, setCropEditingId] = useState<number | null>(null);

  const enterPathEdit = useCallback((overlayId: number) => {
    setPathEditingId(overlayId);
    setSelectedAnchorIndices([]);
    setDrawingModeState('none');
    setCropEditingId(null);
  }, []);

  const exitPathEdit = useCallback(() => {
    setPathEditingId(null);
    setSelectedAnchorIndices([]);
  }, []);

  const setDrawingMode = useCallback((mode: DrawingMode) => {
    setDrawingModeState(mode);
    if (mode !== 'none') {
      setPathEditingId(null);
      setSelectedAnchorIndices([]);
      setCropEditingId(null);
    }
  }, []);

  const enterCropEdit = useCallback((overlayId: number) => {
    setCropEditingId(overlayId);
    setPathEditingId(null);
    setSelectedAnchorIndices([]);
    setDrawingModeState('none');
  }, []);

  const exitCropEdit = useCallback(() => {
    setCropEditingId(null);
  }, []);

  return (
    <PathEditContext.Provider
      value={{
        pathEditingId,
        setPathEditingId,
        selectedAnchorIndices,
        setSelectedAnchorIndices,
        enterPathEdit,
        exitPathEdit,
        drawingMode,
        setDrawingMode,
        cropEditingId,
        enterCropEdit,
        exitCropEdit,
      }}
    >
      {children}
    </PathEditContext.Provider>
  );
};

export const usePathEditContext = (): PathEditContextProps => {
  const context = useContext(PathEditContext);
  if (!context) {
    throw new Error("usePathEditContext must be used within a PathEditProvider");
  }
  return context;
};
