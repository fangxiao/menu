"use client";

import { useEffect, useRef, useState } from "react";
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
  ShieldCheck,
  ShieldAlert,
  Copy,
  CheckCircle2,
  Coins,
  Radio,
  MessageSquarePlus,
  Send,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { MenuPlan, MenuResponse } from "@/lib/types";
import { applyDemoFollowUp, getDemoMenuResponse } from "@/lib/demo-presets";

interface QuickExample {
  label: string;
  text: string;
  servings: number;
  constraints?: string[];
  preference?: string;
}

interface ConversationTurn {
  id: string;
  round: number;
  userMessage?: string;
  response: MenuResponse;
}

const QUICK_EXAMPLES: QuickExample[] = [
  {
    label: "西红柿+牛肉+鸡蛋",
    text: "2个西红柿、半斤牛肉、3个鸡蛋",
    servings: 2,
    constraints: [],
  },
  {
    label: "忌口对比：花生过敏+不吃辣",
    text: "1块鸡胸肉、1根黄瓜、1根胡萝卜、1盒嫩豆腐、2个鸡蛋",
    servings: 2,
    constraints: ["花生过敏", "不吃辣"],
  },
  {
    label: "想做土豆炖牛肉",
    text: "我想做土豆炖牛肉，冰箱只有半斤牛肉",
    servings: 2,
    constraints: [],
  },
  {
    label: "一人食清库存",
    text: "1把金针菇、2个鸡蛋、半根黄瓜",
    servings: 1,
    constraints: [],
  },
];

const SAFETY_CONSTRAINTS = [
  "不吃辣",
  "花生过敏",
  "海鲜过敏",
  "清真",
  "全素",
  "无蛋",
  "免明火/电饭煲",
];

const PREFERENCE_TAGS = [
  "默认最省事",
  "15分钟快手",
  "清淡减脂",
  "下饭硬菜",
  "周末采购",
];

const LOADING_STEPS = [
  "解析冰箱库存与人数份量",
  "检索 64 道结构化家常菜知识库",
  "执行过敏与忌口安全硬过滤",
  "生成双方案与精确采购清单",
];

