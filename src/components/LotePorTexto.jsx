import { useState, useRef } from 'react';
import { interpretarLoteIA } from '../services/ia';
import { hoyISO } from '../services/contextoNegocio';
import '../styles/Asistente.css';

const SpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * Recibe una frase con todo el lote ("hice 100 vasos de arroz con leche, 10 libras de arroz a 3500...")
 * y devuelve un borrador a la página de Lotes para prellenar el formulario.
 * NO guarda nada: el usuario siempre revisa y confirma.
 */
function LotePorTexto({ onBorrador }) {
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
      const { borrador } = await interpretarLoteIA(t, hoyISO());
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
      <h4>✨ Registrar lote con IA</h4>
      <p>
        Cuéntame el lote como lo dirías: “Hice 100 vasos de arroz con leche, perdí 3, los vendo a 5.000.
        Usé 10 libras de arroz a 3.500, 20 litros de leche por 80 mil y 2 libras de azúcar a 3.000”.
      </p>

      <div className="venta-ia-fila">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Hice 100 vasos de arroz con leche, usé 10 libras de arroz a 3.500…"
          maxLength={1500}
          style={{ minHeight: 80 }}
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
            {cargando ? 'Leyendo…' : 'Llenar lote'}
          </button>
        </div>
      </div>

      {aviso && <div className="venta-ia-aviso">{aviso}</div>}
      {ok && <div className="venta-ia-ok-msg">{ok}</div>}
    </div>
  );
}

export default LotePorTexto;
