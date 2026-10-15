import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Download,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogIn,
  Menu,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  getCurrentUser,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  signup,
  type User,
} from "./services/auth";
import {
  createExpenditure,
  deleteExpenditure,
  getExpenditures,
  updateExpenditure,
  type Expenditure,
} from "./services/expenditures";
import "./App.css";
import "./responsive.css";
import "./polish.css";

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete = "new-password",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  const inputId = useId();
  const [isVisible, setIsVisible] = useState(false);
  const toggleLabel = `${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`;

  return (
    <div className="password-field-group">
      <label htmlFor={inputId}>{label}</label>
      <span className="password-field">
        <input
          id={inputId}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          className="password-visibility"
          type="button"
          onClick={() => setIsVisible((visible) => !visible)}
          aria-label={toggleLabel}
          aria-pressed={isVisible}
        >
          {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </div>
  );
}

const categories: Record<string, string[]> = {
  "AZZA Operations": ["Legal Costs", "Contract", "Transport"],
  "AZZA Costs": [
    "Figma Subscriptions/Payments",
    "Agents/AI",
    "KYC Tools",
    "Server Costs",
  ],
  "Office Operations": [
    "Electricity Bill",
    "Water (Buying Cway)",
    "Cleaning",
    "Starlink Subscription",
    "Food",
  ],
  Salaries: ["Salary-related expenditure"],
};

const blankForm = () => ({
  date: new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10),
  category: "",
  subcategory: "",
  amount: "",
  currency: "NGN",
  paymentMethod: "Transfer",
  description: "",
});
function Home({
  onLogin,
  onFoundation,
}: {
  onLogin: () => void;
  onFoundation: () => void;
}) {
  return (
    <div className="home-screen">
      <header className="home-header">
        <div className="brand home-brand">
          <span className="brand-mark">A</span>
          <span>AZZA</span>
        </div>
        <button className="home-login" onClick={onLogin}>
          <LogIn size={15} /> Log in
        </button>
      </header>
      <main className="home-hero">
        <p className="eyebrow"><span className="live-dot" /> MONEY, IN GOOD ORDER</p>
        <h1>Spend with<br /><span>clarity.</span></h1>
        <p className="home-statement">
          Every expense, accounted for. A calmer, clearer view of where your
          organization’s money goes.
        </p>
        <div className="home-actions">
          <button className="foundation-cta" onClick={onFoundation}>
            Create your workspace <ArrowRight size={17} />
          </button>
          <button className="home-text-link" onClick={onLogin}>I already have an account</button>
        </div>
        <div className="home-preview" aria-label="AZZA workspace preview">
          <div className="preview-topline"><span><i /> WORKSPACE PREVIEW</span><b>THIS MONTH</b></div>
          <div className="preview-balance"><strong>₦ 2,840,500</strong><span>Across your recorded spend</span></div>
          <div className="preview-chart" aria-hidden="true">
            {[32, 48, 40, 66, 51, 74, 58, 88, 64, 78, 54, 95].map((height, index) => (
              <i key={index} style={{ "--bar-height": `${height}%`, "--bar-index": index } as React.CSSProperties} />
            ))}
          </div>
          <div className="preview-bottom"><span>Clear records, confident decisions</span><span>01 — 12</span></div>
        </div>
        <div className="home-proof">
          <span><ShieldCheck size={15} /> Your workspace, kept private</span>
          <span><Wallet size={15} /> Every currency in its place</span>
          <span><BarChart3 size={15} /> Decisions backed by detail</span>
        </div>
      </main>
      <footer className="home-footer">
        <span>BUILT FOR THE WAY YOUR TEAM WORKS</span>
        <span>PRIVATE BY DESIGN <b>·</b> READY WHEN YOU ARE</span>
      </footer>
    </div>
  );
}

