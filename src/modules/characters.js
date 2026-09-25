const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function isImageFile(file) {
  return IMAGE_TYPES.has(file.type.toLowerCase());
}

export async function createImageAsset(file) {
  if (!isImageFile(file)) throw new Error('Choose a PNG, JPG, JPEG, or WebP image.');
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('This image could not be decoded.');
    return {
      id: crypto.randomUUID(),
      name: file.name,
      url,
      width: image.naturalWidth,
      height: image.naturalHeight,
      imageElement: image,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw new Error(error.message || 'This image could not be opened.');
  }
}

export function createCharacter(index) {
  return {
    id: crypto.randomUUID(),
    name: `Character ${index}`,
    image: null,
    position: { x: 0, y: 0 },
    renderedDimensions: { width: 0, height: 0 },
    details: [1, 2, 3].map((number) => ({
      id: crypto.randomUUID(),
      label: `Detail ${number}`,
      value: '',
      image: null,
    })),
    animation: { emphasis: 1 },
  };
}

export function releaseAsset(asset) {
  if (asset?.url) URL.revokeObjectURL(asset.url);
}
