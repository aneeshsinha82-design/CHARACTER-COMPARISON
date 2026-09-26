import { createCharacter, createImageAsset, releaseAsset } from './modules/characters.js';
import { drawScene, getTimelineDuration, MOTION_GRAPHIC_PRESETS } from './modules/scene.js?v=15';
import { generateVideo } from './modules/video-export.js';

const app = document.querySelector('#app');
const project = {
  background: null,
  characters: [],
  settings: {
    cameraSpeed: 1,
    displayDuration: 3,
    transitionDuration: 2,
    zoomStrength: 0.62,
    characterSpacing: 1150,
    detailAnimation: 'draw',
    characterHighlight: 'soft-glow',
    motionGraphics: 'none',
  },
};
const playback = { currentTime: 0, playing: false, startAt: 0, frame: 0 };
const exportState = { generating: false, url: null, blob: null };
const motionGraphicOptions = ['<option value="none">None</option>', ...[...new Set(MOTION_GRAPHIC_PRESETS.map((preset) => preset.family))].map((family) =>
  `<optgroup label="${family}">${MOTION_GRAPHIC_PRESETS.filter((preset) => preset.family === family).map((preset) =>
    `<option value="${preset.id}">${preset.family} · ${MOTION_GRAPHIC_PRESETS.find((item) => item.id === preset.id).palette.name}</option>`,
  ).join('')}</optgroup>`,
)].join('');


