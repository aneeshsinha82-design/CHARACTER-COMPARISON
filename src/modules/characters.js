export function isImageFile(file) {
  return file.type.startsWith('image/');
}

export function createCharacter(file) {
  return {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^.]+$/, ''),
    fileName: file.name,
    imageUrl: URL.createObjectURL(file),
  };
}
