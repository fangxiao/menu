export interface ShoppingItem {
  name: string;
  amount: string;
}

export interface DishItem {
  name: string;
  timeMin: number;
  ingredientsText: string;
  steps: string[];
}

export interface MenuPlan {
  id: string;
  title: string;
  badge: string;
  totalTimeMin: number;
  reason: string;
  dishes: DishItem[];
  shoppingList?: {
    main: ShoppingItem[];
    aromatics: ShoppingItem[];
  };
}

export interface ExcludedRecipeInfo {
  recipeName: string;
  reason: string;
}

export interface SafetyReport {
  totalScanned: number;
  passedCount: number;
  excludedCount: number;
  activeConstraints: string[];
  excludedSamples: ExcludedRecipeInfo[];
}

export interface ValueSummary {
  usedInventoryCount: number;
  toBuyCount: number;
  estimatedSavedYuan: number;
  highlight: string;
}

export interface MenuResponse {
  assessment: {
    sufficient: boolean;
    servings: number;
    summary: string;
  };
  plans: MenuPlan[];
  leftoverTip?: string;
  safetyReport?: SafetyReport;
  valueSummary?: ValueSummary;
  adjustmentNote?: string;
  isDemoFallback?: boolean;
}
