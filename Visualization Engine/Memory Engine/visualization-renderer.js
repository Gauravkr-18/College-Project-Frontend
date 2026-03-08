window.VisualizationRenderer = (function () {
    'use strict';

    var stackContainer = null;   // #visStackColumn .vis-memory-container
    var dsContainer    = null;   // #visDataSegment .vis-memory-container

    // Keep ref to "body" elements inside containers where frames get rendered
    var stackBody = null;
    var dsBody    = null;


    function init() {
        stackContainer = document.querySelector('#visStackColumn .vis-memory-container');
        dsContainer    = document.querySelector('#visDataSegment .vis-memory-container');

        if (stackContainer) {
            stackBody = stackContainer.querySelector('.vis-frames-body');
            if (!stackBody) {
                stackBody = document.createElement('div');
                stackBody.className = 'vis-frames-body vis-frames-body--stack';
                stackContainer.appendChild(stackBody);
            }
        }

        if (dsContainer) {
            dsBody = dsContainer.querySelector('.vis-frames-body');
            if (!dsBody) {
                dsBody = document.createElement('div');
                dsBody.className = 'vis-frames-body vis-frames-body--ds';
                dsContainer.appendChild(dsBody);
            }
        }
    }

    function render(state) {
        if (!stackBody) init();
        if (!state) return;

        renderStackFrames(state.stackFrames);
        renderDataSegment(state.dataSegmentFrames);
        renderTerminal(state.terminalOutput);
    }


    function clear() {
        if (stackBody) stackBody.innerHTML = '';
        if (dsBody)    dsBody.innerHTML = '';
        var win = document.getElementById('visTerminalWindow');
        if (win) win.classList.remove('active');
        var contentEl = document.getElementById('visTerminalContent');
        if (contentEl) contentEl.innerHTML = '';
    }

    function renderStackFrames(frames) {
        if (!stackBody) return;
        stackBody.innerHTML = '';

        if (!frames || frames.length === 0) {
            stackBody.innerHTML = '<div class="vis-empty-msg"><svg data-lucide="layers" class="vis-empty-icon"></svg><span>No stack frames</span></div>';
            refreshIcons(stackBody);
            return;
        }

        // Render frames left-to-right (index 0 = bottom of call stack)
        for (var i = 0; i < frames.length; i++) {
            var frame = frames[i];
            var isActive = (i === frames.length - 1);
            var frameEl = createFrameElement(frame, isActive, false);
            if (isActive) frameEl.id = 'vis-active-frame';
            stackBody.appendChild(frameEl);
        }

        refreshIcons(stackBody);
        autoScrollActiveFrame(stackBody);
    }

    function renderDataSegment(dsFrames) {
        if (!dsBody) return;
        dsBody.innerHTML = '';

        if (!dsFrames || dsFrames.length === 0) return;

        dsFrames.forEach(function (frame) {
            var isGlobal = frame.functionName === 'Global';
            dsBody.appendChild(createDSFrameElement(frame, isGlobal));
        });

        refreshIcons(dsBody);
    }

    function createFrameElement(frame, isTop, isDS) {
        var el = document.createElement('div');
        el.className = 'vis-stack-frame' + (isTop ? ' vis-stack-frame--top' : '') + (frame.isTemporary ? ' vis-stack-frame--temp' : '');
        el.setAttribute('data-frame-id', frame.id);

        // Header
        var header = document.createElement('div');
        header.className = 'vis-frame-header';

        var headerLeft = document.createElement('div');
        headerLeft.className = 'vis-frame-header-left';

        var fnIcon = document.createElement('div');
        fnIcon.className = 'vis-frame-icon';
        fnIcon.innerHTML = frame.isTemporary
            ? '<svg data-lucide="terminal" class="vis-frame-icon-svg"></svg>'
            : '<svg data-lucide="code-2" class="vis-frame-icon-svg"></svg>';

        var fnName = document.createElement('span');
        fnName.className = 'vis-frame-name';
        fnName.textContent = frame.functionName + '()';

        headerLeft.appendChild(fnIcon);
        headerLeft.appendChild(fnName);

        header.appendChild(headerLeft);
        el.appendChild(header);

        // Body — variables
        var body = document.createElement('div');
        body.className = 'vis-frame-body';

        if (frame.variables.length === 0) {
            body.innerHTML = '<div class="vis-no-vars">No variables</div>';
        } else {
            frame.variables.forEach(function (v) {
                body.appendChild(createVariableElement(v));
            });
        }

        el.appendChild(body);
        return el;
    }

    function createDSFrameElement(frame, isGlobal) {
        var el = document.createElement('div');
        el.className = 'vis-ds-frame' + (isGlobal ? ' vis-ds-frame--global' : ' vis-ds-frame--static');

        // Header
        var header = document.createElement('div');
        header.className = 'vis-ds-frame-header';
        header.innerHTML = '<svg data-lucide="database" class="vis-ds-icon"></svg><span>' + escapeHtml(frame.functionName) + '</span>';
        el.appendChild(header);

        // Variables
        var body = document.createElement('div');
        body.className = 'vis-ds-frame-body';

        frame.variables.forEach(function (v) {
            body.appendChild(createVariableElement(v));
        });

        el.appendChild(body);
        return el;
    }

    function createVariableElement(v) {
        var box = document.createElement('div');
        box.className = 'vis-var-box' + (v.isHighlighted ? ' vis-var-box--highlighted' : '');
        box.setAttribute('data-var-name', v.name);
        if (v.address) box.setAttribute('data-address', v.address);

        // Check for array types
        var isArray = v.elements && v.elements.length > 0;
        var is2D = isArray && (v.rows || (v.elements[0] && v.elements[0].row !== undefined));

        if (isArray && !is2D) {
            // 1D array rendering
            box.appendChild(createArray1D(v));
        } else if (is2D) {
            // 2D array rendering
            box.appendChild(createArray2D(v));
        } else {
            // Scalar variable
            // Top row: name + size
            var topRow = document.createElement('div');
            topRow.className = 'vis-var-top';

            var nameSpan = document.createElement('span');
            nameSpan.className = 'vis-var-name' + (v.isHighlighted ? ' vis-var-name--highlighted' : '');
            nameSpan.textContent = v.name;
            topRow.appendChild(nameSpan);

            if (v.size) {
                var sizeSpan = document.createElement('span');
                sizeSpan.className = 'vis-var-size';
                sizeSpan.textContent = v.size;
                topRow.appendChild(sizeSpan);
            }
            box.appendChild(topRow);

            // Value container
            var valContainer = document.createElement('div');
            valContainer.className = 'vis-var-value-container';

            var valSpan = document.createElement('span');
            valSpan.className = 'vis-var-value' + (v.isHighlighted ? ' vis-var-value--highlighted' : '');
            valSpan.textContent = v.value === '(garbage)' ? '?' : String(v.value);
            valContainer.appendChild(valSpan);
            box.appendChild(valContainer);

            // Address
            if (v.address) {
                var addrRow = document.createElement('div');
                addrRow.className = 'vis-var-addr-row';

                var addrSpan = document.createElement('span');
                addrSpan.className = 'vis-var-addr';
                addrSpan.innerHTML = '<span class="vis-var-addr-icon">&#128423;</span>' + escapeHtml(v.address);
                addrRow.appendChild(addrSpan);
                box.appendChild(addrRow);
            }
        }

        return box;
    }


    function createArray1D(v) {
        var wrap = document.createElement('div');
        wrap.className = 'vis-array-1d';

        // Header with name + total size
        var hdr = document.createElement('div');
        hdr.className = 'vis-array-header';

        var name = document.createElement('span');
        name.className = 'vis-var-name' + (v.isHighlighted ? ' vis-var-name--highlighted' : '');
        name.textContent = v.name;
        hdr.appendChild(name);

        if (v.total_size || v.size) {
            var sz = document.createElement('span');
            sz.className = 'vis-var-size';
            sz.textContent = v.total_size || v.size;
            hdr.appendChild(sz);
        }
        wrap.appendChild(hdr);

        // Elements row
        var row = document.createElement('div');
        row.className = 'vis-array-elements';

        v.elements.forEach(function (el) {
            var cell = document.createElement('div');
            cell.className = 'vis-array-cell' + (el.isHighlighted ? ' vis-array-cell--highlighted' : '');

            var idx = document.createElement('span');
            idx.className = 'vis-array-idx';
            idx.textContent = '[' + el.index + ']';
            cell.appendChild(idx);

            var val = document.createElement('span');
            val.className = 'vis-array-val';
            val.textContent = el.value === '(garbage)' ? '?' : String(el.value);
            cell.appendChild(val);

            if (el.address) {
                var addr = document.createElement('span');
                addr.className = 'vis-array-addr';
                addr.textContent = el.address;
                cell.appendChild(addr);
            }

            row.appendChild(cell);
        });

        wrap.appendChild(row);

        // Base address
        if (v.base_address || v.address) {
            var ba = document.createElement('div');
            ba.className = 'vis-var-addr-row';
            ba.innerHTML = '<span class="vis-var-addr"><span class="vis-var-addr-icon">&#128423;</span>' + escapeHtml(v.base_address || v.address) + '</span>';
            wrap.appendChild(ba);
        }

        return wrap;
    }


    function createArray2D(v) {
        var wrap = document.createElement('div');
        wrap.className = 'vis-array-2d';

        // Header: name [rows×cols]
        var hdr = document.createElement('div');
        hdr.className = 'vis-array-header';
        var name = document.createElement('span');
        name.className = 'vis-var-name' + (v.isHighlighted ? ' vis-var-name--highlighted' : '');
        name.textContent = v.name + ' [' + (v.rows || '?') + '\u00d7' + (v.cols || '?') + ']';
        hdr.appendChild(name);
        if (v.total_size || v.size) {
            var sz = document.createElement('span');
            sz.className = 'vis-var-size';
            sz.textContent = v.total_size || v.size;
            hdr.appendChild(sz);
        }
        wrap.appendChild(hdr);

        // Determine row/col counts
        var numRows = v.rows || 0;
        var numCols = v.cols || 0;

        // Organize flat elements into a 2D map keyed by [row][col]
        var grid = {};
        (v.elements || []).forEach(function (el) {
            var r = el.row !== undefined ? el.row : 0;
            var c = el.col !== undefined ? el.col : (el.index || 0);
            if (!grid[r]) grid[r] = {};
            grid[r][c] = el;
            if (r + 1 > numRows) numRows = r + 1;
            if (c + 1 > numCols) numCols = c + 1;
        });

        var table = document.createElement('div');
        table.className = 'vis-array-2d-grid';

        // Column index header row
        var colHdrRow = document.createElement('div');
        colHdrRow.className = 'vis-array-2d-row';
        var cornerCell = document.createElement('div');
        cornerCell.className = 'vis-array-2d-corner';
        colHdrRow.appendChild(cornerCell);
        for (var c = 0; c < numCols; c++) {
            var colLabel = document.createElement('div');
            colLabel.className = 'vis-array-2d-col-label';
            colLabel.textContent = '[' + c + ']';
            colHdrRow.appendChild(colLabel);
        }
        table.appendChild(colHdrRow);

        // Data rows
        for (var r = 0; r < numRows; r++) {
            var rowDiv = document.createElement('div');
            rowDiv.className = 'vis-array-2d-row';

            // Row label
            var rowLabel = document.createElement('div');
            rowLabel.className = 'vis-array-2d-row-label';
            rowLabel.textContent = '[' + r + ']';
            rowDiv.appendChild(rowLabel);

            for (var col = 0; col < numCols; col++) {
                var el = (grid[r] && grid[r][col]) ? grid[r][col] : null;
                var cell = document.createElement('div');
                cell.className = 'vis-array-cell' + (el && el.isHighlighted ? ' vis-array-cell--highlighted' : '');

                var idxSpan = document.createElement('span');
                idxSpan.className = 'vis-array-idx';
                idxSpan.textContent = '[' + r + '][' + col + ']';
                cell.appendChild(idxSpan);

                var val = document.createElement('span');
                val.className = 'vis-array-val';
                val.textContent = el ? (el.value === '(garbage)' || el.value === '?' ? '?' : String(el.value)) : '?';
                cell.appendChild(val);

                rowDiv.appendChild(cell);
            }
            table.appendChild(rowDiv);
        }

        wrap.appendChild(table);

        // Base address
        if (v.base_address || v.address) {
            var ba = document.createElement('div');
            ba.className = 'vis-var-addr-row';
            ba.innerHTML = '<span class="vis-var-addr"><span class="vis-var-addr-icon">&#128423;</span>' + escapeHtml(v.base_address || v.address) + '</span>';
            wrap.appendChild(ba);
        }

        return wrap;
    }


    function renderTerminal(output) {
        var win = document.getElementById('visTerminalWindow');
        var contentEl = document.getElementById('visTerminalContent');
        if (!win || !contentEl) return;

        if (output) {
            var html = '<div class="vis-term-line"><span class="vis-term-prompt">$</span><span class="vis-term-text">' + escapeHtml(output) + '</span></div>';
            html += '<div class="vis-term-line"><span class="vis-term-prompt">$</span><span class="vis-term-cursor"></span></div>';
            contentEl.innerHTML = html;
            win.classList.add('active');
            // Scroll to bottom
            contentEl.scrollTop = contentEl.scrollHeight;
        } else {
            contentEl.innerHTML = '<div class="vis-term-line vis-term-empty"><span class="vis-term-prompt">$</span><span>Waiting for output…</span></div>';
            win.classList.remove('active');
        }
    }


    function refreshIcons(root) {
        if (window.lucide) {
            try { lucide.createIcons({ rootElement: root }); } catch (_) {}
        }
    }

    function autoScrollActiveFrame(container) {
        var activeFrame = container.querySelector('#vis-active-frame');
        if (activeFrame) {
            setTimeout(function () {
                activeFrame.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }, 100);
        }
    }


    return {
        init: init,
        render: render,
        clear: clear
    };
})();
