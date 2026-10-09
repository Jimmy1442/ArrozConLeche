import { useState } from 'react';
import { cargarNegocio, aISO } from '../services/contextoNegocio';
import { redactarCobro } from '../services/ia';
import '../styles/Asistente.css';

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const num = (v) => Number(v) || 0;

// Teléfono → formato internacional para wa.me (Colombia por defecto)
const telWhatsApp = (tel) => {
  const d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10 && d.startsWith('3')) return '57' + d;
  return d;
};

const diasDesde = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return Math.max(0, Math.floor((Date.now() - new Date(y, m - 1, d).getTime()) / 86400000));
};

const fechaCorta = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

function CobranzaIA() {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [deudores, setDeudores] = useState(null);
  const [mensajes, setMensajes] = useState({}); // { clave: { texto, tono, generando, error, copiado } }
  const [error, setError] = useState('');

  const abrir = async () => {
    const nuevo = !abierto;
    setAbierto(nuevo);
    if (!nuevo) return;

    setCargando(true);
    setError('');
    try {
      const { ventas, clientes } = await cargarNegocio(true);
      const porCliente = {};

      ventas.forEach((v) => {
        const pagado = num(v.pagado ?? v.abono);
        const saldo = v.saldo !== undefined ? num(v.saldo) : num(v.total) - pagado;
        if (saldo <= 0) return;

        const clave = v.clienteId || v.clienteNombre;
        const cli = clientes.find((c) => c.id === v.clienteId);
        const d = (porCliente[clave] ||= {
          clave,
          nombre: v.clienteNombre || cli?.nombre || 'Cliente',
          telefono: cli?.telefono || v.clienteTelefono || '',
          saldoTotal: 0,
          ventas: []
        });
        d.saldoTotal += saldo;
        d.ventas.push({
          fecha: aISO(v.fecha),
          cantidad: num(v.cantidad),
          total: num(v.total),
          pagado,
          saldo
        });
      });

      const lista = Object.values(porCliente).map((d) => {
        d.ventas.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
        d.diasMasAntigua = diasDesde(d.ventas[0]?.fecha);
        return d;
      });
      lista.sort((a, b) => b.saldoTotal - a.saldoTotal);
      setDeudores(lista);
    } catch (e) {
      setError('No pude cargar los datos: ' + e.message);
    } finally {
      setCargando(false);
    }
  };

  const actualizar = (clave, cambios) =>
    setMensajes((prev) => ({ ...prev, [clave]: { ...prev[clave], ...cambios } }));

  const generar = async (d, tono) => {
    actualizar(d.clave, { generando: true, error: '', tono, copiado: false });
    try {
      const { mensaje } = await redactarCobro({
        nombre: d.nombre,
        saldoTotal: d.saldoTotal,
        ventas: d.ventas.map((v) => ({
          fecha: fechaCorta(v.fecha),
          unidades: v.cantidad,
          total: v.total,
          yaPagado: v.pagado,
          pendiente: v.saldo
        })),
        tono
      });
      actualizar(d.clave, { texto: mensaje, generando: false });
    } catch (e) {
      actualizar(d.clave, { generando: false, error: e.message });
    }
  };

  const copiar = async (clave, texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      actualizar(clave, { copiado: true });
      setTimeout(() => actualizar(clave, { copiado: false }), 2000);
    } catch {
      /* sin permiso de portapapeles: el usuario puede copiar manualmente */
    }
  };

  const totalDeuda = (deudores || []).reduce((s, d) => s + d.saldoTotal, 0);

  return (
    <div className="cobranza">
      <button type="button" className="cobranza-toggle" onClick={abrir}>
        {abierto ? '▾' : '▸'} 💬 Cobrar a quienes me deben (IA)
      </button>

      {abierto && (
        <div className="cobranza-cuerpo">
          {cargando && <p className="cobranza-info">Buscando quién tiene saldo pendiente…</p>}
          {error && <div className="venta-ia-aviso">⚠️ {error}</div>}

          {deudores && deudores.length === 0 && (
            <p className="cobranza-info">🎉 Nadie te debe nada ahora mismo.</p>
          )}

          {deudores && deudores.length > 0 && (
            <>
              <p className="cobranza-info">
                {deudores.length} cliente{deudores.length > 1 ? 's' : ''} con saldo ·{' '}
                <strong>{fmt(totalDeuda)}</strong> por cobrar
              </p>

              {deudores.map((d) => {
                const m = mensajes[d.clave] || {};
                const tel = telWhatsApp(d.telefono);
                return (
                  <div key={d.clave} className="cobranza-card">
                    <div className="cobranza-top">
                      <div>
                        <strong>{d.nombre}</strong>
                        <small>
                          {d.ventas.length} venta{d.ventas.length > 1 ? 's' : ''}
                          {d.diasMasAntigua != null && ` · la más antigua hace ${d.diasMasAntigua} día${d.diasMasAntigua === 1 ? '' : 's'}`}
                        </small>
                      </div>
                      <span className="cobranza-monto">{fmt(d.saldoTotal)}</span>
                    </div>

                    <div className="cobranza-acciones">
                      <button disabled={m.generando} onClick={() => generar(d, 'amable')}>
                        {m.generando && m.tono === 'amable' ? 'Escribiendo…' : '😊 Mensaje amable'}
                      </button>
                      <button disabled={m.generando} onClick={() => generar(d, 'firme')}>
                        {m.generando && m.tono === 'firme' ? 'Escribiendo…' : '📌 Mensaje firme'}
                      </button>
                    </div>

                    {m.error && <div className="venta-ia-aviso">⚠️ {m.error}</div>}

                    {m.texto !== undefined && !m.generando && (
                      <>
                        <textarea
                          className="cobranza-texto"
                          value={m.texto}
                          onChange={(e) => actualizar(d.clave, { texto: e.target.value })}
                        />
                        <div className="cobranza-acciones">
                          {tel ? (
                            <a
                              className="cobranza-wa"
                              href={`https://wa.me/${tel}?text=${encodeURIComponent(m.texto)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              📲 Abrir WhatsApp
                            </a>
                          ) : (
                            <span className="cobranza-info">Este cliente no tiene teléfono guardado.</span>
                          )}
                          <button onClick={() => copiar(d.clave, m.texto)}>
                            {m.copiado ? '✅ Copiado' : '📋 Copiar'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default CobranzaIA;
