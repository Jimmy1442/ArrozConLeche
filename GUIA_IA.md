# IA GRATIS en tu app del arroz (Google Gemini)

La app llama directo a Gemini desde el navegador. Sin servidor, sin tarjeta, sin pagar.

## Activarla (3 minutos)

1. Entra a https://aistudio.google.com/apikey con tu cuenta de Google.
2. Presiona **Create API key** y copia la clave (empieza por `AIza...`).
3. En tu `.env` (raíz del proyecto, junto a `package.json`) agrega una línea:
   ```
   VITE_GEMINI_API_KEY=AIza-tu-clave-aqui
   ```
   Sin comillas ni espacios alrededor del `=`. Debe empezar por `VITE_`.
4. **Reinicia** `npm run dev` (Ctrl+C y volver a correrlo; refrescar no basta).

Opcional: `VITE_GEMINI_MODEL=gemini-3.5-flash` si quieres respuestas más precisas
(por defecto usa `gemini-3.5-flash-lite`, que tiene el límite gratis más generoso).

## Cosas que debes saber

- **Límites gratis:** hay un tope de consultas por minuto y por día. Para uso personal sobra; si lo superas, la app te lo dirá y basta esperar un poco. Los límites exactos los cambia Google y los ves en https://aistudio.google.com/rate-limit.
- **Privacidad:** en el plan gratuito Google puede usar lo que envías para mejorar sus productos. La app envía resúmenes de tus ventas, clientes (nombre y teléfono) y gastos. Si te incomoda, usa un plan de pago.
- **Seguridad de la clave:** queda dentro del código de la app. Local no hay problema; si algún día publicas la app en internet, cualquiera podría sacarla. Nunca subas el `.env` a GitHub.
- La IA **nunca guarda** una venta: solo prellena el formulario y tú confirmas.
- El dictado por voz funciona en Chrome/Edge/Android.

## Probar

- Chat ✨: "¿Quién me debe plata?", "¿Cuánto vendí este mes?", "¿Qué lote me dejó más?"
- Ventas → "Registrar con IA": "Le vendí 20 a Marta, abonó 50 mil".
