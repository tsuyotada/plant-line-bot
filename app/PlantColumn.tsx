"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type PhotoHistoryItem = { id: string; url: string; takenAt: string };

type Props = {
  plants: any[];
  archivedPlants: any[];
  today: string;
  plantHasTodayEventRecord: Record<string, boolean>;
  hasError: boolean;
  addPlantAction: (formData: FormData) => Promise<void>;
  archivePlantAction: (formData: FormData) => Promise<void>;
  restorePlantAction: (formData: FormData) => Promise<void>;
  reorderPlantAction: (orderedIds: string[]) => Promise<void>;
  uploadPhotoAction: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  latestPhotos: Record<string, string>;
  photoHistories: Record<string, PhotoHistoryItem[]>;
};

const plantLabelMap: Record<string, string> = {
  tomato: "トマト",
  coriander: "コリアンダー",
  makrut_lime: "コブミカン",
  mint: "ミント",
  everbearing_strawberry: "四季成りイチゴ",
  italian_parsley: "イタリアンパセリ",
  shiso: "大葉",
  perilla: "えごま",
};

function getPlantLabel(plantType: string | null | undefined): string {
  if (!plantType) return "植物";
  return plantLabelMap[plantType] ?? plantType;
}

const initialStateLabelMap: Record<string, string> = {
  seed: "種",
  seedling: "苗",
  cutting: "挿し木",
  established: "既に育っている株",
  other: "その他",
};

function getInitialStateLabel(stateType: string | null | undefined): string | null {
  if (!stateType) return null;
  return initialStateLabelMap[stateType] ?? stateType;
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_WIDTH = 1200;
      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = Math.round(height * (MAX_WIDTH / width));
        width = MAX_WIDTH;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error("toBlob failed")); },
        "image/jpeg",
        0.7
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("image load failed")); };
    img.src = objectUrl;
  });
}

const fontFamily =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// ── Sortable card wrapper — drag handle is rendered here ──────────────────────

