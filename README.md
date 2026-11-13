# 📅 Combinador de Comisiones y Horarios (Versión Web)

Hecho con odio y amor, pero más amor que odio.

Saludos especiales a **Facu**, que hizo el proyecto original para Linux — yo básicamente agarré su trabajo, le puse el scrapeado web y lo tiré en un navegador. Gracias crack 🫡

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

## 💻 Cómo Ejecutar Localmente

```bash
cd combinador-horarios
python3 server.py
```
Abre `http://localhost:8000` en el navegador. O simplemente abrí `index.html` directamente.

También está disponible online en: **https://mentitos.github.io/combinador-horarios/**

---

## 📂 Estructura del Proyecto

```
combinador-horarios/
├── index.html               # Estructura principal de la aplicación web
├── css/
│   └── styles.css           # Sistema de diseño, temas claro/oscuro y estilos responsivos
├── js/
│   ├── app.js               # Lógica de la interfaz, eventos y vistas
│   ├── pdf-parser.js        # Parser universal de PDFs y JSON en el navegador
│   ├── solver.js            # Algoritmo de combinación y resolución de superposiciones
│   ├── careers.js           # Lógica de filtrado por carrera
│   └── careers-data.js      # Datos de carreras y materias
├── vendor/
│   ├── pdf.min.js           # Motor de lectura de PDF (100% offline)
│   └── pdf.worker.min.js    # Worker de procesamiento de PDF en segundo plano
├── data/
│   ├── oferta-academica-v08.pdf  # PDF de ejemplo (v08)
│   └── datos-v08.json            # JSON precargado de la oferta académica
├── server.py                # Servidor local Python
├── iniciar-web.sh           # Lanzador rápido
└── README.md
```
