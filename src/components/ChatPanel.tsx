import { useEffect, useRef, useState } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { obtenerMensajes } from '../services/servicio.service';
import { enviarMensajeChat, alRecibirMensajeChat, alReconectar } from '../services/socket.service';
import type { Mensaje } from '../types';

interface ChatPanelProps {
  servicioId: string;
  usuarioId: string;
  onCerrar: () => void;
}

export function ChatPanel({ servicioId, usuarioId, onCerrar }: ChatPanelProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    obtenerMensajes(servicioId)
      .then(setMensajes)
      .finally(() => setCargando(false));

    const dejarDeEscuchar = alRecibirMensajeChat((mensaje) => {
      if (mensaje.servicioId !== servicioId) return;
      setMensajes((prev) => (prev.some((m) => m.id === mensaje.id) ? prev : [...prev, mensaje]));
    });

    // Si el socket se reconecta mientras el chat está abierto, vuelve a
    // traer el historial por si se perdió algún mensaje en el corte.
    const dejarReconexion = alReconectar(() => {
      obtenerMensajes(servicioId).then(setMensajes);
    });

    // Respaldo: si el socket no está entregando los mensajes en vivo por lo
    // que sea, esto igual los trae cada 3s mientras el chat esté abierto —
    // así no hace falta cerrar y volver a abrir para verlos.
    const intervalo = window.setInterval(() => {
      obtenerMensajes(servicioId).then((frescos) => {
        setMensajes((prev) => (prev.length === frescos.length ? prev : frescos));
      });
    }, 3000);

    return () => {
      dejarDeEscuchar();
      dejarReconexion();
      clearInterval(intervalo);
    };
  }, [servicioId]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes.length]);

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    enviarMensajeChat(servicioId, limpio);
    setTexto('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
    >
      <div
        className="w-full sm:max-w-sm sm:rounded-2xl border border-gray-800 shadow-2xl flex flex-col h-[70vh] sm:h-[32rem]"
        style={{ backgroundColor: 'rgba(17,17,17,0.94)' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-sm font-bold text-brand-yellow flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Chat del servicio
          </h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cargando ? (
            <p className="text-xs text-gray-500 text-center">Cargando mensajes...</p>
          ) : mensajes.length === 0 ? (
            <p className="text-xs text-gray-500 text-center">
              Aún no hay mensajes. Cuéntale al otro dónde estás o cualquier detalle que necesite saber.
            </p>
          ) : (
            mensajes.map((m) => {
              const esMio = m.autorId === usuarioId;
              return (
                <div key={m.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm"
                    style={{
                      backgroundColor: esMio ? 'rgba(250,204,21,0.95)' : 'rgba(55,65,81,0.92)',
                      color: esMio ? '#000' : '#fff',
                    }}
                  >
                    {m.texto}
                    <div className={`text-[10px] mt-0.5 ${esMio ? 'text-black/60' : 'text-gray-400'}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={finRef} />
        </div>

        <form onSubmit={handleEnviar} className="p-3 border-t border-gray-800 flex items-center gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow"
            style={{ backgroundColor: 'rgba(31,41,55,0.95)' }}
          />
          <button
            type="submit"
            disabled={!texto.trim()}
            className="bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black p-2.5 rounded-xl transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
