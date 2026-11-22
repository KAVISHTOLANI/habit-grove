import { useState } from 'react';
import { DemoTag, EmptyState, Field, Landing, NotFound, Notice, Shell, uid, useFlash, usePersistentState, useRoute } from './shared/ui';
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
  const start = addDays(today, -83);
  const habits: Habit[] = [
    { id: 'demo-1', name: 'Demo: Walk 20 minutes', color: '#2a6b45', days: [0, 1, 2, 3, 4, 5, 6], createdAt: start, demo: true },
    { id: 'demo-2', name: 'Demo: Practise Spanish', color: '#2563eb', days: [0, 1, 2, 3, 4], createdAt: start, demo: true },
    { id: 'demo-3', name: 'Demo: Stretch', color: '#be185d', days: [0, 2, 4], createdAt: start, demo: true },
    { id: 'demo-4', name: 'Demo: Call a friend or family member (weekends only)', color: '#7c3aed', days: [5, 6], createdAt: addDays(today, -6), demo: true },
  ];
  // Deterministic pattern so the demo has real streaks and gaps.
  const checkins: Checkins = { 'demo-1': [], 'demo-2': [], 'demo-3': [], 'demo-4': [] };
  for (let i = 1; i < 84; i++) {
    const d = addDays(today, -i);
    if (i % 6 !== 0) checkins['demo-1'].push(d);
    if (i % 4 !== 3) checkins['demo-2'].push(d);
    if (i > 5 && i % 11 !== 0) checkins['demo-3'].push(d);
  }
  for (const k of Object.keys(checkins)) checkins[k] = checkins[k].filter((d) => isScheduled(habits.find((h) => h.id === k)!, d)).sort();
  return { habits, checkins };
}

export default function App() {
  const [route] = useRoute();
  const [store, setStore] = usePersistentState<Store>('habit-grove:store', () => demoStore(toISO(new Date())));
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
    <Shell name="Habit Grove" wordmark={['Habit', 'Grove']} nav={NAV} route={route} cta={{ to: '/today', label: 'Check in today' }}>
      {page}
    </Shell>
  );
}

/** Overall completion per day: done ÷ scheduled across all habits. */
export function heatmapDays(store: Store, today: string, weeks = 12) {
  const end = addDays(weekStart(today), 6);
  const startDay = addDays(weekStart(today), -(weeks - 1) * 7);
  const out: { day: string; ratio: number | null; done: number; due: number }[] = [];
  for (let d = startDay; d <= end; d = addDays(d, 1)) {
    const due = store.habits.filter((h) => isScheduled(h, d));
    const done = due.filter((h) => isDone(store.checkins, h.id, d)).length;
    out.push({ day: d, ratio: d > today || due.length === 0 ? null : done / due.length, done, due: due.length });
  }
  return out;
}

export function Heatmap({ store, today, weeks = 12 }: { store: Store; today: string; weeks?: number }) {
  const days = heatmapDays(store, today, weeks);
  const level = (r: number | null) => (r == null ? 'none' : r === 0 ? 'l0' : r < 0.34 ? 'l1' : r < 0.67 ? 'l2' : r < 1 ? 'l3' : 'l4');
  return (
    <figure className="heatmap-fig">
      <div className="heatmap" role="img" aria-label={`Check-in heatmap for the last ${weeks} weeks. Darker squares mean more of that day's habits were completed.`}>
        {DAY_NAMES.map((d, i) => <span key={d} className="hm-day-label" style={{ gridRow: i + 1 }}>{i % 2 === 0 ? d : ''}</span>)}
        {days.map((d, i) => (
          <span
            key={d.day}
            className={`hm-cell ${level(d.ratio)} ${d.day === today ? 'is-today' : ''}`}
            style={{ gridRow: (i % 7) + 1, gridColumn: Math.floor(i / 7) + 2, ['--i' as string]: Math.floor(i / 7) }}
            title={`${formatDay(d.day, { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.ratio == null ? (d.day > today ? 'upcoming' : 'nothing scheduled') : `${d.done} of ${d.due} done`}`}
          />
        ))}
      </div>
      <figcaption className="legend small">
        <span>Less</span>
        {['l0', 'l1', 'l2', 'l3', 'l4'].map((l) => <i key={l} className={`hm-cell ${l}`} />)}
        <span>More</span>
        <span className="muted">· hover a square for the day’s count</span>
      </figcaption>
    </figure>
  );
}