app.innerHTML = `
  <div class="studio-app">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Character Studio home"><span class="brand-mark">C</span>Character<span class="brand-light">Studio</span></a>
      <div class="topbar-actions"><span class="save-state"><i></i> Session project</span><button class="button button-primary top-add" data-action="add-character">＋ Add Character</button></div>
    </header>

    <main class="workspace">
      <aside class="sidebar">
        <section class="side-section project-settings">
          <div class="section-heading"><div><p class="eyebrow">PROJECT SETUP</p><h2>Background</h2></div><span class="section-number">01</span></div>
          <div id="background-preview" class="background-preview"><span>16:9 scene background</span></div>
          <div class="button-row"><label class="button button-secondary" for="background-file">Upload Background</label><button class="icon-button" data-action="remove-background" title="Remove background" aria-label="Remove background">×</button></div>
          <input class="sr-only" id="background-file" type="file" accept="image/png,image/jpeg,image/webp" />
          <p class="field-hint">PNG, JPG, or WebP. Replacing keeps the scene layout.</p>
        </section>

        <section class="side-section character-section">
          <div class="section-heading"><div><p class="eyebrow">YOUR LINEUP</p><h2>Characters <span id="character-count" class="muted-count">0</span></h2></div><button class="round-add" data-action="add-character" aria-label="Add character">＋</button></div>
          <div id="character-list" class="character-list"></div>
          <div id="character-editor" class="character-editor"></div>
        </section>
      </aside>

      <section class="main-column">
        <div class="welcome-row"><div><p class="eyebrow">CHARACTER COMPARISON STUDIO</p><h1>Bring your lineup to life.</h1><p class="welcome-copy">Set up your characters, then preview a smooth left-to-right comparison.</p></div><div class="workflow-pill"><span>01</span> Build your scene</div></div>

        <section class="stage-panel">
          <div class="stage-heading"><div><p class="eyebrow">LIVE SCENE</p><h2 id="active-label">Add characters to begin</h2></div><div class="stage-badge"><span class="live-dot"></span><span id="phase-label">Ready for preview</span></div></div>
          <div class="canvas-frame"><canvas id="scene-canvas" width="1920" height="1080" aria-label="Character animation preview"></canvas><div class="canvas-corner">16:9</div></div>
          <div class="timeline-controls">
            <div class="transport"><button class="transport-button" data-action="restart" aria-label="Restart">↺</button><button class="play-button" data-action="toggle-play"><span id="play-icon">▶</span><span id="play-label">Play Preview</span></button></div>
            <div class="scrubber-wrap"><input id="timeline-scrubber" type="range" min="0" max="1" step="0.01" value="0" aria-label="Preview timeline"><div class="time-readout"><span id="current-time">0:00</span><span id="total-time">0:00</span></div></div>
          </div>
        </section>

        <section class="settings-panel">
          <div class="section-heading settings-title"><div><p class="eyebrow">MOTION & FRAMING</p><h2>Animation settings</h2></div><span class="settings-note">Shared by preview and video</span></div>
          <div class="settings-grid">
            <label class="range-field"><span>Camera speed <output id="camera-speed-value">1.0×</output></span><input data-setting="cameraSpeed" type="range" min="0.5" max="2" step="0.1" value="1"></label>
            <label class="range-field"><span>Character hold <output id="display-duration-value">3 sec</output></span><input data-setting="displayDuration" type="range" min="1" max="8" step="0.5" value="3"></label>
            <label class="range-field"><span>Transition <output id="transition-duration-value">2 sec</output></span><input data-setting="transitionDuration" type="range" min="1" max="5" step="0.5" value="2"></label>
            <label class="range-field"><span>Camera zoom <output id="zoom-strength-value">Balanced</output></span><input data-setting="zoomStrength" type="range" min="0.42" max="0.78" step="0.02" value="0.62"></label>
            <label class="range-field"><span>Character spacing <output id="spacing-value">1,150</output></span><input data-setting="characterSpacing" type="range" min="800" max="1800" step="50" value="1150"></label>
            <label class="select-field"><span>Detail entrance</span><select data-setting="detailAnimation"><option value="draw">Draw border</option><option value="fade">Fade in</option><option value="slide-up">Slide up</option><option value="rise-fade">Rise + fade</option><option value="zoom">Zoom in</option><option value="wipe">Top-down reveal</option><option value="spring">Spring pop</option><option value="slide-left">Slide from left</option><option value="name-then-slide">Name first, details slide down</option><option value="callouts">Connected callouts</option></select></label>
            <label class="select-field"><span>Character highlight</span><select data-setting="characterHighlight"><option value="none">None</option><option value="soft-glow">Soft glow</option><option value="cyan-aura">Cyan aura</option><option value="gold-aura">Gold aura</option><option value="spotlight">Spotlight</option><option value="pulse">Pulse</option><option value="bounce">Bounce</option><option value="halo">Halo ring</option><option value="rays">Light rays</option><option value="sparkles">Sparkles</option><option value="shimmer">Moving shimmer</option><option value="color-pop">Color pop</option><option value="focus">Focus stage</option></select></label>
            <label class="select-field"><span>Motion graphics <small>100 presets</small></span><select data-setting="motionGraphics">${motionGraphicOptions}</select></label>
            
            <label class="select-field"><span>Video resolution</span><select id="export-resolution"><option value="1920x1080">1920 × 1080</option><option value="1280x720">1280 × 720</option></select></label>
            <label class="select-field"><span>Frame rate</span><select id="export-fps"><option value="30">30 FPS</option><option value="60">60 FPS</option></select></label>
          </div>
        </section>

        <section class="export-panel">
          <div class="export-copy"><div class="export-icon">▶</div><div><p class="eyebrow">BROWSER VIDEO EXPORT</p><h2>Make a real comparison video</h2><p>Records the same camera animation shown in the preview.</p></div></div>
          <button id="generate-video" class="button button-primary generate-button" data-action="generate-video">Generate Video <span>↗</span></button>
          <div id="export-progress" class="export-progress" hidden><div class="progress-copy"><span id="progress-label">Preparing video…</span><span id="progress-value">0%</span></div><div class="progress-track"><span id="progress-fill"></span></div></div>
          <p id="export-message" class="export-message" role="status" aria-live="polite"></p>
          <div id="video-result" class="video-result" hidden></div>
        </section>
        <footer class="footer"><span>Character Studio</span><span>Images stay in this browser session.</span></footer>
      </section>
    </main>
  </div>
`;

const canvas = document.querySelector('#scene-canvas');
const characterList = document.querySelector('#character-list');
const editor = document.querySelector('#character-editor');
const notice = document.querySelector('#export-message');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function selectedCharacter() {
  return project.characters.find((character) => character.id === project.selectedId) ?? null;
}

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function setNotice(message, isError = false) {
  notice.textContent = message;
  notice.classList.toggle('is-error', isError);
}

