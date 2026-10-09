import { useState, useRef } from 'react';
import { interpretarVentaIA } from '../services/ia';
import { hoyISO } from '../services/contextoNegocio';
import '../styles/Asistente.css';

const SpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * Recibe una frase ("le vendí 20 a Doña Marta, abonó 50 mil") y devuelve
 * un borrador a la página de Ventas para que prellene el formulario.
 * NO guarda nada: el usuario siempre confirma.
 */
function VentaPorTexto({ clientes, lotes, onBorrador }) {
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [ok, setOk] = useState('');
  const recRef = useRef(null);

  const interpretar = async () => {
    const t = texto.trim();
    if (!t || cargando) return;
    setCargando(true);
    setAviso('');
    setOk('');

    try {
      const { borrador } = await interpretarVentaIA(
        t,
        clientes.map((c) => ({ id: c.id, nombre: c.nombre })),
        lotes.map((l) => ({ id: l.id, nombre: l.nombre, valorUnitario: l.valorUnitario ?? null })),
        hoyISO()
      );

      const avisos = onBorrador(borrador) || [];
      if (borrador.aviso) avisos.push(borrador.aviso);

      if (avisos.length) setAviso(avisos.join(' · '));
      setOk('✅ Listo, revisa los datos del formulario y presiona guardar.');
      setTexto('');
    } catch (err) {
      setAviso('⚠️ ' + err.message);
    } finally {
      setCargando(false);
    }
  };

  const dictar = () => {
    if (!SpeechRecognition) return;
    if (escuchando) {
      recRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'es-CO';
    rec.interimResults = false;
    rec.onresult = (e) => {
      const dicho = e.results[0][0].transcript;
      setTexto((prev) => (prev ? prev + ' ' : '') + dicho);
    };
    rec.onend = () => setEscuchando(false);
    rec.onerror = () => setEscuchando(false);
    recRef.current = rec;
    setEscuchando(true);
    rec.start();
  };

  return (
    <div className="venta-ia">
      <h4>✨ Registrar con IA</h4>
      <p>Escribe o dicta la venta como la dirías: “Le vendí 20 a Marta, abonó 50 mil”.</p>

      <div className="venta-ia-fila">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Le vendí 20 a Marta, abonó 50 mil…"
          maxLength={500}
        />
        <div className="venta-ia-botones">
          {SpeechRecognition && (
            <button
              type="button"
              className={`venta-ia-mic ${escuchando ? 'escuchando' : ''}`}
              onClick={dictar}
            >
              {escuchando ? '⏹ Parar' : '🎤 Dictar'}
            </button>
          )}
          <button
            type="button"
            className="venta-ia-ok"
            onClick={interpretar}
            disabled={cargando || !texto.trim()}
          >
            {cargando ? 'Leyendo…' : 'Llenar venta'}
          </button>
        </div>
      </div>

      {aviso && <div className="venta-ia-aviso">{aviso}</div>}
      {ok && <div className="venta-ia-ok-msg">{ok}</div>}
    </div>
  );
}

export default VentaPorTexto;