const QUICK_FOLLOW_UPS = [
  "家里没有料酒和淀粉",
  "多加1个人，重算克数和清单",
  "再加一道10分钟快手汤",
  "刚想起孩子花生过敏且不吃辣",
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

function formatShoppingListForShare(plan: MenuPlan, servings: number): string {
  const lines: string[] = [];
  lines.push(`【冰箱有谱 · 采购清单】${plan.title}（${servings}人份）`);
  if (plan.shoppingList?.main && plan.shoppingList.main.length > 0) {
    lines.push("必买主料：");
    plan.shoppingList.main.forEach((item) => {
      lines.push(`☐ ${item.name} — ${item.amount}`);
    });
  }
  if (plan.shoppingList?.aromatics && plan.shoppingList.aromatics.length > 0) {
    lines.push("顺手可补提味料（家里没有再买）：");
    plan.shoppingList.aromatics.forEach((item) => {
      lines.push(`☐ ${item.name} — ${item.amount}`);
    });
  }
  return lines.join("\n");
}

export default function HomePage() {
  const [ingredients, setIngredients] = useState("");
  const [fridgeImage, setFridgeImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [servings, setServings] = useState(2);
  const [preference, setPreference] = useState("默认最省事");
  const [constraints, setConstraints] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Multi-turn structured card timeline
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>({});
  const [followUpInput, setFollowUpInput] = useState("");
  const [pendingFollowUp, setPendingFollowUp] = useState<string | null>(null);
  const [refining, setRefining] = useState(false);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [copiedPlanKey, setCopiedPlanKey] = useState<string | null>(null);
  const [dishImages, setDishImages] = useState<Record<string, string>>({});
  const [dishImgLoading, setDishImgLoading] = useState<Record<string, boolean>>({});
  const [dishImgError, setDishImgError] = useState<Record<string, string>>({});
  const [demoMode, setDemoMode] = useState(false);
  const [demoSwitchVisible, setDemoSwitchVisible] = useState(false);

  const latestTurn = turns.length > 0 ? turns[turns.length - 1] : null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1" || params.get("demo") === "true") {
      setDemoMode(true);
      setDemoSwitchVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    setLoadingStep(0);
    const t1 = window.setTimeout(() => setLoadingStep(1), 450);
    const t2 = window.setTimeout(() => setLoadingStep(2), 950);
    const t3 = window.setTimeout(() => setLoadingStep(3), 1450);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [loading]);

  function scrollToBottomSoon() {
    window.setTimeout(() => {
      bottomAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 80);
  }

  function toggleConstraint(tag: string) {
    setConstraints((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  }

  function toggleTurnExpanded(turnId: string) {
    setExpandedTurns((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  }

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

  function startNewConversationWithResult(data: MenuResponse) {
    const firstId = `turn-1-${Date.now()}`;
    setTurns([{ id: firstId, round: 1, response: data }]);
    setExpandedTurns({ [firstId]: true });
    setCheckedItems({});
    setDishImages({});
    setDishImgLoading({});
    setDishImgError({});
    setFollowUpInput("");
    setPendingFollowUp(null);
  }

  async function runDemoFallback() {
    setLoading(true);
    setError(null);
    setTurns([]);

    await new Promise((resolve) => window.setTimeout(resolve, 1650));
    const demoData = getDemoMenuResponse({
      ingredients: ingredients.trim() || "2个西红柿、半斤牛肉、3个鸡蛋",
      servings,
      constraints,
    });
    startNewConversationWithResult(demoData);
    setLoading(false);
  }

  async function handleGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = ingredients.trim();
    if (!trimmed && !fridgeImage) {
      setError("先输入冰箱现有食材，或拍一张冰箱食材照片吧");
      return;
    }

    if (demoMode) {
      await runDemoFallback();
      return;
    }

    setLoading(true);
    setError(null);
    setTurns([]);

    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: trimmed,
          imageBase64: fridgeImage || undefined,
          servings,
          preference: preference === "默认最省事" ? "" : preference,
          constraints,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "生成失败，请稍后重试");
      }
      startNewConversationWithResult(data as MenuResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络请求失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleFollowUp(customText?: string) {
    const query = (customText ?? followUpInput).trim();
    if (!query || !latestTurn || refining) return;

    setRefining(true);
    setPendingFollowUp(query);
    setFollowUpInput("");
    setError(null);
    scrollToBottomSoon();

    const history = turns
      .map((t) => t.userMessage)
      .filter((m): m is string => Boolean(m));

    try {
      let nextResponse: MenuResponse;

      if (demoMode || latestTurn.response.isDemoFallback) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        nextResponse = applyDemoFollowUp({
          previous: latestTurn.response,
          followUp: query,
          constraints,
        });
      } else {
        const res = await fetch("/api/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ingredients: ingredients.trim(),
            servings: latestTurn.response.assessment.servings || servings,
            preference: preference === "默认最省事" ? "" : preference,
            constraints,
            followUp: query,
            previousMenu: latestTurn.response,
            history,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "微调失败，请稍后重试");
        }
        nextResponse = data as MenuResponse;
      }

      const nextRound = turns.length + 1;
      const nextId = `turn-${nextRound}-${Date.now()}`;
      setTurns((prev) => [
        ...prev,
        {
          id: nextId,
          round: nextRound,
          userMessage: query,
          response: nextResponse,
        },
      ]);
      // Auto-collapse previous turns so the timeline stays clean and easy to compare
      setExpandedTurns({ [nextId]: true });
      setPendingFollowUp(null);
      scrollToBottomSoon();
    } catch (err) {
      setPendingFollowUp(null);
      setError(err instanceof Error ? err.message : "微调请求失败");
    } finally {
      setRefining(false);
    }
  }

  function toggleShoppingItem(key: string) {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleCopyShoppingList(
    copyKey: string,
    plan: MenuPlan,
    planServings: number
  ) {
    const text = formatShoppingListForShare(plan, planServings);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPlanKey(copyKey);
      window.setTimeout(() => {
        setCopiedPlanKey((curr) => (curr === copyKey ? null : curr));
      }, 2200);
    } catch {
      setError("浏览器未授权剪贴板复制，请手动截图分享");
    }
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
    <main className="min-h-screen w-full max-w-md mx-auto px-4 py-6 pb-20 flex flex-col gap-5">
      {/* Header */}
      <header className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-stone-900">
              冰箱有谱 · 今天吃什么
            </h1>
            <p className="text-xs text-stone-500">
              64 道结构化菜谱 + 安全硬过滤，3 秒出省事方案
            </p>
          </div>
        </div>

        {demoSwitchVisible && (
          <button
            type="button"
            onClick={() => setDemoMode((v) => !v)}
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition cursor-pointer ${
              demoMode
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-stone-100 text-stone-600 border-stone-200"
            }`}
            title="切换决赛零翻车演示模式与实时 API 模式"
          >
            <Radio className="w-3 h-3" />
            {demoMode ? "演示兜底" : "实时模式"}
          </button>
        )}
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
                  setConstraints(ex.constraints || []);
                  if (ex.preference) setPreference(ex.preference);
                  setError(null);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70 active:scale-95 transition cursor-pointer"
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
                className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
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

        {/* Safety & Dietary Hard-Filter Chips */}
        <div>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            安全与忌口（多选 · 知识库硬过滤）
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SAFETY_CONSTRAINTS.map((tag) => {
              const active = constraints.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleConstraint(tag)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer border ${
                    active
                      ? "bg-emerald-600 text-white border-emerald-600 font-medium shadow-xs"
                      : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                  }`}
                >
                  {active ? `✓ ${tag}` : tag}
                </button>
              );
            })}
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
                className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer ${
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
              正在检索知识库并配菜…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {turns.length > 0 ? "重新生成新菜单方案" : "生成极简菜单方案"}
            </>
          )}
        </button>
      </form>

      {/* Step-by-step Thinking Progress (Round 1) */}
      {loading && (
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200/80 flex flex-col gap-2.5">
          <div className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            决策引擎运行中
          </div>
          <ul className="flex flex-col gap-2">
            {LOADING_STEPS.map((label, idx) => {
              const done = idx < loadingStep;
              const current = idx === loadingStep;
              return (
                <li
                  key={label}
                  className={`flex items-center gap-2 text-xs transition ${
                    done
                      ? "text-emerald-700 font-medium"
                      : current
                        ? "text-stone-900 font-semibold"
                        : "text-stone-400"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : current ? (
                    <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-stone-300 shrink-0" />
                  )}
                  <span>{label}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Error Message with Offline Demo Fallback */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={runDemoFallback}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white border border-red-200 text-red-700 hover:bg-red-100/50 transition cursor-pointer"
            >
              使用离线演示数据继续
            </button>
          </div>
        </div>
      )}

      {/* Multi-turn Structured Card Timeline */}
      {turns.length > 0 && !loading && (
        <section className="flex flex-col gap-4">
          {turns.map((turn, turnIndex) => {
            const isLatest = turnIndex === turns.length - 1;
            const isExpanded = !!expandedTurns[turn.id];
            const res = turn.response;
            const firstPlanTitle = res.plans?.[0]?.title || "菜单方案";

            return (
              <div key={turn.id} className="flex flex-col gap-3">
                {/* User Follow-up Bubble (Turn 2+) */}
                {turn.userMessage && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-stone-900 text-white px-3.5 py-2 text-xs leading-relaxed shadow-xs">
                      <span className="text-[10px] text-stone-400 block mb-0.5">
                        补充要求 · 第 {turn.round} 轮
                      </span>
                      {turn.userMessage}
                    </div>
                  </div>
                )}

                {/* Collapsible Header for Previous Turns */}
                {!isLatest && (
                  <button
                    type="button"
                    onClick={() => toggleTurnExpanded(turn.id)}
                    className="w-full bg-white/90 hover:bg-white border border-stone-200 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition cursor-pointer shadow-2xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500">
                        <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                          第 {turn.round} 轮方案
                        </span>
                        <span>{res.assessment.servings} 人份</span>
                        {res.safetyReport &&
                          res.safetyReport.excludedCount > 0 && (
                            <span className="text-emerald-700">
                              · 已拦截 {res.safetyReport.excludedCount} 道
                            </span>
                          )}
                      </div>
                      <p className="text-xs font-medium text-stone-800 truncate mt-0.5">
                        {firstPlanTitle}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-700 font-medium shrink-0">
                      {isExpanded ? (
                        <>
                          收起 <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          展开对比 <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </span>
                  </button>
                )}

                {/* Full Structured Result Cards */}
                {isExpanded && (
                  <div className="flex flex-col gap-3.5">
                    {/* Refinement Adjustment Note */}
                    {res.adjustmentNote && (
                      <div className="bg-indigo-50/90 border border-indigo-200 text-indigo-950 rounded-2xl p-3 text-xs flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-indigo-800 mb-0.5">
                            已按你的补充生成第 {turn.round} 轮方案
                          </div>
                          <p className="text-indigo-900/90 leading-relaxed">
                            {res.adjustmentNote}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Safety Hard-Filter Report */}
                    {res.safetyReport && (
                      <div
                        className={`rounded-2xl p-3.5 border text-xs ${
                          res.safetyReport.activeConstraints.length > 0
                            ? "bg-emerald-50/90 border-emerald-200 text-emerald-950"
                            : "bg-stone-50 border-stone-200/80 text-stone-600"
                        }`}
                      >
                        {res.safetyReport.activeConstraints.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 font-bold text-emerald-800">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                安全硬过滤已生效
                              </span>
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                扫描 {res.safetyReport.totalScanned} 道 · 排除{" "}
                                {res.safetyReport.excludedCount} 道
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                              生效约束：
                              {res.safetyReport.activeConstraints.join("、")}
                              （已在进入模型前从结构化菜谱库中物理隔离）
                            </p>
                            {res.safetyReport.excludedSamples.length > 0 && (
                              <div className="flex flex-col gap-1 pt-1 border-t border-emerald-200/70">
                                <span className="text-[11px] font-semibold text-emerald-900 flex items-center gap-1">
                                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                                  已自动拦截的高风险关联菜品：
                                </span>
                                <div className="flex flex-wrap gap-1.5 mt-0.5">
                                  {res.safetyReport.excludedSamples.map((item) => (
                                    <span
                                      key={item.recipeName}
                                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/90 border border-emerald-200/80 text-stone-700"
                                    >
                                      <span className="font-semibold text-stone-900 line-through decoration-red-400">
                                        {item.recipeName}
                                      </span>
                                      <span className="text-stone-500">
                                        · {item.reason}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 font-medium text-stone-700">
                              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              已检索 {res.safetyReport.totalScanned}{" "}
                              道结构化家常菜谱库
                            </span>
                            <span className="text-[11px] text-stone-500">
                              未勾选特殊忌口
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Value Quantification Card */}
                    {res.valueSummary && (
                      <div className="bg-white border border-stone-200/80 rounded-2xl p-3.5 shadow-xs flex flex-col gap-2.5">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-amber-50/70 rounded-xl py-2 px-1">
                            <div className="text-base font-bold text-amber-700">
                              {res.valueSummary.usedInventoryCount} 样
                            </div>
                            <div className="text-[11px] text-stone-500">
                              消化现有库存
                            </div>
                          </div>
                          <div className="bg-emerald-50/70 rounded-xl py-2 px-1">
                            <div className="text-base font-bold text-emerald-700">
                              {res.valueSummary.toBuyCount} 样
                            </div>
                            <div className="text-[11px] text-stone-500">
                              需补买主料
                            </div>
                          </div>
                          <div className="bg-stone-100/80 rounded-xl py-2 px-1">
                            <div className="text-base font-bold text-stone-900">
                              ¥{res.valueSummary.estimatedSavedYuan}
                            </div>
                            <div className="text-[11px] text-stone-500">
                              预估防盲买省
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-stone-600 px-0.5">
                          <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{res.valueSummary.highlight}</span>
                        </div>
                      </div>
                    )}

                    {/* Assessment */}
                    <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-3.5 text-sm text-amber-950">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs uppercase tracking-wide text-amber-700">
                          库存评估 · {res.assessment.servings} 人份
                        </span>
                        {res.isDemoFallback && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/60 text-amber-900">
                            演示预设
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-stone-700">
                        {res.assessment.summary}
                      </p>
                    </div>

                    {/* Menu Plans */}
                    {res.plans.map((plan) => {
                      const hasMainShopping =
                        plan.shoppingList?.main &&
                        plan.shoppingList.main.length > 0;
                      const hasAromaticShopping =
                        plan.shoppingList?.aromatics &&
                        plan.shoppingList.aromatics.length > 0;
                      const copyKey = `${turn.id}-${plan.id}`;
                      const isCopied = copiedPlanKey === copyKey;

                      return (
                        <article
                          key={copyKey}
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
                              <p className="text-xs text-stone-500 mt-0.5">
                                {plan.reason}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-lg shrink-0">
                              <Clock className="w-3.5 h-3.5" />
                              {plan.totalTimeMin}分
                            </div>
                          </div>

                          {/* Dishes */}
                          <div className="flex flex-col gap-3.5">
                            {plan.dishes.map((dish, idx) => {
                              const dishKey = `${turn.id}-${plan.id}-dish-${idx}`;
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
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                                  <ShoppingBasket className="w-4 h-4 text-emerald-700" />
                                  极简采购清单（点击可打钩）
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyShoppingList(
                                      copyKey,
                                      plan,
                                      res.assessment.servings || servings
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100/60 transition cursor-pointer"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      已复制
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      复制发群
                                    </>
                                  )}
                                </button>
                              </div>

                              {hasMainShopping && (
                                <div className="mb-2">
                                  <div className="text-[11px] font-semibold text-emerald-800 mb-1">
                                    必买主料
                                  </div>
                                  <ul className="flex flex-col gap-1.5">
                                    {plan.shoppingList!.main.map((item, i) => {
                                      const key = `${turn.id}-${plan.id}-main-${i}`;
                                      const checked = !!checkedItems[key];
                                      return (
                                        <li key={key}>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleShoppingItem(key)
                                            }
                                            className={`w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white/80 border transition cursor-pointer ${
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
                                                {checked && (
                                                  <Check className="w-3 h-3" />
                                                )}
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
                                    {plan.shoppingList!.aromatics.map(
                                      (item, i) => {
                                        const key = `${turn.id}-${plan.id}-arom-${i}`;
                                        const checked = !!checkedItems[key];
                                        return (
                                          <li key={key}>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                toggleShoppingItem(key)
                                              }
                                              className={`text-xs px-2.5 py-1 rounded-lg bg-white/80 border flex items-center gap-1.5 transition cursor-pointer ${
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
                                      }
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}

                    {/* Leftover Tip */}
                    {res.leftoverTip && (
                      <div className="bg-stone-100 border border-stone-200 rounded-xl p-3 text-xs text-stone-700 flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{res.leftoverTip}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pending Follow-up Bubble & Thinking Card */}
          {pendingFollowUp && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-stone-900 text-white px-3.5 py-2 text-xs leading-relaxed shadow-xs">
                  <span className="text-[10px] text-stone-400 block mb-0.5">
                    补充要求 · 第 {turns.length + 1} 轮
                  </span>
                  {pendingFollowUp}
                </div>
              </div>
              <div className="bg-white rounded-2xl p-3.5 border border-amber-200/80 shadow-xs flex items-center gap-2.5 text-xs text-stone-700">
                <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                <span>正在结合上一轮方案与安全规则，为你生成新一轮调整方案…</span>
              </div>
            </div>
          )}

          {/* Bottom Conversational Follow-up Composer */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200/80 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                <MessageSquarePlus className="w-4 h-4 text-amber-600" />
                继续对话补充（向下生成新一轮方案）
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
                当前第 {turns.length} 轮
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_FOLLOW_UPS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={refining}
                  onClick={() => handleFollowUp(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70 hover:bg-amber-100/70 disabled:opacity-50 active:scale-95 transition cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={followUpInput}
                disabled={refining}
                onChange={(e) => setFollowUpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFollowUp();
                  }
                }}
                placeholder="例如：刚发现还有半颗生菜 / 家里没料酒 / 换个清淡的"
                className="flex-1 rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
              />
              <button
                type="button"
                disabled={refining || !followUpInput.trim()}
                onClick={() => handleFollowUp()}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-medium shrink-0 transition cursor-pointer"
              >
                {refining ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    生成中
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    发送
                  </>
                )}
              </button>
            </div>
          </div>

          <div ref={bottomAnchorRef} />
        </section>
      )}
    </main>
  );
}