function renderBackground() {
  const preview = document.querySelector('#background-preview');
  if (!project.background) {
    preview.innerHTML = '<span>16:9 scene background</span>';
    preview.classList.remove('has-image');
    return;
  }
  preview.innerHTML = `<img src="${project.background.url}" alt="Background preview"><span>${project.background.width} × ${project.background.height}</span>`;
  preview.classList.add('has-image');
}

function renderCharacterList() {
  document.querySelector('#character-count').textContent = project.characters.length;
  if (!project.characters.length) {
    characterList.innerHTML = '<div class="list-empty">Your characters will appear here.</div>';
    return;
  }
  characterList.innerHTML = project.characters.map((character, index) => `
    <div class="character-list-row ${character.id === project.selectedId ? 'is-selected' : ''}">
      <button class="character-select" data-action="select-character" data-id="${character.id}"><span class="list-index">${String(index + 1).padStart(2, '0')}</span><span class="list-avatar">${character.image ? `<img src="${character.image.url}" alt="">` : '＋'}</span><span class="list-name">${escapeHtml(character.name || `Character ${index + 1}`)}</span></button>
      <button class="list-remove" data-action="remove-character" data-id="${character.id}" aria-label="Remove ${escapeHtml(character.name || `Character ${index + 1}`)}">×</button>
    </div>`).join('');
}

function assetMarkup(asset, label) {
  if (!asset) return `<div class="asset-placeholder"><span>＋</span>${label}</div>`;
  return `<div class="asset-preview"><img src="${asset.url}" alt="${escapeHtml(asset.name)}"><span>${asset.width} × ${asset.height}</span></div>`;
}

function renderEditor() {
  const character = selectedCharacter();
  if (!character) {
    editor.innerHTML = '<div class="editor-empty"><span class="editor-empty-icon">✳</span><strong>No character selected</strong><p>Add a character to edit its image and details.</p></div>';
    return;
  }
  const index = project.characters.indexOf(character) + 1;
  editor.innerHTML = `
    <div class="editor-heading"><div><p class="eyebrow">CHARACTER ${String(index).padStart(2, '0')}</p><h3>Character details</h3></div><button class="icon-button danger-button" data-action="remove-character" data-id="${character.id}" aria-label="Delete character">×</button></div>
    <label class="text-field"><span>Name</span><input type="text" data-character-name="${character.id}" value="${escapeHtml(character.name)}" maxlength="80" placeholder="Character name"></label>
    <div class="field-block"><span class="field-label">Character image</span>${assetMarkup(character.image, 'Image preview')}<div class="button-row"><label class="button button-secondary small-button" for="image-${character.id}">${character.image ? 'Replace image' : 'Upload image'}</label>${character.image ? `<button class="text-button" data-action="remove-character-image" data-id="${character.id}">Remove</button>` : ''}</div><input class="sr-only" id="image-${character.id}" type="file" accept="image/png,image/jpeg,image/webp" data-character-upload="${character.id}"><p class="field-hint">Transparent images work well. Original proportions are preserved.</p></div>
    <div class="detail-heading"><div><span class="field-label">Comparison details</span><span class="detail-count">${character.details.length} ${character.details.length === 1 ? 'item' : 'items'}</span></div><button class="text-button" data-action="add-detail" data-id="${character.id}">＋ Add detail</button></div>
    <div class="detail-list">${character.details.map((detail, detailIndex) => `
      <article class="detail-card" data-detail="${detail.id}">
        <div class="detail-card-top"><span class="detail-number">${String(detailIndex + 1).padStart(2, '0')}</span><div class="detail-order"><button data-action="move-detail" data-id="${character.id}" data-detail-id="${detail.id}" data-direction="up" aria-label="Move detail up" ${detailIndex === 0 ? 'disabled' : ''}>↑</button><button data-action="move-detail" data-id="${character.id}" data-detail-id="${detail.id}" data-direction="down" aria-label="Move detail down" ${detailIndex === character.details.length - 1 ? 'disabled' : ''}>↓</button></div><button class="text-button danger-text" data-action="remove-detail" data-id="${character.id}" data-detail-id="${detail.id}">Remove</button></div>
        <label class="text-field"><span>Label</span><input data-detail-field="label" data-id="${character.id}" data-detail-id="${detail.id}" value="${escapeHtml(detail.label)}" maxlength="80" placeholder="e.g. Height"></label>
        <label class="text-field"><span>Value</span><input data-detail-field="value" data-id="${character.id}" data-detail-id="${detail.id}" value="${escapeHtml(detail.value)}" maxlength="160" placeholder="e.g. 170 cm"></label>
        <div class="detail-image-row">${detail.image ? `<img src="${detail.image.url}" alt="${escapeHtml(detail.image.name)}"><span>${detail.image.width} × ${detail.image.height}</span><button class="text-button" data-action="remove-detail-image" data-id="${character.id}" data-detail-id="${detail.id}">Remove image</button>` : `<label class="upload-detail" for="detail-${detail.id}">＋ Add detail image</label>`}<input class="sr-only" id="detail-${detail.id}" type="file" accept="image/png,image/jpeg,image/webp" data-detail-upload="${character.id}" data-detail-id="${detail.id}"></div>
      </article>`).join('')}</div>
  `;
}