function SplashScreen({ overlay = false }: { overlay?: boolean }) {
  return (
    <div
      className={`splash-screen${overlay ? " splash-overlay" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="splash-brand">
        <span className="brand-mark">A</span>
        <span>AZZA</span>
      </div>
      <div className="splash-progress" aria-hidden="true"><i /></div>
    </div>
  );
}

type WorkspaceView = "dashboard" | "expenditures" | "settings";

function Auth({
  mode,
  onModeChange,
  onBack,
  onSuccess,
  initialResetEmail = "",
  initialResetToken = "",
}: {
  mode: "login" | "signup" | "reset";
  onModeChange: (mode: "login" | "signup" | "reset") => void;
  onBack: () => void;
  onSuccess: (user: User) => void;
  initialResetEmail?: string;
  initialResetToken?: string;
}) {
  const [email, setEmail] = useState(initialResetEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (mode === "reset") {
      if (!email.includes("@")) return setError("Please enter a valid email address.");
      if (!resetToken) {
        setError("");
        setMessage("");
        setIsSubmitting(true);
        try {
          const result = await requestPasswordReset(email);
          setMessage(result.message);
          if (result.resetToken) setResetToken(result.resetToken);
        } catch (apiError) {
          setError(
            apiError instanceof Error
              ? apiError.message
              : "We could not request a password reset right now.",
          );
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      if (!newPassword || !confirmNewPassword) {
        return setError("Please provide a new password and confirm it.");
      }

      if (newPassword !== confirmNewPassword) {
        return setError("Passwords do not match.");
      }

      setError("");
      setMessage("");
      setIsSubmitting(true);
      try {
        const result = await resetPassword(email, resetToken, newPassword);
        setMessage(result);
        setPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        setResetToken("");
        window.setTimeout(() => {
          onModeChange("login");
        }, 1200);
      } catch (apiError) {
        setError(
          apiError instanceof Error
            ? apiError.message
            : "The password reset failed. Please try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === "signup" && !name.trim())
      return setError("Please enter your name.");
    if (!email.includes("@"))
      return setError("Please enter a valid email address.");
    if (mode === "signup" && password !== confirmPassword)
      return setError("Passwords do not match.");
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const user =
        mode === "login"
          ? await login(email, password)
          : await signup(name, email, password);
      onSuccess(user);
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "The authentication service is unavailable. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <section className="auth-panel">
        <button
          className="auth-back"
          onClick={onBack}
          aria-label="Back to home"
          title="Back to home"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="brand auth-brand">
          <span className="brand-mark">A</span>
          <span>AZZA</span>
        </div>
        <div className="auth-copy">
          <p className="eyebrow">
            {mode === "reset" ? "PASSWORD HELP" : "WELCOME BACK"}
          </p>
          <h1>
            {mode === "login"
              ? "Your expenses, in order."
              : mode === "signup"
                ? "Start with a clearer view."
                : "Reset your password."}
          </h1>
          <p>
            {mode === "login"
              ? "Sign in to continue to your AZZA workspace."
              : mode === "signup"
                ? "Create your AZZA workspace and begin recording expenses in seconds."
                : "Enter your email, request a reset code, then choose a new password."}
          </p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Full name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Sarah Adams"
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </label>
          )}
          {mode === "reset" && (
            <>
              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                />
              </label>
              <label>
                Reset token
                <input
                  value={resetToken}
                  onChange={(event) => setResetToken(event.target.value)}
                  placeholder="Paste the token from your email"
                />
              </label>
            </>
          )}
          {mode !== "reset" && (
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder={
                mode === "signup"
                  ? "12+ chars, upper/lowercase, number, symbol"
                  : "Your password"
              }
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          )}
          {mode === "signup" && (
            <PasswordField
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Re-enter your password"
            />
          )}
          {mode === "reset" && resetToken && (
            <>
              <PasswordField
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="New password"
              />
              <PasswordField
                label="Confirm new password"
                value={confirmNewPassword}
                onChange={setConfirmNewPassword}
                placeholder="Re-enter your new password"
              />
            </>
          )}
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success">{message}</p>}
          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : resetToken
                    ? "Reset password"
                    : "Send reset email"}{" "}
            {!isSubmitting && <ArrowRight size={16} />}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "login" ? "New to AZZA?" : mode === "signup" ? "Already have an account?" : "Remembered your password?"}{" "}
          <button
            onClick={() => {
              setError("");
              setMessage("");
              setPassword("");
              setNewPassword("");
              setConfirmNewPassword("");
              setResetToken("");
              onModeChange(
                mode === "login" ? "signup" : mode === "signup" ? "login" : "login",
              );
            }}
          >
            {mode === "login"
              ? "Create an account"
              : mode === "signup"
                ? "Sign in"
                : "Back to sign in"}
          </button>
        </p>
        {mode !== "reset" && (
          <p className="auth-switch">
            Forgot your password?{" "}
            <button
              onClick={() => {
                setError("");
                setMessage("");
                setPassword("");
                setNewPassword("");
                setConfirmNewPassword("");
                setResetToken("");
                onModeChange("reset");
              }}
            >
              Reset it
            </button>
          </p>
        )}
      </section>
      <aside className="auth-aside">
        <span className="auth-aside-mark">A</span>
        <h2>
          Record it now.
          <br />
          Find it later.
        </h2>
        <p>
          AZZA keeps the everyday work of expenditure management light,
          structured, and ready for your next decision.
        </p>
      </aside>
    </div>
  );
}

function App() {
  const [resetLink] = useState(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token") ?? "";
    const email = url.searchParams.get("email") ?? "";
    if (!token || !email) return null;

    return { email, token };
  });
  const [screen, setScreen] = useState<"home" | "login" | "app">(
    resetLink ? "login" : "home",
  );
  const [authMode, setAuthMode] = useState<"login" | "signup" | "reset">(
    resetLink ? "reset" : "login",
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [records, setRecords] = useState<Expenditure[]>([]);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [view, setView] = useState<WorkspaceView>("dashboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(blankForm);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [showTransitionSplash, setShowTransitionSplash] = useState(false);
  const splashTimeout = useRef<number | null>(null);

  const transitionWithSplash = (navigate: () => void) => {
    if (splashTimeout.current !== null) {
      window.clearTimeout(splashTimeout.current);
    }
    setShowTransitionSplash(true);
    navigate();
    splashTimeout.current = window.setTimeout(() => {
      setShowTransitionSplash(false);
      splashTimeout.current = null;
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 100 : 320);
  };

  const navigateToView = (nextView: WorkspaceView) => {
    setMobileNav(false);
    if (view === nextView) return;
    transitionWithSplash(() => setView(nextView));
  };

  useEffect(
    () => () => {
      if (splashTimeout.current !== null) {
        window.clearTimeout(splashTimeout.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!mobileNav) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileNav]);

  useEffect(() => {
    if (resetLink) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [resetLink]);

  useEffect(() => {
    let isActive = true;

    const restoreSession = async () => {
      try {
        const user = await getCurrentUser();
        if (!isActive) return;
        setCurrentUser(user);
        setScreen(resetLink ? "login" : user ? "app" : "home");
      } catch {
        if (!isActive) return;
        setCurrentUser(null);
        setScreen("home");
      } finally {
        if (isActive) setIsAuthLoading(false);
      }
    };

    restoreSession();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setRecords([]);
      return;
    }

    let isActive = true;
    setIsRecordsLoading(true);
    setRecordsError("");
    getExpenditures()
      .then((loadedRecords) => {
        if (isActive) setRecords(loadedRecords);
      })
      .catch((error: unknown) => {
        if (isActive) {
          setRecordsError(
            error instanceof Error ? error.message : "Unable to load expenditures.",
          );
        }
      })
      .finally(() => {
        if (isActive) setIsRecordsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (screen === "app" && !currentUser) {
      setScreen("home");
    }
  }, [screen, currentUser]);

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const matchesQuery =
          `${record.category} ${record.subcategory} ${record.description}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return (
          matchesQuery &&
          (categoryFilter === "All categories" ||
            record.category === categoryFilter)
        );
      }),
    [records, query, categoryFilter],
  );

  const total = records
    .filter((record) => record.currency === "NGN")
    .reduce((sum, record) => sum + record.amount, 0);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthTotal = records
    .filter(
      (record) =>
        record.currency === "NGN" && record.date.startsWith(currentMonth),
    )
    .reduce((sum, record) => sum + record.amount, 0);
  const formatMoney = (amount: number) => amount.toLocaleString("en-NG");

  const openNew = () => {
    setEditingId(null);
    setForm(blankForm());
    setModalOpen(true);
  };
  const openEdit = (record: Expenditure) => {
    setEditingId(record.id);
    setForm({ ...record, amount: String(record.amount) });
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  const saveRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !form.date ||
      !form.category ||
      !form.subcategory ||
      !form.amount ||
      Number(form.amount) <= 0
    )
      return setNotice(
        "Please complete all required fields with a valid amount.",
      );
    const expenditure = { ...form, amount: Number(form.amount) };
    try {
      const saved = editingId
        ? await updateExpenditure(editingId, expenditure)
        : await createExpenditure(expenditure);
      setRecords((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? saved : item))
          : [saved, ...current],
      );
      setNotice(editingId ? "Expenditure updated." : "Expenditure saved.");
      setRecordsError("");
      closeModal();
      transitionWithSplash(() => setView("expenditures"));
      window.setTimeout(() => setNotice(""), 3500);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to save expenditure.",
      );
    }
  };

  const deleteRecord = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this expenditure?")) return;
    try {
      await deleteExpenditure(id);
      setRecords((current) => current.filter((record) => record.id !== id));
      setNotice("Expenditure deleted.");
      window.setTimeout(() => setNotice(""), 3500);
    } catch (error) {
      setRecordsError(
        error instanceof Error ? error.message : "Unable to delete expenditure.",
      );
    }
  };

  const exportRecords = async () => {
    const rows = records.map(
      ({
        date,
        category,
        subcategory,
        amount,
        currency,
        paymentMethod,
        description,
      }) => ({
        Date: date,
        Category: category,
        "Sub-category": subcategory,
        Amount: amount,
        Currency: currency,
        "Mode of Payment": paymentMethod,
        Description: description,
      }),
    );
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(rows),
        "Expenditures",
      );
      XLSX.writeFile(workbook, "AZZA_Expenditure.xlsx");
    } catch (error) {
      console.error("Unable to export expenditures:", error);
      setRecordsError("Unable to export expenditures. Please try again.");
    }
  };

  if (isAuthLoading) {
    return <SplashScreen />;
  }

  if (screen === "home")
    return (
      <>
        <Home
          onLogin={() =>
            transitionWithSplash(() => {
              setAuthMode("login");
              setScreen("login");
            })
          }
          onFoundation={() =>
            transitionWithSplash(() => {
              setAuthMode("signup");
              setScreen("login");
            })
          }
        />
        {showTransitionSplash && <SplashScreen overlay />}
      </>
    );
  if (screen === "login")
    return (
      <>
        <Auth
          mode={authMode}
          initialResetEmail={resetLink?.email}
          initialResetToken={resetLink?.token}
          onModeChange={(mode) => transitionWithSplash(() => setAuthMode(mode))}
          onBack={() => setScreen("home")}
          onSuccess={(user) =>
            transitionWithSplash(() => {
              setCurrentUser(user);
              setScreen("app");
            })
          }
        />
        {showTransitionSplash && <SplashScreen overlay />}
      </>
    );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand-row">
          <div className="brand">
            <span className="brand-mark">A</span>
            <span>AZZA</span>
          </div>
          <button
            className="sidebar-close"
            type="button"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>
        <nav id="primary-navigation" aria-label="Main navigation">
          <button
            className={view === "dashboard" ? "nav-active" : ""}
            aria-current={view === "dashboard" ? "page" : undefined}
            onClick={() => {
              navigateToView("dashboard");
            }}
          >
            <LayoutDashboard size={17} /> Dashboard
          </button>
          <button
            className={view === "expenditures" ? "nav-active" : ""}
            aria-current={view === "expenditures" ? "page" : undefined}
            onClick={() => {
              navigateToView("expenditures");
            }}
          >
            <Wallet size={17} /> Expenditures
          </button>
          <button
            className={view === "settings" ? "nav-active" : ""}
            aria-current={view === "settings" ? "page" : undefined}
            onClick={() => {
              navigateToView("settings");
            }}
          >
            <Settings size={17} /> Settings
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{getInitials(currentUser?.name)}</div>
          <div>
            <strong>{currentUser?.name || "AZZA User"}</strong>
            <small>{currentUser?.email || "Administrator"}</small>
          </div>
          <button
            className="logout-icon"
            onClick={async () => {
              try {
                await logout();
              } finally {
                setCurrentUser(null);
                setScreen("home");
              }
            }}
            aria-label="Log out"
          >
            <LogIn size={15} />
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="mobile-nav-backdrop"
          type="button"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation menu"
        />
      )}

      <main className="main-content">
        <header className={`topbar${mobileNav ? " nav-open" : ""}`}>
          <button
            className="icon-button menu-button"
            type="button"
            onClick={() => setMobileNav((isOpen) => !isOpen)}
            aria-label={mobileNav ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileNav}
            aria-controls="primary-navigation"
          >
            {mobileNav ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <b>/</b>
            <strong>
              {view === "dashboard"
                ? "Dashboard"
                : view === "expenditures"
                  ? "Expenditures"
                  : "Settings"}
            </strong>
          </div>
          <button
            className="top-profile"
            onClick={() => {
              navigateToView("settings");
            }}
            aria-label="Open profile"
          >
            <span className="avatar small">{getInitials(currentUser?.name)}</span>
            <span className="desktop-only">{currentUser?.name}</span>
          </button>
        </header>
        {notice && <div className="toast">{notice}</div>}
        {recordsError && (
          <div className="records-error" role="alert">
            <span>{recordsError}</span>
            <button
              onClick={() => {
                setRecordsError("");
                setIsRecordsLoading(true);
                getExpenditures()
                  .then(setRecords)
                  .catch((error: unknown) =>
                    setRecordsError(error instanceof Error ? error.message : "Unable to load expenditures."),
                  )
                  .finally(() => setIsRecordsLoading(false));
              }}
            >
              Try again
            </button>
          </div>
        )}

        {view === "dashboard" && (
          isRecordsLoading ? (
            <div className="page loading-state"><span className="loading-spinner" /> Loading your workspace…</div>
          ) : (
            <Dashboard
              total={total}
              monthTotal={monthTotal}
              records={records}
              formatMoney={formatMoney}
              userName={currentUser?.name ?? "there"}
              onAdd={openNew}
              onView={() => navigateToView("expenditures")}
              onExport={exportRecords}
            />
          )
        )}
        {view === "expenditures" && (
          <section className="page">
            <div className="page-heading">
              <div>
                <p className="eyebrow">RECORDS</p>
                <h1>Expenditures</h1>
                <p>Review, update and export your expenditure history.</p>
              </div>
              <button className="primary-button" onClick={openNew}>
                <Plus size={17} /> Add expenditure
              </button>
            </div>
            <div className="toolbar">
              <label className="search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search records"
                />
              </label>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option>All categories</option>
                {Object.keys(categories).map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
              <button className="outline-button" onClick={exportRecords}>
                <Download size={16} /> Export Excel
              </button>
            </div>
            {isRecordsLoading ? (
              <div className="panel loading-state"><span className="loading-spinner" /> Loading your records…</div>
            ) : (
            <RecordsTable
              records={filteredRecords}
              formatMoney={formatMoney}
              onEdit={openEdit}
              onDelete={deleteRecord}
            />
            )}
          </section>
        )}
        {view === "settings" && (
          <section className="page">
            <div className="page-heading">
              <div>
                <p className="eyebrow">PREFERENCES</p>
                <h1>Settings</h1>
                <p>Your account details for this AZZA workspace.</p>
              </div>
            </div>
            <div className="settings-panel">
              <h2>Profile</h2>
              <p>These details appear on your AZZA workspace.</p>
              <label>
                Full name
                <input value={currentUser?.name ?? ""} readOnly />
              </label>
              <label>
                Email address
                <input value={currentUser?.email ?? ""} type="email" readOnly />
              </label>
            </div>
          </section>
        )}
      </main>
      {modalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && closeModal()
          }
        >
          <form className="modal" onSubmit={saveRecord}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">
                  {editingId ? "UPDATE RECORD" : "NEW RECORD"}
                </p>
                <h2>{editingId ? "Edit expenditure" : "Add expenditure"}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={closeModal}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>
            <div className="form-grid">
              <label>
                Date *
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm({ ...form, date: event.target.value })
                  }
                />
              </label>
              <label>
                Amount *
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(event) =>
                    setForm({ ...form, amount: event.target.value })
                  }
                />
              </label>
              <label>
                Category *
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      category: event.target.value,
                      subcategory: "",
                    })
                  }
                >
                  <option value="">Select category</option>
                  {Object.keys(categories).map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                Sub-category *
                <select
                  value={form.subcategory}
                  disabled={!form.category}
                  onChange={(event) =>
                    setForm({ ...form, subcategory: event.target.value })
                  }
                >
                  <option value="">Select sub-category</option>
                  {(categories[form.category] ?? []).map((subcategory) => (
                    <option key={subcategory}>{subcategory}</option>
                  ))}
                </select>
              </label>
              <label>
                Currency
                <select
                  value={form.currency}
                  onChange={(event) =>
                    setForm({ ...form, currency: event.target.value })
                  }
                >
                  <option>NGN</option>
                  <option>USD</option>
                  <option>GBP</option>
                </select>
              </label>
              <label>
                Mode of payment
                <select
                  value={form.paymentMethod}
                  onChange={(event) =>
                    setForm({ ...form, paymentMethod: event.target.value })
                  }
                >
                  <option>Transfer</option>
                  <option>Card</option>
                  <option>Cash</option>
                  <option>Direct debit</option>
                </select>
              </label>
              <label className="full-width">
                Description{" "}
                <input
                  value={form.description}
                  placeholder="What was this expenditure for?"
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </label>
            </div>
            {notice && <p className="form-error">{notice}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="outline-button"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button type="submit" className="primary-button">
                {editingId ? "Save changes" : "Save expenditure"}
              </button>
            </div>
          </form>
        </div>
      )}
      {showTransitionSplash && <SplashScreen overlay />}
    </div>
  );
}

