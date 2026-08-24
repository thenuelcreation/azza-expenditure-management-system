import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Download, LayoutDashboard, LogIn, Menu, Pencil, Plus, Search, Settings, Trash2, Wallet, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import './App.css'
import './responsive.css'

type Expenditure = {
  id: number
  date: string
  category: string
  subcategory: string
  amount: number
  currency: string
  paymentMethod: string
  description: string
}

const categories: Record<string, string[]> = {
  'AZZA Operations': ['Legal Costs', 'Contract', 'Transport'],
  'AZZA Costs': ['Figma Subscriptions/Payments', 'Agents/AI', 'KYC Tools', 'Server Costs'],
  'Office Operations': ['Electricity Bill', 'Water (Buying Cway)', 'Cleaning', 'Starlink Subscription', 'Food'],
  Salaries: ['Salary-related expenditure'],
}

const initialRecords: Expenditure[] = [
  { id: 1, date: '2026-08-20', category: 'Office Operations', subcategory: 'Food', amount: 15000, currency: 'NGN', paymentMethod: 'Transfer', description: 'Team lunch' },
  { id: 2, date: '2026-08-19', category: 'AZZA Costs', subcategory: 'Figma Subscriptions/Payments', amount: 25000, currency: 'NGN', paymentMethod: 'Card', description: 'Monthly design tools' },
  { id: 3, date: '2026-08-18', category: 'AZZA Operations', subcategory: 'Transport', amount: 8000, currency: 'NGN', paymentMethod: 'Cash', description: 'Client meeting' },
]

const blankForm = () => ({ date: new Date().toISOString().slice(0, 10), category: '', subcategory: '', amount: '', currency: 'NGN', paymentMethod: 'Transfer', description: '' })
const API_URL = import.meta.env.VITE_API_URL ?? ''

function Home({ onLogin, onFoundation }: { onLogin: () => void; onFoundation: () => void }) {
  return <div className="home-screen"><header className="home-header"><div className="brand home-brand"><span className="brand-mark">A</span><span>AZZA</span></div><button className="home-login" onClick={onLogin}><LogIn size={15} /> Log in</button></header><main className="home-hero"><p className="eyebrow">AZZA EXPENDITURE MANAGEMENT</p><h1>AZZA Expenses</h1><p className="home-statement">A simpler way to capture every expense, keep your records clear, and stay ready for what comes next.</p><button className="foundation-cta" onClick={onFoundation}>AZZA Foundation <ArrowRight size={17} /></button><p className="home-note">Built for focused teams that want to spend less time managing spreadsheets.</p></main><footer className="home-footer">QUICK CAPTURE · CLEAR RECORDS · CONFIDENT DECISIONS</footer></div>
}

