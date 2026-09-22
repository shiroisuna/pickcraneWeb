import { useState } from 'react';
import { Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import logo from '../assets/logo.png';
import { restablecerPassword } from '../services/auth.service';

interface RestablecerPasswordViewProps {
  token: string;
  onVolver: () => void;
}

const inputClass =
  'w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow transition placeholder-gray-500';
const labelClass = 'text-xs font-semibold text-gray-300 mb-1.5 block';

export default function RestablecerPasswordView({ token, onVolver }: RestablecerPasswordViewProps) {
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setEnviando(true);
    try {
      await restablecerPassword(token, password);
      setListo(true);
    } catch (err) {
      const mensaje = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(typeof mensaje === 'string' ? mensaje : 'El enlace no es válido o ya venció. Solicita uno nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-brand-dark flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-brand-gray border border-gray-800 rounded-2xl shadow-2xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="PickCrane" className="h-14" />
          <h1 className="text-lg font-bold tracking-wider text-brand-yellow">Nueva contraseña</h1>
        </div>

        {listo ? (
          <div className="text-center space-y-3 py-4">
            <ShieldCheck className="w-10 h-10 text-green-400 mx-auto" />
            <p className="text-sm text-white">Tu contraseña se actualizó correctamente.</p>
            <button
              onClick={onVolver}
              className="py-2.5 px-5 bg-brand-yellow hover:bg-yellow-500 text-black font-bold rounded-xl transition"
            >
              Iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Nueva contraseña</label>
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Confirmar contraseña</label>
              <input
                type="password"
                className={inputClass}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full py-3 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-black font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar nueva contraseña
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
