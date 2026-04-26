"use client";

import { useRef, useState, useTransition } from "react";

type PlantMasterOption = { plant_code: string; plant_name: string };

type PhotoHistoryItem = { id: string; url: string; takenAt: string };

type Props = {
  plants: any[];
  enabledPlantOptions: PlantMasterOption[];
  today: string;
  plantHasTodayEventRecord: Record<string, boolean>;
  hasError: boolean;
  addPlantAction: (formData: FormData) => Promise<void>;
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
  return plantType ? (plantLabelMap[plantType] ?? "植物") : "植物";
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

export function PlantColumn({
  plants,
  enabledPlantOptions,
  today,
  plantHasTodayEventRecord,
  hasError,
  addPlantAction,
  uploadPhotoAction,
  latestPhotos,
  photoHistories,
}: Props) {
  // Photo preview: plant_id → data URL (session-only; cleared on reload)
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});
  // Which plant's "···" menu is open
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  // Which plant's history modal is open
  const [historyModalId, setHistoryModalId] = useState<string | null>(null);
  // Form submission pending state
  const [isPending, startTransition] = useTransition();
  // Per-plant upload loading and error state
  const [uploadingIds, setUploadingIds] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  // Photo preview lightbox
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  // Collapsible add-plant form
  const [isFormOpen, setIsFormOpen] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function handlePhotoClick(plantId: string) {
    photoInputRefs.current[plantId]?.click();
  }

  async function handlePhotoChange(
    plantId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear previous error
    setUploadErrors((prev) => { const next = { ...prev }; delete next[plantId]; return next; });

    // File size check: 5 MB
    if (file.size > 5 * 1024 * 1024) {
      setUploadErrors((prev) => ({
        ...prev,
        [plantId]: "画像サイズが大きすぎます（5MB以内にしてください）",
      }));
      return;
    }

    // Immediate session preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") {
        setPhotoPreviews((prev) => ({ ...prev, [plantId]: result }));
      }
    };
    reader.readAsDataURL(file);

    setUploadingIds((prev) => ({ ...prev, [plantId]: true }));

    try {
      const compressed = await compressImage(file);
      const compressedFile = new File(
        [compressed],
        file.name.replace(/\.[^/.]+$/, "") + ".jpg",
        { type: "image/jpeg" }
      );

      const fd = new FormData();
      fd.set("plant_id", plantId);
      fd.set("photo", compressedFile);

      const result = await uploadPhotoAction(fd);
      if (!result.success) {
        setUploadErrors((prev) => ({
          ...prev,
          [plantId]: result.error ?? "アップロードに失敗しました。通信状態を確認してください。",
        }));
      }
    } catch {
      setUploadErrors((prev) => ({
        ...prev,
        [plantId]: "アップロードに失敗しました。通信状態を確認してください。",
      }));
    } finally {
      setUploadingIds((prev) => { const next = { ...prev }; delete next[plantId]; return next; });
    }
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
      await addPlantAction(formData);
      formRef.current?.reset();
      setIsFormOpen(false);
    });
  }

  const historyPlant = historyModalId
    ? plants.find((p) => p.id === historyModalId)
    : null;

  return (
    <>
      <style>{`
        .plant-card-wrap {
          background: #ffffff;
          border-radius: 10px;
          box-shadow: 0 1px 3px rgba(60, 50, 30, 0.08);
          transition: box-shadow 0.15s;
          position: relative;
        }
        .plant-card-wrap:hover {
          box-shadow: 0 3px 10px rgba(60, 50, 30, 0.13);
        }
        .plant-photo-click {
          height: 96px;
          background: linear-gradient(135deg, #d4edda 0%, #b8dfbf 55%, #93c9a0 100%);
          border-radius: 10px 10px 0 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
        }
        .plant-photo-click:hover .photo-hover-hint {
          opacity: 1;
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
          letter-spacing: 0.3px;
          font-family: ${fontFamily};
        }
        .photo-camera-btn {
          position: absolute;
          bottom: 6px;
          right: 6px;
          width: 28px;
          height: 28px;
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
        .photo-placeholder-label {
          font-size: 10px;
          font-weight: 600;
          color: rgba(147, 201, 160, 0.9);
          letter-spacing: 1.2px;
          text-transform: uppercase;
          user-select: none;
        }
        .plant-info-wrap {
          padding: 10px 11px 12px;
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
          min-width: 120px;
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
        .plant-menu-item:hover {
          background: #f9f7f3;
          color: #2d4a3e;
        }
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
        .btn-add-plant-toggle:hover {
          background: #f2faf4;
          border-color: #6db07b;
        }
      `}</style>

      {/* Transparent backdrop — closes the "···" menu on outside click */}
      {openMenuId !== null && (
        <div
          onClick={() => setOpenMenuId(null)}
          style={{
            position: "fixed",
            top: 0, right: 0, bottom: 0, left: 0,
            zIndex: 40,
          }}
        />
      )}

      {/* ── Column board ── */}
      <div className="col-board">
        <h2 className="col-heading">育てている植物</h2>

        {/* Plant cards */}
        {hasError ? (
          <div className="todo-card">
            <p style={{ color: "#b91c1c", margin: 0, fontSize: 13 }}>
              植物データの取得でエラーが出ました
            </p>
          </div>
        ) : plants.length === 0 ? (
          <div className="todo-card">
            <p style={{ color: "#9ca3af", margin: 0, fontSize: 13 }}>
              まだ植物は登録されていません
            </p>
          </div>
        ) : (
          <div className="plants-grid">
            {plants.map((plant) => {
              const hasTodayEvent =
                plantHasTodayEventRecord[plant.id] ?? false;
              const stateLabel = getInitialStateLabel(plant.initial_state_type);
              const preview = photoPreviews[plant.id];
              const displayPhoto = preview ?? latestPhotos[plant.id] ?? null;
              const isMenuOpen = openMenuId === plant.id;

              return (
                <div key={plant.id} className="plant-card-wrap">
                  {/* Photo area */}
                  <div
                    className="plant-photo-click"
                    style={{
                      cursor: uploadingIds[plant.id]
                        ? "not-allowed"
                        : displayPhoto
                        ? "zoom-in"
                        : "default",
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
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <span className="photo-placeholder-label">photo</span>
                    )}
                    {uploadingIds[plant.id] ? (
                      <div className="photo-upload-loading-hint">アップロード中…</div>
                    ) : displayPhoto ? (
                      <div className="photo-hover-hint">クリックして拡大</div>
                    ) : null}
                    {!uploadingIds[plant.id] && (
                      <button
                        type="button"
                        className="photo-camera-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePhotoClick(plant.id);
                        }}
                        aria-label="写真を追加"
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Hidden file input (future: upload to Supabase Storage) */}
                  <input
                    ref={(el: HTMLInputElement | null) => {
                      photoInputRefs.current[plant.id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={(e) => handlePhotoChange(plant.id, e)}
                  />

                  <div className="plant-info-wrap">
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#2d4a3e",
                        marginBottom: 2,
                        lineHeight: 1.3,
                      }}
                    >
                      {getPlantLabel(plant.plant_type)}
                    </div>
                    <div
                      style={{
                        color: "#b0b8b0",
                        fontSize: 11,
                        marginBottom: 4,
                      }}
                    >
                      {plant.planted_at}
                    </div>

                    {stateLabel ? (
                      <div
                        style={{
                          fontSize: 10,
                          color: "#7a9a7a",
                          marginBottom: 6,
                          lineHeight: 1.5,
                        }}
                      >
                        <span>植えたとき：{stateLabel}</span>
                        {plant.initial_state_note && (
                          <div style={{ color: "#a0a8a2", marginTop: 1 }}>
                            {plant.initial_state_note}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 10,
                          color: "#d1d5db",
                          marginBottom: 6,
                        }}
                      >
                        未設定
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 4,
                      }}
                    >
                      <span
                        className={hasTodayEvent ? "badge-alert" : "badge-ok"}
                      >
                        {hasTodayEvent ? "要対応" : "良好"}
                      </span>

                      {/* ··· operations menu */}
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          className="plant-menu-trigger"
                          onClick={(e) => handleMenuToggle(plant.id, e)}
                          aria-label="操作メニューを開く"
                        >
                          ···
                        </button>
                        {isMenuOpen && (
                          <div className="plant-menu-dropdown">
                            <button
                              type="button"
                              className="plant-menu-item"
                              onClick={() => handleHistoryOpen(plant.id)}
                            >
                              写真履歴を見る
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleHistoryOpen(plant.id)}
                      style={{
                        display: "block",
                        marginTop: 6,
                        background: "none",
                        border: "none",
                        padding: 0,
                        fontSize: 10,
                        color: "#6db07b",
                        cursor: "pointer",
                        fontFamily,
                        fontWeight: 600,
                        letterSpacing: 0.2,
                      }}
                    >
                      {(photoHistories[plant.id]?.length ?? 0) > 0
                        ? `過去写真を見る（${photoHistories[plant.id].length}枚）`
                        : "過去写真を見る"}
                    </button>

                    {uploadErrors[plant.id] && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "#b91c1c",
                          marginTop: 6,
                          lineHeight: 1.5,
                        }}
                      >
                        {uploadErrors[plant.id]}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Collapsible add plant form */}
        {!isFormOpen ? (
          <button
            type="button"
            className="btn-add-plant-toggle"
            onClick={() => setIsFormOpen(true)}
          >
            ＋ 植物を追加する
          </button>
        ) : (
          <div className="form-card" style={{ marginBottom: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#2d4a3e",
                  letterSpacing: 0.3,
                }}
              >
                植物を追加する
              </div>
              <button
                type="button"
                onClick={() => { setIsFormOpen(false); formRef.current?.reset(); }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 12,
                  color: "#9ca3af",
                  cursor: "pointer",
                  fontFamily,
                  padding: "2px 6px",
                }}
              >
                キャンセル
              </button>
            </div>
            <form ref={formRef} action={handleFormAction}>
              <div style={{ marginBottom: 10 }}>
                <label className="form-label">植物</label>
                <select
                  name="plant_type"
                  className="form-input"
                  defaultValue={
                    enabledPlantOptions[0]?.plant_code ?? "tomato"
                  }
                >
                  {enabledPlantOptions.map((p) => (
                    <option key={p.plant_code} value={p.plant_code}>
                      {p.plant_name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label className="form-label">植えた日</label>
                <input
                  type="date"
                  name="planted_at"
                  defaultValue={today}
                  className="form-input"
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label className="form-label">植えたときの状態</label>
                <select name="initial_state_type" className="form-input">
                  <option value="">— 選択してください —</option>
                  <option value="seed">種</option>
                  <option value="seedling">苗</option>
                  <option value="cutting">挿し木</option>
                  <option value="established">既に育っている株</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">メモ</label>
                <textarea
                  name="initial_state_note"
                  placeholder="例：10cmくらいの苗、種まきから2週間"
                  className="form-textarea"
                />
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={isPending}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  fontSize: 14,
                  opacity: isPending ? 0.7 : 1,
                  cursor: isPending ? "not-allowed" : "pointer",
                  fontFamily,
                }}
              >
                {isPending ? "追加中…" : "追加する"}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Photo history modal */}
      {historyModalId && (
        <div
          className="modal-overlay"
          onClick={() => setHistoryModalId(null)}
        >
          <div
            className="modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#2d4a3e",
                    fontFamily,
                  }}
                >
                  {getPlantLabel(historyPlant?.plant_type)} の写真履歴
                </div>
                {(photoHistories[historyModalId!] ?? []).length > 0 && (
                  <div style={{ fontSize: 11, color: "#a0a8a2", fontFamily, marginTop: 2 }}>
                    {(photoHistories[historyModalId!] ?? []).length}枚・古い順に表示
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalId(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  color: "#9ca3af",
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: "0 4px",
                  fontFamily,
                }}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            {(() => {
              const rawHistory = photoHistories[historyModalId!] ?? [];
              const history = [...rawHistory].reverse();
              if (history.length === 0) {
                return (
                  <div
                    style={{
                      padding: "40px 16px",
                      textAlign: "center",
                      border: "1px dashed #c8e6cc",
                      borderRadius: 10,
                      background: "#f9fcf9",
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 6, fontFamily }}>
                      写真履歴はまだありません
                    </div>
                    <div style={{ fontSize: 12, color: "#c8c0b4", fontFamily }}>
                      カメラアイコンをタップして記録を始めましょう
                    </div>
                  </div>
                );
              }
              return (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
                    gap: 8,
                    marginBottom: 20,
                  }}
                >
                  {history.map((photo) => (
                    <div key={photo.id}>
                      <img
                        src={photo.url}
                        alt={photo.takenAt}
                        style={{
                          width: "100%",
                          aspectRatio: "1",
                          objectFit: "cover",
                          borderRadius: 8,
                          display: "block",
                          cursor: "zoom-in",
                        }}
                        onClick={() => setPreviewPhotoUrl(photo.url)}
                      />
                      <div
                        style={{
                          fontSize: 10,
                          color: "#a0a8a2",
                          textAlign: "center",
                          marginTop: 4,
                          fontFamily,
                        }}
                      >
                        {photo.takenAt}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <button
              type="button"
              className="btn-primary"
              onClick={() => setHistoryModalId(null)}
              style={{
                padding: "8px 20px",
                fontSize: 13,
                fontFamily,
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* Photo preview lightbox */}
      {previewPhotoUrl && (
        <div
          className="modal-overlay"
          style={{ zIndex: 300, background: "rgba(0, 0, 0, 0.88)" }}
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "92vw",
              maxHeight: "88vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewPhotoUrl}
              alt="写真プレビュー"
              style={{
                maxWidth: "92vw",
                maxHeight: "88vh",
                objectFit: "contain",
                borderRadius: 8,
                display: "block",
              }}
            />
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              style={{
                position: "absolute",
                top: -14,
                right: -14,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(0, 0, 0, 0.55)",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                fontFamily,
              }}
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
