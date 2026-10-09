// Llamada DIRECTA a la API de Google Gemini desde el navegador (uso personal, plan GRATIS).
// La clave va en tu archivo .env como VITE_GEMINI_API_KEY (se crea gratis en https://aistudio.google.com/apikey).
// ⚠️ Esa clave queda dentro del JavaScript de la app: úsala local o no publiques la app (ver GUIA_IA.md).

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Modelo con plan gratuito. Si quieres respuestas más precisas, prueba 'gemini-3.5-flash'.
const MODELO = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash-lite';

async function llamarGemini({ system, contents, generationConfig = {} }) {
  if (!API_KEY) throw new Error('Falta VITE_GEMINI_API_KEY en tu archivo .env');

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig
      })
    }
  );

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 429) {
      throw new Error('Llegaste al límite gratuito por ahora. Espera un minuto e intenta de nuevo.');
    }
    throw new Error(data?.error?.message || 'Error al consultar la IA');
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  const texto = parts.map((p) => p.text || '').join('');
  if (!texto) throw new Error('La IA no devolvió respuesta, intenta reformular.');
  return texto;
}

/* ───────── Punto 1: preguntas sobre el negocio ───────── */
export async function preguntarAlNegocio(pregunta, historial = [], contexto) {
  const system = `Eres el asistente del dueño de un pequeño negocio colombiano que produce y vende arroz/comida por lotes.
Respondes en español, claro, breve y amable, usando SOLO los datos del bloque <datos>.
Reglas:
- Los montos están en pesos colombianos (COP); formatéalos como $1.250.000.
- Los totales ya vienen calculados en <datos>: úsalos tal cual, no los recalcules a menos que debas combinarlos.
- Si la respuesta no está en los datos, dilo con honestidad; no inventes cifras.
- Si piden "ganancia", explica brevemente cómo la calculaste (ventas − costo del lote − gastos). Si un lote aún tiene unidades sin vender, su gananciaSobreVentas puede salir negativa solo porque falta vender: menciónalo y da también gananciaEstimadaSiVendeTodo, sin alarmar al dueño.
- Usa listas cortas cuando enumeres clientes o lotes. No uses tablas.

<datos>
${JSON.stringify(contexto)}
</datos>`;

  const contents = [
    ...historial.slice(-8).map((m) => ({
      role: m.rol === 'ia' ? 'model' : 'user',
      parts: [{ text: String(m.texto || '').slice(0, 2000) }]
    })),
    { role: 'user', parts: [{ text: String(pregunta).slice(0, 1000) }] }
  ];

  const respuesta = await llamarGemini({
    system,
    contents,
    generationConfig: { maxOutputTokens: 2048 }
  });
  return { respuesta };
}

/* ───────── Punto 2: texto libre → borrador de venta ───────── */
export async function interpretarVentaIA(texto, clientes = [], lotes = [], hoy) {
  const system = `Conviertes frases dichas por el dueño de un negocio en un borrador de venta.
Hoy es ${hoy}.
Clientes registrados: ${JSON.stringify(clientes)}
Lotes disponibles: ${JSON.stringify(lotes)}

Reglas:
- clienteId: escoge el cliente registrado cuyo nombre mejor coincida (tolera apodos, tildes y errores de dictado como "Doña Marta" ≈ "Marta Gómez"). Si hay duda real entre varios, pon null y explícalo en "aviso".
- Si el cliente mencionado no existe, clienteId = null y pon su nombre en clienteNombreMencionado.
- cantidad: número de unidades vendidas.
- valorUnitario: SOLO si lo dicen (ej. "a 5 mil c/u" = 5000, "a 5.000"). Si no lo dicen, null (la app usará el precio del lote).
- abono: lo que el cliente pagó. Entiende "50 mil" = 50000, "medio millón" = 500000. Si dicen que pagó todo, pagoCompleto = true.
- entrega: "Entregado" solo si dicen que ya se entregó; si no, "Pendiente".
- loteId: solo si mencionan un lote que coincida; si no, null.
- Nunca inventes datos que no estén en la frase.`;

  const salida = await llamarGemini({
    system,
    contents: [{ role: 'user', parts: [{ text: String(texto).slice(0, 600) }] }],
    generationConfig: {
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          clienteId: { type: 'STRING', nullable: true },
          clienteNombreMencionado: { type: 'STRING', nullable: true },
          cantidad: { type: 'NUMBER', nullable: true },
          valorUnitario: { type: 'NUMBER', nullable: true },
          abono: { type: 'NUMBER', nullable: true },
          pagoCompleto: { type: 'BOOLEAN' },
          entrega: { type: 'STRING', enum: ['Pendiente', 'Entregado'] },
          loteId: { type: 'STRING', nullable: true },
          aviso: { type: 'STRING', nullable: true }
        },
        required: ['entrega']
      }
    }
  });

  let b;
  try {
    b = JSON.parse(salida);
  } catch {
    throw new Error('No pude interpretar la venta, intenta con otra frase.');
  }

  // Seguridad: los IDs deben existir de verdad
  if (b.clienteId && !clientes.some((c) => c.id === b.clienteId)) b.clienteId = null;
  if (b.loteId && !lotes.some((l) => l.id === b.loteId)) b.loteId = null;
  return { borrador: b };
}

