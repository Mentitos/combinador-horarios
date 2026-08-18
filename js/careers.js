/**
 * Combinador de Horarios - Career Management & Normalization Module
 * Integración con la base de datos de carreras de la UNGS (materiasungsporcentaje)
 */

import { CAREERS_DATABASE } from './careers-data.js';

/**
 * Normaliza un string para comparaciones robustas:
 *  - Quita acentos y diacríticos
 *  - Quita códigos de materia como (A0075) o A0075
 *  - Pasa a minúsculas
 *  - Quita signos de puntuación y espacios extras
 * @param {string} text 
 * @returns {string}
 */
export function normalizeName(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text.toLowerCase();
  // Quitar acentos/tildes
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Quitar códigos tipo (A0000) o A0000
  s = s.replace(/\(a\d{4}\)/g, '');
  s = s.replace(/a\d{4}/g, '');
  // Reemplazar caracteres especiales por espacios
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  // Colapsar espacios múltiples
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Compara si dos nombres de materia corresponden a la misma materia
 * @param {string} nameA 
 * @param {string} nameB 
 * @returns {boolean}
 */
export function matchSubjectNames(nameA, nameB) {
  const normA = normalizeName(nameA);
  const normB = normalizeName(nameB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Si uno contiene al otro y tienen una longitud representativa
  if (normA.length >= 7 && normB.length >= 7) {
    if (normA.includes(normB) || normB.includes(normA)) {
      return true;
    }
  }

  // Comparación por conjunto de palabras significativas (>3 caracteres)
  const wordsA = new Set(normA.split(' ').filter(w => w.length > 3 && !['para', 'sobre', 'como', 'entre', 'hacia', 'desde'].includes(w)));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 3 && !['para', 'sobre', 'como', 'entre', 'hacia', 'desde'].includes(w)));

  if (wordsA.size >= 2 && wordsB.size >= 2) {
    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
    const ratioA = intersection / wordsA.size;
    const ratioB = intersection / wordsB.size;
    if (ratioA >= 0.75 && ratioB >= 0.75) {
      return true;
    }
  }

  return false;
}

/**
 * Formatea el nombre de la carrera para visualización limpia
 * @param {string} category 
 * @param {string} name 
 * @returns {string}
 */
export function formatCareerDisplayName(category, name) {
  let prefix = '';
  if (category === 'Ingenierías') {
    prefix = name.toLowerCase().startsWith('ing') ? '' : 'Ingeniería en ';
    if (name.toLowerCase() === 'electromecanica') return 'Ingeniería Electromecánica';
    if (name.toLowerCase() === 'industrial') return 'Ingeniería Industrial';
    if (name.toLowerCase() === 'quimica') return 'Ingeniería Química';
  } else if (category === 'Licenciaturas') {
    prefix = name.toLowerCase().startsWith('lic') ? '' : 'Licenciatura en ';
    if (name.toLowerCase() === 'administracion de empresas') return 'Licenciatura en Administración de Empresas';
    if (name.toLowerCase() === 'administracion publica') return 'Licenciatura en Administración Pública';
    if (name.toLowerCase() === 'comunicaciones') return 'Licenciatura en Comunicación';
    if (name.toLowerCase() === 'cultura y lenguajes artisticos') return 'Licenciatura en Cultura y Lenguajes Artísticos';
    if (name.toLowerCase() === 'ecologia') return 'Licenciatura en Ecología';
    if (name.toLowerCase() === 'economia industrial') return 'Licenciatura en Economía Industrial';
    if (name.toLowerCase() === 'economia politica') return 'Licenciatura en Economía Política';
    if (name.toLowerCase() === 'educacion') return 'Licenciatura en Educación';
    if (name.toLowerCase() === 'estudios politicos') return 'Licenciatura en Estudios Políticos';
    if (name.toLowerCase() === 'filosofia') return 'Licenciatura en Filosofía';
    if (name.toLowerCase() === 'logistica') return 'Licenciatura en Logística';
    if (name.toLowerCase() === 'politica social') return 'Licenciatura en Política Social';
    if (name.toLowerCase() === 'sistemas') return 'Licenciatura en Sistemas';
    if (name.toLowerCase() === 'sociologia') return 'Licenciatura en Sociología';
    if (name.toLowerCase() === 'urbanismos') return 'Licenciatura en Urbanismo';
  } else if (category === 'Profesorados') {
    if (name.toLowerCase().startsWith('profesorado')) return name;
    return `Profesorado Universitario en ${name}`;
  } else if (category === 'Tecnicaturas') {
    if (name.toLowerCase().startsWith('tec')) return name.replace('Tec.', 'Tecnicatura Universitaria');
    if (name.toLowerCase() === 'informatica') return 'Tecnicatura Universitaria en Informática';
    if (name.toLowerCase() === 'automatizacion y control') return 'Tecnicatura Universitaria en Automatización y Control';
    if (name.toLowerCase() === 'sist. de info. geografica') return 'Tecnicatura Universitaria en Sistemas de Información Geográfica';
    return `Tecnicatura Universitaria en ${name}`;
  }
  return `${prefix}${name}`;
}

