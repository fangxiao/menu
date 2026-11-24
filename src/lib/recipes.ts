import fs from "node:fs";
import path from "node:path";
import type { ExcludedRecipeInfo, SafetyReport } from "./types";

export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
  grams: number;
}

export interface RecipeDiet {
  vegetarian?: "yes" | "optional" | "no";
  vegan?: "yes" | "optional" | "no";
  pork?: "contains" | "optional" | "free";
  beef?: "contains" | "optional" | "free";
  alcohol?: "contains" | "optional" | "free";
}

export interface RecipeSpicy {
  level: number;
  optional: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  prep_time_min: number;
  difficulty: string;
  base_servings: number;
  main_ingredients: RecipeIngredient[];
  optional_aromatics: string[];
  basic_seasonings: string[];
  special_seasonings: string[];
  allergens?: string[];
  diet?: RecipeDiet;
  spicy?: RecipeSpicy;
  cookware?: string[];
  tags: string[];
  steps: string[];
}

interface RecipeDatabase {
  pantry_defaults: {
    basic_seasonings: string[];
    optional_aromatics: string[];
  };
  recipes: Recipe[];
}

let cachedDb: RecipeDatabase | null = null;

export function loadRecipeDatabase(): RecipeDatabase {
  if (cachedDb) return cachedDb;
  const dbPath = path.join(
    process.cwd(),
    ".agents",
    "skills",
    "fridge-menu",
    "resources",
    "recipes.json"
  );
  const raw = fs.readFileSync(dbPath, "utf-8");
  cachedDb = JSON.parse(raw) as RecipeDatabase;
  return cachedDb;
}

const ALIAS_MAP: Record<string, string[]> = {
  西红柿: ["番茄", "西红柿"],
  番茄: ["番茄", "西红柿"],
  牛肉: ["牛肉", "牛腩"],
  牛腩: ["牛肉", "牛腩"],
  猪肉: ["猪肉", "猪瘦肉", "里脊", "五花", "肉末"],
  肉末: ["肉末", "猪肉"],
  鸡肉: ["鸡肉", "鸡胸肉", "鸡腿", "鸡翅"],
  鸡腿: ["鸡腿", "鸡排"],
  鸡翅: ["鸡翅", "鸡中翅"],
  蛋: ["鸡蛋", "蛋"],
  鸡蛋: ["鸡蛋"],
  青菜: ["生菜", "油麦菜", "空心菜", "菠菜", "菜心", "白菜", "娃娃菜"],
  白菜: ["大白菜", "娃娃菜", "白菜"],
  包菜: ["圆白菜", "包菜"],
  豆腐: ["嫩豆腐", "老豆腐", "北豆腐", "豆腐"],
  豆角: ["四季豆", "长豆角", "豆角"],
  虾: ["虾仁", "鲜虾"],
  鱼: ["巴沙鱼", "龙利鱼", "鲈鱼"],
  蘑菇: ["金针菇", "香菇", "菌菇", "白玉菇"],
  米饭: ["米饭", "剩米饭"],
  面: ["挂面", "面条"],
};

function expandQueryTerms(input: string): string[] {
  const cleaned = input
    .replace(/[0-9半两斤克个根把颗盒条碗片勺、，,。.；;\s]+/g, " ")
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const expanded = new Set<string>();

  for (const token of tokens) {
    expanded.add(token);
    for (const [key, aliases] of Object.entries(ALIAS_MAP)) {
      if (token.includes(key) || key.includes(token)) {
        aliases.forEach((a) => expanded.add(a));
      }
    }
  }
  return Array.from(expanded);
}

const CONSTRAINT_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "不吃辣", regex: /(不吃辣|不要辣|忌辣|免辣|怕辣)/ },
  { label: "花生过敏", regex: /(花生过敏|不吃花生|忌花生|无花生)/ },
  { label: "海鲜过敏", regex: /(海鲜过敏|不吃海鲜|虾过敏|鱼过敏|无海鲜)/ },
  { label: "无蛋", regex: /(鸡蛋过敏|蛋过敏|不吃蛋|不吃鸡蛋|无蛋)/ },
  { label: "清真", regex: /(清真|不吃猪肉|忌猪肉|无猪肉|halal)/i },
  { label: "全素", regex: /(全素|纯素|素食|不吃肉|vegan)/i },
  {
    label: "免明火/电饭煲",
    regex: /(只有电饭煲|电饭煲做|免明火|无明火|没炒锅|宿舍|只有微波炉)/,
  },
];

