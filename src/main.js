import { createCharacter, isImageFile } from './modules/characters.js';
import { renderCharacterGallery } from './modules/gallery.js';

const characters = [];
const app = document.querySelector('#app');

app.innerHTML = `
  <main class="studio-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Character Studio home">
        <span class="brand-mark" aria-hidden="true">C</span>
        <span>Character<span class="brand-light">Studio</span></span>
      </a>
      <span class="topbar-note"><span class="status-dot"></span> Your workspace</span>
    </header>

    <section class="page-intro" aria-labelledby="page-title">
      <div>
        <p class="eyebrow">CHARACTER COMPARISON STUDIO</p>
        <h1 id="page-title">Bring your characters together.</h1>
        <p class="intro-copy">Start by adding character images to your studio. You can upload more at any time.</p>
      </div>
      <div class="step-pill"><span>01</span> Add characters</div>
    </section>

    <section class="upload-panel" aria-labelledby="upload-title">
      <div class="panel-heading">
        <div class="upload-icon" aria-hidden="true">↑</div>
        <div>
          <h2 id="upload-title">Upload characters</h2>
          <p>Choose one or more image files from your device.</p>
        </div>
      </div>
      <label class="drop-zone" id="drop-zone" for="character-files" tabindex="0">
        <span class="drop-icon" aria-hidden="true">＋</span>
        <span class="drop-title">Drop images here</span>
        <span class="drop-subtitle">or <span class="browse-link">browse files</span></span>
        <span class="file-types">PNG, JPG, WEBP, GIF · Multiple files supported</span>
      </label>
      <input id="character-files" class="visually-hidden" type="file" accept="image/*" multiple />
      <p class="upload-feedback" id="upload-feedback" role="status" aria-live="polite"></p>
    </section>

    <section class="gallery-section" aria-labelledby="gallery-title">
      <div class="gallery-heading">
        <div>
          <p class="eyebrow">YOUR COLLECTION</p>
          <h2 id="gallery-title">Characters <span class="count" id="character-count">0</span></h2>
        </div>
        <label class="add-more" for="character-files"><span aria-hidden="true">＋</span> Add images</label>
      </div>
      <div id="character-gallery"></div>
    </section>
    <footer class="footer"><span>Character Studio</span><span>Images stay in this browser session</span></footer>
  </main>
`;

const fileInput = document.querySelector('#character-files');
const dropZone = document.querySelector('#drop-zone');
const feedback = document.querySelector('#upload-feedback');
const gallery = document.querySelector('#character-gallery');
const count = document.querySelector('#character-count');

function addFiles(fileList) {
  const files = Array.from(fileList);
  const images = files.filter(isImageFile);
  const rejected = files.length - images.length;

  images.forEach((file) => characters.push(createCharacter(file)));
  renderCharacterGallery(gallery, characters, (id) => {
    const index = characters.findIndex((character) => character.id === id);
    if (index !== -1) {
      URL.revokeObjectURL(characters[index].imageUrl);
      characters.splice(index, 1);
      updateGallery();
    }
  });
  count.textContent = characters.length;

  if (images.length && rejected) feedback.textContent = `${images.length} image${images.length === 1 ? '' : 's'} added. ${rejected} unsupported file${rejected === 1 ? '' : 's'} skipped.`;
  else if (images.length) feedback.textContent = `${images.length} image${images.length === 1 ? '' : 's'} added to your collection.`;
  else if (files.length) feedback.textContent = 'Please choose image files such as PNG, JPG, WEBP, or GIF.';
  else feedback.textContent = '';
}

function updateGallery() {
  renderCharacterGallery(gallery, characters, (id) => {
    const index = characters.findIndex((character) => character.id === id);
    if (index !== -1) {
      URL.revokeObjectURL(characters[index].imageUrl);
      characters.splice(index, 1);
      updateGallery();
    }
  });
  count.textContent = characters.length;
}

fileInput.addEventListener('change', (event) => {
  addFiles(event.target.files);
  event.target.value = '';
});

dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});

['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.add('is-dragging');
}));

['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragging');
}));

dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));

window.addEventListener('beforeunload', () => {
  characters.forEach((character) => URL.revokeObjectURL(character.imageUrl));
});

updateGallery();

