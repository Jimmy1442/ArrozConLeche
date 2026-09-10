import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

function TopBar({ usuario, titulo, onAbrirSidebar }) {
  const handleLogout = () => signOut(auth);

  return (
    <header className="topbar">
      {/* Botón hamburguesa (solo móvil) */}
      <button
        className="topbar-hamburguesa"
        onClick={onAbrirSidebar}
        aria-label="Abrir menú"
      >
        ☰
      </button>

      <h2 className="topbar-title">{titulo}</h2>

      <div className="topbar-user">
        <div className="topbar-avatar">
          {usuario?.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="topbar-info">
          <span className="topbar-email">{usuario?.email}</span>
          <button className="topbar-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}

export default TopBar;