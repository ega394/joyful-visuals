// src/App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import SuperadminPage from "./pages/SuperadminPage.jsx";
import TamuPage from "./TamuPage.jsx";
import PinjamRuanganPage from "./pages/PinjamRuanganPage.jsx";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/superadmin" element={<SuperadminPage />} />
            <Route path="/superadmin/*" element={<SuperadminPage />} />
            <Route path="/tamu" element={<TamuPage />} />
            <Route path="/pinjamruangan" element={<PinjamRuanganPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
