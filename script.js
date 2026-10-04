document.getElementById('year').textContent = new Date().getFullYear();

const cards = [...document.querySelectorAll('.project')];
const filters = document.querySelector('.filters');
filters.hidden = false;
function updateCount() {
  const count = cards.filter(card => !card.hidden).length;
  document.getElementById('project-count').textContent = count ? `${count} ${count === 1 ? 'project' : 'projects'}` : 'No projects in this category yet.';
}
filters.querySelectorAll('button').forEach(button => {
  button.addEventListener('click', () => {
    filters.querySelectorAll('button').forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    cards.forEach(card => { card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter; });
    updateCount();
  });
});
updateCount();

const dialog = document.getElementById('image-dialog');
let lastPreviewLink;
document.querySelectorAll('[data-preview]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    lastPreviewLink = link;
    const img = document.getElementById('preview-image');
    img.src = link.getAttribute('href');
    img.alt = `${link.dataset.preview} project screenshot`;
    document.getElementById('preview-title').textContent = link.dataset.preview;
    dialog.showModal();
    dialog.querySelector('.preview-scroll').scrollLeft = 0;
  });
});
dialog.querySelector('button').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
dialog.addEventListener('close', () => lastPreviewLink?.focus());
