import * as React from "react";
import { useState, useCallback, useRef } from "react";
import {
  LetterText,
  Music,
  Image,
  Paintbrush,
  Shapes,
  Clapperboard,
  Wand2,
  Users,
  X,
  History,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { useSidebar } from "../../contexts/sidebar-context";
import { VideoOverlayPanel } from "../overlays/video/video-overlay-panel";
import { TextOverlaysPanel } from "../overlays/text/text-overlays-panel";
import SoundsPanel from "../overlays/sounds/sounds-panel";
import { OverlayType } from "../../types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImageOverlayPanel } from "../overlays/images/image-overlay-panel";
import { BackgroundPanel } from "../overlays/background/background-panel";
import { ShapesPanel } from "../overlays/shapes/shapes-panel";
import { HistoryPanel } from "./history-panel";
import { PanelErrorBoundary } from "../core/panel-error-boundary";
import { useEditorContext } from "../../contexts/editor-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  OverlayPropertySection,
  getSectionsForOverlay,
} from "./overlay-property-sections";

const TYPE_LABELS: Record<string, string> = {
  [OverlayType.VIDEO]: "Video",
  [OverlayType.TEXT]: "Text",
  [OverlayType.SOUND]: "Sound",
  [OverlayType.IMAGE]: "Image",
  [OverlayType.SHAPE]: "Shape",
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const {
    activePanel,
    setActivePanel,
    setIsOpen,
    activePropertySection,
    setActivePropertySection,
    exitPropertyMode,
  } = useSidebar();
  const {
    background,
    setBackground,
    selectedOverlayId,
    setSelectedOverlayId,
    selectedOverlayIds,
    overlays,
  } = useEditorContext();

  // ── Resizable content panel width ──
  const PANEL_MIN = 350;
  const PANEL_MAX = 500;
  const PANEL_DEFAULT = 400;
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);
  const isResizingPanel = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Sync CSS variable on the SidebarProvider wrapper so both the spacer
  // and the fixed-position sidebar track the width correctly.
  React.useEffect(() => {
    const wrapper = sidebarRef.current?.closest(
      ".group\\/sidebar-wrapper",
    ) as HTMLElement | null;
    if (wrapper) {
      // icon sidebar (3.5rem ≈ 56px) + content panel + resize handle (3px)
      wrapper.style.setProperty("--sidebar-width", `${panelWidth + 59}px`);
    }
  }, [panelWidth]);

  const handlePanelResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingPanel.current = true;
      const startX = e.clientX;
      const startWidth = panelWidth;

      const onMouseMove = (e: MouseEvent) => {
        if (!isResizingPanel.current) return;
        const delta = e.clientX - startX;
        setPanelWidth(
          Math.min(PANEL_MAX, Math.max(PANEL_MIN, startWidth + delta)),
        );
      };

      const onMouseUp = () => {
        isResizingPanel.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [panelWidth],
  );

  // Resolve selected overlay (single selection only)
  const selectedOverlay = React.useMemo(() => {
    if (
      selectedOverlayId === null ||
      (selectedOverlayIds && selectedOverlayIds.length > 1)
    )
      return null;
    return overlays.find((o) => o.id === selectedOverlayId) ?? null;
  }, [selectedOverlayId, selectedOverlayIds, overlays]);

  // Derive property sections for the selected overlay
  const propertySections = React.useMemo(
    () => (selectedOverlay ? getSectionsForOverlay(selectedOverlay.type) : []),
    [selectedOverlay],
  );

  // Auto-enter property mode when an overlay is selected
  const prevOverlayIdRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (selectedOverlay && selectedOverlay.id !== prevOverlayIdRef.current) {
      // New overlay selected — open the first property section
      const sections = getSectionsForOverlay(selectedOverlay.type);
      if (sections.length > 0) {
        setActivePropertySection(sections[0].id);
        setIsOpen(true);
      }
    }
    if (!selectedOverlay && prevOverlayIdRef.current !== null) {
      // Overlay deselected — exit property mode
      exitPropertyMode();
    }
    prevOverlayIdRef.current = selectedOverlay?.id ?? null;
  }, [selectedOverlay]);

  // When overlay type changes, reset section to first
  const prevOverlayTypeRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (
      selectedOverlay &&
      selectedOverlay.type !== prevOverlayTypeRef.current
    ) {
      const sections = getSectionsForOverlay(selectedOverlay.type);
      if (sections.length > 0 && activePropertySection) {
        // Check if current section exists in new type's sections
        const exists = sections.some((s) => s.id === activePropertySection);
        if (!exists) setActivePropertySection(sections[0].id);
      }
    }
    prevOverlayTypeRef.current = selectedOverlay?.type ?? null;
  }, [selectedOverlay?.type]);

  const getPanelTitle = (type: OverlayType): string => {
    switch (type) {
      case OverlayType.VIDEO:
        return "Video Assets";
      case OverlayType.TEXT:
        return "Text Assets";
      case OverlayType.SOUND:
        return "Audio Assets";
      case OverlayType.IMAGE:
        return "Image Assets";
      case OverlayType.BACKGROUND:
        return "Background";
      case OverlayType.SHAPE:
        return "Shapes";
      case OverlayType.HISTORY:
        return "History";
      default:
        return "Unknown";
    }
  };

  const navigationItems = [
    {
      title: getPanelTitle(OverlayType.VIDEO),
      icon: Clapperboard,
      panel: OverlayType.VIDEO,
    },
    {
      title: getPanelTitle(OverlayType.IMAGE),
      icon: Image,
      panel: OverlayType.IMAGE,
    },
    {
      title: getPanelTitle(OverlayType.SOUND),
      icon: Music,
      panel: OverlayType.SOUND,
    },
    {
      title: getPanelTitle(OverlayType.TEXT),
      icon: LetterText,
      panel: OverlayType.TEXT,
    },
    {
      title: getPanelTitle(OverlayType.SHAPE),
      icon: Shapes,
      panel: OverlayType.SHAPE,
    },
    {
      title: getPanelTitle(OverlayType.BACKGROUND),
      icon: Paintbrush,
      panel: OverlayType.BACKGROUND,
    },
  ];

  const renderActivePanel = () => {
    switch (activePanel) {
      case OverlayType.TEXT:
        return <TextOverlaysPanel />;
      case OverlayType.SOUND:
        return <SoundsPanel />;
      case OverlayType.VIDEO:
        return <VideoOverlayPanel />;
      case OverlayType.IMAGE:
        return <ImageOverlayPanel />;
      case OverlayType.SHAPE:
        return <ShapesPanel />;
      case OverlayType.HISTORY:
        return (
          <PanelErrorBoundary label="History">
            <HistoryPanel />
          </PanelErrorBoundary>
        );
      case OverlayType.BACKGROUND:
        return (
          <BackgroundPanel
            onBackgroundChange={setBackground}
            currentBackground={background}
          />
        );
      default:
        return null;
    }
  };

  /** Whether the sidebar is currently showing property-editing content */
  const isInPropertyMode =
    activePropertySection !== null && selectedOverlay !== null;

  /** Title for the content header when in property mode */
  const propertyHeaderLabel = React.useMemo(() => {
    if (!isInPropertyMode || !selectedOverlay) return "";
    const typeLabel = TYPE_LABELS[selectedOverlay.type] ?? "Properties";
    const section = propertySections.find(
      (s) => s.id === activePropertySection,
    );
    return section ? `${typeLabel} — ${section.label}` : typeLabel;
  }, [
    isInPropertyMode,
    selectedOverlay,
    activePropertySection,
    propertySections,
  ]);

  /* ---- Click handlers for icon rail ---- */

  const dismissZoomIfNeeded = (_nextSection?: string) => {};

  const handleAssetIconClick = (panel: OverlayType) => {
    // If property mode is active, leave it first
    if (isInPropertyMode) exitPropertyMode();
    dismissZoomIfNeeded();

    if (activePanel === panel && !isInPropertyMode) {
      setActivePanel(null as any);
      setIsOpen(false);
    } else {
      setActivePanel(panel);
      setIsOpen(true);
    }
  };

  const handlePropertyIconClick = (sectionId: string) => {
    if (activePropertySection === sectionId) {
      // Toggle off → revert to asset panel and dismiss zoom if needed
      dismissZoomIfNeeded();
      exitPropertyMode();
    } else {
      dismissZoomIfNeeded(sectionId);
      setActivePropertySection(sectionId);
      setIsOpen(true);
    }
  };

  return (
    <Sidebar
      ref={sidebarRef}
      collapsible="icon"
      className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row bg-background"
      {...props}
    >
      {/* Icon sidebar */}
      <Sidebar
        collapsible="none"
        className="!w-[--sidebar-width-icon] bg-background border-r border-border"
      >
        <SidebarContent>
          <SidebarGroup className="gap-1 px-1.5 pt-2">
            {navigationItems.map((item) => (
              <TooltipProvider key={item.title} delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      onClick={() => handleAssetIconClick(item.panel)}
                      aria-label={item.title}
                      size="lg"
                      className={`flex items-center justify-center h-8 w-full rounded-md transition-colors ${
                        activePanel === item.panel && !isInPropertyMode
                          ? "!bg-muted !text-foreground"
                          : "!text-muted-foreground hover:!bg-muted hover:!text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="border bg-background text-foreground"
                  >
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}

            {/* Characters — available in AI Studio only */}

            {/* Property section icons — shown when an overlay is selected */}
            {selectedOverlay && propertySections.length > 0 && (
              <>
                <div className="h-px bg-border mx-1 mt-1" />
                {propertySections.map((section) => (
                  <TooltipProvider key={section.id} delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          onClick={() => handlePropertyIconClick(section.id)}
                          aria-label={section.label}
                          size="lg"
                          className={`flex items-center justify-center h-8 w-full rounded-md transition-colors ${
                            activePropertySection === section.id
                              ? "!bg-primary/15 !text-primary"
                              : "!text-muted-foreground hover:!bg-muted hover:!text-foreground"
                          }`}
                        >
                          <section.icon className="h-4 w-4" />
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="border bg-background text-foreground"
                      >
                        {section.label}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </>
            )}

            {/* History sits last: it is a record of the project, not a tool for
                building it, so it belongs below the asset panels and the
                per-asset settings. */}
            <div className="mx-1 mt-1 h-px bg-border" />
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    onClick={() => handleAssetIconClick(OverlayType.HISTORY)}
                    aria-label="History"
                    size="lg"
                    className={`flex h-8 w-full items-center justify-center rounded-md transition-colors ${
                      activePanel === OverlayType.HISTORY && !isInPropertyMode
                        ? "!bg-muted !text-foreground"
                        : "!text-muted-foreground hover:!bg-muted hover:!text-foreground"
                    }`}
                  >
                    <History className="h-4 w-4" />
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right" className="border bg-background text-foreground">
                  History
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* Content sidebar */}
      <Sidebar
        collapsible="none"
        className="hidden flex-1 md:flex bg-background min-w-0 overflow-hidden"
      >
        {isInPropertyMode ? (
          /* ─── Property-editing content ─── */
          <>
            <SidebarHeader className="border-b px-3 py-2">
              <div className="flex items-center">
                <span className="text-sm font-medium text-foreground truncate">
                  {propertyHeaderLabel}
                </span>
              </div>
            </SidebarHeader>
            <SidebarContent className="text-foreground bg-background">
              <ScrollArea className="flex-1">
                <div className="p-4">
                  <OverlayPropertySection sectionId={activePropertySection!} />
                </div>
              </ScrollArea>
            </SidebarContent>
          </>
        ) : (
          /* ─── Asset-browser content (original) ─── */
          <>
            <SidebarHeader className="border-b px-3 py-2">
              <div className="flex items-center justify-between min-h-7">
                <span className="text-sm font-medium text-foreground">
                  {activePanel ? getPanelTitle(activePanel as OverlayType) : ""}
                </span>
              </div>
            </SidebarHeader>
            <SidebarContent className="text-foreground bg-background">
              {renderActivePanel()}
            </SidebarContent>
          </>
        )}
      </Sidebar>

      {/* Resize handle */}
      <div
        onMouseDown={handlePanelResizeStart}
        className="w-[3px] cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors shrink-0 bg-border"
      />

    </Sidebar>
  );
}
