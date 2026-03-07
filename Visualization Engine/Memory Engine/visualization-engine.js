/* ============================================
   Visualization Engine — Step-by-step memory visualization
   Handles Stack + Data Segment (no Heap).
   Port of CodeLens React engine to vanilla JS.
   Exposed globally as window.VisualizationEngine

   Architecture:
     - Maintains immutable-style state (stacks, data segment)
     - executeStep() processes one step JSON object
     - executeUpTo() replays all steps from scratch up to N
     - State drives VisualizationRenderer.render()

   Action types handled:
     create_stack_frame | create_temporary_stack_frame |
     update_variable | update_multiple_variables |
     update_array | update_array_element |
     update_2d_array | update_2d_array_element |
     clear_frame | remove_stack_frame | clear_all_frames |
     data_segment_update (global/static variables)
   ============================================ */
window.VisualizationEngine = (function () {
    'use strict';

    /* ------- State ------- */
    var state = createInitialState();

    function createInitialState() {
        return {
            currentStep: 0,
            totalSteps: 0,
            activeLine: null,
            description: '',
            stackFrames: [],        // [{id,functionName,variables,isTemporary,isGlobal,isStatic}]
            dataSegment: [],         // flat list of all DS vars (backward compat)
            dataSegmentFrames: [],   // [{id,functionName,variables,isGlobal,isStatic}]
            terminalOutput: '',
            returnValue: null,
            isLoaded: false
        };
    }

    function resetState() {
        var total = state.totalSteps;
        var loaded = state.isLoaded;
        state = createInitialState();
        state.totalSteps = total;
        state.isLoaded = loaded;
    }

    /* ------- ID generator ------- */
    var _frameCounter = 0;
    function generateFrameId(name) {
        _frameCounter++;
        return 'frame_' + name + '_' + _frameCounter;
    }

    /* ------- Data frame parser ------- */
    function parseDataFrames(dataFrame) {
        if (!dataFrame) return [];
        var variables = [];
        var m = (dataFrame.no_of_data_frame || '').match(/create_(\d+)/);
        var count = m ? parseInt(m[1], 10) : 0;
        for (var i = 1; i <= count; i++) {
            var fd = dataFrame['data_frame_' + i];
            if (!fd) continue;
            if (fd.variable_name) {
                var v = {
                    name: fd.variable_name,
                    type: fd.type || 'int',
                    value: fd.variable_value !== undefined ? fd.variable_value : '(garbage)',
                    address: fd.address || '',
                    size: fd.size || '',
                    isHighlighted: false,
                    elements: (function() {
                        var elems = fd.elements || null;
                        if (elems && Array.isArray(elems) && Array.isArray(elems[0])) {
                            // Nested 2D array [[{row,col,...},...],[...]] -> flatten
                            var flat = [];
                            elems.forEach(function(rowArr) {
                                if (Array.isArray(rowArr)) {
                                    rowArr.forEach(function(el) { flat.push(el); });
                                } else {
                                    flat.push(rowArr);
                                }
                            });
                            return flat;
                        }
                        return elems;
                    })(),
                    rows: fd.rows,
                    cols: fd.cols,
                    total_size: fd.total_size,
                    base_address: fd.base_address
                };
                variables.push(v);
            } else if (fd.Format_String) {
                variables.push({ name: 'FORMAT', type: 'string', value: fd.Format_String, isHighlighted: false, address: '', size: '' });
            } else if (fd.arg) {
                variables.push({ name: 'ARG', type: 'string', value: fd.arg, isHighlighted: false, address: '', size: '' });
            } else {
                var firstKey = Object.keys(fd)[0];
                if (firstKey) {
                    variables.push({ name: firstKey, type: 'unknown', value: fd[firstKey], isHighlighted: false, address: '', size: '' });
                }
            }
        }
        return variables;
    }

    /* ------- Variable locator ------- */
    function normalizeAddress(addr) {
        if (!addr) return null;
        return addr.toLowerCase().trim();
    }

    function findVariableLocation(name, address) {
        var normAddr = normalizeAddress(address);
        var fi, vi, dfi, dsi, frame;

        // By address — data segment frames
        if (normAddr) {
            for (dfi = 0; dfi < state.dataSegmentFrames.length; dfi++) {
                frame = state.dataSegmentFrames[dfi];
                for (vi = 0; vi < frame.variables.length; vi++) {
                    if (normalizeAddress(frame.variables[vi].address) === normAddr)
                        return { type: 'dsf', frameIndex: dfi, varIndex: vi };
                }
            }
            for (fi = 0; fi < state.stackFrames.length; fi++) {
                frame = state.stackFrames[fi];
                for (vi = 0; vi < frame.variables.length; vi++) {
                    if (normalizeAddress(frame.variables[vi].address) === normAddr)
                        return { type: 'stack', frameIndex: fi, varIndex: vi };
                }
            }
        }

        // By name — data segment frames
        for (dfi = 0; dfi < state.dataSegmentFrames.length; dfi++) {
            frame = state.dataSegmentFrames[dfi];
            for (vi = 0; vi < frame.variables.length; vi++) {
                if (frame.variables[vi].name === name)
                    return { type: 'dsf', frameIndex: dfi, varIndex: vi };
            }
        }

        // By name — stack frames (top-down = most recent first)
        for (fi = state.stackFrames.length - 1; fi >= 0; fi--) {
            frame = state.stackFrames[fi];
            for (vi = 0; vi < frame.variables.length; vi++) {
                if (frame.variables[vi].name === name)
                    return { type: 'stack', frameIndex: fi, varIndex: vi };
            }
        }

        return null;
    }

    /* ===================================================
       ACTION HANDLERS
       Each handler mutates state immutably by
       replacing arrays/objects (standard for vis engines).
    =================================================== */

    /* -- Clear all highlights -- */
    function clearAllHighlights() {
        state.stackFrames = state.stackFrames.map(function (f) {
            return Object.assign({}, f, {
                variables: f.variables.map(function (v) { return Object.assign({}, v, { isHighlighted: false }); })
            });
        });
        state.dataSegmentFrames = state.dataSegmentFrames.map(function (f) {
            return Object.assign({}, f, {
                variables: f.variables.map(function (v) { return Object.assign({}, v, { isHighlighted: false }); })
            });
        });
        state.dataSegment = state.dataSegment.map(function (v) { return Object.assign({}, v, { isHighlighted: false }); });
    }

    /* -- Remove temporary frames (printf etc.) -- */
    function removeTemporaryFrames() {
        state.stackFrames = state.stackFrames.filter(function (f) { return !f.isTemporary; });
    }

    /* 1. create_stack_frame */
    function handleCreateStackFrame(su) {
        var funcName = su.function_name;
        if (!funcName) return;
        var variables = su.stack_data_frame ? parseDataFrames(su.stack_data_frame) : [];
        var newFrame = {
            id: generateFrameId(funcName),
            functionName: funcName,
            variables: variables,
            isTemporary: false,
            isGlobal: su.isGlobal || false,
            isStatic: su.isStatic || false
        };

        if (su.isGlobal || su.isStatic) {
            var gsFrames = state.stackFrames.filter(function (f) { return f.isGlobal || f.isStatic; });
            var regFrames = state.stackFrames.filter(function (f) { return !f.isGlobal && !f.isStatic; });
            state.stackFrames = gsFrames.concat([newFrame], regFrames);
        } else {
            state.stackFrames = state.stackFrames.concat([newFrame]);
        }
    }

    /* 2. create_temporary_stack_frame */
    function handleCreateTemporaryStackFrame(su) {
        var funcName = su.function_name || 'temp';
        var variables = su.stack_data_frame ? parseDataFrames(su.stack_data_frame) : [];
        state.stackFrames = state.stackFrames.concat([{
            id: generateFrameId(funcName),
            functionName: funcName,
            variables: variables,
            isTemporary: true,
            isGlobal: false,
            isStatic: false
        }]);
    }

    /* 3. update_variable */
    function handleUpdateVariable(su) {
        var loc = findVariableLocation(su.variable_name, su.address);
        if (!loc) return;

        if (loc.type === 'dsf') {
            state.dataSegmentFrames = state.dataSegmentFrames.map(function (f, dfi) {
                return Object.assign({}, f, {
                    variables: f.variables.map(function (v, vi) {
                        if (dfi === loc.frameIndex && vi === loc.varIndex) {
                            return Object.assign({}, v, { value: su.variable_value, isHighlighted: true });
                        }
                        return Object.assign({}, v, { isHighlighted: false });
                    })
                });
            });
            rebuildDataSegment();
        } else {
            state.stackFrames = state.stackFrames.map(function (f, fi) {
                return Object.assign({}, f, {
                    variables: f.variables.map(function (v, vi) {
                        if (fi === loc.frameIndex && vi === loc.varIndex) {
                            return Object.assign({}, v, { value: su.variable_value, isHighlighted: true });
                        }
                        return Object.assign({}, v, { isHighlighted: false });
                    })
                });
            });
        }
    }

    /* 4. update_multiple_variables */
    function handleUpdateMultipleVariables(su) {
        if (!su.updates || !su.updates.length) return;

        // Gather all update locations
        var locMap = {};
        su.updates.forEach(function (u) {
            var loc = findVariableLocation(u.variable_name, u.address);
            if (loc) locMap[loc.type + ':' + loc.frameIndex + ':' + loc.varIndex] = { loc: loc, value: u.variable_value };
        });

        state.stackFrames = state.stackFrames.map(function (f, fi) {
            return Object.assign({}, f, {
                variables: f.variables.map(function (v, vi) {
                    var key = 'stack:' + fi + ':' + vi;
                    if (locMap[key]) return Object.assign({}, v, { value: locMap[key].value, isHighlighted: true });
                    return Object.assign({}, v, { isHighlighted: false });
                })
            });
        });

        state.dataSegmentFrames = state.dataSegmentFrames.map(function (f, dfi) {
            return Object.assign({}, f, {
                variables: f.variables.map(function (v, vi) {
                    var key = 'dsf:' + dfi + ':' + vi;
                    if (locMap[key]) return Object.assign({}, v, { value: locMap[key].value, isHighlighted: true });
                    return Object.assign({}, v, { isHighlighted: false });
                })
            });
        });

        rebuildDataSegment();
    }

    /* 5. update_array / update_array_element */
    function handleUpdateArray(su) {
        var loc = findVariableLocation(su.variable_name, su.address);
        if (!loc) return;
        var target = (loc.type === 'stack') ? state.stackFrames : state.dataSegmentFrames;
        var frame = target[loc.frameIndex];
        if (!frame) return;

        var updatedVars = frame.variables.slice();
        var v = Object.assign({}, updatedVars[loc.varIndex]);

        if (su.action === 'update_array' || su.action === 'update_2d_array') {
            // Direct elements array in su (most common in JSON)
            if (su.elements && Array.isArray(su.elements)) {
                var elems = su.elements;
                // Flatten nested 2D structure if needed
                if (elems.length > 0 && Array.isArray(elems[0])) {
                    var flat = [];
                    elems.forEach(function(rowArr) {
                        rowArr.forEach(function(el) { flat.push(el); });
                    });
                    elems = flat;
                }
                v.elements = elems.map(function(e) { return Object.assign({}, e, { isHighlighted: false }); });
            } else if (su.stack_data_frame) {
                var parsed = parseDataFrames(su.stack_data_frame);
                if (parsed.length > 0) {
                    v = Object.assign(v, parsed[0]);
                }
            }
        } else if (su.action === 'update_array_element') {
            // Single 1D element update — JSON uses su.value (not su.variable_value)
            if (v.elements && su.index !== undefined) {
                v.elements = v.elements.map(function (el) {
                    if (Number(el.index) === Number(su.index)) {
                        return Object.assign({}, el, { value: su.value !== undefined ? su.value : su.variable_value, isHighlighted: true });
                    }
                    return Object.assign({}, el, { isHighlighted: false });
                });
            }
        } else if (su.action === 'update_2d_array_element') {
            // Single 2D element update — JSON uses su.row, su.col, su.value
            if (v.elements && su.row !== undefined && su.col !== undefined) {
                v.elements = v.elements.map(function (el) {
                    if (Number(el.row) === Number(su.row) && Number(el.col) === Number(su.col)) {
                        return Object.assign({}, el, { value: su.value !== undefined ? su.value : su.variable_value, isHighlighted: true });
                    }
                    return Object.assign({}, el, { isHighlighted: false });
                });
            }
        }

        v.isHighlighted = true;
        updatedVars[loc.varIndex] = v;
        frame = Object.assign({}, frame, { variables: updatedVars });
        target[loc.frameIndex] = frame;

        if (loc.type === 'dsf') rebuildDataSegment();
    }

    /* 6. clear_frame / remove_stack_frame */
    function handleClearFrame(su, stepData) {
        var funcName = (su.frame && su.frame.function_name) || su.function_name;
        if (!funcName) return;
        var idx = -1;
        for (var i = state.stackFrames.length - 1; i >= 0; i--) {
            if (state.stackFrames[i].functionName === funcName) { idx = i; break; }
        }
        if (idx === -1) return;
        state.stackFrames = state.stackFrames.filter(function (_, i) { return i !== idx; });
        if (stepData.return_value !== undefined) state.returnValue = stepData.return_value;
    }

    /* 7. clear_all_frames */
    function handleClearAllFrames() {
        state.stackFrames = [];
        // Data segment persists
    }

    /* 8. data_segment_update (create_data_segment_variable) */
    function handleDataSegmentUpdate(dsu) {
        if (!dsu || dsu.action !== 'create_data_segment_variable') return;

        function addToFrameOrCreate(frameName, variable, isGlobal, isStatic) {
            var existing = -1;
            for (var i = 0; i < state.dataSegmentFrames.length; i++) {
                if (state.dataSegmentFrames[i].functionName === frameName) { existing = i; break; }
            }
            if (existing !== -1) {
                var frame = state.dataSegmentFrames[existing];
                var names = frame.variables.map(function (v) { return v.name; });
                if (names.indexOf(variable.name) === -1) {
                    state.dataSegmentFrames[existing] = Object.assign({}, frame, {
                        variables: frame.variables.concat([variable])
                    });
                }
            } else {
                state.dataSegmentFrames.push({
                    id: generateFrameId(frameName.toLowerCase()),
                    functionName: frameName,
                    variables: [variable],
                    isGlobal: isGlobal,
                    isStatic: isStatic,
                    isTemporary: false
                });
            }
        }

        if (dsu.global_data) {
            var gd = dsu.global_data;
            var gv = {
                name: gd.variable_name,
                value: gd.variable_value !== undefined ? gd.variable_value : '(uninitialized)',
                address: gd.address || '',
                size: gd.size || '',
                type: gd.type || 'int',
                isHighlighted: false
            };
            addToFrameOrCreate('Global', gv, true, false);
        }
        if (dsu.static_data) {
            var sd = dsu.static_data;
            var sv = {
                name: sd.variable_name,
                value: sd.variable_value !== undefined ? sd.variable_value : '(uninitialized)',
                address: sd.address || '',
                size: sd.size || '',
                type: sd.type || 'int',
                isHighlighted: false
            };
            addToFrameOrCreate('Static', sv, false, true);
        }

        rebuildDataSegment();
    }

    /* -- DS rebuild helper -- */
    function rebuildDataSegment() {
        var all = [];
        state.dataSegmentFrames.forEach(function (f) { all = all.concat(f.variables); });
        state.dataSegment = all;
    }

    /* ===================================================
       STEP EXECUTOR
       Given a step JSON object, update state accordingly.
    =================================================== */
    function executeStep(stepData) {
        if (!stepData) return;

        // Pre-step cleanup
        removeTemporaryFrames();
        clearAllHighlights();

        // Basic info
        state.currentStep = stepData.step;
        state.activeLine = stepData.line;
        state.description = stepData.description || '';

        // stack_update
        var su = stepData.stack_update;
        if (su && su.action) {
            switch (su.action) {
                case 'create_stack_frame':            handleCreateStackFrame(su); break;
                case 'create_temporary_stack_frame':  handleCreateTemporaryStackFrame(su); break;
                case 'update_variable':               handleUpdateVariable(su); break;
                case 'update_multiple_variables':     handleUpdateMultipleVariables(su); break;
                case 'update_array':
                case 'update_array_element':
                case 'update_2d_array':
                case 'update_2d_array_element':
                case 'update_multiple_arrays':        handleUpdateArray(su); break;
                case 'clear_frame':
                case 'remove_stack_frame':            handleClearFrame(su, stepData); break;
                case 'clear_all_frames':              handleClearAllFrames(); break;
            }
        } else if (su && su.frame && su.frame.action === 'clear') {
            handleClearFrame(su, stepData);
        }

        // data_segment_update
        if (stepData.data_segment_update) {
            handleDataSegmentUpdate(stepData.data_segment_update);
        }

        // terminal_update
        if (stepData.terminal_update !== undefined) {
            state.terminalOutput = stepData.terminal_update;
        }

        // return_value
        if (stepData.return_value !== undefined) {
            state.returnValue = stepData.return_value;
        }
    }

    /* Execute all steps up to index (1-based) */
    function executeUpTo(steps, targetStep) {
        _frameCounter = 0;
        state = createInitialState();
        state.totalSteps = steps.length;
        state.isLoaded = true;

        for (var i = 0; i < targetStep && i < steps.length; i++) {
            executeStep(steps[i]);
        }
        return state;
    }

    /* ------- Public API ------- */
    return {
        createInitialState: createInitialState,
        executeStep: executeStep,
        executeUpTo: executeUpTo,
        getState: function () { return state; },
        reset: function () { _frameCounter = 0; state = createInitialState(); }
    };
})();
