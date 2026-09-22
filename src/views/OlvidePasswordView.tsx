import { useState } from 'react';
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import logo from '../assets/logo.png';
import { solicitarRecuperacion } from '../services/auth.service';

interface OlvidePasswordViewProps {
  onVolver: () => void;
}

const inputClass =
  'w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow transition placeholder-gray-500';
const labelClass = 'text-xs font-semibold text-gray-300 mb-1.5 block';

export default function OlvidePasswordView({ onVolver }: OlvidePasswordViewProps) {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await solicitarRecuperacion(email);
    } finally {
      // Siempre mostramos el mismo mensaje, exista o no la cuenta — por
      // seguridad, para no revelar qué correos están registrados.
      setEnviado(true);
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-brand-dark flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-brand-gray border border-gray-800 rounded-2xl shadow-2xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="PickCrane" className="h-14" />
          <h1 className="text-lg font-bold tracking-wider text-brand-yellow">Recuperar contraseña</h1>
        </div>

        {enviado ? (
          <div className="text-center space-y-3 py-4">
            <MailCheck className="w-10 h-10 text-green-400 mx-auto" />
            <p className="text-sm text-white">
              Si <span className="font-semibold">{email}</span> tiene una cuenta con nosotros, te llegará un correo con
              instrucciones para restablecer tu contraseña.
            </p>
            <button
              onClick={onVolver}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 justify-center mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-gray-400">
              Indica el correo con el que te registraste y te mandaremos un enlace para elegir una contraseña nueva.
            </p>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full py-3 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-black font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
              Enviar enlace de recuperación
            </button>

            <button type="button" onClick={onVolver} className="w-full text-center text-xs text-gray-400 hover:text-white flex items-center gap-1 justify-center">
              <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
