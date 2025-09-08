// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import './index.css';
import App from './App.jsx';
import AdminReview from './pages/adminReview.jsx'; // 👈 crea este archivo con el panel

const router = createBrowserRouter([
  { path: '/', element: <App /> },         // formulario WL
  { path: '/admin', element: <AdminReview /> }, // panel de corrección
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
