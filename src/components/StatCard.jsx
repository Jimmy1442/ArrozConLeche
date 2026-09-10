function StatCard({ icon, label, valor, color = 'turquesa' }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <span className="stat-label">{label}</span>
        <span className="stat-valor">{valor}</span>
      </div>
    </div>
  );
}

export default StatCard;