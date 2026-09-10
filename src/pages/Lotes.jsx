import { useState, useEffect, useMemo } from 'react';
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
import '../styles/Lotes.css';

const UNIDADES = [
  { valor: 'litros', label: 'L' },
  { valor: 'mililitros', label: 'ml' },
  { valor: 'libras', label: 'lb' },
  { valor: 'kilos', label: 'kg' },
  { valor: 'gramos', label: 'g' },
  { valor: 'unidades', label: 'und' },
  { valor: 'docenas', label: 'doc' },
  { valor: 'paquetes', label: 'paq' },
  { valor: 'cajas', label: 'caja' },
  { valor: 'botellas', label: 'bot' }
];

/* ═══════════════════════════════════════════════════════════
   🔥 HELPERS DE FECHA (SIN TIMEZONE)
   ═══════════════════════════════════════════════════════════ */

// 📅 Formatea una fecha para MOSTRAR (ej: "26/07/2026")
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

// 📅 Formatea una fecha para el INPUT type="date" (ej: "2026-07-26")
const normalizarFechaInput = (fecha) => {
  if (!fecha) return new Date().toISOString().split('T')[0];

  // Timestamp de Firestore
  if (fecha.toDate) {
    const d = fecha.toDate();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Date de JS
  if (fecha instanceof Date) {
    const yyyy = fecha.getUTCFullYear();
    const mm = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // String
  if (typeof fecha === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
    if (fecha.includes('T')) return fecha.split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
};

/* ═══════════════════════════════════════════════════════════
   COMPONENTE: IngredienteEditable
   ═══════════════════════════════════════════════════════════ */
function IngredienteEditable({ ingrediente, abrevUnidad, onUpdate, onDelete }) {
  const [modoEdicion, setModoEdicion] = useState(false);
  const [temp, setTemp] = useState({
    nombre: ingrediente.nombre,
    cantidad: ingrediente.cantidad,
    unidad: ingrediente.unidad,
    valorUnitario: ingrediente.valorUnitario
  });

  const guardar = () => {
    if (!temp.nombre.trim() || !temp.cantidad || !temp.valorUnitario) return;
    onUpdate({
      ...ingrediente,
      nombre: temp.nombre.trim(),
      cantidad: Number(temp.cantidad),
      unidad: temp.unidad,
      valorUnitario: Number(temp.valorUnitario)
    });
    setModoEdicion(false);
  };

  const cancelar = () => {
    setTemp({
      nombre: ingrediente.nombre,
      cantidad: ingrediente.cantidad,
      unidad: ingrediente.unidad,
      valorUnitario: ingrediente.valorUnitario
    });
    setModoEdicion(false);
  };

  if (modoEdicion) {
    return (
      <div className="ingrediente-editable editando">
        <input
          type="text"
          value={temp.nombre}
          onChange={(e) => setTemp({ ...temp, nombre: e.target.value })}
          placeholder="Ingrediente"
        />
        <input
          type="number"
          value={temp.cantidad}
          onChange={(e) => setTemp({ ...temp, cantidad: e.target.value })}
          placeholder="Cant."
        />
        <select
          value={temp.unidad}
          onChange={(e) => setTemp({ ...temp, unidad: e.target.value })}
        >
          {UNIDADES.map((u) => (
            <option key={u.valor} value={u.valor}>
              {u.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={temp.valorUnitario}
          onChange={(e) =>
            setTemp({ ...temp, valorUnitario: e.target.value })
          }
          placeholder="Valor unit."
        />
        <div className="ingrediente-acciones">
          <button
            type="button"
            className="btn-accion btn-ok"
            onClick={guardar}
            title="Guardar cambios"
          >
            ✅
          </button>
          <button
            type="button"
            className="btn-accion btn-cancel"
            onClick={cancelar}
            title="Cancelar"
          >
            ✖
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ingrediente-editable">
      <span className="ing-nombre">{ingrediente.nombre}</span>
      <span className="ing-cant">
        {ingrediente.cantidad} {abrevUnidad(ingrediente.unidad)}
      </span>
      <span className="ing-precio">
        ${ingrediente.valorUnitario?.toLocaleString('es-CO')}
      </span>
      <span className="ing-subtotal">
        $
        {(ingrediente.cantidad * ingrediente.valorUnitario).toLocaleString(
          'es-CO'
        )}
      </span>
      <div className="ingrediente-acciones">
        <button
          type="button"
          className="btn-accion btn-edit"
          onClick={() => setModoEdicion(true)}
          title="Editar"
        >
          ✏️
        </button>
        <button
          type="button"
          className="btn-accion btn-delete"
          onClick={onDelete}
          title="Eliminar"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL: Lotes
   ═══════════════════════════════════════════════════════════ */
function Lotes({ usuario, onAbrirSidebar }) {
  const [lotes, setLotes] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState('');

  // ➕ Formulario de creación
  const [nuevo, setNuevo] = useState({
    nombre: '',
    fecha: new Date().toISOString().split('T')[0],
    presentacion: '',
    cantidadProducida: '',
    valorUnitario: '',
    perdidas: '',
    ingredientes: []
  });

  // 🧾 Ingrediente temporal (creación)
  const [ingredienteTemp, setIngredienteTemp] = useState({
    nombre: '',
    cantidad: '',
    unidad: 'libras',
    valorUnitario: ''
  });

  const [seleccionados, setSeleccionados] = useState([]);
  const [editando, setEditando] = useState(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  // 🧾 Ingrediente temporal (edición)
  const [ingredienteTempEdit, setIngredienteTempEdit] = useState({
    nombre: '',
    cantidad: '',
    unidad: 'libras',
    valorUnitario: ''
  });

  // 🔥 Cargar lotes y ventas
  useEffect(() => {
    const qLotes = query(collection(db, 'lotes'), orderBy('fecha', 'desc'));
    const unsubLotes = onSnapshot(
      qLotes,
      (snap) => {
        setLotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCargando(false);
      },
      (err) => {
        console.error(err);
        setError('No se pudieron cargar los lotes');
        setCargando(false);
      }
    );

    const qVentas = query(collection(db, 'ventas'), orderBy('fecha', 'desc'));
    const unsubVentas = onSnapshot(qVentas, (snap) => {
      setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubLotes();
      unsubVentas();
    };
  }, []);

  // 🔗 Ventas agrupadas por loteId
  const ventasPorLote = useMemo(() => {
    const mapa = {};
    ventas.forEach((v) => {
      if (!v.loteId) return;
      if (!mapa[v.loteId]) {
        mapa[v.loteId] = {
          cantidad: 0,
          total: 0,
          pagado: 0,
          saldo: 0,
          pedidos: 0
        };
      }
      mapa[v.loteId].cantidad += Number(v.cantidad) || 0;
      mapa[v.loteId].total += Number(v.total) || 0;
      mapa[v.loteId].pagado += Number(v.pagado) || 0;
      mapa[v.loteId].saldo += Number(v.saldo) || 0;
      mapa[v.loteId].pedidos += 1;
    });
    return mapa;
  }, [ventas]);

  const getVentasLote = (loteId) =>
    ventasPorLote[loteId] || {
      cantidad: 0,
      total: 0,
      pagado: 0,
      saldo: 0,
      pedidos: 0
    };

  // 🧮 Cálculos del formulario
  const producidosForm = Number(nuevo.cantidadProducida) || 0;
  const perdidasForm = Number(nuevo.perdidas) || 0;
  const justificadoForm = perdidasForm;
  const diferenciaForm = producidosForm - justificadoForm;
  const cuadraForm =
    diferenciaForm === 0 && justificadoForm > 0 && producidosForm > 0;

  const costoTotalForm = nuevo.ingredientes.reduce(
    (s, i) => s + (Number(i.cantidad) || 0) * (Number(i.valorUnitario) || 0),
    0
  );

  // 🧮 Cálculos del modal de edición
  const producidosEdit = Number(editando?.cantidadProducida) || 0;
  const perdidasEdit = Number(editando?.perdidas) || 0;
  const ventasEdit = editando
    ? getVentasLote(editando.id)
    : { cantidad: 0, total: 0, pagado: 0, saldo: 0, pedidos: 0 };

  const justificadoEdit = ventasEdit.cantidad + perdidasEdit;
  const diferenciaEdit = producidosEdit - justificadoEdit;
  const cuadraEdit =
    diferenciaEdit === 0 && justificadoEdit > 0 && producidosEdit > 0;

  const costoTotalEdit = (editando?.ingredientes || []).reduce(
    (s, i) => s + (Number(i.cantidad) || 0) * (Number(i.valorUnitario) || 0),
    0
  );
  const gananciaEdit = ventasEdit.total - costoTotalEdit;

  // ➕ Agregar ingrediente (formulario de creación)
  const agregarIngredienteTemp = () => {
    if (
      !ingredienteTemp.nombre.trim() ||
      !ingredienteTemp.cantidad ||
      !ingredienteTemp.valorUnitario
    )
      return;

    const nuevoIng = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nombre: ingredienteTemp.nombre.trim(),
      cantidad: Number(ingredienteTemp.cantidad),
      unidad: ingredienteTemp.unidad,
      valorUnitario: Number(ingredienteTemp.valorUnitario)
    };

    setNuevo((prev) => ({
      ...prev,
      ingredientes: [...prev.ingredientes, nuevoIng]
    }));

    setIngredienteTemp({
      nombre: '',
      cantidad: '',
      unidad: 'libras',
      valorUnitario: ''
    });
  };

  const eliminarIngredienteForm = (id) => {
    setNuevo({
      ...nuevo,
      ingredientes: nuevo.ingredientes.filter((i) => i.id !== id)
    });
  };

  // ➕ Agregar ingrediente (modal de edición)
  const agregarIngredienteTempEdit = () => {
    if (
      !ingredienteTempEdit.nombre.trim() ||
      !ingredienteTempEdit.cantidad ||
      !ingredienteTempEdit.valorUnitario
    )
      return;

    const nuevoIng = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nombre: ingredienteTempEdit.nombre.trim(),
      cantidad: Number(ingredienteTempEdit.cantidad),
      unidad: ingredienteTempEdit.unidad,
      valorUnitario: Number(ingredienteTempEdit.valorUnitario)
    };

    setEditando((prev) => ({
      ...prev,
      ingredientes: [...(prev.ingredientes || []), nuevoIng]
    }));

    setIngredienteTempEdit({
      nombre: '',
      cantidad: '',
      unidad: 'libras',
      valorUnitario: ''
    });
  };

  const eliminarIngredienteEdit = (id) => {
    setEditando({
      ...editando,
      ingredientes: (editando.ingredientes || []).filter((i) => i.id !== id)
    });
  };

  // ➕ Guardar lote nuevo
  const agregar = async () => {
    if (!nuevo.nombre.trim() || !nuevo.cantidadProducida) return;

    setGuardando(true);
    setError('');

    try {
      await addDoc(collection(db, 'lotes'), {
        nombre: nuevo.nombre.trim(),
        fecha: nuevo.fecha,
        presentacion: nuevo.presentacion.trim(),
        cantidadProducida: producidosForm,
        valorUnitario: Number(nuevo.valorUnitario) || 0,
        perdidas: perdidasForm,
        ingredientes: nuevo.ingredientes || [],
        costoTotal: costoTotalForm,
        creadoPor: usuario?.uid || 'anónimo',
        creadoPorEmail: usuario?.email || 'anónimo',
        createdAt: serverTimestamp()
      });

      setNuevo({
        nombre: '',
        fecha: new Date().toISOString().split('T')[0],
        presentacion: '',
        cantidadProducida: '',
        valorUnitario: '',
        perdidas: '',
        ingredientes: []
      });
      setIngredienteTemp({
        nombre: '',
        cantidad: '',
        unidad: 'libras',
        valorUnitario: ''
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
    if (!editando.nombre?.trim() || !editando.cantidadProducida) return;

    setGuardandoEdit(true);
    setError('');

    try {
      const ref = doc(db, 'lotes', editando.id);
      await updateDoc(ref, {
        nombre: editando.nombre.trim(),
        fecha: editando.fecha,
        presentacion: editando.presentacion?.trim() || '',
        cantidadProducida: producidosEdit,
        valorUnitario: Number(editando.valorUnitario) || 0,
        perdidas: perdidasEdit,
        ingredientes: editando.ingredientes || [],
        costoTotal: costoTotalEdit,
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
    if (!window.confirm('¿Eliminar este lote?')) return;
    try {
      await deleteDoc(doc(db, 'lotes', id));
      setSeleccionados(seleccionados.filter((s) => s !== id));
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar');
    }
  };

  const eliminarSeleccionados = async () => {
    if (seleccionados.length === 0) return;
    if (!window.confirm(`¿Eliminar ${seleccionados.length} lote(s)?`)) return;
    try {
      await Promise.all(
        seleccionados.map((id) => deleteDoc(doc(db, 'lotes', id)))
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
    if (seleccionados.length === lotes.length) setSeleccionados([]);
    else setSeleccionados(lotes.map((l) => l.id));
  };

  const todosSeleccionados =
    lotes.length > 0 && seleccionados.length === lotes.length;

  const estadoLote = (l) => {
    const v = getVentasLote(l.id);
    const justificado = v.cantidad + (l.perdidas || 0);
    const dif = (l.cantidadProducida || 0) - justificado;
    if (justificado === 0)
      return { clase: 'badge-amarillo', texto: 'Sin ventas' };
    if (dif === 0) return { clase: 'badge-verde', texto: '✅ Cuadra' };
    if (dif > 0) return { clase: 'badge-amarillo', texto: `Faltan ${dif}` };
    return { clase: 'badge-rojo', texto: `⚠️ Sobran ${Math.abs(dif)}` };
  };

  const abrevUnidad = (unidad) => {
    const u = UNIDADES.find((x) => x.valor === unidad);
    return u ? u.label : unidad || '';
  };

  return (
    <div className="modulo-layout">
      <div className="modulo-main">
        <TopBar
          usuario={usuario}
          titulo="🍚 Lotes de producción"
          onAbrirSidebar={onAbrirSidebar}
        />

        <div className="modulo-content">
          <div className="modulo-header">
            <div>
              <h1>Lotes de producción</h1>
              <p>Registra tus tandas de arroz con leche</p>
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
                {mostrarForm ? '← Volver a la lista' : '➕ Nuevo lote'}
              </Button>
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {/* ➕ FORMULARIO DE CREACIÓN */}
          {mostrarForm && (
            <div className="form-card">
              <h3>Agregar nuevo lote</h3>

              <div className="form-grid">
                {/* DATOS */}
                <div className="form-seccion-titulo">
                  📝 Datos del lote
                </div>

                <div className="form-field form-field-full">
                  <label>Nombre del lote</label>
                  <input
                    type="text"
                    placeholder="Ej: Tanda quincena enero A"
                    value={nuevo.nombre}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, nombre: e.target.value })
                    }
                  />
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

                <div className="form-field">
                  <label>Presentación</label>
                  <input
                    type="text"
                    placeholder="Ej: Vaso 8oz"
                    value={nuevo.presentacion}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, presentacion: e.target.value })
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Cantidad producida</label>
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    value={nuevo.cantidadProducida}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, cantidadProducida: e.target.value })
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Valor unitario de venta</label>
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    value={nuevo.valorUnitario}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, valorUnitario: e.target.value })
                    }
                  />
                </div>

                {/* INGREDIENTES */}
                <div className="form-seccion-titulo">
                  🥛 Ingredientes usados
                </div>

                <div className="form-field form-field-full">
                  <div className="ingrediente-form-card">
                    <div className="ingrediente-form-header">
                      <span className="ingrediente-form-icon">✏️</span>
                      <span className="ingrediente-form-title">
                        Nuevo ingrediente
                      </span>
                    </div>

                    <div className="ingrediente-form-grid">
                      <div className="ingrediente-form-field ingrediente-form-full">
                        <label>Ingrediente</label>
                        <input
                          type="text"
                          placeholder="Ej: Leche entera, Arroz..."
                          value={ingredienteTemp.nombre}
                          onChange={(e) =>
                            setIngredienteTemp({
                              ...ingredienteTemp,
                              nombre: e.target.value
                            })
                          }
                        />
                      </div>

                      <div className="ingrediente-form-field">
                        <label>Cantidad</label>
                        <input
                          type="number"
                          placeholder="0"
                          min="0"
                          step="0.01"
                          value={ingredienteTemp.cantidad}
                          onChange={(e) =>
                            setIngredienteTemp({
                              ...ingredienteTemp,
                              cantidad: e.target.value
                            })
                          }
                        />
                      </div>

                      <div className="ingrediente-form-field">
                        <label>Unidad</label>
                        <select
                          value={ingredienteTemp.unidad}
                          onChange={(e) =>
                            setIngredienteTemp({
                              ...ingredienteTemp,
                              unidad: e.target.value
                            })
                          }
                        >
                          {UNIDADES.map((u) => (
                            <option key={u.valor} value={u.valor}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="ingrediente-form-field">
                        <label>Valor por unidad</label>
                        <input
                          type="number"
                          placeholder="0"
                          min="0"
                          step="0.01"
                          value={ingredienteTemp.valorUnitario}
                          onChange={(e) =>
                            setIngredienteTemp({
                              ...ingredienteTemp,
                              valorUnitario: e.target.value
                            })
                          }
                        />
                      </div>

                      <div className="ingrediente-form-field">
                        <label>Subtotal</label>
                        <div className="ingrediente-form-subtotal">
                          $
                          {(
                            (Number(ingredienteTemp.cantidad) || 0) *
                            (Number(ingredienteTemp.valorUnitario) || 0)
                          ).toLocaleString('es-CO')}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-add-ingrediente"
                        onClick={agregarIngredienteTemp}
                        disabled={
                          !ingredienteTemp.nombre.trim() ||
                          !ingredienteTemp.cantidad ||
                          !ingredienteTemp.valorUnitario
                        }
                      >
                        ➕ Agregar ingrediente
                      </button>
                    </div>
                  </div>

                  {nuevo.ingredientes.length > 0 && (
                    <div className="ingredientes-tabla">
                      {nuevo.ingredientes.map((ing) => (
                        <div key={ing.id} className="ingrediente-row">
                          <span className="ingrediente-nombre">
                            {ing.nombre}
                          </span>
                          <span className="ingrediente-cant">
                            {ing.cantidad} {abrevUnidad(ing.unidad)}
                          </span>
                          <span className="ingrediente-precio">
                            ${ing.valorUnitario?.toLocaleString('es-CO')}
                          </span>
                          <span className="ingrediente-subtotal">
                            $
                            {(ing.cantidad * ing.valorUnitario).toLocaleString(
                              'es-CO'
                            )}
                          </span>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => eliminarIngredienteForm(ing.id)}
                          >
                            🗑
                          </button>
                        </div>
                      ))}
                      <div className="ingredientes-total">
                        <span>Costo total de ingredientes:</span>
                        <strong>${costoTotalForm.toLocaleString('es-CO')}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* DISTRIBUCIÓN */}
                <div className="form-seccion-titulo">
                  📦 Distribución
                </div>

                <div className="form-field form-field-full">
                  <div className="info-box">
                    <strong>✅ Vendidos:</strong> se calcula automáticamente
                    desde el módulo <strong>Ventas</strong> cuando asignes este
                    lote a una venta.
                  </div>
                </div>

                <div className="form-field">
                  <label>➖ Pérdidas / otras salidas</label>
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    value={nuevo.perdidas}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, perdidas: e.target.value })
                    }
                  />
                  <small className="hint">
                    💡 Regalados, dañados, consumo propio
                  </small>
                </div>

                {costoTotalForm > 0 && (
                  <div className="form-field form-field-full">
                    <div className="resumen-lote">
                      <div className="resumen-item">
                        <span>Costo ingredientes:</span>
                        <strong style={{ color: '#F26B7A' }}>
                          -${costoTotalForm.toLocaleString('es-CO')}
                        </strong>
                      </div>
                      <div className="resumen-item">
                        <span>
                          💡 Los ingresos se calcularán con las ventas que
                          registres
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={agregar}
                fullWidth={false}
                disabled={
                  guardando ||
                  !nuevo.nombre.trim() ||
                  !nuevo.cantidadProducida
                }
              >
                {guardando ? 'Guardando...' : 'Guardar lote'}
              </Button>
            </div>
          )}

          {/* 📋 TABLA (desktop) + CARDS (móvil) — solo si NO está creando */}
          {!mostrarForm && (
            <div className="dashboard-panel">
              {/* Vista de tabla (PC/Tablet) */}
              <div className="tabla-lotes-desktop">
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
                        <th>Nombre</th>
                        <th>Producidos</th>
                        <th>Vendidos</th>
                        <th>Pérdidas</th>
                        <th>Ingresos</th>
                        <th>Costos</th>
                        <th>Ganancia</th>
                        <th>Estado</th>
                        <th style={{ width: '100px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cargando ? (
                        <tr>
                          <td colSpan="11" style={{ textAlign: 'center', padding: '30px' }}>
                            Cargando lotes... 🍚
                          </td>
                        </tr>
                      ) : lotes.length === 0 ? (
                        <tr>
                          <td
                            colSpan="11"
                            style={{ textAlign: 'center', padding: '40px', color: '#8B7A66' }}
                          >
                            🍚 Aún no hay lotes registrados
                            <br />
                            <small>Haz clic en "➕ Nuevo lote" para empezar</small>
                          </td>
                        </tr>
                      ) : (
                        lotes.map((l) => {
                          const activo = seleccionados.includes(l.id);
                          const estado = estadoLote(l);
                          const v = getVentasLote(l.id);
                          const costo = l.costoTotal || 0;
                          const ganancia = (v.total || 0) - costo;
                          return (
                            <tr key={l.id} className={activo ? 'fila-seleccionada' : ''}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={activo}
                                  onChange={() => toggleSeleccion(l.id)}
                                />
                              </td>
                              <td>{formatearFecha(l.fecha)}</td>
                              <td>
                                <strong>{l.nombre}</strong>
                                <br />
                                <small style={{ color: '#8B7A66' }}>
                                  {l.presentacion || '—'}
                                </small>
                              </td>
                              <td>
                                <strong>{l.cantidadProducida}</strong>
                              </td>
                              <td>
                                <span style={{ color: '#2A9D8F', fontWeight: 600 }}>
                                  {v.cantidad}
                                </span>
                                {v.pedidos > 0 && (
                                  <small style={{ display: 'block', color: '#8B7A66' }}>
                                    {v.pedidos} pedido{v.pedidos !== 1 ? 's' : ''}
                                  </small>
                                )}
                              </td>
                              <td>
                                <span style={{ color: '#F26B7A', fontWeight: 600 }}>
                                  {l.perdidas || 0}
                                </span>
                              </td>
                              <td>
                                <strong style={{ color: '#2A9D8F' }}>
                                  ${(v.total || 0).toLocaleString('es-CO')}
                                </strong>
                                {v.saldo > 0 && (
                                  <small style={{ display: 'block', color: '#F26B7A' }}>
                                    por cobrar ${v.saldo.toLocaleString('es-CO')}
                                  </small>
                                )}
                              </td>
                              <td>
                                <strong style={{ color: '#F26B7A' }}>
                                  ${costo.toLocaleString('es-CO')}
                                </strong>
                              </td>
                              <td>
                                <strong
                                  style={{
                                    color: ganancia >= 0 ? '#2A9D8F' : '#F26B7A'
                                  }}
                                >
                                  ${ganancia.toLocaleString('es-CO')}
                                </strong>
                              </td>
                              <td>
                                <span className={`badge ${estado.clase}`}>
                                  {estado.texto}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    className="btn-icon"
                                    title="Editar"
                                    onClick={() =>
                                      setEditando({
                                        ...l,
                                        fecha: normalizarFechaInput(l.fecha),
                                        perdidas: l.perdidas ?? '',
                                        ingredientes: l.ingredientes || []
                                      })
                                    }
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    className="btn-icon"
                                    title="Eliminar"
                                    onClick={() => eliminar(l.id)}
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
              <div className="cards-lotes-mobile">
                {cargando ? (
                  <p className="panel-vacio">Cargando lotes... 🍚</p>
                ) : lotes.length === 0 ? (
                  <p className="panel-vacio">
                    🍚 Aún no hay lotes registrados
                    <br />
                    <small>Haz clic en "➕ Nuevo lote" para empezar</small>
                  </p>
                ) : (
                  <>
                    {lotes.length > 1 && (
                      <label className="card-selector-todos">
                        <input
                          type="checkbox"
                          checked={todosSeleccionados}
                          onChange={toggleTodos}
                        />
                        <span>Seleccionar todos ({lotes.length})</span>
                      </label>
                    )}

                    {lotes.map((l) => {
                      const activo = seleccionados.includes(l.id);
                      const estado = estadoLote(l);
                      const v = getVentasLote(l.id);
                      const costo = l.costoTotal || 0;
                      const ganancia = (v.total || 0) - costo;
                      const esRentable = ganancia >= 0;

                      return (
                        <div
                          key={l.id}
                          className={`lote-card ${activo ? 'lote-card-activa' : ''}`}
                        >
                          <div
                            className={`lote-card-barra ${
                              esRentable ? 'barra-verde' : 'barra-roja'
                            }`}
                          />

                          <div className="lote-card-header">
                            <label className="lote-card-check">
                              <input
                                type="checkbox"
                                checked={activo}
                                onChange={() => toggleSeleccion(l.id)}
                              />
                            </label>
                            <div className="lote-card-info">
                              <strong>{l.nombre}</strong>
                              <small>
                                📅 {formatearFecha(l.fecha)} · {l.presentacion || 'Sin presentación'}
                              </small>
                            </div>
                            <span className={`badge ${estado.clase}`}>
                              {estado.texto}
                            </span>
                          </div>

                          <div
                            className={`lote-card-ganancia ${
                              esRentable ? 'ganancia-positiva' : 'ganancia-negativa'
                            }`}
                          >
                            <span className="ganancia-label">
                              {esRentable ? '💰 Ganancia' : '📉 Pérdida'}
                            </span>
                            <strong className="ganancia-valor">
                              ${Math.abs(ganancia).toLocaleString('es-CO')}
                            </strong>
                          </div>

                          <div className="lote-card-info-grid">
                            <div className="lote-info-item">
                              <span className="lote-info-label">🍚 Producidos</span>
                              <strong>{l.cantidadProducida}</strong>
                            </div>
                            <div className="lote-info-item">
                              <span className="lote-info-label">✅ Vendidos</span>
                              <strong style={{ color: '#2A9D8F' }}>{v.cantidad}</strong>
                              {v.pedidos > 0 && (
                                <small>{v.pedidos} pedido{v.pedidos !== 1 ? 's' : ''}</small>
                              )}
                            </div>
                            <div className="lote-info-item">
                              <span className="lote-info-label">➖ Pérdidas</span>
                              <strong style={{ color: '#F26B7A' }}>{l.perdidas || 0}</strong>
                            </div>
                            <div className="lote-info-item">
                              <span className="lote-info-label">🛒 Ingresos</span>
                              <strong style={{ color: '#2A9D8F' }}>
                                ${(v.total || 0).toLocaleString('es-CO')}
                              </strong>
                            </div>
                            <div className="lote-info-item lote-info-full">
                              <span className="lote-info-label">🥛 Costos</span>
                              <strong style={{ color: '#F26B7A' }}>
                                ${costo.toLocaleString('es-CO')}
                              </strong>
                            </div>
                          </div>

                          <div className="lote-card-badges">
                            {(l.ingredientes || []).length > 0 && (
                              <span className="badge badge-amarillo">
                                🥛 {(l.ingredientes || []).length} ingrediente
                                {(l.ingredientes || []).length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {v.pedidos > 0 && (
                              <span className="badge badge-verde">
                                🛒 {v.pedidos} venta{v.pedidos !== 1 ? 's' : ''}
                              </span>
                            )}
                            {v.saldo > 0 && (
                              <span className="badge badge-rojo">
                                ⏳ Por cobrar ${v.saldo.toLocaleString('es-CO')}
                              </span>
                            )}
                          </div>

                          <div className="lote-card-acciones">
                            <button
                              className="btn-accion-card btn-editar"
                              onClick={() =>
                                setEditando({
                                  ...l,
                                  fecha: normalizarFechaInput(l.fecha),
                                  perdidas: l.perdidas ?? '',
                                  ingredientes: l.ingredientes || []
                                })
                              }
                            >
                              ✏️ Editar
                            </button>
                            <button
                              className="btn-accion-card btn-eliminar"
                              onClick={() => eliminar(l.id)}
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
          )}
        </div>
      </div>

      {/* ✏️ MODAL DE EDICIÓN */}
      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div
            className="modal-card modal-card-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header modal-header-custom">
              <div className="modal-header-info">
                <h3>✏️ Editando: {editando.nombre || 'Sin nombre'}</h3>
                <div className="modal-header-stats">
                  <span>
                    🍚 <strong>{editando.cantidadProducida || 0}</strong>{' '}
                    producidos
                  </span>
                  <span>
                    ✅{' '}
                    <strong style={{ color: '#2A9D8F' }}>
                      {ventasEdit.cantidad}
                    </strong>{' '}
                    vendidos
                  </span>
                  <span>
                    ➖{' '}
                    <strong style={{ color: '#F26B7A' }}>
                      {editando.perdidas || 0}
                    </strong>{' '}
                    pérdidas
                  </span>
                </div>
              </div>
              <button
                className="modal-close"
                onClick={() => setEditando(null)}
              >
                ✖
              </button>
            </div>

            <div className="modal-body modal-body-custom">
              {/* SECCIÓN 1: DATOS BÁSICOS */}
              <section className="modal-seccion">
                <h4 className="modal-seccion-titulo">
                  <span>📝 Datos del lote</span>
                </h4>
                <div className="modal-seccion-content">
                  <div className="form-grid">
                    <div className="form-field form-field-full">
                      <label>Nombre del lote</label>
                      <input
                        type="text"
                        value={editando.nombre || ''}
                        onChange={(e) =>
                          setEditando({ ...editando, nombre: e.target.value })
                        }
                      />
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

                    <div className="form-field">
                      <label>Presentación</label>
                      <input
                        type="text"
                        placeholder="Ej: Vaso 8oz"
                        value={editando.presentacion || ''}
                        onChange={(e) =>
                          setEditando({
                            ...editando,
                            presentacion: e.target.value
                          })
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>Cantidad producida</label>
                      <input
                        type="number"
                        value={editando.cantidadProducida || ''}
                        onChange={(e) =>
                          setEditando({
                            ...editando,
                            cantidadProducida: e.target.value
                          })
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>Valor unitario de venta</label>
                      <input
                        type="number"
                        value={editando.valorUnitario || ''}
                        onChange={(e) =>
                          setEditando({
                            ...editando,
                            valorUnitario: e.target.value
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* SECCIÓN 2: INGREDIENTES */}
              <section className="modal-seccion">
                <h4 className="modal-seccion-titulo">
                  <span>🥛 Ingredientes usados</span>
                  <small>
                    {(editando.ingredientes || []).length} agregado(s)
                  </small>
                </h4>
                <div className="modal-seccion-content">
                  <div className="ingrediente-form-card">
                    <div className="ingrediente-form-header">
                      <span className="ingrediente-form-icon">✏️</span>
                      <span className="ingrediente-form-title">
                        Nuevo ingrediente
                      </span>
                    </div>

                    <div className="ingrediente-form-grid">
                      <div className="ingrediente-form-field ingrediente-form-full">
                        <label>Ingrediente</label>
                        <input
                          type="text"
                          placeholder="Ej: Leche entera, Arroz..."
                          value={ingredienteTempEdit.nombre}
                          onChange={(e) =>
                            setIngredienteTempEdit({
                              ...ingredienteTempEdit,
                              nombre: e.target.value
                            })
                          }
                        />
                      </div>

                      <div className="ingrediente-form-field">
                        <label>Cantidad</label>
                        <input
                          type="number"
                          placeholder="0"
                          min="0"
                          step="0.01"
                          value={ingredienteTempEdit.cantidad}
                          onChange={(e) =>
                            setIngredienteTempEdit({
                              ...ingredienteTempEdit,
                              cantidad: e.target.value
                            })
                          }
                        />
                      </div>

                      <div className="ingrediente-form-field">
                        <label>Unidad</label>
                        <select
                          value={ingredienteTempEdit.unidad}
                          onChange={(e) =>
                            setIngredienteTempEdit({
                              ...ingredienteTempEdit,
                              unidad: e.target.value
                            })
                          }
                        >
                          {UNIDADES.map((u) => (
                            <option key={u.valor} value={u.valor}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="ingrediente-form-field">
                        <label>Valor por unidad</label>
                        <input
                          type="number"
                          placeholder="0"
                          min="0"
                          step="0.01"
                          value={ingredienteTempEdit.valorUnitario}
                          onChange={(e) =>
                            setIngredienteTempEdit({
                              ...ingredienteTempEdit,
                              valorUnitario: e.target.value
                            })
                          }
                        />
                      </div>

                      <div className="ingrediente-form-field">
                        <label>Subtotal</label>
                        <div className="ingrediente-form-subtotal">
                          $
                          {(
                            (Number(ingredienteTempEdit.cantidad) || 0) *
                            (Number(ingredienteTempEdit.valorUnitario) || 0)
                          ).toLocaleString('es-CO')}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-add-ingrediente"
                        onClick={agregarIngredienteTempEdit}
                        disabled={
                          !ingredienteTempEdit.nombre.trim() ||
                          !ingredienteTempEdit.cantidad ||
                          !ingredienteTempEdit.valorUnitario
                        }
                      >
                        ➕ Agregar ingrediente
                      </button>
                    </div>
                  </div>

                  {(editando.ingredientes || []).length === 0 ? (
                    <div className="empty-state">
                      No hay ingredientes aún. Agrega el primero arriba 👆
                    </div>
                  ) : (
                    <div className="ingredientes-lista">
                      {(editando.ingredientes || []).map((ing) => (
                        <IngredienteEditable
                          key={ing.id}
                          ingrediente={ing}
                          abrevUnidad={abrevUnidad}
                          onUpdate={(actualizado) => {
                            setEditando({
                              ...editando,
                              ingredientes: editando.ingredientes.map((i) =>
                                i.id === ing.id ? actualizado : i
                              )
                            });
                          }}
                          onDelete={() => eliminarIngredienteEdit(ing.id)}
                        />
                      ))}

                      <div className="ingredientes-total-box">
                        <span>💵 Costo total de ingredientes:</span>
                        <strong>
                          ${costoTotalEdit.toLocaleString('es-CO')}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* SECCIÓN 3: DISTRIBUCIÓN */}
              <section className="modal-seccion">
                <h4 className="modal-seccion-titulo">
                  <span>📦 Distribución</span>
                </h4>
                <div className="modal-seccion-content">
                  <div className="distribucion-grid">
                    <div className="dist-card dist-verde">
                      <span className="dist-label">✅ Vendidos</span>
                      <strong className="dist-valor">
                        {ventasEdit.cantidad}
                      </strong>
                      <small>Automático desde Ventas</small>
                    </div>
                    <div className="dist-card dist-coral">
                      <span className="dist-label">➖ Pérdidas</span>
                      <input
                        type="number"
                        className="dist-input"
                        value={editando.perdidas || ''}
                        onChange={(e) =>
                          setEditando({
                            ...editando,
                            perdidas: e.target.value
                          })
                        }
                      />
                      <small>Regalados, dañados, consumo</small>
                    </div>
                    <div className="dist-card dist-azul">
                      <span className="dist-label">📊 Sin justificar</span>
                      <strong
                        className="dist-valor"
                        style={{
                          color:
                            diferenciaEdit === 0 ? '#2A9D8F' : '#F26B7A'
                        }}
                      >
                        {diferenciaEdit > 0 ? diferenciaEdit : 0}
                      </strong>
                      <small>Faltan por justificar</small>
                    </div>
                  </div>

                  {editando.cantidadProducida && (
                    <div
                      className={`verificacion ${
                        cuadraEdit ? 'ok' : 'alerta'
                      }`}
                    >
                      {cuadraEdit ? (
                        <>
                          ✅ Cuadra perfecto: {justificadoEdit} /{' '}
                          {producidosEdit}
                        </>
                      ) : (
                        <>
                          Vendidos + Pérdidas: {justificadoEdit} /{' '}
                          {producidosEdit} ·{' '}
                          {diferenciaEdit > 0
                            ? `sin justificar ${diferenciaEdit}`
                            : `exceden ${Math.abs(diferenciaEdit)}`}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* SECCIÓN 4: RESUMEN FINANCIERO */}
              <section className="modal-seccion">
                <h4 className="modal-seccion-titulo">
                  <span>💰 Resumen financiero</span>
                </h4>
                <div className="modal-seccion-content">
                  <div className="resumen-financiero">
                    <div className="resumen-fin-card">
                      <span className="resumen-fin-label">Costos</span>
                      <strong
                        className="resumen-fin-valor"
                        style={{ color: '#F26B7A' }}
                      >
                        -${costoTotalEdit.toLocaleString('es-CO')}
                      </strong>
                    </div>
                    <div className="resumen-fin-card">
                      <span className="resumen-fin-label">Ingresos</span>
                      <strong
                        className="resumen-fin-valor"
                        style={{ color: '#2A9D8F' }}
                      >
                        +${ventasEdit.total.toLocaleString('es-CO')}
                      </strong>
                    </div>
                    <div className="resumen-fin-card resumen-fin-total">
                      <span className="resumen-fin-label">💰 Ganancia</span>
                      <strong
                        className="resumen-fin-valor"
                        style={{
                          color:
                            gananciaEdit >= 0 ? '#2A9D8F' : '#F26B7A'
                        }}
                      >
                        ${gananciaEdit.toLocaleString('es-CO')}
                      </strong>
                    </div>
                  </div>

                  {ventasEdit.pedidos > 0 && (
                    <div className="ventas-info-box">
                      <p>
                        🛒 <strong>{ventasEdit.pedidos}</strong> pedido(s)
                        asignado(s) · ✅ Cobrado:{' '}
                        <strong>
                          ${ventasEdit.pagado.toLocaleString('es-CO')}
                        </strong>
                        {ventasEdit.saldo > 0 && (
                          <>
                            {' '}
                            · ⏳ Por cobrar:{' '}
                            <strong style={{ color: '#F26B7A' }}>
                              ${ventasEdit.saldo.toLocaleString('es-CO')}
                            </strong>
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="modal-footer modal-footer-custom">
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
                disabled={guardandoEdit || !editando.nombre?.trim()}
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

export default Lotes;