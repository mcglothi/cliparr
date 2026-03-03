"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Account = {
  id: number;
  store_key: string;
  account_label: string;
  username: string;
  enabled: boolean;
};

type Schedule = {
  id: number;
  account_id: number;
  account_label: string;
  store_key: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  last_enqueued_at: string | null;
};

type Run = {
  id: number;
  store_key: string;
  status: string;
  clipped_count: number;
  message: string;
  started_at: string;
  finished_at: string | null;
};

type Insights = {
  total_runs: number;
  successful_runs: number;
  success_rate: number;
  total_clipped: number;
  accounts: number;
  enabled_schedules: number;
};

const defaultInsights: Insights = {
  total_runs: 0,
  successful_runs: 0,
  success_rate: 0,
  total_clipped: 0,
  accounts: 0,
  enabled_schedules: 0,
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export default function Home() {
  const [stores, setStores] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [insights, setInsights] = useState<Insights>(defaultInsights);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [accountForm, setAccountForm] = useState({
    store_key: "",
    account_label: "",
    username: "",
    password: "",
  });

  const [scheduleForm, setScheduleForm] = useState({
    account_id: "",
    cron: "0 6 * * *",
    timezone: "America/New_York",
    enabled: true,
  });

  const recentRuns = useMemo(() => runs.slice(0, 12), [runs]);

  async function refreshAll() {
    setError("");
    try {
      const [{ stores }, fetchedAccounts, fetchedSchedules, fetchedRuns, fetchedInsights] = await Promise.all([
        api<{ stores: string[] }>("stores"),
        api<Account[]>("accounts"),
        api<Schedule[]>("schedules"),
        api<Run[]>("runs"),
        api<Insights>("insights"),
      ]);
      setStores(stores);
      setAccounts(fetchedAccounts);
      setSchedules(fetchedSchedules);
      setRuns(fetchedRuns);
      setInsights(fetchedInsights);
      setAccountForm((prev) => ({ ...prev, store_key: prev.store_key || stores[0] || "" }));
      setScheduleForm((prev) => ({
        ...prev,
        account_id: prev.account_id || (fetchedAccounts[0] ? String(fetchedAccounts[0].id) : ""),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshAll();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  async function onCreateAccount(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api<Account>("accounts", {
        method: "POST",
        body: JSON.stringify(accountForm),
      });
      setAccountForm((prev) => ({ ...prev, account_label: "", username: "", password: "" }));
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateSchedule(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api<Schedule>("schedules", {
        method: "POST",
        body: JSON.stringify({
          account_id: Number(scheduleForm.account_id),
          cron: scheduleForm.cron,
          timezone: scheduleForm.timezone,
          enabled: scheduleForm.enabled,
        }),
      });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create schedule");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAccount(account: Account) {
    setBusy(true);
    try {
      await api<Account>(`accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !account.enabled }),
      });
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(accountId: number) {
    setBusy(true);
    try {
      await api<{ status: string }>(`accounts/${accountId}`, { method: "DELETE" });
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function toggleSchedule(schedule: Schedule) {
    setBusy(true);
    try {
      await api<Schedule>(`schedules/${schedule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function deleteSchedule(scheduleId: number) {
    setBusy(true);
    try {
      await api<{ status: string }>(`schedules/${scheduleId}`, { method: "DELETE" });
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function runNow(accountId: number) {
    setBusy(true);
    try {
      await api<{ status: string }>("runs/trigger", {
        method: "POST",
        body: JSON.stringify({ account_id: accountId }),
      });
      setNotice("Run queued. It can take up to 2 minutes for results to appear.");
      await refreshAll();
      setTimeout(() => refreshAll(), 15000);
      setTimeout(() => refreshAll(), 45000);
      setTimeout(() => refreshAll(), 90000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="kicker">Cliparr</p>
        <h1>Save without spreadsheet chaos.</h1>
        <p className="sub">Configure store logins, automate clipping schedules, and track how many offers you capture each week.</p>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      <section className="stats-grid">
        <article className="stat-card"><h3>Coupons Clipped</h3><p>{insights.total_clipped}</p></article>
        <article className="stat-card"><h3>Success Rate</h3><p>{insights.success_rate}%</p></article>
        <article className="stat-card"><h3>Accounts</h3><p>{insights.accounts}</p></article>
        <article className="stat-card"><h3>Active Schedules</h3><p>{insights.enabled_schedules}</p></article>
      </section>

      <section className="grid two">
        <article className="card">
          <h2>Add Store Account</h2>
          <form className="form" onSubmit={onCreateAccount}>
            <label>
              Store
              <select value={accountForm.store_key} onChange={(e) => setAccountForm((v) => ({ ...v, store_key: e.target.value }))} required>
                {stores.map((store) => (
                  <option key={store} value={store}>{store}</option>
                ))}
              </select>
            </label>
            <label>
              Account label
              <input value={accountForm.account_label} onChange={(e) => setAccountForm((v) => ({ ...v, account_label: e.target.value }))} placeholder="Household Main" required />
            </label>
            <label>
              Username/email
              <input value={accountForm.username} onChange={(e) => setAccountForm((v) => ({ ...v, username: e.target.value }))} required />
            </label>
            <label>
              Password
              <input type="password" value={accountForm.password} onChange={(e) => setAccountForm((v) => ({ ...v, password: e.target.value }))} required />
            </label>
            <button disabled={busy} type="submit">Save Account</button>
          </form>
        </article>

        <article className="card">
          <h2>Create Schedule</h2>
          <form className="form" onSubmit={onCreateSchedule}>
            <label>
              Account
              <select value={scheduleForm.account_id} onChange={(e) => setScheduleForm((v) => ({ ...v, account_id: e.target.value }))} required>
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.store_key} - {account.account_label}</option>
                ))}
              </select>
            </label>
            <label>
              Cron
              <input value={scheduleForm.cron} onChange={(e) => setScheduleForm((v) => ({ ...v, cron: e.target.value }))} placeholder="0 6 * * *" required />
            </label>
            <label>
              Timezone
              <input value={scheduleForm.timezone} onChange={(e) => setScheduleForm((v) => ({ ...v, timezone: e.target.value }))} required />
            </label>
            <button disabled={busy} type="submit">Save Schedule</button>
          </form>
        </article>
      </section>

      <section className="grid two">
        <article className="card">
          <h2>Accounts</h2>
          <div className="list">
            {accounts.map((a) => (
              <div key={a.id} className="row">
                <div>
                  <strong>{a.account_label}</strong>
                  <p>{a.store_key} · {a.username}</p>
                </div>
                <div className="actions">
                  <button onClick={() => runNow(a.id)} disabled={busy}>Run Now</button>
                  <button onClick={() => toggleAccount(a)} disabled={busy}>{a.enabled ? "Disable" : "Enable"}</button>
                  <button className="danger" onClick={() => deleteAccount(a.id)} disabled={busy}>Delete</button>
                </div>
              </div>
            ))}
            {!accounts.length ? <p className="muted">No accounts yet.</p> : null}
          </div>
        </article>

        <article className="card">
          <h2>Schedules</h2>
          <div className="list">
            {schedules.map((s) => (
              <div key={s.id} className="row">
                <div>
                  <strong>{s.store_key} · {s.account_label}</strong>
                  <p>{s.cron} ({s.timezone})</p>
                </div>
                <div className="actions">
                  <button onClick={() => toggleSchedule(s)} disabled={busy}>{s.enabled ? "Pause" : "Resume"}</button>
                  <button className="danger" onClick={() => deleteSchedule(s.id)} disabled={busy}>Delete</button>
                </div>
              </div>
            ))}
            {!schedules.length ? <p className="muted">No schedules yet.</p> : null}
          </div>
        </article>
      </section>

      <section className="card">
        <h2>Recent Runs</h2>
        <div className="list compact">
          {recentRuns.map((run) => (
            <div key={run.id} className="run-row">
              <span className={`badge ${run.status === "success" ? "ok" : "warn"}`}>{run.status}</span>
              <span>{run.store_key}</span>
              <span>{run.clipped_count} clipped</span>
              <span className="muted">{new Date(run.started_at).toLocaleString()}</span>
            </div>
          ))}
          {!recentRuns.length ? <p className="muted">No runs yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
