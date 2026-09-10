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
import '../styles/Modulos.css';

const ENTREGAS = ['Pendiente', 'Entregado'];
const ESTADOS  = ['Pendiente', 'Pagado'];

function Ventas({ usuario, onAbrirSidebar }) {
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState('');

  const [nuevo, setNuevo] = useState({
    clienteId: '',
    cantidad: '',
    valorUnitario: '',
    abono: '',
    entrega: 'Pendiente',
    estado: 'Pendiente',
    loteId: ''
  });

  const [seleccionados, setSeleccionados] = useState([]);
  const [editando, setEditando] = useState(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  // 📄 Paginación (PC)
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  // 📱 Botón "Ver más" (móvil)
  const [mostrarEnMobile, setMostrarEnMobile] = useState(20);

  // 🔍 Buscador
  const [busqueda, setBusqueda] = useState('');

  // 🍚 Filtro por lote
  const [filtroLote, setFiltroLote] = useState('todos');

  // 🍚 Dropdown custom
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const dropdownRef = useRef(null);

  // 🔥 Cargar ventas, clientes y lotes en tiempo real
  useEffect(() => {
    const qVentas = query(collection(db, 'ventas'), orderBy('fecha', 'desc'));
    const unsubVentas = onSnapshot(
      qVentas,
      (snapshot) => {
        setVentas(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCargando(false);
      },
      (err) => {
        console.error(err);
        setError('No se pudieron cargar las ventas');
        setCargando(false);
      }
    );

    const qClientes = query(collection(db, 'clientes'), orderBy('nombre'));
    const unsubClientes = onSnapshot(qClientes, (snapshot) => {
      setClientes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const qLotes = query(collection(db, 'lotes'), orderBy('fecha', 'desc'));
    const unsubLotes = onSnapshot(qLotes, (snapshot) => {
      setLotes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubVentas();
      unsubClientes();
      unsubLotes();
    };
  }, []);

  // 🔒 Cerrar dropdown al hacer clic fuera o presionar Escape
  useEffect(() => {
    const handleClickFuera = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownAbierto(false);
      }
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') setDropdownAbierto(false);
    };

    document.addEventListener('mousedown', handleClickFuera);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handleClickFuera);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // 📅 Formatear fecha sin problema de timezone
  const formatearFecha = (fecha) => {
    if (!fecha) return '...';

    if (fecha.toDate) {
      return fecha.toDate().toLocaleDateString('es-CO');
    }

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

  // 🔍 Filtrar ventas según búsqueda + lote
  const ventasFiltradas = ventas.filter((v) => {
    // 1. Filtro por lote
    if (filtroLote !== 'todos') {
      if (filtroLote === 'sin-lote') {
        if (v.loteId) return false;
      } else if (v.loteId !== filtroLote) {
        return false;
      }
    }

    // 2. Filtro por búsqueda
    if (!busqueda.trim()) return true;

    const busq = busqueda.toLowerCase().trim();
    const fechaFormateada = formatearFecha(v.fecha).toLowerCase();

    return (
      (v.clienteNombre || '').toLowerCase().includes(busq) ||
      (v.clienteTelefono || '').toLowerCase().includes(busq) ||
      (v.loteNombre || '').toLowerCase().includes(busq) ||
      fechaFormateada.includes(busq) ||
      String(v.cantidad || '').includes(busq)
    );
  });

  // 🧮 Cálculos del formulario
  const cantidadNum = Number(nuevo.cantidad) || 0;
  const valorNum    = Number(nuevo.valorUnitario) || 0;
  const abonoNum    = Number(nuevo.abono) || 0;

  const totalFormulario   = cantidadNum * valorNum;
  const pagadoFormulario  = abonoNum;
  const saldoFormulario   = totalFormulario - pagadoFormulario;

  // 🧮 Cálculos del modal de edición
  const editCantidad = Number(editando?.cantidad) || 0;
  const editValor    = Number(editando?.valorUnitario) || 0;
  const editAbono    = Number(editando?.abono) || 0;
  const totalEditando  = editCantidad * editValor;
  const pagadoEditando = editAbono;
  const saldoEditando  = totalEditando - pagadoEditando;

  // 📄 Cálculos de paginación (PC) — sobre ventas filtradas
  const totalPaginas = Math.ceil(ventasFiltradas.length / porPagina);
  const inicio = (paginaActual - 1) * porPagina;
  const fin = inicio + porPagina;
  const ventasPaginadas = ventasFiltradas.slice(inicio, fin);

  // Resetear página si cambia el tamaño o la cantidad
  useEffect(() => {
    if (paginaActual > totalPaginas && totalPaginas > 0) {
      setPaginaActual(1);
    }
  }, [porPagina, ventasFiltradas.length, totalPaginas, paginaActual]);

  // Resetear filtros cuando cambie la búsqueda o el lote
  useEffect(() => {
    setPaginaActual(1);
    setMostrarEnMobile(20);
  }, [busqueda, filtroLote]);

  const irPagina = (n) => {
    if (n < 1 || n > totalPaginas) return;
    setPaginaActual(n);
  };

  // ➕ Agregar venta
  const agregar = async () => {
    const cliente = clientes.find((c) => c.id === nuevo.clienteId);
    if (!cliente || !nuevo.cantidad || !nuevo.valorUnitario) return;

    const total = cantidadNum * valorNum;
    const pagado = abonoNum;
    const saldo = total - pagado;

    const loteSeleccionado = lotes.find((l) => l.id === nuevo.loteId);

    setGuardando(true);
    setError('');

    try {
      await addDoc(collection(db, 'ventas'), {
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        clienteTelefono: cliente.telefono || '',
        cantidad: cantidadNum,
        valorUnitario: valorNum,
        total,
        abono: abonoNum,
        pagado,
        saldo,
        entrega: nuevo.entrega,
        estado: nuevo.estado,
        loteId: loteSeleccionado?.id || null,
        loteNombre: loteSeleccionado?.nombre || null,
        fecha: serverTimestamp(),
        creadoPor: usuario?.uid || 'anónimo',
        creadoPorEmail: usuario?.email || 'anónimo'
      });

      setNuevo({
        clienteId: '',
        cantidad: '',
        valorUnitario: '',
        abono: '',
        entrega: 'Pendiente',
        estado: 'Pendiente',
        loteId: ''
      });
      setMostrarForm(false);
    } catch (err) {
      console.error('Error al guardar venta:', err);
      setError('Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // ✏️ Guardar edición
  const guardarEdicion = async () => {
    if (!editando) return;
    const cliente = clientes.find((c) => c.id === editando.clienteId);
    if (!cliente || !editando.cantidad || !editando.valorUnitario) return;

    const total = editCantidad * editValor;
    const pagado = editAbono;
    const saldo = total - pagado;

    const loteSeleccionado = lotes.find((l) => l.id === editando.loteId);

    setGuardandoEdit(true);
    setError('');

    try {
      const ref = doc(db, 'ventas', editando.id);
      await updateDoc(ref, {
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        clienteTelefono: cliente.telefono || '',
        cantidad: editCantidad,
        valorUnitario: editValor,
        total,
        abono: editAbono,
        pagado,
        saldo,
        entrega: editando.entrega || 'Pendiente',
        estado: editando.estado || 'Pendiente',
        loteId: loteSeleccionado?.id || null,
        loteNombre: loteSeleccionado?.nombre || null,
        editadoPor: usuario?.email || 'anónimo'
      });
      setEditando(null);
    } catch (err) {
      console.error('Error al editar venta:', err);
      setError('Error: ' + err.message);
    } finally {
      setGuardandoEdit(false);
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta venta?')) return;
    try {
      await deleteDoc(doc(db, 'ventas', id));
      setSeleccionados(seleccionados.filter((s) => s !== id));
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar');
    }
  };

  const eliminarSeleccionados = async () => {
    if (seleccionados.length === 0) return;
    if (!window.confirm(`¿Eliminar ${seleccionados.length} venta(s)?`)) return;
    try {
      await Promise.all(
        seleccionados.map((id) => deleteDoc(doc(db, 'ventas', id)))
      );
      setSeleccionados([]);
    } catch (err) {
      console.error(err);
      setError('No se pudieron eliminar las seleccionadas');
    }
  };

  const toggleSeleccion = (id) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleTodos = () => {
    if (seleccionados.length === ventasPaginadas.length) {
      setSeleccionados((prev) =>
        prev.filter((id) => !ventasPaginadas.some((v) => v.id === id))
      );
    } else {
      const idsPagina = ventasPaginadas.map((v) => v.id);
      setSeleccionados((prev) => [...new Set([...prev, ...idsPagina])]);
    }
  };

  const todosSeleccionados =
    ventasPaginadas.length > 0 &&
    ventasPaginadas.every((v) => seleccionados.includes(v.id));

  // 💰 Totales (sobre ventas filtradas para reflejar la búsqueda)
  const totalVendido = ventasFiltradas.reduce((s, v) => s + (v.total || 0), 0);
  const totalPagado  = ventasFiltradas.reduce((s, v) => s + (v.pagado || 0), 0);
  const totalSaldo   = ventasFiltradas.reduce((s, v) => s + (v.saldo || 0), 0);

  const totalSelVendido = ventas
    .filter((v) => seleccionados.includes(v.id))
    .reduce((s, v) => s + (v.total || 0), 0);
  const totalSelSaldo = ventas
    .filter((v) => seleccionados.includes(v.id))
    .reduce((s, v) => s + (v.saldo || 0), 0);

  const colorEntrega = (e) =>
    e === 'Entregado' ? 'badge-verde' : 'badge-amarillo';

  const colorEstado = (e) =>
    e === 'Pagado' ? 'badge-verde' : 'badge-amarillo';

  // Helper para obtener el nombre del lote seleccionado
  const nombreLoteFiltro =
    filtroLote === 'sin-lote'
      ? 'Sin lote'
      : filtroLote === 'todos'
      ? null
      : lotes.find((l) => l.id === filtroLote)?.nombre || '';

  return (
    <div className="modulo-layout">
      <div className="modulo-main">
        <TopBar
          usuario={usuario}
          titulo="💰 Ventas"
          onAbrirSidebar={onAbrirSidebar}
        />

        <div className="modulo-content">
          <div className="modulo-header">
            <div>
              <h1>Registro de ventas</h1>
              <p>
                Total vendido: <strong>${totalVendido.toLocaleString('es-CO')}</strong>
                {' '}· Pagado: <strong style={{ color: '#2A9D8F' }}>
                  ${totalPagado.toLocaleString('es-CO')}
                </strong>
                {' '}· Saldo: <strong style={{ color: '#F26B7A' }}>
                  ${totalSaldo.toLocaleString('es-CO')}
                </strong>
                {seleccionados.length > 0 && (
                  <>
                    <br />
                    <small>
                      Seleccionado: vendido ${totalSelVendido.toLocaleString('es-CO')} ·
                      saldo pendiente ${totalSelSaldo.toLocaleString('es-CO')}
                    </small>
                  </>
                )}
              </p>
            </div>
            <div className="modulo-acciones">
              {seleccionados.length > 0 && (
                <Button variant="danger" onClick={eliminarSeleccionados} fullWidth={false}>
                  🗑 Eliminar ({seleccionados.length})
                </Button>
              )}
              <Button onClick={() => setMostrarForm(!mostrarForm)} fullWidth={false}>
                {mostrarForm ? '← Volver a la lista' : '➕ Nueva venta'}
              </Button>
            </div>
          </div>

          {/* 🔍 BUSCADOR Y FILTROS (solo si NO está creando) */}
          {!mostrarForm && (
            <>
              <div className="filtros-ventas">
                {/* Buscador */}
                <div className="buscador-ventas">
                  <span className="buscador-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar por cliente, teléfono, fecha..."
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
                <div className="filtro-lote-ventas" ref={dropdownRef}>
                  <button
                    type="button"
                    className="filtro-lote-trigger"
                    onClick={() => setDropdownAbierto(!dropdownAbierto)}
                  >
                    <span className="filtro-lote-icon">🍚</span>
                    <span className="filtro-lote-label">
                      {filtroLote === 'todos' && (
                        <>📚 Todos los lotes ({ventas.length})</>
                      )}
                      {filtroLote === 'sin-lote' && (
                        <>⚠️ Sin lote ({ventas.filter((v) => !v.loteId).length})</>
                      )}
                      {filtroLote !== 'todos' && filtroLote !== 'sin-lote' && (
                        <>
                          🍚 {lotes.find((l) => l.id === filtroLote)?.nombre} (
                          {ventas.filter((v) => v.loteId === filtroLote).length})
                        </>
                      )}
                    </span>
                    <span className={`filtro-lote-arrow ${dropdownAbierto ? 'abierto' : ''}`}>
                      ▼
                    </span>
                  </button>

                  {dropdownAbierto && (
                    <div className="filtro-lote-menu">
                      <button
                        type="button"
                        className={`filtro-lote-opcion ${
                          filtroLote === 'todos' ? 'activa' : ''
                        }`}
                        onClick={() => {
                          setFiltroLote('todos');
                          setDropdownAbierto(false);
                        }}
                      >
                        <span className="opcion-icon">📚</span>
                        <span className="opcion-texto">Todos los lotes</span>
                        <span className="opcion-cantidad">{ventas.length}</span>
                        {filtroLote === 'todos' && <span className="opcion-check">✓</span>}
                      </button>

                      <button
                        type="button"
                        className={`filtro-lote-opcion ${
                          filtroLote === 'sin-lote' ? 'activa' : ''
                        }`}
                        onClick={() => {
                          setFiltroLote('sin-lote');
                          setDropdownAbierto(false);
                        }}
                      >
                        <span className="opcion-icon">⚠️</span>
                        <span className="opcion-texto">Sin lote</span>
                        <span className="opcion-cantidad">
                          {ventas.filter((v) => !v.loteId).length}
                        </span>
                        {filtroLote === 'sin-lote' && <span className="opcion-check">✓</span>}
                      </button>

                      {lotes.map((l) => {
                        const cantidad = ventas.filter((v) => v.loteId === l.id).length;
                        return (
                          <button
                            key={l.id}
                            type="button"
                            className={`filtro-lote-opcion ${
                              filtroLote === l.id ? 'activa' : ''
                            }`}
                            onClick={() => {
                              setFiltroLote(l.id);
                              setDropdownAbierto(false);
                            }}
                          >
                            <span className="opcion-icon">🍚</span>
                            <span className="opcion-texto">{l.nombre}</span>
                            <span className="opcion-cantidad">{cantidad}</span>
                            {filtroLote === l.id && <span className="opcion-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Contador de resultados */}
              {(busqueda || filtroLote !== 'todos') && (
                <div className="buscador-resultados">
                  {ventasFiltradas.length === 0 ? (
                    <span style={{ color: '#F26B7A' }}>
                      ❌ No se encontraron ventas
                      {busqueda && <> para "<strong>{busqueda}</strong>"</>}
                      {filtroLote !== 'todos' && (
                        <>
                          {' '}en el lote <strong>{nombreLoteFiltro}</strong>
                        </>
                      )}
                    </span>
                  ) : (
                    <span>
                      ✅ Mostrando <strong>{ventasFiltradas.length}</strong> de{' '}
                      <strong>{ventas.length}</strong> ventas
                      {filtroLote !== 'todos' && (
                        <>
                          {' '}· Lote: <strong>{nombreLoteFiltro}</strong>
                        </>
                      )}
                      {busqueda && (
                        <>
                          {' '}· Búsqueda: <strong>"{busqueda}"</strong>
                        </>
                      )}
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {error && <div className="error-msg">{error}</div>}

          {/* ➕ Formulario */}
          {mostrarForm && (
            <div className="form-card">
              <h3>Agregar nueva venta</h3>

              {clientes.length === 0 ? (
                <div className="error-msg">
                  ⚠️ Primero debes registrar al menos un cliente en el módulo <strong>Clientes</strong>.
                </div>
              ) : (
                <>
                  <div className="form-grid">
                    <div className="form-field form-field-full">
                      <label>Cliente</label>
                      <select
                        value={nuevo.clienteId}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, clienteId: e.target.value })
                        }
                      >
                        <option value="">Selecciona un cliente</option>
                        {clientes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} · {c.telefono}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field form-field-full">
                      <label>Lote (opcional)</label>
                      <select
                        value={nuevo.loteId}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, loteId: e.target.value })
                        }
                      >
                        <option value="">— Sin lote (venta general) —</option>
                        {lotes.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.nombre} · {l.cantidadProducida} producidos ·{' '}
                            {formatearFecha(l.fecha)}
                          </option>
                        ))}
                      </select>
                      <small className="hint">
                        💡 Elige a qué lote pertenece esta venta (o déjalo vacío)
                      </small>
                    </div>

                    <div className="form-field">
                      <label>Cantidad vendida</label>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        step="1"
                        value={nuevo.cantidad}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, cantidad: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>Valor unitario</label>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        step="0.01"
                        value={nuevo.valorUnitario}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, valorUnitario: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>💵 Abono inicial</label>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        step="0.01"
                        value={nuevo.abono}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, abono: e.target.value })
                        }
                      />
                      <small className="hint">
                        💡 Cuánto te pagó (puede ser menos del total)
                      </small>
                    </div>

                    <div className="form-field">
                      <label>Entrega</label>
                      <select
                        value={nuevo.entrega}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, entrega: e.target.value })
                        }
                      >
                        {ENTREGAS.map((e) => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Estado</label>
                      <select
                        value={nuevo.estado}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, estado: e.target.value })
                        }
                      >
                        {ESTADOS.map((e) => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field form-field-full">
                      <label>Resumen</label>
                      <div className="total-preview">
                        Total: <strong>${totalFormulario.toLocaleString('es-CO')}</strong>
                        {' '}· Abonado: <strong style={{ color: '#2A9D8F' }}>
                          ${pagadoFormulario.toLocaleString('es-CO')}
                        </strong>
                        {' '}· Saldo: <strong style={{ color: '#F26B7A' }}>
                          ${saldoFormulario.toLocaleString('es-CO')}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={agregar}
                    fullWidth={false}
                    disabled={
                      guardando ||
                      !nuevo.clienteId ||
                      !nuevo.cantidad ||
                      !nuevo.valorUnitario
                    }
                  >
                    {guardando ? 'Guardando...' : 'Guardar venta'}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* 📋 TABLA (desktop/tablet) + CARDS (móvil) */}
          {!mostrarForm && (
            <div className="dashboard-panel">
              {/* Vista de tabla (PC/Tablet) */}
              <div className="tabla-ventas-desktop">
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
                        <th>Cliente</th>
                        <th>Cant.</th>
                        <th>Total</th>
                        <th>Abonado</th>
                        <th>Saldo</th>
                        <th>Lote</th>
                        <th>Entrega</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th style={{ width: '100px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cargando ? (
                        <tr>
                          <td colSpan="11" style={{ textAlign: 'center', padding: '30px' }}>
                            Cargando ventas... 🍚
                          </td>
                        </tr>
                      ) : ventasFiltradas.length === 0 ? (
                        <tr>
                          <td
                            colSpan="11"
                            style={{ textAlign: 'center', padding: '40px', color: '#8B7A66' }}
                          >
                            {busqueda || filtroLote !== 'todos' ? (
                              <>
                                🔍 No se encontraron ventas
                                {busqueda && <> para "<strong>{busqueda}</strong>"</>}
                                {filtroLote !== 'todos' && (
                                  <>
                                    {' '}en el lote <strong>{nombreLoteFiltro}</strong>
                                  </>
                                )}
                                <br />
                                <small>Prueba con otro filtro o término de búsqueda</small>
                              </>
                            ) : (
                              <>
                                💰 Aún no hay ventas registradas
                                <br />
                                <small>Haz clic en "➕ Nueva venta" para empezar</small>
                              </>
                            )}
                          </td>
                        </tr>
                      ) : (
                        ventasPaginadas.map((v) => {
                          const activo = seleccionados.includes(v.id);
                          return (
                            <tr key={v.id} className={activo ? 'fila-seleccionada' : ''}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={activo}
                                  onChange={() => toggleSeleccion(v.id)}
                                />
                              </td>
                              <td>
                                <strong>{v.clienteNombre}</strong>
                                <br />
                                <small style={{ color: '#8B7A66' }}>
                                  {v.clienteTelefono}
                                </small>
                              </td>
                              <td>{v.cantidad}</td>
                              <td>${v.total?.toLocaleString('es-CO')}</td>
                              <td>
                                <strong style={{ color: '#2A9D8F' }}>
                                  ${v.pagado?.toLocaleString('es-CO')}
                                </strong>
                              </td>
                              <td>
                                <strong style={{ color: v.saldo > 0 ? '#F26B7A' : '#8B7A66' }}>
                                  ${v.saldo?.toLocaleString('es-CO')}
                                </strong>
                              </td>
                              <td>
                                {v.loteNombre ? (
                                  <span className="badge badge-verde">
                                    🍚 {v.loteNombre}
                                  </span>
                                ) : (
                                  <span style={{ color: '#8B7A66', fontSize: 12 }}>
                                    —
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${colorEntrega(v.entrega)}`}>
                                  {v.entrega}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${colorEstado(v.estado)}`}>
                                  {v.estado}
                                </span>
                              </td>
                              <td>{formatearFecha(v.fecha)}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    className="btn-icon"
                                    title="Editar"
                                    onClick={() =>
                                      setEditando({
                                        ...v,
                                        cantidad: v.cantidad ?? '',
                                        valorUnitario: v.valorUnitario ?? '',
                                        abono: v.abono ?? v.pagado ?? 0,
                                        loteId: v.loteId || ''
                                      })
                                    }
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    className="btn-icon"
                                    title="Eliminar"
                                    onClick={() => eliminar(v.id)}
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

                    {ventasFiltradas.length > 0 && (
                      <tfoot>
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'right', fontWeight: '600' }}>
                            Totales:
                          </td>
                          <td>
                            <strong style={{ color: '#5C3A21' }}>
                              ${totalVendido.toLocaleString('es-CO')}
                            </strong>
                          </td>
                          <td>
                            <strong style={{ color: '#2A9D8F' }}>
                              ${totalPagado.toLocaleString('es-CO')}
                            </strong>
                          </td>
                          <td>
                            <strong style={{ color: '#F26B7A' }}>
                              ${totalSaldo.toLocaleString('es-CO')}
                            </strong>
                          </td>
                          <td colSpan="5"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* 📄 PAGINACIÓN (PC) */}
                {ventasFiltradas.length > 0 && (
                  <div className="paginacion">
                    <div className="paginacion-info">
                      Mostrando <strong>{inicio + 1}</strong>-
                      <strong>{Math.min(fin, ventasFiltradas.length)}</strong> de{' '}
                      <strong>{ventasFiltradas.length}</strong> ventas
                    </div>

                    <div className="paginacion-controles">
                      <button
                        className="pag-btn"
                        onClick={() => irPagina(paginaActual - 1)}
                        disabled={paginaActual === 1}
                        title="Anterior"
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
                        title="Siguiente"
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
              <div className="cards-ventas-mobile">
                {cargando ? (
                  <p className="panel-vacio">Cargando ventas... 🍚</p>
                ) : ventasFiltradas.length === 0 ? (
                  <p className="panel-vacio">
                    {busqueda || filtroLote !== 'todos' ? (
                      <>
                        🔍 No se encontraron ventas
                        {busqueda && <> para "<strong>{busqueda}</strong>"</>}
                        {filtroLote !== 'todos' && (
                          <>
                            {' '}en el lote <strong>{nombreLoteFiltro}</strong>
                          </>
                        )}
                        <br />
                        <small>Prueba con otro filtro o término de búsqueda</small>
                      </>
                    ) : (
                      <>
                        💰 Aún no hay ventas registradas
                        <br />
                        <small>Haz clic en "➕ Nueva venta" para empezar</small>
                      </>
                    )}
                  </p>
                ) : (
                  <>
                    {ventasFiltradas.length > 1 && (
                      <label className="card-selector-todos">
                        <input
                          type="checkbox"
                          checked={todosSeleccionados}
                          onChange={toggleTodos}
                        />
                        <span>Seleccionar todos ({ventasFiltradas.length})</span>
                      </label>
                    )}

                    {ventasFiltradas.slice(0, mostrarEnMobile).map((v) => {
                      const activo = seleccionados.includes(v.id);
                      const esPagado = v.estado === 'Pagado';
                      const esEntregado = v.entrega === 'Entregado';

                      return (
                        <div
                          key={v.id}
                          className={`venta-card ${activo ? 'venta-card-activa' : ''}`}
                        >
                          <div
                            className={`venta-card-barra ${
                              esPagado ? 'barra-verde' : 'barra-amarilla'
                            }`}
                          />

                          <div className="venta-card-header">
                            <label className="venta-card-check">
                              <input
                                type="checkbox"
                                checked={activo}
                                onChange={() => toggleSeleccion(v.id)}
                              />
                            </label>
                            <div className="venta-card-cliente">
                              <strong>{v.clienteNombre}</strong>
                              <small>📞 {v.clienteTelefono || 'Sin teléfono'}</small>
                            </div>
                            <div className="venta-card-fecha">
                              <span>{formatearFecha(v.fecha)}</span>
                            </div>
                          </div>

                          <div className="venta-card-total-destacado">
                            <span className="total-label">💰 Total</span>
                            <strong className="total-valor">
                              ${v.total?.toLocaleString('es-CO')}
                            </strong>
                          </div>

                          <div className="venta-card-info">
                            <div className="info-item">
                              <span className="info-label">📦 Cantidad</span>
                              <strong>{v.cantidad}</strong>
                            </div>
                            <div className="info-item">
                              <span className="info-label">✅ Abonado</span>
                              <strong style={{ color: '#2A9D8F' }}>
                                ${v.pagado?.toLocaleString('es-CO')}
                              </strong>
                            </div>
                            <div className="info-item info-item-full">
                              <span className="info-label">⏳ Saldo pendiente</span>
                              <strong
                                style={{
                                  color: v.saldo > 0 ? '#F26B7A' : '#8B7A66',
                                  fontSize: v.saldo > 0 ? '18px' : '15px'
                                }}
                              >
                                ${v.saldo?.toLocaleString('es-CO')}
                              </strong>
                            </div>
                          </div>

                          <div className="venta-card-badges">
                            {v.loteNombre && (
                              <span className="badge badge-verde">🍚 {v.loteNombre}</span>
                            )}
                            <span className={`badge ${colorEntrega(v.entrega)}`}>
                              {esEntregado ? '✅' : '🚚'} {v.entrega}
                            </span>
                            <span className={`badge ${colorEstado(v.estado)}`}>
                              {esPagado ? '💰' : '⏳'} {v.estado}
                            </span>
                          </div>

                          <div className="venta-card-acciones">
                            <button
                              className="btn-accion-card btn-editar"
                              onClick={() =>
                                setEditando({
                                  ...v,
                                  cantidad: v.cantidad ?? '',
                                  valorUnitario: v.valorUnitario ?? '',
                                  abono: v.abono ?? v.pagado ?? 0,
                                  loteId: v.loteId || ''
                                })
                              }
                            >
                              ✏️ Editar
                            </button>
                            <button
                              className="btn-accion-card btn-eliminar"
                              onClick={() => eliminar(v.id)}
                            >
                              🗑 Eliminar
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* 📱 Botón "Ver más" en móvil */}
                    {ventasFiltradas.length > mostrarEnMobile && (
                      <button
                        className="btn-ver-mas-mobile"
                        onClick={() => setMostrarEnMobile(mostrarEnMobile + 20)}
                      >
                        ⬇️ Ver más ventas ({ventasFiltradas.length - mostrarEnMobile} restantes)
                      </button>
                    )}

                    <div className="ventas-totales-mobile">
                      <h4 className="totales-titulo">📊 Resumen general</h4>
                      <div className="total-row">
                        <span>💰 Total vendido</span>
                        <strong style={{ color: '#5C3A21' }}>
                          ${totalVendido.toLocaleString('es-CO')}
                        </strong>
                      </div>
                      <div className="total-row">
                        <span>✅ Total abonado</span>
                        <strong style={{ color: '#2A9D8F' }}>
                          ${totalPagado.toLocaleString('es-CO')}
                        </strong>
                      </div>
                      <div className="total-row total-row-destacado">
                        <span>⏳ Saldo por cobrar</span>
                        <strong style={{ color: '#F26B7A' }}>
                          ${totalSaldo.toLocaleString('es-CO')}
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
              <h3>✏️ Editar venta</h3>
              <button className="modal-close" onClick={() => setEditando(null)}>
                ✖
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label>Cliente</label>
                  <select
                    value={editando.clienteId}
                    onChange={(e) =>
                      setEditando({ ...editando, clienteId: e.target.value })
                    }
                  >
                    <option value="">Selecciona un cliente</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} · {c.telefono}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field form-field-full">
                  <label>Lote (opcional)</label>
                  <select
                    value={editando.loteId || ''}
                    onChange={(e) =>
                      setEditando({ ...editando, loteId: e.target.value })
                    }
                  >
                    <option value="">— Sin lote (venta general) —</option>
                    {lotes.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre} · {l.cantidadProducida} producidos ·{' '}
                        {formatearFecha(l.fecha)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Cantidad vendida</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editando.cantidad}
                    onChange={(e) =>
                      setEditando({ ...editando, cantidad: e.target.value })
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Valor unitario</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editando.valorUnitario}
                    onChange={(e) =>
                      setEditando({ ...editando, valorUnitario: e.target.value })
                    }
                  />
                </div>

                <div className="form-field">
                  <label>💵 Abono</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editando.abono}
                    onChange={(e) =>
                      setEditando({ ...editando, abono: e.target.value })
                    }
                  />
                  <small className="hint">
                    💡 Edítalo cuando el cliente pague más
                  </small>
                </div>

                <div className="form-field">
                  <label>Entrega</label>
                  <select
                    value={editando.entrega || 'Pendiente'}
                    onChange={(e) =>
                      setEditando({ ...editando, entrega: e.target.value })
                    }
                  >
                    {ENTREGAS.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Estado</label>
                  <select
                    value={editando.estado || 'Pendiente'}
                    onChange={(e) =>
                      setEditando({ ...editando, estado: e.target.value })
                    }
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field form-field-full">
                  <label>Resumen</label>
                  <div className="total-preview">
                    Total: <strong>${totalEditando.toLocaleString('es-CO')}</strong>
                    {' '}· Abonado: <strong style={{ color: '#2A9D8F' }}>
                      ${pagadoEditando.toLocaleString('es-CO')}
                    </strong>
                    {' '}· Saldo: <strong style={{ color: '#F26B7A' }}>
                      ${saldoEditando.toLocaleString('es-CO')}
                    </strong>
                  </div>
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
                  !editando.clienteId ||
                  !editando.cantidad ||
                  !editando.valorUnitario
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
 
export default Ventas;