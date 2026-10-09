// Función serverless (Vercel). Protege la clave de Anthropic: NUNCA va en el frontend.
// Variables de entorno necesarias (Vercel → Settings → Environment Variables):
//   ANTHROPIC_API_KEY   → tu clave de https://console.anthropic.com
//   FIREBASE_API_KEY    → el mismo valor de VITE_FIREBASE_API_KEY (para verificar el login)
//   ALLOWED_EMAILS      → (opcional) correos permitidos separados por coma
//   ANTHROPIC_MODEL     → (opcional) por defecto claude-haiku-5-5

const MODELO = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

// Límite sencillo por usuario (en memoria; suficiente para evitar abusos básicos)
const usos = new Map();
const MAX_POR_HORA = 60;

function limitar(uid) {
  const ahora = Date.now();
  const lista = (usos.get(uid) || []).filter((t) => ahora - t < 3600_000);
  if (lista.length >= MAX_POR_HORA) return false;
  lista.push(ahora);
  usos.set(uid, lista);
  return true;
}

// Verifica que quien llama está logueado en TU Firebase
async function verificarUsuario(req) {
  const auth = req.headers.authorization || '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!idToken) return null;

  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }
  );
  if (!r.ok) return null;
  const data = await r.json();
  const user = data.users?.[0];
  if (!user) return null;

  const permitidos = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (permitidos.length && !permitidos.includes((user.email || '').toLowerCase())) {
    return null;
  }
  return { uid: user.localId, email: user.email };
}

async function llamarClaude(body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model: MODELO, ...body })
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(data?.error?.message || 'Error al llamar a la IA');
  }
  return data;
}

/* ───────── Punto 1: preguntas sobre el negocio ───────── */
async function responderConsulta({ pregunta, historial = [], contexto }) {
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

  const messages = [
    ...historial.slice(-8).map((m) => ({
      role: m.rol === 'ia' ? 'assistant' : 'user',
      content: String(m.texto || '').slice(0, 2000)
    })),
    { role: 'user', content: String(pregunta).slice(0, 1000) }
  ];

  const data = await llamarClaude({ max_tokens: 800, system, messages });
  return { respuesta: data.content?.map((b) => b.text || '').join('') || '' };
}

/* ───────── Punto 2: texto libre → borrador de venta ───────── */
async function interpretarVenta({ texto, clientes = [], lotes = [], hoy }) {
  const system = `Conviertes frases dichas por el dueño de un negocio en un borrador de venta.
Hoy es ${hoy}.
Clientes registrados: ${JSON.stringify(clientes)}
Lotes disponibles: ${JSON.stringify(lotes)}

Reglas:
- clienteId: escoge el cliente registrado cuyo nombre mejor coincida (tolera apodos, tildes y errores de dictado como "Doña Marta" ≈ "Marta Gómez"). Si hay duda real entre varios, pon null y explícalo en "aviso".
- Si el cliente mencionado no existe, clienteId = null y pon su nombre en clienteNombreMencionado.
- cantidad: número de unidades vendidas.
- valorUnitario: SOLO si lo dicen (ej. "a 5 mil c/u" = 5000, "a 5.000"). Si no lo dicen, null (la app usará el precio del lote).
- abono: lo que el cliente pagó. Entiende "50 mil" = 50000, "medio millón" = 500000, "pagó todo" = pagoCompleto true.
- entrega: "Entregado" solo si dicen que ya se entregó; si no, "Pendiente".
- loteId: solo si mencionan un lote que coincida; si no, null.
- Nunca inventes datos que no estén en la frase.`;

  const tool = {
    name: 'borrador_venta',
    description: 'Registra el borrador de venta interpretado',
    input_schema: {
      type: 'object',
      properties: {
        clienteId: { type: ['string', 'null'] },
        clienteNombreMencionado: { type: ['string', 'null'] },
        cantidad: { type: ['number', 'null'] },
        valorUnitario: { type: ['number', 'null'] },
        abono: { type: ['number', 'null'] },
        pagoCompleto: { type: 'boolean' },
        entrega: { type: 'string', enum: ['Pendiente', 'Entregado'] },
        loteId: { type: ['string', 'null'] },
        aviso: { type: ['string', 'null'], description: 'Dudas o datos que faltan, en una frase corta' }
      },
      required: ['clienteId', 'cantidad', 'entrega']
    }
  };

  const data = await llamarClaude({
    max_tokens: 500,
    system,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'borrador_venta' },
    messages: [{ role: 'user', content: String(texto).slice(0, 600) }]
  });

  const uso = data.content?.find((b) => b.type === 'tool_use');
  if (!uso) throw new Error('No pude interpretar la venta');
  const b = uso.input;

  // Seguridad: los IDs deben existir de verdad
  if (b.clienteId && !clientes.some((c) => c.id === b.clienteId)) b.clienteId = null;
  if (b.loteId && !lotes.some((l) => l.id === b.loteId)) b.loteId = null;
  return { borrador: b };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    if (!process.env.ANTHROPIC_API_KEY || !process.env.FIREBASE_API_KEY) {
      return res.status(500).json({ error: 'Faltan variables de entorno en el servidor' });
    }

    const usuario = await verificarUsuario(req);
    if (!usuario) return res.status(401).json({ error: 'No autorizado' });
    if (!limitar(usuario.uid)) {
      return res.status(429).json({ error: 'Demasiadas consultas, intenta en un rato' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    if (body.modo === 'consulta') {
      if (!body.pregunta) return res.status(400).json({ error: 'Falta la pregunta' });
      return res.status(200).json(await responderConsulta(body));
    }
    if (body.modo === 'venta') {
      if (!body.texto) return res.status(400).json({ error: 'Falta el texto' });
      return res.status(200).json(await interpretarVenta(body));
    }
    return res.status(400).json({ error: 'Modo inválido' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
