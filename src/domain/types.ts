// Core domain types. Dates are ISO strings (YYYY-MM-DD) in storage and DD/MM/YYYY on screen.
// Money is stored as a number of Rand (2-decimal precision is enforced when saving).

export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type PeriodKey = string; // YYYY-MM (the month the budget period ends in)
export type WeekKey = ISODate; // Monday of the week

export type CategoryGroup = 'fixed' | 'variable' | 'savings';

export const PAYMENT_METHODS = [
  'Debit card',
  'Credit card',
  'Debit order',
  'EFT',
  'Cash',
  'Tap / mobile pay',
  'Store card',
  'Other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface Category {
  id: ID;
  name: string;
  group: CategoryGroup;
  color: string;
  /** Fixed costs: day of the month the payment goes off (1–31). */
  dueDay?: number;
  /** Fixed costs: how the payment is made (debit order, EFT…). */
  payMethod?: PaymentMethod;
  /** System role used to wire features together. */
  role?: 'groceries';
  archived?: boolean;
}

export type IncomeKind = 'salary' | 'commission' | 'allowance' | 'other';
export const INCOME_KINDS: { value: IncomeKind; label: string; hint: string }[] = [
  { value: 'salary', label: 'Salary', hint: 'Fixed take-home pay' },
  { value: 'commission', label: 'Commission', hint: 'Varies month to month' },
  { value: 'allowance', label: 'Allowance', hint: 'Car, travel, cellphone…' },
  { value: 'other', label: 'Other', hint: 'Side income, rental, refunds' },
];

export interface IncomeLine {
  id: ID;
  name: string;
  /** Expected (planned) amount after tax. */
  amount: number;
  kind?: IncomeKind;
  /** Day of the month it is paid into your account. */
  payDay?: number;
  /** Actual amount that arrived; undefined until marked received. */
  received?: number;
  receivedOn?: ISODate;
}

export interface Budget {
  period: PeriodKey;
  income: IncomeLine[];
  allocations: Record<ID, number>;
  /** When this month's budget was first saved; pay days before this aren't flagged as late. */
  createdOn?: ISODate;
}

export interface Transaction {
  id: ID;
  date: ISODate;
  description: string;
  amount: number;
  categoryId: ID;
  method: PaymentMethod;
  notes?: string;
  goalId?: ID;
  storeId?: ID;
  /** Spending paid out of a savings pot (a yearly cost) — not counted against this month's budget categories. */
  fundedBy?: ID;
  createdAt: string;
}

export interface SavingsGoal {
  id: ID;
  name: string;
  target: number;
  /** Money already saved before tracking started in the app. */
  openingBalance: number;
  targetDate: ISODate;
  monthlyContribution: number;
  categoryId?: ID;
  color: string;
  createdAt: string;
  /** A yearly cost (car licence, Christmas…) rather than a one-off goal. */
  kind?: 'goal' | 'yearly';
  /** Yearly costs roll their due date forward a year once paid. */
  repeats?: boolean;
  emoji?: string;
}

export interface Store {
  id: ID;
  name: string;
  color: string;
  website?: string;
}

export type ProductCategory =
  | 'Meat & fish'
  | 'Dairy & eggs'
  | 'Fruit & veg'
  | 'Bakery'
  | 'Pantry staples'
  | 'Tins & jars'
  | 'Frozen'
  | 'Spices & sauces'
  | 'Snacks'
  | 'Drinks'
  | 'Household'
  | 'Other';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Meat & fish', 'Dairy & eggs', 'Fruit & veg', 'Bakery', 'Pantry staples', 'Tins & jars',
  'Frozen', 'Spices & sauces', 'Snacks', 'Drinks', 'Household', 'Other',
];

export type DietTag = 'meat' | 'pork' | 'fish' | 'dairy' | 'egg' | 'gluten';

export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Product {
  id: ID;
  name: string;
  category: ProductCategory;
  /** Typical pack size in grams (or ml). */
  packSize: number;
  /** Per 100 g. Optional for non-food products. */
  nutrition?: Nutrition;
  tags: DietTag[];
  /** For countable items (eggs, onions): grams per piece and its label. */
  pieceGrams?: number;
  pieceLabel?: string;
}

export type PriceSource = 'manual' | 'flyer' | 'catalogue' | 'sample' | 'receipt';

