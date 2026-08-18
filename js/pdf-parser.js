/**
 * Combinador de Horarios - Universal PDF & JSON Parser
 * Compatible con:
 *  - Oferta Académica v08 (UNGS / universidades con formato similar)
 *  - Oferta Académica v11 (con fechas o códigos separados)
 *  - Formatos tabulares y de texto con días y rangos horarios
 *  - Archivos datos.json exportados o guardados
 */

const DAYS_MAP = {
  "lunes": "Lunes",
  "martes": "Martes",
  "miércoles": "Miércoles",
  "miercoles": "Miércoles",
  "jueves": "Jueves",
  "viernes": "Viernes",
  "sábado": "Sábado",
  "sabado": "Sábado",
  "domingo": "Domingo"
};

const DAY_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/**
 * Limpia y normaliza el nombre de la materia eliminando códigos del tipo (A0075) o A0075
 * @param {string} text 
 * @returns {string}
 */
export function cleanSubjectName(text) {
  if (!text) return "";
  let s = text;
  // Quitar códigos repetidos al final o al inicio
  s = s.replace(/\s*\(A\d{4}\)\s*$/i, "");
  s = s.replace(/\s*A\d{4}\s*$/i, "");
  s = s.replace(/\s*\(A\d{4}\)\s*$/i, "");
  s = s.replace(/^\s*A\d{4}\s+/i, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Normaliza formato de horario a "HH:MM"
 * @param {string} hStr 
 * @param {string} mStr 
 * @returns {string}
 */
function formatTimeSlot(hStr, mStr) {
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Configura la ruta del worker de PDF.js
 */
export function initPdfJs() {
  if (typeof window !== "undefined" && window.pdfjsLib) {
    // Intentar worker local, fallback a CDN
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.js";
    }
  }
}

/**
 * Parsea un archivo PDF (ArrayBuffer o Uint8Array) directamente en el navegador.
 * @param {ArrayBuffer | Uint8Array} pdfData 
 * @param {function(number, number, string): void} [onProgress] (current, total, statusText)
 * @returns {Promise<{subjects: Record<string, Record<string, Array<{day: string, start: string, end: string}>>>, metadata: {totalPages: number, subjectCount: number, commissionCount: number}}>}
 */
export async function parsePdf(pdfData, onProgress = null) {
  initPdfJs();
  if (!window.pdfjsLib) {
    throw new Error("La librería PDF.js no está cargada en el navegador.");
  }

  const loadingTask = window.pdfjsLib.getDocument({ data: pdfData });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const subjects = {};
  let lastSubjectName = null;

  // Extraer texto y elementos estructurados página por página
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) {
      onProgress(pageNum, numPages, `Procesando página ${pageNum} de ${numPages}...`);
    }

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    const textContent = await page.getTextContent();

    // Convertir items a coordenadas absolutas estándar (y=0 arriba, y=pageHeight abajo)
    const items = textContent.items
      .filter(it => it.str && it.str.trim().length > 0)
      .map(it => {
        const x0 = it.transform[4];
        const rawY = it.transform[5];
        const h = it.height || Math.abs(it.transform[0]) || 10;
        const y0 = pageHeight - rawY - h;
        const y1 = pageHeight - rawY;
        const x1 = x0 + (it.width || 0);
        return {
          str: it.str.trim(),
          x0: Math.round(x0 * 10) / 10,
          y0: Math.round(y0 * 10) / 10,
          x1: Math.round(x1 * 10) / 10,
          y1: Math.round(y1 * 10) / 10
        };
      });

    if (items.length === 0) continue;

    // Detectar encabezado de la tabla para descartar títulos superiores
    let headerY = 50.0;
    for (const it of items) {
      const lower = it.str.toLowerCase();
      if (lower.includes("actividad") || lower.includes("comisión") || lower.includes("comision") || lower.includes("horario") || lower.includes("tipo de clase")) {
        headerY = Math.max(headerY, it.y1);
      }
    }

    const tableItems = items.filter(it => it.y0 >= headerY - 3.0);
    if (tableItems.length === 0) continue;

    // Agrupar elementos por líneas horizontales de texto (umbral vertical ~ 3.5px)
    tableItems.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    const lines = [];
    for (const it of tableItems) {
      if (lines.length === 0 || Math.abs(it.y0 - lines[lines.length - 1][0].y0) > 3.5) {
        lines.push([it]);
      } else {
        lines[lines.length - 1].push(it);
      }
    }

    // Estrategia 1: Detección por Anclas de Comisión (v08 / v11 / adaptativo)
    const comAnchors = [];
    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx];
      line.sort((a, b) => a.x0 - b.x0);

      // Concatenar tokens en la columna de comisiones (aprox x entre 350 y 500)
      const comColItems = line.filter(it => it.x0 >= 350 && it.x0 <= 490);
      const comColText = comColItems.map(it => it.str).join(" ");
      const match = comColText.match(/COM[-\s]*(\d+)/i) || comColText.match(/COMISIÓN\s*(\d+)/i);

      if (match && comColItems.length > 0) {
        const comNum = parseInt(match[1], 10);
        const minY0 = Math.min(...comColItems.map(it => it.y0));
        const maxY1 = Math.max(...comColItems.map(it => it.y1));
        const minX0 = Math.min(...comColItems.map(it => it.x0));
        const maxX1 = Math.max(...comColItems.map(it => it.x1));

        comAnchors.push({
          comNum: comNum,
          comId: `COM-${String(comNum).padStart(2, '0')}`,
          x0: minX0,
          y0: minY0,
          x1: maxX1,
          y1: maxY1,
          lineIdx: lIdx
        });
      }
    }

    if (comAnchors.length > 0) {
      // Procesar cada comisión usando ventanas verticales
      for (let i = 0; i < comAnchors.length; i++) {
        const anc = comAnchors[i];
        const yTop = (i > 0) ? (comAnchors[i - 1].y1 + anc.y0) / 2.0 : headerY;
        const yBot = (i < comAnchors.length - 1) ? (anc.y1 + comAnchors[i + 1].y0) / 2.0 : pageHeight - 20.0;

        const sliceItems = tableItems.filter(it => it.y0 >= yTop - 2.5 && it.y1 <= yBot + 2.5);

        // Extraer nombre de la materia (a la izquierda de la columna de comisiones)
        const nameItems = sliceItems.filter(it => it.x1 <= anc.x0 + 4.0 && it.x0 < 390);
        nameItems.sort((a, b) => Math.round(a.y0 / 4.0) - Math.round(b.y0 / 4.0) || a.x0 - b.x0);
        const rawName = nameItems.map(it => it.str).join(" ");
        const name = cleanSubjectName(rawName);

        if (name && name.length >= 3) {
          lastSubjectName = name;
        }
        const targetSubject = name && name.length >= 3 ? name : lastSubjectName;

        if (!targetSubject) continue;

        // Extraer información de días y horarios (a la derecha de la columna de comisiones)
        const schedItems = sliceItems.filter(it => it.x0 >= 470);
        schedItems.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);

        // Agrupar items de horarios por sublíneas
        const subLines = [];
        for (const si of schedItems) {
          if (subLines.length === 0 || Math.abs(si.y0 - subLines[subLines.length - 1][0].y0) > 3.5) {
            subLines.push([si]);
          } else {
            subLines[subLines.length - 1].push(si);
          }
        }

        const blocks = [];
        for (const sl of subLines) {
          sl.sort((a, b) => a.x0 - b.x0);
          const slText = sl.map(it => it.str).join(" ");

          // Buscar día
          let foundDay = null;
          const lowerSl = slText.toLowerCase();
          for (const [dayKey, dayNorm] of Object.entries(DAYS_MAP)) {
            if (lowerSl.includes(dayKey)) {
              foundDay = dayNorm;
              break;
            }
          }

          // Buscar rango horario (ej: "18:00 a 20:59", "08:00 - 12:00", "8:00 a 10:00")
          const timeMatch = slText.match(/(\d{1,2}:\d{2})\s*(?:a|-|hasta)\s*(\d{1,2}:\d{2})/i);
          if (foundDay && timeMatch) {
            const startStr = timeMatch[1].padStart(5, '0');
            const endStr = timeMatch[2].padStart(5, '0');
            const block = { day: foundDay, start: startStr, end: endStr };

            // Evitar duplicados idénticos en la misma comisión
            if (!blocks.some(b => b.day === block.day && b.start === block.start && b.end === block.end)) {
              blocks.push(block);
            }
          }
        }

        // Si es una comisión asincrónica, blocks quedará como []
        if (!subjects[targetSubject]) {
          subjects[targetSubject] = {};
        }
        subjects[targetSubject][anc.comId] = blocks;
      }
    } else {
      // Estrategia 2 (Fallback): Parseo secuencial por patrones de línea (útil para PDFs exportados como texto o v11 clásico)
      parseSequentialLines(lines, subjects, lastSubjectName);
    }
  }

  // Contar estadísticas
  let subjectCount = Object.keys(subjects).length;
  let commissionCount = 0;
  for (const coms of Object.values(subjects)) {
    commissionCount += Object.keys(coms).length;
  }

  if (subjectCount === 0) {
    throw new Error("No se pudieron detectar materias ni comisiones en el PDF. Verificá que el archivo contenga una oferta académica válida.");
  }

  return {
    subjects: subjects,
    metadata: {
      totalPages: numPages,
      subjectCount: subjectCount,
      commissionCount: commissionCount
    }
  };
}

