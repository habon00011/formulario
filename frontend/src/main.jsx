// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "./index.css";
import App from "./App.jsx";
import AdminReview from "./pages/adminReview.jsx";
import AdminAllWL from "./pages/allWL/AdminAllWL.jsx"; // 👈 importa el panel de todas las WL

const router = createBrowserRouter(
  [
    { path: "/", element: <App /> }, // formulario WL
    { path: "/admin", element: <AdminReview /> }, // panel de corrección
    { path: "/admin/all", element: <AdminAllWL /> }, // 👈 panel de TODAS las WL
  ],

  {
    basename: "/wl", // 👈 aquí le dices que todo vive dentro de /wl
  }
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
