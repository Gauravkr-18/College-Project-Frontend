/* =====================================================
   syntax.js — Multi-language Syntax Highlighter
   Languages: C, C++, Java, Python, JavaScript
   Token CSS classes:
     syn-keyword   syn-function  syn-string
     syn-comment   syn-type      syn-number
     syn-constant  syn-builtin   syn-class
     syn-operator  syn-preprocessor syn-decorator
     syn-regex     syn-escape    syn-label
   ===================================================== */
var SyntaxHighlighter = (function () {
    'use strict';

    /* ---- HTML escaping (syntax-specific) ----
       Only escapes &, <, > — intentionally omits quotes
       because highlighted output is placed inside pre-built
       <span class="..."> tags where quotes don't appear.
       This is NOT the same as the global escapeHtml() in config.js. */
    function esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /* ==================================================
       TOKEN DEFINITIONS PER LANGUAGE
       Each list entry becomes part of a \b(?:...)\b regex
       ================================================== */
    var DEFS = {
        c: {
            keywords: 'if|else|while|for|do|switch|case|default|break|continue|return|goto|void|struct|union|enum|typedef|sizeof|static|extern|register|auto|volatile|const|inline|restrict|_Noreturn',
            types:    'int|float|double|char|long|short|unsigned|signed|size_t|ssize_t|ptrdiff_t|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|bool|FILE|wchar_t|clockid_t|time_t',
            constants:'NULL|true|false|INT_MAX|INT_MIN|UINT_MAX|LONG_MAX|LONG_MIN|EOF|EXIT_SUCCESS|EXIT_FAILURE|M_PI|M_E|INFINITY|NAN|CHAR_MAX|CHAR_MIN',
            builtins: 'printf|scanf|fprintf|fscanf|sprintf|snprintf|sscanf|puts|putchar|getchar|fgetc|fputc|fgets|fputs|fopen|fclose|fread|fwrite|fseek|ftell|rewind|fflush|perror|malloc|calloc|realloc|free|memcpy|memmove|memset|memcmp|strlen|strcpy|strncpy|strcat|strncat|strcmp|strncmp|strchr|strrchr|strstr|strtok|strtol|strtof|strtod|atoi|atol|atof|rand|srand|abs|labs|exit|abort|assert',
            hashCls:  'syn-preprocessor'
        },
        cpp: {
            keywords: 'if|else|while|for|do|switch|case|default|break|continue|return|goto|void|struct|union|enum|typedef|sizeof|static|extern|register|auto|volatile|const|inline|class|namespace|using|new|delete|template|typename|this|virtual|override|final|try|catch|throw|public|private|protected|friend|explicit|operator|noexcept|constexpr|consteval|constinit|decltype|mutable|static_assert|co_await|co_return|co_yield|and|or|not|xor|bitand|bitor|compl|and_eq|or_eq|xor_eq|not_eq|restrict',
            types:    'int|float|double|char|long|short|unsigned|signed|bool|string|wstring|size_t|auto|vector|list|deque|queue|stack|set|map|multiset|multimap|unordered_map|unordered_set|pair|tuple|array|bitset|shared_ptr|unique_ptr|weak_ptr|optional|variant|any|span|string_view|FILE|wchar_t',
            constants:'nullptr|NULL|true|false|INT_MAX|INT_MIN|UINT_MAX|LONG_MAX|LONG_MIN|EOF|EXIT_SUCCESS|EXIT_FAILURE|M_PI|M_E|INFINITY|NAN',
            builtins: 'cout|cin|cerr|clog|endl|flush|printf|scanf|malloc|calloc|realloc|free|memcpy|memmove|memset|strlen|strcpy|strcmp|push_back|pop_back|push_front|pop_front|push|pop|top|front|back|begin|end|rbegin|rend|cbegin|cend|size|empty|capacity|reserve|resize|clear|find|insert|erase|emplace|emplace_back|count|sort|stable_sort|reverse|min|max|min_element|max_element|accumulate|fill|copy|move|swap|make_pair|make_tuple|get|to_string|stoi|stof|stod|stol|abs|sqrt|pow|log|exp|ceil|floor|round',
            hashCls:  'syn-preprocessor'
        },
        java: {
            keywords: 'if|else|while|for|do|switch|case|default|break|continue|return|import|package|class|interface|extends|implements|new|this|super|try|catch|finally|throw|throws|public|private|protected|static|void|abstract|final|native|synchronized|volatile|transient|instanceof|enum|record|sealed|permits|var|assert',
            types:    'int|long|float|double|boolean|char|byte|short|String|Integer|Long|Double|Float|Boolean|Character|Byte|Short|Object|Number|Comparable|Serializable|Iterable|Runnable|Callable|Thread|List|ArrayList|LinkedList|HashMap|TreeMap|HashSet|TreeSet|Map|Set|Collection|Optional|Stream|Iterator|Scanner|BufferedReader|PrintWriter|StringBuilder|StringBuffer',
            constants:'null|true|false',
            builtins: 'System|out|err|in|println|print|printf|format|Math|Arrays|Collections|Objects|String|Integer|Double|Long|Boolean|Math.abs|Math.sqrt|Math.pow|Math.log|Math.max|Math.min|Math.floor|Math.ceil|Math.round|Arrays.sort|Arrays.fill|Arrays.copyOf|Collections.sort|Collections.reverse|String.valueOf|String.format|Integer.parseInt|Double.parseDouble|Boolean.parseBoolean',
            hashCls:  'syn-comment'
        },
        python: {
            keywords: 'if|elif|else|while|for|break|continue|return|def|class|import|from|as|try|except|finally|raise|with|pass|lambda|global|nonlocal|del|yield|assert|in|not|and|or|is|match|case|async|await',
            types:    'int|float|str|bool|list|dict|tuple|set|bytes|bytearray|complex|frozenset|memoryview|range|type|object|NoneType|Iterator|Generator|Sequence|Mapping',
            constants:'None|True|False|NotImplemented|Ellipsis',
            builtins: 'print|input|len|range|type|isinstance|issubclass|int|float|str|list|dict|tuple|set|frozenset|bytes|bytearray|bool|abs|min|max|sum|round|pow|divmod|all|any|zip|map|filter|enumerate|sorted|reversed|iter|next|open|repr|vars|dir|id|hash|hex|oct|bin|chr|ord|eval|exec|getattr|setattr|hasattr|delattr|callable|format|super|property|staticmethod|classmethod|slice|breakpoint',
            hashCls:  'syn-comment'
        },
        javascript: {
            keywords: 'if|else|while|for|do|switch|case|default|break|continue|return|function|var|let|const|class|extends|new|this|super|try|catch|finally|throw|import|export|default|from|async|await|of|in|instanceof|typeof|void|delete|yield|static|get|set|debugger',
            types:    'Number|String|Boolean|Array|Object|Symbol|BigInt|Set|Map|WeakMap|WeakSet|WeakRef|Promise|Date|RegExp|Error|TypeError|RangeError|ReferenceError|SyntaxError|URIError|EvalError|Function|Generator|AsyncFunction',
            constants:'null|undefined|true|false|NaN|Infinity|arguments',
            builtins: 'console|log|warn|error|info|debug|dir|table|time|timeEnd|Math|JSON|parseInt|parseFloat|isNaN|isFinite|encodeURIComponent|decodeURIComponent|encodeURI|decodeURI|setTimeout|clearTimeout|setInterval|clearInterval|requestAnimationFrame|cancelAnimationFrame|fetch|document|window|navigator|localStorage|sessionStorage|alert|confirm|prompt|Object|Array|String|Number|Boolean|Symbol|Promise|resolve|reject|then|catch|all|race|any|allSettled|Object.keys|Object.values|Object.entries|Object.assign|Array.from|Array.isArray|Array.of|JSON.stringify|JSON.parse|Math.abs|Math.sqrt|Math.pow|Math.max|Math.min|Math.floor|Math.ceil|Math.round|Math.random',
            hashCls:  'syn-comment'
        }
    };

    /* ==================================================
       BUILD RULE SET FOR A LANGUAGE
       Rules are checked in ORDER — first match wins.
       Critical: strings & comments must come BEFORE
       keywords to prevent matching inside them.
       ================================================== */
    var _cache = {};

    // Per-language print functions for accurate highlighting
    var PRINT_RES = {
        c:          /\b(?:printf|fprintf|sprintf|snprintf|puts|putchar)\b/g,
        cpp:        /\b(?:printf|fprintf|sprintf|snprintf|puts|putchar|cout)\b/g,
        java:       /\b(?:System\.out\.print(?:ln)?|System\.out\.printf)\b/g,
        python:     /\b(?:print)\b/g,
        javascript: /\b(?:console\.(?:log|info|warn|error))\b/g
    };

    function buildRules(lang) {
        var d = DEFS[lang];
        return [
            // 1. Line comments — // (C/C++/Java/JS)
            { re: /\/\/.*/g,              cls: 'syn-comment' },
            // 2. Hash lines — # comment (Python) or #directive (C/C++)
            { re: /#.*/g,                 cls: d.hashCls },
            // 3. Triple-quoted strings (Python) — must come before single "
            { re: /"""[\s\S]*?"""/g,      cls: 'syn-string' },
            { re: /'''[\s\S]*?'''/g,      cls: 'syn-string' },
            // 4. Template literals (JS)
            { re: /`(?:[^`\\]|\\.)*`/g,   cls: 'syn-string' },
            // 5. Regular strings
            { re: /"(?:[^"\\]|\\.)*"/g,   cls: 'syn-string' },
            { re: /'(?:[^'\\]|\\.)*'/g,   cls: 'syn-string' },
            // 6. Numbers — hex, octal, binary, float, int
            { re: /\b0x[0-9a-fA-F]+[lLuU]?\b/g, cls: 'syn-number' },
            { re: /\b0o[0-7]+\b/g,        cls: 'syn-number' },
            { re: /\b0b[01]+\b/g,         cls: 'syn-number' },
            { re: /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFlLuU]?\b/g, cls: 'syn-number' },
            // 7. Constants (true/false/null/None/nullptr etc.)
            { re: new RegExp('\\b(?:' + d.constants + ')\\b', 'g'), cls: 'syn-constant' },
            // 8. Types — before keywords so e.g. "int" doesn't partially match
            { re: new RegExp('\\b(?:' + d.types + ')\\b', 'g'),     cls: 'syn-type' },
            // 9. Keywords
            { re: new RegExp('\\b(?:' + d.keywords + ')\\b', 'g'),  cls: 'syn-keyword' },
            // 10. Print statements (should be white only)
            { re: PRINT_RES[lang] || PRINT_RES.c,             cls: 'syn-print' },
            // 11. Built-ins
            { re: new RegExp('\\b(?:' + d.builtins + ')\\b', 'g'),  cls: 'syn-builtin' },
            // 12. ALL_CAPS identifiers (macros / enum constants)
            { re: /\b[A-Z_][A-Z0-9_]{2,}\b/g,  cls: 'syn-constant' },
            // 13. Function calls — identifier directly followed by (
            { re: /\b[a-zA-Z_]\w*(?=\s*\()/g,  cls: 'syn-function' },
            // 14. PascalCase class names
            { re: /\b[A-Z][A-Za-z0-9_]+\b/g,   cls: 'syn-class' },
            // 15. Escape sequences inside strings (\n, \t, \x41 …)
            { re: /\\(?:[nrtbfv0\\'"`?]|x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[0-7]{1,3})/g, cls: 'syn-escape' },
            // 16. Decorators / annotations  (@Override, @property, @decorator)
            { re: /@[A-Za-z_]\w*/g,             cls: 'syn-decorator' },
            // 17. Regex literals (JS: /pattern/flags)
            { re: /\/(?:[^\/\\\n]|\\.)+\/[gimsuy]*/g, cls: 'syn-regex' },
            // 18. Goto / case labels  (identifier:)
            { re: /\b[A-Za-z_]\w*(?=\s*:)/g,    cls: 'syn-label' },
            // 19. Operators
            { re: /[-+*/%<>!=&|^~?:.]+/g,       cls: 'syn-operator' },
        ];
    }

    function getRules(lang) {
        if (!_cache[lang]) _cache[lang] = buildRules(lang);
        return _cache[lang];
    }

    /* ==================================================
       LINE TOKENIZER
       Handles block comments (/* ... *\/) with `state`
       object passed through all lines for tracking.
       ================================================== */
    function tokenizeLine(line, rules, state) {
        var result = '';
        var i = 0;
        var n = line.length;

        // #include and header file split highlighting (e.g., #include <stdio.h>)
        var includeMatch = line.match(/^(\s*#\s*include)(\s*)(<[^>\n]+>|"[^"\n]+")(.*)$/);
        if (includeMatch) {
            return '<span class="syn-include">' + esc(includeMatch[1]) + '</span>' +
                esc(includeMatch[2]) +
                '<span class="syn-header">' + esc(includeMatch[3]) + '</span>' +
                esc(includeMatch[4]);
        }

        /* --- Continue from a block comment started earlier --- */
        if (state.inBlock) {
            var blockEnd = line.indexOf('*/');
            if (blockEnd === -1) {
                // Entire line still inside block comment
                return '<span class="syn-comment">' + esc(line) + '</span>';
            }
            state.inBlock = false;
            result = '<span class="syn-comment">' + esc(line.substring(0, blockEnd + 2)) + '</span>';
            i = blockEnd + 2;
        }

        /* --- Main single-pass tokenizer --- */
        while (i < n) {

            // Block comment open
            if (line[i] === '/' && i + 1 < n && line[i + 1] === '*') {
                var end2 = line.indexOf('*/', i + 2);
                if (end2 === -1) {
                    // Extends past this line
                    result += '<span class="syn-comment">' + esc(line.substring(i)) + '</span>';
                    state.inBlock = true;
                    return result;
                }
                result += '<span class="syn-comment">' + esc(line.substring(i, end2 + 2)) + '</span>';
                i = end2 + 2;
                continue;
            }

            // Try each rule — first match at position i wins
            var matched = false;
            for (var r = 0; r < rules.length; r++) {
                var rule = rules[r];
                rule.re.lastIndex = i;
                var m = rule.re.exec(line);
                if (m !== null && m.index === i) {
                    result += '<span class="' + rule.cls + '">' + esc(m[0]) + '</span>';
                    i += m[0].length;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                result += esc(line[i]);
                i++;
            }
        }

        return result;
    }

    /* ==================================================
       PUBLIC API
       ================================================== */

    /**
     * highlight(code, lang) → string[]
     * Returns an array of highlighted HTML strings, one per line.
     */
    function highlight(code, lang) {
        lang = (lang || 'c').toLowerCase();
        if (lang === 'c++') lang = 'cpp';
        if (lang === 'js') lang = 'javascript';
        if (lang === 'py') lang = 'python';
        var rules = getRules(lang) || getRules('c');
        var lines = (code || '').split('\n');
        var state = { inBlock: false };
        return lines.map(function (line) {
            return tokenizeLine(line, rules, state);
        });
    }

    /**
     * applyToPreview(code, lang, lineNumsEl, codeEl)
     * Renders highlighted code into the example popup preview panel.
     */
    function applyToPreview(code, lang, lineNumsEl, codeEl) {
        var hlLines = highlight(code, lang);
        var nums = [];
        var lines = [];
        for (var i = 0; i < hlLines.length; i++) {
            nums.push('<span class="line-num">' + (i + 1) + '</span>');
            lines.push('<div class="code-line-preview">' + hlLines[i] + '</div>');
        }
        lineNumsEl.innerHTML = nums.join('');
        codeEl.innerHTML = lines.join('');
    }

    /**
     * applyToViewer(code, lang, containerEl)
     * Renders highlighted code into the main left-panel code viewer.
     */
    function applyToViewer(code, lang, containerEl) {
        var hlLines = highlight(code, lang);
        var parts = [];
        for (var i = 0; i < hlLines.length; i++) {
            parts.push(
                '<div class="code-line">' +
                '<span class="line-number">' + (i + 1) + '</span>' +
                '<span class="code-text">' + hlLines[i] + '</span>' +
                '</div>'
            );
        }
        containerEl.innerHTML = parts.join('');
    }

    /* ==================================================
       CATEGORY COLORS — references category-colors.js
       ================================================== */

    return {
        highlight:      highlight,
        applyToPreview: applyToPreview,
        applyToViewer:  applyToViewer,
        catColor:       CategoryColors.catColor
    };

})();
