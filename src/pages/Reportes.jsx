import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import TopBar from '../components/TopBar';
import StatCard from '../components/StatCard';
import '../styles/Reportes.css';

function Reportes({ usuario, onAbrirSidebar }) {
  const [lotes, setLotes] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // 🎛️ Filtros
  const [loteSeleccionado, setLoteSeleccionado] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // 🔥 Cargar datos
  useEffect(() => {
    const qLotes = query(
      collection(db, 'lotes'),
      orderBy('fecha', 'desc'),
      limit(1000)
    );
    const unsubLotes = onSnapshot(qLotes, (snap) => {
      setLotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCargando(false);
    });

    const qVentas = query(
      collection(db, 'ventas'),
      orderBy('fecha', 'desc'),
      limit(1000)
    );
    const unsubVentas = onSnapshot(qVentas, (snap) => {
      setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubClientes = onSnapshot(collection(db, 'clientes'), (snap) => {
      setClientes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const qGastos = query(
      collection(db, 'gastos'),
      orderBy('fecha', 'desc'),
      limit(1000)
    );
    const unsubGastos = onSnapshot(qGastos, (snap) => {
      setGastos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubLotes();
      unsubVentas();
      unsubClientes();
      unsubGastos();
    };
  }, []);

  // 📊 Ventas por lote
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

  const getVentasLote = (id) =>
    ventasPorLote[id] || {
      cantidad: 0,
      total: 0,
      pagado: 0,
      saldo: 0,
      pedidos: 0
    };

  // 🗂️ Gastos agrupados por loteId
  const gastosPorLote = useMemo(() => {
    const mapa = {};
    gastos.forEach((g) => {
      if (!g.loteId) return;
      if (!mapa[g.loteId]) {
        mapa[g.loteId] = {
          total: 0,
          cantidad: 0,
          porConcepto: {}
        };
      }
      mapa[g.loteId].total += Number(g.valor) || 0;
      mapa[g.loteId].cantidad += 1;

      const concepto = g.concepto || 'Otros';
      if (!mapa[g.loteId].porConcepto[concepto]) {
        mapa[g.loteId].porConcepto[concepto] = 0;
      }
      mapa[g.loteId].porConcepto[concepto] += Number(g.valor) || 0;
    });
    return mapa;
  }, [gastos]);

  const getGastosLote = (loteId) =>
    gastosPorLote[loteId] || { total: 0, cantidad: 0, porConcepto: {} };

  // 📊 Lotes con datos calculados
  const lotesConDatos = useMemo(() => {
    return lotes.map((l) => {
      const v = getVentasLote(l.id);
      const gastosLote = getGastosLote(l.id);

      const base = Number(l.base) || 0;
      const costosIngredientes = Number(l.costoTotal) || 0;

      const totalConGastos = v.pagado + base - gastosLote.total;
      const totalReal =
        v.pagado + base - gastosLote.total - costosIngredientes;

      const ganancia = v.total - costosIngredientes;
      const margen =
        v.total > 0 ? ((ganancia / v.total) * 100).toFixed(1) : '0.0';

      return {
        ...l,
        ventasCantidad: v.cantidad,
        ventasTotal: v.total,
        ventasPagado: v.pagado,
        ventasSaldo: v.saldo,
        ventasPedidos: v.pedidos,

        base,

        gastosTotal: gastosLote.total,
        gastosCantidad: gastosLote.cantidad,
        gastosPorConcepto: gastosLote.porConcepto,

        costosIngredientes,

        totalConGastos,
        totalReal,

        ganancia,
        margen
      };
    });
  }, [lotes, ventasPorLote, gastosPorLote]);

  // 🎯 Aplicar filtros
  const lotesFiltrados = useMemo(() => {
    let resultado = [...lotesConDatos];

    if (loteSeleccionado !== 'todos') {
      resultado = resultado.filter((l) => l.id === loteSeleccionado);
    }

    if (filtroEstado === 'rentables') {
      resultado = resultado.filter((l) => l.totalReal >= 0);
    } else if (filtroEstado === 'perdida') {
      resultado = resultado.filter((l) => l.totalReal < 0);
    }

    return resultado;
  }, [lotesConDatos, loteSeleccionado, filtroEstado]);

  // 📊 Ventas filtradas
  const ventasFiltradas = useMemo(() => {
    if (loteSeleccionado === 'todos') return ventas;
    return ventas.filter((v) => v.loteId === loteSeleccionado);
  }, [ventas, loteSeleccionado]);

  // 💰 Totales del lote seleccionado (o filtrados)
  const totalesFiltrados = useMemo(() => {
    const lista = lotesFiltrados;
    return {
      lotes: lista.length,
      producidos: lista.reduce((s, l) => s + (l.cantidadProducida || 0), 0),
      vendidos: lista.reduce((s, l) => s + (l.ventasCantidad || 0), 0),
      perdidas: lista.reduce((s, l) => s + (l.perdidas || 0), 0),
      costos: lista.reduce((s, l) => s + (l.costoTotal || 0), 0),
      base: lista.reduce((s, l) => s + (l.base || 0), 0),
      gastos: lista.reduce((s, l) => s + (l.gastosTotal || 0), 0),
      facturado: lista.reduce((s, l) => s + (l.ventasTotal || 0), 0),
      cobrado: lista.reduce((s, l) => s + (l.ventasPagado || 0), 0),
      porCobrar: lista.reduce((s, l) => s + (l.ventasSaldo || 0), 0),
      totalConGastos: lista.reduce((s, l) => s + (l.totalConGastos || 0), 0),
      totalReal: lista.reduce((s, l) => s + (l.totalReal || 0), 0)
    };
  }, [lotesFiltrados]);

  // 🏆 Top lotes
  const topLotes = useMemo(
    () => [...lotesFiltrados].sort((a, b) => b.totalReal - a.totalReal),
    [lotesFiltrados]
  );

  // 🥛 Ingredientes
  const topIngredientes = useMemo(() => {
    const mapa = {};
    lotesFiltrados.forEach((l) => {
      (l.ingredientes || []).forEach((ing) => {
        const key = ing.nombre?.toLowerCase() || 'sin nombre';
        if (!mapa[key]) {
          mapa[key] = {
            nombre: ing.nombre,
            cantidad: 0,
            unidad: ing.unidad,
            total: 0,
            lotes: 0
          };
        }
        mapa[key].cantidad += Number(ing.cantidad) || 0;
        mapa[key].total +=
          (Number(ing.cantidad) || 0) * (Number(ing.valorUnitario) || 0);
        mapa[key].lotes += 1;
      });
    });
    return Object.values(mapa)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [lotesFiltrados]);

  const maxIngrediente = topIngredientes[0]?.total || 1;

  // 👥 Top clientes (con fechas)
  const topClientes = useMemo(() => {
    const mapa = {};
    ventasFiltradas.forEach((v) => {
      const key = v.clienteId || v.clienteNombre;
      if (!mapa[key]) {
        mapa[key] = {
          nombre: v.clienteNombre,
          telefono: v.clienteTelefono,
          total: 0,
          pagado: 0,
          saldo: 0,
          pedidos: 0,
          unidades: 0,
          fechaUltimaCompra: null,
          fechaUltimoPago: null
        };
      }

      let fechaVenta = null;
      if (v.fecha?.toDate) fechaVenta = v.fecha.toDate();
      else if (v.fecha) fechaVenta = new Date(v.fecha);

      if (fechaVenta && !isNaN(fechaVenta)) {
        if (
          !mapa[key].fechaUltimaCompra ||
          fechaVenta > mapa[key].fechaUltimaCompra
        ) {
          mapa[key].fechaUltimaCompra = fechaVenta;
        }
        if (
          Number(v.pagado) > 0 &&
          (!mapa[key].fechaUltimoPago ||
            fechaVenta > mapa[key].fechaUltimoPago)
        ) {
          mapa[key].fechaUltimoPago = fechaVenta;
        }
      }

      mapa[key].total += Number(v.total) || 0;
      mapa[key].pagado += Number(v.pagado) || 0;
      mapa[key].saldo += Number(v.saldo) || 0;
      mapa[key].pedidos += 1;
      mapa[key].unidades += Number(v.cantidad) || 0;
    });
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [ventasFiltradas]);

  // ⚠️ Deudores filtrados (respeta lote seleccionado)
  const deudoresFiltrados = useMemo(() => {
    return topClientes.filter((c) => c.saldo > 0).slice(0, 10);
  }, [topClientes]);

  // 📅 Días desde una fecha
  const diasDesde = (fecha) => {
    if (!fecha) return null;

    let fechaObj;
    if (fecha.toDate) fechaObj = fecha.toDate();
    else if (typeof fecha === 'string') fechaObj = new Date(fecha);
    else fechaObj = new Date(fecha);

    if (isNaN(fechaObj)) return null;

    const hoy = new Date();
    const diff = Math.floor((hoy - fechaObj) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  };

  const nivelDeuda = (c) => {
    const dias = diasDesde(c.fechaUltimoPago || c.fechaUltimaCompra);

    if (dias === null) return { nivel: 'sin-datos', label: 'Sin datos' };
    if (dias < 15) {
      return {
        nivel: 'reciente',
        label: dias === 0 ? 'Hoy' : `Hace ${dias} día${dias !== 1 ? 's' : ''}`
      };
    }
    if (dias < 30) {
      return { nivel: 'medio', label: `Hace ${dias} días` };
    }
    return { nivel: 'urgente', label: `Hace ${dias} días ⚠️` };
  };

  // 📊 Gráfico
  const lotesParaGrafico = topLotes.slice(0, 6);
  const maxVentasLote = Math.max(
    ...lotesParaGrafico.map((l) => l.ventasTotal || 0),
    1
  );

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

  const abrevUnidad = (unidad) => {
    const mapa = {
      litros: 'L',
      mililitros: 'ml',
      libras: 'lb',
      kilos: 'kg',
      gramos: 'g',
      unidades: 'und',
      docenas: 'doc',
      paquetes: 'paq',
      cajas: 'caja',
      botellas: 'bot'
    };
    return mapa[unidad] || unidad || '';
  };

  return (
    <div className="modulo-layout">
      <div className="modulo-main">
        <TopBar
          usuario={usuario}
          titulo="📊 Reportes"
          onAbrirSidebar={onAbrirSidebar}
        />

        <div className="modulo-content">
          {/* Header */}
          <div className="reportes-header">
            <div>
              <h1>Reportes del negocio</h1>
              <p>Análisis por lote de producción</p>
            </div>
          </div>

          {/* 🎛️ FILTROS */}
          <div className="filtros-panel">
            <div className="filtro-grupo">
              <label>🍚 Lote</label>
              <select
                value={loteSeleccionado}
                onChange={(e) => setLoteSeleccionado(e.target.value)}
              >
                <option value="todos">
                  📚 Todos los lotes ({lotes.length})
                </option>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre} · {formatearFecha(l.fecha)}
                  </option>
                ))}
              </select>
            </div>

            <div className="filtro-grupo">
              <label>📊 Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="rentables">✅ Rentables</option>
                <option value="perdida">⚠️ En pérdida</option>
              </select>
            </div>
          </div>

         {/* 🍚 LOTE SELECCIONADO */}
{loteSeleccionado !== 'todos' && lotesFiltrados.length === 1 && (
  <div className="seccion-resumen-general">
    <div className="seccion-header">
      <div>
        <h2>🍚 Lote seleccionado</h2>
        <p className="seccion-subtitulo">
          {formatearFecha(lotesFiltrados[0].fecha)} ·{' '}
          {lotesFiltrados[0].presentacion || 'Sin presentación'}
        </p>
      </div>
      <button
        className="btn-ver-todos"
        onClick={() => setLoteSeleccionado('todos')}
      >
        ✖ Ver todos los lotes
      </button>
    </div>

    {/* Banner del lote */}
    <div className="lote-seleccionado-banner">
      <div>
        <span className="lote-badge">🍚 LOTE SELECCIONADO</span>
        <h2>{lotesFiltrados[0].nombre}</h2>
        <p>
          {formatearFecha(lotesFiltrados[0].fecha)} ·{' '}
          {lotesFiltrados[0].presentacion || 'Sin presentación'}
        </p>
      </div>
    </div>

    {/* 🍚 PRODUCCIÓN */}
    <div className="resumen-bloque">
      <div className="resumen-bloque-titulo">
        <span className="resumen-bloque-icon">🍚</span>
        <span>Producción</span>
      </div>
      <div className="stats-grid stats-grid-3">
        <StatCard
          icon="🍚"
          label="Producidos"
          valor={lotesFiltrados[0].cantidadProducida || 0}
          color="chocolate"
        />
        <StatCard
          icon="🛒"
          label="Vendidos"
          valor={lotesFiltrados[0].ventasCantidad || 0}
          color="turquesa"
        />
        <StatCard
          icon="📉"
          label="Pérdidas"
          valor={lotesFiltrados[0].perdidas || 0}
          color="coral"
        />
      </div>
    </div>

    {/* 💰 FINANZAS */}
    <div className="resumen-bloque">
      <div className="resumen-bloque-titulo">
        <span className="resumen-bloque-icon">💰</span>
        <span>Finanzas</span>
      </div>
      <div className="stats-grid">
        <StatCard
          icon="🥛"
          label="Costos ingredientes"
          valor={`$${(
            lotesFiltrados[0].costoTotal || 0
          ).toLocaleString('es-CO')}`}
          color="chocolate"
        />
        <StatCard
          icon="🗂️"
          label="Gastos externos"
          valor={`$${(
            lotesFiltrados[0].gastosTotal || 0
          ).toLocaleString('es-CO')}`}
          color="coral"
        />
        <StatCard
          icon="💵"
          label="Base"
          valor={`$${(
            lotesFiltrados[0].base || 0
          ).toLocaleString('es-CO')}`}
          color="turquesa"
        />
        <StatCard
          icon="📊"
          label="Facturado"
          valor={`$${(
            lotesFiltrados[0].ventasTotal || 0
          ).toLocaleString('es-CO')}`}
          color="amarillo"
        />
      </div>
    </div>

    {/* ✅ COBROS */}
    <div className="resumen-bloque">
      <div className="resumen-bloque-titulo">
        <span className="resumen-bloque-icon">✅</span>
        <span>Cobros</span>
      </div>
      <div className="stats-grid stats-grid-2">
        <StatCard
          icon="✅"
          label="Cobrado"
          valor={`$${(
            lotesFiltrados[0].ventasPagado || 0
          ).toLocaleString('es-CO')}`}
          color="turquesa"
        />
        <StatCard
          icon="⏳"
          label="Por cobrar"
          valor={`$${(
            lotesFiltrados[0].ventasSaldo || 0
          ).toLocaleString('es-CO')}`}
          color="amarillo"
        />
      </div>
    </div>

    {/* 💰 TOTALES DESTACADOS */}
    <div className="resumen-totales">
      <div className="resumen-total-card total-real-naranja">
        <div className="resumen-total-icon">📊</div>
        <div className="resumen-total-info">
          <span className="total-real-label">Total con gastos</span>
          <small>Cobrado + Base − Gastos</small>
        </div>
        <strong
          className="total-real-valor"
          style={{
            color:
              lotesFiltrados[0].totalConGastos >= 0 ? '#2A9D8F' : '#F26B7A'
          }}
        >
          ${lotesFiltrados[0].totalConGastos.toLocaleString('es-CO')}
        </strong>
      </div>

      <div className="resumen-total-card total-real-verde">
        <div className="resumen-total-icon">💰</div>
        <div className="resumen-total-info">
          <span className="total-real-label">Total real</span>
          <small>Cobrado + Base − Gastos − Costos</small>
        </div>
        <strong
          className="total-real-valor"
          style={{
            color: lotesFiltrados[0].totalReal >= 0 ? '#2A9D8F' : '#F26B7A'
          }}
        >
          ${lotesFiltrados[0].totalReal.toLocaleString('es-CO')}
        </strong>
      </div>
    </div>
  </div>
)}

          {/* 📊 RESUMEN GENERAL (solo cuando NO hay lote seleccionado) */}
{loteSeleccionado === 'todos' && (
  <div className="seccion-resumen-general">
    <div className="seccion-header">
      <div>
        <h2>📊 Resumen general</h2>
        <p className="seccion-subtitulo">
          Acumulado de <strong>{totalesFiltrados.lotes}</strong> lotes
        </p>
      </div>
    </div>

    {/* 🍚 PRODUCCIÓN */}
    <div className="resumen-bloque">
      <div className="resumen-bloque-titulo">
        <span className="resumen-bloque-icon">🍚</span>
        <span>Producción</span>
      </div>
      <div className="stats-grid">
        <StatCard
          icon="🍚"
          label="Lotes"
          valor={totalesFiltrados.lotes}
          color="chocolate"
        />
        <StatCard
          icon="📦"
          label="Producidos"
          valor={totalesFiltrados.producidos.toLocaleString('es-CO')}
          color="chocolate"
        />
        <StatCard
          icon="🛒"
          label="Vendidos"
          valor={totalesFiltrados.vendidos.toLocaleString('es-CO')}
          color="turquesa"
        />
        <StatCard
          icon="📉"
          label="Pérdidas"
          valor={totalesFiltrados.perdidas.toLocaleString('es-CO')}
          color="coral"
        />
      </div>
    </div>

    {/* 💰 FINANZAS */}
    <div className="resumen-bloque">
      <div className="resumen-bloque-titulo">
        <span className="resumen-bloque-icon">💰</span>
        <span>Finanzas</span>
      </div>
      <div className="stats-grid">
        <StatCard
          icon="🥛"
          label="Costos ingredientes"
          valor={`$${totalesFiltrados.costos.toLocaleString('es-CO')}`}
          color="chocolate"
        />
        <StatCard
          icon="🗂️"
          label="Gastos externos"
          valor={`$${totalesFiltrados.gastos.toLocaleString('es-CO')}`}
          color="coral"
        />
        <StatCard
          icon="💵"
          label="Base total"
          valor={`$${totalesFiltrados.base.toLocaleString('es-CO')}`}
          color="turquesa"
        />
        <StatCard
          icon="📊"
          label="Facturado"
          valor={`$${totalesFiltrados.facturado.toLocaleString('es-CO')}`}
          color="amarillo"
        />
      </div>
    </div>

    {/* ✅ COBROS */}
    <div className="resumen-bloque">
      <div className="resumen-bloque-titulo">
        <span className="resumen-bloque-icon">✅</span>
        <span>Cobros</span>
      </div>
      <div className="stats-grid stats-grid-2">
        <StatCard
          icon="✅"
          label="Ventas cobradas"
          valor={`$${totalesFiltrados.cobrado.toLocaleString('es-CO')}`}
          color="turquesa"
        />
        <StatCard
          icon="⏳"
          label="Por cobrar"
          valor={`$${totalesFiltrados.porCobrar.toLocaleString('es-CO')}`}
          color="amarillo"
        />
      </div>
    </div>

    {/* 💰 TOTALES DESTACADOS */}
    <div className="resumen-totales">
      <div className="resumen-total-card total-real-naranja">
        <div className="resumen-total-icon">📊</div>
        <div className="resumen-total-info">
          <span className="total-real-label">Total con gastos</span>
          <small>Cobrado + Base − Gastos</small>
        </div>
        <strong
          className="total-real-valor"
          style={{
            color:
              totalesFiltrados.totalConGastos >= 0 ? '#2A9D8F' : '#F26B7A'
          }}
        >
          ${totalesFiltrados.totalConGastos.toLocaleString('es-CO')}
        </strong>
      </div>

      <div className="resumen-total-card total-real-verde">
        <div className="resumen-total-icon">💰</div>
        <div className="resumen-total-info">
          <span className="total-real-label">Total real</span>
          <small>Cobrado + Base − Gastos − Costos</small>
        </div>
        <strong
          className="total-real-valor"
          style={{
            color: totalesFiltrados.totalReal >= 0 ? '#2A9D8F' : '#F26B7A'
          }}
        >
          ${totalesFiltrados.totalReal.toLocaleString('es-CO')}
        </strong>
      </div>
    </div>
  </div>
)}

          {/* ⚠️ CLIENTES CON SALDO PENDIENTE (después del resumen) */}
          {deudoresFiltrados.length > 0 && (
            <div className="dashboard-panel">
              <h3 className="panel-title">
                ⚠️ Clientes con saldo pendiente
                {loteSeleccionado !== 'todos' && lotesFiltrados[0] && (
                  <span className="cartera-scope">
                    {' '}
                    · {lotesFiltrados[0].nombre}
                  </span>
                )}
              </h3>

              {/* 📊 TABLA DESKTOP */}
              <div className="tabla-deudas-desktop">
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Teléfono</th>
                        <th>Pedidos</th>
                        <th>Total</th>
                        <th>Abonado</th>
                        <th>Debe</th>
                        <th>% Pagado</th>
                        <th>Último pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deudoresFiltrados.map((c, i) => {
                        const pct =
                          c.total > 0
                            ? ((c.pagado / c.total) * 100).toFixed(0)
                            : 0;
                        const urgencia = nivelDeuda(c);

                        return (
                          <tr key={i}>
                            <td>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10
                                }}
                              >
                                <div className="cliente-avatar-deuda">
                                  {c.nombre?.[0]?.toUpperCase() || '?'}
                                </div>
                                <strong>{c.nombre}</strong>
                              </div>
                            </td>
                            <td>{c.telefono ? `📞 ${c.telefono}` : '—'}</td>
                            <td>{c.pedidos}</td>
                            <td>${c.total.toLocaleString('es-CO')}</td>
                            <td>
                              <strong style={{ color: '#2A9D8F' }}>
                                ${c.pagado.toLocaleString('es-CO')}
                              </strong>
                            </td>
                            <td>
                              <strong style={{ color: '#F26B7A' }}>
                                ${c.saldo.toLocaleString('es-CO')}
                              </strong>
                            </td>
                            <td>
                              <span
                                className={`badge-pago badge-pago-${
                                  pct >= 70
                                    ? 'verde'
                                    : pct >= 40
                                    ? 'amarillo'
                                    : 'rojo'
                                }`}
                              >
                                {pct}%
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge-urgencia badge-${urgencia.nivel}`}
                              >
                                {urgencia.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 📱 CARDS MOBILE */}
              <div className="cards-deudas-mobile">
                {deudoresFiltrados.map((c, i) => {
                  const porcentajePagado =
                    c.total > 0 ? ((c.pagado / c.total) * 100).toFixed(0) : 0;
                  const urgencia = nivelDeuda(c);

                  return (
                    <div key={i} className="deuda-card">
                      <div className="deuda-card-barra" />

                      <div className="deuda-card-header">
                        <div className="deuda-card-avatar">
                          {c.nombre?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="deuda-card-info">
                          <strong>{c.nombre}</strong>
                          {c.telefono ? (
                            <small className="deuda-card-telefono">
                              📞 {c.telefono}
                            </small>
                          ) : (
                            <small style={{ color: '#8B7A66' }}>
                              Sin teléfono
                            </small>
                          )}
                        </div>
                        <span className="deuda-card-pedidos">
                          🛒 {c.pedidos}
                        </span>
                      </div>

                      <div
                        className={`deuda-card-urgencia badge-${urgencia.nivel}`}
                      >
                        <span>Último pago:</span>
                        <strong>{urgencia.label}</strong>
                      </div>

                      <div className="deuda-card-deuda">
                        <span className="deuda-label">⚠️ Debe</span>
                        <strong className="deuda-valor">
                          ${c.saldo.toLocaleString('es-CO')}
                        </strong>
                      </div>

                      <div className="deuda-card-info-grid">
                        <div className="deuda-info-item">
                          <span className="deuda-info-label">💰 Total</span>
                          <strong>${c.total.toLocaleString('es-CO')}</strong>
                        </div>
                        <div className="deuda-info-item">
                          <span className="deuda-info-label">✅ Abonado</span>
                          <strong style={{ color: '#2A9D8F' }}>
                            ${c.pagado.toLocaleString('es-CO')}
                          </strong>
                        </div>
                      </div>

                      <div className="deuda-card-progreso">
                        <div className="deuda-progreso-header">
                          <span>Pago</span>
                          <strong>{porcentajePagado}%</strong>
                        </div>
                        <div className="deuda-progreso-track">
                          <div
                            className="deuda-progreso-fill"
                            style={{ width: `${porcentajePagado}%` }}
                          />
                        </div>
                      </div>

                      {c.telefono && (
                        <div className="deuda-card-acciones-single">
                          <a
                            href={`https://wa.me/57${c.telefono.replace(
                              /\D/g,
                              ''
                            )}?text=Hola ${encodeURIComponent(
                              c.nombre
                            )}, te recuerdo tu saldo pendiente de $${c.saldo.toLocaleString(
                              'es-CO'
                            )} 🍚`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-accion-deuda btn-whatsapp"
                          >
                            💬 Enviar WhatsApp
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 🏆 Top lotes rentables */}
          {topLotes.length > 0 && (
            <div className="dashboard-panel">
              <h3 className="panel-title">
                🏆{' '}
                {loteSeleccionado === 'todos'
                  ? 'Lotes más rentables'
                  : 'Este lote'}
              </h3>
              <div className="tabla-ranking">
                {topLotes.slice(0, 8).map((l, i) => (
                  <div key={l.id} className="ranking-item">
                    {loteSeleccionado === 'todos' && (
                      <div
                        className={`ranking-pos ${
                          i < 3 ? `pos-${i + 1}` : ''
                        }`}
                      >
                        #{i + 1}
                      </div>
                    )}
                    <div className="ranking-info">
                      <strong>{l.nombre}</strong>
                      <small>
                        {l.cantidadProducida} producidos · {l.ventasCantidad}{' '}
                        vendidos · {formatearFecha(l.fecha)}
                      </small>
                    </div>
                    <div className="ranking-montos">
                      <strong
                        style={{
                          color: l.totalReal >= 0 ? '#2A9D8F' : '#F26B7A'
                        }}
                      >
                        ${l.totalReal.toLocaleString('es-CO')}
                      </strong>
                      <small style={{ color: '#8B7A66' }}>
                        cobrado ${(l.ventasPagado || 0).toLocaleString('es-CO')}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gráfico comparativo (solo en "todos") */}
          {loteSeleccionado === 'todos' && lotesParaGrafico.length > 1 && (
            <div className="dashboard-panel">
              <h3 className="panel-title">📊 Comparativa de ventas por lote</h3>
              <div className="grafico-lotes">
                {lotesParaGrafico.map((l) => {
                  const anchoVentas =
                    ((l.ventasTotal || 0) / maxVentasLote) * 100;
                  const anchoCostos =
                    ((l.costoTotal || 0) / maxVentasLote) * 100;
                  return (
                    <div key={l.id} className="grafico-lote-item">
                      <div className="grafico-lote-nombre">{l.nombre}</div>
                      <div className="grafico-lote-barras">
                        <div className="grafico-lote-barra">
                          <div
                            className="grafico-lote-fill fill-ventas"
                            style={{ width: `${anchoVentas}%` }}
                          />
                          <span className="grafico-lote-monto">
                            💰 ${(l.ventasTotal || 0).toLocaleString('es-CO')}
                          </span>
                        </div>
                        <div className="grafico-lote-barra">
                          <div
                            className="grafico-lote-fill fill-costos"
                            style={{ width: `${anchoCostos}%` }}
                          />
                          <span className="grafico-lote-monto">
                            🥛 ${(l.costoTotal || 0).toLocaleString('es-CO')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top ingredientes + Top clientes */}
          <div className="reportes-grid-2">
            <div className="dashboard-panel">
              <h3 className="panel-title">🥛 Ingredientes más costosos</h3>
              {topIngredientes.length === 0 ? (
                <p className="panel-vacio">Sin ingredientes.</p>
              ) : (
                <div className="lista-ingredientes">
                  {topIngredientes.map((ing, i) => {
                    const ancho = (ing.total / maxIngrediente) * 100;
                    return (
                      <div key={i} className="ingrediente-item">
                        <div className="ingrediente-header">
                          <strong>{ing.nombre}</strong>
                          <span>${ing.total.toLocaleString('es-CO')}</span>
                        </div>
                        <div className="ingrediente-track">
                          <div
                            className="ingrediente-fill"
                            style={{ width: `${ancho}%` }}
                          />
                        </div>
                        <small className="ingrediente-cantidad">
                          {ing.cantidad.toLocaleString('es-CO')}{' '}
                          {abrevUnidad(ing.unidad)} · usado en {ing.lotes} lote
                          {ing.lotes !== 1 ? 's' : ''}
                        </small>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="dashboard-panel">
              <h3 className="panel-title">🏆 Top clientes</h3>
              {topClientes.length === 0 ? (
                <p className="panel-vacio">Sin ventas en estos lotes.</p>
              ) : (
                <div className="tabla-ranking">
                  {topClientes.slice(0, 6).map((c, i) => (
                    <div key={i} className="ranking-item">
                      <div
                        className={`ranking-pos ${
                          i < 3 ? `pos-${i + 1}` : ''
                        }`}
                      >
                        #{i + 1}
                      </div>
                      <div className="ranking-info">
                        <strong>{c.nombre}</strong>
                        <small>
                          {c.pedidos} pedido{c.pedidos !== 1 ? 's' : ''} ·{' '}
                          <strong style={{ color: '#2A9D8F' }}>
                            {c.unidades}
                          </strong>{' '}
                          unidades
                        </small>
                      </div>
                      <div className="ranking-montos">
                        <strong style={{ color: '#F26B7A' }}>
                          ${c.total.toLocaleString('es-CO')}
                        </strong>
                        {c.saldo > 0 && (
                          <small style={{ color: '#9C7A00' }}>
                            debe ${c.saldo.toLocaleString('es-CO')}
                          </small>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reportes;