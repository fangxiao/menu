import { NextRequest, NextResponse } from "next/server";
import {
  loadRecipeDatabase,
  selectCandidateRecipesWithSafety,
} from "@/lib/recipes";
import type { MenuResponse, ValueSummary } from "@/lib/types";

interface RequestBody {
  ingredients?: string;
  imageBase64?: string;
  servings?: number;
  preference?: string;
  constraints?: string[];
  followUp?: string;
  previousMenu?: MenuResponse;
  history?: string[];
}

function extractJson(text: string): MenuResponse {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidate = candidate.slice(firstBrace, lastBrace + 1);
  }

  // Fix common LLM JSON trailing commas
  candidate = candidate.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(candidate) as MenuResponse;
  } catch {
    throw new Error(
      `模型返回格式非有效 JSON，请重试（返回开头：${trimmed.slice(0, 60)}...）`
    );
  }
}

function buildFallbackValueSummary(
  parsed: MenuResponse,
  rawIngredients: string
): ValueSummary {
  const inventoryTokens = rawIngredients
    .split(/[、，,。\s+和与]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const usedInventoryCount = Math.max(inventoryTokens.length, 2);
  const firstPlan = parsed.plans?.[0];
  const toBuyCount = firstPlan?.shoppingList?.main?.length ?? 0;
  const estimatedSavedYuan = Math.max(15, usedInventoryCount * 8);

  return {
    usedInventoryCount,
    toBuyCount,
    estimatedSavedYuan,
    highlight:
      toBuyCount === 0
        ? `优先消化 ${usedInventoryCount} 样现有库存，0 补货直接开火，约省 ¥${estimatedSavedYuan} 盲买成本`
        : `充分利用 ${usedInventoryCount} 样库存，仅需精准补买 ${toBuyCount} 样主料，约省 ¥${estimatedSavedYuan}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const rawIngredients = (body.ingredients || "").trim();
    const imageBase64 = (body.imageBase64 || "").trim();
    if (!rawIngredients && !imageBase64) {
      return NextResponse.json(
        { error: "请输入冰箱现有食材，或上传一张冰箱食材照片" },
        { status: 400 }
      );
    }

    const servings =
      typeof body.servings === "number" && body.servings >= 1 && body.servings <= 8
        ? Math.round(body.servings)
        : 1;
    const preference = (body.preference || "").trim();
    const constraints = Array.isArray(body.constraints) ? body.constraints : [];
    const followUp = (body.followUp || "").trim();
    const history = Array.isArray(body.history)
      ? body.history.map((h) => String(h).trim()).filter(Boolean)
      : [];
    const previousMenu = body.previousMenu;

    const baseUrl = (
      process.env.AI_API_BASE_URL || "https://api.ailearning.top/v1"
    ).replace(/\/+$/, "");
    const apiKey = process.env.AI_API_KEY || "";
    const model = imageBase64
      ? process.env.AI_VISION_MODEL || process.env.AI_TEXT_MODEL || "multimodal"
      : process.env.AI_TEXT_MODEL || process.env.AI_VISION_MODEL || "multimodal";

    if (!apiKey || apiKey === "your-api-key-here") {
      return NextResponse.json(
        { error: "服务端未配置 AI_API_KEY，请在 .env.local 中配置" },
        { status: 500 }
      );
    }

    const db = loadRecipeDatabase();
    const combinedQuery = [rawIngredients, preference, ...history, followUp]
      .filter(Boolean)
      .join(" ");
    const { candidates, safetyReport } = selectCandidateRecipesWithSafety(
      combinedQuery,
      constraints,
      imageBase64 && !rawIngredients ? 30 : 18
    );

    const compactRecipes = candidates.map((r) => ({
      name: r.name,
      time: r.prep_time_min,
      base_servings: r.base_servings,
      main_ingredients: r.main_ingredients.map(
        (i) => `${i.name}${i.amount}${i.unit}(约${i.grams}g)`
      ),
      optional_aromatics: r.optional_aromatics,
      special_seasonings: r.special_seasonings,
      cookware: r.cookware || [],
      tags: r.tags,
      steps: r.steps,
    }));

    const safetyRuleBlock =
      safetyReport.activeConstraints.length > 0
        ? `\n0. **安全与忌口硬约束（最高优先级，绝对不可违反）**：\n   - 当前生效约束：${safetyReport.activeConstraints.join("、")}。\n   - 知识库已通过硬过滤排除 ${safetyReport.excludedCount} 道不合规菜谱，严禁在方案、步骤或采购清单中出现任何违反上述约束的主料、可选提味料或隐藏调料（如不吃辣去掉小米辣/干辣椒/豆瓣酱；清真严禁猪肉与料酒；全素严禁蚝油/虾皮/肉蛋奶；花生/海鲜/无蛋严禁相关过敏原；免明火/电饭煲仅使用电饭煲/微波炉/免火做法）。`
        : "";

    const systemPrompt = `你是「冰箱有谱 · 极简配菜与采购助手」。你的目标是用最少决策成本，帮用户解决「今天吃什么」和「去超市买什么」。

## 规则${safetyRuleBlock}
1. **调料默认假设**：
   - 默认家里常备基础调料：${db.pantry_defaults.basic_seasonings.join("、")}（不计入缺料）。
   - 可选提味料：${db.pantry_defaults.optional_aromatics.join("、")}（有就放、没有可省，仅在采购清单 aromatics 中顺带提醒）。
   - 特殊酱料（如豆瓣酱、咖喱块、蚝油、可乐等）：若需要且用户未提及，请在 ingredientsText 中注明或放入采购清单。
2. **换算与份量**：
   - 1斤=500g，半斤=250g，1个中等西红柿≈150g，1个鸡蛋≈50g。
   - 按就餐人数（${servings}人份）合理分配食材，避免同一个方案内两道菜重复透支同一份库存食材。
3. **双方案互补决策**：
   - **若现有食材不够 ${servings} 人份，或缺少某道菜的关键食材**：
     - 方案 A：「现有食材直接做（零采购）」——100%只用现有食材拼出最省事的菜或简餐（shoppingList 留空或省略）。
     - 方案 B：「微补货升级版（多买1-2样凑齐${servings}人份）」——只需额外买 1-2 样高性价比主料即可凑齐标准餐，必须附带精确克数/数量单位的 shoppingList。
   - **若现有食材已经足够 ${servings} 人份**：
     - 提供 2 个不同风味或省事程度的「零采购」方案（如方案 A 快手下饭炒菜组合，方案 B 一菜一汤/清淡省锅组合），均无需必买主料。
4. **极简步骤**：
   - 每道菜 steps 控制在 3-4 步大白话核心动作，包含火候（大火/中小火）与关键细节。
5. **严格输出 JSON**：
   - 只返回合法 JSON，不要任何额外解释文字或 Markdown 注释。

## JSON 输出结构
{
  "assessment": {
    "sufficient": true,
    "servings": ${servings},
    "summary": "一句话库存评估，说明按几人份估算以及是否够吃"
  },
  "valueSummary": {
    "usedInventoryCount": 3,
    "toBuyCount": 0,
    "estimatedSavedYuan": 28,
    "highlight": "一句话量化收益，如：消化 3 样现有库存、0 补货开火，约省 ¥28 避免外卖与盲买"
  },
  "plans": [
    {
      "id": "plan-a",
      "title": "方案 A：...",
      "badge": "零采购 · 直接开火",
      "totalTimeMin": 20,
      "reason": "一句话适用场景",
      "dishes": [
        {
          "name": "菜名",
          "timeMin": 15,
          "ingredientsText": "按当前人数换算的食材分配（如：牛肉250g、西红柿2个）",
          "steps": ["步骤1", "步骤2", "步骤3"]
        }
      ],
      "shoppingList": {
        "main": [{"name": "食材名", "amount": "精确克数或个/把"}],
        "aromatics": [{"name": "提味料名", "amount": "少量/1头/1小把"}]
      }
    }
  ],
  "leftoverTip": "若有未用完的库存食材，给1句防浪费小贴士；全部用完可为空字符串",
  "adjustmentNote": "仅在用户进行多轮追问微调时填写：用1句大白话说明本轮根据补充要求做了哪些调整；首轮生成可留空字符串"
}

## 参考菜谱知识库（已通过安全过滤，优先从中匹配）
${JSON.stringify(compactRecipes)}`;

    const previousSummary = previousMenu
      ? JSON.stringify({
          assessment: previousMenu.assessment,
          plans: previousMenu.plans.map((p) => ({
            title: p.title,
            dishes: p.dishes.map((d) => ({
              name: d.name,
              ingredientsText: d.ingredientsText,
            })),
            shoppingList: p.shoppingList,
          })),
        })
      : "";

    const followUpBlock = followUp
      ? `\n\n## 多轮微调上下文（请基于上一轮方案做增量调整）\n上一轮方案摘要：${previousSummary}${
          history.length > 0 ? `\n此前已生效的补充要求：${history.join("；")}` : ""
        }\n本轮最新补充/微调要求：${followUp}\n请严格按本轮补充要求更新菜品、做法步骤、人数克数、采购清单，并在 adjustmentNote 中用一句话说明做了什么调整。`
      : "";

    const userPrompt = `${
      imageBase64 && !followUp
        ? "请先仔细识别照片中可见的所有食材及其大致数量/份量，再结合文字补充（如有）来配菜，并在 assessment.summary 中简要列出识别到的食材。\n"
        : ""
    }冰箱现有食材/需求：${rawIngredients || "（见附带照片）"}
就餐人数：${servings} 人${preference ? `\n偏好/场景：${preference}` : ""}${
      safetyReport.activeConstraints.length > 0
        ? `\n安全与忌口（硬约束）：${safetyReport.activeConstraints.join("、")}`
        : ""
    }${followUpBlock}

请直接输出纯 JSON，第一个字符必须是 {，最后一个字符必须是 }，不要输出任何分析过程或前缀文字。`;

    const userContent =
      imageBase64 && !followUp
        ? [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: imageBase64 } },
          ]
        : userPrompt;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const upstreamRes = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: attempt === 0 ? 0.4 : 0.1,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (!upstreamRes.ok) {
        const errText = await upstreamRes.text();
        return NextResponse.json(
          { error: `模型接口调用失败 (${upstreamRes.status}): ${errText.slice(0, 200)}` },
          { status: 502 }
        );
      }

      const data = (await upstreamRes.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastError = new Error("模型返回内容为空，请重试");
        continue;
      }

      try {
        const parsed = extractJson(content);
        parsed.safetyReport = safetyReport;
        if (!parsed.valueSummary || !parsed.valueSummary.highlight) {
          parsed.valueSummary = buildFallbackValueSummary(parsed, rawIngredients);
        }
        return NextResponse.json(parsed);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error("JSON 解析失败");
      }
    }

    throw lastError || new Error("生成失败，请重试");
  } catch (err) {
    console.error("[/api/menu] error:", err);
    const message = err instanceof Error ? err.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
