export const SCENE_WIDTH = 1920;
export const SCENE_HEIGHT = 1080;
const BASELINE = 875;
const imageCache = new Map();

const MOTION_GRAPHIC_FAMILIES = [
  { name: 'Orbit Flow', effect: 'orbit' },
  { name: 'Energy Burst', effect: 'burst' },
  { name: 'Velocity Lines', effect: 'speed' },
  { name: 'Hologram Scan', effect: 'scan' },
  { name: 'Particle Field', effect: 'particles' },
  { name: 'Lens Flare', effect: 'flare' },
  { name: 'Spotlight Sweep', effect: 'spotlight' },
  { name: 'Geometric Frame', effect: 'frame' },
  { name: 'Comet Spiral', effect: 'comets' },
  { name: 'Digital Rain', effect: 'rain' },
];
const MOTION_GRAPHIC_PALETTES = [
  { name: 'Arctic Cyan', primary: '89, 225, 255', secondary: '123, 150, 255', glow: '#59dcff' },
  { name: 'Electric Violet', primary: '167, 127, 255', secondary: '93, 185, 255', glow: '#9677ff' },
  { name: 'Solar Gold', primary: '255, 210, 104', secondary: '255, 137, 83', glow: '#ffc45e' },
  { name: 'Crimson Pulse', primary: '255, 105, 135', secondary: '255, 169, 92', glow: '#ff6486' },
  { name: 'Emerald Flux', primary: '92, 244, 190', secondary: '98, 191, 255', glow: '#5cf4be' },
  { name: 'Neon Magenta', primary: '255, 94, 222', secondary: '130, 114, 255', glow: '#ff5ede' },
  { name: 'Ice Blue', primary: '195, 244, 255', secondary: '89, 172, 255', glow: '#b5f1ff' },
  { name: 'Sunset Orange', primary: '255, 151, 88', secondary: '255, 92, 131', glow: '#ff9758' },
  { name: 'Lime Matrix', primary: '190, 255, 87', secondary: '57, 221, 184', glow: '#c4ff58' },
  { name: 'Starlight Silver', primary: '232, 241, 255', secondary: '150, 183, 255', glow: '#e8f1ff' },
];
export const MOTION_GRAPHIC_PRESETS = MOTION_GRAPHIC_FAMILIES.flatMap((family, familyIndex) =>
  MOTION_GRAPHIC_PALETTES.map((palette, paletteIndex) => ({
    id: `mg-${familyIndex + 1}-${paletteIndex + 1}`,
    family: family.name,
    effect: family.effect,
    palette,
    speed: 0.78 + paletteIndex * 0.055,
    intensity: 0.78 + (paletteIndex % 5) * 0.08,
  })),
);


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

function calloutBounds(character) {
  const height = character.renderedDimensions.height || 580;
  const headY = character.position.y + height * 0.1;
  const count = character.details?.length || 0;
  return {
    top: headY - 300,
    bottom: headY - 300 + Math.max(0, count - 1) * 72 + (count ? 104 : 0),
  };
}

