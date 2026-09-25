function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function renderCharacterGallery(container, characters, onRemove) {
  if (!characters.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-illustration" aria-hidden="true"><span>▧</span></div>
        <h3>Your collection is ready</h3>
        <p>Uploaded characters will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="character-grid">${characters.map((character) => `
    <article class="character-card">
      <div class="character-image-wrap">
        <img src="${character.imageUrl}" alt="${escapeHtml(character.name)}" class="character-image" />
        <button class="remove-character" type="button" aria-label="Remove ${escapeHtml(character.name)}" data-remove="${character.id}">×</button>
      </div>
      <div class="character-info">
        <h3 title="${escapeHtml(character.name)}">${escapeHtml(character.name)}</h3>
        <p>${escapeHtml(character.fileName)}</p>
      </div>
    </article>
  `).join('')}</div>`;

  container.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => onRemove(button.dataset.remove));
  });
}
