# Memory Engine — Stack & Data Segment Visualizer

Vanilla JS port of the CodeLens React memory visualization engine.
Renders step-by-step stack frames, variables, arrays, and the data segment
(global/static variables) as code executes.

## Files

| File                        | Role                                                      |
|-----------------------------|-----------------------------------------------------------|
| `visualization-engine.js`   | State machine — processes step JSON, maintains memory state |
| `visualization-renderer.js` | DOM renderer — turns engine state into visible HTML        |

**Globals exposed:**
- `window.VisualizationEngine`
- `window.VisualizationRenderer`

**Dependencies:** `config.js` must be loaded first (`escapeHtml` global).

---

## How It Works

```
AnimationController.renderStep(idx)
        │
        ▼
VisualizationEngine.executeUpTo(steps, idx)
        │  ← replays all steps[0..idx-1] from scratch
        │  ← returns state object
        ▼
VisualizationRenderer.render(state)
        │  ← reads state.stackFrames + state.dataSegmentFrames
        │  ← writes DOM inside #visStackColumn and #visDataSegment
        ▼
     User sees live memory panels
```

---

## visualization-engine.js

### State Shape

```js
{
  currentStep:        number,
  totalSteps:         number,
  activeLine:         number | null,
  description:        string,
  stackFrames:        StackFrame[],
  dataSegment:        Variable[],      // flat list (backward compat)
  dataSegmentFrames:  DSFrame[],       // grouped by Global / Static
  terminalOutput:     string,
  returnValue:        any,
  isLoaded:           boolean
}
```

**StackFrame shape:**
```js
{
  id:           string,    // unique, e.g. "frame_main_1"
  functionName: string,
  variables:    Variable[],
  isTemporary:  boolean,   // true for printf/temp frames
  isGlobal:     boolean,
  isStatic:     boolean
}
```

**Variable shape:**
```js
{
  name:         string,
  type:         string,    // 'int', 'float', 'char', etc.
  value:        any,
  address:      string,    // e.g. "0x7fff5abc"
  size:         string,    // e.g. "4 bytes"
  isHighlighted:boolean,
  elements:     Element[] | null,   // for arrays
  rows:         number | null,      // for 2D arrays
  cols:         number | null,
  total_size:   string | null,
  base_address: string | null
}
```

### Public API

| Method | Description |
|---|---|
| `executeUpTo(steps, targetStep)` | Replays all steps from scratch up to `targetStep` (1-based). Returns the full state object. |
| `executeStep(stepData)` | Process a single step object against current state. |
| `reset()` | Clear all state back to initial. |
| `getState()` | Returns current state reference. |
| `createInitialState()` | Returns a fresh empty state object. |

### Supported `stack_update` Actions

| Action | Description |
|---|---|
| `create_stack_frame` | Push a new function frame (with optional variables) |
| `create_temporary_stack_frame` | Push a temporary frame (printf, etc.) auto-removed next step |
| `update_variable` | Update a variable value by name or address |
| `update_multiple_variables` | Update several variables in one step |
| `update_array` | Replace full elements list for an array |
| `update_array_element` | Update one element of a 1D array by index |
| `update_2d_array` | Replace full elements list for a 2D array |
| `update_2d_array_element` | Update one element of a 2D array by row+col |
| `clear_frame` / `remove_stack_frame` | Pop a named function frame |
| `clear_all_frames` | Remove all stack frames (data segment persists) |

### `data_segment_update` Action

| Action | Description |
|---|---|
| `create_data_segment_variable` | Add a global or static variable to the data segment panel |

### Step JSON Format

```json
{
  "step": 3,
  "line": 7,
  "description": "x is assigned 5",
  "stack_update": {
    "action": "update_variable",
    "variable_name": "x",
    "variable_value": 5,
    "address": "0x7fff1000"
  },
  "data_segment_update": null,
  "terminal_update": null,
  "return_value": null
}
```

### Variable Lookup

Variables are located by **address first** (exact match), then by **name** (most recent frame first for stack, top-down for data segment). This handles shadowed variable names correctly.