function cameraTarget(character, zoomStrength, detailAnimation = 'draw') {
  let top;
  let bottom = BASELINE;
  if (detailAnimation === 'callouts' && character.details?.length) {
    const bounds = calloutBounds(character);
    top = bounds.top - 36;
    bottom = Math.max(BASELINE, bounds.bottom + 42);
  } else {
    const boxHeight = detailBoxHeight(character);
    top = character.position.y - boxHeight - 44;
  }
  const zoom = clamp((SCENE_HEIGHT * zoomStrength) / (bottom - top), 0.09, 3.2);
  return {
    x: character.position.x,
    y: (top + bottom) / 2,
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

function detailEntranceDuration(character, settings, hold) {
  if (settings.detailAnimation === 'name-then-slide') return Math.min(hold, Math.max(0.62, 0.38 + character.details.length * 0.24));
  if (settings.detailAnimation === 'callouts') return Math.min(hold, Math.max(0.8, 0.3 + character.details.length * 0.2));
  return 0.85;
}

export function sampleTimeline(project, seconds) {
  const characters = project.characters;
  if (!characters.length) return { camera: { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2, zoom: 1 }, activeIndex: -1, phase: 'empty', progress: 0, detailBorderProgress: 0, detailAnimationElapsed: 0, detailAnimationDuration: 0, turnSeconds: 0 };

  const hold = Number(project.settings.displayDuration) || 4;
  const transition = (Number(project.settings.transitionDuration) || 2) / (Number(project.settings.cameraSpeed) || 1);
  const duration = getTimelineDuration(project);
  let remaining = clamp(seconds, 0, duration);

  for (let index = 0; index < characters.length; index += 1) {
    const current = cameraTarget(characters[index], project.settings.zoomStrength, project.settings.detailAnimation);
    const entranceDuration = detailEntranceDuration(characters[index], project.settings, hold);
    if (remaining <= hold || index === characters.length - 1) {
      const holdElapsed = clamp(remaining, 0, hold);
      return {
        camera: current,
        activeIndex: index,
        phase: 'hold',
        progress: duration ? clamp(seconds / duration, 0, 1) : 0,
        detailBorderProgress: clamp(holdElapsed / entranceDuration, 0, 1),
        detailAnimationElapsed: holdElapsed,
        detailAnimationDuration: entranceDuration,
        turnSeconds: holdElapsed,
      };
    }
    remaining -= hold;

    const next = cameraTarget(characters[index + 1], project.settings.zoomStrength, project.settings.detailAnimation);
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
        detailAnimationElapsed: entranceDuration,
        detailAnimationDuration: entranceDuration,
        turnSeconds: hold,
      };
    }
    remaining -= transition;
  }

  const last = characters.length - 1;
  const entranceDuration = detailEntranceDuration(characters[last], project.settings, hold);
  return { camera: cameraTarget(characters[last], project.settings.zoomStrength, project.settings.detailAnimation), activeIndex: last, phase: 'hold', progress: 1, detailBorderProgress: 1, detailAnimationElapsed: entranceDuration, detailAnimationDuration: entranceDuration, turnSeconds: hold };
}

function drawCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawCharacterAura(ctx, character, innerColor, middleColor, radiusScale = 0.82) {
  const { x } = character.position;
  const { height } = character.renderedDimensions;
  const centerY = BASELINE - height * 0.48;
  const radius = height * radiusScale;
  const gradient = ctx.createRadialGradient(x, centerY, 0, x, centerY, radius);
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.48, middleColor);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, centerY - radius, radius * 2, radius * 2);
}

