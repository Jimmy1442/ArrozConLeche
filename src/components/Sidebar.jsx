import { NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import logo from '../assets/logo.png';

const menuItems = [
  { path: '/dashboard', label: 'Inicio',    icon: '🏠' },
  { path: '/ventas',    label: 'Ventas',    icon: '💰' },
  { path: '/clientes',  label: 'Clientes',  icon: '👥' },
  { path: '/lotes',     label: 'Lotes',     icon: '🍚' },
  { path: '/reportes',  label: 'Reportes',  icon: '📊' }
];

function Sidebar({ abierto, onClose }) {
  // Cerrar con la tecla Escape en móvil
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && abierto) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [abierto, onClose]);

  // Bloquear scroll del body cuando el sidebar está abierto en móvil
  useEffect(() => {
    if (abierto) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [abierto]);

  return (
    <>
      {/* Overlay para móvil */}
      {abierto && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${abierto ? 'sidebar-abierto' : ''}`}>
        {/* Botón cerrar en móvil */}
        <button
          className="sidebar-cerrar"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          ✖
        </button>

        <div className="sidebar-logo">
          <img src={logo} alt="M&S" />
          <span>M&S Arroz</span>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>🍚 Dulce Arroz con Love</p>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;