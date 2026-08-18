/**
 * Combinador de Horarios - Main Application Logic
 * Incluye integración con catálogo de carreras de la UNGS (materiasungsporcentaje)
 */

import { parsePdf, parseJson, initPdfJs } from './pdf-parser.js';
import { findCombinations, DAY_ORDER, parseTime, formatTime } from './solver.js';
import { getAllCareersList, getCareerById, analyzeCareerOffer } from './careers.js';
import { CAREERS_DATABASE } from './careers-data.js';

// Application State
const state = {
  subjects: {},
  selectedSubjects: new Set(),
  combinations: [],
  currentComboIndex: 1, // 1-based
  currentView: 'grid',
  activeFileName: '',
  theme: localStorage.getItem('combinador_theme') || 'light',
  
  // Carrera seleccionada
  selectedCareerId: localStorage.getItem('combinador_career_id') || '',
  filterOnlyCareer: true,
  careerAnalysis: null
};

// Subject Color Palette for Calendar Grid
const SUBJECT_COLORS = [
  { bg: 'hsl(215, 80%, 48%)', text: '#ffffff' },
  { bg: 'hsl(158, 65%, 38%)', text: '#ffffff' },
  { bg: 'hsl(270, 60%, 52%)', text: '#ffffff' },
  { bg: 'hsl(28, 85%, 48%)', text: '#ffffff' },
  { bg: 'hsl(335, 75%, 48%)', text: '#ffffff' },
  { bg: 'hsl(190, 85%, 38%)', text: '#ffffff' },
  { bg: 'hsl(45, 90%, 38%)', text: '#ffffff' },
  { bg: 'hsl(120, 50%, 40%)', text: '#ffffff' },
  { bg: 'hsl(12, 80%, 50%)', text: '#ffffff' },
  { bg: 'hsl(245, 65%, 55%)', text: '#ffffff' }
];

// DOM Elements
const elements = {
  // Theme
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIconSun: document.getElementById('themeIconSun'),
  themeIconMoon: document.getElementById('themeIconMoon'),

  // File loading
  dropzone: document.getElementById('dropzone'),
  btnLoadPdf: document.getElementById('btnLoadPdf'),
  pdfFileInput: document.getElementById('pdfFileInput'),
  btnLoadJson: document.getElementById('btnLoadJson'),
  jsonFileInput: document.getElementById('jsonFileInput'),
  btnLoadSample: document.getElementById('btnLoadSample'),
  lblFileName: document.getElementById('lblFileName'),
  lblFileStats: document.getElementById('lblFileStats'),

  // Career Section
  careerSelect: document.getElementById('careerSelect'),
  careerCountBadge: document.getElementById('careerCountBadge'),
  careerInfoCard: document.getElementById('careerInfoCard'),
  careerSelectedTitle: document.getElementById('careerSelectedTitle'),
  statPlanTotal: document.getElementById('statPlanTotal'),
  statInOffer: document.getElementById('statInOffer'),
  statSelected: document.getElementById('statSelected'),
  careerProgressBar: document.getElementById('careerProgressBar'),
  chkFilterOnlyCareer: document.getElementById('chkFilterOnlyCareer'),
  btnSelectAllCareer: document.getElementById('btnSelectAllCareer'),

  // Subjects selection
  filterInput: document.getElementById('filterInput'),
  btnSelectAll: document.getElementById('btnSelectAll'),
  btnSelectNone: document.getElementById('btnSelectNone'),
  btnInvertSelect: document.getElementById('btnInvertSelect'),
  subjectsListContainer: document.getElementById('subjectsListContainer'),
  lblSelectionCount: document.getElementById('lblSelectionCount'),

  // Time range
  chkTimeRange: document.getElementById('chkTimeRange'),
  timeStart: document.getElementById('timeStart'),
  timeEnd: document.getElementById('timeEnd'),
  presetMorning: document.getElementById('presetMorning'),
  presetAfternoon: document.getElementById('presetAfternoon'),
  presetNight: document.getElementById('presetNight'),

  // Search
  btnSearch: document.getElementById('btnSearch'),
  searchProgress: document.getElementById('searchProgress'),
  searchProgressBar: document.getElementById('searchProgressBar'),

  // Results & Navigation
  lblSummary: document.getElementById('lblSummary'),
  comboNavigator: document.getElementById('comboNavigator'),
  spinComb: document.getElementById('spinComb'),
  lblTotalCombos: document.getElementById('lblTotalCombos'),
  btnPrevComb: document.getElementById('btnPrevComb'),
  btnNextComb: document.getElementById('btnNextComb'),

  // Views
  tabGrid: document.getElementById('tabGrid'),
  tabTable: document.getElementById('tabTable'),
  tabCards: document.getElementById('tabCards'),
  emptyState: document.getElementById('emptyState'),
  viewGrid: document.getElementById('viewGrid'),
  viewTable: document.getElementById('viewTable'),
  viewCards: document.getElementById('viewCards'),

  // View Containers
  gridLegend: document.getElementById('gridLegend'),
  timetableGridWrapper: document.getElementById('timetableGridWrapper'),
  asyncEventsContainer: document.getElementById('asyncEventsContainer'),
  asyncCardsList: document.getElementById('asyncCardsList'),
  tableBody: document.getElementById('tableBody'),
  cardsBreakdownGrid: document.getElementById('cardsBreakdownGrid'),

  // Export actions
  btnExportJson: document.getElementById('btnExportJson'),
  btnPrintSchedule: document.getElementById('btnPrintSchedule'),
  btnCopyClipboard: document.getElementById('btnCopyClipboard'),

  // Toast
  toastContainer: document.getElementById('toastContainer')
};

