import { useState, type ComponentType } from 'react';
import {
  LayoutDashboard, Wallet, ReceiptText, PiggyBank, BarChart3, ShoppingBasket, CalendarDays, ChefHat,
  ListChecks, Archive, Tags, Settings as SettingsIcon, Plus, User, AlertTriangle, Sun, Dumbbell, Sparkles, RefreshCcw, Eye, EyeOff,
} from 'lucide-react';
import { go, useRoute, useUI, type Route } from './lib/ui-state';
import { useStore } from './data/store';
import { usePrivacy } from './lib/privacy';
import { Toasts } from './components/ui';
import { TransactionForm } from './components/TransactionForm';
import { Onboarding } from './components/Onboarding';
import { QuickAdd } from './components/QuickAdd';
import { Dashboard } from './pages/Dashboard';
import { TodayPage } from './pages/Today';
import { ResetPage } from './pages/Reset';
import { HabitsPage } from './pages/Habits';
import { WorkoutsPage } from './pages/Workouts';
import { BudgetPage } from './pages/Budget';
import { TransactionsPage } from './pages/Transactions';
import { GroceriesPage } from './pages/Groceries';
import { SettingsPage } from './pages/Settings';
import { SavingsPage } from './pages/Savings';
import { ReportsPage } from './pages/Reports';
import { MealPlanPage } from './pages/MealPlan';
import { RecipesPage } from './pages/Recipes';
import { ShoppingPage } from './pages/Shopping';
import { PantryPage } from './pages/Pantry';
import { PricesPage } from './pages/Prices';

interface NavItem { route: Route; label: string; icon: ComponentType<{ className?: string }>; page: ComponentType }
interface Tab { id: string; label: string; icon: ComponentType<{ className?: string }>; sections: NavItem[] }
/** Four tabs. Each tab's sections show as a row of pills at the top of the page. */
const TABS: Tab[] = [
  { id: 'today', label: 'Today', icon: Sun, sections: [{ route: 'today', label: 'Today', icon: Sun, page: TodayPage }] },
  { id: 'money', label: 'Money', icon: Wallet, sections: [
    { route: 'dashboard', label: 'Overview', icon: LayoutDashboard, page: Dashboard },
    { route: 'budget', label: 'Budget', icon: Wallet, page: BudgetPage },
    { route: 'transactions', label: 'Spending', icon: ReceiptText, page: TransactionsPage },
    { route: 'savings', label: 'Savings', icon: PiggyBank, page: SavingsPage },
    { route: 'reports', label: 'Report', icon: BarChart3, page: ReportsPage },
  ] },
  { id: 'food', label: 'Food', icon: ChefHat, sections: [
    { route: 'meals', label: 'Meals', icon: CalendarDays, page: MealPlanPage },
    { route: 'shopping', label: 'Shopping', icon: ListChecks, page: ShoppingPage },
    { route: 'groceries', label: 'Grocery money', icon: ShoppingBasket, page: GroceriesPage },
    { route: 'recipes', label: 'Recipes', icon: ChefHat, page: RecipesPage },
    { route: 'pantry', label: 'Pantry', icon: Archive, page: PantryPage },
    { route: 'prices', label: 'Prices', icon: Tags, page: PricesPage },
  ] },
  { id: 'me', label: 'Me', icon: User, sections: [
    { route: 'habits', label: 'Habits', icon: Sparkles, page: HabitsPage },
    { route: 'workouts', label: 'Workouts', icon: Dumbbell, page: WorkoutsPage },
    { route: 'reset', label: 'Weekly reset', icon: RefreshCcw, page: ResetPage },
    { route: 'preferences', label: 'Settings', icon: SettingsIcon, page: SettingsPage },
  ] },
];
const tabOf = (r: Route) => TABS.find((t) => t.sections.some((x) => x.route === r)) || TABS[0];

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">E</div>
      <div className="brand-name">TheEdit</div>
    </div>
  );
}

function PrivacyButton() {
  const { hidden, setHidden } = usePrivacy();
  return (
    <button className="btn ghost icon" onClick={() => setHidden(!hidden)} aria-pressed={hidden} aria-label={hidden ? 'Show balances' : 'Hide balances'} title={hidden ? 'Show balances' : 'Hide balances'} data-testid="privacy-toggle">
      {hidden ? <EyeOff /> : <Eye />}
    </button>
  );
}

export default function App() {
  const route = useRoute();
  const onboarded = useStore((s) => s.data.settings.onboarded);
  const hidden = usePrivacy((s) => s.hidden);
  const saveError = useStore((s) => s.saveError);
  const { addOpen, setAddOpen } = useUI();
  const [quick, setQuick] = useState(false);
  const tab = tabOf(route);
  const current = tab.sections.find((n) => n.route === route) || tab.sections[0];
  const Page = current.page;
  return (
    <div className="app">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="row between" style={{ paddingRight: 4 }}><Brand /><PrivacyButton /></div>
        <button className="btn primary" style={{ margin: '0 4px 12px' }} onClick={() => setQuick(true)}><Plus /> Add</button>
        {TABS.map((t) => (
          <a key={t.id} href={`#${t.sections[0].route}`} className={`nav-link ${tab.id === t.id ? 'active' : ''}`} aria-current={tab.id === t.id ? 'page' : undefined}>
            <t.icon /> {t.label}
          </a>
        ))}
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header className="mobile-top">
          <Brand />
          <PrivacyButton />
        </header>
        <main className="main">
          {saveError && (
            <div className="banner danger" style={{ marginBottom: 16 }}>
              <AlertTriangle /> <div>Your browser isn't letting TheEdit save (private mode or storage full). Changes will be lost when you close this tab — export a backup from Settings.</div>
            </div>
          )}
          {tab.sections.length > 1 && (
            <nav className="subnav" aria-label={`${tab.label} sections`}>
              {tab.sections.map((n) => (
                <a key={n.route} href={`#${n.route}`} className={n.route === current.route ? 'on' : ''} aria-current={n.route === current.route ? 'page' : undefined}>{n.label}</a>
              ))}
            </nav>
          )}
          <Page key={`${route}-${hidden}`} />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {TABS.slice(0, 2).map((t) => <button key={t.id} className={tab.id === t.id ? 'active' : ''} aria-current={tab.id === t.id ? 'page' : undefined} onClick={() => go(t.sections[0].route)}><t.icon />{t.label}</button>)}
        <button onClick={() => setQuick(true)} aria-label="Add"><span className="add"><Plus /></span></button>
        {TABS.slice(2).map((t) => <button key={t.id} className={tab.id === t.id ? 'active' : ''} aria-current={tab.id === t.id ? 'page' : undefined} onClick={() => go(t.sections[0].route)}><t.icon />{t.label}</button>)}
      </nav>

      {addOpen && <TransactionForm onClose={() => setAddOpen(false)} />}
      {quick && <QuickAdd onClose={() => setQuick(false)} />}
      {!onboarded && <Onboarding />}
      <Toasts />
    </div>
  );
}
