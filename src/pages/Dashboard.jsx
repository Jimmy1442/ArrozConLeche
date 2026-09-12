import { useState, useEffect } from 'react';
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
import '../styles/Dashboard.css';

function Dashboard({ usuario, onAbrirSidebar }) {
  const [ventas, setVentas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // 🎛️ Selector de lote activo ('' = auto = el más reciente)
  const [loteSeleccionadoId, setLoteSeleccionadoId] = useState('');

  // 🔥 Cargar todo
  useEffect(() => {
    const qVentas = query(
      collection(db, 'ventas'),
      orderBy('fecha', 'desc'),
      limit(500)
    );
    const unsubVentas = onSnapshot(
      qVentas,
      (snap) => {
        setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCargando(false);
      },
      (err) => {
        console.error(err);
        setError('No se pudieron cargar los datos');
        setCargando(false);
      }
    );

    const qLotes = query(
      collection(db, 'lotes'),
      orderBy('fecha', 'desc'),
      limit(500)
    );
    const unsubLotes = onSnapshot(qLotes, (snap) => {
      setLotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubClientes = onSnapshot(collection(db, 'clientes'), (snap) => {
      setClientes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const qGastos = query(
      collection(db, 'gastos'),
      orderBy('fecha', 'desc'),
      limit(500)
    );
    const unsubGastos = onSnapshot(qGastos, (snap) => {
      setGastos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubVentas();
      unsubLotes();
      unsubClientes();
      unsubGastos();
    };
  }, []);

  // 📊 Ventas agrupadas por lote
  const ventasPorLote = {};
  ventas.forEach((v) => {
    if (!v.loteId) return;
    if (!ventasPorLote[v.loteId]) {
      ventasPorLote[v.loteId] = {
        cantidad: 0,
        total: 0,
        pagado: 0,
        saldo: 0,
        pedidos: 0
      };
    }
    ventasPorLote[v.loteId].cantidad += Number(v.cantidad) || 0;
    ventasPorLote[v.loteId].total += Number(v.total) || 0;
    ventasPorLote[v.loteId].pagado += Number(v.pagado) || 0;
    ventasPorLote[v.loteId].saldo += Number(v.saldo) || 0;
    ventasPorLote[v.loteId].pedidos += 1;
  });

  const getVentasLote = (id) =>
    ventasPorLote[id] || {
      cantidad: 0,
      total: 0,
      pagado: 0,
      saldo: 0,
      pedidos: 0
    };

  // 🗂️ Gastos agrupados por loteId
  const gastosPorLote = {};
  gastos.forEach((g) => {
    if (!g.loteId) return;
    if (!gastosPorLote[g.loteId]) {
      gastosPorLote[g.loteId] = { total: 0, cantidad: 0 };
    }
    gastosPorLote[g.loteId].total += Number(g.valor) || 0;
    gastosPorLote[g.loteId].cantidad += 1;
  });

  const getGastosLote = (id) =>
    gastosPorLote[id] || { total: 0, cantidad: 0 };

  // 🍚 LOTE ACTIVO = el seleccionado o el más reciente
  const loteActivo = loteSeleccionadoId
    ? lotes.find((l) => l.id === loteSeleccionadoId) || lotes[0]
    : lotes.length > 0
    ? lotes[0]
    : null;

  const ventasActivo = loteActivo ? getVentasLote(loteActivo.id) : null;
  const gastosActivo = loteActivo
    ? getGastosLote(loteActivo.id)
    : { total: 0, cantidad: 0 };

  // 💵 Base del lote activo
  const baseActivo = Number(loteActivo?.base) || 0;

  // 🥛 Costos del lote activo
  const costoActivo = Number(loteActivo?.costoTotal) || 0;

  // 📊 Total con gastos = Cobrado + Base − Gastos
  const totalConGastosActivo =
    (ventasActivo?.pagado || 0) + baseActivo - (gastosActivo?.total || 0);

  // 📈 Ganancia aproximada del lote activo = Producidos × Valor unitario
  const gananciaAproximadaActivo =
    (Number(loteActivo?.cantidadProducida) || 0) *
    (Number(loteActivo?.valorUnitario) || 0);

  // 🔴 Clientes que deben en este lote
  const clientesDeudoresActivo = loteActivo
    ? Object.values(
        ventas
          .filter((v) => v.loteId === loteActivo.id && (v.saldo || 0) > 0)
          .reduce((acc, v) => {
            const key = v.clienteId || v.clienteNombre;
            if (!acc[key]) {
              acc[key] = {
                nombre: v.clienteNombre,
                saldo: 0
              };
            }
            acc[key].saldo += Number(v.saldo) || 0;
            return acc;
          }, {})
      )
    : [];

  const cantidadDeudores = clientesDeudoresActivo.length;

  // 💰 TOTALES HISTÓRICOS
  const totalCostos = lotes.reduce((s, l) => s + (l.costoTotal || 0), 0);

  const totalVentas = ventas.reduce((s, v) => s + (v.pagado || 0), 0);
  const totalPagado = ventas.reduce((s, v) => s + (v.pagado || 0), 0);
  const totalPorCobrar = ventas.reduce((s, v) => s + (v.saldo || 0), 0);

  const totalBase = lotes.reduce((s, l) => s + (Number(l.base) || 0), 0);
  const totalGastos = gastos.reduce((s, g) => s + (Number(g.valor) || 0), 0);

  const lotesConVentas = lotes.filter((l) => {
    const v = getVentasLote(l.id);
    return v.pedidos > 0;
  });
  const costosLotesConVentas = lotesConVentas.reduce(
    (s, l) => s + (l.costoTotal || 0),
    0
  );
  const gananciaNeta = totalPagado - costosLotesConVentas;

  const totalConGastosNegocio = totalPagado + totalBase - totalGastos;

  // 📈 GANANCIA APROXIMADA = Valor total de la producción
  const gananciaAproximada = lotes.reduce((suma, l) => {
    const producidos = Number(l.cantidadProducida) || 0;
    const valorUnitario = Number(l.valorUnitario) || 0;
    return suma + producidos * valorUnitario;
  }, 0);

  // 🏆 Top clientes
  const topClientes = Object.values(
    ventas.reduce((acc, v) => {
      const key = v.clienteId || v.clienteNombre;
      if (!acc[key]) {
        acc[key] = {
          nombre: v.clienteNombre,
          telefono: v.clienteTelefono,
          total: 0,
          pagado: 0,
          saldo: 0,
          pedidos: 0,
          unidades: 0
        };
      }
      acc[key].total += v.total || 0;
      acc[key].pagado += v.pagado || 0;
      acc[key].saldo += v.saldo || 0;
      acc[key].pedidos += 1;
      acc[key].unidades += Number(v.cantidad) || 0;
      return acc;
    }, {})
  )
    .sort((a, b) => b.pagado - a.pagado)
    .slice(0, 5);

  // 🏆 Top lotes rentables (por total con gastos)
  const topLotes = lotes
    .map((l) => {
      const v = getVentasLote(l.id);
      const g = getGastosLote(l.id);
      const base = Number(l.base) || 0;
      const costo = Number(l.costoTotal) || 0;
      const totalConGastos = v.pagado + base - g.total;

      return {
        ...l,
        ventasCantidad: v.cantidad,
        ventasTotal: v.total,
        ventasPagado: v.pagado,
        base,
        gastosTotal: g.total,
        costoTotal: costo,
        totalConGastos,
        ganancia: v.total - costo
      };
    })
    .sort((a, b) => b.totalConGastos - a.totalConGastos)
    .slice(0, 5);

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

  // 📊 Progreso del lote activo
  const progresoVentas = loteActivo
    ? Math.min(
        100,
        Math.round(
          ((ventasActivo?.cantidad || 0) / (loteActivo.cantidadProducida || 1)) *
            100
        )
      )
    : 0;

  return (
    <div className="dashboard-layout">
      <div className="dashboard-main">
        <TopBar
          usuario={usuario}
          titulo="Panel de control"
          onAbrirSidebar={onAbrirSidebar}
        />

        <div className="dashboard-content">
          {/* Bienvenida */}
          <div className="welcome-banner">
            <div>
              <h1>¡Hola de nuevo! 💛</h1>
              <p>Este es el resumen de M&S Dulce Arroz con Love</p>
            </div>
            <span className="welcome-emoji">🍚</span>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {/* 🍚 LOTE ACTIVO */}
          {cargando ? (
            <div className="dashboard-panel">
              <p className="panel-vacio">Cargando... 🍚</p>
            </div>
          ) : !loteActivo ? (
            <div className="dashboard-panel">
              <h3 className="panel-title">🍚 Lote activo</h3>
              <p className="panel-vacio">
                Aún no tienes lotes registrados.
                <br />
                <small>Crea el primero en el módulo Lotes.</small>
              </p>
            </div>
          ) : (
            <div className="lote-activo-panel">
              <div className="lote-activo-header">
                <div>
                  <span className="lote-activo-badge">🍚 LOTE ACTIVO</span>

                  {/* 🎛️ SELECTOR DE LOTE */}
                  <div className="lote-selector">
                    <select
                      value={loteSeleccionadoId || loteActivo.id}
                      onChange={(e) => setLoteSeleccionadoId(e.target.value)}
                    >
                      {lotes.map((l) => (
                        <option key={l.id} value={l.id}>
                          🍚 {l.nombre} · {formatearFecha(l.fecha)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <p>
                    {formatearFecha(loteActivo.fecha)} ·{' '}
                    {loteActivo.presentacion || 'Sin presentación'}
                  </p>
                </div>
                <div className="lote-activo-ganancia">
                  <span>📊 Total con gastos</span>
                  <strong
                    style={{
                      color: totalConGastosActivo >= 0 ? '#2A9D8F' : '#F26B7A'
                    }}
                  >
                    ${totalConGastosActivo.toLocaleString('es-CO')}
                  </strong>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="lote-activo-progreso">
                <div className="progreso-header">
                  <span>
                    ✅ Vendidos: <strong>{ventasActivo?.cantidad || 0}</strong>{' '}
                    de <strong>{loteActivo.cantidadProducida}</strong>
                  </span>
                  <strong>{progresoVentas}%</strong>
                </div>
                <div className="progreso-track">
                  <div
                    className="progreso-fill"
                    style={{
                      width: `${progresoVentas}%`,
                      background:
                        progresoVentas >= 100
                          ? 'linear-gradient(90deg, #2A9D8F, #3DC5B8)'
                          : 'linear-gradient(90deg, #FFD93D, #F26B7A)'
                    }}
                  />
                </div>
              </div>

              {/* Grid de stats del lote */}
              <div className="lote-activo-grid">
                <div className="lote-stat">
                  <span className="lote-stat-label">🍚 Producidos</span>
                  <strong className="lote-stat-valor">
                    {loteActivo.cantidadProducida}
                  </strong>
                </div>
                <div className="lote-stat">
                  <span className="lote-stat-label">✅ Vendidos</span>
                  <strong
                    className="lote-stat-valor"
                    style={{ color: '#2A9D8F' }}
                  >
                    {ventasActivo?.cantidad || 0}
                  </strong>
                </div>
                <div className="lote-stat">
                  <span className="lote-stat-label">➖ Pérdidas</span>
                  <strong
                    className="lote-stat-valor"
                    style={{ color: '#F26B7A' }}
                  >
                    {loteActivo.perdidas || 0}
                  </strong>
                </div>
                <div className="lote-stat">
                  <span className="lote-stat-label">🧊 Disponibles</span>
                  <strong
                    className="lote-stat-valor"
                    style={{ color: '#9C7A00' }}
                  >
                    {Math.max(
                      0,
                      (loteActivo.cantidadProducida || 0) -
                        (ventasActivo?.cantidad || 0) -
                        (loteActivo.perdidas || 0)
                    )}
                  </strong>
                </div>

                <div className="lote-stat lote-stat-money">
                  <span className="lote-stat-label">✅ Cobrado</span>
                  <strong
                    className="lote-stat-valor"
                    style={{ color: '#2A9D8F' }}
                  >
                    ${(ventasActivo?.pagado || 0).toLocaleString('es-CO')}
                  </strong>
                </div>
                <div className="lote-stat lote-stat-money">
                  <span className="lote-stat-label">💵 Base</span>
                  <strong
                    className="lote-stat-valor"
                    style={{ color: '#3DC5B8' }}
                  >
                    ${baseActivo.toLocaleString('es-CO')}
                  </strong>
                </div>
                <div className="lote-stat lote-stat-money">
                  <span className="lote-stat-label">🗂️ Gastos</span>
                  <strong
                    className="lote-stat-valor"
                    style={{ color: '#F26B7A' }}
                  >
                    ${(gastosActivo?.total || 0).toLocaleString('es-CO')}
                  </strong>
                </div>
                <div className="lote-stat lote-stat-money">
                  <span className="lote-stat-label">🥛 Costos</span>
                  <strong
                    className="lote-stat-valor"
                    style={{ color: '#F26B7A' }}
                  >
                    ${costoActivo.toLocaleString('es-CO')}
                  </strong>
                </div>

                {/* 🔴 Debe */}
                <div className="lote-stat lote-stat-debe">
                  <span className="lote-stat-label">🔴 Debe</span>
                  <strong
                    className="lote-stat-valor"
                    style={{
                      color:
                        (ventasActivo?.saldo || 0) > 0 ? '#F26B7A' : '#8B7A66',
                      fontSize: (ventasActivo?.saldo || 0) > 0 ? '20px' : '15px'
                    }}
                  >
                    ${(ventasActivo?.saldo || 0).toLocaleString('es-CO')}
                  </strong>
                  {cantidadDeudores > 0 && (
                    <small
                      style={{
                        fontSize: 10,
                        color: '#8B7A66',
                        marginTop: 2,
                        display: 'block',
                        lineHeight: 1.4
                      }}
                    >
                      👤 {cantidadDeudores}{' '}
                      {cantidadDeudores === 1
                        ? 'cliente debe'
                        : 'clientes deben'}
                      :
                      <br />
                      <strong style={{ color: '#C7394A' }}>
                        {clientesDeudoresActivo
                          .slice(0, 2)
                          .map((c) => c.nombre)
                          .join(', ')}
                        {cantidadDeudores > 2 &&
                          ` +${cantidadDeudores - 2} más`}
                      </strong>
                    </small>
                  )}
                </div>

                <div className="lote-stat lote-stat-money">
                  <span className="lote-stat-label">
                    📈 Ganancia aproximada
                  </span>
                  <strong
                    className="lote-stat-valor"
                    style={{ color: '#2A9D8F' }}
                  >
                    ${gananciaAproximadaActivo.toLocaleString('es-CO')}
                  </strong>
                  <small
                    style={{
                      fontSize: 10,
                      color: '#8B7A66',
                      marginTop: 2
                    }}
                  >
                    {loteActivo.cantidadProducida} × $
                    {Number(loteActivo.valorUnitario || 0).toLocaleString(
                      'es-CO'
                    )}
                  </small>
                </div>

                <div className="lote-stat lote-stat-destacado">
                  <span className="lote-stat-label">
                    📊 Total con gastos
                  </span>
                  <strong
                    className="lote-stat-valor"
                    style={{
                      color:
                        totalConGastosActivo >= 0 ? '#2A9D8F' : '#F26B7A'
                    }}
                  >
                    ${totalConGastosActivo.toLocaleString('es-CO')}
                  </strong>
                  <small>Cobrado + Base − Gastos</small>
                </div>
              </div>
            </div>
          )}

          {/* 📊 RESUMEN GENERAL */}
          <div className="resumen-general-panel">
            <div className="resumen-general-header">
              <div>
                <span className="resumen-general-badge">
                  📊 RESUMEN GENERAL
                </span>
                <h2>Acumulado histórico</h2>
                <p>De todos tus lotes, ventas y gastos</p>
              </div>
            </div>

            <div className="stats-grid stats-grid-3">
              <StatCard
                icon="🍚"
                label="Total lotes"
                valor={lotes.length}
                color="chocolate"
              />
              <StatCard
                icon="🥛"
                label="Costos ingredientes"
                valor={`$${totalCostos.toLocaleString('es-CO')}`}
                color="chocolate"
              />
              <StatCard
                icon="🗂️"
                label="Gastos externos"
                valor={`$${totalGastos.toLocaleString('es-CO')}`}
                color="coral"
              />
            </div>

            <div className="stats-grid stats-grid-3">
              <StatCard
                icon="✅"
                label="Ventas cobradas"
                valor={`$${totalVentas.toLocaleString('es-CO')}`}
                color="turquesa"
              />
              <StatCard
                icon="💵"
                label="Base total"
                valor={`$${totalBase.toLocaleString('es-CO')}`}
                color="turquesa"
              />
              <StatCard
                icon="⏳"
                label="Por cobrar"
                valor={`$${totalPorCobrar.toLocaleString('es-CO')}`}
                color="amarillo"
              />
            </div>

            <div className="stats-grid">
              <StatCard
                icon="📈"
                label="Ganancia aproximada (producidos × precio)"
                valor={`$${gananciaAproximada.toLocaleString('es-CO')}`}
                color="turquesa"
              />
            </div>

            <div className="dashboard-total-simple">
              <div className="dashboard-total-card dashboard-total-naranja">
                <div className="dashboard-total-info">
                  <span className="dashboard-total-label">
                    📊 Total con gastos
                  </span>
                  <small>Cobrado + Base − Gastos</small>
                </div>
                <strong
                  className="dashboard-total-valor"
                  style={{
                    color:
                      totalConGastosNegocio >= 0 ? '#2A9D8F' : '#F26B7A'
                  }}
                >
                  ${totalConGastosNegocio.toLocaleString('es-CO')}
                </strong>
              </div>
            </div>
          </div>

          {/* 🏆 TOP LOTES + 👥 TOP CLIENTES */}
          <div className="dashboard-grid-2">
            <div className="dashboard-panel">
              <h3 className="panel-title">💰 Lotes más rentables</h3>
              {topLotes.length === 0 ? (
                <p className="panel-vacio">Aún no hay lotes registrados.</p>
              ) : (
                <div className="tabla-ranking">
                  {topLotes.map((l, i) => (
                    <div key={l.id} className="ranking-item">
                      <div
                        className={`ranking-pos ${
                          i < 3 ? `pos-${i + 1}` : ''
                        }`}
                      >
                        #{i + 1}
                      </div>
                      <div className="ranking-info">
                        <strong>{l.nombre}</strong>
                        <small>
                          {l.cantidadProducida} producidos ·{' '}
                          {l.ventasCantidad} vendidos ·{' '}
                          {formatearFecha(l.fecha)}
                        </small>
                      </div>
                      <div className="ranking-montos">
                        <strong
                          style={{
                            color:
                              l.totalConGastos >= 0 ? '#2A9D8F' : '#F26B7A'
                          }}
                        >
                          ${l.totalConGastos.toLocaleString('es-CO')}
                        </strong>
                        <small style={{ color: '#8B7A66' }}>
                          cobrado $
                          {(l.ventasPagado || 0).toLocaleString('es-CO')}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard-panel">
              <h3 className="panel-title">🏆 Top clientes</h3>
              {topClientes.length === 0 ? (
                <p className="panel-vacio">Aún no hay ventas registradas.</p>
              ) : (
                <div className="top-clientes">
                  {topClientes.map((c, i) => (
                    <div key={i} className="top-cliente-item">
                      <div className="top-cliente-rank">#{i + 1}</div>
                      <div className="top-cliente-info">
                        <strong>{c.nombre}</strong>
                        <small>
                          {c.pedidos} pedido{c.pedidos !== 1 ? 's' : ''} ·{' '}
                          <strong style={{ color: '#2A9D8F' }}>
                            {c.unidades}
                          </strong>{' '}
                          unidades vendidas
                        </small>
                      </div>
                      <div className="top-cliente-monto">
                        <strong style={{ color: '#2A9D8F' }}>
                          ${c.pagado.toLocaleString('es-CO')}
                        </strong>
                        {c.saldo > 0 && (
                          <small style={{ color: '#F26B7A' }}>
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

export default Dashboard;