export function normalizeConstraints(
  selected: string[] = [],
  rawText = ""
): string[] {
  const active = new Set<string>();
  for (const c of selected) {
    const trimmed = c.trim();
    if (trimmed) active.add(trimmed);
  }
  for (const { label, regex } of CONSTRAINT_PATTERNS) {
    if (regex.test(rawText)) {
      active.add(label);
    }
  }
  return Array.from(active);
}

function getExclusionReasons(recipe: Recipe, constraints: string[]): string[] {
  const reasons: string[] = [];
  const allergens = recipe.allergens || [];
  const diet = recipe.diet || {};
  const spicy = recipe.spicy || { level: 0, optional: false };
  const cookware = recipe.cookware || [];
  const allText = [
    recipe.name,
    ...recipe.main_ingredients.map((i) => i.name),
    ...recipe.special_seasonings,
  ].join(" ");

  for (const c of constraints) {
    if (c === "不吃辣") {
      if (spicy.level > 0 && !spicy.optional) {
        reasons.push("默认含辣/辣椒调料");
      } else if (/(豆瓣酱|剁椒|泡椒|辣椒油|干辣椒)/.test(allText) && !spicy.optional) {
        reasons.push("含辣味酱料");
      }
    }

    if (c === "花生过敏") {
      if (allergens.includes("花生") || allText.includes("花生")) {
        reasons.push("含过敏原：花生");
      }
    }

    if (c === "海鲜过敏") {
      const hit = allergens.filter((a) => ["甲壳类", "贝类", "鱼类"].includes(a));
      if (hit.length > 0) {
        reasons.push(`含海鲜/水产（${hit.join("/")}）`);
      }
    }

    if (c === "无蛋") {
      if (allergens.includes("蛋")) {
        reasons.push("含过敏原：鸡蛋");
      }
    }

    if (c === "清真") {
      if (diet.pork === "contains") {
        reasons.push("含猪肉成分");
      } else if (diet.alcohol === "contains" || allergens.includes("酒精")) {
        reasons.push("含料酒/酒精");
      }
    }

    if (c === "全素") {
      if (diet.vegan === "no") {
        reasons.push("含肉/蛋/海鲜或动物性调料");
      }
    }

    if (c === "免明火/电饭煲") {
      const noFlameTools = ["电饭煲", "微波炉", "空气炸锅", "无需开火"];
      const canNoFlame = cookware.some((tool) => noFlameTools.includes(tool));
      if (!canNoFlame) {
        reasons.push(`需明火厨具（${cookware.join("/") || "炒锅"}）`);
      }
    }
  }

  return reasons;
}

function scoreRecipe(recipe: Recipe, userInput: string, terms: string[]): number {
  let score = 0;
  const ingText = recipe.main_ingredients.map((i) => i.name).join(" ");

  if (userInput.includes(recipe.name)) {
    score += 10;
  }

  for (const term of terms) {
    if (term.length < 1) continue;
    if (recipe.name.includes(term)) score += 4;
    if (ingText.includes(term)) score += 3;
    if (recipe.tags.some((t) => t.includes(term))) score += 1;
  }

  if (recipe.prep_time_min <= 15) score += 0.5;
  return score;
}

export interface CandidateSelectionResult {
  candidates: Recipe[];
  safetyReport: SafetyReport;
}

/**
 * Deterministic safety hard-filter + relevance ranking over the structured recipe KB.
 */
export function selectCandidateRecipesWithSafety(
  userInput: string,
  selectedConstraints: string[] = [],
  limit = 18
): CandidateSelectionResult {
  const db = loadRecipeDatabase();
  const terms = expandQueryTerms(userInput);
  const activeConstraints = normalizeConstraints(selectedConstraints, userInput);

  const passed: Array<{ recipe: Recipe; score: number }> = [];
  const excluded: Array<{ info: ExcludedRecipeInfo; score: number }> = [];

  for (const recipe of db.recipes) {
    const score = scoreRecipe(recipe, userInput, terms);
    if (activeConstraints.length > 0) {
      const reasons = getExclusionReasons(recipe, activeConstraints);
      if (reasons.length > 0) {
        excluded.push({
          info: {
            recipeName: recipe.name,
            reason: reasons.join("；"),
          },
          score,
        });
        continue;
      }
    }
    passed.push({ recipe, score });
  }

  passed.sort((a, b) => b.score - a.score);
  // Prioritize excluded dishes that were most relevant to user's ingredients so the demo feels sharp
  excluded.sort((a, b) => b.score - a.score);

  return {
    candidates: passed.slice(0, limit).map((item) => item.recipe),
    safetyReport: {
      totalScanned: db.recipes.length,
      passedCount: passed.length,
      excludedCount: excluded.length,
      activeConstraints,
      excludedSamples: excluded.slice(0, 5).map((item) => item.info),
    },
  };
}