function renderSettingsValues() {
  document.querySelector('#camera-speed-value').textContent = `${Number(project.settings.cameraSpeed).toFixed(1)}×`;
  document.querySelector('#display-duration-value').textContent = `${project.settings.displayDuration} sec`;
  document.querySelector('#transition-duration-value').textContent = `${project.settings.transitionDuration} sec`;
  document.querySelector('#zoom-strength-value').textContent = Number(project.settings.zoomStrength) < 0.52 ? 'Wide' : Number(project.settings.zoomStrength) > 0.70 ? 'Close' : 'Balanced';
  document.querySelector('#spacing-value').textContent = Number(project.settings.characterSpacing).toLocaleString();
}

function renderScene() {
  const frame = drawScene(canvas, project, playback.currentTime);
  const active = project.characters[frame.activeIndex];
  document.querySelector('#active-label').textContent = active ? `${active.name || 'Character'} · ${frame.activeIndex + 1} of ${project.characters.length}` : 'Add characters to begin';
  document.querySelector('#phase-label').textContent = playback.playing ? (frame.phase === 'transition' ? 'Moving to next character' : 'Character in focus') : 'Ready for preview';
  const duration = getTimelineDuration(project);
  const scrubber = document.querySelector('#timeline-scrubber');
  scrubber.max = Math.max(duration, 1);
  scrubber.value = playback.currentTime;
  document.querySelector('#current-time').textContent = formatTime(playback.currentTime);
  document.querySelector('#total-time').textContent = formatTime(duration);
  document.querySelector('#play-icon').textContent = playback.playing ? 'Ⅱ' : '▶';
  document.querySelector('#play-label').textContent = playback.playing ? 'Pause Preview' : 'Play Preview';
}

function stopPlayback() {
  playback.playing = false;
  cancelAnimationFrame(playback.frame);
  playback.frame = 0;
}

function playbackFrame(now) {
  if (!playback.playing) return;
  playback.currentTime = (now - playback.startAt) / 1000;
  const duration = getTimelineDuration(project);
  if (playback.currentTime >= duration) {
    playback.currentTime = duration;
    stopPlayback();
  }
  renderScene();
  if (playback.playing) playback.frame = requestAnimationFrame(playbackFrame);
}

function togglePlayback() {
  if (!project.characters.length) {
    setNotice('Add at least one character to preview the animation.', true);
    return;
  }
  if (playback.playing) {
    stopPlayback();
    renderScene();
    return;
  }
  if (playback.currentTime >= getTimelineDuration(project)) playback.currentTime = 0;
  playback.playing = true;
  playback.startAt = performance.now() - playback.currentTime * 1000;
  playback.frame = requestAnimationFrame(playbackFrame);
  renderScene();
}

function revokeCharacter(character) {
  releaseAsset(character.image);
  character.details.forEach((detail) => releaseAsset(detail.image));
}

async function useUploadedFile(file, onLoaded) {
  try {
    const asset = await createImageAsset(file);
    onLoaded(asset);
    setNotice(`${file.name} is ready (${asset.width} × ${asset.height}).`);
  } catch (error) {
    setNotice(error.message, true);
  }
}

