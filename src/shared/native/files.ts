import { File } from 'expo-file-system';

/** The camera returns plain paths; expo-file-system and the video player want a file:// URI. */
export const toUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

export function deleteFile(path: string) {
  try {
    const file = new File(toUri(path));
    if (file.exists) file.delete();
  } catch (e) {
    console.warn(`Could not delete ${path}`, e);
  }
}

export function fileSize(path: string): number {
  try {
    return new File(toUri(path)).size ?? 0;
  } catch {
    return 0;
  }
}