/**
 * Muestra una notificación Toast
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  } else {
    iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  }

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

/**
 * Inicialización de la aplicación
 */
function initApp() {
  applyTheme(state.theme);
  initPdfJs();
  populateCareerDropdown();
  setupEventListeners();

  // Intentar pre-cargar datos de ejemplo si están disponibles
  preloadSampleData();
}

/**
 * Llena el menú desplegable de carreras agrupadas por categoría
 */
function populateCareerDropdown() {
  const select = elements.careerSelect;
  select.innerHTML = '<option value="">Todas las carreras (Sin filtro)</option>';

  const allCareers = getAllCareersList();
  const categories = Object.keys(CAREERS_DATABASE);

  categories.forEach(cat => {
    const group = document.createElement('optgroup');
    group.label = cat;

    const careersInCat = allCareers.filter(c => c.category === cat);
    careersInCat.forEach(car => {
      const opt = document.createElement('option');
      opt.value = car.id;
      opt.textContent = `${car.displayName} (${car.totalSubjects} mat.)`;
      if (car.id === state.selectedCareerId) {
        opt.selected = true;
      }
      group.appendChild(opt);
    });

    select.appendChild(group);
  });
}

/**
 * Configuración del Tema Claro/Oscuro
 */
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('combinador_theme', theme);

  if (theme === 'dark') {
    elements.themeIconSun.style.display = 'none';
    elements.themeIconMoon.style.display = 'block';
  } else {
    elements.themeIconSun.style.display = 'block';
    elements.themeIconMoon.style.display = 'none';
  }
}

/**
 * Configura los event listeners de la interfaz
 */
function setupEventListeners() {
  // Toggle theme
  elements.themeToggleBtn.addEventListener('click', () => {
    applyTheme(state.theme === 'light' ? 'dark' : 'light');
  });

  // Career Selection
  elements.careerSelect.addEventListener('change', (e) => {
    handleCareerChange(e.target.value);
  });

  elements.chkFilterOnlyCareer.addEventListener('change', (e) => {
    state.filterOnlyCareer = e.target.checked;
    renderSubjectsList();
    filterSubjectsList(elements.filterInput.value);
  });

  elements.btnSelectAllCareer.addEventListener('click', selectAllCareerSubjects);

  // File loading buttons
  elements.btnLoadPdf.addEventListener('click', () => elements.pdfFileInput.click());
  elements.pdfFileInput.addEventListener('change', handlePdfFileSelect);

  elements.btnLoadJson.addEventListener('click', () => elements.jsonFileInput.click());
  elements.jsonFileInput.addEventListener('change', handleJsonFileSelect);

  elements.btnLoadSample.addEventListener('click', loadSampleOffer);

  // Drag & Drop
  elements.dropzone.addEventListener('click', () => elements.pdfFileInput.click());
  elements.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropzone.classList.add('dragover');
  });
  elements.dropzone.addEventListener('dragleave', () => {
    elements.dropzone.classList.remove('dragover');
  });
  elements.dropzone.addEventListener('drop', handleFileDrop);

  // Filter input
  elements.filterInput.addEventListener('input', () => {
    filterSubjectsList(elements.filterInput.value);
  });

  // Select buttons
  elements.btnSelectAll.addEventListener('click', () => selectAllVisible(true));
  elements.btnSelectNone.addEventListener('click', () => selectAllVisible(false));
  elements.btnInvertSelect.addEventListener('click', invertSelection);

  // Time range filter toggle & presets
  elements.chkTimeRange.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    elements.timeStart.disabled = !enabled;
    elements.timeEnd.disabled = !enabled;
    elements.presetMorning.disabled = !enabled;
    elements.presetAfternoon.disabled = !enabled;
    elements.presetNight.disabled = !enabled;
  });

  [elements.presetMorning, elements.presetAfternoon, elements.presetNight].forEach(btn => {
    btn.addEventListener('click', () => {
      elements.timeStart.value = btn.dataset.start;
      elements.timeEnd.value = btn.dataset.end;
    });
  });

  // Search button
  elements.btnSearch.addEventListener('click', handleSearch);

  // Combination Navigation
  elements.spinComb.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    goToCombination(val);
  });
  elements.btnPrevComb.addEventListener('click', () => {
    goToCombination(state.currentComboIndex - 1);
  });
  elements.btnNextComb.addEventListener('click', () => {
    goToCombination(state.currentComboIndex + 1);
  });

  // Keyboard navigation for combinations
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (state.combinations.length > 0) {
      if (e.key === 'ArrowLeft') {
        goToCombination(state.currentComboIndex - 1);
      } else if (e.key === 'ArrowRight') {
        goToCombination(state.currentComboIndex + 1);
      }
    }
  });

  // View Tabs
  elements.tabGrid.addEventListener('click', () => switchView('grid'));
  elements.tabTable.addEventListener('click', () => switchView('table'));
  elements.tabCards.addEventListener('click', () => switchView('cards'));

  // Export Actions
  elements.btnExportJson.addEventListener('click', exportCombinationsJson);
  elements.btnPrintSchedule.addEventListener('click', () => window.print());
  elements.btnCopyClipboard.addEventListener('click', copySummaryToClipboard);
}

