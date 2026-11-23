import fs from "node:fs";
import path from "node:path";

export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
  grams: number;
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

/**
 * Select top relevant recipes from the 50-recipe KB based on ingredient & dish-name overlap,
 * plus a few versatile fallback dishes so the LLM always has balanced options.
 */
export function selectCandidateRecipes(userInput: string, limit = 18): Recipe[] {
  const db = loadRecipeDatabase();
  const terms = expandQueryTerms(userInput);

  const scored = db.recipes.map((recipe) => {
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

    // Slight boost for quick, versatile staples
    if (recipe.prep_time_min <= 15) score += 0.5;
    return { recipe, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.recipe);
}
