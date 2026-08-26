const copyButton = document.querySelector('#copy-bib');
const bibtex = document.querySelector('#bibtex-code');
const moreWorks = document.querySelector('.more-works');
const moreWorksToggle = document.querySelector('#more-works-toggle');
const moreWorksPanel = document.querySelector('#more-works-panel');
const moreWorksClose = document.querySelector('#more-works-close');

function setMoreWorks(open) {
  moreWorksToggle.setAttribute('aria-expanded', String(open));
  moreWorksPanel.hidden = !open;
}

moreWorksToggle.addEventListener('click', () => {
  setMoreWorks(moreWorksToggle.getAttribute('aria-expanded') !== 'true');
});

moreWorksClose.addEventListener('click', () => {
  setMoreWorks(false);
  moreWorksToggle.focus();
});

document.addEventListener('click', (event) => {
  if (!moreWorks.contains(event.target)) setMoreWorks(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMoreWorks(false);
});

document.body.classList.add('motion-ready');
const revealItems = document.querySelectorAll('.section-intro, .card, .paper-figure, .result-card, .insights article, .resource-grid > *');
revealItems.forEach((item) => item.classList.add('reveal'));

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.12 });

revealItems.forEach((item) => revealObserver.observe(item));

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(bibtex.textContent);
    copyButton.textContent = 'Copied!';
    window.setTimeout(() => { copyButton.textContent = 'Copy citation'; }, 1600);
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(bibtex);
    selection.removeAllRanges();
    selection.addRange(range);
    copyButton.textContent = 'Selected — press Ctrl/Cmd+C';
  }
});
