"use client";

import Image from "@/components/StoreImage";
import { useEffect, useState } from "react";
import type { ProductImage, ProductVideo } from "@/types/catalog";
import type { Subcategory, Collection } from "@/types/catalog";
import { slugify } from "@/utils/format";
import { supabase } from "@/utils/supabaseClient";
import { getVideoPlatformLabel } from "@/utils/video";
import styles from "../crud.module.css";

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_price: number | null;
  category_id: number | null;
  subcategory_id?: number | null;
  collection_id?: number | null;
  material_id: number | null;
  stock: number;
  sku: string | null;
  sizes_available?: string[] | null;
  is_featured: boolean;
  is_active: boolean;
  categories?: { name: string } | null;
  materials?: { name: string } | null;
  product_images?: ProductImage[] | null;
  product_videos?: ProductVideo[] | null;
}

interface Category {
  id: number;
  name: string;
}

interface Material {
  id: number;
  name: string;
}

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  price: 0,
  compare_price: null as number | null,
  category_id: null as number | null,
  subcategory_id: null as number | null,
  collection_id: null as number | null,
  material_id: null as number | null,
  stock: 0,
  sku: "",
  sizes_available: "",
  primary_image: "",
  image_alt: "",
  video_type: "upload" as ProductVideo["video_type"],
  video_title: "",
  video_url: "",
  video_poster: "",
  is_featured: false,
  is_active: true,
};

