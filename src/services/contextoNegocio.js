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
      unidadesVendidas: vs.reduce((s, v) => s + num(v.cantidad), 0),
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

  const totalVentas = ventas.reduce((s, v) => s + num(v.total), 0);
  const totalCobrado = ventas.reduce((s, v) => s + pagadoDe(v), 0);
  const totalCostosLotes = lotes.reduce((s, l) => s + num(l.costoTotal), 0);
  const totalGastos = gastos.reduce((s, g) => s + num(g.valor), 0);

  const ultimasVentas = [...ventas]
    .sort((a, b) => (aISO(b.fecha) || '').localeCompare(aISO(a.fecha) || ''))
    .slice(0, 40)
    .map((v) => ({
      fecha: aISO(v.fecha),
      cliente: v.clienteNombre,
      cantidad: num(v.cantidad),
      total: num(v.total),
      pagado: pagadoDe(v),
      saldo: saldoDe(v),
      entrega: v.entrega,
      lote: v.loteNombre || null
    }));

  return {
    hoy: hoyISO(),
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
    gastosPorConcepto,
    ultimasVentas
  };
}

export async function obtenerContexto(forzar = false) {
  return construirContexto(await cargarNegocio(forzar));
}
