import { useState } from "react";
import "./FAQ.css";

const preguntas = [
  {
    q: "¿Qué es una Whitelist?",
    a: "Es un sistema de selección para permitir el acceso al servidor solo a jugadores que cumplen las normas y entienden el rol."
  },
  {
    q: "¿Cuánto tarda en revisarse?",
    a: "El tiempo habitual de revisión es de unas horas, aunque en algunos casos puede extenderse hasta 24 h o más, dependiendo del volumen de solicitudes."
  },
  {
    q: "¿Puedo volver a enviar si me rechazan?",
    a: "Sí, pero recuerda que solo dispones de 3 intentos en total. Además, no podrás enviar otra solicitud mientras tengas una pendiente de revisión."
  },
  {
    q: "¿Dónde recibiré la respuesta?",
    a: "Siempre en Discord, mediante un mensaje o notificación de nuestro equipo staff."
  }
];

export default function FAQ() {
  const [open, setOpen] = useState(null);

  const toggle = (i) => {
    setOpen(open === i ? null : i);
  };

  return (
    <div className="faq-container">
      <h2 className="faq-title">❓ Preguntas frecuentes</h2>
      {preguntas.map((item, i) => (
        <div key={i} className={`faq-item ${open === i ? "open" : ""}`}>
          <button className="faq-question" onClick={() => toggle(i)}>
            {item.q}
            <span className="faq-icon">{open === i ? "−" : "+"}</span>
          </button>
          <div className="faq-answer">
            <p>{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
