import { useState, useEffect, useRef } from 'react';
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
import '../styles/Gastos.css';

// 📝 Conceptos predefinidos
const CONCEPTOS = [
  'Transporte',
  'Empaques',
  'Gas',
  'Agua',
  'Luz',
  'Mano de obra',
  'Publicidad',
  'Etiquetas',
  'Mantenimiento',
  'Otros'
];

function Gastos({ usuario, onAbrirSidebar }) {
  const [gastos, setGastos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState('');

  // ➕ Formulario
  const [nuevo, setNuevo] = useState({
    loteId: '',
    concepto: 'Transporte',
    descripcion: '',
    valor: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  const [seleccionados, setSeleccionados] = useState([]);
  const [editando, setEditando] = useState(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);

 // 🎛️ Filtros
const [filtroLote, setFiltroLote] = useState('todos');
const [filtroConcepto, setFiltroConcepto] = useState('todos');
const [busqueda, setBusqueda] = useState('');

// 🔽 Dropdown custom para lote
const [dropdownLoteAbierto, setDropdownLoteAbierto] = useState(false);
const dropdownLoteRef = useRef(null);

  // 📄 Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  // 🔥 Cargar gastos y lotes
  useEffect(() => {
    const qGastos = query(collection(db, 'gastos'), orderBy('fecha', 'desc'));
    const unsubGastos = onSnapshot(
      qGastos,
      (snap) => {
        setGastos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCargando(false);
      },
      (err) => {
        console.error(err);
        setError('No se pudieron cargar los gastos');
        setCargando(false);
      }
    );

    const qLotes = query(collection(db, 'lotes'), orderBy('fecha', 'desc'));
    const unsubLotes = onSnapshot(qLotes, (snap) => {
      setLotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubGastos();
      unsubLotes();
    };
  }, []);

  

  // 🔒 Cerrar dropdown al hacer clic fuera o presionar Escape
useEffect(() => {
  const handleClickFuera = (e) => {
    if (dropdownLoteRef.current && !dropdownLoteRef.current.contains(e.target)) {
      setDropdownLoteAbierto(false);
    }
  };
  const handleEsc = (e) => {
    if (e.key === 'Escape') setDropdownLoteAbierto(false);
  };
  document.addEventListener('mousedown', handleClickFuera);
  document.addEventListener('keydown', handleEsc);
  return () => {
    document.removeEventListener('mousedown', handleClickFuera);
    document.removeEventListener('keydown', handleEsc);
  };
}, []);

  // 📅 Formatear fecha
  const formatearFecha = (fecha) => {
    if (!fecha) return '...';
    if (fecha.toDate) return fecha.toDate().toLocaleDateString('es-CO');
    if (typeof fecha === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        const [yyyy, mm, dd] = fecha.split('-');
        return `${dd}/${mm}/${yyyy}`;
      }
      if (fecha.includes('T')) {
        const [datePart] = fecha.split('T');
        const [yyyy, mm, dd] = datePart.split('-');
        return `${dd}/${mm}/${yyyy}`;
      }
    }
    return new Date(fecha).toLocaleDateString('es-CO');
  };

  // 🔍 Filtrar gastos
  const gastosFiltrados = gastos.filter((g) => {
    if (filtroLote !== 'todos' && g.loteId !== filtroLote) return false;
    if (filtroConcepto !== 'todos' && g.concepto !== filtroConcepto) return false;
    if (!busqueda.trim()) return true;

    const busq = busqueda.toLowerCase().trim();
    const fechaFormateada = formatearFecha(g.fecha).toLowerCase();

    return (
      (g.concepto || '').toLowerCase().includes(busq) ||
      (g.descripcion || '').toLowerCase().includes(busq) ||
      (g.loteNombre || '').toLowerCase().includes(busq) ||
      fechaFormateada.includes(busq) ||
      String(g.valor || '').includes(busq)
    );
  });

  // 📄 Paginación
  const totalPaginas = Math.ceil(gastosFiltrados.length / porPagina);
  const inicio = (paginaActual - 1) * porPagina;
  const fin = inicio + porPagina;
  const gastosPaginados = gastosFiltrados.slice(inicio, fin);

  useEffect(() => {
    if (paginaActual > totalPaginas && totalPaginas > 0) {
      setPaginaActual(1);
    }
  }, [porPagina, gastosFiltrados.length, totalPaginas, paginaActual]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroLote, filtroConcepto]);

  const irPagina = (n) => {
    if (n < 1 || n > totalPaginas) return;
    setPaginaActual(n);
  };

  // 💰 Total filtrado
  const totalGastos = gastosFiltrados.reduce((s, g) => s + (Number(g.valor) || 0), 0);

  // ➕ Agregar gasto
  const agregar = async () => {
    if (!nuevo.loteId || !nuevo.concepto || !nuevo.valor) return;

    const lote = lotes.find((l) => l.id === nuevo.loteId);
    if (!lote) {
      setError('El lote seleccionado no existe');
      return;
    }

    setGuardando(true);
    setError('');

    try {
      await addDoc(collection(db, 'gastos'), {
        loteId: lote.id,
        loteNombre: lote.nombre,
        concepto: nuevo.concepto,
        descripcion: nuevo.descripcion.trim(),
        valor: Number(nuevo.valor) || 0,
        fecha: nuevo.fecha,
        creadoPor: usuario?.uid || 'anónimo',
        creadoPorEmail: usuario?.email || 'anónimo',
        createdAt: serverTimestamp()
      });

      setNuevo({
        loteId: '',
        concepto: 'Transporte',
        descripcion: '',
        valor: '',
        fecha: new Date().toISOString().split('T')[0]
      });
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
    if (!editando.loteId || !editando.concepto || !editando.valor) return;

    const lote = lotes.find((l) => l.id === editando.loteId);
    if (!lote) {
      setError('El lote seleccionado no existe');
      return;
    }

    setGuardandoEdit(true);
    setError('');

    try {
      const ref = doc(db, 'gastos', editando.id);
      await updateDoc(ref, {
        loteId: lote.id,
        loteNombre: lote.nombre,
        concepto: editando.concepto,
        descripcion: editando.descripcion?.trim() || '',
        valor: Number(editando.valor) || 0,
        fecha: editando.fecha,
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
    if (!window.confirm('¿Eliminar este gasto?')) return;
    try {
      await deleteDoc(doc(db, 'gastos', id));
      setSeleccionados(seleccionados.filter((s) => s !== id));
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar');
    }
  };

  const eliminarSeleccionados = async () => {
    if (seleccionados.length === 0) return;
    if (!window.confirm(`¿Eliminar ${seleccionados.length} gasto(s)?`)) return;
    try {
      await Promise.all(
        seleccionados.map((id) => deleteDoc(doc(db, 'gastos', id)))
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
    if (seleccionados.length === gastosPaginados.length) {
      setSeleccionados((prev) =>
        prev.filter((id) => !gastosPaginados.some((g) => g.id === id))
      );
    } else {
      const idsPagina = gastosPaginados.map((g) => g.id);
      setSeleccionados((prev) => [...new Set([...prev, ...idsPagina])]);
    }
  };

  const todosSeleccionados =
    gastosPaginados.length > 0 &&
    gastosPaginados.every((g) => seleccionados.includes(g.id));

  // 🎨 Color por concepto
  const colorConcepto = (concepto) => {
    const colores = {
      Transporte: 'badge-azul',
      Empaques: 'badge-amarillo',
      Gas: 'badge-rojo',
      Agua: 'badge-azul',
      Luz: 'badge-amarillo',
      'Mano de obra': 'badge-verde',
      Publicidad: 'badge-rojo',
      Etiquetas: 'badge-amarillo',
      Mantenimiento: 'badge-azul',
      Otros: 'badge-verde'
    };
    return colores[concepto] || 'badge-verde';
  };

  // Nombre del lote seleccionado (para el dropdown)
  const nombreLoteFiltro =
    filtroLote === 'todos'
      ? null
      : lotes.find((l) => l.id === filtroLote)?.nombre || '';

  return (
    <div className="modulo-layout">
      <div className="modulo-main">
        <TopBar
          usuario={usuario}
          titulo="🗂️ Gastos externos"
          onAbrirSidebar={onAbrirSidebar}
        />

        <div className="modulo-content">
          <div className="modulo-header">
            <div>
              <h1>Gastos externos</h1>
              <p>
                Total gastos:{' '}
                <strong style={{ color: '#F26B7A' }}>
                  ${totalGastos.toLocaleString('es-CO')}
                </strong>
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
                {mostrarForm ? '← Volver a la lista' : '➕ Nuevo gasto'}
              </Button>
            </div>
          </div>

          {/* 🔍 BUSCADOR Y FILTROS */}
          {!mostrarForm && (
            <>
             <div className="filtros-ventas">
  <div className="buscador-ventas">
    <span className="buscador-icon">🔍</span>
    <input
      type="text"
      placeholder="Buscar por concepto, descripción, lote..."
      value={busqueda}
      onChange={(e) => setBusqueda(e.target.value)}
    />
    {busqueda && (
      <button
        className="buscador-limpiar"
        onClick={() => setBusqueda('')}
        title="Limpiar búsqueda"
      >
        ✖
      </button>
    )}
  </div>

  {/* Filtro por lote - Dropdown custom */}
  <div className="filtro-lote-ventas" ref={dropdownLoteRef}>
    <button
      type="button"
      className="filtro-lote-trigger"
      onClick={() => setDropdownLoteAbierto(!dropdownLoteAbierto)}
    >
      <span className="filtro-lote-icon">🍚</span>
      <span className="filtro-lote-label">
        {filtroLote === 'todos' ? (
          <>📚 Todos los lotes ({gastos.length})</>
        ) : (
          <>
            🍚 {lotes.find((l) => l.id === filtroLote)?.nombre || 'Lote'} (
            {gastos.filter((g) => g.loteId === filtroLote).length})
          </>
        )}
      </span>
      <span className={`filtro-lote-arrow ${dropdownLoteAbierto ? 'abierto' : ''}`}>
        ▼
      </span>
    </button>

    {dropdownLoteAbierto && (
      <div className="filtro-lote-menu">
        <button
          type="button"
          className={`filtro-lote-opcion ${
            filtroLote === 'todos' ? 'activa' : ''
          }`}
          onClick={() => {
            setFiltroLote('todos');
            setDropdownLoteAbierto(false);
          }}
        >
          <span className="opcion-icon">📚</span>
          <span className="opcion-texto">Todos los lotes</span>
          <span className="opcion-cantidad">{gastos.length}</span>
          {filtroLote === 'todos' && <span className="opcion-check">✓</span>}
        </button>

        {lotes.map((l) => {
          const cant = gastos.filter((g) => g.loteId === l.id).length;
          return (
            <button
              key={l.id}
              type="button"
              className={`filtro-lote-opcion ${
                filtroLote === l.id ? 'activa' : ''
              }`}
              onClick={() => {
                setFiltroLote(l.id);
                setDropdownLoteAbierto(false);
              }}
            >
              <span className="opcion-icon">🍚</span>
              <span className="opcion-texto">{l.nombre}</span>
              <span className="opcion-cantidad">{cant}</span>
              {filtroLote === l.id && <span className="opcion-check">✓</span>}
            </button>
          );
        })}
      </div>
    )}
  </div>
</div>

              {/* Filtro por concepto */}
              <div className="filtros-conceptos">
                <button
                  className={`filtro-concepto-btn ${filtroConcepto === 'todos' ? 'activo' : ''}`}
                  onClick={() => setFiltroConcepto('todos')}
                >
                  📚 Todos
                </button>
                {CONCEPTOS.map((c) => {
                  const cant = gastos.filter((g) => g.concepto === c).length;
                  if (cant === 0) return null;
                  return (
                    <button
                      key={c}
                      className={`filtro-concepto-btn ${filtroConcepto === c ? 'activo' : ''}`}
                      onClick={() => setFiltroConcepto(c)}
                    >
                      {c} ({cant})
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {error && <div className="error-msg">{error}</div>}

          {/* ➕ FORMULARIO */}
          {mostrarForm && (
            <div className="form-card">
              <h3>Agregar nuevo gasto</h3>

              {lotes.length === 0 ? (
                <div className="error-msg">
                  ⚠️ Primero debes registrar al menos un lote en el módulo{' '}
                  <strong>Lotes</strong>.
                </div>
              ) : (
                <>
                  <div className="form-grid">
                    <div className="form-field form-field-full">
                      <label>Lote *</label>
                      <select
                        value={nuevo.loteId}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, loteId: e.target.value })
                        }
                      >
                        <option value="">Selecciona un lote</option>
                        {lotes.map((l) => (
                          <option key={l.id} value={l.id}>
                            🍚 {l.nombre} · {formatearFecha(l.fecha)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Concepto *</label>
                      <select
                        value={nuevo.concepto}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, concepto: e.target.value })
                        }
                      >
                        {CONCEPTOS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Fecha</label>
                      <input
                        type="date"
                        value={nuevo.fecha}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, fecha: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-field form-field-full">
                      <label>Descripción (opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej: Domicilio a Doña Sandra"
                        value={nuevo.descripcion}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, descripcion: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-field form-field-full">
                      <label>Valor *</label>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        step="0.01"
                        value={nuevo.valor}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, valor: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <Button
                    onClick={agregar}
                    fullWidth={false}
                    disabled={
                      guardando ||
                      !nuevo.loteId ||
                      !nuevo.concepto ||
                      !nuevo.valor
                    }
                  >
                    {guardando ? 'Guardando...' : 'Guardar gasto'}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* 📋 TABLA / CARDS */}
          {!mostrarForm && (
            <div className="dashboard-panel">
              {/* Vista de tabla (PC/Tablet) */}
              <div className="tabla-gastos-desktop">
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
                        <th>Fecha</th>
                        <th>Lote</th>
                        <th>Concepto</th>
                        <th>Descripción</th>
                        <th style={{ textAlign: 'right' }}>Valor</th>
                        <th style={{ width: '100px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cargando ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                            Cargando gastos... 🗂️
                          </td>
                        </tr>
                      ) : gastosFiltrados.length === 0 ? (
                        <tr>
                          <td
                            colSpan="7"
                            style={{
                              textAlign: 'center',
                              padding: '40px',
                              color: '#8B7A66'
                            }}
                          >
                            {busqueda || filtroLote !== 'todos' || filtroConcepto !== 'todos' ? (
                              <>
                                🔍 No se encontraron gastos con esos filtros
                                <br />
                                <small>Prueba con otros criterios</small>
                              </>
                            ) : (
                              <>
                                🗂️ Aún no hay gastos registrados
                                <br />
                                <small>
                                  Haz clic en "➕ Nuevo gasto" para empezar
                                </small>
                              </>
                            )}
                          </td>
                        </tr>
                      ) : (
                        gastosPaginados.map((g) => {
                          const activo = seleccionados.includes(g.id);
                          return (
                            <tr
                              key={g.id}
                              className={activo ? 'fila-seleccionada' : ''}
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  checked={activo}
                                  onChange={() => toggleSeleccion(g.id)}
                                />
                              </td>
                              <td>{formatearFecha(g.fecha)}</td>
                              <td>
                                <span className="badge badge-verde">
                                  🍚 {g.loteNombre}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${colorConcepto(g.concepto)}`}>
                                  {g.concepto}
                                </span>
                              </td>
                              <td style={{ color: '#8B7A66', fontSize: 13 }}>
                                {g.descripcion || '—'}
                              </td>
                              <td
                                style={{
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: '#F26B7A'
                                }}
                              >
                                ${Number(g.valor || 0).toLocaleString('es-CO')}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    className="btn-icon"
                                    title="Editar"
                                    onClick={() =>
                                      setEditando({
                                        ...g,
                                        valor: g.valor ?? '',
                                        descripcion: g.descripcion ?? ''
                                      })
                                    }
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    className="btn-icon"
                                    title="Eliminar"
                                    onClick={() => eliminar(g.id)}
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

                    {gastosFiltrados.length > 0 && (
                      <tfoot>
                        <tr>
                          <td
                            colSpan="5"
                            style={{ textAlign: 'right', fontWeight: '600' }}
                          >
                            Total gastos:
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 800,
                              color: '#F26B7A',
                              fontSize: 15
                            }}
                          >
                            ${totalGastos.toLocaleString('es-CO')}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Paginación */}
                {gastosFiltrados.length > 0 && (
                  <div className="paginacion">
                    <div className="paginacion-info">
                      Mostrando <strong>{inicio + 1}</strong>-
                      <strong>{Math.min(fin, gastosFiltrados.length)}</strong> de{' '}
                      <strong>{gastosFiltrados.length}</strong> gastos
                    </div>

                    <div className="paginacion-controles">
                      <button
                        className="pag-btn"
                        onClick={() => irPagina(paginaActual - 1)}
                        disabled={paginaActual === 1}
                      >
                        ◀️
                      </button>

                      <span className="pag-numero">
                        Página <strong>{paginaActual}</strong> de{' '}
                        <strong>{totalPaginas}</strong>
                      </span>

                      <button
                        className="pag-btn"
                        onClick={() => irPagina(paginaActual + 1)}
                        disabled={paginaActual === totalPaginas}
                      >
                        ▶️
                      </button>
                    </div>

                    <div className="paginacion-tamano">
                      <label>Mostrar:</label>
                      <select
                        value={porPagina}
                        onChange={(e) => {
                          setPorPagina(Number(e.target.value));
                          setPaginaActual(1);
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Vista de cards (móvil) */}
              <div className="cards-gastos-mobile">
                {cargando ? (
                  <p className="panel-vacio">Cargando gastos... 🗂️</p>
                ) : gastosFiltrados.length === 0 ? (
                  <p className="panel-vacio">
                    🗂️ Aún no hay gastos registrados
                  </p>
                ) : (
                  <>
                    {gastosFiltrados.map((g) => {
                      const activo = seleccionados.includes(g.id);
                      return (
                        <div
                          key={g.id}
                          className={`gasto-card ${activo ? 'gasto-card-activa' : ''}`}
                        >
                          <div className="gasto-card-header">
                            <label className="gasto-card-check">
                              <input
                                type="checkbox"
                                checked={activo}
                                onChange={() => toggleSeleccion(g.id)}
                              />
                            </label>
                            <div className="gasto-card-info">
                              <strong>{g.concepto}</strong>
                              <small>{formatearFecha(g.fecha)}</small>
                            </div>
                            <div className="gasto-card-valor">
                              ${Number(g.valor || 0).toLocaleString('es-CO')}
                            </div>
                          </div>

                          {g.descripcion && (
                            <div className="gasto-card-desc">
                              📝 {g.descripcion}
                            </div>
                          )}

                          <div className="gasto-card-lote">
                            <span className="badge badge-verde">
                              🍚 {g.loteNombre}
                            </span>
                          </div>

                          <div className="gasto-card-acciones">
                            <button
                              className="btn-accion-card btn-editar"
                              onClick={() =>
                                setEditando({
                                  ...g,
                                  valor: g.valor ?? '',
                                  descripcion: g.descripcion ?? ''
                                })
                              }
                            >
                              ✏️ Editar
                            </button>
                            <button
                              className="btn-accion-card btn-eliminar"
                              onClick={() => eliminar(g.id)}
                            >
                              🗑 Eliminar
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="ventas-totales-mobile">
                      <h4 className="totales-titulo">📊 Total gastos</h4>
                      <div className="total-row total-row-destacado">
                        <span>🗂️ Gastos</span>
                        <strong style={{ color: '#F26B7A' }}>
                          ${totalGastos.toLocaleString('es-CO')}
                        </strong>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✏️ MODAL DE EDICIÓN */}
      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Editar gasto</h3>
              <button className="modal-close" onClick={() => setEditando(null)}>
                ✖
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label>Lote</label>
                  <select
                    value={editando.loteId}
                    onChange={(e) =>
                      setEditando({ ...editando, loteId: e.target.value })
                    }
                  >
                    <option value="">Selecciona un lote</option>
                    {lotes.map((l) => (
                      <option key={l.id} value={l.id}>
                        🍚 {l.nombre} · {formatearFecha(l.fecha)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Concepto</label>
                  <select
                    value={editando.concepto}
                    onChange={(e) =>
                      setEditando({ ...editando, concepto: e.target.value })
                    }
                  >
                    {CONCEPTOS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={editando.fecha || ''}
                    onChange={(e) =>
                      setEditando({ ...editando, fecha: e.target.value })
                    }
                  />
                </div>

                <div className="form-field form-field-full">
                  <label>Descripción</label>
                  <input
                    type="text"
                    value={editando.descripcion || ''}
                    onChange={(e) =>
                      setEditando({ ...editando, descripcion: e.target.value })
                    }
                  />
                </div>

                <div className="form-field form-field-full">
                  <label>Valor</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editando.valor}
                    onChange={(e) =>
                      setEditando({ ...editando, valor: e.target.value })
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
                  !editando.loteId ||
                  !editando.concepto ||
                  !editando.valor
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

export default Gastos;