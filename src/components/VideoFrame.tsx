"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ProductVideo, SocialVideo } from "@/types/catalog";
import {
  getSocialEmbedSrc,
  getVideoPlatformLabel,
  isDirectVideoUrl,
} from "@/utils/video";
import styles from "./VideoFrame.module.css";

type VideoSource =
  | ProductVideo
  | {
      platform: SocialVideo["platform"];
      title: string;
      video_url: string;
      thumbnail_url?: string | null;
    };

interface VideoFrameProps {
  video: VideoSource;
  compact?: boolean;
  mediaLabel?: "video" | "publicación";
  autoLoad?: boolean;
}

function getSource(video: VideoSource) {
  if ("video_url" in video) {
    return {
      platform: video.platform,
      title: video.title,
      url: video.video_url,
      posterUrl: video.thumbnail_url,
    };
  }

  return {
    platform: video.video_type,
    title: video.title || getVideoPlatformLabel(video.video_type),
    url: video.url,
    posterUrl: video.poster_url,
  };
}

export default function VideoFrame({
  video,
  compact = false,
  mediaLabel = "video",
  autoLoad = false,
}: VideoFrameProps) {
  const source = getSource(video);
  const embedSrc = getSocialEmbedSrc(source.url, source.platform);
  const directVideo =
    source.platform === "upload" || isDirectVideoUrl(source.url);
  const [activated, setActivated] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const external = source.platform !== "upload";
  const allowed = !external || autoLoad || activated === source.url;
  const failed = failedUrl === source.url;

  useEffect(() => {
    if (!allowed || failed || source.platform !== "tiktok" || !embedSrc) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ready = false;
    const observer = new IntersectionObserver((entries) => {
      if (!ready && !timer && entries.some((entry) => entry.isIntersecting)) {
        timer = setTimeout(() => setFailedUrl(source.url), 25000);
      }
    }, { rootMargin: "200px" });
    if (media.current) observer.observe(media.current);
    const receive = (event: MessageEvent) => {
      if (event.origin !== "https://www.tiktok.com" ||
          event.source !== frame.current?.contentWindow ||
          !event.data || typeof event.data !== "object" ||
          event.data["x-tiktok-player"] !== true) return;
      if (event.data.type === "onPlayerReady") {
        ready = true;
        clearTimeout(timer);
      }
      // A denied autoplay request does not mean the video is unavailable.
      if (event.data.type === "onPlayerError" &&
          [1001, 2001, 3001].includes(event.data.value?.errorCode)) {
        setFailedUrl(source.url);
      }
    };
    window.addEventListener("message", receive);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("message", receive);
    };
  }, [allowed, failed, embedSrc, source.platform, source.url]);

  return (
    <article className={compact ? styles.compactFrame : styles.frame}>
      <div
        ref={media}
        className={`${styles.media} ${!allowed && compact ? styles.pendingCompact : ""}`}
      >
        {failed ? (
          <div className={styles.activation} role="status">
            <p>{mediaLabel === "publicación" ? "Esta publicación" : "Este video"} no está disponible aquí en este momento.</p>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {directVideo ? "Abrir video" : `Abrir en ${getVideoPlatformLabel(source.platform)}`}
            </a>
          </div>
        ) : !allowed ? (
          <div className={styles.activation}>
            <p>
              {mediaLabel === "publicación" ? "Esta publicación" : "Este video"}{" "}
              se carga desde {getVideoPlatformLabel(source.platform)}. Al
              activarlo, ese servicio puede recibir datos técnicos y utilizar
              sus propias tecnologías.
            </p>
            <button type="button" onClick={() => setActivated(source.url)}>
              Activar{" "}
              {mediaLabel === "publicación"
                ? "publicación externa"
                : "video externo"}
            </button>
            <Link href="/politica-de-privacidad">
              Información de privacidad
            </Link>
          </div>
        ) : directVideo ? (
          <video
            aria-label={source.title}
            className={styles.video}
            controls
            playsInline
            preload="metadata"
            poster={source.posterUrl || undefined}
            onError={() => setFailedUrl(source.url)}
          >
            <source src={source.url} />
          </video>
        ) : embedSrc ? (
          <iframe
            ref={frame}
            className={styles.iframe}
            src={embedSrc}
            title={source.title}
            loading="lazy"
            allow="encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="no-referrer"
            onError={() => setFailedUrl(source.url)}
          />
        ) : (
          <a
            className={styles.linkFallback}
            href={source.url}
            target="_blank"
            rel="noreferrer"
          >
            Ver video
          </a>
        )}
      </div>
      <div className={styles.caption}>
        <span>{getVideoPlatformLabel(source.platform)}</span>
        <strong>{source.title}</strong>
        {external && allowed && !autoLoad && (
          <button
            className={styles.stopExternal}
            type="button"
            onClick={() => setActivated(null)}
          >
            Cerrar{" "}
            {mediaLabel === "publicación"
              ? "publicación externa"
              : "video externo"}
          </button>
        )}
      </div>
    </article>
  );
}
