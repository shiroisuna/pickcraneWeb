import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, XCircle } from 'lucide-react';
import logo from '../assets/logo.png';
import { verificarEmail } from '../services/auth.service';

interface VerificarEmailViewProps {
  token: string;
  onVolver: () => void;
}

export default function VerificarEmailView({ token, onVolver }: VerificarEmailViewProps) {
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');

  useEffect(() => {
    verificarEmail(token)
      .then(() => setEstado('ok'))
      .catch(() => setEstado('error'));
  }, [token]);

  return (
    <div className="min-h-screen w-full bg-brand-dark flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-brand-gray border border-gray-800 rounded-2xl shadow-2xl p-6 space-y-6 text-center">
        <div className="flex items-center gap-3 justify-center">
          <img src={logo} alt="PickCrane" className="h-14" />
        </div>

        {estado === 'cargando' && (
          <div className="py-6 space-y-3">
            <Loader2 className="w-8 h-8 text-brand-yellow animate-spin mx-auto" />
            <p className="text-sm text-gray-400">Verificando tu cuenta...</p>
          </div>
        )}

        {estado === 'ok' && (
          <div className="py-4 space-y-3">
            <ShieldCheck className="w-10 h-10 text-green-400 mx-auto" />
            <p className="text-sm text-white">¡Tu cuenta quedó verificada!</p>
            <button
              onClick={onVolver}
              className="py-2.5 px-5 bg-brand-yellow hover:bg-yellow-500 text-black font-bold rounded-xl transition"
            >
              Iniciar sesión
            </button>
          </div>
        )}

        {estado === 'error' && (
          <div className="py-4 space-y-3">
            <XCircle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-sm text-white">Este enlace de verificación no es válido o ya venció.</p>
            <p className="text-xs text-gray-400">
              Inicia sesión y desde tu perfil puedes pedir que te reenvíen el correo de verificación.
            </p>
            <button
              onClick={onVolver}
              className="py-2.5 px-5 bg-brand-yellow hover:bg-yellow-500 text-black font-bold rounded-xl transition"
            >
              Iniciar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