function drawHighlightRays(ctx, character) {
  const { x } = character.position;
  const { height } = character.renderedDimensions;
  const centerY = BASELINE - height * 0.82;
  ctx.save();
  ctx.strokeStyle = 'rgba(143, 200, 255, 0.64)';
  ctx.lineWidth = 7;
  ctx.shadowColor = '#6fbaff';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  for (let index = 0; index < 12; index += 1) {
    const angle = (Math.PI * 2 * index) / 12;
    const inner = height * 0.18;
    const outer = height * (index % 2 ? 0.25 : 0.29);
    ctx.moveTo(x + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
    ctx.lineTo(x + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
  }
  ctx.stroke();
  ctx.restore();
}

function drawHighlightSparkles(ctx, character, turnSeconds) {
  const { x } = character.position;
  const { width, height } = character.renderedDimensions;
  const sparkles = [
    [-0.42, 0.23, 15], [0.43, 0.18, 18], [-0.48, 0.43, 11], [0.49, 0.42, 12],
    [-0.35, 0.58, 10], [0.38, 0.61, 14], [-0.19, 0.12, 10], [0.2, 0.1, 11],
  ];
  ctx.save();
  sparkles.forEach(([offsetX, offsetY, size], index) => {
    const flicker = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(turnSeconds * 5 + index * 1.7));
    const sparkleX = x + width * offsetX;
    const sparkleY = BASELINE - height * offsetY;
    ctx.globalAlpha = flicker;
    ctx.fillStyle = index % 2 ? '#ffe59a' : '#aeeeff';
    ctx.beginPath();
    ctx.moveTo(sparkleX, sparkleY - size);
    ctx.quadraticCurveTo(sparkleX + 3, sparkleY - 3, sparkleX + size, sparkleY);
    ctx.quadraticCurveTo(sparkleX + 3, sparkleY + 3, sparkleX, sparkleY + size);
    ctx.quadraticCurveTo(sparkleX - 3, sparkleY + 3, sparkleX - size, sparkleY);
    ctx.quadraticCurveTo(sparkleX - 3, sparkleY - 3, sparkleX, sparkleY - size);
    ctx.fill();
  });
  ctx.restore();
}

function drawMotionGraphics(ctx, presetId, character, seconds) {
  if (!presetId || presetId === 'none' || !character) return;
  const preset = MOTION_GRAPHIC_PRESETS.find((item) => item.id === presetId);
  if (!preset) return;
  const { x } = character.position;
  const height = character.renderedDimensions.height || 580;
  const centerY = BASELINE - height * 0.58;
  const phase = seconds * Math.PI * 2 * preset.speed;
  const pulse = 0.5 + 0.5 * Math.sin(phase * 0.72);
  const { effect, palette, intensity } = preset;
  const colorA = (alpha) => `rgba(${palette.primary}, ${alpha * intensity})`;
  const colorB = (alpha) => `rgba(${palette.secondary}, ${alpha * intensity})`;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (effect === 'orbit') {
    ctx.translate(x, centerY);
    for (let index = 0; index < 3; index += 1) {
      ctx.save();
      ctx.rotate(phase * (index % 2 ? -0.035 : 0.035) + index * 0.72);
      ctx.beginPath();
      ctx.ellipse(0, 0, height * (0.58 + index * 0.13), height * (0.17 + index * 0.035), 0, 0, Math.PI * 2);
      ctx.strokeStyle = index % 2 ? colorA(0.72) : colorB(0.68);
      ctx.lineWidth = 5;
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 18;
      ctx.setLineDash([110, 58]);
      ctx.lineDashOffset = -seconds * 95 * preset.speed;
      ctx.stroke();
      ctx.restore();
    }
  } else if (effect === 'burst') {
    ctx.translate(x, centerY);
    for (let index = 0; index < 24; index += 1) {
      const angle = index / 24 * Math.PI * 2 + phase * 0.035;
      const inner = height * (0.62 + pulse * 0.035);
      const outer = height * (0.75 + (index % 3) * 0.05 + pulse * 0.05);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.strokeStyle = index % 2 ? colorA(0.72) : colorB(0.66);
      ctx.lineWidth = index % 4 === 0 ? 7 : 4;
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 14;
      ctx.stroke();
    }
  } else if (effect === 'speed') {
    const span = 1550;
    ctx.lineWidth = 4;
    for (let index = 0; index < 22; index += 1) {
      const baseX = x - span / 2 + (index * 173 + seconds * (330 + index % 4 * 90) * preset.speed) % span;
      const y = centerY - height * 0.62 + (index * 89) % Math.max(180, height * 1.18);
      const length = 80 + (index % 5) * 34;
      const gradient = ctx.createLinearGradient(baseX - length, y, baseX + length, y);
      gradient.addColorStop(0, colorA(0));
      gradient.addColorStop(0.5, colorA(0.62));
      gradient.addColorStop(1, colorA(0));
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(baseX - length, y);
      ctx.lineTo(baseX + length, y);
      ctx.stroke();
    }
  } else if (effect === 'scan') {
    const scanY = BASELINE - height + ((seconds * 260 * preset.speed) % height);
    const gradient = ctx.createLinearGradient(x - height * 0.65, scanY, x + height * 0.65, scanY);
    gradient.addColorStop(0, colorA(0));
    gradient.addColorStop(0.5, colorA(0.5));
    gradient.addColorStop(1, colorA(0));
    ctx.fillStyle = gradient;
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 18;
    ctx.fillRect(x - height * 0.65, scanY - 4, height * 1.3, 8);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = colorB(0.16);
    ctx.lineWidth = 2;
    for (let index = 0; index < 9; index += 1) {
      const y = BASELINE - height + index * height / 8;
      ctx.beginPath();
      ctx.moveTo(x - height * 0.5, y);
      ctx.lineTo(x + height * 0.5, y);
      ctx.stroke();
    }
  } else if (effect === 'particles') {
    for (let index = 0; index < 36; index += 1) {
      const angle = index * 2.399963 + phase * (index % 2 ? 0.045 : -0.035);
      const radius = height * (0.42 + (index % 7) * 0.075);
      const drift = Math.sin(phase * 0.3 + index * 1.7) * height * 0.045;
      const px = x + Math.cos(angle) * radius;
      const py = centerY + Math.sin(angle) * radius * 0.72 + drift;
      const size = 3 + (index % 4) + pulse * 2;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fillStyle = index % 3 ? colorA(0.82) : colorB(0.86);
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 14;
      ctx.fill();
    }
  } else if (effect === 'flare') {
    const flareX = x + Math.sin(phase * 0.3) * height * 0.32;
    const flareY = centerY - height * 0.12;
    const beam = ctx.createLinearGradient(x - height, flareY, x + height, flareY);
    beam.addColorStop(0, colorA(0));
    beam.addColorStop(0.48, colorA(0.12));
    beam.addColorStop(0.5, colorA(0.62));
    beam.addColorStop(0.52, colorA(0.12));
    beam.addColorStop(1, colorA(0));
    ctx.fillStyle = beam;
    ctx.fillRect(x - height, flareY - 8, height * 2, 16);
    const glow = ctx.createRadialGradient(flareX, flareY, 0, flareX, flareY, height * 0.18);
    glow.addColorStop(0, colorA(0.78));
    glow.addColorStop(0.22, colorB(0.34));
    glow.addColorStop(1, colorA(0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(flareX, flareY, height * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (effect === 'spotlight') {
    const sweepX = x + Math.sin(phase * 0.24) * height * 0.52;
    const gradient = ctx.createRadialGradient(sweepX, BASELINE - height * 0.68, 0, sweepX, BASELINE - height * 0.68, height * 1.1);
    gradient.addColorStop(0, colorA(0.26));
    gradient.addColorStop(0.42, colorB(0.15));
    gradient.addColorStop(1, colorA(0));
    ctx.fillStyle = gradient;
    ctx.fillRect(x - height * 1.15, BASELINE - height * 1.65, height * 2.3, height * 1.8);
  } else if (effect === 'frame') {
    const halfW = height * (0.48 + pulse * 0.025);
    const top = BASELINE - height * 1.02;
    const bottom = BASELINE - height * 0.02;
    const corner = height * 0.2;
    ctx.strokeStyle = colorA(0.82);
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 7;
    for (const side of [-1, 1]) {
      for (const vertical of [top, bottom]) {
        const px = x + side * halfW;
        const py = vertical === top ? top : bottom;
        ctx.beginPath();
        ctx.moveTo(px - side * corner, py);
        ctx.lineTo(px, py);
        ctx.lineTo(px, py + (vertical === top ? corner : -corner));
        ctx.stroke();
      }
    }
  } else if (effect === 'comets') {
    ctx.translate(x, centerY);
    for (let index = 0; index < 5; index += 1) {
      const angle = phase * (0.11 + index * 0.012) + index * Math.PI * 0.4;
      const rx = height * (0.42 + index * 0.075);
      const ry = height * (0.3 + index * 0.045);
      const px = Math.cos(angle) * rx;
      const py = Math.sin(angle) * ry;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, angle * 0.15, angle, angle + 0.7);
      ctx.strokeStyle = index % 2 ? colorA(0.62) : colorB(0.72);
      ctx.lineWidth = 5 - index % 3;
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 8 + pulse * 4, 0, Math.PI * 2);
      ctx.fillStyle = colorA(0.95);
      ctx.fill();
    }
  } else if (effect === 'rain') {
    const columns = 17;
    for (let index = 0; index < columns; index += 1) {
      const px = x - height * 0.72 + index * height * 1.44 / (columns - 1);
      const trail = height * 0.42 + (index % 5) * height * 0.07;
      const travel = (seconds * (190 + (index % 4) * 55) * preset.speed + index * 151) % (height * 1.35);
      const py = BASELINE - height + travel;
      const gradient = ctx.createLinearGradient(px, py - trail, px, py);
      gradient.addColorStop(0, colorA(0));
      gradient.addColorStop(1, colorA(0.8));
      ctx.strokeStyle = gradient;
      ctx.lineWidth = index % 3 === 0 ? 5 : 3;
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(px, py - trail);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function drawCharacter(ctx, character, isActive, highlightStyle = 'none', turnSeconds = 0) {
  const { x } = character.position;
  const { width, height } = character.renderedDimensions;
  const image = getImage(character.image);
  ctx.save();
  ctx.globalAlpha = isActive ? 1 : highlightStyle === 'focus' ? 0.24 : 0.48;
  if (isActive) {
    if (highlightStyle === 'soft-glow') drawCharacterAura(ctx, character, 'rgba(156, 139, 255, 0.3)', 'rgba(115, 99, 242, 0.16)');
    if (highlightStyle === 'cyan-aura') drawCharacterAura(ctx, character, 'rgba(100, 239, 255, 0.34)', 'rgba(41, 169, 255, 0.18)');
    if (highlightStyle === 'gold-aura') drawCharacterAura(ctx, character, 'rgba(255, 221, 132, 0.34)', 'rgba(255, 166, 63, 0.18)');
    if (highlightStyle === 'spotlight') drawCharacterAura(ctx, character, 'rgba(233, 244, 255, 0.38)', 'rgba(123, 170, 255, 0.15)', 1.12);
    if (highlightStyle === 'halo') {
      const ringScale = 1 + 0.04 * Math.sin(turnSeconds * 3.5);
      ctx.save();
      ctx.strokeStyle = '#62e4ff';
      ctx.lineWidth = 8;
      ctx.shadowColor = '#45cfff';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.ellipse(x, BASELINE - 10, width * 0.54 * ringScale, height * 0.045 * ringScale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (highlightStyle === 'rays') drawHighlightRays(ctx, character);
    if (highlightStyle === 'sparkles') drawHighlightSparkles(ctx, character, turnSeconds);
    if (highlightStyle === 'shimmer') {
      const sweepX = x + Math.sin(turnSeconds * 1.8) * width * 0.64;
      const shimmer = ctx.createLinearGradient(sweepX - 34, 0, sweepX + 34, 0);
      shimmer.addColorStop(0, 'rgba(102, 230, 255, 0)');
      shimmer.addColorStop(0.5, 'rgba(125, 235, 255, 0.38)');
      shimmer.addColorStop(1, 'rgba(102, 230, 255, 0)');
      ctx.fillStyle = shimmer;
      ctx.fillRect(sweepX - 34, BASELINE - height, 68, height);
    }

    let scale = 1;
    let lift = 0;
    if (highlightStyle === 'pulse') scale = 1 + 0.03 * (0.5 + 0.5 * Math.sin(turnSeconds * Math.PI * 2 / 1.35));
    if (highlightStyle === 'bounce') lift = Math.abs(Math.sin(turnSeconds * Math.PI * 2 / 1.25)) * height * 0.025;
    if (highlightStyle === 'bounce') ctx.translate(0, -lift);
    if (highlightStyle === 'bounce') scale = 1 + lift / Math.max(height, 1) * 0.3;
    if (scale !== 1) {
      ctx.translate(x, BASELINE);
      ctx.scale(scale, scale);
      ctx.translate(-x, -BASELINE);
    }
    if (highlightStyle === 'color-pop' && 'filter' in ctx) ctx.filter = 'saturate(1.45) contrast(1.05)';
  }
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

function drawDetailCallouts(ctx, character, animationElapsed, animationDuration) {
  const details = character.details || [];
  if (!details.length) return;
  const cardWidth = 360;
  const headX = character.position.x;
  const headY = character.position.y + character.renderedDimensions.height * 0.1;
  const top = { x: headX - 100, y: headY - 300 };
  const bottom = { x: headX + 42, y: headY + 34 };
  const startTime = 0.12;
  const sequenceWindow = Math.max(0.12, animationDuration - startTime);
  const step = sequenceWindow / details.length;

  const pointsFor = (detail, index) => {
    const cardHeight = detail.image ? 104 : 82;
    const side = index % 2 === 0 ? 1 : -1;
    const cardX = side > 0 ? headX + 270 : headX - 270 - cardWidth;
    const cardY = headY - 300 + index * 72;
    const centerY = cardY + cardHeight / 2;
    const trunkT = clamp((centerY - top.y) / (bottom.y - top.y), 0, 1);
    const junction = { x: top.x + (bottom.x - top.x) * trunkT, y: centerY };
    const edgeX = side > 0 ? cardX : cardX + cardWidth;
    return { cardHeight, cardX, cardY, side, centerY, junction, edgeX };
  };

  ctx.save();
  ctx.strokeStyle = '#76d8ff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#42caff';
  ctx.shadowBlur = 10;
  const trunkProgress = smoothstep(clamp((animationElapsed - startTime * 0.45) / Math.max(0.12, animationDuration * 0.38), 0, 1));
  const trunkEnd = {
    x: bottom.x + (top.x - bottom.x) * trunkProgress,
    y: bottom.y + (top.y - bottom.y) * trunkProgress,
  };
  ctx.beginPath();
  ctx.moveTo(bottom.x, bottom.y);
  ctx.lineTo(trunkEnd.x, trunkEnd.y);
  ctx.stroke();
  ctx.restore();

  details.forEach((detail, index) => {
    const layout = pointsFor(detail, index);
    const localStart = startTime + index * step;
    const itemDuration = Math.min(0.34, Math.max(0.16, step * 0.8));
    const progress = smoothstep(clamp((animationElapsed - localStart) / itemDuration, 0, 1));
    const branchProgress = smoothstep(clamp((progress - 0.08) / 0.52, 0, 1));

    ctx.save();
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#76d8ff';
    ctx.shadowColor = '#42caff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(layout.junction.x, layout.junction.y);
    ctx.lineTo(layout.junction.x + (layout.edgeX - layout.junction.x) * branchProgress, layout.centerY);
    ctx.stroke();
    ctx.restore();

    const cardProgress = smoothstep(clamp((progress - 0.28) / 0.72, 0, 1));
    if (cardProgress <= 0) return;
    const { cardHeight, cardX, cardY, side } = layout;
    ctx.save();
    ctx.globalAlpha *= cardProgress;
    ctx.translate((1 - cardProgress) * side * -22, (1 - cardProgress) * 8);
    ctx.shadowColor = '#07142c88';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = 'rgba(11, 20, 38, 0.42)';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 17);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#76d8ff';
    ctx.fillRect(side > 0 ? cardX : cardX + cardWidth - 5, cardY + 14, 5, cardHeight - 28);
    const imageSpace = detail.image ? 70 : 0;
    ctx.textAlign = 'start';
    ctx.fillStyle = '#f6f9ff';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(detail.label || `Detail ${index + 1}`, cardX + 22, cardY + (detail.value ? 34 : cardHeight / 2 + 8), cardWidth - imageSpace - 44);
    if (detail.value) {
      ctx.fillStyle = '#cad8ef';
      ctx.font = '400 19px system-ui, sans-serif';
      ctx.fillText(detail.value, cardX + 22, cardY + 62, cardWidth - imageSpace - 44);
    }
    if (detail.image) {
      const image = getImage(detail.image);
      if (image) {
        const fit = Math.min(58 / image.naturalWidth, 72 / image.naturalHeight);
        const width = image.naturalWidth * fit;
        const height = image.naturalHeight * fit;
        ctx.drawImage(image, cardX + cardWidth - width - 16, cardY + (cardHeight - height) / 2, width, height);
      }
    }
    ctx.restore();
  });
}
function drawDetailCard(ctx, character, entranceProgress = 1, animationStyle = 'draw', animationElapsed = 0, animationDuration = 0.85) {
  if (animationStyle === 'callouts') {
    drawDetailCallouts(ctx, character, animationElapsed, animationDuration);
    return;
  }
  const boxWidth = 460;
  const rowHeights = character.details.map(detailRowHeight);
  const boxHeight = detailBoxHeight(character);
  const boxX = character.position.x - boxWidth / 2;
  const boxY = character.position.y - boxHeight - 48;
  ctx.save();
  const easedProgress = smoothstep(clamp(entranceProgress, 0, 1));
  const sequentialReveal = animationStyle === 'name-then-slide';
  const panelAlpha = sequentialReveal ? smoothstep(clamp(animationElapsed / Math.min(0.22, animationDuration * 0.3), 0, 1)) : 1;
  if (sequentialReveal) ctx.globalAlpha *= panelAlpha;
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
  ctx.fillStyle = 'rgba(8, 14, 29, 0.44)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 22);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, 78, [22, 22, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 31px system-ui, sans-serif';
  ctx.textAlign = 'center';
  if (sequentialReveal) {
    const nameStart = Math.min(0.08, animationDuration * 0.12);
    const nameEnd = Math.min(0.3, animationDuration * 0.34);
    ctx.globalAlpha = panelAlpha * smoothstep(clamp((animationElapsed - nameStart) / Math.max(0.01, nameEnd - nameStart), 0, 1));
  }
  ctx.fillText(character.name || 'Character', boxX + boxWidth / 2, boxY + 49, boxWidth - 56);
  ctx.textAlign = 'start';
  if (sequentialReveal) ctx.globalAlpha = panelAlpha;

  const divider = ctx.createLinearGradient(boxX, 0, boxX + boxWidth, 0);
  divider.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
  divider.addColorStop(0.5, 'rgba(255, 255, 255, 0.82)');
  divider.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
  ctx.strokeStyle = divider;
  ctx.lineWidth = 4;
  ctx.shadowColor = '#49caff';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(boxX + 2, boxY + 78);
  ctx.lineTo(boxX + boxWidth - 2, boxY + 78);
  ctx.stroke();
  ctx.shadowColor = 'transparent';

  const rowsTop = boxY + 95;
  let rowY = rowsTop;
  const rowsWindowStart = Math.min(0.4, animationDuration * 0.4);
  const rowsWindow = Math.max(0.05, animationDuration - rowsWindowStart);
  const rowDuration = Math.min(0.26, rowsWindow * 0.75);
  const rowStagger = character.details.length > 1 ? Math.max(0, (rowsWindow - rowDuration) / (character.details.length - 1)) : 0;
  character.details.forEach((detail, index) => {
    const rowHeight = rowHeights[index];
    const rowX = boxX + 22;
    const rowWidth = boxWidth - 44;
    let rowProgress = 1;
    if (sequentialReveal) {
      const rowStart = rowsWindowStart + index * rowStagger;
      rowProgress = smoothstep(clamp((animationElapsed - rowStart) / rowDuration, 0, 1));
      ctx.save();
      ctx.beginPath();
      ctx.rect(rowX, rowY, rowWidth, rowHeight);
      ctx.clip();
      ctx.translate(0, -(1 - rowProgress) * (rowY - rowsTop + rowHeight * 0.85));
      ctx.globalAlpha = panelAlpha * rowProgress;
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
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
    if (sequentialReveal) ctx.restore();
    rowY += rowHeight + 12;
  });

  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.setLineDash([9, 7]);
  const border = ctx.createLinearGradient(boxX, boxY, boxX + boxWidth, boxY + boxHeight);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
  if (sequentialReveal) ctx.globalAlpha = panelAlpha;
  const borderProgress = animationStyle === 'draw' ? entranceProgress : 1;
  if (animationStyle === 'draw' && borderProgress < 1) {
    ctx.shadowColor = '#49caffaa';
    ctx.shadowBlur = 12;
  }
  traceRoundedRectReveal(ctx, boxX, boxY, boxWidth, boxHeight, 22, borderProgress);
  ctx.setLineDash([]);
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
  const highlight = project.settings.characterHighlight || 'none';
  if (frame.activeIndex >= 0) drawMotionGraphics(ctx, project.settings.motionGraphics, project.characters[frame.activeIndex], seconds);
  project.characters.forEach((character, index) => drawCharacter(ctx, character, index === frame.activeIndex, highlight, frame.turnSeconds));
  if (frame.activeIndex >= 0) drawDetailCard(ctx, project.characters[frame.activeIndex], frame.detailBorderProgress, project.settings.detailAnimation, frame.detailAnimationElapsed, frame.detailAnimationDuration);

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
