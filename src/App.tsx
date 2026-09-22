import { useState } from 'react';
import SolicitarGruaView from './views/SolicitarGruaView';
import RegistroView from './views/RegistroView';
import LoginView from './views/LoginView';
import OlvidePasswordView from './views/OlvidePasswordView';
import RestablecerPasswordView from './views/RestablecerPasswordView';
import VerificarEmailView from './views/VerificarEmailView';
import CertificacionGrueroView from './views/CertificacionGrueroView';
import GrueroDashboardView from './views/GrueroDashboardView';
import AdminPanelView from './views/AdminPanelView';
import { obtenerUsuarioActual } from './services/auth.service';
import type { Usuario } from './types';
import './App.css';

type Pantalla = 'registro' | 'login' | 'olvide-password';

// Enlaces de los correos (verificación / recuperación) llegan como
// /verificar?token=... o /restablecer?token=... — no hay router en esta
// app, así que se detectan una sola vez al cargar, antes que nada más.
const rutaInicial = window.location.pathname;
const tokenInicial = new URLSearchParams(window.location.search).get('token');

function limpiarUrl() {
  window.history.replaceState(null, '', '/');
}

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(() => obtenerUsuarioActual());
  const [pantallaAuth, setPantallaAuth] = useState<Pantalla>('registro');
  const [pantallaEspecial, setPantallaEspecial] = useState<'verificar' | 'restablecer' | null>(() => {
    if (rutaInicial === '/verificar' && tokenInicial) return 'verificar';
    if (rutaInicial === '/restablecer' && tokenInicial) return 'restablecer';
    return null;
  });

  if (pantallaEspecial === 'verificar' && tokenInicial) {
    return (
      <VerificarEmailView
        token={tokenInicial}
        onVolver={() => {
          limpiarUrl();
          setPantallaEspecial(null);
          setPantallaAuth('login');
        }}
      />
    );
  }

  if (pantallaEspecial === 'restablecer' && tokenInicial) {
    return (
      <RestablecerPasswordView
        token={tokenInicial}
        onVolver={() => {
          limpiarUrl();
          setPantallaEspecial(null);
          setPantallaAuth('login');
        }}
      />
    );
  }

  // Sin sesión: registro, login, o recuperar contraseña
  if (!usuario) {
    if (pantallaAuth === 'olvide-password') {
      return <OlvidePasswordView onVolver={() => setPantallaAuth('login')} />;
    }
    return pantallaAuth === 'registro' ? (
      <RegistroView onRegistrado={setUsuario} onIrALogin={() => setPantallaAuth('login')} />
    ) : (
      <LoginView
        onSesionIniciada={setUsuario}
        onIrARegistro={() => setPantallaAuth('registro')}
        onIrAOlvidePassword={() => setPantallaAuth('olvide-password')}
      />
    );
  }

  // Admin: panel de certificaciones
  if (usuario.rol === 'ADMIN') {
    return <AdminPanelView onCerrarSesion={() => setUsuario(null)} />;
  }

  // Gruero sin certificación aprobada: pantalla de subida de documentos
  if (usuario.rol === 'GRUERO' && usuario.grueroPerfil?.estadoCertificacion !== 'APROBADO') {
    return (
      <CertificacionGrueroView
        usuario={usuario}
        onCertificado={() => setUsuario({ ...usuario, grueroPerfil: { ...usuario.grueroPerfil!, estadoCertificacion: 'APROBADO' } })}
        onCerrarSesion={() => setUsuario(null)}
      />
    );
  }

  // Cliente: la app principal de solicitud (ya conectada al servicio real + Socket.IO)
  // Gruero ya certificado: su dashboard con switch de disponibilidad y mapa
  if (usuario.rol === 'GRUERO') {
    return <GrueroDashboardView usuario={usuario} onCerrarSesion={() => setUsuario(null)} onUsuarioActualizado={setUsuario} />;
  }
  return <SolicitarGruaView usuario={usuario} onCerrarSesion={() => setUsuario(null)} onUsuarioActualizado={setUsuario} />;
}
