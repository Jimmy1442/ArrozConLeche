import { useState, useEffect, useRef } from 'react';

// Quita tildes y pasa a minúsculas para buscar sin importar acentos
const normalizar = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function ClienteSelector({
  clientes,
  value,
  onChange,
  placeholder = 'Selecciona un cliente'
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  const seleccionado = clientes.find((c) => c.id === value);

  // Cerrar al tocar fuera o con Escape
  useEffect(() => {
    const fuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    const esc = (e) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('touchstart', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('touchstart', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  useEffect(() => {
    if (abierto) {
      setBusqueda('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [abierto]);

  const q = normalizar(busqueda.trim());
  const filtrados = q
    ? clientes.filter(
        (c) =>
          normalizar(c.nombre).includes(q) ||
          normalizar(c.telefono).includes(q)
      )
    : clientes;

  const elegir = (id) => {
    onChange(id);
    setAbierto(false);
  };

  return (
    <div className="cliente-selector" ref={ref}>
      <button
        type="button"
        className={`cliente-selector-trigger ${abierto ? 'abierto' : ''}`}
        onClick={() => setAbierto(!abierto)}
      >
        <span
          className={`cliente-selector-texto ${seleccionado ? '' : 'placeholder'}`}
        >
          {seleccionado
            ? `${seleccionado.nombre}${seleccionado.telefono ? ' · ' + seleccionado.telefono : ''}`
            : placeholder}
        </span>
        <span className="cliente-selector-flecha">▼</span>
      </button>

      {abierto && (
        <div className="cliente-selector-menu">
          <div className="cliente-selector-buscar">
            <span>🔍</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda('')}>
                ✖
              </button>
            )}
          </div>

          <div className="cliente-selector-lista">
            {filtrados.length === 0 ? (
              <div className="cliente-selector-vacio">
                ❌ No se encontraron clientes
              </div>
            ) : (
              filtrados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cliente-selector-opcion ${c.id === value ? 'activa' : ''}`}
                  onClick={() => elegir(c.id)}
                >
                  <strong>{c.nombre}</strong>
                  {c.telefono && <small>{c.telefono}</small>}
                  {c.id === value && <span className="check">✓</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ClienteSelector;
