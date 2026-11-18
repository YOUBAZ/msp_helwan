"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  ImagePlus,
  PlayCircle,
  RotateCcw,
  Trash2,
  Video,
  X,
} from "lucide-react";
import StorageMeter from "@/components/dashboard/StorageMeter";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorText,
  Field,
  inputCls,
  PageTitle,
} from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import { fitJpeg } from "@/lib/image";
import { countLabel, photoSrc } from "@/lib/media";
import type { MediaAlbum } from "@/lib/types";

type Usage = { usedBytes: number; budgetBytes: number };
type Failed = { file: File; reason: string };

const FULL = "Media storage is full";
const iconBtn =
  "p-1.5 rounded-lg bg-white/90 text-slate-600 hover:text-blue-900 shadow disabled:opacity-30";

export default function AlbumEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { call, can } = useAuth();
  const [album, setAlbum] = useState<MediaAlbum | null>(null);
  const [missing, setMissing] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [all, u] = await Promise.all([
      call<MediaAlbum[]>("/admin/media/albums"),
      call<Usage>("/admin/media/usage"),
    ]);
    const a = all.find((x) => x.id === id) ?? null;
    setAlbum(a);
    setMissing(!a);
    setUsage(u);
  }, [call, id]);

  useEffect(() => {
    if (can("media.manage")) load().catch((e: Error) => setError(e.message));
  }, [load, can]);

  const act = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!can("media.manage")) {
    return <Empty text="You don't have permission to manage the Media page." />;
  }
  if (missing) {
    return <Empty text="This album doesn't exist anymore." />;
  }
  if (!album) return null;

  const post = (path: string, body: object) =>
    call(path, { method: "POST", body: JSON.stringify(body) });

  return (
    <>
      <Link
        href="/dashboard/media"
        className="mb-4 inline-flex items-center gap-2 text-slate-400 hover:text-blue-900 text-xs font-black uppercase tracking-widest"
      >
        <ArrowLeft size={14} /> All albums
      </Link>
      <PageTitle
        eyebrow={album.category}
        title={album.title}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant={album.published ? "ghost" : "accent"}
              onClick={() =>
                void act(() =>
                  call(`/admin/media/albums/${album.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ published: !album.published }),
                  }),
                )
              }
            >
              {album.published ? <EyeOff size={16} /> : <Eye size={16} />}
              {album.published ? "Hide" : "Publish"}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (
                  !confirm(
                    `Delete "${album.title}" and everything in it? This can't be undone.`,
                  )
                )
                  return;
                try {
                  await call(`/admin/media/albums/${album.id}`, {
                    method: "DELETE",
                  });
                  router.push("/dashboard/media");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Trash2 size={16} /> Delete album
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-6 -mt-4">
        <Badge tone={album.published ? "green" : "slate"}>
          {album.published
            ? "Published: visible on the Media page"
            : "Hidden: only managers can see it"}
        </Badge>
        <span className="text-xs font-bold text-slate-500">
          {countLabel(album)}
        </span>
        {album.published && album.items.length === 0 && (
          <span className="text-xs font-bold text-orange-600">
            Empty albums are not shown on the site.
          </span>
        )}
      </div>

      <div className="mb-4">
        <ErrorText error={error} />
      </div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <PhotoUploader albumId={album.id} onChange={load} />
          <Card className="p-5 md:p-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-900 mb-4">
              In this album ({album.items.length})
            </h3>
            {album.items.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nothing yet. Add photos or a video link.
              </p>
            ) : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {album.items.map((item, i) => (
                  <li
                    key={item.id}
                    className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group"
                  >
                    {item.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoSrc(item.photo, "small")}
                        alt={`Item ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : item.video?.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.video.thumbnailUrl}
                        alt="Video"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-900 to-orange-600" />
                    )}
                    {item.video && (
                      <a
                        href={item.video.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/30"
                        title="Open the video"
                      >
                        <PlayCircle size={36} />
                        <span className="text-[10px] font-black uppercase tracking-widest mt-1">
                          {item.video.provider}
                        </span>
                      </a>
                    )}
                    {i === 0 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-orange-600 text-white text-[9px] font-black uppercase tracking-widest">
                        Cover
                      </span>
                    )}
                    <div className="absolute bottom-2 inset-x-2 flex justify-between">
                      <div className="flex gap-1">
                        <button
                          className={iconBtn}
                          aria-label="Move earlier"
                          disabled={i === 0}
                          onClick={() =>
                            void act(() =>
                              post(`/admin/media/items/${item.id}/move`, {
                                direction: "up",
                              }),
                            )
                          }
                        >
                          <ArrowLeft size={14} />
                        </button>
                        <button
                          className={iconBtn}
                          aria-label="Move later"
                          disabled={i === album.items.length - 1}
                          onClick={() =>
                            void act(() =>
                              post(`/admin/media/items/${item.id}/move`, {
                                direction: "down",
                              }),
                            )
                          }
                        >
                          <ArrowRight size={14} />
                        </button>
                      </div>
                      <button
                        className={`${iconBtn} hover:!text-red-600`}
                        aria-label="Remove from album"
                        onClick={() =>
                          confirm("Remove this from the album?") &&
                          void act(() =>
                            call(`/admin/media/items/${item.id}`, {
                              method: "DELETE",
                            }),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {usage && (
            <StorageMeter used={usage.usedBytes} budget={usage.budgetBytes} />
          )}
          <VideoForm albumId={album.id} onAdded={load} />
          <DetailsForm album={album} onSaved={load} />
        </div>
      </div>
    </>
  );
}

/** Pick or drop many photos; each is shrunk in the browser and uploaded in turn. */
function PhotoUploader({
  albumId,
  onChange,
}: {
  albumId: string;
  onChange: () => Promise<void>;
}) {
  const { call } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [failed, setFailed] = useState<Failed[]>([]);
  const [stopped, setStopped] = useState("");
  const [dragging, setDragging] = useState(false);

  async function upload(files: File[]) {
    if (!files.length || progress) return;
    setFailed([]);
    setStopped("");
    const bad: Failed[] = [];
    for (const [n, file] of files.entries()) {
      setProgress({ done: n, total: files.length });
      try {
        const [full, small] = await Promise.all([
          fitJpeg(file, 1600, 0.82),
          fitJpeg(file, 600, 0.8),
        ]);
        const body = new FormData();
        body.append("full", full, "full.jpg");
        body.append("small", small, "small.jpg");
        await call(`/admin/media/albums/${albumId}/photos`, {
          method: "POST",
          body,
        });
      } catch (e) {
        const reason = (e as Error).message;
        if (reason.startsWith(FULL)) {
          // Storage is full: keep what's uploaded, don't try the rest.
          setStopped(
            `${reason} ${files.length - n} photo(s) were not uploaded.`,
          );
          break;
        }
        bad.push({ file, reason });
      }
    }
    setProgress(null);
    setFailed(bad);
    await onChange();
    if (input.current) input.current.value = "";
  }

  return (
    <Card className="p-5 md:p-6">
      <h3 className="text-xs font-black uppercase tracking-widest text-blue-900 mb-4">
        Add photos
      </h3>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload([...e.dataTransfer.files]);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-orange-600 bg-orange-50" : "border-slate-200"
        }`}
      >
        <ImagePlus className="mx-auto text-slate-300 mb-3" size={40} />
        <p className="text-sm text-slate-500 mb-4">Drag photos here, or</p>
        <input
          ref={input}
          id="media-files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void upload([...(e.target.files ?? [])])}
        />
        <Button
          type="button"
          variant="accent"
          disabled={!!progress}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={16} /> Choose photos
        </Button>
        <p className="text-xs text-slate-400 mt-3">
          JPG, PNG or WebP. Photos are resized automatically before uploading.
        </p>
      </div>
      {progress && (
        <p role="status" className="mt-4 text-sm font-bold text-blue-900">
          Uploading {progress.done + 1} of {progress.total}…
        </p>
      )}
      {stopped && (
        <p role="alert" className="mt-4 text-sm font-bold text-red-600">
          {stopped}
        </p>
      )}
      {failed.length > 0 && (
        <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-100">
          <p className="text-sm font-bold text-red-700 mb-2">
            {failed.length} photo(s) couldn&apos;t be uploaded:
          </p>
          <ul className="space-y-1 mb-3">
            {failed.map((f) => (
              <li
                key={f.file.name + f.file.size}
                className="text-xs text-red-700"
              >
                <b>{f.file.name}</b>: {f.reason}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void upload(failed.map((f) => f.file))}
            >
              <RotateCcw size={14} /> Retry
            </Button>
            <Button type="button" variant="ghost" onClick={() => setFailed([])}>
              <X size={14} /> Dismiss
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function VideoForm({
  albumId,
  onAdded,
}: {
  albumId: string;
  onAdded: () => Promise<void>;
}) {
  const { call } = useAuth();
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState({ ok: "", err: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg({ ok: "", err: "" });
    try {
      await call(`/admin/media/albums/${albumId}/videos`, {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      setUrl("");
      setMsg({ ok: "Video added.", err: "" });
      await onAdded();
    } catch (err) {
      setMsg({ ok: "", err: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 md:p-6">
      <form onSubmit={submit} className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-blue-900">
          Add a video
        </h3>
        <Field label="YouTube, Facebook or Google Drive link" id="v-url">
          <input
            id="v-url"
            required
            placeholder="https://youtu.be/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={inputCls}
          />
        </Field>
        <p className="text-xs text-slate-400">
          Google Drive videos must be shared as &quot;Anyone with the
          link&quot;.
        </p>
        <ErrorText error={msg.err} />
        {msg.ok && <p className="text-green-600 text-sm font-bold">{msg.ok}</p>}
        <Button type="submit" variant="ghost" disabled={busy}>
          <Video size={16} /> {busy ? "Adding…" : "Add video"}
        </Button>
      </form>
    </Card>
  );
}

function DetailsForm({
  album,
  onSaved,
}: {
  album: MediaAlbum;
  onSaved: () => Promise<void>;
}) {
  const { call } = useAuth();
  const [form, setForm] = useState({
    title: album.title,
    category: album.category,
    eventDate: album.eventDate ?? "",
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [msg, setMsg] = useState({ ok: "", err: "" });

  useEffect(() => {
    call<string[]>("/admin/media/categories").then(
      setCategories,
      () => undefined,
    );
  }, [call]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await call(`/admin/media/albums/${album.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          eventDate: form.eventDate || null,
        }),
      });
      setMsg({ ok: "Saved.", err: "" });
      await onSaved();
    } catch (err) {
      setMsg({ ok: "", err: (err as Error).message });
    }
  }

  return (
    <Card className="p-5 md:p-6">
      <form onSubmit={submit} className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-blue-900">
          Album details
        </h3>
        <Field label="Album name" id="d-title">
          <input
            id="d-title"
            required
            minLength={2}
            maxLength={80}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Category" id="d-category">
          <input
            id="d-category"
            required
            minLength={2}
            maxLength={40}
            list="d-categories"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className={inputCls}
          />
          <datalist id="d-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Event date (optional)" id="d-date">
          <input
            id="d-date"
            type="date"
            value={form.eventDate}
            onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            className={inputCls}
          />
        </Field>
        <ErrorText error={msg.err} />
        {msg.ok && <p className="text-green-600 text-sm font-bold">{msg.ok}</p>}
        <Button type="submit">Save details</Button>
      </form>
    </Card>
  );
}
