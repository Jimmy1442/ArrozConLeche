import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import TopBar from '../components/TopBar';
import Button from '../components/Button';
import '../styles/Modulos.css';

function Clientes({ usuario, onAbrirSidebar }) {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState('');

  // ➕ Formulario
  const [nuevo, setNuevo] = useState({ nombre: '', telefono: '' });

  const [seleccionados, setSeleccionados] = useState([]);
  const [editando, setEditando] = useState(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  // 🔥 Cargar clientes
  useEffect(() => {
    const q = query(collection(db, 'clientes'), orderBy('fecha', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setClientes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCargando(false);
      },
      (err) => {
        console.error(err);
        setError('No se pudieron cargar los clientes');
        setCargando(false);
      }
    );
    return () => unsub();
  }, []);

  // ➕ Agregar cliente
  const agregar = async () => {
    const nombre = nuevo.nombre.trim();
    const telefono = nuevo.telefono.trim();
    if (!nombre || !telefono) return;

    setGuardando(true);
    setError('');

    try {
      await addDoc(collection(db, 'clientes'), {
        nombre,
        telefono,
        fecha: serverTimestamp(),
        creadoPor: usuario?.uid || 'anónimo',
        creadoPorEmail: usuario?.email || 'anónimo'
      });
      setNuevo({ nombre: '', telefono: '' });
      setMostrarForm(false);
    } catch (err) {
      console.error(err);
      setError('Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // ✏️ Guardar edición
  const guardarEdicion = async () => {
    if (!editando) return;
    const nombre = editando.nombre?.trim();
    const telefono = editando.telefono?.trim();
    if (!nombre || !telefono) return;

    setGuardandoEdit(true);
    setError('');

    try {
      const ref = doc(db, 'clientes', editando.id);
      await updateDoc(ref, {
        nombre,
        telefono,
        editadoPor: usuario?.email || 'anónimo'
      });
      setEditando(null);
    } catch (err) {
      console.error(err);
      setError('Error: ' + err.message);
    } finally {
      setGuardandoEdit(false);
    }
  };

  // 🗑️ Eliminar
  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este cliente?')) return;
    try {
      await deleteDoc(doc(db, 'clientes', id));
      setSeleccionados(seleccionados.filter((s) => s !== id));
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar');
    }
  };

  const eliminarSeleccionados = async () => {
    if (seleccionados.length === 0) return;
    if (!window.confirm(`¿Eliminar ${seleccionados.length} cliente(s)?`)) return;
    try {
      await Promise.all(
        seleccionados.map((id) => deleteDoc(doc(db, 'clientes', id)))
      );
      setSeleccionados([]);
    } catch (err) {
      console.error(err);
      setError('No se pudieron eliminar los seleccionados');
    }
  };

  const toggleSeleccion = (id) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleTodos = () => {
    if (seleccionados.length === clientes.length) setSeleccionados([]);
    else setSeleccionados(clientes.map((c) => c.id));
  };

  const todosSeleccionados =
    clientes.length > 0 && seleccionados.length === clientes.length;

  const formatearFecha = (fecha) => {
    if (!fecha) return '...';
    if (fecha.toDate) return fecha.toDate().toLocaleDateString('es-CO');
    return new Date(fecha).toLocaleDateString('es-CO');
  };

  return (
    <div className="modulo-layout">
      <div className="modulo-main">
        <TopBar
          usuario={usuario}
          titulo="👥 Clientes"
          onAbrirSidebar={onAbrirSidebar}
        />

        <div className="modulo-content">
          <div className="modulo-header">
            <div>
              <h1>Lista de clientes</h1>
              <p>
                Total registrados: <strong>{clientes.length}</strong>
                {seleccionados.length > 0 && (
                  <> · Seleccionados: <strong>{seleccionados.length}</strong></>
                )}
              </p>
            </div>
            <div className="modulo-acciones">
              {seleccionados.length > 0 && (
                <Button
                  variant="danger"
                  onClick={eliminarSeleccionados}
                  fullWidth={false}
                >
                  🗑 Eliminar ({seleccionados.length})
                </Button>
              )}
              <Button onClick={() => setMostrarForm(!mostrarForm)} fullWidth={false}>
                {mostrarForm ? '✖ Cancelar' : '➕ Nuevo cliente'}
              </Button>
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {/* ➕ Formulario */}
          {mostrarForm && (
            <div className="form-card">
              <h3>Agregar nuevo cliente</h3>

              <div className="form-grid">
                <div className="form-field">
                  <label>Nombre</label>
                  <input
                    type="text"
                    placeholder="Ej: María López"
                    value={nuevo.nombre}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, nombre: e.target.value })
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Teléfono</label>
                  <input
                    type="tel"
                    placeholder="Ej: 313 635 3736"
                    value={nuevo.telefono}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, telefono: e.target.value })
                    }
                  />
                </div>
              </div>

              <Button
                onClick={agregar}
                fullWidth={false}
                disabled={
                  guardando || !nuevo.nombre.trim() || !nuevo.telefono.trim()
                }
              >
                {guardando ? 'Guardando...' : 'Guardar cliente'}
              </Button>
            </div>
          )}

          {/* 📋 TABLA (desktop/tablet) + CARDS (móvil) */}
          <div className="dashboard-panel">
            {/* Vista de tabla (PC/Tablet) */}
            <div className="tabla-clientes-desktop">
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={todosSeleccionados}
                          onChange={toggleTodos}
                        />
                      </th>
                      <th>Nombre</th>
                      <th>Teléfono</th>
                      <th>Fecha de registro</th>
                      <th>Registrado por</th>
                      <th style={{ width: '100px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>
                          Cargando clientes... 🍚
                        </td>
                      </tr>
                    ) : clientes.length === 0 ? (
                      <tr>
                        <td
                          colSpan="6"
                          style={{ textAlign: 'center', padding: '40px', color: '#8B7A66' }}
                        >
                          👥 Aún no hay clientes registrados
                          <br />
                          <small>Haz clic en "➕ Nuevo cliente" para empezar</small>
                        </td>
                      </tr>
                    ) : (
                      clientes.map((c) => {
                        const activo = seleccionados.includes(c.id);
                        return (
                          <tr
                            key={c.id}
                            className={activo ? 'fila-seleccionada' : ''}
                          >
                            <td>
                              <input
                                type="checkbox"
                                checked={activo}
                                onChange={() => toggleSeleccion(c.id)}
                              />
                            </td>
                            <td>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10
                                }}
                              >
                                <div className="cliente-avatar-mini">
                                  {c.nombre?.[0]?.toUpperCase() || '?'}
                                </div>
                                <strong>{c.nombre}</strong>
                              </div>
                            </td>
                            <td>📞 {c.telefono}</td>
                            <td>{formatearFecha(c.fecha)}</td>
                            <td style={{ fontSize: '12px', color: '#8B7A66' }}>
                              {c.creadoPorEmail}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="btn-icon"
                                  title="Editar"
                                  onClick={() => setEditando({ ...c })}
                                >
                                  ✏️
                                </button>
                                <button
                                  className="btn-icon"
                                  title="Eliminar"
                                  onClick={() => eliminar(c.id)}
                                >
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vista de cards (móvil) */}
            <div className="cards-clientes-mobile">
              {cargando ? (
                <p className="panel-vacio">Cargando clientes... 🍚</p>
              ) : clientes.length === 0 ? (
                <p className="panel-vacio">
                  👥 Aún no hay clientes registrados
                  <br />
                  <small>Haz clic en "➕ Nuevo cliente" para empezar</small>
                </p>
              ) : (
                <>
                  {clientes.length > 1 && (
                    <label className="card-selector-todos">
                      <input
                        type="checkbox"
                        checked={todosSeleccionados}
                        onChange={toggleTodos}
                      />
                      <span>Seleccionar todos ({clientes.length})</span>
                    </label>
                  )}

                  {clientes.map((c) => {
                    const activo = seleccionados.includes(c.id);

                    return (
                      <div
                        key={c.id}
                        className={`cliente-card-mobile ${
                          activo ? 'cliente-card-activa' : ''
                        }`}
                      >
                        {/* Barra superior turquesa */}
                        <div className="cliente-card-barra" />

                        {/* Header */}
                        <div className="cliente-card-header">
                          <label className="cliente-card-check">
                            <input
                              type="checkbox"
                              checked={activo}
                              onChange={() => toggleSeleccion(c.id)}
                            />
                          </label>
                          <div className="cliente-card-avatar">
                            {c.nombre?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="cliente-card-info">
                            <strong>{c.nombre}</strong>
                            <small>📅 {formatearFecha(c.fecha)}</small>
                          </div>
                        </div>

                        {/* Teléfono destacado */}
                        <div className="cliente-card-telefono">
                          <span className="telefono-label">📞 Teléfono</span>
                          <a
                            href={`tel:${c.telefono}`}
                            className="telefono-valor"
                          >
                            {c.telefono}
                          </a>
                        </div>

                        {/* Registrado por */}
                        <div className="cliente-card-meta">
                          <span className="meta-label">👤 Registrado por</span>
                          <span className="meta-valor">
                            {c.creadoPorEmail || 'anónimo'}
                          </span>
                        </div>

                        {/* Acciones */}
                        <div className="cliente-card-acciones">
                          <button
                            className="btn-accion-card btn-editar"
                            onClick={() => setEditando({ ...c })}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            className="btn-accion-card btn-eliminar"
                            onClick={() => eliminar(c.id)}
                          >
                            🗑 Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✏️ MODAL DE EDICIÓN */}
      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Editar cliente</h3>
              <button className="modal-close" onClick={() => setEditando(null)}>
                ✖
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={editando.nombre || ''}
                    onChange={(e) =>
                      setEditando({ ...editando, nombre: e.target.value })
                    }
                  />
                </div>

                <div className="form-field form-field-full">
                  <label>Teléfono</label>
                  <input
                    type="tel"
                    value={editando.telefono || ''}
                    onChange={(e) =>
                      setEditando({ ...editando, telefono: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <Button
                variant="danger"
                fullWidth={false}
                onClick={() => setEditando(null)}
              >
                Cancelar
              </Button>
              <Button
                fullWidth={false}
                onClick={guardarEdicion}
                disabled={
                  guardandoEdit ||
                  !editando.nombre?.trim() ||
                  !editando.telefono?.trim()
                }
              >
                {guardandoEdit ? 'Guardando...' : '💾 Guardar cambios'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clientes;