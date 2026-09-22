import { useState, useEffect } from 'react';
import { User, Wrench, Loader2, Copy } from 'lucide-react';
import logo from '../assets/logo.png';
import { LocationSearchInput } from '../components/LocationSearchInput';
import { registrar } from '../services/auth.service';
import { obtenerDatosPagoMovil } from '../services/pago.service';
import type { Usuario, Coordenadas, DatosPagoMovil } from '../types';

interface RegistroViewProps {
  onRegistrado: (usuario: Usuario) => void;
  onIrALogin: () => void;
}

type RolElegido = 'CLIENTE' | 'GRUERO' | null;

const inputClass =
  'w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow transition placeholder-gray-500';
const labelClass = 'text-xs font-semibold text-gray-300 mb-1.5 block';

export default function RegistroView({ onRegistrado, onIrALogin }: RegistroViewProps) {
  const [rol, setRol] = useState<RolElegido>(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');

  // Campos exclusivos de GRUERO
  const [tipoGrua, setTipoGrua] = useState('');
  const [placa, setPlaca] = useState('');
  const [direccion, setDireccion] = useState('');
  const [coordsDireccion, setCoordsDireccion] = useState<Coordenadas | null>(null);
  const [referenciaMembresia, setReferenciaMembresia] = useState('');
  const [datosPagoMovil, setDatosPagoMovil] = useState<DatosPagoMovil | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (rol !== 'GRUERO' || datosPagoMovil) return;
    obtenerDatosPagoMovil().then(setDatosPagoMovil).catch(() => {});
  }, [rol, datosPagoMovil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rol === 'GRUERO' && !coordsDireccion) {
      setError('Selecciona la dirección de tu base desde el buscador (necesitamos las coordenadas).');
      return;
    }
    if (rol === 'GRUERO' && referenciaMembresia.trim().length < 4) {
      setError('Indica el número de referencia del pago de tu membresía.');
      return;
    }

    setEnviando(true);
    try {
      const { usuario } =
        rol === 'CLIENTE'
          ? await registrar({ rol: 'CLIENTE', nombre, email, password, telefono: telefono || undefined })
          : await registrar({
              rol: 'GRUERO',
              nombre,
              email,
              password,
              telefono: telefono || undefined,
              tipoGrua,
              placa,
              direccion,
              latitud: coordsDireccion![0],
              longitud: coordsDireccion![1],
              referenciaMembresia,
            });
      onRegistrado(usuario);
    } catch (err) {
      const mensaje =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'No se pudo completar el registro. Intenta de nuevo.';
      setError(typeof mensaje === 'string' ? mensaje : 'Revisa los datos ingresados.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-brand-dark flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-brand-gray border border-gray-800 rounded-2xl shadow-2xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="PickCrane" className="h-14" />
          <h1 className="text-xl font-bold tracking-wider text-brand-yellow">Crear cuenta en PickCrane</h1>
        </div>

        {rol === null ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">¿Cómo quieres usar PickCrane?</p>
            <button
              onClick={() => setRol('CLIENTE')}
              className="group w-full flex items-center gap-3 p-4 rounded-xl border border-brand-yellow/40 hover:border-brand-yellow hover:bg-brand-yellow bg-gray-800/40 transition text-left"
            >
              <User className="w-6 h-6 text-blue-400 group-hover:text-black" />
              <div>
                <p className="font-semibold text-brand-yellow group-hover:text-black">Soy usuario</p>
                <p className="text-xs text-gray-400 group-hover:text-black/70">Quiero solicitar grúas cuando las necesite</p>
              </div>
            </button>
            <button
              onClick={() => setRol('GRUERO')}
              className="group w-full flex items-center gap-3 p-4 rounded-xl border border-brand-yellow/40 hover:border-brand-yellow hover:bg-brand-yellow bg-gray-800/40 transition text-left"
            >
              <Wrench className="w-6 h-6 text-brand-yellow group-hover:text-black" />
              <div>
                <p className="font-semibold text-brand-yellow group-hover:text-black">Soy gruero</p>
                <p className="text-xs text-gray-400 group-hover:text-black/70">Quiero ofrecer servicios de grúa (requiere certificación)</p>
              </div>
            </button>
            <button onClick={onIrALogin} className="w-full text-center text-xs text-gray-400 hover:text-white pt-2">
              ¿Ya tienes cuenta? Inicia sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setRol(null)}
              className="text-xs text-gray-400 hover:text-white"
            >
              ← Cambiar tipo de cuenta ({rol === 'CLIENTE' ? 'Usuario' : 'Gruero'})
            </button>

            <div>
              <label className={labelClass}>Nombre completo</label>
              <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Contraseña</label>
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Teléfono (opcional)</label>
              <input className={inputClass} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>

            {rol === 'GRUERO' && (
              <>
                <hr className="border-gray-700" />
                <p className="text-xs text-brand-yellow font-semibold">Membresía mensual de la plataforma ($10)</p>
                {!datosPagoMovil ? (
                  <p className="text-xs text-gray-400 animate-pulse">Cargando datos de pago...</p>
                ) : (
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-2 text-sm">
                    <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Transfiere a esta cuenta</p>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Banco:</span>
                      <span className="text-white font-medium">{datosPagoMovil.banco}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Teléfono:</span>
                      <span className="text-white font-medium flex items-center gap-1.5">
                        {datosPagoMovil.telefono}
                        <Copy
                          className="w-3.5 h-3.5 cursor-pointer text-gray-500 hover:text-white"
                          onClick={() => navigator.clipboard.writeText(datosPagoMovil.telefono)}
                        />
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Cédula/RIF:</span>
                      <span className="text-white font-medium">{datosPagoMovil.cedulaORif}</span>
                    </div>
                    <hr className="border-gray-700" />
                    <div className="flex items-center justify-between text-base">
                      <span className="text-gray-300">Monto a pagar:</span>
                      <span className="font-bold text-brand-yellow">$10.00</span>
                    </div>
                  </div>
                )}
                <div>
                  <label className={labelClass}>Número de referencia de tu transferencia</label>
                  <input
                    className={inputClass}
                    placeholder="Ej: 003456789"
                    value={referenciaMembresia}
                    onChange={(e) => setReferenciaMembresia(e.target.value)}
                    required
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  Un administrador confirmará tu membresía; podrás subir tus documentos de certificación
                  mientras tanto.
                </p>

                <hr className="border-gray-700" />
                <p className="text-xs text-brand-yellow font-semibold">Datos de tu grúa</p>
                <div>
                  <label className={labelClass}>Tipo de grúa</label>
                  <input
                    className={inputClass}
                    placeholder="Ej: Plataforma, Grúa de arrastre, Canastilla..."
                    value={tipoGrua}
                    onChange={(e) => setTipoGrua(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Placa</label>
                  <input className={inputClass} value={placa} onChange={(e) => setPlaca(e.target.value)} required />
                </div>
                <LocationSearchInput
                  label="Dirección de tu base / taller"
                  placeholder="Busca tu dirección..."
                  iconColor="text-brand-yellow"
                  onSelectLocation={(coords, nombreLugar) => {
                    setCoordsDireccion(coords);
                    setDireccion(nombreLugar);
                  }}
                />
                <p className="text-[11px] text-gray-500">
                  Después de crear tu cuenta te pediremos subir foto de la grúa, licencia, certificado médico y RCV
                  para certificarte.
                </p>
              </>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full py-3 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear cuenta
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
