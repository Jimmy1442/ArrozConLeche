import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Ventas from './pages/Ventas';
import Clientes from './pages/Clientes';
import Reportes from './pages/Reportes';
import Lotes from './pages/Lotes';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setCargando(false);
    });
    return () => unsub();
  }, []);

  if (cargando) {
    return (
      <div className="loading-screen">
        <h1>Cargando... 🍚</h1>
      </div>
    );
  }

  if (!usuario) return <Login onLogin={setUsuario} />;

  return (
    <BrowserRouter>
      <Sidebar
        abierto={sidebarAbierto}
        onClose={() => setSidebarAbierto(false)}
      />
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
        />
        <Route
          path="/dashboard"
          element={
            <Dashboard
              usuario={usuario}
              onAbrirSidebar={() => setSidebarAbierto(true)}
            />
          }
        />
        <Route
          path="/ventas"
          element={
            <Ventas
              usuario={usuario}
              onAbrirSidebar={() => setSidebarAbierto(true)}
            />
          }
        />
        <Route
          path="/clientes"
          element={
            <Clientes
              usuario={usuario}
              onAbrirSidebar={() => setSidebarAbierto(true)}
            />
          }
        />
        <Route
          path="/lotes"
          element={
            <Lotes
              usuario={usuario}
              onAbrirSidebar={() => setSidebarAbierto(true)}
            />
          }
        />
        <Route
          path="/reportes"
          element={
            <Reportes
              usuario={usuario}
              onAbrirSidebar={() => setSidebarAbierto(true)}
            />
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;