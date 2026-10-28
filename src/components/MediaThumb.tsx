/** Square thumbnail for a post/story: image if there is one, otherwise the first frame of the video. */
export function MediaThumb({ image, video, alt }: { image?: string; video?: string; alt: string }) {
  if (image) return <img src={image} alt={alt} loading="lazy" />
  if (video) return <video src={video} muted playsInline preload="metadata" aria-label={alt} />
  return <span className="thumb-empty" aria-label={alt} />
}
