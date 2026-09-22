import { useState } from 'react';
import { ArrowLeft, Camera, Wallet, Loader2, User, Save, KeyRound, MailCheck, MailWarning } from 'lucide-react';
import { actualizarPerfil, subirFotoPerfil, cambiarPassword } from '../services/perfil.service';
import { actualizarUsuarioGuardado, reenviarVerificacion } from '../services/auth.service';
import { urlArchivo } from '../utils/archivos';
import type { Usuario } from '../types';

interface PerfilViewProps {
  usuario: Usuario;
  onVolver: () => void;
  onUsuarioActualizado: (usuario: Usuario) => void;
}

const inputClass =
  'w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow transition placeholder-gray-500';
const labelClass = 'text-xs font-semibold text-gray-300 mb-1.5 block';

export default function PerfilView({ usuario, onVolver, onUsuarioActualizado }: PerfilViewProps) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [telefono, setTelefono] = useState(usuario.telefono ?? '');
  const [cedula, setCedula] = useState(usuario.cedula ?? '');
  const [direccion, setDireccion] = useState(usuario.direccion ?? '');

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [datosGuardados, setDatosGuardados] = useState(false);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [passwordCambiada, setPasswordCambiada] = useState(false);
  const [errorPassword, setErrorPassword] = useState<string | null>(null);

  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  const handleReenviarVerificacion = async () => {
    setReenviando(true);
    try {
      await reenviarVerificacion();
      setReenviado(true);
    } catch {
      // silencioso: si falla, el botón se puede volver a intentar
    } finally {
      setReenviando(false);
    }
  };

  const propagarActualizacion = (nuevo: Usuario) => {
    actualizarUsuarioGuardado(nuevo);
    onUsuarioActualizado(nuevo);
  };

  const handleSubirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const actualizado = await subirFotoPerfil(archivo);
      propagarActualizacion(actualizado);
    } catch {
      setErrorDatos('No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      setSubiendoFoto(false);
      e.target.value = '';
    }
  };

  const handleGuardarDatos = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDatos(null);
    setDatosGuardados(false);
    setGuardandoDatos(true);
    try {
      const actualizado = await actualizarPerfil({
        nombre,
        telefono: telefono || undefined,
        cedula: cedula || undefined,
        direccion: direccion || undefined,
      });
      propagarActualizacion(actualizado);
      setDatosGuardados(true);
    } catch {
      setErrorDatos('No se pudieron guardar los cambios. Intenta de nuevo.');
    } finally {
      setGuardandoDatos(false);
    }
  };

  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPassword(null);
    setPasswordCambiada(false);

    if (passwordNueva !== passwordConfirmar) {
      setErrorPassword('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (passwordNueva.length < 6) {
      setErrorPassword('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setCambiandoPassword(true);
    try {
      await cambiarPassword(passwordActual, passwordNueva);
      setPasswordCambiada(true);
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordConfirmar('');
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setErrorPassword(status === 401 ? 'Tu contraseña actual no es correcta.' : 'No se pudo cambiar la contraseña.');
    } finally {
      setCambiandoPassword(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-brand-dark font-sans">
      <header className="bg-brand-gray border-b border-gray-800 p-4 flex items-center gap-3 text-white shadow-md">
        <button onClick={onVolver} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-brand-yellow">Mi Perfil</h1>
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-6">
        {/* Foto de perfil */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center overflow-hidden">
              {usuario.fotoPerfilUrl ? (
                <img src={urlArchivo(usuario.fotoPerfilUrl)} alt={usuario.nombre} className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-gray-500" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-brand-yellow hover:bg-yellow-500 text-black rounded-full p-1.5 cursor-pointer shadow-lg transition">
              {subiendoFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              <input type="file" accept="image/*" className="hidden" onChange={handleSubirFoto} disabled={subiendoFoto} />
            </label>
          </div>
          <p className="text-white font-semibold">{usuario.nombre}</p>
          <p className="text-xs text-gray-500">{usuario.rol === 'GRUERO' ? 'Gruero' : 'Usuario'}</p>
        </div>

        {/* Verificación de correo */}
        {usuario.emailVerificado ? (
          <div className="bg-green-950/30 border border-green-800/50 rounded-xl p-3 flex items-center gap-2 text-green-300 text-sm">
            <MailCheck className="w-4 h-4 shrink-0" /> Tu correo está verificado.
          </div>
        ) : (
          <div className="bg-yellow-950/30 border border-yellow-800/50 rounded-xl p-3 space-y-2 text-yellow-300 text-sm">
            <div className="flex items-center gap-2">
              <MailWarning className="w-4 h-4 shrink-0" /> Todavía no verificas tu correo.
            </div>
            {reenviado ? (
              <p className="text-xs text-yellow-400/80">Te reenviamos el correo — revisa tu bandeja de entrada.</p>
            ) : (
              <button
                onClick={handleReenviarVerificacion}
                disabled={reenviando}
                className="text-xs font-semibold underline hover:text-yellow-100 disabled:opacity-50"
              >
                {reenviando ? 'Enviando...' : 'Reenviar correo de verificación'}
              </button>
            )}
          </div>
        )}

        {/* Saldo a favor */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 flex items-center justify-between">
          <span className="text-sm text-gray-300 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-green-400" /> Saldo a favor
          </span>
          <span className="text-lg font-bold text-green-400">${usuario.saldoAFavor.toFixed(2)}</span>
        </div>

        {/* Datos personales */}
        <form onSubmit={handleGuardarDatos} className="bg-brand-gray border border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Información personal</h2>

          <div>
            <label className={labelClass}>Email</label>
            <input value={usuario.email} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
            <p className="text-[11px] text-gray-500 mt-1">El email no se puede cambiar.</p>
          </div>

          <div>
            <label className={labelClass}>Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} required />
          </div>

          <div>
            <label className={labelClass}>Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Cédula</label>
            <input value={cedula} onChange={(e) => setCedula(e.target.value)} className={inputClass} placeholder="V-12345678" />
          </div>

          <div>
            <label className={labelClass}>Dirección</label>
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputClass} />
          </div>

          {errorDatos && <p className="text-sm text-red-400">{errorDatos}</p>}
          {datosGuardados && <p className="text-sm text-green-400">Cambios guardados.</p>}

          <button
            type="submit"
            disabled={guardandoDatos}
            className="w-full py-3 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
          >
            {guardandoDatos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar cambios
          </button>
        </form>

        {/* Cambiar contraseña */}
        <form onSubmit={handleCambiarPassword} className="bg-brand-gray border border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-brand-yellow" /> Cambiar contraseña
          </h2>

          <div>
            <label className={labelClass}>Contraseña actual</label>
            <input
              type="password"
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Nueva contraseña</label>
            <input
              type="password"
              value={passwordNueva}
              onChange={(e) => setPasswordNueva(e.target.value)}
              className={inputClass}
              minLength={6}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Confirmar nueva contraseña</label>
            <input
              type="password"
              value={passwordConfirmar}
              onChange={(e) => setPasswordConfirmar(e.target.value)}
              className={inputClass}
              minLength={6}
              required
            />
          </div>

          {errorPassword && <p className="text-sm text-red-400">{errorPassword}</p>}
          {passwordCambiada && <p className="text-sm text-green-400">Contraseña actualizada.</p>}

          <button
            type="submit"
            disabled={cambiandoPassword}
            className="w-full py-3 px-4 border border-brand-yellow/40 hover:border-brand-yellow hover:bg-brand-yellow bg-gray-800 disabled:bg-gray-800 disabled:border-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-brand-yellow hover:text-black font-semibold rounded-xl transition flex items-center justify-center gap-2"
          >
            {cambiandoPassword && <Loader2 className="w-4 h-4 animate-spin" />}
            Actualizar contraseña
          </button>
        </form>
      </main>
    </div>
  );
}
