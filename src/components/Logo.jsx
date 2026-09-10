import logo from '../assets/logo.png';

function Logo({ size = 140 }) {
  return (
    <div className="logo-wrapper">
      <img
        src={logo}
        alt="M&S Dulce Arroz con Love"
        className="logo-img"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

export default Logo;