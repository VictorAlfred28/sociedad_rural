import React from 'react';

export default function DeleteData() {
  return (
    <div className="min-h-screen bg-white px-6 py-10 text-gray-800">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          Eliminación de Datos – Sociedad Rural del Norte
        </h1>

        <p className="mb-4">
          Los usuarios de Sociedad Rural del Norte pueden solicitar la eliminación
          de sus datos personales asociados a la aplicación.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">
          Cómo solicitar la eliminación
        </h2>

        <p className="mb-4">
          Para solicitar la eliminación de tus datos, envía un correo electrónico a:
        </p>

        <p className="font-semibold mb-4">
          soporte@sociedadruraldelnorte.agentech.ar
        </p>

        <p className="mb-4">
          Asunto: “Solicitud de eliminación de datos”
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">
          Datos que se eliminarán
        </h2>

        <ul className="list-disc pl-6 mb-4">
          <li>Nombre y apellido</li>
          <li>Correo electrónico</li>
          <li>Teléfono</li>
          <li>Datos de perfil</li>
          <li>Información de acceso a la aplicación</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">
          Datos que podrían conservarse
        </h2>

        <p className="mb-4">
          Por motivos legales, administrativos o contables, ciertos registros
          institucionales o de pagos podrían conservarse durante el período
          requerido por la normativa aplicable.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">
          Tiempo de procesamiento
        </h2>

        <p className="mb-4">
          Las solicitudes serán procesadas dentro de un plazo razonable posterior
          a la verificación de identidad del solicitante.
        </p>

        <p className="mt-10 text-sm text-gray-500">
          Última actualización: Mayo 2026
        </p>
      </div>
    </div>
  );
}