/**
 * Manejo del cambio de carrera seleccionada
 */
function handleCareerChange(careerId) {
  state.selectedCareerId = careerId;
  localStorage.setItem('combinador_career_id', careerId);

  if (!careerId) {
    state.careerAnalysis = null;
    elements.careerInfoCard.style.display = 'none';
    elements.careerCountBadge.style.display = 'none';
    renderSubjectsList();
    filterSubjectsList(elements.filterInput.value);
    updateSelectionCount();
    return;
  }

  const career = getCareerById(careerId);
  if (!career) return;

  // Analizar carrera contra la oferta cargada
  const analysis = analyzeCareerOffer(career, state.subjects);
  state.careerAnalysis = analysis;

  elements.careerSelectedTitle.textContent = career.displayName;
  elements.statPlanTotal.textContent = analysis.totalPlanSubjects;
  elements.statInOffer.textContent = analysis.availableInOfferCount;

  elements.careerInfoCard.style.display = 'flex';
  elements.careerCountBadge.style.display = 'inline-block';
  elements.careerCountBadge.textContent = `${analysis.availableInOfferCount}/${analysis.totalPlanSubjects}`;

  renderSubjectsList();
  filterSubjectsList(elements.filterInput.value);
  updateSelectionCount();

  showToast(`Carrera seleccionada: ${career.displayName} (${analysis.availableInOfferCount} disponibles en la oferta)`, 'info');
}

/**
 * Selecciona automáticamente todas las materias de la carrera que están disponibles en la oferta
 */
function selectAllCareerSubjects() {
  if (!state.careerAnalysis || state.careerAnalysis.matchedOfferSubjectNames.size === 0) {
    showToast('No hay materias de esta carrera disponibles en la oferta cargada.', 'info');
    return;
  }

  state.careerAnalysis.matchedOfferSubjectNames.forEach(name => {
    state.selectedSubjects.add(name);
  });

  renderSubjectsList();
  filterSubjectsList(elements.filterInput.value);
  updateSelectionCount();
  showToast(`Se seleccionaron las ${state.careerAnalysis.matchedOfferSubjectNames.size} materias disponibles de la carrera.`, 'success');
}

/**
 * Carga de datos de muestra automáticos
 */
async function preloadSampleData() {
  try {
    const res = await fetch('./data/datos-v08.json');
    if (res.ok) {
      const data = await res.json();
      onDataLoaded('Oferta-Academica-2-2026-v08.pdf (Precargada)', data);
    }
  } catch {
    // Si no está disponible localmente por CORS de file://, el usuario puede cargarla con el botón
  }
}

/**
 * Carga la oferta de ejemplo al hacer clic en el botón
 */
async function loadSampleOffer() {
  setLoadingProgress(true, 0, 'Cargando oferta académica de ejemplo...');
  try {
    const res = await fetch('./data/datos-v08.json');
    if (!res.ok) {
      const pdfRes = await fetch('./data/oferta-academica-v08.pdf');
      if (!pdfRes.ok) throw new Error('No se pudo acceder al archivo de ejemplo local.');
      const arrayBuffer = await pdfRes.arrayBuffer();
      const parsed = await parsePdf(arrayBuffer, (cur, tot) => {
        setLoadingProgress(true, Math.round((cur / tot) * 100), `Procesando página ${cur} de ${tot}...`);
      });
      onDataLoaded('Oferta-Academica-2-2026-v08.pdf', parsed);
      return;
    }
    const data = await res.json();
    onDataLoaded('Oferta-Academica-2-2026-v08.pdf (Ejemplo)', data);
    showToast('Oferta académica de ejemplo cargada con éxito.', 'success');
  } catch (err) {
    showToast('Error al cargar oferta de ejemplo: ' + err.message, 'error');
  } finally {
    setLoadingProgress(false);
  }
}

