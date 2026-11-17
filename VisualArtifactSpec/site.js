const viewer = document.querySelector('#figure-viewer');
const caseButtons = [...document.querySelectorAll('[data-case-target]')];
caseButtons.forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('#cases video').forEach(video => video.pause());
  caseButtons.forEach(other => {
    const active = other === button;
    other.setAttribute('aria-pressed', String(active));
    document.getElementById(other.dataset.caseTarget).hidden = !active;
  });
}));
document.querySelectorAll('[data-gallery]').forEach(gallery => {
  const pages = JSON.parse(gallery.dataset.gallery);
  gallery.querySelectorAll('[data-gallery-step]').forEach(button => button.addEventListener('click', () => {
    const index = (Number(gallery.dataset.page) + Number(button.dataset.galleryStep) + pages.length) % pages.length;
    gallery.dataset.page = index;
    const img = gallery.querySelector('img');
    img.src = pages[index];
    img.alt = img.alt.replace(/(Slide|Card) \d+$/, `${gallery.dataset.unit} ${index + 1}`);
    gallery.querySelector('a[data-lightbox]').href = pages[index];
    gallery.querySelector('figcaption').textContent = `${gallery.dataset.unit} ${index + 1} of ${pages.length} · Full original preview; click to enlarge.`;
    gallery.querySelector('[aria-live]').textContent = `${index + 1} / ${pages.length}`;
  }));
});
document.querySelectorAll('[data-seek]').forEach(button => button.addEventListener('click', () => {
  const video = button.closest('.comparison-output').querySelector('video');
  video.pause();
  const seek = () => { video.currentTime = Number(button.dataset.seek); };
  if (video.readyState >= 1) seek();
  else { video.addEventListener('loadedmetadata', seek, {once:true}); video.load(); }
}));
document.querySelectorAll('[data-reset-frame]').forEach(button => button.addEventListener('click', () => {
  const frame = button.closest('.live-artifact').querySelector('iframe');
  frame.src = frame.getAttribute('src');
}));
const resultViews = {
  overall: [['harness', 'Harness'], ['reasoning', 'Reasoning'], ['total', 'Total', 'S'], ['base', 'Fulfillment', 'B'], ['adjustment', 'Performance', 'Δ'], ['validTasks', 'Valid tasks', '/ 211']],
  dimensions: [['total', 'Total', 'S'], ['cp', 'CP', '%'], ['fn', 'FN', '%'], ['content', 'Content', 'C · points'], ['organization', 'Organization', 'O · points'], ['visuals', 'Visuals', 'V · points'], ['delivery', 'Delivery', 'D · points']],
  families: [['total', 'Overall', '211 tasks'], ['presentations', 'Presentations', '47 tasks'], ['staticGraphics', 'Static graphics', '72 tasks'], ['animationsVideos', 'Animations & videos', '32 tasks'], ['webInterfaces', 'Web interfaces', '60 tasks']]
};
Object.entries(resultViews).forEach(([view, columns]) => {
  const table = document.querySelector(`#table-${view}`);
  const caption = table.createCaption();
  caption.className = 'visually-hidden';
  caption.textContent = `VAS 1.0 ${view} scores. Sorted by total score, highest first.`;
  const header = table.createTHead().insertRow();
  [['model', 'Model'], ...columns].forEach(([key, label, unit]) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    if (key === 'total') th.className = 'total-column';
    if (unit) { const small = document.createElement('small'); small.textContent = unit; th.append(small); }
    header.append(th);
  });
  const body = table.createTBody();
  (window.VAS_RESULTS || []).forEach(result => {
    const row = body.insertRow();
    const model = document.createElement('th');
    model.scope = 'row'; model.textContent = result.model;
    model.title = `${result.harness} · Reasoning: ${result.reasoning}`;
    row.append(model);
    columns.forEach(([key]) => {
      const cell = row.insertCell();
      if (key === 'total') cell.className = 'total-column';
      const value = result[key];
      if (value === null || value === undefined) {
        cell.classList.add('pending-score');
        cell.setAttribute('aria-label', 'Result pending');
      } else { cell.textContent = typeof value === 'number' && key !== 'validTasks' ? value.toFixed(2) : String(value); }
    });
  });
});
const resultTabs = [...document.querySelectorAll('[data-results-view]')];
function selectResultTab(selected) {
  resultTabs.forEach(tab => {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  });
}
resultTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectResultTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % resultTabs.length;
    if (event.key === 'ArrowLeft') next = (index + resultTabs.length - 1) % resultTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = resultTabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectResultTab(resultTabs[next]); resultTabs[next].focus(); }
  });
});
const viewerImage = document.querySelector('#viewer-image');
const viewerCaption = document.querySelector('#viewer-caption');
document.querySelectorAll('[data-lightbox]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !viewer.showModal) return;
    event.preventDefault();
    viewerImage.src = link.href;
    viewerImage.alt = link.querySelector('img').alt;
    viewerCaption.textContent = link.closest('figure').querySelector('figcaption').textContent;
    viewer.showModal();
  });
});
viewer.addEventListener('click', event => {
  if (event.target === viewer) {
    const rect = viewer.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) viewer.close();
  }
});
