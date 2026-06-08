// src/App.tsx
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import SuperadminPage from "./pages/SuperadminPage.jsx";
// Lazy load halaman publik berat (tamu + pinjam ruangan) → bundle awal ringan
const TamuPage          = lazy(() => import("./TamuPage.jsx"));
const PinjamRuanganPage = lazy(() => import("./pages/PinjamRuanganPage.jsx"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontFamily: "Inter,system-ui,sans-serif" }}>
    Memuat…
  </div>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/superadmin" element={<SuperadminPage />} />
              <Route path="/superadmin/*" element={<SuperadminPage />} />
              <Route path="/tamu" element={<TamuPage />} />
              <Route path="/pinjamruangan" element={<PinjamRuanganPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
