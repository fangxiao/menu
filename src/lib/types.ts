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

export interface MenuResponse {
  assessment: {
    sufficient: boolean;
    servings: number;
    summary: string;
  };
  plans: MenuPlan[];
  leftoverTip?: string;
}