export interface PriceRecord {
  id: ID;
  productId: ID;
  storeId: ID;
  price: number;
  packSize: number;
  isSpecial: boolean;
  specialEnds?: ISODate;
  /** Regular price when this record is a special (to show the saving). */
  wasPrice?: number;
  verifiedOn: ISODate;
  source: PriceSource;
  label?: string;
}

export interface Catalogue {
  id: ID;
  storeId: ID;
  title: string;
  url?: string;
  validFrom?: ISODate;
  validTo?: ISODate;
  addedOn: ISODate;
  itemCount: number;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface Ingredient {
  productId: ID;
  grams: number;
}

export interface Recipe {
  id: ID;
  name: string;
  image?: string; // data URL or https URL
  emoji: string;
  mealTypes: MealType[];
  servings: number;
  prepMinutes: number;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  custom?: boolean;
}

export interface MealSlot {
  recipeId: ID;
  servings: number;
}

/** days[0] = Monday. */
export interface MealPlanWeek {
  week: WeekKey;
  days: Partial<Record<MealType, MealSlot>>[];
}

export interface ShoppingState {
  week: WeekKey;
  checked: ID[];
  storeOverride: Record<ID, ID>;
  extras: { id: ID; name: string; checked: boolean }[];
  completedOn?: ISODate;
}

export interface PantryItem {
  id: ID;
  productId: ID;
  quantity: number; // grams / ml
  expiry?: ISODate;
  addedOn: ISODate;
}

export type Diet = 'none' | 'vegetarian' | 'pescatarian' | 'no-pork';

export interface Settings {
  name: string;
  periodStartDay: number;
  householdSize: number;
  diet: Diet;
  dairyFree: boolean;
  glutenFree: boolean;
  excludedProducts: ID[];
  kcalTarget: number;
  proteinTarget: number;
  preferredStores: ID[];
  onboarded: boolean;
}

export interface AppData {
  version: number;
  settings: Settings;
  categories: Category[];
  budgets: Record<PeriodKey, Budget>;
  transactions: Transaction[];
  goals: SavingsGoal[];
  stores: Store[];
  products: Product[];
  prices: PriceRecord[];
  catalogues: Catalogue[];
  recipes: Recipe[];
  mealPlans: Record<WeekKey, MealPlanWeek>;
  shopping: Record<WeekKey, ShoppingState>;
  pantry: PantryItem[];
  habits: Habit[];
  /** date → habitId → count done that day (1 for a simple yes/no habit). */
  habitLogs: Record<ISODate, Record<ID, number>>;
  routines: Routine[];
  /** Weekday (0 = Monday … 6 = Sunday) → routine planned for that day. */
  workoutSchedule: Record<number, ID | undefined>;
  workoutLogs: WorkoutLog[];
  /** Weekly reset check-ins, keyed by the Monday of the week being planned. */
  resets: Record<WeekKey, WeeklyReset>;
}

export interface WeeklyReset {
  week: WeekKey;
  completedOn: ISODate;
  focus?: string;
}

export type PastelColor = 'lavender' | 'coral' | 'periwinkle' | 'pink' | 'mint' | 'butter' | 'sky';
export const PASTELS: PastelColor[] = ['lavender', 'coral', 'periwinkle', 'pink', 'mint', 'butter', 'sky'];

export interface Habit {
  id: ID;
  name: string;
  emoji: string;
  color: PastelColor;
  /** Weekdays it applies to (0 = Monday … 6 = Sunday). Empty = every day. */
  days: number[];
  /** Times per day for counted habits (e.g. 8 glasses of water); 1 = simple tick. */
  target: number;
  unit?: string;
  createdAt: ISODate;
  archived?: boolean;
}

export type WorkoutKind = 'strength' | 'cardio' | 'mobility' | 'class';

export interface Exercise {
  name: string;
  sets?: number;
  reps?: string; // "10" or "8–12"
  weight?: number; // kg
  minutes?: number;
}

export interface Routine {
  id: ID;
  name: string;
  emoji: string;
  color: PastelColor;
  kind: WorkoutKind;
  minutes: number;
  exercises: Exercise[];
}

export interface WorkoutLog {
  id: ID;
  date: ISODate;
  routineId?: ID;
  name: string;
  kind: WorkoutKind;
  minutes: number;
  /** Indexes of exercises completed. */
  done: number[];
  effort?: 1 | 2 | 3; // easy / medium / hard
  notes?: string;
}
