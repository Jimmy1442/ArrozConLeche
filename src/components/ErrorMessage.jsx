function ErrorMessage({ mensaje }) {
  if (!mensaje) return null;
  return <div className="error-msg">{mensaje}</div>;
}

export default ErrorMessage;