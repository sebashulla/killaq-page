import type { SocialVideo, VideoPlatform } from "@/types/catalog";

export function getVideoPlatformLabel(platform: VideoPlatform | SocialVideo["platform"]) {
  if (platform === "instagram") return "Instagram";
  if (platform === "tiktok") return "TikTok";
  if (platform === "upload") return "Video";
  return "Video externo";
}

export function isDirectVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);
}

export function getSocialEmbedSrc(url: string, platform?: string) {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return "";

  let parsed: URL;
  try { parsed = new URL(trimmedUrl); } catch { return ""; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return "";
  const host = parsed.hostname.toLowerCase();
  const instagramMatch = ["instagram.com", "www.instagram.com"].includes(host)
    ? parsed.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?(?:embed\/?)?$/)
    : null;
  if (instagramMatch) {
    return `https://www.instagram.com/${instagramMatch[1]}/${instagramMatch[2]}/embed`;
  }

  const tiktokMatch = ["tiktok.com", "www.tiktok.com"].includes(host)
    ? parsed.pathname.match(/^\/@[^/]+\/video\/(\d+)\/?$/) ||
      parsed.pathname.match(/^\/(?:embed\/v2|player\/v1)\/(\d+)\/?$/)
    : null;
  if (tiktokMatch) {
    return `https://www.tiktok.com/player/v1/${tiktokMatch[1]}?autoplay=0&rel=0`;
  }

  if (platform === "instagram" || platform === "tiktok") return "";
  // Unknown providers get a link, never an arbitrary third-party iframe.
  return "";
}
