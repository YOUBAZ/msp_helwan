/** Load an image file in the browser, with friendly errors. */
async function decode(file: File, maxBytes: number): Promise<{ img: HTMLImageElement; done: () => void }> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > maxBytes) {
    throw new Error(`That image is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("This image couldn't be read. Try a JPG or PNG."));
      i.src = url;
    });
    return { img, done: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** Draw part of an image onto a white canvas of the given size and export JPEG. */
function toJpeg(
  img: HTMLImageElement,
  src: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs get a white background
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't process the image."))),
      "image/jpeg",
      quality,
    ),
  );
}

/**
 * Crop an image file to a centred square and shrink it to `size` px,
 * returning a JPEG blob (~50 KB). Used for profile photos.
 */
export async function squareJpeg(file: File, size = 512): Promise<Blob> {
  const { img, done } = await decode(file, 15 * 1024 * 1024);
  try {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(size, side);
    return await toJpeg(
      img,
      { x: (img.naturalWidth - side) / 2, y: (img.naturalHeight - side) / 2, w: side, h: side },
      out,
      out,
      0.85,
    );
  } finally {
    done();
  }
}

/** Size of an image scaled down (never up) so its longest side is `maxSide`. */
function fit(w: number, h: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))] as const;
}

/**
 * Make the two JPEG versions of a Media photo (no cropping) from a single
 * decode of the file: `full` for the viewer, `small` for album cards.
 */
export async function photoVersions(
  file: File,
  sizes: { full: number; small: number } = { full: 1600, small: 600 },
): Promise<{ full: Blob; small: Blob }> {
  const { img, done } = await decode(file, 40 * 1024 * 1024);
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const whole = { x: 0, y: 0, w, h };
    const [fw, fh] = fit(w, h, sizes.full);
    const full = await toJpeg(img, whole, fw, fh, 0.82);
    const [sw, sh] = fit(w, h, sizes.small);
    const small = await toJpeg(img, whole, sw, sh, 0.8);
    return { full, small };
  } finally {
    done();
  }
}
