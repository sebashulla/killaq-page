"use client";

import { useEffect, useState } from "react";
import type { SocialVideo } from "@/types/catalog";
import { supabase } from "@/utils/supabaseClient";
import { getVideoPlatformLabel } from "@/utils/video";
import styles from "../crud.module.css";

const emptyForm = {
  platform: "instagram" as SocialVideo["platform"],
  title: "",
  video_url: "",
  thumbnail_url: "",
  sort_order: 0,
  is_active: true,
};

export default function SocialVideosAdmin() {
  const [videos, setVideos] = useState<SocialVideo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<SocialVideo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchVideos = async () => {
    const { data } = await supabase
      .from("social_videos")
      .select("id, platform, title, video_url, thumbnail_url, sort_order, is_active")
      .order("sort_order", { ascending: true });
    setVideos((data || []) as SocialVideo[]);
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchVideos, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const openCreate = () => {
    setEditingVideo(null);
    setError("");
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (video: SocialVideo) => {
    setEditingVideo(video);
    setError("");
    setForm({
      platform: video.platform,
      title: video.title,
      video_url: video.video_url,
      thumbnail_url: video.thumbnail_url || "",
      sort_order: video.sort_order || 0,
      is_active: Boolean(video.is_active),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.video_url.trim()) return;

    setSaving(true);
    setError("");

    const payload = {
      platform: form.platform,
      title: form.title.trim(),
      video_url: form.video_url.trim(),
      thumbnail_url: form.thumbnail_url.trim() || null,
      sort_order: form.sort_order,
      is_active: form.is_active,
    };

    const response = editingVideo?.id
      ? await supabase.from("social_videos").update(payload).eq("id", editingVideo.id)
      : await supabase.from("social_videos").insert(payload);

    if (response.error) {
      setError(response.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowModal(false);
    fetchVideos();
  };

  const handleDelete = async (id?: number) => {
    if (!id || !confirm("¿Seguro que quieres eliminar este video?")) return;
    await supabase.from("social_videos").delete().eq("id", id);
    fetchVideos();
  };

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.helperText}>
          Publica reels, TikToks o enlaces externos en el bloque de videos de la página principal.
        </p>
        <button className={styles.addButton} onClick={openCreate} type="button">
          Nuevo video
        </button>
      </div>

      {videos.length === 0 ? (
        <div className={styles.emptyState}>Aún no hay videos sociales publicados.</div>
      ) : (
        <div className={styles.tableWrap} role="region" aria-label="Listado de videos" tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Título</th>
                <th>Plataforma</th>
                <th>URL</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id || video.video_url}>
                  <td>{video.sort_order || 0}</td>
                  <td><strong className={styles.rowTitle}>{video.title}</strong></td>
                  <td><span className={styles.mediaBadge}>{getVideoPlatformLabel(video.platform)}</span></td>
                  <td className={styles.muted}>{video.video_url}</td>
                  <td>
                    <span className={video.is_active ? styles.badgeActive : styles.badgeInactive}>
                      {video.is_active ? "Publicado" : "Oculto"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionGroup}>
                      <button className={styles.editBtn} onClick={() => openEdit(video)} type="button">
                        Editar
                      </button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(video.id)} type="button">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingVideo ? "Editar video" : "Nuevo video social"}</h2>
            {error && <div className={styles.formError}>{error}</div>}

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Plataforma</label>
                <select
                  className={styles.formSelect}
                  value={form.platform}
                  onChange={(event) => setForm({ ...form, platform: event.target.value as SocialVideo["platform"] })}
                >
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="external">URL externa</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Orden</label>
                <input
                  className={styles.formInput}
                  type="number"
                  value={form.sort_order}
                  onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) || 0 })}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Título</label>
              <input
                className={styles.formInput}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Ej: Nueva colección en oro"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>URL del video</label>
              <input
                className={styles.formInput}
                value={form.video_url}
                onChange={(event) => setForm({ ...form, video_url: event.target.value })}
                placeholder="https://www.instagram.com/reel/... o https://www.tiktok.com/@.../video/..."
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Imagen previa</label>
              <input
                className={styles.formInput}
                value={form.thumbnail_url}
                onChange={(event) => setForm({ ...form, thumbnail_url: event.target.value })}
                placeholder="Opcional"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Estado</label>
              <select
                className={styles.formSelect}
                value={form.is_active ? "true" : "false"}
                onChange={(event) => setForm({ ...form, is_active: event.target.value === "true" })}
              >
                <option value="true">Publicado en home</option>
                <option value="false">Oculto</option>
              </select>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)} type="button">
                Cancelar
              </button>
              <button className={styles.saveBtn} disabled={saving || !form.title || !form.video_url} onClick={handleSave} type="button">
                {saving ? "Guardando..." : "Guardar video"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
