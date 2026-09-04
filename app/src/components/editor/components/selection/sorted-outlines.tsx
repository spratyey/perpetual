import React from "react";
import { Sequence } from "remotion";
import { SelectionOutline } from "./selected-outline";
import { Overlay } from "../../types";
import { SnapLine } from "./snap-utils";

const displaySelectedOverlayOnTop = (
  overlays: Overlay[],
  selectedOverlayIds: number[]
): Overlay[] => {
  const selectedOverlays = overlays.filter((overlay) =>
    selectedOverlayIds.includes(overlay.id)
  );
  const unselectedOverlays = overlays.filter(
    (overlay) => !selectedOverlayIds.includes(overlay.id)
  );

  return [...unselectedOverlays, ...selectedOverlays];
};

export const SortedOutlines: React.FC<{
  overlays: Overlay[];
  selectedOverlayId: number | null;
  selectedOverlayIds: number[];
  setSelectedOverlayIds: React.Dispatch<React.SetStateAction<number[]>>;
  changeOverlay: (
    overlayId: number,
    updater: (overlay: Overlay) => Overlay
  ) => void;
  setSelectedOverlayId: React.Dispatch<React.SetStateAction<number | null>>;
  canvasWidth: number;
  canvasHeight: number;
  onSnapGuidesChange: (guides: SnapLine[]) => void;
}> = ({
  overlays,
  selectedOverlayId,
  selectedOverlayIds,
  setSelectedOverlayIds,
  changeOverlay,
  setSelectedOverlayId,
  canvasWidth,
  canvasHeight,
  onSnapGuidesChange,
}) => {
  const overlaysToDisplay = React.useMemo(
    () => displaySelectedOverlayOnTop(overlays, selectedOverlayIds),
    [overlays, selectedOverlayIds]
  );

  const isDragging = React.useMemo(
    () => overlays.some((overlay) => overlay.isDragging),
    [overlays]
  );

  return overlaysToDisplay.map((overlay) => {
    return (
      <Sequence
        key={overlay.id}
        from={overlay.from}
        durationInFrames={overlay.durationInFrames}
        layout="none"
      >
        <SelectionOutline
          changeOverlay={changeOverlay}
          overlay={overlay}
          setSelectedOverlayId={setSelectedOverlayId}
          selectedOverlayId={selectedOverlayId}
          selectedOverlayIds={selectedOverlayIds}
          setSelectedOverlayIds={setSelectedOverlayIds}
          isDragging={isDragging}
          allOverlays={overlays}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onSnapGuidesChange={onSnapGuidesChange}
        />
      </Sequence>
    );
  });
};
