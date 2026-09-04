import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { OverlayType } from "../types";
import { useSidebar as useUISidebar } from "../../ui/sidebar";

// Define the shape of our context data
type SidebarContextType = {
  activePanel: OverlayType; // Stores the currently active panel name
  setActivePanel: (panel: OverlayType) => void; // Function to update the active panel
  setIsOpen: (open: boolean) => void;
  /** When non-null the left panel shows a property section for the selected overlay */
  activePropertySection: string | null;
  setActivePropertySection: (section: string | null) => void;
  /** Restore the sidebar to its asset-browser mode */
  exitPropertyMode: () => void;
};

// Create the context with undefined as initial value
const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// Custom hook to consume the sidebar context
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  const uiSidebar = useUISidebar();

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }

  return {
    ...context,
    setIsOpen: uiSidebar.setOpen,
  };
};

// Provider component that wraps parts of the app that need access to sidebar state
export const SidebarProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [activePanel, setActivePanel] = useState<OverlayType>(OverlayType.TEXT);
  const [activePropertySection, setActivePropertySection] = useState<string | null>(null);
  const { setOpen } = useUISidebar();

  // Auto-open sidebar panel when media is added via MCP
  useEffect(() => {
    const handler = (e: Event) => {
      const panel = (e as CustomEvent).detail?.panel;
      if (panel && Object.values(OverlayType).includes(panel)) {
        setActivePropertySection(null); // leave property mode
        setActivePanel(panel as OverlayType);
        setOpen(true);
      }
    };
    window.addEventListener('open-sidebar-panel', handler);
    return () => window.removeEventListener('open-sidebar-panel', handler);
  }, [setOpen]);

  const exitPropertyMode = useCallback(() => {
    setActivePropertySection(null);
  }, []);

  const value = {
    activePanel,
    setActivePanel,
    setIsOpen: setOpen,
    activePropertySection,
    setActivePropertySection,
    exitPropertyMode,
  };

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
};
