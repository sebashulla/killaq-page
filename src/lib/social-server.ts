import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  canonicalSocialUrl,
  cleanSocialTitle,
  uniqueSocialPosts,
  type SocialChannel,
  type SocialFeed,
  type SocialPlatform,
  type SocialPost,
} from "./social-core";
type RecordValue = Record<string, unknown>;
let cached: { value: SocialFeed; expires: number } | undefined;
let pending: Promise<SocialFeed> | undefined;
async function json(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Social provider unavailable");
  const value = await response.json();
  if (value.error && value.error.code !== "ok")
    throw new Error("Social provider rejected request");
  return value;
}
async function official(
  platform: SocialPlatform,
): Promise<SocialPost[] | null> {
  if (platform === "tiktok") {
    const token = process.env.TIKTOK_DISPLAY_ACCESS_TOKEN;
    if (!token) return null;
    const value = await json(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,share_url",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ max_count: 3 }),
      },
    );
    if (!Array.isArray(value.data?.videos))
      throw Error("Invalid social response");
    const posts = uniqueSocialPosts(
      value.data.videos
        .map((v: RecordValue) => ({
          id: String(v.id),
          platform,
          url: canonicalSocialUrl(v.share_url, platform),
          title: cleanSocialTitle(v.title, "Video de KILLAQ"),
          postedAt:
            typeof v.create_time === "number" && Number.isFinite(v.create_time)
              ? new Date(v.create_time * 1000).toISOString()
              : undefined,
        }))
        .filter((v: SocialPost) => v.url),
    );
    if (value.data.videos.length && !posts.length)
      throw Error("Unexpected social account");
    return posts;
  }
  const token = process.env.INSTAGRAM_ACCESS_TOKEN,
    userId = process.env.INSTAGRAM_USER_ID,
    version = process.env.INSTAGRAM_API_VERSION;
  if (!token || !userId || !version) return null;
  if (!/^\d+$/.test(userId) || !/^v\d{2}\.\d+$/.test(version))
    throw Error("Invalid social configuration");
  const root = `https://graph.instagram.com/${version}/${userId}`;
  const options = { headers: { Authorization: `Bearer ${token}` } };
  const identity = await json(root + "?fields=username", options);
  if (identity.username !== "joyeria_killaq")
    throw Error("Unexpected social account");
  const value = await json(
    root + "/media?fields=id,permalink,media_type,timestamp&limit=25",
    options,
  );
  if (!Array.isArray(value.data)) throw Error("Invalid social response");
  // Meta does not offer custom ordering. These are the newest timestamps in the returned page,
  // labelled 'recent', not an assertion that the complete account was enumerated.
  const posts: SocialPost[] = value.data
    .map((v: RecordValue) => ({
      id: String(v.id),
      platform,
      url: canonicalSocialUrl(v.permalink, platform),
      title:
        v.media_type === "VIDEO" ? "Reel de KILLAQ" : "Publicación de KILLAQ",
      postedAt:
        typeof v.timestamp === "string" &&
        Number.isFinite(Date.parse(v.timestamp))
          ? new Date(v.timestamp).toISOString()
          : undefined,
    }))
    .filter((v: SocialPost) => v.url && v.postedAt);
  return uniqueSocialPosts(
    posts.sort((a, b) => Date.parse(b.postedAt!) - Date.parse(a.postedAt!)),
  );
}
async function manual(platform: SocialPlatform): Promise<SocialPost[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(7000) }),
    },
  });
  const result = await db
    .from("social_videos")
    .select("id,title,video_url")
    .eq("platform", platform)
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at", { ascending: false })
    .limit(12);
  if (result.error) throw Error("Social selection unavailable");
  return uniqueSocialPosts(
    (result.data || [])
      .map((v) => ({
        id: String(v.id),
        platform,
        title: cleanSocialTitle(v.title, "KILLAQ en " + platform),
        url: canonicalSocialUrl(v.video_url, platform),
      }))
      .filter((v) => v.url),
  );
}
async function channel(platform: SocialPlatform): Promise<SocialChannel> {
  try {
    const posts = await official(platform);
    if (posts !== null) return { posts, source: "api", available: true };
  } catch {
    /* Expired credentials never erase the owner's curated selection. */
  }
  try {
    const posts = await manual(platform);
    return {
      posts,
      source: posts.length ? "manual" : "empty",
      available: true,
    };
  } catch {
    return { posts: [], source: "empty", available: false };
  }
}
export async function getSocialFeed() {
  if (cached && cached.expires > Date.now()) return cached.value;
  if (pending) return pending;
  pending = Promise.all([channel("instagram"), channel("tiktok")])
    .then(([instagram, tiktok]) => {
      const value = {
        instagram,
        tiktok,
        refreshedAt: new Date().toISOString(),
      };
      cached = { value, expires: Date.now() + 60000 };
      return value;
    })
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
