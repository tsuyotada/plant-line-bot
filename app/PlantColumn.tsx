"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { useRouter } from "next/navigation";
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

type PhotoHistoryItem = {
  id: string;
  url: string;
  takenAt: string;
  siteComment:     string | null;
  changeSummary:   string | null;
  careAdvice:      string | null;
  watchPoint:      string | null;
  analysisVersion: number | null;
};

type BatchItem = {
  id: string;
  file: File;
  preview: string;
  plantId: string;
  status: "pending" | "uploading" | "done" | "error";
  errorMsg?: string;
  identifying?: boolean;
  autoSelected?: boolean;
  autoSelectReason?: string;
};

type CareCardInfo = {
  advice: string;
  tags: string[];
  priority: string;
};

type Props = {
  plants: any[];
  archivedPlants: any[];
  today: string;
  plantHasTodayEventRecord: Record<string, boolean>;
  hasError: boolean;
  readOnly?: boolean;
  addPlantAction?: (formData: FormData) => Promise<void>;
  archivePlantAction?: (formData: FormData) => Promise<void>;
  restorePlantAction?: (formData: FormData) => Promise<void>;
  reorderPlantAction?: (orderedIds: string[]) => Promise<void>;
  uploadPhotoAction?: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  deletePhotoAction?: (formData: FormData) => Promise<void>;
  latestPhotos: Record<string, string>;
  photoHistories: Record<string, PhotoHistoryItem[]>;
  careCardMap: Record<string, CareCardInfo>;
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
  const compress = (maxLongEdge: number, quality: number) =>
    new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        const longEdge = Math.max(width, height);
        if (longEdge > maxLongEdge) {
          const ratio = maxLongEdge / longEdge;
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
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
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("image load failed")); };
      img.src = objectUrl;
    });

  // 1回目：長辺1920px / quality 0.82（AI判定・観察に十分な画質）
  const blob = await compress(1920, 0.82);
  // 3MBを超える場合だけ、より小さくリトライ
  if (blob.size > 3 * 1024 * 1024) {
    return compress(1200, 0.75);
  }
  return blob;
}

async function compressToDataUrl(file: File, maxWidth = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
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

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  "水やり":   { bg: "#dbeafe", color: "#1e40af" },
  "液体肥料": { bg: "#fef3c7", color: "#92400e" },
  "観察":     { bg: "#e0f2fe", color: "#0369a1" },
  "写真記録": { bg: "#ede9fe", color: "#5b21b6" },
  "剪定":     { bg: "#dcfce7", color: "#166534" },
  "収穫":     { bg: "#d1fae5", color: "#065f46" },
  "環境確認": { bg: "#f1f5f9", color: "#475569" },
};

const TAG_TODO: Record<string, string> = {
  "水やり":   "水やりをしましょう。",
  "液体肥料": "液体肥料をあげるタイミングです。",
  "観察":     "葉や茎の様子を観察してみましょう。",
  "写真記録": "今日の様子を写真に残しましょう。",
  "剪定":     "不要な葉・枝を剪定しましょう。",
  "収穫":     "収穫できそうな実を確認しましょう。",
  "環境確認": "置き場所・日当たりを確認してみましょう。",
};

const TAG_PRIORITY_ORDER = ["水やり", "液体肥料", "観察", "剪定", "収穫", "環境確認", "写真記録"];

// ── 初回登録ウィザード（植物0件のオーナーのみ表示） ────────────────────────────

