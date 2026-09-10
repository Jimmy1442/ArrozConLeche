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
    cantidadPagada: '',
    entrega: 'Pendiente',
    estado: 'Pendiente',
    loteId: ''
  });

  const [seleccionados, setSeleccionados] = useState([]);
  const [editando, setEditando] = useState(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);

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

  // 🧮 Cálculos del formulario
  const cantidadNum = Number(nuevo.cantidad) || 0;
  const valorNum    = Number(nuevo.valorUnitario) || 0;
  const pagadaNum   = Number(nuevo.cantidadPagada) || 0;

  const totalFormulario   = cantidadNum * valorNum;
  const pagadoFormulario  = pagadaNum * valorNum;
  const saldoFormulario   = totalFormulario - pagadoFormulario;

  // 🧮 Cálculos del modal de edición
  const editCantidad = Number(editando?.cantidad) || 0;
  const editValor    = Number(editando?.valorUnitario) || 0;
  const editPagada   = Number(editando?.cantidadPagada) || 0;
  const totalEditando  = editCantidad * editValor;
  const pagadoEditando = editPagada * editValor;
  const saldoEditando  = totalEditando - pagadoEditando;

  // ➕ Agregar venta
  const agregar = async () => {
    const cliente = clientes.find((c) => c.id === nuevo.clienteId);
    if (!cliente || !nuevo.cantidad || !nuevo.valorUnitario) return;

    const total = cantidadNum * valorNum;
    const pagado = pagadaNum * valorNum;
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
        cantidadPagada: pagadaNum,
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
        cantidadPagada: '',
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
    const pagado = editPagada * editValor;
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
        cantidadPagada: editPagada,
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
    if (seleccionados.length === ventas.length) setSeleccionados([]);
    else setSeleccionados(ventas.map((v) => v.id));
  };

  const todosSeleccionados =
    ventas.length > 0 && seleccionados.length === ventas.length;

  // 💰 Totales
  const totalVendido = ventas.reduce((s, v) => s + (v.total || 0), 0);
  const totalPagado  = ventas.reduce((s, v) => s + (v.pagado || 0), 0);
  const totalSaldo   = ventas.reduce((s, v) => s + (v.saldo || 0), 0);

  const totalSelVendido = ventas
    .filter((v) => seleccionados.includes(v.id))
    .reduce((s, v) => s + (v.total || 0), 0);
  const totalSelSaldo = ventas
    .filter((v) => seleccionados.includes(v.id))
    .reduce((s, v) => s + (v.saldo || 0), 0);

  const formatearFecha = (fecha) => {
  if (!fecha) return '...';

  // Timestamp de Firestore
  if (fecha.toDate) {
    return fecha.toDate().toLocaleDateString('es-CO');
  }

  // String "YYYY-MM-DD" → formatear sin timezone
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

  const colorEntrega = (e) =>
    e === 'Entregado' ? 'badge-verde' : 'badge-amarillo';

  const colorEstado = (e) =>
    e === 'Pagado' ? 'badge-verde' : 'badge-amarillo';

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
                {mostrarForm ? '✖ Cancelar' : '➕ Nueva venta'}
              </Button>
            </div>
          </div>

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
                      <label>Cantidad pagada</label>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        max={nuevo.cantidad || undefined}
                        step="1"
                        value={nuevo.cantidadPagada}
                        onChange={(e) =>
                          setNuevo({ ...nuevo, cantidadPagada: e.target.value })
                        }
                      />
                      <small className="hint">
                        💡 Cuántas unidades ya te pagó
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
                        {' '}· Pagado: <strong style={{ color: '#2A9D8F' }}>
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
                      <th>Pagado</th>
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
                    ) : ventas.length === 0 ? (
                      <tr>
                        <td
                          colSpan="11"
                          style={{ textAlign: 'center', padding: '40px', color: '#8B7A66' }}
                        >
                          💰 Aún no hay ventas registradas
                          <br />
                          <small>Haz clic en "➕ Nueva venta" para empezar</small>
                        </td>
                      </tr>
                    ) : (
                      ventas.map((v) => {
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
                            <td>
                              {v.cantidad}
                              {v.cantidadPagada > 0 && v.cantidadPagada < v.cantidad && (
                                <>
                                  <br />
                                  <small style={{ color: '#2A9D8F' }}>
                                    ✔ {v.cantidadPagada} pagada(s)
                                  </small>
                                </>
                              )}
                            </td>
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
                                      cantidadPagada: v.cantidadPagada ?? 0,
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

                  {ventas.length > 0 && (
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
            </div>

            {/* Vista de cards (móvil) */}
            <div className="cards-ventas-mobile">
              {cargando ? (
                <p className="panel-vacio">Cargando ventas... 🍚</p>
              ) : ventas.length === 0 ? (
                <p className="panel-vacio">
                  💰 Aún no hay ventas registradas
                  <br />
                  <small>Haz clic en "➕ Nueva venta" para empezar</small>
                </p>
              ) : (
                <>
                  {ventas.length > 1 && (
                    <label className="card-selector-todos">
                      <input
                        type="checkbox"
                        checked={todosSeleccionados}
                        onChange={toggleTodos}
                      />
                      <span>Seleccionar todos ({ventas.length})</span>
                    </label>
                  )}

                  {ventas.map((v) => {
                    const activo = seleccionados.includes(v.id);
                    const esPagado = v.estado === 'Pagado';
                    const esEntregado = v.entrega === 'Entregado';

                    return (
                      <div
                        key={v.id}
                        className={`venta-card ${activo ? 'venta-card-activa' : ''}`}
                      >
                        {/* Barra de color según estado */}
                        <div
                          className={`venta-card-barra ${
                            esPagado ? 'barra-verde' : 'barra-amarilla'
                          }`}
                        />

                        {/* Header */}
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

                        {/* Total destacado */}
                        <div className="venta-card-total-destacado">
                          <span className="total-label">💰 Total</span>
                          <strong className="total-valor">
                            ${v.total?.toLocaleString('es-CO')}
                          </strong>
                        </div>

                        {/* Info grid */}
                        <div className="venta-card-info">
                          <div className="info-item">
                            <span className="info-label">📦 Cantidad</span>
                            <strong>{v.cantidad}</strong>
                            {v.cantidadPagada > 0 && v.cantidadPagada < v.cantidad && (
                              <small style={{ color: '#2A9D8F' }}>
                                ✔ {v.cantidadPagada} pagada(s)
                              </small>
                            )}
                          </div>
                          <div className="info-item">
                            <span className="info-label">✅ Pagado</span>
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

                        {/* Badges */}
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

                        {/* Acciones */}
                        <div className="venta-card-acciones">
                          <button
                            className="btn-accion-card btn-editar"
                            onClick={() =>
                              setEditando({
                                ...v,
                                cantidad: v.cantidad ?? '',
                                valorUnitario: v.valorUnitario ?? '',
                                cantidadPagada: v.cantidadPagada ?? 0,
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

                  {/* Totales al final */}
                  <div className="ventas-totales-mobile">
                    <h4 className="totales-titulo">📊 Resumen general</h4>
                    <div className="total-row">
                      <span>💰 Total vendido</span>
                      <strong style={{ color: '#5C3A21' }}>
                        ${totalVendido.toLocaleString('es-CO')}
                      </strong>
                    </div>
                    <div className="total-row">
                      <span>✅ Total pagado</span>
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
                  <label>Cantidad pagada</label>
                  <input
                    type="number"
                    min="0"
                    max={editando.cantidad || undefined}
                    step="1"
                    value={editando.cantidadPagada}
                    onChange={(e) =>
                      setEditando({ ...editando, cantidadPagada: e.target.value })
                    }
                  />
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
                    {' '}· Pagado: <strong style={{ color: '#2A9D8F' }}>
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