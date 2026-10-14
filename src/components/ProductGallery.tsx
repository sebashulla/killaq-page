"use client";

import Image from "./StoreImage";
import { useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, Expand, Play, X, ZoomIn, ZoomOut } from "lucide-react";
import VideoFrame from "./VideoFrame";
import type { ProductImage, ProductVideo } from "@/types/catalog";
import s from "./ProductGallery.module.css";

type Media = { kind: "image"; image: ProductImage } | { kind: "video"; video: ProductVideo };
export default function ProductGallery({ name, images, videos, demo, onSelect }: {
  name: string; images: ProductImage[]; videos: ProductVideo[]; demo: boolean; onSelect: (index: number) => void;
}) {
  const media: Media[] = [...images.map(image => ({ kind: "image" as const, image })), ...videos.map(video => ({ kind: "video" as const, video }))];
  const [selected, setSelected] = useState(0);
  const [enlarged, setEnlarged] = useState(false);
  const [opened, setOpened] = useState(false);
  const [loadedImage, setLoadedImage] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const current = media[selected] || media[0];
  const imageIndex = current.kind === "image" ? Math.min(selected, images.length - 1) : 0;

  function choose(index: number) {
    if (index === selected) return;
    setSelected(index);
    setEnlarged(false);
    setLoadedImage(null);
    viewport.current?.scrollTo(0, 0);
    onSelect(index);
  }
  function open() { setEnlarged(false); setLoadedImage(null); setOpened(true); dialog.current?.showModal(); }
  function point(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse") return;
    const target = event.currentTarget, rect = target.getBoundingClientRect();
    target.style.setProperty("--zoom-x", `${Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))}%`);
    target.style.setProperty("--zoom-y", `${Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100))}%`);
    target.dataset.zoomed = "true";
  }

  return <div className={s.gallery} role="group" aria-label={`Galería de ${name}`}>
    <div className={s.stage}>
      {current.kind === "image" ? <button ref={trigger} type="button" className={s.imageButton}
        aria-label={`Ampliar imagen ${imageIndex + 1} de ${name}`} aria-haspopup="dialog"
        onPointerEnter={point} onPointerMove={point} onPointerLeave={event => { delete event.currentTarget.dataset.zoomed; }} onClick={open}>
        <Image key={current.image.url} src={current.image.url} alt={current.image.alt_text || name} fill className={s.image}
          sizes="(max-width: 700px) 100vw, (max-width: 1400px) 53vw, 720px" loading="eager" />
        <span className={s.expand}><Expand size={16} aria-hidden="true" /> Ampliar</span>
      </button> : <div className={s.videoStage} key={current.video.url}><VideoFrame video={current.video} autoLoad /></div>}
      {demo && <span className={s.reference}>Referencia visual</span>}
      {media.length > 1 && <div className={s.controls}>
        <button type="button" aria-label="Contenido anterior" onClick={() => choose((selected - 1 + media.length) % media.length)}><ArrowLeft size={17} aria-hidden="true" /></button>
        <span aria-live="polite" aria-atomic="true">{String(selected + 1).padStart(2, "0")} / {String(media.length).padStart(2, "0")}</span>
        <button type="button" aria-label="Siguiente contenido" onClick={() => choose((selected + 1) % media.length)}><ArrowRight size={17} aria-hidden="true" /></button>
      </div>}
    </div>
    <div className={s.caption}>
      <span>{current.kind === "image" ? "La pieza, de cerca" : current.video.title || "La pieza en movimiento"}</span>
      {current.kind === "image" && <><span className={s.desktopHint}>Pasa el cursor para explorar</span><span className={s.touchHint}>Toca la imagen para ampliar</span></>}
    </div>
    {media.length > 1 && <div className={s.thumbnails} role="group" aria-label="Fotografías y videos de la pieza">
      {media.map((item, index) => <button type="button" key={item.kind + (item.kind === "image" ? item.image.url : item.video.url)}
        className={s.thumbnail} aria-pressed={selected === index}
        aria-label={item.kind === "image" ? `Ver imagen ${index + 1} de ${name}` : `Ver video ${index - images.length + 1} de ${name}`}
        onClick={() => choose(index)}>
        {item.kind === "image" ? <Image src={item.image.url} alt="" fill sizes="80px" className={s.thumbnailImage} /> : <>
          {item.video.poster_url && <Image src={item.video.poster_url} alt="" fill sizes="80px" className={s.thumbnailImage} />}
          <span className={s.videoThumb}><Play size={19} fill="currentColor" aria-hidden="true" /><span>Video</span></span>
        </>}
      </button>)}
    </div>}

    <dialog ref={dialog} className={s.lightbox} aria-label={`Vista ampliada de ${name}`}
      onClose={() => { setOpened(false); setEnlarged(false); trigger.current?.focus({ preventScroll: true }); }}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      onKeyDown={event => {
        if (enlarged && event.target === viewport.current) return;
        if (images.length > 1 && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
          event.preventDefault(); choose((imageIndex + (event.key === "ArrowRight" ? 1 : -1) + images.length) % images.length);
        }
      }}>
      {opened && <div className={s.lightboxContent}>
        <header className={s.lightboxHeader}><div><span>KILLAQ</span><h2>{name}</h2></div>
          <div className={s.lightboxActions}>
            <button type="button" aria-label={enlarged ? "Alejar imagen" : "Acercar imagen"} aria-pressed={enlarged} onClick={() => { setEnlarged(value => !value); viewport.current?.scrollTo(0, 0); }}>{enlarged ? <ZoomOut size={21} /> : <ZoomIn size={21} />}</button>
            <button type="button" aria-label="Cerrar vista ampliada" autoFocus onClick={() => dialog.current?.close()}><X size={23} aria-hidden="true" /></button>
          </div>
        </header>
        <div ref={viewport} className={s.lightboxViewport} tabIndex={0} role="region" aria-label="Fotografía ampliada; desplázate para explorar">
          <div className={`${s.lightboxCanvas} ${enlarged ? s.enlarged : ""}`}>
            {loadedImage !== images[imageIndex].url && <span role="status" className={s.loading}>Cargando detalle…</span>}
            <Image src={images[imageIndex].url} alt={images[imageIndex].alt_text || name} fill loading="eager" onLoad={() => setLoadedImage(images[imageIndex].url)} sizes="(max-width: 700px) 160vw, 1600px" className={s.lightboxImage} />
          </div>
        </div>
        <footer className={s.lightboxFooter}>
          {images.length > 1 && <button type="button" aria-label="Imagen anterior ampliada" onClick={() => choose((imageIndex - 1 + images.length) % images.length)}><ArrowLeft size={19} aria-hidden="true" /></button>}
          <p aria-live="polite">Fotografía {imageIndex + 1} de {images.length}{demo && " · Muestra digital"}</p>
          {images.length > 1 && <button type="button" aria-label="Siguiente imagen ampliada" onClick={() => choose((imageIndex + 1) % images.length)}><ArrowRight size={19} aria-hidden="true" /></button>}
        </footer>
      </div>}
    </dialog>
  </div>;
}
