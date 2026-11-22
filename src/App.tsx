import { useState } from 'react';
import { EmptyState, Field, Landing, NotFound, Notice, Shell, uid, useFlash, usePersistentState, useRoute } from './shared/ui';
import { addDays, formatDay, toISO, weekStart } from './lib/dates';
import {
  completionRate,
  currentStreak,
  DAY_NAMES,
  dayState,
  isScheduled,
  isDone,
  longestStreak,
  missedDays,
  monthGrid,
  toggleCheckin,
  validateHabit,
  weekSummary,
  type Checkins,
  type Habit,
} from './lib/habits';

const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/today', label: 'Today' },
  { to: '/habits', label: 'Habits' },
  { to: '/stats', label: 'Weekly stats' },
];
const COLORS = ['#2a6b45', '#2563eb', '#b45309', '#be185d', '#7c3aed', '#0e7490'];

interface Store {
  habits: Habit[];
  checkins: Checkins;
}

function demoStore(today: string): Store {
  const start = addDays(today, -27);
  const habits: Habit[] = [
    { id: 'demo-1', name: 'Demo: Walk 20 minutes', color: '#2a6b45', days: [0, 1, 2, 3, 4, 5, 6], createdAt: start, demo: true },
    { id: 'demo-2', name: 'Demo: Practise Spanish', color: '#2563eb', days: [0, 1, 2, 3, 4], createdAt: start, demo: true },
    { id: 'demo-3', name: 'Demo: Stretch', color: '#be185d', days: [0, 2, 4], createdAt: start, demo: true },
  ];
  // Deterministic pattern so the demo has real streaks and gaps.
  const checkins: Checkins = { 'demo-1': [], 'demo-2': [], 'demo-3': [] };
  for (let i = 1; i < 28; i++) {
    const d = addDays(today, -i);
    if (i % 6 !== 0) checkins['demo-1'].push(d);
    if (i % 4 !== 3) checkins['demo-2'].push(d);
    if (i > 5) checkins['demo-3'].push(d);
  }
  for (const k of Object.keys(checkins)) checkins[k] = checkins[k].filter((d) => isScheduled(habits.find((h) => h.id === k)!, d)).sort();
  return { habits, checkins };
}

export default function App() {
  const [route] = useRoute();
  const [store, setStore] = usePersistentState<Store>('habit-grove:store', { habits: [], checkins: {} });
  const today = toISO(new Date());
  const loadDemo = () => setStore(demoStore(today));

  let page;
  const detail = route.match(/^\/habit\/(.+)$/);
  if (route === '/') page = <Home />;
  else if (route === '/today') page = <Today store={store} setStore={setStore} today={today} loadDemo={loadDemo} />;
  else if (route === '/habits') page = <Manage store={store} setStore={setStore} today={today} loadDemo={loadDemo} />;
  else if (route === '/stats') page = <Stats store={store} today={today} />;
  else if (detail) page = <Detail store={store} setStore={setStore} id={detail[1]} today={today} />;
  else page = <NotFound />;

  return (
    <Shell name="Habit Grove" mark="HG" nav={NAV} route={route}>
      {page}
    </Shell>
  );
}

function Home() {
  return (
    <Landing
      eyebrow="Habit tracker"
      title="Small daily habits, tracked honestly."
      lead="Choose which days each habit is due, check in when you do it, and see streaks, missed days and weekly completion without any guilt-trip gamification."
      actions={
        <>
          <a className="btn btn-primary" href="#/today">Go to today</a>
          <a className="btn" href="#/habits">Create a habit</a>
        </>
      }
      preview={
        <div className="hero-grid" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} className={i % 6 === 5 ? 'missed' : i % 7 === 6 ? 'off' : 'done'} />
          ))}
          <p className="small muted">Each square is a day: filled when done, outlined when missed, faint when the habit is not scheduled.</p>
        </div>
      }
      steps={[
        { title: 'Create a habit', body: 'Name it and pick the days it applies — every day, weekdays, or a custom set.' },
        { title: 'Check in', body: 'Tick it off on the Today page, or backfill a day from the past week.' },
        { title: 'Review', body: 'See streaks, the month calendar and weekly completion for each habit.' },
      ]}
      features={[
        { title: 'Streaks that make sense', body: 'Rest days do not break a streak, and today stays open until it is over.' },
        { title: 'Missed days', body: 'Each habit lists the scheduled days you missed in the last two weeks.' },
        { title: 'Calendar history', body: 'Month-by-month view with done, missed and rest days.' },
        { title: 'Weekly statistics', body: 'Completion per day and per habit for any week.' },
      ]}
      note="Data stays in this browser. Habit Grove does not send notifications or reminders."
    />
  );
}

