# D.S Engine — Data Structure Visualizer

Vanilla JS port of the CodeLens React data structure visualization engine.
Renders step-by-step arrays (1D, 2D), pointers, cell states, info sidebars,
and terminal output as algorithms execute.

## Files

| File              | Role                                                           |
|-------------------|----------------------------------------------------------------|
| `ds-engine.js`    | State machine — processes step JSON, maintains DS state        |
| `ds-renderer.js`  | DOM renderer — turns engine state into visible HTML            |

**Globals exposed:**
- `window.DSEngine`
- `window.DSRenderer`

**Dependencies:** `config.js` must be loaded first (`escapeHtml` global).

---

## How It Works

```
AnimationController.renderStep(idx)
        │   ← detects ds_update in step → DS path
        ▼
DSEngine.executeUpTo(steps, idx)
        │  ← replays all steps[0..idx-1] from scratch
        │  ← returns state object
        ▼
DSRenderer.render(state)
        │  ← reads state.arrays + state.pointers etc.
        │  ← writes DOM into #dsVisualizerContainer
        ▼
     User sees live array / matrix / pointer panels
```

---

## ds-engine.js

### State Shape

```js
{
  currentStep:    number,
  totalSteps:     number,
  activeLine:     number | null,
  description:    string,
  arrays:         DSArray[],       // all named arrays
  pointers:       Pointer[],       // named pointer variables
  activePointers: Pointer[],       // currently highlighted pointers
  terminalOutput: string,
  infoSidebar: {
    title:        string,
    items:        InfoItem[]
  },
  isLoaded:       boolean
}
```

**DSArray shape:**
```js
{
  name:      string,          // e.g. "arr"
  label:     string | null,   // display label override
  type:      string,          // 'array' | 'matrix'
  elements:  Element[],       // flat list (1D) or row-major flat list (2D)
  rows:      number | null,   // 2D only
  cols:      number | null,   // 2D only
  size:      number
}
```

**Element shape (1D):**
```js
{
  index:    number,
  value:    any,
  state:    string,           // '' | 'active' | 'comparing' | 'sorted' | 'pivot' | 'swapping' | 'found' | etc.
  address:  string | null
}
```

**Element shape (2D):**
```js
{
  row:      number,
  col:      number,
  value:    any,
  state:    string
}
```

**Pointer shape:**
```js
{
  name:      string,          // e.g. "i", "j"
  value:     number | null,   // current array index the pointer is at
  target:    string | null,   // name of the array this pointer belongs to
  isActive:  boolean
}
```

**InfoItem shape:**
```js
{
  key:   string,   // label, e.g. "Comparisons"
  value: string    // display value
}
```

### Public API

| Method | Description |
|---|---|
| `executeUpTo(steps, targetStep)` | Replays all steps from scratch up to `targetStep` (1-based). Returns state object. |
| `executeStep(stepData)` | Process a single step object against current state. |
| `reset()` | Clear all state back to initial. |
| `getState()` | Returns current state reference. |
| `createInitialState()` | Returns a fresh empty state object. |

### Supported `ds_update` Actions

| Action | Description |
|---|---|
| `create_array` | Create a named 1D array with initial values |
| `create_2d_array` | Create a named 2D array (matrix) with rows × cols |
| `update_element` | Update value + state of a single element by index |
| `update_element_state` | Update only the state of a single element |
| `update_multiple_elements` | Batch update for multiple indices in one step |
| `reset_states` | Reset all cell states to `''` (neutral) |
| `swap_elements` | Swap two elements and set their state to `'swapping'` |
| `update_pointer` | Create or move a named pointer to a new index |
| `update_multiple_pointers` | Batch update for several pointers |
| `remove_pointer` | Remove a pointer from state |
| `clear_pointers` | Remove all pointers |
| `update_info_sidebar` | Replace the sidebar info panel items |

### Step JSON Format

```json
{
  "step": 2,
  "line": 5,
  "description": "i pointer moves to index 3",
  "ds_update": {
    "action": "update_pointer",
    "pointer_name": "i",
    "pointer_value": 3,
    "target_array": "arr"
  },
  "terminal_update": null
}
```

### Cell States Reference

These are the standard state values for `element.state`:

| State | Typical styling |
|---|---|
| `''` (empty) | Default neutral colour |
| `'active'` | Primary highlight — current element |
| `'comparing'` | Two elements being compared |
| `'sorted'` | Permanently placed in sorted position |
| `'pivot'` | Pivot element in quicksort-style algorithms |
| `'swapping'` | Elements mid-swap |
| `'found'` | Target found (search algorithms) |
| `'visited'` | Already processed |
| `'current'` | Current traversal position |
| `'min'` / `'max'` | Minimum or maximum tracker |
| `'left'` / `'right'` / `'mid'` | Binary search boundary markers |

The CSS classes applied are `ds-cell--<state>`, defined in the project stylesheet.

### normalizeArrayData()

When elements arrive from JSON they may be objects or plain values. `normalizeArrayData()` normalises them into the full element shape, assigning default `state: ''` and sequential `index` / `row`+`col` values. Called automatically inside `create_array` and `create_2d_array` handlers.

### resetArrayStates()