/**
 * Manejo de selección de archivo PDF
 */
async function handlePdfFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  await processPdfFile(file);
}

/**
 * Manejo de arrastrar y soltar archivo
 */
async function handleFileDrop(e) {
  e.preventDefault();
  elements.dropzone.classList.remove('dragover');

  const files = e.dataTransfer.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  if (file.name.toLowerCase().endsWith('.pdf')) {
    await processPdfFile(file);
  } else if (file.name.toLowerCase().endsWith('.json')) {
    await processJsonFile(file);
  } else {
    showToast('Por favor subí un archivo en formato .pdf o .json', 'error');
  }
}

/**
 * Procesa un archivo PDF
 */
async function processPdfFile(file) {
  setLoadingProgress(true, 0, 'Leyendo archivo PDF...');
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await parsePdf(arrayBuffer, (cur, tot, text) => {
      const pct = Math.round((cur / tot) * 100);
      setLoadingProgress(true, pct, text);
    });

    onDataLoaded(file.name, result);
    showToast(`PDF procesado: ${result.metadata.subjectCount} materias encontradas.`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Error al parsear el PDF: ' + err.message, 'error');
  } finally {
    setLoadingProgress(false);
    elements.pdfFileInput.value = '';
  }
}

/**
 * Manejo de selección de archivo JSON
 */
async function handleJsonFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  await processJsonFile(file);
}

/**
 * Procesa un archivo JSON
 */
async function processJsonFile(file) {
  setLoadingProgress(true, 0, 'Cargando archivo JSON...');
  try {
    const text = await file.text();
    const result = parseJson(text);
    onDataLoaded(file.name, result);
    showToast(`JSON cargado: ${result.metadata.subjectCount} materias encontradas.`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Error al leer el archivo JSON: ' + err.message, 'error');
  } finally {
    setLoadingProgress(false);
    elements.jsonFileInput.value = '';
  }
}

/**
 * Actualiza el estado cuando se cargan nuevos datos
 */
function onDataLoaded(fileName, data) {
  state.activeFileName = fileName;
  state.subjects = data.subjects || {};
  state.selectedSubjects.clear();
  state.combinations = [];
  state.currentComboIndex = 1;

  const subjectCount = Object.keys(state.subjects).length;
  let commissionCount = 0;
  for (const coms of Object.values(state.subjects)) {
    commissionCount += Object.keys(coms).length;
  }

  elements.lblFileName.textContent = fileName;
  elements.lblFileStats.textContent = `${subjectCount} materias, ${commissionCount} comisiones`;

  // Re-evaluar carrera activa si existe
  if (state.selectedCareerId) {
    const career = getCareerById(state.selectedCareerId);
    if (career) {
      state.careerAnalysis = analyzeCareerOffer(career, state.subjects);
      elements.statPlanTotal.textContent = state.careerAnalysis.totalPlanSubjects;
      elements.statInOffer.textContent = state.careerAnalysis.availableInOfferCount;
      elements.careerCountBadge.textContent = `${state.careerAnalysis.availableInOfferCount}/${state.careerAnalysis.totalPlanSubjects}`;
    }
  }

  renderSubjectsList();
  updateSelectionCount();
  resetResultsView();

  elements.btnSearch.disabled = subjectCount === 0;
}

/**
 * Renderiza la lista de materias con checkboxes, filtros y badges de carrera
 */
function renderSubjectsList() {
  const container = elements.subjectsListContainer;
  container.innerHTML = '';

  let subjectNames = Object.keys(state.subjects).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  if (subjectNames.length === 0) {
    container.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--color-text-muted); font-size: 0.8rem;">No hay materias disponibles.</div>';
    return;
  }

  // Filtrar si la carrera activa tiene activado el filtro exclusivo
  const isCareerFilterActive = state.selectedCareerId && state.careerAnalysis && state.filterOnlyCareer;
  if (isCareerFilterActive) {
    subjectNames = subjectNames.filter(name => state.careerAnalysis.matchedOfferSubjectNames.has(name));
    if (subjectNames.length === 0) {
      container.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--color-text-muted); font-size: 0.8rem;">No se encontraron materias de esta carrera en la oferta cargada.</div>';
      return;
    }
  }

  const fragment = document.createDocumentFragment();

  subjectNames.forEach(name => {
    const coms = state.subjects[name];
    const comCount = Object.keys(coms).length;

    const item = document.createElement('div');
    item.className = 'subject-item';
    item.dataset.name = name;

    const isSelected = state.selectedSubjects.has(name);
    if (isSelected) item.classList.add('selected');

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'subject-checkbox';
    chk.checked = isSelected;

    const info = document.createElement('div');
    info.className = 'subject-info';

    const titleWrap = document.createElement('div');
    titleWrap.style.display = 'flex';
    titleWrap.style.alignItems = 'center';
    titleWrap.style.flexWrap = 'wrap';
    titleWrap.style.gap = '0.25rem';

    const title = document.createElement('span');
    title.className = 'subject-name';
    title.textContent = name;
    titleWrap.appendChild(title);

    // Si pertenece a la carrera activa y no estamos en modo exclusivo, mostrar tag
    if (state.selectedCareerId && state.careerAnalysis && state.careerAnalysis.matchedOfferSubjectNames.has(name) && !state.filterOnlyCareer) {
      const careerTag = document.createElement('span');
      careerTag.className = 'subject-career-tag';
      careerTag.textContent = 'Plan Carrera';
      titleWrap.appendChild(careerTag);
    }

    info.appendChild(titleWrap);

    const badge = document.createElement('span');
    badge.className = 'subject-badge-count';
    badge.textContent = `${comCount} ${comCount === 1 ? 'com.' : 'coms.'}`;

    item.appendChild(chk);
    item.appendChild(info);
    item.appendChild(badge);

    // Eventos de selección
    item.addEventListener('click', (e) => {
      if (e.target !== chk) {
        chk.checked = !chk.checked;
      }
      toggleSubjectSelection(name, chk.checked);
    });

    chk.addEventListener('change', () => {
      toggleSubjectSelection(name, chk.checked);
    });

    fragment.appendChild(item);
  });

  container.appendChild(fragment);
}

