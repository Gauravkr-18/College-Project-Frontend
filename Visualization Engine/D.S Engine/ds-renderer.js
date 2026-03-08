window.DSRenderer = (function () {
    'use strict';

    var container = null;
    var terminalEl = null;


    var STATE_COLORS = {
        'default':    { cls: 'ds-cell--default' },
        'active':     { cls: 'ds-cell--active' },
        'comparing':  { cls: 'ds-cell--comparing' },
        'compare':    { cls: 'ds-cell--comparing' },
        'visited':    { cls: 'ds-cell--visited' },
        'updated':    { cls: 'ds-cell--updated' },
        'swapping':   { cls: 'ds-cell--swapping' },
        'sorted':     { cls: 'ds-cell--sorted' },
        'found':      { cls: 'ds-cell--found' },
        'highlighted':{ cls: 'ds-cell--highlighted' },
        'inserted':   { cls: 'ds-cell--inserted' },
        'deleted':    { cls: 'ds-cell--deleted' },
        'error':      { cls: 'ds-cell--error' },
        'traversing': { cls: 'ds-cell--traversing' }
    };

    function getStateCls(st) {
        return (STATE_COLORS[st] || STATE_COLORS['default']).cls;
    }


    function init() {
        container = document.getElementById('dsVisArea');
        terminalEl = document.getElementById('dsTerminalContent');
    }


    function clear() {
        if (container) container.innerHTML = '';
        if (terminalEl) {
            terminalEl.innerHTML = '<div class="vis-term-line vis-term-empty"><span class="vis-term-prompt">$</span><span>Waiting for output\u2026</span></div>';
        }
    }


    function render(dsState) {
        if (!container) init();
        if (!container) return;
        if (!dsState || !dsState.hasData) {
            clear();
            return;
        }

        var html = '';

        // Choose renderer based on type & data
        var hasMultiple = dsState.arrays && dsState.arrays.length > 0;

        if (hasMultiple) {
            html += renderMultipleArrays(dsState);
        } else if (dsState.type === '2d_array') {
            html += renderMatrix(dsState.array, dsState);
        } else {
            html += renderSingleArray(dsState.array, dsState);
        }

        container.innerHTML = html;

        // Terminal
        if (terminalEl && dsState.terminalOutput) {
            renderTerminal(dsState.terminalOutput);
        }
    }


    function renderSingleArray(array, dsState) {
        if (!array || !array.length) return '';
        var html = '<div class="ds-array-wrapper">';

        // Info sidebar
        if (dsState.variable_name || dsState.address || dsState.size) {
            html += renderInfoSidebar(dsState);
        }

        // Array cells
        html += '<div class="ds-array-container">';
        array.forEach(function (item, idx) {
            html += renderArrayCell(item, idx, dsState.pointers);
        });
        html += '</div>';
        html += '</div>';
        return html;
    }


    function renderMultipleArrays(dsState) {
        var html = '<div class="ds-multi-arrays">';
        dsState.arrays.forEach(function (arrConfig) {
            var arrData = arrConfig.data || {};
            var arr = arrData.array || [];
            var pointers = arrData.pointers || {};
            var is2D = dsState.type === '2d_array';

            html += '<div class="ds-array-group">';

            // Info sidebar for this array
            if (arrConfig.variable_name || arrConfig.address || arrConfig.size) {
                html += renderInfoSidebar(arrConfig);
            }

            if (is2D) {
                html += renderMatrixGrid(arr, pointers, arrConfig);
            } else {
                html += '<div class="ds-array-container">';
                arr.forEach(function (item, idx) {
                    html += renderArrayCell(item, idx, pointers);
                });
                html += '</div>';
            }

            html += '</div>';
        });
        html += '</div>';
        return html;
    }


    function renderMatrix(array, dsState) {
        if (!array || !array.length) return '';
        var html = '<div class="ds-matrix-wrapper">';

        // Info sidebar
        if (dsState.variable_name || dsState.address || dsState.size) {
            html += renderInfoSidebar(dsState, true);
        }

        html += renderMatrixGrid(array, dsState.pointers, dsState);
        html += '</div>';
        return html;
    }

    function renderMatrixGrid(array, pointers, meta) {
        // Group by rows
        var rowGroups = {};
        array.forEach(function (cell) {
            var r = cell.row;
            if (r === undefined) return;
            if (!rowGroups[r]) rowGroups[r] = [];
            rowGroups[r].push(cell);
        });

        var sortedRows = Object.keys(rowGroups).sort(function (a, b) { return a - b; });
        sortedRows.forEach(function (r) {
            rowGroups[r].sort(function (a, b) { return a.col - b.col; });
        });

        var colIndices = [];
        var colSet = {};
        array.forEach(function (cell) {
            if (cell.col !== undefined && !colSet[cell.col]) {
                colIndices.push(cell.col);
                colSet[cell.col] = true;
            }
        });
        colIndices.sort(function (a, b) { return a - b; });

        // Determine current row/col pointer values
        var rowPtrs = extractRowPointers(pointers);
        var colPtrs = extractColPointers(pointers);
        var currentRow = getCurrentPointerValue(pointers, 'row');
        var currentCol = getCurrentPointerValue(pointers, 'col');

        var html = '<div class="ds-matrix-grid">';

        // Column headers
        html += '<div class="ds-matrix-header">';
        html += '<div class="ds-matrix-row-label"></div>'; // spacer for row labels
        colIndices.forEach(function (colIdx) {
            var cp = getPointersAtValue(colPtrs, colIdx);
            html += '<div class="ds-matrix-col-header">';
            if (cp.length) {
                html += '<div class="ds-pointer-indicators">';
                cp.forEach(function (p) {
                    html += '<span class="ds-pointer-badge ds-pointer-badge--col">'
                        + escapeHtml(p) + '=' + colIdx + '</span>';
                });
                html += '<span class="ds-pointer-arrow ds-pointer-arrow--down">▼</span>';
                html += '</div>';
            }
            html += '<span class="ds-matrix-idx">col ' + colIdx + '</span>';
            html += '</div>';
        });
        html += '</div>';

        // Rows
        sortedRows.forEach(function (rowKey) {
            var rowIndex = parseInt(rowKey, 10);
            var cells = rowGroups[rowKey];
            var rp = getPointersAtValue(rowPtrs, rowIndex);

            html += '<div class="ds-matrix-row">';
            // Row label
            html += '<div class="ds-matrix-row-label">';
            if (rp.length) {
                html += '<div class="ds-pointer-indicators ds-pointer-indicators--row">';
                rp.forEach(function (p) {
                    html += '<span class="ds-pointer-badge ds-pointer-badge--row">'
                        + escapeHtml(p) + '=' + rowIndex + '</span>';
                });
                html += '<span class="ds-pointer-arrow ds-pointer-arrow--right">▶</span>';
                html += '</div>';
            }
            html += '<span class="ds-matrix-idx">row ' + rowIndex + '</span>';
            html += '</div>';

            // Cells
            html += '<div class="ds-matrix-cells">';
            cells.forEach(function (cell) {
                var isIntersection = currentRow === cell.row && currentCol === cell.col
                    && currentRow !== null && currentCol !== null;
                var stateCls = getStateCls(cell.state);
                var intersectCls = isIntersection ? ' ds-cell--intersection' : '';
                html += '<div class="ds-cell ' + stateCls + intersectCls + '">'
                    + '<span class="ds-cell-value">' + escapeHtml(cell.value) + '</span>'
                    + '</div>';
            });
            html += '</div>';
            html += '</div>';
        });

        html += '</div>';
        return html;
    }


    function renderArrayCell(item, idx, pointers) {
        var stateCls = getStateCls(item.state);
        var ptrs = getPointersAtIndex(pointers, item.index !== undefined ? item.index : idx);

        var html = '<div class="ds-cell-wrapper">';

        // Pointer labels above
        if (ptrs.length > 0) {
            html += '<div class="ds-pointer-indicators">';
            ptrs.forEach(function (p) {
                html += '<span class="ds-pointer-badge">'
                    + escapeHtml(p) + '=' + (item.index !== undefined ? item.index : idx)
                    + '</span>';
            });
            html += '<span class="ds-pointer-arrow">▼</span>';
            html += '</div>';
        }

        // Cell
        html += '<div class="ds-cell ' + stateCls + '">';
        if (item.label) {
            html += '<span class="ds-cell-label">' + escapeHtml(item.label) + '</span>';
        }
        html += '<span class="ds-cell-value">' + escapeHtml(item.value) + '</span>';
        html += '</div>';

        // Index below
        html += '<span class="ds-cell-index">[' + (item.index !== undefined ? item.index : idx) + ']</span>';

        // Address below index
        if (item.address) {
            html += '<span class="ds-cell-addr">' + escapeHtml(item.address) + '</span>';
        }

        html += '</div>';
        return html;
    }


    function renderInfoSidebar(data, is2D) {
        var html = '<div class="ds-info-sidebar">';

        if (data.variable_name) {
            html += '<div class="ds-info-item">'
                + '<span class="ds-info-label">Variable</span>'
                + '<div class="ds-info-value ds-info-value--name">'
                + '<svg class="ds-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>'
                + '<span>' + escapeHtml(data.variable_name) + '</span>'
                + '</div>'
                + '</div>';
        }

        if (is2D && (data.rows || data.cols)) {
            html += '<div class="ds-info-item">'
                + '<span class="ds-info-label">Dimensions</span>'
                + '<div class="ds-info-value ds-info-value--dim">'
                + '<span>' + (data.rows || '?') + ' × ' + (data.cols || '?') + '</span>'
                + '</div>'
                + '</div>';
        }

        if (data.address) {
            html += '<div class="ds-info-item">'
                + '<span class="ds-info-label">Address</span>'
                + '<div class="ds-info-value ds-info-value--addr">'
                + '<span>' + escapeHtml(data.address) + '</span>'
                + '</div>'
                + '</div>';
        }

        if (data.size) {
            html += '<div class="ds-info-item">'
                + '<span class="ds-info-label">Size</span>'
                + '<div class="ds-info-value ds-info-value--size">'
                + '<span>' + escapeHtml(data.size) + '</span>'
                + '</div>'
                + '</div>';
        }

        html += '</div>';
        return html;
    }


    function renderTerminal(output) {
        if (!terminalEl) return;
        var termWindow = document.getElementById('dsTerminalWindow');
        if (termWindow) termWindow.classList.add('active');

        var lines = String(output).split('\n');
        var html = '';
        lines.forEach(function (line) {
            html += '<div class="vis-term-line"><span class="vis-term-text">' + escapeHtml(line) + '</span></div>';
        });
        terminalEl.innerHTML = html;
    }


    function getPointersAtIndex(pointers, index) {
        if (!pointers) return [];
        var result = [];
        Object.keys(pointers).forEach(function (key) {
            if (Number(pointers[key]) === Number(index)) {
                result.push(key);
            }
        });
        return result;
    }

    // For 2D: separate row vs col pointers
    var ROW_KEYWORDS = ['i', 'row', 'r', 'rows'];
    var COL_KEYWORDS = ['j', 'col', 'c', 'cols', 'k'];

    function extractRowPointers(pointers) {
        if (!pointers) return {};
        var result = {};
        Object.keys(pointers).forEach(function (key) {
            var kl = key.toLowerCase();
            if (ROW_KEYWORDS.indexOf(kl) !== -1 || kl.indexOf('row') !== -1) {
                result[key] = pointers[key];
            }
        });
        return result;
    }

    function extractColPointers(pointers) {
        if (!pointers) return {};
        var result = {};
        Object.keys(pointers).forEach(function (key) {
            var kl = key.toLowerCase();
            if (COL_KEYWORDS.indexOf(kl) !== -1 || kl.indexOf('col') !== -1) {
                result[key] = pointers[key];
            }
        });
        return result;
    }

    function getCurrentPointerValue(pointers, type) {
        if (!pointers) return null;
        var keywords = type === 'row' ? ROW_KEYWORDS : COL_KEYWORDS;
        var keys = Object.keys(pointers);
        for (var i = 0; i < keys.length; i++) {
            if (keywords.indexOf(keys[i].toLowerCase()) !== -1) {
                return Number(pointers[keys[i]]);
            }
        }
        return null;
    }

    function getPointersAtValue(ptrObj, val) {
        var result = [];
        Object.keys(ptrObj).forEach(function (key) {
            if (Number(ptrObj[key]) === Number(val)) {
                result.push(key);
            }
        });
        return result;
    }


    return {
        init: init,
        clear: clear,
        render: render
    };
})();
