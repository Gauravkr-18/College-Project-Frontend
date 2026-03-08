window.DSEngine = (function () {
    'use strict';


    var state = createInitialState();

    function createInitialState() {
        return {
            type: null,               // 'array' | '2d_array'
            // Single array metadata
            variable_name: null,
            address: null,
            size: null,
            // 2D array dimensions
            rows: null,
            cols: null,
            // Main array data (for backward compat / single array)
            array: [],
            // Multiple arrays support
            arrays: [],
            // Pointers (i, j, pivot, etc.)
            pointers: {},
            // Variables outside array (loop counters etc.)
            variables: {},
            // Description
            description: '',
            // Terminal output
            terminalOutput: '',
            // Flags
            hasData: false
        };
    }

    function reset() {
        state = createInitialState();
    }


    function normalizeArrayItem(item, prevItem) {
        // Ensure state field exists
        var result = {
            value: item.value !== undefined ? item.value : (prevItem ? prevItem.value : '?'),
            state: item.state || 'default',
            address: item.address || (prevItem ? prevItem.address : '')
        };
        // 1D array
        if (item.index !== undefined) {
            result.index = item.index;
        }
        // 2D array
        if (item.row !== undefined) {
            result.row = item.row;
            result.col = item.col;
        }
        if (item.label) result.label = item.label;
        return result;
    }

    function normalizeArrayData(newArray, prevArray) {
        if (!newArray || !newArray.length) return prevArray || [];
        var prevMap = {};
        if (prevArray && prevArray.length) {
            prevArray.forEach(function (item) {
                // key by index for 1D, row_col for 2D
                var key = item.row !== undefined
                    ? item.row + '_' + item.col
                    : String(item.index);
                prevMap[key] = item;
            });
        }
        return newArray.map(function (item) {
            var key = item.row !== undefined
                ? item.row + '_' + item.col
                : String(item.index);
            return normalizeArrayItem(item, prevMap[key]);
        });
    }


    function resetArrayStates(arr) {
        if (!arr || !arr.length) return arr;
        return arr.map(function (item) {
            return Object.assign({}, item, { state: 'default' });
        });
    }

    function resetMultipleArraysStates(arrays) {
        if (!arrays || !arrays.length) return arrays;
        return arrays.map(function (arrConfig) {
            return Object.assign({}, arrConfig, {
                data: Object.assign({}, arrConfig.data, {
                    array: resetArrayStates(arrConfig.data ? arrConfig.data.array : [])
                })
            });
        });
    }


    function clearVariableHighlightsExcept(variables, keepKeys) {
        var result = {};
        var keep = {};
        if (keepKeys) keepKeys.forEach(function (k) { keep[k] = true; });
        Object.keys(variables).forEach(function (key) {
            result[key] = Object.assign({}, variables[key], {
                isHighlighted: !!keep[key] && variables[key].isHighlighted
            });
        });
        return result;
    }


    function handleDSInit(dsUpdate) {
        var type = dsUpdate.type || state.type;
        var data = dsUpdate.data || {};
        var prevDS = state;

        var newArray = data.array
            ? normalizeArrayData(data.array, prevDS.array)
            : prevDS.array;

        var pointers = data.pointers !== undefined ? data.pointers : prevDS.pointers;

        state = Object.assign({}, state, {
            type: type,
            variable_name: dsUpdate.variable_name || prevDS.variable_name,
            address: dsUpdate.address || prevDS.address,
            size: dsUpdate.size || prevDS.size,
            rows: dsUpdate.rows || prevDS.rows,
            cols: dsUpdate.cols || prevDS.cols,
            array: newArray,
            pointers: pointers || {},
            description: dsUpdate.description || '',
            hasData: true
        });
    }


    function handleDSUpdate(dsUpdate) {
        var data = dsUpdate.data || {};
        var prevDS = state;

        var newArray = data.array
            ? normalizeArrayData(data.array, prevDS.array)
            : prevDS.array;

        var pointers = data.pointers !== undefined ? data.pointers : prevDS.pointers;

        // If we have multiple arrays, update the matching one
        if (prevDS.arrays.length > 0 && dsUpdate.variable_name) {
            var updatedArrays = prevDS.arrays.map(function (arrConfig) {
                if (arrConfig.variable_name === dsUpdate.variable_name) {
                    return Object.assign({}, arrConfig, {
                        address: dsUpdate.address || arrConfig.address,
                        size: dsUpdate.size || arrConfig.size,
                        rows: dsUpdate.rows || arrConfig.rows,
                        cols: dsUpdate.cols || arrConfig.cols,
                        data: {
                            array: normalizeArrayData(data.array, arrConfig.data ? arrConfig.data.array : []),
                            pointers: data.pointers !== undefined ? data.pointers : (arrConfig.data ? arrConfig.data.pointers : {})
                        }
                    });
                }
                // Reset states for non-updated arrays
                return Object.assign({}, arrConfig, {
                    data: Object.assign({}, arrConfig.data, {
                        array: resetArrayStates(arrConfig.data ? arrConfig.data.array : [])
                    })
                });
            });
            state = Object.assign({}, state, {
                arrays: updatedArrays,
                array: updatedArrays[0] ? updatedArrays[0].data.array : newArray,
                pointers: pointers || {},
                description: dsUpdate.description || '',
                hasData: true
            });
        } else {
            state = Object.assign({}, state, {
                variable_name: dsUpdate.variable_name || prevDS.variable_name,
                address: dsUpdate.address || prevDS.address,
                size: dsUpdate.size || prevDS.size,
                rows: dsUpdate.rows || prevDS.rows,
                cols: dsUpdate.cols || prevDS.cols,
                array: newArray,
                pointers: pointers || {},
                description: dsUpdate.description || '',
                hasData: true
            });
        }
    }


    function handleDSInitMultiple(dsUpdate) {
        var type = dsUpdate.type || state.type;
        var arraysConfig = dsUpdate.arrays || [];
        var prevArrays = state.arrays || [];

        var processedArrays = arraysConfig.map(function (arrConf) {
            var prevArr = null;
            prevArrays.forEach(function (p) {
                if (p.variable_name === arrConf.variable_name) prevArr = p;
            });
            var data = arrConf.data || {};
            return {
                variable_name: arrConf.variable_name,
                address: arrConf.address || (prevArr ? prevArr.address : null),
                size: arrConf.size || (prevArr ? prevArr.size : null),
                rows: arrConf.rows || (prevArr ? prevArr.rows : null),
                cols: arrConf.cols || (prevArr ? prevArr.cols : null),
                data: {
                    array: normalizeArrayData(data.array, prevArr && prevArr.data ? prevArr.data.array : []),
                    pointers: data.pointers !== undefined ? data.pointers : (prevArr && prevArr.data ? prevArr.data.pointers : {})
                }
            };
        });

        // Merge: keep non-updated arrays, replace updated ones
        var updatedNames = {};
        arraysConfig.forEach(function (a) { updatedNames[a.variable_name] = true; });
        var processedMap = {};
        processedArrays.forEach(function (a) { processedMap[a.variable_name] = a; });

        var merged = prevArrays.map(function (prev) {
            if (updatedNames[prev.variable_name]) {
                return processedMap[prev.variable_name];
            }
            return Object.assign({}, prev, {
                data: Object.assign({}, prev.data, {
                    array: resetArrayStates(prev.data ? prev.data.array : [])
                })
            });
        });
        processedArrays.forEach(function (arr) {
            var exists = prevArrays.some(function (p) { return p.variable_name === arr.variable_name; });
            if (!exists) merged.push(arr);
        });

        state = Object.assign({}, state, {
            type: type,
            arrays: merged,
            array: merged[0] ? merged[0].data.array : [],
            variable_name: merged[0] ? merged[0].variable_name : state.variable_name,
            address: merged[0] ? merged[0].address : state.address,
            size: merged[0] ? merged[0].size : state.size,
            pointers: merged[0] && merged[0].data ? merged[0].data.pointers : {},
            description: dsUpdate.description || '',
            hasData: true
        });
    }


    function handleDSUpdateMultiple(dsUpdate) {
        handleDSInitMultiple(dsUpdate);
    }


    function handleDSUpdateMessage(dsUpdate) {
        state = Object.assign({}, state, {
            description: dsUpdate.description || '',
            // Reset array states for visual clarity
            array: resetArrayStates(state.array),
            arrays: resetMultipleArraysStates(state.arrays)
        });
    }


    function handleVariableDeclare(dsUpdate) {
        var name = dsUpdate.variable_name;
        if (!name) return;
        var frameKey = 'var_' + name;
        var newVars = clearVariableHighlightsExcept(state.variables, [frameKey]);
        newVars[frameKey] = {
            name: name,
            value: dsUpdate.variable_value,
            position: dsUpdate.position || 'outside_array',
            isHighlighted: true
        };
        state = Object.assign({}, state, {
            variables: newVars,
            array: resetArrayStates(state.array),
            arrays: resetMultipleArraysStates(state.arrays),
            description: dsUpdate.description || ('Variable ' + name + ' declared')
        });
    }


    function handleMultipleVariableDeclare(dsUpdate) {
        var decl = dsUpdate.declare || [];
        if (!decl.length) return;
        var frameKeys = decl.map(function (v) { return 'var_' + v.variable_name; });
        var newVars = clearVariableHighlightsExcept(state.variables, frameKeys);
        decl.forEach(function (v) {
            newVars['var_' + v.variable_name] = {
                name: v.variable_name,
                value: v.variable_value,
                position: v.position || 'outside_array',
                isHighlighted: true
            };
        });
        state = Object.assign({}, state, {
            variables: newVars,
            array: resetArrayStates(state.array),
            arrays: resetMultipleArraysStates(state.arrays),
            description: dsUpdate.description || (decl.length + ' variables declared')
        });
    }


    function handleArrayCompare(dsUpdate) {
        var indices = dsUpdate.indices || [];
        var highlightState = dsUpdate.state || 'active';

        if (state.arrays.length > 0) {
            // Multi-array: check if array_name specified
            var targetName = dsUpdate.array_name || (state.arrays[0] ? state.arrays[0].variable_name : null);
            state.arrays = state.arrays.map(function (arrConfig) {
                if (arrConfig.variable_name === targetName) {
                    return Object.assign({}, arrConfig, {
                        data: Object.assign({}, arrConfig.data, {
                            array: arrConfig.data.array.map(function (item) {
                                var isTarget = indices.indexOf(item.index) !== -1;
                                return Object.assign({}, item, { state: isTarget ? highlightState : 'default' });
                            })
                        })
                    });
                }
                return Object.assign({}, arrConfig, {
                    data: Object.assign({}, arrConfig.data, {
                        array: resetArrayStates(arrConfig.data.array)
                    })
                });
            });
            state.array = state.arrays[0] ? state.arrays[0].data.array : state.array;
        } else {
            state.array = state.array.map(function (item) {
                var isTarget = indices.indexOf(item.index) !== -1;
                if (isTarget === undefined) {
                    // 2D: check by row,col — indices could be an array of {row,col}
                    isTarget = false;
                }
                return Object.assign({}, item, { state: isTarget ? highlightState : 'default' });
            });
        }
        state.description = dsUpdate.description || '';
    }


    function handleArraySetPointer(dsUpdate) {
        var newPointers = dsUpdate.pointers || {};

        if (state.arrays.length > 0) {
            // Check for per-array pointers (pointers_1, pointers_2)
            var arrayName1 = dsUpdate.array_name_1;
            var arrayName2 = dsUpdate.array_name_2;
            if (arrayName1 || arrayName2) {
                state.arrays = state.arrays.map(function (arrConfig) {
                    var updated = Object.assign({}, arrConfig.data.pointers);
                    if (arrConfig.variable_name === arrayName1 && dsUpdate.pointers_1) {
                        Object.assign(updated, dsUpdate.pointers_1);
                    }
                    if (arrConfig.variable_name === arrayName2 && dsUpdate.pointers_2) {
                        Object.assign(updated, dsUpdate.pointers_2);
                    }
                    return Object.assign({}, arrConfig, {
                        data: Object.assign({}, arrConfig.data, {
                            array: resetArrayStates(arrConfig.data.array),
                            pointers: updated
                        })
                    });
                });
            } else {
                // Apply pointers to first array
                var first = state.arrays[0];
                if (first) {
                    state.arrays[0] = Object.assign({}, first, {
                        data: Object.assign({}, first.data, {
                            array: resetArrayStates(first.data.array),
                            pointers: Object.assign({}, first.data.pointers, newPointers)
                        })
                    });
                }
            }
        } else {
            state.pointers = Object.assign({}, state.pointers, newPointers);
            state.array = resetArrayStates(state.array);
        }
        state.description = dsUpdate.description || '';
    }


    function handleSetNodeState(dsUpdate) {
        var updates = dsUpdate.updates || [];
        if (!updates.length) return;
        var updateMap = {};
        updates.forEach(function (u) {
            if (u.index !== undefined) {
                updateMap[u.index] = u.state || 'active';
            }
        });

        if (state.arrays.length > 0) {
            var targetName = dsUpdate.array_name || (state.arrays[0] ? state.arrays[0].variable_name : null);
            state.arrays = state.arrays.map(function (arrConfig) {
                if (arrConfig.variable_name === targetName) {
                    return Object.assign({}, arrConfig, {
                        data: Object.assign({}, arrConfig.data, {
                            array: arrConfig.data.array.map(function (item) {
                                if (updateMap[item.index] !== undefined) {
                                    return Object.assign({}, item, { state: updateMap[item.index] });
                                }
                                return Object.assign({}, item, { state: 'default' });
                            })
                        })
                    });
                }
                return arrConfig;
            });
        } else {
            state.array = state.array.map(function (item) {
                if (updateMap[item.index] !== undefined) {
                    return Object.assign({}, item, { state: updateMap[item.index] });
                }
                return Object.assign({}, item, { state: 'default' });
            });
        }
        state.description = dsUpdate.description || '';
    }


    function handleFunctionReturn(dsUpdate) {
        state.array = resetArrayStates(state.array);
        state.arrays = resetMultipleArraysStates(state.arrays);
        state.description = dsUpdate.description || 'Function returned';
    }

    function executeStep(stepData) {
        if (!stepData) return;

        var ds = stepData.ds_update;
        if (ds && ds.action) {
            switch (ds.action) {
                case 'ds_init':
                    handleDSInit(ds);
                    break;
                case 'ds_update':
                    handleDSUpdate(ds);
                    break;
                case 'ds_init_multiple':
                    handleDSInitMultiple(ds);
                    break;
                case 'ds_update_multiple':
                    handleDSUpdateMultiple(ds);
                    break;
                case 'ds_update_message':
                    handleDSUpdateMessage(ds);
                    break;
                case 'variable_declare':
                    handleVariableDeclare(ds);
                    break;
                case 'multiple_variable_declare':
                    handleMultipleVariableDeclare(ds);
                    break;
                case 'array_compare':
                case 'array_highlight':
                    handleArrayCompare(ds);
                    break;
                case 'array_set_pointer':
                    handleArraySetPointer(ds);
                    break;
                case 'set_node_state':
                    handleSetNodeState(ds);
                    break;
                case 'function_return':
                case 'program_end':
                    handleFunctionReturn(ds);
                    break;
                default:
                    // Unknown action — just update description
                    if (ds.description) state.description = ds.description;
                    break;
            }
        } else if (ds && ds.description) {
            // ds_update with no action — just description update
            state.description = ds.description;
            state.array = resetArrayStates(state.array);
            state.arrays = resetMultipleArraysStates(state.arrays);
        }

        // terminal_update
        if (stepData.terminal_update !== undefined) {
            state.terminalOutput = stepData.terminal_update;
        }
    }


    function executeUpTo(steps, targetStep) {
        state = createInitialState();
        for (var i = 0; i < targetStep && i < steps.length; i++) {
            executeStep(steps[i]);
        }
        return state;
    }


    return {
        reset: reset,
        executeStep: executeStep,
        executeUpTo: executeUpTo,
        getState: function () { return state; }
    };
})();
