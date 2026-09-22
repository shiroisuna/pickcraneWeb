import { api } from './api';
import type { Usuario } from '../types';

export async function obtenerPerfil(): Promise<Usuario> {
  const { data } = await api.get('/perfil');
  return data;
}

export interface ActualizarPerfilInput {
  nombre?: string;
  telefono?: string;
  cedula?: string;
  direccion?: string;
}

export async function actualizarPerfil(datos: ActualizarPerfilInput): Promise<Usuario> {
  const { data } = await api.patch('/perfil', datos);
  return data;
}

export async function subirFotoPerfil(archivo: File): Promise<Usuario> {
  const formData = new FormData();
  formData.append('archivo', archivo);
  const { data } = await api.post('/perfil/foto', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function cambiarPassword(passwordActual: string, passwordNueva: string): Promise<void> {
  await api.patch('/perfil/password', { passwordActual, passwordNueva });
}

export async function solicitarRetiro(monto: number, banco: string, telefono: string, cedulaORif: string) {
  const { data } = await api.post('/perfil/solicitar-retiro', { monto, banco, telefono, cedulaORif });
  return data;
}
