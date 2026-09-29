// Mirror of the local PostgreSQL schema in db/. Single user, so no row carries
// an owner column and there is nothing to authenticate against.

export type AccountType =
  | 'general' | 'cash' | 'current' | 'credit_card' | 'savings'
  | 'investment' | 'loan' | 'mobile_wallet' | 'overdraft' | 'insurance'

export type CategoryKind = 'income' | 'expense'
export type TxnType = 'income' | 'expense' | 'transfer'
export type TxnStatus = 'cleared' | 'pending' | 'void'
export type BudgetPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one_time'
export type RecurrenceFreq = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
export type DebtKind = 'lent' | 'borrowed'

export interface Currency {
  code: string
  name: string
  symbol: string
  decimal_digits: number
}

export interface Profile {
  id: number
  display_name: string | null
  base_currency: string
  locale: string
  week_starts_on: number
  month_starts_on: number
  theme: 'light' | 'dark' | 'system'
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  name: string
  type: AccountType
  currency_code: string
  initial_balance_minor: number
  credit_limit_minor: number | null
  color: string
  icon: string
  note: string | null
  exclude_from_stats: boolean
  archived: boolean
  position: number
  created_at: string
  updated_at: string
}

export interface AccountBalance {
  account_id: string
  currency_code: string
  initial_balance_minor: number
  balance_minor: number
  cleared_balance_minor: number
  pending_minor: number
  transaction_count: number
  last_activity_on: string | null
}

export type AccountWithBalance = Account & { balance: AccountBalance | null }

export interface Category {
  id: string
  parent_id: string | null
  name: string
  kind: CategoryKind
  color: string
  icon: string
  is_system: boolean
  archived: boolean
  position: number
  created_at: string
  updated_at: string
}

export type CategoryNode = Category & { children: Category[] }

export interface Label {
  id: string
  name: string
  color: string
  created_at: string
}

export interface Transaction {
  id: string
  type: TxnType
  account_id: string
  transfer_account_id: string | null
  category_id: string | null
  amount_minor: number
  currency_code: string
  transfer_amount_minor: number | null
  occurred_on: string
  payee: string | null
  note: string | null
  status: TxnStatus
  attachment_path: string | null
  recurring_rule_id: string | null
  debt_id: string | null
  goal_id: string | null
  import_hash: string | null
  created_at: string
  updated_at: string
}

export type TransactionRow = Transaction & {
  account: Pick<Account, 'id' | 'name' | 'color' | 'icon' | 'currency_code'> | null
  transfer_account: Pick<Account, 'id' | 'name' | 'color' | 'icon' | 'currency_code'> | null
  category: Pick<Category, 'id' | 'name' | 'color' | 'icon' | 'parent_id'> | null
}

export interface Budget {
  id: string
  name: string
  amount_minor: number
  currency_code: string
  period: BudgetPeriod
  starts_on: string
  ends_on: string | null
  rollover: boolean
  color: string
  archived: boolean
  created_at: string
  updated_at: string
}

export interface BudgetProgress {
  budget_id: string
  name: string
  currency_code: string
  amount_minor: number
  spent_minor: number
  rollover_minor: number
  win_start: string
  win_end: string
  missing_rate: boolean
}

export interface Goal {
  id: string
  name: string
  target_minor: number
  currency_code: string
  account_id: string | null
  target_date: string | null
  color: string
  icon: string
  note: string | null
  achieved_at: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

export interface GoalContribution {
  id: string
  goal_id: string
  amount_minor: number
  occurred_on: string
  note: string | null
  transaction_id: string | null
  created_at: string
}

export interface Debt {
  id: string
  kind: DebtKind
  person_name: string
  amount_minor: number
  currency_code: string
  account_id: string | null
  occurred_on: string
  due_on: string | null
  note: string | null
  settled_at: string | null
  created_at: string
  updated_at: string
}

export interface DebtPayment {
  id: string
  debt_id: string
  amount_minor: number
  occurred_on: string
  note: string | null
  transaction_id: string | null
  created_at: string
}

export interface RecurringRule {
  id: string
  name: string
  type: TxnType
  account_id: string
  transfer_account_id: string | null
  category_id: string | null
  amount_minor: number
  currency_code: string
  payee: string | null
  note: string | null
  freq: RecurrenceFreq
  interval_count: number
  starts_on: string
  ends_on: string | null
  next_occurrence_on: string
  last_generated_on: string | null
  auto_create: boolean
  remind_days_before: number
  archived: boolean
  created_at: string
  updated_at: string
}

export interface ExchangeRate {
  id: string
  base_code: string
  quote_code: string
  rate: number
  as_of: string
  created_at: string
}

export interface CategoryTotal {
  category_id: string | null
  category_name: string
  color: string
  icon: string
  total_minor: number
  txn_count: number
}

export interface CashflowPoint {
  bucket_start: string
  income_minor: number
  expense_minor: number
  net_minor: number
}

export interface NetWorth {
  assets_minor: number
  liabilities_minor: number
  net_minor: number
  missing_rate: boolean
}