Iterates every element in every array and sets `state: ''`. Called by the `reset_states` action. Useful at the end of a pass in sorting algorithms before highlighting the next pass.

---

## ds-renderer.js

### DOM Target

| Selector | Renders |
|---|---|
| `#dsVisualizerContainer` | All arrays, matrices, pointers, sidebars |
| `#dsTerminalWindow` | Terminal output floating window |
| `#dsTerminalContent` | Terminal lines |

### Public API

| Method | Description |
|---|---|
| `init()` | Locate DOM containers. Called automatically on first `render()`. |
| `render(dsState)` | Full re-render from engine state. Called by AnimationController. |
| `clear()` | Empty all panels and hide terminal. |

### Public Utility

| Method | Description |
|---|---|
| `getCellStateClass(state)` | Returns the CSS modifier class string for a given cell state value. |

### Layout Logic

```
┌──────────────────────────────────┬────────────────┐
│  Array / Matrix panels           │  Info Sidebar  │
│  (one per state.arrays entry)    │  (key-value    │
│                                  │   stats)       │
└──────────────────────────────────┴────────────────┘
                  ↕
        Pointers rendered as arrows
        under the array they target
```

- If `state.arrays` has exactly **one** 1D array → single array layout
- If `state.arrays` has **multiple** 1D arrays → multi-array stacked layout
- If array `type === 'matrix'` → 2D grid layout (regardless of count)
- Sidebar renders if `state.infoSidebar.items.length > 0`

### Pointer Rendering

Pointers are drawn as SVG arrow labels below the array row. Each pointer name is placed above the cell at its target index. Multiple pointers at the same index are stacked vertically.

```
[ 12 ][ 7  ][ 3  ][ 45 ][ 9  ]
           ↑           ↑
           j           i
```

### Terminal Panel

Identical to the Memory Engine terminal. Shows when `state.terminalOutput` is non-empty. Uses the same `$` prompt + blinking cursor format.

### CSS Classes Reference

| Class | Description |
|---|---|
| `.ds-array-wrapper` | Outer wrapper for one array panel |
| `.ds-array-label` | Array name / label header |
| `.ds-array-row` | Row of cells for 1D array |
| `.ds-array-cell` | Single value cell |
| `.ds-array-cell--active` | Active cell (current element) |
| `.ds-array-cell--comparing` | Cell being compared |
| `.ds-array-cell--sorted` | Cell in final sorted position |
| `.ds-array-cell--pivot` | Pivot cell |
| `.ds-array-cell--swapping` | Cell mid-swap |
| `.ds-array-cell--found` | Search target found |
| `.ds-array-cell--visited` | Already processed cell |
| `.ds-array-cell--min` / `--max` | Min/max tracker cell |
| `.ds-array-cell--left` / `--right` / `--mid` | Binary search boundary cells |
| `.ds-index-label` | Index number label under each cell |
| `.ds-pointer-row` | Container row for pointer arrows |
| `.ds-pointer-arrow` | One pointer label with arrow |
| `.ds-matrix-grid` | CSS grid for 2D array |
| `.ds-matrix-cell` | One cell in a 2D matrix |
| `.ds-matrix-row-label` | Row index label |
| `.ds-matrix-col-label` | Column index label |
| `.ds-info-sidebar` | Stats/info panel on the right |
| `.ds-info-item` | One key-value row in sidebar |
| `.ds-info-key` | Left label |
| `.ds-info-value` | Right value |
| `.ds-term-line` | One terminal output line |
| `.ds-term-prompt` | The `$` prompt symbol |

---

## Example JSON Steps

### Sorting — create array + set pivot:
```json
{
  "step": 1,
  "line": 2,
  "description": "Array initialised",
  "ds_update": {
    "action": "create_array",
    "array_name": "arr",
    "array_data": [64, 25, 12, 22, 11]
  }
}
```

```json
{
  "step": 4,
  "line": 8,
  "description": "Pivot selected at index 2",
  "ds_update": {
    "action": "update_element_state",
    "array_name": "arr",
    "index": 2,
    "state": "pivot"
  }
}
```

### Swap two elements:
```json
{
  "step": 7,
  "line": 14,
  "description": "Swap arr[1] and arr[4]",
  "ds_update": {
    "action": "swap_elements",
    "array_name": "arr",
    "index1": 1,
    "index2": 4
  }
}
```

### Move pointer:
```json
{
  "step": 9,
  "line": 16,
  "description": "j advances to index 3",
  "ds_update": {
    "action": "update_pointer",
    "pointer_name": "j",
    "pointer_value": 3,
    "target_array": "arr"
  }
}
```

### Update info sidebar:
```json
{
  "step": 12,
  "line": 20,
  "description": "Pass complete",
  "ds_update": {
    "action": "update_info_sidebar",
    "title": "Bubble Sort Stats",
    "items": [
      { "key": "Pass", "value": "2" },
      { "key": "Comparisons", "value": "15" },
      { "key": "Swaps", "value": "6" }
    ]
  }
}
```

### 2D matrix:
```json
{
  "step": 1,
  "line": 3,
  "description": "Matrix created",
  "ds_update": {
    "action": "create_2d_array",
    "array_name": "matrix",
    "rows": 3,
    "cols": 3,
    "array_data": [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ]
  }
}
```