function OnboardingWizard({
  addPlantAction,
}: {
  addPlantAction: (formData: FormData) => Promise<void>;
}) {
  type WizardStep = "welcome" | "type" | "photo" | "details";
  const [step, setStep] = useState<WizardStep>("welcome");
  const [plantType, setPlantType] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [memo, setMemo] = useState("");
  const [isPending, startTransition] = useTransition();
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") setPhotoPreview(ev.target.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    if (!plantType.trim()) return;
    startTransition(async () => {
      const hasPhoto = !!photo;
      const fd = new FormData();
      fd.set("name", plantType.trim());
      if (location.trim()) fd.set("location", location.trim());
      if (memo.trim()) fd.set("memo", memo.trim());
      if (photo) {
        try {
          const compressed = await compressImage(photo);
          fd.set("photo", new File([compressed], photo.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg" }));
        } catch {
          fd.set("photo", photo);
        }
      }
      try { sessionStorage.setItem("pc-welcome", "1"); } catch { /* ignore */ }
      await addPlantAction(fd);
      trackEvent("plant_created", { role: "owner", has_photo: hasPhoto });
      if (hasPhoto) trackEvent("plant_created_with_photo", { role: "owner" });
    });
  }

  const stepNum = step === "type" ? 1 : step === "photo" ? 2 : step === "details" ? 3 : null;

  return (
    <div style={{ padding: "8px 0", minHeight: 280 }}>
      <style>{`
        .wizard-btn-primary {
          width: 100%; padding: 10px; background: #4b7a5a; color: #fff;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: ${fontFamily};
        }
        .wizard-btn-primary:disabled { background: #9ca3af; cursor: not-allowed; }
        @keyframes pc-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {step === "welcome" && (
        <div style={{ textAlign: "center", padding: "28px 8px 20px", animation: "pc-fadein 0.3s ease" }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#a0b8a0",
            letterSpacing: 2, textTransform: "uppercase",
            marginBottom: 20, fontFamily,
          }}>
            First plant
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1a3320", marginBottom: 10, lineHeight: 1.4, fontFamily }}>
            まずは、1鉢置いてみましょう
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.8, marginBottom: 32, fontFamily }}>
            種類と写真があると、その植物に合わせた<br />
            ケアのタイミングを調整できます。<br />
            あとから少しずつ整えられます。
          </div>
          <button
            type="button"
            onClick={() => setStep("type")}
            style={{
              padding: "10px 32px", background: "#4b7a5a", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily,
            }}
          >
            はじめる →
          </button>
        </div>
      )}

      {stepNum !== null && (
        <div style={{ animation: "pc-fadein 0.25s ease" }}>
          {/* ステップインジケーター */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 22 }}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={{
                width: 32, height: 4, borderRadius: 2,
                background: n < stepNum ? "#4b7a5a" : n === stepNum ? "#48b06a" : "#e5e7eb",
                transition: "background 0.25s",
              }} />
            ))}
          </div>

          {step === "type" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2d4a3e", marginBottom: 4, lineHeight: 1.5, fontFamily }}>
                植物の種類を教えてください
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 12, lineHeight: 1.65, fontFamily }}>
                わかる範囲で大丈夫です。種類と写真をもとに、気にかけるタイミングを調整します。
              </div>
              <input
                type="text"
                value={plantType}
                onChange={(e) => setPlantType(e.target.value)}
                placeholder="例：サボテン、ガジュマル、コブミカン、バジル"
                className="form-input"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && plantType.trim()) setStep("photo"); }}
                style={{ marginBottom: 14 }}
              />
              <button
                type="button"
                className="wizard-btn-primary"
                onClick={() => plantType.trim() && setStep("photo")}
                disabled={!plantType.trim()}
              >
                次へ →
              </button>
            </div>
          )}

          {step === "photo" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2d4a3e", marginBottom: 4, lineHeight: 1.5, fontFamily }}>
                写真があると、あとから変化を見やすくなります
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 12, lineHeight: 1.65, fontFamily }}>
                写真はあとから追加しても大丈夫です。
              </div>
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="プレビュー"
                  style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 8, display: "block", marginBottom: 10 }}
                />
              )}
              <button
                type="button"
                className="form-photo-pick-btn"
                onClick={() => photoInputRef.current?.click()}
                style={{ marginBottom: 12 }}
              >
                {photoPreview ? "写真を変更する" : "写真を選ぶ / 撮る"}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={handlePhotoChange}
              />
              <button
                type="button"
                className="wizard-btn-primary"
                onClick={() => setStep("details")}
              >
                次へ →
              </button>
              {!photoPreview && (
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  style={{
                    display: "block", width: "100%", marginTop: 8, background: "none",
                    border: "none", padding: 0, fontSize: 11, color: "#9ca3af",
                    cursor: "pointer", fontFamily, textAlign: "center",
                  }}
                >
                  写真はあとで追加する
                </button>
              )}
            </div>
          )}

          {step === "details" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2d4a3e", marginBottom: 4, lineHeight: 1.5, fontFamily }}>
                どこに置いているか、軽く残しておけます
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 12, fontFamily }}>どちらも任意です。あとから追加しても大丈夫です。</div>
              <div style={{ marginBottom: 10 }}>
                <label className="form-label">置き場所</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="例：南向きベランダ、窓際"
                  className="form-input"
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">ひとことメモ</label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="気になることや覚えておきたいことなど"
                  className="form-textarea"
                />
              </div>
              <button
                type="button"
                className="wizard-btn-primary"
                onClick={handleSubmit}
                disabled={isPending}
                style={{ opacity: isPending ? 0.7 : 1, cursor: isPending ? "not-allowed" : "pointer" }}
              >
                {isPending ? "登録中…" : "この1鉢を置く"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PlantColumn({
  plants,
  archivedPlants,
  today,
  plantHasTodayEventRecord,
  hasError,
  readOnly = false,
  addPlantAction,
  archivePlantAction,
  restorePlantAction,
  reorderPlantAction,
  uploadPhotoAction,
  deletePhotoAction,
  latestPhotos,
  photoHistories,
  careCardMap,
}: Props) {
  const router = useRouter();
  const [localPlants, setLocalPlants] = useState(plants);
  const [welcomeToast, setWelcomeToast] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [historyModalId, setHistoryModalId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadingIds, setUploadingIds] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [expandedCareIds, setExpandedCareIds] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Record<string, { current: number; total: number }>>({});
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchWarning, setBatchWarning] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  const touchStartX = useRef<number>(0);
  const formPhotoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLocalPlants(plants);
  }, [plants]);

  // ウィザード完了後のウェルカムトーストを plants が増えたタイミングで表示
  useEffect(() => {
    if (plants.length === 0) return;
    try {
      if (sessionStorage.getItem("pc-welcome") === "1") {
        sessionStorage.removeItem("pc-welcome");
        setWelcomeToast(true);
      }
    } catch { /* sessionStorage 使用不可環境 */ }
  }, [plants.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!welcomeToast) return;
    const t = setTimeout(() => setWelcomeToast(false), 4000);
    return () => clearTimeout(t);
  }, [welcomeToast]);

  const lightboxOpen = lightbox !== null;
  useEffect(() => {
    if (!lightboxOpen) return;
    function handleKey(e: KeyboardEvent) {
      setLightbox((prev) => {
        if (!prev) return prev;
        if (e.key === "ArrowLeft" && prev.index > 0) return { ...prev, index: prev.index - 1 };
        if (e.key === "ArrowRight" && prev.index < prev.urls.length - 1) return { ...prev, index: prev.index + 1 };
        if (e.key === "Escape") return null;
        return prev;
      });
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [lightboxOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!reorderPlantAction) return;
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

  async function handleDeletePhoto(photoId: string) {
    if (!deletePhotoAction) return;
    if (!window.confirm("この写真を削除しますか？")) return;
    const fd = new FormData();
    fd.set("photo_id", photoId);
    startTransition(async () => {
      await deletePhotoAction(fd);
    });
  }

  async function handlePhotoChange(plantId: string, e: React.ChangeEvent<HTMLInputElement>) {
    if (!uploadPhotoAction) return;
    const allFiles = Array.from(e.target.files ?? []);
    if (allFiles.length === 0) return;

    setUploadErrors((prev) => { const next = { ...prev }; delete next[plantId]; return next; });

    // スマホ写真は大きくても自動圧縮して登録できるように。30MB超のみスキップ（通常のスマホ写真には該当しない）
    const MAX_RAW = 30 * 1024 * 1024;
    const tooHuge = allFiles.filter((f) => f.size > MAX_RAW);
    const files = allFiles.filter((f) => f.size <= MAX_RAW);

    if (files.length === 0) {
      setUploadErrors((prev) => ({ ...prev, [plantId]: "写真が大きすぎて処理できませんでした。別の写真でお試しください。" }));
      e.target.value = "";
      return;
    }
    if (tooHuge.length > 0) {
      setUploadErrors((prev) => ({ ...prev, [plantId]: `${tooHuge.length}枚は処理できなかったためスキップします` }));
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
    let compressedTooLarge = false;

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
        // 圧縮後も4MBを超える場合は登録できない（通常のスマホ写真では発生しない）
        if (compressed.size > 4 * 1024 * 1024) {
          failCount++;
          compressedTooLarge = true;
          console.warn(`[Upload] 圧縮後もサイズ超過 file=${file.name} size=${compressed.size}`);
        } else {
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
      const msg = compressedTooLarge
        ? "写真を小さくしてみましたが、まだ登録できませんでした。少し軽い写真で試してみてください。"
        : "写真の登録に失敗しました。通信状態を確認してみてください。";
      setUploadErrors((prev) => ({ ...prev, [plantId]: msg }));
    } else if (failCount > 0) {
      setUploadErrors((prev) => ({ ...prev, [plantId]: `${failCount}枚の登録に失敗しました（${successCount}枚は成功）` }));
    }
    if (successCount > 0) {
      router.refresh();
    }
  }

  // Core batch initialization — shared between file-select and capture-session flows
  async function initBatchModal(files: File[], warning: string | null = null) {
    setBatchWarning(warning);

    const plantCount = localPlants.length;
    const needsIdentify = plantCount > 1;

    const items: BatchItem[] = await Promise.all(
      files.map(
        (file, i) =>
          new Promise<BatchItem>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const singlePlantId = plantCount === 1 ? localPlants[0].id : "";
              resolve({
                id: `${Date.now()}-${i}`,
                file,
                preview: ev.target?.result as string,
                plantId: singlePlantId,
                status: "pending",
                identifying: needsIdentify,
                autoSelected: plantCount === 1,
                autoSelectReason: plantCount === 1 ? "登録植物が1種類" : undefined,
              });
            };
            reader.readAsDataURL(file);
          })
      )
    );

    setBatchItems(items);
    setIsBatchModalOpen(true);

    if (needsIdentify) {
      const plantParams = localPlants.map((p) => ({
        id: p.id,
        name: getPlantLabel(p.plant_type),
        species: p.species ?? null,
        memo: p.memo ?? null,
        latestPhotoUrl: latestPhotos[p.id] ?? null,
      }));

      await Promise.allSettled(
        items.map(async (item) => {
          try {
            const smallDataUrl = await compressToDataUrl(item.file, 512);
            const res = await fetch("/api/identify-plant", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageDataUrl: smallDataUrl, plants: plantParams }),
            });
            const data = await res.json();
            const result = data.result as { matchedPlantId: string; confidence: number; reason: string } | null;
            setBatchItems((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? {
                      ...it,
                      identifying: false,
                      ...(result && result.confidence >= 0.6
                        ? { plantId: result.matchedPlantId, autoSelected: true, autoSelectReason: result.reason }
                        : {}),
                    }
                  : it
              )
            );
          } catch {
            setBatchItems((prev) =>
              prev.map((it) => (it.id === item.id ? { ...it, identifying: false } : it))
            );
          }
        })
      );
    }
  }

  async function handleBatchFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const allFiles = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (allFiles.length === 0) return;

    // 大きな写真は保存時に自動圧縮するため、30MB超のみ除外
    const MAX_RAW = 30 * 1024 * 1024;
    const tooHuge = allFiles.filter((f) => f.size > MAX_RAW);
    const files = allFiles.filter((f) => f.size <= MAX_RAW);

    if (files.length === 0) {
      setBatchWarning("写真が大きすぎて処理できませんでした。別の写真でお試しください。");
      return;
    }

    const warning = tooHuge.length > 0 ? `${tooHuge.length}枚は処理できなかったためスキップします` : null;
    await initBatchModal(files, warning);
  }

  async function handleBatchSave() {
    if (!uploadPhotoAction) return;
    const items = [...batchItems];
    setBatchSaving(true);
    const results = [...items];

    for (let i = 0; i < items.length; i++) {
      setBatchItems((prev) => prev.map((it, idx) => idx === i ? { ...it, status: "uploading" as const } : it));
      try {
        const item = items[i];
        const compressed = await compressImage(item.file);
        // 圧縮後も4MBを超える場合は登録不可（通常のスマホ写真では発生しない）
        if (compressed.size > 4 * 1024 * 1024) {
          const errMsg = "写真を小さくしても大きすぎました。別の写真でお試しください。";
          results[i] = { ...results[i], status: "error", errorMsg: errMsg };
          setBatchItems((prev) => prev.map((it, idx) => idx === i ? { ...it, status: "error" as const, errorMsg: errMsg } : it));
          continue;
        }
        const fd = new FormData();
        fd.set("plant_id", item.plantId);
        fd.set("photo", new File([compressed], item.file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg" }));
        const result = await uploadPhotoAction(fd);
        if (result.success) {
          results[i] = { ...results[i], status: "done" };
          setBatchItems((prev) => prev.map((it, idx) => idx === i ? { ...it, status: "done" as const } : it));
        } else {
          results[i] = { ...results[i], status: "error", errorMsg: result.error ?? "保存失敗" };
          setBatchItems((prev) => prev.map((it, idx) => idx === i ? { ...it, status: "error" as const, errorMsg: result.error ?? "保存失敗" } : it));
        }
      } catch {
        results[i] = { ...results[i], status: "error", errorMsg: "例外が発生しました" };
        setBatchItems((prev) => prev.map((it, idx) => idx === i ? { ...it, status: "error" as const, errorMsg: "例外が発生しました" } : it));
      }
    }

    setBatchSaving(false);
    if (results.every((it) => it.status === "done")) {
      router.refresh();
      setIsBatchModalOpen(false);
      setBatchItems([]);
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
    if (!addPlantAction) return;
    startTransition(async () => {
      const rawFile = formData.get("photo") as File | null;
      const hasPhoto = !!(rawFile && rawFile.size > 0);
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
      trackEvent("plant_created", { role: "owner", has_photo: hasPhoto });
      if (hasPhoto) trackEvent("plant_created_with_photo", { role: "owner" });
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
        .plants-heading-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .btn-batch-upload {
          padding: 5px 11px;
          background: #f2faf4;
          border: 1.5px solid #93c9a0;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 600;
          color: #5a9a6a;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
          transition: background 0.12s, border-color 0.12s;
          flex-shrink: 0;
        }
        .btn-batch-upload:hover { background: #e4f5e9; border-color: #6db07b; color: #2d4a3e; }
        .batch-item-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid #f0ebe2;
        }
        .batch-item-row:last-child { border-bottom: none; }
        .batch-thumb {
          width: 62px;
          height: 62px;
          object-fit: cover;
          border-radius: 7px;
          flex-shrink: 0;
          cursor: zoom-in;
        }
        .batch-plant-select {
          flex: 1;
          padding: 7px 9px;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          font-size: 12px;
          color: #374151;
          background: #ffffff;
          font-family: inherit;
          cursor: pointer;
          outline: none;
          min-width: 0;
        }
        .batch-plant-select:focus { border-color: #6db07b; box-shadow: 0 0 0 2px rgba(109, 176, 123, 0.18); }
        .batch-status-icon {
          font-size: 16px;
          width: 22px;
          text-align: center;
          flex-shrink: 0;
        }
        .batch-error-msg {
          font-size: 10px;
          color: #b91c1c;
          margin-top: 3px;
        }
        /* ─── Generic white cards ─── */
        .todo-card,
        .form-card {
          background: #ffffff;
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 8px;
          box-shadow: 0 1px 3px rgba(60, 50, 30, 0.07);
        }
        /* ─── Badges ─── */
        .badge-alert {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          background: #fef3c7;
          color: #92400e;
        }
        .badge-ok {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          background: #dcf5e4;
          color: #1a5c36;
        }
        /* ─── Form fields ─── */
        .form-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #7a8a7a;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .form-input {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #ddd8cf;
          background: #fdfcfa;
          font-size: 13px;
          box-sizing: border-box;
          font-family: inherit;
          color: #374151;
        }
        .form-input:focus {
          outline: none;
          border-color: #6db07b;
          box-shadow: 0 0 0 2px rgba(109, 176, 123, 0.18);
        }
        .form-textarea {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #ddd8cf;
          background: #fdfcfa;
          font-size: 13px;
          box-sizing: border-box;
          font-family: inherit;
          color: #374151;
          resize: vertical;
          min-height: 60px;
          line-height: 1.5;
        }
        .form-textarea:focus {
          outline: none;
          border-color: #6db07b;
          box-shadow: 0 0 0 2px rgba(109, 176, 123, 0.18);
        }
        /* ─── Primary button ─── */
        .btn-primary {
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-family: inherit;
          background: #06c755;
          color: #ffffff;
        }
      `}</style>

      {openMenuId !== null && (
        <div
          onClick={() => setOpenMenuId(null)}
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 }}
        />
      )}

      <div className="col-board">
        <div className="plants-heading-row">
          <h2 className="col-heading" style={{ margin: 0 }}>My plants</h2>
          {!readOnly && localPlants.length > 0 && (
            <button
              type="button"
              className="btn-batch-upload"
              onClick={() => batchInputRef.current?.click()}
            >
              カメラロールから選ぶ
            </button>
          )}
        </div>
        {!readOnly && (
          <input
            ref={batchInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleBatchFileSelect}
          />
        )}

        {hasError ? (
          <div className="todo-card">
            <p style={{ color: "#b91c1c", margin: 0, fontSize: 13 }}>植物データの取得でエラーが出ました</p>
          </div>
        ) : localPlants.length === 0 ? (
          !readOnly && addPlantAction ? (
            <OnboardingWizard addPlantAction={addPlantAction} />
          ) : (
            <div className="todo-card">
              <p style={{ color: "#9ca3af", margin: 0, fontSize: 13 }}>まだ植物は登録されていません</p>
            </div>
          )
        ) : (
          (() => {
            const cards = localPlants.map((plant) => {
              const preview = photoPreviews[plant.id];
              const displayPhoto = preview ?? latestPhotos[plant.id] ?? null;
              const hasTodayEvent = plantHasTodayEventRecord[plant.id] ?? false;
              const stateLabel = getInitialStateLabel(plant.initial_state_type);
              const isMenuOpen = openMenuId === plant.id;
              const careCard = careCardMap[plant.id] ?? null;

              const cardInner = (
                <>
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
                      if (!displayPhoto) return;
                      if (preview) {
                        setLightbox({ urls: [displayPhoto], index: 0 });
                      } else {
                        const history = photoHistories[plant.id] ?? [];
                        const urls = history.length > 0 ? history.map((p) => p.url) : [displayPhoto];
                        setLightbox({ urls, index: 0 });
                      }
                    }}
                  >
                    {displayPhoto ? (
                      <img
                        src={displayPhoto}
                        alt={getPlantLabel(plant.plant_type)}
                        loading="lazy"
                        decoding="async"
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
                    {/* カメラボタン: オーナーのみ */}
                    {!readOnly && !uploadingIds[plant.id] && (
                      <button
                        type="button"
                        className="photo-camera-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          photoInputRefs.current[plant.id]?.click();
                        }}
                        aria-label="写真を追加"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      </button>
                    )}
                    {/* 優先度インジケーター */}
                    {careCard && (careCard.priority === "urgent" || careCard.priority === "attention") && (
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0, height: 3, zIndex: 3,
                        background: careCard.priority === "urgent" ? "#ef4444" : "#f59e0b",
                      }} />
                    )}
                  </div>

                  {/* 写真アップロード用 hidden input: オーナーのみ */}
                  {!readOnly && (
                    <input
                      ref={(el) => { photoInputRefs.current[plant.id] = el; }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: "none" }}
                      onChange={(e) => handlePhotoChange(plant.id, e)}
                    />
                  )}

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
                      {/* ···メニュー: オーナーのみ */}
                      {!readOnly && (
                        <div style={{ position: "relative" }}>
                          <button type="button" className="plant-menu-trigger" onClick={(e) => handleMenuToggle(plant.id, e)} aria-label="操作メニューを開く">
                            ···
                          </button>
                          {isMenuOpen && (
                            <div className="plant-menu-dropdown">
                              <button type="button" className="plant-menu-item" onClick={() => handleHistoryOpen(plant.id)}>
                                写真履歴を見る
                              </button>
                              {archivePlantAction && (
                                <form action={archivePlantAction} style={{ display: "contents" }}>
                                  <input type="hidden" name="plant_id" value={plant.id} />
                                  <button type="submit" className="plant-menu-item-danger" onClick={() => setOpenMenuId(null)}>
                                    アーカイブ
                                  </button>
                                </form>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 過去写真リンク: 常に表示 */}
                    <button
                      type="button"
                      onClick={() => handleHistoryOpen(plant.id)}
                      style={{ display: "block", marginTop: 5, background: "none", border: "none", padding: 0, fontSize: 10, color: "#6db07b", cursor: "pointer", fontFamily, fontWeight: 600 }}
                    >
                      {(photoHistories[plant.id]?.length ?? 0) > 0
                        ? `過去写真（${photoHistories[plant.id].length}枚）`
                        : "過去写真を見る"}
                    </button>

                    {!readOnly && uploadErrors[plant.id] && (
                      <div style={{ fontSize: 10, color: "#b91c1c", marginTop: 5, lineHeight: 1.5 }}>
                        {uploadErrors[plant.id]}
                      </div>
                    )}

                    {/* ── 最新写真の観察メモ ── */}
                    {(() => {
                      const latestPhoto = photoHistories[plant.id]?.[0];
                      const comment = latestPhoto?.siteComment;
                      if (!comment) return null;
                      return (
                        <div style={{ marginTop: 7, paddingTop: 7, borderTop: "1px solid #f0ebe2" }}>
                          <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 3, fontFamily }}>
                            📸 最新の観察
                          </div>
                          <div style={{
                            fontSize: 11,
                            color: "#5a7a6a",
                            lineHeight: 1.65,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                          }}>
                            {comment}
                          </div>
                          {latestPhoto?.watchPoint && (
                            <div style={{ fontSize: 10, color: "#a0b8a0", marginTop: 4, lineHeight: 1.5 }}>
                              次に見るポイント：{latestPhoto.watchPoint}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── ケアメモ ── */}
                    {careCard && (() => {
                      const isExpanded = expandedCareIds.has(plant.id);
                      const priorityTodos = TAG_PRIORITY_ORDER
                        .filter(tag => careCard.tags.includes(tag))
                        .map(tag => ({ tag, todo: TAG_TODO[tag] ?? tag }));
                      const showToggle = priorityTodos.length > 2 || careCard.advice.length > 60;
                      const visibleTodos = isExpanded ? priorityTodos : priorityTodos.slice(0, 2);

                      return (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f0ebe2" }}>
                          {visibleTodos.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11, color: "#374151", lineHeight: 1.7 }}>
                              {visibleTodos.map(({ tag, todo }) => (
                                <li key={tag}>{todo}</li>
                              ))}
                            </ul>
                          ) : (
                            <div style={{
                              fontSize: 11, color: "#374151", lineHeight: 1.6,
                              ...(!isExpanded ? {
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              } : {}),
                            }}>
                              {careCard.advice}
                            </div>
                          )}

                          {isExpanded && (
                            <>
                              {careCard.advice.length > 0 && (
                                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6, marginTop: 5 }}>
                                  {careCard.advice}
                                </div>
                              )}
                              {careCard.tags.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
                                  {careCard.tags.map((tag) => {
                                    const c = TAG_COLORS[tag] ?? { bg: "#f1f5f9", color: "#475569" };
                                    return (
                                      <span key={tag} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, fontWeight: 600, background: c.bg, color: c.color }}>
                                        {tag}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}

                          {showToggle && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedCareIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(plant.id)) next.delete(plant.id); else next.add(plant.id);
                                  return next;
                                });
                              }}
                              style={{ background: "none", border: "none", padding: 0, marginTop: 4, fontSize: 10, color: "#6db07b", cursor: "pointer", fontFamily, fontWeight: 600, display: "block" }}
                            >
                              {isExpanded ? "閉じる ▲" : "続きを読む ▼"}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </>
              );

              if (readOnly) {
                return (
                  <div key={plant.id} className="plant-card-sortable" style={{ position: "relative" }}>
                    {cardInner}
                  </div>
                );
              }
              return (
                <SortablePlantCard key={plant.id} id={plant.id}>
                  {cardInner}
                </SortablePlantCard>
              );
            });

            const grid = <div className="plants-grid">{cards}</div>;

            if (readOnly) return grid;
            return (
              <DndContext
                id="plant-column"
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={localPlants.map((p) => p.id)} strategy={rectSortingStrategy}>
                  {grid}
                </SortableContext>
              </DndContext>
            );
          })()
        )}

        {/* 1〜2件のときは柔らかいメッセージを表示 */}
        {localPlants.length > 0 && localPlants.length <= 2 && !readOnly && (
          <div style={{
            marginTop: 10, padding: "10px 12px",
            background: "#f9fcf9", borderRadius: 8,
            fontSize: 11, color: "#7a9a7a", lineHeight: 1.75,
            border: "1px solid #e8f5e9",
          }}>
            今日も、気になったときに様子を見てみましょう。
          </div>
        )}

        {/* Add plant form: オーナーのみ。0件はウィザードを使うため非表示 */}
        {!readOnly && localPlants.length > 0 && (!isFormOpen ? (
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
        ))}

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
                    {!readOnly && restorePlantAction && (
                      <form action={restorePlantAction}>
                        <input type="hidden" name="plant_id" value={plant.id} />
                        <button type="submit" className="btn-restore">復元</button>
                      </form>
                    )}
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
                    {(photoHistories[historyModalId!] ?? []).length}枚・新しい順に表示
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setHistoryModalId(null)} style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer", lineHeight: 1, padding: "0 4px", fontFamily }}>×</button>
            </div>

            {(() => {
              const history = photoHistories[historyModalId!] ?? [];
              if (history.length === 0) {
                return (
                  <div style={{ padding: "40px 16px", textAlign: "center", border: "1px dashed #c8e6cc", borderRadius: 10, background: "#f9fcf9", marginBottom: 20 }}>
                    <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 6, fontFamily }}>写真履歴はまだありません</div>
                    <div style={{ fontSize: 12, color: "#c8c0b4", fontFamily }}>カメラアイコンをタップして記録を始めましょう</div>
                  </div>
                );
              }
              const urls = history.map((p) => p.url);
              // 観察メモがある写真が1枚でもあればリスト形式にする
              const hasAnyAnalysis = history.some((p) => p.siteComment || p.changeSummary);
              if (hasAnyAnalysis) {
                // 縦並びリスト形式（分析情報付き）
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                    {history.map((photo, photoIdx) => (
                      <div key={photo.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        {/* サムネイル */}
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <img
                            src={photo.url}
                            alt={photo.takenAt}
                            loading="lazy"
                            decoding="async"
                            style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, display: "block", cursor: "zoom-in" }}
                            onClick={() => setLightbox({ urls, index: photoIdx })}
                          />
                          {deletePhotoAction && (
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(photo.id)}
                              aria-label="写真を削除"
                              style={{
                                position: "absolute", top: 3, right: 3,
                                width: 18, height: 18, borderRadius: "50%",
                                background: "rgba(0,0,0,0.55)", border: "none",
                                color: "#fff", fontSize: 12, lineHeight: 1, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                              }}
                            >×</button>
                          )}
                        </div>
                        {/* 分析情報 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, color: "#a0a8a2", marginBottom: 3, fontFamily }}>{photo.takenAt}</div>
                          {photo.changeSummary && (
                            <div style={{ fontSize: 11, color: "#4a7a5a", lineHeight: 1.6, marginBottom: 3, fontFamily, fontWeight: 600 }}>
                              📊 {photo.changeSummary}
                            </div>
                          )}
                          {photo.siteComment && (
                            <div style={{ fontSize: 11, color: "#5a7a6a", lineHeight: 1.65, marginBottom: 3, fontFamily }}>
                              {photo.siteComment}
                            </div>
                          )}
                          {photo.careAdvice && (
                            <div style={{ fontSize: 10, color: "#7a9a7a", lineHeight: 1.5, marginBottom: 2, fontFamily }}>
                              🌿 {photo.careAdvice}
                            </div>
                          )}
                          {photo.watchPoint && (
                            <div style={{ fontSize: 10, color: "#a0b8a0", lineHeight: 1.5, fontFamily }}>
                              次に見るポイント：{photo.watchPoint}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              // 分析情報なし（旧データ）: グリッド形式
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8, marginBottom: 20 }}>
                  {history.map((photo, photoIdx) => (
                    <div key={photo.id} style={{ position: "relative" }}>
                      <img
                        src={photo.url}
                        alt={photo.takenAt}
                        loading="lazy"
                        decoding="async"
                        style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, display: "block", cursor: "zoom-in" }}
                        onClick={() => setLightbox({ urls, index: photoIdx })}
                      />
                      {deletePhotoAction && (
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(photo.id)}
                          aria-label="写真を削除"
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: "rgba(0,0,0,0.55)",
                            border: "none",
                            color: "#fff",
                            fontSize: 14,
                            lineHeight: 1,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                          }}
                        >×</button>
                      )}
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

      {/* Batch upload modal */}
      {isBatchModalOpen && (
        <div className="modal-overlay" onClick={() => { if (!batchSaving) { setIsBatchModalOpen(false); setBatchItems([]); } }}>
          <div className="modal-panel" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#2d4a3e", fontFamily }}>
                  写真をまとめて追加
                </div>
                <div style={{ fontSize: 11, color: "#a0a8a2", marginTop: 2, fontFamily }}>
                  {batchItems.some((it) => it.identifying)
                    ? "植物を推定中です…確認して「保存する」を押してください"
                    : "各写真の植物を確認してから「保存する」を押してください"}
                </div>
              </div>
              {!batchSaving && (
                <button
                  type="button"
                  onClick={() => { setIsBatchModalOpen(false); setBatchItems([]); }}
                  style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer", lineHeight: 1, padding: "0 4px", fontFamily }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Warning banner */}
            {batchWarning && (
              <div style={{ fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 6, padding: "6px 10px", marginBottom: 12, fontFamily }}>
                {batchWarning}
              </div>
            )}

            {/* Progress banner */}
            {batchSaving && (() => {
              const doneCount = batchItems.filter((it) => it.status === "done" || it.status === "error").length;
              return (
                <div style={{ fontSize: 12, color: "#5a9a6a", background: "#f2faf4", border: "1px solid #b8dfc0", borderRadius: 6, padding: "7px 10px", marginBottom: 12, fontFamily, fontWeight: 600 }}>
                  {doneCount}/{batchItems.length}枚 保存中…
                </div>
              );
            })()}

            {/* Photo list */}
            <div style={{ maxHeight: "52vh", overflowY: "auto", marginBottom: 16 }}>
              {batchItems.map((item, idx) => (
                <div key={item.id} className="batch-item-row">
                  <img
                    src={item.preview}
                    alt={`写真${idx + 1}`}
                    className="batch-thumb"
                    onClick={() => setLightbox({ urls: [item.preview], index: 0 })}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <select
                      className="batch-plant-select"
                      value={item.plantId}
                      disabled={item.status === "uploading" || item.status === "done" || item.identifying}
                      onChange={(e) =>
                        setBatchItems((prev) =>
                          prev.map((it, i) =>
                            i === idx
                              ? { ...it, plantId: e.target.value, autoSelected: false, autoSelectReason: undefined }
                              : it
                          )
                        )
                      }
                    >
                      <option value="">{item.identifying ? "推定中…" : "植物を選択"}</option>
                      {localPlants.map((plant) => (
                        <option key={plant.id} value={plant.id}>
                          {getPlantLabel(plant.plant_type)}{plant.species ? ` (${plant.species})` : ""}
                        </option>
                      ))}
                    </select>
                    {item.autoSelected && !item.identifying && (
                      <div style={{ fontSize: 10, color: "#6db07b", marginTop: 3, display: "flex", alignItems: "center", gap: 4, fontFamily }}>
                        <span>✦ 自動選択</span>
                        {item.autoSelectReason && (
                          <span style={{ color: "#a0a8a2" }}>· {item.autoSelectReason}</span>
                        )}
                      </div>
                    )}
                    {item.status === "error" && item.errorMsg && (
                      <div className="batch-error-msg">{item.errorMsg}</div>
                    )}
                  </div>
                  <div className="batch-status-icon">
                    {item.status === "uploading" && <span style={{ color: "#6db07b" }}>⏳</span>}
                    {item.status === "done" && <span style={{ color: "#16a34a" }}>✓</span>}
                    {item.status === "error" && <span style={{ color: "#b91c1c" }}>✗</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            {(() => {
              const errorCount = batchItems.filter((it) => it.status === "error").length;
              const allFinished = !batchSaving && batchItems.every((it) => it.status === "done" || it.status === "error");
              const canSave = !batchSaving && batchItems.every((it) => it.plantId !== "") && batchItems.some((it) => it.status === "pending");

              if (allFinished && errorCount > 0) {
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "#b91c1c", fontFamily }}>
                      {errorCount}枚の保存に失敗しました。通信状態を確認して再度お試しください。
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => { setIsBatchModalOpen(false); setBatchItems([]); }}
                      style={{ padding: "9px 20px", fontSize: 13, fontFamily }}
                    >
                      閉じる
                    </button>
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!canSave}
                  onClick={handleBatchSave}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    fontSize: 14,
                    fontFamily,
                    opacity: canSave ? 1 : 0.45,
                    cursor: canSave ? "pointer" : "not-allowed",
                  }}
                >
                  {batchSaving
                    ? "保存中…"
                    : `保存する（${batchItems.filter((it) => it.status === "pending").length}枚）`}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {lightbox && (() => {
        const { urls, index } = lightbox;
        const canPrev = index > 0;
        const canNext = index < urls.length - 1;
        return (
          <div
            className="modal-overlay"
            style={{ zIndex: 300, background: "rgba(0,0,0,0.88)" }}
            onClick={() => setLightbox(null)}
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - touchStartX.current;
              if (dx > 50 && canPrev) setLightbox((p) => p ? { ...p, index: p.index - 1 } : null);
              if (dx < -50 && canNext) setLightbox((p) => p ? { ...p, index: p.index + 1 } : null);
            }}
          >
            {/* Counter */}
            {urls.length > 1 && (
              <div style={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.88)", fontSize: 13, fontWeight: 600, fontFamily, background: "rgba(0,0,0,0.38)", padding: "4px 14px", borderRadius: 20, pointerEvents: "none", whiteSpace: "nowrap" }}>
                {index + 1} / {urls.length}
              </div>
            )}

            {/* Prev button (新しい写真) */}
            {canPrev && (
              <button
                type="button"
                aria-label="新しい写真"
                onClick={(e) => { e.stopPropagation(); setLightbox((p) => p ? { ...p, index: p.index - 1 } : null); }}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "2px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily, lineHeight: 1 }}
              >‹</button>
            )}

            {/* Image */}
            <div
              style={{ position: "relative", maxWidth: "80vw", maxHeight: "88vh", display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={(e) => e.stopPropagation()}
            >
              <img src={urls[index]} alt="写真プレビュー" style={{ maxWidth: "80vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 8, display: "block" }} />
              <button
                type="button"
                onClick={() => setLightbox(null)}
                style={{ position: "absolute", top: -14, right: -14, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "2px solid rgba(255,255,255,0.3)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, fontFamily }}
              >×</button>
            </div>

            {/* Next button (古い写真) */}
            {canNext && (
              <button
                type="button"
                aria-label="古い写真"
                onClick={(e) => { e.stopPropagation(); setLightbox((p) => p ? { ...p, index: p.index + 1 } : null); }}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "2px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily, lineHeight: 1 }}
              >›</button>
            )}
          </div>
        );
      })()}

      {/* ウェルカムトースト（初回植物登録完了後、数秒表示） */}
      {welcomeToast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a3320",
            color: "#fff",
            borderRadius: 12,
            padding: "14px 28px",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 4px 24px rgba(0,0,0,0.28)",
            zIndex: 400,
            textAlign: "center",
            maxWidth: "calc(100vw - 48px)",
            fontFamily,
            animation: "pc-fadein 0.35s ease",
            pointerEvents: "none",
          }}
        >
          最初の1鉢を置きました。
          <div style={{ fontSize: 11, fontWeight: 400, marginTop: 5, color: "rgba(255,255,255,0.70)" }}>
            今日から、少しずつ様子を残していけます。
          </div>
        </div>
      )}
    </>
  );
}
