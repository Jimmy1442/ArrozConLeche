import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Convierte Timestamp / string / Date a 'YYYY-MM-DD' (hora local)
export const aISO = (f) => {
  if (!f) return null;
  if (typeof f === 'string') return f.slice(0, 10);
  const d = f.toDate ? f.toDate() : f instanceof Date ? f : new Date(f);
  if (isNaN(d)) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const num = (v) => Number(v) || 0;

export const hoyISO = () => aISO(new Date());

// Cache corto para no gastar lecturas del plan gratuito de Firestore en cada pregunta
let cache = { t: 0, datos: null };
const TTL = 60_000;

export async function cargarNegocio(forzar = false) {
  if (!forzar && cache.datos && Date.now() - cache.t < TTL) return cache.datos;

  const leer = async (nombre) => {
    const snap = await getDocs(collection(db, nombre));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const [ventas, lotes, gastos, clientes] = await Promise.all([
    leer('ventas'),
    leer('lotes'),
    leer('gastos'),
    leer('clientes')
  ]);

  cache = { t: Date.now(), datos: { ventas, lotes, gastos, clientes } };
  return cache.datos;
}

// Resume todo en un objeto compacto con los totales YA calculados
export function construirContexto({ ventas, lotes, gastos, clientes }) {
  const pagadoDe = (v) => num(v.pagado ?? v.abono);
  const saldoDe = (v) => (v.saldo !== undefined ? num(v.saldo) : num(v.total) - pagadoDe(v));

  // ── Por lote
  const porLote = lotes.map((l) => {
    const vs = ventas.filter((v) => v.loteId === l.id);
    const gs = gastos.filter((g) => g.loteId === l.id);
    const ingresos = vs.reduce((s, v) => s + num(v.total), 0);
    const cobrado = vs.reduce((s, v) => s + pagadoDe(v), 0);
    const gastosLote = gs.reduce((s, g) => s + num(g.valor), 0);
    const costo = num(l.costoTotal);
    return {
      nombre: l.nombre,
      fecha: aISO(l.fecha),
      producidas: num(l.cantidadProducida),
      perdidas: num(l.perdidas),
      precioVentaUnitario: num(l.valorUnitario),
      costoLote: costo,
      // Detalle de ingredientes (costo = cantidad × precio por unidad)
      ingredientes: (l.ingredientes || []).map((i) => ({
        nombre: i.nombre,
        cantidad: num(i.cantidad),
        unidad: i.unidad,
        precioPorUnidad: num(i.valorUnitario),
        costo: num(i.cantidad) * num(i.valorUnitario)
      })),
      unidadesVendidas: vs.reduce((s, v) => s + num(v.cantidad), 0),
      // producidas − pérdidas − vendidas (lo que aún queda por vender)
      unidadesDisponibles:
        num(l.cantidadProducida) - num(l.perdidas) - vs.reduce((s, v) => s + num(v.cantidad), 0),
      baseAporteExtra: num(l.base),
      ingresosVentas: ingresos,
      cobrado,
      porCobrar: ingresos - cobrado,
      gastosAdicionales: gastosLote,
      // OJO: mientras el lote tenga unidades sin vender, esta cifra puede salir negativa
      // porque el costo es del lote completo, no solo de lo vendido.
      gananciaSobreVentas: ingresos - costo - gastosLote,
      // Si se vendiera todo lo que quedó (producidas − pérdidas) al precio del lote
      gananciaEstimadaSiVendeTodo:
        Math.max(num(l.cantidadProducida) - num(l.perdidas), 0) * num(l.valorUnitario) -
        costo -
        gastosLote
    };
  });

  // ── Por mes
  const porMes = {};
  const mes = (iso) => (iso ? iso.slice(0, 7) : 'sin-fecha');
  ventas.forEach((v) => {
    const m = (porMes[mes(aISO(v.fecha))] ||= { ventas: 0, cobrado: 0, unidades: 0, gastos: 0 });
    m.ventas += num(v.total);
    m.cobrado += pagadoDe(v);
    m.unidades += num(v.cantidad);
  });
  gastos.forEach((g) => {
    const m = (porMes[mes(aISO(g.fecha))] ||= { ventas: 0, cobrado: 0, unidades: 0, gastos: 0 });
    m.gastos += num(g.valor);
  });

  // ── Por cliente
  const porCliente = {};
  ventas.forEach((v) => {
    const k = v.clienteId || v.clienteNombre;
    const c = (porCliente[k] ||= {
      nombre: v.clienteNombre,
      telefono: v.clienteTelefono || '',
      compras: 0,
      totalComprado: 0,
      saldo: 0,
      ultimaCompra: null
    });
    c.compras += 1;
    c.totalComprado += num(v.total);
    c.saldo += Math.max(saldoDe(v), 0);
    const f = aISO(v.fecha);
    if (f && (!c.ultimaCompra || f > c.ultimaCompra)) c.ultimaCompra = f;
  });
  const listaClientes = Object.values(porCliente);

  // ── Gastos por concepto
  const gastosPorConcepto = {};
  gastos.forEach((g) => {
    gastosPorConcepto[g.concepto || 'Otro'] =
      (gastosPorConcepto[g.concepto || 'Otro'] || 0) + num(g.valor);
  });

  // ── Ranking de ingredientes (suma de todos los lotes, agrupando por nombre)
  const ingMapa = {};
  lotes.forEach((l) => {
    (l.ingredientes || []).forEach((i) => {
      const clave = String(i.nombre || '').trim().toLowerCase();
      if (!clave) return;
      const costo = num(i.cantidad) * num(i.valorUnitario);
      const g = (ingMapa[clave] ||= {
        nombre: String(i.nombre).trim(),
        costoTotal: 0,
        vecesUsado: 0,
        precioPorUnidadMaximo: 0,
        unidadDelPrecio: i.unidad
      });
      g.costoTotal += costo;
      g.vecesUsado += 1;
      if (num(i.valorUnitario) > g.precioPorUnidadMaximo) {
        g.precioPorUnidadMaximo = num(i.valorUnitario);
        g.unidadDelPrecio = i.unidad;
      }
    });
  });
  const costoTodosIngredientes = Object.values(ingMapa).reduce((s, g) => s + g.costoTotal, 0);
  const ingredientesRanking = Object.values(ingMapa)
    .sort((a, b) => b.costoTotal - a.costoTotal)
    .slice(0, 20)
    .map((g) => ({
      ...g,
      porcentajeDelCostoDeIngredientes: costoTodosIngredientes
        ? Math.round((g.costoTotal / costoTodosIngredientes) * 1000) / 10
        : 0
    }));

  const totalVentas = ventas.reduce((s, v) => s + num(v.total), 0);
  const totalCobrado = ventas.reduce((s, v) => s + pagadoDe(v), 0);
  const totalCostosLotes = lotes.reduce((s, l) => s + num(l.costoTotal), 0);
  const totalGastos = gastos.reduce((s, g) => s + num(g.valor), 0);

  const ventasOrdenadas = [...ventas].sort((a, b) =>
    (aISO(b.fecha) || '').localeCompare(aISO(a.fecha) || '')
  );

  // Ventas en formato compacto (ahorra texto): cada fila sigue el orden de ventasColumnas
  const LIMITE_VENTAS = 300;
  const ventasCompactas = ventasOrdenadas.slice(0, LIMITE_VENTAS).map((v) => [
    aISO(v.fecha),
    v.clienteNombre,
    num(v.cantidad),
    num(v.valorUnitario),
    num(v.total),
    pagadoDe(v),
    saldoDe(v),
    v.entrega || 'Pendiente',
    v.loteNombre || null
  ]);

  // Entregas pendientes (todas, con tope de seguridad)
  const entregasPendientes = ventasOrdenadas
    .filter((v) => (v.entrega || 'Pendiente') === 'Pendiente')
    .slice(0, 80)
    .map((v) => ({
      fecha: aISO(v.fecha),
      cliente: v.clienteNombre,
      cantidad: num(v.cantidad),
      lote: v.loteNombre || null,
      saldo: saldoDe(v)
    }));

  // Ventas por día (últimos 45 días con ventas)
  const diaMapa = {};
  ventas.forEach((v) => {
    const f = aISO(v.fecha);
    if (!f) return;
    const d = (diaMapa[f] ||= { ventas: 0, cobrado: 0, unidades: 0, numeroDeVentas: 0 });
    d.ventas += num(v.total);
    d.cobrado += pagadoDe(v);
    d.unidades += num(v.cantidad);
    d.numeroDeVentas += 1;
  });
  const porDia = Object.fromEntries(
    Object.entries(diaMapa)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 45)
  );

  // Todos los clientes registrados (incluso los que no han comprado)
  const todosLosClientes = clientes.slice(0, 200).map((c) => {
    const st = porCliente[c.id];
    return {
      nombre: c.nombre,
      telefono: c.telefono || '',
      compras: st?.compras || 0,
      totalComprado: st?.totalComprado || 0,
      saldoPendiente: st?.saldo || 0,
      ultimaCompra: st?.ultimaCompra || null
    };
  });

  // Gastos individuales (más recientes primero)
  const LIMITE_GASTOS = 200;
  const gastosCompactos = [...gastos]
    .sort((a, b) => (aISO(b.fecha) || '').localeCompare(aISO(a.fecha) || ''))
    .slice(0, LIMITE_GASTOS)
    .map((g) => [aISO(g.fecha), g.loteNombre || null, g.concepto || null, g.descripcion || '', num(g.valor)]);

  return {
    hoy: hoyISO(),
    horaActual: new Date().toLocaleTimeString('es-CO'),
    moneda: 'COP',
    resumenGeneral: {
      totalVentas,
      totalCobrado,
      totalPorCobrar: totalVentas - totalCobrado,
      totalCostosLotes,
      totalGastosAdicionales: totalGastos,
      gananciaSobreVentas: totalVentas - totalCostosLotes - totalGastos,
      cantidadVentas: ventas.length,
      cantidadClientes: clientes.length,
      entregasPendientes: ventas.filter((v) => v.entrega === 'Pendiente').length
    },
    porMes,
    lotes: porLote,
    clientesConDeuda: listaClientes
      .filter((c) => c.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 40),
    topClientes: [...listaClientes].sort((a, b) => b.totalComprado - a.totalComprado).slice(0, 15),
    // Ingredientes de TODOS los lotes, ordenados del que más plata se lleva al que menos
    ingredientesRanking,
    gastosPorConcepto,
    porDia,
    entregasPendientes,
    clientes: todosLosClientes,
    gastosColumnas: ['fecha', 'lote', 'concepto', 'descripcion', 'valor'],
    gastos: gastosCompactos,
    ventasColumnas: ['fecha', 'cliente', 'cantidad', 'valorUnitario', 'total', 'pagado', 'saldo', 'entrega', 'lote'],
    ventas: ventasCompactas,
    // Para saber si algo quedó fuera por el tamaño
    cobertura: {
      ventasIncluidas: ventasCompactas.length,
      ventasTotales: ventas.length,
      gastosIncluidos: gastosCompactos.length,
      gastosTotales: gastos.length
    }
  };
}

export async function obtenerContexto(forzar = false) {
  return construirContexto(await cargarNegocio(forzar));
}