### Immutable-Style Updates

All state mutations use `Object.assign({}, ...)` to create new objects. Arrays are replaced with new arrays. This makes it safe to replay from step 0 on every `executeUpTo` call without residual state.

---

## visualization-renderer.js

### DOM Targets

| Element selector | Renders |
|---|---|
| `#visStackColumn .vis-memory-container` | Stack frames |
| `#visDataSegment .vis-memory-container` | Global / Static data segment |
| `#visTerminalWindow` | Terminal output floating window |
| `#visTerminalContent` | Terminal lines |

### Public API

| Method | Description |
|---|---|
| `init()` | Locate DOM containers. Called automatically on first `render()`. |
| `render(state)` | Full re-render from engine state. Called by AnimationController. |
| `clear()` | Empty all panels and hide terminal. |

### Stack Frame Layout

Frames are rendered **left-to-right**, with index 0 (typically `main`) on the far left and the most recently called function on the far right. The rightmost/topmost frame gets the `vis-stack-frame--top` CSS class and `id="vis-active-frame"`.

```
[ main() ]  →  [ factorial(5) ]  →  [ factorial(4) ]  (active)
```

After rendering, the active frame is scrolled into view with `scrollIntoView({ inline: 'center' })`.

### Variable Rendering

| Variable type | Renderer |
|---|---|
| Scalar (`int`, `char`, etc.) | Name + size badge + value box + address |
| 1D array | Name header + horizontal cell row with index, value, address per cell |
| 2D array | Name + dimensions header + grid with row/col labels |

Highlighted variables (`isHighlighted: true`) get the `--highlighted` modifier CSS class on name, value, and container.

Garbage values render as `?` instead of `(garbage)`.

### Terminal Panel

The terminal is a macOS-style floating window (`#visTerminalWindow`). It shows when `state.terminalOutput` is non-empty and hides otherwise.

Format:
```
$ <output text>
$ ▌         ← blinking cursor line
```

### CSS Classes Reference

| Class | Description |
|---|---|
| `.vis-stack-frame` | One function call frame |
| `.vis-stack-frame--top` | Active (topmost) frame |
| `.vis-stack-frame--temp` | Temporary frame (printf, etc.) |
| `.vis-frame-header` | Frame title bar |
| `.vis-frame-body` | Variables container |
| `.vis-var-box` | One variable row |
| `.vis-var-box--highlighted` | Currently updated variable |
| `.vis-var-name`, `.vis-var-value`, `.vis-var-size`, `.vis-var-addr` | Variable sub-elements |
| `.vis-array-1d` | 1D array wrapper |
| `.vis-array-cell` | One array element cell |
| `.vis-array-cell--highlighted` | Currently updated cell |
| `.vis-array-2d` | 2D array wrapper |
| `.vis-array-2d-grid` | Grid container |
| `.vis-ds-frame` | Data segment frame wrapper |
| `.vis-ds-frame--global` | Global variables frame |
| `.vis-ds-frame--static` | Static variables frame |
| `.vis-term-line` | One terminal output line |
| `.vis-term-prompt` | The `$` prompt symbol |

---

## Example JSON Step (Full)

```json
{
  "step": 1,
  "line": 3,
  "description": "Function main() called, x declared",
  "stack_update": {
    "action": "create_stack_frame",
    "function_name": "main",
    "stack_data_frame": {
      "no_of_data_frame": "create_1",
      "data_frame_1": {
        "variable_name": "x",
        "type": "int",
        "variable_value": 0,
        "address": "0x7fff1000",
        "size": "4 bytes"
      }
    }
  },
  "data_segment_update": null,
  "terminal_update": null,
  "return_value": null
}
```

```json
{
  "step": 5,
  "line": 9,
  "description": "Global counter incremented",
  "stack_update": null,
  "data_segment_update": {
    "action": "create_data_segment_variable",
    "global_data": {
      "variable_name": "counter",
      "type": "int",
      "variable_value": 1,
      "address": "0x601030",
      "size": "4 bytes"
    }
  },
  "terminal_update": null,
  "return_value": null
}
```
