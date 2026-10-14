export const SOCIAL_PROFILES = {
  instagram: {
    name: "Instagram",
    handle: "joyeria_killaq",
    url: "https://www.instagram.com/joyeria_killaq/",
  },
  tiktok: {
    name: "TikTok",
    handle: "killaq_joyas",
    url: "https://www.tiktok.com/@killaq_joyas",
  },
} as const;
export type SocialPlatform = keyof typeof SOCIAL_PROFILES;
export type SocialPost = {
  id: string;
  platform: SocialPlatform;
  title: string;
  url: string;
  postedAt?: string;
};
export type SocialChannel = {
  posts: SocialPost[];
  source: "api" | "manual" | "empty";
  available: boolean;
};
export type SocialFeed = {
  instagram: SocialChannel;
  tiktok: SocialChannel;
  refreshedAt: string;
};
export function canonicalSocialUrl(raw: unknown, platform: SocialPlatform) {
  try {
    const u = new URL(String(raw));
    if (u.protocol !== "https:" || u.username || u.password) return "";
    if (
      platform === "instagram" &&
      ["www.instagram.com", "instagram.com"].includes(u.hostname) &&
      /^\/(p|reel|tv)\/[\w-]+\/?$/.test(u.pathname)
    )
      return "https://www.instagram.com" + u.pathname.replace(/\/$/, "") + "/";
    if (
      platform === "tiktok" &&
      ["www.tiktok.com", "tiktok.com"].includes(u.hostname) &&
      /^\/@killaq_joyas\/video\/\d+\/?$/.test(u.pathname)
    )
      return "https://www.tiktok.com" + u.pathname.replace(/\/$/, "");
  } catch {}
  return "";
}
export function cleanSocialTitle(value: unknown, fallback: string) {
  return (
    (typeof value === "string"
      ? value
          .replace(/[\u0000-\u001f\u007f]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 150)
      : "") || fallback
  );
}
export function uniqueSocialPosts(posts: SocialPost[]) {
  const seen = new Set<string>();
  return posts
    .filter((post) => {
      if (seen.has(post.url)) return false;
      seen.add(post.url);
      return true;
    })
    .slice(0, 3);
}
