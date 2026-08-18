# 📅 Combinador de Comisiones y Horarios (Versión Web)

Aplicación web moderna y responsiva para combinar comisiones universitarias sin superposición de horarios, adaptada a partir del programa original en PySide6 y mejorada para funcionar directamente en el navegador con soporte para múltiples formatos de PDF (versión v08, versión v11 y genéricos).

---

## 🚀 Características Principales

1. **Soporte Multi-formato de PDF y JSON**:
   - **PDF Oferta Académica v08**: Formato con columnas de Actividad (Nombre + Código), Comisión, Día, Horario y Tipo de clase.
   - **PDF Oferta Académica v11**: Formato con columnas separadas de código o fechas.
   - **Formato Tabular Genérico**: Detección adaptativa de columnas y anclas de comisiones.
   - **Archivos `datos.json`**: Carga y exportación directa de combinaciones y ofertas académicas.
   - **Cursos Asincrónicos**: Reconocimiento de cursadas virtuales asincrónicas sin horario fijo.

2. **Interfaz Fiel a la Original con Mejoras Web**:
   - **Panel Izquierdo**:
     - Carga de PDF o JSON vía explorador o *Drag & Drop*.
     - Botón de carga rápida de la Oferta Académica 2026 (v08).
     - Buscador / Filtro en tiempo real de materias con conteo.
     - Botones de selección rápida (*Todas*, *Ninguna*, *Invertir*).
     - Lista interactiva con checkboxes y badges de cantidad de comisiones.
     - Filtro opcional por **Franja Horaria** con selectores de inicio/fin y accesos directos (*Mañana 08-14*, *Tarde 14-18*, *Noche 18-22*).
     - Botón de búsqueda con feedback visual y barra de progreso.
   - **Panel Derecho (Resultados y Vistas)**:
     - Navegación entre combinaciones (*Anterior*, *Siguiente*, selector numérico `[ 1 ] / N`, atajos de teclado `←` y `→`).
     - **Vista 1: Grilla Horaria Semanal**: Calendario visual 2D interactivo (Lunes a Sábado, 07:00 a 22:00) con bloques de colores por materia.
     - **Vista 2: Tabla de Horarios**: Tabla idéntica a la aplicación original de escritorio (Materia, Comisión, Día, Horario, Modalidad).
     - **Vista 3: Detalle por Materia**: Tarjetas individuales con las comisiones y días asignados.
     - **Exportación**: Descarga como archivo JSON, impresión/guardado a PDF y copiado de resumen al portapapeles.
     - **Tema Claro / Oscuro**: Toggle con detección automática del sistema.

---

## 💻 Cómo Ejecutar la Aplicación Web

### Opción 1: Con el script de inicio automático (Recomendada)
Ejecutá en la terminal:
```bash
/home/mati/combinador-horarios-web/iniciar-web.sh
```
o bien:
```bash
cd /home/mati/combinador-horarios-web
python3 server.py
```
Esto abrirá automáticamente la aplicación en tu navegador web en `http://localhost:8000`.

### Opción 2: Abrir directamente con tu navegador
Podés abrir el archivo `index.html` con cualquier navegador:
```bash
firefox /home/mati/combinador-horarios-web/index.html
```

---

## 📂 Estructura del Proyecto

```
combinador-horarios-web/
├── index.html               # Estructura principal de la aplicación web
├── css/
│   └── styles.css           # Sistema de diseño, temas claro/oscuro y estilos responsivos
├── js/
│   ├── app.js               # Lógica de la interfaz, eventos y vistas
│   ├── pdf-parser.js        # Parser universal de PDFs y JSON en el navegador
│   └── solver.js            # Algoritmo de combinación y resolución de superposiciones
├── vendor/
│   ├── pdf.min.js           # Motor de lectura de PDF (100% offline)
│   └── pdf.worker.min.js    # Worker de procesamiento de PDF en segundo plano
├── data/
│   ├── oferta-academica-v08.pdf  # PDF de ejemplo (v08)
│   └── datos-v08.json            # JSON precargado de la oferta académica
├── server.py                # Servidor local Python integrado
├── iniciar-web.sh           # Lanzador rápido
└── README.md
```
