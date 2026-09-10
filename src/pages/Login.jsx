import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../firebase';
import Logo from '../components/Logo';
import InputField from '../components/InputField';
import Button from '../components/Button';
import ErrorMessage from '../components/ErrorMessage';
import '../styles/Login.css';

function Login({ onLogin }) {
  const [esRegistro, setEsRegistro] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      let credencial;
      if (esRegistro) {
        credencial = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        credencial = await signInWithEmailAndPassword(auth, email, password);
      }
      onLogin(credencial.user);
    } catch (err) {
      const mensajes = {
        'auth/invalid-email': 'El correo no es válido 🍚',
        'auth/user-not-found': 'No encontramos esa cuenta',
        'auth/wrong-password': 'Contraseña incorrecta',
        'auth/email-already-in-use': 'Ese correo ya está registrado',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
        'auth/invalid-credential': 'Correo o contraseña incorrectos'
      };
      setError(mensajes[err.code] || 'Algo salió mal, intenta de nuevo');
    } finally {
      setCargando(false);
    }
  };

  const cambiarModo = () => {
    setEsRegistro(!esRegistro);
    setError('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <Logo />

        <h1 className="login-title">
          {esRegistro ? 'Crear cuenta' : 'Bienvenido'}
        </h1>
        <p className="login-subtitle">
          {esRegistro
            ? 'Únete a M&S Dulce Arroz con Love 💛'
            : 'Un arroz hecho con amor, para endulzar tu día'}
        </p>

        <ErrorMessage mensaje={error} />

        <form onSubmit={handleSubmit}>
          <InputField
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
          />

          <InputField
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
          />

          <Button type="submit" variant="primary" disabled={cargando}>
            {cargando
              ? 'Cargando...'
              : esRegistro
              ? 'Registrarme 🍮'
              : 'Iniciar sesión'}
          </Button>
        </form>

        <div className="toggle-auth">
          {esRegistro ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
          <button onClick={cambiarModo}>
            {esRegistro ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;