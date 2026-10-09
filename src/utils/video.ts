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

  const instagramMatch = trimmedUrl.match(/instagram\.com\/(p|reel|tv)\/([^/?#]+)/i);
  if (instagramMatch) {
    return `https://www.instagram.com/${instagramMatch[1]}/${instagramMatch[2]}/embed`;
  }

  const tiktokMatch = trimmedUrl.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i) ||
    trimmedUrl.match(/tiktok\.com\/(?:embed\/v2\/)?(\d+)/i);
  if (tiktokMatch) {
    return `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`;
  }

  if (platform === "instagram" || platform === "tiktok") return "";
  return trimmedUrl;
}