export default function ProductosAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("*, categories(name), materials(name), product_images(id, url, alt_text, sort_order)")
      .order("created_at", { ascending: false });

    const baseProducts = (data || []) as Product[];
    const ids = baseProducts.map((product) => product.id);

    if (ids.length === 0) {
      setProducts(baseProducts);
      return;
    }

    const { data: videos } = await supabase
      .from("product_videos")
      .select("id, product_id, video_type, title, url, poster_url, sort_order, is_active")
      .in("product_id", ids)
      .order("sort_order", { ascending: true });

    const videosByProduct = new Map<string, ProductVideo[]>();
    ((videos || []) as ProductVideo[]).forEach((video) => {
      if (!video.product_id) return;
      const current = videosByProduct.get(video.product_id) || [];
      videosByProduct.set(video.product_id, [...current, video]);
    });

    setProducts(
      baseProducts.map((product) => ({
        ...product,
        product_videos: videosByProduct.get(product.id) || null,
      }))
    );
  };

  const fetchMeta = async () => {
    const [catRes, matRes, subRes, collectionRes] = await Promise.all([
      supabase.from("categories").select("id, name").order("sort_order"),
      supabase.from("materials").select("id, name").order("sort_order"),
      supabase.from("subcategories").select("id, category_id, slug, name").eq("is_active",true).order("sort_order"),
      supabase.from("collections").select("id, name, slug, is_active").order("sort_order"),
    ]);
    setCategories(catRes.data || []);
    setMaterials(matRes.data || []);
    setSubcategories(subRes.data || []);
    setCollections(collectionRes.data || []);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchProducts();
      fetchMeta();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const openCreate = () => {
    setEditingProduct(null);
    setVideoFile(null);
    setError("");
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    const primaryImage =
      product.product_images?.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0] ||
      null;
    const primaryVideo =
      product.product_videos?.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0] ||
      null;

    setEditingProduct(product);
    setVideoFile(null);
    setError("");
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      price: Number(product.price),
      compare_price: product.compare_price ? Number(product.compare_price) : null,
      category_id: product.category_id,
      subcategory_id: product.subcategory_id || null,
      collection_id: product.collection_id || null,
      material_id: product.material_id,
      stock: product.stock,
      sku: product.sku || "",
      sizes_available: product.sizes_available?.join(", ") || "",
      primary_image: primaryImage?.url || "",
      image_alt: primaryImage?.alt_text || product.name,
      video_type: primaryVideo?.video_type || "upload",
      video_title: primaryVideo?.title || "",
      video_url: primaryVideo?.url || "",
      video_poster: primaryVideo?.poster_url || "",
      is_featured: product.is_featured,
      is_active: product.is_active,
    });
    setShowModal(true);
  };

  const savePrimaryImage = async (productId: string) => {
    const imageUrl = form.primary_image.trim();
    const existingImage = editingProduct?.product_images?.[0];

    if (!imageUrl) {
      if (existingImage?.id) {
        const { error: imageError } = await supabase.from("product_images").delete().eq("id", existingImage.id);
        if (imageError) throw new Error(imageError.message);
      }
      return;
    }

    const imagePayload = {
      product_id: productId,
      url: imageUrl,
      alt_text: form.image_alt || form.name,
      sort_order: 0,
    };

    if (existingImage?.id) {
      const { error: imageError } = await supabase.from("product_images").update(imagePayload).eq("id", existingImage.id);
      if (imageError) throw new Error(imageError.message);
    } else {
      const { error: imageError } = await supabase.from("product_images").insert(imagePayload);
      if (imageError) throw new Error(imageError.message);
    }
  };

  const uploadProductVideo = async (productId: string) => {
    if (!videoFile) return "";
    const cleanName = videoFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `products/${productId}/${Date.now()}-${cleanName}`;
    const { error: uploadError } = await supabase.storage
      .from("product-videos")
      .upload(filePath, videoFile, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from("product-videos").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const savePrimaryVideo = async (productId: string) => {
    const uploadedUrl = await uploadProductVideo(productId);
    const videoUrl = uploadedUrl || form.video_url.trim();
    const existingVideo =
      editingProduct?.product_videos?.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0] ||
      null;

    if (!videoUrl) {
      if (existingVideo?.id) {
        const { error: videoError } = await supabase.from("product_videos").delete().eq("id", existingVideo.id);
        if (videoError) throw new Error(videoError.message);
      }
      return;
    }

    const videoPayload = {
      product_id: productId,
      video_type: uploadedUrl ? "upload" : form.video_type,
      title: form.video_title.trim() || form.name,
      url: videoUrl,
      poster_url: form.video_poster.trim() || null,
      sort_order: 0,
      is_active: true,
    };

    if (existingVideo?.id) {
      const { error: videoError } = await supabase.from("product_videos").update(videoPayload).eq("id", existingVideo.id);
      if (videoError) throw new Error(videoError.message);
    } else {
      const { error: videoError } = await supabase.from("product_videos").insert(videoPayload);
      if (videoError) throw new Error(videoError.message);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !Number.isFinite(form.price) || form.price <= 0 || !Number.isInteger(form.stock) || form.stock < 0 || (form.compare_price !== null && form.compare_price <= form.price)) { setError("Revisa el nombre, el precio mayor a cero, el stock entero y el precio anterior mayor al actual."); return; }

    setSaving(true);
    setError("");

    if (form.subcategory_id && !subcategories.some(item => item.id === form.subcategory_id && item.category_id === form.category_id)) { setError("La subcategoría debe pertenecer a la categoría seleccionada."); setSaving(false); return; }

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim() || null,
      price: form.price,
      compare_price: form.compare_price || null,
      category_id: form.category_id,
      subcategory_id: form.subcategory_id,
      collection_id: form.collection_id,
      material_id: form.material_id,
      stock: form.stock,
      sku: form.sku.trim() || null,
      sizes_available: [...new Set(form.sizes_available.split(",").map(size => size.trim()).filter(Boolean))],
      is_featured: form.is_featured,
      is_active: form.is_active,
    };

    const response = editingProduct
      ? await supabase.from("products").update(payload).eq("id", editingProduct.id).select("id").single()
      : await supabase.from("products").insert(payload).select("id").single();

    if (response.error || !response.data) {
      setError(response.error?.message || "No se pudo guardar el producto.");
      setSaving(false);
      return;
    }

    try {
      if (!editingProduct) setEditingProduct({ ...payload, id: response.data.id });
      await savePrimaryImage(response.data.id);
      await savePrimaryVideo(response.data.id);
      setSaving(false);
      setShowModal(false);
      fetchProducts();
    } catch (saveError) {
      const { data: savedProduct } = await supabase.from("products").select("*, product_images(id, url, alt_text, sort_order)").eq("id", response.data.id).maybeSingle();
      if (savedProduct) {
        const { data: savedVideos } = await supabase.from("product_videos").select("*").eq("product_id", response.data.id).order("sort_order");
        setEditingProduct({ ...savedProduct, product_videos: savedVideos || [] } as Product);
      }
      setError(`La pieza se guardó, pero falta completar sus archivos. ${saveError instanceof Error ? saveError.message : "Revisa la imagen o el video."} Puedes reintentar sin crear otra pieza.`);
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que quieres eliminar este producto?")) return;
    const { error: deleteError } = await supabase.from("products").delete().eq("id", id);
    if (deleteError) { setError("No se pudo eliminar el producto. Revisa tus permisos."); return; }
    fetchProducts();
  };

  return (
    <>
      {error && !showModal && <p className={styles.formError} role="alert">{error}</p>}
      <div className={styles.toolbar}>
        <p className={styles.helperText}>
          Gestiona catálogo, precios, stock, visibilidad, imagen principal y video de cada pieza.
        </p>
        <button className={styles.addButton} onClick={openCreate} type="button">
          Nuevo producto
        </button>
      </div>

      {products.length === 0 ? (
        <div className={styles.emptyState}>No hay productos. Añade el primero desde el botón superior.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Material</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Video</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const imageUrl = product.product_images?.[0]?.url;
                const video = product.product_videos?.[0];
                return (
                  <tr key={product.id}>
                    <td>
                      {imageUrl ? (
                        <div className={styles.thumbnailBox}>
                          <Image src={imageUrl} alt={product.name} fill className={styles.thumbnailImage} sizes="60px" />
                        </div>
                      ) : (
                        <span className={styles.muted}>Sin imagen</span>
                      )}
                    </td>
                    <td>
                      <strong className={styles.rowTitle}>{product.name}</strong>
                      {product.is_featured && <span className={styles.featuredLabel}>Destacado</span>}
                    </td>
                    <td>{product.categories?.name || "Sin categoría"}</td>
                    <td>{product.materials?.name || "Sin material"}</td>
                    <td className={styles.priceCell}>S/ {Number(product.price).toFixed(2)}</td>
                    <td>{product.stock}</td>
                    <td>
                      {video ? (
                        <span className={styles.mediaBadge}>{getVideoPlatformLabel(video.video_type)}</span>
                      ) : (
                        <span className={styles.muted}>Sin video</span>
                      )}
                    </td>
                    <td>
                      <span className={product.is_active ? styles.badgeActive : styles.badgeInactive}>
                        {product.is_active ? "Publicado" : "Oculto"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionGroup}>
                        <button className={styles.editBtn} onClick={() => openEdit(product)} type="button">
                          Editar
                        </button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(product.id)} type="button">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingProduct ? "Editar producto" : "Nuevo producto"}</h2>
            {error && <div className={styles.formError}>{error}</div>}

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nombre</label>
                <input
                  className={styles.formInput}
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                      slug: editingProduct ? form.slug : slugify(event.target.value),
                      image_alt: form.image_alt || event.target.value,
                    })
                  }
                  placeholder="Ej: Anillo Solitario Diamante"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Slug URL</label>
                <input
                  className={styles.formInput}
                  value={form.slug}
                  onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
                  placeholder="anillo-solitario-diamante"
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Descripción</label>
              <textarea
                className={styles.formTextarea}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Describe materiales, acabado, ocasión y cuidados."
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="product-category">Categoría</label>
                <select
                  id="product-category"
                  className={styles.formSelect}
                  value={form.category_id || ""}
                  onChange={(event) =>
                    setForm({ ...form, category_id: event.target.value ? Number(event.target.value) : null, subcategory_id:null })
                  }
                >
                  <option value="">Seleccionar</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Material</label>
                <select
                  className={styles.formSelect}
                  value={form.material_id || ""}
                  onChange={(event) =>
                    setForm({ ...form, material_id: event.target.value ? Number(event.target.value) : null })
                  }
                >
                  <option value="">Seleccionar</option>
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>{material.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}><label className={styles.formLabel} htmlFor="product-subcategory">Subcategoría</label><select id="product-subcategory" className={styles.formSelect} disabled={!form.category_id} value={form.subcategory_id || ""} onChange={event => setForm({...form,subcategory_id:event.target.value ? Number(event.target.value) : null})}><option value="">Sin subcategoría</option>{subcategories.filter(item => item.category_id === form.category_id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small className={styles.helperText}>Solo se muestran los estilos de esta categoría.</small></div>
              <div className={styles.formGroup}><label className={styles.formLabel} htmlFor="product-collection">Colección</label><select id="product-collection" className={styles.formSelect} value={form.collection_id || ""} onChange={event => setForm({...form,collection_id:event.target.value ? Number(event.target.value) : null})}><option value="">Sin colección</option>{collections.map(item => <option key={item.id} value={item.id}>{item.name}{item.is_active === false ? " (inactiva)" : ""}</option>)}</select><small className={styles.helperText}>Una pieza publicada con imagen y colección activa puede elegirse en «Pieza exclusiva».</small></div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Precio (S/)</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: Number(event.target.value) || 0 })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Precio anterior</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.compare_price || ""}
                  onChange={(event) =>
                    setForm({ ...form, compare_price: event.target.value ? Number(event.target.value) : null })
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Stock</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(event) => setForm({ ...form, stock: Number(event.target.value) || 0 })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>SKU</label>
                <input
                  className={styles.formInput}
                  value={form.sku}
                  onChange={(event) => setForm({ ...form, sku: event.target.value })}
                  placeholder="KLQ-AN-001"
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Imagen principal</label>
              <input
                className={styles.formInput}
                value={form.primary_image}
                onChange={(event) => setForm({ ...form, primary_image: event.target.value })}
                placeholder="https://res.cloudinary.com/... o /images/product-1.png"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="product-sizes">Tallas disponibles</label>
              <input id="product-sizes" className={styles.formInput} value={form.sizes_available} onChange={event => setForm({ ...form, sizes_available: event.target.value })} placeholder="Ej: 6, 7, 8. Dejar vacío si no requiere talla." />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Texto alternativo de imagen</label>
              <input
                className={styles.formInput}
                value={form.image_alt}
                onChange={(event) => setForm({ ...form, image_alt: event.target.value })}
                placeholder="Describe la pieza para accesibilidad"
              />
            </div>

            <div className={styles.formSection}>
              <h3 className={styles.formSectionTitle}>Video del producto</h3>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tipo de video</label>
                  <select
                    className={styles.formSelect}
                    value={form.video_type}
                    onChange={(event) =>
                      setForm({ ...form, video_type: event.target.value as ProductVideo["video_type"] })
                    }
                  >
                    <option value="upload">Archivo subido</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="external">URL externa</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Título del video</label>
                  <input
                    className={styles.formInput}
                    value={form.video_title}
                    onChange={(event) => setForm({ ...form, video_title: event.target.value })}
                    placeholder="Ej: Brillo y detalle de la pieza"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Subir archivo</label>
                <input
                  className={styles.fileInput}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(event) => setVideoFile(event.target.files?.[0] || null)}
                />
                {videoFile && <span className={styles.inlineHint}>{videoFile.name}</span>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>URL de video</label>
                <input
                  className={styles.formInput}
                  value={form.video_url}
                  onChange={(event) => setForm({ ...form, video_url: event.target.value })}
                  placeholder="https://www.instagram.com/reel/... o https://.../video.mp4"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Imagen previa del video</label>
                <input
                  className={styles.formInput}
                  value={form.video_poster}
                  onChange={(event) => setForm({ ...form, video_poster: event.target.value })}
                  placeholder="Opcional: URL de portada"
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Destacado</label>
                <select
                  className={styles.formSelect}
                  value={form.is_featured ? "true" : "false"}
                  onChange={(event) => setForm({ ...form, is_featured: event.target.value === "true" })}
                >
                  <option value="false">No</option>
                  <option value="true">Sí, mostrar en home</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Estado</label>
                <select
                  className={styles.formSelect}
                  value={form.is_active ? "true" : "false"}
                  onChange={(event) => setForm({ ...form, is_active: event.target.value === "true" })}
                >
                  <option value="true">Publicado en tienda</option>
                  <option value="false">Oculto en tienda</option>
                </select>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)} type="button">
                Cancelar
              </button>
              <button className={styles.saveBtn} disabled={saving || !form.name} onClick={handleSave} type="button">
                {saving ? "Guardando..." : "Guardar producto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
