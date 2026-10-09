import { useState, useRef, useEffect } from 'react';
import { obtenerContexto } from '../services/contextoNegocio';
import { preguntarAlNegocio } from '../services/ia';
import '../styles/Asistente.css';

const SUGERENCIAS = [
  '¿Cuánto he vendido este mes?',
  '¿Quién me debe plata?',
  '¿Qué lote me ha dejado más ganancia?',
  '¿Cuántas entregas tengo pendientes?'
];

const SALUDO = {
  rol: 'ia',
  texto: '¡Hola! 🍚 Pregúntame lo que quieras sobre tus ventas, lotes, gastos o clientes.'
};

function AsistenteIA() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([SALUDO]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, pensando, abierto]);

  const enviar = async (pregunta) => {
    const p = (pregunta ?? texto).trim();
    if (!p || pensando) return;

    const historial = mensajes.filter((m) => m !== SALUDO);
    setMensajes((prev) => [...prev, { rol: 'user', texto: p }]);
    setTexto('');
    setPensando(true);

    try {
      const contexto = await obtenerContexto();
      const { respuesta } = await preguntarAlNegocio(p, historial, contexto);
      setMensajes((prev) => [...prev, { rol: 'ia', texto: respuesta || 'No pude responder eso.' }]);
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        { rol: 'ia', texto: `⚠️ ${err.message}`, error: true }
      ]);
    } finally {
      setPensando(false);
    }
  };

  return (
    <>
      {!abierto && (
        <button
          className="asistente-fab"
          onClick={() => setAbierto(true)}
          aria-label="Abrir asistente"
        >
          ✨
        </button>
      )}

      {abierto && (
        <div className="asistente-panel" role="dialog" aria-label="Asistente del negocio">
          <div className="asistente-header">
            <span>✨ Asistente</span>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar">
              ✕
            </button>
          </div>

          <div className="asistente-mensajes">
            {mensajes.map((m, i) => (
              <div
                key={i}
                className={`asistente-msg ${m.rol === 'user' ? 'user' : 'ia'} ${m.error ? 'error' : ''}`}
              >
                {m.texto}
              </div>
            ))}

            {mensajes.length === 1 && (
              <div className="asistente-sugerencias">
                {SUGERENCIAS.map((s) => (
                  <button key={s} onClick={() => enviar(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {pensando && <div className="asistente-msg ia pensando">Pensando…</div>}
            <div ref={finRef} />
          </div>

          <form
            className="asistente-input"
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
          >
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe tu pregunta…"
              maxLength={500}
            />
            <button type="submit" disabled={pensando || !texto.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default AsistenteIA;
