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

function Dashboard({ usuario, onAbrirSidebar  }) {
  const [ventas, setVentas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

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

    return () => {
      unsubVentas();
      unsubLotes();
      unsubClientes();
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

  // 🍚 LOTE ACTIVO = el más reciente
  const loteActivo = lotes.length > 0 ? lotes[0] : null;
  const ventasActivo = loteActivo ? getVentasLote(loteActivo.id) : null;

  // 💰 TOTALES HISTÓRICOS
  const totalCostos = lotes.reduce((s, l) => s + (l.costoTotal || 0), 0);
  const totalVentas = ventas.reduce((s, v) => s + (v.total || 0), 0);
  const totalPagado = ventas.reduce((s, v) => s + (v.pagado || 0), 0);
  const totalPorCobrar = ventas.reduce((s, v) => s + (v.saldo || 0), 0);
  const gananciaNeta = totalPagado - totalCostos;
  const gananciaAprox = totalVentas - totalCostos;

  // 🏆 Top lotes rentables
  const topLotes = lotes
    .map((l) => {
      const v = getVentasLote(l.id);
      return {
        ...l,
        ventasCantidad: v.cantidad,
        ventasTotal: v.total,
        ventasPagado: v.pagado,
        ganancia: v.total - (l.costoTotal || 0)
      };
    })
    .sort((a, b) => b.ganancia - a.ganancia)
    .slice(0, 5);

  // 🏆 Top clientes
  const topClientes = Object.values(
    ventas.reduce((acc, v) => {
      const key = v.clienteId || v.clienteNombre;
      if (!acc[key]) {
        acc[key] = {
          nombre: v.clienteNombre,
          telefono: v.clienteTelefono,
          pagado: 0,
          saldo: 0,
          pedidos: 0
        };
      }
      acc[key].pagado += v.pagado || 0;
      acc[key].saldo += v.saldo || 0;
      acc[key].pedidos += 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b.pagado - a.pagado)
    .slice(0, 5);

  const formatearFecha = (fecha) => {
    if (!fecha) return '...';
    if (fecha.toDate) return fecha.toDate().toLocaleDateString('es-CO');
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
                  <h2>{loteActivo.nombre}</h2>
                  <p>
                    {formatearFecha(loteActivo.fecha)} ·{' '}
                    {loteActivo.presentacion || 'Sin presentación'}
                  </p>
                </div>
                <div className="lote-activo-ganancia">
                  <span>Ganancia</span>
                  <strong
                    style={{
                      color:
                        (ventasActivo?.total || 0) - (loteActivo.costoTotal || 0) >= 0
                          ? '#2A9D8F'
                          : '#F26B7A'
                    }}
                  >
                    $
                    {(
                      (ventasActivo?.total || 0) - (loteActivo.costoTotal || 0)
                    ).toLocaleString('es-CO')}
                  </strong>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="lote-activo-progreso">
                <div className="progreso-header">
                  <span>
                    ✅ Vendidos: <strong>{ventasActivo?.cantidad || 0}</strong> de{' '}
                    <strong>{loteActivo.cantidadProducida}</strong>
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
                  <span className="lote-stat-label">💰 Ingresos</span>
                  <strong
                    className="lote-stat-valor"
                    style={{ color: '#2A9D8F' }}
                  >
                    ${(ventasActivo?.total || 0).toLocaleString('es-CO')}
                  </strong>
                </div>
                <div className="lote-stat lote-stat-money">
                  <span className="lote-stat-label">🥛 Costos</span>
                  <strong
                    className="lote-stat-valor"
                    style={{ color: '#F26B7A' }}
                  >
                    ${(loteActivo.costoTotal || 0).toLocaleString('es-CO')}
                  </strong>
                </div>
                <div className="lote-stat lote-stat-money">
                  <span className="lote-stat-label">⏳ Por cobrar</span>
                  <strong
                    className="lote-stat-valor"
                    style={{ color: '#9C7A00' }}
                  >
                    ${(ventasActivo?.saldo || 0).toLocaleString('es-CO')}
                  </strong>
                </div>
                <div className="lote-stat lote-stat-money">
                  <span className="lote-stat-label">🛒 Pedidos</span>
                  <strong className="lote-stat-valor">
                    {ventasActivo?.pedidos || 0}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* 📊 RESUMEN GENERAL */}
          <div className="seccion-titulo">
            <h2>📊 Resumen general</h2>
            <p>Acumulado histórico de todos tus lotes y ventas</p>
          </div>

          <div className="stats-grid">
            <StatCard
              icon="🍚"
              label="Total lotes"
              valor={lotes.length}
              color="chocolate"
            />
            <StatCard
              icon="🥛"
              label="Costos totales"
              valor={`$${totalCostos.toLocaleString('es-CO')}`}
              color="chocolate"
            />
            <StatCard
              icon="💰"
              label="Ventas totales"
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
              label="Ganancia neta (cobrado − costos)"
              valor={`$${gananciaNeta.toLocaleString('es-CO')}`}
              color={gananciaNeta >= 0 ? 'turquesa' : 'coral'}
            />
            <StatCard
              icon="📈"
              label="Ganancia aprox. (ventas − costos)"
              valor={`$${gananciaAprox.toLocaleString('es-CO')}`}
              color={gananciaAprox >= 0 ? 'turquesa' : 'coral'}
            />
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
                        className={`ranking-pos ${i < 3 ? `pos-${i + 1}` : ''}`}
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
                            color: l.ganancia >= 0 ? '#2A9D8F' : '#F26B7A'
                          }}
                        >
                          ${l.ganancia.toLocaleString('es-CO')}
                        </strong>
                        <small style={{ color: '#8B7A66' }}>
                          ventas $
                          {(l.ventasTotal || 0).toLocaleString('es-CO')}
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
                          {c.telefono || 'sin teléfono'}
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