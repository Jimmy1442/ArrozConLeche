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
  const [cargando, setCargando] = useState(true);

  // 🎛️ Filtros
  const [loteSeleccionado, setLoteSeleccionado] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos'); // todos | rentables | perdida

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

    return () => {
      unsubLotes();
      unsubVentas();
      unsubClientes();
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

  // 📊 Lotes con sus ventas calculadas
  const lotesConDatos = useMemo(() => {
    return lotes.map((l) => {
      const v = getVentasLote(l.id);
      const ganancia = v.total - (l.costoTotal || 0);
      const margen =
        v.total > 0 ? ((ganancia / v.total) * 100).toFixed(1) : '0.0';
      return {
        ...l,
        ventasCantidad: v.cantidad,
        ventasTotal: v.total,
        ventasPagado: v.pagado,
        ventasSaldo: v.saldo,
        ventasPedidos: v.pedidos,
        ganancia,
        margen
      };
    });
  }, [lotes, ventasPorLote]);

  // 🎯 Aplicar filtros
  const lotesFiltrados = useMemo(() => {
    let resultado = [...lotesConDatos];

    if (loteSeleccionado !== 'todos') {
      resultado = resultado.filter((l) => l.id === loteSeleccionado);
    }

    if (filtroEstado === 'rentables') {
      resultado = resultado.filter((l) => l.ganancia >= 0);
    } else if (filtroEstado === 'perdida') {
      resultado = resultado.filter((l) => l.ganancia < 0);
    }

    return resultado;
  }, [lotesConDatos, loteSeleccionado, filtroEstado]);

  // 📊 Ventas filtradas
  const ventasFiltradas = useMemo(() => {
    if (loteSeleccionado === 'todos') return ventas;
    return ventas.filter((v) => v.loteId === loteSeleccionado);
  }, [ventas, loteSeleccionado]);

  // 💰 Totales
  const totalCostos = lotesFiltrados.reduce(
    (s, l) => s + (l.costoTotal || 0),
    0
  );
  const totalVentas = lotesFiltrados.reduce(
    (s, l) => s + (l.ventasTotal || 0),
    0
  );
  const totalPagado = lotesFiltrados.reduce(
    (s, l) => s + (l.ventasPagado || 0),
    0
  );
  const totalPorCobrar = lotesFiltrados.reduce(
    (s, l) => s + (l.ventasSaldo || 0),
    0
  );

  const gananciaNeta = totalPagado - totalCostos;
  const gananciaAprox = totalVentas - totalCostos;
  const margen =
    totalVentas > 0 ? ((gananciaAprox / totalVentas) * 100).toFixed(1) : 0;

  const totalProducidos = lotesFiltrados.reduce(
    (s, l) => s + (l.cantidadProducida || 0),
    0
  );
  const totalVendidos = lotesFiltrados.reduce(
    (s, l) => s + (l.ventasCantidad || 0),
    0
  );
  const totalPerdidas = lotesFiltrados.reduce(
    (s, l) => s + (l.perdidas || 0),
    0
  );

  const ticketPromedio =
    ventasFiltradas.length > 0
      ? Math.round(totalVentas / ventasFiltradas.length)
      : 0;

  // 🏆 Top lotes
  const topLotes = useMemo(
    () => [...lotesFiltrados].sort((a, b) => b.ganancia - a.ganancia),
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

  // 👥 Top clientes
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
          pedidos: 0
        };
      }
      mapa[key].total += v.total || 0;
      mapa[key].pagado += v.pagado || 0;
      mapa[key].saldo += v.saldo || 0;
      mapa[key].pedidos += 1;
    });
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [ventasFiltradas]);

  const clientesConDeuda = topClientes.filter((c) => c.saldo > 0).slice(0, 5);

  // 📊 Comparativa para gráfico
  const lotesParaGrafico = topLotes.slice(0, 6);
  const maxVentasLote = Math.max(
    ...lotesParaGrafico.map((l) => l.ventasTotal || 0),
    1
  );

  const formatearFecha = (fecha) => {
    if (!fecha) return '...';
    if (fecha.toDate) return fecha.toDate().toLocaleDateString('es-CO');
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

          {/* Banner del lote seleccionado */}
          {loteSeleccionado !== 'todos' && lotesFiltrados.length === 1 && (
            <div className="lote-seleccionado-banner">
              <div>
                <span className="lote-badge">🍚 LOTE SELECCIONADO</span>
                <h2>{lotesFiltrados[0].nombre}</h2>
                <p>
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
          )}

          {/* Tarjetas principales */}
          <div className="stats-grid stats-grid-3">
            <StatCard
              icon="🍚"
              label={
                loteSeleccionado === 'todos'
                  ? 'Lotes filtrados'
                  : 'Producidos'
              }
              valor={
                loteSeleccionado === 'todos'
                  ? lotesFiltrados.length
                  : totalProducidos
              }
              color="chocolate"
            />
            <StatCard
              icon="🥛"
              label="Costos"
              valor={`$${totalCostos.toLocaleString('es-CO')}`}
              color="chocolate"
            />
            <StatCard
              icon="💰"
              label="Ventas"
              valor={`$${totalVentas.toLocaleString('es-CO')}`}
              color="coral"
            />
          </div>

          <div className="stats-grid stats-grid-3">
            <StatCard
              icon="⏳"
              label="Por cobrar"
              valor={`$${totalPorCobrar.toLocaleString('es-CO')}`}
              color="amarillo"
            />
            <StatCard
              icon="✅"
              label="Ganancia neta"
              valor={`$${gananciaNeta.toLocaleString('es-CO')}`}
              color={gananciaNeta >= 0 ? 'turquesa' : 'coral'}
            />
            <StatCard
              icon="📈"
              label="Ganancia aproximada"
              valor={`$${gananciaAprox.toLocaleString('es-CO')}`}
              color={gananciaAprox >= 0 ? 'turquesa' : 'coral'}
            />
          </div>

          {/* Resumen ejecutivo */}
          <div className="dashboard-panel">
            <h3 className="panel-title">📋 Resumen ejecutivo</h3>
            <div className="resumen-ejecutivo">
              <div className="ejecutivo-item">
                <span className="ejecutivo-label">Margen de ganancia</span>
                <strong
                  className="ejecutivo-valor"
                  style={{ color: margen >= 0 ? '#2A9D8F' : '#F26B7A' }}
                >
                  {margen}%
                </strong>
                <small className="ejecutivo-hint">Sobre ventas</small>
              </div>

              <div className="ejecutivo-item">
                <span className="ejecutivo-label">Total producidos</span>
                <strong
                  className="ejecutivo-valor"
                  style={{ color: '#5C3A21' }}
                >
                  {totalProducidos}
                </strong>
                <small className="ejecutivo-hint">
                  {totalVendidos} vendidos · {totalPerdidas} pérdidas
                </small>
              </div>

              <div className="ejecutivo-item">
                <span className="ejecutivo-label">Ticket promedio</span>
                <strong
                  className="ejecutivo-valor"
                  style={{ color: '#F26B7A' }}
                >
                  ${ticketPromedio.toLocaleString('es-CO')}
                </strong>
                <small className="ejecutivo-hint">
                  {ventasFiltradas.length} pedidos
                </small>
              </div>

              <div className="ejecutivo-item">
                <span className="ejecutivo-label">Eficiencia ventas</span>
                <strong
                  className="ejecutivo-valor"
                  style={{ color: '#2A9D8F' }}
                >
                  {totalProducidos > 0
                    ? ((totalVendidos / totalProducidos) * 100).toFixed(1)
                    : 0}
                  %
                </strong>
                <small className="ejecutivo-hint">
                  Vendidos / Producidos
                </small>
              </div>
            </div>
          </div>

          {/* Top lotes rentables */}
          <div className="dashboard-panel">
            <h3 className="panel-title">
              🏆{' '}
              {loteSeleccionado === 'todos'
                ? 'Lotes más rentables'
                : 'Este lote'}
            </h3>
            {topLotes.length === 0 ? (
              <p className="panel-vacio">
                Sin lotes que coincidan con los filtros.
              </p>
            ) : (
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
                          color: l.ganancia >= 0 ? '#2A9D8F' : '#F26B7A'
                        }}
                      >
                        ${l.ganancia.toLocaleString('es-CO')}
                      </strong>
                      <small
                        style={{
                          color: '#8B7A66',
                          display: 'flex',
                          gap: 6
                        }}
                      >
                        <span>
                          ventas ${(l.ventasTotal || 0).toLocaleString('es-CO')}
                        </span>
                        <span
                          style={{
                            background:
                              Number(l.margen) >= 30
                                ? '#D3F5E0'
                                : Number(l.margen) >= 0
                                ? '#FFF3C4'
                                : '#FFD3D3',
                            color:
                              Number(l.margen) >= 30
                                ? '#1E7A4C'
                                : Number(l.margen) >= 0
                                ? '#9C7A00'
                                : '#9C1E1E',
                            padding: '1px 6px',
                            borderRadius: 8,
                            fontWeight: 700
                          }}
                        >
                          {l.margen}%
                        </span>
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gráfico comparativo */}
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
                          {c.telefono || 'sin teléfono'}
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

          {/* ⚠️ Clientes con deuda */}
          {clientesConDeuda.length > 0 && (
            <div className="dashboard-panel">
              <h3 className="panel-title">⚠️ Clientes con saldo pendiente</h3>

              {/* Vista de tabla (PC/Tablet) */}
              <div className="tabla-deudas-desktop">
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Teléfono</th>
                        <th>Pedidos</th>
                        <th>Total</th>
                        <th>Pagado</th>
                        <th>Debe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesConDeuda.map((c, i) => (
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
                          <td>
  {c.telefono ? `📞 ${c.telefono}` : '—'}
</td>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Vista de cards (móvil) */}
              <div className="cards-deudas-mobile">
                {clientesConDeuda.map((c, i) => {
                  const porcentajePagado =
                    c.total > 0 ? ((c.pagado / c.total) * 100).toFixed(0) : 0;

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
                          <span className="deuda-info-label">✅ Pagado</span>
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

          {/* Detalle de lotes — vista tabla + cards */}
          <div className="dashboard-panel">
            <h3 className="panel-title">
              📋 Detalle de lotes ({lotesFiltrados.length})
            </h3>

            {lotesFiltrados.length === 0 ? (
              <p className="panel-vacio">
                Sin lotes que coincidan con los filtros.
              </p>
            ) : (
              <>
                {/* Vista de tabla (PC/Tablet) */}
                <div className="tabla-reportes-desktop">
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Lote</th>
                          <th>Producidos</th>
                          <th>Vendidos</th>
                          <th>Pérdidas</th>
                          <th>Costos</th>
                          <th>Ventas</th>
                          <th>Ganancia</th>
                          <th>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lotesFiltrados.slice(0, 30).map((l) => (
                          <tr key={l.id}>
                            <td>{formatearFecha(l.fecha)}</td>
                            <td>
                              <strong>{l.nombre}</strong>
                            </td>
                            <td>{l.cantidadProducida}</td>
                            <td>
                              <span
                                style={{ color: '#2A9D8F', fontWeight: 600 }}
                              >
                                {l.ventasCantidad}
                              </span>
                            </td>
                            <td>
                              <span
                                style={{ color: '#F26B7A', fontWeight: 600 }}
                              >
                                {l.perdidas || 0}
                              </span>
                            </td>
                            <td>
                              <strong style={{ color: '#F26B7A' }}>
                                ${(l.costoTotal || 0).toLocaleString('es-CO')}
                              </strong>
                            </td>
                            <td>
                              <strong style={{ color: '#2A9D8F' }}>
                                ${(l.ventasTotal || 0).toLocaleString('es-CO')}
                              </strong>
                            </td>
                            <td>
                              <strong
                                style={{
                                  color:
                                    l.ganancia >= 0 ? '#2A9D8F' : '#F26B7A'
                                }}
                              >
                                ${l.ganancia.toLocaleString('es-CO')}
                              </strong>
                            </td>
                            <td>
                              <span
                                style={{
                                  background:
                                    Number(l.margen) >= 30
                                      ? '#D3F5E0'
                                      : Number(l.margen) >= 0
                                      ? '#FFF3C4'
                                      : '#FFD3D3',
                                  color:
                                    Number(l.margen) >= 30
                                      ? '#1E7A4C'
                                      : Number(l.margen) >= 0
                                      ? '#9C7A00'
                                      : '#9C1E1E',
                                  padding: '3px 8px',
                                  borderRadius: 8,
                                  fontSize: 11,
                                  fontWeight: 700
                                }}
                              >
                                {l.margen}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {lotesFiltrados.length > 30 && (
                      <p
                        style={{
                          textAlign: 'center',
                          padding: '15px',
                          color: '#8B7A66',
                          fontSize: '13px'
                        }}
                      >
                        Mostrando 30 de {lotesFiltrados.length} lotes
                      </p>
                    )}
                  </div>
                </div>

                {/* Vista de cards (móvil) */}
                <div className="cards-reportes-mobile">
                  {lotesFiltrados.slice(0, 30).map((l) => {
                    const esRentable = l.ganancia >= 0;
                    const margenNum = Number(l.margen);

                    return (
                      <div key={l.id} className="reporte-card">
                        <div
                          className={`reporte-card-barra ${
                            esRentable ? 'barra-verde' : 'barra-roja'
                          }`}
                        />

                        <div className="reporte-card-header">
                          <div className="reporte-card-info">
                            <strong>{l.nombre}</strong>
                            <small>📅 {formatearFecha(l.fecha)}</small>
                          </div>
                          <span
                            className="reporte-card-margen"
                            style={{
                              background:
                                margenNum >= 30
                                  ? '#D3F5E0'
                                  : margenNum >= 0
                                  ? '#FFF3C4'
                                  : '#FFD3D3',
                              color:
                                margenNum >= 30
                                  ? '#1E7A4C'
                                  : margenNum >= 0
                                  ? '#9C7A00'
                                  : '#9C1E1E'
                            }}
                          >
                            {l.margen}%
                          </span>
                        </div>

                        <div
                          className={`reporte-card-ganancia ${
                            esRentable
                              ? 'ganancia-positiva'
                              : 'ganancia-negativa'
                          }`}
                        >
                          <span className="reporte-ganancia-label">
                            {esRentable ? '💰 Ganancia' : '📉 Pérdida'}
                          </span>
                          <strong className="reporte-ganancia-valor">
                            ${Math.abs(l.ganancia).toLocaleString('es-CO')}
                          </strong>
                        </div>

                        <div className="reporte-card-info-grid">
                          <div className="reporte-info-item">
                            <span className="reporte-info-label">
                              🍚 Producidos
                            </span>
                            <strong>{l.cantidadProducida}</strong>
                          </div>
                          <div className="reporte-info-item">
                            <span className="reporte-info-label">
                              ✅ Vendidos
                            </span>
                            <strong style={{ color: '#2A9D8F' }}>
                              {l.ventasCantidad}
                            </strong>
                          </div>
                          <div className="reporte-info-item">
                            <span className="reporte-info-label">
                              ➖ Pérdidas
                            </span>
                            <strong style={{ color: '#F26B7A' }}>
                              {l.perdidas || 0}
                            </strong>
                          </div>
                          <div className="reporte-info-item">
                            <span className="reporte-info-label">
                              🛒 Ventas
                            </span>
                            <strong style={{ color: '#2A9D8F' }}>
                              ${(l.ventasTotal || 0).toLocaleString('es-CO')}
                            </strong>
                          </div>
                          <div className="reporte-info-item reporte-info-full">
                            <span className="reporte-info-label">
                              🥛 Costos
                            </span>
                            <strong style={{ color: '#F26B7A' }}>
                              ${(l.costoTotal || 0).toLocaleString('es-CO')}
                            </strong>
                          </div>
                        </div>

                        {l.cantidadProducida > 0 && (
                          <div className="reporte-card-progreso">
                            <div className="reporte-progreso-header">
                              <span>Vendidos</span>
                              <strong>
                                {(
                                  (l.ventasCantidad / l.cantidadProducida) *
                                  100
                                ).toFixed(0)}
                                %
                              </strong>
                            </div>
                            <div className="reporte-progreso-track">
                              <div
                                className="reporte-progreso-fill"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (l.ventasCantidad / l.cantidadProducida) *
                                      100
                                  )}%`
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {lotesFiltrados.length > 30 && (
                    <p
                      style={{
                        textAlign: 'center',
                        padding: '15px',
                        color: '#8B7A66',
                        fontSize: '13px'
                      }}
                    >
                      Mostrando 30 de {lotesFiltrados.length} lotes
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reportes;