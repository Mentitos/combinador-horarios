/**
 * Combinador de Horarios - Universal PDF & JSON Parser
 * Compatible con:
 *  - Oferta Académica v08 (UNGS / universidades con formato similar)
 *  - Oferta Académica v11 (con aulas, docentes, instancias y fechas)
 *  - Formatos tabulares adaptativos y de texto con días y rangos horarios
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

/**
 * Limpia y normaliza el nombre de la materia eliminando códigos del tipo (A0075) o A0075,
 * fechas de encabezado, sellos de tiempo y números residuales.
 * @param {string} text 
 * @returns {string}
 */
export function cleanSubjectName(text) {
  if (!text) return "";
  let s = text;
  
  // Quitar marcas temporales tipo 13/08/2026 17:27:06
  s = s.replace(/\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?/g, "");
  // Quitar encabezados de sede o título general
  s = s.replace(/Sede\s+(?:Campus|Roca)[^]*/gi, "");
  s = s.replace(/COMISIONES\s+DE\s+UN\s+PERIODO[^]*/gi, "");
  
  // Quitar códigos tipo (A0000) o A0000 repetidos al inicio o al final
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\s*\(A\d{4}\)\s*$/i, "");
    s = s.replace(/\s*A\d{4}\s*$/i, "");
    s = s.replace(/^\s*A\d{4}\s+/i, "");
    s = s.replace(/^\s*\(A\d{4}\)\s*/i, "");
  }
  
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Configura la ruta del worker de PDF.js
 */
export function initPdfJs() {
  if (typeof window !== "undefined" && window.pdfjsLib) {
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.js";
    }
  }
}

/**
 * Parsea un archivo PDF (ArrayBuffer o Uint8Array) directamente en el navegador.
 * Soporta de forma adaptativa tanto el formato v08 (retrato) como el v11 (apaisado con aulas).
 * 
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

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) {
      onProgress(pageNum, numPages, `Procesando página ${pageNum} de ${numPages}...`);
    }

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    const textContent = await page.getTextContent();

    // Convertir items a coordenadas estándar (y=0 arriba, y=pageHeight abajo)
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

    // Detectar encabezado de la tabla para ignorar metadatos superiores
    let headerY = 50.0;
    for (const it of items) {
      const lower = it.str.toLowerCase();
      if (lower.includes("actividad") || lower.includes("comisión") || lower.includes("comision") || lower.includes("horario") || lower.includes("dictado") || lower.includes("tipo de clase")) {
        headerY = Math.max(headerY, it.y1);
      }
    }

    const tableItems = items.filter(it => it.y0 >= headerY - 1.0);
    if (tableItems.length === 0) continue;

    // Agrupar elementos en líneas de texto horizontales (umbral ~ 3.5px)
    tableItems.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    const lines = [];
    for (const it of tableItems) {
      if (lines.length === 0 || Math.abs(it.y0 - lines[lines.length - 1][0].y0) > 3.5) {
        lines.push([it]);
      } else {
        lines[lines.length - 1].push(it);
      }
    }

    // Buscar anclas de comisión en cualquier columna (adaptativo para v08 en x~430 o v11 en x~200)
    const comAnchors = [];
    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx];
      line.sort((a, b) => a.x0 - b.x0);

      for (let i = 0; i < line.length; i++) {
        let text = line[i].str;
        if (i < line.length - 1 && text.toUpperCase() === "COM") {
          text = `COM-${line[i + 1].str}`;
        }

        const match = text.match(/COM[-\s]*(\d+)/i) || text.match(/COMISIÓN\s*(\d+)/i);
        if (match) {
          const comNum = parseInt(match[1], 10);
          comAnchors.push({
            comNum: comNum,
            comId: `COM-${String(comNum).padStart(2, '0')}`,
            x0: line[i].x0,
            y0: line[i].y0,
            x1: line[i].x1,
            y1: line[i].y1,
            lineIdx: lIdx
          });
          break; // Un ancla principal por línea
        }
      }
    }

    if (comAnchors.length > 0) {
      // Procesar cada comisión mediante ventanas verticales
      for (let i = 0; i < comAnchors.length; i++) {
        const anc = comAnchors[i];
        const yTop = (i > 0) ? (comAnchors[i - 1].y1 + anc.y0) / 2.0 : headerY;
        const yBot = (i < comAnchors.length - 1) ? (anc.y1 + comAnchors[i + 1].y0) / 2.0 : pageHeight - 15.0;

        const sliceItems = tableItems.filter(it => it.y0 >= yTop - 2.5 && it.y1 <= yBot + 2.5);

        // Nombre de materia: todos los elementos a la izquierda de la columna de comisión
        const nameItems = sliceItems.filter(it => it.x1 <= anc.x0 + 3.0);
        nameItems.sort((a, b) => Math.round(a.y0 / 4.0) - Math.round(b.y0 / 4.0) || a.x0 - b.x0);
        const rawName = nameItems.map(it => it.str).join(" ");
        const name = cleanSubjectName(rawName);

        if (name && name.length >= 3) {
          lastSubjectName = name;
        }
        const targetSubject = name && name.length >= 3 ? name : lastSubjectName;

        if (!targetSubject) continue;

        // Horarios: todos los elementos a la derecha de la columna de comisión
        const schedItems = sliceItems.filter(it => it.x0 >= anc.x1 - 3.0);
        schedItems.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);

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

          let foundDay = null;
          const lowerSl = slText.toLowerCase();
          for (const [dayKey, dayNorm] of Object.entries(DAYS_MAP)) {
            if (lowerSl.includes(dayKey)) {
              foundDay = dayNorm;
              break;
            }
          }

          const timeMatch = slText.match(/(\d{1,2}:\d{2})\s*(?:a|-|hasta)\s*(\d{1,2}:\d{2})/i);
          if (foundDay && timeMatch) {
            const startStr = timeMatch[1].padStart(5, '0');
            const endStr = timeMatch[2].padStart(5, '0');
            const block = { day: foundDay, start: startStr, end: endStr };

            if (!blocks.some(b => b.day === block.day && b.start === block.start && b.end === block.end)) {
              blocks.push(block);
            }
          }
        }

        if (!subjects[targetSubject]) {
          subjects[targetSubject] = {};
        }
        if (!subjects[targetSubject][anc.comId]) {
          subjects[targetSubject][anc.comId] = [];
        }

        // Agregar bloques detectados sin duplicar
        const existingBlocks = subjects[targetSubject][anc.comId];
        for (const b of blocks) {
          if (!existingBlocks.some(eb => eb.day === b.day && eb.start === b.start && eb.end === b.end)) {
            existingBlocks.push(b);
          }
        }
      }
    } else {
      // Fallback: parseo secuencial
      parseSequentialLines(lines, subjects, lastSubjectName);
    }
  }

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
 * Parseo de líneas de texto secuenciales para formatos alternativos o texto plano
 */
function parseSequentialLines(lines, subjects, fallbackSubjectName) {
  let currentSubject = fallbackSubjectName;

  for (const line of lines) {
    const lineText = line.map(it => it.str).join(" ");
    
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
 * Parsea un archivo datos.json
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
