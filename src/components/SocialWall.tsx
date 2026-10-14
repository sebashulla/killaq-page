"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Camera, Music } from "lucide-react";
import {
  SOCIAL_PROFILES,
  type SocialFeed,
  type SocialPlatform,
} from "@/lib/social-core";
import VideoFrame from "./VideoFrame";
import s from "./SocialWall.module.css";
export default function SocialWall() {
  const [feed, setFeed] = useState<SocialFeed | null>(null);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch("/api/redes", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const value = await response.json();
        if (active) setFeed(value);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);
  return (
    <section className={s.wall} aria-labelledby="killaq-social-title">
      <header className={s.heading}>
        <span>EL UNIVERSO KILLAQ, MÁS CERCA</span>
        <h2 id="killaq-social-title">Detalles que merecen compartirse.</h2>
        <p>
          Una mirada a nuestras piezas, al taller y a las historias detrás de
          cada joya.
        </p>
      </header>
      {(["tiktok", "instagram"] as SocialPlatform[]).map((platform) => {
        const profile = SOCIAL_PROFILES[platform],
          channel = feed?.[platform],
        Icon = platform === "instagram" ? Camera : Music;
        return (
          <div key={platform} className={s.channel}>
            <div className={s.channelHeader}>
              <div>
                <Icon size={23} strokeWidth={1.3} aria-hidden="true" />
                <h3>{profile.name}</h3>
                <span>@{profile.handle}</span>
              </div>
              <a href={profile.url} target="_blank" rel="noopener noreferrer">
                Ver perfil <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
            {busy ? (
              <p role="status" className={s.empty}>
                Preparando las publicaciones…
              </p>
            ) : channel?.posts.length ? (
              <>
                <div className={s.grid}>
                  {channel.posts.map((post) => (
                    <div key={post.url}>
                      <VideoFrame
                        autoLoad
                        video={{
                          platform,
                          title: post.title,
                          video_url: post.url,
                        }}
                        mediaLabel={
                          platform === "instagram" ? "publicación" : "video"
                        }
                      />
                      <a
                        className={s.postLink}
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir en {profile.name}{" "}
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    </div>
                  ))}
                </div>
                <p className={s.note}>
                  {channel.source === "api"
                    ? "Publicaciones recientes consultadas desde la cuenta conectada."
                    : "Tres publicaciones seleccionadas por KILLAQ. Puedes ver más novedades en nuestro perfil."}{" "}
                  Las publicaciones se cargan desde {profile.name} al acercarte
                  a esta sección. Ese servicio puede recibir datos técnicos y
                  usar sus propias tecnologías. <Link href="/politica-de-privacidad">Información de privacidad</Link>.
                </p>
              </>
            ) : (
              <div className={s.empty}>
                <p>
                  {channel?.available === false
                    ? "No pudimos cargar las publicaciones en este momento."
                    : "Descubre nuestras publicaciones en el perfil de KILLAQ."}
                </p>
                <a href={profile.url} target="_blank" rel="noopener noreferrer">
                  Explorar {profile.name}{" "}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
