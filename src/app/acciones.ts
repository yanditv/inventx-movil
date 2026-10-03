"use server";

import { redirect } from "next/navigation";
import { cerrarSesion, crearSesion, getSesion } from "@/lib/session";
import { marcarConexion, puntosPermitidos, validarLogin } from "@/lib/ventas";
import { PERMISO, ROL_ADMINISTRADOR, permisosDeRol, tiene } from "@/lib/seguridad";

export type EstadoLogin = { error?: string; usuario?: string };

export async function iniciarSesion(_prev: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const usuario = String(form.get("usuario") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!usuario || !password.trim()) return { error: "Ingrese datos validos", usuario };

  let emp;
  try {
    emp = await validarLogin(usuario, password);
  } catch (e) {
    console.error(e);
    return {
      error: `No se pudo conectar con la base de datos (${process.env.DB_SERVER}). Verifique que el servidor SQL Server esté encendido y accesible.`,
      usuario,
    };
  }
  if (!emp) return { error: `El usuario ${usuario} no se encuentra registrado en el sistema`, usuario };

  const esAdmin = Number(emp.IDTipoPersonal) === ROL_ADMINISTRADOR;
  const permisos = await permisosDeRol(Number(emp.IDTipoPersonal));
  if (!tiene({ esAdmin, permisos }, PERMISO.APP_WEB)) {
    return { error: "Su usuario no tiene permiso para usar la app web. Pida al administrador que lo habilite en Ajustes > Permisos.", usuario };
  }
  const base = {
    idEmpleado: Number(emp.IDEmpleado),
    usuario: emp.Usuario,
    nombre: `${emp.Nombres} ${emp.Apellidos}`.trim(),
    idSucursal: emp.IDSucursal,
    idEmpresa: emp.IDEmpresa,
    idTipoPersonal: emp.IDTipoPersonal,
    esAdmin,
    permisos,
  };
  const puntos = await puntosPermitidos(base);
  if (puntos.length === 0) {
    return { error: "No tiene puntos de venta asignados. Pida al administrador que le asigne uno en Ajustes > Usuarios.", usuario };
  }
  const sesion = { ...base, idPuntoAcceso: puntos.length === 1 ? puntos[0].IDPuntoAcceso : undefined };
  await crearSesion(sesion);
  if (sesion.idPuntoAcceso) {
    await marcarConexion(sesion.idPuntoAcceso, sesion.idSucursal, sesion.idEmpleado);
    redirect("/ventas");
  }
  redirect("/punto");
}

export async function seleccionarPunto(form: FormData) {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  const id = Number(form.get("idPuntoAcceso"));
  const pa = (await puntosPermitidos(sesion)).find((p) => p.IDPuntoAcceso === id);
  if (!pa) redirect("/punto");
  await crearSesion({ ...sesion, idPuntoAcceso: pa.IDPuntoAcceso });
  await marcarConexion(pa.IDPuntoAcceso, pa.IDSucursal, sesion.idEmpleado);
  redirect("/ventas");
}

export async function salir() {
  await cerrarSesion();
  redirect("/login");
}