/* ───────── Punto 3: mensaje de cobro por WhatsApp ───────── */
// Solo se envía a la IA la información de UN cliente (nombre + sus ventas con saldo).
export async function redactarCobro({ nombre, saldoTotal, ventas, tono = 'amable' }) {
  const estilo =
    tono === 'firme'
      ? 'Firme pero siempre respetuoso: deja claro que el pago está pendiente hace tiempo y pide una fecha concreta de pago. Sin amenazas ni presiones.'
      : 'Muy amable y cercano, como un recordatorio entre conocidos, sin hacer sentir mal al cliente.';

  const system = `Redactas mensajes cortos de WhatsApp para que el dueño de un pequeño negocio colombiano (arroz/comida) cobre a un cliente.
Reglas:
- Español colombiano natural, 3 a 5 líneas máximo, con 1 o 2 emojis como máximo.
- Saluda por el primer nombre del cliente.
- Menciona el valor total pendiente con formato $1.250.000 y, de forma breve, a qué corresponde (cantidad y fecha).
- Pregunta cuándo podría realizar el pago o ponerse al día.
- Tono: ${estilo}
- NO inventes números de cuenta, links de pago, fechas ni datos que no estén abajo.
- NO firmes con nombre propio ni incluyas explicaciones: responde SOLO con el texto del mensaje.`;

  const datos = JSON.stringify({ cliente: nombre, saldoTotal, ventas });
  const mensaje = await llamarGemini({
    system,
    contents: [{ role: 'user', parts: [{ text: datos }] }],
    generationConfig: { maxOutputTokens: 1024 }
  });
  return { mensaje: mensaje.trim() };
}

/* ───────── Registrar lote: texto libre → borrador de lote ───────── */
const UNIDADES_LOTE = [
  'litros', 'mililitros', 'libras', 'kilos', 'gramos',
  'unidades', 'docenas', 'paquetes', 'cajas', 'botellas'
];

export async function interpretarLoteIA(texto, hoy) {
  const system = `Conviertes lo que cuenta el dueño de un pequeño negocio colombiano de arroz con leche / comida en un borrador de LOTE de producción.
Hoy es ${hoy}.

Reglas:
- nombre: el que diga el usuario (ej. "Lote arroz con leche"). Si no dice, null.
- fecha: formato YYYY-MM-DD. Si dice "hoy" o no menciona fecha, usa ${hoy}. Entiende "ayer", "el lunes", etc. respecto a hoy.
- presentacion: cómo se envasa/vende (ej. "vaso de 8 oz", "bolsa de 500 g"). Si no la dice, null.
- cantidadProducida: cuántas unidades produjo en total.
- perdidas: unidades dañadas, regaladas o perdidas. Si no dice, null.
- valorUnitario: precio de VENTA de cada unidad del producto. Solo si lo dice; si no, null.
- base: aporte extra de dinero al lote, solo si lo mencionan; si no, null.
- ingredientes: lista de lo que se usó. Para cada uno:
  · nombre, cantidad (número) y unidad (una de: ${UNIDADES_LOTE.join(', ')}). Convierte sinónimos ("lb"→libras, "lts"→litros, "kg"→kilos).
  · Precio: si dicen el precio POR unidad ("a 3.500 la libra") ponlo en precioUnitario. Si dicen lo que costó en TOTAL ese ingrediente ("10 libras por 35 mil") ponlo en precioTotal. Si no dicen precio, deja ambos en null. Nunca inventes precios.
  · "mil" = 1000 ("35 mil" = 35000), "medio millón" = 500000.
- aviso: una frase corta con lo que falta o dudas (ej. "No dijiste el precio de la canela"). Si no hay nada, null.
- Nunca inventes datos que no estén en el texto.`;

  const salida = await llamarGemini({
    system,
    contents: [{ role: 'user', parts: [{ text: String(texto).slice(0, 1500) }] }],
    generationConfig: {
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          nombre: { type: 'STRING', nullable: true },
          fecha: { type: 'STRING', nullable: true },
          presentacion: { type: 'STRING', nullable: true },
          cantidadProducida: { type: 'NUMBER', nullable: true },
          perdidas: { type: 'NUMBER', nullable: true },
          valorUnitario: { type: 'NUMBER', nullable: true },
          base: { type: 'NUMBER', nullable: true },
          ingredientes: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                nombre: { type: 'STRING' },
                cantidad: { type: 'NUMBER' },
                unidad: { type: 'STRING', enum: UNIDADES_LOTE },
                precioUnitario: { type: 'NUMBER', nullable: true },
                precioTotal: { type: 'NUMBER', nullable: true }
              },
              required: ['nombre', 'cantidad', 'unidad']
            }
          },
          aviso: { type: 'STRING', nullable: true }
        },
        required: ['ingredientes']
      }
    }
  });

  let b;
  try {
    b = JSON.parse(salida);
  } catch {
    throw new Error('No pude interpretar el lote, intenta con otra frase.');
  }

  // El precio unitario lo calculamos en código (más confiable que pedírselo a la IA)
  b.ingredientes = (b.ingredientes || []).map((i) => {
    const cant = Number(i.cantidad) || 0;
    let unit = i.precioUnitario != null ? Number(i.precioUnitario) : null;
    if (unit == null && i.precioTotal != null && cant > 0) unit = Number(i.precioTotal) / cant;
    return {
      nombre: i.nombre,
      cantidad: cant,
      unidad: UNIDADES_LOTE.includes(i.unidad) ? i.unidad : 'unidades',
      valorUnitario: unit != null ? Math.round(unit * 100) / 100 : null
    };
  });
  if (b.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) b.fecha = null;
  return { borrador: b };
}
