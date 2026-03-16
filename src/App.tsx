// src/App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { useEffect } from "react";

const queryClient = new QueryClient();

const App = () => {

  useEffect(() => {
    const loadUpdater = async () => {
      if (typeof window !== "undefined" && (window as any).Capacitor) {
        try {
          const module = await import('@capgo/capacitor-updater');
          module.CapacitorUpdater.notifyAppReady();
          console.log("CapacitorUpdater loaded for mobile.");
        } catch (err) {
          console.warn("Failed to load CapacitorUpdater:", err);
        }
      }
    };
    loadUpdater();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