/**
 * Parseo de líneas de texto secuenciales para formatos alternativos o v11
 */
function parseSequentialLines(lines, subjects, fallbackSubjectName) {
  let currentSubject = fallbackSubjectName;

  for (const line of lines) {
    const lineText = line.map(it => it.str).join(" ");
    
    // Buscar código de comisión COM-XX o COM XX
    const comMatch = lineText.match(/(?:A\d{4}\s+)?COM[-\s]*(\d+)/i);
    const timeMatch = lineText.match(/(\d{1,2}:\d{2})\s*(?:a|-)\s*(\d{1,2}:\d{2})/i);

    let foundDay = null;
    const lower = lineText.toLowerCase();
    for (const [dayKey, dayNorm] of Object.entries(DAYS_MAP)) {
      if (lower.includes(dayKey)) {
        foundDay = dayNorm;
        break;
      }
    }

    // Buscar si la línea tiene nombre de materia
    const nameMatch = lineText.match(/^([A-ZÁÉÍÓÚÜÑ0-9\s,\.\-:\(\)]+?)(?:\s+A\d{4}\s+COM|\s+COM[-\s]*\d+|$)/);
    if (nameMatch && nameMatch[1].length > 4 && !comMatch && !timeMatch) {
      const candidateName = cleanSubjectName(nameMatch[1]);
      if (candidateName && candidateName.length >= 3) {
        currentSubject = candidateName;
      }
    }

    if (comMatch && currentSubject) {
      const comNum = parseInt(comMatch[1], 10);
      const comId = `COM-${String(comNum).padStart(2, '0')}`;

      if (!subjects[currentSubject]) {
        subjects[currentSubject] = {};
      }
      if (!subjects[currentSubject][comId]) {
        subjects[currentSubject][comId] = [];
      }

      if (foundDay && timeMatch) {
        const block = {
          day: foundDay,
          start: timeMatch[1].padStart(5, '0'),
          end: timeMatch[2].padStart(5, '0')
        };
        const blocks = subjects[currentSubject][comId];
        if (!blocks.some(b => b.day === block.day && b.start === block.start && b.end === block.end)) {
          blocks.push(block);
        }
      }
    }
  }
}

/**
 * Parsea un archivo datos.json (texto JSON o FileReader)
 * @param {string} jsonString 
 * @returns {{subjects: Record<string, Record<string, Array<{day: string, start: string, end: string}>>>, metadata: {totalPages: number, subjectCount: number, commissionCount: number}}}
 */
export function parseJson(jsonString) {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch (err) {
    throw new Error("El archivo JSON no tiene un formato válido: " + err.message);
  }

  const subjects = data.subjects || data;
  if (!subjects || typeof subjects !== "object" || Object.keys(subjects).length === 0) {
    throw new Error("El archivo JSON no contiene un catálogo de materias ('subjects') válido.");
  }

  let commissionCount = 0;
  for (const coms of Object.values(subjects)) {
    if (typeof coms === "object") {
      commissionCount += Object.keys(coms).length;
    }
  }

  return {
    subjects: subjects,
    metadata: {
      totalPages: 1,
      subjectCount: Object.keys(subjects).length,
      commissionCount: commissionCount
    }
  };
}
