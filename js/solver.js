/**
 * Combinador de Horarios - Solver Engine
 * Algoritmo exacto de combinatoria y detección de superposición de horarios.
 */

export const DAY_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/**
 * Convierte "HH:MM" a minutos desde las 00:00
 * @param {string} tStr 
 * @returns {number}
 */
export function parseTime(tStr) {
  if (!tStr || typeof tStr !== "string") return 0;
  const parts = tStr.trim().split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Convierte minutos desde 00:00 a formato "HH:MM"
 * @param {number} minutes 
 * @returns {string}
 */
export function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Verifica si dos intervalos (start, end) en minutos se solapan
 * @param {[number, number]} intv1 
 * @param {[number, number]} intv2 
 * @returns {boolean}
 */
export function intervalOverlap(intv1, intv2) {
  const [s1, e1] = intv1;
  const [s2, e2] = intv2;
  return !(e1 <= s2 || e2 <= s1);
}

/**
 * Retorna true si existe al menos un día común con horarios superpuestos entre dos comisiones.
 * @param {Array<{day: string, start: string, end: string}>} schedA 
 * @param {Array<{day: string, start: string, end: string}>} schedB 
 * @returns {boolean}
 */
export function schedulesOverlap(schedA, schedB) {
  if (!schedA || !schedB || schedA.length === 0 || schedB.length === 0) {
    return false;
  }

  const daysA = new Map();
  for (const block of schedA) {
    if (!daysA.has(block.day)) daysA.set(block.day, []);
    daysA.get(block.day).push([parseTime(block.start), parseTime(block.end)]);
  }

  const daysB = new Map();
  for (const block of schedB) {
    if (!daysB.has(block.day)) daysB.set(block.day, []);
    daysB.get(block.day).push([parseTime(block.start), parseTime(block.end)]);
  }

  for (const [day, intervalsA] of daysA.entries()) {
    if (daysB.has(day)) {
      const intervalsB = daysB.get(day);
      for (const intA of intervalsA) {
        for (const intB of intervalsB) {
          if (intervalOverlap(intA, intB)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Verifica si TODOS los bloques de la comisión están dentro del rango horario especificado.
 * Las comisiones asincrónicas (sin bloques) siempre se consideran válidas.
 * @param {Array<{day: string, start: string, end: string}>} blocks 
 * @param {number} startMin 
 * @param {number} endMin 
 * @returns {boolean}
 */
export function commissionWithinTimeRange(blocks, startMin, endMin) {
  if (!blocks || blocks.length === 0) {
    return true; // Comisiones asincrónicas siempre OK
  }
  for (const block of blocks) {
    const blkStart = parseTime(block.start);
    const blkEnd = parseTime(block.end);
    if (blkStart < startMin || blkEnd > endMin) {
      return false;
    }
  }
  return true;
}

/**
 * Filtra comisiones que tengan algún bloque fuera de la franja horaria.
 * @param {Record<string, Record<string, Array<{day: string, start: string, end: string}>>>} subjects 
 * @param {number} startMin 
 * @param {number} endMin 
 * @returns {Record<string, Record<string, Array<{day: string, start: string, end: string}>>>}
 */
export function filterByTimeRange(subjects, startMin, endMin) {
  const filtered = {};
  for (const [subj, comisiones] of Object.entries(subjects)) {
    const kept = {};
    for (const [com, blocks] of Object.entries(comisiones)) {
      if (commissionWithinTimeRange(blocks, startMin, endMin)) {
        kept[com] = blocks;
      }
    }
    if (Object.keys(kept).length > 0) {
      filtered[subj] = kept;
    }
  }
  return filtered;
}

/**
 * Algoritmo cartesiano eficiente con poda temprana (backtracking) para encontrar
 * combinaciones válidas sin solapamiento de horarios.
 * 
 * @param {Record<string, Record<string, Array<{day: string, start: string, end: string}>>>} subjects 
 * @param {{start: string, end: string} | null} timeRange 
 * @returns {Array<Array<{subject: string, commission: string, blocks: Array<{day: string, start: string, end: string}>}>>}
 */
export function findCombinations(subjects, timeRange = null) {
  let startMin = 0;
  let endMin = 24 * 60;

  if (timeRange && timeRange.start && timeRange.end) {
    startMin = parseTime(timeRange.start);
    endMin = parseTime(timeRange.end);
  }

  const filteredSubjects = filterByTimeRange(subjects, startMin, endMin);
  const names = Object.keys(filteredSubjects);

  if (names.length === 0) {
    return [];
  }

  // Si alguna materia seleccionada se quedó sin comisiones por el filtro horario, no hay combinaciones posibles
  if (names.length < Object.keys(subjects).length) {
    return [];
  }

  const subjectOptions = names.map(name => {
    return Object.entries(filteredSubjects[name]).map(([comision, blocks]) => ({
      subject: name,
      commission: comision,
      blocks: blocks
    }));
  });

  const validCombinations = [];
  const currentCombo = [];

  function backtrack(index) {
    if (index === subjectOptions.length) {
      validCombinations.push([...currentCombo]);
      return;
    }

    for (const option of subjectOptions[index]) {
      let overlaps = false;
      for (const selected of currentCombo) {
        if (schedulesOverlap(option.blocks, selected.blocks)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        currentCombo.push(option);
        backtrack(index + 1);
        currentCombo.pop();
      }
    }
  }

  backtrack(0);
  return validCombinations;
}
