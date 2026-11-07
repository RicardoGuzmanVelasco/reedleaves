import imageManifest from "./generated/image-manifest.mjs";

// Only app-owned paths in the build manifest receive a content version.
export function imageUrl(path) {
  const hash = imageManifest[path];
  return hash ? `${path}?content=${hash}` : path;
}