function addCharacter() {
  const character = createCharacter(project.characters.length + 1);
  project.characters.push(character);
  project.selectedId = character.id;
  stopPlayback();
  renderCharacterList();
  renderEditor();
  playback.currentTime = 0;
  renderScene();
  document.querySelector(`[data-character-name="${character.id}"]`)?.focus();
}

function removeCharacter(id) {
  const index = project.characters.findIndex((character) => character.id === id);
  if (index < 0) return;
  revokeCharacter(project.characters[index]);
  project.characters.splice(index, 1);
  if (project.selectedId === id) project.selectedId = project.characters[Math.max(0, index - 1)]?.id ?? null;
  stopPlayback();
  playback.currentTime = 0;
  renderCharacterList();
  renderEditor();
  renderScene();
}

function addDetail(characterId) {
  const character = project.characters.find((item) => item.id === characterId);
  if (!character) return;
  character.details.push({ id: crypto.randomUUID(), label: `Detail ${character.details.length + 1}`, value: '', image: null });
  renderEditor();
  renderScene();
  editor.querySelector('.detail-card:last-child input')?.focus();
}

function moveDetail(characterId, detailId, direction) {
  const character = project.characters.find((item) => item.id === characterId);
  if (!character) return;
  const index = character.details.findIndex((item) => item.id === detailId);
  const destination = index + (direction === 'up' ? -1 : 1);
  if (index < 0 || destination < 0 || destination >= character.details.length) return;
  [character.details[index], character.details[destination]] = [character.details[destination], character.details[index]];
  renderEditor();
  renderScene();
}

async function uploadBackground(input) {
  const file = input.files?.[0];
  if (!file) return;
  await useUploadedFile(file, (asset) => {
    releaseAsset(project.background);
    project.background = asset;
    renderBackground();
    renderScene();
  });
  input.value = '';
}

async function uploadCharacterImage(input) {
  const id = input.dataset.characterUpload;
  const file = input.files?.[0];
  if (!file) return;
  await useUploadedFile(file, (asset) => {
    const character = project.characters.find((item) => item.id === id);
    if (!character) return releaseAsset(asset);
    releaseAsset(character.image);
    character.image = asset;
    renderEditor();
    renderCharacterList();
    renderScene();
  });
  input.value = '';
}

async function uploadDetailImage(input) {
  const characterId = input.dataset.detailUpload;
  const detailId = input.dataset.detailId;
  const file = input.files?.[0];
  if (!file) return;
  await useUploadedFile(file, (asset) => {
    const character = project.characters.find((item) => item.id === characterId);
    const detail = character?.details.find((item) => item.id === detailId);
    if (!detail) return releaseAsset(asset);
    releaseAsset(detail.image);
    detail.image = asset;
    renderEditor();
    renderScene();
  });
  input.value = '';
}

async function startVideoExport() {
  if (exportState.generating) return;
  stopPlayback();
  playback.currentTime = 0;
  renderScene();
  const snapshot = {
    background: project.background,
    settings: { ...project.settings },
    characters: project.characters.map((character) => ({
      ...character,
      position: { ...character.position },
      renderedDimensions: { ...character.renderedDimensions },
      details: character.details.map((detail) => ({ ...detail })),
    })),
  };
  const progress = document.querySelector('#export-progress');
  const fill = document.querySelector('#progress-fill');
  const value = document.querySelector('#progress-value');
  const label = document.querySelector('#progress-label');
  const button = document.querySelector('#generate-video');
  const result = document.querySelector('#video-result');

  exportState.generating = true;
  progress.hidden = false;
  button.disabled = true;
  result.hidden = true;
  setNotice('Preparing the scene for recording…');
  try {
    const blob = await generateVideo(snapshot, {
      resolution: document.querySelector('#export-resolution').value,
      fps: document.querySelector('#export-fps').value,
      onProgress: (amount) => {
        const percent = Math.round(amount * 100);
        fill.style.width = `${percent}%`;
        value.textContent = `${percent}%`;
        label.textContent = percent === 100 ? 'Finishing video…' : 'Rendering video';
      },
    });
    if (exportState.url) URL.revokeObjectURL(exportState.url);
    exportState.blob = blob;
    exportState.url = URL.createObjectURL(blob);
    result.innerHTML = `<div class="video-ready"><span>✓ Video ready</span><span>${(blob.size / (1024 * 1024)).toFixed(1)} MB · WebM</span></div><video controls playsinline src="${exportState.url}"></video><a class="button button-secondary download-button" href="${exportState.url}" download="character-comparison.webm">⬇ Download video</a>`;
    result.hidden = false;
    setNotice('Your WebM video is ready to preview or download.');
  } catch (error) {
    setNotice(error.message || 'The video could not be generated. Try a lower resolution or frame rate.', true);
  } finally {
    exportState.generating = false;
    progress.hidden = true;
    button.disabled = false;
  }
}