function Dashboard({
  total,
  monthTotal,
  records,
  formatMoney,
  userName,
  onAdd,
  onView,
  onExport,
}: {
  total: number;
  monthTotal: number;
  records: Expenditure[];
  formatMoney: (amount: number) => string;
  userName: string;
  onAdd: () => void;
  onView: () => void;
  onExport: () => void;
}) {
  return (
    <section className="page dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()}</p>
          <h1>
            {getGreeting()}, {userName.split(" ")[0]}<span>.</span>
          </h1>
          <p>Here’s what’s happening with your organization’s finances.</p>
        </div>
        <button className="primary-button" onClick={onAdd}>
          <Plus size={17} /> New expenditure
        </button>
      </div>
      <div className="stat-grid">
        <div className="stat-card accent">
          <span>Total spend <i>· NGN</i></span>
          <strong>{formatMoney(total)}</strong>
          <small>NGN transactions only</small>
        </div>
        <div className="stat-card">
          <span>This month <i>· NGN</i></span>
          <strong>{formatMoney(monthTotal)}</strong>
          <small>{new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</small>
        </div>
        <div className="stat-card">
          <span>Transactions</span>
          <strong>{records.length}</strong>
          <small>Recorded expenditures</small>
        </div>
      </div>
      <div className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent expenditures</h2>
              <p>Your latest recorded transactions</p>
            </div>
            <button className="text-button" onClick={onView}>
              View all
            </button>
          </div>
          <RecordsTable
            records={records.slice(0, 4)}
            formatMoney={formatMoney}
            compact
          />
        </div>
        <div className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h2>Quick actions</h2>
              <p>Keep your records up to date</p>
            </div>
          </div>
          <button onClick={onAdd}>
            <Plus size={18} />
            <span>
              <b>Add expenditure</b>
              <small>Record a new transaction</small>
            </span>
          </button>
          <button onClick={onView}>
            <Wallet size={18} />
            <span>
              <b>View expenditures</b>
              <small>Search your history</small>
            </span>
          </button>
          <button onClick={onExport}>
            <Download size={18} />
            <span>
              <b>Export to Excel</b>
              <small>Download all records</small>
            </span>
          </button>
        </div>
      </div>
      <div className="panel category-panel">
        <div className="panel-heading">
          <div>
            <h2>Spend by category</h2>
            <p>NGN distribution across recorded expenditure</p>
          </div>
          <BarChart3 size={19} />
        </div>
        <CategoryBreakdown records={records} formatMoney={formatMoney} />
      </div>
    </section>
  );
}

function CategoryBreakdown({
  records,
  formatMoney,
}: {
  records: Expenditure[];
  formatMoney: (amount: number) => string;
}) {
  const totals = Object.entries(
    records.reduce<Record<string, number>>((summary, record) => {
      if (record.currency === "NGN") {
        summary[record.category] = (summary[record.category] ?? 0) + record.amount;
      }
      return summary;
    }, {}),
  ).sort(([, first], [, second]) => second - first);
  const largest = totals[0]?.[1] ?? 0;

  if (!totals.length) {
    return <p className="category-empty">Your category breakdown will appear once you record NGN expenses.</p>;
  }

  return (
    <div className="category-list">
      {totals.map(([category, amount], index) => (
        <div className="category-row" key={category}>
          <div className="category-meta"><span><i style={{ "--category-index": index } as React.CSSProperties} />{category}</span><strong>{formatMoney(amount)} <small>NGN</small></strong></div>
          <div className="category-track"><i style={{ width: `${(amount / largest) * 100}%`, "--category-index": index } as React.CSSProperties} /></div>
        </div>
      ))}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getInitials(name?: string): string {
  return name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AZ";
}

function RecordsTable({
  records,
  formatMoney,
  onEdit,
  onDelete,
  compact = false,
}: {
  records: Expenditure[];
  formatMoney: (amount: number) => string;
  onEdit?: (record: Expenditure) => void;
  onDelete?: (id: number) => void;
  compact?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Payment</th>
            {!compact && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty">
                No expenditures found.
              </td>
            </tr>
          ) : (
            records.map((record) => (
              <tr key={record.id}>
                <td>
                  {new Date(`${record.date}T12:00:00`).toLocaleDateString(
                    "en-GB",
                  )}
                </td>
                <td>
                  <div className="merchant">
                    <strong>{record.subcategory}</strong>
                    <small>{record.category}</small>
                  </div>
                </td>
                <td className="amount">
                  {formatMoney(record.amount)} <small>{record.currency}</small>
                </td>
                <td>
                  <span className="pill">{record.paymentMethod}</span>
                </td>
                {!compact && (
                  <td className="actions">
                    <button onClick={() => onEdit?.(record)} aria-label="Edit">
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => onDelete?.(record.id)}
                      aria-label="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;
