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

function detailRowHeight(detail) {
  return detail.image ? 110 : 72;
}

function detailBoxHeight(character) {
  const details = character.details;
  if (!details.length) return 98;
  return 115 + details.reduce((height, detail) => height + detailRowHeight(detail), 0) + (details.length - 1) * 12;
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
  if (!characters.length) return { camera: { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2, zoom: 1 }, activeIndex: -1, phase: 'empty', progress: 0, detailBorderProgress: 0 };

  const hold = Number(project.settings.displayDuration) || 4;
  const transition = (Number(project.settings.transitionDuration) || 2) / (Number(project.settings.cameraSpeed) || 1);
  const duration = getTimelineDuration(project);
  let remaining = clamp(seconds, 0, duration);

  for (let index = 0; index < characters.length; index += 1) {
    const current = cameraTarget(characters[index], project.settings.zoomStrength);
    if (remaining <= hold || index === characters.length - 1) {
      const holdElapsed = hold - remaining;
      return {
        camera: current,
        activeIndex: index,
        phase: 'hold',
        progress: duration ? clamp(seconds / duration, 0, 1) : 0,
        detailBorderProgress: clamp(holdElapsed / 0.85, 0, 1),
      };
    }
    remaining -= hold;

    const next = cameraTarget(characters[index + 1], project.settings.zoomStrength);
    if (remaining < transition) {
      const linearAmount = transition ? clamp(remaining / transition, 0, 1) : 1;
      const easedAmount = smoothstep(linearAmount);
      return {
        camera: {
          x: current.x + (next.x - current.x) * linearAmount,
          y: current.y + (next.y - current.y) * easedAmount,
          zoom: current.zoom + (next.zoom - current.zoom) * easedAmount,
        },
        activeIndex: index,
        phase: 'transition',
        progress: duration ? clamp(seconds / duration, 0, 1) : 0,
        detailBorderProgress: 1,
      };
    }
    remaining -= transition;
  }

  const last = characters.length - 1;
  return { camera: cameraTarget(characters[last], project.settings.zoomStrength), activeIndex: last, phase: 'hold', progress: 1, detailBorderProgress: 1 };
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


function traceRoundedRectReveal(ctx, x, y, width, height, radius, progress) {
  const points = [{ x: x + radius, y }];
  const addLine = (endX, endY) => points.push({ x: endX, y: endY });
  const addArc = (centerX, centerY, startAngle, endAngle) => {
    const steps = 16;
    for (let step = 1; step <= steps; step += 1) {
      const angle = startAngle + ((endAngle - startAngle) * step) / steps;
      points.push({ x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
    }
  };

  addLine(x + width - radius, y);
  addArc(x + width - radius, y + radius, -Math.PI / 2, 0);
  addLine(x + width, y + height - radius);
  addArc(x + width - radius, y + height - radius, 0, Math.PI / 2);
  addLine(x + radius, y + height);
  addArc(x + radius, y + height - radius, Math.PI / 2, Math.PI);
  addLine(x, y + radius);
  addArc(x + radius, y + radius, Math.PI, Math.PI * 1.5);

  const segments = [];
  let perimeter = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    segments.push({ from, to, length });
    perimeter += length;
  }

  let remaining = perimeter * clamp(progress, 0, 1);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const segment of segments) {
    if (remaining <= 0) break;
    const amount = Math.min(1, remaining / segment.length);
    ctx.lineTo(
      segment.from.x + (segment.to.x - segment.from.x) * amount,
      segment.from.y + (segment.to.y - segment.from.y) * amount,
    );
    remaining -= segment.length;
  }
  ctx.stroke();
}

function drawDetailCard(ctx, character, entranceProgress = 1, animationStyle = 'draw') {
  const boxWidth = 460;
  const rowHeights = character.details.map(detailRowHeight);
  const boxHeight = detailBoxHeight(character);
  const boxX = character.position.x - boxWidth / 2;
  const boxY = character.position.y - boxHeight - 48;
  ctx.save();
  const easedProgress = smoothstep(clamp(entranceProgress, 0, 1));
  const centerX = boxX + boxWidth / 2;
  const centerY = boxY + boxHeight / 2;
  if (animationStyle === 'fade') {
    ctx.globalAlpha *= easedProgress;
  } else if (animationStyle === 'slide-up') {
    ctx.translate(0, (1 - easedProgress) * 84);
  } else if (animationStyle === 'rise-fade') {
    ctx.globalAlpha *= easedProgress;
    ctx.translate(0, (1 - easedProgress) * 46);
  } else if (animationStyle === 'zoom') {
    const scale = 0.78 + easedProgress * 0.22;
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);
  } else if (animationStyle === 'wipe') {
    ctx.beginPath();
    ctx.rect(boxX - 2, boxY - 2, boxWidth + 4, (boxHeight + 4) * easedProgress);
    ctx.clip();
  } else if (animationStyle === 'spring') {
    const scale = 1 - 0.22 * Math.exp(-7 * easedProgress) * Math.cos(10 * easedProgress);
    ctx.globalAlpha *= easedProgress;
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);
  } else if (animationStyle === 'slide-left') {
    ctx.translate((1 - easedProgress) * -90, 0);
  }
  ctx.shadowColor = '#07142c44';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = 'rgba(8, 14, 29, 0.82)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 22);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(32, 64, 112, 0.78)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, 78, [22, 22, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 31px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(character.name || 'Character', boxX + boxWidth / 2, boxY + 49, boxWidth - 56);
  ctx.textAlign = 'start';

  const divider = ctx.createLinearGradient(boxX, 0, boxX + boxWidth, 0);
  divider.addColorStop(0, '#438cff');
  divider.addColorStop(0.5, '#67e7ff');
  divider.addColorStop(1, '#438cff');
  ctx.strokeStyle = divider;
  ctx.lineWidth = 4;
  ctx.shadowColor = '#49caff';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(boxX + 2, boxY + 78);
  ctx.lineTo(boxX + boxWidth - 2, boxY + 78);
  ctx.stroke();
  ctx.shadowColor = 'transparent';

  let rowY = boxY + 95;
  character.details.forEach((detail, index) => {
    const rowHeight = rowHeights[index];
    const rowX = boxX + 22;
    const rowWidth = boxWidth - 44;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.strokeStyle = 'rgba(139, 166, 208, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rowX, rowY, rowWidth, rowHeight, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f3f6ff';
    ctx.font = '600 23px system-ui, sans-serif';
    ctx.textAlign = detail.image ? 'start' : 'center';
    ctx.fillText(detail.label || `Detail ${index + 1}`, detail.image ? rowX + 18 : boxX + boxWidth / 2, rowY + (detail.value ? 29 : rowHeight / 2 + 8), detail.image ? 250 : rowWidth - 28);
    if (detail.value) {
      ctx.fillStyle = '#c7d7f2';
      ctx.font = '400 21px system-ui, sans-serif';
      ctx.fillText(detail.value, detail.image ? rowX + 18 : boxX + boxWidth / 2, rowY + 55, detail.image ? 250 : rowWidth - 28);
    }
    ctx.textAlign = 'start';
    if (detail.image) {
      const image = getImage(detail.image);
      if (image) drawCover(ctx, image, rowX + rowWidth - 102, rowY + 13, 80, 84);
    }
    rowY += rowHeight + 12;
  });

  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  const border = ctx.createLinearGradient(boxX, boxY, boxX + boxWidth, boxY + boxHeight);
  border.addColorStop(0, '#3987ff');
  border.addColorStop(0.5, '#67e7ff');
  border.addColorStop(1, '#3976df');
  ctx.strokeStyle = border;
  const borderProgress = animationStyle === 'draw' ? entranceProgress : 1;
  if (animationStyle === 'draw' && borderProgress < 1) {
    ctx.shadowColor = '#49caffaa';
    ctx.shadowBlur = 12;
  }
  traceRoundedRectReveal(ctx, boxX, boxY, boxWidth, boxHeight, 22, borderProgress);
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
  if (frame.activeIndex >= 0) drawDetailCard(ctx, project.characters[frame.activeIndex], frame.detailBorderProgress, project.settings.detailAnimation);

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