function HeroGrove() {
  const today = toISO(new Date());
  const store = demoStore(today);
  return (
    <div className="hero-grove">
      <Heatmap store={store} today={today} />
      <ul className="streak-bars">
        {store.habits.slice(0, 3).map((h) => {
          const cur = currentStreak(h, store.checkins, today), best = longestStreak(h, store.checkins, today);
          return (
            <li key={h.id}>
              <span className="sb-name">{h.name.replace('Demo: ', '')}</span>
              <span className="sb-track"><span style={{ width: `${(cur / Math.max(best, 1)) * 100}%`, background: h.color }} /></span>
              <span className="sb-num">{cur}<small>/{best} best</small></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Home() {
  return (
    <Landing
      eyebrow="Habit tracker · streaks & history"
      title={<>Small habits, <em>tracked honestly.</em></>}
      lead="Choose the days each habit is due, check in when you do it, and watch the grid fill in. Rest days never break a streak, and today stays open until it’s over."
      primary={{ href: '#/today', label: 'Go to today' }}
      secondary={{ href: '#/stats', label: 'Explore the stats' }}
      previewLabel="Last 12 weeks — demo habits"
      preview={<HeroGrove />}
      steps={[
        { title: 'Create a habit', body: 'Name it and pick the days it applies — every day, weekdays, or a custom set.' },
        { title: 'Check in', body: 'Tick it off on the Today page, or backfill a day from the past week.' },
        { title: 'Review', body: 'See streaks, the month calendar and weekly completion for each habit.' },
      ]}
      stepsIntro="Habit Grove opens with four labelled demo habits and twelve weeks of history. Clear them whenever you are ready to start your own."
      features={[
        { title: 'Streaks that make sense', body: 'Rest days do not break a streak, and an unfinished today does not either.' },
        { title: 'Missed days', body: 'Each habit lists the scheduled days you missed in the last two weeks.' },
        { title: 'Calendar history', body: 'Month-by-month view with done, missed and rest days.' },
        { title: 'Weekly statistics', body: 'A heatmap, a per-day chart and a per-habit table for any week.' },
      ]}
      note="Data stays in this browser. Habit Grove does not send notifications or reminders."
      closing={{ title: <>Start with <em>one small habit.</em></>, action: { href: '#/habits', label: 'Create a habit' } }}
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
          <p className="eyebrow">Workspace · Today</p>
          <h1>{formatDay(today, { weekday: 'long' })}, <em>{formatDay(today, { day: 'numeric', month: 'long' })}</em></h1>
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
                  <a href={`#/habit/${h.id}`}><strong>{h.name.replace('Demo: ', '')}</strong></a> {h.demo && <DemoTag />}
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
          <p className="eyebrow">Workspace · Habits</p>
          <h1>Your <em>habits</em></h1>
          <p>Create, edit or remove the habits you track.</p>
        </div>
        {store.habits.length === 0 ? (
          <button type="button" className="btn" onClick={loadDemo}>Load demo habits</button>
        ) : store.habits.some((h) => h.demo) ? (
          <button type="button" className="btn" onClick={() => setStore({ habits: store.habits.filter((h) => !h.demo), checkins: Object.fromEntries(Object.entries(store.checkins).filter(([k]) => !k.startsWith('demo-'))) })}>Clear demo habits</button>
        ) : null}
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
          <p className="eyebrow"><a href="#/today">← Today</a> · Habit history</p>
          <h1>{h.name.replace('Demo: ', '')} {h.demo && <DemoTag />}</h1>
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
          <p className="eyebrow">Workspace · Weekly stats</p>
          <h1>Week of <em>{formatDay(monday, { day: 'numeric', month: 'long' })}</em></h1>
          <p data-testid="week-rate">{totalSched === 0 ? 'No scheduled check-ins so far this week.' : `${totalDone} of ${totalSched} scheduled check-ins done (${Math.round((totalDone / totalSched) * 100)}%)`}</p>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => setMonday(addDays(monday, -7))}>← Previous week</button>
          <button type="button" className="btn" onClick={() => setMonday(addDays(monday, 7))} disabled={addDays(monday, 7) > today}>Next week →</button>
        </div>
      </div>
      <div className="card">
        <h2>Last 12 weeks</h2>
        <Heatmap store={store} today={today} />
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
