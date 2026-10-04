# Inscripción Liga El Garito

Página de inscripción para cada fecha de la Liga El Garito, Temporada Clausura 2026.

- Los jugadores se anotan solos desde el enlace. El orden lo da la hora del servidor, no la del teléfono.
- 12 parejas titulares y el resto en reserva.
- La pareja campeona de la fecha anterior aparece primera, con el cupo asegurado, y lo confirma con un clic.
- Si alguien se anota con **Partner**, tiene plazo hasta el viernes a las 12:00 para completar el nombre. Si no lo hace, pasa al final de la lista.
- Los jugadores suspendidos no pueden inscribirse en esa fecha con ninguna pareja.
- Cada inscripción recibe un código de 6 números, que queda guardado en el teléfono. Con ese código el jugador completa su Partner o se baja de la lista.
- El organizador entra con un PIN para agregar, editar o quitar parejas, pegar la lista desde WhatsApp y cambiar los datos de la fecha.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `index.html` | La página que ven los jugadores, publicada con GitHub Pages. |
| `config.js` | La dirección del servidor. Aquí pegas la URL de Apps Script. |
| `escudo.webp` | El escudo de la liga. |
| `Codigo.gs` | El servidor, que corre en Google Apps Script. Este archivo es solo una copia de referencia: el que funciona es el que pegas en Apps Script. |

## 1. Instalar el servidor en Google (unos 5 minutos)

1. Abre [script.google.com](https://script.google.com) con tu cuenta de Google y toca **Nuevo proyecto**. Ponle de nombre *Inscripción El Garito*.
2. Borra lo que aparece en `Código.gs` y pega todo el contenido de `Codigo.gs`.
3. Cambia esta línea por un PIN que solo conozcas tú:
   ```js
   const PIN_ORGANIZADOR = 'CAMBIA-ESTE-PIN';
   ```
   Cambia el PIN solo en el editor de Apps Script. No lo subas a GitHub.
4. Guarda el proyecto. En la barra de arriba, elige la función **setup** y toca **Ejecutar**.
   - Google te pedirá permisos. Toca *Revisar permisos*, elige tu cuenta, entra a *Configuración avanzada*, toca *Ir a Inscripción El Garito* y luego *Permitir*.
   - Esto crea en tu Drive la planilla **Inscripción El Garito · Datos**, con la Fecha 10 ya cargada. El enlace a la planilla aparece en el registro de ejecución.
5. Toca **Implementar → Nueva implementación** y elige el tipo **Aplicación web**. Configúrala así:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
6. Toca **Implementar** y copia la URL de la aplicación web. Termina en `/exec`.

> Si usas una cuenta de trabajo y no aparece la opción *Cualquier usuario*, tu empresa no permite publicar aplicaciones abiertas. En ese caso, haz estos mismos pasos con una cuenta personal de Gmail.

## 2. Publicar la página en GitHub

1. En el repositorio, toca **Add file → Upload files**. Arrastra `index.html`, `config.js`, `escudo.webp`, `Codigo.gs` y `README.md`, y toca **Commit changes**.
2. Abre `config.js`, toca el lápiz para editarlo y pega la URL de Apps Script entre las comillas:
   ```js
   window.GARITO_API = 'https://script.google.com/macros/s/…/exec';
   ```
   Toca **Commit changes**.
3. Entra a **Settings → Pages**. En *Source* elige **Deploy from a branch**, luego la rama **main** y la carpeta **/ (root)**, y toca **Save**.
4. Uno o dos minutos después, la página queda en:
   **https://nnavarroo-sys.github.io/Inscripci-n-Liga-El-Garito/**

GitHub Pages es gratis solo si el repositorio es público. El código queda visible, pero las inscripciones y el PIN no: se guardan en tu planilla y en Apps Script.

## 3. Usarla cada semana

- **Jugadores:** entran al enlace y se anotan con su nombre y el de su pareja, o con Partner. La lista de cada fecha abre el miércoles a las 09:00 y cierra a la hora de juego. Para cambiar esa hora, edita `HORA_APERTURA` en Apps Script y publica una nueva versión.
- **Campeones:** el cupo 1 aparece reservado con 🏆. Uno de los campeones toca **Confirmar** en esa fila y quedan registrados.
- **Organizador:** al final de la página toca *Soy el organizador* y escribe tu PIN. Ese teléfono queda en modo organizador hasta que toques *Salir*. Desde ahí puedes:
  - Agregar, editar o quitar parejas.
  - Pegar el mensaje de WhatsApp para reemplazar la lista.
  - Abrir **Datos de la fecha** para cambiar la categoría, los cupos, el lugar, el pago, los campeones y los suspendidos.
- **Mensaje para el grupo:** el botón *Copiar para WhatsApp* arma la lista con el formato de siempre.
- **La planilla:**
  - La hoja **Fechas** tiene los datos de cada fecha.
  - La hoja **Inscripciones** tiene todas las parejas, incluso las que se bajaron.
  - La hoja **Registro** guarda cada cambio con su hora, por si hay que aclarar algo.

## Si cambias el código del servidor

Después de editar `Codigo.gs` en Apps Script, entra a **Implementar → Gestionar implementaciones**. Toca el lápiz, elige *Versión: Nueva versión* y toca **Implementar**. La URL no cambia, así que no hay que tocar `config.js`.
