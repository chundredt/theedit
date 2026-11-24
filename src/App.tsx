import { useState, type ComponentType } from 'react';
import {
  LayoutDashboard, Wallet, ReceiptText, PiggyBank, BarChart3, ShoppingBasket, CalendarDays, ChefHat,
  ListChecks, Archive, Tags, Settings as SettingsIcon, Plus, MoreHorizontal, AlertTriangle,
} from 'lucide-react';
import { go, useRoute, useUI, type Route } from './lib/ui-state';
import { useStore } from './data/store';
import { Modal, Toasts } from './components/ui';
import { TransactionForm } from './components/TransactionForm';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './pages/Dashboard';
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
const MONEY: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, page: Dashboard },
  { route: 'budget', label: 'Budget', icon: Wallet, page: BudgetPage },
  { route: 'transactions', label: 'Transactions', icon: ReceiptText, page: TransactionsPage },
  { route: 'savings', label: 'Savings goals', icon: PiggyBank, page: SavingsPage },
  { route: 'reports', label: 'Reports', icon: BarChart3, page: ReportsPage },
];
const FOOD: NavItem[] = [
  { route: 'groceries', label: 'Grocery budget', icon: ShoppingBasket, page: GroceriesPage },
  { route: 'meals', label: 'Meal planner', icon: CalendarDays, page: MealPlanPage },
  { route: 'recipes', label: 'Recipes', icon: ChefHat, page: RecipesPage },
  { route: 'shopping', label: 'Shopping list', icon: ListChecks, page: ShoppingPage },
  { route: 'pantry', label: 'Pantry', icon: Archive, page: PantryPage },
  { route: 'prices', label: 'Prices & specials', icon: Tags, page: PricesPage },
];
const SETTINGS: NavItem = { route: 'preferences', label: 'Settings & data', icon: SettingsIcon, page: SettingsPage };
const ALL = [...MONEY, ...FOOD, SETTINGS];

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">R</div>
      <div className="brand-name">RandWise</div>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const onboarded = useStore((s) => s.data.settings.onboarded);
  const saveError = useStore((s) => s.saveError);
  const { addOpen, setAddOpen } = useUI();
  const [more, setMore] = useState(false);
  const current = ALL.find((n) => n.route === route) || MONEY[0];
  const Page = current.page;
  const link = (n: NavItem) => (
    <a key={n.route} href={`#${n.route}`} className={`nav-link ${route === n.route ? 'active' : ''}`} aria-current={route === n.route ? 'page' : undefined}>
      <n.icon /> {n.label}
    </a>
  );

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Main navigation">
        <Brand />
        <button className="btn primary" style={{ margin: '0 4px 8px' }} onClick={() => setAddOpen(true)}><Plus /> Add expense</button>
        <div className="nav-group">Money</div>
        {MONEY.map(link)}
        <div className="nav-group">Food & groceries</div>
        {FOOD.map(link)}
        <div className="sidebar-foot">{link(SETTINGS)}</div>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header className="mobile-top">
          <Brand />
          <button className="btn ghost icon" onClick={() => go('preferences')} aria-label="Settings"><SettingsIcon /></button>
        </header>
        <main className="main">
          {saveError && (
            <div className="banner danger" style={{ marginBottom: 16 }}>
              <AlertTriangle /> <div>Your browser isn't letting RandWise save (private mode or storage full). Changes will be lost when you close this tab — export a backup from Settings.</div>
            </div>
          )}
          <Page key={route} />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {[MONEY[0], MONEY[1]].map((n) => (
          <button key={n.route} className={route === n.route ? 'active' : ''} onClick={() => go(n.route)}><n.icon />{n.label === 'Dashboard' ? 'Home' : n.label}</button>
        ))}
        <button onClick={() => setAddOpen(true)} aria-label="Add expense"><span className="add"><Plus /></span></button>
        <button className={FOOD.some((f) => f.route === route) ? 'active' : ''} onClick={() => go('groceries')}><ShoppingBasket />Food</button>
        <button onClick={() => setMore(true)}><MoreHorizontal />More</button>
      </nav>

      {more && (
        <Modal title="Go to" onClose={() => setMore(false)}>
          <div className="sheet-nav">
            {ALL.map((n) => (
              <button key={n.route} className={route === n.route ? 'active' : ''} onClick={() => { go(n.route); setMore(false); }}>
                <n.icon />{n.label}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {addOpen && <TransactionForm onClose={() => setAddOpen(false)} />}
      {!onboarded && <Onboarding />}
      <Toasts />
    </div>
  );
}