function SortablePlantCard({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className="plant-card-sortable"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      {...attributes}
    >
      {/* Drag handle strip — only this area triggers DnD */}
      <div className="drag-handle" {...listeners} title="ドラッグして並び替え">
        <span style={{ color: "rgba(180,180,180,0.6)", fontSize: 10, letterSpacing: 3, userSelect: "none" }}>
          ⠿⠿⠿
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlantColumn({
  plants,
  archivedPlants,
  today,
  plantHasTodayEventRecord,
  hasError,
  addPlantAction,
  archivePlantAction,
  restorePlantAction,
  reorderPlantAction,
  uploadPhotoAction,
  latestPhotos,
  photoHistories,
}: Props) {
  const [localPlants, setLocalPlants] = useState(plants);
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [historyModalId, setHistoryModalId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadingIds, setUploadingIds] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [photoMenuOpenId, setPhotoMenuOpenId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, { current: number; total: number }>>({});

  const formRef = useRef<HTMLFormElement>(null);
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const photoLibraryInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const formPhotoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!photoMenuOpenId) return;
    function handleOutsideClick() { setPhotoMenuOpenId(null); }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [photoMenuOpenId]);

  useEffect(() => {
    setLocalPlants(plants);
  }, [plants]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    setLocalPlants((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      reorderPlantAction(reordered.map((p) => p.id)).catch(console.error);
      return reordered;
    });
  }

  async function handlePhotoChange(plantId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const allFiles = Array.from(e.target.files ?? []);
    if (allFiles.length === 0) return;

    setUploadErrors((prev) => { const next = { ...prev }; delete next[plantId]; return next; });

    const oversized = allFiles.filter((f) => f.size > 5 * 1024 * 1024);
    const files = allFiles.filter((f) => f.size <= 5 * 1024 * 1024);

    if (files.length === 0) {
      setUploadErrors((prev) => ({ ...prev, [plantId]: `画像サイズが大きすぎます（5MB以内にしてください）` }));
      e.target.value = "";
      return;
    }
    if (oversized.length > 0) {
      setUploadErrors((prev) => ({ ...prev, [plantId]: `${oversized.length}枚は5MBを超えたためスキップします` }));
    }

    // 最初の1枚をプレビュー表示
    const firstReader = new FileReader();
    firstReader.onload = (ev) => {
      if (typeof ev.target?.result === "string") {
        setPhotoPreviews((prev) => ({ ...prev, [plantId]: ev.target!.result as string }));
      }
    };
    firstReader.readAsDataURL(files[0]);

    setUploadingIds((prev) => ({ ...prev, [plantId]: true }));
    setUploadProgress((prev) => ({ ...prev, [plantId]: { current: 0, total: files.length } }));

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress((prev) => ({ ...prev, [plantId]: { current: i + 1, total: files.length } }));

      // 2枚目以降はプレビューを更新
      if (i > 0) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (typeof ev.target?.result === "string") {
            setPhotoPreviews((prev) => ({ ...prev, [plantId]: ev.target!.result as string }));
          }
        };
        reader.readAsDataURL(file);
      }

      try {
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.set("plant_id", plantId);
        fd.set("photo", new File([compressed], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg" }));
        const result = await uploadPhotoAction(fd);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`[Upload] 失敗 file=${file.name}`, result.error);
        }
      } catch {
        failCount++;
        console.error(`[Upload] 例外 file=${file.name}`);
      }
    }

    setUploadingIds((prev) => { const next = { ...prev }; delete next[plantId]; return next; });
    setUploadProgress((prev) => { const next = { ...prev }; delete next[plantId]; return next; });
    e.target.value = "";

    if (failCount > 0 && successCount === 0) {
      setUploadErrors((prev) => ({ ...prev, [plantId]: "アップロードに失敗しました。通信状態を確認してください。" }));
    } else if (failCount > 0) {
      setUploadErrors((prev) => ({ ...prev, [plantId]: `${failCount}枚のアップロードに失敗しました（${successCount}枚は成功）` }));
    }
  }

  function handleFormPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) { setFormPhotoPreview(null); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") setFormPhotoPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  function handleMenuToggle(plantId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setOpenMenuId((prev) => (prev === plantId ? null : plantId));
  }

  function handleHistoryOpen(plantId: string) {
    setHistoryModalId(plantId);
    setOpenMenuId(null);
  }

  function handleFormAction(formData: FormData) {
    startTransition(async () => {
      const rawFile = formData.get("photo") as File | null;
      if (rawFile && rawFile.size > 0) {
        try {
          const compressed = await compressImage(rawFile);
          formData.set("photo", new File([compressed], rawFile.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg" }));
        } catch { /* use original */ }
      }
      await addPlantAction(formData);
      formRef.current?.reset();
      setIsFormOpen(false);
      setIsDetailsOpen(false);
      setFormPhotoPreview(null);
    });
  }

  const historyPlant = historyModalId
    ? [...localPlants, ...archivedPlants].find((p) => p.id === historyModalId)
    : null;

  return (
    <>
      <style>{`
        .plant-card-sortable {
          background: #ffffff;
          border-radius: 10px;
          box-shadow: 0 1px 3px rgba(60, 50, 30, 0.08);
          overflow: hidden;
          min-width: 0;
          transition: box-shadow 0.15s;
          position: relative;
        }
        .plant-card-sortable:hover {
          box-shadow: 0 3px 10px rgba(60, 50, 30, 0.13);
        }
        .drag-handle {
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #faf8f4;
          cursor: grab;
          border-bottom: 1px solid #f0ebe2;
          touch-action: none;
        }
        .drag-handle:active {
          cursor: grabbing;
          background: #f2ede6;
        }
        .photo-hover-hint {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.15s;
          font-size: 11px;
          color: #fff;
          font-weight: 600;
          letter-spacing: 0.3px;
          font-family: ${fontFamily};
        }
        div:hover > .photo-hover-hint {
          opacity: 1;
        }
        .photo-upload-loading-hint {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.40);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: #fff;
          font-weight: 600;
          font-family: ${fontFamily};
        }
        .photo-camera-btn {
          position: absolute;
          bottom: 5px;
          right: 5px;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.88);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4a5568;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
          backdrop-filter: blur(4px);
          transition: background 0.15s;
          z-index: 2;
        }
        .photo-camera-btn:hover {
          background: rgba(255, 255, 255, 0.98);
        }
        .photo-source-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.97);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-top: 1px solid #e8e4dc;
          padding: 7px 8px;
          display: flex;
          gap: 6px;
          z-index: 20;
        }
        .photo-source-btn {
          flex: 1;
          padding: 7px 4px;
          border-radius: 7px;
          border: 1px solid #e8e4dc;
          background: #fafaf8;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          font-family: inherit;
          text-align: center;
          transition: background 0.12s;
          white-space: nowrap;
        }
        .photo-source-btn:hover {
          background: #f2faf4;
          border-color: #b8dfc0;
        }
        .plant-info-wrap {
          padding: 8px 10px 10px;
        }
        .plant-menu-trigger {
          font-size: 14px;
          color: #ddd8cf;
          cursor: pointer;
          letter-spacing: 1px;
          user-select: none;
          background: none;
          border: none;
          padding: 2px 4px;
          line-height: 1;
          font-family: inherit;
          border-radius: 4px;
        }
        .plant-menu-trigger:hover {
          color: #9ca3af;
          background: #f5f2ed;
        }
        .plant-menu-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 4px);
          background: #ffffff;
          border-radius: 8px;
          padding: 4px 0;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
          z-index: 50;
          min-width: 130px;
          border: 1px solid #f0ebe2;
        }
        .plant-menu-item {
          display: block;
          width: 100%;
          padding: 8px 14px;
          background: transparent;
          border: none;
          text-align: left;
          font-size: 13px;
          color: #374151;
          cursor: pointer;
          font-family: inherit;
        }
        .plant-menu-item:hover { background: #f9f7f3; color: #2d4a3e; }
        .plant-menu-item-danger {
          display: block;
          width: 100%;
          padding: 8px 14px;
          background: transparent;
          border: none;
          text-align: left;
          font-size: 13px;
          color: #b91c1c;
          cursor: pointer;
          font-family: inherit;
        }
        .plant-menu-item-danger:hover { background: #fff5f5; }
        .modal-overlay {
          position: fixed;
          top: 0; right: 0; bottom: 0; left: 0;
          z-index: 200;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-panel {
          background: #ffffff;
          border-radius: 14px;
          padding: 24px;
          max-width: 480px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
        }
        .btn-add-plant-toggle {
          width: 100%;
          padding: 10px 16px;
          background: transparent;
          border: 1.5px dashed #b8d4bc;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #6db07b;
          cursor: pointer;
          font-family: inherit;
          letter-spacing: 0.2px;
          transition: background 0.15s, border-color 0.15s;
        }
        .btn-add-plant-toggle:hover { background: #f2faf4; border-color: #6db07b; }
        .details-toggle-btn {
          width: 100%;
          padding: 7px 10px;
          background: #f9f7f3;
          border: 1px solid #e8e4dc;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 600;
          color: #7a8a7a;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.12s;
        }
        .details-toggle-btn:hover { background: #f2ede6; }
        .form-photo-pick-btn {
          width: 100%;
          padding: 7px 10px;
          background: #f2faf4;
          border: 1.5px dashed #93c9a0;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 600;
          color: #6db07b;
          cursor: pointer;
          font-family: inherit;
          text-align: center;
          transition: background 0.12s;
        }
        .form-photo-pick-btn:hover { background: #e4f5e9; }
        .archived-section-toggle {
          width: 100%;
          padding: 8px 10px;
          background: transparent;
          border: 1px solid #e8e4dc;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #a0a8a2;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.12s;
          margin-top: 10px;
        }
        .archived-section-toggle:hover { background: #f5f2ed; }
        .archived-plant-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: #ffffff;
          border-radius: 8px;
          margin-bottom: 6px;
          box-shadow: 0 1px 2px rgba(60, 50, 30, 0.06);
        }
        .btn-restore {
          padding: 4px 10px;
          background: transparent;
          border: 1px solid #b8d4bc;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #6db07b;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .btn-restore:hover { background: #f2faf4; }
      `}</style>

      {openMenuId !== null && (
        <div
          onClick={() => setOpenMenuId(null)}
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 }}
        />
      )}

      <div className="col-board">
        <h2 className="col-heading">育てている植物</h2>

        {hasError ? (
          <div className="todo-card">
            <p style={{ color: "#b91c1c", margin: 0, fontSize: 13 }}>植物データの取得でエラーが出ました</p>
          </div>
        ) : localPlants.length === 0 ? (
          <div className="todo-card">
            <p style={{ color: "#9ca3af", margin: 0, fontSize: 13 }}>まだ植物は登録されていません</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={localPlants.map((p) => p.id)} strategy={rectSortingStrategy}>
              <div className="plants-grid">
                {localPlants.map((plant) => {
                  const preview = photoPreviews[plant.id];
                  const displayPhoto = preview ?? latestPhotos[plant.id] ?? null;
                  const hasTodayEvent = plantHasTodayEventRecord[plant.id] ?? false;
                  const stateLabel = getInitialStateLabel(plant.initial_state_type);
                  const isMenuOpen = openMenuId === plant.id;

                  return (
                    <SortablePlantCard key={plant.id} id={plant.id}>
                      {/* Photo area */}
                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          aspectRatio: "5/2",
                          overflow: "hidden",
                          background: "linear-gradient(135deg, #d4edda 0%, #b8dfbf 55%, #93c9a0 100%)",
                          cursor: uploadingIds[plant.id] ? "not-allowed" : displayPhoto ? "zoom-in" : "default",
                        }}
                        onClick={() => {
                          if (uploadingIds[plant.id]) return;
                          if (displayPhoto) setPreviewPhotoUrl(displayPhoto);
                        }}
                      >
                        {displayPhoto ? (
                          <img
                            src={displayPhoto}
                            alt={getPlantLabel(plant.plant_type)}
                            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <span
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              fontSize: 10,
                              fontWeight: 600,
                              color: "rgba(147, 201, 160, 0.9)",
                              letterSpacing: "1.2px",
                              textTransform: "uppercase",
                              userSelect: "none",
                              pointerEvents: "none",
                            }}
                          >
                            photo
                          </span>
                        )}
                        {uploadingIds[plant.id] ? (
                          <div className="photo-upload-loading-hint">
                            {(() => {
                              const prog = uploadProgress[plant.id];
                              if (prog && prog.total > 1) return `${prog.current}/${prog.total}枚 アップロード中…`;
                              return "アップロード中…";
                            })()}
                          </div>
                        ) : displayPhoto ? (
                          <div className="photo-hover-hint">クリックして拡大</div>
                        ) : null}
                        {!uploadingIds[plant.id] && (
                          <button
                            type="button"
                            className="photo-camera-btn"
                            onClick={(e) => { e.stopPropagation(); setPhotoMenuOpenId((prev) => prev === plant.id ? null : plant.id); }}
                            aria-label="写真を追加"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <input
                        ref={(el) => { photoInputRefs.current[plant.id] = el; }}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: "none" }}
                        onChange={(e) => handlePhotoChange(plant.id, e)}
                      />
                      <input
                        ref={(el) => { photoLibraryInputRefs.current[plant.id] = el; }}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: "none" }}
                        onChange={(e) => handlePhotoChange(plant.id, e)}
                      />

                      {/* Info area */}
                      <div className="plant-info-wrap">
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#2d4a3e", marginBottom: 1, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {getPlantLabel(plant.plant_type)}
                        </div>

                        {plant.species && (
                          <div style={{ fontSize: 10, color: "#7a8a7a", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {plant.species}
                          </div>
                        )}

                        <div style={{ color: "#b0b8b0", fontSize: 10, marginBottom: 3 }}>
                          {plant.location ? `📍 ${plant.location}` : (plant.started_at ?? plant.planted_at ?? "")}
                        </div>

                        {plant.location && (
                          <div style={{ color: "#b0b8b0", fontSize: 10, marginBottom: 3 }}>
                            {plant.started_at ?? plant.planted_at ?? ""}
                          </div>
                        )}

                        {plant.memo && (
                          <div style={{ fontSize: 10, color: "#a0a8a2", marginBottom: 3, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {plant.memo}
                          </div>
                        )}

                        {stateLabel && !plant.species && !plant.location && (
                          <div style={{ fontSize: 10, color: "#7a9a7a", marginBottom: 4, lineHeight: 1.4 }}>
                            植えたとき：{stateLabel}
                          </div>
                        )}

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                          <span className={hasTodayEvent ? "badge-alert" : "badge-ok"}>
                            {hasTodayEvent ? "要対応" : "見守り"}
                          </span>
                          <div style={{ position: "relative" }}>
                            <button type="button" className="plant-menu-trigger" onClick={(e) => handleMenuToggle(plant.id, e)} aria-label="操作メニューを開く">
                              ···
                            </button>
                            {isMenuOpen && (
                              <div className="plant-menu-dropdown">
                                <button type="button" className="plant-menu-item" onClick={() => handleHistoryOpen(plant.id)}>
                                  写真履歴を見る
                                </button>
                                <form action={archivePlantAction} style={{ display: "contents" }}>
                                  <input type="hidden" name="plant_id" value={plant.id} />
                                  <button type="submit" className="plant-menu-item-danger" onClick={() => setOpenMenuId(null)}>
                                    アーカイブ
                                  </button>
                                </form>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleHistoryOpen(plant.id)}
                          style={{ display: "block", marginTop: 5, background: "none", border: "none", padding: 0, fontSize: 10, color: "#6db07b", cursor: "pointer", fontFamily, fontWeight: 600 }}
                        >
                          {(photoHistories[plant.id]?.length ?? 0) > 0
                            ? `過去写真（${photoHistories[plant.id].length}枚）`
                            : "過去写真を見る"}
                        </button>

                        {uploadErrors[plant.id] && (
                          <div style={{ fontSize: 10, color: "#b91c1c", marginTop: 5, lineHeight: 1.5 }}>
                            {uploadErrors[plant.id]}
                          </div>
                        )}
                      </div>

                      {/* Photo source menu overlay */}
                      {photoMenuOpenId === plant.id && !uploadingIds[plant.id] && (
                        <div className="photo-source-overlay" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="photo-source-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              photoInputRefs.current[plant.id]?.click();
                              setPhotoMenuOpenId(null);
                            }}
                          >
                            📷 撮影
                          </button>
                          <button
                            type="button"
                            className="photo-source-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              photoLibraryInputRefs.current[plant.id]?.click();
                              setPhotoMenuOpenId(null);
                            }}
                          >
                            🖼 ライブラリ
                          </button>
                        </div>
                      )}
                    </SortablePlantCard>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Add plant form */}
        {!isFormOpen ? (
          <button type="button" className="btn-add-plant-toggle" onClick={() => setIsFormOpen(true)}>
            ＋ 植物を追加する
          </button>
        ) : (
          <div className="form-card" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2d4a3e" }}>植物を追加する</div>
              <button
                type="button"
                onClick={() => { setIsFormOpen(false); setIsDetailsOpen(false); setFormPhotoPreview(null); formRef.current?.reset(); }}
                style={{ background: "none", border: "none", fontSize: 12, color: "#9ca3af", cursor: "pointer", fontFamily, padding: "2px 6px" }}
              >
                キャンセル
              </button>
            </div>

            <form ref={formRef} action={handleFormAction}>
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">植物名 <span style={{ color: "#b91c1c" }}>*</span></label>
                <input type="text" name="name" required placeholder="例：ミニトマト、バジル、パキラ" className="form-input" />
              </div>

              <button
                type="button"
                className="details-toggle-btn"
                onClick={() => setIsDetailsOpen((v) => !v)}
                style={{ marginBottom: isDetailsOpen ? 12 : 14 }}
              >
                <span style={{ fontSize: 11 }}>{isDetailsOpen ? "▼" : "▶"}</span>
                詳細を入力する
                <span style={{ fontSize: 10, color: "#b0b8b0", fontWeight: 400 }}>（任意）</span>
              </button>

              {isDetailsOpen && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 10 }}>
                    <label className="form-label">種類 / 品種 <span style={{ fontSize: 9, color: "#b0b8b0", fontWeight: 400 }}>わかれば</span></label>
                    <input type="text" name="species" placeholder="例：中玉トマト、スイートバジル" className="form-input" />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label className="form-label">置き場所 <span style={{ fontSize: 9, color: "#b0b8b0", fontWeight: 400 }}>任意</span></label>
                    <input type="text" name="location" placeholder="例：南向きベランダ、窓際" className="form-input" />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label className="form-label">育成開始日 <span style={{ fontSize: 9, color: "#b0b8b0", fontWeight: 400 }}>任意</span></label>
                    <input type="date" name="started_at" defaultValue={today} className="form-input" />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label className="form-label">メモ <span style={{ fontSize: 9, color: "#b0b8b0", fontWeight: 400 }}>任意</span></label>
                    <textarea name="memo" placeholder="例：種から育てた苗、購入先：〇〇ホームセンター" className="form-textarea" />
                  </div>
                  <div style={{ marginBottom: 2 }}>
                    <label className="form-label">写真 <span style={{ fontSize: 9, color: "#b0b8b0", fontWeight: 400 }}>任意</span></label>
                    {formPhotoPreview && (
                      <img src={formPhotoPreview} alt="プレビュー" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 7, display: "block", marginBottom: 6 }} />
                    )}
                    <button type="button" className="form-photo-pick-btn" onClick={() => formPhotoInputRef.current?.click()}>
                      {formPhotoPreview ? "写真を変更する" : "📷 写真を選ぶ"}
                    </button>
                    <input ref={formPhotoInputRef} type="file" name="photo" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFormPhotoChange} />
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={isPending}
                style={{ width: "100%", padding: "10px 16px", fontSize: 14, opacity: isPending ? 0.7 : 1, cursor: isPending ? "not-allowed" : "pointer", fontFamily }}
              >
                {isPending ? "追加中…" : "追加する"}
              </button>
            </form>
          </div>
        )}

        {/* Archived plants */}
        {archivedPlants.length > 0 && (
          <>
            <button type="button" className="archived-section-toggle" onClick={() => setIsArchivedOpen((v) => !v)}>
              <span style={{ fontSize: 11 }}>{isArchivedOpen ? "▼" : "▶"}</span>
              アーカイブ済み（{archivedPlants.length}件）
            </button>
            {isArchivedOpen && (
              <div style={{ marginTop: 8 }}>
                {archivedPlants.map((plant) => (
                  <div key={plant.id} className="archived-plant-row">
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>{getPlantLabel(plant.plant_type)}</div>
                      {plant.species && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{plant.species}</div>}
                      <div style={{ fontSize: 10, color: "#c8c0b4", marginTop: 1 }}>{plant.started_at ?? plant.planted_at ?? ""}</div>
                    </div>
                    <form action={restorePlantAction}>
                      <input type="hidden" name="plant_id" value={plant.id} />
                      <button type="submit" className="btn-restore">復元</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Photo history modal */}
      {historyModalId && (
        <div className="modal-overlay" onClick={() => setHistoryModalId(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#2d4a3e", fontFamily }}>
                  {getPlantLabel(historyPlant?.plant_type)} の写真履歴
                </div>
                {(photoHistories[historyModalId!] ?? []).length > 0 && (
                  <div style={{ fontSize: 11, color: "#a0a8a2", fontFamily, marginTop: 2 }}>
                    {(photoHistories[historyModalId!] ?? []).length}枚・古い順に表示
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setHistoryModalId(null)} style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer", lineHeight: 1, padding: "0 4px", fontFamily }}>×</button>
            </div>

            {(() => {
              const history = [...(photoHistories[historyModalId!] ?? [])].reverse();
              if (history.length === 0) {
                return (
                  <div style={{ padding: "40px 16px", textAlign: "center", border: "1px dashed #c8e6cc", borderRadius: 10, background: "#f9fcf9", marginBottom: 20 }}>
                    <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 6, fontFamily }}>写真履歴はまだありません</div>
                    <div style={{ fontSize: 12, color: "#c8c0b4", fontFamily }}>カメラアイコンをタップして記録を始めましょう</div>
                  </div>
                );
              }
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8, marginBottom: 20 }}>
                  {history.map((photo) => (
                    <div key={photo.id}>
                      <img src={photo.url} alt={photo.takenAt} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, display: "block", cursor: "zoom-in" }} onClick={() => setPreviewPhotoUrl(photo.url)} />
                      <div style={{ fontSize: 10, color: "#a0a8a2", textAlign: "center", marginTop: 4, fontFamily }}>{photo.takenAt}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <button type="button" className="btn-primary" onClick={() => setHistoryModalId(null)} style={{ padding: "8px 20px", fontSize: 13, fontFamily }}>閉じる</button>
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {previewPhotoUrl && (
        <div className="modal-overlay" style={{ zIndex: 300, background: "rgba(0, 0, 0, 0.88)" }} onClick={() => setPreviewPhotoUrl(null)}>
          <div style={{ position: "relative", maxWidth: "92vw", maxHeight: "88vh", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => e.stopPropagation()}>
            <img src={previewPhotoUrl} alt="写真プレビュー" style={{ maxWidth: "92vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 8, display: "block" }} />
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              style={{ position: "absolute", top: -14, right: -14, width: 32, height: 32, borderRadius: "50%", background: "rgba(0, 0, 0, 0.55)", border: "2px solid rgba(255, 255, 255, 0.3)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, fontFamily }}
            >×</button>
          </div>
        </div>
      )}
    </>
  );
}
