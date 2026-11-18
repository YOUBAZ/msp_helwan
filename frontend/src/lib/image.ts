/**
 * Crop an image file to a centred square and shrink it to `size` px,
 * returning a JPEG blob (~50 KB). Done in the browser so uploads are small.
 */
export async function squareJpeg(file: File, size = 512): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That image is too large (max 15 MB).");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("This image couldn't be read. Try a JPG or PNG."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(size, side);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // transparent PNGs get a white background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Couldn't process the image."))),
        "image/jpeg",
        0.85,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
