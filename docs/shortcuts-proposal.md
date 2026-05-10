# Duomo Keyboard-First Overhaul Proposal

**Goal:** Build a unified, discoverable, and enforceable hotkey system that makes Duomo the undisputed keyboard-first email client — better than Tatem.

---

## 1. Current State (The Problems)

After auditing the codebase, the hotkey layer has **seven major weaknesses** that Tatem does not have (or has solved):

### 1.1 Fragmentation — No Single Source of Truth
Shortcuts are defined in **~12 different files**:
- `use-mail-hotkeys.ts` — inbox list actions (j, k, e, u, c, /)
- `use-mailbox-hotkeys.ts` — global navigation (g i, g s, mod+1..9)
- `email-detail-view.tsx` — detail view (j, k, r, f, e, #, s, u, esc)
- `triage-page.tsx` — triage (e, r, c, s, t, #, arrows, esc)
- `todo-page.tsx` — todo (j, k, e, del, a, u, c, /)
- `sidebar.tsx` — mod+b
- `use-command-palette-state.ts` — mod+k
- `compose-email-fields.tsx` — o, c, b, s, m, mod+enter
- `keyboard-shortcuts-dialog.tsx` — a **manually-maintained** copy of the above
- `landing-page.tsx` — another **manually-maintained** copy for marketing
- `email-commands.ts` — command-palette entries with `shortcut` fields

**Consequence:** When a developer changes `e` from "archive" to "done" in one hook, the help dialog, command palette, and landing page all become stale. This is already happening (the dialog says "Mark as done" while the code calls it "archive" in some places).

### 1.2 Inconsistent API Surface
- Some hooks pass raw functions: `useHotkeys({ e: () => ... })`
- Some pass objects: `useHotkeys({ e: { onKeyDown: () => ..., enabled: ... } })`
- Some manually call `event.preventDefault()` inside handlers
- Some use `$mod`, some hardcode platform detection

### 1.3 Zero Conflict Detection
If two components in overlapping DOM trees register the same key (e.g. `s` for both "star" and "snooze"), `tinykeys` simply fires both. There is no dev-time warning.

### 1.4 Static Discovery
The only discovery mechanism is a `?` dialog that opens a static, manually-curated list. It is:
- Not searchable
- Not context-aware (shows "Compose" shortcuts even when you're reading an email)
- Not linked to the actual code

### 1.5 No In-Context Hints
Buttons and menus that have shortcuts do not pull them from a registry. They manually add `<Kbd>` children. If the shortcut changes, the button lies.

### 1.6 No Adoption Mechanics
There is no system to:
- Teach users shortcuts progressively
- Show a hint when a mouse action could have been a keypress
- Celebrate or track shortcut usage

### 1.7 Missing Power-User Primitives (Where Tatem Wins)
- **Bulk selection:** No `x` to select, then `e` to archive 5 threads at once
- **Jumping:** No `gg` / `G` to jump to top/bottom of a list
- **Multi-step:** No `5j` to move 5 items down
- **Shift-selection:** No `Shift+J/K` to select a range
- **Visual command bar:** No bottom bar that updates as context changes

---

## 2. Proposed Architecture

### 2.1 Core Principle: The Registry

Create a single, typed registry that is the **only** place a shortcut is defined. Everything else — the help dialog, the command palette, the landing page, button hints — derives from it.

```
src/frontend/lib/shortcuts/
  types.ts       — Shared types (Shortcut, ShortcutContext, etc.)
  registry.ts    — THE source of truth
  contexts.ts    — Context definitions (inbox, detail, triage, global, etc.)
  resolver.ts    — Runtime: which shortcuts are active right now?
  hints.ts       — "You just clicked Archive — try pressing E"
```

### 2.2 Hook Replacement

Replace the ad-hoc `useHotkeys({ ... })` calls with:

```ts
const { bindings } = useShortcuts("inbox", { groups, onOpen, onAction, ... });
```

This hook:
1. Looks up the `inbox` context in the registry
2. Generates the `tinykeys`-compatible binding map
3. Calls `useHotkeys` internally
4. **In dev mode**, warns if two active contexts define the same key

### 2.3 Auto-Generated Help Dialog

`KeyboardShortcutsDialog` becomes:

```tsx
const groups = useShortcutGroupsForActiveContexts();
```

It reads the registry, filters by currently-active contexts, and renders. Never manually updated again.

### 2.4 Context-Aware Bottom Bar

Add a thin, optional bar at the bottom of the screen (like Vimium's HUD or Tatem's footer) that shows the 4-6 most relevant shortcuts for the current view. It updates instantly as you navigate.

Example:
```
[J/K] Next/Prev  [E] Done  [R] Reply  [C] Compose  [?] All shortcuts
```

### 2.5 Hint System

When a user performs a mouse action that has a keyboard equivalent, show a micro-toast:

> 💡 **Tip:** You can also press `E` to mark as done.

This is driven by a `hintIfShortcutExists(actionId)` utility.

### 2.6 Onboarding Flow

A 3-step interactive tutorial that triggers on first login:
1. "Press `J` to move down" (highlights the key on screen)
2. "Press `E` to archive this email"
3. "Press `?` anytime to see all shortcuts"

Completion gives a small badge in settings.

### 2.7 Dev-Time Enforcement

Add an ESLint rule or a simple unit test that:
- Parses all `registerShortcut()` calls
- Ensures no duplicate keys exist in the same context
- Ensures every shortcut in the registry has a corresponding entry in the command palette (if applicable)
- Ensures the landing-page shortcut list is auto-generated, not hardcoded

---

## 3. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create `src/frontend/lib/shortcuts/` with `types.ts`, `registry.ts`, `contexts.ts`
- [ ] Build `useShortcuts(context, options)` hook
- [ ] Refactor `keyboard-shortcuts-dialog.tsx` to be registry-driven
- [ ] Refactor `use-mail-hotkeys.ts` as the first proof-of-concept
- [ ] Add dev-mode conflict warning in `useShortcuts`

### Phase 2: Coverage (Week 2)
- [ ] Migrate all `useHotkeys` call sites to `useShortcuts`
- [ ] Delete all manual `<Kbd>` in buttons; replace with `<ShortcutButton actionId="...">`
- [ ] Auto-generate landing-page shortcuts from registry (or export a JSON at build time)
- [ ] Ensure command palette `shortcut` fields pull from registry

### Phase 3: Power User Features (Week 3)
- [ ] Implement `x` (select) + bulk actions (`e`, `#`, `s`, `u`)
- [ ] Implement `gg` / `G` / `Shift+G` for list jumping
- [ ] Implement `5j` / `5k` numeric prefixes for repeated motion
- [ ] Add `Shift+J/K` range selection in lists

### Phase 4: Adoption & Polish (Week 4)
- [ ] Build context-aware bottom hint bar
- [ ] Build mouse-action → shortcut hint toast system
- [ ] Build 3-step onboarding modal
- [ ] Add analytics/logging for shortcut usage (optional, privacy-respecting)

---

## 4. Registry Schema (Draft)

```ts
export type ShortcutContext =
  | "global"
  | "inbox-list"
  | "email-detail"
  | "triage"
  | "todo"
  | "compose"
  | "command-palette";

export interface ShortcutDefinition {
  id: string;                 // e.g. "inbox:archive"
  key: string;                // tinykeys format: "e", "$mod+k", "g i"
  label: string;              // human readable: "Mark as done"
  category: string;           // "Navigation", "Actions", "Compose"
  contexts: ShortcutContext[]; // where this shortcut is active
  allowInEditable?: boolean;
  preventDefault?: boolean;
}

export interface ShortcutRegistry {
  register(def: ShortcutDefinition): void;
  getByContext(ctx: ShortcutContext): ShortcutDefinition[];
  getByKey(key: string, ctx: ShortcutContext): ShortcutDefinition | undefined;
  getAll(): ShortcutDefinition[];
}
```

---

## 5. Why This Eats Tatem

| Feature | Tatem | Current Duomo | Proposed Duomo |
|---------|-------|---------------|----------------|
| Single source of truth | Partial | No | **Yes** |
| Context-aware help | Basic | No | **Yes** |
| Bottom hint bar | No | No | **Yes** |
| Bulk selection (x + e) | Yes | No | **Yes** |
| Motion counts (5j) | No | No | **Yes** |
| In-context button hints | No | Partial | **Yes** |
| Progressive onboarding | No | No | **Yes** |
| Mouse-action tips | No | No | **Yes** |
| Auto-generated marketing | N/A | No | **Yes** |

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing muscle memory | Phase 1 keeps all existing key mappings; only the *implementation* changes |
| Performance overhead of registry lookup | Registry is a flat map; lookup is O(1). Hook memoizes bindings. |
| `tinykeys` string format quirks | Registry normalizes keys (e.g. `Mod` → `$mod`) before passing to `useHotkeys` |
| Mobile confusion | Bottom bar and hints are desktop-only. Shortcuts don't show on mobile. |

---

## 7. Decision Needed

Before Phase 1 starts, we need to decide:

1. **Scope:** Do we want to migrate *all* shortcuts in one PR, or feature-by-feature?
2. **Naming:** Should we call the system `shortcuts`, `hotkeys`, or `keymap` consistently?
3. **Power features:** Is `5j` overkill for our user base, or is it a differentiator?
4. **Onboarding priority:** Should the hint bar come before bulk selection, or after?

**Recommendation:** Start with Phase 1 immediately. The registry + auto-generated dialog alone eliminates a major maintenance burden and prevents the marketing site from drifting out of sync with the product.
