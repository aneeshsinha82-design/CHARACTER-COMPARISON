export const SCENE_WIDTH = 1920;
export const SCENE_HEIGHT = 1080;
const BASELINE = 875;
const imageCache = new Map();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smoothstep = (value) => value * value * (3 - 2 * value);

function getImage(asset) {
  const url = typeof asset === 'string' ? asset : asset?.url;
  if (!url) return null;
  if (asset?.imageElement?.complete && asset.imageElement.naturalWidth) return asset.imageElement;
  if (!imageCache.has(url)) {
    const image = new Image();
    image.src = url;
    imageCache.set(url, image);
  }
  const image = imageCache.get(url);
  return image.complete && image.naturalWidth ? image : null;
}

function detailBoxHeight(character) {
  return 88 + character.details.reduce((height, detail) => height + (detail.image ? 92 : 48), 0);
}

export function getSceneLayout(project) {
  const maxWidth = project.characters.reduce((max, character) => {
    const height = character.image ? Math.max(300, character.image.height * 0.5) : 580;
    const width = character.image ? height * character.image.width / character.image.height : height * 0.48;
    character.renderedDimensions = { width, height };
    return Math.max(max, width);
  }, 0);
  const gap = Math.max(Number(project.settings.characterSpacing) || 1050, maxWidth + 280);

  project.characters.forEach((character, index) => {
    const width = character.renderedDimensions.width || 278;
    const height = character.renderedDimensions.height || 580;
    const x = SCENE_WIDTH / 2 + index * gap;
    character.position = { x, y: BASELINE - height, baseline: BASELINE };
  });

  return {
    width: Math.max(SCENE_WIDTH, SCENE_WIDTH + Math.max(0, project.characters.length - 1) * gap),
    height: SCENE_HEIGHT,
    baseline: BASELINE,
    gap,
  };
}

function cameraTarget(character, zoomStrength) {
  const height = character.renderedDimensions.height || 580;
  const boxHeight = detailBoxHeight(character);
  const top = character.position.y - boxHeight - 44;
  const zoom = clamp((SCENE_HEIGHT * zoomStrength) / (BASELINE - top), 0.09, 3.2);
  return {
    x: character.position.x,
    y: (top + BASELINE) / 2,
    zoom,
  };
}

export function getTimelineDuration(project) {
  const count = project.characters.length;
  if (!count) return 0;
  const hold = Number(project.settings.displayDuration) || 4;
  const transition = (Number(project.settings.transitionDuration) || 2) / (Number(project.settings.cameraSpeed) || 1);
  return count * hold + Math.max(0, count - 1) * transition;
}

export function sampleTimeline(project, seconds) {
  const characters = project.characters;
  if (!characters.length) return { camera: { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2, zoom: 1 }, activeIndex: -1, phase: 'empty', progress: 0 };

  const hold = Number(project.settings.displayDuration) || 4;
  const transition = (Number(project.settings.transitionDuration) || 2) / (Number(project.settings.cameraSpeed) || 1);
  const duration = getTimelineDuration(project);
  let remaining = clamp(seconds, 0, duration);

  for (let index = 0; index < characters.length; index += 1) {
    const current = cameraTarget(characters[index], project.settings.zoomStrength);
    if (remaining <= hold || index === characters.length - 1) {
      return { camera: current, activeIndex: index, phase: 'hold', progress: duration ? clamp(seconds / duration, 0, 1) : 0 };
    }
    remaining -= hold;

    const next = cameraTarget(characters[index + 1], project.settings.zoomStrength);
    if (remaining <= transition) {
      const amount = smoothstep(transition ? remaining / transition : 1);
      return {
        camera: {
          x: next.x + (current.x - next.x) * amount,
          y: next.y + (current.y - next.y) * amount,
          zoom: next.zoom + (current.zoom - next.zoom) * amount,
        },
        activeIndex: remaining < transition * 0.5 ? index + 1 : index,
        phase: 'transition',
        progress: duration ? clamp(seconds / duration, 0, 1) : 0,
      };
    }
    remaining -= transition;
  }

  const last = characters.length - 1;
  return { camera: cameraTarget(characters[last], project.settings.zoomStrength), activeIndex: last, phase: 'hold', progress: 1 };
}

function drawCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawCharacter(ctx, character, isActive) {
  const { x } = character.position;
  const { width, height } = character.renderedDimensions;
  const image = getImage(character.image);
  ctx.save();
  ctx.globalAlpha = isActive ? 1 : 0.48;
  if (image) {
    ctx.drawImage(image, x - width / 2, BASELINE - height, width, height);
  } else {
    const head = Math.max(70, height * 0.16);
    const bodyTop = BASELINE - height + head * 1.2;
    ctx.strokeStyle = isActive ? '#f5f6ff' : '#b6bfd3';
    ctx.fillStyle = isActive ? '#edeaff' : '#cad0df';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(x, BASELINE - height + head / 2, head / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, bodyTop);
    ctx.lineTo(x, BASELINE - 170);
    ctx.moveTo(x, bodyTop + 25);
    ctx.lineTo(x - width * 0.28, BASELINE - 390);
    ctx.moveTo(x, bodyTop + 25);
    ctx.lineTo(x + width * 0.28, BASELINE - 390);
    ctx.moveTo(x, BASELINE - 170);
    ctx.lineTo(x - width * 0.22, BASELINE);
    ctx.moveTo(x, BASELINE - 170);
    ctx.lineTo(x + width * 0.22, BASELINE);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDetailCard(ctx, character) {
  const boxWidth = 460;
  const rowHeights = character.details.map((detail) => detail.image ? 88 : 48);
  const boxHeight = 82 + rowHeights.reduce((sum, height) => sum + height, 0);
  const boxX = character.position.x - boxWidth / 2;
  const boxY = character.position.y - boxHeight - 48;
  ctx.save();
  ctx.shadowColor = '#07142c44';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#dbe0eb';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 22);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#675ce4';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, 78, [22, 22, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 31px system-ui, sans-serif';
  ctx.fillText(character.name || 'Character', boxX + 28, boxY + 49, boxWidth - 56);

  let rowY = boxY + 82;
  character.details.forEach((detail, index) => {
    const rowHeight = rowHeights[index];
    if (index) {
      ctx.strokeStyle = '#edf0f5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(boxX + 20, rowY);
      ctx.lineTo(boxX + boxWidth - 20, rowY);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a3347';
    ctx.font = '600 23px system-ui, sans-serif';
    ctx.fillText(detail.label || `Detail ${index + 1}`, boxX + 28, rowY + 32, detail.image ? 260 : boxWidth - 56);
    if (detail.value) {
      ctx.fillStyle = '#687188';
      ctx.font = '400 21px system-ui, sans-serif';
      ctx.fillText(detail.value, boxX + 28, rowY + 58, detail.image ? 260 : boxWidth - 56);
    }
    if (detail.image) {
      const image = getImage(detail.image);
      if (image) drawCover(ctx, image, boxX + boxWidth - 112, rowY + 8, 82, 70);
    }
    rowY += rowHeight;
  });
  ctx.restore();
}

export function drawScene(canvas, project, seconds) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const scaleX = canvas.width / SCENE_WIDTH;
  const scaleY = canvas.height / SCENE_HEIGHT;
  const layout = getSceneLayout(project);
  const frame = sampleTimeline(project, seconds);
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  ctx.clearRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);

  const background = getImage(project.background);
  if (background) {
    const tiles = Math.max(1, Math.ceil(layout.width / SCENE_WIDTH));
    for (let index = 0; index < tiles; index += 1) drawCover(ctx, background, index * SCENE_WIDTH, 0, SCENE_WIDTH, SCENE_HEIGHT);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, SCENE_HEIGHT);
    gradient.addColorStop(0, '#eef0fb');
    gradient.addColorStop(1, '#ccd3e5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, Math.max(layout.width, SCENE_WIDTH), SCENE_HEIGHT);
    ctx.fillStyle = '#ffffff30';
    for (let index = 0; index < Math.ceil(layout.width / 220); index += 1) {
      ctx.fillRect(index * 220, 0, 2, SCENE_HEIGHT);
    }
  }

  ctx.setTransform(
    scaleX * frame.camera.zoom,
    0,
    0,
    scaleY * frame.camera.zoom,
    scaleX * (SCENE_WIDTH / 2 - frame.camera.x * frame.camera.zoom),
    scaleY * (SCENE_HEIGHT / 2 - frame.camera.y * frame.camera.zoom),
  );
  ctx.fillStyle = '#17233a22';
  ctx.fillRect(0, BASELINE, layout.width, 11);
  project.characters.forEach((character, index) => drawCharacter(ctx, character, index === frame.activeIndex));
  if (frame.activeIndex >= 0) drawDetailCard(ctx, project.characters[frame.activeIndex]);

  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  if (!project.characters.length) {
    ctx.fillStyle = '#4f5b75';
    ctx.textAlign = 'center';
    ctx.font = '600 36px system-ui, sans-serif';
    ctx.fillText('Add a character to start your scene', SCENE_WIDTH / 2, SCENE_HEIGHT / 2);
    ctx.textAlign = 'start';
  }
  return { ...frame, layout, duration: getTimelineDuration(project) };
}
