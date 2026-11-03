import { Routes, Route } from "react-router-dom";
import Layout from "../components/Layout/Layout";
import Home from "../pages/Home/Home";
import AboutPage from "../pages/About/AboutPage";
import MapViewPage from "../pages/MapView/MapViewPage";
import NotFoundPage from "../pages/NotFound/NotFoundPage";
import TermsOfService from "../pages/TermsOfService";

function AppRoutes() {
  console.log("🛣️ AppRoutes: Setting up routes");
  
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="map" element={<MapViewPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="terms" element={<TermsOfService />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes; 