/**
 * Retorna la lista plana de todas las carreras disponibles organizadas por categoría
 * @returns {Array<{id: string, category: string, rawName: string, displayName: string, totalSubjects: number, subjects: Array<{id: number, name: string}>}>}
 */
export function getAllCareersList() {
  const list = [];
  for (const [category, careers] of Object.entries(CAREERS_DATABASE)) {
    for (const career of careers) {
      const id = `${normalizeName(category)}_${normalizeName(career.name)}`.replace(/\s+/g, '_');
      const displayName = formatCareerDisplayName(category, career.name);
      list.push({
        id: id,
        category: category,
        rawName: career.name,
        displayName: displayName,
        totalSubjects: career.totalSubjects,
        subjects: career.subjects
      });
    }
  }
  return list;
}

/**
 * Busca una carrera por su identificador único
 * @param {string} careerId 
 * @returns {any}
 */
export function getCareerById(careerId) {
  const all = getAllCareersList();
  return all.find(c => c.id === careerId) || null;
}

/**
 * Analiza una carrera contra la oferta académica cargada (diccionario de materias):
 * Determina cuántas materias del plan de estudios están disponibles en este cuatrimestre
 * y mapea los nombres exactos de la oferta.
 * 
 * @param {any} career 
 * @param {Record<string, any>} availableOfferSubjects 
 * @returns {{
 *   totalPlanSubjects: number,
 *   availableInOfferCount: number,
 *   matchedOfferSubjectNames: Set<string>,
 *   planSubjectsStatus: Array<{planName: string, offerName: string | null, isAvailable: boolean}>
 * }}
 */
export function analyzeCareerOffer(career, availableOfferSubjects) {
  if (!career || !career.subjects) {
    return {
      totalPlanSubjects: 0,
      availableInOfferCount: 0,
      matchedOfferSubjectNames: new Set(),
      planSubjectsStatus: []
    };
  }

  const offerNames = Object.keys(availableOfferSubjects || {});
  const offerNormalizedMap = new Map();
  for (const name of offerNames) {
    offerNormalizedMap.set(normalizeName(name), name);
  }

  const matchedOfferSubjectNames = new Set();
  const planSubjectsStatus = [];

  for (const subj of career.subjects) {
    const planName = subj.name;
    const normPlan = normalizeName(planName);

    let matchedOfferName = null;

    // 1. Coincidencia normalizada directa
    if (offerNormalizedMap.has(normPlan)) {
      matchedOfferName = offerNormalizedMap.get(normPlan);
    } else {
      // 2. Coincidencia por similitud
      for (const [normOffer, origOffer] of offerNormalizedMap.entries()) {
        if (matchSubjectNames(planName, origOffer)) {
          matchedOfferName = origOffer;
          break;
        }
      }
    }

    if (matchedOfferName) {
      matchedOfferSubjectNames.add(matchedOfferName);
      planSubjectsStatus.push({
        planName: planName,
        offerName: matchedOfferName,
        isAvailable: true
      });
    } else {
      planSubjectsStatus.push({
        planName: planName,
        offerName: null,
        isAvailable: false
      });
    }
  }

  return {
    totalPlanSubjects: career.subjects.length,
    availableInOfferCount: matchedOfferSubjectNames.size,
    matchedOfferSubjectNames: matchedOfferSubjectNames,
    planSubjectsStatus: planSubjectsStatus
  };
}
