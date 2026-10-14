"use client";

import Link from "next/link";
import { useState } from "react";
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
}: VideoFrameProps) {
  const source = getSource(video);
  const embedSrc = getSocialEmbedSrc(source.url, source.platform);
  const directVideo =
    source.platform === "upload" || isDirectVideoUrl(source.url);
  const [activated, setActivated] = useState<string | null>(null);
  const external = source.platform !== "upload";
  const allowed = !external || activated === source.url;

  return (
    <article className={compact ? styles.compactFrame : styles.frame}>
      <div
        className={`${styles.media} ${!allowed && compact ? styles.pendingCompact : ""}`}
      >
        {!allowed ? (
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
            className={styles.video}
            controls
            playsInline
            preload="metadata"
            poster={source.posterUrl || undefined}
          >
            <source src={source.url} />
          </video>
        ) : embedSrc ? (
          <iframe
            className={styles.iframe}
            src={embedSrc}
            title={source.title}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
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
        {external && allowed && (
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