/**
 * Activa o desactiva la selección de una materia
 */
function toggleSubjectSelection(name, isSelected) {
  if (isSelected) {
    state.selectedSubjects.add(name);
  } else {
    state.selectedSubjects.delete(name);
  }

  // Actualizar estilo visual del item
  const items = elements.subjectsListContainer.querySelectorAll('.subject-item');
  items.forEach(it => {
    if (it.dataset.name === name) {
      if (isSelected) it.classList.add('selected');
      else it.classList.remove('selected');
    }
  });

  updateSelectionCount();
}

/**
 * Filtra las materias visibles según el texto de búsqueda
 */
function filterSubjectsList(query) {
  const q = query.trim().toLowerCase();
  const items = elements.subjectsListContainer.querySelectorAll('.subject-item');

  items.forEach(it => {
    const name = it.dataset.name.toLowerCase();
    if (!q || name.includes(q)) {
      it.style.display = 'flex';
    } else {
      it.style.display = 'none';
    }
  });
}

/**
 * Selecciona o deselecciona todas las materias actualmente visibles
 */
function selectAllVisible(stateVal) {
  const items = elements.subjectsListContainer.querySelectorAll('.subject-item');
  items.forEach(it => {
    if (it.style.display !== 'none') {
      const chk = it.querySelector('.subject-checkbox');
      const name = it.dataset.name;
      chk.checked = stateVal;
      if (stateVal) {
        state.selectedSubjects.add(name);
        it.classList.add('selected');
      } else {
        state.selectedSubjects.delete(name);
        it.classList.remove('selected');
      }
    }
  });
  updateSelectionCount();
}

/**
 * Invierte la selección de las materias visibles
 */
function invertSelection() {
  const items = elements.subjectsListContainer.querySelectorAll('.subject-item');
  items.forEach(it => {
    if (it.style.display !== 'none') {
      const chk = it.querySelector('.subject-checkbox');
      const name = it.dataset.name;
      chk.checked = !chk.checked;
      if (chk.checked) {
        state.selectedSubjects.add(name);
        it.classList.add('selected');
      } else {
        state.selectedSubjects.delete(name);
        it.classList.remove('selected');
      }
    }
  });
  updateSelectionCount();
}

/**
 * Actualiza el contador de materias seleccionadas y estadísticas de carrera
 */
function updateSelectionCount() {
  const count = state.selectedSubjects.size;
  elements.lblSelectionCount.textContent = `Seleccionadas: ${count}`;

  // Actualizar stats de carrera
  if (state.selectedCareerId && state.careerAnalysis) {
    let careerSelectedCount = 0;
    state.selectedSubjects.forEach(name => {
      if (state.careerAnalysis.matchedOfferSubjectNames.has(name)) {
        careerSelectedCount++;
      }
    });

    elements.statSelected.textContent = careerSelectedCount;

    const inOffer = state.careerAnalysis.availableInOfferCount;
    const progressPct = inOffer > 0 ? Math.min(100, Math.round((careerSelectedCount / inOffer) * 100)) : 0;
    elements.careerProgressBar.style.width = `${progressPct}%`;
  }
}