app.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, id, detailId, direction } = button.dataset;
  if (action === 'add-character') addCharacter();
  if (action === 'select-character') {
    project.selectedId = id;
    renderCharacterList();
    renderEditor();
  }
  if (action === 'remove-character') removeCharacter(id);
  if (action === 'remove-character-image') {
    const character = project.characters.find((item) => item.id === id);
    if (character) {
      releaseAsset(character.image);
      character.image = null;
      renderEditor();
      renderCharacterList();
      renderScene();
    }
  }
  if (action === 'remove-background') {
    releaseAsset(project.background);
    project.background = null;
    renderBackground();
    renderScene();
  }
  if (action === 'add-detail') addDetail(id);
  if (action === 'remove-detail') {
    const character = project.characters.find((item) => item.id === id);
    const index = character?.details.findIndex((item) => item.id === detailId) ?? -1;
    if (index >= 0) {
      releaseAsset(character.details[index].image);
      character.details.splice(index, 1);
      renderEditor();
      renderScene();
    }
  }
  if (action === 'remove-detail-image') {
    const character = project.characters.find((item) => item.id === id);
    const detail = character?.details.find((item) => item.id === detailId);
    if (detail) {
      releaseAsset(detail.image);
      detail.image = null;
      renderEditor();
      renderScene();
    }
  }
  if (action === 'move-detail') moveDetail(id, detailId, direction);
  if (action === 'toggle-play') togglePlayback();
  if (action === 'restart') {
    stopPlayback();
    playback.currentTime = 0;
    renderScene();
  }
  if (action === 'generate-video') startVideoExport();
});

app.addEventListener('input', (event) => {
  const { setting, characterName, detailField, id, detailId } = event.target.dataset;
  if (setting) {
    project.settings[setting] = ['detailAnimation', 'characterHighlight', 'motionGraphics'].includes(setting) ? event.target.value : Number(event.target.value);
    renderSettingsValues();
    renderScene();
    return;
  }
  if (characterName) {
    const character = project.characters.find((item) => item.id === characterName);
    if (character) {
      character.name = event.target.value;
      const label = characterList.querySelector(`[data-id="${character.id}"] .list-name`);
      if (label) label.textContent = character.name || `Character ${project.characters.indexOf(character) + 1}`;
      renderScene();
    }
    return;
  }
  if (detailField) {
    const character = project.characters.find((item) => item.id === id);
    const detail = character?.details.find((item) => item.id === detailId);
    if (detail) {
      detail[detailField] = event.target.value;
      renderScene();
    }
  }
});

app.addEventListener('change', (event) => {
  if (event.target.id === 'background-file') uploadBackground(event.target);
  if (event.target.matches('[data-character-upload]')) uploadCharacterImage(event.target);
  if (event.target.matches('[data-detail-upload]')) uploadDetailImage(event.target);
});

document.querySelector('#timeline-scrubber').addEventListener('input', (event) => {
  stopPlayback();
  playback.currentTime = Number(event.target.value);
  renderScene();
});

window.addEventListener('beforeunload', () => {
  releaseAsset(project.background);
  project.characters.forEach(revokeCharacter);
  if (exportState.url) URL.revokeObjectURL(exportState.url);
});

renderCharacterList();
renderEditor();
renderBackground();
renderSettingsValues();
renderScene();
