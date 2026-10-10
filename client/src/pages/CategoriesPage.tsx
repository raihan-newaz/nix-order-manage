import { FormEvent, useEffect, useState } from "react";
import {
  FolderTree,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { MediaPicker } from '../components/MediaPicker';

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  parentId?: string | null;
  productCount: number;
};
const empty = { name: "", slug: "", description: "", image: "", parentId: "" };

export const CategoriesPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<Category | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const load = () =>
    api
      .get("/inventory/categories")
      .then((res) => setCategories(res.data.categories))
      .catch(() => toast.error("Could not load categories"));
  useEffect(() => {
    load();
  }, []);
  const change = (key: keyof typeof empty, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const reset = () => {
    setEditing(null);
    setForm(empty);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.put(`/inventory/categories/${editing.id}`, form);
      else await api.post("/inventory/categories", form);
      toast.success(editing ? "Category updated" : "Category created");
      reset();
      load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not save category");
    } finally {
      setSaving(false);
    }
  };
  const edit = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      image: category.image || "",
      parentId: category.parentId || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (category: Category) => {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    try {
      await api.delete(`/inventory/categories/${category.id}`);
      toast.success("Category deleted");
      load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not delete category");
    }
  };
  const visible = categories.filter((category) =>
    `${category.name} ${category.slug}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          <FolderTree className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Product categories
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Create a WooCommerce-style category structure for product
          organization, storefront filters and reporting.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <form
          onSubmit={submit}
          className="h-fit rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {editing ? `Edit ${editing.name}` : "Add new category"}
            </h2>
            {editing && (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="space-y-4">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Name
              <input
                required
                value={form.name}
                onChange={(e) => change("name", e.target.value)}
                className="field"
                placeholder="e.g. Denim Joggers"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Slug{" "}
              <span className="font-normal text-slate-400">(optional)</span>
              <input
                value={form.slug}
                onChange={(e) => change("slug", e.target.value)}
                className="field"
                placeholder="denim-joggers"
              />
            </label>
            <label className="block text-sm font-semibold">
              Parent category
              <select
                value={form.parentId}
                onChange={(e) => change("parentId", e.target.value)}
                className="field"
              >
                <option value="">None</option>
                {categories
                  .filter((category) => category.id !== editing?.id)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Category image{" "}
              <span className="font-normal text-slate-400">
                (Media Gallery)
              </span>
              <MediaPicker title="Choose category image" value={form.image ? [form.image] : []} onChange={urls => change('image', urls[0] || '')} />
            </label>
            <label className="block text-sm font-semibold">
              Description
              <textarea
                value={form.description}
                onChange={(e) => change("description", e.target.value)}
                className="field min-h-24"
                placeholder="Optional storefront description"
              />
            </label>
            <button
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-4 py-2.5 text-xs font-medium shadow-sm transition disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving
                ? "Saving…"
                : editing
                  ? "Update category"
                  : "Add category"}
            </button>
          </div>
        </form>
        <section className="overflow-hidden rounded-2xl border border-slate-100/90 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <b className="text-sm">
              All categories{" "}
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                {categories.length}
              </span>
            </b>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          {visible.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((category) => (
                <article
                  className="flex items-center gap-4 p-4"
                  key={category.id}
                >
                  {category.image ? (
                    <img
                      src={category.image}
                      alt=""
                      className="h-12 w-12 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <FolderTree className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-sm text-slate-900 dark:text-white">
                        {category.name}
                      </b>
                      <code className="text-xs text-slate-400">
                        /{category.slug}
                      </code>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {category.description || "No description"}
                    </p>
                  </div>
                  <span className="hidden rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 sm:block dark:bg-slate-800 dark:text-slate-300">
                    {category.productCount} products
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => edit(category)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400 transition"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(category)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-slate-500">
              No categories found. Create your first product category.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
