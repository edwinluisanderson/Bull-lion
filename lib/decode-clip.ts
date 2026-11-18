/** Fetch and decode one clip. A bad file returns null and leaves the others alone. */
export async function decodeSoundClip(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    if (typeof ctx.decodeAudioData !== "function") return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await ctx.decodeAudioData((await response.arrayBuffer()).slice(0));
  } catch {
    return null;
  }
}
