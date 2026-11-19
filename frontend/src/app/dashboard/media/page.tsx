"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ImageIcon, Plus } from "lucide-react";
import StorageMeter from "@/components/dashboard/StorageMeter";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorText,
  Field,
  inputCls,
  Modal,
  PageTitle,
} from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import { albumCover, countLabel } from "@/lib/media";
import type { MediaAlbum } from "@/lib/types";

type Usage = { usedBytes: number; budgetBytes: number };

const iconBtn =
  "p-2 rounded-lg text-slate-400 hover:text-blue-900 hover:bg-slate-100 disabled:opacity-30";

export default function MediaAdminPage() {
  const { call, can } = useAuth();
  const [albums, setAlbums] = useState<MediaAlbum[] | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [a, u] = await Promise.all([
        call<MediaAlbum[]>("/admin/media/albums"),
        call<Usage>("/admin/media/usage"),
      ]);
      setAlbums(a);
      setUsage(u);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call]);

  useEffect(() => {
    if (can("media.manage")) void load();
  }, [load, can]);

  if (!can("media.manage")) {
    return <Empty text="You don't have permission to manage the Media page." />;
  }

  const move = async (id: string, direction: "up" | "down") => {
    if (moving) return; // one move at a time
    setMoving(true);
    setError("");
    try {
      await call(`/admin/media/albums/${id}/move`, {
        method: "POST",
        body: JSON.stringify({ direction }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMoving(false);
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="Media page"
        title="Media"
        action={
          <Button variant="accent" onClick={() => setCreating(true)}>
            <Plus size={16} /> New album
          </Button>
        }
      />
      {usage && (
        <StorageMeter used={usage.usedBytes} budget={usage.budgetBytes} />
      )}
      <div className="mb-4">
        <ErrorText error={error} />
      </div>

      {!albums ? null : albums.length === 0 ? (
        <Empty text="No albums yet. Create the first one." />
      ) : (
        <div className="space-y-3">
          {albums.map((a, i) => {
            const cover = albumCover(a);
            return (
              <Card key={a.id} className="p-4 md:p-5 flex items-center gap-4">
                <div className="w-20 h-16 md:w-28 md:h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-blue-900 truncate">
                      {a.title}
                    </h3>
                    <Badge tone={a.published ? "green" : "slate"}>
                      {a.published ? "Published" : "Hidden"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {a.category} · {countLabel(a)}
                    {a.eventDate &&
                      ` · ${new Date(`${a.eventDate}T00:00:00`).toLocaleDateString("en-GB", { dateStyle: "medium" })}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className={iconBtn}
                    aria-label={`Move ${a.title} up`}
                    disabled={moving || i === 0}
                    onClick={() => void move(a.id, "up")}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className={iconBtn}
                    aria-label={`Move ${a.title} down`}
                    disabled={moving || i === albums.length - 1}
                    onClick={() => void move(a.id, "down")}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <Link
                    href={`/dashboard/media/${a.id}`}
                    className="ml-1 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-900 text-white hover:bg-orange-600"
                  >
                    Open
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {creating && <NewAlbumDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function NewAlbumDialog({ onClose }: { onClose: () => void }) {
  const { call } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ title: "", category: "", eventDate: "" });
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call<string[]>("/admin/media/categories").then(
      setCategories,
      () => undefined,
    );
  }, [call]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const album = await call<MediaAlbum>("/admin/media/albums", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          eventDate: form.eventDate || undefined,
        }),
      });
      router.push(`/dashboard/media/${album.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="New album" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Album name" id="a-title">
          <input
            id="a-title"
            required
            minLength={2}
            maxLength={80}
            placeholder="e.g. Hackathon 2026"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputCls}
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Category" id="a-category">
            <input
              id="a-category"
              required
              minLength={2}
              maxLength={40}
              list="a-categories"
              placeholder="Event, Hackathon, Workshop…"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputCls}
            />
            <datalist id="a-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Event date (optional)" id="a-date">
            <input
              id="a-date"
              type="date"
              value={form.eventDate}
              onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          New albums start hidden, so you can add photos before visitors see
          them.
        </p>
        <ErrorText error={error} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Creating…" : "Create album"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
