import React from "react";



const categorieVeicoli = [
    { label: "City Car", icon: "🚗", color: "#3498db" },
    { label: "Utilitaria", icon: "🚙", color: "#2ecc71" },
    { label: "Berlina", icon: "🚘", color: "#34495e" },
    { label: "SUV", icon: "🚙", color: "#f39c12" },
    { label: "Furgone", icon: "🚐", color: "#8e44ad" },
    { label: "Minivan", icon: "🚐", color: "#d35400" },
    { label: "Lusso", icon: "🛻", color: "#e74c3c" },
    { label: "Sportiva", icon: "🏎️", color: "#c0392b" },
    { label: "Cabrio", icon: "🚘☀️", color: "#e67e22" },
    { label: "Elettrica", icon: "⚡🚗", color: "#16a085" },
    { label: "Ibrida", icon: "♻️🚗", color: "#27ae60" },
    { label: "Motociclo", icon: "🏍️", color: "#7f8c8d" },
    { label: "Quad", icon: "🛵", color: "#9b59b6" },
    { label: "Pick-up", icon: "🛻", color: "#95a5a6" },
    { label: "Camper", icon: "🚍", color: "#2980b9" },
    { label: "Imbarcazione", icon: "🚤", color: "#1abc9c" },
    { label: "Acquascooter", icon: "🌊🛥️", color: "#3498db" },
  ];
  

  const CategoriaAuto = ({ categoria }) => {
    const info = categorieVeicoli[categoria] || { icon: "❓", color: "#bdc3c7" };
  
    return (
      <span
        style={{
          display: "inline-block",
          padding: "6px 10px",
          borderRadius: "20px",
          backgroundColor: info.color,
          color: "#fff",
          fontWeight: "bold",
          fontSize: "0.85rem",
          whiteSpace: "nowrap",
        }}
      >
        {info.icon} {categoria}
      </span>
    );
  };
  
  export default CategoriaAuto;