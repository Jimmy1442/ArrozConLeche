# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# 🍚 M&S Dulce Arroz con Love

Sistema de gestión para negocio de arroz con leche.

## 🛠️ Tecnologías

- **Frontend:** React + Vite
- **Backend:** Firebase (Auth + Firestore)
- **Estilos:** CSS puro

## 📦 Módulos

- 🏠 **Dashboard** - Panel de control con lote activo
- 💰 **Ventas** - Registro de ventas a clientes
- 👥 **Clientes** - Lista de clientes
- 🍚 **Lotes** - Producción por tandas
- 📊 **Reportes** - Análisis y rentabilidad

## 🚀 Instalación

### 1. Clona el repositorio

\`\`\`bash
git clone https://github.com/Jimmy1442/ArrozConLeche.git
cd ArrozConLeche/arroz-frontend
\`\`\`

### 2. Instala las dependencias

\`\`\`bash
npm install
\`\`\`

### 3. Configura las variables de entorno

Copia el archivo de ejemplo y renómbralo a `.env`:

\`\`\`bash
# En Windows
copy .env.example .env

# En Mac/Linux
cp .env.example .env
\`\`\`

Luego abre el `.env` y **rellena cada valor** con tus credenciales de Firebase.

**¿Dónde las consigo?**
1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Entra a tu proyecto
3. Configuración del proyecto → Tus apps → Web
4. Copia los valores del `firebaseConfig`

### 4. Corre el proyecto

\`\`\`bash
npm run dev
\`\`\`

Abre http://localhost:5173 en el navegador.

## 🔑 Variables de entorno

| Variable | Descripción |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` | API Key de Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Dominio de autenticación |
| `VITE_FIREBASE_PROJECT_ID` | ID del proyecto |
| `VITE_FIREBASE_STORAGE_BUCKET` | Bucket de storage |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ID del sender |
| `VITE_FIREBASE_APP_ID` | ID de la app |

⚠️ **NUNCA subas el archivo `.env` a GitHub.** Está en el `.gitignore` por seguridad.

## 👨‍💻 Autor

**Jimmy** - [@Jimmy1442](https://github.com/Jimmy1442)