function StreakBadge({ n }: { n: number }) {
  return <span className={`badge ${n > 0 ? 'badge-ok' : ''}`}>{n} day streak</span>;
}

function Today({ store, setStore, today, loadDemo }: { store: Store; setStore: (s: Store) => void; today: string; loadDemo: () => void }) {
  const [flash, setFlash] = useFlash();
  const due = store.habits.filter((h) => isScheduled(h, today));
  const notDue = store.habits.filter((h) => !isScheduled(h, today));
  const doneCount = due.filter((h) => isDone(store.checkins, h.id, today)).length;
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  function toggle(h: Habit, day: string) {
    const r = toggleCheckin(store.checkins, h.id, day, today);
    if (r.error) return setFlash({ kind: 'error', text: r.error });
    setStore({ ...store, checkins: r.checkins });
    const nowDone = isDone(r.checkins, h.id, day);
    if (nowDone) setFlash({ kind: 'success', text: `Checked in “${h.name}” for ${day === today ? 'today' : formatDay(day)}.` });
  }

  if (store.habits.length === 0)
    return (
      <EmptyState
        title="No habits yet"
        actions={
          <>
            <a className="btn btn-primary" href="#/habits">Create your first habit</a>
            <button type="button" className="btn" onClick={loadDemo}>Load demo habits</button>
          </>
        }
      >
        Start with one small habit you can do in under five minutes.
      </EmptyState>
    );

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{formatDay(today, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
          <p data-testid="today-summary">
            {due.length === 0 ? 'Nothing scheduled today — enjoy the rest day.' : `${doneCount} of ${due.length} habits done today`}
          </p>
        </div>
      </div>
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <ul className="habit-list">
        {[...due, ...notDue].map((h) => {
          const scheduled = isScheduled(h, today);
          const done = isDone(store.checkins, h.id, today);
          return (
            <li key={h.id} className={`card habit ${done ? 'is-done' : ''}`} style={{ borderLeftColor: h.color }}>
              <div className="habit-top">
                <button
                  type="button"
                  className={`check-btn ${done ? 'on' : ''}`}
                  aria-pressed={done}
                  onClick={() => toggle(h, today)}
                  style={{ ['--c' as string]: h.color }}
                  aria-label={`${done ? 'Undo check-in for' : 'Check in'} ${h.name}`}
                >
                  {done ? '✓' : ''}
                </button>
                <div className="habit-name">
                  <a href={`#/habit/${h.id}`}><strong>{h.name}</strong></a>
                  <div className="hint">{scheduled ? 'Due today' : 'Not scheduled today'} · {h.days.length === 7 ? 'Every day' : h.days.map((d) => DAY_NAMES[d]).join(', ')}</div>
                </div>
                <StreakBadge n={currentStreak(h, store.checkins, today)} />
              </div>
              <div className="strip" role="group" aria-label={`Last 7 days for ${h.name}`}>
                {last7.map((d) => {
                  const st = dayState(h, store.checkins, d, today);
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`strip-day st-${st}`}
                      style={{ ['--c' as string]: h.color }}
                      onClick={() => toggle(h, d)}
                      disabled={st === 'before'}
                      aria-label={`${formatDay(d, { weekday: 'long', day: 'numeric', month: 'short' })}: ${st}`}
                    >
                      <span>{formatDay(d, { weekday: 'narrow' })}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="hint">Tip: tap a day in the strip to backfill a check-in you forgot.</p>
    </div>
  );
}

function HabitForm({ store, setStore, editing, onDone, today }: { store: Store; setStore: (s: Store) => void; editing?: Habit; onDone: (msg: string) => void; today: string }) {
  const [name, setName] = useState(editing?.name ?? '');
  const [days, setDays] = useState<number[]>(editing?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [color, setColor] = useState(editing?.color ?? COLORS[store.habits.length % COLORS.length]);
  const [errors, setErrors] = useState<ReturnType<typeof validateHabit>>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateHabit({ name, days }, store.habits, editing?.id);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const sorted = [...days].sort();
    if (editing) {
      setStore({ ...store, habits: store.habits.map((h) => (h.id === editing.id ? { ...h, name: name.trim(), days: sorted, color } : h)) });
      onDone(`Updated “${name.trim()}”.`);
    } else {
      setStore({ ...store, habits: [...store.habits, { id: uid('habit'), name: name.trim(), days: sorted, color, createdAt: today }] });
      setName('');
      onDone(`Created “${name.trim()}”. Check in from the Today page.`);
    }
  }
  const preset = (d: number[]) => setDays(d);
  return (
    <form className="card stack" onSubmit={submit} noValidate aria-label={editing ? 'Edit habit' : 'New habit'}>
      <h2>{editing ? 'Edit habit' : 'New habit'}</h2>
      <Field label="Habit name" error={errors.name}>{(c) => <input type="text" {...c} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Read 10 pages" />}</Field>
      <fieldset className="days" aria-describedby={errors.days ? 'days-err' : undefined}>
        <legend className="label">Scheduled days</legend>
        <div className="row">
          {DAY_NAMES.map((d, i) => (
            <label key={d} className={`day-toggle ${days.includes(i) ? 'on' : ''}`}>
              <input type="checkbox" checked={days.includes(i)} onChange={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])} />
              {d}
            </label>
          ))}
        </div>
        <div className="row small">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => preset([0, 1, 2, 3, 4, 5, 6])}>Every day</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => preset([0, 1, 2, 3, 4])}>Weekdays</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => preset([5, 6])}>Weekends</button>
        </div>
        {errors.days && <span className="error-text" id="days-err">{errors.days}</span>}
      </fieldset>
      <fieldset className="days">
        <legend className="label">Colour</legend>
        <div className="row">
          {COLORS.map((c) => (
            <label key={c} className="swatch" style={{ background: c }}>
              <input type="radio" name={`color-${editing?.id ?? 'new'}`} checked={color === c} onChange={() => setColor(c)} aria-label={`Colour ${c}`} />
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" className="btn btn-primary">{editing ? 'Save changes' : 'Create habit'}</button>
    </form>
  );
}

function Manage({ store, setStore, today, loadDemo }: { store: Store; setStore: (s: Store) => void; today: string; loadDemo: () => void }) {
  const [flash, setFlash] = useFlash();
  const [editId, setEditId] = useState<string | null>(null);
  const editing = store.habits.find((h) => h.id === editId);
  const remove = (h: Habit) => {
    if (!window.confirm(`Delete “${h.name}” and its check-in history?`)) return;
    const { [h.id]: _removed, ...rest } = store.checkins;
    void _removed;
    setStore({ habits: store.habits.filter((x) => x.id !== h.id), checkins: rest });
    setFlash({ kind: 'success', text: `Deleted “${h.name}”.` });
  };
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Habits</h1>
          <p>Create, edit or remove the habits you track.</p>
        </div>
        {store.habits.length === 0 && <button type="button" className="btn" onClick={loadDemo}>Load demo habits</button>}
      </div>
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <div className="layout-side">
        <HabitForm
          key={editId ?? 'new'}
          store={store}
          setStore={setStore}
          editing={editing}
          today={today}
          onDone={(msg) => {
            setFlash({ kind: 'success', text: msg });
            setEditId(null);
          }}
        />
        {store.habits.length === 0 ? (
          <EmptyState title="Nothing tracked yet">Your habits will be listed here with their streaks.</EmptyState>
        ) : (
          <ul className="list card">
            {store.habits.map((h) => (
              <li key={h.id} className="row row-between">
                <span className="row">
                  <span className="dot" style={{ background: h.color }} />
                  <a href={`#/habit/${h.id}`}>{h.name}</a>
                  <StreakBadge n={currentStreak(h, store.checkins, today)} />
                </span>
                <span className="row">
                  <button type="button" className="btn btn-sm" onClick={() => setEditId(h.id)} aria-label={`Edit ${h.name}`}>Edit</button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(h)} aria-label={`Delete ${h.name}`}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {editing && <button type="button" className="btn btn-ghost" onClick={() => setEditId(null)}>Cancel editing</button>}
    </div>
  );
}

function Detail({ store, setStore, id, today }: { store: Store; setStore: (s: Store) => void; id: string; today: string }) {
  const h = store.habits.find((x) => x.id === id);
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [flash, setFlash] = useFlash();
  if (!h) return <EmptyState title="Habit not found" actions={<a className="btn btn-primary" href="#/habits">Back to habits</a>}>It may have been deleted.</EmptyState>;
  const cells = monthGrid(cursor.y, cursor.m);
  const rate = completionRate(h, store.checkins, today, 30);
  const missed = missedDays(h, store.checkins, addDays(today, -13), today, today);
  const move = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const toggle = (day: string) => {
    const r = toggleCheckin(store.checkins, h.id, day, today);
    if (r.error) return setFlash({ kind: 'error', text: r.error });
    setStore({ ...store, checkins: r.checkins });
  };
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <a href="#/today" className="small">← Today</a>
          <h1>{h.name}</h1>
          <p>{h.days.length === 7 ? 'Every day' : h.days.map((d) => DAY_NAMES[d]).join(', ')} · tracking since {formatDay(h.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Current streak</div><div className="stat-value">{currentStreak(h, store.checkins, today)}</div></div>
        <div className="stat"><div className="stat-label">Longest streak</div><div className="stat-value">{longestStreak(h, store.checkins, today)}</div></div>
        <div className="stat"><div className="stat-label">Last 30 days</div><div className="stat-value">{rate == null ? '—' : `${Math.round(rate * 100)}%`}</div></div>
        <div className="stat"><div className="stat-label">Missed (14 days)</div><div className="stat-value">{missed.length}</div></div>
      </div>
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <div className="grid-2">
        <div className="card">
          <div className="card-title-row">
            <h2>{new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
            <div className="row">
              <button type="button" className="btn btn-sm" onClick={() => move(-1)} aria-label="Previous month">←</button>
              <button type="button" className="btn btn-sm" onClick={() => move(1)} aria-label="Next month">→</button>
            </div>
          </div>
          <div className="month" role="grid" aria-label="Check-in calendar">
            {DAY_NAMES.map((d) => <div key={d} className="month-head" role="columnheader">{d}</div>)}
            {cells.map((c, i) =>
              c ? (
                <button
                  key={c}
                  type="button"
                  className={`month-day st-${dayState(h, store.checkins, c, today)}`}
                  style={{ ['--c' as string]: h.color }}
                  onClick={() => toggle(c)}
                  aria-label={`${formatDay(c, { day: 'numeric', month: 'long' })}: ${dayState(h, store.checkins, c, today)}`}
                >
                  {Number(c.slice(8))}
                </button>
              ) : (
                <span key={`e${i}`} />
              ),
            )}
          </div>
          <div className="legend small">
            <span><i className="st-done" style={{ ['--c' as string]: h.color }} /> Done</span>
            <span><i className="st-missed" /> Missed</span>
            <span><i className="st-off" /> Rest day</span>
          </div>
        </div>
        <div className="card">
          <h2>Missed in the last two weeks</h2>
          {missed.length === 0 ? (
            <p>No missed days. Nicely done.</p>
          ) : (
            <ul className="list">
              {missed.map((d) => (
                <li key={d} className="row row-between">
                  {formatDay(d, { weekday: 'long', day: 'numeric', month: 'short' })}
                  <button type="button" className="btn btn-sm" onClick={() => toggle(d)}>Mark as done</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stats({ store, today }: { store: Store; today: string }) {
  const [monday, setMonday] = useState(weekStart(today));
  if (store.habits.length === 0)
    return <EmptyState title="No statistics yet" actions={<a className="btn btn-primary" href="#/habits">Create a habit</a>}>Statistics appear once you track at least one habit.</EmptyState>;
  const week = weekSummary(store.habits, store.checkins, monday, today);
  const totalSched = week.filter((d) => !d.future).reduce((n, d) => n + d.scheduled, 0);
  const totalDone = week.reduce((n, d) => n + d.done, 0);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Week of {formatDay(monday, { day: 'numeric', month: 'long' })}</h1>
          <p data-testid="week-rate">{totalSched === 0 ? 'No scheduled check-ins so far this week.' : `${totalDone} of ${totalSched} scheduled check-ins done (${Math.round((totalDone / totalSched) * 100)}%)`}</p>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => setMonday(addDays(monday, -7))}>← Previous week</button>
          <button type="button" className="btn" onClick={() => setMonday(addDays(monday, 7))} disabled={addDays(monday, 7) > today}>Next week →</button>
        </div>
      </div>
      <div className="card">
        <h2>Check-ins per day</h2>
        <div className="bars" role="img" aria-label="Bar chart of completed check-ins per day this week">
          {week.map((d) => (
            <div key={d.day} className="bar-col">
              <div className="bar-track">
                <div className="bar-sched" style={{ height: `${(d.scheduled / Math.max(1, store.habits.length)) * 100}%` }}>
                  <div className="bar-done" style={{ height: d.scheduled ? `${(d.done / d.scheduled) * 100}%` : 0 }} />
                </div>
              </div>
              <span className="small">{formatDay(d.day, { weekday: 'short' })}</span>
              <span className="hint">{d.future ? '—' : `${d.done}/${d.scheduled}`}</span>
            </div>
          ))}
        </div>
        <p className="hint">Light bar: habits scheduled that day. Dark fill: habits completed.</p>
      </div>
      <div className="card">
        <h2>By habit</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Habit</th><th className="num">This week</th><th className="num">30-day rate</th><th className="num">Streak</th></tr></thead>
            <tbody>
              {store.habits.map((h) => {
                const days = week.filter((d) => !d.future && isScheduled(h, d.day));
                const done = days.filter((d) => isDone(store.checkins, h.id, d.day)).length;
                const rate = completionRate(h, store.checkins, today);
                return (
                  <tr key={h.id}>
                    <td><a href={`#/habit/${h.id}`}>{h.name}</a></td>
                    <td className="num">{done}/{days.length}</td>
                    <td className="num">{rate == null ? '—' : `${Math.round(rate * 100)}%`}</td>
                    <td className="num">{currentStreak(h, store.checkins, today)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