function Auth({ mode, onModeChange, onBack, onSuccess }: { mode: 'login' | 'signup'; onModeChange: (mode: 'login' | 'signup') => void; onBack: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (mode === 'signup' && !name.trim()) return setError('Please enter your name.')
    if (!email.includes('@')) return setError('Please enter a valid email address.')
    if (mode === 'signup' && password !== confirmPassword) return setError('Passwords do not match.')
    setError('')
    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_URL}/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name, email, password }) })
      const result = await response.json() as { error?: string }
      if (!response.ok) return setError(result.error ?? 'Authentication failed. Please try again.')
      onSuccess()
    } catch {
      setError('The authentication service is unavailable. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  return <div className="auth-screen"><section className="auth-panel"><button className="auth-back" onClick={onBack} aria-label="Back to home" title="Back to home"><ArrowLeft size={20} /></button><div className="brand auth-brand"><span className="brand-mark">A</span><span>AZZA</span></div><div className="auth-copy"><p className="eyebrow">WELCOME BACK</p><h1>{mode === 'login' ? 'Your expenses, in order.' : 'Start with a clearer view.'}</h1><p>{mode === 'login' ? 'Sign in to continue to your AZZA workspace.' : 'Create your AZZA workspace and begin recording expenses in seconds.'}</p></div><form className="auth-form" onSubmit={submit}>{mode === 'signup' && <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Sarah Adams" /></label>}<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? '12+ chars, upper/lowercase, number, symbol' : 'Your password'} /></label>{mode === 'signup' && <label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password" /></label>}{error && <p className="auth-error">{error}</p>}<button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'} {!isSubmitting && <ArrowRight size={16} />}</button></form><p className="auth-switch">{mode === 'login' ? 'New to AZZA?' : 'Already have an account?'} <button onClick={() => { setError(''); onModeChange(mode === 'login' ? 'signup' : 'login') }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p></section><aside className="auth-aside"><span className="auth-aside-mark">A</span><h2>Record it now.<br />Find it later.</h2><p>AZZA keeps the everyday work of expenditure management light, structured, and ready for your next decision.</p></aside></div>
}

function App() {
  const [screen, setScreen] = useState<'home' | 'login' | 'app'>(() => localStorage.getItem('azza-auth') === 'true' ? 'app' : 'home')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [records, setRecords] = useState<Expenditure[]>(() => {
    const saved = localStorage.getItem('azza-expenditures')
    return saved ? JSON.parse(saved) : initialRecords
  })
  const [view, setView] = useState<'dashboard' | 'expenditures' | 'settings'>('dashboard')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(blankForm)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [notice, setNotice] = useState('')
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => localStorage.setItem('azza-expenditures', JSON.stringify(records)), [records])

  const filteredRecords = useMemo(() => records.filter((record) => {
    const matchesQuery = `${record.category} ${record.subcategory} ${record.description}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (categoryFilter === 'All categories' || record.category === categoryFilter)
  }), [records, query, categoryFilter])

  const total = records.reduce((sum, record) => sum + record.amount, 0)
  const monthTotal = records.filter((record) => record.date.startsWith('2026-08')).reduce((sum, record) => sum + record.amount, 0)
  const formatMoney = (amount: number) => amount.toLocaleString('en-NG')

  const openNew = () => { setEditingId(null); setForm(blankForm()); setModalOpen(true) }
  const openEdit = (record: Expenditure) => { setEditingId(record.id); setForm({ ...record, amount: String(record.amount) }); setModalOpen(true) }
  const closeModal = () => setModalOpen(false)

  const saveRecord = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.date || !form.category || !form.subcategory || !form.amount || Number(form.amount) <= 0) return setNotice('Please complete all required fields with a valid amount.')
    const record = { ...form, amount: Number(form.amount), id: editingId ?? Date.now() }
    setRecords((current) => editingId ? current.map((item) => item.id === editingId ? record : item) : [record, ...current])
    setNotice(editingId ? 'Expenditure updated successfully.' : 'Expenditure saved successfully.')
    closeModal()
    setView('expenditures')
    window.setTimeout(() => setNotice(''), 3500)
  }

  const deleteRecord = (id: number) => {
    if (window.confirm('Are you sure you want to delete this expenditure?')) setRecords((current) => current.filter((record) => record.id !== id))
  }

  const exportRecords = () => {
    const rows = records.map(({ date, category, subcategory, amount, currency, paymentMethod, description }) => ({ Date: date, Category: category, 'Sub-category': subcategory, Amount: amount, Currency: currency, 'Mode of Payment': paymentMethod, Description: description }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Expenditures')
    XLSX.writeFile(workbook, 'AZZA_Expenditure.xlsx')
  }

  if (screen === 'home') return <Home onLogin={() => { setAuthMode('login'); setScreen('login') }} onFoundation={() => { setAuthMode('signup'); setScreen('login') }} />
  if (screen === 'login') return <Auth mode={authMode} onModeChange={setAuthMode} onBack={() => setScreen('home')} onSuccess={() => { localStorage.setItem('azza-auth', 'true'); setScreen('app') }} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-mark">A</span><span>AZZA</span></div>
        <nav>
          <button className={view === 'dashboard' ? 'nav-active' : ''} onClick={() => { setView('dashboard'); setMobileNav(false) }}><LayoutDashboard size={17} /> Dashboard</button>
          <button className={view === 'expenditures' ? 'nav-active' : ''} onClick={() => { setView('expenditures'); setMobileNav(false) }}><Wallet size={17} /> Expenditures</button>
          <button className={view === 'settings' ? 'nav-active' : ''} onClick={() => { setView('settings'); setMobileNav(false) }}><Settings size={17} /> Settings</button>
        </nav>
        <div className="sidebar-footer"><div className="avatar">SA</div><div><strong>Sarah Adams</strong><small>Administrator</small></div><button className="logout-icon" onClick={() => { localStorage.removeItem('azza-auth'); setScreen('home') }} aria-label="Log out"><LogIn size={15} /></button></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label={mobileNav ? 'Close navigation' : 'Open navigation'}>{mobileNav ? <X size={20} /> : <Menu size={20} />}</button><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{view === 'dashboard' ? 'Dashboard' : view === 'expenditures' ? 'Expenditures' : 'Settings'}</strong></div><button className="top-profile" onClick={() => { setView('settings'); setMobileNav(false) }} aria-label="Open profile"><span className="avatar small">SA</span><span className="desktop-only">Sarah Adams</span></button></header>
        {notice && <div className="toast">{notice}</div>}

        {view === 'dashboard' && <Dashboard total={total} monthTotal={monthTotal} records={records} formatMoney={formatMoney} onAdd={openNew} onView={() => setView('expenditures')} onExport={exportRecords} />}
        {view === 'expenditures' && <section className="page"><div className="page-heading"><div><p className="eyebrow">RECORDS</p><h1>Expenditures</h1><p>Review, update and export your expenditure history.</p></div><button className="primary-button" onClick={openNew}><Plus size={17} /> Add expenditure</button></div><div className="toolbar"><label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" /></label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All categories</option>{Object.keys(categories).map((category) => <option key={category}>{category}</option>)}</select><button className="outline-button" onClick={exportRecords}><Download size={16} /> Export Excel</button></div><RecordsTable records={filteredRecords} formatMoney={formatMoney} onEdit={openEdit} onDelete={deleteRecord} /></section>}
        {view === 'settings' && <section className="page"><div className="page-heading"><div><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p>Manage your workspace preferences.</p></div></div><div className="settings-panel"><h2>Profile</h2><p>These details appear on your AZZA workspace.</p><label>Full name<input defaultValue="Sarah Adams" /></label><label>Email address<input defaultValue="sarah@azza.com" type="email" /></label><button className="primary-button">Save changes</button></div></section>}
      </main>
      {modalOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}><form className="modal" onSubmit={saveRecord}><div className="modal-heading"><div><p className="eyebrow">{editingId ? 'UPDATE RECORD' : 'NEW RECORD'}</p><h2>{editingId ? 'Edit expenditure' : 'Add expenditure'}</h2></div><button type="button" className="icon-button" onClick={closeModal} aria-label="Close"><X size={19} /></button></div><div className="form-grid"><label>Date *<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label>Amount *<input type="number" min="1" step="0.01" placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label>Category *<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value, subcategory: '' })}><option value="">Select category</option>{Object.keys(categories).map((category) => <option key={category}>{category}</option>)}</select></label><label>Sub-category *<select value={form.subcategory} disabled={!form.category} onChange={(event) => setForm({ ...form, subcategory: event.target.value })}><option value="">Select sub-category</option>{(categories[form.category] ?? []).map((subcategory) => <option key={subcategory}>{subcategory}</option>)}</select></label><label>Currency<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option>NGN</option><option>USD</option><option>GBP</option></select></label><label>Mode of payment<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}><option>Transfer</option><option>Card</option><option>Cash</option><option>Direct debit</option></select></label><label className="full-width">Description <input value={form.description} placeholder="What was this expenditure for?" onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div>{notice && <p className="form-error">{notice}</p>}<div className="modal-actions"><button type="button" className="outline-button" onClick={closeModal}>Cancel</button><button type="submit" className="primary-button">{editingId ? 'Save changes' : 'Save expenditure'}</button></div></form></div>}
    </div>
  )
}

function Dashboard({ total, monthTotal, records, formatMoney, onAdd, onView, onExport }: { total: number; monthTotal: number; records: Expenditure[]; formatMoney: (amount: number) => string; onAdd: () => void; onView: () => void; onExport: () => void }) {
  return <section className="page dashboard"><div className="page-heading"><div><p className="eyebrow">MONDAY, 24 AUGUST 2026</p><h1>Good morning, Sarah<span>.</span></h1><p>Here’s what’s happening with your organization’s finances.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> New expenditure</button></div><div className="stat-grid"><div className="stat-card accent"><span>Total expenditure</span><strong>{formatMoney(total)}</strong><small>Across all recorded transactions</small></div><div className="stat-card"><span>This month</span><strong>{formatMoney(monthTotal)}</strong><small>August 2026</small></div><div className="stat-card"><span>Transactions</span><strong>{records.length}</strong><small>Recorded expenditures</small></div></div><div className="content-grid"><div className="panel"><div className="panel-heading"><div><h2>Recent expenditures</h2><p>Your latest recorded transactions</p></div><button className="text-button" onClick={onView}>View all</button></div><RecordsTable records={records.slice(0, 4)} formatMoney={formatMoney} compact /></div><div className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Keep your records up to date</p></div></div><button onClick={onAdd}><Plus size={18} /><span><b>Add expenditure</b><small>Record a new transaction</small></span></button><button onClick={onView}><Wallet size={18} /><span><b>View expenditures</b><small>Search your history</small></span></button><button onClick={onExport}><Download size={18} /><span><b>Export to Excel</b><small>Download all records</small></span></button></div></div></section>
}

function RecordsTable({ records, formatMoney, onEdit, onDelete, compact = false }: { records: Expenditure[]; formatMoney: (amount: number) => string; onEdit?: (record: Expenditure) => void; onDelete?: (id: number) => void; compact?: boolean }) {
  return <div className="table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Payment</th>{!compact && <th aria-label="Actions" />}</tr></thead><tbody>{records.length === 0 ? <tr><td colSpan={5} className="empty">No expenditures found.</td></tr> : records.map((record) => <tr key={record.id}><td>{new Date(`${record.date}T12:00:00`).toLocaleDateString('en-GB')}</td><td><div className="merchant"><strong>{record.subcategory}</strong><small>{record.category}</small></div></td><td className="amount">{formatMoney(record.amount)} <small>{record.currency}</small></td><td><span className="pill">{record.paymentMethod}</span></td>{!compact && <td className="actions"><button onClick={() => onEdit?.(record)} aria-label="Edit"><Pencil size={15} /></button><button onClick={() => onDelete?.(record.id)} aria-label="Delete"><Trash2 size={15} /></button></td>}</tr>)}</tbody></table></div>
}

export default App
