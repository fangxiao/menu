"use client";

import { useRef, useState } from "react";
import {
  ChefHat,
  Clock,
  ShoppingBasket,
  Sparkles,
  Check,
  Users,
  Refrigerator,
  Loader2,
  AlertCircle,
  Lightbulb,
  Image as ImageIcon,
  Camera,
  X,
} from "lucide-react";
import type { MenuResponse } from "@/lib/types";

const QUICK_EXAMPLES = [
  { label: "西红柿+牛肉+鸡蛋", text: "2个西红柿、半斤牛肉、3个鸡蛋", servings: 2 },
  { label: "一人食清库存", text: "1把金针菇、2个鸡蛋、半根黄瓜", servings: 1 },
  { label: "想做土豆炖牛肉", text: "我想做土豆炖牛肉，冰箱只有半斤牛肉", servings: 2 },
];

const PREFERENCE_TAGS = [
  "默认最省事",
  "15分钟快手",
  "清淡减脂",
  "下饭硬菜",
  "周末采购",
];

function compressImageToBase64(file: File, maxSize = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("浏览器不支持图片压缩"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("图片读取失败"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

export default function HomePage() {
  const [ingredients, setIngredients] = useState("");
  const [fridgeImage, setFridgeImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [servings, setServings] = useState(2);
  const [preference, setPreference] = useState("默认最省事");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MenuResponse | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [dishImages, setDishImages] = useState<Record<string, string>>({});
  const [dishImgLoading, setDishImgLoading] = useState<Record<string, boolean>>({});
  const [dishImgError, setDishImgError] = useState<Record<string, string>>({});

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError(null);
      const compressed = await compressImageToBase64(file);
      setFridgeImage(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片处理失败");
    } finally {
      e.target.value = "";
    }
  }

  async function handleGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = ingredients.trim();
    if (!trimmed && !fridgeImage) {
      setError("先输入冰箱现有食材，或拍一张冰箱食材照片吧");
      return;
    }

    setLoading(true);
    setError(null);
    setCheckedItems({});
    setDishImages({});
    setDishImgLoading({});
    setDishImgError({});

    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: trimmed,
          imageBase64: fridgeImage || undefined,
          servings,
          preference: preference === "默认最省事" ? "" : preference,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "生成失败，请稍后重试");
      }
      setResult(data as MenuResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络请求失败");
    } finally {
      setLoading(false);
    }
  }

  function toggleShoppingItem(key: string) {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleGenerateDishImage(
    dishKey: string,
    dishName: string,
    ingredientsText: string
  ) {
    setDishImgLoading((prev) => ({ ...prev, [dishKey]: true }));
    setDishImgError((prev) => ({ ...prev, [dishKey]: "" }));
    try {
      const res = await fetch("/api/dish-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dishName, ingredientsText }),
      });
      const data = (await res.json()) as { imageUrl?: string; error?: string };
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || "生图失败");
      }
      setDishImages((prev) => ({ ...prev, [dishKey]: data.imageUrl! }));
    } catch (err) {
      setDishImgError((prev) => ({
        ...prev,
        [dishKey]: err instanceof Error ? err.message : "生图失败",
      }));
    } finally {
      setDishImgLoading((prev) => ({ ...prev, [dishKey]: false }));
    }
  }

  return (
    <main className="min-h-screen w-full max-w-md mx-auto px-4 py-6 pb-16 flex flex-col gap-5">
      {/* Header */}
      <header className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-stone-900">
              冰箱救急 · 今天吃什么
            </h1>
            <p className="text-xs text-stone-500">
              输入库存与人数，3 秒出省事家常菜单
            </p>
          </div>
        </div>
      </header>

      {/* Input Form Card */}
      <form
        onSubmit={handleGenerate}
        className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200/80 flex flex-col gap-4"
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="ingredients"
              className="flex items-center gap-1.5 text-sm font-semibold text-stone-800"
            >
              <Refrigerator className="w-4 h-4 text-amber-600" />
              冰箱现有食材（文字或拍照）
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-amber-600" />
              {fridgeImage ? "重拍/换图" : "拍照/传图"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {fridgeImage && (
            <div className="relative mb-2.5 w-24 h-24 rounded-xl overflow-hidden border border-stone-200 shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fridgeImage}
                alt="冰箱食材照片"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                aria-label="移除照片"
                onClick={() => setFridgeImage(null)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <textarea
            id="ingredients"
            rows={3}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder="例如：2个西红柿、半斤牛肉、3个鸡蛋&#10;或者直接点右上角「拍照/传图」拍冰箱剩余食材"
            className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 resize-none"
          />

          {/* Quick Examples */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {QUICK_EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => {
                  setIngredients(ex.text);
                  setServings(ex.servings);
                  setError(null);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70 active:scale-95 transition"
              >
                试一试：{ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* Servings Selector */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-800">
            <Users className="w-4 h-4 text-amber-600" />
            就餐人数
          </span>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setServings(num)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  servings === num
                    ? "bg-stone-900 text-white shadow-xs"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {num}人
              </button>
            ))}
          </div>
        </div>

        {/* Preference Pills */}
        <div>
          <span className="text-xs font-medium text-stone-500 block mb-1.5">
            做饭偏好（可选）
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PREFERENCE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setPreference(tag)}
                className={`px-2.5 py-1 rounded-lg text-xs transition ${
                  preference === tag
                    ? "bg-amber-600 text-white font-medium"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              正在帮你配菜…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              生成极简菜单方案
            </>
          )}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <section className="flex flex-col gap-4">
          {/* Assessment */}
          <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-3.5 text-sm text-amber-950">
            <div className="font-semibold text-xs uppercase tracking-wide text-amber-700 mb-1">
              库存评估 · {result.assessment.servings} 人份
            </div>
            <p className="text-xs leading-relaxed text-stone-700">
              {result.assessment.summary}
            </p>
          </div>

          {/* Menu Plans */}
          {result.plans.map((plan) => {
            const hasMainShopping =
              plan.shoppingList?.main && plan.shoppingList.main.length > 0;
            const hasAromaticShopping =
              plan.shoppingList?.aromatics &&
              plan.shoppingList.aromatics.length > 0;

            return (
              <article
                key={plan.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200/80 flex flex-col gap-3.5"
              >
                {/* Plan Header */}
                <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 mb-1.5">
                      {plan.badge}
                    </span>
                    <h2 className="text-base font-bold text-stone-900">
                      {plan.title}
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">{plan.reason}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-lg shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    {plan.totalTimeMin}分
                  </div>
                </div>

                {/* Dishes */}
                <div className="flex flex-col gap-3.5">
                  {plan.dishes.map((dish, idx) => {
                    const dishKey = `${plan.id}-dish-${idx}`;
                    const imgUrl = dishImages[dishKey];
                    const isImgLoading = !!dishImgLoading[dishKey];
                    const imgErr = dishImgError[dishKey];

                    return (
                      <div
                        key={dishKey}
                        className="bg-stone-50/80 rounded-xl p-3 border border-stone-100"
                      >
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <h3 className="text-sm font-bold text-stone-900">
                            {idx + 1}. {dish.name}
                          </h3>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-stone-500">
                              约 {dish.timeMin} 分钟
                            </span>
                            {!imgUrl && (
                              <button
                                type="button"
                                disabled={isImgLoading}
                                onClick={() =>
                                  handleGenerateDishImage(
                                    dishKey,
                                    dish.name,
                                    dish.ingredientsText
                                  )
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-800 hover:bg-amber-200/80 disabled:opacity-60 transition cursor-pointer"
                              >
                                {isImgLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <ImageIcon className="w-3 h-3" />
                                )}
                                {isImgLoading ? "生图中…" : "成品图"}
                              </button>
                            )}
                          </div>
                        </div>

                        {imgErr && (
                          <p className="text-[11px] text-red-600 mb-1.5">
                            {imgErr}
                          </p>
                        )}

                        {imgUrl && (
                          <div className="mb-2.5 overflow-hidden rounded-xl border border-stone-200 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt={dish.name}
                              className="w-full h-44 object-cover"
                            />
                          </div>
                        )}

                        <p className="text-xs text-amber-800 bg-amber-50/70 rounded-lg px-2.5 py-1.5 mb-2 leading-relaxed">
                          <span className="font-semibold">用料：</span>
                          {dish.ingredientsText}
                        </p>
                        <ol className="flex flex-col gap-1.5 text-xs text-stone-700 leading-relaxed">
                          {dish.steps.map((step, sIdx) => (
                            <li key={sIdx} className="flex gap-2">
                              <span className="w-4 h-4 rounded-full bg-stone-200 text-stone-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {sIdx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    );
                  })}
                </div>

                {/* Interactive Shopping List */}
                {(hasMainShopping || hasAromaticShopping) && (
                  <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 mb-2">
                      <ShoppingBasket className="w-4 h-4 text-emerald-700" />
                      极简采购清单（点击可打钩）
                    </div>

                    {hasMainShopping && (
                      <div className="mb-2">
                        <div className="text-[11px] font-semibold text-emerald-800 mb-1">
                          必买主料
                        </div>
                        <ul className="flex flex-col gap-1.5">
                          {plan.shoppingList!.main.map((item, i) => {
                            const key = `${plan.id}-main-${i}`;
                            const checked = !!checkedItems[key];
                            return (
                              <li key={key}>
                                <button
                                  type="button"
                                  onClick={() => toggleShoppingItem(key)}
                                  className={`w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white/80 border transition ${
                                    checked
                                      ? "border-emerald-200 text-stone-400 line-through"
                                      : "border-emerald-100 text-stone-800"
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <span
                                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                                        checked
                                          ? "bg-emerald-600 border-emerald-600 text-white"
                                          : "border-stone-300 bg-white"
                                      }`}
                                    >
                                      {checked && <Check className="w-3 h-3" />}
                                    </span>
                                    {item.name}
                                  </span>
                                  <span className="font-medium text-emerald-800">
                                    {item.amount}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {hasAromaticShopping && (
                      <div>
                        <div className="text-[11px] font-semibold text-emerald-700/90 mb-1">
                          顺手可补提味料（家里没有再买）
                        </div>
                        <ul className="flex flex-wrap gap-1.5">
                          {plan.shoppingList!.aromatics.map((item, i) => {
                            const key = `${plan.id}-arom-${i}`;
                            const checked = !!checkedItems[key];
                            return (
                              <li key={key}>
                                <button
                                  type="button"
                                  onClick={() => toggleShoppingItem(key)}
                                  className={`text-xs px-2.5 py-1 rounded-lg bg-white/80 border flex items-center gap-1.5 transition ${
                                    checked
                                      ? "border-emerald-200 text-stone-400 line-through"
                                      : "border-emerald-100 text-stone-700"
                                  }`}
                                >
                                  {checked && (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  )}
                                  {item.name} · {item.amount}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {/* Leftover Tip */}
          {result.leftoverTip && (
            <div className="bg-stone-100 border border-stone-200 rounded-xl p-3 text-xs text-stone-700 flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{result.leftoverTip}</span>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