/**
 * Control del spinner y barra de progreso
 */
function setLoadingProgress(active, percent = 0, statusText = '') {
  if (active) {
    elements.searchProgress.classList.add('active');
    if (percent > 0) {
      elements.searchProgressBar.classList.remove('indeterminate');
      elements.searchProgressBar.style.width = `${percent}%`;
    } else {
      elements.searchProgressBar.classList.add('indeterminate');
      elements.searchProgressBar.style.width = '100%';
    }
    if (statusText) {
      elements.lblSummary.textContent = statusText;
    }
  } else {
    elements.searchProgress.classList.remove('active');
  }
}

/**
 * Ejecución del Solver de Combinaciones
 */
function handleSearch() {
  const selected = Array.from(state.selectedSubjects);
  if (selected.length < 2) {
    showToast('Por favor seleccioná al menos 2 materias para combinar.', 'info');
    return;
  }

  setLoadingProgress(true, 0, 'Calculando combinaciones posibles sin superposición...');
  elements.btnSearch.disabled = true;

  setTimeout(() => {
    try {
      const selectedSubjectsMap = {};
      for (const name of selected) {
        selectedSubjectsMap[name] = state.subjects[name];
      }

      let timeRange = null;
      if (elements.chkTimeRange.checked) {
        timeRange = {
          start: elements.timeStart.value,
          end: elements.timeEnd.value
        };
      }

      const combos = findCombinations(selectedSubjectsMap, timeRange);
      state.combinations = combos;
      state.currentComboIndex = 1;

      if (combos.length === 0) {
        elements.lblSummary.textContent = 'No se encontraron combinaciones posibles sin superposición de horarios.';
        elements.comboNavigator.style.display = 'none';
        elements.emptyState.style.display = 'flex';
        elements.emptyState.querySelector('.empty-state-title').textContent = 'Sin combinaciones válidas';
        elements.emptyState.querySelector('.empty-state-desc').textContent = 'Las materias seleccionadas tienen horarios que se solapan en todas sus comisiones o están fuera del rango horario configurado.';
        hideAllViews();
        showToast('No se encontraron combinaciones sin superposición.', 'info');
      } else {
        elements.lblSummary.textContent = `Se encontraron ${combos.length} combinaciones posibles sin superposición.`;
        elements.comboNavigator.style.display = 'flex';
        elements.spinComb.value = 1;
        elements.spinComb.max = combos.length;
        elements.lblTotalCombos.textContent = `/ ${combos.length}`;
        elements.emptyState.style.display = 'none';

        switchView(state.currentView);
        renderCurrentCombination();
        showToast(`¡Se encontraron ${combos.length} combinaciones válidas!`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Error al buscar combinaciones: ' + err.message, 'error');
    } finally {
      setLoadingProgress(false);
      elements.btnSearch.disabled = false;
    }
  }, 30);
}

/**
 * Navega a una combinación específica
 */
function goToCombination(index) {
  if (state.combinations.length === 0) return;
  const target = Math.max(1, Math.min(index, state.combinations.length));
  state.currentComboIndex = target;
  elements.spinComb.value = target;

  elements.btnPrevComb.disabled = target <= 1;
  elements.btnNextComb.disabled = target >= state.combinations.length;

  renderCurrentCombination();
}

/**
 * Resetea las vistas de resultados
 */
function resetResultsView() {
  elements.comboNavigator.style.display = 'none';
  elements.emptyState.style.display = 'flex';
  elements.lblSummary.textContent = 'Cargá un PDF y elegí las materias.';
  hideAllViews();
}

/**
 * Oculta todos los paneles de vista
 */
function hideAllViews() {
  elements.viewGrid.style.display = 'none';
  elements.viewTable.style.display = 'none';
  elements.viewCards.style.display = 'none';
}

/**
 * Cambia entre pestañas de vista (Grilla, Tabla, Tarjetas)
 */
function switchView(viewName) {
  state.currentView = viewName;

  [elements.tabGrid, elements.tabTable, elements.tabCards].forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });

  if (state.combinations.length === 0) {
    elements.emptyState.style.display = 'flex';
    hideAllViews();
    return;
  }

  elements.emptyState.style.display = 'none';
  hideAllViews();

  if (viewName === 'grid') {
    elements.viewGrid.style.display = 'block';
  } else if (viewName === 'table') {
    elements.viewTable.style.display = 'block';
  } else if (viewName === 'cards') {
    elements.viewCards.style.display = 'block';
  }

  renderCurrentCombination();
}

/**
 * Renderiza la combinación activa en todas las vistas
 */
