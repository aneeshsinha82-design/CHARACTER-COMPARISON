import { drawScene, getTimelineDuration, SCENE_HEIGHT, SCENE_WIDTH } from './scene.js';

function supportedMimeType() {
  if (typeof MediaRecorder === 'undefined') throw new Error('Video recording is not available in this browser. Try the latest version of Chrome.');
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const type = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!type) throw new Error('This browser does not support WebM video recording.');
  return type;
}

export function generateVideo(project, { resolution, fps, onProgress }) {
  return new Promise((resolve, reject) => {
    try {
      if (!project.characters.length) throw new Error('Add at least one character before generating a video.');
      const mimeType = supportedMimeType();
      const duration = getTimelineDuration(project);
      const [width, height] = resolution.split('x').map(Number);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const stream = canvas.captureStream(Number(fps));
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      let animationFrame = 0;
      let start = 0;

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error('The browser stopped recording before the video was complete.'));
      recorder.onstop = () => {
        cancelAnimationFrame(animationFrame);
        stream.getTracks().forEach((track) => track.stop());
        if (!chunks.length) return reject(new Error('The video export finished without recording any frames.'));
        resolve(new Blob(chunks, { type: mimeType }));
      };

      drawScene(canvas, project, 0);
      recorder.start(200);
      start = performance.now();

      const render = (now) => {
        const elapsed = Math.min(duration, (now - start) / 1000);
        drawScene(canvas, project, elapsed);
        onProgress(duration ? elapsed / duration : 1);
        if (elapsed >= duration) {
          recorder.stop();
          return;
        }
        animationFrame = requestAnimationFrame(render);
      };
      animationFrame = requestAnimationFrame(render);
    } catch (error) {
      reject(error);
    }
  });
}

export { SCENE_WIDTH, SCENE_HEIGHT };
