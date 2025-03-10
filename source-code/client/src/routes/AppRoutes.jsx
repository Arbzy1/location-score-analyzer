import { Routes, Route } from "react-router-dom";
import Layout from "../components/Layout/Layout";
import Home from "../pages/Home/Home";
import AboutPage from "../pages/About/AboutPage";
import NotFoundPage from "../pages/NotFound/NotFoundPage";

function AppRoutes() {
  console.log("🛣️ AppRoutes: Setting up routes");
  
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes; 