function renderCurrentCombination() {
  if (state.combinations.length === 0 || state.currentComboIndex < 1 || state.currentComboIndex > state.combinations.length) {
    return;
  }

  const combo = state.combinations[state.currentComboIndex - 1];

  const subjectColorMap = new Map();
  combo.forEach((item, idx) => {
    const color = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
    subjectColorMap.set(item.subject, color);
  });

  renderTableView(combo);
  renderWeeklyGridView(combo, subjectColorMap);
  renderCardsView(combo, subjectColorMap);
}

/**
 * Renderiza la vista de Tabla
 */
function renderTableView(combo) {
  const tbody = elements.tableBody;
  tbody.innerHTML = '';

  const rows = [];
  for (const item of combo) {
    const { subject, commission, blocks } = item;
    if (!blocks || blocks.length === 0) {
      rows.push({
        subject: subject,
        commission: commission,
        day: '—',
        time: 'Asincrónica',
        isAsync: true
      });
    } else {
      for (const block of blocks) {
        rows.push({
          subject: subject,
          commission: commission,
          day: block.day,
          time: `${block.start} a ${block.end}`,
          startMin: parseTime(block.start),
          isAsync: false
        });
      }
    }
  }

  rows.sort((a, b) => {
    const dayIdxA = DAY_ORDER.indexOf(a.day);
    const dayIdxB = DAY_ORDER.indexOf(b.day);
    const safeDayA = dayIdxA !== -1 ? dayIdxA : 99;
    const safeDayB = dayIdxB !== -1 ? dayIdxB : 99;
    if (safeDayA !== safeDayB) return safeDayA - safeDayB;
    return (a.startMin || 0) - (b.startMin || 0);
  });

  const fragment = document.createDocumentFragment();
  rows.forEach(r => {
    const tr = document.createElement('tr');

    const tdSubj = document.createElement('td');
    tdSubj.className = 'td-subject';
    tdSubj.textContent = r.subject;

    const tdCom = document.createElement('td');
    tdCom.className = 'td-commission';
    tdCom.textContent = r.commission;

    const tdDay = document.createElement('td');
    tdDay.className = 'td-day';
    tdDay.textContent = r.day;

    const tdTime = document.createElement('td');
    tdTime.className = 'td-time';
    tdTime.textContent = r.time;

    const tdMod = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge-modality ${r.isAsync ? 'async' : 'sync'}`;
    badge.textContent = r.isAsync ? 'Virtual Asincrónico' : 'Presencial / Sincrónico';
    tdMod.appendChild(badge);

    tr.appendChild(tdSubj);
    tr.appendChild(tdCom);
    tr.appendChild(tdDay);
    tr.appendChild(tdTime);
    tr.appendChild(tdMod);

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

/**
 * Renderiza la Grilla Horaria Semanal (Visual 2D Timetable)
 */
function renderWeeklyGridView(combo, subjectColorMap) {
  const container = elements.timetableGridWrapper;
  container.innerHTML = '';

  const legendContainer = elements.gridLegend;
  legendContainer.innerHTML = '';
  subjectColorMap.forEach((color, subj) => {
    const legItem = document.createElement('div');
    legItem.className = 'legend-item';
    legItem.innerHTML = `<span class="legend-color-dot" style="background: ${color.bg};"></span><span>${subj}</span>`;
    legendContainer.appendChild(legItem);
  });

  const displayDays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  let minHour = 8;
  let maxHour = 22;

  combo.forEach(item => {
    if (item.blocks) {
      item.blocks.forEach(b => {
        const startH = Math.floor(parseTime(b.start) / 60);
        const endH = Math.ceil(parseTime(b.end) / 60);
        if (startH < minHour) minHour = Math.max(7, startH);
        if (endH > maxHour) maxHour = Math.min(23, endH);
      });
    }
  });

  const totalHours = maxHour - minHour;
  const slotHeightPx = 48;

  const corner = document.createElement('div');
  corner.className = 'grid-corner-cell';
  corner.textContent = 'HORA';
  container.appendChild(corner);

  displayDays.forEach(day => {
    const dayHeader = document.createElement('div');
    dayHeader.className = 'grid-day-header';
    dayHeader.textContent = day;
    container.appendChild(dayHeader);
  });

  const timeCol = document.createElement('div');
  timeCol.className = 'grid-time-column';
  for (let h = minHour; h < maxHour; h++) {
    const slot = document.createElement('div');
    slot.className = 'grid-time-slot-label';
    slot.style.height = `${slotHeightPx}px`;
    slot.textContent = `${String(h).padStart(2, '0')}:00`;
    timeCol.appendChild(slot);
  }
  container.appendChild(timeCol);

  const daysContainer = document.createElement('div');
  daysContainer.className = 'grid-days-container';
  daysContainer.style.height = `${totalHours * slotHeightPx}px`;

  const asyncCourses = [];

  displayDays.forEach(day => {
    const dayCol = document.createElement('div');
    dayCol.className = 'grid-day-column';
    dayCol.style.height = '100%';

    combo.forEach(item => {
      const { subject, commission, blocks } = item;
      const color = subjectColorMap.get(subject) || SUBJECT_COLORS[0];

      if (!blocks || blocks.length === 0) {
        if (!asyncCourses.some(a => a.subject === subject && a.commission === commission)) {
          asyncCourses.push({ subject, commission });
        }
        return;
      }

      blocks.forEach(b => {
        if (b.day === day) {
          const startMin = parseTime(b.start);
          const endMin = parseTime(b.end);

          const gridStartMin = minHour * 60;
          const topPx = ((startMin - gridStartMin) / 60) * slotHeightPx;
          const heightPx = Math.max(24, ((endMin - startMin) / 60) * slotHeightPx - 2);

          const eventBlock = document.createElement('div');
          eventBlock.className = 'grid-event-block';
          eventBlock.style.top = `${topPx}px`;
          eventBlock.style.height = `${heightPx}px`;
          eventBlock.style.backgroundColor = color.bg;
          eventBlock.style.color = color.text;

          eventBlock.innerHTML = `
            <span class="event-subject-title" title="${subject}">${subject}</span>
            <div class="event-meta-row">
              <span>${commission}</span>
              <span>${b.start}-${b.end}</span>
            </div>
          `;

          dayCol.appendChild(eventBlock);
        }
      });
    });

    daysContainer.appendChild(dayCol);
  });

  container.appendChild(daysContainer);

  if (asyncCourses.length > 0) {
    elements.asyncEventsContainer.style.display = 'block';
    elements.asyncCardsList.innerHTML = '';
    asyncCourses.forEach(ac => {
      const card = document.createElement('div');
      card.className = 'async-card';
      card.innerHTML = `
        <strong>${ac.subject}</strong>
        <span class="badge-modality async">${ac.commission} • Asincrónica</span>
      `;
      elements.asyncCardsList.appendChild(card);
    });
  } else {
    elements.asyncEventsContainer.style.display = 'none';
  }
}

/**
 * Renderiza la vista de Tarjetas por Materia
 */
function renderCardsView(combo, subjectColorMap) {
  const container = elements.cardsBreakdownGrid;
  container.innerHTML = '';

  const fragment = document.createDocumentFragment();

  combo.forEach(item => {
    const { subject, commission, blocks } = item;
    const color = subjectColorMap.get(subject) || SUBJECT_COLORS[0];

    const card = document.createElement('div');
    card.className = 'subject-breakdown-card';
    card.style.borderLeft = `4px solid ${color.bg}`;

    let blocksHtml = '';
    if (!blocks || blocks.length === 0) {
      blocksHtml = '<div class="card-block-item"><span>Cursada Virtual Asincrónica</span><span class="badge-modality async">Sin horario fijo</span></div>';
    } else {
      blocks.forEach(b => {
        blocksHtml += `
          <div class="card-block-item">
            <strong>${b.day}</strong>
            <span class="td-time">${b.start} a ${b.end}</span>
          </div>
        `;
      });
    }

    card.innerHTML = `
      <div class="card-subj-header">
        <span class="card-subj-name">${subject}</span>
        <span class="card-subj-badge">${commission}</span>
      </div>
      <div class="card-blocks-list">
        ${blocksHtml}
      </div>
    `;

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

/**
 * Exporta las combinaciones a archivo JSON descargable
 */
function exportCombinationsJson() {
  if (state.combinations.length === 0) {
    showToast('No hay combinaciones para exportar.', 'info');
    return;
  }

  const exportData = {
    totalCombinations: state.combinations.length,
    activeCombinationIndex: state.currentComboIndex,
    activeCombination: state.combinations[state.currentComboIndex - 1],
    allCombinations: state.combinations
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `combinaciones-horarios-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Archivo JSON descargado con éxito.', 'success');
}

/**
 * Copia el resumen de la combinación actual al portapapeles
 */
async function copySummaryToClipboard() {
  if (state.combinations.length === 0) {
    showToast('No hay combinación activa para copiar.', 'info');
    return;
  }

  const combo = state.combinations[state.currentComboIndex - 1];
  let text = `Combinación ${state.currentComboIndex} de ${state.combinations.length}:\n\n`;

  combo.forEach(item => {
    text += `• ${item.subject} (${item.commission}):\n`;
    if (!item.blocks || item.blocks.length === 0) {
      text += `    - Virtual - Asincrónica\n`;
    } else {
      item.blocks.forEach(b => {
        text += `    - ${b.day} de ${b.start} a ${b.end}\n`;
      });
    }
  });

  try {
    await navigator.clipboard.writeText(text);
    showToast('Resumen copiado al portapapeles.', 'success');
  } catch {
    showToast('No se pudo acceder al portapapeles.', 'error');
  }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);
