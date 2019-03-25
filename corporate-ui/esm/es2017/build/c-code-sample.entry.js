import { h } from '../corporate-ui.core.js';

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var highlight = createCommonjsModule(function (module, exports) {
/*
Syntax highlighting with language autodetection.
https://highlightjs.org/
*/

(function(factory) {

  // Setup highlight.js for different environments. First is Node.js or
  // CommonJS.
  {
    factory(exports);
  }

}(function(hljs) {
  // Convenience variables for build-in objects
  var ArrayProto = [],
      objectKeys = Object.keys;

  // Global internal variables used within the highlight.js library.
  var languages = {},
      aliases   = {};

  // Regular expressions used throughout the highlight.js library.
  var noHighlightRe    = /^(no-?highlight|plain|text)$/i,
      languagePrefixRe = /\blang(?:uage)?-([\w-]+)\b/i,
      fixMarkupRe      = /((^(<[^>]+>|\t|)+|(?:\n)))/gm;

  var spanEndTag = '</span>';

  // Global options used when within external APIs. This is modified when
  // calling the `hljs.configure` function.
  var options = {
    classPrefix: 'hljs-',
    tabReplace: null,
    useBR: false,
    languages: undefined
  };


  /* Utility functions */

  function escape(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function tag(node) {
    return node.nodeName.toLowerCase();
  }

  function testRe(re, lexeme) {
    var match = re && re.exec(lexeme);
    return match && match.index === 0;
  }

  function isNotHighlighted(language) {
    return noHighlightRe.test(language);
  }

  function blockLanguage(block) {
    var i, match, length, _class;
    var classes = block.className + ' ';

    classes += block.parentNode ? block.parentNode.className : '';

    // language-* takes precedence over non-prefixed class names.
    match = languagePrefixRe.exec(classes);
    if (match) {
      return getLanguage(match[1]) ? match[1] : 'no-highlight';
    }

    classes = classes.split(/\s+/);

    for (i = 0, length = classes.length; i < length; i++) {
      _class = classes[i];

      if (isNotHighlighted(_class) || getLanguage(_class)) {
        return _class;
      }
    }
  }

  function inherit(parent) {  // inherit(parent, override_obj, override_obj, ...)
    var key;
    var result = {};
    var objects = Array.prototype.slice.call(arguments, 1);

    for (key in parent)
      result[key] = parent[key];
    objects.forEach(function(obj) {
      for (key in obj)
        result[key] = obj[key];
    });
    return result;
  }

  /* Stream merging */

  function nodeStream(node) {
    var result = [];
    (function _nodeStream(node, offset) {
      for (var child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 3)
          offset += child.nodeValue.length;
        else if (child.nodeType === 1) {
          result.push({
            event: 'start',
            offset: offset,
            node: child
          });
          offset = _nodeStream(child, offset);
          // Prevent void elements from having an end tag that would actually
          // double them in the output. There are more void elements in HTML
          // but we list only those realistically expected in code display.
          if (!tag(child).match(/br|hr|img|input/)) {
            result.push({
              event: 'stop',
              offset: offset,
              node: child
            });
          }
        }
      }
      return offset;
    })(node, 0);
    return result;
  }

  function mergeStreams(original, highlighted, value) {
    var processed = 0;
    var result = '';
    var nodeStack = [];

    function selectStream() {
      if (!original.length || !highlighted.length) {
        return original.length ? original : highlighted;
      }
      if (original[0].offset !== highlighted[0].offset) {
        return (original[0].offset < highlighted[0].offset) ? original : highlighted;
      }

      /*
      To avoid starting the stream just before it should stop the order is
      ensured that original always starts first and closes last:

      if (event1 == 'start' && event2 == 'start')
        return original;
      if (event1 == 'start' && event2 == 'stop')
        return highlighted;
      if (event1 == 'stop' && event2 == 'start')
        return original;
      if (event1 == 'stop' && event2 == 'stop')
        return highlighted;

      ... which is collapsed to:
      */
      return highlighted[0].event === 'start' ? original : highlighted;
    }

    function open(node) {
      function attr_str(a) {return ' ' + a.nodeName + '="' + escape(a.value).replace('"', '&quot;') + '"';}
      result += '<' + tag(node) + ArrayProto.map.call(node.attributes, attr_str).join('') + '>';
    }

    function close(node) {
      result += '</' + tag(node) + '>';
    }

    function render(event) {
      (event.event === 'start' ? open : close)(event.node);
    }

    while (original.length || highlighted.length) {
      var stream = selectStream();
      result += escape(value.substring(processed, stream[0].offset));
      processed = stream[0].offset;
      if (stream === original) {
        /*
        On any opening or closing tag of the original markup we first close
        the entire highlighted node stack, then render the original tag along
        with all the following original tags at the same offset and then
        reopen all the tags on the highlighted stack.
        */
        nodeStack.reverse().forEach(close);
        do {
          render(stream.splice(0, 1)[0]);
          stream = selectStream();
        } while (stream === original && stream.length && stream[0].offset === processed);
        nodeStack.reverse().forEach(open);
      } else {
        if (stream[0].event === 'start') {
          nodeStack.push(stream[0].node);
        } else {
          nodeStack.pop();
        }
        render(stream.splice(0, 1)[0]);
      }
    }
    return result + escape(value.substr(processed));
  }

  /* Initialization */

  function expand_mode(mode) {
    if (mode.variants && !mode.cached_variants) {
      mode.cached_variants = mode.variants.map(function(variant) {
        return inherit(mode, {variants: null}, variant);
      });
    }
    return mode.cached_variants || (mode.endsWithParent && [inherit(mode)]) || [mode];
  }

  function compileLanguage(language) {

    function reStr(re) {
        return (re && re.source) || re;
    }

    function langRe(value, global) {
      return new RegExp(
        reStr(value),
        'm' + (language.case_insensitive ? 'i' : '') + (global ? 'g' : '')
      );
    }

    // joinRe logically computes regexps.join(separator), but fixes the
    // backreferences so they continue to match.
    function joinRe(regexps, separator) {
      // backreferenceRe matches an open parenthesis or backreference. To avoid
      // an incorrect parse, it additionally matches the following:
      // - [...] elements, where the meaning of parentheses and escapes change
      // - other escape sequences, so we do not misparse escape sequences as
      //   interesting elements
      // - non-matching or lookahead parentheses, which do not capture. These
      //   follow the '(' with a '?'.
      var backreferenceRe = /\[(?:[^\\\]]|\\.)*\]|\(\??|\\([1-9][0-9]*)|\\./;
      var numCaptures = 0;
      var ret = '';
      for (var i = 0; i < regexps.length; i++) {
        var offset = numCaptures;
        var re = reStr(regexps[i]);
        if (i > 0) {
          ret += separator;
        }
        while (re.length > 0) {
          var match = backreferenceRe.exec(re);
          if (match == null) {
            ret += re;
            break;
          }
          ret += re.substring(0, match.index);
          re = re.substring(match.index + match[0].length);
          if (match[0][0] == '\\' && match[1]) {
            // Adjust the backreference.
            ret += '\\' + String(Number(match[1]) + offset);
          } else {
            ret += match[0];
            if (match[0] == '(') {
              numCaptures++;
            }
          }
        }
      }
      return ret;
    }

    function compileMode(mode, parent) {
      if (mode.compiled)
        return;
      mode.compiled = true;

      mode.keywords = mode.keywords || mode.beginKeywords;
      if (mode.keywords) {
        var compiled_keywords = {};

        var flatten = function(className, str) {
          if (language.case_insensitive) {
            str = str.toLowerCase();
          }
          str.split(' ').forEach(function(kw) {
            var pair = kw.split('|');
            compiled_keywords[pair[0]] = [className, pair[1] ? Number(pair[1]) : 1];
          });
        };

        if (typeof mode.keywords === 'string') { // string
          flatten('keyword', mode.keywords);
        } else {
          objectKeys(mode.keywords).forEach(function (className) {
            flatten(className, mode.keywords[className]);
          });
        }
        mode.keywords = compiled_keywords;
      }
      mode.lexemesRe = langRe(mode.lexemes || /\w+/, true);

      if (parent) {
        if (mode.beginKeywords) {
          mode.begin = '\\b(' + mode.beginKeywords.split(' ').join('|') + ')\\b';
        }
        if (!mode.begin)
          mode.begin = /\B|\b/;
        mode.beginRe = langRe(mode.begin);
        if (mode.endSameAsBegin)
          mode.end = mode.begin;
        if (!mode.end && !mode.endsWithParent)
          mode.end = /\B|\b/;
        if (mode.end)
          mode.endRe = langRe(mode.end);
        mode.terminator_end = reStr(mode.end) || '';
        if (mode.endsWithParent && parent.terminator_end)
          mode.terminator_end += (mode.end ? '|' : '') + parent.terminator_end;
      }
      if (mode.illegal)
        mode.illegalRe = langRe(mode.illegal);
      if (mode.relevance == null)
        mode.relevance = 1;
      if (!mode.contains) {
        mode.contains = [];
      }
      mode.contains = Array.prototype.concat.apply([], mode.contains.map(function(c) {
        return expand_mode(c === 'self' ? mode : c);
      }));
      mode.contains.forEach(function(c) {compileMode(c, mode);});

      if (mode.starts) {
        compileMode(mode.starts, parent);
      }

      var terminators =
        mode.contains.map(function(c) {
          return c.beginKeywords ? '\\.?(?:' + c.begin + ')\\.?' : c.begin;
        })
        .concat([mode.terminator_end, mode.illegal])
        .map(reStr)
        .filter(Boolean);
      mode.terminators = terminators.length ? langRe(joinRe(terminators, '|'), true) : {exec: function(/*s*/) {return null;}};
    }
    
    compileMode(language);
  }

  /*
  Core highlighting function. Accepts a language name, or an alias, and a
  string with the code to highlight. Returns an object with the following
  properties:

  - relevance (int)
  - value (an HTML string with highlighting markup)

  */
  function highlight(name, value, ignore_illegals, continuation) {

    function escapeRe(value) {
      return new RegExp(value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'm');
    }

    function subMode(lexeme, mode) {
      var i, length;

      for (i = 0, length = mode.contains.length; i < length; i++) {
        if (testRe(mode.contains[i].beginRe, lexeme)) {
          if (mode.contains[i].endSameAsBegin) {
            mode.contains[i].endRe = escapeRe( mode.contains[i].beginRe.exec(lexeme)[0] );
          }
          return mode.contains[i];
        }
      }
    }

    function endOfMode(mode, lexeme) {
      if (testRe(mode.endRe, lexeme)) {
        while (mode.endsParent && mode.parent) {
          mode = mode.parent;
        }
        return mode;
      }
      if (mode.endsWithParent) {
        return endOfMode(mode.parent, lexeme);
      }
    }

    function isIllegal(lexeme, mode) {
      return !ignore_illegals && testRe(mode.illegalRe, lexeme);
    }

    function keywordMatch(mode, match) {
      var match_str = language.case_insensitive ? match[0].toLowerCase() : match[0];
      return mode.keywords.hasOwnProperty(match_str) && mode.keywords[match_str];
    }

    function buildSpan(classname, insideSpan, leaveOpen, noPrefix) {
      var classPrefix = noPrefix ? '' : options.classPrefix,
          openSpan    = '<span class="' + classPrefix,
          closeSpan   = leaveOpen ? '' : spanEndTag;

      openSpan += classname + '">';

      return openSpan + insideSpan + closeSpan;
    }

    function processKeywords() {
      var keyword_match, last_index, match, result;

      if (!top.keywords)
        return escape(mode_buffer);

      result = '';
      last_index = 0;
      top.lexemesRe.lastIndex = 0;
      match = top.lexemesRe.exec(mode_buffer);

      while (match) {
        result += escape(mode_buffer.substring(last_index, match.index));
        keyword_match = keywordMatch(top, match);
        if (keyword_match) {
          relevance += keyword_match[1];
          result += buildSpan(keyword_match[0], escape(match[0]));
        } else {
          result += escape(match[0]);
        }
        last_index = top.lexemesRe.lastIndex;
        match = top.lexemesRe.exec(mode_buffer);
      }
      return result + escape(mode_buffer.substr(last_index));
    }

    function processSubLanguage() {
      var explicit = typeof top.subLanguage === 'string';
      if (explicit && !languages[top.subLanguage]) {
        return escape(mode_buffer);
      }

      var result = explicit ?
                   highlight(top.subLanguage, mode_buffer, true, continuations[top.subLanguage]) :
                   highlightAuto(mode_buffer, top.subLanguage.length ? top.subLanguage : undefined);

      // Counting embedded language score towards the host language may be disabled
      // with zeroing the containing mode relevance. Usecase in point is Markdown that
      // allows XML everywhere and makes every XML snippet to have a much larger Markdown
      // score.
      if (top.relevance > 0) {
        relevance += result.relevance;
      }
      if (explicit) {
        continuations[top.subLanguage] = result.top;
      }
      return buildSpan(result.language, result.value, false, true);
    }

    function processBuffer() {
      result += (top.subLanguage != null ? processSubLanguage() : processKeywords());
      mode_buffer = '';
    }

    function startNewMode(mode) {
      result += mode.className? buildSpan(mode.className, '', true): '';
      top = Object.create(mode, {parent: {value: top}});
    }

    function processLexeme(buffer, lexeme) {

      mode_buffer += buffer;

      if (lexeme == null) {
        processBuffer();
        return 0;
      }

      var new_mode = subMode(lexeme, top);
      if (new_mode) {
        if (new_mode.skip) {
          mode_buffer += lexeme;
        } else {
          if (new_mode.excludeBegin) {
            mode_buffer += lexeme;
          }
          processBuffer();
          if (!new_mode.returnBegin && !new_mode.excludeBegin) {
            mode_buffer = lexeme;
          }
        }
        startNewMode(new_mode, lexeme);
        return new_mode.returnBegin ? 0 : lexeme.length;
      }

      var end_mode = endOfMode(top, lexeme);
      if (end_mode) {
        var origin = top;
        if (origin.skip) {
          mode_buffer += lexeme;
        } else {
          if (!(origin.returnEnd || origin.excludeEnd)) {
            mode_buffer += lexeme;
          }
          processBuffer();
          if (origin.excludeEnd) {
            mode_buffer = lexeme;
          }
        }
        do {
          if (top.className) {
            result += spanEndTag;
          }
          if (!top.skip && !top.subLanguage) {
            relevance += top.relevance;
          }
          top = top.parent;
        } while (top !== end_mode.parent);
        if (end_mode.starts) {
          if (end_mode.endSameAsBegin) {
            end_mode.starts.endRe = end_mode.endRe;
          }
          startNewMode(end_mode.starts, '');
        }
        return origin.returnEnd ? 0 : lexeme.length;
      }

      if (isIllegal(lexeme, top))
        throw new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.className || '<unnamed>') + '"');

      /*
      Parser should not reach this point as all types of lexemes should be caught
      earlier, but if it does due to some bug make sure it advances at least one
      character forward to prevent infinite looping.
      */
      mode_buffer += lexeme;
      return lexeme.length || 1;
    }

    var language = getLanguage(name);
    if (!language) {
      throw new Error('Unknown language: "' + name + '"');
    }

    compileLanguage(language);
    var top = continuation || language;
    var continuations = {}; // keep continuations for sub-languages
    var result = '', current;
    for(current = top; current !== language; current = current.parent) {
      if (current.className) {
        result = buildSpan(current.className, '', true) + result;
      }
    }
    var mode_buffer = '';
    var relevance = 0;
    try {
      var match, count, index = 0;
      while (true) {
        top.terminators.lastIndex = index;
        match = top.terminators.exec(value);
        if (!match)
          break;
        count = processLexeme(value.substring(index, match.index), match[0]);
        index = match.index + count;
      }
      processLexeme(value.substr(index));
      for(current = top; current.parent; current = current.parent) { // close dangling modes
        if (current.className) {
          result += spanEndTag;
        }
      }
      return {
        relevance: relevance,
        value: result,
        language: name,
        top: top
      };
    } catch (e) {
      if (e.message && e.message.indexOf('Illegal') !== -1) {
        return {
          relevance: 0,
          value: escape(value)
        };
      } else {
        throw e;
      }
    }
  }

  /*
  Highlighting with language detection. Accepts a string with the code to
  highlight. Returns an object with the following properties:

  - language (detected language)
  - relevance (int)
  - value (an HTML string with highlighting markup)
  - second_best (object with the same structure for second-best heuristically
    detected language, may be absent)

  */
  function highlightAuto(text, languageSubset) {
    languageSubset = languageSubset || options.languages || objectKeys(languages);
    var result = {
      relevance: 0,
      value: escape(text)
    };
    var second_best = result;
    languageSubset.filter(getLanguage).filter(autoDetection).forEach(function(name) {
      var current = highlight(name, text, false);
      current.language = name;
      if (current.relevance > second_best.relevance) {
        second_best = current;
      }
      if (current.relevance > result.relevance) {
        second_best = result;
        result = current;
      }
    });
    if (second_best.language) {
      result.second_best = second_best;
    }
    return result;
  }

  /*
  Post-processing of the highlighted markup:

  - replace TABs with something more useful
  - replace real line-breaks with '<br>' for non-pre containers

  */
  function fixMarkup(value) {
    return !(options.tabReplace || options.useBR)
      ? value
      : value.replace(fixMarkupRe, function(match, p1) {
          if (options.useBR && match === '\n') {
            return '<br>';
          } else if (options.tabReplace) {
            return p1.replace(/\t/g, options.tabReplace);
          }
          return '';
      });
  }

  function buildClassName(prevClassName, currentLang, resultLang) {
    var language = currentLang ? aliases[currentLang] : resultLang,
        result   = [prevClassName.trim()];

    if (!prevClassName.match(/\bhljs\b/)) {
      result.push('hljs');
    }

    if (prevClassName.indexOf(language) === -1) {
      result.push(language);
    }

    return result.join(' ').trim();
  }

  /*
  Applies highlighting to a DOM node containing code. Accepts a DOM node and
  two optional parameters for fixMarkup.
  */
  function highlightBlock(block) {
    var node, originalStream, result, resultNode, text;
    var language = blockLanguage(block);

    if (isNotHighlighted(language))
        return;

    if (options.useBR) {
      node = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      node.innerHTML = block.innerHTML.replace(/\n/g, '').replace(/<br[ \/]*>/g, '\n');
    } else {
      node = block;
    }
    text = node.textContent;
    result = language ? highlight(language, text, true) : highlightAuto(text);

    originalStream = nodeStream(node);
    if (originalStream.length) {
      resultNode = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      resultNode.innerHTML = result.value;
      result.value = mergeStreams(originalStream, nodeStream(resultNode), text);
    }
    result.value = fixMarkup(result.value);

    block.innerHTML = result.value;
    block.className = buildClassName(block.className, language, result.language);
    block.result = {
      language: result.language,
      re: result.relevance
    };
    if (result.second_best) {
      block.second_best = {
        language: result.second_best.language,
        re: result.second_best.relevance
      };
    }
  }

  /*
  Updates highlight.js global options with values passed in the form of an object.
  */
  function configure(user_options) {
    options = inherit(options, user_options);
  }

  /*
  Applies highlighting to all <pre><code>..</code></pre> blocks on a page.
  */
  function initHighlighting() {
    if (initHighlighting.called)
      return;
    initHighlighting.called = true;

    var blocks = document.querySelectorAll('pre code');
    ArrayProto.forEach.call(blocks, highlightBlock);
  }

  /*
  Attaches highlighting to the page load event.
  */
  function initHighlightingOnLoad() {
    addEventListener('DOMContentLoaded', initHighlighting, false);
    addEventListener('load', initHighlighting, false);
  }

  function registerLanguage(name, language) {
    var lang = languages[name] = language(hljs);
    if (lang.aliases) {
      lang.aliases.forEach(function(alias) {aliases[alias] = name;});
    }
  }

  function listLanguages() {
    return objectKeys(languages);
  }

  function getLanguage(name) {
    name = (name || '').toLowerCase();
    return languages[name] || languages[aliases[name]];
  }

  function autoDetection(name) {
    var lang = getLanguage(name);
    return lang && !lang.disableAutodetect;
  }

  /* Interface definition */

  hljs.highlight = highlight;
  hljs.highlightAuto = highlightAuto;
  hljs.fixMarkup = fixMarkup;
  hljs.highlightBlock = highlightBlock;
  hljs.configure = configure;
  hljs.initHighlighting = initHighlighting;
  hljs.initHighlightingOnLoad = initHighlightingOnLoad;
  hljs.registerLanguage = registerLanguage;
  hljs.listLanguages = listLanguages;
  hljs.getLanguage = getLanguage;
  hljs.autoDetection = autoDetection;
  hljs.inherit = inherit;

  // Common regexps
  hljs.IDENT_RE = '[a-zA-Z]\\w*';
  hljs.UNDERSCORE_IDENT_RE = '[a-zA-Z_]\\w*';
  hljs.NUMBER_RE = '\\b\\d+(\\.\\d+)?';
  hljs.C_NUMBER_RE = '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'; // 0x..., 0..., decimal, float
  hljs.BINARY_NUMBER_RE = '\\b(0b[01]+)'; // 0b...
  hljs.RE_STARTERS_RE = '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';

  // Common modes
  hljs.BACKSLASH_ESCAPE = {
    begin: '\\\\[\\s\\S]', relevance: 0
  };
  hljs.APOS_STRING_MODE = {
    className: 'string',
    begin: '\'', end: '\'',
    illegal: '\\n',
    contains: [hljs.BACKSLASH_ESCAPE]
  };
  hljs.QUOTE_STRING_MODE = {
    className: 'string',
    begin: '"', end: '"',
    illegal: '\\n',
    contains: [hljs.BACKSLASH_ESCAPE]
  };
  hljs.PHRASAL_WORDS_MODE = {
    begin: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/
  };
  hljs.COMMENT = function (begin, end, inherits) {
    var mode = hljs.inherit(
      {
        className: 'comment',
        begin: begin, end: end,
        contains: []
      },
      inherits || {}
    );
    mode.contains.push(hljs.PHRASAL_WORDS_MODE);
    mode.contains.push({
      className: 'doctag',
      begin: '(?:TODO|FIXME|NOTE|BUG|XXX):',
      relevance: 0
    });
    return mode;
  };
  hljs.C_LINE_COMMENT_MODE = hljs.COMMENT('//', '$');
  hljs.C_BLOCK_COMMENT_MODE = hljs.COMMENT('/\\*', '\\*/');
  hljs.HASH_COMMENT_MODE = hljs.COMMENT('#', '$');
  hljs.NUMBER_MODE = {
    className: 'number',
    begin: hljs.NUMBER_RE,
    relevance: 0
  };
  hljs.C_NUMBER_MODE = {
    className: 'number',
    begin: hljs.C_NUMBER_RE,
    relevance: 0
  };
  hljs.BINARY_NUMBER_MODE = {
    className: 'number',
    begin: hljs.BINARY_NUMBER_RE,
    relevance: 0
  };
  hljs.CSS_NUMBER_MODE = {
    className: 'number',
    begin: hljs.NUMBER_RE + '(' +
      '%|em|ex|ch|rem'  +
      '|vw|vh|vmin|vmax' +
      '|cm|mm|in|pt|pc|px' +
      '|deg|grad|rad|turn' +
      '|s|ms' +
      '|Hz|kHz' +
      '|dpi|dpcm|dppx' +
      ')?',
    relevance: 0
  };
  hljs.REGEXP_MODE = {
    className: 'regexp',
    begin: /\//, end: /\/[gimuy]*/,
    illegal: /\n/,
    contains: [
      hljs.BACKSLASH_ESCAPE,
      {
        begin: /\[/, end: /\]/,
        relevance: 0,
        contains: [hljs.BACKSLASH_ESCAPE]
      }
    ]
  };
  hljs.TITLE_MODE = {
    className: 'title',
    begin: hljs.IDENT_RE,
    relevance: 0
  };
  hljs.UNDERSCORE_TITLE_MODE = {
    className: 'title',
    begin: hljs.UNDERSCORE_IDENT_RE,
    relevance: 0
  };
  hljs.METHOD_GUARD = {
    // excludes method names from keyword processing
    begin: '\\.\\s*' + hljs.UNDERSCORE_IDENT_RE,
    relevance: 0
  };

  return hljs;
}));
});

var _1c = function(hljs){

  // общий паттерн для определения идентификаторов
  var UNDERSCORE_IDENT_RE = '[A-Za-zА-Яа-яёЁ_][A-Za-zА-Яа-яёЁ_0-9]+';
  
  // v7 уникальные ключевые слова, отсутствующие в v8 ==> keyword
  var v7_keywords =
  'далее ';

  // v8 ключевые слова ==> keyword
  var v8_keywords =
  'возврат вызватьисключение выполнить для если и из или иначе иначеесли исключение каждого конецесли ' +
  'конецпопытки конеццикла не новый перейти перем по пока попытка прервать продолжить тогда цикл экспорт ';

  // keyword : ключевые слова
  var KEYWORD = v7_keywords + v8_keywords;
  
  // v7 уникальные директивы, отсутствующие в v8 ==> meta-keyword
  var v7_meta_keywords =
  'загрузитьизфайла ';

  // v8 ключевые слова в инструкциях препроцессора, директивах компиляции, аннотациях ==> meta-keyword
  var v8_meta_keywords =
  'вебклиент вместо внешнеесоединение клиент конецобласти мобильноеприложениеклиент мобильноеприложениесервер ' +
  'наклиенте наклиентенасервере наклиентенасерверебезконтекста насервере насерверебезконтекста область перед ' +
  'после сервер толстыйклиентобычноеприложение толстыйклиентуправляемоеприложение тонкийклиент ';

  // meta-keyword : ключевые слова в инструкциях препроцессора, директивах компиляции, аннотациях
  var METAKEYWORD = v7_meta_keywords + v8_meta_keywords;

  // v7 системные константы ==> built_in
  var v7_system_constants =
  'разделительстраниц разделительстрок символтабуляции ';
  
  // v7 уникальные методы глобального контекста, отсутствующие в v8 ==> built_in
  var v7_global_context_methods =
  'ansitooem oemtoansi ввестивидсубконто ввестиперечисление ввестипериод ввестиплансчетов выбранныйплансчетов ' +
  'датагод датамесяц датачисло заголовоксистемы значениевстроку значениеизстроки каталогиб каталогпользователя ' +
  'кодсимв конгода конецпериодаби конецрассчитанногопериодаби конецстандартногоинтервала конквартала конмесяца ' +
  'коннедели лог лог10 максимальноеколичествосубконто названиеинтерфейса названиенабораправ назначитьвид ' +
  'назначитьсчет найтиссылки началопериодаби началостандартногоинтервала начгода начквартала начмесяца ' +
  'начнедели номерднягода номерднянедели номернеделигода обработкаожидания основнойжурналрасчетов ' +
  'основнойплансчетов основнойязык очиститьокносообщений периодстр получитьвремята получитьдатута ' +
  'получитьдокументта получитьзначенияотбора получитьпозициюта получитьпустоезначение получитьта ' +
  'префиксавтонумерации пропись пустоезначение разм разобратьпозициюдокумента рассчитатьрегистрына ' +
  'рассчитатьрегистрыпо симв создатьобъект статусвозврата стрколичествострок сформироватьпозициюдокумента ' +
  'счетпокоду текущеевремя типзначения типзначениястр установитьтана установитьтапо фиксшаблон шаблон ';
  
  // v8 методы глобального контекста ==> built_in
  var v8_global_context_methods =
  'acos asin atan base64значение base64строка cos exp log log10 pow sin sqrt tan xmlзначение xmlстрока ' +
  'xmlтип xmlтипзнч активноеокно безопасныйрежим безопасныйрежимразделенияданных булево ввестидату ввестизначение ' +
  'ввестистроку ввестичисло возможностьчтенияxml вопрос восстановитьзначение врег выгрузитьжурналрегистрации ' +
  'выполнитьобработкуоповещения выполнитьпроверкуправдоступа вычислить год данныеформывзначение дата день деньгода ' +
  'деньнедели добавитьмесяц заблокироватьданныедляредактирования заблокироватьработупользователя завершитьработусистемы ' +
  'загрузитьвнешнююкомпоненту закрытьсправку записатьjson записатьxml записатьдатуjson записьжурналарегистрации ' +
  'заполнитьзначениясвойств запроситьразрешениепользователя запуститьприложение запуститьсистему зафиксироватьтранзакцию ' +
  'значениевданныеформы значениевстрокувнутр значениевфайл значениезаполнено значениеизстрокивнутр значениеизфайла ' +
  'изxmlтипа импортмоделиxdto имякомпьютера имяпользователя инициализироватьпредопределенныеданные информацияобошибке ' +
  'каталогбиблиотекимобильногоустройства каталогвременныхфайлов каталогдокументов каталогпрограммы кодироватьстроку ' +
  'кодлокализацииинформационнойбазы кодсимвола командасистемы конецгода конецдня конецквартала конецмесяца конецминуты ' +
  'конецнедели конецчаса конфигурациябазыданныхизмененадинамически конфигурацияизменена копироватьданныеформы ' +
  'копироватьфайл краткоепредставлениеошибки лев макс местноевремя месяц мин минута монопольныйрежим найти ' +
  'найтинедопустимыесимволыxml найтиокнопонавигационнойссылке найтипомеченныенаудаление найтипоссылкам найтифайлы ' +
  'началогода началодня началоквартала началомесяца началоминуты началонедели началочаса начатьзапросразрешенияпользователя ' +
  'начатьзапускприложения начатькопированиефайла начатьперемещениефайла начатьподключениевнешнейкомпоненты ' +
  'начатьподключениерасширенияработыскриптографией начатьподключениерасширенияработысфайлами начатьпоискфайлов ' +
  'начатьполучениекаталогавременныхфайлов начатьполучениекаталогадокументов начатьполучениерабочегокаталогаданныхпользователя ' +
  'начатьполучениефайлов начатьпомещениефайла начатьпомещениефайлов начатьсозданиедвоичныхданныхизфайла начатьсозданиекаталога ' +
  'начатьтранзакцию начатьудалениефайлов начатьустановкувнешнейкомпоненты начатьустановкурасширенияработыскриптографией ' +
  'начатьустановкурасширенияработысфайлами неделягода необходимостьзавершениясоединения номерсеансаинформационнойбазы ' +
  'номерсоединенияинформационнойбазы нрег нстр обновитьинтерфейс обновитьнумерациюобъектов обновитьповторноиспользуемыезначения ' +
  'обработкапрерыванияпользователя объединитьфайлы окр описаниеошибки оповестить оповеститьобизменении ' +
  'отключитьобработчикзапросанастроекклиенталицензирования отключитьобработчикожидания отключитьобработчикоповещения ' +
  'открытьзначение открытьиндекссправки открытьсодержаниесправки открытьсправку открытьформу открытьформумодально ' +
  'отменитьтранзакцию очиститьжурналрегистрации очиститьнастройкипользователя очиститьсообщения параметрыдоступа ' +
  'перейтипонавигационнойссылке переместитьфайл подключитьвнешнююкомпоненту ' +
  'подключитьобработчикзапросанастроекклиенталицензирования подключитьобработчикожидания подключитьобработчикоповещения ' +
  'подключитьрасширениеработыскриптографией подключитьрасширениеработысфайлами подробноепредставлениеошибки ' +
  'показатьвводдаты показатьвводзначения показатьвводстроки показатьвводчисла показатьвопрос показатьзначение ' +
  'показатьинформациюобошибке показатьнакарте показатьоповещениепользователя показатьпредупреждение полноеимяпользователя ' +
  'получитьcomобъект получитьxmlтип получитьадреспоместоположению получитьблокировкусеансов получитьвремязавершенияспящегосеанса ' +
  'получитьвремязасыпанияпассивногосеанса получитьвремяожиданияблокировкиданных получитьданныевыбора ' +
  'получитьдополнительныйпараметрклиенталицензирования получитьдопустимыекодылокализации получитьдопустимыечасовыепояса ' +
  'получитьзаголовокклиентскогоприложения получитьзаголовоксистемы получитьзначенияотборажурналарегистрации ' +
  'получитьидентификаторконфигурации получитьизвременногохранилища получитьимявременногофайла ' +
  'получитьимяклиенталицензирования получитьинформациюэкрановклиента получитьиспользованиежурналарегистрации ' +
  'получитьиспользованиесобытияжурналарегистрации получитькраткийзаголовокприложения получитьмакетоформления ' +
  'получитьмаскувсефайлы получитьмаскувсефайлыклиента получитьмаскувсефайлысервера получитьместоположениепоадресу ' +
  'получитьминимальнуюдлинупаролейпользователей получитьнавигационнуюссылку получитьнавигационнуюссылкуинформационнойбазы ' +
  'получитьобновлениеконфигурациибазыданных получитьобновлениепредопределенныхданныхинформационнойбазы получитьобщиймакет ' +
  'получитьобщуюформу получитьокна получитьоперативнуюотметкувремени получитьотключениебезопасногорежима ' +
  'получитьпараметрыфункциональныхопцийинтерфейса получитьполноеимяпредопределенногозначения ' +
  'получитьпредставлениянавигационныхссылок получитьпроверкусложностипаролейпользователей получитьразделительпути ' +
  'получитьразделительпутиклиента получитьразделительпутисервера получитьсеансыинформационнойбазы ' +
  'получитьскоростьклиентскогосоединения получитьсоединенияинформационнойбазы получитьсообщенияпользователю ' +
  'получитьсоответствиеобъектаиформы получитьсоставстандартногоинтерфейсаodata получитьструктурухранениябазыданных ' +
  'получитьтекущийсеансинформационнойбазы получитьфайл получитьфайлы получитьформу получитьфункциональнуюопцию ' +
  'получитьфункциональнуюопциюинтерфейса получитьчасовойпоясинформационнойбазы пользователиос поместитьвовременноехранилище ' +
  'поместитьфайл поместитьфайлы прав праводоступа предопределенноезначение представлениекодалокализации представлениепериода ' +
  'представлениеправа представлениеприложения представлениесобытияжурналарегистрации представлениечасовогопояса предупреждение ' +
  'прекратитьработусистемы привилегированныйрежим продолжитьвызов прочитатьjson прочитатьxml прочитатьдатуjson пустаястрока ' +
  'рабочийкаталогданныхпользователя разблокироватьданныедляредактирования разделитьфайл разорватьсоединениесвнешнимисточникомданных ' +
  'раскодироватьстроку рольдоступна секунда сигнал символ скопироватьжурналрегистрации смещениелетнеговремени ' +
  'смещениестандартноговремени соединитьбуферыдвоичныхданных создатькаталог создатьфабрикуxdto сокрл сокрлп сокрп сообщить ' +
  'состояние сохранитьзначение сохранитьнастройкипользователя сред стрдлина стрзаканчиваетсяна стрзаменить стрнайти стрначинаетсяс ' +
  'строка строкасоединенияинформационнойбазы стрполучитьстроку стрразделить стрсоединить стрсравнить стрчисловхождений '+
  'стрчислострок стршаблон текущаядата текущаядатасеанса текущаяуниверсальнаядата текущаяуниверсальнаядатавмиллисекундах ' +
  'текущийвариантинтерфейсаклиентскогоприложения текущийвариантосновногошрифтаклиентскогоприложения текущийкодлокализации ' +
  'текущийрежимзапуска текущийязык текущийязыксистемы тип типзнч транзакцияактивна трег удалитьданныеинформационнойбазы ' +
  'удалитьизвременногохранилища удалитьобъекты удалитьфайлы универсальноевремя установитьбезопасныйрежим ' +
  'установитьбезопасныйрежимразделенияданных установитьблокировкусеансов установитьвнешнююкомпоненту ' +
  'установитьвремязавершенияспящегосеанса установитьвремязасыпанияпассивногосеанса установитьвремяожиданияблокировкиданных ' +
  'установитьзаголовокклиентскогоприложения установитьзаголовоксистемы установитьиспользованиежурналарегистрации ' +
  'установитьиспользованиесобытияжурналарегистрации установитькраткийзаголовокприложения ' +
  'установитьминимальнуюдлинупаролейпользователей установитьмонопольныйрежим установитьнастройкиклиенталицензирования ' +
  'установитьобновлениепредопределенныхданныхинформационнойбазы установитьотключениебезопасногорежима ' +
  'установитьпараметрыфункциональныхопцийинтерфейса установитьпривилегированныйрежим ' +
  'установитьпроверкусложностипаролейпользователей установитьрасширениеработыскриптографией ' +
  'установитьрасширениеработысфайлами установитьсоединениесвнешнимисточникомданных установитьсоответствиеобъектаиформы ' +
  'установитьсоставстандартногоинтерфейсаodata установитьчасовойпоясинформационнойбазы установитьчасовойпояссеанса ' +
  'формат цел час часовойпояс часовойпояссеанса число числопрописью этоадресвременногохранилища ';

  // v8 свойства глобального контекста ==> built_in
  var v8_global_context_property =
  'wsссылки библиотекакартинок библиотекамакетовоформлениякомпоновкиданных библиотекастилей бизнеспроцессы ' +
  'внешниеисточникиданных внешниеобработки внешниеотчеты встроенныепокупки главныйинтерфейс главныйстиль ' +
  'документы доставляемыеуведомления журналыдокументов задачи информацияобинтернетсоединении использованиерабочейдаты ' +
  'историяработыпользователя константы критерииотбора метаданные обработки отображениерекламы отправкадоставляемыхуведомлений ' +
  'отчеты панельзадачос параметрзапуска параметрысеанса перечисления планывидоврасчета планывидовхарактеристик ' +
  'планыобмена планысчетов полнотекстовыйпоиск пользователиинформационнойбазы последовательности проверкавстроенныхпокупок ' +
  'рабочаядата расширенияконфигурации регистрыбухгалтерии регистрынакопления регистрырасчета регистрысведений ' +
  'регламентныезадания сериализаторxdto справочники средствагеопозиционирования средствакриптографии средствамультимедиа ' +
  'средстваотображениярекламы средствапочты средствателефонии фабрикаxdto файловыепотоки фоновыезадания хранилищанастроек ' +
  'хранилищевариантовотчетов хранилищенастроекданныхформ хранилищеобщихнастроек хранилищепользовательскихнастроекдинамическихсписков ' +
  'хранилищепользовательскихнастроекотчетов хранилищесистемныхнастроек ';

  // built_in : встроенные или библиотечные объекты (константы, классы, функции)
  var BUILTIN =
  v7_system_constants +
  v7_global_context_methods + v8_global_context_methods +
  v8_global_context_property;
  
  // v8 системные наборы значений ==> class
  var v8_system_sets_of_values =
  'webцвета windowsцвета windowsшрифты библиотекакартинок рамкистиля символы цветастиля шрифтыстиля ';

  // v8 системные перечисления - интерфейсные ==> class
  var v8_system_enums_interface =
  'автоматическоесохранениеданныхформывнастройках автонумерациявформе автораздвижениесерий ' +
  'анимациядиаграммы вариантвыравниванияэлементовизаголовков вариантуправлениявысотойтаблицы ' +
  'вертикальнаяпрокруткаформы вертикальноеположение вертикальноеположениеэлемента видгруппыформы ' +
  'виддекорацииформы виддополненияэлементаформы видизмененияданных видкнопкиформы видпереключателя ' +
  'видподписейкдиаграмме видполяформы видфлажка влияниеразмеранапузырекдиаграммы горизонтальноеположение ' +
  'горизонтальноеположениеэлемента группировкаколонок группировкаподчиненныхэлементовформы ' +
  'группыиэлементы действиеперетаскивания дополнительныйрежимотображения допустимыедействияперетаскивания ' +
  'интервалмеждуэлементамиформы использованиевывода использованиеполосыпрокрутки ' +
  'используемоезначениеточкибиржевойдиаграммы историявыборапривводе источникзначенийоситочекдиаграммы ' +
  'источникзначенияразмерапузырькадиаграммы категориягруппыкоманд максимумсерий начальноеотображениедерева ' +
  'начальноеотображениесписка обновлениетекстаредактирования ориентациядендрограммы ориентациядиаграммы ' +
  'ориентацияметокдиаграммы ориентацияметоксводнойдиаграммы ориентацияэлементаформы отображениевдиаграмме ' +
  'отображениевлегендедиаграммы отображениегруппыкнопок отображениезаголовкашкалыдиаграммы ' +
  'отображениезначенийсводнойдиаграммы отображениезначенияизмерительнойдиаграммы ' +
  'отображениеинтерваладиаграммыганта отображениекнопки отображениекнопкивыбора отображениеобсужденийформы ' +
  'отображениеобычнойгруппы отображениеотрицательныхзначенийпузырьковойдиаграммы отображениепанелипоиска ' +
  'отображениеподсказки отображениепредупрежденияприредактировании отображениеразметкиполосырегулирования ' +
  'отображениестраницформы отображениетаблицы отображениетекстазначениядиаграммыганта ' +
  'отображениеуправленияобычнойгруппы отображениефигурыкнопки палитрацветовдиаграммы поведениеобычнойгруппы ' +
  'поддержкамасштабадендрограммы поддержкамасштабадиаграммыганта поддержкамасштабасводнойдиаграммы ' +
  'поисквтаблицепривводе положениезаголовкаэлементаформы положениекартинкикнопкиформы ' +
  'положениекартинкиэлементаграфическойсхемы положениекоманднойпанелиформы положениекоманднойпанелиэлементаформы ' +
  'положениеопорнойточкиотрисовки положениеподписейкдиаграмме положениеподписейшкалызначенийизмерительнойдиаграммы ' +
  'положениесостоянияпросмотра положениестрокипоиска положениетекстасоединительнойлинии положениеуправленияпоиском ' +
  'положениешкалывремени порядокотображенияточекгоризонтальнойгистограммы порядоксерийвлегендедиаграммы ' +
  'размеркартинки расположениезаголовкашкалыдиаграммы растягиваниеповертикалидиаграммыганта ' +
  'режимавтоотображениясостояния режимвводастроктаблицы режимвыборанезаполненного режимвыделениядаты ' +
  'режимвыделениястрокитаблицы режимвыделениятаблицы режимизмененияразмера режимизменениясвязанногозначения ' +
  'режимиспользованиядиалогапечати режимиспользованияпараметракоманды режиммасштабированияпросмотра ' +
  'режимосновногоокнаклиентскогоприложения режимоткрытияокнаформы режимотображениявыделения ' +
  'режимотображениягеографическойсхемы режимотображениязначенийсерии режимотрисовкисеткиграфическойсхемы ' +
  'режимполупрозрачностидиаграммы режимпробеловдиаграммы режимразмещениянастранице режимредактированияколонки ' +
  'режимсглаживаниядиаграммы режимсглаживанияиндикатора режимсписказадач сквозноевыравнивание ' +
  'сохранениеданныхформывнастройках способзаполнениятекстазаголовкашкалыдиаграммы ' +
  'способопределенияограничивающегозначениядиаграммы стандартнаягруппакоманд стандартноеоформление ' +
  'статусоповещенияпользователя стильстрелки типаппроксимациилиниитрендадиаграммы типдиаграммы ' +
  'типединицышкалывремени типимпортасерийслоягеографическойсхемы типлиниигеографическойсхемы типлиниидиаграммы ' +
  'типмаркерагеографическойсхемы типмаркерадиаграммы типобластиоформления ' +
  'типорганизацииисточникаданныхгеографическойсхемы типотображениясериислоягеографическойсхемы ' +
  'типотображенияточечногообъектагеографическойсхемы типотображенияшкалыэлементалегендыгеографическойсхемы ' +
  'типпоискаобъектовгеографическойсхемы типпроекциигеографическойсхемы типразмещенияизмерений ' +
  'типразмещенияреквизитовизмерений типрамкиэлементауправления типсводнойдиаграммы ' +
  'типсвязидиаграммыганта типсоединениязначенийпосериямдиаграммы типсоединенияточекдиаграммы ' +
  'типсоединительнойлинии типстороныэлементаграфическойсхемы типформыотчета типшкалырадарнойдиаграммы ' +
  'факторлиниитрендадиаграммы фигуракнопки фигурыграфическойсхемы фиксациявтаблице форматдняшкалывремени ' +
  'форматкартинки ширинаподчиненныхэлементовформы ';

  // v8 системные перечисления - свойства прикладных объектов ==> class
  var v8_system_enums_objects_properties =
  'виддвижениябухгалтерии виддвижениянакопления видпериодарегистрарасчета видсчета видточкимаршрутабизнеспроцесса ' +
  'использованиеагрегатарегистранакопления использованиегруппиэлементов использованиережимапроведения ' +
  'использованиесреза периодичностьагрегатарегистранакопления режимавтовремя режимзаписидокумента режимпроведениядокумента ';

  // v8 системные перечисления - планы обмена ==> class
  var v8_system_enums_exchange_plans =
  'авторегистрацияизменений допустимыйномерсообщения отправкаэлементаданных получениеэлементаданных ';

  // v8 системные перечисления - табличный документ ==> class
  var v8_system_enums_tabular_document =
  'использованиерасшифровкитабличногодокумента ориентациястраницы положениеитоговколоноксводнойтаблицы ' +
  'положениеитоговстроксводнойтаблицы положениетекстаотносительнокартинки расположениезаголовкагруппировкитабличногодокумента ' +
  'способчтениязначенийтабличногодокумента типдвустороннейпечати типзаполненияобластитабличногодокумента ' +
  'типкурсоровтабличногодокумента типлиниирисункатабличногодокумента типлинииячейкитабличногодокумента ' +
  'типнаправленияпереходатабличногодокумента типотображениявыделениятабличногодокумента типотображениялинийсводнойтаблицы ' +
  'типразмещениятекстатабличногодокумента типрисункатабличногодокумента типсмещениятабличногодокумента ' +
  'типузоратабличногодокумента типфайлатабличногодокумента точностьпечати чередованиерасположениястраниц ';

  // v8 системные перечисления - планировщик ==> class
  var v8_system_enums_sheduler =
  'отображениевремениэлементовпланировщика ';

  // v8 системные перечисления - форматированный документ ==> class
  var v8_system_enums_formatted_document =
  'типфайлаформатированногодокумента ';

  // v8 системные перечисления - запрос ==> class
  var v8_system_enums_query =
  'обходрезультатазапроса типзаписизапроса ';

  // v8 системные перечисления - построитель отчета ==> class
  var v8_system_enums_report_builder =
  'видзаполнениярасшифровкипостроителяотчета типдобавленияпредставлений типизмеренияпостроителяотчета типразмещенияитогов ';

  // v8 системные перечисления - работа с файлами ==> class
  var v8_system_enums_files =
  'доступкфайлу режимдиалогавыборафайла режимоткрытияфайла ';

  // v8 системные перечисления - построитель запроса ==> class
  var v8_system_enums_query_builder =
  'типизмеренияпостроителязапроса ';

  // v8 системные перечисления - анализ данных ==> class
  var v8_system_enums_data_analysis =
  'видданныханализа методкластеризации типединицыинтервалавременианализаданных типзаполнениятаблицырезультатаанализаданных ' +
  'типиспользованиячисловыхзначенийанализаданных типисточникаданныхпоискаассоциаций типколонкианализаданныхдереворешений ' +
  'типколонкианализаданныхкластеризация типколонкианализаданныхобщаястатистика типколонкианализаданныхпоискассоциаций ' +
  'типколонкианализаданныхпоискпоследовательностей типколонкимоделипрогноза типмерырасстоянияанализаданных ' +
  'типотсеченияправилассоциации типполяанализаданных типстандартизациианализаданных типупорядочиванияправилассоциациианализаданных ' +
  'типупорядочиванияшаблоновпоследовательностейанализаданных типупрощениядереварешений ';

  // v8 системные перечисления - xml, json, xs, dom, xdto, web-сервисы ==> class
  var v8_system_enums_xml_json_xs_dom_xdto_ws =
  'wsнаправлениепараметра вариантxpathxs вариантзаписидатыjson вариантпростоготипаxs видгруппымоделиxs видфасетаxdto ' +
  'действиепостроителяdom завершенностьпростоготипаxs завершенностьсоставноготипаxs завершенностьсхемыxs запрещенныеподстановкиxs ' +
  'исключениягруппподстановкиxs категорияиспользованияатрибутаxs категорияограниченияидентичностиxs категорияограниченияпространствименxs ' +
  'методнаследованияxs модельсодержимогоxs назначениетипаxml недопустимыеподстановкиxs обработкапробельныхсимволовxs обработкасодержимогоxs ' +
  'ограничениезначенияxs параметрыотбораузловdom переносстрокjson позициявдокументеdom пробельныесимволыxml типатрибутаxml типзначенияjson ' +
  'типканоническогоxml типкомпонентыxs типпроверкиxml типрезультатаdomxpath типузлаdom типузлаxml формаxml формапредставленияxs ' +
  'форматдатыjson экранированиесимволовjson ';

  // v8 системные перечисления - система компоновки данных ==> class
  var v8_system_enums_data_composition_system =
  'видсравнениякомпоновкиданных действиеобработкирасшифровкикомпоновкиданных направлениесортировкикомпоновкиданных ' +
  'расположениевложенныхэлементоврезультатакомпоновкиданных расположениеитоговкомпоновкиданных расположениегруппировкикомпоновкиданных ' +
  'расположениеполейгруппировкикомпоновкиданных расположениеполякомпоновкиданных расположениереквизитовкомпоновкиданных ' +
  'расположениересурсовкомпоновкиданных типбухгалтерскогоостаткакомпоновкиданных типвыводатекстакомпоновкиданных ' +
  'типгруппировкикомпоновкиданных типгруппыэлементовотборакомпоновкиданных типдополненияпериодакомпоновкиданных ' +
  'типзаголовкаполейкомпоновкиданных типмакетагруппировкикомпоновкиданных типмакетаобластикомпоновкиданных типостаткакомпоновкиданных ' +
  'типпериодакомпоновкиданных типразмещениятекстакомпоновкиданных типсвязинаборовданныхкомпоновкиданных типэлементарезультатакомпоновкиданных ' +
  'расположениелегендыдиаграммыкомпоновкиданных типпримененияотборакомпоновкиданных режимотображенияэлементанастройкикомпоновкиданных ' +
  'режимотображениянастроеккомпоновкиданных состояниеэлементанастройкикомпоновкиданных способвосстановлениянастроеккомпоновкиданных ' +
  'режимкомпоновкирезультата использованиепараметракомпоновкиданных автопозицияресурсовкомпоновкиданных '+
  'вариантиспользованиягруппировкикомпоновкиданных расположениересурсоввдиаграммекомпоновкиданных фиксациякомпоновкиданных ' +
  'использованиеусловногооформлениякомпоновкиданных ';

  // v8 системные перечисления - почта ==> class
  var v8_system_enums_email =
  'важностьинтернетпочтовогосообщения обработкатекстаинтернетпочтовогосообщения способкодированияинтернетпочтовоговложения ' +
  'способкодированиянеasciiсимволовинтернетпочтовогосообщения типтекстапочтовогосообщения протоколинтернетпочты ' +
  'статусразборапочтовогосообщения ';

  // v8 системные перечисления - журнал регистрации ==> class
  var v8_system_enums_logbook =
  'режимтранзакциизаписижурналарегистрации статустранзакциизаписижурналарегистрации уровеньжурналарегистрации ';

  // v8 системные перечисления - криптография ==> class
  var v8_system_enums_cryptography =
  'расположениехранилищасертификатовкриптографии режимвключениясертификатовкриптографии режимпроверкисертификатакриптографии ' +
  'типхранилищасертификатовкриптографии ';

  // v8 системные перечисления - ZIP ==> class
  var v8_system_enums_zip =
  'кодировкаименфайловвzipфайле методсжатияzip методшифрованияzip режимвосстановленияпутейфайловzip режимобработкиподкаталоговzip ' +
  'режимсохраненияпутейzip уровеньсжатияzip ';

  // v8 системные перечисления - 
  // Блокировка данных, Фоновые задания, Автоматизированное тестирование,
  // Доставляемые уведомления, Встроенные покупки, Интернет, Работа с двоичными данными ==> class
  var v8_system_enums_other =
  'звуковоеоповещение направлениепереходакстроке позициявпотоке порядокбайтов режимблокировкиданных режимуправленияблокировкойданных ' +
  'сервисвстроенныхпокупок состояниефоновогозадания типподписчикадоставляемыхуведомлений уровеньиспользованиязащищенногосоединенияftp ';

  // v8 системные перечисления - схема запроса ==> class
  var v8_system_enums_request_schema =
  'направлениепорядкасхемызапроса типдополненияпериодамисхемызапроса типконтрольнойточкисхемызапроса типобъединениясхемызапроса ' +
  'типпараметрадоступнойтаблицысхемызапроса типсоединениясхемызапроса ';

  // v8 системные перечисления - свойства объектов метаданных ==> class
  var v8_system_enums_properties_of_metadata_objects =
  'httpметод автоиспользованиеобщегореквизита автопрефиксномеразадачи вариантвстроенногоязыка видиерархии видрегистранакопления ' +
  'видтаблицывнешнегоисточникаданных записьдвиженийприпроведении заполнениепоследовательностей индексирование ' +
  'использованиебазыпланавидоврасчета использованиебыстроговыбора использованиеобщегореквизита использованиеподчинения ' +
  'использованиеполнотекстовогопоиска использованиеразделяемыхданныхобщегореквизита использованиереквизита ' +
  'назначениеиспользованияприложения назначениерасширенияконфигурации направлениепередачи обновлениепредопределенныхданных ' +
  'оперативноепроведение основноепредставлениевидарасчета основноепредставлениевидахарактеристики основноепредставлениезадачи ' +
  'основноепредставлениепланаобмена основноепредставлениесправочника основноепредставлениесчета перемещениеграницыприпроведении ' +
  'периодичностьномерабизнеспроцесса периодичностьномерадокумента периодичностьрегистрарасчета периодичностьрегистрасведений ' +
  'повторноеиспользованиевозвращаемыхзначений полнотекстовыйпоискпривводепостроке принадлежностьобъекта проведение ' +
  'разделениеаутентификацииобщегореквизита разделениеданныхобщегореквизита разделениерасширенийконфигурацииобщегореквизита '+
  'режимавтонумерацииобъектов режимзаписирегистра режимиспользованиямодальности ' +
  'режимиспользованиясинхронныхвызововрасширенийплатформыивнешнихкомпонент режимповторногоиспользованиясеансов ' +
  'режимполученияданныхвыборапривводепостроке режимсовместимости режимсовместимостиинтерфейса ' +
  'режимуправленияблокировкойданныхпоумолчанию сериикодовпланавидовхарактеристик сериикодовпланасчетов ' +
  'сериикодовсправочника созданиепривводе способвыбора способпоискастрокипривводепостроке способредактирования ' +
  'типданныхтаблицывнешнегоисточникаданных типкодапланавидоврасчета типкодасправочника типмакета типномерабизнеспроцесса ' +
  'типномерадокумента типномеразадачи типформы удалениедвижений ';

  // v8 системные перечисления - разные ==> class
  var v8_system_enums_differents =
  'важностьпроблемыприменениярасширенияконфигурации вариантинтерфейсаклиентскогоприложения вариантмасштабаформклиентскогоприложения ' +
  'вариантосновногошрифтаклиентскогоприложения вариантстандартногопериода вариантстандартнойдатыначала видграницы видкартинки ' +
  'видотображенияполнотекстовогопоиска видрамки видсравнения видцвета видчисловогозначения видшрифта допустимаядлина допустимыйзнак ' +
  'использованиеbyteordermark использованиеметаданныхполнотекстовогопоиска источникрасширенийконфигурации клавиша кодвозвратадиалога ' +
  'кодировкаxbase кодировкатекста направлениепоиска направлениесортировки обновлениепредопределенныхданных обновлениеприизмененииданных ' +
  'отображениепанелиразделов проверказаполнения режимдиалогавопрос режимзапускаклиентскогоприложения режимокругления режимоткрытияформприложения ' +
  'режимполнотекстовогопоиска скоростьклиентскогосоединения состояниевнешнегоисточникаданных состояниеобновленияконфигурациибазыданных ' +
  'способвыборасертификатаwindows способкодированиястроки статуссообщения типвнешнейкомпоненты типплатформы типповеденияклавишиenter ' +
  'типэлементаинформацииовыполненииобновленияконфигурациибазыданных уровеньизоляциитранзакций хешфункция частидаты';

  // class: встроенные наборы значений, системные перечисления (содержат дочерние значения, обращения к которым через разыменование)
  var CLASS =
  v8_system_sets_of_values +
  v8_system_enums_interface +
  v8_system_enums_objects_properties +
  v8_system_enums_exchange_plans +
  v8_system_enums_tabular_document +
  v8_system_enums_sheduler +
  v8_system_enums_formatted_document +
  v8_system_enums_query +
  v8_system_enums_report_builder +
  v8_system_enums_files +
  v8_system_enums_query_builder +
  v8_system_enums_data_analysis +
  v8_system_enums_xml_json_xs_dom_xdto_ws +
  v8_system_enums_data_composition_system +
  v8_system_enums_email +
  v8_system_enums_logbook +
  v8_system_enums_cryptography +
  v8_system_enums_zip +
  v8_system_enums_other +
  v8_system_enums_request_schema +
  v8_system_enums_properties_of_metadata_objects +
  v8_system_enums_differents;

  // v8 общие объекты (у объектов есть конструктор, экземпляры создаются методом НОВЫЙ) ==> type
  var v8_shared_object =
  'comобъект ftpсоединение httpзапрос httpсервисответ httpсоединение wsопределения wsпрокси xbase анализданных аннотацияxs ' +
  'блокировкаданных буфердвоичныхданных включениеxs выражениекомпоновкиданных генераторслучайныхчисел географическаясхема ' +
  'географическиекоординаты графическаясхема группамоделиxs данныерасшифровкикомпоновкиданных двоичныеданные дендрограмма ' +
  'диаграмма диаграммаганта диалогвыборафайла диалогвыборацвета диалогвыборашрифта диалограсписаниярегламентногозадания ' +
  'диалогредактированиястандартногопериода диапазон документdom документhtml документацияxs доставляемоеуведомление ' +
  'записьdom записьfastinfoset записьhtml записьjson записьxml записьzipфайла записьданных записьтекста записьузловdom ' +
  'запрос защищенноесоединениеopenssl значенияполейрасшифровкикомпоновкиданных извлечениетекста импортxs интернетпочта ' +
  'интернетпочтовоесообщение интернетпочтовыйпрофиль интернетпрокси интернетсоединение информациядляприложенияxs ' +
  'использованиеатрибутаxs использованиесобытияжурналарегистрации источникдоступныхнастроеккомпоновкиданных ' +
  'итераторузловdom картинка квалификаторыдаты квалификаторыдвоичныхданных квалификаторыстроки квалификаторычисла ' +
  'компоновщикмакетакомпоновкиданных компоновщикнастроеккомпоновкиданных конструктормакетаоформлениякомпоновкиданных ' +
  'конструкторнастроеккомпоновкиданных конструкторформатнойстроки линия макеткомпоновкиданных макетобластикомпоновкиданных ' +
  'макетоформлениякомпоновкиданных маскаxs менеджеркриптографии наборсхемxml настройкикомпоновкиданных настройкисериализацииjson ' +
  'обработкакартинок обработкарасшифровкикомпоновкиданных обходдереваdom объявлениеатрибутаxs объявлениенотацииxs ' +
  'объявлениеэлементаxs описаниеиспользованиясобытиядоступжурналарегистрации ' +
  'описаниеиспользованиясобытияотказвдоступежурналарегистрации описаниеобработкирасшифровкикомпоновкиданных ' +
  'описаниепередаваемогофайла описаниетипов определениегруппыатрибутовxs определениегруппымоделиxs ' +
  'определениеограниченияидентичностиxs определениепростоготипаxs определениесоставноготипаxs определениетипадокументаdom ' +
  'определенияxpathxs отборкомпоновкиданных пакетотображаемыхдокументов параметрвыбора параметркомпоновкиданных ' +
  'параметрызаписиjson параметрызаписиxml параметрычтенияxml переопределениеxs планировщик полеанализаданных ' +
  'полекомпоновкиданных построительdom построительзапроса построительотчета построительотчетаанализаданных ' +
  'построительсхемxml поток потоквпамяти почта почтовоесообщение преобразованиеxsl преобразованиекканоническомуxml ' +
  'процессорвыводарезультатакомпоновкиданныхвколлекциюзначений процессорвыводарезультатакомпоновкиданныхвтабличныйдокумент ' +
  'процессоркомпоновкиданных разыменовательпространствименdom рамка расписаниерегламентногозадания расширенноеимяxml ' +
  'результатчтенияданных своднаядиаграмма связьпараметравыбора связьпотипу связьпотипукомпоновкиданных сериализаторxdto ' +
  'сертификатклиентаwindows сертификатклиентафайл сертификаткриптографии сертификатыудостоверяющихцентровwindows ' +
  'сертификатыудостоверяющихцентровфайл сжатиеданных системнаяинформация сообщениепользователю сочетаниеклавиш ' +
  'сравнениезначений стандартнаядатаначала стандартныйпериод схемаxml схемакомпоновкиданных табличныйдокумент ' +
  'текстовыйдокумент тестируемоеприложение типданныхxml уникальныйидентификатор фабрикаxdto файл файловыйпоток ' +
  'фасетдлиныxs фасетколичестваразрядовдробнойчастиxs фасетмаксимальноговключающегозначенияxs ' +
  'фасетмаксимальногоисключающегозначенияxs фасетмаксимальнойдлиныxs фасетминимальноговключающегозначенияxs ' +
  'фасетминимальногоисключающегозначенияxs фасетминимальнойдлиныxs фасетобразцаxs фасетобщегоколичестваразрядовxs ' +
  'фасетперечисленияxs фасетпробельныхсимволовxs фильтрузловdom форматированнаястрока форматированныйдокумент ' +
  'фрагментxs хешированиеданных хранилищезначения цвет чтениеfastinfoset чтениеhtml чтениеjson чтениеxml чтениеzipфайла ' +
  'чтениеданных чтениетекста чтениеузловdom шрифт элементрезультатакомпоновкиданных ';

  // v8 универсальные коллекции значений ==> type
  var v8_universal_collection =
  'comsafearray деревозначений массив соответствие списокзначений структура таблицазначений фиксированнаяструктура ' +
  'фиксированноесоответствие фиксированныймассив ';

  // type : встроенные типы
  var TYPE =
  v8_shared_object +
  v8_universal_collection;

  // literal : примитивные типы
  var LITERAL = 'null истина ложь неопределено';
  
  // number : числа
  var NUMBERS = hljs.inherit(hljs.NUMBER_MODE);

  // string : строки
  var STRINGS = {
    className: 'string',
    begin: '"|\\|', end: '"|$',
    contains: [{begin: '""'}]
  };

  // number : даты
  var DATE = {
    begin: "'", end: "'", excludeBegin: true, excludeEnd: true,
    contains: [
      {
        className: 'number',
        begin: '\\d{4}([\\.\\\\/:-]?\\d{2}){0,5}'
      }
    ]
  };
  
  // comment : комментарии
  var COMMENTS = hljs.inherit(hljs.C_LINE_COMMENT_MODE);
  
  // meta : инструкции препроцессора, директивы компиляции
  var META = {
    className: 'meta',
    lexemes: UNDERSCORE_IDENT_RE,
    begin: '#|&', end: '$',
    keywords: {'meta-keyword': KEYWORD + METAKEYWORD},
    contains: [
      COMMENTS
    ]
  };
  
  // symbol : метка goto
  var SYMBOL = {
    className: 'symbol',
    begin: '~', end: ';|:', excludeEnd: true
  };  
  
  // function : объявление процедур и функций
  var FUNCTION = {
    className: 'function',
    lexemes: UNDERSCORE_IDENT_RE,
    variants: [
      {begin: 'процедура|функция', end: '\\)', keywords: 'процедура функция'},
      {begin: 'конецпроцедуры|конецфункции', keywords: 'конецпроцедуры конецфункции'}
    ],
    contains: [
      {
        begin: '\\(', end: '\\)', endsParent : true,
        contains: [
          {
            className: 'params',
            lexemes: UNDERSCORE_IDENT_RE,
            begin: UNDERSCORE_IDENT_RE, end: ',', excludeEnd: true, endsWithParent: true,
            keywords: {
              keyword: 'знач',
              literal: LITERAL
            },
            contains: [
              NUMBERS,
              STRINGS,
              DATE
            ]
          },
          COMMENTS
        ]
      },
      hljs.inherit(hljs.TITLE_MODE, {begin: UNDERSCORE_IDENT_RE})
    ]
  };

  return {
    case_insensitive: true,
    lexemes: UNDERSCORE_IDENT_RE,
    keywords: {
      keyword: KEYWORD,
      built_in: BUILTIN,
      class: CLASS,
      type: TYPE,
      literal: LITERAL
    },
    contains: [
      META,
      FUNCTION,
      COMMENTS,
      SYMBOL,
      NUMBERS,
      STRINGS,
      DATE
    ]  
  }
};

var abnf = function(hljs) {
    var regexes = {
        ruleDeclaration: "^[a-zA-Z][a-zA-Z0-9-]*",
        unexpectedChars: "[!@#$^&',?+~`|:]"
    };

    var keywords = [
        "ALPHA",
        "BIT",
        "CHAR",
        "CR",
        "CRLF",
        "CTL",
        "DIGIT",
        "DQUOTE",
        "HEXDIG",
        "HTAB",
        "LF",
        "LWSP",
        "OCTET",
        "SP",
        "VCHAR",
        "WSP"
    ];

    var commentMode = hljs.COMMENT(";", "$");

    var terminalBinaryMode = {
        className: "symbol",
        begin: /%b[0-1]+(-[0-1]+|(\.[0-1]+)+){0,1}/
    };

    var terminalDecimalMode = {
        className: "symbol",
        begin: /%d[0-9]+(-[0-9]+|(\.[0-9]+)+){0,1}/
    };

    var terminalHexadecimalMode = {
        className: "symbol",
        begin: /%x[0-9A-F]+(-[0-9A-F]+|(\.[0-9A-F]+)+){0,1}/,
    };

    var caseSensitivityIndicatorMode = {
        className: "symbol",
        begin: /%[si]/
    };

    var ruleDeclarationMode = {
        begin: regexes.ruleDeclaration + '\\s*=',
        returnBegin: true,
        end: /=/,
        relevance: 0,
        contains: [{className: "attribute", begin: regexes.ruleDeclaration}]
    };

    return {
      illegal: regexes.unexpectedChars,
      keywords: keywords.join(" "),
      contains: [
          ruleDeclarationMode,
          commentMode,
          terminalBinaryMode,
          terminalDecimalMode,
          terminalHexadecimalMode,
          caseSensitivityIndicatorMode,
          hljs.QUOTE_STRING_MODE,
          hljs.NUMBER_MODE
      ]
    };
};

var accesslog = function(hljs) {
  return {
    contains: [
      // IP
      {
        className: 'number',
        begin: '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}(:\\d{1,5})?\\b'
      },
      // Other numbers
      {
        className: 'number',
        begin: '\\b\\d+\\b',
        relevance: 0
      },
      // Requests
      {
        className: 'string',
        begin: '"(GET|POST|HEAD|PUT|DELETE|CONNECT|OPTIONS|PATCH|TRACE)', end: '"',
        keywords: 'GET POST HEAD PUT DELETE CONNECT OPTIONS PATCH TRACE',
        illegal: '\\n',
        relevance: 10
      },
      // Dates
      {
        className: 'string',
        begin: /\[/, end: /\]/,
        illegal: '\\n'
      },
      // Strings
      {
        className: 'string',
        begin: '"', end: '"',
        illegal: '\\n'
      }
    ]
  };
};

var actionscript = function(hljs) {
  var IDENT_RE = '[a-zA-Z_$][a-zA-Z0-9_$]*';
  var IDENT_FUNC_RETURN_TYPE_RE = '([*]|[a-zA-Z_$][a-zA-Z0-9_$]*)';

  var AS3_REST_ARG_MODE = {
    className: 'rest_arg',
    begin: '[.]{3}', end: IDENT_RE,
    relevance: 10
  };

  return {
    aliases: ['as'],
    keywords: {
      keyword: 'as break case catch class const continue default delete do dynamic each ' +
        'else extends final finally for function get if implements import in include ' +
        'instanceof interface internal is namespace native new override package private ' +
        'protected public return set static super switch this throw try typeof use var void ' +
        'while with',
      literal: 'true false null undefined'
    },
    contains: [
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.C_NUMBER_MODE,
      {
        className: 'class',
        beginKeywords: 'package', end: '{',
        contains: [hljs.TITLE_MODE]
      },
      {
        className: 'class',
        beginKeywords: 'class interface', end: '{', excludeEnd: true,
        contains: [
          {
            beginKeywords: 'extends implements'
          },
          hljs.TITLE_MODE
        ]
      },
      {
        className: 'meta',
        beginKeywords: 'import include', end: ';',
        keywords: {'meta-keyword': 'import include'}
      },
      {
        className: 'function',
        beginKeywords: 'function', end: '[{;]', excludeEnd: true,
        illegal: '\\S',
        contains: [
          hljs.TITLE_MODE,
          {
            className: 'params',
            begin: '\\(', end: '\\)',
            contains: [
              hljs.APOS_STRING_MODE,
              hljs.QUOTE_STRING_MODE,
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE,
              AS3_REST_ARG_MODE
            ]
          },
          {
            begin: ':\\s*' + IDENT_FUNC_RETURN_TYPE_RE
          }
        ]
      },
      hljs.METHOD_GUARD
    ],
    illegal: /#/
  };
};

var ada = // We try to support full Ada2012
//
// We highlight all appearances of types, keywords, literals (string, char, number, bool)
// and titles (user defined function/procedure/package)
// CSS classes are set accordingly
//
// Languages causing problems for language detection:
// xml (broken by Foo : Bar type), elm (broken by Foo : Bar type), vbscript-html (broken by body keyword)
// sql (ada default.txt has a lot of sql keywords)

function(hljs) {
    // Regular expression for Ada numeric literals.
    // stolen form the VHDL highlighter

    // Decimal literal:
    var INTEGER_RE = '\\d(_|\\d)*';
    var EXPONENT_RE = '[eE][-+]?' + INTEGER_RE;
    var DECIMAL_LITERAL_RE = INTEGER_RE + '(\\.' + INTEGER_RE + ')?' + '(' + EXPONENT_RE + ')?';

    // Based literal:
    var BASED_INTEGER_RE = '\\w+';
    var BASED_LITERAL_RE = INTEGER_RE + '#' + BASED_INTEGER_RE + '(\\.' + BASED_INTEGER_RE + ')?' + '#' + '(' + EXPONENT_RE + ')?';

    var NUMBER_RE = '\\b(' + BASED_LITERAL_RE + '|' + DECIMAL_LITERAL_RE + ')';

    // Identifier regex
    var ID_REGEX = '[A-Za-z](_?[A-Za-z0-9.])*';

    // bad chars, only allowed in literals
    var BAD_CHARS = '[]{}%#\'\"';

    // Ada doesn't have block comments, only line comments
    var COMMENTS = hljs.COMMENT('--', '$');

    // variable declarations of the form
    // Foo : Bar := Baz;
    // where only Bar will be highlighted
    var VAR_DECLS = {
        // TODO: These spaces are not required by the Ada syntax
        // however, I have yet to see handwritten Ada code where
        // someone does not put spaces around :
        begin: '\\s+:\\s+', end: '\\s*(:=|;|\\)|=>|$)',
        // endsWithParent: true,
        // returnBegin: true,
        illegal: BAD_CHARS,
        contains: [
            {
                // workaround to avoid highlighting
                // named loops and declare blocks
                beginKeywords: 'loop for declare others',
                endsParent: true,
            },
            {
                // properly highlight all modifiers
                className: 'keyword',
                beginKeywords: 'not null constant access function procedure in out aliased exception'
            },
            {
                className: 'type',
                begin: ID_REGEX,
                endsParent: true,
                relevance: 0,
            }
        ]
    };

    return {
        case_insensitive: true,
        keywords: {
            keyword:
                'abort else new return abs elsif not reverse abstract end ' +
                'accept entry select access exception of separate aliased exit or some ' +
                'all others subtype and for out synchronized array function overriding ' +
                'at tagged generic package task begin goto pragma terminate ' +
                'body private then if procedure type case in protected constant interface ' +
                'is raise use declare range delay limited record when delta loop rem while ' +
                'digits renames with do mod requeue xor',
            literal:
                'True False',
        },
        contains: [
            COMMENTS,
            // strings "foobar"
            {
                className: 'string',
                begin: /"/, end: /"/,
                contains: [{begin: /""/, relevance: 0}]
            },
            // characters ''
            {
                // character literals always contain one char
                className: 'string',
                begin: /'.'/
            },
            {
                // number literals
                className: 'number',
                begin: NUMBER_RE,
                relevance: 0
            },
            {
                // Attributes
                className: 'symbol',
                begin: "'" + ID_REGEX,
            },
            {
                // package definition, maybe inside generic
                className: 'title',
                begin: '(\\bwith\\s+)?(\\bprivate\\s+)?\\bpackage\\s+(\\bbody\\s+)?', end: '(is|$)',
                keywords: 'package body',
                excludeBegin: true,
                excludeEnd: true,
                illegal: BAD_CHARS
            },
            {
                // function/procedure declaration/definition
                // maybe inside generic
                begin: '(\\b(with|overriding)\\s+)?\\b(function|procedure)\\s+', end: '(\\bis|\\bwith|\\brenames|\\)\\s*;)',
                keywords: 'overriding function procedure with is renames return',
                // we need to re-match the 'function' keyword, so that
                // the title mode below matches only exactly once
                returnBegin: true,
                contains:
                [
                    COMMENTS,
                    {
                        // name of the function/procedure
                        className: 'title',
                        begin: '(\\bwith\\s+)?\\b(function|procedure)\\s+',
                        end: '(\\(|\\s+|$)',
                        excludeBegin: true,
                        excludeEnd: true,
                        illegal: BAD_CHARS
                    },
                    // 'self'
                    // // parameter types
                    VAR_DECLS,
                    {
                        // return type
                        className: 'type',
                        begin: '\\breturn\\s+', end: '(\\s+|;|$)',
                        keywords: 'return',
                        excludeBegin: true,
                        excludeEnd: true,
                        // we are done with functions
                        endsParent: true,
                        illegal: BAD_CHARS

                    },
                ]
            },
            {
                // new type declarations
                // maybe inside generic
                className: 'type',
                begin: '\\b(sub)?type\\s+', end: '\\s+',
                keywords: 'type',
                excludeBegin: true,
                illegal: BAD_CHARS
            },

            // see comment above the definition
            VAR_DECLS,

            // no markup
            // relevance boosters for small snippets
            // {begin: '\\s*=>\\s*'},
            // {begin: '\\s*:=\\s*'},
            // {begin: '\\s+:=\\s+'},
        ]
    };
};

var angelscript = function(hljs) {
  var builtInTypeMode = {
    className: 'built_in',
    begin: '\\b(void|bool|int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|string|ref|array|double|float|auto|dictionary)'
  };

  var objectHandleMode = {
    className: 'symbol',
    begin: '[a-zA-Z0-9_]+@'
  };

  var genericMode = {
    className: 'keyword',
    begin: '<', end: '>',
    contains: [ builtInTypeMode, objectHandleMode ]
  };

  builtInTypeMode.contains = [ genericMode ];
  objectHandleMode.contains = [ genericMode ];

  return {
    aliases: [ 'asc' ],

    keywords:
      'for in|0 break continue while do|0 return if else case switch namespace is cast ' +
      'or and xor not get|0 in inout|10 out override set|0 private public const default|0 ' +
      'final shared external mixin|10 enum typedef funcdef this super import from interface ' +
      'abstract|0 try catch protected explicit',

    // avoid close detection with C# and JS
    illegal: '(^using\\s+[A-Za-z0-9_\\.]+;$|\\bfunction\s*[^\\(])',

    contains: [
      { // 'strings'
        className: 'string',
        begin: '\'', end: '\'',
        illegal: '\\n',
        contains: [ hljs.BACKSLASH_ESCAPE ],
        relevance: 0
      },

      { // "strings"
        className: 'string',
        begin: '"', end: '"',
        illegal: '\\n',
        contains: [ hljs.BACKSLASH_ESCAPE ],
        relevance: 0
      },

      // """heredoc strings"""
      {
        className: 'string',
        begin: '"""', end: '"""'
      },

      hljs.C_LINE_COMMENT_MODE, // single-line comments
      hljs.C_BLOCK_COMMENT_MODE, // comment blocks

      { // interface or namespace declaration
        beginKeywords: 'interface namespace', end: '{',
        illegal: '[;.\\-]',
        contains: [
          { // interface or namespace name
            className: 'symbol',
            begin: '[a-zA-Z0-9_]+'
          }
        ]
      },

      { // class declaration
        beginKeywords: 'class', end: '{',
        illegal: '[;.\\-]',
        contains: [
          { // class name
            className: 'symbol',
            begin: '[a-zA-Z0-9_]+',
            contains: [
              {
                begin: '[:,]\\s*',
                contains: [
                  {
                    className: 'symbol',
                    begin: '[a-zA-Z0-9_]+'
                  }
                ]
              }
            ]
          }
        ]
      },

      builtInTypeMode, // built-in types
      objectHandleMode, // object handles

      { // literals
        className: 'literal',
        begin: '\\b(null|true|false)'
      },

      { // numbers
        className: 'number',
        begin: '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?f?|\\.\\d+f?)([eE][-+]?\\d+f?)?)'
      }
    ]
  };
};

var apache = function(hljs) {
  var NUMBER = {className: 'number', begin: '[\\$%]\\d+'};
  return {
    aliases: ['apacheconf'],
    case_insensitive: true,
    contains: [
      hljs.HASH_COMMENT_MODE,
      {className: 'section', begin: '</?', end: '>'},
      {
        className: 'attribute',
        begin: /\w+/,
        relevance: 0,
        // keywords aren’t needed for highlighting per se, they only boost relevance
        // for a very generally defined mode (starts with a word, ends with line-end
        keywords: {
          nomarkup:
            'order deny allow setenv rewriterule rewriteengine rewritecond documentroot ' +
            'sethandler errordocument loadmodule options header listen serverroot ' +
            'servername'
        },
        starts: {
          end: /$/,
          relevance: 0,
          keywords: {
            literal: 'on off all'
          },
          contains: [
            {
              className: 'meta',
              begin: '\\s\\[', end: '\\]$'
            },
            {
              className: 'variable',
              begin: '[\\$%]\\{', end: '\\}',
              contains: ['self', NUMBER]
            },
            NUMBER,
            hljs.QUOTE_STRING_MODE
          ]
        }
      }
    ],
    illegal: /\S/
  };
};

var applescript = function(hljs) {
  var STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: ''});
  var PARAMS = {
    className: 'params',
    begin: '\\(', end: '\\)',
    contains: ['self', hljs.C_NUMBER_MODE, STRING]
  };
  var COMMENT_MODE_1 = hljs.COMMENT('--', '$');
  var COMMENT_MODE_2 = hljs.COMMENT(
    '\\(\\*',
    '\\*\\)',
    {
      contains: ['self', COMMENT_MODE_1] //allow nesting
    }
  );
  var COMMENTS = [
    COMMENT_MODE_1,
    COMMENT_MODE_2,
    hljs.HASH_COMMENT_MODE
  ];

  return {
    aliases: ['osascript'],
    keywords: {
      keyword:
        'about above after against and around as at back before beginning ' +
        'behind below beneath beside between but by considering ' +
        'contain contains continue copy div does eighth else end equal ' +
        'equals error every exit fifth first for fourth from front ' +
        'get given global if ignoring in into is it its last local me ' +
        'middle mod my ninth not of on onto or over prop property put ref ' +
        'reference repeat returning script second set seventh since ' +
        'sixth some tell tenth that the|0 then third through thru ' +
        'timeout times to transaction try until where while whose with ' +
        'without',
      literal:
        'AppleScript false linefeed return pi quote result space tab true',
      built_in:
        'alias application boolean class constant date file integer list ' +
        'number real record string text ' +
        'activate beep count delay launch log offset read round ' +
        'run say summarize write ' +
        'character characters contents day frontmost id item length ' +
        'month name paragraph paragraphs rest reverse running time version ' +
        'weekday word words year'
    },
    contains: [
      STRING,
      hljs.C_NUMBER_MODE,
      {
        className: 'built_in',
        begin:
          '\\b(clipboard info|the clipboard|info for|list (disks|folder)|' +
          'mount volume|path to|(close|open for) access|(get|set) eof|' +
          'current date|do shell script|get volume settings|random number|' +
          'set volume|system attribute|system info|time to GMT|' +
          '(load|run|store) script|scripting components|' +
          'ASCII (character|number)|localized string|' +
          'choose (application|color|file|file name|' +
          'folder|from list|remote application|URL)|' +
          'display (alert|dialog))\\b|^\\s*return\\b'
      },
      {
        className: 'literal',
        begin:
          '\\b(text item delimiters|current application|missing value)\\b'
      },
      {
        className: 'keyword',
        begin:
          '\\b(apart from|aside from|instead of|out of|greater than|' +
          "isn't|(doesn't|does not) (equal|come before|come after|contain)|" +
          '(greater|less) than( or equal)?|(starts?|ends|begins?) with|' +
          'contained by|comes (before|after)|a (ref|reference)|POSIX file|' +
          'POSIX path|(date|time) string|quoted form)\\b'
      },
      {
        beginKeywords: 'on',
        illegal: '[${=;\\n]',
        contains: [hljs.UNDERSCORE_TITLE_MODE, PARAMS]
      }
    ].concat(COMMENTS),
    illegal: '//|->|=>|\\[\\['
  };
};

var arcade = function(hljs) {
  var IDENT_RE = '[A-Za-z_][0-9A-Za-z_]*';
  var KEYWORDS = {
    keyword:
      'if for while var new function do return void else break',
    literal:
      'true false null undefined NaN Infinity PI BackSlash DoubleQuote ForwardSlash NewLine SingleQuote Tab',
    built_in:
      'Abs Acos Area AreaGeodetic Asin Atan Atan2 Average Boolean Buffer BufferGeodetic ' +
      'Ceil Centroid Clip Console Constrain Contains Cos Count Crosses Cut Date DateAdd ' +
      'DateDiff Day Decode DefaultValue Dictionary Difference Disjoint Distance Distinct ' +
      'DomainCode DomainName Equals Exp Extent Feature FeatureSet FeatureSetById FeatureSetByTitle ' +
      'FeatureSetByUrl Filter First Floor Geometry Guid HasKey Hour IIf IndexOf Intersection ' +
      'Intersects IsEmpty Length LengthGeodetic Log Max Mean Millisecond Min Minute Month ' +
      'MultiPartToSinglePart Multipoint NextSequenceValue Now Number OrderBy Overlaps Point Polygon ' +
      'Polyline Pow Random Relate Reverse Round Second SetGeometry Sin Sort Sqrt Stdev Sum ' +
      'SymmetricDifference Tan Text Timestamp Today ToLocal Top Touches ToUTC TypeOf Union Variance ' +
      'Weekday When Within Year '
  };
  var SYMBOL = {
    className: 'symbol',
    begin: '\\$[feature|layer|map|value|view]+'
  };
  var NUMBER = {
    className: 'number',
    variants: [
      { begin: '\\b(0[bB][01]+)' },
      { begin: '\\b(0[oO][0-7]+)' },
      { begin: hljs.C_NUMBER_RE }
    ],
    relevance: 0
  };
  var SUBST = {
    className: 'subst',
    begin: '\\$\\{', end: '\\}',
    keywords: KEYWORDS,
    contains: []  // defined later
  };
  var TEMPLATE_STRING = {
    className: 'string',
    begin: '`', end: '`',
    contains: [
      hljs.BACKSLASH_ESCAPE,
      SUBST
    ]
  };
  SUBST.contains = [
    hljs.APOS_STRING_MODE,
    hljs.QUOTE_STRING_MODE,
    TEMPLATE_STRING,
    NUMBER,
    hljs.REGEXP_MODE
  ];
  var PARAMS_CONTAINS = SUBST.contains.concat([
    hljs.C_BLOCK_COMMENT_MODE,
    hljs.C_LINE_COMMENT_MODE
  ]);

  return {
    aliases: ['arcade'],
    keywords: KEYWORDS,
    contains: [
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      TEMPLATE_STRING,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      SYMBOL,
      NUMBER,
      { // object attr container
        begin: /[{,]\s*/, relevance: 0,
        contains: [
          {
            begin: IDENT_RE + '\\s*:', returnBegin: true,
            relevance: 0,
            contains: [{className: 'attr', begin: IDENT_RE, relevance: 0}]
          }
        ]
      },
      { // "value" container
        begin: '(' + hljs.RE_STARTERS_RE + '|\\b(return)\\b)\\s*',
        keywords: 'return',
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.REGEXP_MODE,
          {
            className: 'function',
            begin: '(\\(.*?\\)|' + IDENT_RE + ')\\s*=>', returnBegin: true,
            end: '\\s*=>',
            contains: [
              {
                className: 'params',
                variants: [
                  {
                    begin: IDENT_RE
                  },
                  {
                    begin: /\(\s*\)/,
                  },
                  {
                    begin: /\(/, end: /\)/,
                    excludeBegin: true, excludeEnd: true,
                    keywords: KEYWORDS,
                    contains: PARAMS_CONTAINS
                  }
                ]
              }
            ]
          }
        ],
        relevance: 0
      },
      {
        className: 'function',
        beginKeywords: 'function', end: /\{/, excludeEnd: true,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {begin: IDENT_RE}),
          {
            className: 'params',
            begin: /\(/, end: /\)/,
            excludeBegin: true,
            excludeEnd: true,
            contains: PARAMS_CONTAINS
          }
        ],
        illegal: /\[|%/
      },
      {
        begin: /\$[(.]/
      }
    ],
    illegal: /#(?!!)/
  };
};

var cpp = function(hljs) {
  var CPP_PRIMITIVE_TYPES = {
    className: 'keyword',
    begin: '\\b[a-z\\d_]*_t\\b'
  };

  var STRINGS = {
    className: 'string',
    variants: [
      {
        begin: '(u8?|U|L)?"', end: '"',
        illegal: '\\n',
        contains: [hljs.BACKSLASH_ESCAPE]
      },
      { begin: /(?:u8?|U|L)?R"([^()\\ ]{0,16})\((?:.|\n)*?\)\1"/ },
      {
        begin: '\'\\\\?.', end: '\'',
        illegal: '.'
      }
    ]
  };

  var NUMBERS = {
    className: 'number',
    variants: [
      { begin: '\\b(0b[01\']+)' },
      { begin: '(-?)\\b([\\d\']+(\\.[\\d\']*)?|\\.[\\d\']+)(u|U|l|L|ul|UL|f|F|b|B)' },
      { begin: '(-?)(\\b0[xX][a-fA-F0-9\']+|(\\b[\\d\']+(\\.[\\d\']*)?|\\.[\\d\']+)([eE][-+]?[\\d\']+)?)' }
    ],
    relevance: 0
  };

  var PREPROCESSOR =       {
    className: 'meta',
    begin: /#\s*[a-z]+\b/, end: /$/,
    keywords: {
      'meta-keyword':
        'if else elif endif define undef warning error line ' +
        'pragma ifdef ifndef include'
    },
    contains: [
      {
        begin: /\\\n/, relevance: 0
      },
      hljs.inherit(STRINGS, {className: 'meta-string'}),
      {
        className: 'meta-string',
        begin: /<[^\n>]*>/, end: /$/,
        illegal: '\\n',
      },
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE
    ]
  };

  var FUNCTION_TITLE = hljs.IDENT_RE + '\\s*\\(';

  var CPP_KEYWORDS = {
    keyword: 'int float while private char catch import module export virtual operator sizeof ' +
      'dynamic_cast|10 typedef const_cast|10 const for static_cast|10 union namespace ' +
      'unsigned long volatile static protected bool template mutable if public friend ' +
      'do goto auto void enum else break extern using asm case typeid ' +
      'short reinterpret_cast|10 default double register explicit signed typename try this ' +
      'switch continue inline delete alignof constexpr decltype ' +
      'noexcept static_assert thread_local restrict _Bool complex _Complex _Imaginary ' +
      'atomic_bool atomic_char atomic_schar ' +
      'atomic_uchar atomic_short atomic_ushort atomic_int atomic_uint atomic_long atomic_ulong atomic_llong ' +
      'atomic_ullong new throw return ' +
      'and or not',
    built_in: 'std string cin cout cerr clog stdin stdout stderr stringstream istringstream ostringstream ' +
      'auto_ptr deque list queue stack vector map set bitset multiset multimap unordered_set ' +
      'unordered_map unordered_multiset unordered_multimap array shared_ptr abort abs acos ' +
      'asin atan2 atan calloc ceil cosh cos exit exp fabs floor fmod fprintf fputs free frexp ' +
      'fscanf isalnum isalpha iscntrl isdigit isgraph islower isprint ispunct isspace isupper ' +
      'isxdigit tolower toupper labs ldexp log10 log malloc realloc memchr memcmp memcpy memset modf pow ' +
      'printf putchar puts scanf sinh sin snprintf sprintf sqrt sscanf strcat strchr strcmp ' +
      'strcpy strcspn strlen strncat strncmp strncpy strpbrk strrchr strspn strstr tanh tan ' +
      'vfprintf vprintf vsprintf endl initializer_list unique_ptr',
    literal: 'true false nullptr NULL'
  };

  var EXPRESSION_CONTAINS = [
    CPP_PRIMITIVE_TYPES,
    hljs.C_LINE_COMMENT_MODE,
    hljs.C_BLOCK_COMMENT_MODE,
    NUMBERS,
    STRINGS
  ];

  return {
    aliases: ['c', 'cc', 'h', 'c++', 'h++', 'hpp'],
    keywords: CPP_KEYWORDS,
    illegal: '</',
    contains: EXPRESSION_CONTAINS.concat([
      PREPROCESSOR,
      {
        begin: '\\b(deque|list|queue|stack|vector|map|set|bitset|multiset|multimap|unordered_map|unordered_set|unordered_multiset|unordered_multimap|array)\\s*<', end: '>',
        keywords: CPP_KEYWORDS,
        contains: ['self', CPP_PRIMITIVE_TYPES]
      },
      {
        begin: hljs.IDENT_RE + '::',
        keywords: CPP_KEYWORDS
      },
      {
        // This mode covers expression context where we can't expect a function
        // definition and shouldn't highlight anything that looks like one:
        // `return some()`, `else if()`, `(x*sum(1, 2))`
        variants: [
          {begin: /=/, end: /;/},
          {begin: /\(/, end: /\)/},
          {beginKeywords: 'new throw return else', end: /;/}
        ],
        keywords: CPP_KEYWORDS,
        contains: EXPRESSION_CONTAINS.concat([
          {
            begin: /\(/, end: /\)/,
            keywords: CPP_KEYWORDS,
            contains: EXPRESSION_CONTAINS.concat(['self']),
            relevance: 0
          }
        ]),
        relevance: 0
      },
      {
        className: 'function',
        begin: '(' + hljs.IDENT_RE + '[\\*&\\s]+)+' + FUNCTION_TITLE,
        returnBegin: true, end: /[{;=]/,
        excludeEnd: true,
        keywords: CPP_KEYWORDS,
        illegal: /[^\w\s\*&]/,
        contains: [
          {
            begin: FUNCTION_TITLE, returnBegin: true,
            contains: [hljs.TITLE_MODE],
            relevance: 0
          },
          {
            className: 'params',
            begin: /\(/, end: /\)/,
            keywords: CPP_KEYWORDS,
            relevance: 0,
            contains: [
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE,
              STRINGS,
              NUMBERS,
              CPP_PRIMITIVE_TYPES,
              // Count matching parentheses.
              {
                begin: /\(/, end: /\)/,
                keywords: CPP_KEYWORDS,
                relevance: 0,
                contains: [
                  'self',
                  hljs.C_LINE_COMMENT_MODE,
                  hljs.C_BLOCK_COMMENT_MODE,
                  STRINGS,
                  NUMBERS,
                  CPP_PRIMITIVE_TYPES
                ]
              }
            ]
          },
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          PREPROCESSOR
        ]
      },
      {
        className: 'class',
        beginKeywords: 'class struct', end: /[{;:]/,
        contains: [
          {begin: /</, end: />/, contains: ['self']}, // skip generic stuff
          hljs.TITLE_MODE
        ]
      }
    ]),
    exports: {
      preprocessor: PREPROCESSOR,
      strings: STRINGS,
      keywords: CPP_KEYWORDS
    }
  };
};

var arduino = function(hljs) {
  var CPP = hljs.getLanguage('cpp').exports;
	return {
    keywords: {
      keyword:
        'boolean byte word string String array ' + CPP.keywords.keyword,
      built_in:
        'setup loop while catch for if do goto try switch case else ' +
        'default break continue return ' +
        'KeyboardController MouseController SoftwareSerial ' +
        'EthernetServer EthernetClient LiquidCrystal ' +
        'RobotControl GSMVoiceCall EthernetUDP EsploraTFT ' +
        'HttpClient RobotMotor WiFiClient GSMScanner ' +
        'FileSystem Scheduler GSMServer YunClient YunServer ' +
        'IPAddress GSMClient GSMModem Keyboard Ethernet ' +
        'Console GSMBand Esplora Stepper Process ' +
        'WiFiUDP GSM_SMS Mailbox USBHost Firmata PImage ' +
        'Client Server GSMPIN FileIO Bridge Serial ' +
        'EEPROM Stream Mouse Audio Servo File Task ' +
        'GPRS WiFi Wire TFT GSM SPI SD ' +
        'runShellCommandAsynchronously analogWriteResolution ' +
        'retrieveCallingNumber printFirmwareVersion ' +
        'analogReadResolution sendDigitalPortPair ' +
        'noListenOnLocalhost readJoystickButton setFirmwareVersion ' +
        'readJoystickSwitch scrollDisplayRight getVoiceCallStatus ' +
        'scrollDisplayLeft writeMicroseconds delayMicroseconds ' +
        'beginTransmission getSignalStrength runAsynchronously ' +
        'getAsynchronously listenOnLocalhost getCurrentCarrier ' +
        'readAccelerometer messageAvailable sendDigitalPorts ' +
        'lineFollowConfig countryNameWrite runShellCommand ' +
        'readStringUntil rewindDirectory readTemperature ' +
        'setClockDivider readLightSensor endTransmission ' +
        'analogReference detachInterrupt countryNameRead ' +
        'attachInterrupt encryptionType readBytesUntil ' +
        'robotNameWrite readMicrophone robotNameRead cityNameWrite ' +
        'userNameWrite readJoystickY readJoystickX mouseReleased ' +
        'openNextFile scanNetworks noInterrupts digitalWrite ' +
        'beginSpeaker mousePressed isActionDone mouseDragged ' +
        'displayLogos noAutoscroll addParameter remoteNumber ' +
        'getModifiers keyboardRead userNameRead waitContinue ' +
        'processInput parseCommand printVersion readNetworks ' +
        'writeMessage blinkVersion cityNameRead readMessage ' +
        'setDataMode parsePacket isListening setBitOrder ' +
        'beginPacket isDirectory motorsWrite drawCompass ' +
        'digitalRead clearScreen serialEvent rightToLeft ' +
        'setTextSize leftToRight requestFrom keyReleased ' +
        'compassRead analogWrite interrupts WiFiServer ' +
        'disconnect playMelody parseFloat autoscroll ' +
        'getPINUsed setPINUsed setTimeout sendAnalog ' +
        'readSlider analogRead beginWrite createChar ' +
        'motorsStop keyPressed tempoWrite readButton ' +
        'subnetMask debugPrint macAddress writeGreen ' +
        'randomSeed attachGPRS readString sendString ' +
        'remotePort releaseAll mouseMoved background ' +
        'getXChange getYChange answerCall getResult ' +
        'voiceCall endPacket constrain getSocket writeJSON ' +
        'getButton available connected findUntil readBytes ' +
        'exitValue readGreen writeBlue startLoop IPAddress ' +
        'isPressed sendSysex pauseMode gatewayIP setCursor ' +
        'getOemKey tuneWrite noDisplay loadImage switchPIN ' +
        'onRequest onReceive changePIN playFile noBuffer ' +
        'parseInt overflow checkPIN knobRead beginTFT ' +
        'bitClear updateIR bitWrite position writeRGB ' +
        'highByte writeRed setSpeed readBlue noStroke ' +
        'remoteIP transfer shutdown hangCall beginSMS ' +
        'endWrite attached maintain noCursor checkReg ' +
        'checkPUK shiftOut isValid shiftIn pulseIn ' +
        'connect println localIP pinMode getIMEI ' +
        'display noBlink process getBand running beginSD ' +
        'drawBMP lowByte setBand release bitRead prepare ' +
        'pointTo readRed setMode noFill remove listen ' +
        'stroke detach attach noTone exists buffer ' +
        'height bitSet circle config cursor random ' +
        'IRread setDNS endSMS getKey micros ' +
        'millis begin print write ready flush width ' +
        'isPIN blink clear press mkdir rmdir close ' +
        'point yield image BSSID click delay ' +
        'read text move peek beep rect line open ' +
        'seek fill size turn stop home find ' +
        'step tone sqrt RSSI SSID ' +
        'end bit tan cos sin pow map abs max ' +
        'min get run put',
      literal:
        'DIGITAL_MESSAGE FIRMATA_STRING ANALOG_MESSAGE ' +
        'REPORT_DIGITAL REPORT_ANALOG INPUT_PULLUP ' +
        'SET_PIN_MODE INTERNAL2V56 SYSTEM_RESET LED_BUILTIN ' +
        'INTERNAL1V1 SYSEX_START INTERNAL EXTERNAL ' +
        'DEFAULT OUTPUT INPUT HIGH LOW'
    },
    contains: [
      CPP.preprocessor,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.C_NUMBER_MODE
    ]
  };
};

var armasm = function(hljs) {
    //local labels: %?[FB]?[AT]?\d{1,2}\w+
  return {
    case_insensitive: true,
    aliases: ['arm'],
    lexemes: '\\.?' + hljs.IDENT_RE,
    keywords: {
      meta:
        //GNU preprocs
        '.2byte .4byte .align .ascii .asciz .balign .byte .code .data .else .end .endif .endm .endr .equ .err .exitm .extern .global .hword .if .ifdef .ifndef .include .irp .long .macro .rept .req .section .set .skip .space .text .word .arm .thumb .code16 .code32 .force_thumb .thumb_func .ltorg '+
        //ARM directives
        'ALIAS ALIGN ARM AREA ASSERT ATTR CN CODE CODE16 CODE32 COMMON CP DATA DCB DCD DCDU DCDO DCFD DCFDU DCI DCQ DCQU DCW DCWU DN ELIF ELSE END ENDFUNC ENDIF ENDP ENTRY EQU EXPORT EXPORTAS EXTERN FIELD FILL FUNCTION GBLA GBLL GBLS GET GLOBAL IF IMPORT INCBIN INCLUDE INFO KEEP LCLA LCLL LCLS LTORG MACRO MAP MEND MEXIT NOFP OPT PRESERVE8 PROC QN READONLY RELOC REQUIRE REQUIRE8 RLIST FN ROUT SETA SETL SETS SN SPACE SUBT THUMB THUMBX TTL WHILE WEND ',
      built_in:
        'r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 '+ //standard registers
        'pc lr sp ip sl sb fp '+ //typical regs plus backward compatibility
        'a1 a2 a3 a4 v1 v2 v3 v4 v5 v6 v7 v8 f0 f1 f2 f3 f4 f5 f6 f7 '+ //more regs and fp
        'p0 p1 p2 p3 p4 p5 p6 p7 p8 p9 p10 p11 p12 p13 p14 p15 '+ //coprocessor regs
        'c0 c1 c2 c3 c4 c5 c6 c7 c8 c9 c10 c11 c12 c13 c14 c15 '+ //more coproc
        'q0 q1 q2 q3 q4 q5 q6 q7 q8 q9 q10 q11 q12 q13 q14 q15 '+ //advanced SIMD NEON regs

        //program status registers
        'cpsr_c cpsr_x cpsr_s cpsr_f cpsr_cx cpsr_cxs cpsr_xs cpsr_xsf cpsr_sf cpsr_cxsf '+
        'spsr_c spsr_x spsr_s spsr_f spsr_cx spsr_cxs spsr_xs spsr_xsf spsr_sf spsr_cxsf '+

        //NEON and VFP registers
        's0 s1 s2 s3 s4 s5 s6 s7 s8 s9 s10 s11 s12 s13 s14 s15 '+
        's16 s17 s18 s19 s20 s21 s22 s23 s24 s25 s26 s27 s28 s29 s30 s31 '+
        'd0 d1 d2 d3 d4 d5 d6 d7 d8 d9 d10 d11 d12 d13 d14 d15 '+
        'd16 d17 d18 d19 d20 d21 d22 d23 d24 d25 d26 d27 d28 d29 d30 d31 ' +

        '{PC} {VAR} {TRUE} {FALSE} {OPT} {CONFIG} {ENDIAN} {CODESIZE} {CPU} {FPU} {ARCHITECTURE} {PCSTOREOFFSET} {ARMASM_VERSION} {INTER} {ROPI} {RWPI} {SWST} {NOSWST} . @'
    },
    contains: [
      {
        className: 'keyword',
        begin: '\\b('+     //mnemonics
            'adc|'+
            '(qd?|sh?|u[qh]?)?add(8|16)?|usada?8|(q|sh?|u[qh]?)?(as|sa)x|'+
            'and|adrl?|sbc|rs[bc]|asr|b[lx]?|blx|bxj|cbn?z|tb[bh]|bic|'+
            'bfc|bfi|[su]bfx|bkpt|cdp2?|clz|clrex|cmp|cmn|cpsi[ed]|cps|'+
            'setend|dbg|dmb|dsb|eor|isb|it[te]{0,3}|lsl|lsr|ror|rrx|'+
            'ldm(([id][ab])|f[ds])?|ldr((s|ex)?[bhd])?|movt?|mvn|mra|mar|'+
            'mul|[us]mull|smul[bwt][bt]|smu[as]d|smmul|smmla|'+
            'mla|umlaal|smlal?([wbt][bt]|d)|mls|smlsl?[ds]|smc|svc|sev|'+
            'mia([bt]{2}|ph)?|mrr?c2?|mcrr2?|mrs|msr|orr|orn|pkh(tb|bt)|rbit|'+
            'rev(16|sh)?|sel|[su]sat(16)?|nop|pop|push|rfe([id][ab])?|'+
            'stm([id][ab])?|str(ex)?[bhd]?|(qd?)?sub|(sh?|q|u[qh]?)?sub(8|16)|'+
            '[su]xt(a?h|a?b(16)?)|srs([id][ab])?|swpb?|swi|smi|tst|teq|'+
            'wfe|wfi|yield'+
        ')'+
        '(eq|ne|cs|cc|mi|pl|vs|vc|hi|ls|ge|lt|gt|le|al|hs|lo)?'+ //condition codes
        '[sptrx]?' ,                                             //legal postfixes
        end: '\\s'
      },
      hljs.COMMENT('[;@]', '$', {relevance: 0}),
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        begin: '\'',
        end: '[^\\\\]\'',
        relevance: 0
      },
      {
        className: 'title',
        begin: '\\|', end: '\\|',
        illegal: '\\n',
        relevance: 0
      },
      {
        className: 'number',
        variants: [
            {begin: '[#$=]?0x[0-9a-f]+'}, //hex
            {begin: '[#$=]?0b[01]+'},     //bin
            {begin: '[#$=]\\d+'},        //literal
            {begin: '\\b\\d+'}           //bare number
        ],
        relevance: 0
      },
      {
        className: 'symbol',
        variants: [
            {begin: '^[a-z_\\.\\$][a-z0-9_\\.\\$]+'}, //ARM syntax
            {begin: '^\\s*[a-z_\\.\\$][a-z0-9_\\.\\$]+:'}, //GNU ARM syntax
            {begin: '[=#]\\w+' }  //label reference
        ],
        relevance: 0
      }
    ]
  };
};

var xml = function(hljs) {
  var XML_IDENT_RE = '[A-Za-z0-9\\._:-]+';
  var TAG_INTERNALS = {
    endsWithParent: true,
    illegal: /</,
    relevance: 0,
    contains: [
      {
        className: 'attr',
        begin: XML_IDENT_RE,
        relevance: 0
      },
      {
        begin: /=\s*/,
        relevance: 0,
        contains: [
          {
            className: 'string',
            endsParent: true,
            variants: [
              {begin: /"/, end: /"/},
              {begin: /'/, end: /'/},
              {begin: /[^\s"'=<>`]+/}
            ]
          }
        ]
      }
    ]
  };
  return {
    aliases: ['html', 'xhtml', 'rss', 'atom', 'xjb', 'xsd', 'xsl', 'plist'],
    case_insensitive: true,
    contains: [
      {
        className: 'meta',
        begin: '<!DOCTYPE', end: '>',
        relevance: 10,
        contains: [{begin: '\\[', end: '\\]'}]
      },
      hljs.COMMENT(
        '<!--',
        '-->',
        {
          relevance: 10
        }
      ),
      {
        begin: '<\\!\\[CDATA\\[', end: '\\]\\]>',
        relevance: 10
      },
      {
        className: 'meta',
        begin: /<\?xml/, end: /\?>/, relevance: 10
      },
      {
        begin: /<\?(php)?/, end: /\?>/,
        subLanguage: 'php',
        contains: [
          // We don't want the php closing tag ?> to close the PHP block when
          // inside any of the following blocks:
          {begin: '/\\*', end: '\\*/', skip: true},
          {begin: 'b"', end: '"', skip: true},
          {begin: 'b\'', end: '\'', skip: true},
          hljs.inherit(hljs.APOS_STRING_MODE, {illegal: null, className: null, contains: null, skip: true}),
          hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null, className: null, contains: null, skip: true})
        ]
      },
      {
        className: 'tag',
        /*
        The lookahead pattern (?=...) ensures that 'begin' only matches
        '<style' as a single word, followed by a whitespace or an
        ending braket. The '$' is needed for the lexeme to be recognized
        by hljs.subMode() that tests lexemes outside the stream.
        */
        begin: '<style(?=\\s|>|$)', end: '>',
        keywords: {name: 'style'},
        contains: [TAG_INTERNALS],
        starts: {
          end: '</style>', returnEnd: true,
          subLanguage: ['css', 'xml']
        }
      },
      {
        className: 'tag',
        // See the comment in the <style tag about the lookahead pattern
        begin: '<script(?=\\s|>|$)', end: '>',
        keywords: {name: 'script'},
        contains: [TAG_INTERNALS],
        starts: {
          end: '\<\/script\>', returnEnd: true,
          subLanguage: ['actionscript', 'javascript', 'handlebars', 'xml']
        }
      },
      {
        className: 'tag',
        begin: '</?', end: '/?>',
        contains: [
          {
            className: 'name', begin: /[^\/><\s]+/, relevance: 0
          },
          TAG_INTERNALS
        ]
      }
    ]
  };
};

var asciidoc = function(hljs) {
  return {
    aliases: ['adoc'],
    contains: [
      // block comment
      hljs.COMMENT(
        '^/{4,}\\n',
        '\\n/{4,}$',
        // can also be done as...
        //'^/{4,}$',
        //'^/{4,}$',
        {
          relevance: 10
        }
      ),
      // line comment
      hljs.COMMENT(
        '^//',
        '$',
        {
          relevance: 0
        }
      ),
      // title
      {
        className: 'title',
        begin: '^\\.\\w.*$'
      },
      // example, admonition & sidebar blocks
      {
        begin: '^[=\\*]{4,}\\n',
        end: '\\n^[=\\*]{4,}$',
        relevance: 10
      },
      // headings
      {
        className: 'section',
        relevance: 10,
        variants: [
          {begin: '^(={1,5}) .+?( \\1)?$'},
          {begin: '^[^\\[\\]\\n]+?\\n[=\\-~\\^\\+]{2,}$'},
        ]
      },
      // document attributes
      {
        className: 'meta',
        begin: '^:.+?:',
        end: '\\s',
        excludeEnd: true,
        relevance: 10
      },
      // block attributes
      {
        className: 'meta',
        begin: '^\\[.+?\\]$',
        relevance: 0
      },
      // quoteblocks
      {
        className: 'quote',
        begin: '^_{4,}\\n',
        end: '\\n_{4,}$',
        relevance: 10
      },
      // listing and literal blocks
      {
        className: 'code',
        begin: '^[\\-\\.]{4,}\\n',
        end: '\\n[\\-\\.]{4,}$',
        relevance: 10
      },
      // passthrough blocks
      {
        begin: '^\\+{4,}\\n',
        end: '\\n\\+{4,}$',
        contains: [
          {
            begin: '<', end: '>',
            subLanguage: 'xml',
            relevance: 0
          }
        ],
        relevance: 10
      },
      // lists (can only capture indicators)
      {
        className: 'bullet',
        begin: '^(\\*+|\\-+|\\.+|[^\\n]+?::)\\s+'
      },
      // admonition
      {
        className: 'symbol',
        begin: '^(NOTE|TIP|IMPORTANT|WARNING|CAUTION):\\s+',
        relevance: 10
      },
      // inline strong
      {
        className: 'strong',
        // must not follow a word character or be followed by an asterisk or space
        begin: '\\B\\*(?![\\*\\s])',
        end: '(\\n{2}|\\*)',
        // allow escaped asterisk followed by word char
        contains: [
          {
            begin: '\\\\*\\w',
            relevance: 0
          }
        ]
      },
      // inline emphasis
      {
        className: 'emphasis',
        // must not follow a word character or be followed by a single quote or space
        begin: '\\B\'(?![\'\\s])',
        end: '(\\n{2}|\')',
        // allow escaped single quote followed by word char
        contains: [
          {
            begin: '\\\\\'\\w',
            relevance: 0
          }
        ],
        relevance: 0
      },
      // inline emphasis (alt)
      {
        className: 'emphasis',
        // must not follow a word character or be followed by an underline or space
        begin: '_(?![_\\s])',
        end: '(\\n{2}|_)',
        relevance: 0
      },
      // inline smart quotes
      {
        className: 'string',
        variants: [
          {begin: "``.+?''"},
          {begin: "`.+?'"}
        ]
      },
      // inline code snippets (TODO should get same treatment as strong and emphasis)
      {
        className: 'code',
        begin: '(`.+?`|\\+.+?\\+)',
        relevance: 0
      },
      // indented literal block
      {
        className: 'code',
        begin: '^[ \\t]',
        end: '$',
        relevance: 0
      },
      // horizontal rules
      {
        begin: '^\'{3,}[ \\t]*$',
        relevance: 10
      },
      // images and links
      {
        begin: '(link:)?(http|https|ftp|file|irc|image:?):\\S+\\[.*?\\]',
        returnBegin: true,
        contains: [
          {
            begin: '(link|image:?):',
            relevance: 0
          },
          {
            className: 'link',
            begin: '\\w',
            end: '[^\\[]+',
            relevance: 0
          },
          {
            className: 'string',
            begin: '\\[',
            end: '\\]',
            excludeBegin: true,
            excludeEnd: true,
            relevance: 0
          }
        ],
        relevance: 10
      }
    ]
  };
};

var aspectj = function (hljs) {
  var KEYWORDS =
    'false synchronized int abstract float private char boolean static null if const ' +
    'for true while long throw strictfp finally protected import native final return void ' +
    'enum else extends implements break transient new catch instanceof byte super volatile case ' +
    'assert short package default double public try this switch continue throws privileged ' +
    'aspectOf adviceexecution proceed cflowbelow cflow initialization preinitialization ' +
    'staticinitialization withincode target within execution getWithinTypeName handler ' +
    'thisJoinPoint thisJoinPointStaticPart thisEnclosingJoinPointStaticPart declare parents '+
    'warning error soft precedence thisAspectInstance';
  var SHORTKEYS = 'get set args call';
  return {
    keywords : KEYWORDS,
    illegal : /<\/|#/,
    contains : [
      hljs.COMMENT(
        '/\\*\\*',
        '\\*/',
        {
          relevance : 0,
          contains : [
            {
              // eat up @'s in emails to prevent them to be recognized as doctags
              begin: /\w+@/, relevance: 0
            },
            {
              className : 'doctag',
              begin : '@[A-Za-z]+'
            }
          ]
        }
      ),
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      {
        className : 'class',
        beginKeywords : 'aspect',
        end : /[{;=]/,
        excludeEnd : true,
        illegal : /[:;"\[\]]/,
        contains : [
          {
            beginKeywords : 'extends implements pertypewithin perthis pertarget percflowbelow percflow issingleton'
          },
          hljs.UNDERSCORE_TITLE_MODE,
          {
            begin : /\([^\)]*/,
            end : /[)]+/,
            keywords : KEYWORDS + ' ' + SHORTKEYS,
            excludeEnd : false
          }
        ]
      },
      {
        className : 'class',
        beginKeywords : 'class interface',
        end : /[{;=]/,
        excludeEnd : true,
        relevance: 0,
        keywords : 'class interface',
        illegal : /[:"\[\]]/,
        contains : [
          {beginKeywords : 'extends implements'},
          hljs.UNDERSCORE_TITLE_MODE
        ]
      },
      {
        // AspectJ Constructs
        beginKeywords : 'pointcut after before around throwing returning',
        end : /[)]/,
        excludeEnd : false,
        illegal : /["\[\]]/,
        contains : [
          {
            begin : hljs.UNDERSCORE_IDENT_RE + '\\s*\\(',
            returnBegin : true,
            contains : [hljs.UNDERSCORE_TITLE_MODE]
          }
        ]
      },
      {
        begin : /[:]/,
        returnBegin : true,
        end : /[{;]/,
        relevance: 0,
        excludeEnd : false,
        keywords : KEYWORDS,
        illegal : /["\[\]]/,
        contains : [
          {
            begin : hljs.UNDERSCORE_IDENT_RE + '\\s*\\(',
            keywords : KEYWORDS + ' ' + SHORTKEYS,
            relevance: 0
          },
          hljs.QUOTE_STRING_MODE
        ]
      },
      {
        // this prevents 'new Name(...), or throw ...' from being recognized as a function definition
        beginKeywords : 'new throw',
        relevance : 0
      },
      {
        // the function class is a bit different for AspectJ compared to the Java language
        className : 'function',
        begin : /\w+ +\w+(\.)?\w+\s*\([^\)]*\)\s*((throws)[\w\s,]+)?[\{;]/,
        returnBegin : true,
        end : /[{;=]/,
        keywords : KEYWORDS,
        excludeEnd : true,
        contains : [
          {
            begin : hljs.UNDERSCORE_IDENT_RE + '\\s*\\(',
            returnBegin : true,
            relevance: 0,
            contains : [hljs.UNDERSCORE_TITLE_MODE]
          },
          {
            className : 'params',
            begin : /\(/, end : /\)/,
            relevance: 0,
            keywords : KEYWORDS,
            contains : [
              hljs.APOS_STRING_MODE,
              hljs.QUOTE_STRING_MODE,
              hljs.C_NUMBER_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      },
      hljs.C_NUMBER_MODE,
      {
        // annotation is also used in this language
        className : 'meta',
        begin : '@[A-Za-z]+'
      }
    ]
  };
};

var autohotkey = function(hljs) {
  var BACKTICK_ESCAPE = {
    begin: '`[\\s\\S]'
  };

  return {
    case_insensitive: true,
    aliases: [ 'ahk' ],
    keywords: {
      keyword: 'Break Continue Critical Exit ExitApp Gosub Goto New OnExit Pause return SetBatchLines SetTimer Suspend Thread Throw Until ahk_id ahk_class ahk_pid ahk_exe ahk_group',
      literal: 'A|0 true false NOT AND OR',
      built_in: 'ComSpec Clipboard ClipboardAll ErrorLevel',
    },
    contains: [
      {
        className: 'built_in',
        begin: 'A_[a-zA-Z0-9]+'
      },
      BACKTICK_ESCAPE,
      hljs.inherit(hljs.QUOTE_STRING_MODE, {contains: [BACKTICK_ESCAPE]}),
      hljs.COMMENT(';', '$', {relevance: 0}),
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: 'number',
        begin: hljs.NUMBER_RE,
        relevance: 0
      },
      {
        className: 'subst', // FIXED
        begin: '%(?=[a-zA-Z0-9#_$@])', end: '%',
        illegal: '[^a-zA-Z0-9#_$@]'
      },
      {
        className: 'built_in',
        begin: '^\\s*\\w+\\s*,'
        //I don't really know if this is totally relevant
      },
      {
        className: 'meta', 
        begin: '^\\s*#\w+', end:'$',
        relevance: 0
      },
      {
        className: 'symbol',
        contains: [BACKTICK_ESCAPE],
        variants: [
          {begin: '^[^\\n";]+::(?!=)'},
          {begin: '^[^\\n";]+:(?!=)', relevance: 0} // zero relevance as it catches a lot of things
                                                    // followed by a single ':' in many languages
        ]
      },
      {
        // consecutive commas, not for highlighting but just for relevance
        begin: ',\\s*,'
      }
    ]
  }
};

var autoit = function(hljs) {
    var KEYWORDS = 'ByRef Case Const ContinueCase ContinueLoop ' +
        'Default Dim Do Else ElseIf EndFunc EndIf EndSelect ' +
        'EndSwitch EndWith Enum Exit ExitLoop For Func ' +
        'Global If In Local Next ReDim Return Select Static ' +
        'Step Switch Then To Until Volatile WEnd While With',

        LITERAL = 'True False And Null Not Or',

        BUILT_IN =
          'Abs ACos AdlibRegister AdlibUnRegister Asc AscW ASin Assign ATan AutoItSetOption AutoItWinGetTitle AutoItWinSetTitle Beep Binary BinaryLen BinaryMid BinaryToString BitAND BitNOT BitOR BitRotate BitShift BitXOR BlockInput Break Call CDTray Ceiling Chr ChrW ClipGet ClipPut ConsoleRead ConsoleWrite ConsoleWriteError ControlClick ControlCommand ControlDisable ControlEnable ControlFocus ControlGetFocus ControlGetHandle ControlGetPos ControlGetText ControlHide ControlListView ControlMove ControlSend ControlSetText ControlShow ControlTreeView Cos Dec DirCopy DirCreate DirGetSize DirMove DirRemove DllCall DllCallAddress DllCallbackFree DllCallbackGetPtr DllCallbackRegister DllClose DllOpen DllStructCreate DllStructGetData DllStructGetPtr DllStructGetSize DllStructSetData DriveGetDrive DriveGetFileSystem DriveGetLabel DriveGetSerial DriveGetType DriveMapAdd DriveMapDel DriveMapGet DriveSetLabel DriveSpaceFree DriveSpaceTotal DriveStatus EnvGet EnvSet EnvUpdate Eval Execute Exp FileChangeDir FileClose FileCopy FileCreateNTFSLink FileCreateShortcut FileDelete FileExists FileFindFirstFile FileFindNextFile FileFlush FileGetAttrib FileGetEncoding FileGetLongName FileGetPos FileGetShortcut FileGetShortName FileGetSize FileGetTime FileGetVersion FileInstall FileMove FileOpen FileOpenDialog FileRead FileReadLine FileReadToArray FileRecycle FileRecycleEmpty FileSaveDialog FileSelectFolder FileSetAttrib FileSetEnd FileSetPos FileSetTime FileWrite FileWriteLine Floor FtpSetProxy FuncName GUICreate GUICtrlCreateAvi GUICtrlCreateButton GUICtrlCreateCheckbox GUICtrlCreateCombo GUICtrlCreateContextMenu GUICtrlCreateDate GUICtrlCreateDummy GUICtrlCreateEdit GUICtrlCreateGraphic GUICtrlCreateGroup GUICtrlCreateIcon GUICtrlCreateInput GUICtrlCreateLabel GUICtrlCreateList GUICtrlCreateListView GUICtrlCreateListViewItem GUICtrlCreateMenu GUICtrlCreateMenuItem GUICtrlCreateMonthCal GUICtrlCreateObj GUICtrlCreatePic GUICtrlCreateProgress GUICtrlCreateRadio GUICtrlCreateSlider GUICtrlCreateTab GUICtrlCreateTabItem GUICtrlCreateTreeView GUICtrlCreateTreeViewItem GUICtrlCreateUpdown GUICtrlDelete GUICtrlGetHandle GUICtrlGetState GUICtrlRead GUICtrlRecvMsg GUICtrlRegisterListViewSort GUICtrlSendMsg GUICtrlSendToDummy GUICtrlSetBkColor GUICtrlSetColor GUICtrlSetCursor GUICtrlSetData GUICtrlSetDefBkColor GUICtrlSetDefColor GUICtrlSetFont GUICtrlSetGraphic GUICtrlSetImage GUICtrlSetLimit GUICtrlSetOnEvent GUICtrlSetPos GUICtrlSetResizing GUICtrlSetState GUICtrlSetStyle GUICtrlSetTip GUIDelete GUIGetCursorInfo GUIGetMsg GUIGetStyle GUIRegisterMsg GUISetAccelerators GUISetBkColor GUISetCoord GUISetCursor GUISetFont GUISetHelp GUISetIcon GUISetOnEvent GUISetState GUISetStyle GUIStartGroup GUISwitch Hex HotKeySet HttpSetProxy HttpSetUserAgent HWnd InetClose InetGet InetGetInfo InetGetSize InetRead IniDelete IniRead IniReadSection IniReadSectionNames IniRenameSection IniWrite IniWriteSection InputBox Int IsAdmin IsArray IsBinary IsBool IsDeclared IsDllStruct IsFloat IsFunc IsHWnd IsInt IsKeyword IsNumber IsObj IsPtr IsString Log MemGetStats Mod MouseClick MouseClickDrag MouseDown MouseGetCursor MouseGetPos MouseMove MouseUp MouseWheel MsgBox Number ObjCreate ObjCreateInterface ObjEvent ObjGet ObjName OnAutoItExitRegister OnAutoItExitUnRegister Ping PixelChecksum PixelGetColor PixelSearch ProcessClose ProcessExists ProcessGetStats ProcessList ProcessSetPriority ProcessWait ProcessWaitClose ProgressOff ProgressOn ProgressSet Ptr Random RegDelete RegEnumKey RegEnumVal RegRead RegWrite Round Run RunAs RunAsWait RunWait Send SendKeepActive SetError SetExtended ShellExecute ShellExecuteWait Shutdown Sin Sleep SoundPlay SoundSetWaveVolume SplashImageOn SplashOff SplashTextOn Sqrt SRandom StatusbarGetText StderrRead StdinWrite StdioClose StdoutRead String StringAddCR StringCompare StringFormat StringFromASCIIArray StringInStr StringIsAlNum StringIsAlpha StringIsASCII StringIsDigit StringIsFloat StringIsInt StringIsLower StringIsSpace StringIsUpper StringIsXDigit StringLeft StringLen StringLower StringMid StringRegExp StringRegExpReplace StringReplace StringReverse StringRight StringSplit StringStripCR StringStripWS StringToASCIIArray StringToBinary StringTrimLeft StringTrimRight StringUpper Tan TCPAccept TCPCloseSocket TCPConnect TCPListen TCPNameToIP TCPRecv TCPSend TCPShutdown, UDPShutdown TCPStartup, UDPStartup TimerDiff TimerInit ToolTip TrayCreateItem TrayCreateMenu TrayGetMsg TrayItemDelete TrayItemGetHandle TrayItemGetState TrayItemGetText TrayItemSetOnEvent TrayItemSetState TrayItemSetText TraySetClick TraySetIcon TraySetOnEvent TraySetPauseIcon TraySetState TraySetToolTip TrayTip UBound UDPBind UDPCloseSocket UDPOpen UDPRecv UDPSend VarGetType WinActivate WinActive WinClose WinExists WinFlash WinGetCaretPos WinGetClassList WinGetClientSize WinGetHandle WinGetPos WinGetProcess WinGetState WinGetText WinGetTitle WinKill WinList WinMenuSelectItem WinMinimizeAll WinMinimizeAllUndo WinMove WinSetOnTop WinSetState WinSetTitle WinSetTrans WinWait',

        COMMENT = {
            variants: [
              hljs.COMMENT(';', '$', {relevance: 0}),
              hljs.COMMENT('#cs', '#ce'),
              hljs.COMMENT('#comments-start', '#comments-end')
            ]
        },

        VARIABLE = {
            begin: '\\$[A-z0-9_]+'
        },

        STRING = {
            className: 'string',
            variants: [{
                begin: /"/,
                end: /"/,
                contains: [{
                    begin: /""/,
                    relevance: 0
                }]
            }, {
                begin: /'/,
                end: /'/,
                contains: [{
                    begin: /''/,
                    relevance: 0
                }]
            }]
        },

        NUMBER = {
            variants: [hljs.BINARY_NUMBER_MODE, hljs.C_NUMBER_MODE]
        },

        PREPROCESSOR = {
            className: 'meta',
            begin: '#',
            end: '$',
            keywords: {'meta-keyword': 'comments include include-once NoTrayIcon OnAutoItStartRegister pragma compile RequireAdmin'},
            contains: [{
                    begin: /\\\n/,
                    relevance: 0
                }, {
                    beginKeywords: 'include',
                    keywords: {'meta-keyword': 'include'},
                    end: '$',
                    contains: [
                        STRING, {
                            className: 'meta-string',
                            variants: [{
                                begin: '<',
                                end: '>'
                            }, {
                                begin: /"/,
                                end: /"/,
                                contains: [{
                                    begin: /""/,
                                    relevance: 0
                                }]
                            }, {
                                begin: /'/,
                                end: /'/,
                                contains: [{
                                    begin: /''/,
                                    relevance: 0
                                }]
                            }]
                        }
                    ]
                },
                STRING,
                COMMENT
            ]
        },

        CONSTANT = {
            className: 'symbol',
            // begin: '@',
            // end: '$',
            // keywords: 'AppDataCommonDir AppDataDir AutoItExe AutoItPID AutoItVersion AutoItX64 COM_EventObj CommonFilesDir Compiled ComputerName ComSpec CPUArch CR CRLF DesktopCommonDir DesktopDepth DesktopDir DesktopHeight DesktopRefresh DesktopWidth DocumentsCommonDir error exitCode exitMethod extended FavoritesCommonDir FavoritesDir GUI_CtrlHandle GUI_CtrlId GUI_DragFile GUI_DragId GUI_DropId GUI_WinHandle HomeDrive HomePath HomeShare HotKeyPressed HOUR IPAddress1 IPAddress2 IPAddress3 IPAddress4 KBLayout LF LocalAppDataDir LogonDNSDomain LogonDomain LogonServer MDAY MIN MON MSEC MUILang MyDocumentsDir NumParams OSArch OSBuild OSLang OSServicePack OSType OSVersion ProgramFilesDir ProgramsCommonDir ProgramsDir ScriptDir ScriptFullPath ScriptLineNumber ScriptName SEC StartMenuCommonDir StartMenuDir StartupCommonDir StartupDir SW_DISABLE SW_ENABLE SW_HIDE SW_LOCK SW_MAXIMIZE SW_MINIMIZE SW_RESTORE SW_SHOW SW_SHOWDEFAULT SW_SHOWMAXIMIZED SW_SHOWMINIMIZED SW_SHOWMINNOACTIVE SW_SHOWNA SW_SHOWNOACTIVATE SW_SHOWNORMAL SW_UNLOCK SystemDir TAB TempDir TRAY_ID TrayIconFlashing TrayIconVisible UserName UserProfileDir WDAY WindowsDir WorkingDir YDAY YEAR',
            // relevance: 5
            begin: '@[A-z0-9_]+'
        },

        FUNCTION = {
            className: 'function',
            beginKeywords: 'Func',
            end: '$',
            illegal: '\\$|\\[|%',
            contains: [
                hljs.UNDERSCORE_TITLE_MODE, {
                    className: 'params',
                    begin: '\\(',
                    end: '\\)',
                    contains: [
                        VARIABLE,
                        STRING,
                        NUMBER
                    ]
                }
            ]
        };

    return {
        case_insensitive: true,
        illegal: /\/\*/,
        keywords: {
            keyword: KEYWORDS,
            built_in: BUILT_IN,
            literal: LITERAL
        },
        contains: [
            COMMENT,
            VARIABLE,
            STRING,
            NUMBER,
            PREPROCESSOR,
            CONSTANT,
            FUNCTION
        ]
    }
};

var avrasm = function(hljs) {
  return {
    case_insensitive: true,
    lexemes: '\\.?' + hljs.IDENT_RE,
    keywords: {
      keyword:
        /* mnemonic */
        'adc add adiw and andi asr bclr bld brbc brbs brcc brcs break breq brge brhc brhs ' +
        'brid brie brlo brlt brmi brne brpl brsh brtc brts brvc brvs bset bst call cbi cbr ' +
        'clc clh cli cln clr cls clt clv clz com cp cpc cpi cpse dec eicall eijmp elpm eor ' +
        'fmul fmuls fmulsu icall ijmp in inc jmp ld ldd ldi lds lpm lsl lsr mov movw mul ' +
        'muls mulsu neg nop or ori out pop push rcall ret reti rjmp rol ror sbc sbr sbrc sbrs ' +
        'sec seh sbi sbci sbic sbis sbiw sei sen ser ses set sev sez sleep spm st std sts sub ' +
        'subi swap tst wdr',
      built_in:
        /* general purpose registers */
        'r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 r16 r17 r18 r19 r20 r21 r22 ' +
        'r23 r24 r25 r26 r27 r28 r29 r30 r31 x|0 xh xl y|0 yh yl z|0 zh zl ' +
        /* IO Registers (ATMega128) */
        'ucsr1c udr1 ucsr1a ucsr1b ubrr1l ubrr1h ucsr0c ubrr0h tccr3c tccr3a tccr3b tcnt3h ' +
        'tcnt3l ocr3ah ocr3al ocr3bh ocr3bl ocr3ch ocr3cl icr3h icr3l etimsk etifr tccr1c ' +
        'ocr1ch ocr1cl twcr twdr twar twsr twbr osccal xmcra xmcrb eicra spmcsr spmcr portg ' +
        'ddrg ping portf ddrf sreg sph spl xdiv rampz eicrb eimsk gimsk gicr eifr gifr timsk ' +
        'tifr mcucr mcucsr tccr0 tcnt0 ocr0 assr tccr1a tccr1b tcnt1h tcnt1l ocr1ah ocr1al ' +
        'ocr1bh ocr1bl icr1h icr1l tccr2 tcnt2 ocr2 ocdr wdtcr sfior eearh eearl eedr eecr ' +
        'porta ddra pina portb ddrb pinb portc ddrc pinc portd ddrd pind spdr spsr spcr udr0 ' +
        'ucsr0a ucsr0b ubrr0l acsr admux adcsr adch adcl porte ddre pine pinf',
      meta:
        '.byte .cseg .db .def .device .dseg .dw .endmacro .equ .eseg .exit .include .list ' +
        '.listmac .macro .nolist .org .set'
    },
    contains: [
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.COMMENT(
        ';',
        '$',
        {
          relevance: 0
        }
      ),
      hljs.C_NUMBER_MODE, // 0x..., decimal, float
      hljs.BINARY_NUMBER_MODE, // 0b...
      {
        className: 'number',
        begin: '\\b(\\$[a-zA-Z0-9]+|0o[0-7]+)' // $..., 0o...
      },
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        begin: '\'', end: '[^\\\\]\'',
        illegal: '[^\\\\][^\']'
      },
      {className: 'symbol',  begin: '^[A-Za-z0-9_.$]+:'},
      {className: 'meta', begin: '#', end: '$'},
      {  // подстановка в «.macro»
        className: 'subst',
        begin: '@[0-9]+'
      }
    ]
  };
};

var awk = function(hljs) {
  var VARIABLE = {
    className: 'variable',
    variants: [
      {begin: /\$[\w\d#@][\w\d_]*/},
      {begin: /\$\{(.*?)}/}
    ]
  };
  var KEYWORDS = 'BEGIN END if else while do for in break continue delete next nextfile function func exit|10';
  var STRING = {
    className: 'string',
    contains: [hljs.BACKSLASH_ESCAPE],
    variants: [
      {
        begin: /(u|b)?r?'''/, end: /'''/,
        relevance: 10
      },
      {
        begin: /(u|b)?r?"""/, end: /"""/,
        relevance: 10
      },
      {
        begin: /(u|r|ur)'/, end: /'/,
        relevance: 10
      },
      {
        begin: /(u|r|ur)"/, end: /"/,
        relevance: 10
      },
      {
        begin: /(b|br)'/, end: /'/
      },
      {
        begin: /(b|br)"/, end: /"/
      },
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE
    ]
  };
  return {
	 keywords: {
	   keyword: KEYWORDS
    },
    contains: [
      VARIABLE,
      STRING,
      hljs.REGEXP_MODE,
      hljs.HASH_COMMENT_MODE,
      hljs.NUMBER_MODE
    ]
  }
};

var axapta = function(hljs) {
  return {
    keywords: 'false int abstract private char boolean static null if for true ' +
      'while long throw finally protected final return void enum else ' +
      'break new catch byte super case short default double public try this switch ' +
      'continue reverse firstfast firstonly forupdate nofetch sum avg minof maxof count ' +
      'order group by asc desc index hint like dispaly edit client server ttsbegin ' +
      'ttscommit str real date container anytype common div mod',
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.C_NUMBER_MODE,
      {
        className: 'meta',
        begin: '#', end: '$'
      },
      {
        className: 'class',
        beginKeywords: 'class interface', end: '{', excludeEnd: true,
        illegal: ':',
        contains: [
          {beginKeywords: 'extends implements'},
          hljs.UNDERSCORE_TITLE_MODE
        ]
      }
    ]
  };
};

var bash = function(hljs) {
  var VAR = {
    className: 'variable',
    variants: [
      {begin: /\$[\w\d#@][\w\d_]*/},
      {begin: /\$\{(.*?)}/}
    ]
  };
  var QUOTE_STRING = {
    className: 'string',
    begin: /"/, end: /"/,
    contains: [
      hljs.BACKSLASH_ESCAPE,
      VAR,
      {
        className: 'variable',
        begin: /\$\(/, end: /\)/,
        contains: [hljs.BACKSLASH_ESCAPE]
      }
    ]
  };
  var APOS_STRING = {
    className: 'string',
    begin: /'/, end: /'/
  };

  return {
    aliases: ['sh', 'zsh'],
    lexemes: /\b-?[a-z\._]+\b/,
    keywords: {
      keyword:
        'if then else elif fi for while in do done case esac function',
      literal:
        'true false',
      built_in:
        // Shell built-ins
        // http://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
        'break cd continue eval exec exit export getopts hash pwd readonly return shift test times ' +
        'trap umask unset ' +
        // Bash built-ins
        'alias bind builtin caller command declare echo enable help let local logout mapfile printf ' +
        'read readarray source type typeset ulimit unalias ' +
        // Shell modifiers
        'set shopt ' +
        // Zsh built-ins
        'autoload bg bindkey bye cap chdir clone comparguments compcall compctl compdescribe compfiles ' +
        'compgroups compquote comptags comptry compvalues dirs disable disown echotc echoti emulate ' +
        'fc fg float functions getcap getln history integer jobs kill limit log noglob popd print ' +
        'pushd pushln rehash sched setcap setopt stat suspend ttyctl unfunction unhash unlimit ' +
        'unsetopt vared wait whence where which zcompile zformat zftp zle zmodload zparseopts zprof ' +
        'zpty zregexparse zsocket zstyle ztcp',
      _:
        '-ne -eq -lt -gt -f -d -e -s -l -a' // relevance booster
    },
    contains: [
      {
        className: 'meta',
        begin: /^#![^\n]+sh\s*$/,
        relevance: 10
      },
      {
        className: 'function',
        begin: /\w[\w\d_]*\s*\(\s*\)\s*\{/,
        returnBegin: true,
        contains: [hljs.inherit(hljs.TITLE_MODE, {begin: /\w[\w\d_]*/})],
        relevance: 0
      },
      hljs.HASH_COMMENT_MODE,
      QUOTE_STRING,
      APOS_STRING,
      VAR
    ]
  };
};

var basic = function(hljs) {
  return {
    case_insensitive: true,
    illegal: '^\.',
    // Support explicitely typed variables that end with $%! or #.
    lexemes: '[a-zA-Z][a-zA-Z0-9_\$\%\!\#]*',
    keywords: {
        keyword:
          'ABS ASC AND ATN AUTO|0 BEEP BLOAD|10 BSAVE|10 CALL CALLS CDBL CHAIN CHDIR CHR$|10 CINT CIRCLE ' +
          'CLEAR CLOSE CLS COLOR COM COMMON CONT COS CSNG CSRLIN CVD CVI CVS DATA DATE$ ' +
          'DEFDBL DEFINT DEFSNG DEFSTR DEF|0 SEG USR DELETE DIM DRAW EDIT END ENVIRON ENVIRON$ ' +
          'EOF EQV ERASE ERDEV ERDEV$ ERL ERR ERROR EXP FIELD FILES FIX FOR|0 FRE GET GOSUB|10 GOTO ' +
          'HEX$ IF|0 THEN ELSE|0 INKEY$ INP INPUT INPUT# INPUT$ INSTR IMP INT IOCTL IOCTL$ KEY ON ' +
          'OFF LIST KILL LEFT$ LEN LET LINE LLIST LOAD LOC LOCATE LOF LOG LPRINT USING LSET ' +
          'MERGE MID$ MKDIR MKD$ MKI$ MKS$ MOD NAME NEW NEXT NOISE NOT OCT$ ON OR PEN PLAY STRIG OPEN OPTION ' +
          'BASE OUT PAINT PALETTE PCOPY PEEK PMAP POINT POKE POS PRINT PRINT] PSET PRESET ' +
          'PUT RANDOMIZE READ REM RENUM RESET|0 RESTORE RESUME RETURN|0 RIGHT$ RMDIR RND RSET ' +
          'RUN SAVE SCREEN SGN SHELL SIN SOUND SPACE$ SPC SQR STEP STICK STOP STR$ STRING$ SWAP ' +
          'SYSTEM TAB TAN TIME$ TIMER TROFF TRON TO USR VAL VARPTR VARPTR$ VIEW WAIT WHILE ' +
          'WEND WIDTH WINDOW WRITE XOR'
    },
    contains: [
      hljs.QUOTE_STRING_MODE,
      hljs.COMMENT('REM', '$', {relevance: 10}),
      hljs.COMMENT('\'', '$', {relevance: 0}),
      {
        // Match line numbers
        className: 'symbol',
        begin: '^[0-9]+\ ',
        relevance: 10
      },
      {
        // Match typed numeric constants (1000, 12.34!, 1.2e5, 1.5#, 1.2D2)
        className: 'number',
        begin: '\\b([0-9]+[0-9edED\.]*[#\!]?)',
        relevance: 0
      },
      {
        // Match hexadecimal numbers (&Hxxxx)
        className: 'number',
        begin: '(\&[hH][0-9a-fA-F]{1,4})'
      },
      {
        // Match octal numbers (&Oxxxxxx)
        className: 'number',
        begin: '(\&[oO][0-7]{1,6})'
      }
    ]
  };
};

var bnf = function(hljs){
  return {
    contains: [
      // Attribute
      {
        className: 'attribute',
        begin: /</, end: />/
      },
      // Specific
      {
        begin: /::=/,
        starts: {
          end: /$/,
          contains: [
            {
              begin: /</, end: />/
            },
            // Common
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE
          ]
        }
      }
    ]
  };
};

var brainfuck = function(hljs){
  var LITERAL = {
    className: 'literal',
    begin: '[\\+\\-]',
    relevance: 0
  };
  return {
    aliases: ['bf'],
    contains: [
      hljs.COMMENT(
        '[^\\[\\]\\.,\\+\\-<> \r\n]',
        '[\\[\\]\\.,\\+\\-<> \r\n]',
        {
          returnEnd: true,
          relevance: 0
        }
      ),
      {
        className: 'title',
        begin: '[\\[\\]]',
        relevance: 0
      },
      {
        className: 'string',
        begin: '[\\.,]',
        relevance: 0
      },
      {
        // this mode works as the only relevance counter
        begin: /\+\+|\-\-/, returnBegin: true,
        contains: [LITERAL]
      },
      LITERAL
    ]
  };
};

var cal = function(hljs) {
  var KEYWORDS =
    'div mod in and or not xor asserterror begin case do downto else end exit for if of repeat then to ' +
    'until while with var';
  var LITERALS = 'false true';
  var COMMENT_MODES = [
    hljs.C_LINE_COMMENT_MODE,
    hljs.COMMENT(
      /\{/,
      /\}/,
      {
        relevance: 0
      }
    ),
    hljs.COMMENT(
      /\(\*/,
      /\*\)/,
      {
        relevance: 10
      }
    )
  ];
  var STRING = {
    className: 'string',
    begin: /'/, end: /'/,
    contains: [{begin: /''/}]
  };
  var CHAR_STRING = {
    className: 'string', begin: /(#\d+)+/
  };
  var DATE = {
      className: 'number',
      begin: '\\b\\d+(\\.\\d+)?(DT|D|T)',
      relevance: 0
  };
  var DBL_QUOTED_VARIABLE = {
      className: 'string', // not a string technically but makes sense to be highlighted in the same style
      begin: '"',
      end: '"'
  };

  var PROCEDURE = {
    className: 'function',
    beginKeywords: 'procedure', end: /[:;]/,
    keywords: 'procedure|10',
    contains: [
      hljs.TITLE_MODE,
      {
        className: 'params',
        begin: /\(/, end: /\)/,
        keywords: KEYWORDS,
        contains: [STRING, CHAR_STRING]
      }
    ].concat(COMMENT_MODES)
  };

  var OBJECT = {
    className: 'class',
    begin: 'OBJECT (Table|Form|Report|Dataport|Codeunit|XMLport|MenuSuite|Page|Query) (\\d+) ([^\\r\\n]+)',
    returnBegin: true,
    contains: [
      hljs.TITLE_MODE,
        PROCEDURE
    ]
  };

  return {
    case_insensitive: true,
    keywords: { keyword: KEYWORDS, literal: LITERALS },
    illegal: /\/\*/,
    contains: [
      STRING, CHAR_STRING,
      DATE, DBL_QUOTED_VARIABLE,
      hljs.NUMBER_MODE,
      OBJECT,
      PROCEDURE
    ]
  };
};

var capnproto = function(hljs) {
  return {
    aliases: ['capnp'],
    keywords: {
      keyword:
        'struct enum interface union group import using const annotation extends in of on as with from fixed',
      built_in:
        'Void Bool Int8 Int16 Int32 Int64 UInt8 UInt16 UInt32 UInt64 Float32 Float64 ' +
        'Text Data AnyPointer AnyStruct Capability List',
      literal:
        'true false'
    },
    contains: [
      hljs.QUOTE_STRING_MODE,
      hljs.NUMBER_MODE,
      hljs.HASH_COMMENT_MODE,
      {
        className: 'meta',
        begin: /@0x[\w\d]{16};/,
        illegal: /\n/
      },
      {
        className: 'symbol',
        begin: /@\d+\b/
      },
      {
        className: 'class',
        beginKeywords: 'struct enum', end: /\{/,
        illegal: /\n/,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {
            starts: {endsWithParent: true, excludeEnd: true} // hack: eating everything after the first title
          })
        ]
      },
      {
        className: 'class',
        beginKeywords: 'interface', end: /\{/,
        illegal: /\n/,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {
            starts: {endsWithParent: true, excludeEnd: true} // hack: eating everything after the first title
          })
        ]
      }
    ]
  };
};

var ceylon = function(hljs) {
  // 2.3. Identifiers and keywords
  var KEYWORDS =
    'assembly module package import alias class interface object given value ' +
    'assign void function new of extends satisfies abstracts in out return ' +
    'break continue throw assert dynamic if else switch case for while try ' +
    'catch finally then let this outer super is exists nonempty';
  // 7.4.1 Declaration Modifiers
  var DECLARATION_MODIFIERS =
    'shared abstract formal default actual variable late native deprecated' +
    'final sealed annotation suppressWarnings small';
  // 7.4.2 Documentation
  var DOCUMENTATION =
    'doc by license see throws tagged';
  var SUBST = {
    className: 'subst', excludeBegin: true, excludeEnd: true,
    begin: /``/, end: /``/,
    keywords: KEYWORDS,
    relevance: 10
  };
  var EXPRESSIONS = [
    {
      // verbatim string
      className: 'string',
      begin: '"""',
      end: '"""',
      relevance: 10
    },
    {
      // string literal or template
      className: 'string',
      begin: '"', end: '"',
      contains: [SUBST]
    },
    {
      // character literal
      className: 'string',
      begin: "'",
      end: "'"
    },
    {
      // numeric literal
      className: 'number',
      begin: '#[0-9a-fA-F_]+|\\$[01_]+|[0-9_]+(?:\\.[0-9_](?:[eE][+-]?\\d+)?)?[kMGTPmunpf]?',
      relevance: 0
    }
  ];
  SUBST.contains = EXPRESSIONS;

  return {
    keywords: {
      keyword: KEYWORDS + ' ' + DECLARATION_MODIFIERS,
      meta: DOCUMENTATION
    },
    illegal: '\\$[^01]|#[^0-9a-fA-F]',
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.COMMENT('/\\*', '\\*/', {contains: ['self']}),
      {
        // compiler annotation
        className: 'meta',
        begin: '@[a-z]\\w*(?:\\:\"[^\"]*\")?'
      }
    ].concat(EXPRESSIONS)
  };
};

var clean = function(hljs) {
  return {
    aliases: ['clean','icl','dcl'],
    keywords: {
      keyword:
        'if let in with where case of class instance otherwise ' +
        'implementation definition system module from import qualified as ' +
        'special code inline foreign export ccall stdcall generic derive ' +
        'infix infixl infixr',
      built_in:
        'Int Real Char Bool',
      literal:
        'True False'
    },
    contains: [

      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.C_NUMBER_MODE,

      {begin: '->|<-[|:]?|#!?|>>=|\\{\\||\\|\\}|:==|=:|<>'} // relevance booster
    ]
  };
};

var clojure = function(hljs) {
  var keywords = {
    'builtin-name':
      // Clojure keywords
      'def defonce cond apply if-not if-let if not not= = < > <= >= == + / * - rem '+
      'quot neg? pos? delay? symbol? keyword? true? false? integer? empty? coll? list? '+
      'set? ifn? fn? associative? sequential? sorted? counted? reversible? number? decimal? '+
      'class? distinct? isa? float? rational? reduced? ratio? odd? even? char? seq? vector? '+
      'string? map? nil? contains? zero? instance? not-every? not-any? libspec? -> ->> .. . '+
      'inc compare do dotimes mapcat take remove take-while drop letfn drop-last take-last '+
      'drop-while while intern condp case reduced cycle split-at split-with repeat replicate '+
      'iterate range merge zipmap declare line-seq sort comparator sort-by dorun doall nthnext '+
      'nthrest partition eval doseq await await-for let agent atom send send-off release-pending-sends '+
      'add-watch mapv filterv remove-watch agent-error restart-agent set-error-handler error-handler '+
      'set-error-mode! error-mode shutdown-agents quote var fn loop recur throw try monitor-enter '+
      'monitor-exit defmacro defn defn- macroexpand macroexpand-1 for dosync and or '+
      'when when-not when-let comp juxt partial sequence memoize constantly complement identity assert '+
      'peek pop doto proxy defstruct first rest cons defprotocol cast coll deftype defrecord last butlast '+
      'sigs reify second ffirst fnext nfirst nnext defmulti defmethod meta with-meta ns in-ns create-ns import '+
      'refer keys select-keys vals key val rseq name namespace promise into transient persistent! conj! '+
      'assoc! dissoc! pop! disj! use class type num float double short byte boolean bigint biginteger '+
      'bigdec print-method print-dup throw-if printf format load compile get-in update-in pr pr-on newline '+
      'flush read slurp read-line subvec with-open memfn time re-find re-groups rand-int rand mod locking '+
      'assert-valid-fdecl alias resolve ref deref refset swap! reset! set-validator! compare-and-set! alter-meta! '+
      'reset-meta! commute get-validator alter ref-set ref-history-count ref-min-history ref-max-history ensure sync io! '+
      'new next conj set! to-array future future-call into-array aset gen-class reduce map filter find empty '+
      'hash-map hash-set sorted-map sorted-map-by sorted-set sorted-set-by vec vector seq flatten reverse assoc dissoc list '+
      'disj get union difference intersection extend extend-type extend-protocol int nth delay count concat chunk chunk-buffer '+
      'chunk-append chunk-first chunk-rest max min dec unchecked-inc-int unchecked-inc unchecked-dec-inc unchecked-dec unchecked-negate '+
      'unchecked-add-int unchecked-add unchecked-subtract-int unchecked-subtract chunk-next chunk-cons chunked-seq? prn vary-meta '+
      'lazy-seq spread list* str find-keyword keyword symbol gensym force rationalize'
   };

  var SYMBOLSTART = 'a-zA-Z_\\-!.?+*=<>&#\'';
  var SYMBOL_RE = '[' + SYMBOLSTART + '][' + SYMBOLSTART + '0-9/;:]*';
  var SIMPLE_NUMBER_RE = '[-+]?\\d+(\\.\\d+)?';

  var SYMBOL = {
    begin: SYMBOL_RE,
    relevance: 0
  };
  var NUMBER = {
    className: 'number', begin: SIMPLE_NUMBER_RE,
    relevance: 0
  };
  var STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null});
  var COMMENT = hljs.COMMENT(
    ';',
    '$',
    {
      relevance: 0
    }
  );
  var LITERAL = {
    className: 'literal',
    begin: /\b(true|false|nil)\b/
  };
  var COLLECTION = {
    begin: '[\\[\\{]', end: '[\\]\\}]'
  };
  var HINT = {
    className: 'comment',
    begin: '\\^' + SYMBOL_RE
  };
  var HINT_COL = hljs.COMMENT('\\^\\{', '\\}');
  var KEY = {
    className: 'symbol',
    begin: '[:]{1,2}' + SYMBOL_RE
  };
  var LIST = {
    begin: '\\(', end: '\\)'
  };
  var BODY = {
    endsWithParent: true,
    relevance: 0
  };
  var NAME = {
    keywords: keywords,
    lexemes: SYMBOL_RE,
    className: 'name', begin: SYMBOL_RE,
    starts: BODY
  };
  var DEFAULT_CONTAINS = [LIST, STRING, HINT, HINT_COL, COMMENT, KEY, COLLECTION, NUMBER, LITERAL, SYMBOL];

  LIST.contains = [hljs.COMMENT('comment', ''), NAME, BODY];
  BODY.contains = DEFAULT_CONTAINS;
  COLLECTION.contains = DEFAULT_CONTAINS;
  HINT_COL.contains = [COLLECTION];

  return {
    aliases: ['clj'],
    illegal: /\S/,
    contains: [LIST, STRING, HINT, HINT_COL, COMMENT, KEY, COLLECTION, NUMBER, LITERAL]
  }
};

var clojureRepl = function(hljs) {
  return {
    contains: [
      {
        className: 'meta',
        begin: /^([\w.-]+|\s*#_)?=>/,
        starts: {
          end: /$/,
          subLanguage: 'clojure'
        }
      }
    ]
  }
};

var cmake = function(hljs) {
  return {
    aliases: ['cmake.in'],
    case_insensitive: true,
    keywords: {
      keyword:
        // scripting commands
        'break cmake_host_system_information cmake_minimum_required cmake_parse_arguments ' +
        'cmake_policy configure_file continue elseif else endforeach endfunction endif endmacro ' +
        'endwhile execute_process file find_file find_library find_package find_path ' +
        'find_program foreach function get_cmake_property get_directory_property ' +
        'get_filename_component get_property if include include_guard list macro ' +
        'mark_as_advanced math message option return separate_arguments ' +
        'set_directory_properties set_property set site_name string unset variable_watch while ' +
        // project commands
        'add_compile_definitions add_compile_options add_custom_command add_custom_target ' +
        'add_definitions add_dependencies add_executable add_library add_link_options ' +
        'add_subdirectory add_test aux_source_directory build_command create_test_sourcelist ' +
        'define_property enable_language enable_testing export fltk_wrap_ui ' +
        'get_source_file_property get_target_property get_test_property include_directories ' +
        'include_external_msproject include_regular_expression install link_directories ' +
        'link_libraries load_cache project qt_wrap_cpp qt_wrap_ui remove_definitions ' +
        'set_source_files_properties set_target_properties set_tests_properties source_group ' +
        'target_compile_definitions target_compile_features target_compile_options ' +
        'target_include_directories target_link_directories target_link_libraries ' +
        'target_link_options target_sources try_compile try_run ' +
        // CTest commands
        'ctest_build ctest_configure ctest_coverage ctest_empty_binary_directory ctest_memcheck ' +
        'ctest_read_custom_files ctest_run_script ctest_sleep ctest_start ctest_submit ' +
        'ctest_test ctest_update ctest_upload ' +
        // deprecated commands
        'build_name exec_program export_library_dependencies install_files install_programs ' +
        'install_targets load_command make_directory output_required_files remove ' +
        'subdir_depends subdirs use_mangled_mesa utility_source variable_requires write_file ' +
        'qt5_use_modules qt5_use_package qt5_wrap_cpp ' +
        // core keywords
        'on off true false and or not command policy target test exists is_newer_than ' +
        'is_directory is_symlink is_absolute matches less greater equal less_equal ' +
        'greater_equal strless strgreater strequal strless_equal strgreater_equal version_less ' +
        'version_greater version_equal version_less_equal version_greater_equal in_list defined'
    },
    contains: [
      {
        className: 'variable',
        begin: '\\${', end: '}'
      },
      hljs.HASH_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.NUMBER_MODE
    ]
  };
};

var coffeescript = function(hljs) {
  var KEYWORDS = {
    keyword:
      // JS keywords
      'in if for while finally new do return else break catch instanceof throw try this ' +
      'switch continue typeof delete debugger super yield import export from as default await ' +
      // Coffee keywords
      'then unless until loop of by when and or is isnt not',
    literal:
      // JS literals
      'true false null undefined ' +
      // Coffee literals
      'yes no on off',
    built_in:
      'npm require console print module global window document'
  };
  var JS_IDENT_RE = '[A-Za-z$_][0-9A-Za-z$_]*';
  var SUBST = {
    className: 'subst',
    begin: /#\{/, end: /}/,
    keywords: KEYWORDS
  };
  var EXPRESSIONS = [
    hljs.BINARY_NUMBER_MODE,
    hljs.inherit(hljs.C_NUMBER_MODE, {starts: {end: '(\\s*/)?', relevance: 0}}), // a number tries to eat the following slash to prevent treating it as a regexp
    {
      className: 'string',
      variants: [
        {
          begin: /'''/, end: /'''/,
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        {
          begin: /'/, end: /'/,
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        {
          begin: /"""/, end: /"""/,
          contains: [hljs.BACKSLASH_ESCAPE, SUBST]
        },
        {
          begin: /"/, end: /"/,
          contains: [hljs.BACKSLASH_ESCAPE, SUBST]
        }
      ]
    },
    {
      className: 'regexp',
      variants: [
        {
          begin: '///', end: '///',
          contains: [SUBST, hljs.HASH_COMMENT_MODE]
        },
        {
          begin: '//[gim]*',
          relevance: 0
        },
        {
          // regex can't start with space to parse x / 2 / 3 as two divisions
          // regex can't start with *, and it supports an "illegal" in the main mode
          begin: /\/(?![ *])(\\\/|.)*?\/[gim]*(?=\W|$)/
        }
      ]
    },
    {
      begin: '@' + JS_IDENT_RE // relevance booster
    },
    {
      subLanguage: 'javascript',
      excludeBegin: true, excludeEnd: true,
      variants: [
        {
          begin: '```', end: '```',
        },
        {
          begin: '`', end: '`',
        }
      ]
    }
  ];
  SUBST.contains = EXPRESSIONS;

  var TITLE = hljs.inherit(hljs.TITLE_MODE, {begin: JS_IDENT_RE});
  var PARAMS_RE = '(\\(.*\\))?\\s*\\B[-=]>';
  var PARAMS = {
    className: 'params',
    begin: '\\([^\\(]', returnBegin: true,
    /* We need another contained nameless mode to not have every nested
    pair of parens to be called "params" */
    contains: [{
      begin: /\(/, end: /\)/,
      keywords: KEYWORDS,
      contains: ['self'].concat(EXPRESSIONS)
    }]
  };

  return {
    aliases: ['coffee', 'cson', 'iced'],
    keywords: KEYWORDS,
    illegal: /\/\*/,
    contains: EXPRESSIONS.concat([
      hljs.COMMENT('###', '###'),
      hljs.HASH_COMMENT_MODE,
      {
        className: 'function',
        begin: '^\\s*' + JS_IDENT_RE + '\\s*=\\s*' + PARAMS_RE, end: '[-=]>',
        returnBegin: true,
        contains: [TITLE, PARAMS]
      },
      {
        // anonymous function start
        begin: /[:\(,=]\s*/,
        relevance: 0,
        contains: [
          {
            className: 'function',
            begin: PARAMS_RE, end: '[-=]>',
            returnBegin: true,
            contains: [PARAMS]
          }
        ]
      },
      {
        className: 'class',
        beginKeywords: 'class',
        end: '$',
        illegal: /[:="\[\]]/,
        contains: [
          {
            beginKeywords: 'extends',
            endsWithParent: true,
            illegal: /[:="\[\]]/,
            contains: [TITLE]
          },
          TITLE
        ]
      },
      {
        begin: JS_IDENT_RE + ':', end: ':',
        returnBegin: true, returnEnd: true,
        relevance: 0
      }
    ])
  };
};

var coq = function(hljs) {
  return {
    keywords: {
      keyword:
        '_ as at cofix else end exists exists2 fix for forall fun if IF in let ' +
        'match mod Prop return Set then Type using where with ' +
        'Abort About Add Admit Admitted All Arguments Assumptions Axiom Back BackTo ' +
        'Backtrack Bind Blacklist Canonical Cd Check Class Classes Close Coercion ' +
        'Coercions CoFixpoint CoInductive Collection Combined Compute Conjecture ' +
        'Conjectures Constant constr Constraint Constructors Context Corollary ' +
        'CreateHintDb Cut Declare Defined Definition Delimit Dependencies Dependent' +
        'Derive Drop eauto End Equality Eval Example Existential Existentials ' +
        'Existing Export exporting Extern Extract Extraction Fact Field Fields File ' +
        'Fixpoint Focus for From Function Functional Generalizable Global Goal Grab ' +
        'Grammar Graph Guarded Heap Hint HintDb Hints Hypotheses Hypothesis ident ' +
        'Identity If Immediate Implicit Import Include Inductive Infix Info Initial ' +
        'Inline Inspect Instance Instances Intro Intros Inversion Inversion_clear ' +
        'Language Left Lemma Let Libraries Library Load LoadPath Local Locate Ltac ML ' +
        'Mode Module Modules Monomorphic Morphism Next NoInline Notation Obligation ' +
        'Obligations Opaque Open Optimize Options Parameter Parameters Parametric ' +
        'Path Paths pattern Polymorphic Preterm Print Printing Program Projections ' +
        'Proof Proposition Pwd Qed Quit Rec Record Recursive Redirect Relation Remark ' +
        'Remove Require Reserved Reset Resolve Restart Rewrite Right Ring Rings Save ' +
        'Scheme Scope Scopes Script Search SearchAbout SearchHead SearchPattern ' +
        'SearchRewrite Section Separate Set Setoid Show Solve Sorted Step Strategies ' +
        'Strategy Structure SubClass Table Tables Tactic Term Test Theorem Time ' +
        'Timeout Transparent Type Typeclasses Types Undelimit Undo Unfocus Unfocused ' +
        'Unfold Universe Universes Unset Unshelve using Variable Variables Variant ' +
        'Verbose Visibility where with',
      built_in:
        'abstract absurd admit after apply as assert assumption at auto autorewrite ' +
        'autounfold before bottom btauto by case case_eq cbn cbv change ' +
        'classical_left classical_right clear clearbody cofix compare compute ' +
        'congruence constr_eq constructor contradict contradiction cut cutrewrite ' +
        'cycle decide decompose dependent destruct destruction dintuition ' +
        'discriminate discrR do double dtauto eapply eassumption eauto ecase ' +
        'econstructor edestruct ediscriminate eelim eexact eexists einduction ' +
        'einjection eleft elim elimtype enough equality erewrite eright ' +
        'esimplify_eq esplit evar exact exactly_once exfalso exists f_equal fail ' +
        'field field_simplify field_simplify_eq first firstorder fix fold fourier ' +
        'functional generalize generalizing gfail give_up has_evar hnf idtac in ' +
        'induction injection instantiate intro intro_pattern intros intuition ' +
        'inversion inversion_clear is_evar is_var lapply lazy left lia lra move ' +
        'native_compute nia nsatz omega once pattern pose progress proof psatz quote ' +
        'record red refine reflexivity remember rename repeat replace revert ' +
        'revgoals rewrite rewrite_strat right ring ring_simplify rtauto set ' +
        'setoid_reflexivity setoid_replace setoid_rewrite setoid_symmetry ' +
        'setoid_transitivity shelve shelve_unifiable simpl simple simplify_eq solve ' +
        'specialize split split_Rabs split_Rmult stepl stepr subst sum swap ' +
        'symmetry tactic tauto time timeout top transitivity trivial try tryif ' +
        'unfold unify until using vm_compute with'
    },
    contains: [
      hljs.QUOTE_STRING_MODE,
      hljs.COMMENT('\\(\\*', '\\*\\)'),
      hljs.C_NUMBER_MODE,
      {
        className: 'type',
        excludeBegin: true,
        begin: '\\|\\s*',
        end: '\\w+'
      },
      {begin: /[-=]>/} // relevance booster
    ]
  };
};

var cos = function cos (hljs) {

  var STRINGS = {
    className: 'string',
    variants: [
      {
        begin: '"',
        end: '"',
        contains: [{ // escaped
          begin: "\"\"",
          relevance: 0
        }]
      }
    ]
  };

  var NUMBERS = {
    className: "number",
    begin: "\\b(\\d+(\\.\\d*)?|\\.\\d+)",
    relevance: 0
  };

  var COS_KEYWORDS =
    'property parameter class classmethod clientmethod extends as break ' +
    'catch close continue do d|0 else elseif for goto halt hang h|0 if job ' +
    'j|0 kill k|0 lock l|0 merge new open quit q|0 read r|0 return set s|0 ' +
    'tcommit throw trollback try tstart use view while write w|0 xecute x|0 ' +
    'zkill znspace zn ztrap zwrite zw zzdump zzwrite print zbreak zinsert ' +
    'zload zprint zremove zsave zzprint mv mvcall mvcrt mvdim mvprint zquit ' +
    'zsync ascii';

    // registered function - no need in them due to all functions are highlighted,
    // but I'll just leave this here.

    //"$bit", "$bitcount",
    //"$bitfind", "$bitlogic", "$case", "$char", "$classmethod", "$classname",
    //"$compile", "$data", "$decimal", "$double", "$extract", "$factor",
    //"$find", "$fnumber", "$get", "$increment", "$inumber", "$isobject",
    //"$isvaliddouble", "$isvalidnum", "$justify", "$length", "$list",
    //"$listbuild", "$listdata", "$listfind", "$listfromstring", "$listget",
    //"$listlength", "$listnext", "$listsame", "$listtostring", "$listvalid",
    //"$locate", "$match", "$method", "$name", "$nconvert", "$next",
    //"$normalize", "$now", "$number", "$order", "$parameter", "$piece",
    //"$prefetchoff", "$prefetchon", "$property", "$qlength", "$qsubscript",
    //"$query", "$random", "$replace", "$reverse", "$sconvert", "$select",
    //"$sortbegin", "$sortend", "$stack", "$text", "$translate", "$view",
    //"$wascii", "$wchar", "$wextract", "$wfind", "$wiswide", "$wlength",
    //"$wreverse", "$xecute", "$zabs", "$zarccos", "$zarcsin", "$zarctan",
    //"$zcos", "$zcot", "$zcsc", "$zdate", "$zdateh", "$zdatetime",
    //"$zdatetimeh", "$zexp", "$zhex", "$zln", "$zlog", "$zpower", "$zsec",
    //"$zsin", "$zsqr", "$ztan", "$ztime", "$ztimeh", "$zboolean",
    //"$zconvert", "$zcrc", "$zcyc", "$zdascii", "$zdchar", "$zf",
    //"$ziswide", "$zlascii", "$zlchar", "$zname", "$zposition", "$zqascii",
    //"$zqchar", "$zsearch", "$zseek", "$zstrip", "$zwascii", "$zwchar",
    //"$zwidth", "$zwpack", "$zwbpack", "$zwunpack", "$zwbunpack", "$zzenkaku",
    //"$change", "$mv", "$mvat", "$mvfmt", "$mvfmts", "$mviconv",
    //"$mviconvs", "$mvinmat", "$mvlover", "$mvoconv", "$mvoconvs", "$mvraise",
    //"$mvtrans", "$mvv", "$mvname", "$zbitand", "$zbitcount", "$zbitfind",
    //"$zbitget", "$zbitlen", "$zbitnot", "$zbitor", "$zbitset", "$zbitstr",
    //"$zbitxor", "$zincrement", "$znext", "$zorder", "$zprevious", "$zsort",
    //"device", "$ecode", "$estack", "$etrap", "$halt", "$horolog",
    //"$io", "$job", "$key", "$namespace", "$principal", "$quit", "$roles",
    //"$storage", "$system", "$test", "$this", "$tlevel", "$username",
    //"$x", "$y", "$za", "$zb", "$zchild", "$zeof", "$zeos", "$zerror",
    //"$zhorolog", "$zio", "$zjob", "$zmode", "$znspace", "$zparent", "$zpi",
    //"$zpos", "$zreference", "$zstorage", "$ztimestamp", "$ztimezone",
    //"$ztrap", "$zversion"

  return {
    case_insensitive: true,
    aliases: ["cos", "cls"],
    keywords: COS_KEYWORDS,
    contains: [
      NUMBERS,
      STRINGS,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: "comment",
        begin: /;/, end: "$",
        relevance: 0
      },
      { // Functions and user-defined functions: write $ztime(60*60*3), $$myFunc(10), $$^Val(1)
        className: "built_in",
        begin: /(?:\$\$?|\.\.)\^?[a-zA-Z]+/
      },
      { // Macro command: quit $$$OK
        className: "built_in",
        begin: /\$\$\$[a-zA-Z]+/
      },
      { // Special (global) variables: write %request.Content; Built-in classes: %Library.Integer
        className: "built_in",
        begin: /%[a-z]+(?:\.[a-z]+)*/
      },
      { // Global variable: set ^globalName = 12 write ^globalName
        className: "symbol",
        begin: /\^%?[a-zA-Z][\w]*/
      },
      { // Some control constructions: do ##class(Package.ClassName).Method(), ##super()
        className: "keyword",
        begin: /##class|##super|#define|#dim/
      },

      // sub-languages: are not fully supported by hljs by 11/15/2015
      // left for the future implementation.
      {
        begin: /&sql\(/,    end: /\)/,
        excludeBegin: true, excludeEnd: true,
        subLanguage: "sql"
      },
      {
        begin: /&(js|jscript|javascript)</, end: />/,
        excludeBegin: true, excludeEnd: true,
        subLanguage: "javascript"
      },
      {
        // this brakes first and last tag, but this is the only way to embed a valid html
        begin: /&html<\s*</, end: />\s*>/,
        subLanguage: "xml"
      }
    ]
  };
};

var crmsh = function(hljs) {
  var RESOURCES = 'primitive rsc_template';

  var COMMANDS = 'group clone ms master location colocation order fencing_topology ' +
      'rsc_ticket acl_target acl_group user role ' +
      'tag xml';

  var PROPERTY_SETS = 'property rsc_defaults op_defaults';

  var KEYWORDS = 'params meta operations op rule attributes utilization';

  var OPERATORS = 'read write deny defined not_defined in_range date spec in ' +
      'ref reference attribute type xpath version and or lt gt tag ' +
      'lte gte eq ne \\';

  var TYPES = 'number string';

  var LITERALS = 'Master Started Slave Stopped start promote demote stop monitor true false';

  return {
    aliases: ['crm', 'pcmk'],
    case_insensitive: true,
    keywords: {
      keyword: KEYWORDS + ' ' + OPERATORS + ' ' + TYPES,
      literal: LITERALS
    },
    contains: [
      hljs.HASH_COMMENT_MODE,
      {
        beginKeywords: 'node',
        starts: {
          end: '\\s*([\\w_-]+:)?',
          starts: {
            className: 'title',
            end: '\\s*[\\$\\w_][\\w_-]*'
          }
        }
      },
      {
        beginKeywords: RESOURCES,
        starts: {
          className: 'title',
          end: '\\s*[\\$\\w_][\\w_-]*',
          starts: {
            end: '\\s*@?[\\w_][\\w_\\.:-]*'
          }
        }
      },
      {
        begin: '\\b(' + COMMANDS.split(' ').join('|') + ')\\s+',
        keywords: COMMANDS,
        starts: {
          className: 'title',
          end: '[\\$\\w_][\\w_-]*'
        }
      },
      {
        beginKeywords: PROPERTY_SETS,
        starts: {
          className: 'title',
          end: '\\s*([\\w_-]+:)?'
        }
      },
      hljs.QUOTE_STRING_MODE,
      {
        className: 'meta',
        begin: '(ocf|systemd|service|lsb):[\\w_:-]+',
        relevance: 0
      },
      {
        className: 'number',
        begin: '\\b\\d+(\\.\\d+)?(ms|s|h|m)?',
        relevance: 0
      },
      {
        className: 'literal',
        begin: '[-]?(infinity|inf)',
        relevance: 0
      },
      {
        className: 'attr',
        begin: /([A-Za-z\$_\#][\w_-]+)=/,
        relevance: 0
      },
      {
        className: 'tag',
        begin: '</?',
        end: '/?>',
        relevance: 0
      }
    ]
  };
};

var crystal = function(hljs) {
  var INT_SUFFIX = '(_*[ui](8|16|32|64|128))?';
  var FLOAT_SUFFIX = '(_*f(32|64))?';
  var CRYSTAL_IDENT_RE = '[a-zA-Z_]\\w*[!?=]?';
  var CRYSTAL_METHOD_RE = '[a-zA-Z_]\\w*[!?=]?|[-+~]\\@|<<|>>|=~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~|]|//|//=|&[-+*]=?|&\\*\\*|\\[\\][=?]?';
  var CRYSTAL_PATH_RE = '[A-Za-z_]\\w*(::\\w+)*(\\?|\\!)?';
  var CRYSTAL_KEYWORDS = {
    keyword:
      'abstract alias annotation as as? asm begin break case class def do else elsif end ensure enum extend for fun if ' +
      'include instance_sizeof is_a? lib macro module next nil? of out pointerof private protected rescue responds_to? ' +
      'return require select self sizeof struct super then type typeof union uninitialized unless until verbatim when while with yield ' +
      '__DIR__ __END_LINE__ __FILE__ __LINE__',
    literal: 'false nil true'
  };
  var SUBST = {
    className: 'subst',
    begin: '#{', end: '}',
    keywords: CRYSTAL_KEYWORDS
  };
  var EXPANSION = {
    className: 'template-variable',
    variants: [
      {begin: '\\{\\{', end: '\\}\\}'},
      {begin: '\\{%', end: '%\\}'}
    ],
    keywords: CRYSTAL_KEYWORDS
  };

  function recursiveParen(begin, end) {
    var
    contains = [{begin: begin, end: end}];
    contains[0].contains = contains;
    return contains;
  }
  var STRING = {
    className: 'string',
    contains: [hljs.BACKSLASH_ESCAPE, SUBST],
    variants: [
      {begin: /'/, end: /'/},
      {begin: /"/, end: /"/},
      {begin: /`/, end: /`/},
      {begin: '%[Qwi]?\\(', end: '\\)', contains: recursiveParen('\\(', '\\)')},
      {begin: '%[Qwi]?\\[', end: '\\]', contains: recursiveParen('\\[', '\\]')},
      {begin: '%[Qwi]?{', end: '}', contains: recursiveParen('{', '}')},
      {begin: '%[Qwi]?<', end: '>', contains: recursiveParen('<', '>')},
      {begin: '%[Qwi]?\\|', end: '\\|'},
      {begin: /<<-\w+$/, end: /^\s*\w+$/},
    ],
    relevance: 0,
  };
  var Q_STRING = {
    className: 'string',
    variants: [
      {begin: '%q\\(', end: '\\)', contains: recursiveParen('\\(', '\\)')},
      {begin: '%q\\[', end: '\\]', contains: recursiveParen('\\[', '\\]')},
      {begin: '%q{', end: '}', contains: recursiveParen('{', '}')},
      {begin: '%q<', end: '>', contains: recursiveParen('<', '>')},
      {begin: '%q\\|', end: '\\|'},
      {begin: /<<-'\w+'$/, end: /^\s*\w+$/},
    ],
    relevance: 0,
  };
  var REGEXP = {
    begin: '(?!%})(' + hljs.RE_STARTERS_RE + '|\\n|\\b(case|if|select|unless|until|when|while)\\b)\\s*',
    keywords: 'case if select unless until when while',
    contains: [
      {
        className: 'regexp',
        contains: [hljs.BACKSLASH_ESCAPE, SUBST],
        variants: [
          {begin: '//[a-z]*', relevance: 0},
          {begin: '/(?!\\/)', end: '/[a-z]*'},
        ]
      }
    ],
    relevance: 0
  };
  var REGEXP2 = {
    className: 'regexp',
    contains: [hljs.BACKSLASH_ESCAPE, SUBST],
    variants: [
      {begin: '%r\\(', end: '\\)', contains: recursiveParen('\\(', '\\)')},
      {begin: '%r\\[', end: '\\]', contains: recursiveParen('\\[', '\\]')},
      {begin: '%r{', end: '}', contains: recursiveParen('{', '}')},
      {begin: '%r<', end: '>', contains: recursiveParen('<', '>')},
      {begin: '%r\\|', end: '\\|'},
    ],
    relevance: 0
  };
  var ATTRIBUTE = {
    className: 'meta',
    begin: '@\\[', end: '\\]',
    contains: [
      hljs.inherit(hljs.QUOTE_STRING_MODE, {className: 'meta-string'})
    ]
  };
  var CRYSTAL_DEFAULT_CONTAINS = [
    EXPANSION,
    STRING,
    Q_STRING,
    REGEXP2,
    REGEXP,
    ATTRIBUTE,
    hljs.HASH_COMMENT_MODE,
    {
      className: 'class',
      beginKeywords: 'class module struct', end: '$|;',
      illegal: /=/,
      contains: [
        hljs.HASH_COMMENT_MODE,
        hljs.inherit(hljs.TITLE_MODE, {begin: CRYSTAL_PATH_RE}),
        {begin: '<'} // relevance booster for inheritance
      ]
    },
    {
      className: 'class',
      beginKeywords: 'lib enum union', end: '$|;',
      illegal: /=/,
      contains: [
        hljs.HASH_COMMENT_MODE,
        hljs.inherit(hljs.TITLE_MODE, {begin: CRYSTAL_PATH_RE}),
      ],
      relevance: 10
    },
    {
      beginKeywords: 'annotation', end: '$|;',
      illegal: /=/,
      contains: [
        hljs.HASH_COMMENT_MODE,
        hljs.inherit(hljs.TITLE_MODE, {begin: CRYSTAL_PATH_RE}),
      ],
      relevance: 10
    },
    {
      className: 'function',
      beginKeywords: 'def', end: /\B\b/,
      contains: [
        hljs.inherit(hljs.TITLE_MODE, {
          begin: CRYSTAL_METHOD_RE,
          endsParent: true
        })
      ]
    },
    {
      className: 'function',
      beginKeywords: 'fun macro', end: /\B\b/,
      contains: [
        hljs.inherit(hljs.TITLE_MODE, {
          begin: CRYSTAL_METHOD_RE,
          endsParent: true
        })
      ],
      relevance: 5
    },
    {
      className: 'symbol',
      begin: hljs.UNDERSCORE_IDENT_RE + '(\\!|\\?)?:',
      relevance: 0
    },
    {
      className: 'symbol',
      begin: ':',
      contains: [STRING, {begin: CRYSTAL_METHOD_RE}],
      relevance: 0
    },
    {
      className: 'number',
      variants: [
        { begin: '\\b0b([01_]+)' + INT_SUFFIX },
        { begin: '\\b0o([0-7_]+)' + INT_SUFFIX },
        { begin: '\\b0x([A-Fa-f0-9_]+)' + INT_SUFFIX },
        { begin: '\\b([1-9][0-9_]*[0-9]|[0-9])(\\.[0-9][0-9_]*)?([eE]_*[-+]?[0-9_]*)?' + FLOAT_SUFFIX + '(?!_)' },
        { begin: '\\b([1-9][0-9_]*|0)' + INT_SUFFIX }
      ],
      relevance: 0
    }
  ];
  SUBST.contains = CRYSTAL_DEFAULT_CONTAINS;
  EXPANSION.contains = CRYSTAL_DEFAULT_CONTAINS.slice(1); // without EXPANSION

  return {
    aliases: ['cr'],
    lexemes: CRYSTAL_IDENT_RE,
    keywords: CRYSTAL_KEYWORDS,
    contains: CRYSTAL_DEFAULT_CONTAINS
  };
};

var cs = function(hljs) {
  var KEYWORDS = {
    keyword:
      // Normal keywords.
      'abstract as base bool break byte case catch char checked const continue decimal ' +
      'default delegate do double enum event explicit extern finally fixed float ' +
      'for foreach goto if implicit in int interface internal is lock long nameof ' +
      'object operator out override params private protected public readonly ref sbyte ' +
      'sealed short sizeof stackalloc static string struct switch this try typeof ' +
      'uint ulong unchecked unsafe ushort using virtual void volatile while ' +
      // Contextual keywords.
      'add alias ascending async await by descending dynamic equals from get global group into join ' +
      'let on orderby partial remove select set value var where yield',
    literal:
      'null false true'
  };
  var NUMBERS = {
    className: 'number',
    variants: [
      { begin: '\\b(0b[01\']+)' },
      { begin: '(-?)\\b([\\d\']+(\\.[\\d\']*)?|\\.[\\d\']+)(u|U|l|L|ul|UL|f|F|b|B)' },
      { begin: '(-?)(\\b0[xX][a-fA-F0-9\']+|(\\b[\\d\']+(\\.[\\d\']*)?|\\.[\\d\']+)([eE][-+]?[\\d\']+)?)' }
    ],
    relevance: 0
  };
  var VERBATIM_STRING = {
    className: 'string',
    begin: '@"', end: '"',
    contains: [{begin: '""'}]
  };
  var VERBATIM_STRING_NO_LF = hljs.inherit(VERBATIM_STRING, {illegal: /\n/});
  var SUBST = {
    className: 'subst',
    begin: '{', end: '}',
    keywords: KEYWORDS
  };
  var SUBST_NO_LF = hljs.inherit(SUBST, {illegal: /\n/});
  var INTERPOLATED_STRING = {
    className: 'string',
    begin: /\$"/, end: '"',
    illegal: /\n/,
    contains: [{begin: '{{'}, {begin: '}}'}, hljs.BACKSLASH_ESCAPE, SUBST_NO_LF]
  };
  var INTERPOLATED_VERBATIM_STRING = {
    className: 'string',
    begin: /\$@"/, end: '"',
    contains: [{begin: '{{'}, {begin: '}}'}, {begin: '""'}, SUBST]
  };
  var INTERPOLATED_VERBATIM_STRING_NO_LF = hljs.inherit(INTERPOLATED_VERBATIM_STRING, {
    illegal: /\n/,
    contains: [{begin: '{{'}, {begin: '}}'}, {begin: '""'}, SUBST_NO_LF]
  });
  SUBST.contains = [
    INTERPOLATED_VERBATIM_STRING,
    INTERPOLATED_STRING,
    VERBATIM_STRING,
    hljs.APOS_STRING_MODE,
    hljs.QUOTE_STRING_MODE,
    NUMBERS,
    hljs.C_BLOCK_COMMENT_MODE
  ];
  SUBST_NO_LF.contains = [
    INTERPOLATED_VERBATIM_STRING_NO_LF,
    INTERPOLATED_STRING,
    VERBATIM_STRING_NO_LF,
    hljs.APOS_STRING_MODE,
    hljs.QUOTE_STRING_MODE,
    NUMBERS,
    hljs.inherit(hljs.C_BLOCK_COMMENT_MODE, {illegal: /\n/})
  ];
  var STRING = {
    variants: [
      INTERPOLATED_VERBATIM_STRING,
      INTERPOLATED_STRING,
      VERBATIM_STRING,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE
    ]
  };

  var TYPE_IDENT_RE = hljs.IDENT_RE + '(<' + hljs.IDENT_RE + '(\\s*,\\s*' + hljs.IDENT_RE + ')*>)?(\\[\\])?';

  return {
    aliases: ['csharp', 'c#'],
    keywords: KEYWORDS,
    illegal: /::/,
    contains: [
      hljs.COMMENT(
        '///',
        '$',
        {
          returnBegin: true,
          contains: [
            {
              className: 'doctag',
              variants: [
                {
                  begin: '///', relevance: 0
                },
                {
                  begin: '<!--|-->'
                },
                {
                  begin: '</?', end: '>'
                }
              ]
            }
          ]
        }
      ),
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: 'meta',
        begin: '#', end: '$',
        keywords: {
          'meta-keyword': 'if else elif endif define undef warning error line region endregion pragma checksum'
        }
      },
      STRING,
      NUMBERS,
      {
        beginKeywords: 'class interface', end: /[{;=]/,
        illegal: /[^\s:,]/,
        contains: [
          hljs.TITLE_MODE,
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      },
      {
        beginKeywords: 'namespace', end: /[{;=]/,
        illegal: /[^\s:]/,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {begin: '[a-zA-Z](\\.?\\w)*'}),
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      },
      {
        // [Attributes("")]
        className: 'meta',
        begin: '^\\s*\\[', excludeBegin: true, end: '\\]', excludeEnd: true,
        contains: [
          {className: 'meta-string', begin: /"/, end: /"/}
        ]
      },
      {
        // Expression keywords prevent 'keyword Name(...)' from being
        // recognized as a function definition
        beginKeywords: 'new return throw await else',
        relevance: 0
      },
      {
        className: 'function',
        begin: '(' + TYPE_IDENT_RE + '\\s+)+' + hljs.IDENT_RE + '\\s*\\(', returnBegin: true,
        end: /\s*[{;=]/, excludeEnd: true,
        keywords: KEYWORDS,
        contains: [
          {
            begin: hljs.IDENT_RE + '\\s*\\(', returnBegin: true,
            contains: [hljs.TITLE_MODE],
            relevance: 0
          },
          {
            className: 'params',
            begin: /\(/, end: /\)/,
            excludeBegin: true,
            excludeEnd: true,
            keywords: KEYWORDS,
            relevance: 0,
            contains: [
              STRING,
              NUMBERS,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      }
    ]
  };
};

var csp = function(hljs) {
  return {
    case_insensitive: false,
    lexemes: '[a-zA-Z][a-zA-Z0-9_-]*',
    keywords: {
      keyword: 'base-uri child-src connect-src default-src font-src form-action' +
        ' frame-ancestors frame-src img-src media-src object-src plugin-types' +
        ' report-uri sandbox script-src style-src', 
    },
    contains: [
    {
      className: 'string',
      begin: "'", end: "'"
    },
    {
      className: 'attribute',
      begin: '^Content', end: ':', excludeEnd: true,
    },
    ]
  };
};

var css = function(hljs) {
  var IDENT_RE = '[a-zA-Z-][a-zA-Z0-9_-]*';
  var RULE = {
    begin: /[A-Z\_\.\-]+\s*:/, returnBegin: true, end: ';', endsWithParent: true,
    contains: [
      {
        className: 'attribute',
        begin: /\S/, end: ':', excludeEnd: true,
        starts: {
          endsWithParent: true, excludeEnd: true,
          contains: [
            {
              begin: /[\w-]+\(/, returnBegin: true,
              contains: [
                {
                  className: 'built_in',
                  begin: /[\w-]+/
                },
                {
                  begin: /\(/, end: /\)/,
                  contains: [
                    hljs.APOS_STRING_MODE,
                    hljs.QUOTE_STRING_MODE
                  ]
                }
              ]
            },
            hljs.CSS_NUMBER_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.APOS_STRING_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            {
              className: 'number', begin: '#[0-9A-Fa-f]+'
            },
            {
              className: 'meta', begin: '!important'
            }
          ]
        }
      }
    ]
  };

  return {
    case_insensitive: true,
    illegal: /[=\/|'\$]/,
    contains: [
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: 'selector-id', begin: /#[A-Za-z0-9_-]+/
      },
      {
        className: 'selector-class', begin: /\.[A-Za-z0-9_-]+/
      },
      {
        className: 'selector-attr',
        begin: /\[/, end: /\]/,
        illegal: '$'
      },
      {
        className: 'selector-pseudo',
        begin: /:(:)?[a-zA-Z0-9\_\-\+\(\)"'.]+/
      },
      {
        begin: '@(font-face|page)',
        lexemes: '[a-z-]+',
        keywords: 'font-face page'
      },
      {
        begin: '@', end: '[{;]', // at_rule eating first "{" is a good thing
                                 // because it doesn’t let it to be parsed as
                                 // a rule set but instead drops parser into
                                 // the default mode which is how it should be.
        illegal: /:/, // break on Less variables @var: ...
        contains: [
          {
            className: 'keyword',
            begin: /\w+/
          },
          {
            begin: /\s/, endsWithParent: true, excludeEnd: true,
            relevance: 0,
            contains: [
              hljs.APOS_STRING_MODE, hljs.QUOTE_STRING_MODE,
              hljs.CSS_NUMBER_MODE
            ]
          }
        ]
      },
      {
        className: 'selector-tag', begin: IDENT_RE,
        relevance: 0
      },
      {
        begin: '{', end: '}',
        illegal: /\S/,
        contains: [
          hljs.C_BLOCK_COMMENT_MODE,
          RULE,
        ]
      }
    ]
  };
};

var d = /**
 * Known issues:
 *
 * - invalid hex string literals will be recognized as a double quoted strings
 *   but 'x' at the beginning of string will not be matched
 *
 * - delimited string literals are not checked for matching end delimiter
 *   (not possible to do with js regexp)
 *
 * - content of token string is colored as a string (i.e. no keyword coloring inside a token string)
 *   also, content of token string is not validated to contain only valid D tokens
 *
 * - special token sequence rule is not strictly following D grammar (anything following #line
 *   up to the end of line is matched as special token sequence)
 */

function(hljs) {
  /**
   * Language keywords
   *
   * @type {Object}
   */
  var D_KEYWORDS = {
    keyword:
      'abstract alias align asm assert auto body break byte case cast catch class ' +
      'const continue debug default delete deprecated do else enum export extern final ' +
      'finally for foreach foreach_reverse|10 goto if immutable import in inout int ' +
      'interface invariant is lazy macro mixin module new nothrow out override package ' +
      'pragma private protected public pure ref return scope shared static struct ' +
      'super switch synchronized template this throw try typedef typeid typeof union ' +
      'unittest version void volatile while with __FILE__ __LINE__ __gshared|10 ' +
      '__thread __traits __DATE__ __EOF__ __TIME__ __TIMESTAMP__ __VENDOR__ __VERSION__',
    built_in:
      'bool cdouble cent cfloat char creal dchar delegate double dstring float function ' +
      'idouble ifloat ireal long real short string ubyte ucent uint ulong ushort wchar ' +
      'wstring',
    literal:
      'false null true'
  };

  /**
   * Number literal regexps
   *
   * @type {String}
   */
  var decimal_integer_re = '(0|[1-9][\\d_]*)',
    decimal_integer_nosus_re = '(0|[1-9][\\d_]*|\\d[\\d_]*|[\\d_]+?\\d)',
    binary_integer_re = '0[bB][01_]+',
    hexadecimal_digits_re = '([\\da-fA-F][\\da-fA-F_]*|_[\\da-fA-F][\\da-fA-F_]*)',
    hexadecimal_integer_re = '0[xX]' + hexadecimal_digits_re,

    decimal_exponent_re = '([eE][+-]?' + decimal_integer_nosus_re + ')',
    decimal_float_re = '(' + decimal_integer_nosus_re + '(\\.\\d*|' + decimal_exponent_re + ')|' +
                '\\d+\\.' + decimal_integer_nosus_re + decimal_integer_nosus_re + '|' +
                '\\.' + decimal_integer_re + decimal_exponent_re + '?' +
              ')',
    hexadecimal_float_re = '(0[xX](' +
                  hexadecimal_digits_re + '\\.' + hexadecimal_digits_re + '|'+
                  '\\.?' + hexadecimal_digits_re +
                 ')[pP][+-]?' + decimal_integer_nosus_re + ')',

    integer_re = '(' +
      decimal_integer_re + '|' +
      binary_integer_re  + '|' +
       hexadecimal_integer_re   +
    ')',

    float_re = '(' +
      hexadecimal_float_re + '|' +
      decimal_float_re  +
    ')';

  /**
   * Escape sequence supported in D string and character literals
   *
   * @type {String}
   */
  var escape_sequence_re = '\\\\(' +
              '[\'"\\?\\\\abfnrtv]|' +  // common escapes
              'u[\\dA-Fa-f]{4}|' +     // four hex digit unicode codepoint
              '[0-7]{1,3}|' +       // one to three octal digit ascii char code
              'x[\\dA-Fa-f]{2}|' +    // two hex digit ascii char code
              'U[\\dA-Fa-f]{8}' +      // eight hex digit unicode codepoint
              ')|' +
              '&[a-zA-Z\\d]{2,};';      // named character entity

  /**
   * D integer number literals
   *
   * @type {Object}
   */
  var D_INTEGER_MODE = {
    className: 'number',
      begin: '\\b' + integer_re + '(L|u|U|Lu|LU|uL|UL)?',
      relevance: 0
  };

  /**
   * [D_FLOAT_MODE description]
   * @type {Object}
   */
  var D_FLOAT_MODE = {
    className: 'number',
    begin: '\\b(' +
        float_re + '([fF]|L|i|[fF]i|Li)?|' +
        integer_re + '(i|[fF]i|Li)' +
      ')',
    relevance: 0
  };

  /**
   * D character literal
   *
   * @type {Object}
   */
  var D_CHARACTER_MODE = {
    className: 'string',
    begin: '\'(' + escape_sequence_re + '|.)', end: '\'',
    illegal: '.'
  };

  /**
   * D string escape sequence
   *
   * @type {Object}
   */
  var D_ESCAPE_SEQUENCE = {
    begin: escape_sequence_re,
    relevance: 0
  };

  /**
   * D double quoted string literal
   *
   * @type {Object}
   */
  var D_STRING_MODE = {
    className: 'string',
    begin: '"',
    contains: [D_ESCAPE_SEQUENCE],
    end: '"[cwd]?'
  };

  /**
   * D wysiwyg and delimited string literals
   *
   * @type {Object}
   */
  var D_WYSIWYG_DELIMITED_STRING_MODE = {
    className: 'string',
    begin: '[rq]"',
    end: '"[cwd]?',
    relevance: 5
  };

  /**
   * D alternate wysiwyg string literal
   *
   * @type {Object}
   */
  var D_ALTERNATE_WYSIWYG_STRING_MODE = {
    className: 'string',
    begin: '`',
    end: '`[cwd]?'
  };

  /**
   * D hexadecimal string literal
   *
   * @type {Object}
   */
  var D_HEX_STRING_MODE = {
    className: 'string',
    begin: 'x"[\\da-fA-F\\s\\n\\r]*"[cwd]?',
    relevance: 10
  };

  /**
   * D delimited string literal
   *
   * @type {Object}
   */
  var D_TOKEN_STRING_MODE = {
    className: 'string',
    begin: 'q"\\{',
    end: '\\}"'
  };

  /**
   * Hashbang support
   *
   * @type {Object}
   */
  var D_HASHBANG_MODE = {
    className: 'meta',
    begin: '^#!',
    end: '$',
    relevance: 5
  };

  /**
   * D special token sequence
   *
   * @type {Object}
   */
  var D_SPECIAL_TOKEN_SEQUENCE_MODE = {
    className: 'meta',
    begin: '#(line)',
    end: '$',
    relevance: 5
  };

  /**
   * D attributes
   *
   * @type {Object}
   */
  var D_ATTRIBUTE_MODE = {
    className: 'keyword',
    begin: '@[a-zA-Z_][a-zA-Z_\\d]*'
  };

  /**
   * D nesting comment
   *
   * @type {Object}
   */
  var D_NESTING_COMMENT_MODE = hljs.COMMENT(
    '\\/\\+',
    '\\+\\/',
    {
      contains: ['self'],
      relevance: 10
    }
  );

  return {
    lexemes: hljs.UNDERSCORE_IDENT_RE,
    keywords: D_KEYWORDS,
    contains: [
      hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        D_NESTING_COMMENT_MODE,
        D_HEX_STRING_MODE,
        D_STRING_MODE,
        D_WYSIWYG_DELIMITED_STRING_MODE,
        D_ALTERNATE_WYSIWYG_STRING_MODE,
        D_TOKEN_STRING_MODE,
        D_FLOAT_MODE,
        D_INTEGER_MODE,
        D_CHARACTER_MODE,
        D_HASHBANG_MODE,
        D_SPECIAL_TOKEN_SEQUENCE_MODE,
        D_ATTRIBUTE_MODE
    ]
  };
};

var markdown = function(hljs) {
  return {
    aliases: ['md', 'mkdown', 'mkd'],
    contains: [
      // highlight headers
      {
        className: 'section',
        variants: [
          { begin: '^#{1,6}', end: '$' },
          { begin: '^.+?\\n[=-]{2,}$' }
        ]
      },
      // inline html
      {
        begin: '<', end: '>',
        subLanguage: 'xml',
        relevance: 0
      },
      // lists (indicators only)
      {
        className: 'bullet',
        begin: '^([*+-]|(\\d+\\.))\\s+'
      },
      // strong segments
      {
        className: 'strong',
        begin: '[*_]{2}.+?[*_]{2}'
      },
      // emphasis segments
      {
        className: 'emphasis',
        variants: [
          { begin: '\\*.+?\\*' },
          { begin: '_.+?_'
          , relevance: 0
          }
        ]
      },
      // blockquotes
      {
        className: 'quote',
        begin: '^>\\s+', end: '$'
      },
      // code snippets
      {
        className: 'code',
        variants: [
          {
            begin: '^```\w*\s*$', end: '^```\s*$'
          },
          {
            begin: '`.+?`'
          },
          {
            begin: '^( {4}|\t)', end: '$',
            relevance: 0
          }
        ]
      },
      // horizontal rules
      {
        begin: '^[-\\*]{3,}', end: '$'
      },
      // using links - title and link
      {
        begin: '\\[.+?\\][\\(\\[].*?[\\)\\]]',
        returnBegin: true,
        contains: [
          {
            className: 'string',
            begin: '\\[', end: '\\]',
            excludeBegin: true,
            returnEnd: true,
            relevance: 0
          },
          {
            className: 'link',
            begin: '\\]\\(', end: '\\)',
            excludeBegin: true, excludeEnd: true
          },
          {
            className: 'symbol',
            begin: '\\]\\[', end: '\\]',
            excludeBegin: true, excludeEnd: true
          }
        ],
        relevance: 10
      },
      {
        begin: /^\[[^\n]+\]:/,
        returnBegin: true,
        contains: [
          {
            className: 'symbol',
            begin: /\[/, end: /\]/,
            excludeBegin: true, excludeEnd: true
          },
          {
            className: 'link',
            begin: /:\s*/, end: /$/,
            excludeBegin: true
          }
        ]
      }
    ]
  };
};

var dart = function (hljs) {
  var SUBST = {
    className: 'subst',
    variants: [
       {begin: '\\$[A-Za-z0-9_]+'}
    ],
  };

  var BRACED_SUBST = {
    className: 'subst',
    variants: [
       {begin: '\\${', end: '}'},
    ],
    keywords: 'true false null this is new super',
  };

  var STRING = {
    className: 'string',
    variants: [
      {
        begin: 'r\'\'\'', end: '\'\'\''
      },
      {
        begin: 'r"""', end: '"""'
      },
      {
        begin: 'r\'', end: '\'',
        illegal: '\\n'
      },
      {
        begin: 'r"', end: '"',
        illegal: '\\n'
      },
      {
        begin: '\'\'\'', end: '\'\'\'',
        contains: [hljs.BACKSLASH_ESCAPE, SUBST, BRACED_SUBST]
      },
      {
        begin: '"""', end: '"""',
        contains: [hljs.BACKSLASH_ESCAPE, SUBST, BRACED_SUBST]
      },
      {
        begin: '\'', end: '\'',
        illegal: '\\n',
        contains: [hljs.BACKSLASH_ESCAPE, SUBST, BRACED_SUBST]
      },
      {
        begin: '"', end: '"',
        illegal: '\\n',
        contains: [hljs.BACKSLASH_ESCAPE, SUBST, BRACED_SUBST]
      }
    ]
  };
  BRACED_SUBST.contains = [
    hljs.C_NUMBER_MODE, STRING
  ];

  var KEYWORDS = {
    keyword: 'assert async await break case catch class const continue default do else enum extends false final ' +
      'finally for if in is new null rethrow return super switch sync this throw true try var void while with yield ' +
      'abstract as dynamic export external factory get implements import library operator part set static typedef',
    built_in:
      // dart:core
      'print Comparable DateTime Duration Function Iterable Iterator List Map Match Null Object Pattern RegExp Set ' +
      'Stopwatch String StringBuffer StringSink Symbol Type Uri bool double int num ' +
      // dart:html
      'document window querySelector querySelectorAll Element ElementList'
  };

  return {
    keywords: KEYWORDS,
    contains: [
      STRING,
      hljs.COMMENT(
        '/\\*\\*',
        '\\*/',
        {
          subLanguage: 'markdown'
        }
      ),
      hljs.COMMENT(
        '///',
        '$',
        {
          subLanguage: 'markdown'
        }
      ),
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: 'class',
        beginKeywords: 'class interface', end: '{', excludeEnd: true,
        contains: [
          {
            beginKeywords: 'extends implements'
          },
          hljs.UNDERSCORE_TITLE_MODE
        ]
      },
      hljs.C_NUMBER_MODE,
      {
        className: 'meta', begin: '@[A-Za-z]+'
      },
      {
        begin: '=>' // No markup, just a relevance booster
      }
    ]
  }
};

var delphi = function(hljs) {
  var KEYWORDS =
    'exports register file shl array record property for mod while set ally label uses raise not ' +
    'stored class safecall var interface or private static exit index inherited to else stdcall ' +
    'override shr asm far resourcestring finalization packed virtual out and protected library do ' +
    'xorwrite goto near function end div overload object unit begin string on inline repeat until ' +
    'destructor write message program with read initialization except default nil if case cdecl in ' +
    'downto threadvar of try pascal const external constructor type public then implementation ' +
    'finally published procedure absolute reintroduce operator as is abstract alias assembler ' +
    'bitpacked break continue cppdecl cvar enumerator experimental platform deprecated ' +
    'unimplemented dynamic export far16 forward generic helper implements interrupt iochecks ' +
    'local name nodefault noreturn nostackframe oldfpccall otherwise saveregisters softfloat ' +
    'specialize strict unaligned varargs ';
  var COMMENT_MODES = [
    hljs.C_LINE_COMMENT_MODE,
    hljs.COMMENT(/\{/, /\}/, {relevance: 0}),
    hljs.COMMENT(/\(\*/, /\*\)/, {relevance: 10})
  ];
  var DIRECTIVE = {
    className: 'meta',
    variants: [
      {begin: /\{\$/, end: /\}/},
      {begin: /\(\*\$/, end: /\*\)/}
    ]
  };
  var STRING = {
    className: 'string',
    begin: /'/, end: /'/,
    contains: [{begin: /''/}]
  };
  var CHAR_STRING = {
    className: 'string', begin: /(#\d+)+/
  };
  var CLASS = {
    begin: hljs.IDENT_RE + '\\s*=\\s*class\\s*\\(', returnBegin: true,
    contains: [
      hljs.TITLE_MODE
    ]
  };
  var FUNCTION = {
    className: 'function',
    beginKeywords: 'function constructor destructor procedure', end: /[:;]/,
    keywords: 'function constructor|10 destructor|10 procedure|10',
    contains: [
      hljs.TITLE_MODE,
      {
        className: 'params',
        begin: /\(/, end: /\)/,
        keywords: KEYWORDS,
        contains: [STRING, CHAR_STRING, DIRECTIVE].concat(COMMENT_MODES)
      },
      DIRECTIVE
    ].concat(COMMENT_MODES)
  };
  return {
    aliases: ['dpr', 'dfm', 'pas', 'pascal', 'freepascal', 'lazarus', 'lpr', 'lfm'],
    case_insensitive: true,
    keywords: KEYWORDS,
    illegal: /"|\$[G-Zg-z]|\/\*|<\/|\|/,
    contains: [
      STRING, CHAR_STRING,
      hljs.NUMBER_MODE,
      CLASS,
      FUNCTION,
      DIRECTIVE
    ].concat(COMMENT_MODES)
  };
};

var diff = function(hljs) {
  return {
    aliases: ['patch'],
    contains: [
      {
        className: 'meta',
        relevance: 10,
        variants: [
          {begin: /^@@ +\-\d+,\d+ +\+\d+,\d+ +@@$/},
          {begin: /^\*\*\* +\d+,\d+ +\*\*\*\*$/},
          {begin: /^\-\-\- +\d+,\d+ +\-\-\-\-$/}
        ]
      },
      {
        className: 'comment',
        variants: [
          {begin: /Index: /, end: /$/},
          {begin: /={3,}/, end: /$/},
          {begin: /^\-{3}/, end: /$/},
          {begin: /^\*{3} /, end: /$/},
          {begin: /^\+{3}/, end: /$/},
          {begin: /\*{5}/, end: /\*{5}$/}
        ]
      },
      {
        className: 'addition',
        begin: '^\\+', end: '$'
      },
      {
        className: 'deletion',
        begin: '^\\-', end: '$'
      },
      {
        className: 'addition',
        begin: '^\\!', end: '$'
      }
    ]
  };
};

var django = function(hljs) {
  var FILTER = {
    begin: /\|[A-Za-z]+:?/,
    keywords: {
      name:
        'truncatewords removetags linebreaksbr yesno get_digit timesince random striptags ' +
        'filesizeformat escape linebreaks length_is ljust rjust cut urlize fix_ampersands ' +
        'title floatformat capfirst pprint divisibleby add make_list unordered_list urlencode ' +
        'timeuntil urlizetrunc wordcount stringformat linenumbers slice date dictsort ' +
        'dictsortreversed default_if_none pluralize lower join center default ' +
        'truncatewords_html upper length phone2numeric wordwrap time addslashes slugify first ' +
        'escapejs force_escape iriencode last safe safeseq truncatechars localize unlocalize ' +
        'localtime utc timezone'
    },
    contains: [
      hljs.QUOTE_STRING_MODE,
      hljs.APOS_STRING_MODE
    ]
  };

  return {
    aliases: ['jinja'],
    case_insensitive: true,
    subLanguage: 'xml',
    contains: [
      hljs.COMMENT(/\{%\s*comment\s*%}/, /\{%\s*endcomment\s*%}/),
      hljs.COMMENT(/\{#/, /#}/),
      {
        className: 'template-tag',
        begin: /\{%/, end: /%}/,
        contains: [
          {
            className: 'name',
            begin: /\w+/,
            keywords: {
              name:
                'comment endcomment load templatetag ifchanged endifchanged if endif firstof for ' +
                'endfor ifnotequal endifnotequal widthratio extends include spaceless ' +
                'endspaceless regroup ifequal endifequal ssi now with cycle url filter ' +
                'endfilter debug block endblock else autoescape endautoescape csrf_token empty elif ' +
                'endwith static trans blocktrans endblocktrans get_static_prefix get_media_prefix ' +
                'plural get_current_language language get_available_languages ' +
                'get_current_language_bidi get_language_info get_language_info_list localize ' +
                'endlocalize localtime endlocaltime timezone endtimezone get_current_timezone ' +
                'verbatim'
            },
            starts: {
              endsWithParent: true,
              keywords: 'in by as',
              contains: [FILTER],
              relevance: 0
            }
          }
        ]
      },
      {
        className: 'template-variable',
        begin: /\{\{/, end: /}}/,
        contains: [FILTER]
      }
    ]
  };
};

var dns = function(hljs) {
  return {
    aliases: ['bind', 'zone'],
    keywords: {
      keyword:
        'IN A AAAA AFSDB APL CAA CDNSKEY CDS CERT CNAME DHCID DLV DNAME DNSKEY DS HIP IPSECKEY KEY KX ' +
        'LOC MX NAPTR NS NSEC NSEC3 NSEC3PARAM PTR RRSIG RP SIG SOA SRV SSHFP TA TKEY TLSA TSIG TXT'
    },
    contains: [
      hljs.COMMENT(';', '$', {relevance: 0}),
      {
        className: 'meta',
        begin: /^\$(TTL|GENERATE|INCLUDE|ORIGIN)\b/
      },
      // IPv6
      {
        className: 'number',
        begin: '((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:)))\\b'
      },
      // IPv4
      {
        className: 'number',
        begin: '((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\b'
      },
      hljs.inherit(hljs.NUMBER_MODE, {begin: /\b\d+[dhwm]?/})
    ]
  };
};

var dockerfile = function(hljs) {
  return {
    aliases: ['docker'],
    case_insensitive: true,
    keywords: 'from maintainer expose env arg user onbuild stopsignal',
    contains: [
      hljs.HASH_COMMENT_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.NUMBER_MODE,
      {
        beginKeywords: 'run cmd entrypoint volume add copy workdir label healthcheck shell',
        starts: {
          end: /[^\\]$/,
          subLanguage: 'bash'
        }
      }
    ],
    illegal: '</'
  }
};

var dos = function(hljs) {
  var COMMENT = hljs.COMMENT(
    /^\s*@?rem\b/, /$/,
    {
      relevance: 10
    }
  );
  var LABEL = {
    className: 'symbol',
    begin: '^\\s*[A-Za-z._?][A-Za-z0-9_$#@~.?]*(:|\\s+label)',
    relevance: 0
  };
  return {
    aliases: ['bat', 'cmd'],
    case_insensitive: true,
    illegal: /\/\*/,
    keywords: {
      keyword:
        'if else goto for in do call exit not exist errorlevel defined ' +
        'equ neq lss leq gtr geq',
      built_in:
        'prn nul lpt3 lpt2 lpt1 con com4 com3 com2 com1 aux ' +
        'shift cd dir echo setlocal endlocal set pause copy ' +
        'append assoc at attrib break cacls cd chcp chdir chkdsk chkntfs cls cmd color ' +
        'comp compact convert date dir diskcomp diskcopy doskey erase fs ' +
        'find findstr format ftype graftabl help keyb label md mkdir mode more move path ' +
        'pause print popd pushd promt rd recover rem rename replace restore rmdir shift' +
        'sort start subst time title tree type ver verify vol ' +
        // winutils
        'ping net ipconfig taskkill xcopy ren del'
    },
    contains: [
      {
        className: 'variable', begin: /%%[^ ]|%[^ ]+?%|![^ ]+?!/
      },
      {
        className: 'function',
        begin: LABEL.begin, end: 'goto:eof',
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {begin: '([_a-zA-Z]\\w*\\.)*([_a-zA-Z]\\w*:)?[_a-zA-Z]\\w*'}),
          COMMENT
        ]
      },
      {
        className: 'number', begin: '\\b\\d+',
        relevance: 0
      },
      COMMENT
    ]
  };
};

var dsconfig = function(hljs) {
  var QUOTED_PROPERTY = {
    className: 'string',
    begin: /"/, end: /"/
  };
  var APOS_PROPERTY = {
    className: 'string',
    begin: /'/, end: /'/
  };
  var UNQUOTED_PROPERTY = {
    className: 'string',
    begin: '[\\w-?]+:\\w+', end: '\\W',
    relevance: 0
  };
  var VALUELESS_PROPERTY = {
    className: 'string',
    begin: '\\w+-?\\w+', end: '\\W',
    relevance: 0
  };

  return {
    keywords: 'dsconfig',
    contains: [
      {
        className: 'keyword',
        begin: '^dsconfig', end: '\\s', excludeEnd: true,
        relevance: 10
      },
      {
        className: 'built_in',
        begin: '(list|create|get|set|delete)-(\\w+)', end: '\\s', excludeEnd: true,
        illegal: '!@#$%^&*()',
        relevance: 10
      },
      {
        className: 'built_in',
        begin: '--(\\w+)', end: '\\s', excludeEnd: true
      },
      QUOTED_PROPERTY,
      APOS_PROPERTY,
      UNQUOTED_PROPERTY,
      VALUELESS_PROPERTY,
      hljs.HASH_COMMENT_MODE
    ]
  };
};

var dts = function(hljs) {
  var STRINGS = {
    className: 'string',
    variants: [
      hljs.inherit(hljs.QUOTE_STRING_MODE, { begin: '((u8?|U)|L)?"' }),
      {
        begin: '(u8?|U)?R"', end: '"',
        contains: [hljs.BACKSLASH_ESCAPE]
      },
      {
        begin: '\'\\\\?.', end: '\'',
        illegal: '.'
      }
    ]
  };

  var NUMBERS = {
    className: 'number',
    variants: [
      { begin: '\\b(\\d+(\\.\\d*)?|\\.\\d+)(u|U|l|L|ul|UL|f|F)' },
      { begin: hljs.C_NUMBER_RE }
    ],
    relevance: 0
  };

  var PREPROCESSOR = {
    className: 'meta',
    begin: '#', end: '$',
    keywords: {'meta-keyword': 'if else elif endif define undef ifdef ifndef'},
    contains: [
      {
        begin: /\\\n/, relevance: 0
      },
      {
        beginKeywords: 'include', end: '$',
        keywords: {'meta-keyword': 'include'},
        contains: [
          hljs.inherit(STRINGS, {className: 'meta-string'}),
          {
            className: 'meta-string',
            begin: '<', end: '>',
            illegal: '\\n'
          }
        ]
      },
      STRINGS,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE
    ]
  };

  var DTS_REFERENCE = {
    className: 'variable',
    begin: '\\&[a-z\\d_]*\\b'
  };

  var DTS_KEYWORD = {
    className: 'meta-keyword',
    begin: '/[a-z][a-z\\d-]*/'
  };

  var DTS_LABEL = {
    className: 'symbol',
    begin: '^\\s*[a-zA-Z_][a-zA-Z\\d_]*:'
  };

  var DTS_CELL_PROPERTY = {
    className: 'params',
    begin: '<',
    end: '>',
    contains: [
      NUMBERS,
      DTS_REFERENCE
    ]
  };

  var DTS_NODE = {
    className: 'class',
    begin: /[a-zA-Z_][a-zA-Z\d_@]*\s{/,
    end: /[{;=]/,
    returnBegin: true,
    excludeEnd: true
  };

  var DTS_ROOT_NODE = {
    className: 'class',
    begin: '/\\s*{',
    end: '};',
    relevance: 10,
    contains: [
      DTS_REFERENCE,
      DTS_KEYWORD,
      DTS_LABEL,
      DTS_NODE,
      DTS_CELL_PROPERTY,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      NUMBERS,
      STRINGS
    ]
  };

  return {
    keywords: "",
    contains: [
      DTS_ROOT_NODE,
      DTS_REFERENCE,
      DTS_KEYWORD,
      DTS_LABEL,
      DTS_NODE,
      DTS_CELL_PROPERTY,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      NUMBERS,
      STRINGS,
      PREPROCESSOR,
      {
        begin: hljs.IDENT_RE + '::',
        keywords: ""
      }
    ]
  };
};

var dust = function(hljs) {
  var EXPRESSION_KEYWORDS = 'if eq ne lt lte gt gte select default math sep';
  return {
    aliases: ['dst'],
    case_insensitive: true,
    subLanguage: 'xml',
    contains: [
      {
        className: 'template-tag',
        begin: /\{[#\/]/, end: /\}/, illegal: /;/,
        contains: [
          {
            className: 'name',
            begin: /[a-zA-Z\.-]+/,
            starts: {
              endsWithParent: true, relevance: 0,
              contains: [
                hljs.QUOTE_STRING_MODE
              ]
            }
          }
        ]
      },
      {
        className: 'template-variable',
        begin: /\{/, end: /\}/, illegal: /;/,
        keywords: EXPRESSION_KEYWORDS
      }
    ]
  };
};

var ebnf = function(hljs) {
    var commentMode = hljs.COMMENT(/\(\*/, /\*\)/);

    var nonTerminalMode = {
        className: "attribute",
        begin: /^[ ]*[a-zA-Z][a-zA-Z-]*([\s-]+[a-zA-Z][a-zA-Z]*)*/
    };

    var specialSequenceMode = {
        className: "meta",
        begin: /\?.*\?/
    };

    var ruleBodyMode = {
        begin: /=/, end: /;/,
        contains: [
            commentMode,
            specialSequenceMode,
            // terminals
            hljs.APOS_STRING_MODE, hljs.QUOTE_STRING_MODE
        ]
    };

    return {
        illegal: /\S/,
        contains: [
            commentMode,
            nonTerminalMode,
            ruleBodyMode
        ]
    };
};

var elixir = function(hljs) {
  var ELIXIR_IDENT_RE = '[a-zA-Z_][a-zA-Z0-9_.]*(\\!|\\?)?';
  var ELIXIR_METHOD_RE = '[a-zA-Z_]\\w*[!?=]?|[-+~]\\@|<<|>>|=~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~`|]|\\[\\]=?';
  var ELIXIR_KEYWORDS =
    'and false then defined module in return redo retry end for true self when ' +
    'next until do begin unless nil break not case cond alias while ensure or ' +
    'include use alias fn quote require import with|0';
  var SUBST = {
    className: 'subst',
    begin: '#\\{', end: '}',
    lexemes: ELIXIR_IDENT_RE,
    keywords: ELIXIR_KEYWORDS
  };
  var STRING = {
    className: 'string',
    contains: [hljs.BACKSLASH_ESCAPE, SUBST],
    variants: [
      {
        begin: /'/, end: /'/
      },
      {
        begin: /"/, end: /"/
      }
    ]
  };
  var FUNCTION = {
    className: 'function',
    beginKeywords: 'def defp defmacro', end: /\B\b/, // the mode is ended by the title
    contains: [
      hljs.inherit(hljs.TITLE_MODE, {
        begin: ELIXIR_IDENT_RE,
        endsParent: true
      })
    ]
  };
  var CLASS = hljs.inherit(FUNCTION, {
    className: 'class',
    beginKeywords: 'defimpl defmodule defprotocol defrecord', end: /\bdo\b|$|;/
  });
  var ELIXIR_DEFAULT_CONTAINS = [
    STRING,
    hljs.HASH_COMMENT_MODE,
    CLASS,
    FUNCTION,
    {
      begin: '::'
    },
    {
      className: 'symbol',
      begin: ':(?![\\s:])',
      contains: [STRING, {begin: ELIXIR_METHOD_RE}],
      relevance: 0
    },
    {
      className: 'symbol',
      begin: ELIXIR_IDENT_RE + ':(?!:)',
      relevance: 0
    },
    {
      className: 'number',
      begin: '(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b',
      relevance: 0
    },
    {
      className: 'variable',
      begin: '(\\$\\W)|((\\$|\\@\\@?)(\\w+))'
    },
    {
      begin: '->'
    },
    { // regexp container
      begin: '(' + hljs.RE_STARTERS_RE + ')\\s*',
      contains: [
        hljs.HASH_COMMENT_MODE,
        {
          className: 'regexp',
          illegal: '\\n',
          contains: [hljs.BACKSLASH_ESCAPE, SUBST],
          variants: [
            {
              begin: '/', end: '/[a-z]*'
            },
            {
              begin: '%r\\[', end: '\\][a-z]*'
            }
          ]
        }
      ],
      relevance: 0
    }
  ];
  SUBST.contains = ELIXIR_DEFAULT_CONTAINS;

  return {
    lexemes: ELIXIR_IDENT_RE,
    keywords: ELIXIR_KEYWORDS,
    contains: ELIXIR_DEFAULT_CONTAINS
  };
};

var elm = function(hljs) {
  var COMMENT = {
    variants: [
      hljs.COMMENT('--', '$'),
      hljs.COMMENT(
        '{-',
        '-}',
        {
          contains: ['self']
        }
      )
    ]
  };

  var CONSTRUCTOR = {
    className: 'type',
    begin: '\\b[A-Z][\\w\']*', // TODO: other constructors (built-in, infix).
    relevance: 0
  };

  var LIST = {
    begin: '\\(', end: '\\)',
    illegal: '"',
    contains: [
      {className: 'type', begin: '\\b[A-Z][\\w]*(\\((\\.\\.|,|\\w+)\\))?'},
      COMMENT
    ]
  };

  var RECORD = {
    begin: '{', end: '}',
    contains: LIST.contains
  };

  var CHARACTER = {
    className: 'string',
    begin: '\'\\\\?.', end: '\'',
    illegal: '.'
  };

  return {
    keywords:
      'let in if then else case of where module import exposing ' +
      'type alias as infix infixl infixr port effect command subscription',
    contains: [

      // Top-level constructions.

      {
        beginKeywords: 'port effect module', end: 'exposing',
        keywords: 'port effect module where command subscription exposing',
        contains: [LIST, COMMENT],
        illegal: '\\W\\.|;'
      },
      {
        begin: 'import', end: '$',
        keywords: 'import as exposing',
        contains: [LIST, COMMENT],
        illegal: '\\W\\.|;'
      },
      {
        begin: 'type', end: '$',
        keywords: 'type alias',
        contains: [CONSTRUCTOR, LIST, RECORD, COMMENT]
      },
      {
        beginKeywords: 'infix infixl infixr', end: '$',
        contains: [hljs.C_NUMBER_MODE, COMMENT]
      },
      {
        begin: 'port', end: '$',
        keywords: 'port',
        contains: [COMMENT]
      },

      // Literals and names.

      CHARACTER,
      hljs.QUOTE_STRING_MODE,
      hljs.C_NUMBER_MODE,
      CONSTRUCTOR,
      hljs.inherit(hljs.TITLE_MODE, {begin: '^[_a-z][\\w\']*'}),
      COMMENT,

      {begin: '->|<-'} // No markup, relevance booster
    ],
    illegal: /;/
  };
};

var ruby = function(hljs) {
  var RUBY_METHOD_RE = '[a-zA-Z_]\\w*[!?=]?|[-+~]\\@|<<|>>|=~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~`|]|\\[\\]=?';
  var RUBY_KEYWORDS = {
    keyword:
      'and then defined module in return redo if BEGIN retry end for self when ' +
      'next until do begin unless END rescue else break undef not super class case ' +
      'require yield alias while ensure elsif or include attr_reader attr_writer attr_accessor',
    literal:
      'true false nil'
  };
  var YARDOCTAG = {
    className: 'doctag',
    begin: '@[A-Za-z]+'
  };
  var IRB_OBJECT = {
    begin: '#<', end: '>'
  };
  var COMMENT_MODES = [
    hljs.COMMENT(
      '#',
      '$',
      {
        contains: [YARDOCTAG]
      }
    ),
    hljs.COMMENT(
      '^\\=begin',
      '^\\=end',
      {
        contains: [YARDOCTAG],
        relevance: 10
      }
    ),
    hljs.COMMENT('^__END__', '\\n$')
  ];
  var SUBST = {
    className: 'subst',
    begin: '#\\{', end: '}',
    keywords: RUBY_KEYWORDS
  };
  var STRING = {
    className: 'string',
    contains: [hljs.BACKSLASH_ESCAPE, SUBST],
    variants: [
      {begin: /'/, end: /'/},
      {begin: /"/, end: /"/},
      {begin: /`/, end: /`/},
      {begin: '%[qQwWx]?\\(', end: '\\)'},
      {begin: '%[qQwWx]?\\[', end: '\\]'},
      {begin: '%[qQwWx]?{', end: '}'},
      {begin: '%[qQwWx]?<', end: '>'},
      {begin: '%[qQwWx]?/', end: '/'},
      {begin: '%[qQwWx]?%', end: '%'},
      {begin: '%[qQwWx]?-', end: '-'},
      {begin: '%[qQwWx]?\\|', end: '\\|'},
      {
        // \B in the beginning suppresses recognition of ?-sequences where ?
        // is the last character of a preceding identifier, as in: `func?4`
        begin: /\B\?(\\\d{1,3}|\\x[A-Fa-f0-9]{1,2}|\\u[A-Fa-f0-9]{4}|\\?\S)\b/
      },
      {
        begin: /<<(-?)\w+$/, end: /^\s*\w+$/,
      }
    ]
  };
  var PARAMS = {
    className: 'params',
    begin: '\\(', end: '\\)', endsParent: true,
    keywords: RUBY_KEYWORDS
  };

  var RUBY_DEFAULT_CONTAINS = [
    STRING,
    IRB_OBJECT,
    {
      className: 'class',
      beginKeywords: 'class module', end: '$|;',
      illegal: /=/,
      contains: [
        hljs.inherit(hljs.TITLE_MODE, {begin: '[A-Za-z_]\\w*(::\\w+)*(\\?|\\!)?'}),
        {
          begin: '<\\s*',
          contains: [{
            begin: '(' + hljs.IDENT_RE + '::)?' + hljs.IDENT_RE
          }]
        }
      ].concat(COMMENT_MODES)
    },
    {
      className: 'function',
      beginKeywords: 'def', end: '$|;',
      contains: [
        hljs.inherit(hljs.TITLE_MODE, {begin: RUBY_METHOD_RE}),
        PARAMS
      ].concat(COMMENT_MODES)
    },
    {
      // swallow namespace qualifiers before symbols
      begin: hljs.IDENT_RE + '::'
    },
    {
      className: 'symbol',
      begin: hljs.UNDERSCORE_IDENT_RE + '(\\!|\\?)?:',
      relevance: 0
    },
    {
      className: 'symbol',
      begin: ':(?!\\s)',
      contains: [STRING, {begin: RUBY_METHOD_RE}],
      relevance: 0
    },
    {
      className: 'number',
      begin: '(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b',
      relevance: 0
    },
    {
      begin: '(\\$\\W)|((\\$|\\@\\@?)(\\w+))' // variables
    },
    {
      className: 'params',
      begin: /\|/, end: /\|/,
      keywords: RUBY_KEYWORDS
    },
    { // regexp container
      begin: '(' + hljs.RE_STARTERS_RE + '|unless)\\s*',
      keywords: 'unless',
      contains: [
        IRB_OBJECT,
        {
          className: 'regexp',
          contains: [hljs.BACKSLASH_ESCAPE, SUBST],
          illegal: /\n/,
          variants: [
            {begin: '/', end: '/[a-z]*'},
            {begin: '%r{', end: '}[a-z]*'},
            {begin: '%r\\(', end: '\\)[a-z]*'},
            {begin: '%r!', end: '![a-z]*'},
            {begin: '%r\\[', end: '\\][a-z]*'}
          ]
        }
      ].concat(COMMENT_MODES),
      relevance: 0
    }
  ].concat(COMMENT_MODES);

  SUBST.contains = RUBY_DEFAULT_CONTAINS;
  PARAMS.contains = RUBY_DEFAULT_CONTAINS;

  var SIMPLE_PROMPT = "[>?]>";
  var DEFAULT_PROMPT = "[\\w#]+\\(\\w+\\):\\d+:\\d+>";
  var RVM_PROMPT = "(\\w+-)?\\d+\\.\\d+\\.\\d(p\\d+)?[^>]+>";

  var IRB_DEFAULT = [
    {
      begin: /^\s*=>/,
      starts: {
        end: '$', contains: RUBY_DEFAULT_CONTAINS
      }
    },
    {
      className: 'meta',
      begin: '^('+SIMPLE_PROMPT+"|"+DEFAULT_PROMPT+'|'+RVM_PROMPT+')',
      starts: {
        end: '$', contains: RUBY_DEFAULT_CONTAINS
      }
    }
  ];

  return {
    aliases: ['rb', 'gemspec', 'podspec', 'thor', 'irb'],
    keywords: RUBY_KEYWORDS,
    illegal: /\/\*/,
    contains: COMMENT_MODES.concat(IRB_DEFAULT).concat(RUBY_DEFAULT_CONTAINS)
  };
};

var erb = function(hljs) {
  return {
    subLanguage: 'xml',
    contains: [
      hljs.COMMENT('<%#', '%>'),
      {
        begin: '<%[%=-]?', end: '[%-]?%>',
        subLanguage: 'ruby',
        excludeBegin: true,
        excludeEnd: true
      }
    ]
  };
};

var erlangRepl = function(hljs) {
  return {
    keywords: {
      built_in:
        'spawn spawn_link self',
      keyword:
        'after and andalso|10 band begin bnot bor bsl bsr bxor case catch cond div end fun if ' +
        'let not of or orelse|10 query receive rem try when xor'
    },
    contains: [
      {
        className: 'meta', begin: '^[0-9]+> ',
        relevance: 10
      },
      hljs.COMMENT('%', '$'),
      {
        className: 'number',
        begin: '\\b(\\d+#[a-fA-F0-9]+|\\d+(\\.\\d+)?([eE][-+]?\\d+)?)',
        relevance: 0
      },
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      {
        begin: '\\?(::)?([A-Z]\\w*(::)?)+'
      },
      {
        begin: '->'
      },
      {
        begin: 'ok'
      },
      {
        begin: '!'
      },
      {
        begin: '(\\b[a-z\'][a-zA-Z0-9_\']*:[a-z\'][a-zA-Z0-9_\']*)|(\\b[a-z\'][a-zA-Z0-9_\']*)',
        relevance: 0
      },
      {
        begin: '[A-Z][a-zA-Z0-9_\']*',
        relevance: 0
      }
    ]
  };
};

var erlang = function(hljs) {
  var BASIC_ATOM_RE = '[a-z\'][a-zA-Z0-9_\']*';
  var FUNCTION_NAME_RE = '(' + BASIC_ATOM_RE + ':' + BASIC_ATOM_RE + '|' + BASIC_ATOM_RE + ')';
  var ERLANG_RESERVED = {
    keyword:
      'after and andalso|10 band begin bnot bor bsl bzr bxor case catch cond div end fun if ' +
      'let not of orelse|10 query receive rem try when xor',
    literal:
      'false true'
  };

  var COMMENT = hljs.COMMENT('%', '$');
  var NUMBER = {
    className: 'number',
    begin: '\\b(\\d+#[a-fA-F0-9]+|\\d+(\\.\\d+)?([eE][-+]?\\d+)?)',
    relevance: 0
  };
  var NAMED_FUN = {
    begin: 'fun\\s+' + BASIC_ATOM_RE + '/\\d+'
  };
  var FUNCTION_CALL = {
    begin: FUNCTION_NAME_RE + '\\(', end: '\\)',
    returnBegin: true,
    relevance: 0,
    contains: [
      {
        begin: FUNCTION_NAME_RE, relevance: 0
      },
      {
        begin: '\\(', end: '\\)', endsWithParent: true,
        returnEnd: true,
        relevance: 0
        // "contains" defined later
      }
    ]
  };
  var TUPLE = {
    begin: '{', end: '}',
    relevance: 0
    // "contains" defined later
  };
  var VAR1 = {
    begin: '\\b_([A-Z][A-Za-z0-9_]*)?',
    relevance: 0
  };
  var VAR2 = {
    begin: '[A-Z][a-zA-Z0-9_]*',
    relevance: 0
  };
  var RECORD_ACCESS = {
    begin: '#' + hljs.UNDERSCORE_IDENT_RE,
    relevance: 0,
    returnBegin: true,
    contains: [
      {
        begin: '#' + hljs.UNDERSCORE_IDENT_RE,
        relevance: 0
      },
      {
        begin: '{', end: '}',
        relevance: 0
        // "contains" defined later
      }
    ]
  };

  var BLOCK_STATEMENTS = {
    beginKeywords: 'fun receive if try case', end: 'end',
    keywords: ERLANG_RESERVED
  };
  BLOCK_STATEMENTS.contains = [
    COMMENT,
    NAMED_FUN,
    hljs.inherit(hljs.APOS_STRING_MODE, {className: ''}),
    BLOCK_STATEMENTS,
    FUNCTION_CALL,
    hljs.QUOTE_STRING_MODE,
    NUMBER,
    TUPLE,
    VAR1, VAR2,
    RECORD_ACCESS
  ];

  var BASIC_MODES = [
    COMMENT,
    NAMED_FUN,
    BLOCK_STATEMENTS,
    FUNCTION_CALL,
    hljs.QUOTE_STRING_MODE,
    NUMBER,
    TUPLE,
    VAR1, VAR2,
    RECORD_ACCESS
  ];
  FUNCTION_CALL.contains[1].contains = BASIC_MODES;
  TUPLE.contains = BASIC_MODES;
  RECORD_ACCESS.contains[1].contains = BASIC_MODES;

  var PARAMS = {
    className: 'params',
    begin: '\\(', end: '\\)',
    contains: BASIC_MODES
  };
  return {
    aliases: ['erl'],
    keywords: ERLANG_RESERVED,
    illegal: '(</|\\*=|\\+=|-=|/\\*|\\*/|\\(\\*|\\*\\))',
    contains: [
      {
        className: 'function',
        begin: '^' + BASIC_ATOM_RE + '\\s*\\(', end: '->',
        returnBegin: true,
        illegal: '\\(|#|//|/\\*|\\\\|:|;',
        contains: [
          PARAMS,
          hljs.inherit(hljs.TITLE_MODE, {begin: BASIC_ATOM_RE})
        ],
        starts: {
          end: ';|\\.',
          keywords: ERLANG_RESERVED,
          contains: BASIC_MODES
        }
      },
      COMMENT,
      {
        begin: '^-', end: '\\.',
        relevance: 0,
        excludeEnd: true,
        returnBegin: true,
        lexemes: '-' + hljs.IDENT_RE,
        keywords:
          '-module -record -undef -export -ifdef -ifndef -author -copyright -doc -vsn ' +
          '-import -include -include_lib -compile -define -else -endif -file -behaviour ' +
          '-behavior -spec',
        contains: [PARAMS]
      },
      NUMBER,
      hljs.QUOTE_STRING_MODE,
      RECORD_ACCESS,
      VAR1, VAR2,
      TUPLE,
      {begin: /\.$/} // relevance booster
    ]
  };
};

var excel = function(hljs) {
  return {
    aliases: ['xlsx', 'xls'],
    case_insensitive: true,
    lexemes: /[a-zA-Z][\w\.]*/,
    // built-in functions imported from https://web.archive.org/web/20160513042710/https://support.office.com/en-us/article/Excel-functions-alphabetical-b3944572-255d-4efb-bb96-c6d90033e188
    keywords: {
        built_in: 'ABS ACCRINT ACCRINTM ACOS ACOSH ACOT ACOTH AGGREGATE ADDRESS AMORDEGRC AMORLINC AND ARABIC AREAS ASC ASIN ASINH ATAN ATAN2 ATANH AVEDEV AVERAGE AVERAGEA AVERAGEIF AVERAGEIFS BAHTTEXT BASE BESSELI BESSELJ BESSELK BESSELY BETADIST BETA.DIST BETAINV BETA.INV BIN2DEC BIN2HEX BIN2OCT BINOMDIST BINOM.DIST BINOM.DIST.RANGE BINOM.INV BITAND BITLSHIFT BITOR BITRSHIFT BITXOR CALL CEILING CEILING.MATH CEILING.PRECISE CELL CHAR CHIDIST CHIINV CHITEST CHISQ.DIST CHISQ.DIST.RT CHISQ.INV CHISQ.INV.RT CHISQ.TEST CHOOSE CLEAN CODE COLUMN COLUMNS COMBIN COMBINA COMPLEX CONCAT CONCATENATE CONFIDENCE CONFIDENCE.NORM CONFIDENCE.T CONVERT CORREL COS COSH COT COTH COUNT COUNTA COUNTBLANK COUNTIF COUNTIFS COUPDAYBS COUPDAYS COUPDAYSNC COUPNCD COUPNUM COUPPCD COVAR COVARIANCE.P COVARIANCE.S CRITBINOM CSC CSCH CUBEKPIMEMBER CUBEMEMBER CUBEMEMBERPROPERTY CUBERANKEDMEMBER CUBESET CUBESETCOUNT CUBEVALUE CUMIPMT CUMPRINC DATE DATEDIF DATEVALUE DAVERAGE DAY DAYS DAYS360 DB DBCS DCOUNT DCOUNTA DDB DEC2BIN DEC2HEX DEC2OCT DECIMAL DEGREES DELTA DEVSQ DGET DISC DMAX DMIN DOLLAR DOLLARDE DOLLARFR DPRODUCT DSTDEV DSTDEVP DSUM DURATION DVAR DVARP EDATE EFFECT ENCODEURL EOMONTH ERF ERF.PRECISE ERFC ERFC.PRECISE ERROR.TYPE EUROCONVERT EVEN EXACT EXP EXPON.DIST EXPONDIST FACT FACTDOUBLE FALSE|0 F.DIST FDIST F.DIST.RT FILTERXML FIND FINDB F.INV F.INV.RT FINV FISHER FISHERINV FIXED FLOOR FLOOR.MATH FLOOR.PRECISE FORECAST FORECAST.ETS FORECAST.ETS.CONFINT FORECAST.ETS.SEASONALITY FORECAST.ETS.STAT FORECAST.LINEAR FORMULATEXT FREQUENCY F.TEST FTEST FV FVSCHEDULE GAMMA GAMMA.DIST GAMMADIST GAMMA.INV GAMMAINV GAMMALN GAMMALN.PRECISE GAUSS GCD GEOMEAN GESTEP GETPIVOTDATA GROWTH HARMEAN HEX2BIN HEX2DEC HEX2OCT HLOOKUP HOUR HYPERLINK HYPGEOM.DIST HYPGEOMDIST IF|0 IFERROR IFNA IFS IMABS IMAGINARY IMARGUMENT IMCONJUGATE IMCOS IMCOSH IMCOT IMCSC IMCSCH IMDIV IMEXP IMLN IMLOG10 IMLOG2 IMPOWER IMPRODUCT IMREAL IMSEC IMSECH IMSIN IMSINH IMSQRT IMSUB IMSUM IMTAN INDEX INDIRECT INFO INT INTERCEPT INTRATE IPMT IRR ISBLANK ISERR ISERROR ISEVEN ISFORMULA ISLOGICAL ISNA ISNONTEXT ISNUMBER ISODD ISREF ISTEXT ISO.CEILING ISOWEEKNUM ISPMT JIS KURT LARGE LCM LEFT LEFTB LEN LENB LINEST LN LOG LOG10 LOGEST LOGINV LOGNORM.DIST LOGNORMDIST LOGNORM.INV LOOKUP LOWER MATCH MAX MAXA MAXIFS MDETERM MDURATION MEDIAN MID MIDBs MIN MINIFS MINA MINUTE MINVERSE MIRR MMULT MOD MODE MODE.MULT MODE.SNGL MONTH MROUND MULTINOMIAL MUNIT N NA NEGBINOM.DIST NEGBINOMDIST NETWORKDAYS NETWORKDAYS.INTL NOMINAL NORM.DIST NORMDIST NORMINV NORM.INV NORM.S.DIST NORMSDIST NORM.S.INV NORMSINV NOT NOW NPER NPV NUMBERVALUE OCT2BIN OCT2DEC OCT2HEX ODD ODDFPRICE ODDFYIELD ODDLPRICE ODDLYIELD OFFSET OR PDURATION PEARSON PERCENTILE.EXC PERCENTILE.INC PERCENTILE PERCENTRANK.EXC PERCENTRANK.INC PERCENTRANK PERMUT PERMUTATIONA PHI PHONETIC PI PMT POISSON.DIST POISSON POWER PPMT PRICE PRICEDISC PRICEMAT PROB PRODUCT PROPER PV QUARTILE QUARTILE.EXC QUARTILE.INC QUOTIENT RADIANS RAND RANDBETWEEN RANK.AVG RANK.EQ RANK RATE RECEIVED REGISTER.ID REPLACE REPLACEB REPT RIGHT RIGHTB ROMAN ROUND ROUNDDOWN ROUNDUP ROW ROWS RRI RSQ RTD SEARCH SEARCHB SEC SECH SECOND SERIESSUM SHEET SHEETS SIGN SIN SINH SKEW SKEW.P SLN SLOPE SMALL SQL.REQUEST SQRT SQRTPI STANDARDIZE STDEV STDEV.P STDEV.S STDEVA STDEVP STDEVPA STEYX SUBSTITUTE SUBTOTAL SUM SUMIF SUMIFS SUMPRODUCT SUMSQ SUMX2MY2 SUMX2PY2 SUMXMY2 SWITCH SYD T TAN TANH TBILLEQ TBILLPRICE TBILLYIELD T.DIST T.DIST.2T T.DIST.RT TDIST TEXT TEXTJOIN TIME TIMEVALUE T.INV T.INV.2T TINV TODAY TRANSPOSE TREND TRIM TRIMMEAN TRUE|0 TRUNC T.TEST TTEST TYPE UNICHAR UNICODE UPPER VALUE VAR VAR.P VAR.S VARA VARP VARPA VDB VLOOKUP WEBSERVICE WEEKDAY WEEKNUM WEIBULL WEIBULL.DIST WORKDAY WORKDAY.INTL XIRR XNPV XOR YEAR YEARFRAC YIELD YIELDDISC YIELDMAT Z.TEST ZTEST'
    },
    contains: [
      {
        /* matches a beginning equal sign found in Excel formula examples */ 
        begin: /^=/,
        end: /[^=]/, returnEnd: true, illegal: /=/, /* only allow single equal sign at front of line */
        relevance: 10
      },
      /* technically, there can be more than 2 letters in column names, but this prevents conflict with some keywords */
      {
        /* matches a reference to a single cell */
        className: 'symbol',
        begin: /\b[A-Z]{1,2}\d+\b/,
        end: /[^\d]/, excludeEnd: true,
        relevance: 0
      },
      {
        /* matches a reference to a range of cells */
        className: 'symbol',
        begin: /[A-Z]{0,2}\d*:[A-Z]{0,2}\d*/,
        relevance: 0
      },
      hljs.BACKSLASH_ESCAPE,
      hljs.QUOTE_STRING_MODE,
      {
        className: 'number',
        begin: hljs.NUMBER_RE + '(%)?',
        relevance: 0
      },
      /* Excel formula comments are done by putting the comment in a function call to N() */
      hljs.COMMENT(/\bN\(/,/\)/,
      {
        excludeBegin: true,
        excludeEnd: true,
        illegal: /\n/
      })
    ]
  };
};

var fix = function(hljs) {
  return {
    contains: [
    {
      begin: /[^\u2401\u0001]+/,
      end: /[\u2401\u0001]/,
      excludeEnd: true,
      returnBegin: true,
      returnEnd: false,
      contains: [
      {
        begin: /([^\u2401\u0001=]+)/,
        end: /=([^\u2401\u0001=]+)/,
        returnEnd: true,
        returnBegin: false,
        className: 'attr'
      },
      {
        begin: /=/,
        end: /([\u2401\u0001])/,
        excludeEnd: true,
        excludeBegin: true,
        className: 'string'
      }]
    }],
    case_insensitive: true
  };
};

var flix = function (hljs) {

    var CHAR = {
        className: 'string',
        begin: /'(.|\\[xXuU][a-zA-Z0-9]+)'/
    };

    var STRING = {
        className: 'string',
        variants: [
            {
                begin: '"', end: '"'
            }
        ]
    };

    var NAME = {
        className: 'title',
        begin: /[^0-9\n\t "'(),.`{}\[\]:;][^\n\t "'(),.`{}\[\]:;]+|[^0-9\n\t "'(),.`{}\[\]:;=]/
    };

    var METHOD = {
        className: 'function',
        beginKeywords: 'def',
        end: /[:={\[(\n;]/,
        excludeEnd: true,
        contains: [NAME]
    };

    return {
        keywords: {
            literal: 'true false',
            keyword: 'case class def else enum if impl import in lat rel index let match namespace switch type yield with'
        },
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            CHAR,
            STRING,
            METHOD,
            hljs.C_NUMBER_MODE
        ]
    };
};

var fortran = function(hljs) {
  var PARAMS = {
    className: 'params',
    begin: '\\(', end: '\\)'
  };

  var F_KEYWORDS = {
    literal: '.False. .True.',
    keyword: 'kind do while private call intrinsic where elsewhere ' +
      'type endtype endmodule endselect endinterface end enddo endif if forall endforall only contains default return stop then ' +
      'public subroutine|10 function program .and. .or. .not. .le. .eq. .ge. .gt. .lt. ' +
      'goto save else use module select case ' +
      'access blank direct exist file fmt form formatted iostat name named nextrec number opened rec recl sequential status unformatted unit ' +
      'continue format pause cycle exit ' +
      'c_null_char c_alert c_backspace c_form_feed flush wait decimal round iomsg ' +
      'synchronous nopass non_overridable pass protected volatile abstract extends import ' +
      'non_intrinsic value deferred generic final enumerator class associate bind enum ' +
      'c_int c_short c_long c_long_long c_signed_char c_size_t c_int8_t c_int16_t c_int32_t c_int64_t c_int_least8_t c_int_least16_t ' +
      'c_int_least32_t c_int_least64_t c_int_fast8_t c_int_fast16_t c_int_fast32_t c_int_fast64_t c_intmax_t C_intptr_t c_float c_double ' +
      'c_long_double c_float_complex c_double_complex c_long_double_complex c_bool c_char c_null_ptr c_null_funptr ' +
      'c_new_line c_carriage_return c_horizontal_tab c_vertical_tab iso_c_binding c_loc c_funloc c_associated  c_f_pointer ' +
      'c_ptr c_funptr iso_fortran_env character_storage_size error_unit file_storage_size input_unit iostat_end iostat_eor ' +
      'numeric_storage_size output_unit c_f_procpointer ieee_arithmetic ieee_support_underflow_control ' +
      'ieee_get_underflow_mode ieee_set_underflow_mode newunit contiguous recursive ' +
      'pad position action delim readwrite eor advance nml interface procedure namelist include sequence elemental pure ' +
      'integer real character complex logical dimension allocatable|10 parameter ' +
      'external implicit|10 none double precision assign intent optional pointer ' +
      'target in out common equivalence data',
    built_in: 'alog alog10 amax0 amax1 amin0 amin1 amod cabs ccos cexp clog csin csqrt dabs dacos dasin datan datan2 dcos dcosh ddim dexp dint ' +
      'dlog dlog10 dmax1 dmin1 dmod dnint dsign dsin dsinh dsqrt dtan dtanh float iabs idim idint idnint ifix isign max0 max1 min0 min1 sngl ' +
      'algama cdabs cdcos cdexp cdlog cdsin cdsqrt cqabs cqcos cqexp cqlog cqsin cqsqrt dcmplx dconjg derf derfc dfloat dgamma dimag dlgama ' +
      'iqint qabs qacos qasin qatan qatan2 qcmplx qconjg qcos qcosh qdim qerf qerfc qexp qgamma qimag qlgama qlog qlog10 qmax1 qmin1 qmod ' +
      'qnint qsign qsin qsinh qsqrt qtan qtanh abs acos aimag aint anint asin atan atan2 char cmplx conjg cos cosh exp ichar index int log ' +
      'log10 max min nint sign sin sinh sqrt tan tanh print write dim lge lgt lle llt mod nullify allocate deallocate ' +
      'adjustl adjustr all allocated any associated bit_size btest ceiling count cshift date_and_time digits dot_product ' +
      'eoshift epsilon exponent floor fraction huge iand ibclr ibits ibset ieor ior ishft ishftc lbound len_trim matmul ' +
      'maxexponent maxloc maxval merge minexponent minloc minval modulo mvbits nearest pack present product ' +
      'radix random_number random_seed range repeat reshape rrspacing scale scan selected_int_kind selected_real_kind ' +
      'set_exponent shape size spacing spread sum system_clock tiny transpose trim ubound unpack verify achar iachar transfer ' +
      'dble entry dprod cpu_time command_argument_count get_command get_command_argument get_environment_variable is_iostat_end ' +
      'ieee_arithmetic ieee_support_underflow_control ieee_get_underflow_mode ieee_set_underflow_mode ' +
      'is_iostat_eor move_alloc new_line selected_char_kind same_type_as extends_type_of'  +
      'acosh asinh atanh bessel_j0 bessel_j1 bessel_jn bessel_y0 bessel_y1 bessel_yn erf erfc erfc_scaled gamma log_gamma hypot norm2 ' +
      'atomic_define atomic_ref execute_command_line leadz trailz storage_size merge_bits ' +
      'bge bgt ble blt dshiftl dshiftr findloc iall iany iparity image_index lcobound ucobound maskl maskr ' +
      'num_images parity popcnt poppar shifta shiftl shiftr this_image'
  };
  return {
    case_insensitive: true,
    aliases: ['f90', 'f95'],
    keywords: F_KEYWORDS,
    illegal: /\/\*/,
    contains: [
      hljs.inherit(hljs.APOS_STRING_MODE, {className: 'string', relevance: 0}),
      hljs.inherit(hljs.QUOTE_STRING_MODE, {className: 'string', relevance: 0}),
      {
        className: 'function',
        beginKeywords: 'subroutine function program',
        illegal: '[${=\\n]',
        contains: [hljs.UNDERSCORE_TITLE_MODE, PARAMS]
      },
      hljs.COMMENT('!', '$', {relevance: 0}),
      {
        className: 'number',
        begin: '(?=\\b|\\+|\\-|\\.)(?=\\.\\d|\\d)(?:\\d+)?(?:\\.?\\d*)(?:[de][+-]?\\d+)?\\b\\.?',
        relevance: 0
      }
    ]
  };
};

var fsharp = function(hljs) {
  var TYPEPARAM = {
    begin: '<', end: '>',
    contains: [
      hljs.inherit(hljs.TITLE_MODE, {begin: /'[a-zA-Z0-9_]+/})
    ]
  };

  return {
    aliases: ['fs'],
    keywords:
      'abstract and as assert base begin class default delegate do done ' +
      'downcast downto elif else end exception extern false finally for ' +
      'fun function global if in inherit inline interface internal lazy let ' +
      'match member module mutable namespace new null of open or ' +
      'override private public rec return sig static struct then to ' +
      'true try type upcast use val void when while with yield',
    illegal: /\/\*/,
    contains: [
      {
        // monad builder keywords (matches before non-bang kws)
        className: 'keyword',
        begin: /\b(yield|return|let|do)!/
      },
      {
        className: 'string',
        begin: '@"', end: '"',
        contains: [{begin: '""'}]
      },
      {
        className: 'string',
        begin: '"""', end: '"""'
      },
      hljs.COMMENT('\\(\\*', '\\*\\)'),
      {
        className: 'class',
        beginKeywords: 'type', end: '\\(|=|$', excludeEnd: true,
        contains: [
          hljs.UNDERSCORE_TITLE_MODE,
          TYPEPARAM
        ]
      },
      {
        className: 'meta',
        begin: '\\[<', end: '>\\]',
        relevance: 10
      },
      {
        className: 'symbol',
        begin: '\\B(\'[A-Za-z])\\b',
        contains: [hljs.BACKSLASH_ESCAPE]
      },
      hljs.C_LINE_COMMENT_MODE,
      hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null}),
      hljs.C_NUMBER_MODE
    ]
  };
};

var gams = function (hljs) {
  var KEYWORDS = {
    'keyword':
      'abort acronym acronyms alias all and assign binary card diag display ' +
      'else eq file files for free ge gt if integer le loop lt maximizing ' +
      'minimizing model models ne negative no not option options or ord ' +
      'positive prod put putpage puttl repeat sameas semicont semiint smax ' +
      'smin solve sos1 sos2 sum system table then until using while xor yes',
    'literal': 'eps inf na',
    'built-in':
      'abs arccos arcsin arctan arctan2 Beta betaReg binomial ceil centropy ' +
      'cos cosh cvPower div div0 eDist entropy errorf execSeed exp fact ' +
      'floor frac gamma gammaReg log logBeta logGamma log10 log2 mapVal max ' +
      'min mod ncpCM ncpF ncpVUpow ncpVUsin normal pi poly power ' +
      'randBinomial randLinear randTriangle round rPower sigmoid sign ' +
      'signPower sin sinh slexp sllog10 slrec sqexp sqlog10 sqr sqrec sqrt ' +
      'tan tanh trunc uniform uniformInt vcPower bool_and bool_eqv bool_imp ' +
      'bool_not bool_or bool_xor ifThen rel_eq rel_ge rel_gt rel_le rel_lt ' +
      'rel_ne gday gdow ghour gleap gmillisec gminute gmonth gsecond gyear ' +
      'jdate jnow jstart jtime errorLevel execError gamsRelease gamsVersion ' +
      'handleCollect handleDelete handleStatus handleSubmit heapFree ' +
      'heapLimit heapSize jobHandle jobKill jobStatus jobTerminate ' +
      'licenseLevel licenseStatus maxExecError sleep timeClose timeComp ' +
      'timeElapsed timeExec timeStart'
  };
  var PARAMS = {
    className: 'params',
    begin: /\(/, end: /\)/,
    excludeBegin: true,
    excludeEnd: true,
  };
  var SYMBOLS = {
    className: 'symbol',
    variants: [
      {begin: /\=[lgenxc]=/},
      {begin: /\$/},
    ]
  };
  var QSTR = { // One-line quoted comment string
    className: 'comment',
    variants: [
      {begin: '\'', end: '\''},
      {begin: '"', end: '"'},
    ],
    illegal: '\\n',
    contains: [hljs.BACKSLASH_ESCAPE]
  };
  var ASSIGNMENT = {
    begin: '/',
    end: '/',
    keywords: KEYWORDS,
    contains: [
      QSTR,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.APOS_STRING_MODE,
      hljs.C_NUMBER_MODE,
    ],
  };
  var DESCTEXT = { // Parameter/set/variable description text
    begin: /[a-z][a-z0-9_]*(\([a-z0-9_, ]*\))?[ \t]+/,
    excludeBegin: true,
    end: '$',
    endsWithParent: true,
    contains: [
      QSTR,
      ASSIGNMENT,
      {
        className: 'comment',
        begin: /([ ]*[a-z0-9&#*=?@>\\<:\-,()$\[\]_.{}!+%^]+)+/,
        relevance: 0
      },
    ],
  };

  return {
    aliases: ['gms'],
    case_insensitive: true,
    keywords: KEYWORDS,
    contains: [
      hljs.COMMENT(/^\$ontext/, /^\$offtext/),
      {
        className: 'meta',
        begin: '^\\$[a-z0-9]+',
        end: '$',
        returnBegin: true,
        contains: [
          {
            className: 'meta-keyword',
            begin: '^\\$[a-z0-9]+',
          }
        ]
      },
      hljs.COMMENT('^\\*', '$'),
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.APOS_STRING_MODE,
      // Declarations
      {
        beginKeywords:
          'set sets parameter parameters variable variables ' +
          'scalar scalars equation equations',
        end: ';',
        contains: [
          hljs.COMMENT('^\\*', '$'),
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.APOS_STRING_MODE,
          ASSIGNMENT,
          DESCTEXT,
        ]
      },
      { // table environment
        beginKeywords: 'table',
        end: ';',
        returnBegin: true,
        contains: [
          { // table header row
            beginKeywords: 'table',
            end: '$',
            contains: [DESCTEXT],
          },
          hljs.COMMENT('^\\*', '$'),
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.APOS_STRING_MODE,
          hljs.C_NUMBER_MODE,
          // Table does not contain DESCTEXT or ASSIGNMENT
        ]
      },
      // Function definitions
      {
        className: 'function',
        begin: /^[a-z][a-z0-9_,\-+' ()$]+\.{2}/,
        returnBegin: true,
        contains: [
              { // Function title
                className: 'title',
                begin: /^[a-z0-9_]+/,
              },
              PARAMS,
              SYMBOLS,
            ],
      },
      hljs.C_NUMBER_MODE,
      SYMBOLS,
    ]
  };
};

var gauss = function(hljs) {
  var KEYWORDS = {
    keyword:  'bool break call callexe checkinterrupt clear clearg closeall cls comlog compile ' +
              'continue create debug declare delete disable dlibrary dllcall do dos ed edit else ' +
              'elseif enable end endfor endif endp endo errorlog errorlogat expr external fn ' +
              'for format goto gosub graph if keyword let lib library line load loadarray loadexe ' +
              'loadf loadk loadm loadp loads loadx local locate loopnextindex lprint lpwidth lshow ' +
              'matrix msym ndpclex new open output outwidth plot plotsym pop prcsn print ' +
              'printdos proc push retp return rndcon rndmod rndmult rndseed run save saveall screen ' +
              'scroll setarray show sparse stop string struct system trace trap threadfor ' +
              'threadendfor threadbegin threadjoin threadstat threadend until use while winprint ' +
              'ne ge le gt lt and xor or not eq eqv',
    built_in: 'abs acf aconcat aeye amax amean AmericanBinomCall AmericanBinomCall_Greeks AmericanBinomCall_ImpVol ' +
              'AmericanBinomPut AmericanBinomPut_Greeks AmericanBinomPut_ImpVol AmericanBSCall AmericanBSCall_Greeks ' +
              'AmericanBSCall_ImpVol AmericanBSPut AmericanBSPut_Greeks AmericanBSPut_ImpVol amin amult annotationGetDefaults ' +
              'annotationSetBkd annotationSetFont annotationSetLineColor annotationSetLineStyle annotationSetLineThickness ' +
              'annualTradingDays arccos arcsin areshape arrayalloc arrayindex arrayinit arraytomat asciiload asclabel astd ' +
              'astds asum atan atan2 atranspose axmargin balance band bandchol bandcholsol bandltsol bandrv bandsolpd bar ' +
              'base10 begwind besselj bessely beta box boxcox cdfBeta cdfBetaInv cdfBinomial cdfBinomialInv cdfBvn cdfBvn2 ' +
              'cdfBvn2e cdfCauchy cdfCauchyInv cdfChic cdfChii cdfChinc cdfChincInv cdfExp cdfExpInv cdfFc cdfFnc cdfFncInv ' +
              'cdfGam cdfGenPareto cdfHyperGeo cdfLaplace cdfLaplaceInv cdfLogistic cdfLogisticInv cdfmControlCreate cdfMvn ' +
              'cdfMvn2e cdfMvnce cdfMvne cdfMvt2e cdfMvtce cdfMvte cdfN cdfN2 cdfNc cdfNegBinomial cdfNegBinomialInv cdfNi ' +
              'cdfPoisson cdfPoissonInv cdfRayleigh cdfRayleighInv cdfTc cdfTci cdfTnc cdfTvn cdfWeibull cdfWeibullInv cdir ' +
              'ceil ChangeDir chdir chiBarSquare chol choldn cholsol cholup chrs close code cols colsf combinate combinated ' +
              'complex con cond conj cons ConScore contour conv convertsatostr convertstrtosa corrm corrms corrvc corrx corrxs ' +
              'cos cosh counts countwts crossprd crout croutp csrcol csrlin csvReadM csvReadSA cumprodc cumsumc curve cvtos ' +
              'datacreate datacreatecomplex datalist dataload dataloop dataopen datasave date datestr datestring datestrymd ' +
              'dayinyr dayofweek dbAddDatabase dbClose dbCommit dbCreateQuery dbExecQuery dbGetConnectOptions dbGetDatabaseName ' +
              'dbGetDriverName dbGetDrivers dbGetHostName dbGetLastErrorNum dbGetLastErrorText dbGetNumericalPrecPolicy ' +
              'dbGetPassword dbGetPort dbGetTableHeaders dbGetTables dbGetUserName dbHasFeature dbIsDriverAvailable dbIsOpen ' +
              'dbIsOpenError dbOpen dbQueryBindValue dbQueryClear dbQueryCols dbQueryExecPrepared dbQueryFetchAllM dbQueryFetchAllSA ' +
              'dbQueryFetchOneM dbQueryFetchOneSA dbQueryFinish dbQueryGetBoundValue dbQueryGetBoundValues dbQueryGetField ' +
              'dbQueryGetLastErrorNum dbQueryGetLastErrorText dbQueryGetLastInsertID dbQueryGetLastQuery dbQueryGetPosition ' +
              'dbQueryIsActive dbQueryIsForwardOnly dbQueryIsNull dbQueryIsSelect dbQueryIsValid dbQueryPrepare dbQueryRows ' +
              'dbQuerySeek dbQuerySeekFirst dbQuerySeekLast dbQuerySeekNext dbQuerySeekPrevious dbQuerySetForwardOnly ' +
              'dbRemoveDatabase dbRollback dbSetConnectOptions dbSetDatabaseName dbSetHostName dbSetNumericalPrecPolicy ' +
              'dbSetPort dbSetUserName dbTransaction DeleteFile delif delrows denseToSp denseToSpRE denToZero design det detl ' +
              'dfft dffti diag diagrv digamma doswin DOSWinCloseall DOSWinOpen dotfeq dotfeqmt dotfge dotfgemt dotfgt dotfgtmt ' +
              'dotfle dotflemt dotflt dotfltmt dotfne dotfnemt draw drop dsCreate dstat dstatmt dstatmtControlCreate dtdate dtday ' +
              'dttime dttodtv dttostr dttoutc dtvnormal dtvtodt dtvtoutc dummy dummybr dummydn eig eigh eighv eigv elapsedTradingDays ' +
              'endwind envget eof eqSolve eqSolvemt eqSolvemtControlCreate eqSolvemtOutCreate eqSolveset erf erfc erfccplx erfcplx error ' +
              'etdays ethsec etstr EuropeanBinomCall EuropeanBinomCall_Greeks EuropeanBinomCall_ImpVol EuropeanBinomPut ' +
              'EuropeanBinomPut_Greeks EuropeanBinomPut_ImpVol EuropeanBSCall EuropeanBSCall_Greeks EuropeanBSCall_ImpVol ' +
              'EuropeanBSPut EuropeanBSPut_Greeks EuropeanBSPut_ImpVol exctsmpl exec execbg exp extern eye fcheckerr fclearerr feq ' +
              'feqmt fflush fft ffti fftm fftmi fftn fge fgemt fgets fgetsa fgetsat fgetst fgt fgtmt fileinfo filesa fle flemt ' +
              'floor flt fltmt fmod fne fnemt fonts fopen formatcv formatnv fputs fputst fseek fstrerror ftell ftocv ftos ftostrC ' +
              'gamma gammacplx gammaii gausset gdaAppend gdaCreate gdaDStat gdaDStatMat gdaGetIndex gdaGetName gdaGetNames gdaGetOrders ' +
              'gdaGetType gdaGetTypes gdaGetVarInfo gdaIsCplx gdaLoad gdaPack gdaRead gdaReadByIndex gdaReadSome gdaReadSparse ' +
              'gdaReadStruct gdaReportVarInfo gdaSave gdaUpdate gdaUpdateAndPack gdaVars gdaWrite gdaWrite32 gdaWriteSome getarray ' +
              'getdims getf getGAUSShome getmatrix getmatrix4D getname getnamef getNextTradingDay getNextWeekDay getnr getorders ' +
              'getpath getPreviousTradingDay getPreviousWeekDay getRow getscalar3D getscalar4D getTrRow getwind glm gradcplx gradMT ' +
              'gradMTm gradMTT gradMTTm gradp graphprt graphset hasimag header headermt hess hessMT hessMTg hessMTgw hessMTm ' +
              'hessMTmw hessMTT hessMTTg hessMTTgw hessMTTm hessMTw hessp hist histf histp hsec imag indcv indexcat indices indices2 ' +
              'indicesf indicesfn indnv indsav integrate1d integrateControlCreate intgrat2 intgrat3 inthp1 inthp2 inthp3 inthp4 ' +
              'inthpControlCreate intquad1 intquad2 intquad3 intrleav intrleavsa intrsect intsimp inv invpd invswp iscplx iscplxf ' +
              'isden isinfnanmiss ismiss key keyav keyw lag lag1 lagn lapEighb lapEighi lapEighvb lapEighvi lapgEig lapgEigh lapgEighv ' +
              'lapgEigv lapgSchur lapgSvdcst lapgSvds lapgSvdst lapSvdcusv lapSvds lapSvdusv ldlp ldlsol linSolve listwise ln lncdfbvn ' +
              'lncdfbvn2 lncdfmvn lncdfn lncdfn2 lncdfnc lnfact lngammacplx lnpdfmvn lnpdfmvt lnpdfn lnpdft loadd loadstruct loadwind ' +
              'loess loessmt loessmtControlCreate log loglog logx logy lower lowmat lowmat1 ltrisol lu lusol machEpsilon make makevars ' +
              'makewind margin matalloc matinit mattoarray maxbytes maxc maxindc maxv maxvec mbesselei mbesselei0 mbesselei1 mbesseli ' +
              'mbesseli0 mbesseli1 meanc median mergeby mergevar minc minindc minv miss missex missrv moment momentd movingave ' +
              'movingaveExpwgt movingaveWgt nextindex nextn nextnevn nextwind ntos null null1 numCombinations ols olsmt olsmtControlCreate ' +
              'olsqr olsqr2 olsqrmt ones optn optnevn orth outtyp pacf packedToSp packr parse pause pdfCauchy pdfChi pdfExp pdfGenPareto ' +
              'pdfHyperGeo pdfLaplace pdfLogistic pdfn pdfPoisson pdfRayleigh pdfWeibull pi pinv pinvmt plotAddArrow plotAddBar plotAddBox ' +
              'plotAddHist plotAddHistF plotAddHistP plotAddPolar plotAddScatter plotAddShape plotAddTextbox plotAddTS plotAddXY plotArea ' +
              'plotBar plotBox plotClearLayout plotContour plotCustomLayout plotGetDefaults plotHist plotHistF plotHistP plotLayout ' +
              'plotLogLog plotLogX plotLogY plotOpenWindow plotPolar plotSave plotScatter plotSetAxesPen plotSetBar plotSetBarFill ' +
              'plotSetBarStacked plotSetBkdColor plotSetFill plotSetGrid plotSetLegend plotSetLineColor plotSetLineStyle plotSetLineSymbol ' +
              'plotSetLineThickness plotSetNewWindow plotSetTitle plotSetWhichYAxis plotSetXAxisShow plotSetXLabel plotSetXRange ' +
              'plotSetXTicInterval plotSetXTicLabel plotSetYAxisShow plotSetYLabel plotSetYRange plotSetZAxisShow plotSetZLabel ' +
              'plotSurface plotTS plotXY polar polychar polyeval polygamma polyint polymake polymat polymroot polymult polyroot ' +
              'pqgwin previousindex princomp printfm printfmt prodc psi putarray putf putvals pvCreate pvGetIndex pvGetParNames ' +
              'pvGetParVector pvLength pvList pvPack pvPacki pvPackm pvPackmi pvPacks pvPacksi pvPacksm pvPacksmi pvPutParVector ' +
              'pvTest pvUnpack QNewton QNewtonmt QNewtonmtControlCreate QNewtonmtOutCreate QNewtonSet QProg QProgmt QProgmtInCreate ' +
              'qqr qqre qqrep qr qre qrep qrsol qrtsol qtyr qtyre qtyrep quantile quantiled qyr qyre qyrep qz rank rankindx readr ' +
              'real reclassify reclassifyCuts recode recserar recsercp recserrc rerun rescale reshape rets rev rfft rffti rfftip rfftn ' +
              'rfftnp rfftp rndBernoulli rndBeta rndBinomial rndCauchy rndChiSquare rndCon rndCreateState rndExp rndGamma rndGeo rndGumbel ' +
              'rndHyperGeo rndi rndKMbeta rndKMgam rndKMi rndKMn rndKMnb rndKMp rndKMu rndKMvm rndLaplace rndLCbeta rndLCgam rndLCi rndLCn ' +
              'rndLCnb rndLCp rndLCu rndLCvm rndLogNorm rndMTu rndMVn rndMVt rndn rndnb rndNegBinomial rndp rndPoisson rndRayleigh ' +
              'rndStateSkip rndu rndvm rndWeibull rndWishart rotater round rows rowsf rref sampleData satostrC saved saveStruct savewind ' +
              'scale scale3d scalerr scalinfnanmiss scalmiss schtoc schur searchsourcepath seekr select selif seqa seqm setdif setdifsa ' +
              'setvars setvwrmode setwind shell shiftr sin singleindex sinh sleep solpd sortc sortcc sortd sorthc sorthcc sortind ' +
              'sortindc sortmc sortr sortrc spBiconjGradSol spChol spConjGradSol spCreate spDenseSubmat spDiagRvMat spEigv spEye spLDL ' +
              'spline spLU spNumNZE spOnes spreadSheetReadM spreadSheetReadSA spreadSheetWrite spScale spSubmat spToDense spTrTDense ' +
              'spTScalar spZeros sqpSolve sqpSolveMT sqpSolveMTControlCreate sqpSolveMTlagrangeCreate sqpSolveMToutCreate sqpSolveSet ' +
              'sqrt statements stdc stdsc stocv stof strcombine strindx strlen strput strrindx strsect strsplit strsplitPad strtodt ' +
              'strtof strtofcplx strtriml strtrimr strtrunc strtruncl strtruncpad strtruncr submat subscat substute subvec sumc sumr ' +
              'surface svd svd1 svd2 svdcusv svds svdusv sysstate tab tan tanh tempname ' +
              'time timedt timestr timeutc title tkf2eps tkf2ps tocart todaydt toeplitz token topolar trapchk ' +
              'trigamma trimr trunc type typecv typef union unionsa uniqindx uniqindxsa unique uniquesa upmat upmat1 upper utctodt ' +
              'utctodtv utrisol vals varCovMS varCovXS varget vargetl varmall varmares varput varputl vartypef vcm vcms vcx vcxs ' +
              'vec vech vecr vector vget view viewxyz vlist vnamecv volume vput vread vtypecv wait waitc walkindex where window ' +
              'writer xlabel xlsGetSheetCount xlsGetSheetSize xlsGetSheetTypes xlsMakeRange xlsReadM xlsReadSA xlsWrite xlsWriteM ' +
              'xlsWriteSA xpnd xtics xy xyz ylabel ytics zeros zeta zlabel ztics cdfEmpirical dot h5create h5open h5read h5readAttribute ' +
              'h5write h5writeAttribute ldl plotAddErrorBar plotAddSurface plotCDFEmpirical plotSetColormap plotSetContourLabels ' +
              'plotSetLegendFont plotSetTextInterpreter plotSetXTicCount plotSetYTicCount plotSetZLevels powerm strjoin sylvester ' +
              'strtrim',
    literal: 'DB_AFTER_LAST_ROW DB_ALL_TABLES DB_BATCH_OPERATIONS DB_BEFORE_FIRST_ROW DB_BLOB DB_EVENT_NOTIFICATIONS ' +
             'DB_FINISH_QUERY DB_HIGH_PRECISION DB_LAST_INSERT_ID DB_LOW_PRECISION_DOUBLE DB_LOW_PRECISION_INT32 ' +
             'DB_LOW_PRECISION_INT64 DB_LOW_PRECISION_NUMBERS DB_MULTIPLE_RESULT_SETS DB_NAMED_PLACEHOLDERS ' +
             'DB_POSITIONAL_PLACEHOLDERS DB_PREPARED_QUERIES DB_QUERY_SIZE DB_SIMPLE_LOCKING DB_SYSTEM_TABLES DB_TABLES ' +
             'DB_TRANSACTIONS DB_UNICODE DB_VIEWS __STDIN __STDOUT __STDERR __FILE_DIR'
  };


  var AT_COMMENT_MODE = hljs.COMMENT('@', '@');

  var PREPROCESSOR =
  {
    className: 'meta',
    begin: '#', end: '$',
    keywords: {'meta-keyword': 'define definecs|10 undef ifdef ifndef iflight ifdllcall ifmac ifos2win ifunix else endif lineson linesoff srcfile srcline'},
    contains: [
      {
        begin: /\\\n/, relevance: 0
      },
      {
        beginKeywords: 'include', end: '$',
        keywords: {'meta-keyword': 'include'},
        contains: [
          {
            className: 'meta-string',
            begin: '"', end: '"',
            illegal: '\\n'
          }
        ]
      },
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      AT_COMMENT_MODE,
    ]
  };

  var STRUCT_TYPE =
  {
    begin: /\bstruct\s+/,
    end: /\s/,
    keywords: "struct",
    contains: [
      {
        className: "type",
        begin: hljs.UNDERSCORE_IDENT_RE,
        relevance: 0,
      },
    ],
  };

  // only for definitions
  var PARSE_PARAMS = [
    {
      className: 'params',
      begin: /\(/, end: /\)/,
      excludeBegin: true,
      excludeEnd: true,
      endsWithParent: true,
      relevance: 0,
      contains: [
        { // dots
          className: 'literal',
          begin: /\.\.\./,
        },
        hljs.C_NUMBER_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        AT_COMMENT_MODE,
        STRUCT_TYPE,
      ]
    }
  ];

  var FUNCTION_DEF =
  {
    className: "title",
    begin: hljs.UNDERSCORE_IDENT_RE,
    relevance: 0,
  };

  var DEFINITION = function (beginKeywords, end, inherits) {
    var mode = hljs.inherit(
      {
        className: "function",
        beginKeywords: beginKeywords,
        end: end,
        excludeEnd: true,
        contains: [].concat(PARSE_PARAMS),
      },
      inherits || {}
    );
    mode.contains.push(FUNCTION_DEF);
    mode.contains.push(hljs.C_NUMBER_MODE);
    mode.contains.push(hljs.C_BLOCK_COMMENT_MODE);
    mode.contains.push(AT_COMMENT_MODE);
    return mode;
  };

  var BUILT_IN_REF =
  { // these are explicitly named internal function calls
    className: 'built_in',
    begin: '\\b(' + KEYWORDS.built_in.split(' ').join('|') + ')\\b',
  };

  var STRING_REF =
  {
    className: 'string',
    begin: '"', end: '"',
    contains: [hljs.BACKSLASH_ESCAPE],
    relevance: 0,
  };

  var FUNCTION_REF =
  {
    //className: "fn_ref",
    begin: hljs.UNDERSCORE_IDENT_RE + '\\s*\\(',
    returnBegin: true,
    keywords: KEYWORDS,
    relevance: 0,
    contains: [
      {
        beginKeywords: KEYWORDS.keyword,
      },
      BUILT_IN_REF,
      { // ambiguously named function calls get a relevance of 0
        className: 'built_in',
        begin: hljs.UNDERSCORE_IDENT_RE,
        relevance: 0,
      },
    ],
  };

  var FUNCTION_REF_PARAMS =
  {
    //className: "fn_ref_params",
    begin: /\(/,
    end: /\)/,
    relevance: 0,
    keywords: { built_in: KEYWORDS.built_in, literal: KEYWORDS.literal },
    contains: [
      hljs.C_NUMBER_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      AT_COMMENT_MODE,
      BUILT_IN_REF,
      FUNCTION_REF,
      STRING_REF,
      'self',
    ],
  };

  FUNCTION_REF.contains.push(FUNCTION_REF_PARAMS);

  return {
    aliases: ['gss'],
    case_insensitive: true, // language is case-insensitive
    keywords: KEYWORDS,
    illegal: /(\{[%#]|[%#]\}| <- )/,
    contains: [
      hljs.C_NUMBER_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      AT_COMMENT_MODE,
      STRING_REF,
      PREPROCESSOR,
      {
        className: 'keyword',
        begin: /\bexternal (matrix|string|array|sparse matrix|struct|proc|keyword|fn)/,
      },
      DEFINITION('proc keyword', ';'),
      DEFINITION('fn', '='),
      {
        beginKeywords: 'for threadfor',
        end: /;/,
        //end: /\(/,
        relevance: 0,
        contains: [
          hljs.C_BLOCK_COMMENT_MODE,
          AT_COMMENT_MODE,
          FUNCTION_REF_PARAMS,
        ],
      },
      { // custom method guard
        // excludes method names from keyword processing
        variants: [
          { begin: hljs.UNDERSCORE_IDENT_RE + '\\.' + hljs.UNDERSCORE_IDENT_RE, },
          { begin: hljs.UNDERSCORE_IDENT_RE + '\\s*=', },
        ],
        relevance: 0,
      },
      FUNCTION_REF,
      STRUCT_TYPE,
    ]
  };
};

var gcode = function(hljs) {
    var GCODE_IDENT_RE = '[A-Z_][A-Z0-9_.]*';
    var GCODE_CLOSE_RE = '\\%';
    var GCODE_KEYWORDS =
      'IF DO WHILE ENDWHILE CALL ENDIF SUB ENDSUB GOTO REPEAT ENDREPEAT ' +
      'EQ LT GT NE GE LE OR XOR';
    var GCODE_START = {
        className: 'meta',
        begin: '([O])([0-9]+)'
    };
    var GCODE_CODE = [
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        hljs.COMMENT(/\(/, /\)/),
        hljs.inherit(hljs.C_NUMBER_MODE, {begin: '([-+]?([0-9]*\\.?[0-9]+\\.?))|' + hljs.C_NUMBER_RE}),
        hljs.inherit(hljs.APOS_STRING_MODE, {illegal: null}),
        hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null}),
        {
            className: 'name',
            begin: '([G])([0-9]+\\.?[0-9]?)'
        },
        {
            className: 'name',
            begin: '([M])([0-9]+\\.?[0-9]?)'
        },
        {
            className: 'attr',
            begin: '(VC|VS|#)',
            end: '(\\d+)'
        },
        {
            className: 'attr',
            begin: '(VZOFX|VZOFY|VZOFZ)'
        },
        {
            className: 'built_in',
            begin: '(ATAN|ABS|ACOS|ASIN|SIN|COS|EXP|FIX|FUP|ROUND|LN|TAN)(\\[)',
            end: '([-+]?([0-9]*\\.?[0-9]+\\.?))(\\])'
        },
        {
            className: 'symbol',
            variants: [
                {
                    begin: 'N', end: '\\d+',
                    illegal: '\\W'
                }
            ]
        }
    ];

    return {
        aliases: ['nc'],
        // Some implementations (CNC controls) of G-code are interoperable with uppercase and lowercase letters seamlessly.
        // However, most prefer all uppercase and uppercase is customary.
        case_insensitive: true,
        lexemes: GCODE_IDENT_RE,
        keywords: GCODE_KEYWORDS,
        contains: [
            {
                className: 'meta',
                begin: GCODE_CLOSE_RE
            },
            GCODE_START
        ].concat(GCODE_CODE)
    };
};

var gherkin = function (hljs) {
  return {
    aliases: ['feature'],
    keywords: 'Feature Background Ability Business\ Need Scenario Scenarios Scenario\ Outline Scenario\ Template Examples Given And Then But When',
    contains: [
      {
        className: 'symbol',
        begin: '\\*',
        relevance: 0
      },
      {
        className: 'meta',
        begin: '@[^@\\s]+'
      },
      {
        begin: '\\|', end: '\\|\\w*$',
        contains: [
          {
            className: 'string',
            begin: '[^|]+'
          }
        ]
      },
      {
        className: 'variable',
        begin: '<', end: '>'
      },
      hljs.HASH_COMMENT_MODE,
      {
        className: 'string',
        begin: '"""', end: '"""'
      },
      hljs.QUOTE_STRING_MODE
    ]
  };
};

var glsl = function(hljs) {
  return {
    keywords: {
      keyword:
        // Statements
        'break continue discard do else for if return while switch case default ' +
        // Qualifiers
        'attribute binding buffer ccw centroid centroid varying coherent column_major const cw ' +
        'depth_any depth_greater depth_less depth_unchanged early_fragment_tests equal_spacing ' +
        'flat fractional_even_spacing fractional_odd_spacing highp in index inout invariant ' +
        'invocations isolines layout line_strip lines lines_adjacency local_size_x local_size_y ' +
        'local_size_z location lowp max_vertices mediump noperspective offset origin_upper_left ' +
        'out packed patch pixel_center_integer point_mode points precise precision quads r11f_g11f_b10f '+
        'r16 r16_snorm r16f r16i r16ui r32f r32i r32ui r8 r8_snorm r8i r8ui readonly restrict ' +
        'rg16 rg16_snorm rg16f rg16i rg16ui rg32f rg32i rg32ui rg8 rg8_snorm rg8i rg8ui rgb10_a2 ' +
        'rgb10_a2ui rgba16 rgba16_snorm rgba16f rgba16i rgba16ui rgba32f rgba32i rgba32ui rgba8 ' +
        'rgba8_snorm rgba8i rgba8ui row_major sample shared smooth std140 std430 stream triangle_strip ' +
        'triangles triangles_adjacency uniform varying vertices volatile writeonly',
      type:
        'atomic_uint bool bvec2 bvec3 bvec4 dmat2 dmat2x2 dmat2x3 dmat2x4 dmat3 dmat3x2 dmat3x3 ' +
        'dmat3x4 dmat4 dmat4x2 dmat4x3 dmat4x4 double dvec2 dvec3 dvec4 float iimage1D iimage1DArray ' +
        'iimage2D iimage2DArray iimage2DMS iimage2DMSArray iimage2DRect iimage3D iimageBuffer' +
        'iimageCube iimageCubeArray image1D image1DArray image2D image2DArray image2DMS image2DMSArray ' +
        'image2DRect image3D imageBuffer imageCube imageCubeArray int isampler1D isampler1DArray ' +
        'isampler2D isampler2DArray isampler2DMS isampler2DMSArray isampler2DRect isampler3D ' +
        'isamplerBuffer isamplerCube isamplerCubeArray ivec2 ivec3 ivec4 mat2 mat2x2 mat2x3 ' +
        'mat2x4 mat3 mat3x2 mat3x3 mat3x4 mat4 mat4x2 mat4x3 mat4x4 sampler1D sampler1DArray ' +
        'sampler1DArrayShadow sampler1DShadow sampler2D sampler2DArray sampler2DArrayShadow ' +
        'sampler2DMS sampler2DMSArray sampler2DRect sampler2DRectShadow sampler2DShadow sampler3D ' +
        'samplerBuffer samplerCube samplerCubeArray samplerCubeArrayShadow samplerCubeShadow ' +
        'image1D uimage1DArray uimage2D uimage2DArray uimage2DMS uimage2DMSArray uimage2DRect ' +
        'uimage3D uimageBuffer uimageCube uimageCubeArray uint usampler1D usampler1DArray ' +
        'usampler2D usampler2DArray usampler2DMS usampler2DMSArray usampler2DRect usampler3D ' +
        'samplerBuffer usamplerCube usamplerCubeArray uvec2 uvec3 uvec4 vec2 vec3 vec4 void',
      built_in:
        // Constants
        'gl_MaxAtomicCounterBindings gl_MaxAtomicCounterBufferSize gl_MaxClipDistances gl_MaxClipPlanes ' +
        'gl_MaxCombinedAtomicCounterBuffers gl_MaxCombinedAtomicCounters gl_MaxCombinedImageUniforms ' +
        'gl_MaxCombinedImageUnitsAndFragmentOutputs gl_MaxCombinedTextureImageUnits gl_MaxComputeAtomicCounterBuffers ' +
        'gl_MaxComputeAtomicCounters gl_MaxComputeImageUniforms gl_MaxComputeTextureImageUnits ' +
        'gl_MaxComputeUniformComponents gl_MaxComputeWorkGroupCount gl_MaxComputeWorkGroupSize ' +
        'gl_MaxDrawBuffers gl_MaxFragmentAtomicCounterBuffers gl_MaxFragmentAtomicCounters ' +
        'gl_MaxFragmentImageUniforms gl_MaxFragmentInputComponents gl_MaxFragmentInputVectors ' +
        'gl_MaxFragmentUniformComponents gl_MaxFragmentUniformVectors gl_MaxGeometryAtomicCounterBuffers ' +
        'gl_MaxGeometryAtomicCounters gl_MaxGeometryImageUniforms gl_MaxGeometryInputComponents ' +
        'gl_MaxGeometryOutputComponents gl_MaxGeometryOutputVertices gl_MaxGeometryTextureImageUnits ' +
        'gl_MaxGeometryTotalOutputComponents gl_MaxGeometryUniformComponents gl_MaxGeometryVaryingComponents ' +
        'gl_MaxImageSamples gl_MaxImageUnits gl_MaxLights gl_MaxPatchVertices gl_MaxProgramTexelOffset ' +
        'gl_MaxTessControlAtomicCounterBuffers gl_MaxTessControlAtomicCounters gl_MaxTessControlImageUniforms ' +
        'gl_MaxTessControlInputComponents gl_MaxTessControlOutputComponents gl_MaxTessControlTextureImageUnits ' +
        'gl_MaxTessControlTotalOutputComponents gl_MaxTessControlUniformComponents ' +
        'gl_MaxTessEvaluationAtomicCounterBuffers gl_MaxTessEvaluationAtomicCounters ' +
        'gl_MaxTessEvaluationImageUniforms gl_MaxTessEvaluationInputComponents gl_MaxTessEvaluationOutputComponents ' +
        'gl_MaxTessEvaluationTextureImageUnits gl_MaxTessEvaluationUniformComponents ' +
        'gl_MaxTessGenLevel gl_MaxTessPatchComponents gl_MaxTextureCoords gl_MaxTextureImageUnits ' +
        'gl_MaxTextureUnits gl_MaxVaryingComponents gl_MaxVaryingFloats gl_MaxVaryingVectors ' +
        'gl_MaxVertexAtomicCounterBuffers gl_MaxVertexAtomicCounters gl_MaxVertexAttribs gl_MaxVertexImageUniforms ' +
        'gl_MaxVertexOutputComponents gl_MaxVertexOutputVectors gl_MaxVertexTextureImageUnits ' +
        'gl_MaxVertexUniformComponents gl_MaxVertexUniformVectors gl_MaxViewports gl_MinProgramTexelOffset ' +
        // Variables
        'gl_BackColor gl_BackLightModelProduct gl_BackLightProduct gl_BackMaterial ' +
        'gl_BackSecondaryColor gl_ClipDistance gl_ClipPlane gl_ClipVertex gl_Color ' +
        'gl_DepthRange gl_EyePlaneQ gl_EyePlaneR gl_EyePlaneS gl_EyePlaneT gl_Fog gl_FogCoord ' +
        'gl_FogFragCoord gl_FragColor gl_FragCoord gl_FragData gl_FragDepth gl_FrontColor ' +
        'gl_FrontFacing gl_FrontLightModelProduct gl_FrontLightProduct gl_FrontMaterial ' +
        'gl_FrontSecondaryColor gl_GlobalInvocationID gl_InstanceID gl_InvocationID gl_Layer gl_LightModel ' +
        'gl_LightSource gl_LocalInvocationID gl_LocalInvocationIndex gl_ModelViewMatrix ' +
        'gl_ModelViewMatrixInverse gl_ModelViewMatrixInverseTranspose gl_ModelViewMatrixTranspose ' +
        'gl_ModelViewProjectionMatrix gl_ModelViewProjectionMatrixInverse gl_ModelViewProjectionMatrixInverseTranspose ' +
        'gl_ModelViewProjectionMatrixTranspose gl_MultiTexCoord0 gl_MultiTexCoord1 gl_MultiTexCoord2 ' +
        'gl_MultiTexCoord3 gl_MultiTexCoord4 gl_MultiTexCoord5 gl_MultiTexCoord6 gl_MultiTexCoord7 ' +
        'gl_Normal gl_NormalMatrix gl_NormalScale gl_NumSamples gl_NumWorkGroups gl_ObjectPlaneQ ' +
        'gl_ObjectPlaneR gl_ObjectPlaneS gl_ObjectPlaneT gl_PatchVerticesIn gl_Point gl_PointCoord ' +
        'gl_PointSize gl_Position gl_PrimitiveID gl_PrimitiveIDIn gl_ProjectionMatrix gl_ProjectionMatrixInverse ' +
        'gl_ProjectionMatrixInverseTranspose gl_ProjectionMatrixTranspose gl_SampleID gl_SampleMask ' +
        'gl_SampleMaskIn gl_SamplePosition gl_SecondaryColor gl_TessCoord gl_TessLevelInner gl_TessLevelOuter ' +
        'gl_TexCoord gl_TextureEnvColor gl_TextureMatrix gl_TextureMatrixInverse gl_TextureMatrixInverseTranspose ' +
        'gl_TextureMatrixTranspose gl_Vertex gl_VertexID gl_ViewportIndex gl_WorkGroupID gl_WorkGroupSize gl_in gl_out ' +
        // Functions
        'EmitStreamVertex EmitVertex EndPrimitive EndStreamPrimitive abs acos acosh all any asin ' +
        'asinh atan atanh atomicAdd atomicAnd atomicCompSwap atomicCounter atomicCounterDecrement ' +
        'atomicCounterIncrement atomicExchange atomicMax atomicMin atomicOr atomicXor barrier ' +
        'bitCount bitfieldExtract bitfieldInsert bitfieldReverse ceil clamp cos cosh cross ' +
        'dFdx dFdy degrees determinant distance dot equal exp exp2 faceforward findLSB findMSB ' +
        'floatBitsToInt floatBitsToUint floor fma fract frexp ftransform fwidth greaterThan ' +
        'greaterThanEqual groupMemoryBarrier imageAtomicAdd imageAtomicAnd imageAtomicCompSwap ' +
        'imageAtomicExchange imageAtomicMax imageAtomicMin imageAtomicOr imageAtomicXor imageLoad ' +
        'imageSize imageStore imulExtended intBitsToFloat interpolateAtCentroid interpolateAtOffset ' +
        'interpolateAtSample inverse inversesqrt isinf isnan ldexp length lessThan lessThanEqual log ' +
        'log2 matrixCompMult max memoryBarrier memoryBarrierAtomicCounter memoryBarrierBuffer ' +
        'memoryBarrierImage memoryBarrierShared min mix mod modf noise1 noise2 noise3 noise4 ' +
        'normalize not notEqual outerProduct packDouble2x32 packHalf2x16 packSnorm2x16 packSnorm4x8 ' +
        'packUnorm2x16 packUnorm4x8 pow radians reflect refract round roundEven shadow1D shadow1DLod ' +
        'shadow1DProj shadow1DProjLod shadow2D shadow2DLod shadow2DProj shadow2DProjLod sign sin sinh ' +
        'smoothstep sqrt step tan tanh texelFetch texelFetchOffset texture texture1D texture1DLod ' +
        'texture1DProj texture1DProjLod texture2D texture2DLod texture2DProj texture2DProjLod ' +
        'texture3D texture3DLod texture3DProj texture3DProjLod textureCube textureCubeLod ' +
        'textureGather textureGatherOffset textureGatherOffsets textureGrad textureGradOffset ' +
        'textureLod textureLodOffset textureOffset textureProj textureProjGrad textureProjGradOffset ' +
        'textureProjLod textureProjLodOffset textureProjOffset textureQueryLevels textureQueryLod ' +
        'textureSize transpose trunc uaddCarry uintBitsToFloat umulExtended unpackDouble2x32 ' +
        'unpackHalf2x16 unpackSnorm2x16 unpackSnorm4x8 unpackUnorm2x16 unpackUnorm4x8 usubBorrow',
      literal: 'true false'
    },
    illegal: '"',
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.C_NUMBER_MODE,
      {
        className: 'meta',
        begin: '#', end: '$'
      }
    ]
  };
};

var gml = function(hljs) {
  var GML_KEYWORDS = {
    keywords: 'begin end if then else while do for break continue with until ' +
      'repeat exit and or xor not return mod div switch case default var ' +
      'globalvar enum #macro #region #endregion',
    built_in: 'is_real is_string is_array is_undefined is_int32 is_int64 ' +
      'is_ptr is_vec3 is_vec4 is_matrix is_bool typeof ' +
      'variable_global_exists variable_global_get variable_global_set ' +
      'variable_instance_exists variable_instance_get variable_instance_set ' +
      'variable_instance_get_names array_length_1d array_length_2d ' +
      'array_height_2d array_equals array_create array_copy random ' +
      'random_range irandom irandom_range random_set_seed random_get_seed ' +
      'randomize randomise choose abs round floor ceil sign frac sqrt sqr ' +
      'exp ln log2 log10 sin cos tan arcsin arccos arctan arctan2 dsin dcos ' +
      'dtan darcsin darccos darctan darctan2 degtorad radtodeg power logn ' +
      'min max mean median clamp lerp dot_product dot_product_3d ' +
      'dot_product_normalised dot_product_3d_normalised ' +
      'dot_product_normalized dot_product_3d_normalized math_set_epsilon ' +
      'math_get_epsilon angle_difference point_distance_3d point_distance ' +
      'point_direction lengthdir_x lengthdir_y real string int64 ptr ' +
      'string_format chr ansi_char ord string_length string_byte_length ' +
      'string_pos string_copy string_char_at string_ord_at string_byte_at ' +
      'string_set_byte_at string_delete string_insert string_lower ' +
      'string_upper string_repeat string_letters string_digits ' +
      'string_lettersdigits string_replace string_replace_all string_count ' +
      'string_hash_to_newline clipboard_has_text clipboard_set_text ' +
      'clipboard_get_text date_current_datetime date_create_datetime ' +
      'date_valid_datetime date_inc_year date_inc_month date_inc_week ' +
      'date_inc_day date_inc_hour date_inc_minute date_inc_second ' +
      'date_get_year date_get_month date_get_week date_get_day ' +
      'date_get_hour date_get_minute date_get_second date_get_weekday ' +
      'date_get_day_of_year date_get_hour_of_year date_get_minute_of_year ' +
      'date_get_second_of_year date_year_span date_month_span ' +
      'date_week_span date_day_span date_hour_span date_minute_span ' +
      'date_second_span date_compare_datetime date_compare_date ' +
      'date_compare_time date_date_of date_time_of date_datetime_string ' +
      'date_date_string date_time_string date_days_in_month ' +
      'date_days_in_year date_leap_year date_is_today date_set_timezone ' +
      'date_get_timezone game_set_speed game_get_speed motion_set ' +
      'motion_add place_free place_empty place_meeting place_snapped ' +
      'move_random move_snap move_towards_point move_contact_solid ' +
      'move_contact_all move_outside_solid move_outside_all ' +
      'move_bounce_solid move_bounce_all move_wrap distance_to_point ' +
      'distance_to_object position_empty position_meeting path_start ' +
      'path_end mp_linear_step mp_potential_step mp_linear_step_object ' +
      'mp_potential_step_object mp_potential_settings mp_linear_path ' +
      'mp_potential_path mp_linear_path_object mp_potential_path_object ' +
      'mp_grid_create mp_grid_destroy mp_grid_clear_all mp_grid_clear_cell ' +
      'mp_grid_clear_rectangle mp_grid_add_cell mp_grid_get_cell ' +
      'mp_grid_add_rectangle mp_grid_add_instances mp_grid_path ' +
      'mp_grid_draw mp_grid_to_ds_grid collision_point collision_rectangle ' +
      'collision_circle collision_ellipse collision_line ' +
      'collision_point_list collision_rectangle_list collision_circle_list ' +
      'collision_ellipse_list collision_line_list instance_position_list ' +
      'instance_place_list point_in_rectangle ' +
      'point_in_triangle point_in_circle rectangle_in_rectangle ' +
      'rectangle_in_triangle rectangle_in_circle instance_find ' +
      'instance_exists instance_number instance_position instance_nearest ' +
      'instance_furthest instance_place instance_create_depth ' +
      'instance_create_layer instance_copy instance_change instance_destroy ' +
      'position_destroy position_change instance_id_get ' +
      'instance_deactivate_all instance_deactivate_object ' +
      'instance_deactivate_region instance_activate_all ' +
      'instance_activate_object instance_activate_region room_goto ' +
      'room_goto_previous room_goto_next room_previous room_next ' +
      'room_restart game_end game_restart game_load game_save ' +
      'game_save_buffer game_load_buffer event_perform event_user ' +
      'event_perform_object event_inherited show_debug_message ' +
      'show_debug_overlay debug_event debug_get_callstack alarm_get ' +
      'alarm_set font_texture_page_size keyboard_set_map keyboard_get_map ' +
      'keyboard_unset_map keyboard_check keyboard_check_pressed ' +
      'keyboard_check_released keyboard_check_direct keyboard_get_numlock ' +
      'keyboard_set_numlock keyboard_key_press keyboard_key_release ' +
      'keyboard_clear io_clear mouse_check_button ' +
      'mouse_check_button_pressed mouse_check_button_released ' +
      'mouse_wheel_up mouse_wheel_down mouse_clear draw_self draw_sprite ' +
      'draw_sprite_pos draw_sprite_ext draw_sprite_stretched ' +
      'draw_sprite_stretched_ext draw_sprite_tiled draw_sprite_tiled_ext ' +
      'draw_sprite_part draw_sprite_part_ext draw_sprite_general draw_clear ' +
      'draw_clear_alpha draw_point draw_line draw_line_width draw_rectangle ' +
      'draw_roundrect draw_roundrect_ext draw_triangle draw_circle ' +
      'draw_ellipse draw_set_circle_precision draw_arrow draw_button ' +
      'draw_path draw_healthbar draw_getpixel draw_getpixel_ext ' +
      'draw_set_colour draw_set_color draw_set_alpha draw_get_colour ' +
      'draw_get_color draw_get_alpha merge_colour make_colour_rgb ' +
      'make_colour_hsv colour_get_red colour_get_green colour_get_blue ' +
      'colour_get_hue colour_get_saturation colour_get_value merge_color ' +
      'make_color_rgb make_color_hsv color_get_red color_get_green ' +
      'color_get_blue color_get_hue color_get_saturation color_get_value ' +
      'merge_color screen_save screen_save_part draw_set_font ' +
      'draw_set_halign draw_set_valign draw_text draw_text_ext string_width ' +
      'string_height string_width_ext string_height_ext ' +
      'draw_text_transformed draw_text_ext_transformed draw_text_colour ' +
      'draw_text_ext_colour draw_text_transformed_colour ' +
      'draw_text_ext_transformed_colour draw_text_color draw_text_ext_color ' +
      'draw_text_transformed_color draw_text_ext_transformed_color ' +
      'draw_point_colour draw_line_colour draw_line_width_colour ' +
      'draw_rectangle_colour draw_roundrect_colour ' +
      'draw_roundrect_colour_ext draw_triangle_colour draw_circle_colour ' +
      'draw_ellipse_colour draw_point_color draw_line_color ' +
      'draw_line_width_color draw_rectangle_color draw_roundrect_color ' +
      'draw_roundrect_color_ext draw_triangle_color draw_circle_color ' +
      'draw_ellipse_color draw_primitive_begin draw_vertex ' +
      'draw_vertex_colour draw_vertex_color draw_primitive_end ' +
      'sprite_get_uvs font_get_uvs sprite_get_texture font_get_texture ' +
      'texture_get_width texture_get_height texture_get_uvs ' +
      'draw_primitive_begin_texture draw_vertex_texture ' +
      'draw_vertex_texture_colour draw_vertex_texture_color ' +
      'texture_global_scale surface_create surface_create_ext ' +
      'surface_resize surface_free surface_exists surface_get_width ' +
      'surface_get_height surface_get_texture surface_set_target ' +
      'surface_set_target_ext surface_reset_target surface_depth_disable ' +
      'surface_get_depth_disable draw_surface draw_surface_stretched ' +
      'draw_surface_tiled draw_surface_part draw_surface_ext ' +
      'draw_surface_stretched_ext draw_surface_tiled_ext ' +
      'draw_surface_part_ext draw_surface_general surface_getpixel ' +
      'surface_getpixel_ext surface_save surface_save_part surface_copy ' +
      'surface_copy_part application_surface_draw_enable ' +
      'application_get_position application_surface_enable ' +
      'application_surface_is_enabled display_get_width display_get_height ' +
      'display_get_orientation display_get_gui_width display_get_gui_height ' +
      'display_reset display_mouse_get_x display_mouse_get_y ' +
      'display_mouse_set display_set_ui_visibility ' +
      'window_set_fullscreen window_get_fullscreen ' +
      'window_set_caption window_set_min_width window_set_max_width ' +
      'window_set_min_height window_set_max_height window_get_visible_rects ' +
      'window_get_caption window_set_cursor window_get_cursor ' +
      'window_set_colour window_get_colour window_set_color ' +
      'window_get_color window_set_position window_set_size ' +
      'window_set_rectangle window_center window_get_x window_get_y ' +
      'window_get_width window_get_height window_mouse_get_x ' +
      'window_mouse_get_y window_mouse_set window_view_mouse_get_x ' +
      'window_view_mouse_get_y window_views_mouse_get_x ' +
      'window_views_mouse_get_y audio_listener_position ' +
      'audio_listener_velocity audio_listener_orientation ' +
      'audio_emitter_position audio_emitter_create audio_emitter_free ' +
      'audio_emitter_exists audio_emitter_pitch audio_emitter_velocity ' +
      'audio_emitter_falloff audio_emitter_gain audio_play_sound ' +
      'audio_play_sound_on audio_play_sound_at audio_stop_sound ' +
      'audio_resume_music audio_music_is_playing audio_resume_sound ' +
      'audio_pause_sound audio_pause_music audio_channel_num ' +
      'audio_sound_length audio_get_type audio_falloff_set_model ' +
      'audio_play_music audio_stop_music audio_master_gain audio_music_gain ' +
      'audio_sound_gain audio_sound_pitch audio_stop_all audio_resume_all ' +
      'audio_pause_all audio_is_playing audio_is_paused audio_exists ' +
      'audio_sound_set_track_position audio_sound_get_track_position ' +
      'audio_emitter_get_gain audio_emitter_get_pitch audio_emitter_get_x ' +
      'audio_emitter_get_y audio_emitter_get_z audio_emitter_get_vx ' +
      'audio_emitter_get_vy audio_emitter_get_vz ' +
      'audio_listener_set_position audio_listener_set_velocity ' +
      'audio_listener_set_orientation audio_listener_get_data ' +
      'audio_set_master_gain audio_get_master_gain audio_sound_get_gain ' +
      'audio_sound_get_pitch audio_get_name audio_sound_set_track_position ' +
      'audio_sound_get_track_position audio_create_stream ' +
      'audio_destroy_stream audio_create_sync_group ' +
      'audio_destroy_sync_group audio_play_in_sync_group ' +
      'audio_start_sync_group audio_stop_sync_group audio_pause_sync_group ' +
      'audio_resume_sync_group audio_sync_group_get_track_pos ' +
      'audio_sync_group_debug audio_sync_group_is_playing audio_debug ' +
      'audio_group_load audio_group_unload audio_group_is_loaded ' +
      'audio_group_load_progress audio_group_name audio_group_stop_all ' +
      'audio_group_set_gain audio_create_buffer_sound ' +
      'audio_free_buffer_sound audio_create_play_queue ' +
      'audio_free_play_queue audio_queue_sound audio_get_recorder_count ' +
      'audio_get_recorder_info audio_start_recording audio_stop_recording ' +
      'audio_sound_get_listener_mask audio_emitter_get_listener_mask ' +
      'audio_get_listener_mask audio_sound_set_listener_mask ' +
      'audio_emitter_set_listener_mask audio_set_listener_mask ' +
      'audio_get_listener_count audio_get_listener_info audio_system ' +
      'show_message show_message_async clickable_add clickable_add_ext ' +
      'clickable_change clickable_change_ext clickable_delete ' +
      'clickable_exists clickable_set_style show_question ' +
      'show_question_async get_integer get_string get_integer_async ' +
      'get_string_async get_login_async get_open_filename get_save_filename ' +
      'get_open_filename_ext get_save_filename_ext show_error ' +
      'highscore_clear highscore_add highscore_value highscore_name ' +
      'draw_highscore sprite_exists sprite_get_name sprite_get_number ' +
      'sprite_get_width sprite_get_height sprite_get_xoffset ' +
      'sprite_get_yoffset sprite_get_bbox_left sprite_get_bbox_right ' +
      'sprite_get_bbox_top sprite_get_bbox_bottom sprite_save ' +
      'sprite_save_strip sprite_set_cache_size sprite_set_cache_size_ext ' +
      'sprite_get_tpe sprite_prefetch sprite_prefetch_multi sprite_flush ' +
      'sprite_flush_multi sprite_set_speed sprite_get_speed_type ' +
      'sprite_get_speed font_exists font_get_name font_get_fontname ' +
      'font_get_bold font_get_italic font_get_first font_get_last ' +
      'font_get_size font_set_cache_size path_exists path_get_name ' +
      'path_get_length path_get_time path_get_kind path_get_closed ' +
      'path_get_precision path_get_number path_get_point_x path_get_point_y ' +
      'path_get_point_speed path_get_x path_get_y path_get_speed ' +
      'script_exists script_get_name timeline_add timeline_delete ' +
      'timeline_clear timeline_exists timeline_get_name ' +
      'timeline_moment_clear timeline_moment_add_script timeline_size ' +
      'timeline_max_moment object_exists object_get_name object_get_sprite ' +
      'object_get_solid object_get_visible object_get_persistent ' +
      'object_get_mask object_get_parent object_get_physics ' +
      'object_is_ancestor room_exists room_get_name sprite_set_offset ' +
      'sprite_duplicate sprite_assign sprite_merge sprite_add ' +
      'sprite_replace sprite_create_from_surface sprite_add_from_surface ' +
      'sprite_delete sprite_set_alpha_from_sprite sprite_collision_mask ' +
      'font_add_enable_aa font_add_get_enable_aa font_add font_add_sprite ' +
      'font_add_sprite_ext font_replace font_replace_sprite ' +
      'font_replace_sprite_ext font_delete path_set_kind path_set_closed ' +
      'path_set_precision path_add path_assign path_duplicate path_append ' +
      'path_delete path_add_point path_insert_point path_change_point ' +
      'path_delete_point path_clear_points path_reverse path_mirror ' +
      'path_flip path_rotate path_rescale path_shift script_execute ' +
      'object_set_sprite object_set_solid object_set_visible ' +
      'object_set_persistent object_set_mask room_set_width room_set_height ' +
      'room_set_persistent room_set_background_colour ' +
      'room_set_background_color room_set_view room_set_viewport ' +
      'room_get_viewport room_set_view_enabled room_add room_duplicate ' +
      'room_assign room_instance_add room_instance_clear room_get_camera ' +
      'room_set_camera asset_get_index asset_get_type ' +
      'file_text_open_from_string file_text_open_read file_text_open_write ' +
      'file_text_open_append file_text_close file_text_write_string ' +
      'file_text_write_real file_text_writeln file_text_read_string ' +
      'file_text_read_real file_text_readln file_text_eof file_text_eoln ' +
      'file_exists file_delete file_rename file_copy directory_exists ' +
      'directory_create directory_destroy file_find_first file_find_next ' +
      'file_find_close file_attributes filename_name filename_path ' +
      'filename_dir filename_drive filename_ext filename_change_ext ' +
      'file_bin_open file_bin_rewrite file_bin_close file_bin_position ' +
      'file_bin_size file_bin_seek file_bin_write_byte file_bin_read_byte ' +
      'parameter_count parameter_string environment_get_variable ' +
      'ini_open_from_string ini_open ini_close ini_read_string ' +
      'ini_read_real ini_write_string ini_write_real ini_key_exists ' +
      'ini_section_exists ini_key_delete ini_section_delete ' +
      'ds_set_precision ds_exists ds_stack_create ds_stack_destroy ' +
      'ds_stack_clear ds_stack_copy ds_stack_size ds_stack_empty ' +
      'ds_stack_push ds_stack_pop ds_stack_top ds_stack_write ds_stack_read ' +
      'ds_queue_create ds_queue_destroy ds_queue_clear ds_queue_copy ' +
      'ds_queue_size ds_queue_empty ds_queue_enqueue ds_queue_dequeue ' +
      'ds_queue_head ds_queue_tail ds_queue_write ds_queue_read ' +
      'ds_list_create ds_list_destroy ds_list_clear ds_list_copy ' +
      'ds_list_size ds_list_empty ds_list_add ds_list_insert ' +
      'ds_list_replace ds_list_delete ds_list_find_index ds_list_find_value ' +
      'ds_list_mark_as_list ds_list_mark_as_map ds_list_sort ' +
      'ds_list_shuffle ds_list_write ds_list_read ds_list_set ds_map_create ' +
      'ds_map_destroy ds_map_clear ds_map_copy ds_map_size ds_map_empty ' +
      'ds_map_add ds_map_add_list ds_map_add_map ds_map_replace ' +
      'ds_map_replace_map ds_map_replace_list ds_map_delete ds_map_exists ' +
      'ds_map_find_value ds_map_find_previous ds_map_find_next ' +
      'ds_map_find_first ds_map_find_last ds_map_write ds_map_read ' +
      'ds_map_secure_save ds_map_secure_load ds_map_secure_load_buffer ' +
      'ds_map_secure_save_buffer ds_map_set ds_priority_create ' +
      'ds_priority_destroy ds_priority_clear ds_priority_copy ' +
      'ds_priority_size ds_priority_empty ds_priority_add ' +
      'ds_priority_change_priority ds_priority_find_priority ' +
      'ds_priority_delete_value ds_priority_delete_min ds_priority_find_min ' +
      'ds_priority_delete_max ds_priority_find_max ds_priority_write ' +
      'ds_priority_read ds_grid_create ds_grid_destroy ds_grid_copy ' +
      'ds_grid_resize ds_grid_width ds_grid_height ds_grid_clear ' +
      'ds_grid_set ds_grid_add ds_grid_multiply ds_grid_set_region ' +
      'ds_grid_add_region ds_grid_multiply_region ds_grid_set_disk ' +
      'ds_grid_add_disk ds_grid_multiply_disk ds_grid_set_grid_region ' +
      'ds_grid_add_grid_region ds_grid_multiply_grid_region ds_grid_get ' +
      'ds_grid_get_sum ds_grid_get_max ds_grid_get_min ds_grid_get_mean ' +
      'ds_grid_get_disk_sum ds_grid_get_disk_min ds_grid_get_disk_max ' +
      'ds_grid_get_disk_mean ds_grid_value_exists ds_grid_value_x ' +
      'ds_grid_value_y ds_grid_value_disk_exists ds_grid_value_disk_x ' +
      'ds_grid_value_disk_y ds_grid_shuffle ds_grid_write ds_grid_read ' +
      'ds_grid_sort ds_grid_set ds_grid_get effect_create_below ' +
      'effect_create_above effect_clear part_type_create part_type_destroy ' +
      'part_type_exists part_type_clear part_type_shape part_type_sprite ' +
      'part_type_size part_type_scale part_type_orientation part_type_life ' +
      'part_type_step part_type_death part_type_speed part_type_direction ' +
      'part_type_gravity part_type_colour1 part_type_colour2 ' +
      'part_type_colour3 part_type_colour_mix part_type_colour_rgb ' +
      'part_type_colour_hsv part_type_color1 part_type_color2 ' +
      'part_type_color3 part_type_color_mix part_type_color_rgb ' +
      'part_type_color_hsv part_type_alpha1 part_type_alpha2 ' +
      'part_type_alpha3 part_type_blend part_system_create ' +
      'part_system_create_layer part_system_destroy part_system_exists ' +
      'part_system_clear part_system_draw_order part_system_depth ' +
      'part_system_position part_system_automatic_update ' +
      'part_system_automatic_draw part_system_update part_system_drawit ' +
      'part_system_get_layer part_system_layer part_particles_create ' +
      'part_particles_create_colour part_particles_create_color ' +
      'part_particles_clear part_particles_count part_emitter_create ' +
      'part_emitter_destroy part_emitter_destroy_all part_emitter_exists ' +
      'part_emitter_clear part_emitter_region part_emitter_burst ' +
      'part_emitter_stream external_call external_define external_free ' +
      'window_handle window_device matrix_get matrix_set ' +
      'matrix_build_identity matrix_build matrix_build_lookat ' +
      'matrix_build_projection_ortho matrix_build_projection_perspective ' +
      'matrix_build_projection_perspective_fov matrix_multiply ' +
      'matrix_transform_vertex matrix_stack_push matrix_stack_pop ' +
      'matrix_stack_multiply matrix_stack_set matrix_stack_clear ' +
      'matrix_stack_top matrix_stack_is_empty browser_input_capture ' +
      'os_get_config os_get_info os_get_language os_get_region ' +
      'os_lock_orientation display_get_dpi_x display_get_dpi_y ' +
      'display_set_gui_size display_set_gui_maximise ' +
      'display_set_gui_maximize device_mouse_dbclick_enable ' +
      'display_set_timing_method display_get_timing_method ' +
      'display_set_sleep_margin display_get_sleep_margin virtual_key_add ' +
      'virtual_key_hide virtual_key_delete virtual_key_show ' +
      'draw_enable_drawevent draw_enable_swf_aa draw_set_swf_aa_level ' +
      'draw_get_swf_aa_level draw_texture_flush draw_flush ' +
      'gpu_set_blendenable gpu_set_ztestenable gpu_set_zfunc ' +
      'gpu_set_zwriteenable gpu_set_lightingenable gpu_set_fog ' +
      'gpu_set_cullmode gpu_set_blendmode gpu_set_blendmode_ext ' +
      'gpu_set_blendmode_ext_sepalpha gpu_set_colorwriteenable ' +
      'gpu_set_colourwriteenable gpu_set_alphatestenable ' +
      'gpu_set_alphatestref gpu_set_alphatestfunc gpu_set_texfilter ' +
      'gpu_set_texfilter_ext gpu_set_texrepeat gpu_set_texrepeat_ext ' +
      'gpu_set_tex_filter gpu_set_tex_filter_ext gpu_set_tex_repeat ' +
      'gpu_set_tex_repeat_ext gpu_set_tex_mip_filter ' +
      'gpu_set_tex_mip_filter_ext gpu_set_tex_mip_bias ' +
      'gpu_set_tex_mip_bias_ext gpu_set_tex_min_mip gpu_set_tex_min_mip_ext ' +
      'gpu_set_tex_max_mip gpu_set_tex_max_mip_ext gpu_set_tex_max_aniso ' +
      'gpu_set_tex_max_aniso_ext gpu_set_tex_mip_enable ' +
      'gpu_set_tex_mip_enable_ext gpu_get_blendenable gpu_get_ztestenable ' +
      'gpu_get_zfunc gpu_get_zwriteenable gpu_get_lightingenable ' +
      'gpu_get_fog gpu_get_cullmode gpu_get_blendmode gpu_get_blendmode_ext ' +
      'gpu_get_blendmode_ext_sepalpha gpu_get_blendmode_src ' +
      'gpu_get_blendmode_dest gpu_get_blendmode_srcalpha ' +
      'gpu_get_blendmode_destalpha gpu_get_colorwriteenable ' +
      'gpu_get_colourwriteenable gpu_get_alphatestenable ' +
      'gpu_get_alphatestref gpu_get_alphatestfunc gpu_get_texfilter ' +
      'gpu_get_texfilter_ext gpu_get_texrepeat gpu_get_texrepeat_ext ' +
      'gpu_get_tex_filter gpu_get_tex_filter_ext gpu_get_tex_repeat ' +
      'gpu_get_tex_repeat_ext gpu_get_tex_mip_filter ' +
      'gpu_get_tex_mip_filter_ext gpu_get_tex_mip_bias ' +
      'gpu_get_tex_mip_bias_ext gpu_get_tex_min_mip gpu_get_tex_min_mip_ext ' +
      'gpu_get_tex_max_mip gpu_get_tex_max_mip_ext gpu_get_tex_max_aniso ' +
      'gpu_get_tex_max_aniso_ext gpu_get_tex_mip_enable ' +
      'gpu_get_tex_mip_enable_ext gpu_push_state gpu_pop_state ' +
      'gpu_get_state gpu_set_state draw_light_define_ambient ' +
      'draw_light_define_direction draw_light_define_point ' +
      'draw_light_enable draw_set_lighting draw_light_get_ambient ' +
      'draw_light_get draw_get_lighting shop_leave_rating url_get_domain ' +
      'url_open url_open_ext url_open_full get_timer achievement_login ' +
      'achievement_logout achievement_post achievement_increment ' +
      'achievement_post_score achievement_available ' +
      'achievement_show_achievements achievement_show_leaderboards ' +
      'achievement_load_friends achievement_load_leaderboard ' +
      'achievement_send_challenge achievement_load_progress ' +
      'achievement_reset achievement_login_status achievement_get_pic ' +
      'achievement_show_challenge_notifications achievement_get_challenges ' +
      'achievement_event achievement_show achievement_get_info ' +
      'cloud_file_save cloud_string_save cloud_synchronise ads_enable ' +
      'ads_disable ads_setup ads_engagement_launch ads_engagement_available ' +
      'ads_engagement_active ads_event ads_event_preload ' +
      'ads_set_reward_callback ads_get_display_height ads_get_display_width ' +
      'ads_move ads_interstitial_available ads_interstitial_display ' +
      'device_get_tilt_x device_get_tilt_y device_get_tilt_z ' +
      'device_is_keypad_open device_mouse_check_button ' +
      'device_mouse_check_button_pressed device_mouse_check_button_released ' +
      'device_mouse_x device_mouse_y device_mouse_raw_x device_mouse_raw_y ' +
      'device_mouse_x_to_gui device_mouse_y_to_gui iap_activate iap_status ' +
      'iap_enumerate_products iap_restore_all iap_acquire iap_consume ' +
      'iap_product_details iap_purchase_details facebook_init ' +
      'facebook_login facebook_status facebook_graph_request ' +
      'facebook_dialog facebook_logout facebook_launch_offerwall ' +
      'facebook_post_message facebook_send_invite facebook_user_id ' +
      'facebook_accesstoken facebook_check_permission ' +
      'facebook_request_read_permissions ' +
      'facebook_request_publish_permissions gamepad_is_supported ' +
      'gamepad_get_device_count gamepad_is_connected ' +
      'gamepad_get_description gamepad_get_button_threshold ' +
      'gamepad_set_button_threshold gamepad_get_axis_deadzone ' +
      'gamepad_set_axis_deadzone gamepad_button_count gamepad_button_check ' +
      'gamepad_button_check_pressed gamepad_button_check_released ' +
      'gamepad_button_value gamepad_axis_count gamepad_axis_value ' +
      'gamepad_set_vibration gamepad_set_colour gamepad_set_color ' +
      'os_is_paused window_has_focus code_is_compiled http_get ' +
      'http_get_file http_post_string http_request json_encode json_decode ' +
      'zip_unzip load_csv base64_encode base64_decode md5_string_unicode ' +
      'md5_string_utf8 md5_file os_is_network_connected sha1_string_unicode ' +
      'sha1_string_utf8 sha1_file os_powersave_enable analytics_event ' +
      'analytics_event_ext win8_livetile_tile_notification ' +
      'win8_livetile_tile_clear win8_livetile_badge_notification ' +
      'win8_livetile_badge_clear win8_livetile_queue_enable ' +
      'win8_secondarytile_pin win8_secondarytile_badge_notification ' +
      'win8_secondarytile_delete win8_livetile_notification_begin ' +
      'win8_livetile_notification_secondary_begin ' +
      'win8_livetile_notification_expiry win8_livetile_notification_tag ' +
      'win8_livetile_notification_text_add ' +
      'win8_livetile_notification_image_add win8_livetile_notification_end ' +
      'win8_appbar_enable win8_appbar_add_element ' +
      'win8_appbar_remove_element win8_settingscharm_add_entry ' +
      'win8_settingscharm_add_html_entry win8_settingscharm_add_xaml_entry ' +
      'win8_settingscharm_set_xaml_property ' +
      'win8_settingscharm_get_xaml_property win8_settingscharm_remove_entry ' +
      'win8_share_image win8_share_screenshot win8_share_file ' +
      'win8_share_url win8_share_text win8_search_enable ' +
      'win8_search_disable win8_search_add_suggestions ' +
      'win8_device_touchscreen_available win8_license_initialize_sandbox ' +
      'win8_license_trial_version winphone_license_trial_version ' +
      'winphone_tile_title winphone_tile_count winphone_tile_back_title ' +
      'winphone_tile_back_content winphone_tile_back_content_wide ' +
      'winphone_tile_front_image winphone_tile_front_image_small ' +
      'winphone_tile_front_image_wide winphone_tile_back_image ' +
      'winphone_tile_back_image_wide winphone_tile_background_colour ' +
      'winphone_tile_background_color winphone_tile_icon_image ' +
      'winphone_tile_small_icon_image winphone_tile_wide_content ' +
      'winphone_tile_cycle_images winphone_tile_small_background_image ' +
      'physics_world_create physics_world_gravity ' +
      'physics_world_update_speed physics_world_update_iterations ' +
      'physics_world_draw_debug physics_pause_enable physics_fixture_create ' +
      'physics_fixture_set_kinematic physics_fixture_set_density ' +
      'physics_fixture_set_awake physics_fixture_set_restitution ' +
      'physics_fixture_set_friction physics_fixture_set_collision_group ' +
      'physics_fixture_set_sensor physics_fixture_set_linear_damping ' +
      'physics_fixture_set_angular_damping physics_fixture_set_circle_shape ' +
      'physics_fixture_set_box_shape physics_fixture_set_edge_shape ' +
      'physics_fixture_set_polygon_shape physics_fixture_set_chain_shape ' +
      'physics_fixture_add_point physics_fixture_bind ' +
      'physics_fixture_bind_ext physics_fixture_delete physics_apply_force ' +
      'physics_apply_impulse physics_apply_angular_impulse ' +
      'physics_apply_local_force physics_apply_local_impulse ' +
      'physics_apply_torque physics_mass_properties physics_draw_debug ' +
      'physics_test_overlap physics_remove_fixture physics_set_friction ' +
      'physics_set_density physics_set_restitution physics_get_friction ' +
      'physics_get_density physics_get_restitution ' +
      'physics_joint_distance_create physics_joint_rope_create ' +
      'physics_joint_revolute_create physics_joint_prismatic_create ' +
      'physics_joint_pulley_create physics_joint_wheel_create ' +
      'physics_joint_weld_create physics_joint_friction_create ' +
      'physics_joint_gear_create physics_joint_enable_motor ' +
      'physics_joint_get_value physics_joint_set_value physics_joint_delete ' +
      'physics_particle_create physics_particle_delete ' +
      'physics_particle_delete_region_circle ' +
      'physics_particle_delete_region_box ' +
      'physics_particle_delete_region_poly physics_particle_set_flags ' +
      'physics_particle_set_category_flags physics_particle_draw ' +
      'physics_particle_draw_ext physics_particle_count ' +
      'physics_particle_get_data physics_particle_get_data_particle ' +
      'physics_particle_group_begin physics_particle_group_circle ' +
      'physics_particle_group_box physics_particle_group_polygon ' +
      'physics_particle_group_add_point physics_particle_group_end ' +
      'physics_particle_group_join physics_particle_group_delete ' +
      'physics_particle_group_count physics_particle_group_get_data ' +
      'physics_particle_group_get_mass physics_particle_group_get_inertia ' +
      'physics_particle_group_get_centre_x ' +
      'physics_particle_group_get_centre_y physics_particle_group_get_vel_x ' +
      'physics_particle_group_get_vel_y physics_particle_group_get_ang_vel ' +
      'physics_particle_group_get_x physics_particle_group_get_y ' +
      'physics_particle_group_get_angle physics_particle_set_group_flags ' +
      'physics_particle_get_group_flags physics_particle_get_max_count ' +
      'physics_particle_get_radius physics_particle_get_density ' +
      'physics_particle_get_damping physics_particle_get_gravity_scale ' +
      'physics_particle_set_max_count physics_particle_set_radius ' +
      'physics_particle_set_density physics_particle_set_damping ' +
      'physics_particle_set_gravity_scale network_create_socket ' +
      'network_create_socket_ext network_create_server ' +
      'network_create_server_raw network_connect network_connect_raw ' +
      'network_send_packet network_send_raw network_send_broadcast ' +
      'network_send_udp network_send_udp_raw network_set_timeout ' +
      'network_set_config network_resolve network_destroy buffer_create ' +
      'buffer_write buffer_read buffer_seek buffer_get_surface ' +
      'buffer_set_surface buffer_delete buffer_exists buffer_get_type ' +
      'buffer_get_alignment buffer_poke buffer_peek buffer_save ' +
      'buffer_save_ext buffer_load buffer_load_ext buffer_load_partial ' +
      'buffer_copy buffer_fill buffer_get_size buffer_tell buffer_resize ' +
      'buffer_md5 buffer_sha1 buffer_base64_encode buffer_base64_decode ' +
      'buffer_base64_decode_ext buffer_sizeof buffer_get_address ' +
      'buffer_create_from_vertex_buffer ' +
      'buffer_create_from_vertex_buffer_ext buffer_copy_from_vertex_buffer ' +
      'buffer_async_group_begin buffer_async_group_option ' +
      'buffer_async_group_end buffer_load_async buffer_save_async ' +
      'gml_release_mode gml_pragma steam_activate_overlay ' +
      'steam_is_overlay_enabled steam_is_overlay_activated ' +
      'steam_get_persona_name steam_initialised ' +
      'steam_is_cloud_enabled_for_app steam_is_cloud_enabled_for_account ' +
      'steam_file_persisted steam_get_quota_total steam_get_quota_free ' +
      'steam_file_write steam_file_write_file steam_file_read ' +
      'steam_file_delete steam_file_exists steam_file_size steam_file_share ' +
      'steam_is_screenshot_requested steam_send_screenshot ' +
      'steam_is_user_logged_on steam_get_user_steam_id steam_user_owns_dlc ' +
      'steam_user_installed_dlc steam_set_achievement steam_get_achievement ' +
      'steam_clear_achievement steam_set_stat_int steam_set_stat_float ' +
      'steam_set_stat_avg_rate steam_get_stat_int steam_get_stat_float ' +
      'steam_get_stat_avg_rate steam_reset_all_stats ' +
      'steam_reset_all_stats_achievements steam_stats_ready ' +
      'steam_create_leaderboard steam_upload_score steam_upload_score_ext ' +
      'steam_download_scores_around_user steam_download_scores ' +
      'steam_download_friends_scores steam_upload_score_buffer ' +
      'steam_upload_score_buffer_ext steam_current_game_language ' +
      'steam_available_languages steam_activate_overlay_browser ' +
      'steam_activate_overlay_user steam_activate_overlay_store ' +
      'steam_get_user_persona_name steam_get_app_id ' +
      'steam_get_user_account_id steam_ugc_download steam_ugc_create_item ' +
      'steam_ugc_start_item_update steam_ugc_set_item_title ' +
      'steam_ugc_set_item_description steam_ugc_set_item_visibility ' +
      'steam_ugc_set_item_tags steam_ugc_set_item_content ' +
      'steam_ugc_set_item_preview steam_ugc_submit_item_update ' +
      'steam_ugc_get_item_update_progress steam_ugc_subscribe_item ' +
      'steam_ugc_unsubscribe_item steam_ugc_num_subscribed_items ' +
      'steam_ugc_get_subscribed_items steam_ugc_get_item_install_info ' +
      'steam_ugc_get_item_update_info steam_ugc_request_item_details ' +
      'steam_ugc_create_query_user steam_ugc_create_query_user_ex ' +
      'steam_ugc_create_query_all steam_ugc_create_query_all_ex ' +
      'steam_ugc_query_set_cloud_filename_filter ' +
      'steam_ugc_query_set_match_any_tag steam_ugc_query_set_search_text ' +
      'steam_ugc_query_set_ranked_by_trend_days ' +
      'steam_ugc_query_add_required_tag steam_ugc_query_add_excluded_tag ' +
      'steam_ugc_query_set_return_long_description ' +
      'steam_ugc_query_set_return_total_only ' +
      'steam_ugc_query_set_allow_cached_response steam_ugc_send_query ' +
      'shader_set shader_get_name shader_reset shader_current ' +
      'shader_is_compiled shader_get_sampler_index shader_get_uniform ' +
      'shader_set_uniform_i shader_set_uniform_i_array shader_set_uniform_f ' +
      'shader_set_uniform_f_array shader_set_uniform_matrix ' +
      'shader_set_uniform_matrix_array shader_enable_corner_id ' +
      'texture_set_stage texture_get_texel_width texture_get_texel_height ' +
      'shaders_are_supported vertex_format_begin vertex_format_end ' +
      'vertex_format_delete vertex_format_add_position ' +
      'vertex_format_add_position_3d vertex_format_add_colour ' +
      'vertex_format_add_color vertex_format_add_normal ' +
      'vertex_format_add_texcoord vertex_format_add_textcoord ' +
      'vertex_format_add_custom vertex_create_buffer ' +
      'vertex_create_buffer_ext vertex_delete_buffer vertex_begin ' +
      'vertex_end vertex_position vertex_position_3d vertex_colour ' +
      'vertex_color vertex_argb vertex_texcoord vertex_normal vertex_float1 ' +
      'vertex_float2 vertex_float3 vertex_float4 vertex_ubyte4 ' +
      'vertex_submit vertex_freeze vertex_get_number vertex_get_buffer_size ' +
      'vertex_create_buffer_from_buffer ' +
      'vertex_create_buffer_from_buffer_ext push_local_notification ' +
      'push_get_first_local_notification push_get_next_local_notification ' +
      'push_cancel_local_notification skeleton_animation_set ' +
      'skeleton_animation_get skeleton_animation_mix ' +
      'skeleton_animation_set_ext skeleton_animation_get_ext ' +
      'skeleton_animation_get_duration skeleton_animation_get_frames ' +
      'skeleton_animation_clear skeleton_skin_set skeleton_skin_get ' +
      'skeleton_attachment_set skeleton_attachment_get ' +
      'skeleton_attachment_create skeleton_collision_draw_set ' +
      'skeleton_bone_data_get skeleton_bone_data_set ' +
      'skeleton_bone_state_get skeleton_bone_state_set skeleton_get_minmax ' +
      'skeleton_get_num_bounds skeleton_get_bounds ' +
      'skeleton_animation_get_frame skeleton_animation_set_frame ' +
      'draw_skeleton draw_skeleton_time draw_skeleton_instance ' +
      'draw_skeleton_collision skeleton_animation_list skeleton_skin_list ' +
      'skeleton_slot_data layer_get_id layer_get_id_at_depth ' +
      'layer_get_depth layer_create layer_destroy layer_destroy_instances ' +
      'layer_add_instance layer_has_instance layer_set_visible ' +
      'layer_get_visible layer_exists layer_x layer_y layer_get_x ' +
      'layer_get_y layer_hspeed layer_vspeed layer_get_hspeed ' +
      'layer_get_vspeed layer_script_begin layer_script_end layer_shader ' +
      'layer_get_script_begin layer_get_script_end layer_get_shader ' +
      'layer_set_target_room layer_get_target_room layer_reset_target_room ' +
      'layer_get_all layer_get_all_elements layer_get_name layer_depth ' +
      'layer_get_element_layer layer_get_element_type layer_element_move ' +
      'layer_force_draw_depth layer_is_draw_depth_forced ' +
      'layer_get_forced_depth layer_background_get_id ' +
      'layer_background_exists layer_background_create ' +
      'layer_background_destroy layer_background_visible ' +
      'layer_background_change layer_background_sprite ' +
      'layer_background_htiled layer_background_vtiled ' +
      'layer_background_stretch layer_background_yscale ' +
      'layer_background_xscale layer_background_blend ' +
      'layer_background_alpha layer_background_index layer_background_speed ' +
      'layer_background_get_visible layer_background_get_sprite ' +
      'layer_background_get_htiled layer_background_get_vtiled ' +
      'layer_background_get_stretch layer_background_get_yscale ' +
      'layer_background_get_xscale layer_background_get_blend ' +
      'layer_background_get_alpha layer_background_get_index ' +
      'layer_background_get_speed layer_sprite_get_id layer_sprite_exists ' +
      'layer_sprite_create layer_sprite_destroy layer_sprite_change ' +
      'layer_sprite_index layer_sprite_speed layer_sprite_xscale ' +
      'layer_sprite_yscale layer_sprite_angle layer_sprite_blend ' +
      'layer_sprite_alpha layer_sprite_x layer_sprite_y ' +
      'layer_sprite_get_sprite layer_sprite_get_index ' +
      'layer_sprite_get_speed layer_sprite_get_xscale ' +
      'layer_sprite_get_yscale layer_sprite_get_angle ' +
      'layer_sprite_get_blend layer_sprite_get_alpha layer_sprite_get_x ' +
      'layer_sprite_get_y layer_tilemap_get_id layer_tilemap_exists ' +
      'layer_tilemap_create layer_tilemap_destroy tilemap_tileset tilemap_x ' +
      'tilemap_y tilemap_set tilemap_set_at_pixel tilemap_get_tileset ' +
      'tilemap_get_tile_width tilemap_get_tile_height tilemap_get_width ' +
      'tilemap_get_height tilemap_get_x tilemap_get_y tilemap_get ' +
      'tilemap_get_at_pixel tilemap_get_cell_x_at_pixel ' +
      'tilemap_get_cell_y_at_pixel tilemap_clear draw_tilemap draw_tile ' +
      'tilemap_set_global_mask tilemap_get_global_mask tilemap_set_mask ' +
      'tilemap_get_mask tilemap_get_frame tile_set_empty tile_set_index ' +
      'tile_set_flip tile_set_mirror tile_set_rotate tile_get_empty ' +
      'tile_get_index tile_get_flip tile_get_mirror tile_get_rotate ' +
      'layer_tile_exists layer_tile_create layer_tile_destroy ' +
      'layer_tile_change layer_tile_xscale layer_tile_yscale ' +
      'layer_tile_blend layer_tile_alpha layer_tile_x layer_tile_y ' +
      'layer_tile_region layer_tile_visible layer_tile_get_sprite ' +
      'layer_tile_get_xscale layer_tile_get_yscale layer_tile_get_blend ' +
      'layer_tile_get_alpha layer_tile_get_x layer_tile_get_y ' +
      'layer_tile_get_region layer_tile_get_visible ' +
      'layer_instance_get_instance instance_activate_layer ' +
      'instance_deactivate_layer camera_create camera_create_view ' +
      'camera_destroy camera_apply camera_get_active camera_get_default ' +
      'camera_set_default camera_set_view_mat camera_set_proj_mat ' +
      'camera_set_update_script camera_set_begin_script ' +
      'camera_set_end_script camera_set_view_pos camera_set_view_size ' +
      'camera_set_view_speed camera_set_view_border camera_set_view_angle ' +
      'camera_set_view_target camera_get_view_mat camera_get_proj_mat ' +
      'camera_get_update_script camera_get_begin_script ' +
      'camera_get_end_script camera_get_view_x camera_get_view_y ' +
      'camera_get_view_width camera_get_view_height camera_get_view_speed_x ' +
      'camera_get_view_speed_y camera_get_view_border_x ' +
      'camera_get_view_border_y camera_get_view_angle ' +
      'camera_get_view_target view_get_camera view_get_visible ' +
      'view_get_xport view_get_yport view_get_wport view_get_hport ' +
      'view_get_surface_id view_set_camera view_set_visible view_set_xport ' +
      'view_set_yport view_set_wport view_set_hport view_set_surface_id ' +
      'gesture_drag_time gesture_drag_distance gesture_flick_speed ' +
      'gesture_double_tap_time gesture_double_tap_distance ' +
      'gesture_pinch_distance gesture_pinch_angle_towards ' +
      'gesture_pinch_angle_away gesture_rotate_time gesture_rotate_angle ' +
      'gesture_tap_count gesture_get_drag_time gesture_get_drag_distance ' +
      'gesture_get_flick_speed gesture_get_double_tap_time ' +
      'gesture_get_double_tap_distance gesture_get_pinch_distance ' +
      'gesture_get_pinch_angle_towards gesture_get_pinch_angle_away ' +
      'gesture_get_rotate_time gesture_get_rotate_angle ' +
      'gesture_get_tap_count keyboard_virtual_show keyboard_virtual_hide ' +
      'keyboard_virtual_status keyboard_virtual_height',
    literal: 'self other all noone global local undefined pointer_invalid ' +
      'pointer_null path_action_stop path_action_restart ' +
      'path_action_continue path_action_reverse true false pi GM_build_date ' +
      'GM_version GM_runtime_version  timezone_local timezone_utc ' +
      'gamespeed_fps gamespeed_microseconds  ev_create ev_destroy ev_step ' +
      'ev_alarm ev_keyboard ev_mouse ev_collision ev_other ev_draw ' +
      'ev_draw_begin ev_draw_end ev_draw_pre ev_draw_post ev_keypress ' +
      'ev_keyrelease ev_trigger ev_left_button ev_right_button ' +
      'ev_middle_button ev_no_button ev_left_press ev_right_press ' +
      'ev_middle_press ev_left_release ev_right_release ev_middle_release ' +
      'ev_mouse_enter ev_mouse_leave ev_mouse_wheel_up ev_mouse_wheel_down ' +
      'ev_global_left_button ev_global_right_button ev_global_middle_button ' +
      'ev_global_left_press ev_global_right_press ev_global_middle_press ' +
      'ev_global_left_release ev_global_right_release ' +
      'ev_global_middle_release ev_joystick1_left ev_joystick1_right ' +
      'ev_joystick1_up ev_joystick1_down ev_joystick1_button1 ' +
      'ev_joystick1_button2 ev_joystick1_button3 ev_joystick1_button4 ' +
      'ev_joystick1_button5 ev_joystick1_button6 ev_joystick1_button7 ' +
      'ev_joystick1_button8 ev_joystick2_left ev_joystick2_right ' +
      'ev_joystick2_up ev_joystick2_down ev_joystick2_button1 ' +
      'ev_joystick2_button2 ev_joystick2_button3 ev_joystick2_button4 ' +
      'ev_joystick2_button5 ev_joystick2_button6 ev_joystick2_button7 ' +
      'ev_joystick2_button8 ev_outside ev_boundary ev_game_start ' +
      'ev_game_end ev_room_start ev_room_end ev_no_more_lives ' +
      'ev_animation_end ev_end_of_path ev_no_more_health ev_close_button ' +
      'ev_user0 ev_user1 ev_user2 ev_user3 ev_user4 ev_user5 ev_user6 ' +
      'ev_user7 ev_user8 ev_user9 ev_user10 ev_user11 ev_user12 ev_user13 ' +
      'ev_user14 ev_user15 ev_step_normal ev_step_begin ev_step_end ev_gui ' +
      'ev_gui_begin ev_gui_end ev_cleanup ev_gesture ev_gesture_tap ' +
      'ev_gesture_double_tap ev_gesture_drag_start ev_gesture_dragging ' +
      'ev_gesture_drag_end ev_gesture_flick ev_gesture_pinch_start ' +
      'ev_gesture_pinch_in ev_gesture_pinch_out ev_gesture_pinch_end ' +
      'ev_gesture_rotate_start ev_gesture_rotating ev_gesture_rotate_end ' +
      'ev_global_gesture_tap ev_global_gesture_double_tap ' +
      'ev_global_gesture_drag_start ev_global_gesture_dragging ' +
      'ev_global_gesture_drag_end ev_global_gesture_flick ' +
      'ev_global_gesture_pinch_start ev_global_gesture_pinch_in ' +
      'ev_global_gesture_pinch_out ev_global_gesture_pinch_end ' +
      'ev_global_gesture_rotate_start ev_global_gesture_rotating ' +
      'ev_global_gesture_rotate_end vk_nokey vk_anykey vk_enter vk_return ' +
      'vk_shift vk_control vk_alt vk_escape vk_space vk_backspace vk_tab ' +
      'vk_pause vk_printscreen vk_left vk_right vk_up vk_down vk_home ' +
      'vk_end vk_delete vk_insert vk_pageup vk_pagedown vk_f1 vk_f2 vk_f3 ' +
      'vk_f4 vk_f5 vk_f6 vk_f7 vk_f8 vk_f9 vk_f10 vk_f11 vk_f12 vk_numpad0 ' +
      'vk_numpad1 vk_numpad2 vk_numpad3 vk_numpad4 vk_numpad5 vk_numpad6 ' +
      'vk_numpad7 vk_numpad8 vk_numpad9 vk_divide vk_multiply vk_subtract ' +
      'vk_add vk_decimal vk_lshift vk_lcontrol vk_lalt vk_rshift ' +
      'vk_rcontrol vk_ralt  mb_any mb_none mb_left mb_right mb_middle ' +
      'c_aqua c_black c_blue c_dkgray c_fuchsia c_gray c_green c_lime ' +
      'c_ltgray c_maroon c_navy c_olive c_purple c_red c_silver c_teal ' +
      'c_white c_yellow c_orange fa_left fa_center fa_right fa_top ' +
      'fa_middle fa_bottom pr_pointlist pr_linelist pr_linestrip ' +
      'pr_trianglelist pr_trianglestrip pr_trianglefan bm_complex bm_normal ' +
      'bm_add bm_max bm_subtract bm_zero bm_one bm_src_colour ' +
      'bm_inv_src_colour bm_src_color bm_inv_src_color bm_src_alpha ' +
      'bm_inv_src_alpha bm_dest_alpha bm_inv_dest_alpha bm_dest_colour ' +
      'bm_inv_dest_colour bm_dest_color bm_inv_dest_color bm_src_alpha_sat ' +
      'tf_point tf_linear tf_anisotropic mip_off mip_on mip_markedonly ' +
      'audio_falloff_none audio_falloff_inverse_distance ' +
      'audio_falloff_inverse_distance_clamped audio_falloff_linear_distance ' +
      'audio_falloff_linear_distance_clamped ' +
      'audio_falloff_exponent_distance ' +
      'audio_falloff_exponent_distance_clamped audio_old_system ' +
      'audio_new_system audio_mono audio_stereo audio_3d cr_default cr_none ' +
      'cr_arrow cr_cross cr_beam cr_size_nesw cr_size_ns cr_size_nwse ' +
      'cr_size_we cr_uparrow cr_hourglass cr_drag cr_appstart cr_handpoint ' +
      'cr_size_all spritespeed_framespersecond ' +
      'spritespeed_framespergameframe asset_object asset_unknown ' +
      'asset_sprite asset_sound asset_room asset_path asset_script ' +
      'asset_font asset_timeline asset_tiles asset_shader fa_readonly ' +
      'fa_hidden fa_sysfile fa_volumeid fa_directory fa_archive  ' +
      'ds_type_map ds_type_list ds_type_stack ds_type_queue ds_type_grid ' +
      'ds_type_priority ef_explosion ef_ring ef_ellipse ef_firework ' +
      'ef_smoke ef_smokeup ef_star ef_spark ef_flare ef_cloud ef_rain ' +
      'ef_snow pt_shape_pixel pt_shape_disk pt_shape_square pt_shape_line ' +
      'pt_shape_star pt_shape_circle pt_shape_ring pt_shape_sphere ' +
      'pt_shape_flare pt_shape_spark pt_shape_explosion pt_shape_cloud ' +
      'pt_shape_smoke pt_shape_snow ps_distr_linear ps_distr_gaussian ' +
      'ps_distr_invgaussian ps_shape_rectangle ps_shape_ellipse ' +
      'ps_shape_diamond ps_shape_line ty_real ty_string dll_cdecl ' +
      'dll_stdcall matrix_view matrix_projection matrix_world os_win32 ' +
      'os_windows os_macosx os_ios os_android os_symbian os_linux ' +
      'os_unknown os_winphone os_tizen os_win8native ' +
      'os_wiiu os_3ds  os_psvita os_bb10 os_ps4 os_xboxone ' +
      'os_ps3 os_xbox360 os_uwp os_tvos os_switch ' +
      'browser_not_a_browser browser_unknown browser_ie browser_firefox ' +
      'browser_chrome browser_safari browser_safari_mobile browser_opera ' +
      'browser_tizen browser_edge browser_windows_store browser_ie_mobile  ' +
      'device_ios_unknown device_ios_iphone device_ios_iphone_retina ' +
      'device_ios_ipad device_ios_ipad_retina device_ios_iphone5 ' +
      'device_ios_iphone6 device_ios_iphone6plus device_emulator ' +
      'device_tablet display_landscape display_landscape_flipped ' +
      'display_portrait display_portrait_flipped tm_sleep tm_countvsyncs ' +
      'of_challenge_win of_challen ge_lose of_challenge_tie ' +
      'leaderboard_type_number leaderboard_type_time_mins_secs ' +
      'cmpfunc_never cmpfunc_less cmpfunc_equal cmpfunc_lessequal ' +
      'cmpfunc_greater cmpfunc_notequal cmpfunc_greaterequal cmpfunc_always ' +
      'cull_noculling cull_clockwise cull_counterclockwise lighttype_dir ' +
      'lighttype_point iap_ev_storeload iap_ev_product iap_ev_purchase ' +
      'iap_ev_consume iap_ev_restore iap_storeload_ok iap_storeload_failed ' +
      'iap_status_uninitialised iap_status_unavailable iap_status_loading ' +
      'iap_status_available iap_status_processing iap_status_restoring ' +
      'iap_failed iap_unavailable iap_available iap_purchased iap_canceled ' +
      'iap_refunded fb_login_default fb_login_fallback_to_webview ' +
      'fb_login_no_fallback_to_webview fb_login_forcing_webview ' +
      'fb_login_use_system_account fb_login_forcing_safari  ' +
      'phy_joint_anchor_1_x phy_joint_anchor_1_y phy_joint_anchor_2_x ' +
      'phy_joint_anchor_2_y phy_joint_reaction_force_x ' +
      'phy_joint_reaction_force_y phy_joint_reaction_torque ' +
      'phy_joint_motor_speed phy_joint_angle phy_joint_motor_torque ' +
      'phy_joint_max_motor_torque phy_joint_translation phy_joint_speed ' +
      'phy_joint_motor_force phy_joint_max_motor_force phy_joint_length_1 ' +
      'phy_joint_length_2 phy_joint_damping_ratio phy_joint_frequency ' +
      'phy_joint_lower_angle_limit phy_joint_upper_angle_limit ' +
      'phy_joint_angle_limits phy_joint_max_length phy_joint_max_torque ' +
      'phy_joint_max_force phy_debug_render_aabb ' +
      'phy_debug_render_collision_pairs phy_debug_render_coms ' +
      'phy_debug_render_core_shapes phy_debug_render_joints ' +
      'phy_debug_render_obb phy_debug_render_shapes  ' +
      'phy_particle_flag_water phy_particle_flag_zombie ' +
      'phy_particle_flag_wall phy_particle_flag_spring ' +
      'phy_particle_flag_elastic phy_particle_flag_viscous ' +
      'phy_particle_flag_powder phy_particle_flag_tensile ' +
      'phy_particle_flag_colourmixing phy_particle_flag_colormixing ' +
      'phy_particle_group_flag_solid phy_particle_group_flag_rigid ' +
      'phy_particle_data_flag_typeflags phy_particle_data_flag_position ' +
      'phy_particle_data_flag_velocity phy_particle_data_flag_colour ' +
      'phy_particle_data_flag_color phy_particle_data_flag_category  ' +
      'achievement_our_info achievement_friends_info ' +
      'achievement_leaderboard_info achievement_achievement_info ' +
      'achievement_filter_all_players achievement_filter_friends_only ' +
      'achievement_filter_favorites_only ' +
      'achievement_type_achievement_challenge ' +
      'achievement_type_score_challenge achievement_pic_loaded  ' +
      'achievement_show_ui achievement_show_profile ' +
      'achievement_show_leaderboard achievement_show_achievement ' +
      'achievement_show_bank achievement_show_friend_picker ' +
      'achievement_show_purchase_prompt network_socket_tcp ' +
      'network_socket_udp network_socket_bluetooth network_type_connect ' +
      'network_type_disconnect network_type_data ' +
      'network_type_non_blocking_connect network_config_connect_timeout ' +
      'network_config_use_non_blocking_socket ' +
      'network_config_enable_reliable_udp ' +
      'network_config_disable_reliable_udp buffer_fixed buffer_grow ' +
      'buffer_wrap buffer_fast buffer_vbuffer buffer_network buffer_u8 ' +
      'buffer_s8 buffer_u16 buffer_s16 buffer_u32 buffer_s32 buffer_u64 ' +
      'buffer_f16 buffer_f32 buffer_f64 buffer_bool buffer_text ' +
      'buffer_string buffer_surface_copy buffer_seek_start ' +
      'buffer_seek_relative buffer_seek_end ' +
      'buffer_generalerror buffer_outofspace buffer_outofbounds ' +
      'buffer_invalidtype  text_type button_type input_type ANSI_CHARSET ' +
      'DEFAULT_CHARSET EASTEUROPE_CHARSET RUSSIAN_CHARSET SYMBOL_CHARSET ' +
      'SHIFTJIS_CHARSET HANGEUL_CHARSET GB2312_CHARSET CHINESEBIG5_CHARSET ' +
      'JOHAB_CHARSET HEBREW_CHARSET ARABIC_CHARSET GREEK_CHARSET ' +
      'TURKISH_CHARSET VIETNAMESE_CHARSET THAI_CHARSET MAC_CHARSET ' +
      'BALTIC_CHARSET OEM_CHARSET  gp_face1 gp_face2 gp_face3 gp_face4 ' +
      'gp_shoulderl gp_shoulderr gp_shoulderlb gp_shoulderrb gp_select ' +
      'gp_start gp_stickl gp_stickr gp_padu gp_padd gp_padl gp_padr ' +
      'gp_axislh gp_axislv gp_axisrh gp_axisrv ov_friends ov_community ' +
      'ov_players ov_settings ov_gamegroup ov_achievements lb_sort_none ' +
      'lb_sort_ascending lb_sort_descending lb_disp_none lb_disp_numeric ' +
      'lb_disp_time_sec lb_disp_time_ms ugc_result_success ' +
      'ugc_filetype_community ugc_filetype_microtrans ugc_visibility_public ' +
      'ugc_visibility_friends_only ugc_visibility_private ' +
      'ugc_query_RankedByVote ugc_query_RankedByPublicationDate ' +
      'ugc_query_AcceptedForGameRankedByAcceptanceDate ' +
      'ugc_query_RankedByTrend ' +
      'ugc_query_FavoritedByFriendsRankedByPublicationDate ' +
      'ugc_query_CreatedByFriendsRankedByPublicationDate ' +
      'ugc_query_RankedByNumTimesReported ' +
      'ugc_query_CreatedByFollowedUsersRankedByPublicationDate ' +
      'ugc_query_NotYetRated ugc_query_RankedByTotalVotesAsc ' +
      'ugc_query_RankedByVotesUp ugc_query_RankedByTextSearch ' +
      'ugc_sortorder_CreationOrderDesc ugc_sortorder_CreationOrderAsc ' +
      'ugc_sortorder_TitleAsc ugc_sortorder_LastUpdatedDesc ' +
      'ugc_sortorder_SubscriptionDateDesc ugc_sortorder_VoteScoreDesc ' +
      'ugc_sortorder_ForModeration ugc_list_Published ugc_list_VotedOn ' +
      'ugc_list_VotedUp ugc_list_VotedDown ugc_list_WillVoteLater ' +
      'ugc_list_Favorited ugc_list_Subscribed ugc_list_UsedOrPlayed ' +
      'ugc_list_Followed ugc_match_Items ugc_match_Items_Mtx ' +
      'ugc_match_Items_ReadyToUse ugc_match_Collections ugc_match_Artwork ' +
      'ugc_match_Videos ugc_match_Screenshots ugc_match_AllGuides ' +
      'ugc_match_WebGuides ugc_match_IntegratedGuides ' +
      'ugc_match_UsableInGame ugc_match_ControllerBindings  ' +
      'vertex_usage_position vertex_usage_colour vertex_usage_color ' +
      'vertex_usage_normal vertex_usage_texcoord vertex_usage_textcoord ' +
      'vertex_usage_blendweight vertex_usage_blendindices ' +
      'vertex_usage_psize vertex_usage_tangent vertex_usage_binormal ' +
      'vertex_usage_fog vertex_usage_depth vertex_usage_sample ' +
      'vertex_type_float1 vertex_type_float2 vertex_type_float3 ' +
      'vertex_type_float4 vertex_type_colour vertex_type_color ' +
      'vertex_type_ubyte4 layerelementtype_undefined ' +
      'layerelementtype_background layerelementtype_instance ' +
      'layerelementtype_oldtilemap layerelementtype_sprite ' +
      'layerelementtype_tilemap layerelementtype_particlesystem ' +
      'layerelementtype_tile tile_rotate tile_flip tile_mirror ' +
      'tile_index_mask kbv_type_default kbv_type_ascii kbv_type_url ' +
      'kbv_type_email kbv_type_numbers kbv_type_phone kbv_type_phone_name ' +
      'kbv_returnkey_default kbv_returnkey_go kbv_returnkey_google ' +
      'kbv_returnkey_join kbv_returnkey_next kbv_returnkey_route ' +
      'kbv_returnkey_search kbv_returnkey_send kbv_returnkey_yahoo ' +
      'kbv_returnkey_done kbv_returnkey_continue kbv_returnkey_emergency ' +
      'kbv_autocapitalize_none kbv_autocapitalize_words ' +
      'kbv_autocapitalize_sentences kbv_autocapitalize_characters',
    symbol: 'argument_relative argument argument0 argument1 argument2 ' +
      'argument3 argument4 argument5 argument6 argument7 argument8 ' +
      'argument9 argument10 argument11 argument12 argument13 argument14 ' +
      'argument15 argument_count x y xprevious yprevious xstart ystart ' +
      'hspeed vspeed direction speed friction gravity gravity_direction ' +
      'path_index path_position path_positionprevious path_speed ' +
      'path_scale path_orientation path_endaction object_index id solid ' +
      'persistent mask_index instance_count instance_id room_speed fps ' +
      'fps_real current_time current_year current_month current_day ' +
      'current_weekday current_hour current_minute current_second alarm ' +
      'timeline_index timeline_position timeline_speed timeline_running ' +
      'timeline_loop room room_first room_last room_width room_height ' +
      'room_caption room_persistent score lives health show_score ' +
      'show_lives show_health caption_score caption_lives caption_health ' +
      'event_type event_number event_object event_action ' +
      'application_surface gamemaker_pro gamemaker_registered ' +
      'gamemaker_version error_occurred error_last debug_mode ' +
      'keyboard_key keyboard_lastkey keyboard_lastchar keyboard_string ' +
      'mouse_x mouse_y mouse_button mouse_lastbutton cursor_sprite ' +
      'visible sprite_index sprite_width sprite_height sprite_xoffset ' +
      'sprite_yoffset image_number image_index image_speed depth ' +
      'image_xscale image_yscale image_angle image_alpha image_blend ' +
      'bbox_left bbox_right bbox_top bbox_bottom layer background_colour  ' +
      'background_showcolour background_color background_showcolor ' +
      'view_enabled view_current view_visible view_xview view_yview ' +
      'view_wview view_hview view_xport view_yport view_wport view_hport ' +
      'view_angle view_hborder view_vborder view_hspeed view_vspeed ' +
      'view_object view_surface_id view_camera game_id game_display_name ' +
      'game_project_name game_save_id working_directory temp_directory ' +
      'program_directory browser_width browser_height os_type os_device ' +
      'os_browser os_version display_aa async_load delta_time ' +
      'webgl_enabled event_data iap_data phy_rotation phy_position_x ' +
      'phy_position_y phy_angular_velocity phy_linear_velocity_x ' +
      'phy_linear_velocity_y phy_speed_x phy_speed_y phy_speed ' +
      'phy_angular_damping phy_linear_damping phy_bullet ' +
      'phy_fixed_rotation phy_active phy_mass phy_inertia phy_com_x ' +
      'phy_com_y phy_dynamic phy_kinematic phy_sleeping ' +
      'phy_collision_points phy_collision_x phy_collision_y ' +
      'phy_col_normal_x phy_col_normal_y phy_position_xprevious ' +
      'phy_position_yprevious'
  };

  return {
    aliases: ['gml', 'GML'],
    case_insensitive: false, // language is case-insensitive
    keywords: GML_KEYWORDS,

    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.C_NUMBER_MODE
    ]
  };
};

var go = function(hljs) {
  var GO_KEYWORDS = {
    keyword:
      'break default func interface select case map struct chan else goto package switch ' +
      'const fallthrough if range type continue for import return var go defer ' +
      'bool byte complex64 complex128 float32 float64 int8 int16 int32 int64 string uint8 ' +
      'uint16 uint32 uint64 int uint uintptr rune',
    literal:
       'true false iota nil',
    built_in:
      'append cap close complex copy imag len make new panic print println real recover delete'
  };
  return {
    aliases: ['golang'],
    keywords: GO_KEYWORDS,
    illegal: '</',
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: 'string',
        variants: [
          hljs.QUOTE_STRING_MODE,
          {begin: '\'', end: '[^\\\\]\''},
          {begin: '`', end: '`'},
        ]
      },
      {
        className: 'number',
        variants: [
          {begin: hljs.C_NUMBER_RE + '[dflsi]', relevance: 1},
          hljs.C_NUMBER_MODE
        ]
      },
      {
        begin: /:=/ // relevance booster
      },
      {
        className: 'function',
        beginKeywords: 'func', end: /\s*\{/, excludeEnd: true,
        contains: [
          hljs.TITLE_MODE,
          {
            className: 'params',
            begin: /\(/, end: /\)/,
            keywords: GO_KEYWORDS,
            illegal: /["']/
          }
        ]
      }
    ]
  };
};

var golo = function(hljs) {
    return {
      keywords: {
        keyword:
          'println readln print import module function local return let var ' +
          'while for foreach times in case when match with break continue ' +
          'augment augmentation each find filter reduce ' +
          'if then else otherwise try catch finally raise throw orIfNull ' +
          'DynamicObject|10 DynamicVariable struct Observable map set vector list array',
        literal:
          'true false null'
      },
      contains: [
        hljs.HASH_COMMENT_MODE,
        hljs.QUOTE_STRING_MODE,
        hljs.C_NUMBER_MODE,
        {
          className: 'meta', begin: '@[A-Za-z]+'
        }
      ]
    }
};

var gradle = function(hljs) {
  return {
    case_insensitive: true,
    keywords: {
      keyword:
        'task project allprojects subprojects artifacts buildscript configurations ' +
        'dependencies repositories sourceSets description delete from into include ' +
        'exclude source classpath destinationDir includes options sourceCompatibility ' +
        'targetCompatibility group flatDir doLast doFirst flatten todir fromdir ant ' +
        'def abstract break case catch continue default do else extends final finally ' +
        'for if implements instanceof native new private protected public return static ' +
        'switch synchronized throw throws transient try volatile while strictfp package ' +
        'import false null super this true antlrtask checkstyle codenarc copy boolean ' +
        'byte char class double float int interface long short void compile runTime ' +
        'file fileTree abs any append asList asWritable call collect compareTo count ' +
        'div dump each eachByte eachFile eachLine every find findAll flatten getAt ' +
        'getErr getIn getOut getText grep immutable inject inspect intersect invokeMethods ' +
        'isCase join leftShift minus multiply newInputStream newOutputStream newPrintWriter ' +
        'newReader newWriter next plus pop power previous print println push putAt read ' +
        'readBytes readLines reverse reverseEach round size sort splitEachLine step subMap ' +
        'times toInteger toList tokenize upto waitForOrKill withPrintWriter withReader ' +
        'withStream withWriter withWriterAppend write writeLine'
    },
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.NUMBER_MODE,
      hljs.REGEXP_MODE

    ]
  }
};

var groovy = function(hljs) {
    return {
        keywords: {
            literal : 'true false null',
            keyword:
            'byte short char int long boolean float double void ' +
            // groovy specific keywords
            'def as in assert trait ' +
            // common keywords with Java
            'super this abstract static volatile transient public private protected synchronized final ' +
            'class interface enum if else for while switch case break default continue ' +
            'throw throws try catch finally implements extends new import package return instanceof'
        },

        contains: [
            hljs.COMMENT(
                '/\\*\\*',
                '\\*/',
                {
                    relevance : 0,
                    contains : [
                      {
                          // eat up @'s in emails to prevent them to be recognized as doctags
                          begin: /\w+@/, relevance: 0
                      },
                      {
                          className : 'doctag',
                          begin : '@[A-Za-z]+'
                      }
                    ]
                }
            ),
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            {
                className: 'string',
                begin: '"""', end: '"""'
            },
            {
                className: 'string',
                begin: "'''", end: "'''"
            },
            {
                className: 'string',
                begin: "\\$/", end: "/\\$",
                relevance: 10
            },
            hljs.APOS_STRING_MODE,
            {
                className: 'regexp',
                begin: /~?\/[^\/\n]+\//,
                contains: [
                    hljs.BACKSLASH_ESCAPE
                ]
            },
            hljs.QUOTE_STRING_MODE,
            {
                className: 'meta',
                begin: "^#!/usr/bin/env", end: '$',
                illegal: '\n'
            },
            hljs.BINARY_NUMBER_MODE,
            {
                className: 'class',
                beginKeywords: 'class interface trait enum', end: '{',
                illegal: ':',
                contains: [
                    {beginKeywords: 'extends implements'},
                    hljs.UNDERSCORE_TITLE_MODE
                ]
            },
            hljs.C_NUMBER_MODE,
            {
                className: 'meta', begin: '@[A-Za-z]+'
            },
            {
                // highlight map keys and named parameters as strings
                className: 'string', begin: /[^\?]{0}[A-Za-z0-9_$]+ *:/
            },
            {
                // catch middle element of the ternary operator
                // to avoid highlight it as a label, named parameter, or map key
                begin: /\?/, end: /\:/
            },
            {
                // highlight labeled statements
                className: 'symbol', begin: '^\\s*[A-Za-z0-9_$]+:',
                relevance: 0
            }
        ],
        illegal: /#|<\//
    }
};

var haml = // TODO support filter tags like :javascript, support inline HTML
function(hljs) {
  return {
    case_insensitive: true,
    contains: [
      {
        className: 'meta',
        begin: '^!!!( (5|1\\.1|Strict|Frameset|Basic|Mobile|RDFa|XML\\b.*))?$',
        relevance: 10
      },
      // FIXME these comments should be allowed to span indented lines
      hljs.COMMENT(
        '^\\s*(!=#|=#|-#|/).*$',
        false,
        {
          relevance: 0
        }
      ),
      {
        begin: '^\\s*(-|=|!=)(?!#)',
        starts: {
          end: '\\n',
          subLanguage: 'ruby'
        }
      },
      {
        className: 'tag',
        begin: '^\\s*%',
        contains: [
          {
            className: 'selector-tag',
            begin: '\\w+'
          },
          {
            className: 'selector-id',
            begin: '#[\\w-]+'
          },
          {
            className: 'selector-class',
            begin: '\\.[\\w-]+'
          },
          {
            begin: '{\\s*',
            end: '\\s*}',
            contains: [
              {
                begin: ':\\w+\\s*=>',
                end: ',\\s+',
                returnBegin: true,
                endsWithParent: true,
                contains: [
                  {
                    className: 'attr',
                    begin: ':\\w+'
                  },
                  hljs.APOS_STRING_MODE,
                  hljs.QUOTE_STRING_MODE,
                  {
                    begin: '\\w+',
                    relevance: 0
                  }
                ]
              }
            ]
          },
          {
            begin: '\\(\\s*',
            end: '\\s*\\)',
            excludeEnd: true,
            contains: [
              {
                begin: '\\w+\\s*=',
                end: '\\s+',
                returnBegin: true,
                endsWithParent: true,
                contains: [
                  {
                    className: 'attr',
                    begin: '\\w+',
                    relevance: 0
                  },
                  hljs.APOS_STRING_MODE,
                  hljs.QUOTE_STRING_MODE,
                  {
                    begin: '\\w+',
                    relevance: 0
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        begin: '^\\s*[=~]\\s*'
      },
      {
        begin: '#{',
        starts: {
          end: '}',
          subLanguage: 'ruby'
        }
      }
    ]
  };
};

var handlebars = function(hljs) {
  var BUILT_INS = {'builtin-name': 'each in with if else unless bindattr action collection debugger log outlet template unbound view yield'};
  return {
    aliases: ['hbs', 'html.hbs', 'html.handlebars'],
    case_insensitive: true,
    subLanguage: 'xml',
    contains: [
    hljs.COMMENT('{{!(--)?', '(--)?}}'),
      {
        className: 'template-tag',
        begin: /\{\{[#\/]/, end: /\}\}/,
        contains: [
          {
            className: 'name',
            begin: /[a-zA-Z\.-]+/,
            keywords: BUILT_INS,
            starts: {
              endsWithParent: true, relevance: 0,
              contains: [
                hljs.QUOTE_STRING_MODE
              ]
            }
          }
        ]
      },
      {
        className: 'template-variable',
        begin: /\{\{/, end: /\}\}/,
        keywords: BUILT_INS
      }
    ]
  };
};

var haskell = function(hljs) {
  var COMMENT = {
    variants: [
      hljs.COMMENT('--', '$'),
      hljs.COMMENT(
        '{-',
        '-}',
        {
          contains: ['self']
        }
      )
    ]
  };

  var PRAGMA = {
    className: 'meta',
    begin: '{-#', end: '#-}'
  };

  var PREPROCESSOR = {
    className: 'meta',
    begin: '^#', end: '$'
  };

  var CONSTRUCTOR = {
    className: 'type',
    begin: '\\b[A-Z][\\w\']*', // TODO: other constructors (build-in, infix).
    relevance: 0
  };

  var LIST = {
    begin: '\\(', end: '\\)',
    illegal: '"',
    contains: [
      PRAGMA,
      PREPROCESSOR,
      {className: 'type', begin: '\\b[A-Z][\\w]*(\\((\\.\\.|,|\\w+)\\))?'},
      hljs.inherit(hljs.TITLE_MODE, {begin: '[_a-z][\\w\']*'}),
      COMMENT
    ]
  };

  var RECORD = {
    begin: '{', end: '}',
    contains: LIST.contains
  };

  return {
    aliases: ['hs'],
    keywords:
      'let in if then else case of where do module import hiding ' +
      'qualified type data newtype deriving class instance as default ' +
      'infix infixl infixr foreign export ccall stdcall cplusplus ' +
      'jvm dotnet safe unsafe family forall mdo proc rec',
    contains: [

      // Top-level constructions.

      {
        beginKeywords: 'module', end: 'where',
        keywords: 'module where',
        contains: [LIST, COMMENT],
        illegal: '\\W\\.|;'
      },
      {
        begin: '\\bimport\\b', end: '$',
        keywords: 'import qualified as hiding',
        contains: [LIST, COMMENT],
        illegal: '\\W\\.|;'
      },

      {
        className: 'class',
        begin: '^(\\s*)?(class|instance)\\b', end: 'where',
        keywords: 'class family instance where',
        contains: [CONSTRUCTOR, LIST, COMMENT]
      },
      {
        className: 'class',
        begin: '\\b(data|(new)?type)\\b', end: '$',
        keywords: 'data family type newtype deriving',
        contains: [PRAGMA, CONSTRUCTOR, LIST, RECORD, COMMENT]
      },
      {
        beginKeywords: 'default', end: '$',
        contains: [CONSTRUCTOR, LIST, COMMENT]
      },
      {
        beginKeywords: 'infix infixl infixr', end: '$',
        contains: [hljs.C_NUMBER_MODE, COMMENT]
      },
      {
        begin: '\\bforeign\\b', end: '$',
        keywords: 'foreign import export ccall stdcall cplusplus jvm ' +
                  'dotnet safe unsafe',
        contains: [CONSTRUCTOR, hljs.QUOTE_STRING_MODE, COMMENT]
      },
      {
        className: 'meta',
        begin: '#!\\/usr\\/bin\\/env\ runhaskell', end: '$'
      },

      // "Whitespaces".

      PRAGMA,
      PREPROCESSOR,

      // Literals and names.

      // TODO: characters.
      hljs.QUOTE_STRING_MODE,
      hljs.C_NUMBER_MODE,
      CONSTRUCTOR,
      hljs.inherit(hljs.TITLE_MODE, {begin: '^[_a-z][\\w\']*'}),

      COMMENT,

      {begin: '->|<-'} // No markup, relevance booster
    ]
  };
};

var haxe = function(hljs) {

  var HAXE_BASIC_TYPES = 'Int Float String Bool Dynamic Void Array ';

  return {
    aliases: ['hx'],
    keywords: {
      keyword: 'break case cast catch continue default do dynamic else enum extern ' +
               'for function here if import in inline never new override package private get set ' +
               'public return static super switch this throw trace try typedef untyped using var while ' +
               HAXE_BASIC_TYPES,
      built_in:
        'trace this',
      literal:
        'true false null _'
    },
    contains: [
      { className: 'string', // interpolate-able strings
        begin: '\'', end: '\'',
        contains: [
          hljs.BACKSLASH_ESCAPE,
          { className: 'subst', // interpolation
            begin: '\\$\\{', end: '\\}'
          },
          { className: 'subst', // interpolation
            begin: '\\$', end: '\\W}'
          }
        ]
      },
      hljs.QUOTE_STRING_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.C_NUMBER_MODE,
      { className: 'meta', // compiler meta
        begin: '@:', end: '$'
      },
      { className: 'meta', // compiler conditionals
        begin: '#', end: '$',
        keywords: {'meta-keyword': 'if else elseif end error'}
      },
      { className: 'type', // function types
        begin: ':[ \t]*', end: '[^A-Za-z0-9_ \t\\->]',
        excludeBegin: true, excludeEnd: true,
        relevance: 0
      },
      { className: 'type', // types
        begin: ':[ \t]*', end: '\\W',
        excludeBegin: true, excludeEnd: true
      },
      { className: 'type', // instantiation
        begin: 'new *', end: '\\W',
        excludeBegin: true, excludeEnd: true
      },
      { className: 'class', // enums
        beginKeywords: 'enum', end: '\\{',
        contains: [
          hljs.TITLE_MODE
        ]
      },
      { className: 'class', // abstracts
        beginKeywords: 'abstract', end: '[\\{$]',
        contains: [
          { className: 'type',
            begin: '\\(', end: '\\)',
            excludeBegin: true, excludeEnd: true
          },
          { className: 'type',
            begin: 'from +', end: '\\W',
            excludeBegin: true, excludeEnd: true
          },
          { className: 'type',
            begin: 'to +', end: '\\W',
            excludeBegin: true, excludeEnd: true
          },
          hljs.TITLE_MODE
        ],
        keywords: {
          keyword: 'abstract from to'
        }
      },
      { className: 'class', // classes
        begin: '\\b(class|interface) +', end: '[\\{$]',  excludeEnd: true,
        keywords: 'class interface',
        contains: [
          { className: 'keyword',
            begin: '\\b(extends|implements) +',
            keywords: 'extends implements',
            contains: [
              {
                className: 'type',
                begin: hljs.IDENT_RE,
                relevance: 0
              }
            ]
          },
          hljs.TITLE_MODE
        ]
      },
      { className: 'function',
        beginKeywords: 'function', end: '\\(', excludeEnd: true,
        illegal: '\\S',
        contains: [
          hljs.TITLE_MODE
        ]
      }
    ],
    illegal: /<\//
  };
};

var hsp = function(hljs) {
  return {
    case_insensitive: true,
    lexemes: /[\w\._]+/,
    keywords: 'goto gosub return break repeat loop continue wait await dim sdim foreach dimtype dup dupptr end stop newmod delmod mref run exgoto on mcall assert logmes newlab resume yield onexit onerror onkey onclick oncmd exist delete mkdir chdir dirlist bload bsave bcopy memfile if else poke wpoke lpoke getstr chdpm memexpand memcpy memset notesel noteadd notedel noteload notesave randomize noteunsel noteget split strrep setease button chgdisp exec dialog mmload mmplay mmstop mci pset pget syscolor mes print title pos circle cls font sysfont objsize picload color palcolor palette redraw width gsel gcopy gzoom gmode bmpsave hsvcolor getkey listbox chkbox combox input mesbox buffer screen bgscr mouse objsel groll line clrobj boxf objprm objmode stick grect grotate gsquare gradf objimage objskip objenable celload celdiv celput newcom querycom delcom cnvstow comres axobj winobj sendmsg comevent comevarg sarrayconv callfunc cnvwtos comevdisp libptr system hspstat hspver stat cnt err strsize looplev sublev iparam wparam lparam refstr refdval int rnd strlen length length2 length3 length4 vartype gettime peek wpeek lpeek varptr varuse noteinfo instr abs limit getease str strmid strf getpath strtrim sin cos tan atan sqrt double absf expf logf limitf powf geteasef mousex mousey mousew hwnd hinstance hdc ginfo objinfo dirinfo sysinfo thismod __hspver__ __hsp30__ __date__ __time__ __line__ __file__ _debug __hspdef__ and or xor not screen_normal screen_palette screen_hide screen_fixedsize screen_tool screen_frame gmode_gdi gmode_mem gmode_rgb0 gmode_alpha gmode_rgb0alpha gmode_add gmode_sub gmode_pixela ginfo_mx ginfo_my ginfo_act ginfo_sel ginfo_wx1 ginfo_wy1 ginfo_wx2 ginfo_wy2 ginfo_vx ginfo_vy ginfo_sizex ginfo_sizey ginfo_winx ginfo_winy ginfo_mesx ginfo_mesy ginfo_r ginfo_g ginfo_b ginfo_paluse ginfo_dispx ginfo_dispy ginfo_cx ginfo_cy ginfo_intid ginfo_newid ginfo_sx ginfo_sy objinfo_mode objinfo_bmscr objinfo_hwnd notemax notesize dir_cur dir_exe dir_win dir_sys dir_cmdline dir_desktop dir_mydoc dir_tv font_normal font_bold font_italic font_underline font_strikeout font_antialias objmode_normal objmode_guifont objmode_usefont gsquare_grad msgothic msmincho do until while wend for next _break _continue switch case default swbreak swend ddim ldim alloc m_pi rad2deg deg2rad ease_linear ease_quad_in ease_quad_out ease_quad_inout ease_cubic_in ease_cubic_out ease_cubic_inout ease_quartic_in ease_quartic_out ease_quartic_inout ease_bounce_in ease_bounce_out ease_bounce_inout ease_shake_in ease_shake_out ease_shake_inout ease_loop',
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.APOS_STRING_MODE,

      {
        // multi-line string
        className: 'string',
        begin: '{"', end: '"}',
        contains: [hljs.BACKSLASH_ESCAPE]
      },

      hljs.COMMENT(';', '$', {relevance: 0}),

      {
        // pre-processor
        className: 'meta',
        begin: '#', end: '$',
        keywords: {'meta-keyword': 'addion cfunc cmd cmpopt comfunc const defcfunc deffunc define else endif enum epack func global if ifdef ifndef include modcfunc modfunc modinit modterm module pack packopt regcmd runtime undef usecom uselib'},
        contains: [
          hljs.inherit(hljs.QUOTE_STRING_MODE, {className: 'meta-string'}),
          hljs.NUMBER_MODE,
          hljs.C_NUMBER_MODE,
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      },

      {
        // label
        className: 'symbol',
        begin: '^\\*(\\w+|@)'
      },

      hljs.NUMBER_MODE,
      hljs.C_NUMBER_MODE
    ]
  };
};

var htmlbars = function(hljs) {
  var BUILT_INS = 'action collection component concat debugger each each-in else get hash if input link-to loc log mut outlet partial query-params render textarea unbound unless with yield view';

  var ATTR_ASSIGNMENT = {
    illegal: /\}\}/,
    begin: /[a-zA-Z0-9_]+=/,
    returnBegin: true,
    relevance: 0,
    contains: [
      {
        className: 'attr', begin: /[a-zA-Z0-9_]+/
      }
    ]
  };

  var SUB_EXPR = {
    illegal: /\}\}/,
    begin: /\)/, end: /\)/,
    contains: [
      {
        begin: /[a-zA-Z\.\-]+/,
        keywords: {built_in: BUILT_INS},
        starts: {
          endsWithParent: true, relevance: 0,
          contains: [
            hljs.QUOTE_STRING_MODE,
          ]
        }
      }
    ]
  };

  var TAG_INNARDS = {
    endsWithParent: true, relevance: 0,
    keywords: {keyword: 'as', built_in: BUILT_INS},
    contains: [
      hljs.QUOTE_STRING_MODE,
      ATTR_ASSIGNMENT,
      hljs.NUMBER_MODE
    ]
  };

  return {
    case_insensitive: true,
    subLanguage: 'xml',
    contains: [
      hljs.COMMENT('{{!(--)?', '(--)?}}'),
      {
        className: 'template-tag',
        begin: /\{\{[#\/]/, end: /\}\}/,
        contains: [
          {
            className: 'name',
            begin: /[a-zA-Z\.\-]+/,
            keywords: {'builtin-name': BUILT_INS},
            starts: TAG_INNARDS
          }
        ]
      },
      {
        className: 'template-variable',
        begin: /\{\{[a-zA-Z][a-zA-Z\-]+/, end: /\}\}/,
        keywords: {keyword: 'as', built_in: BUILT_INS},
        contains: [
          hljs.QUOTE_STRING_MODE
        ]
      }
    ]
  };
};

var http = function(hljs) {
  var VERSION = 'HTTP/[0-9\\.]+';
  return {
    aliases: ['https'],
    illegal: '\\S',
    contains: [
      {
        begin: '^' + VERSION, end: '$',
        contains: [{className: 'number', begin: '\\b\\d{3}\\b'}]
      },
      {
        begin: '^[A-Z]+ (.*?) ' + VERSION + '$', returnBegin: true, end: '$',
        contains: [
          {
            className: 'string',
            begin: ' ', end: ' ',
            excludeBegin: true, excludeEnd: true
          },
          {
            begin: VERSION
          },
          {
            className: 'keyword',
            begin: '[A-Z]+'
          }
        ]
      },
      {
        className: 'attribute',
        begin: '^\\w', end: ': ', excludeEnd: true,
        illegal: '\\n|\\s|=',
        starts: {end: '$', relevance: 0}
      },
      {
        begin: '\\n\\n',
        starts: {subLanguage: [], endsWithParent: true}
      }
    ]
  };
};

var hy = function(hljs) {
  var keywords = {
    'builtin-name':
      // keywords
      '!= % %= & &= * ** **= *= *map ' +
      '+ += , --build-class-- --import-- -= . / // //= ' +
      '/= < << <<= <= = > >= >> >>= ' +
      '@ @= ^ ^= abs accumulate all and any ap-compose ' +
      'ap-dotimes ap-each ap-each-while ap-filter ap-first ap-if ap-last ap-map ap-map-when ap-pipe ' +
      'ap-reduce ap-reject apply as-> ascii assert assoc bin break butlast ' +
      'callable calling-module-name car case cdr chain chr coll? combinations compile ' +
      'compress cond cons cons? continue count curry cut cycle dec ' +
      'def default-method defclass defmacro defmacro-alias defmacro/g! defmain defmethod defmulti defn ' +
      'defn-alias defnc defnr defreader defseq del delattr delete-route dict-comp dir ' +
      'disassemble dispatch-reader-macro distinct divmod do doto drop drop-last drop-while empty? ' +
      'end-sequence eval eval-and-compile eval-when-compile even? every? except exec filter first ' +
      'flatten float? fn fnc fnr for for* format fraction genexpr ' +
      'gensym get getattr global globals group-by hasattr hash hex id ' +
      'identity if if* if-not if-python2 import in inc input instance? ' +
      'integer integer-char? integer? interleave interpose is is-coll is-cons is-empty is-even ' +
      'is-every is-float is-instance is-integer is-integer-char is-iterable is-iterator is-keyword is-neg is-none ' +
      'is-not is-numeric is-odd is-pos is-string is-symbol is-zero isinstance islice issubclass ' +
      'iter iterable? iterate iterator? keyword keyword? lambda last len let ' +
      'lif lif-not list* list-comp locals loop macro-error macroexpand macroexpand-1 macroexpand-all ' +
      'map max merge-with method-decorator min multi-decorator multicombinations name neg? next ' +
      'none? nonlocal not not-in not? nth numeric? oct odd? open ' +
      'or ord partition permutations pos? post-route postwalk pow prewalk print ' +
      'product profile/calls profile/cpu put-route quasiquote quote raise range read read-str ' +
      'recursive-replace reduce remove repeat repeatedly repr require rest round route ' +
      'route-with-methods rwm second seq set-comp setattr setv some sorted string ' +
      'string? sum switch symbol? take take-nth take-while tee try unless ' +
      'unquote unquote-splicing vars walk when while with with* with-decorator with-gensyms ' +
      'xi xor yield yield-from zero? zip zip-longest | |= ~'
   };

  var SYMBOLSTART = 'a-zA-Z_\\-!.?+*=<>&#\'';
  var SYMBOL_RE = '[' + SYMBOLSTART + '][' + SYMBOLSTART + '0-9/;:]*';
  var SIMPLE_NUMBER_RE = '[-+]?\\d+(\\.\\d+)?';

  var SHEBANG = {
    className: 'meta',
    begin: '^#!', end: '$'
  };

  var SYMBOL = {
    begin: SYMBOL_RE,
    relevance: 0
  };
  var NUMBER = {
    className: 'number', begin: SIMPLE_NUMBER_RE,
    relevance: 0
  };
  var STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null});
  var COMMENT = hljs.COMMENT(
    ';',
    '$',
    {
      relevance: 0
    }
  );
  var LITERAL = {
    className: 'literal',
    begin: /\b([Tt]rue|[Ff]alse|nil|None)\b/
  };
  var COLLECTION = {
    begin: '[\\[\\{]', end: '[\\]\\}]'
  };
  var HINT = {
    className: 'comment',
    begin: '\\^' + SYMBOL_RE
  };
  var HINT_COL = hljs.COMMENT('\\^\\{', '\\}');
  var KEY = {
    className: 'symbol',
    begin: '[:]{1,2}' + SYMBOL_RE
  };
  var LIST = {
    begin: '\\(', end: '\\)'
  };
  var BODY = {
    endsWithParent: true,
    relevance: 0
  };
  var NAME = {
    keywords: keywords,
    lexemes: SYMBOL_RE,
    className: 'name', begin: SYMBOL_RE,
    starts: BODY
  };
  var DEFAULT_CONTAINS = [LIST, STRING, HINT, HINT_COL, COMMENT, KEY, COLLECTION, NUMBER, LITERAL, SYMBOL];

  LIST.contains = [hljs.COMMENT('comment', ''), NAME, BODY];
  BODY.contains = DEFAULT_CONTAINS;
  COLLECTION.contains = DEFAULT_CONTAINS;

  return {
    aliases: ['hylang'],
    illegal: /\S/,
    contains: [SHEBANG, LIST, STRING, HINT, HINT_COL, COMMENT, KEY, COLLECTION, NUMBER, LITERAL]
  }
};

var inform7 = function(hljs) {
  var START_BRACKET = '\\[';
  var END_BRACKET = '\\]';
  return {
    aliases: ['i7'],
    case_insensitive: true,
    keywords: {
      // Some keywords more or less unique to I7, for relevance.
      keyword:
        // kind:
        'thing room person man woman animal container ' +
        'supporter backdrop door ' +
        // characteristic:
        'scenery open closed locked inside gender ' +
        // verb:
        'is are say understand ' +
        // misc keyword:
        'kind of rule'
    },
    contains: [
      {
        className: 'string',
        begin: '"', end: '"',
        relevance: 0,
        contains: [
          {
            className: 'subst',
            begin: START_BRACKET, end: END_BRACKET
          }
        ]
      },
      {
        className: 'section',
        begin: /^(Volume|Book|Part|Chapter|Section|Table)\b/,
        end: '$'
      },
      {
        // Rule definition
        // This is here for relevance.
        begin: /^(Check|Carry out|Report|Instead of|To|Rule|When|Before|After)\b/,
        end: ':',
        contains: [
          {
            //Rule name
            begin: '\\(This', end: '\\)'
          }
        ]
      },
      {
        className: 'comment',
        begin: START_BRACKET, end: END_BRACKET,
        contains: ['self']
      }
    ]
  };
};

var ini = function(hljs) {
  var STRING = {
    className: "string",
    contains: [hljs.BACKSLASH_ESCAPE],
    variants: [
      {
        begin: "'''", end: "'''",
        relevance: 10
      }, {
        begin: '"""', end: '"""',
        relevance: 10
      }, {
        begin: '"', end: '"'
      }, {
        begin: "'", end: "'"
      }
    ]
  };
  return {
    aliases: ['toml'],
    case_insensitive: true,
    illegal: /\S/,
    contains: [
      hljs.COMMENT(';', '$'),
      hljs.HASH_COMMENT_MODE,
      {
        className: 'section',
        begin: /^\s*\[+/, end: /\]+/
      },
      {
        begin: /^[a-z0-9\[\]_\.-]+\s*=\s*/, end: '$',
        returnBegin: true,
        contains: [
          {
            className: 'attr',
            begin: /[a-z0-9\[\]_\.-]+/
          },
          {
            begin: /=/, endsWithParent: true,
            relevance: 0,
            contains: [
              {
                className: 'literal',
                begin: /\bon|off|true|false|yes|no\b/
              },
              {
                className: 'variable',
                variants: [
                  {begin: /\$[\w\d"][\w\d_]*/},
                  {begin: /\$\{(.*?)}/}
                ]
              },
              STRING,
              {
                className: 'number',
                begin: /([\+\-]+)?[\d]+_[\d_]+/
              },
              hljs.NUMBER_MODE
            ]
          }
        ]
      }
    ]
  };
};

var irpf90 = function(hljs) {
  var PARAMS = {
    className: 'params',
    begin: '\\(', end: '\\)'
  };

  var F_KEYWORDS = {
    literal: '.False. .True.',
    keyword: 'kind do while private call intrinsic where elsewhere ' +
      'type endtype endmodule endselect endinterface end enddo endif if forall endforall only contains default return stop then ' +
      'public subroutine|10 function program .and. .or. .not. .le. .eq. .ge. .gt. .lt. ' +
      'goto save else use module select case ' +
      'access blank direct exist file fmt form formatted iostat name named nextrec number opened rec recl sequential status unformatted unit ' +
      'continue format pause cycle exit ' +
      'c_null_char c_alert c_backspace c_form_feed flush wait decimal round iomsg ' +
      'synchronous nopass non_overridable pass protected volatile abstract extends import ' +
      'non_intrinsic value deferred generic final enumerator class associate bind enum ' +
      'c_int c_short c_long c_long_long c_signed_char c_size_t c_int8_t c_int16_t c_int32_t c_int64_t c_int_least8_t c_int_least16_t ' +
      'c_int_least32_t c_int_least64_t c_int_fast8_t c_int_fast16_t c_int_fast32_t c_int_fast64_t c_intmax_t C_intptr_t c_float c_double ' +
      'c_long_double c_float_complex c_double_complex c_long_double_complex c_bool c_char c_null_ptr c_null_funptr ' +
      'c_new_line c_carriage_return c_horizontal_tab c_vertical_tab iso_c_binding c_loc c_funloc c_associated  c_f_pointer ' +
      'c_ptr c_funptr iso_fortran_env character_storage_size error_unit file_storage_size input_unit iostat_end iostat_eor ' +
      'numeric_storage_size output_unit c_f_procpointer ieee_arithmetic ieee_support_underflow_control ' +
      'ieee_get_underflow_mode ieee_set_underflow_mode newunit contiguous recursive ' +
      'pad position action delim readwrite eor advance nml interface procedure namelist include sequence elemental pure ' +
      'integer real character complex logical dimension allocatable|10 parameter ' +
      'external implicit|10 none double precision assign intent optional pointer ' +
      'target in out common equivalence data ' +
      // IRPF90 special keywords
      'begin_provider &begin_provider end_provider begin_shell end_shell begin_template end_template subst assert touch ' +
      'soft_touch provide no_dep free irp_if irp_else irp_endif irp_write irp_read',
    built_in: 'alog alog10 amax0 amax1 amin0 amin1 amod cabs ccos cexp clog csin csqrt dabs dacos dasin datan datan2 dcos dcosh ddim dexp dint ' +
      'dlog dlog10 dmax1 dmin1 dmod dnint dsign dsin dsinh dsqrt dtan dtanh float iabs idim idint idnint ifix isign max0 max1 min0 min1 sngl ' +
      'algama cdabs cdcos cdexp cdlog cdsin cdsqrt cqabs cqcos cqexp cqlog cqsin cqsqrt dcmplx dconjg derf derfc dfloat dgamma dimag dlgama ' +
      'iqint qabs qacos qasin qatan qatan2 qcmplx qconjg qcos qcosh qdim qerf qerfc qexp qgamma qimag qlgama qlog qlog10 qmax1 qmin1 qmod ' +
      'qnint qsign qsin qsinh qsqrt qtan qtanh abs acos aimag aint anint asin atan atan2 char cmplx conjg cos cosh exp ichar index int log ' +
      'log10 max min nint sign sin sinh sqrt tan tanh print write dim lge lgt lle llt mod nullify allocate deallocate ' +
      'adjustl adjustr all allocated any associated bit_size btest ceiling count cshift date_and_time digits dot_product ' +
      'eoshift epsilon exponent floor fraction huge iand ibclr ibits ibset ieor ior ishft ishftc lbound len_trim matmul ' +
      'maxexponent maxloc maxval merge minexponent minloc minval modulo mvbits nearest pack present product ' +
      'radix random_number random_seed range repeat reshape rrspacing scale scan selected_int_kind selected_real_kind ' +
      'set_exponent shape size spacing spread sum system_clock tiny transpose trim ubound unpack verify achar iachar transfer ' +
      'dble entry dprod cpu_time command_argument_count get_command get_command_argument get_environment_variable is_iostat_end ' +
      'ieee_arithmetic ieee_support_underflow_control ieee_get_underflow_mode ieee_set_underflow_mode ' +
      'is_iostat_eor move_alloc new_line selected_char_kind same_type_as extends_type_of'  +
      'acosh asinh atanh bessel_j0 bessel_j1 bessel_jn bessel_y0 bessel_y1 bessel_yn erf erfc erfc_scaled gamma log_gamma hypot norm2 ' +
      'atomic_define atomic_ref execute_command_line leadz trailz storage_size merge_bits ' +
      'bge bgt ble blt dshiftl dshiftr findloc iall iany iparity image_index lcobound ucobound maskl maskr ' +
      'num_images parity popcnt poppar shifta shiftl shiftr this_image ' +
      // IRPF90 special built_ins
      'IRP_ALIGN irp_here'
  };
  return {
    case_insensitive: true,
    keywords: F_KEYWORDS,
    illegal: /\/\*/,
    contains: [
      hljs.inherit(hljs.APOS_STRING_MODE, {className: 'string', relevance: 0}),
      hljs.inherit(hljs.QUOTE_STRING_MODE, {className: 'string', relevance: 0}),
      {
        className: 'function',
        beginKeywords: 'subroutine function program',
        illegal: '[${=\\n]',
        contains: [hljs.UNDERSCORE_TITLE_MODE, PARAMS]
      },
      hljs.COMMENT('!', '$', {relevance: 0}),
      hljs.COMMENT('begin_doc', 'end_doc', {relevance: 10}),
      {
        className: 'number',
        begin: '(?=\\b|\\+|\\-|\\.)(?=\\.\\d|\\d)(?:\\d+)?(?:\\.?\\d*)(?:[de][+-]?\\d+)?\\b\\.?',
        relevance: 0
      }
    ]
  };
};

var isbl = function(hljs) {
  // Определение идентификаторов
  var UNDERSCORE_IDENT_RE = "[A-Za-zА-Яа-яёЁ_!][A-Za-zА-Яа-яёЁ_0-9]*";

  // Определение имен функций
  var FUNCTION_NAME_IDENT_RE = "[A-Za-zА-Яа-яёЁ_][A-Za-zА-Яа-яёЁ_0-9]*";

  // keyword : ключевые слова
  var KEYWORD =
    "and и else иначе endexcept endfinally endforeach конецвсе endif конецесли endwhile конецпока " +
    "except exitfor finally foreach все if если in в not не or или try while пока ";

  // SYSRES Constants
  var sysres_constants =
    "SYSRES_CONST_ACCES_RIGHT_TYPE_EDIT " +
    "SYSRES_CONST_ACCES_RIGHT_TYPE_FULL " +
    "SYSRES_CONST_ACCES_RIGHT_TYPE_VIEW " +
    "SYSRES_CONST_ACCESS_MODE_REQUISITE_CODE " +
    "SYSRES_CONST_ACCESS_NO_ACCESS_VIEW " +
    "SYSRES_CONST_ACCESS_NO_ACCESS_VIEW_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_ADD_REQUISITE_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_ADD_REQUISITE_YES_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_CHANGE_REQUISITE_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_CHANGE_REQUISITE_YES_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_DELETE_REQUISITE_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_DELETE_REQUISITE_YES_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_EXECUTE_REQUISITE_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_EXECUTE_REQUISITE_YES_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_NO_ACCESS_REQUISITE_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_NO_ACCESS_REQUISITE_YES_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_RATIFY_REQUISITE_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_RATIFY_REQUISITE_YES_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_REQUISITE_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_VIEW " +
    "SYSRES_CONST_ACCESS_RIGHTS_VIEW_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_VIEW_REQUISITE_CODE " +
    "SYSRES_CONST_ACCESS_RIGHTS_VIEW_REQUISITE_YES_CODE " +
    "SYSRES_CONST_ACCESS_TYPE_CHANGE " +
    "SYSRES_CONST_ACCESS_TYPE_CHANGE_CODE " +
    "SYSRES_CONST_ACCESS_TYPE_EXISTS " +
    "SYSRES_CONST_ACCESS_TYPE_EXISTS_CODE " +
    "SYSRES_CONST_ACCESS_TYPE_FULL " +
    "SYSRES_CONST_ACCESS_TYPE_FULL_CODE " +
    "SYSRES_CONST_ACCESS_TYPE_VIEW " +
    "SYSRES_CONST_ACCESS_TYPE_VIEW_CODE " +
    "SYSRES_CONST_ACTION_TYPE_ABORT " +
    "SYSRES_CONST_ACTION_TYPE_ACCEPT " +
    "SYSRES_CONST_ACTION_TYPE_ACCESS_RIGHTS " +
    "SYSRES_CONST_ACTION_TYPE_ADD_ATTACHMENT " +
    "SYSRES_CONST_ACTION_TYPE_CHANGE_CARD " +
    "SYSRES_CONST_ACTION_TYPE_CHANGE_KIND " +
    "SYSRES_CONST_ACTION_TYPE_CHANGE_STORAGE " +
    "SYSRES_CONST_ACTION_TYPE_CONTINUE " +
    "SYSRES_CONST_ACTION_TYPE_COPY " +
    "SYSRES_CONST_ACTION_TYPE_CREATE " +
    "SYSRES_CONST_ACTION_TYPE_CREATE_VERSION " +
    "SYSRES_CONST_ACTION_TYPE_DELETE " +
    "SYSRES_CONST_ACTION_TYPE_DELETE_ATTACHMENT " +
    "SYSRES_CONST_ACTION_TYPE_DELETE_VERSION " +
    "SYSRES_CONST_ACTION_TYPE_DISABLE_DELEGATE_ACCESS_RIGHTS " +
    "SYSRES_CONST_ACTION_TYPE_ENABLE_DELEGATE_ACCESS_RIGHTS " +
    "SYSRES_CONST_ACTION_TYPE_ENCRYPTION_BY_CERTIFICATE " +
    "SYSRES_CONST_ACTION_TYPE_ENCRYPTION_BY_CERTIFICATE_AND_PASSWORD " +
    "SYSRES_CONST_ACTION_TYPE_ENCRYPTION_BY_PASSWORD " +
    "SYSRES_CONST_ACTION_TYPE_EXPORT_WITH_LOCK " +
    "SYSRES_CONST_ACTION_TYPE_EXPORT_WITHOUT_LOCK " +
    "SYSRES_CONST_ACTION_TYPE_IMPORT_WITH_UNLOCK " +
    "SYSRES_CONST_ACTION_TYPE_IMPORT_WITHOUT_UNLOCK " +
    "SYSRES_CONST_ACTION_TYPE_LIFE_CYCLE_STAGE " +
    "SYSRES_CONST_ACTION_TYPE_LOCK " +
    "SYSRES_CONST_ACTION_TYPE_LOCK_FOR_SERVER " +
    "SYSRES_CONST_ACTION_TYPE_LOCK_MODIFY " +
    "SYSRES_CONST_ACTION_TYPE_MARK_AS_READED " +
    "SYSRES_CONST_ACTION_TYPE_MARK_AS_UNREADED " +
    "SYSRES_CONST_ACTION_TYPE_MODIFY " +
    "SYSRES_CONST_ACTION_TYPE_MODIFY_CARD " +
    "SYSRES_CONST_ACTION_TYPE_MOVE_TO_ARCHIVE " +
    "SYSRES_CONST_ACTION_TYPE_OFF_ENCRYPTION " +
    "SYSRES_CONST_ACTION_TYPE_PASSWORD_CHANGE " +
    "SYSRES_CONST_ACTION_TYPE_PERFORM " +
    "SYSRES_CONST_ACTION_TYPE_RECOVER_FROM_LOCAL_COPY " +
    "SYSRES_CONST_ACTION_TYPE_RESTART " +
    "SYSRES_CONST_ACTION_TYPE_RESTORE_FROM_ARCHIVE " +
    "SYSRES_CONST_ACTION_TYPE_REVISION " +
    "SYSRES_CONST_ACTION_TYPE_SEND_BY_MAIL " +
    "SYSRES_CONST_ACTION_TYPE_SIGN " +
    "SYSRES_CONST_ACTION_TYPE_START " +
    "SYSRES_CONST_ACTION_TYPE_UNLOCK " +
    "SYSRES_CONST_ACTION_TYPE_UNLOCK_FROM_SERVER " +
    "SYSRES_CONST_ACTION_TYPE_VERSION_STATE " +
    "SYSRES_CONST_ACTION_TYPE_VERSION_VISIBILITY " +
    "SYSRES_CONST_ACTION_TYPE_VIEW " +
    "SYSRES_CONST_ACTION_TYPE_VIEW_SHADOW_COPY " +
    "SYSRES_CONST_ACTION_TYPE_WORKFLOW_DESCRIPTION_MODIFY " +
    "SYSRES_CONST_ACTION_TYPE_WRITE_HISTORY " +
    "SYSRES_CONST_ACTIVE_VERSION_STATE_PICK_VALUE " +
    "SYSRES_CONST_ADD_REFERENCE_MODE_NAME " +
    "SYSRES_CONST_ADDITION_REQUISITE_CODE " +
    "SYSRES_CONST_ADDITIONAL_PARAMS_REQUISITE_CODE " +
    "SYSRES_CONST_ADITIONAL_JOB_END_DATE_REQUISITE_NAME " +
    "SYSRES_CONST_ADITIONAL_JOB_READ_REQUISITE_NAME " +
    "SYSRES_CONST_ADITIONAL_JOB_START_DATE_REQUISITE_NAME " +
    "SYSRES_CONST_ADITIONAL_JOB_STATE_REQUISITE_NAME " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_ADDING_USER_TO_GROUP_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_ADDING_USER_TO_GROUP_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_CREATION_COMP_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_CREATION_COMP_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_CREATION_GROUP_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_CREATION_GROUP_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_CREATION_USER_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_CREATION_USER_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_DATABASE_USER_CREATION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_DATABASE_USER_CREATION_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_DATABASE_USER_DELETION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_DATABASE_USER_DELETION_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_DELETION_COMP_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_DELETION_COMP_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_DELETION_GROUP_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_DELETION_GROUP_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_DELETION_USER_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_DELETION_USER_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_DELETION_USER_FROM_GROUP_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_DELETION_USER_FROM_GROUP_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_GRANTING_FILTERER_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_GRANTING_FILTERER_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_GRANTING_FILTERER_RESTRICTION_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_GRANTING_FILTERER_RESTRICTION_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_GRANTING_PRIVILEGE_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_GRANTING_PRIVILEGE_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_GRANTING_RIGHTS_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_GRANTING_RIGHTS_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_IS_MAIN_SERVER_CHANGED_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_IS_MAIN_SERVER_CHANGED_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_IS_PUBLIC_CHANGED_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_IS_PUBLIC_CHANGED_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_REMOVING_FILTERER_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_REMOVING_FILTERER_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_REMOVING_FILTERER_RESTRICTION_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_REMOVING_FILTERER_RESTRICTION_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_REMOVING_PRIVILEGE_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_REMOVING_PRIVILEGE_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_REMOVING_RIGHTS_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_REMOVING_RIGHTS_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_SERVER_LOGIN_CREATION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_SERVER_LOGIN_CREATION_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_SERVER_LOGIN_DELETION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_SERVER_LOGIN_DELETION_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_CATEGORY_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_CATEGORY_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_COMP_TITLE_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_COMP_TITLE_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_FULL_NAME_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_FULL_NAME_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_GROUP_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_GROUP_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_PARENT_GROUP_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_PARENT_GROUP_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_USER_AUTH_TYPE_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_USER_AUTH_TYPE_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_USER_LOGIN_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_USER_LOGIN_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_USER_STATUS_ACTION " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_UPDATING_USER_STATUS_ACTION_CODE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_USER_PASSWORD_CHANGE " +
    "SYSRES_CONST_ADMINISTRATION_HISTORY_USER_PASSWORD_CHANGE_ACTION " +
    "SYSRES_CONST_ALL_ACCEPT_CONDITION_RUS " +
    "SYSRES_CONST_ALL_USERS_GROUP " +
    "SYSRES_CONST_ALL_USERS_GROUP_NAME " +
    "SYSRES_CONST_ALL_USERS_SERVER_GROUP_NAME " +
    "SYSRES_CONST_ALLOWED_ACCESS_TYPE_CODE " +
    "SYSRES_CONST_ALLOWED_ACCESS_TYPE_NAME " +
    "SYSRES_CONST_APP_VIEWER_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_APPROVING_SIGNATURE_NAME " +
    "SYSRES_CONST_APPROVING_SIGNATURE_REQUISITE_CODE " +
    "SYSRES_CONST_ASSISTANT_SUBSTITUE_TYPE " +
    "SYSRES_CONST_ASSISTANT_SUBSTITUE_TYPE_CODE " +
    "SYSRES_CONST_ATTACH_TYPE_COMPONENT_TOKEN " +
    "SYSRES_CONST_ATTACH_TYPE_DOC " +
    "SYSRES_CONST_ATTACH_TYPE_EDOC " +
    "SYSRES_CONST_ATTACH_TYPE_FOLDER " +
    "SYSRES_CONST_ATTACH_TYPE_JOB " +
    "SYSRES_CONST_ATTACH_TYPE_REFERENCE " +
    "SYSRES_CONST_ATTACH_TYPE_TASK " +
    "SYSRES_CONST_AUTH_ENCODED_PASSWORD " +
    "SYSRES_CONST_AUTH_ENCODED_PASSWORD_CODE " +
    "SYSRES_CONST_AUTH_NOVELL " +
    "SYSRES_CONST_AUTH_PASSWORD " +
    "SYSRES_CONST_AUTH_PASSWORD_CODE " +
    "SYSRES_CONST_AUTH_WINDOWS " +
    "SYSRES_CONST_AUTHENTICATING_SIGNATURE_NAME " +
    "SYSRES_CONST_AUTHENTICATING_SIGNATURE_REQUISITE_CODE " +
    "SYSRES_CONST_AUTO_ENUM_METHOD_FLAG " +
    "SYSRES_CONST_AUTO_NUMERATION_CODE " +
    "SYSRES_CONST_AUTO_STRONG_ENUM_METHOD_FLAG " +
    "SYSRES_CONST_AUTOTEXT_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_AUTOTEXT_TEXT_REQUISITE_CODE " +
    "SYSRES_CONST_AUTOTEXT_USAGE_ALL " +
    "SYSRES_CONST_AUTOTEXT_USAGE_ALL_CODE " +
    "SYSRES_CONST_AUTOTEXT_USAGE_SIGN " +
    "SYSRES_CONST_AUTOTEXT_USAGE_SIGN_CODE " +
    "SYSRES_CONST_AUTOTEXT_USAGE_WORK " +
    "SYSRES_CONST_AUTOTEXT_USAGE_WORK_CODE " +
    "SYSRES_CONST_AUTOTEXT_USE_ANYWHERE_CODE " +
    "SYSRES_CONST_AUTOTEXT_USE_ON_SIGNING_CODE " +
    "SYSRES_CONST_AUTOTEXT_USE_ON_WORK_CODE " +
    "SYSRES_CONST_BEGIN_DATE_REQUISITE_CODE " +
    "SYSRES_CONST_BLACK_LIFE_CYCLE_STAGE_FONT_COLOR " +
    "SYSRES_CONST_BLUE_LIFE_CYCLE_STAGE_FONT_COLOR " +
    "SYSRES_CONST_BTN_PART " +
    "SYSRES_CONST_CALCULATED_ROLE_TYPE_CODE " +
    "SYSRES_CONST_CALL_TYPE_VARIABLE_BUTTON_VALUE " +
    "SYSRES_CONST_CALL_TYPE_VARIABLE_PROGRAM_VALUE " +
    "SYSRES_CONST_CANCEL_MESSAGE_FUNCTION_RESULT " +
    "SYSRES_CONST_CARD_PART " +
    "SYSRES_CONST_CARD_REFERENCE_MODE_NAME " +
    "SYSRES_CONST_CERTIFICATE_TYPE_REQUISITE_ENCRYPT_VALUE " +
    "SYSRES_CONST_CERTIFICATE_TYPE_REQUISITE_SIGN_AND_ENCRYPT_VALUE " +
    "SYSRES_CONST_CERTIFICATE_TYPE_REQUISITE_SIGN_VALUE " +
    "SYSRES_CONST_CHECK_PARAM_VALUE_DATE_PARAM_TYPE " +
    "SYSRES_CONST_CHECK_PARAM_VALUE_FLOAT_PARAM_TYPE " +
    "SYSRES_CONST_CHECK_PARAM_VALUE_INTEGER_PARAM_TYPE " +
    "SYSRES_CONST_CHECK_PARAM_VALUE_PICK_PARAM_TYPE " +
    "SYSRES_CONST_CHECK_PARAM_VALUE_REEFRENCE_PARAM_TYPE " +
    "SYSRES_CONST_CLOSED_RECORD_FLAG_VALUE_FEMININE " +
    "SYSRES_CONST_CLOSED_RECORD_FLAG_VALUE_MASCULINE " +
    "SYSRES_CONST_CODE_COMPONENT_TYPE_ADMIN " +
    "SYSRES_CONST_CODE_COMPONENT_TYPE_DEVELOPER " +
    "SYSRES_CONST_CODE_COMPONENT_TYPE_DOCS " +
    "SYSRES_CONST_CODE_COMPONENT_TYPE_EDOC_CARDS " +
    "SYSRES_CONST_CODE_COMPONENT_TYPE_EXTERNAL_EXECUTABLE " +
    "SYSRES_CONST_CODE_COMPONENT_TYPE_OTHER " +
    "SYSRES_CONST_CODE_COMPONENT_TYPE_REFERENCE " +
    "SYSRES_CONST_CODE_COMPONENT_TYPE_REPORT " +
    "SYSRES_CONST_CODE_COMPONENT_TYPE_SCRIPT " +
    "SYSRES_CONST_CODE_COMPONENT_TYPE_URL " +
    "SYSRES_CONST_CODE_REQUISITE_ACCESS " +
    "SYSRES_CONST_CODE_REQUISITE_CODE " +
    "SYSRES_CONST_CODE_REQUISITE_COMPONENT " +
    "SYSRES_CONST_CODE_REQUISITE_DESCRIPTION " +
    "SYSRES_CONST_CODE_REQUISITE_EXCLUDE_COMPONENT " +
    "SYSRES_CONST_CODE_REQUISITE_RECORD " +
    "SYSRES_CONST_COMMENT_REQ_CODE " +
    "SYSRES_CONST_COMMON_SETTINGS_REQUISITE_CODE " +
    "SYSRES_CONST_COMP_CODE_GRD " +
    "SYSRES_CONST_COMPONENT_GROUP_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_COMPONENT_TYPE_ADMIN_COMPONENTS " +
    "SYSRES_CONST_COMPONENT_TYPE_DEVELOPER_COMPONENTS " +
    "SYSRES_CONST_COMPONENT_TYPE_DOCS " +
    "SYSRES_CONST_COMPONENT_TYPE_EDOC_CARDS " +
    "SYSRES_CONST_COMPONENT_TYPE_EDOCS " +
    "SYSRES_CONST_COMPONENT_TYPE_EXTERNAL_EXECUTABLE " +
    "SYSRES_CONST_COMPONENT_TYPE_OTHER " +
    "SYSRES_CONST_COMPONENT_TYPE_REFERENCE_TYPES " +
    "SYSRES_CONST_COMPONENT_TYPE_REFERENCES " +
    "SYSRES_CONST_COMPONENT_TYPE_REPORTS " +
    "SYSRES_CONST_COMPONENT_TYPE_SCRIPTS " +
    "SYSRES_CONST_COMPONENT_TYPE_URL " +
    "SYSRES_CONST_COMPONENTS_REMOTE_SERVERS_VIEW_CODE " +
    "SYSRES_CONST_CONDITION_BLOCK_DESCRIPTION " +
    "SYSRES_CONST_CONST_FIRM_STATUS_COMMON " +
    "SYSRES_CONST_CONST_FIRM_STATUS_INDIVIDUAL " +
    "SYSRES_CONST_CONST_NEGATIVE_VALUE " +
    "SYSRES_CONST_CONST_POSITIVE_VALUE " +
    "SYSRES_CONST_CONST_SERVER_STATUS_DONT_REPLICATE " +
    "SYSRES_CONST_CONST_SERVER_STATUS_REPLICATE " +
    "SYSRES_CONST_CONTENTS_REQUISITE_CODE " +
    "SYSRES_CONST_DATA_TYPE_BOOLEAN " +
    "SYSRES_CONST_DATA_TYPE_DATE " +
    "SYSRES_CONST_DATA_TYPE_FLOAT " +
    "SYSRES_CONST_DATA_TYPE_INTEGER " +
    "SYSRES_CONST_DATA_TYPE_PICK " +
    "SYSRES_CONST_DATA_TYPE_REFERENCE " +
    "SYSRES_CONST_DATA_TYPE_STRING " +
    "SYSRES_CONST_DATA_TYPE_TEXT " +
    "SYSRES_CONST_DATA_TYPE_VARIANT " +
    "SYSRES_CONST_DATE_CLOSE_REQ_CODE " +
    "SYSRES_CONST_DATE_FORMAT_DATE_ONLY_CHAR " +
    "SYSRES_CONST_DATE_OPEN_REQ_CODE " +
    "SYSRES_CONST_DATE_REQUISITE " +
    "SYSRES_CONST_DATE_REQUISITE_CODE " +
    "SYSRES_CONST_DATE_REQUISITE_NAME " +
    "SYSRES_CONST_DATE_REQUISITE_TYPE " +
    "SYSRES_CONST_DATE_TYPE_CHAR " +
    "SYSRES_CONST_DATETIME_FORMAT_VALUE " +
    "SYSRES_CONST_DEA_ACCESS_RIGHTS_ACTION_CODE " +
    "SYSRES_CONST_DESCRIPTION_LOCALIZE_ID_REQUISITE_CODE " +
    "SYSRES_CONST_DESCRIPTION_REQUISITE_CODE " +
    "SYSRES_CONST_DET1_PART " +
    "SYSRES_CONST_DET2_PART " +
    "SYSRES_CONST_DET3_PART " +
    "SYSRES_CONST_DET4_PART " +
    "SYSRES_CONST_DET5_PART " +
    "SYSRES_CONST_DET6_PART " +
    "SYSRES_CONST_DETAIL_DATASET_KEY_REQUISITE_CODE " +
    "SYSRES_CONST_DETAIL_PICK_REQUISITE_CODE " +
    "SYSRES_CONST_DETAIL_REQ_CODE " +
    "SYSRES_CONST_DO_NOT_USE_ACCESS_TYPE_CODE " +
    "SYSRES_CONST_DO_NOT_USE_ACCESS_TYPE_NAME " +
    "SYSRES_CONST_DO_NOT_USE_ON_VIEW_ACCESS_TYPE_CODE " +
    "SYSRES_CONST_DO_NOT_USE_ON_VIEW_ACCESS_TYPE_NAME " +
    "SYSRES_CONST_DOCUMENT_STORAGES_CODE " +
    "SYSRES_CONST_DOCUMENT_TEMPLATES_TYPE_NAME " +
    "SYSRES_CONST_DOUBLE_REQUISITE_CODE " +
    "SYSRES_CONST_EDITOR_CLOSE_FILE_OBSERV_TYPE_CODE " +
    "SYSRES_CONST_EDITOR_CLOSE_PROCESS_OBSERV_TYPE_CODE " +
    "SYSRES_CONST_EDITOR_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_EDITORS_APPLICATION_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_EDITORS_CREATE_SEVERAL_PROCESSES_REQUISITE_CODE " +
    "SYSRES_CONST_EDITORS_EXTENSION_REQUISITE_CODE " +
    "SYSRES_CONST_EDITORS_OBSERVER_BY_PROCESS_TYPE " +
    "SYSRES_CONST_EDITORS_REFERENCE_CODE " +
    "SYSRES_CONST_EDITORS_REPLACE_SPEC_CHARS_REQUISITE_CODE " +
    "SYSRES_CONST_EDITORS_USE_PLUGINS_REQUISITE_CODE " +
    "SYSRES_CONST_EDITORS_VIEW_DOCUMENT_OPENED_TO_EDIT_CODE " +
    "SYSRES_CONST_EDOC_CARD_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_EDOC_CARD_TYPES_LINK_REQUISITE_CODE " +
    "SYSRES_CONST_EDOC_CERTIFICATE_AND_PASSWORD_ENCODE_CODE " +
    "SYSRES_CONST_EDOC_CERTIFICATE_ENCODE_CODE " +
    "SYSRES_CONST_EDOC_DATE_REQUISITE_CODE " +
    "SYSRES_CONST_EDOC_KIND_REFERENCE_CODE " +
    "SYSRES_CONST_EDOC_KINDS_BY_TEMPLATE_ACTION_CODE " +
    "SYSRES_CONST_EDOC_MANAGE_ACCESS_CODE " +
    "SYSRES_CONST_EDOC_NONE_ENCODE_CODE " +
    "SYSRES_CONST_EDOC_NUMBER_REQUISITE_CODE " +
    "SYSRES_CONST_EDOC_PASSWORD_ENCODE_CODE " +
    "SYSRES_CONST_EDOC_READONLY_ACCESS_CODE " +
    "SYSRES_CONST_EDOC_SHELL_LIFE_TYPE_VIEW_VALUE " +
    "SYSRES_CONST_EDOC_SIZE_RESTRICTION_PRIORITY_REQUISITE_CODE " +
    "SYSRES_CONST_EDOC_STORAGE_CHECK_ACCESS_RIGHTS_REQUISITE_CODE " +
    "SYSRES_CONST_EDOC_STORAGE_COMPUTER_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_EDOC_STORAGE_DATABASE_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_EDOC_STORAGE_EDIT_IN_STORAGE_REQUISITE_CODE " +
    "SYSRES_CONST_EDOC_STORAGE_LOCAL_PATH_REQUISITE_CODE " +
    "SYSRES_CONST_EDOC_STORAGE_SHARED_SOURCE_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_EDOC_TEMPLATE_REQUISITE_CODE " +
    "SYSRES_CONST_EDOC_TYPES_REFERENCE_CODE " +
    "SYSRES_CONST_EDOC_VERSION_ACTIVE_STAGE_CODE " +
    "SYSRES_CONST_EDOC_VERSION_DESIGN_STAGE_CODE " +
    "SYSRES_CONST_EDOC_VERSION_OBSOLETE_STAGE_CODE " +
    "SYSRES_CONST_EDOC_WRITE_ACCES_CODE " +
    "SYSRES_CONST_EDOCUMENT_CARD_REQUISITES_REFERENCE_CODE_SELECTED_REQUISITE " +
    "SYSRES_CONST_ENCODE_CERTIFICATE_TYPE_CODE " +
    "SYSRES_CONST_END_DATE_REQUISITE_CODE " +
    "SYSRES_CONST_ENUMERATION_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_EXECUTE_ACCESS_RIGHTS_TYPE_CODE " +
    "SYSRES_CONST_EXECUTIVE_FILE_STORAGE_TYPE " +
    "SYSRES_CONST_EXIST_CONST " +
    "SYSRES_CONST_EXIST_VALUE " +
    "SYSRES_CONST_EXPORT_LOCK_TYPE_ASK " +
    "SYSRES_CONST_EXPORT_LOCK_TYPE_WITH_LOCK " +
    "SYSRES_CONST_EXPORT_LOCK_TYPE_WITHOUT_LOCK " +
    "SYSRES_CONST_EXPORT_VERSION_TYPE_ASK " +
    "SYSRES_CONST_EXPORT_VERSION_TYPE_LAST " +
    "SYSRES_CONST_EXPORT_VERSION_TYPE_LAST_ACTIVE " +
    "SYSRES_CONST_EXTENSION_REQUISITE_CODE " +
    "SYSRES_CONST_FILTER_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_FILTER_REQUISITE_CODE " +
    "SYSRES_CONST_FILTER_TYPE_COMMON_CODE " +
    "SYSRES_CONST_FILTER_TYPE_COMMON_NAME " +
    "SYSRES_CONST_FILTER_TYPE_USER_CODE " +
    "SYSRES_CONST_FILTER_TYPE_USER_NAME " +
    "SYSRES_CONST_FILTER_VALUE_REQUISITE_NAME " +
    "SYSRES_CONST_FLOAT_NUMBER_FORMAT_CHAR " +
    "SYSRES_CONST_FLOAT_REQUISITE_TYPE " +
    "SYSRES_CONST_FOLDER_AUTHOR_VALUE " +
    "SYSRES_CONST_FOLDER_KIND_ANY_OBJECTS " +
    "SYSRES_CONST_FOLDER_KIND_COMPONENTS " +
    "SYSRES_CONST_FOLDER_KIND_EDOCS " +
    "SYSRES_CONST_FOLDER_KIND_JOBS " +
    "SYSRES_CONST_FOLDER_KIND_TASKS " +
    "SYSRES_CONST_FOLDER_TYPE_COMMON " +
    "SYSRES_CONST_FOLDER_TYPE_COMPONENT " +
    "SYSRES_CONST_FOLDER_TYPE_FAVORITES " +
    "SYSRES_CONST_FOLDER_TYPE_INBOX " +
    "SYSRES_CONST_FOLDER_TYPE_OUTBOX " +
    "SYSRES_CONST_FOLDER_TYPE_QUICK_LAUNCH " +
    "SYSRES_CONST_FOLDER_TYPE_SEARCH " +
    "SYSRES_CONST_FOLDER_TYPE_SHORTCUTS " +
    "SYSRES_CONST_FOLDER_TYPE_USER " +
    "SYSRES_CONST_FROM_DICTIONARY_ENUM_METHOD_FLAG " +
    "SYSRES_CONST_FULL_SUBSTITUTE_TYPE " +
    "SYSRES_CONST_FULL_SUBSTITUTE_TYPE_CODE " +
    "SYSRES_CONST_FUNCTION_CANCEL_RESULT " +
    "SYSRES_CONST_FUNCTION_CATEGORY_SYSTEM " +
    "SYSRES_CONST_FUNCTION_CATEGORY_USER " +
    "SYSRES_CONST_FUNCTION_FAILURE_RESULT " +
    "SYSRES_CONST_FUNCTION_SAVE_RESULT " +
    "SYSRES_CONST_GENERATED_REQUISITE " +
    "SYSRES_CONST_GREEN_LIFE_CYCLE_STAGE_FONT_COLOR " +
    "SYSRES_CONST_GROUP_ACCOUNT_TYPE_VALUE_CODE " +
    "SYSRES_CONST_GROUP_CATEGORY_NORMAL_CODE " +
    "SYSRES_CONST_GROUP_CATEGORY_NORMAL_NAME " +
    "SYSRES_CONST_GROUP_CATEGORY_SERVICE_CODE " +
    "SYSRES_CONST_GROUP_CATEGORY_SERVICE_NAME " +
    "SYSRES_CONST_GROUP_COMMON_CATEGORY_FIELD_VALUE " +
    "SYSRES_CONST_GROUP_FULL_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_GROUP_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_GROUP_RIGHTS_T_REQUISITE_CODE " +
    "SYSRES_CONST_GROUP_SERVER_CODES_REQUISITE_CODE " +
    "SYSRES_CONST_GROUP_SERVER_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_GROUP_SERVICE_CATEGORY_FIELD_VALUE " +
    "SYSRES_CONST_GROUP_USER_REQUISITE_CODE " +
    "SYSRES_CONST_GROUPS_REFERENCE_CODE " +
    "SYSRES_CONST_GROUPS_REQUISITE_CODE " +
    "SYSRES_CONST_HIDDEN_MODE_NAME " +
    "SYSRES_CONST_HIGH_LVL_REQUISITE_CODE " +
    "SYSRES_CONST_HISTORY_ACTION_CREATE_CODE " +
    "SYSRES_CONST_HISTORY_ACTION_DELETE_CODE " +
    "SYSRES_CONST_HISTORY_ACTION_EDIT_CODE " +
    "SYSRES_CONST_HOUR_CHAR " +
    "SYSRES_CONST_ID_REQUISITE_CODE " +
    "SYSRES_CONST_IDSPS_REQUISITE_CODE " +
    "SYSRES_CONST_IMAGE_MODE_COLOR " +
    "SYSRES_CONST_IMAGE_MODE_GREYSCALE " +
    "SYSRES_CONST_IMAGE_MODE_MONOCHROME " +
    "SYSRES_CONST_IMPORTANCE_HIGH " +
    "SYSRES_CONST_IMPORTANCE_LOW " +
    "SYSRES_CONST_IMPORTANCE_NORMAL " +
    "SYSRES_CONST_IN_DESIGN_VERSION_STATE_PICK_VALUE " +
    "SYSRES_CONST_INCOMING_WORK_RULE_TYPE_CODE " +
    "SYSRES_CONST_INT_REQUISITE " +
    "SYSRES_CONST_INT_REQUISITE_TYPE " +
    "SYSRES_CONST_INTEGER_NUMBER_FORMAT_CHAR " +
    "SYSRES_CONST_INTEGER_TYPE_CHAR " +
    "SYSRES_CONST_IS_GENERATED_REQUISITE_NEGATIVE_VALUE " +
    "SYSRES_CONST_IS_PUBLIC_ROLE_REQUISITE_CODE " +
    "SYSRES_CONST_IS_REMOTE_USER_NEGATIVE_VALUE " +
    "SYSRES_CONST_IS_REMOTE_USER_POSITIVE_VALUE " +
    "SYSRES_CONST_IS_STORED_REQUISITE_NEGATIVE_VALUE " +
    "SYSRES_CONST_IS_STORED_REQUISITE_STORED_VALUE " +
    "SYSRES_CONST_ITALIC_LIFE_CYCLE_STAGE_DRAW_STYLE " +
    "SYSRES_CONST_JOB_BLOCK_DESCRIPTION " +
    "SYSRES_CONST_JOB_KIND_CONTROL_JOB " +
    "SYSRES_CONST_JOB_KIND_JOB " +
    "SYSRES_CONST_JOB_KIND_NOTICE " +
    "SYSRES_CONST_JOB_STATE_ABORTED " +
    "SYSRES_CONST_JOB_STATE_COMPLETE " +
    "SYSRES_CONST_JOB_STATE_WORKING " +
    "SYSRES_CONST_KIND_REQUISITE_CODE " +
    "SYSRES_CONST_KIND_REQUISITE_NAME " +
    "SYSRES_CONST_KINDS_CREATE_SHADOW_COPIES_REQUISITE_CODE " +
    "SYSRES_CONST_KINDS_DEFAULT_EDOC_LIFE_STAGE_REQUISITE_CODE " +
    "SYSRES_CONST_KINDS_EDOC_ALL_TEPLATES_ALLOWED_REQUISITE_CODE " +
    "SYSRES_CONST_KINDS_EDOC_ALLOW_LIFE_CYCLE_STAGE_CHANGING_REQUISITE_CODE " +
    "SYSRES_CONST_KINDS_EDOC_ALLOW_MULTIPLE_ACTIVE_VERSIONS_REQUISITE_CODE " +
    "SYSRES_CONST_KINDS_EDOC_SHARE_ACCES_RIGHTS_BY_DEFAULT_CODE " +
    "SYSRES_CONST_KINDS_EDOC_TEMPLATE_REQUISITE_CODE " +
    "SYSRES_CONST_KINDS_EDOC_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_KINDS_SIGNERS_REQUISITES_CODE " +
    "SYSRES_CONST_KOD_INPUT_TYPE " +
    "SYSRES_CONST_LAST_UPDATE_DATE_REQUISITE_CODE " +
    "SYSRES_CONST_LIFE_CYCLE_START_STAGE_REQUISITE_CODE " +
    "SYSRES_CONST_LILAC_LIFE_CYCLE_STAGE_FONT_COLOR " +
    "SYSRES_CONST_LINK_OBJECT_KIND_COMPONENT " +
    "SYSRES_CONST_LINK_OBJECT_KIND_DOCUMENT " +
    "SYSRES_CONST_LINK_OBJECT_KIND_EDOC " +
    "SYSRES_CONST_LINK_OBJECT_KIND_FOLDER " +
    "SYSRES_CONST_LINK_OBJECT_KIND_JOB " +
    "SYSRES_CONST_LINK_OBJECT_KIND_REFERENCE " +
    "SYSRES_CONST_LINK_OBJECT_KIND_TASK " +
    "SYSRES_CONST_LINK_REF_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_LIST_REFERENCE_MODE_NAME " +
    "SYSRES_CONST_LOCALIZATION_DICTIONARY_MAIN_VIEW_CODE " +
    "SYSRES_CONST_MAIN_VIEW_CODE " +
    "SYSRES_CONST_MANUAL_ENUM_METHOD_FLAG " +
    "SYSRES_CONST_MASTER_COMP_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_MASTER_TABLE_REC_ID_REQUISITE_CODE " +
    "SYSRES_CONST_MAXIMIZED_MODE_NAME " +
    "SYSRES_CONST_ME_VALUE " +
    "SYSRES_CONST_MESSAGE_ATTENTION_CAPTION " +
    "SYSRES_CONST_MESSAGE_CONFIRMATION_CAPTION " +
    "SYSRES_CONST_MESSAGE_ERROR_CAPTION " +
    "SYSRES_CONST_MESSAGE_INFORMATION_CAPTION " +
    "SYSRES_CONST_MINIMIZED_MODE_NAME " +
    "SYSRES_CONST_MINUTE_CHAR " +
    "SYSRES_CONST_MODULE_REQUISITE_CODE " +
    "SYSRES_CONST_MONITORING_BLOCK_DESCRIPTION " +
    "SYSRES_CONST_MONTH_FORMAT_VALUE " +
    "SYSRES_CONST_NAME_LOCALIZE_ID_REQUISITE_CODE " +
    "SYSRES_CONST_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_NAME_SINGULAR_REQUISITE_CODE " +
    "SYSRES_CONST_NAMEAN_INPUT_TYPE " +
    "SYSRES_CONST_NEGATIVE_PICK_VALUE " +
    "SYSRES_CONST_NEGATIVE_VALUE " +
    "SYSRES_CONST_NO " +
    "SYSRES_CONST_NO_PICK_VALUE " +
    "SYSRES_CONST_NO_SIGNATURE_REQUISITE_CODE " +
    "SYSRES_CONST_NO_VALUE " +
    "SYSRES_CONST_NONE_ACCESS_RIGHTS_TYPE_CODE " +
    "SYSRES_CONST_NONOPERATING_RECORD_FLAG_VALUE " +
    "SYSRES_CONST_NONOPERATING_RECORD_FLAG_VALUE_MASCULINE " +
    "SYSRES_CONST_NORMAL_ACCESS_RIGHTS_TYPE_CODE " +
    "SYSRES_CONST_NORMAL_LIFE_CYCLE_STAGE_DRAW_STYLE " +
    "SYSRES_CONST_NORMAL_MODE_NAME " +
    "SYSRES_CONST_NOT_ALLOWED_ACCESS_TYPE_CODE " +
    "SYSRES_CONST_NOT_ALLOWED_ACCESS_TYPE_NAME " +
    "SYSRES_CONST_NOTE_REQUISITE_CODE " +
    "SYSRES_CONST_NOTICE_BLOCK_DESCRIPTION " +
    "SYSRES_CONST_NUM_REQUISITE " +
    "SYSRES_CONST_NUM_STR_REQUISITE_CODE " +
    "SYSRES_CONST_NUMERATION_AUTO_NOT_STRONG " +
    "SYSRES_CONST_NUMERATION_AUTO_STRONG " +
    "SYSRES_CONST_NUMERATION_FROM_DICTONARY " +
    "SYSRES_CONST_NUMERATION_MANUAL " +
    "SYSRES_CONST_NUMERIC_TYPE_CHAR " +
    "SYSRES_CONST_NUMREQ_REQUISITE_CODE " +
    "SYSRES_CONST_OBSOLETE_VERSION_STATE_PICK_VALUE " +
    "SYSRES_CONST_OPERATING_RECORD_FLAG_VALUE " +
    "SYSRES_CONST_OPERATING_RECORD_FLAG_VALUE_CODE " +
    "SYSRES_CONST_OPERATING_RECORD_FLAG_VALUE_FEMININE " +
    "SYSRES_CONST_OPERATING_RECORD_FLAG_VALUE_MASCULINE " +
    "SYSRES_CONST_OPTIONAL_FORM_COMP_REQCODE_PREFIX " +
    "SYSRES_CONST_ORANGE_LIFE_CYCLE_STAGE_FONT_COLOR " +
    "SYSRES_CONST_ORIGINALREF_REQUISITE_CODE " +
    "SYSRES_CONST_OURFIRM_REF_CODE " +
    "SYSRES_CONST_OURFIRM_REQUISITE_CODE " +
    "SYSRES_CONST_OURFIRM_VAR " +
    "SYSRES_CONST_OUTGOING_WORK_RULE_TYPE_CODE " +
    "SYSRES_CONST_PICK_NEGATIVE_RESULT " +
    "SYSRES_CONST_PICK_POSITIVE_RESULT " +
    "SYSRES_CONST_PICK_REQUISITE " +
    "SYSRES_CONST_PICK_REQUISITE_TYPE " +
    "SYSRES_CONST_PICK_TYPE_CHAR " +
    "SYSRES_CONST_PLAN_STATUS_REQUISITE_CODE " +
    "SYSRES_CONST_PLATFORM_VERSION_COMMENT " +
    "SYSRES_CONST_PLUGINS_SETTINGS_DESCRIPTION_REQUISITE_CODE " +
    "SYSRES_CONST_POSITIVE_PICK_VALUE " +
    "SYSRES_CONST_POWER_TO_CREATE_ACTION_CODE " +
    "SYSRES_CONST_POWER_TO_SIGN_ACTION_CODE " +
    "SYSRES_CONST_PRIORITY_REQUISITE_CODE " +
    "SYSRES_CONST_QUALIFIED_TASK_TYPE " +
    "SYSRES_CONST_QUALIFIED_TASK_TYPE_CODE " +
    "SYSRES_CONST_RECSTAT_REQUISITE_CODE " +
    "SYSRES_CONST_RED_LIFE_CYCLE_STAGE_FONT_COLOR " +
    "SYSRES_CONST_REF_ID_T_REF_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_REF_REQUISITE " +
    "SYSRES_CONST_REF_REQUISITE_TYPE " +
    "SYSRES_CONST_REF_REQUISITES_REFERENCE_CODE_SELECTED_REQUISITE " +
    "SYSRES_CONST_REFERENCE_RECORD_HISTORY_CREATE_ACTION_CODE " +
    "SYSRES_CONST_REFERENCE_RECORD_HISTORY_DELETE_ACTION_CODE " +
    "SYSRES_CONST_REFERENCE_RECORD_HISTORY_MODIFY_ACTION_CODE " +
    "SYSRES_CONST_REFERENCE_TYPE_CHAR " +
    "SYSRES_CONST_REFERENCE_TYPE_REQUISITE_NAME " +
    "SYSRES_CONST_REFERENCES_ADD_PARAMS_REQUISITE_CODE " +
    "SYSRES_CONST_REFERENCES_DISPLAY_REQUISITE_REQUISITE_CODE " +
    "SYSRES_CONST_REMOTE_SERVER_STATUS_WORKING " +
    "SYSRES_CONST_REMOTE_SERVER_TYPE_MAIN " +
    "SYSRES_CONST_REMOTE_SERVER_TYPE_SECONDARY " +
    "SYSRES_CONST_REMOTE_USER_FLAG_VALUE_CODE " +
    "SYSRES_CONST_REPORT_APP_EDITOR_INTERNAL " +
    "SYSRES_CONST_REPORT_BASE_REPORT_ID_REQUISITE_CODE " +
    "SYSRES_CONST_REPORT_BASE_REPORT_REQUISITE_CODE " +
    "SYSRES_CONST_REPORT_SCRIPT_REQUISITE_CODE " +
    "SYSRES_CONST_REPORT_TEMPLATE_REQUISITE_CODE " +
    "SYSRES_CONST_REPORT_VIEWER_CODE_REQUISITE_CODE " +
    "SYSRES_CONST_REQ_ALLOW_COMPONENT_DEFAULT_VALUE " +
    "SYSRES_CONST_REQ_ALLOW_RECORD_DEFAULT_VALUE " +
    "SYSRES_CONST_REQ_ALLOW_SERVER_COMPONENT_DEFAULT_VALUE " +
    "SYSRES_CONST_REQ_MODE_AVAILABLE_CODE " +
    "SYSRES_CONST_REQ_MODE_EDIT_CODE " +
    "SYSRES_CONST_REQ_MODE_HIDDEN_CODE " +
    "SYSRES_CONST_REQ_MODE_NOT_AVAILABLE_CODE " +
    "SYSRES_CONST_REQ_MODE_VIEW_CODE " +
    "SYSRES_CONST_REQ_NUMBER_REQUISITE_CODE " +
    "SYSRES_CONST_REQ_SECTION_VALUE " +
    "SYSRES_CONST_REQ_TYPE_VALUE " +
    "SYSRES_CONST_REQUISITE_FORMAT_BY_UNIT " +
    "SYSRES_CONST_REQUISITE_FORMAT_DATE_FULL " +
    "SYSRES_CONST_REQUISITE_FORMAT_DATE_TIME " +
    "SYSRES_CONST_REQUISITE_FORMAT_LEFT " +
    "SYSRES_CONST_REQUISITE_FORMAT_RIGHT " +
    "SYSRES_CONST_REQUISITE_FORMAT_WITHOUT_UNIT " +
    "SYSRES_CONST_REQUISITE_NUMBER_REQUISITE_CODE " +
    "SYSRES_CONST_REQUISITE_SECTION_ACTIONS " +
    "SYSRES_CONST_REQUISITE_SECTION_BUTTON " +
    "SYSRES_CONST_REQUISITE_SECTION_BUTTONS " +
    "SYSRES_CONST_REQUISITE_SECTION_CARD " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE10 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE11 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE12 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE13 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE14 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE15 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE16 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE17 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE18 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE19 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE2 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE20 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE21 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE22 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE23 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE24 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE3 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE4 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE5 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE6 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE7 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE8 " +
    "SYSRES_CONST_REQUISITE_SECTION_TABLE9 " +
    "SYSRES_CONST_REQUISITES_PSEUDOREFERENCE_REQUISITE_NUMBER_REQUISITE_CODE " +
    "SYSRES_CONST_RIGHT_ALIGNMENT_CODE " +
    "SYSRES_CONST_ROLES_REFERENCE_CODE " +
    "SYSRES_CONST_ROUTE_STEP_AFTER_RUS " +
    "SYSRES_CONST_ROUTE_STEP_AND_CONDITION_RUS " +
    "SYSRES_CONST_ROUTE_STEP_OR_CONDITION_RUS " +
    "SYSRES_CONST_ROUTE_TYPE_COMPLEX " +
    "SYSRES_CONST_ROUTE_TYPE_PARALLEL " +
    "SYSRES_CONST_ROUTE_TYPE_SERIAL " +
    "SYSRES_CONST_SBDATASETDESC_NEGATIVE_VALUE " +
    "SYSRES_CONST_SBDATASETDESC_POSITIVE_VALUE " +
    "SYSRES_CONST_SBVIEWSDESC_POSITIVE_VALUE " +
    "SYSRES_CONST_SCRIPT_BLOCK_DESCRIPTION " +
    "SYSRES_CONST_SEARCH_BY_TEXT_REQUISITE_CODE " +
    "SYSRES_CONST_SEARCHES_COMPONENT_CONTENT " +
    "SYSRES_CONST_SEARCHES_CRITERIA_ACTION_NAME " +
    "SYSRES_CONST_SEARCHES_EDOC_CONTENT " +
    "SYSRES_CONST_SEARCHES_FOLDER_CONTENT " +
    "SYSRES_CONST_SEARCHES_JOB_CONTENT " +
    "SYSRES_CONST_SEARCHES_REFERENCE_CODE " +
    "SYSRES_CONST_SEARCHES_TASK_CONTENT " +
    "SYSRES_CONST_SECOND_CHAR " +
    "SYSRES_CONST_SECTION_REQUISITE_ACTIONS_VALUE " +
    "SYSRES_CONST_SECTION_REQUISITE_CARD_VALUE " +
    "SYSRES_CONST_SECTION_REQUISITE_CODE " +
    "SYSRES_CONST_SECTION_REQUISITE_DETAIL_1_VALUE " +
    "SYSRES_CONST_SECTION_REQUISITE_DETAIL_2_VALUE " +
    "SYSRES_CONST_SECTION_REQUISITE_DETAIL_3_VALUE " +
    "SYSRES_CONST_SECTION_REQUISITE_DETAIL_4_VALUE " +
    "SYSRES_CONST_SECTION_REQUISITE_DETAIL_5_VALUE " +
    "SYSRES_CONST_SECTION_REQUISITE_DETAIL_6_VALUE " +
    "SYSRES_CONST_SELECT_REFERENCE_MODE_NAME " +
    "SYSRES_CONST_SELECT_TYPE_SELECTABLE " +
    "SYSRES_CONST_SELECT_TYPE_SELECTABLE_ONLY_CHILD " +
    "SYSRES_CONST_SELECT_TYPE_SELECTABLE_WITH_CHILD " +
    "SYSRES_CONST_SELECT_TYPE_UNSLECTABLE " +
    "SYSRES_CONST_SERVER_TYPE_MAIN " +
    "SYSRES_CONST_SERVICE_USER_CATEGORY_FIELD_VALUE " +
    "SYSRES_CONST_SETTINGS_USER_REQUISITE_CODE " +
    "SYSRES_CONST_SIGNATURE_AND_ENCODE_CERTIFICATE_TYPE_CODE " +
    "SYSRES_CONST_SIGNATURE_CERTIFICATE_TYPE_CODE " +
    "SYSRES_CONST_SINGULAR_TITLE_REQUISITE_CODE " +
    "SYSRES_CONST_SQL_SERVER_AUTHENTIFICATION_FLAG_VALUE_CODE " +
    "SYSRES_CONST_SQL_SERVER_ENCODE_AUTHENTIFICATION_FLAG_VALUE_CODE " +
    "SYSRES_CONST_STANDART_ROUTE_REFERENCE_CODE " +
    "SYSRES_CONST_STANDART_ROUTE_REFERENCE_COMMENT_REQUISITE_CODE " +
    "SYSRES_CONST_STANDART_ROUTES_GROUPS_REFERENCE_CODE " +
    "SYSRES_CONST_STATE_REQ_NAME " +
    "SYSRES_CONST_STATE_REQUISITE_ACTIVE_VALUE " +
    "SYSRES_CONST_STATE_REQUISITE_CLOSED_VALUE " +
    "SYSRES_CONST_STATE_REQUISITE_CODE " +
    "SYSRES_CONST_STATIC_ROLE_TYPE_CODE " +
    "SYSRES_CONST_STATUS_PLAN_DEFAULT_VALUE " +
    "SYSRES_CONST_STATUS_VALUE_AUTOCLEANING " +
    "SYSRES_CONST_STATUS_VALUE_BLUE_SQUARE " +
    "SYSRES_CONST_STATUS_VALUE_COMPLETE " +
    "SYSRES_CONST_STATUS_VALUE_GREEN_SQUARE " +
    "SYSRES_CONST_STATUS_VALUE_ORANGE_SQUARE " +
    "SYSRES_CONST_STATUS_VALUE_PURPLE_SQUARE " +
    "SYSRES_CONST_STATUS_VALUE_RED_SQUARE " +
    "SYSRES_CONST_STATUS_VALUE_SUSPEND " +
    "SYSRES_CONST_STATUS_VALUE_YELLOW_SQUARE " +
    "SYSRES_CONST_STDROUTE_SHOW_TO_USERS_REQUISITE_CODE " +
    "SYSRES_CONST_STORAGE_TYPE_FILE " +
    "SYSRES_CONST_STORAGE_TYPE_SQL_SERVER " +
    "SYSRES_CONST_STR_REQUISITE " +
    "SYSRES_CONST_STRIKEOUT_LIFE_CYCLE_STAGE_DRAW_STYLE " +
    "SYSRES_CONST_STRING_FORMAT_LEFT_ALIGN_CHAR " +
    "SYSRES_CONST_STRING_FORMAT_RIGHT_ALIGN_CHAR " +
    "SYSRES_CONST_STRING_REQUISITE_CODE " +
    "SYSRES_CONST_STRING_REQUISITE_TYPE " +
    "SYSRES_CONST_STRING_TYPE_CHAR " +
    "SYSRES_CONST_SUBSTITUTES_PSEUDOREFERENCE_CODE " +
    "SYSRES_CONST_SUBTASK_BLOCK_DESCRIPTION " +
    "SYSRES_CONST_SYSTEM_SETTING_CURRENT_USER_PARAM_VALUE " +
    "SYSRES_CONST_SYSTEM_SETTING_EMPTY_VALUE_PARAM_VALUE " +
    "SYSRES_CONST_SYSTEM_VERSION_COMMENT " +
    "SYSRES_CONST_TASK_ACCESS_TYPE_ALL " +
    "SYSRES_CONST_TASK_ACCESS_TYPE_ALL_MEMBERS " +
    "SYSRES_CONST_TASK_ACCESS_TYPE_MANUAL " +
    "SYSRES_CONST_TASK_ENCODE_TYPE_CERTIFICATION " +
    "SYSRES_CONST_TASK_ENCODE_TYPE_CERTIFICATION_AND_PASSWORD " +
    "SYSRES_CONST_TASK_ENCODE_TYPE_NONE " +
    "SYSRES_CONST_TASK_ENCODE_TYPE_PASSWORD " +
    "SYSRES_CONST_TASK_ROUTE_ALL_CONDITION " +
    "SYSRES_CONST_TASK_ROUTE_AND_CONDITION " +
    "SYSRES_CONST_TASK_ROUTE_OR_CONDITION " +
    "SYSRES_CONST_TASK_STATE_ABORTED " +
    "SYSRES_CONST_TASK_STATE_COMPLETE " +
    "SYSRES_CONST_TASK_STATE_CONTINUED " +
    "SYSRES_CONST_TASK_STATE_CONTROL " +
    "SYSRES_CONST_TASK_STATE_INIT " +
    "SYSRES_CONST_TASK_STATE_WORKING " +
    "SYSRES_CONST_TASK_TITLE " +
    "SYSRES_CONST_TASK_TYPES_GROUPS_REFERENCE_CODE " +
    "SYSRES_CONST_TASK_TYPES_REFERENCE_CODE " +
    "SYSRES_CONST_TEMPLATES_REFERENCE_CODE " +
    "SYSRES_CONST_TEST_DATE_REQUISITE_NAME " +
    "SYSRES_CONST_TEST_DEV_DATABASE_NAME " +
    "SYSRES_CONST_TEST_DEV_SYSTEM_CODE " +
    "SYSRES_CONST_TEST_EDMS_DATABASE_NAME " +
    "SYSRES_CONST_TEST_EDMS_MAIN_CODE " +
    "SYSRES_CONST_TEST_EDMS_MAIN_DB_NAME " +
    "SYSRES_CONST_TEST_EDMS_SECOND_CODE " +
    "SYSRES_CONST_TEST_EDMS_SECOND_DB_NAME " +
    "SYSRES_CONST_TEST_EDMS_SYSTEM_CODE " +
    "SYSRES_CONST_TEST_NUMERIC_REQUISITE_NAME " +
    "SYSRES_CONST_TEXT_REQUISITE " +
    "SYSRES_CONST_TEXT_REQUISITE_CODE " +
    "SYSRES_CONST_TEXT_REQUISITE_TYPE " +
    "SYSRES_CONST_TEXT_TYPE_CHAR " +
    "SYSRES_CONST_TYPE_CODE_REQUISITE_CODE " +
    "SYSRES_CONST_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_UNDEFINED_LIFE_CYCLE_STAGE_FONT_COLOR " +
    "SYSRES_CONST_UNITS_SECTION_ID_REQUISITE_CODE " +
    "SYSRES_CONST_UNITS_SECTION_REQUISITE_CODE " +
    "SYSRES_CONST_UNOPERATING_RECORD_FLAG_VALUE_CODE " +
    "SYSRES_CONST_UNSTORED_DATA_REQUISITE_CODE " +
    "SYSRES_CONST_UNSTORED_DATA_REQUISITE_NAME " +
    "SYSRES_CONST_USE_ACCESS_TYPE_CODE " +
    "SYSRES_CONST_USE_ACCESS_TYPE_NAME " +
    "SYSRES_CONST_USER_ACCOUNT_TYPE_VALUE_CODE " +
    "SYSRES_CONST_USER_ADDITIONAL_INFORMATION_REQUISITE_CODE " +
    "SYSRES_CONST_USER_AND_GROUP_ID_FROM_PSEUDOREFERENCE_REQUISITE_CODE " +
    "SYSRES_CONST_USER_CATEGORY_NORMAL " +
    "SYSRES_CONST_USER_CERTIFICATE_REQUISITE_CODE " +
    "SYSRES_CONST_USER_CERTIFICATE_STATE_REQUISITE_CODE " +
    "SYSRES_CONST_USER_CERTIFICATE_SUBJECT_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_USER_CERTIFICATE_THUMBPRINT_REQUISITE_CODE " +
    "SYSRES_CONST_USER_COMMON_CATEGORY " +
    "SYSRES_CONST_USER_COMMON_CATEGORY_CODE " +
    "SYSRES_CONST_USER_FULL_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_USER_GROUP_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_USER_LOGIN_REQUISITE_CODE " +
    "SYSRES_CONST_USER_REMOTE_CONTROLLER_REQUISITE_CODE " +
    "SYSRES_CONST_USER_REMOTE_SYSTEM_REQUISITE_CODE " +
    "SYSRES_CONST_USER_RIGHTS_T_REQUISITE_CODE " +
    "SYSRES_CONST_USER_SERVER_NAME_REQUISITE_CODE " +
    "SYSRES_CONST_USER_SERVICE_CATEGORY " +
    "SYSRES_CONST_USER_SERVICE_CATEGORY_CODE " +
    "SYSRES_CONST_USER_STATUS_ADMINISTRATOR_CODE " +
    "SYSRES_CONST_USER_STATUS_ADMINISTRATOR_NAME " +
    "SYSRES_CONST_USER_STATUS_DEVELOPER_CODE " +
    "SYSRES_CONST_USER_STATUS_DEVELOPER_NAME " +
    "SYSRES_CONST_USER_STATUS_DISABLED_CODE " +
    "SYSRES_CONST_USER_STATUS_DISABLED_NAME " +
    "SYSRES_CONST_USER_STATUS_SYSTEM_DEVELOPER_CODE " +
    "SYSRES_CONST_USER_STATUS_USER_CODE " +
    "SYSRES_CONST_USER_STATUS_USER_NAME " +
    "SYSRES_CONST_USER_STATUS_USER_NAME_DEPRECATED " +
    "SYSRES_CONST_USER_TYPE_FIELD_VALUE_USER " +
    "SYSRES_CONST_USER_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_USERS_CONTROLLER_REQUISITE_CODE " +
    "SYSRES_CONST_USERS_IS_MAIN_SERVER_REQUISITE_CODE " +
    "SYSRES_CONST_USERS_REFERENCE_CODE " +
    "SYSRES_CONST_USERS_REGISTRATION_CERTIFICATES_ACTION_NAME " +
    "SYSRES_CONST_USERS_REQUISITE_CODE " +
    "SYSRES_CONST_USERS_SYSTEM_REQUISITE_CODE " +
    "SYSRES_CONST_USERS_USER_ACCESS_RIGHTS_TYPR_REQUISITE_CODE " +
    "SYSRES_CONST_USERS_USER_AUTHENTICATION_REQUISITE_CODE " +
    "SYSRES_CONST_USERS_USER_COMPONENT_REQUISITE_CODE " +
    "SYSRES_CONST_USERS_USER_GROUP_REQUISITE_CODE " +
    "SYSRES_CONST_USERS_VIEW_CERTIFICATES_ACTION_NAME " +
    "SYSRES_CONST_VIEW_DEFAULT_CODE " +
    "SYSRES_CONST_VIEW_DEFAULT_NAME " +
    "SYSRES_CONST_VIEWER_REQUISITE_CODE " +
    "SYSRES_CONST_WAITING_BLOCK_DESCRIPTION " +
    "SYSRES_CONST_WIZARD_FORM_LABEL_TEST_STRING  " +
    "SYSRES_CONST_WIZARD_QUERY_PARAM_HEIGHT_ETALON_STRING " +
    "SYSRES_CONST_WIZARD_REFERENCE_COMMENT_REQUISITE_CODE " +
    "SYSRES_CONST_WORK_RULES_DESCRIPTION_REQUISITE_CODE " +
    "SYSRES_CONST_WORK_TIME_CALENDAR_REFERENCE_CODE " +
    "SYSRES_CONST_WORK_WORKFLOW_HARD_ROUTE_TYPE_VALUE " +
    "SYSRES_CONST_WORK_WORKFLOW_HARD_ROUTE_TYPE_VALUE_CODE " +
    "SYSRES_CONST_WORK_WORKFLOW_HARD_ROUTE_TYPE_VALUE_CODE_RUS " +
    "SYSRES_CONST_WORK_WORKFLOW_SOFT_ROUTE_TYPE_VALUE_CODE_RUS " +
    "SYSRES_CONST_WORKFLOW_ROUTE_TYPR_HARD " +
    "SYSRES_CONST_WORKFLOW_ROUTE_TYPR_SOFT " +
    "SYSRES_CONST_XML_ENCODING " +
    "SYSRES_CONST_XREC_STAT_REQUISITE_CODE " +
    "SYSRES_CONST_XRECID_FIELD_NAME " +
    "SYSRES_CONST_YES " +
    "SYSRES_CONST_YES_NO_2_REQUISITE_CODE " +
    "SYSRES_CONST_YES_NO_REQUISITE_CODE " +
    "SYSRES_CONST_YES_NO_T_REF_TYPE_REQUISITE_CODE " +
    "SYSRES_CONST_YES_PICK_VALUE " +
    "SYSRES_CONST_YES_VALUE ";

  // Base constant
  var base_constants = "CR FALSE nil NO_VALUE NULL TAB TRUE YES_VALUE ";

  // Base group name
  var base_group_name_constants =
    "ADMINISTRATORS_GROUP_NAME CUSTOMIZERS_GROUP_NAME DEVELOPERS_GROUP_NAME SERVICE_USERS_GROUP_NAME ";

  // Decision block properties
  var decision_block_properties_constants =
    "DECISION_BLOCK_FIRST_OPERAND_PROPERTY DECISION_BLOCK_NAME_PROPERTY DECISION_BLOCK_OPERATION_PROPERTY " +
    "DECISION_BLOCK_RESULT_TYPE_PROPERTY DECISION_BLOCK_SECOND_OPERAND_PROPERTY ";

  // File extension
  var file_extension_constants =
    "ANY_FILE_EXTENTION COMPRESSED_DOCUMENT_EXTENSION EXTENDED_DOCUMENT_EXTENSION " +
    "SHORT_COMPRESSED_DOCUMENT_EXTENSION SHORT_EXTENDED_DOCUMENT_EXTENSION ";

  // Job block properties
  var job_block_properties_constants =
    "JOB_BLOCK_ABORT_DEADLINE_PROPERTY " +
    "JOB_BLOCK_AFTER_FINISH_EVENT " +
    "JOB_BLOCK_AFTER_QUERY_PARAMETERS_EVENT " +
    "JOB_BLOCK_ATTACHMENT_PROPERTY " +
    "JOB_BLOCK_ATTACHMENTS_RIGHTS_GROUP_PROPERTY " +
    "JOB_BLOCK_ATTACHMENTS_RIGHTS_TYPE_PROPERTY " +
    "JOB_BLOCK_BEFORE_QUERY_PARAMETERS_EVENT " +
    "JOB_BLOCK_BEFORE_START_EVENT " +
    "JOB_BLOCK_CREATED_JOBS_PROPERTY " +
    "JOB_BLOCK_DEADLINE_PROPERTY " +
    "JOB_BLOCK_EXECUTION_RESULTS_PROPERTY " +
    "JOB_BLOCK_IS_PARALLEL_PROPERTY " +
    "JOB_BLOCK_IS_RELATIVE_ABORT_DEADLINE_PROPERTY " +
    "JOB_BLOCK_IS_RELATIVE_DEADLINE_PROPERTY " +
    "JOB_BLOCK_JOB_TEXT_PROPERTY " +
    "JOB_BLOCK_NAME_PROPERTY " +
    "JOB_BLOCK_NEED_SIGN_ON_PERFORM_PROPERTY " +
    "JOB_BLOCK_PERFORMER_PROPERTY " +
    "JOB_BLOCK_RELATIVE_ABORT_DEADLINE_TYPE_PROPERTY " +
    "JOB_BLOCK_RELATIVE_DEADLINE_TYPE_PROPERTY " +
    "JOB_BLOCK_SUBJECT_PROPERTY ";

  // Language code
  var language_code_constants = "ENGLISH_LANGUAGE_CODE RUSSIAN_LANGUAGE_CODE ";

  // Launching external applications
  var launching_external_applications_constants =
    "smHidden smMaximized smMinimized smNormal wmNo wmYes ";

  // Link kind
  var link_kind_constants =
    "COMPONENT_TOKEN_LINK_KIND " +
    "DOCUMENT_LINK_KIND " +
    "EDOCUMENT_LINK_KIND " +
    "FOLDER_LINK_KIND " +
    "JOB_LINK_KIND " +
    "REFERENCE_LINK_KIND " +
    "TASK_LINK_KIND ";

  // Lock type
  var lock_type_constants =
    "COMPONENT_TOKEN_LOCK_TYPE EDOCUMENT_VERSION_LOCK_TYPE ";

  // Monitor block properties
  var monitor_block_properties_constants =
    "MONITOR_BLOCK_AFTER_FINISH_EVENT " +
    "MONITOR_BLOCK_BEFORE_START_EVENT " +
    "MONITOR_BLOCK_DEADLINE_PROPERTY " +
    "MONITOR_BLOCK_INTERVAL_PROPERTY " +
    "MONITOR_BLOCK_INTERVAL_TYPE_PROPERTY " +
    "MONITOR_BLOCK_IS_RELATIVE_DEADLINE_PROPERTY " +
    "MONITOR_BLOCK_NAME_PROPERTY " +
    "MONITOR_BLOCK_RELATIVE_DEADLINE_TYPE_PROPERTY " +
    "MONITOR_BLOCK_SEARCH_SCRIPT_PROPERTY ";

  // Notice block properties
  var notice_block_properties_constants =
    "NOTICE_BLOCK_AFTER_FINISH_EVENT " +
    "NOTICE_BLOCK_ATTACHMENT_PROPERTY " +
    "NOTICE_BLOCK_ATTACHMENTS_RIGHTS_GROUP_PROPERTY " +
    "NOTICE_BLOCK_ATTACHMENTS_RIGHTS_TYPE_PROPERTY " +
    "NOTICE_BLOCK_BEFORE_START_EVENT " +
    "NOTICE_BLOCK_CREATED_NOTICES_PROPERTY " +
    "NOTICE_BLOCK_DEADLINE_PROPERTY " +
    "NOTICE_BLOCK_IS_RELATIVE_DEADLINE_PROPERTY " +
    "NOTICE_BLOCK_NAME_PROPERTY " +
    "NOTICE_BLOCK_NOTICE_TEXT_PROPERTY " +
    "NOTICE_BLOCK_PERFORMER_PROPERTY " +
    "NOTICE_BLOCK_RELATIVE_DEADLINE_TYPE_PROPERTY " +
    "NOTICE_BLOCK_SUBJECT_PROPERTY ";

  // Object events
  var object_events_constants =
    "dseAfterCancel " +
    "dseAfterClose " +
    "dseAfterDelete " +
    "dseAfterDeleteOutOfTransaction " +
    "dseAfterInsert " +
    "dseAfterOpen " +
    "dseAfterScroll " +
    "dseAfterUpdate " +
    "dseAfterUpdateOutOfTransaction " +
    "dseBeforeCancel " +
    "dseBeforeClose " +
    "dseBeforeDelete " +
    "dseBeforeDetailUpdate " +
    "dseBeforeInsert " +
    "dseBeforeOpen " +
    "dseBeforeUpdate " +
    "dseOnAnyRequisiteChange " +
    "dseOnCloseRecord " +
    "dseOnDeleteError " +
    "dseOnOpenRecord " +
    "dseOnPrepareUpdate " +
    "dseOnUpdateError " +
    "dseOnUpdateRatifiedRecord " +
    "dseOnValidDelete " +
    "dseOnValidUpdate " +
    "reOnChange " +
    "reOnChangeValues " +
    "SELECTION_BEGIN_ROUTE_EVENT " +
    "SELECTION_END_ROUTE_EVENT ";

  // Object params
  var object_params_constants =
    "CURRENT_PERIOD_IS_REQUIRED " +
    "PREVIOUS_CARD_TYPE_NAME " +
    "SHOW_RECORD_PROPERTIES_FORM ";

  // Other
  var other_constants =
    "ACCESS_RIGHTS_SETTING_DIALOG_CODE " +
    "ADMINISTRATOR_USER_CODE " +
    "ANALYTIC_REPORT_TYPE " +
    "asrtHideLocal " +
    "asrtHideRemote " +
    "CALCULATED_ROLE_TYPE_CODE " +
    "COMPONENTS_REFERENCE_DEVELOPER_VIEW_CODE " +
    "DCTS_TEST_PROTOCOLS_FOLDER_PATH " +
    "E_EDOC_VERSION_ALREADY_APPROVINGLY_SIGNED " +
    "E_EDOC_VERSION_ALREADY_APPROVINGLY_SIGNED_BY_USER " +
    "E_EDOC_VERSION_ALREDY_SIGNED " +
    "E_EDOC_VERSION_ALREDY_SIGNED_BY_USER " +
    "EDOC_TYPES_CODE_REQUISITE_FIELD_NAME " +
    "EDOCUMENTS_ALIAS_NAME " +
    "FILES_FOLDER_PATH " +
    "FILTER_OPERANDS_DELIMITER " +
    "FILTER_OPERATIONS_DELIMITER " +
    "FORMCARD_NAME " +
    "FORMLIST_NAME " +
    "GET_EXTENDED_DOCUMENT_EXTENSION_CREATION_MODE " +
    "GET_EXTENDED_DOCUMENT_EXTENSION_IMPORT_MODE " +
    "INTEGRATED_REPORT_TYPE " +
    "IS_BUILDER_APPLICATION_ROLE " +
    "IS_BUILDER_APPLICATION_ROLE2 " +
    "IS_BUILDER_USERS " +
    "ISBSYSDEV " +
    "LOG_FOLDER_PATH " +
    "mbCancel " +
    "mbNo " +
    "mbNoToAll " +
    "mbOK " +
    "mbYes " +
    "mbYesToAll " +
    "MEMORY_DATASET_DESRIPTIONS_FILENAME " +
    "mrNo " +
    "mrNoToAll " +
    "mrYes " +
    "mrYesToAll " +
    "MULTIPLE_SELECT_DIALOG_CODE " +
    "NONOPERATING_RECORD_FLAG_FEMININE " +
    "NONOPERATING_RECORD_FLAG_MASCULINE " +
    "OPERATING_RECORD_FLAG_FEMININE " +
    "OPERATING_RECORD_FLAG_MASCULINE " +
    "PROFILING_SETTINGS_COMMON_SETTINGS_CODE_VALUE " +
    "PROGRAM_INITIATED_LOOKUP_ACTION " +
    "ratDelete " +
    "ratEdit " +
    "ratInsert " +
    "REPORT_TYPE " +
    "REQUIRED_PICK_VALUES_VARIABLE " +
    "rmCard " +
    "rmList " +
    "SBRTE_PROGID_DEV " +
    "SBRTE_PROGID_RELEASE " +
    "STATIC_ROLE_TYPE_CODE " +
    "SUPPRESS_EMPTY_TEMPLATE_CREATION " +
    "SYSTEM_USER_CODE " +
    "UPDATE_DIALOG_DATASET " +
    "USED_IN_OBJECT_HINT_PARAM " +
    "USER_INITIATED_LOOKUP_ACTION " +
    "USER_NAME_FORMAT " +
    "USER_SELECTION_RESTRICTIONS " +
    "WORKFLOW_TEST_PROTOCOLS_FOLDER_PATH " +
    "ELS_SUBTYPE_CONTROL_NAME " +
    "ELS_FOLDER_KIND_CONTROL_NAME " +
    "REPEAT_PROCESS_CURRENT_OBJECT_EXCEPTION_NAME ";

  // Privileges
  var privileges_constants =
    "PRIVILEGE_COMPONENT_FULL_ACCESS " +
    "PRIVILEGE_DEVELOPMENT_EXPORT " +
    "PRIVILEGE_DEVELOPMENT_IMPORT " +
    "PRIVILEGE_DOCUMENT_DELETE " +
    "PRIVILEGE_ESD " +
    "PRIVILEGE_FOLDER_DELETE " +
    "PRIVILEGE_MANAGE_ACCESS_RIGHTS " +
    "PRIVILEGE_MANAGE_REPLICATION " +
    "PRIVILEGE_MANAGE_SESSION_SERVER " +
    "PRIVILEGE_OBJECT_FULL_ACCESS " +
    "PRIVILEGE_OBJECT_VIEW " +
    "PRIVILEGE_RESERVE_LICENSE " +
    "PRIVILEGE_SYSTEM_CUSTOMIZE " +
    "PRIVILEGE_SYSTEM_DEVELOP " +
    "PRIVILEGE_SYSTEM_INSTALL " +
    "PRIVILEGE_TASK_DELETE " +
    "PRIVILEGE_USER_PLUGIN_SETTINGS_CUSTOMIZE " +
    "PRIVILEGES_PSEUDOREFERENCE_CODE ";

  // Pseudoreference code
  var pseudoreference_code_constants =
    "ACCESS_TYPES_PSEUDOREFERENCE_CODE " +
    "ALL_AVAILABLE_COMPONENTS_PSEUDOREFERENCE_CODE " +
    "ALL_AVAILABLE_PRIVILEGES_PSEUDOREFERENCE_CODE " +
    "ALL_REPLICATE_COMPONENTS_PSEUDOREFERENCE_CODE " +
    "AVAILABLE_DEVELOPERS_COMPONENTS_PSEUDOREFERENCE_CODE " +
    "COMPONENTS_PSEUDOREFERENCE_CODE " +
    "FILTRATER_SETTINGS_CONFLICTS_PSEUDOREFERENCE_CODE " +
    "GROUPS_PSEUDOREFERENCE_CODE " +
    "RECEIVE_PROTOCOL_PSEUDOREFERENCE_CODE " +
    "REFERENCE_REQUISITE_PSEUDOREFERENCE_CODE " +
    "REFERENCE_REQUISITES_PSEUDOREFERENCE_CODE " +
    "REFTYPES_PSEUDOREFERENCE_CODE " +
    "REPLICATION_SEANCES_DIARY_PSEUDOREFERENCE_CODE " +
    "SEND_PROTOCOL_PSEUDOREFERENCE_CODE " +
    "SUBSTITUTES_PSEUDOREFERENCE_CODE " +
    "SYSTEM_SETTINGS_PSEUDOREFERENCE_CODE " +
    "UNITS_PSEUDOREFERENCE_CODE " +
    "USERS_PSEUDOREFERENCE_CODE " +
    "VIEWERS_PSEUDOREFERENCE_CODE ";

  // Requisite ISBCertificateType values
  var requisite_ISBCertificateType_values_constants =
    "CERTIFICATE_TYPE_ENCRYPT " +
    "CERTIFICATE_TYPE_SIGN " +
    "CERTIFICATE_TYPE_SIGN_AND_ENCRYPT ";

  // Requisite ISBEDocStorageType values
  var requisite_ISBEDocStorageType_values_constants =
    "STORAGE_TYPE_FILE " +
    "STORAGE_TYPE_NAS_CIFS " +
    "STORAGE_TYPE_SAPERION " +
    "STORAGE_TYPE_SQL_SERVER ";

  // Requisite CompType2 values
  var requisite_compType2_values_constants =
    "COMPTYPE2_REQUISITE_DOCUMENTS_VALUE " +
    "COMPTYPE2_REQUISITE_TASKS_VALUE " +
    "COMPTYPE2_REQUISITE_FOLDERS_VALUE " +
    "COMPTYPE2_REQUISITE_REFERENCES_VALUE ";

  // Requisite name
  var requisite_name_constants =
    "SYSREQ_CODE " +
    "SYSREQ_COMPTYPE2 " +
    "SYSREQ_CONST_AVAILABLE_FOR_WEB " +
    "SYSREQ_CONST_COMMON_CODE " +
    "SYSREQ_CONST_COMMON_VALUE " +
    "SYSREQ_CONST_FIRM_CODE " +
    "SYSREQ_CONST_FIRM_STATUS " +
    "SYSREQ_CONST_FIRM_VALUE " +
    "SYSREQ_CONST_SERVER_STATUS " +
    "SYSREQ_CONTENTS " +
    "SYSREQ_DATE_OPEN " +
    "SYSREQ_DATE_CLOSE " +
    "SYSREQ_DESCRIPTION " +
    "SYSREQ_DESCRIPTION_LOCALIZE_ID " +
    "SYSREQ_DOUBLE " +
    "SYSREQ_EDOC_ACCESS_TYPE " +
    "SYSREQ_EDOC_AUTHOR " +
    "SYSREQ_EDOC_CREATED " +
    "SYSREQ_EDOC_DELEGATE_RIGHTS_REQUISITE_CODE " +
    "SYSREQ_EDOC_EDITOR " +
    "SYSREQ_EDOC_ENCODE_TYPE " +
    "SYSREQ_EDOC_ENCRYPTION_PLUGIN_NAME " +
    "SYSREQ_EDOC_ENCRYPTION_PLUGIN_VERSION " +
    "SYSREQ_EDOC_EXPORT_DATE " +
    "SYSREQ_EDOC_EXPORTER " +
    "SYSREQ_EDOC_KIND " +
    "SYSREQ_EDOC_LIFE_STAGE_NAME " +
    "SYSREQ_EDOC_LOCKED_FOR_SERVER_CODE " +
    "SYSREQ_EDOC_MODIFIED " +
    "SYSREQ_EDOC_NAME " +
    "SYSREQ_EDOC_NOTE " +
    "SYSREQ_EDOC_QUALIFIED_ID " +
    "SYSREQ_EDOC_SESSION_KEY " +
    "SYSREQ_EDOC_SESSION_KEY_ENCRYPTION_PLUGIN_NAME " +
    "SYSREQ_EDOC_SESSION_KEY_ENCRYPTION_PLUGIN_VERSION " +
    "SYSREQ_EDOC_SIGNATURE_TYPE " +
    "SYSREQ_EDOC_SIGNED " +
    "SYSREQ_EDOC_STORAGE " +
    "SYSREQ_EDOC_STORAGES_ARCHIVE_STORAGE " +
    "SYSREQ_EDOC_STORAGES_CHECK_RIGHTS " +
    "SYSREQ_EDOC_STORAGES_COMPUTER_NAME " +
    "SYSREQ_EDOC_STORAGES_EDIT_IN_STORAGE " +
    "SYSREQ_EDOC_STORAGES_EXECUTIVE_STORAGE " +
    "SYSREQ_EDOC_STORAGES_FUNCTION " +
    "SYSREQ_EDOC_STORAGES_INITIALIZED " +
    "SYSREQ_EDOC_STORAGES_LOCAL_PATH " +
    "SYSREQ_EDOC_STORAGES_SAPERION_DATABASE_NAME " +
    "SYSREQ_EDOC_STORAGES_SEARCH_BY_TEXT " +
    "SYSREQ_EDOC_STORAGES_SERVER_NAME " +
    "SYSREQ_EDOC_STORAGES_SHARED_SOURCE_NAME " +
    "SYSREQ_EDOC_STORAGES_TYPE " +
    "SYSREQ_EDOC_TEXT_MODIFIED " +
    "SYSREQ_EDOC_TYPE_ACT_CODE " +
    "SYSREQ_EDOC_TYPE_ACT_DESCRIPTION " +
    "SYSREQ_EDOC_TYPE_ACT_DESCRIPTION_LOCALIZE_ID " +
    "SYSREQ_EDOC_TYPE_ACT_ON_EXECUTE " +
    "SYSREQ_EDOC_TYPE_ACT_ON_EXECUTE_EXISTS " +
    "SYSREQ_EDOC_TYPE_ACT_SECTION " +
    "SYSREQ_EDOC_TYPE_ADD_PARAMS " +
    "SYSREQ_EDOC_TYPE_COMMENT " +
    "SYSREQ_EDOC_TYPE_EVENT_TEXT " +
    "SYSREQ_EDOC_TYPE_NAME_IN_SINGULAR " +
    "SYSREQ_EDOC_TYPE_NAME_IN_SINGULAR_LOCALIZE_ID " +
    "SYSREQ_EDOC_TYPE_NAME_LOCALIZE_ID " +
    "SYSREQ_EDOC_TYPE_NUMERATION_METHOD " +
    "SYSREQ_EDOC_TYPE_PSEUDO_REQUISITE_CODE " +
    "SYSREQ_EDOC_TYPE_REQ_CODE " +
    "SYSREQ_EDOC_TYPE_REQ_DESCRIPTION " +
    "SYSREQ_EDOC_TYPE_REQ_DESCRIPTION_LOCALIZE_ID " +
    "SYSREQ_EDOC_TYPE_REQ_IS_LEADING " +
    "SYSREQ_EDOC_TYPE_REQ_IS_REQUIRED " +
    "SYSREQ_EDOC_TYPE_REQ_NUMBER " +
    "SYSREQ_EDOC_TYPE_REQ_ON_CHANGE " +
    "SYSREQ_EDOC_TYPE_REQ_ON_CHANGE_EXISTS " +
    "SYSREQ_EDOC_TYPE_REQ_ON_SELECT " +
    "SYSREQ_EDOC_TYPE_REQ_ON_SELECT_KIND " +
    "SYSREQ_EDOC_TYPE_REQ_SECTION " +
    "SYSREQ_EDOC_TYPE_VIEW_CARD " +
    "SYSREQ_EDOC_TYPE_VIEW_CODE " +
    "SYSREQ_EDOC_TYPE_VIEW_COMMENT " +
    "SYSREQ_EDOC_TYPE_VIEW_IS_MAIN " +
    "SYSREQ_EDOC_TYPE_VIEW_NAME " +
    "SYSREQ_EDOC_TYPE_VIEW_NAME_LOCALIZE_ID " +
    "SYSREQ_EDOC_VERSION_AUTHOR " +
    "SYSREQ_EDOC_VERSION_CRC " +
    "SYSREQ_EDOC_VERSION_DATA " +
    "SYSREQ_EDOC_VERSION_EDITOR " +
    "SYSREQ_EDOC_VERSION_EXPORT_DATE " +
    "SYSREQ_EDOC_VERSION_EXPORTER " +
    "SYSREQ_EDOC_VERSION_HIDDEN " +
    "SYSREQ_EDOC_VERSION_LIFE_STAGE " +
    "SYSREQ_EDOC_VERSION_MODIFIED " +
    "SYSREQ_EDOC_VERSION_NOTE " +
    "SYSREQ_EDOC_VERSION_SIGNATURE_TYPE " +
    "SYSREQ_EDOC_VERSION_SIGNED " +
    "SYSREQ_EDOC_VERSION_SIZE " +
    "SYSREQ_EDOC_VERSION_SOURCE " +
    "SYSREQ_EDOC_VERSION_TEXT_MODIFIED " +
    "SYSREQ_EDOCKIND_DEFAULT_VERSION_STATE_CODE " +
    "SYSREQ_FOLDER_KIND " +
    "SYSREQ_FUNC_CATEGORY " +
    "SYSREQ_FUNC_COMMENT " +
    "SYSREQ_FUNC_GROUP " +
    "SYSREQ_FUNC_GROUP_COMMENT " +
    "SYSREQ_FUNC_GROUP_NUMBER " +
    "SYSREQ_FUNC_HELP " +
    "SYSREQ_FUNC_PARAM_DEF_VALUE " +
    "SYSREQ_FUNC_PARAM_IDENT " +
    "SYSREQ_FUNC_PARAM_NUMBER " +
    "SYSREQ_FUNC_PARAM_TYPE " +
    "SYSREQ_FUNC_TEXT " +
    "SYSREQ_GROUP_CATEGORY " +
    "SYSREQ_ID " +
    "SYSREQ_LAST_UPDATE " +
    "SYSREQ_LEADER_REFERENCE " +
    "SYSREQ_LINE_NUMBER " +
    "SYSREQ_MAIN_RECORD_ID " +
    "SYSREQ_NAME " +
    "SYSREQ_NAME_LOCALIZE_ID " +
    "SYSREQ_NOTE " +
    "SYSREQ_ORIGINAL_RECORD " +
    "SYSREQ_OUR_FIRM " +
    "SYSREQ_PROFILING_SETTINGS_BATCH_LOGING " +
    "SYSREQ_PROFILING_SETTINGS_BATCH_SIZE " +
    "SYSREQ_PROFILING_SETTINGS_PROFILING_ENABLED " +
    "SYSREQ_PROFILING_SETTINGS_SQL_PROFILING_ENABLED " +
    "SYSREQ_PROFILING_SETTINGS_START_LOGGED " +
    "SYSREQ_RECORD_STATUS " +
    "SYSREQ_REF_REQ_FIELD_NAME " +
    "SYSREQ_REF_REQ_FORMAT " +
    "SYSREQ_REF_REQ_GENERATED " +
    "SYSREQ_REF_REQ_LENGTH " +
    "SYSREQ_REF_REQ_PRECISION " +
    "SYSREQ_REF_REQ_REFERENCE " +
    "SYSREQ_REF_REQ_SECTION " +
    "SYSREQ_REF_REQ_STORED " +
    "SYSREQ_REF_REQ_TOKENS " +
    "SYSREQ_REF_REQ_TYPE " +
    "SYSREQ_REF_REQ_VIEW " +
    "SYSREQ_REF_TYPE_ACT_CODE " +
    "SYSREQ_REF_TYPE_ACT_DESCRIPTION " +
    "SYSREQ_REF_TYPE_ACT_DESCRIPTION_LOCALIZE_ID " +
    "SYSREQ_REF_TYPE_ACT_ON_EXECUTE " +
    "SYSREQ_REF_TYPE_ACT_ON_EXECUTE_EXISTS " +
    "SYSREQ_REF_TYPE_ACT_SECTION " +
    "SYSREQ_REF_TYPE_ADD_PARAMS " +
    "SYSREQ_REF_TYPE_COMMENT " +
    "SYSREQ_REF_TYPE_COMMON_SETTINGS " +
    "SYSREQ_REF_TYPE_DISPLAY_REQUISITE_NAME " +
    "SYSREQ_REF_TYPE_EVENT_TEXT " +
    "SYSREQ_REF_TYPE_MAIN_LEADING_REF " +
    "SYSREQ_REF_TYPE_NAME_IN_SINGULAR " +
    "SYSREQ_REF_TYPE_NAME_IN_SINGULAR_LOCALIZE_ID " +
    "SYSREQ_REF_TYPE_NAME_LOCALIZE_ID " +
    "SYSREQ_REF_TYPE_NUMERATION_METHOD " +
    "SYSREQ_REF_TYPE_REQ_CODE " +
    "SYSREQ_REF_TYPE_REQ_DESCRIPTION " +
    "SYSREQ_REF_TYPE_REQ_DESCRIPTION_LOCALIZE_ID " +
    "SYSREQ_REF_TYPE_REQ_IS_CONTROL " +
    "SYSREQ_REF_TYPE_REQ_IS_FILTER " +
    "SYSREQ_REF_TYPE_REQ_IS_LEADING " +
    "SYSREQ_REF_TYPE_REQ_IS_REQUIRED " +
    "SYSREQ_REF_TYPE_REQ_NUMBER " +
    "SYSREQ_REF_TYPE_REQ_ON_CHANGE " +
    "SYSREQ_REF_TYPE_REQ_ON_CHANGE_EXISTS " +
    "SYSREQ_REF_TYPE_REQ_ON_SELECT " +
    "SYSREQ_REF_TYPE_REQ_ON_SELECT_KIND " +
    "SYSREQ_REF_TYPE_REQ_SECTION " +
    "SYSREQ_REF_TYPE_VIEW_CARD " +
    "SYSREQ_REF_TYPE_VIEW_CODE " +
    "SYSREQ_REF_TYPE_VIEW_COMMENT " +
    "SYSREQ_REF_TYPE_VIEW_IS_MAIN " +
    "SYSREQ_REF_TYPE_VIEW_NAME " +
    "SYSREQ_REF_TYPE_VIEW_NAME_LOCALIZE_ID " +
    "SYSREQ_REFERENCE_TYPE_ID " +
    "SYSREQ_STATE " +
    "SYSREQ_STATЕ " +
    "SYSREQ_SYSTEM_SETTINGS_VALUE " +
    "SYSREQ_TYPE " +
    "SYSREQ_UNIT " +
    "SYSREQ_UNIT_ID " +
    "SYSREQ_USER_GROUPS_GROUP_FULL_NAME " +
    "SYSREQ_USER_GROUPS_GROUP_NAME " +
    "SYSREQ_USER_GROUPS_GROUP_SERVER_NAME " +
    "SYSREQ_USERS_ACCESS_RIGHTS " +
    "SYSREQ_USERS_AUTHENTICATION " +
    "SYSREQ_USERS_CATEGORY " +
    "SYSREQ_USERS_COMPONENT " +
    "SYSREQ_USERS_COMPONENT_USER_IS_PUBLIC " +
    "SYSREQ_USERS_DOMAIN " +
    "SYSREQ_USERS_FULL_USER_NAME " +
    "SYSREQ_USERS_GROUP " +
    "SYSREQ_USERS_IS_MAIN_SERVER " +
    "SYSREQ_USERS_LOGIN " +
    "SYSREQ_USERS_REFERENCE_USER_IS_PUBLIC " +
    "SYSREQ_USERS_STATUS " +
    "SYSREQ_USERS_USER_CERTIFICATE " +
    "SYSREQ_USERS_USER_CERTIFICATE_INFO " +
    "SYSREQ_USERS_USER_CERTIFICATE_PLUGIN_NAME " +
    "SYSREQ_USERS_USER_CERTIFICATE_PLUGIN_VERSION " +
    "SYSREQ_USERS_USER_CERTIFICATE_STATE " +
    "SYSREQ_USERS_USER_CERTIFICATE_SUBJECT_NAME " +
    "SYSREQ_USERS_USER_CERTIFICATE_THUMBPRINT " +
    "SYSREQ_USERS_USER_DEFAULT_CERTIFICATE " +
    "SYSREQ_USERS_USER_DESCRIPTION " +
    "SYSREQ_USERS_USER_GLOBAL_NAME " +
    "SYSREQ_USERS_USER_LOGIN " +
    "SYSREQ_USERS_USER_MAIN_SERVER " +
    "SYSREQ_USERS_USER_TYPE " +
    "SYSREQ_WORK_RULES_FOLDER_ID ";

  // Result
  var result_constants = "RESULT_VAR_NAME RESULT_VAR_NAME_ENG ";

  // Rule identification
  var rule_identification_constants =
    "AUTO_NUMERATION_RULE_ID " +
    "CANT_CHANGE_ID_REQUISITE_RULE_ID " +
    "CANT_CHANGE_OURFIRM_REQUISITE_RULE_ID " +
    "CHECK_CHANGING_REFERENCE_RECORD_USE_RULE_ID " +
    "CHECK_CODE_REQUISITE_RULE_ID " +
    "CHECK_DELETING_REFERENCE_RECORD_USE_RULE_ID " +
    "CHECK_FILTRATER_CHANGES_RULE_ID " +
    "CHECK_RECORD_INTERVAL_RULE_ID " +
    "CHECK_REFERENCE_INTERVAL_RULE_ID " +
    "CHECK_REQUIRED_DATA_FULLNESS_RULE_ID " +
    "CHECK_REQUIRED_REQUISITES_FULLNESS_RULE_ID " +
    "MAKE_RECORD_UNRATIFIED_RULE_ID " +
    "RESTORE_AUTO_NUMERATION_RULE_ID " +
    "SET_FIRM_CONTEXT_FROM_RECORD_RULE_ID " +
    "SET_FIRST_RECORD_IN_LIST_FORM_RULE_ID " +
    "SET_IDSPS_VALUE_RULE_ID " +
    "SET_NEXT_CODE_VALUE_RULE_ID " +
    "SET_OURFIRM_BOUNDS_RULE_ID " +
    "SET_OURFIRM_REQUISITE_RULE_ID ";

  // Script block properties
  var script_block_properties_constants =
    "SCRIPT_BLOCK_AFTER_FINISH_EVENT " +
    "SCRIPT_BLOCK_BEFORE_START_EVENT " +
    "SCRIPT_BLOCK_EXECUTION_RESULTS_PROPERTY " +
    "SCRIPT_BLOCK_NAME_PROPERTY " +
    "SCRIPT_BLOCK_SCRIPT_PROPERTY ";

  // Subtask block properties
  var subtask_block_properties_constants =
    "SUBTASK_BLOCK_ABORT_DEADLINE_PROPERTY " +
    "SUBTASK_BLOCK_AFTER_FINISH_EVENT " +
    "SUBTASK_BLOCK_ASSIGN_PARAMS_EVENT " +
    "SUBTASK_BLOCK_ATTACHMENTS_PROPERTY " +
    "SUBTASK_BLOCK_ATTACHMENTS_RIGHTS_GROUP_PROPERTY " +
    "SUBTASK_BLOCK_ATTACHMENTS_RIGHTS_TYPE_PROPERTY " +
    "SUBTASK_BLOCK_BEFORE_START_EVENT " +
    "SUBTASK_BLOCK_CREATED_TASK_PROPERTY " +
    "SUBTASK_BLOCK_CREATION_EVENT " +
    "SUBTASK_BLOCK_DEADLINE_PROPERTY " +
    "SUBTASK_BLOCK_IMPORTANCE_PROPERTY " +
    "SUBTASK_BLOCK_INITIATOR_PROPERTY " +
    "SUBTASK_BLOCK_IS_RELATIVE_ABORT_DEADLINE_PROPERTY " +
    "SUBTASK_BLOCK_IS_RELATIVE_DEADLINE_PROPERTY " +
    "SUBTASK_BLOCK_JOBS_TYPE_PROPERTY " +
    "SUBTASK_BLOCK_NAME_PROPERTY " +
    "SUBTASK_BLOCK_PARALLEL_ROUTE_PROPERTY " +
    "SUBTASK_BLOCK_PERFORMERS_PROPERTY " +
    "SUBTASK_BLOCK_RELATIVE_ABORT_DEADLINE_TYPE_PROPERTY " +
    "SUBTASK_BLOCK_RELATIVE_DEADLINE_TYPE_PROPERTY " +
    "SUBTASK_BLOCK_REQUIRE_SIGN_PROPERTY " +
    "SUBTASK_BLOCK_STANDARD_ROUTE_PROPERTY " +
    "SUBTASK_BLOCK_START_EVENT " +
    "SUBTASK_BLOCK_STEP_CONTROL_PROPERTY " +
    "SUBTASK_BLOCK_SUBJECT_PROPERTY " +
    "SUBTASK_BLOCK_TASK_CONTROL_PROPERTY " +
    "SUBTASK_BLOCK_TEXT_PROPERTY " +
    "SUBTASK_BLOCK_UNLOCK_ATTACHMENTS_ON_STOP_PROPERTY " +
    "SUBTASK_BLOCK_USE_STANDARD_ROUTE_PROPERTY " +
    "SUBTASK_BLOCK_WAIT_FOR_TASK_COMPLETE_PROPERTY ";

  // System component
  var system_component_constants =
    "SYSCOMP_CONTROL_JOBS " +
    "SYSCOMP_FOLDERS " +
    "SYSCOMP_JOBS " +
    "SYSCOMP_NOTICES " +
    "SYSCOMP_TASKS ";

  // System dialogs
  var system_dialogs_constants =
    "SYSDLG_CREATE_EDOCUMENT " +
    "SYSDLG_CREATE_EDOCUMENT_VERSION " +
    "SYSDLG_CURRENT_PERIOD " +
    "SYSDLG_EDIT_FUNCTION_HELP " +
    "SYSDLG_EDOCUMENT_KINDS_FOR_TEMPLATE " +
    "SYSDLG_EXPORT_MULTIPLE_EDOCUMENTS " +
    "SYSDLG_EXPORT_SINGLE_EDOCUMENT " +
    "SYSDLG_IMPORT_EDOCUMENT " +
    "SYSDLG_MULTIPLE_SELECT " +
    "SYSDLG_SETUP_ACCESS_RIGHTS " +
    "SYSDLG_SETUP_DEFAULT_RIGHTS " +
    "SYSDLG_SETUP_FILTER_CONDITION " +
    "SYSDLG_SETUP_SIGN_RIGHTS " +
    "SYSDLG_SETUP_TASK_OBSERVERS " +
    "SYSDLG_SETUP_TASK_ROUTE " +
    "SYSDLG_SETUP_USERS_LIST " +
    "SYSDLG_SIGN_EDOCUMENT " +
    "SYSDLG_SIGN_MULTIPLE_EDOCUMENTS ";

  // System reference names
  var system_reference_names_constants =
    "SYSREF_ACCESS_RIGHTS_TYPES " +
    "SYSREF_ADMINISTRATION_HISTORY " +
    "SYSREF_ALL_AVAILABLE_COMPONENTS " +
    "SYSREF_ALL_AVAILABLE_PRIVILEGES " +
    "SYSREF_ALL_REPLICATING_COMPONENTS " +
    "SYSREF_AVAILABLE_DEVELOPERS_COMPONENTS " +
    "SYSREF_CALENDAR_EVENTS " +
    "SYSREF_COMPONENT_TOKEN_HISTORY " +
    "SYSREF_COMPONENT_TOKENS " +
    "SYSREF_COMPONENTS " +
    "SYSREF_CONSTANTS " +
    "SYSREF_DATA_RECEIVE_PROTOCOL " +
    "SYSREF_DATA_SEND_PROTOCOL " +
    "SYSREF_DIALOGS " +
    "SYSREF_DIALOGS_REQUISITES " +
    "SYSREF_EDITORS " +
    "SYSREF_EDOC_CARDS " +
    "SYSREF_EDOC_TYPES " +
    "SYSREF_EDOCUMENT_CARD_REQUISITES " +
    "SYSREF_EDOCUMENT_CARD_TYPES " +
    "SYSREF_EDOCUMENT_CARD_TYPES_REFERENCE " +
    "SYSREF_EDOCUMENT_CARDS " +
    "SYSREF_EDOCUMENT_HISTORY " +
    "SYSREF_EDOCUMENT_KINDS " +
    "SYSREF_EDOCUMENT_REQUISITES " +
    "SYSREF_EDOCUMENT_SIGNATURES " +
    "SYSREF_EDOCUMENT_TEMPLATES " +
    "SYSREF_EDOCUMENT_TEXT_STORAGES " +
    "SYSREF_EDOCUMENT_VIEWS " +
    "SYSREF_FILTERER_SETUP_CONFLICTS " +
    "SYSREF_FILTRATER_SETTING_CONFLICTS " +
    "SYSREF_FOLDER_HISTORY " +
    "SYSREF_FOLDERS " +
    "SYSREF_FUNCTION_GROUPS " +
    "SYSREF_FUNCTION_PARAMS " +
    "SYSREF_FUNCTIONS " +
    "SYSREF_JOB_HISTORY " +
    "SYSREF_LINKS " +
    "SYSREF_LOCALIZATION_DICTIONARY " +
    "SYSREF_LOCALIZATION_LANGUAGES " +
    "SYSREF_MODULES " +
    "SYSREF_PRIVILEGES " +
    "SYSREF_RECORD_HISTORY " +
    "SYSREF_REFERENCE_REQUISITES " +
    "SYSREF_REFERENCE_TYPE_VIEWS " +
    "SYSREF_REFERENCE_TYPES " +
    "SYSREF_REFERENCES " +
    "SYSREF_REFERENCES_REQUISITES " +
    "SYSREF_REMOTE_SERVERS " +
    "SYSREF_REPLICATION_SESSIONS_LOG " +
    "SYSREF_REPLICATION_SESSIONS_PROTOCOL " +
    "SYSREF_REPORTS " +
    "SYSREF_ROLES " +
    "SYSREF_ROUTE_BLOCK_GROUPS " +
    "SYSREF_ROUTE_BLOCKS " +
    "SYSREF_SCRIPTS " +
    "SYSREF_SEARCHES " +
    "SYSREF_SERVER_EVENTS " +
    "SYSREF_SERVER_EVENTS_HISTORY " +
    "SYSREF_STANDARD_ROUTE_GROUPS " +
    "SYSREF_STANDARD_ROUTES " +
    "SYSREF_STATUSES " +
    "SYSREF_SYSTEM_SETTINGS " +
    "SYSREF_TASK_HISTORY " +
    "SYSREF_TASK_KIND_GROUPS " +
    "SYSREF_TASK_KINDS " +
    "SYSREF_TASK_RIGHTS " +
    "SYSREF_TASK_SIGNATURES " +
    "SYSREF_TASKS " +
    "SYSREF_UNITS " +
    "SYSREF_USER_GROUPS " +
    "SYSREF_USER_GROUPS_REFERENCE " +
    "SYSREF_USER_SUBSTITUTION " +
    "SYSREF_USERS " +
    "SYSREF_USERS_REFERENCE " +
    "SYSREF_VIEWERS " +
    "SYSREF_WORKING_TIME_CALENDARS ";

  // Table name
  var table_name_constants =
    "ACCESS_RIGHTS_TABLE_NAME " +
    "EDMS_ACCESS_TABLE_NAME " +
    "EDOC_TYPES_TABLE_NAME ";

  // Test
  var test_constants =
    "TEST_DEV_DB_NAME " +
    "TEST_DEV_SYSTEM_CODE " +
    "TEST_EDMS_DB_NAME " +
    "TEST_EDMS_MAIN_CODE " +
    "TEST_EDMS_MAIN_DB_NAME " +
    "TEST_EDMS_SECOND_CODE " +
    "TEST_EDMS_SECOND_DB_NAME " +
    "TEST_EDMS_SYSTEM_CODE " +
    "TEST_ISB5_MAIN_CODE " +
    "TEST_ISB5_SECOND_CODE " +
    "TEST_SQL_SERVER_2005_NAME " +
    "TEST_SQL_SERVER_NAME ";

  // Using the dialog windows
  var using_the_dialog_windows_constants =
    "ATTENTION_CAPTION " +
    "cbsCommandLinks " +
    "cbsDefault " +
    "CONFIRMATION_CAPTION " +
    "ERROR_CAPTION " +
    "INFORMATION_CAPTION " +
    "mrCancel " +
    "mrOk ";

  // Using the document
  var using_the_document_constants =
    "EDOC_VERSION_ACTIVE_STAGE_CODE " +
    "EDOC_VERSION_DESIGN_STAGE_CODE " +
    "EDOC_VERSION_OBSOLETE_STAGE_CODE ";

  // Using the EA and encryption
  var using_the_EA_and_encryption_constants =
    "cpDataEnciphermentEnabled " +
    "cpDigitalSignatureEnabled " +
    "cpID " +
    "cpIssuer " +
    "cpPluginVersion " +
    "cpSerial " +
    "cpSubjectName " +
    "cpSubjSimpleName " +
    "cpValidFromDate " +
    "cpValidToDate ";

  // Using the ISBL-editor
  var using_the_ISBL_editor_constants =
    "ISBL_SYNTAX " + "NO_SYNTAX " + "XML_SYNTAX ";

  // Wait block properties
  var wait_block_properties_constants =
    "WAIT_BLOCK_AFTER_FINISH_EVENT " +
    "WAIT_BLOCK_BEFORE_START_EVENT " +
    "WAIT_BLOCK_DEADLINE_PROPERTY " +
    "WAIT_BLOCK_IS_RELATIVE_DEADLINE_PROPERTY " +
    "WAIT_BLOCK_NAME_PROPERTY " +
    "WAIT_BLOCK_RELATIVE_DEADLINE_TYPE_PROPERTY ";

  // SYSRES Common
  var sysres_common_constants =
    "SYSRES_COMMON " +
    "SYSRES_CONST " +
    "SYSRES_MBFUNC " +
    "SYSRES_SBDATA " +
    "SYSRES_SBGUI " +
    "SYSRES_SBINTF " +
    "SYSRES_SBREFDSC " +
    "SYSRES_SQLERRORS " +
    "SYSRES_SYSCOMP ";

  // Константы ==> built_in
  var CONSTANTS =
    sysres_constants +
    base_constants +
    base_group_name_constants +
    decision_block_properties_constants +
    file_extension_constants +
    job_block_properties_constants +
    language_code_constants +
    launching_external_applications_constants +
    link_kind_constants +
    lock_type_constants +
    monitor_block_properties_constants +
    notice_block_properties_constants +
    object_events_constants +
    object_params_constants +
    other_constants +
    privileges_constants +
    pseudoreference_code_constants +
    requisite_ISBCertificateType_values_constants +
    requisite_ISBEDocStorageType_values_constants +
    requisite_compType2_values_constants +
    requisite_name_constants +
    result_constants +
    rule_identification_constants +
    script_block_properties_constants +
    subtask_block_properties_constants +
    system_component_constants +
    system_dialogs_constants +
    system_reference_names_constants +
    table_name_constants +
    test_constants +
    using_the_dialog_windows_constants +
    using_the_document_constants +
    using_the_EA_and_encryption_constants +
    using_the_ISBL_editor_constants +
    wait_block_properties_constants +
    sysres_common_constants;

  // enum TAccountType
  var TAccountType = "atUser atGroup atRole ";

  // enum TActionEnabledMode
  var TActionEnabledMode =
    "aemEnabledAlways " +
    "aemDisabledAlways " +
    "aemEnabledOnBrowse " +
    "aemEnabledOnEdit " +
    "aemDisabledOnBrowseEmpty ";

  // enum TAddPosition
  var TAddPosition = "apBegin apEnd ";

  // enum TAlignment
  var TAlignment = "alLeft alRight ";

  // enum TAreaShowMode
  var TAreaShowMode =
    "asmNever " +
    "asmNoButCustomize " +
    "asmAsLastTime " +
    "asmYesButCustomize " +
    "asmAlways ";

  // enum TCertificateInvalidationReason
  var TCertificateInvalidationReason = "cirCommon cirRevoked ";

  // enum TCertificateType
  var TCertificateType = "ctSignature ctEncode ctSignatureEncode ";

  // enum TCheckListBoxItemState
  var TCheckListBoxItemState = "clbUnchecked clbChecked clbGrayed ";

  // enum TCloseOnEsc
  var TCloseOnEsc = "ceISB ceAlways ceNever ";

  // enum TCompType
  var TCompType =
    "ctDocument " +
    "ctReference " +
    "ctScript " +
    "ctUnknown " +
    "ctReport " +
    "ctDialog " +
    "ctFunction " +
    "ctFolder " +
    "ctEDocument " +
    "ctTask " +
    "ctJob " +
    "ctNotice " +
    "ctControlJob ";

  // enum TConditionFormat
  var TConditionFormat = "cfInternal cfDisplay ";

  // enum TConnectionIntent
  var TConnectionIntent = "ciUnspecified ciWrite ciRead ";

  // enum TContentKind
  var TContentKind =
    "ckFolder " +
    "ckEDocument " +
    "ckTask " +
    "ckJob " +
    "ckComponentToken " +
    "ckAny " +
    "ckReference " +
    "ckScript " +
    "ckReport " +
    "ckDialog ";

  // enum TControlType
  var TControlType =
    "ctISBLEditor " +
    "ctBevel " +
    "ctButton " +
    "ctCheckListBox " +
    "ctComboBox " +
    "ctComboEdit " +
    "ctGrid " +
    "ctDBCheckBox " +
    "ctDBComboBox " +
    "ctDBEdit " +
    "ctDBEllipsis " +
    "ctDBMemo " +
    "ctDBNavigator " +
    "ctDBRadioGroup " +
    "ctDBStatusLabel " +
    "ctEdit " +
    "ctGroupBox " +
    "ctInplaceHint " +
    "ctMemo " +
    "ctPanel " +
    "ctListBox " +
    "ctRadioButton " +
    "ctRichEdit " +
    "ctTabSheet " +
    "ctWebBrowser " +
    "ctImage " +
    "ctHyperLink " +
    "ctLabel " +
    "ctDBMultiEllipsis " +
    "ctRibbon " +
    "ctRichView " +
    "ctInnerPanel " +
    "ctPanelGroup " +
    "ctBitButton ";

  // enum TCriterionContentType
  var TCriterionContentType =
    "cctDate " +
    "cctInteger " +
    "cctNumeric " +
    "cctPick " +
    "cctReference " +
    "cctString " +
    "cctText ";

  // enum TCultureType
  var TCultureType = "cltInternal cltPrimary cltGUI ";

  // enum TDataSetEventType
  var TDataSetEventType =
    "dseBeforeOpen " +
    "dseAfterOpen " +
    "dseBeforeClose " +
    "dseAfterClose " +
    "dseOnValidDelete " +
    "dseBeforeDelete " +
    "dseAfterDelete " +
    "dseAfterDeleteOutOfTransaction " +
    "dseOnDeleteError " +
    "dseBeforeInsert " +
    "dseAfterInsert " +
    "dseOnValidUpdate " +
    "dseBeforeUpdate " +
    "dseOnUpdateRatifiedRecord " +
    "dseAfterUpdate " +
    "dseAfterUpdateOutOfTransaction " +
    "dseOnUpdateError " +
    "dseAfterScroll " +
    "dseOnOpenRecord " +
    "dseOnCloseRecord " +
    "dseBeforeCancel " +
    "dseAfterCancel " +
    "dseOnUpdateDeadlockError " +
    "dseBeforeDetailUpdate " +
    "dseOnPrepareUpdate " +
    "dseOnAnyRequisiteChange ";

  // enum TDataSetState
  var TDataSetState = "dssEdit dssInsert dssBrowse dssInActive ";

  // enum TDateFormatType
  var TDateFormatType = "dftDate dftShortDate dftDateTime dftTimeStamp ";

  // enum TDateOffsetType
  var TDateOffsetType = "dotDays dotHours dotMinutes dotSeconds ";

  // enum TDateTimeKind
  var TDateTimeKind = "dtkndLocal dtkndUTC ";

  // enum TDeaAccessRights
  var TDeaAccessRights = "arNone arView arEdit arFull ";

  // enum TDocumentDefaultAction
  var TDocumentDefaultAction = "ddaView ddaEdit ";

  // enum TEditMode
  var TEditMode =
    "emLock " +
    "emEdit " +
    "emSign " +
    "emExportWithLock " +
    "emImportWithUnlock " +
    "emChangeVersionNote " +
    "emOpenForModify " +
    "emChangeLifeStage " +
    "emDelete " +
    "emCreateVersion " +
    "emImport " +
    "emUnlockExportedWithLock " +
    "emStart " +
    "emAbort " +
    "emReInit " +
    "emMarkAsReaded " +
    "emMarkAsUnreaded " +
    "emPerform " +
    "emAccept " +
    "emResume " +
    "emChangeRights " +
    "emEditRoute " +
    "emEditObserver " +
    "emRecoveryFromLocalCopy " +
    "emChangeWorkAccessType " +
    "emChangeEncodeTypeToCertificate " +
    "emChangeEncodeTypeToPassword " +
    "emChangeEncodeTypeToNone " +
    "emChangeEncodeTypeToCertificatePassword " +
    "emChangeStandardRoute " +
    "emGetText " +
    "emOpenForView " +
    "emMoveToStorage " +
    "emCreateObject " +
    "emChangeVersionHidden " +
    "emDeleteVersion " +
    "emChangeLifeCycleStage " +
    "emApprovingSign " +
    "emExport " +
    "emContinue " +
    "emLockFromEdit " +
    "emUnLockForEdit " +
    "emLockForServer " +
    "emUnlockFromServer " +
    "emDelegateAccessRights " +
    "emReEncode ";

  // enum TEditorCloseObservType
  var TEditorCloseObservType = "ecotFile ecotProcess ";

  // enum TEdmsApplicationAction
  var TEdmsApplicationAction = "eaGet eaCopy eaCreate eaCreateStandardRoute ";

  // enum TEDocumentLockType
  var TEDocumentLockType = "edltAll edltNothing edltQuery ";

  // enum TEDocumentStepShowMode
  var TEDocumentStepShowMode = "essmText essmCard ";

  // enum TEDocumentStepVersionType
  var TEDocumentStepVersionType = "esvtLast esvtLastActive esvtSpecified ";

  // enum TEDocumentStorageFunction
  var TEDocumentStorageFunction = "edsfExecutive edsfArchive ";

  // enum TEDocumentStorageType
  var TEDocumentStorageType = "edstSQLServer edstFile ";

  // enum TEDocumentVersionSourceType
  var TEDocumentVersionSourceType =
    "edvstNone edvstEDocumentVersionCopy edvstFile edvstTemplate edvstScannedFile ";

  // enum TEDocumentVersionState
  var TEDocumentVersionState = "vsDefault vsDesign vsActive vsObsolete ";

  // enum TEncodeType
  var TEncodeType = "etNone etCertificate etPassword etCertificatePassword ";

  // enum TExceptionCategory
  var TExceptionCategory = "ecException ecWarning ecInformation ";

  // enum TExportedSignaturesType
  var TExportedSignaturesType = "estAll estApprovingOnly ";

  // enum TExportedVersionType
  var TExportedVersionType = "evtLast evtLastActive evtQuery ";

  // enum TFieldDataType
  var TFieldDataType =
    "fdtString " +
    "fdtNumeric " +
    "fdtInteger " +
    "fdtDate " +
    "fdtText " +
    "fdtUnknown " +
    "fdtWideString " +
    "fdtLargeInteger ";

  // enum TFolderType
  var TFolderType =
    "ftInbox " +
    "ftOutbox " +
    "ftFavorites " +
    "ftCommonFolder " +
    "ftUserFolder " +
    "ftComponents " +
    "ftQuickLaunch " +
    "ftShortcuts " +
    "ftSearch ";

  // enum TGridRowHeight
  var TGridRowHeight = "grhAuto " + "grhX1 " + "grhX2 " + "grhX3 ";

  // enum THyperlinkType
  var THyperlinkType = "hltText " + "hltRTF " + "hltHTML ";

  // enum TImageFileFormat
  var TImageFileFormat =
    "iffBMP " +
    "iffJPEG " +
    "iffMultiPageTIFF " +
    "iffSinglePageTIFF " +
    "iffTIFF " +
    "iffPNG ";

  // enum TImageMode
  var TImageMode = "im8bGrayscale " + "im24bRGB " + "im1bMonochrome ";

  // enum TImageType
  var TImageType = "itBMP " + "itJPEG " + "itWMF " + "itPNG ";

  // enum TInplaceHintKind
  var TInplaceHintKind =
    "ikhInformation " + "ikhWarning " + "ikhError " + "ikhNoIcon ";

  // enum TISBLContext
  var TISBLContext =
    "icUnknown " +
    "icScript " +
    "icFunction " +
    "icIntegratedReport " +
    "icAnalyticReport " +
    "icDataSetEventHandler " +
    "icActionHandler " +
    "icFormEventHandler " +
    "icLookUpEventHandler " +
    "icRequisiteChangeEventHandler " +
    "icBeforeSearchEventHandler " +
    "icRoleCalculation " +
    "icSelectRouteEventHandler " +
    "icBlockPropertyCalculation " +
    "icBlockQueryParamsEventHandler " +
    "icChangeSearchResultEventHandler " +
    "icBlockEventHandler " +
    "icSubTaskInitEventHandler " +
    "icEDocDataSetEventHandler " +
    "icEDocLookUpEventHandler " +
    "icEDocActionHandler " +
    "icEDocFormEventHandler " +
    "icEDocRequisiteChangeEventHandler " +
    "icStructuredConversionRule " +
    "icStructuredConversionEventBefore " +
    "icStructuredConversionEventAfter " +
    "icWizardEventHandler " +
    "icWizardFinishEventHandler " +
    "icWizardStepEventHandler " +
    "icWizardStepFinishEventHandler " +
    "icWizardActionEnableEventHandler " +
    "icWizardActionExecuteEventHandler " +
    "icCreateJobsHandler " +
    "icCreateNoticesHandler " +
    "icBeforeLookUpEventHandler " +
    "icAfterLookUpEventHandler " +
    "icTaskAbortEventHandler " +
    "icWorkflowBlockActionHandler " +
    "icDialogDataSetEventHandler " +
    "icDialogActionHandler " +
    "icDialogLookUpEventHandler " +
    "icDialogRequisiteChangeEventHandler " +
    "icDialogFormEventHandler " +
    "icDialogValidCloseEventHandler " +
    "icBlockFormEventHandler " +
    "icTaskFormEventHandler " +
    "icReferenceMethod " +
    "icEDocMethod " +
    "icDialogMethod " +
    "icProcessMessageHandler ";

  // enum TItemShow
  var TItemShow = "isShow " + "isHide " + "isByUserSettings ";

  // enum TJobKind
  var TJobKind = "jkJob " + "jkNotice " + "jkControlJob ";

  // enum TJoinType
  var TJoinType = "jtInner " + "jtLeft " + "jtRight " + "jtFull " + "jtCross ";

  // enum TLabelPos
  var TLabelPos = "lbpAbove " + "lbpBelow " + "lbpLeft " + "lbpRight ";

  // enum TLicensingType
  var TLicensingType = "eltPerConnection " + "eltPerUser ";

  // enum TLifeCycleStageFontColor
  var TLifeCycleStageFontColor =
    "sfcUndefined " +
    "sfcBlack " +
    "sfcGreen " +
    "sfcRed " +
    "sfcBlue " +
    "sfcOrange " +
    "sfcLilac ";

  // enum TLifeCycleStageFontStyle
  var TLifeCycleStageFontStyle = "sfsItalic " + "sfsStrikeout " + "sfsNormal ";

  // enum TLockableDevelopmentComponentType
  var TLockableDevelopmentComponentType =
    "ldctStandardRoute " +
    "ldctWizard " +
    "ldctScript " +
    "ldctFunction " +
    "ldctRouteBlock " +
    "ldctIntegratedReport " +
    "ldctAnalyticReport " +
    "ldctReferenceType " +
    "ldctEDocumentType " +
    "ldctDialog " +
    "ldctServerEvents ";

  // enum TMaxRecordCountRestrictionType
  var TMaxRecordCountRestrictionType =
    "mrcrtNone " + "mrcrtUser " + "mrcrtMaximal " + "mrcrtCustom ";

  // enum TRangeValueType
  var TRangeValueType =
    "vtEqual " + "vtGreaterOrEqual " + "vtLessOrEqual " + "vtRange ";

  // enum TRelativeDate
  var TRelativeDate =
    "rdYesterday " +
    "rdToday " +
    "rdTomorrow " +
    "rdThisWeek " +
    "rdThisMonth " +
    "rdThisYear " +
    "rdNextMonth " +
    "rdNextWeek " +
    "rdLastWeek " +
    "rdLastMonth ";

  // enum TReportDestination
  var TReportDestination = "rdWindow " + "rdFile " + "rdPrinter ";

  // enum TReqDataType
  var TReqDataType =
    "rdtString " +
    "rdtNumeric " +
    "rdtInteger " +
    "rdtDate " +
    "rdtReference " +
    "rdtAccount " +
    "rdtText " +
    "rdtPick " +
    "rdtUnknown " +
    "rdtLargeInteger " +
    "rdtDocument ";

  // enum TRequisiteEventType
  var TRequisiteEventType = "reOnChange " + "reOnChangeValues ";

  // enum TSBTimeType
  var TSBTimeType = "ttGlobal " + "ttLocal " + "ttUser " + "ttSystem ";

  // enum TSearchShowMode
  var TSearchShowMode =
    "ssmBrowse " + "ssmSelect " + "ssmMultiSelect " + "ssmBrowseModal ";

  // enum TSelectMode
  var TSelectMode = "smSelect " + "smLike " + "smCard ";

  // enum TSignatureType
  var TSignatureType = "stNone " + "stAuthenticating " + "stApproving ";

  // enum TSignerContentType
  var TSignerContentType = "sctString " + "sctStream ";

  // enum TStringsSortType
  var TStringsSortType = "sstAnsiSort " + "sstNaturalSort ";

  // enum TStringValueType
  var TStringValueType = "svtEqual " + "svtContain ";

  // enum TStructuredObjectAttributeType
  var TStructuredObjectAttributeType =
    "soatString " +
    "soatNumeric " +
    "soatInteger " +
    "soatDatetime " +
    "soatReferenceRecord " +
    "soatText " +
    "soatPick " +
    "soatBoolean " +
    "soatEDocument " +
    "soatAccount " +
    "soatIntegerCollection " +
    "soatNumericCollection " +
    "soatStringCollection " +
    "soatPickCollection " +
    "soatDatetimeCollection " +
    "soatBooleanCollection " +
    "soatReferenceRecordCollection " +
    "soatEDocumentCollection " +
    "soatAccountCollection " +
    "soatContents " +
    "soatUnknown ";

  // enum TTaskAbortReason
  var TTaskAbortReason = "tarAbortByUser " + "tarAbortByWorkflowException ";

  // enum TTextValueType
  var TTextValueType = "tvtAllWords " + "tvtExactPhrase " + "tvtAnyWord ";

  // enum TUserObjectStatus
  var TUserObjectStatus =
    "usNone " +
    "usCompleted " +
    "usRedSquare " +
    "usBlueSquare " +
    "usYellowSquare " +
    "usGreenSquare " +
    "usOrangeSquare " +
    "usPurpleSquare " +
    "usFollowUp ";

  // enum TUserType
  var TUserType =
    "utUnknown " +
    "utUser " +
    "utDeveloper " +
    "utAdministrator " +
    "utSystemDeveloper " +
    "utDisconnected ";

  // enum TValuesBuildType
  var TValuesBuildType =
    "btAnd " + "btDetailAnd " + "btOr " + "btNotOr " + "btOnly ";

  // enum TViewMode
  var TViewMode = "vmView " + "vmSelect " + "vmNavigation ";

  // enum TViewSelectionMode
  var TViewSelectionMode =
    "vsmSingle " + "vsmMultiple " + "vsmMultipleCheck " + "vsmNoSelection ";

  // enum TWizardActionType
  var TWizardActionType =
    "wfatPrevious " + "wfatNext " + "wfatCancel " + "wfatFinish ";

  // enum TWizardFormElementProperty
  var TWizardFormElementProperty =
    "wfepUndefined " +
    "wfepText3 " +
    "wfepText6 " +
    "wfepText9 " +
    "wfepSpinEdit " +
    "wfepDropDown " +
    "wfepRadioGroup " +
    "wfepFlag " +
    "wfepText12 " +
    "wfepText15 " +
    "wfepText18 " +
    "wfepText21 " +
    "wfepText24 " +
    "wfepText27 " +
    "wfepText30 " +
    "wfepRadioGroupColumn1 " +
    "wfepRadioGroupColumn2 " +
    "wfepRadioGroupColumn3 ";

  // enum TWizardFormElementType
  var TWizardFormElementType =
    "wfetQueryParameter " + "wfetText " + "wfetDelimiter " + "wfetLabel ";

  // enum TWizardParamType
  var TWizardParamType =
    "wptString " +
    "wptInteger " +
    "wptNumeric " +
    "wptBoolean " +
    "wptDateTime " +
    "wptPick " +
    "wptText " +
    "wptUser " +
    "wptUserList " +
    "wptEDocumentInfo " +
    "wptEDocumentInfoList " +
    "wptReferenceRecordInfo " +
    "wptReferenceRecordInfoList " +
    "wptFolderInfo " +
    "wptTaskInfo " +
    "wptContents " +
    "wptFileName " +
    "wptDate ";

  // enum TWizardStepResult
  var TWizardStepResult =
    "wsrComplete " +
    "wsrGoNext " +
    "wsrGoPrevious " +
    "wsrCustom " +
    "wsrCancel " +
    "wsrGoFinal ";

  // enum TWizardStepType
  var TWizardStepType =
    "wstForm " +
    "wstEDocument " +
    "wstTaskCard " +
    "wstReferenceRecordCard " +
    "wstFinal ";

  // enum TWorkAccessType
  var TWorkAccessType = "waAll " + "waPerformers " + "waManual ";

  // enum TWorkflowBlockType
  var TWorkflowBlockType =
    "wsbStart " +
    "wsbFinish " +
    "wsbNotice " +
    "wsbStep " +
    "wsbDecision " +
    "wsbWait " +
    "wsbMonitor " +
    "wsbScript " +
    "wsbConnector " +
    "wsbSubTask " +
    "wsbLifeCycleStage " +
    "wsbPause ";

  // enum TWorkflowDataType
  var TWorkflowDataType =
    "wdtInteger " +
    "wdtFloat " +
    "wdtString " +
    "wdtPick " +
    "wdtDateTime " +
    "wdtBoolean " +
    "wdtTask " +
    "wdtJob " +
    "wdtFolder " +
    "wdtEDocument " +
    "wdtReferenceRecord " +
    "wdtUser " +
    "wdtGroup " +
    "wdtRole " +
    "wdtIntegerCollection " +
    "wdtFloatCollection " +
    "wdtStringCollection " +
    "wdtPickCollection " +
    "wdtDateTimeCollection " +
    "wdtBooleanCollection " +
    "wdtTaskCollection " +
    "wdtJobCollection " +
    "wdtFolderCollection " +
    "wdtEDocumentCollection " +
    "wdtReferenceRecordCollection " +
    "wdtUserCollection " +
    "wdtGroupCollection " +
    "wdtRoleCollection " +
    "wdtContents " +
    "wdtUserList " +
    "wdtSearchDescription " +
    "wdtDeadLine " +
    "wdtPickSet " +
    "wdtAccountCollection ";

  // enum TWorkImportance
  var TWorkImportance = "wiLow " + "wiNormal " + "wiHigh ";

  // enum TWorkRouteType
  var TWorkRouteType = "wrtSoft " + "wrtHard ";

  // enum TWorkState
  var TWorkState =
    "wsInit " +
    "wsRunning " +
    "wsDone " +
    "wsControlled " +
    "wsAborted " +
    "wsContinued ";

  // enum TWorkTextBuildingMode
  var TWorkTextBuildingMode =
    "wtmFull " + "wtmFromCurrent " + "wtmOnlyCurrent ";

  // Перечисления
  var ENUMS =
    TAccountType +
    TActionEnabledMode +
    TAddPosition +
    TAlignment +
    TAreaShowMode +
    TCertificateInvalidationReason +
    TCertificateType +
    TCheckListBoxItemState +
    TCloseOnEsc +
    TCompType +
    TConditionFormat +
    TConnectionIntent +
    TContentKind +
    TControlType +
    TCriterionContentType +
    TCultureType +
    TDataSetEventType +
    TDataSetState +
    TDateFormatType +
    TDateOffsetType +
    TDateTimeKind +
    TDeaAccessRights +
    TDocumentDefaultAction +
    TEditMode +
    TEditorCloseObservType +
    TEdmsApplicationAction +
    TEDocumentLockType +
    TEDocumentStepShowMode +
    TEDocumentStepVersionType +
    TEDocumentStorageFunction +
    TEDocumentStorageType +
    TEDocumentVersionSourceType +
    TEDocumentVersionState +
    TEncodeType +
    TExceptionCategory +
    TExportedSignaturesType +
    TExportedVersionType +
    TFieldDataType +
    TFolderType +
    TGridRowHeight +
    THyperlinkType +
    TImageFileFormat +
    TImageMode +
    TImageType +
    TInplaceHintKind +
    TISBLContext +
    TItemShow +
    TJobKind +
    TJoinType +
    TLabelPos +
    TLicensingType +
    TLifeCycleStageFontColor +
    TLifeCycleStageFontStyle +
    TLockableDevelopmentComponentType +
    TMaxRecordCountRestrictionType +
    TRangeValueType +
    TRelativeDate +
    TReportDestination +
    TReqDataType +
    TRequisiteEventType +
    TSBTimeType +
    TSearchShowMode +
    TSelectMode +
    TSignatureType +
    TSignerContentType +
    TStringsSortType +
    TStringValueType +
    TStructuredObjectAttributeType +
    TTaskAbortReason +
    TTextValueType +
    TUserObjectStatus +
    TUserType +
    TValuesBuildType +
    TViewMode +
    TViewSelectionMode +
    TWizardActionType +
    TWizardFormElementProperty +
    TWizardFormElementType +
    TWizardParamType +
    TWizardStepResult +
    TWizardStepType +
    TWorkAccessType +
    TWorkflowBlockType +
    TWorkflowDataType +
    TWorkImportance +
    TWorkRouteType +
    TWorkState +
    TWorkTextBuildingMode;

  // Системные функции ==> SYSFUNCTIONS
  var system_functions =
    "AddSubString " +
    "AdjustLineBreaks " +
    "AmountInWords " +
    "Analysis " +
    "ArrayDimCount " +
    "ArrayHighBound " +
    "ArrayLowBound " +
    "ArrayOf " +
    "ArrayReDim " +
    "Assert " +
    "Assigned " +
    "BeginOfMonth " +
    "BeginOfPeriod " +
    "BuildProfilingOperationAnalysis " +
    "CallProcedure " +
    "CanReadFile " +
    "CArrayElement " +
    "CDataSetRequisite " +
    "ChangeDate " +
    "ChangeReferenceDataset " +
    "Char " +
    "CharPos " +
    "CheckParam " +
    "CheckParamValue " +
    "CompareStrings " +
    "ConstantExists " +
    "ControlState " +
    "ConvertDateStr " +
    "Copy " +
    "CopyFile " +
    "CreateArray " +
    "CreateCachedReference " +
    "CreateConnection " +
    "CreateDialog " +
    "CreateDualListDialog " +
    "CreateEditor " +
    "CreateException " +
    "CreateFile " +
    "CreateFolderDialog " +
    "CreateInputDialog " +
    "CreateLinkFile " +
    "CreateList " +
    "CreateLock " +
    "CreateMemoryDataSet " +
    "CreateObject " +
    "CreateOpenDialog " +
    "CreateProgress " +
    "CreateQuery " +
    "CreateReference " +
    "CreateReport " +
    "CreateSaveDialog " +
    "CreateScript " +
    "CreateSQLPivotFunction " +
    "CreateStringList " +
    "CreateTreeListSelectDialog " +
    "CSelectSQL " +
    "CSQL " +
    "CSubString " +
    "CurrentUserID " +
    "CurrentUserName " +
    "CurrentVersion " +
    "DataSetLocateEx " +
    "DateDiff " +
    "DateTimeDiff " +
    "DateToStr " +
    "DayOfWeek " +
    "DeleteFile " +
    "DirectoryExists " +
    "DisableCheckAccessRights " +
    "DisableCheckFullShowingRestriction " +
    "DisableMassTaskSendingRestrictions " +
    "DropTable " +
    "DupeString " +
    "EditText " +
    "EnableCheckAccessRights " +
    "EnableCheckFullShowingRestriction " +
    "EnableMassTaskSendingRestrictions " +
    "EndOfMonth " +
    "EndOfPeriod " +
    "ExceptionExists " +
    "ExceptionsOff " +
    "ExceptionsOn " +
    "Execute " +
    "ExecuteProcess " +
    "Exit " +
    "ExpandEnvironmentVariables " +
    "ExtractFileDrive " +
    "ExtractFileExt " +
    "ExtractFileName " +
    "ExtractFilePath " +
    "ExtractParams " +
    "FileExists " +
    "FileSize " +
    "FindFile " +
    "FindSubString " +
    "FirmContext " +
    "ForceDirectories " +
    "Format " +
    "FormatDate " +
    "FormatNumeric " +
    "FormatSQLDate " +
    "FormatString " +
    "FreeException " +
    "GetComponent " +
    "GetComponentLaunchParam " +
    "GetConstant " +
    "GetLastException " +
    "GetReferenceRecord " +
    "GetRefTypeByRefID " +
    "GetTableID " +
    "GetTempFolder " +
    "IfThen " +
    "In " +
    "IndexOf " +
    "InputDialog " +
    "InputDialogEx " +
    "InteractiveMode " +
    "IsFileLocked " +
    "IsGraphicFile " +
    "IsNumeric " +
    "Length " +
    "LoadString " +
    "LoadStringFmt " +
    "LocalTimeToUTC " +
    "LowerCase " +
    "Max " +
    "MessageBox " +
    "MessageBoxEx " +
    "MimeDecodeBinary " +
    "MimeDecodeString " +
    "MimeEncodeBinary " +
    "MimeEncodeString " +
    "Min " +
    "MoneyInWords " +
    "MoveFile " +
    "NewID " +
    "Now " +
    "OpenFile " +
    "Ord " +
    "Precision " +
    "Raise " +
    "ReadCertificateFromFile " +
    "ReadFile " +
    "ReferenceCodeByID " +
    "ReferenceNumber " +
    "ReferenceRequisiteMode " +
    "ReferenceRequisiteValue " +
    "RegionDateSettings " +
    "RegionNumberSettings " +
    "RegionTimeSettings " +
    "RegRead " +
    "RegWrite " +
    "RenameFile " +
    "Replace " +
    "Round " +
    "SelectServerCode " +
    "SelectSQL " +
    "ServerDateTime " +
    "SetConstant " +
    "SetManagedFolderFieldsState " +
    "ShowConstantsInputDialog " +
    "ShowMessage " +
    "Sleep " +
    "Split " +
    "SQL " +
    "SQL2XLSTAB " +
    "SQLProfilingSendReport " +
    "StrToDate " +
    "SubString " +
    "SubStringCount " +
    "SystemSetting " +
    "Time " +
    "TimeDiff " +
    "Today " +
    "Transliterate " +
    "Trim " +
    "UpperCase " +
    "UserStatus " +
    "UTCToLocalTime " +
    "ValidateXML " +
    "VarIsClear " +
    "VarIsEmpty " +
    "VarIsNull " +
    "WorkTimeDiff " +
    "WriteFile " +
    "WriteFileEx " +
    "WriteObjectHistory " +
    "Анализ " +
    "БазаДанных " +
    "БлокЕсть " +
    "БлокЕстьРасш " +
    "БлокИнфо " +
    "БлокСнять " +
    "БлокСнятьРасш " +
    "БлокУстановить " +
    "Ввод " +
    "ВводМеню " +
    "ВедС " +
    "ВедСпр " +
    "ВерхняяГраницаМассива " +
    "ВнешПрогр " +
    "Восст " +
    "ВременнаяПапка " +
    "Время " +
    "ВыборSQL " +
    "ВыбратьЗапись " +
    "ВыделитьСтр " +
    "Вызвать " +
    "Выполнить " +
    "ВыпПрогр " +
    "ГрафическийФайл " +
    "ГруппаДополнительно " +
    "ДатаВремяСерв " +
    "ДеньНедели " +
    "ДиалогДаНет " +
    "ДлинаСтр " +
    "ДобПодстр " +
    "ЕПусто " +
    "ЕслиТо " +
    "ЕЧисло " +
    "ЗамПодстр " +
    "ЗаписьСправочника " +
    "ЗначПоляСпр " +
    "ИДТипСпр " +
    "ИзвлечьДиск " +
    "ИзвлечьИмяФайла " +
    "ИзвлечьПуть " +
    "ИзвлечьРасширение " +
    "ИзмДат " +
    "ИзменитьРазмерМассива " +
    "ИзмеренийМассива " +
    "ИмяОрг " +
    "ИмяПоляСпр " +
    "Индекс " +
    "ИндикаторЗакрыть " +
    "ИндикаторОткрыть " +
    "ИндикаторШаг " +
    "ИнтерактивныйРежим " +
    "ИтогТблСпр " +
    "КодВидВедСпр " +
    "КодВидСпрПоИД " +
    "КодПоAnalit " +
    "КодСимвола " +
    "КодСпр " +
    "КолПодстр " +
    "КолПроп " +
    "КонМес " +
    "Конст " +
    "КонстЕсть " +
    "КонстЗнач " +
    "КонТран " +
    "КопироватьФайл " +
    "КопияСтр " +
    "КПериод " +
    "КСтрТблСпр " +
    "Макс " +
    "МаксСтрТблСпр " +
    "Массив " +
    "Меню " +
    "МенюРасш " +
    "Мин " +
    "НаборДанныхНайтиРасш " +
    "НаимВидСпр " +
    "НаимПоAnalit " +
    "НаимСпр " +
    "НастроитьПереводыСтрок " +
    "НачМес " +
    "НачТран " +
    "НижняяГраницаМассива " +
    "НомерСпр " +
    "НПериод " +
    "Окно " +
    "Окр " +
    "Окружение " +
    "ОтлИнфДобавить " +
    "ОтлИнфУдалить " +
    "Отчет " +
    "ОтчетАнал " +
    "ОтчетИнт " +
    "ПапкаСуществует " +
    "Пауза " +
    "ПВыборSQL " +
    "ПереименоватьФайл " +
    "Переменные " +
    "ПереместитьФайл " +
    "Подстр " +
    "ПоискПодстр " +
    "ПоискСтр " +
    "ПолучитьИДТаблицы " +
    "ПользовательДополнительно " +
    "ПользовательИД " +
    "ПользовательИмя " +
    "ПользовательСтатус " +
    "Прервать " +
    "ПроверитьПараметр " +
    "ПроверитьПараметрЗнач " +
    "ПроверитьУсловие " +
    "РазбСтр " +
    "РазнВремя " +
    "РазнДат " +
    "РазнДатаВремя " +
    "РазнРабВремя " +
    "РегУстВрем " +
    "РегУстДат " +
    "РегУстЧсл " +
    "РедТекст " +
    "РеестрЗапись " +
    "РеестрСписокИменПарам " +
    "РеестрЧтение " +
    "РеквСпр " +
    "РеквСпрПр " +
    "Сегодня " +
    "Сейчас " +
    "Сервер " +
    "СерверПроцессИД " +
    "СертификатФайлСчитать " +
    "СжПроб " +
    "Символ " +
    "СистемаДиректумКод " +
    "СистемаИнформация " +
    "СистемаКод " +
    "Содержит " +
    "СоединениеЗакрыть " +
    "СоединениеОткрыть " +
    "СоздатьДиалог " +
    "СоздатьДиалогВыбораИзДвухСписков " +
    "СоздатьДиалогВыбораПапки " +
    "СоздатьДиалогОткрытияФайла " +
    "СоздатьДиалогСохраненияФайла " +
    "СоздатьЗапрос " +
    "СоздатьИндикатор " +
    "СоздатьИсключение " +
    "СоздатьКэшированныйСправочник " +
    "СоздатьМассив " +
    "СоздатьНаборДанных " +
    "СоздатьОбъект " +
    "СоздатьОтчет " +
    "СоздатьПапку " +
    "СоздатьРедактор " +
    "СоздатьСоединение " +
    "СоздатьСписок " +
    "СоздатьСписокСтрок " +
    "СоздатьСправочник " +
    "СоздатьСценарий " +
    "СоздСпр " +
    "СостСпр " +
    "Сохр " +
    "СохрСпр " +
    "СписокСистем " +
    "Спр " +
    "Справочник " +
    "СпрБлокЕсть " +
    "СпрБлокСнять " +
    "СпрБлокСнятьРасш " +
    "СпрБлокУстановить " +
    "СпрИзмНабДан " +
    "СпрКод " +
    "СпрНомер " +
    "СпрОбновить " +
    "СпрОткрыть " +
    "СпрОтменить " +
    "СпрПарам " +
    "СпрПолеЗнач " +
    "СпрПолеИмя " +
    "СпрРекв " +
    "СпрРеквВведЗн " +
    "СпрРеквНовые " +
    "СпрРеквПр " +
    "СпрРеквПредЗн " +
    "СпрРеквРежим " +
    "СпрРеквТипТекст " +
    "СпрСоздать " +
    "СпрСост " +
    "СпрСохранить " +
    "СпрТблИтог " +
    "СпрТблСтр " +
    "СпрТблСтрКол " +
    "СпрТблСтрМакс " +
    "СпрТблСтрМин " +
    "СпрТблСтрПред " +
    "СпрТблСтрСлед " +
    "СпрТблСтрСозд " +
    "СпрТблСтрУд " +
    "СпрТекПредст " +
    "СпрУдалить " +
    "СравнитьСтр " +
    "СтрВерхРегистр " +
    "СтрНижнРегистр " +
    "СтрТблСпр " +
    "СумПроп " +
    "Сценарий " +
    "СценарийПарам " +
    "ТекВерсия " +
    "ТекОрг " +
    "Точн " +
    "Тран " +
    "Транслитерация " +
    "УдалитьТаблицу " +
    "УдалитьФайл " +
    "УдСпр " +
    "УдСтрТблСпр " +
    "Уст " +
    "УстановкиКонстант " +
    "ФайлАтрибутСчитать " +
    "ФайлАтрибутУстановить " +
    "ФайлВремя " +
    "ФайлВремяУстановить " +
    "ФайлВыбрать " +
    "ФайлЗанят " +
    "ФайлЗаписать " +
    "ФайлИскать " +
    "ФайлКопировать " +
    "ФайлМожноЧитать " +
    "ФайлОткрыть " +
    "ФайлПереименовать " +
    "ФайлПерекодировать " +
    "ФайлПереместить " +
    "ФайлПросмотреть " +
    "ФайлРазмер " +
    "ФайлСоздать " +
    "ФайлСсылкаСоздать " +
    "ФайлСуществует " +
    "ФайлСчитать " +
    "ФайлУдалить " +
    "ФмтSQLДат " +
    "ФмтДат " +
    "ФмтСтр " +
    "ФмтЧсл " +
    "Формат " +
    "ЦМассивЭлемент " +
    "ЦНаборДанныхРеквизит " +
    "ЦПодстр ";

  // Предопределенные переменные ==> built_in
  var predefined_variables =
    "AltState " +
    "Application " +
    "CallType " +
    "ComponentTokens " +
    "CreatedJobs " +
    "CreatedNotices " +
    "ControlState " +
    "DialogResult " +
    "Dialogs " +
    "EDocuments " +
    "EDocumentVersionSource " +
    "Folders " +
    "GlobalIDs " +
    "Job " +
    "Jobs " +
    "InputValue " +
    "LookUpReference " +
    "LookUpRequisiteNames " +
    "LookUpSearch " +
    "Object " +
    "ParentComponent " +
    "Processes " +
    "References " +
    "Requisite " +
    "ReportName " +
    "Reports " +
    "Result " +
    "Scripts " +
    "Searches " +
    "SelectedAttachments " +
    "SelectedItems " +
    "SelectMode " +
    "Sender " +
    "ServerEvents " +
    "ServiceFactory " +
    "ShiftState " +
    "SubTask " +
    "SystemDialogs " +
    "Tasks " +
    "Wizard " +
    "Wizards " +
    "Work " +
    "ВызовСпособ " +
    "ИмяОтчета " +
    "РеквЗнач ";

  // Интерфейсы ==> type
  var interfaces =
    "IApplication " +
    "IAccessRights " +
    "IAccountRepository " +
    "IAccountSelectionRestrictions " +
    "IAction " +
    "IActionList " +
    "IAdministrationHistoryDescription " +
    "IAnchors " +
    "IApplication " +
    "IArchiveInfo " +
    "IAttachment " +
    "IAttachmentList " +
    "ICheckListBox " +
    "ICheckPointedList " +
    "IColumn " +
    "IComponent " +
    "IComponentDescription " +
    "IComponentToken " +
    "IComponentTokenFactory " +
    "IComponentTokenInfo " +
    "ICompRecordInfo " +
    "IConnection " +
    "IContents " +
    "IControl " +
    "IControlJob " +
    "IControlJobInfo " +
    "IControlList " +
    "ICrypto " +
    "ICrypto2 " +
    "ICustomJob " +
    "ICustomJobInfo " +
    "ICustomListBox " +
    "ICustomObjectWizardStep " +
    "ICustomWork " +
    "ICustomWorkInfo " +
    "IDataSet " +
    "IDataSetAccessInfo " +
    "IDataSigner " +
    "IDateCriterion " +
    "IDateRequisite " +
    "IDateRequisiteDescription " +
    "IDateValue " +
    "IDeaAccessRights " +
    "IDeaObjectInfo " +
    "IDevelopmentComponentLock " +
    "IDialog " +
    "IDialogFactory " +
    "IDialogPickRequisiteItems " +
    "IDialogsFactory " +
    "IDICSFactory " +
    "IDocRequisite " +
    "IDocumentInfo " +
    "IDualListDialog " +
    "IECertificate " +
    "IECertificateInfo " +
    "IECertificates " +
    "IEditControl " +
    "IEditorForm " +
    "IEdmsExplorer " +
    "IEdmsObject " +
    "IEdmsObjectDescription " +
    "IEdmsObjectFactory " +
    "IEdmsObjectInfo " +
    "IEDocument " +
    "IEDocumentAccessRights " +
    "IEDocumentDescription " +
    "IEDocumentEditor " +
    "IEDocumentFactory " +
    "IEDocumentInfo " +
    "IEDocumentStorage " +
    "IEDocumentVersion " +
    "IEDocumentVersionListDialog " +
    "IEDocumentVersionSource " +
    "IEDocumentWizardStep " +
    "IEDocVerSignature " +
    "IEDocVersionState " +
    "IEnabledMode " +
    "IEncodeProvider " +
    "IEncrypter " +
    "IEvent " +
    "IEventList " +
    "IException " +
    "IExternalEvents " +
    "IExternalHandler " +
    "IFactory " +
    "IField " +
    "IFileDialog " +
    "IFolder " +
    "IFolderDescription " +
    "IFolderDialog " +
    "IFolderFactory " +
    "IFolderInfo " +
    "IForEach " +
    "IForm " +
    "IFormTitle " +
    "IFormWizardStep " +
    "IGlobalIDFactory " +
    "IGlobalIDInfo " +
    "IGrid " +
    "IHasher " +
    "IHistoryDescription " +
    "IHyperLinkControl " +
    "IImageButton " +
    "IImageControl " +
    "IInnerPanel " +
    "IInplaceHint " +
    "IIntegerCriterion " +
    "IIntegerList " +
    "IIntegerRequisite " +
    "IIntegerValue " +
    "IISBLEditorForm " +
    "IJob " +
    "IJobDescription " +
    "IJobFactory " +
    "IJobForm " +
    "IJobInfo " +
    "ILabelControl " +
    "ILargeIntegerCriterion " +
    "ILargeIntegerRequisite " +
    "ILargeIntegerValue " +
    "ILicenseInfo " +
    "ILifeCycleStage " +
    "IList " +
    "IListBox " +
    "ILocalIDInfo " +
    "ILocalization " +
    "ILock " +
    "IMemoryDataSet " +
    "IMessagingFactory " +
    "IMetadataRepository " +
    "INotice " +
    "INoticeInfo " +
    "INumericCriterion " +
    "INumericRequisite " +
    "INumericValue " +
    "IObject " +
    "IObjectDescription " +
    "IObjectImporter " +
    "IObjectInfo " +
    "IObserver " +
    "IPanelGroup " +
    "IPickCriterion " +
    "IPickProperty " +
    "IPickRequisite " +
    "IPickRequisiteDescription " +
    "IPickRequisiteItem " +
    "IPickRequisiteItems " +
    "IPickValue " +
    "IPrivilege " +
    "IPrivilegeList " +
    "IProcess " +
    "IProcessFactory " +
    "IProcessMessage " +
    "IProgress " +
    "IProperty " +
    "IPropertyChangeEvent " +
    "IQuery " +
    "IReference " +
    "IReferenceCriterion " +
    "IReferenceEnabledMode " +
    "IReferenceFactory " +
    "IReferenceHistoryDescription " +
    "IReferenceInfo " +
    "IReferenceRecordCardWizardStep " +
    "IReferenceRequisiteDescription " +
    "IReferencesFactory " +
    "IReferenceValue " +
    "IRefRequisite " +
    "IReport " +
    "IReportFactory " +
    "IRequisite " +
    "IRequisiteDescription " +
    "IRequisiteDescriptionList " +
    "IRequisiteFactory " +
    "IRichEdit " +
    "IRouteStep " +
    "IRule " +
    "IRuleList " +
    "ISchemeBlock " +
    "IScript " +
    "IScriptFactory " +
    "ISearchCriteria " +
    "ISearchCriterion " +
    "ISearchDescription " +
    "ISearchFactory " +
    "ISearchFolderInfo " +
    "ISearchForObjectDescription " +
    "ISearchResultRestrictions " +
    "ISecuredContext " +
    "ISelectDialog " +
    "IServerEvent " +
    "IServerEventFactory " +
    "IServiceDialog " +
    "IServiceFactory " +
    "ISignature " +
    "ISignProvider " +
    "ISignProvider2 " +
    "ISignProvider3 " +
    "ISimpleCriterion " +
    "IStringCriterion " +
    "IStringList " +
    "IStringRequisite " +
    "IStringRequisiteDescription " +
    "IStringValue " +
    "ISystemDialogsFactory " +
    "ISystemInfo " +
    "ITabSheet " +
    "ITask " +
    "ITaskAbortReasonInfo " +
    "ITaskCardWizardStep " +
    "ITaskDescription " +
    "ITaskFactory " +
    "ITaskInfo " +
    "ITaskRoute " +
    "ITextCriterion " +
    "ITextRequisite " +
    "ITextValue " +
    "ITreeListSelectDialog " +
    "IUser " +
    "IUserList " +
    "IValue " +
    "IView " +
    "IWebBrowserControl " +
    "IWizard " +
    "IWizardAction " +
    "IWizardFactory " +
    "IWizardFormElement " +
    "IWizardParam " +
    "IWizardPickParam " +
    "IWizardReferenceParam " +
    "IWizardStep " +
    "IWorkAccessRights " +
    "IWorkDescription " +
    "IWorkflowAskableParam " +
    "IWorkflowAskableParams " +
    "IWorkflowBlock " +
    "IWorkflowBlockResult " +
    "IWorkflowEnabledMode " +
    "IWorkflowParam " +
    "IWorkflowPickParam " +
    "IWorkflowReferenceParam " +
    "IWorkState " +
    "IWorkTreeCustomNode " +
    "IWorkTreeJobNode " +
    "IWorkTreeTaskNode " +
    "IXMLEditorForm " +
    "SBCrypto ";

  // built_in : встроенные или библиотечные объекты (константы, перечисления)
  var BUILTIN = CONSTANTS + ENUMS;

  // class: встроенные наборы значений, системные объекты, фабрики
  var CLASS = predefined_variables;

  // literal : примитивные типы
  var LITERAL = "null true false nil ";

  // number : числа
  var NUMBERS = {
    className: "number",
    begin: hljs.NUMBER_RE,
    relevance: 0,
  };

  // string : строки
  var STRINGS = {
    className: "string",
    variants: [{ begin: '"', end: '"' }, { begin: "'", end: "'" }],
  };

  // Токены
  var DOCTAGS = {
    className: "doctag",
    begin: "\\b(?:TODO|DONE|BEGIN|END|STUB|CHG|FIXME|NOTE|BUG|XXX)\\b",
    relevance: 0,
  };

  // Однострочный комментарий
  var ISBL_LINE_COMMENT_MODE = {
    className: "comment",
    begin: "//",
    end: "$",
    relevance: 0,
    contains: [hljs.PHRASAL_WORDS_MODE, DOCTAGS],
  };

  // Многострочный комментарий
  var ISBL_BLOCK_COMMENT_MODE = {
    className: "comment",
    begin: "/\\*",
    end: "\\*/",
    relevance: 0,
    contains: [hljs.PHRASAL_WORDS_MODE, DOCTAGS],
  };

  // comment : комментарии
  var COMMENTS = {
    variants: [ISBL_LINE_COMMENT_MODE, ISBL_BLOCK_COMMENT_MODE],
  };

  // keywords : ключевые слова
  var KEYWORDS = {
    keyword: KEYWORD,
    built_in: BUILTIN,
    class: CLASS,
    literal: LITERAL,
  };

  // methods : методы
  var METHODS = {
    begin: "\\.\\s*" + hljs.UNDERSCORE_IDENT_RE,
    keywords: KEYWORDS,
    relevance: 0,
  };

  // type : встроенные типы
  var TYPES = {
    className: "type",
    begin: ":[ \\t]*(" + interfaces.trim().replace(/\s/g, "|") + ")",
    end: "[ \\t]*=",
    excludeEnd: true,
  };

  // variables : переменные
  var VARIABLES = {
    className: "variable",
    lexemes: UNDERSCORE_IDENT_RE,
    keywords: KEYWORDS,
    begin: UNDERSCORE_IDENT_RE,
    relevance: 0,
    containts: [TYPES, METHODS],
  };

  // Имена функций
  var FUNCTION_TITLE = FUNCTION_NAME_IDENT_RE + "\\(";

  var TITLE_MODE = {
    className: "title",
    lexemes: UNDERSCORE_IDENT_RE,
    keywords: {
      built_in: system_functions,
    },
    begin: FUNCTION_TITLE,
    end: "\\(",
    returnBegin: true,
    excludeEnd: true,
  };

  // function : функции
  var FUNCTIONS = {
    className: "function",
    begin: FUNCTION_TITLE,
    end: "\\)$",
    returnBegin: true,
    lexemes: UNDERSCORE_IDENT_RE,
    keywords: KEYWORDS,
    illegal: "[\\[\\]\\|\\$\\?%,~#@]",
    contains: [TITLE_MODE, METHODS, VARIABLES, STRINGS, NUMBERS, COMMENTS],
  };

  return {
    aliases: ["isbl"],
    case_insensitive: true,
    lexemes: UNDERSCORE_IDENT_RE,
    keywords: KEYWORDS,
    illegal: "\\$|\\?|%|,|;$|~|#|@|</",
    contains: [
      FUNCTIONS,
      TYPES,
      METHODS,
      VARIABLES,
      STRINGS,
      NUMBERS,
      COMMENTS,
    ],
  };
};

var java = function(hljs) {
  var JAVA_IDENT_RE = '[\u00C0-\u02B8a-zA-Z_$][\u00C0-\u02B8a-zA-Z_$0-9]*';
  var GENERIC_IDENT_RE = JAVA_IDENT_RE + '(<' + JAVA_IDENT_RE + '(\\s*,\\s*' + JAVA_IDENT_RE + ')*>)?';
  var KEYWORDS =
    'false synchronized int abstract float private char boolean var static null if const ' +
    'for true while long strictfp finally protected import native final void ' +
    'enum else break transient catch instanceof byte super volatile case assert short ' +
    'package default double public try this switch continue throws protected public private ' +
    'module requires exports do';

  // https://docs.oracle.com/javase/7/docs/technotes/guides/language/underscores-literals.html
  var JAVA_NUMBER_RE = '\\b' +
    '(' +
      '0[bB]([01]+[01_]+[01]+|[01]+)' + // 0b...
      '|' +
      '0[xX]([a-fA-F0-9]+[a-fA-F0-9_]+[a-fA-F0-9]+|[a-fA-F0-9]+)' + // 0x...
      '|' +
      '(' +
        '([\\d]+[\\d_]+[\\d]+|[\\d]+)(\\.([\\d]+[\\d_]+[\\d]+|[\\d]+))?' +
        '|' +
        '\\.([\\d]+[\\d_]+[\\d]+|[\\d]+)' +
      ')' +
      '([eE][-+]?\\d+)?' + // octal, decimal, float
    ')' +
    '[lLfF]?';
  var JAVA_NUMBER_MODE = {
    className: 'number',
    begin: JAVA_NUMBER_RE,
    relevance: 0
  };

  return {
    aliases: ['jsp'],
    keywords: KEYWORDS,
    illegal: /<\/|#/,
    contains: [
      hljs.COMMENT(
        '/\\*\\*',
        '\\*/',
        {
          relevance : 0,
          contains : [
            {
              // eat up @'s in emails to prevent them to be recognized as doctags
              begin: /\w+@/, relevance: 0
            },
            {
              className : 'doctag',
              begin : '@[A-Za-z]+'
            }
          ]
        }
      ),
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      {
        className: 'class',
        beginKeywords: 'class interface', end: /[{;=]/, excludeEnd: true,
        keywords: 'class interface',
        illegal: /[:"\[\]]/,
        contains: [
          {beginKeywords: 'extends implements'},
          hljs.UNDERSCORE_TITLE_MODE
        ]
      },
      {
        // Expression keywords prevent 'keyword Name(...)' from being
        // recognized as a function definition
        beginKeywords: 'new throw return else',
        relevance: 0
      },
      {
        className: 'function',
        begin: '(' + GENERIC_IDENT_RE + '\\s+)+' + hljs.UNDERSCORE_IDENT_RE + '\\s*\\(', returnBegin: true, end: /[{;=]/,
        excludeEnd: true,
        keywords: KEYWORDS,
        contains: [
          {
            begin: hljs.UNDERSCORE_IDENT_RE + '\\s*\\(', returnBegin: true,
            relevance: 0,
            contains: [hljs.UNDERSCORE_TITLE_MODE]
          },
          {
            className: 'params',
            begin: /\(/, end: /\)/,
            keywords: KEYWORDS,
            relevance: 0,
            contains: [
              hljs.APOS_STRING_MODE,
              hljs.QUOTE_STRING_MODE,
              hljs.C_NUMBER_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      },
      JAVA_NUMBER_MODE,
      {
        className: 'meta', begin: '@[A-Za-z]+'
      }
    ]
  };
};

var javascript = function(hljs) {
  var IDENT_RE = '[A-Za-z$_][0-9A-Za-z$_]*';
  var KEYWORDS = {
    keyword:
      'in of if for while finally var new function do return void else break catch ' +
      'instanceof with throw case default try this switch continue typeof delete ' +
      'let yield const export super debugger as async await static ' +
      // ECMAScript 6 modules import
      'import from as'
    ,
    literal:
      'true false null undefined NaN Infinity',
    built_in:
      'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent ' +
      'encodeURI encodeURIComponent escape unescape Object Function Boolean Error ' +
      'EvalError InternalError RangeError ReferenceError StopIteration SyntaxError ' +
      'TypeError URIError Number Math Date String RegExp Array Float32Array ' +
      'Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array ' +
      'Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require ' +
      'module console window document Symbol Set Map WeakSet WeakMap Proxy Reflect ' +
      'Promise'
  };
  var NUMBER = {
    className: 'number',
    variants: [
      { begin: '\\b(0[bB][01]+)' },
      { begin: '\\b(0[oO][0-7]+)' },
      { begin: hljs.C_NUMBER_RE }
    ],
    relevance: 0
  };
  var SUBST = {
    className: 'subst',
    begin: '\\$\\{', end: '\\}',
    keywords: KEYWORDS,
    contains: []  // defined later
  };
  var TEMPLATE_STRING = {
    className: 'string',
    begin: '`', end: '`',
    contains: [
      hljs.BACKSLASH_ESCAPE,
      SUBST
    ]
  };
  SUBST.contains = [
    hljs.APOS_STRING_MODE,
    hljs.QUOTE_STRING_MODE,
    TEMPLATE_STRING,
    NUMBER,
    hljs.REGEXP_MODE
  ];
  var PARAMS_CONTAINS = SUBST.contains.concat([
    hljs.C_BLOCK_COMMENT_MODE,
    hljs.C_LINE_COMMENT_MODE
  ]);

  return {
    aliases: ['js', 'jsx'],
    keywords: KEYWORDS,
    contains: [
      {
        className: 'meta',
        relevance: 10,
        begin: /^\s*['"]use (strict|asm)['"]/
      },
      {
        className: 'meta',
        begin: /^#!/, end: /$/
      },
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      TEMPLATE_STRING,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      NUMBER,
      { // object attr container
        begin: /[{,]\s*/, relevance: 0,
        contains: [
          {
            begin: IDENT_RE + '\\s*:', returnBegin: true,
            relevance: 0,
            contains: [{className: 'attr', begin: IDENT_RE, relevance: 0}]
          }
        ]
      },
      { // "value" container
        begin: '(' + hljs.RE_STARTERS_RE + '|\\b(case|return|throw)\\b)\\s*',
        keywords: 'return throw case',
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.REGEXP_MODE,
          {
            className: 'function',
            begin: '(\\(.*?\\)|' + IDENT_RE + ')\\s*=>', returnBegin: true,
            end: '\\s*=>',
            contains: [
              {
                className: 'params',
                variants: [
                  {
                    begin: IDENT_RE
                  },
                  {
                    begin: /\(\s*\)/,
                  },
                  {
                    begin: /\(/, end: /\)/,
                    excludeBegin: true, excludeEnd: true,
                    keywords: KEYWORDS,
                    contains: PARAMS_CONTAINS
                  }
                ]
              }
            ]
          },
          { // E4X / JSX
            begin: /</, end: /(\/\w+|\w+\/)>/,
            subLanguage: 'xml',
            contains: [
              {begin: /<\w+\s*\/>/, skip: true},
              {
                begin: /<\w+/, end: /(\/\w+|\w+\/)>/, skip: true,
                contains: [
                  {begin: /<\w+\s*\/>/, skip: true},
                  'self'
                ]
              }
            ]
          }
        ],
        relevance: 0
      },
      {
        className: 'function',
        beginKeywords: 'function', end: /\{/, excludeEnd: true,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {begin: IDENT_RE}),
          {
            className: 'params',
            begin: /\(/, end: /\)/,
            excludeBegin: true,
            excludeEnd: true,
            contains: PARAMS_CONTAINS
          }
        ],
        illegal: /\[|%/
      },
      {
        begin: /\$[(.]/ // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
      },
      hljs.METHOD_GUARD,
      { // ES6 class
        className: 'class',
        beginKeywords: 'class', end: /[{;=]/, excludeEnd: true,
        illegal: /[:"\[\]]/,
        contains: [
          {beginKeywords: 'extends'},
          hljs.UNDERSCORE_TITLE_MODE
        ]
      },
      {
        beginKeywords: 'constructor get set', end: /\{/, excludeEnd: true
      }
    ],
    illegal: /#(?!!)/
  };
};

var jbossCli = function (hljs) {
  var PARAM = {
    begin: /[\w-]+ *=/, returnBegin: true,
    relevance: 0,
    contains: [{className: 'attr', begin: /[\w-]+/}]
  };
  var PARAMSBLOCK = {
    className: 'params',
    begin: /\(/,
    end: /\)/,
    contains: [PARAM],
    relevance : 0
  };
  var OPERATION = {
    className: 'function',
    begin: /:[\w\-.]+/,
    relevance: 0
  };
  var PATH = {
    className: 'string',
    begin: /\B(([\/.])[\w\-.\/=]+)+/,
  };
  var COMMAND_PARAMS = {
    className: 'params',
    begin: /--[\w\-=\/]+/,
  };
  return {
    aliases: ['wildfly-cli'],
    lexemes: '[a-z\-]+',
    keywords: {
      keyword: 'alias batch cd clear command connect connection-factory connection-info data-source deploy ' +
      'deployment-info deployment-overlay echo echo-dmr help history if jdbc-driver-info jms-queue|20 jms-topic|20 ls ' +
      'patch pwd quit read-attribute read-operation reload rollout-plan run-batch set shutdown try unalias ' +
      'undeploy unset version xa-data-source', // module
      literal: 'true false'
    },
    contains: [
      hljs.HASH_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      COMMAND_PARAMS,
      OPERATION,
      PATH,
      PARAMSBLOCK
    ]
  }
};

var json = function(hljs) {
  var LITERALS = {literal: 'true false null'};
  var TYPES = [
    hljs.QUOTE_STRING_MODE,
    hljs.C_NUMBER_MODE
  ];
  var VALUE_CONTAINER = {
    end: ',', endsWithParent: true, excludeEnd: true,
    contains: TYPES,
    keywords: LITERALS
  };
  var OBJECT = {
    begin: '{', end: '}',
    contains: [
      {
        className: 'attr',
        begin: /"/, end: /"/,
        contains: [hljs.BACKSLASH_ESCAPE],
        illegal: '\\n',
      },
      hljs.inherit(VALUE_CONTAINER, {begin: /:/})
    ],
    illegal: '\\S'
  };
  var ARRAY = {
    begin: '\\[', end: '\\]',
    contains: [hljs.inherit(VALUE_CONTAINER)], // inherit is a workaround for a bug that makes shared modes with endsWithParent compile only the ending of one of the parents
    illegal: '\\S'
  };
  TYPES.splice(TYPES.length, 0, OBJECT, ARRAY);
  return {
    contains: TYPES,
    keywords: LITERALS,
    illegal: '\\S'
  };
};

var julia = function(hljs) {
  // Since there are numerous special names in Julia, it is too much trouble
  // to maintain them by hand. Hence these names (i.e. keywords, literals and
  // built-ins) are automatically generated from Julia v0.6 itself through
  // the following scripts for each.

  var KEYWORDS = {
    // # keyword generator, multi-word keywords handled manually below
    // foreach(println, ["in", "isa", "where"])
    // for kw in Base.REPLCompletions.complete_keyword("")
    //     if !(contains(kw, " ") || kw == "struct")
    //         println(kw)
    //     end
    // end
    keyword:
      'in isa where ' +
      'baremodule begin break catch ccall const continue do else elseif end export false finally for function ' +
      'global if import importall let local macro module quote return true try using while ' +
      // legacy, to be deprecated in the next release
      'type immutable abstract bitstype typealias ',

    // # literal generator
    // println("true")
    // println("false")
    // for name in Base.REPLCompletions.completions("", 0)[1]
    //     try
    //         v = eval(Symbol(name))
    //         if !(v isa Function || v isa Type || v isa TypeVar || v isa Module || v isa Colon)
    //             println(name)
    //         end
    //     end
    // end
    literal:
      'true false ' +
      'ARGS C_NULL DevNull ENDIAN_BOM ENV I Inf Inf16 Inf32 Inf64 InsertionSort JULIA_HOME LOAD_PATH MergeSort ' +
      'NaN NaN16 NaN32 NaN64 PROGRAM_FILE QuickSort RoundDown RoundFromZero RoundNearest RoundNearestTiesAway ' +
      'RoundNearestTiesUp RoundToZero RoundUp STDERR STDIN STDOUT VERSION catalan e|0 eu|0 eulergamma golden im ' +
      'nothing pi γ π φ ',

    // # built_in generator:
    // for name in Base.REPLCompletions.completions("", 0)[1]
    //     try
    //         v = eval(Symbol(name))
    //         if v isa Type || v isa TypeVar
    //             println(name)
    //         end
    //     end
    // end
    built_in:
      'ANY AbstractArray AbstractChannel AbstractFloat AbstractMatrix AbstractRNG AbstractSerializer AbstractSet ' +
      'AbstractSparseArray AbstractSparseMatrix AbstractSparseVector AbstractString AbstractUnitRange AbstractVecOrMat ' +
      'AbstractVector Any ArgumentError Array AssertionError Associative Base64DecodePipe Base64EncodePipe Bidiagonal '+
      'BigFloat BigInt BitArray BitMatrix BitVector Bool BoundsError BufferStream CachingPool CapturedException ' +
      'CartesianIndex CartesianRange Cchar Cdouble Cfloat Channel Char Cint Cintmax_t Clong Clonglong ClusterManager ' +
      'Cmd CodeInfo Colon Complex Complex128 Complex32 Complex64 CompositeException Condition ConjArray ConjMatrix ' +
      'ConjVector Cptrdiff_t Cshort Csize_t Cssize_t Cstring Cuchar Cuint Cuintmax_t Culong Culonglong Cushort Cwchar_t ' +
      'Cwstring DataType Date DateFormat DateTime DenseArray DenseMatrix DenseVecOrMat DenseVector Diagonal Dict ' +
      'DimensionMismatch Dims DirectIndexString Display DivideError DomainError EOFError EachLine Enum Enumerate ' +
      'ErrorException Exception ExponentialBackOff Expr Factorization FileMonitor Float16 Float32 Float64 Function ' +
      'Future GlobalRef GotoNode HTML Hermitian IO IOBuffer IOContext IOStream IPAddr IPv4 IPv6 IndexCartesian IndexLinear ' +
      'IndexStyle InexactError InitError Int Int128 Int16 Int32 Int64 Int8 IntSet Integer InterruptException ' +
      'InvalidStateException Irrational KeyError LabelNode LinSpace LineNumberNode LoadError LowerTriangular MIME Matrix ' +
      'MersenneTwister Method MethodError MethodTable Module NTuple NewvarNode NullException Nullable Number ObjectIdDict ' +
      'OrdinalRange OutOfMemoryError OverflowError Pair ParseError PartialQuickSort PermutedDimsArray Pipe ' +
      'PollingFileWatcher ProcessExitedException Ptr QuoteNode RandomDevice Range RangeIndex Rational RawFD ' +
      'ReadOnlyMemoryError Real ReentrantLock Ref Regex RegexMatch RemoteChannel RemoteException RevString RoundingMode ' +
      'RowVector SSAValue SegmentationFault SerializationState Set SharedArray SharedMatrix SharedVector Signed ' +
      'SimpleVector Slot SlotNumber SparseMatrixCSC SparseVector StackFrame StackOverflowError StackTrace StepRange ' +
      'StepRangeLen StridedArray StridedMatrix StridedVecOrMat StridedVector String SubArray SubString SymTridiagonal ' +
      'Symbol Symmetric SystemError TCPSocket Task Text TextDisplay Timer Tridiagonal Tuple Type TypeError TypeMapEntry ' +
      'TypeMapLevel TypeName TypeVar TypedSlot UDPSocket UInt UInt128 UInt16 UInt32 UInt64 UInt8 UndefRefError UndefVarError ' +
      'UnicodeError UniformScaling Union UnionAll UnitRange Unsigned UpperTriangular Val Vararg VecElement VecOrMat Vector ' +
      'VersionNumber Void WeakKeyDict WeakRef WorkerConfig WorkerPool '
  };

  // ref: http://julia.readthedocs.org/en/latest/manual/variables/#allowed-variable-names
  var VARIABLE_NAME_RE = '[A-Za-z_\\u00A1-\\uFFFF][A-Za-z_0-9\\u00A1-\\uFFFF]*';

  // placeholder for recursive self-reference
  var DEFAULT = {
    lexemes: VARIABLE_NAME_RE, keywords: KEYWORDS, illegal: /<\//
  };

  // ref: http://julia.readthedocs.org/en/latest/manual/integers-and-floating-point-numbers/
  var NUMBER = {
    className: 'number',
    // supported numeric literals:
    //  * binary literal (e.g. 0x10)
    //  * octal literal (e.g. 0o76543210)
    //  * hexadecimal literal (e.g. 0xfedcba876543210)
    //  * hexadecimal floating point literal (e.g. 0x1p0, 0x1.2p2)
    //  * decimal literal (e.g. 9876543210, 100_000_000)
    //  * floating pointe literal (e.g. 1.2, 1.2f, .2, 1., 1.2e10, 1.2e-10)
    begin: /(\b0x[\d_]*(\.[\d_]*)?|0x\.\d[\d_]*)p[-+]?\d+|\b0[box][a-fA-F0-9][a-fA-F0-9_]*|(\b\d[\d_]*(\.[\d_]*)?|\.\d[\d_]*)([eEfF][-+]?\d+)?/,
    relevance: 0
  };

  var CHAR = {
    className: 'string',
    begin: /'(.|\\[xXuU][a-zA-Z0-9]+)'/
  };

  var INTERPOLATION = {
    className: 'subst',
    begin: /\$\(/, end: /\)/,
    keywords: KEYWORDS
  };

  var INTERPOLATED_VARIABLE = {
    className: 'variable',
    begin: '\\$' + VARIABLE_NAME_RE
  };

  // TODO: neatly escape normal code in string literal
  var STRING = {
    className: 'string',
    contains: [hljs.BACKSLASH_ESCAPE, INTERPOLATION, INTERPOLATED_VARIABLE],
    variants: [
      { begin: /\w*"""/, end: /"""\w*/, relevance: 10 },
      { begin: /\w*"/, end: /"\w*/ }
    ]
  };

  var COMMAND = {
    className: 'string',
    contains: [hljs.BACKSLASH_ESCAPE, INTERPOLATION, INTERPOLATED_VARIABLE],
    begin: '`', end: '`'
  };

  var MACROCALL = {
    className: 'meta',
    begin: '@' + VARIABLE_NAME_RE
  };

  var COMMENT = {
    className: 'comment',
    variants: [
      { begin: '#=', end: '=#', relevance: 10 },
      { begin: '#', end: '$' }
    ]
  };

  DEFAULT.contains = [
    NUMBER,
    CHAR,
    STRING,
    COMMAND,
    MACROCALL,
    COMMENT,
    hljs.HASH_COMMENT_MODE,
    {
      className: 'keyword',
      begin:
        '\\b(((abstract|primitive)\\s+)type|(mutable\\s+)?struct)\\b'
    },
    {begin: /<:/}  // relevance booster
  ];
  INTERPOLATION.contains = DEFAULT.contains;

  return DEFAULT;
};

var juliaRepl = function(hljs) {
  return {
    contains: [
      {
        className: 'meta',
        begin: /^julia>/,
        relevance: 10,
        starts: {
          // end the highlighting if we are on a new line and the line does not have at
          // least six spaces in the beginning
          end: /^(?![ ]{6})/,
          subLanguage: 'julia'
      },
      // jldoctest Markdown blocks are used in the Julia manual and package docs indicate
      // code snippets that should be verified when the documentation is built. They can be
      // either REPL-like or script-like, but are usually REPL-like and therefore we apply
      // julia-repl highlighting to them. More information can be found in Documenter's
      // manual: https://juliadocs.github.io/Documenter.jl/latest/man/doctests.html
      aliases: ['jldoctest']
      }
    ]
  }
};

var kotlin = function(hljs) {
  var KEYWORDS = {
    keyword:
      'abstract as val var vararg get set class object open private protected public noinline ' +
      'crossinline dynamic final enum if else do while for when throw try catch finally ' +
      'import package is in fun override companion reified inline lateinit init ' +
      'interface annotation data sealed internal infix operator out by constructor super ' +
      'tailrec where const inner suspend typealias external expect actual ' +
      // to be deleted soon
      'trait volatile transient native default',
    built_in:
      'Byte Short Char Int Long Boolean Float Double Void Unit Nothing',
    literal:
      'true false null'
  };
  var KEYWORDS_WITH_LABEL = {
    className: 'keyword',
    begin: /\b(break|continue|return|this)\b/,
    starts: {
      contains: [
        {
          className: 'symbol',
          begin: /@\w+/
        }
      ]
    }
  };
  var LABEL = {
    className: 'symbol', begin: hljs.UNDERSCORE_IDENT_RE + '@'
  };

  // for string templates
  var SUBST = {
    className: 'subst',
    begin: '\\${', end: '}', contains: [hljs.APOS_STRING_MODE, hljs.C_NUMBER_MODE]
  };
  var VARIABLE = {
    className: 'variable', begin: '\\$' + hljs.UNDERSCORE_IDENT_RE
  };
  var STRING = {
    className: 'string',
    variants: [
      {
        begin: '"""', end: '"""',
        contains: [VARIABLE, SUBST]
      },
      // Can't use built-in modes easily, as we want to use STRING in the meta
      // context as 'meta-string' and there's no syntax to remove explicitly set
      // classNames in built-in modes.
      {
        begin: '\'', end: '\'',
        illegal: /\n/,
        contains: [hljs.BACKSLASH_ESCAPE]
      },
      {
        begin: '"', end: '"',
        illegal: /\n/,
        contains: [hljs.BACKSLASH_ESCAPE, VARIABLE, SUBST]
      }
    ]
  };

  var ANNOTATION_USE_SITE = {
    className: 'meta', begin: '@(?:file|property|field|get|set|receiver|param|setparam|delegate)\\s*:(?:\\s*' + hljs.UNDERSCORE_IDENT_RE + ')?'
  };
  var ANNOTATION = {
    className: 'meta', begin: '@' + hljs.UNDERSCORE_IDENT_RE,
    contains: [
      {
        begin: /\(/, end: /\)/,
        contains: [
          hljs.inherit(STRING, {className: 'meta-string'})
        ]
      }
    ]
  };

  // https://kotlinlang.org/docs/reference/whatsnew11.html#underscores-in-numeric-literals
  // According to the doc above, the number mode of kotlin is the same as java 8,
  // so the code below is copied from java.js
  var KOTLIN_NUMBER_RE = '\\b' +
    '(' +
      '0[bB]([01]+[01_]+[01]+|[01]+)' + // 0b...
      '|' +
      '0[xX]([a-fA-F0-9]+[a-fA-F0-9_]+[a-fA-F0-9]+|[a-fA-F0-9]+)' + // 0x...
      '|' +
      '(' +
        '([\\d]+[\\d_]+[\\d]+|[\\d]+)(\\.([\\d]+[\\d_]+[\\d]+|[\\d]+))?' +
        '|' +
        '\\.([\\d]+[\\d_]+[\\d]+|[\\d]+)' +
      ')' +
      '([eE][-+]?\\d+)?' + // octal, decimal, float
    ')' +
    '[lLfF]?';
  var KOTLIN_NUMBER_MODE = {
    className: 'number',
    begin: KOTLIN_NUMBER_RE,
    relevance: 0
  };

  return {
    aliases: ['kt'],
    keywords: KEYWORDS,
    contains : [
      hljs.COMMENT(
        '/\\*\\*',
        '\\*/',
        {
          relevance : 0,
          contains : [{
            className : 'doctag',
            begin : '@[A-Za-z]+'
          }]
        }
      ),
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      KEYWORDS_WITH_LABEL,
      LABEL,
      ANNOTATION_USE_SITE,
      ANNOTATION,
      {
        className: 'function',
        beginKeywords: 'fun', end: '[(]|$',
        returnBegin: true,
        excludeEnd: true,
        keywords: KEYWORDS,
        illegal: /fun\s+(<.*>)?[^\s\(]+(\s+[^\s\(]+)\s*=/,
        relevance: 5,
        contains: [
          {
            begin: hljs.UNDERSCORE_IDENT_RE + '\\s*\\(', returnBegin: true,
            relevance: 0,
            contains: [hljs.UNDERSCORE_TITLE_MODE]
          },
          {
            className: 'type',
            begin: /</, end: />/, keywords: 'reified',
            relevance: 0
          },
          {
            className: 'params',
            begin: /\(/, end: /\)/,
            endsParent: true,
            keywords: KEYWORDS,
            relevance: 0,
            contains: [
              {
                begin: /:/, end: /[=,\/]/, endsWithParent: true,
                contains: [
                  {className: 'type', begin: hljs.UNDERSCORE_IDENT_RE},
                  hljs.C_LINE_COMMENT_MODE,
                  hljs.C_BLOCK_COMMENT_MODE
                ],
                relevance: 0
              },
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE,
              ANNOTATION_USE_SITE,
              ANNOTATION,
              STRING,
              hljs.C_NUMBER_MODE
            ]
          },
          hljs.C_BLOCK_COMMENT_MODE
        ]
      },
      {
        className: 'class',
        beginKeywords: 'class interface trait', end: /[:\{(]|$/, // remove 'trait' when removed from KEYWORDS
        excludeEnd: true,
        illegal: 'extends implements',
        contains: [
          {beginKeywords: 'public protected internal private constructor'},
          hljs.UNDERSCORE_TITLE_MODE,
          {
            className: 'type',
            begin: /</, end: />/, excludeBegin: true, excludeEnd: true,
            relevance: 0
          },
          {
            className: 'type',
            begin: /[,:]\s*/, end: /[<\(,]|$/, excludeBegin: true, returnEnd: true
          },
          ANNOTATION_USE_SITE,
          ANNOTATION
        ]
      },
      STRING,
      {
        className: 'meta',
        begin: "^#!/usr/bin/env", end: '$',
        illegal: '\n'
      },
      KOTLIN_NUMBER_MODE
    ]
  };
};

var lasso = function(hljs) {
  var LASSO_IDENT_RE = '[a-zA-Z_][\\w.]*';
  var LASSO_ANGLE_RE = '<\\?(lasso(script)?|=)';
  var LASSO_CLOSE_RE = '\\]|\\?>';
  var LASSO_KEYWORDS = {
    literal:
      'true false none minimal full all void and or not ' +
      'bw nbw ew new cn ncn lt lte gt gte eq neq rx nrx ft',
    built_in:
      'array date decimal duration integer map pair string tag xml null ' +
      'boolean bytes keyword list locale queue set stack staticarray ' +
      'local var variable global data self inherited currentcapture givenblock',
    keyword:
      'cache database_names database_schemanames database_tablenames ' +
      'define_tag define_type email_batch encode_set html_comment handle ' +
      'handle_error header if inline iterate ljax_target link ' +
      'link_currentaction link_currentgroup link_currentrecord link_detail ' +
      'link_firstgroup link_firstrecord link_lastgroup link_lastrecord ' +
      'link_nextgroup link_nextrecord link_prevgroup link_prevrecord log ' +
      'loop namespace_using output_none portal private protect records ' +
      'referer referrer repeating resultset rows search_args ' +
      'search_arguments select sort_args sort_arguments thread_atomic ' +
      'value_list while abort case else fail_if fail_ifnot fail if_empty ' +
      'if_false if_null if_true loop_abort loop_continue loop_count params ' +
      'params_up return return_value run_children soap_definetag ' +
      'soap_lastrequest soap_lastresponse tag_name ascending average by ' +
      'define descending do equals frozen group handle_failure import in ' +
      'into join let match max min on order parent protected provide public ' +
      'require returnhome skip split_thread sum take thread to trait type ' +
      'where with yield yieldhome'
  };
  var HTML_COMMENT = hljs.COMMENT(
    '<!--',
    '-->',
    {
      relevance: 0
    }
  );
  var LASSO_NOPROCESS = {
    className: 'meta',
    begin: '\\[noprocess\\]',
    starts: {
      end: '\\[/noprocess\\]',
      returnEnd: true,
      contains: [HTML_COMMENT]
    }
  };
  var LASSO_START = {
    className: 'meta',
    begin: '\\[/noprocess|' + LASSO_ANGLE_RE
  };
  var LASSO_DATAMEMBER = {
    className: 'symbol',
    begin: '\'' + LASSO_IDENT_RE + '\''
  };
  var LASSO_CODE = [
    hljs.C_LINE_COMMENT_MODE,
    hljs.C_BLOCK_COMMENT_MODE,
    hljs.inherit(hljs.C_NUMBER_MODE, {begin: hljs.C_NUMBER_RE + '|(-?infinity|NaN)\\b'}),
    hljs.inherit(hljs.APOS_STRING_MODE, {illegal: null}),
    hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null}),
    {
      className: 'string',
      begin: '`', end: '`'
    },
    { // variables
      variants: [
        {
          begin: '[#$]' + LASSO_IDENT_RE
        },
        {
          begin: '#', end: '\\d+',
          illegal: '\\W'
        }
      ]
    },
    {
      className: 'type',
      begin: '::\\s*', end: LASSO_IDENT_RE,
      illegal: '\\W'
    },
    {
      className: 'params',
      variants: [
        {
          begin: '-(?!infinity)' + LASSO_IDENT_RE,
          relevance: 0
        },
        {
          begin: '(\\.\\.\\.)'
        }
      ]
    },
    {
      begin: /(->|\.)\s*/,
      relevance: 0,
      contains: [LASSO_DATAMEMBER]
    },
    {
      className: 'class',
      beginKeywords: 'define',
      returnEnd: true, end: '\\(|=>',
      contains: [
        hljs.inherit(hljs.TITLE_MODE, {begin: LASSO_IDENT_RE + '(=(?!>))?|[-+*/%](?!>)'})
      ]
    }
  ];
  return {
    aliases: ['ls', 'lassoscript'],
    case_insensitive: true,
    lexemes: LASSO_IDENT_RE + '|&[lg]t;',
    keywords: LASSO_KEYWORDS,
    contains: [
      {
        className: 'meta',
        begin: LASSO_CLOSE_RE,
        relevance: 0,
        starts: { // markup
          end: '\\[|' + LASSO_ANGLE_RE,
          returnEnd: true,
          relevance: 0,
          contains: [HTML_COMMENT]
        }
      },
      LASSO_NOPROCESS,
      LASSO_START,
      {
        className: 'meta',
        begin: '\\[no_square_brackets',
        starts: {
          end: '\\[/no_square_brackets\\]', // not implemented in the language
          lexemes: LASSO_IDENT_RE + '|&[lg]t;',
          keywords: LASSO_KEYWORDS,
          contains: [
            {
              className: 'meta',
              begin: LASSO_CLOSE_RE,
              relevance: 0,
              starts: {
                end: '\\[noprocess\\]|' + LASSO_ANGLE_RE,
                returnEnd: true,
                contains: [HTML_COMMENT]
              }
            },
            LASSO_NOPROCESS,
            LASSO_START
          ].concat(LASSO_CODE)
        }
      },
      {
        className: 'meta',
        begin: '\\[',
        relevance: 0
      },
      {
        className: 'meta',
        begin: '^#!', end:'lasso9$',
        relevance: 10
      }
    ].concat(LASSO_CODE)
  };
};

var ldif = function(hljs) {
  return {
    contains: [
      {
        className: 'attribute',
        begin: '^dn', end: ': ', excludeEnd: true,
        starts: {end: '$', relevance: 0},
        relevance: 10
      },
      {
        className: 'attribute',
        begin: '^\\w', end: ': ', excludeEnd: true,
        starts: {end: '$', relevance: 0}
      },
      {
        className: 'literal',
        begin: '^-', end: '$'
      },
      hljs.HASH_COMMENT_MODE
    ]
  };
};

var leaf = function (hljs) {
  return {
    contains: [
      {
        className: 'function',
        begin: '#+' + '[A-Za-z_0-9]*' + '\\(',
        end:' {',
        returnBegin: true,
        excludeEnd: true,
        contains : [
          {
            className: 'keyword',
            begin: '#+'
          },
          {
            className: 'title',
            begin: '[A-Za-z_][A-Za-z_0-9]*'
          },
          {
            className: 'params',
            begin: '\\(', end: '\\)',
            endsParent: true,
            contains: [
              {
                className: 'string',
                begin: '"',
                end: '"'
              },
              {
                className: 'variable',
                begin: '[A-Za-z_][A-Za-z_0-9]*'
              }
            ]
          }
        ]
      }
    ]
  };
};

var less = function(hljs) {
  var IDENT_RE        = '[\\w-]+'; // yes, Less identifiers may begin with a digit
  var INTERP_IDENT_RE = '(' + IDENT_RE + '|@{' + IDENT_RE + '})';

  /* Generic Modes */

  var RULES = [], VALUE = []; // forward def. for recursive modes

  var STRING_MODE = function(c) { return {
    // Less strings are not multiline (also include '~' for more consistent coloring of "escaped" strings)
    className: 'string', begin: '~?' + c + '.*?' + c
  };};

  var IDENT_MODE = function(name, begin, relevance) { return {
    className: name, begin: begin, relevance: relevance
  };};

  var PARENS_MODE = {
    // used only to properly balance nested parens inside mixin call, def. arg list
    begin: '\\(', end: '\\)', contains: VALUE, relevance: 0
  };

  // generic Less highlighter (used almost everywhere except selectors):
  VALUE.push(
    hljs.C_LINE_COMMENT_MODE,
    hljs.C_BLOCK_COMMENT_MODE,
    STRING_MODE("'"),
    STRING_MODE('"'),
    hljs.CSS_NUMBER_MODE, // fixme: it does not include dot for numbers like .5em :(
    {
      begin: '(url|data-uri)\\(',
      starts: {className: 'string', end: '[\\)\\n]', excludeEnd: true}
    },
    IDENT_MODE('number', '#[0-9A-Fa-f]+\\b'),
    PARENS_MODE,
    IDENT_MODE('variable', '@@?' + IDENT_RE, 10),
    IDENT_MODE('variable', '@{'  + IDENT_RE + '}'),
    IDENT_MODE('built_in', '~?`[^`]*?`'), // inline javascript (or whatever host language) *multiline* string
    { // @media features (it’s here to not duplicate things in AT_RULE_MODE with extra PARENS_MODE overriding):
      className: 'attribute', begin: IDENT_RE + '\\s*:', end: ':', returnBegin: true, excludeEnd: true
    },
    {
      className: 'meta',
      begin: '!important'
    }
  );

  var VALUE_WITH_RULESETS = VALUE.concat({
    begin: '{', end: '}', contains: RULES
  });

  var MIXIN_GUARD_MODE = {
    beginKeywords: 'when', endsWithParent: true,
    contains: [{beginKeywords: 'and not'}].concat(VALUE) // using this form to override VALUE’s 'function' match
  };

  /* Rule-Level Modes */

  var RULE_MODE = {
    begin: INTERP_IDENT_RE + '\\s*:', returnBegin: true, end: '[;}]',
    relevance: 0,
    contains: [
      {
        className: 'attribute',
        begin: INTERP_IDENT_RE, end: ':', excludeEnd: true,
        starts: {
          endsWithParent: true, illegal: '[<=$]',
          relevance: 0,
          contains: VALUE
        }
      }
    ]
  };

  var AT_RULE_MODE = {
    className: 'keyword',
    begin: '@(import|media|charset|font-face|(-[a-z]+-)?keyframes|supports|document|namespace|page|viewport|host)\\b',
    starts: {end: '[;{}]', returnEnd: true, contains: VALUE, relevance: 0}
  };

  // variable definitions and calls
  var VAR_RULE_MODE = {
    className: 'variable',
    variants: [
      // using more strict pattern for higher relevance to increase chances of Less detection.
      // this is *the only* Less specific statement used in most of the sources, so...
      // (we’ll still often loose to the css-parser unless there's '//' comment,
      // simply because 1 variable just can't beat 99 properties :)
      {begin: '@' + IDENT_RE + '\\s*:', relevance: 15},
      {begin: '@' + IDENT_RE}
    ],
    starts: {end: '[;}]', returnEnd: true, contains: VALUE_WITH_RULESETS}
  };

  var SELECTOR_MODE = {
    // first parse unambiguous selectors (i.e. those not starting with tag)
    // then fall into the scary lookahead-discriminator variant.
    // this mode also handles mixin definitions and calls
    variants: [{
      begin: '[\\.#:&\\[>]', end: '[;{}]'  // mixin calls end with ';'
      }, {
      begin: INTERP_IDENT_RE, end: '{'
    }],
    returnBegin: true,
    returnEnd:   true,
    illegal: '[<=\'$"]',
    relevance: 0,
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      MIXIN_GUARD_MODE,
      IDENT_MODE('keyword',  'all\\b'),
      IDENT_MODE('variable', '@{'  + IDENT_RE + '}'),     // otherwise it’s identified as tag
      IDENT_MODE('selector-tag',  INTERP_IDENT_RE + '%?', 0), // '%' for more consistent coloring of @keyframes "tags"
      IDENT_MODE('selector-id', '#' + INTERP_IDENT_RE),
      IDENT_MODE('selector-class', '\\.' + INTERP_IDENT_RE, 0),
      IDENT_MODE('selector-tag',  '&', 0),
      {className: 'selector-attr', begin: '\\[', end: '\\]'},
      {className: 'selector-pseudo', begin: /:(:)?[a-zA-Z0-9\_\-\+\(\)"'.]+/},
      {begin: '\\(', end: '\\)', contains: VALUE_WITH_RULESETS}, // argument list of parametric mixins
      {begin: '!important'} // eat !important after mixin call or it will be colored as tag
    ]
  };

  RULES.push(
    hljs.C_LINE_COMMENT_MODE,
    hljs.C_BLOCK_COMMENT_MODE,
    AT_RULE_MODE,
    VAR_RULE_MODE,
    RULE_MODE,
    SELECTOR_MODE
  );

  return {
    case_insensitive: true,
    illegal: '[=>\'/<($"]',
    contains: RULES
  };
};

var lisp = function(hljs) {
  var LISP_IDENT_RE = '[a-zA-Z_\\-\\+\\*\\/\\<\\=\\>\\&\\#][a-zA-Z0-9_\\-\\+\\*\\/\\<\\=\\>\\&\\#!]*';
  var MEC_RE = '\\|[^]*?\\|';
  var LISP_SIMPLE_NUMBER_RE = '(\\-|\\+)?\\d+(\\.\\d+|\\/\\d+)?((d|e|f|l|s|D|E|F|L|S)(\\+|\\-)?\\d+)?';
  var SHEBANG = {
    className: 'meta',
    begin: '^#!', end: '$'
  };
  var LITERAL = {
    className: 'literal',
    begin: '\\b(t{1}|nil)\\b'
  };
  var NUMBER = {
    className: 'number',
    variants: [
      {begin: LISP_SIMPLE_NUMBER_RE, relevance: 0},
      {begin: '#(b|B)[0-1]+(/[0-1]+)?'},
      {begin: '#(o|O)[0-7]+(/[0-7]+)?'},
      {begin: '#(x|X)[0-9a-fA-F]+(/[0-9a-fA-F]+)?'},
      {begin: '#(c|C)\\(' + LISP_SIMPLE_NUMBER_RE + ' +' + LISP_SIMPLE_NUMBER_RE, end: '\\)'}
    ]
  };
  var STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null});
  var COMMENT = hljs.COMMENT(
    ';', '$',
    {
      relevance: 0
    }
  );
  var VARIABLE = {
    begin: '\\*', end: '\\*'
  };
  var KEYWORD = {
    className: 'symbol',
    begin: '[:&]' + LISP_IDENT_RE
  };
  var IDENT = {
    begin: LISP_IDENT_RE,
    relevance: 0
  };
  var MEC = {
    begin: MEC_RE
  };
  var QUOTED_LIST = {
    begin: '\\(', end: '\\)',
    contains: ['self', LITERAL, STRING, NUMBER, IDENT]
  };
  var QUOTED = {
    contains: [NUMBER, STRING, VARIABLE, KEYWORD, QUOTED_LIST, IDENT],
    variants: [
      {
        begin: '[\'`]\\(', end: '\\)'
      },
      {
        begin: '\\(quote ', end: '\\)',
        keywords: {name: 'quote'}
      },
      {
        begin: '\'' + MEC_RE
      }
    ]
  };
  var QUOTED_ATOM = {
    variants: [
      {begin: '\'' + LISP_IDENT_RE},
      {begin: '#\'' + LISP_IDENT_RE + '(::' + LISP_IDENT_RE + ')*'}
    ]
  };
  var LIST = {
    begin: '\\(\\s*', end: '\\)'
  };
  var BODY = {
    endsWithParent: true,
    relevance: 0
  };
  LIST.contains = [
    {
      className: 'name',
      variants: [
        {begin: LISP_IDENT_RE},
        {begin: MEC_RE}
      ]
    },
    BODY
  ];
  BODY.contains = [QUOTED, QUOTED_ATOM, LIST, LITERAL, NUMBER, STRING, COMMENT, VARIABLE, KEYWORD, MEC, IDENT];

  return {
    illegal: /\S/,
    contains: [
      NUMBER,
      SHEBANG,
      LITERAL,
      STRING,
      COMMENT,
      QUOTED,
      QUOTED_ATOM,
      LIST,
      IDENT
    ]
  };
};

var livecodeserver = function(hljs) {
  var VARIABLE = {
    begin: '\\b[gtps][A-Z]+[A-Za-z0-9_\\-]*\\b|\\$_[A-Z]+',
    relevance: 0
  };
  var COMMENT_MODES = [
    hljs.C_BLOCK_COMMENT_MODE,
    hljs.HASH_COMMENT_MODE,
    hljs.COMMENT('--', '$'),
    hljs.COMMENT('[^:]//', '$')
  ];
  var TITLE1 = hljs.inherit(hljs.TITLE_MODE, {
    variants: [
      {begin: '\\b_*rig[A-Z]+[A-Za-z0-9_\\-]*'},
      {begin: '\\b_[a-z0-9\\-]+'}
    ]
  });
  var TITLE2 = hljs.inherit(hljs.TITLE_MODE, {begin: '\\b([A-Za-z0-9_\\-]+)\\b'});
  return {
    case_insensitive: false,
    keywords: {
      keyword:
        '$_COOKIE $_FILES $_GET $_GET_BINARY $_GET_RAW $_POST $_POST_BINARY $_POST_RAW $_SESSION $_SERVER ' +
        'codepoint codepoints segment segments codeunit codeunits sentence sentences trueWord trueWords paragraph ' +
        'after byte bytes english the until http forever descending using line real8 with seventh ' +
        'for stdout finally element word words fourth before black ninth sixth characters chars stderr ' +
        'uInt1 uInt1s uInt2 uInt2s stdin string lines relative rel any fifth items from middle mid ' +
        'at else of catch then third it file milliseconds seconds second secs sec int1 int1s int4 ' +
        'int4s internet int2 int2s normal text item last long detailed effective uInt4 uInt4s repeat ' +
        'end repeat URL in try into switch to words https token binfile each tenth as ticks tick ' +
        'system real4 by dateItems without char character ascending eighth whole dateTime numeric short ' +
        'first ftp integer abbreviated abbr abbrev private case while if ' +
        'div mod wrap and or bitAnd bitNot bitOr bitXor among not in a an within ' +
        'contains ends with begins the keys of keys',
      literal:
        'SIX TEN FORMFEED NINE ZERO NONE SPACE FOUR FALSE COLON CRLF PI COMMA ENDOFFILE EOF EIGHT FIVE ' +
        'QUOTE EMPTY ONE TRUE RETURN CR LINEFEED RIGHT BACKSLASH NULL SEVEN TAB THREE TWO ' +
        'six ten formfeed nine zero none space four false colon crlf pi comma endoffile eof eight five ' +
        'quote empty one true return cr linefeed right backslash null seven tab three two ' +
        'RIVERSION RISTATE FILE_READ_MODE FILE_WRITE_MODE FILE_WRITE_MODE DIR_WRITE_MODE FILE_READ_UMASK ' +
        'FILE_WRITE_UMASK DIR_READ_UMASK DIR_WRITE_UMASK',
      built_in:
        'put abs acos aliasReference annuity arrayDecode arrayEncode asin atan atan2 average avg avgDev base64Decode ' +
        'base64Encode baseConvert binaryDecode binaryEncode byteOffset byteToNum cachedURL cachedURLs charToNum ' +
        'cipherNames codepointOffset codepointProperty codepointToNum codeunitOffset commandNames compound compress ' +
        'constantNames cos date dateFormat decompress directories ' +
        'diskSpace DNSServers exp exp1 exp2 exp10 extents files flushEvents folders format functionNames geometricMean global ' +
        'globals hasMemory harmonicMean hostAddress hostAddressToName hostName hostNameToAddress isNumber ISOToMac itemOffset ' +
        'keys len length libURLErrorData libUrlFormData libURLftpCommand libURLLastHTTPHeaders libURLLastRHHeaders ' +
        'libUrlMultipartFormAddPart libUrlMultipartFormData libURLVersion lineOffset ln ln1 localNames log log2 log10 ' +
        'longFilePath lower macToISO matchChunk matchText matrixMultiply max md5Digest median merge millisec ' +
        'millisecs millisecond milliseconds min monthNames nativeCharToNum normalizeText num number numToByte numToChar ' +
        'numToCodepoint numToNativeChar offset open openfiles openProcesses openProcessIDs openSockets ' +
        'paragraphOffset paramCount param params peerAddress pendingMessages platform popStdDev populationStandardDeviation ' +
        'populationVariance popVariance processID random randomBytes replaceText result revCreateXMLTree revCreateXMLTreeFromFile ' +
        'revCurrentRecord revCurrentRecordIsFirst revCurrentRecordIsLast revDatabaseColumnCount revDatabaseColumnIsNull ' +
        'revDatabaseColumnLengths revDatabaseColumnNames revDatabaseColumnNamed revDatabaseColumnNumbered ' +
        'revDatabaseColumnTypes revDatabaseConnectResult revDatabaseCursors revDatabaseID revDatabaseTableNames ' +
        'revDatabaseType revDataFromQuery revdb_closeCursor revdb_columnbynumber revdb_columncount revdb_columnisnull ' +
        'revdb_columnlengths revdb_columnnames revdb_columntypes revdb_commit revdb_connect revdb_connections ' +
        'revdb_connectionerr revdb_currentrecord revdb_cursorconnection revdb_cursorerr revdb_cursors revdb_dbtype ' +
        'revdb_disconnect revdb_execute revdb_iseof revdb_isbof revdb_movefirst revdb_movelast revdb_movenext ' +
        'revdb_moveprev revdb_query revdb_querylist revdb_recordcount revdb_rollback revdb_tablenames ' +
        'revGetDatabaseDriverPath revNumberOfRecords revOpenDatabase revOpenDatabases revQueryDatabase ' +
        'revQueryDatabaseBlob revQueryResult revQueryIsAtStart revQueryIsAtEnd revUnixFromMacPath revXMLAttribute ' +
        'revXMLAttributes revXMLAttributeValues revXMLChildContents revXMLChildNames revXMLCreateTreeFromFileWithNamespaces ' +
        'revXMLCreateTreeWithNamespaces revXMLDataFromXPathQuery revXMLEvaluateXPath revXMLFirstChild revXMLMatchingNode ' +
        'revXMLNextSibling revXMLNodeContents revXMLNumberOfChildren revXMLParent revXMLPreviousSibling ' +
        'revXMLRootNode revXMLRPC_CreateRequest revXMLRPC_Documents revXMLRPC_Error ' +
        'revXMLRPC_GetHost revXMLRPC_GetMethod revXMLRPC_GetParam revXMLText revXMLRPC_Execute ' +
        'revXMLRPC_GetParamCount revXMLRPC_GetParamNode revXMLRPC_GetParamType revXMLRPC_GetPath revXMLRPC_GetPort ' +
        'revXMLRPC_GetProtocol revXMLRPC_GetRequest revXMLRPC_GetResponse revXMLRPC_GetSocket revXMLTree ' +
        'revXMLTrees revXMLValidateDTD revZipDescribeItem revZipEnumerateItems revZipOpenArchives round sampVariance ' +
        'sec secs seconds sentenceOffset sha1Digest shell shortFilePath sin specialFolderPath sqrt standardDeviation statRound ' +
        'stdDev sum sysError systemVersion tan tempName textDecode textEncode tick ticks time to tokenOffset toLower toUpper ' +
        'transpose truewordOffset trunc uniDecode uniEncode upper URLDecode URLEncode URLStatus uuid value variableNames ' +
        'variance version waitDepth weekdayNames wordOffset xsltApplyStylesheet xsltApplyStylesheetFromFile xsltLoadStylesheet ' +
        'xsltLoadStylesheetFromFile add breakpoint cancel clear local variable file word line folder directory URL close socket process ' +
        'combine constant convert create new alias folder directory decrypt delete variable word line folder ' +
        'directory URL dispatch divide do encrypt filter get include intersect kill libURLDownloadToFile ' +
        'libURLFollowHttpRedirects libURLftpUpload libURLftpUploadFile libURLresetAll libUrlSetAuthCallback ' +
        'libURLSetCustomHTTPHeaders libUrlSetExpect100 libURLSetFTPListCommand libURLSetFTPMode libURLSetFTPStopTime ' +
        'libURLSetStatusCallback load multiply socket prepare process post seek rel relative read from process rename ' +
        'replace require resetAll resolve revAddXMLNode revAppendXML revCloseCursor revCloseDatabase revCommitDatabase ' +
        'revCopyFile revCopyFolder revCopyXMLNode revDeleteFolder revDeleteXMLNode revDeleteAllXMLTrees ' +
        'revDeleteXMLTree revExecuteSQL revGoURL revInsertXMLNode revMoveFolder revMoveToFirstRecord revMoveToLastRecord ' +
        'revMoveToNextRecord revMoveToPreviousRecord revMoveToRecord revMoveXMLNode revPutIntoXMLNode revRollBackDatabase ' +
        'revSetDatabaseDriverPath revSetXMLAttribute revXMLRPC_AddParam revXMLRPC_DeleteAllDocuments revXMLAddDTD ' +
        'revXMLRPC_Free revXMLRPC_FreeAll revXMLRPC_DeleteDocument revXMLRPC_DeleteParam revXMLRPC_SetHost ' +
        'revXMLRPC_SetMethod revXMLRPC_SetPort revXMLRPC_SetProtocol revXMLRPC_SetSocket revZipAddItemWithData ' +
        'revZipAddItemWithFile revZipAddUncompressedItemWithData revZipAddUncompressedItemWithFile revZipCancel ' +
        'revZipCloseArchive revZipDeleteItem revZipExtractItemToFile revZipExtractItemToVariable revZipSetProgressCallback ' +
        'revZipRenameItem revZipReplaceItemWithData revZipReplaceItemWithFile revZipOpenArchive send set sort split start stop ' +
        'subtract union unload wait write'
    },
    contains: [
      VARIABLE,
      {
        className: 'keyword',
        begin: '\\bend\\sif\\b'
      },
      {
        className: 'function',
        beginKeywords: 'function', end: '$',
        contains: [
          VARIABLE,
          TITLE2,
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.BINARY_NUMBER_MODE,
          hljs.C_NUMBER_MODE,
          TITLE1
        ]
      },
      {
        className: 'function',
        begin: '\\bend\\s+', end: '$',
        keywords: 'end',
        contains: [
          TITLE2,
          TITLE1
        ],
        relevance: 0
      },
      {
        beginKeywords: 'command on', end: '$',
        contains: [
          VARIABLE,
          TITLE2,
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.BINARY_NUMBER_MODE,
          hljs.C_NUMBER_MODE,
          TITLE1
        ]
      },
      {
        className: 'meta',
        variants: [
          {
            begin: '<\\?(rev|lc|livecode)',
            relevance: 10
          },
          { begin: '<\\?' },
          { begin: '\\?>' }
        ]
      },
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.BINARY_NUMBER_MODE,
      hljs.C_NUMBER_MODE,
      TITLE1
    ].concat(COMMENT_MODES),
    illegal: ';$|^\\[|^=|&|{'
  };
};

var livescript = function(hljs) {
  var KEYWORDS = {
    keyword:
      // JS keywords
      'in if for while finally new do return else break catch instanceof throw try this ' +
      'switch continue typeof delete debugger case default function var with ' +
      // LiveScript keywords
      'then unless until loop of by when and or is isnt not it that otherwise from to til fallthrough super ' +
      'case default function var void const let enum export import native ' +
      '__hasProp __extends __slice __bind __indexOf',
    literal:
      // JS literals
      'true false null undefined ' +
      // LiveScript literals
      'yes no on off it that void',
    built_in:
      'npm require console print module global window document'
  };
  var JS_IDENT_RE = '[A-Za-z$_](?:\-[0-9A-Za-z$_]|[0-9A-Za-z$_])*';
  var TITLE = hljs.inherit(hljs.TITLE_MODE, {begin: JS_IDENT_RE});
  var SUBST = {
    className: 'subst',
    begin: /#\{/, end: /}/,
    keywords: KEYWORDS
  };
  var SUBST_SIMPLE = {
    className: 'subst',
    begin: /#[A-Za-z$_]/, end: /(?:\-[0-9A-Za-z$_]|[0-9A-Za-z$_])*/,
    keywords: KEYWORDS
  };
  var EXPRESSIONS = [
    hljs.BINARY_NUMBER_MODE,
    {
      className: 'number',
      begin: '(\\b0[xX][a-fA-F0-9_]+)|(\\b\\d(\\d|_\\d)*(\\.(\\d(\\d|_\\d)*)?)?(_*[eE]([-+]\\d(_\\d|\\d)*)?)?[_a-z]*)',
      relevance: 0,
      starts: {end: '(\\s*/)?', relevance: 0} // a number tries to eat the following slash to prevent treating it as a regexp
    },
    {
      className: 'string',
      variants: [
        {
          begin: /'''/, end: /'''/,
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        {
          begin: /'/, end: /'/,
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        {
          begin: /"""/, end: /"""/,
          contains: [hljs.BACKSLASH_ESCAPE, SUBST, SUBST_SIMPLE]
        },
        {
          begin: /"/, end: /"/,
          contains: [hljs.BACKSLASH_ESCAPE, SUBST, SUBST_SIMPLE]
        },
        {
          begin: /\\/, end: /(\s|$)/,
          excludeEnd: true
        }
      ]
    },
    {
      className: 'regexp',
      variants: [
        {
          begin: '//', end: '//[gim]*',
          contains: [SUBST, hljs.HASH_COMMENT_MODE]
        },
        {
          // regex can't start with space to parse x / 2 / 3 as two divisions
          // regex can't start with *, and it supports an "illegal" in the main mode
          begin: /\/(?![ *])(\\\/|.)*?\/[gim]*(?=\W|$)/
        }
      ]
    },
    {
      begin: '@' + JS_IDENT_RE
    },
    {
      begin: '``', end: '``',
      excludeBegin: true, excludeEnd: true,
      subLanguage: 'javascript'
    }
  ];
  SUBST.contains = EXPRESSIONS;

  var PARAMS = {
    className: 'params',
    begin: '\\(', returnBegin: true,
    /* We need another contained nameless mode to not have every nested
    pair of parens to be called "params" */
    contains: [
      {
        begin: /\(/, end: /\)/,
        keywords: KEYWORDS,
        contains: ['self'].concat(EXPRESSIONS)
      }
    ]
  };

  return {
    aliases: ['ls'],
    keywords: KEYWORDS,
    illegal: /\/\*/,
    contains: EXPRESSIONS.concat([
      hljs.COMMENT('\\/\\*', '\\*\\/'),
      hljs.HASH_COMMENT_MODE,
      {
        className: 'function',
        contains: [TITLE, PARAMS],
        returnBegin: true,
        variants: [
          {
            begin: '(' + JS_IDENT_RE + '\\s*(?:=|:=)\\s*)?(\\(.*\\))?\\s*\\B\\->\\*?', end: '\\->\\*?'
          },
          {
            begin: '(' + JS_IDENT_RE + '\\s*(?:=|:=)\\s*)?!?(\\(.*\\))?\\s*\\B[-~]{1,2}>\\*?', end: '[-~]{1,2}>\\*?'
          },
          {
            begin: '(' + JS_IDENT_RE + '\\s*(?:=|:=)\\s*)?(\\(.*\\))?\\s*\\B!?[-~]{1,2}>\\*?', end: '!?[-~]{1,2}>\\*?'
          }
        ]
      },
      {
        className: 'class',
        beginKeywords: 'class',
        end: '$',
        illegal: /[:="\[\]]/,
        contains: [
          {
            beginKeywords: 'extends',
            endsWithParent: true,
            illegal: /[:="\[\]]/,
            contains: [TITLE]
          },
          TITLE
        ]
      },
      {
        begin: JS_IDENT_RE + ':', end: ':',
        returnBegin: true, returnEnd: true,
        relevance: 0
      }
    ])
  };
};

var llvm = function(hljs) {
  var identifier = '([-a-zA-Z$._][\\w\\-$.]*)';
  return {
    //lexemes: '[.%]?' + hljs.IDENT_RE,
    keywords:
      'begin end true false declare define global ' +
      'constant private linker_private internal ' +
      'available_externally linkonce linkonce_odr weak ' +
      'weak_odr appending dllimport dllexport common ' +
      'default hidden protected extern_weak external ' +
      'thread_local zeroinitializer undef null to tail ' +
      'target triple datalayout volatile nuw nsw nnan ' +
      'ninf nsz arcp fast exact inbounds align ' +
      'addrspace section alias module asm sideeffect ' +
      'gc dbg linker_private_weak attributes blockaddress ' +
      'initialexec localdynamic localexec prefix unnamed_addr ' +
      'ccc fastcc coldcc x86_stdcallcc x86_fastcallcc ' +
      'arm_apcscc arm_aapcscc arm_aapcs_vfpcc ptx_device ' +
      'ptx_kernel intel_ocl_bicc msp430_intrcc spir_func ' +
      'spir_kernel x86_64_sysvcc x86_64_win64cc x86_thiscallcc ' +
      'cc c signext zeroext inreg sret nounwind ' +
      'noreturn noalias nocapture byval nest readnone ' +
      'readonly inlinehint noinline alwaysinline optsize ssp ' +
      'sspreq noredzone noimplicitfloat naked builtin cold ' +
      'nobuiltin noduplicate nonlazybind optnone returns_twice ' +
      'sanitize_address sanitize_memory sanitize_thread sspstrong ' +
      'uwtable returned type opaque eq ne slt sgt ' +
      'sle sge ult ugt ule uge oeq one olt ogt ' +
      'ole oge ord uno ueq une x acq_rel acquire ' +
      'alignstack atomic catch cleanup filter inteldialect ' +
      'max min monotonic nand personality release seq_cst ' +
      'singlethread umax umin unordered xchg add fadd ' +
      'sub fsub mul fmul udiv sdiv fdiv urem srem ' +
      'frem shl lshr ashr and or xor icmp fcmp ' +
      'phi call trunc zext sext fptrunc fpext uitofp ' +
      'sitofp fptoui fptosi inttoptr ptrtoint bitcast ' +
      'addrspacecast select va_arg ret br switch invoke ' +
      'unwind unreachable indirectbr landingpad resume ' +
      'malloc alloca free load store getelementptr ' +
      'extractelement insertelement shufflevector getresult ' +
      'extractvalue insertvalue atomicrmw cmpxchg fence ' +
      'argmemonly double',
    contains: [
      {
        className: 'keyword',
        begin: 'i\\d+'
      },
      hljs.COMMENT(
        ';', '\\n', {relevance: 0}
      ),
      // Double quote string
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        variants: [
          // Double-quoted string
          { begin: '"', end: '[^\\\\]"' },
        ],
        relevance: 0
      },
      {
        className: 'title',
        variants: [
          { begin: '@' + identifier },
          { begin: '@\\d+' },
          { begin: '!' + identifier },
          { begin: '!\\d+' + identifier }
        ]
      },
      {
        className: 'symbol',
        variants: [
          { begin: '%' + identifier },
          { begin: '%\\d+' },
          { begin: '#\\d+' },
        ]
      },
      {
        className: 'number',
        variants: [
            { begin: '0[xX][a-fA-F0-9]+' },
            { begin: '-?\\d+(?:[.]\\d+)?(?:[eE][-+]?\\d+(?:[.]\\d+)?)?' }
        ],
        relevance: 0
      },
    ]
  };
};

var lsl = function(hljs) {

    var LSL_STRING_ESCAPE_CHARS = {
        className: 'subst',
        begin: /\\[tn"\\]/
    };

    var LSL_STRINGS = {
        className: 'string',
        begin: '"',
        end: '"',
        contains: [
            LSL_STRING_ESCAPE_CHARS
        ]
    };

    var LSL_NUMBERS = {
        className: 'number',
        begin: hljs.C_NUMBER_RE
    };

    var LSL_CONSTANTS = {
        className: 'literal',
        variants: [
            {
                begin: '\\b(?:PI|TWO_PI|PI_BY_TWO|DEG_TO_RAD|RAD_TO_DEG|SQRT2)\\b'
            },
            {
                begin: '\\b(?:XP_ERROR_(?:EXPERIENCES_DISABLED|EXPERIENCE_(?:DISABLED|SUSPENDED)|INVALID_(?:EXPERIENCE|PARAMETERS)|KEY_NOT_FOUND|MATURITY_EXCEEDED|NONE|NOT_(?:FOUND|PERMITTED(?:_LAND)?)|NO_EXPERIENCE|QUOTA_EXCEEDED|RETRY_UPDATE|STORAGE_EXCEPTION|STORE_DISABLED|THROTTLED|UNKNOWN_ERROR)|JSON_APPEND|STATUS_(?:PHYSICS|ROTATE_[XYZ]|PHANTOM|SANDBOX|BLOCK_GRAB(?:_OBJECT)?|(?:DIE|RETURN)_AT_EDGE|CAST_SHADOWS|OK|MALFORMED_PARAMS|TYPE_MISMATCH|BOUNDS_ERROR|NOT_(?:FOUND|SUPPORTED)|INTERNAL_ERROR|WHITELIST_FAILED)|AGENT(?:_(?:BY_(?:LEGACY_|USER)NAME|FLYING|ATTACHMENTS|SCRIPTED|MOUSELOOK|SITTING|ON_OBJECT|AWAY|WALKING|IN_AIR|TYPING|CROUCHING|BUSY|ALWAYS_RUN|AUTOPILOT|LIST_(?:PARCEL(?:_OWNER)?|REGION)))?|CAMERA_(?:PITCH|DISTANCE|BEHINDNESS_(?:ANGLE|LAG)|(?:FOCUS|POSITION)(?:_(?:THRESHOLD|LOCKED|LAG))?|FOCUS_OFFSET|ACTIVE)|ANIM_ON|LOOP|REVERSE|PING_PONG|SMOOTH|ROTATE|SCALE|ALL_SIDES|LINK_(?:ROOT|SET|ALL_(?:OTHERS|CHILDREN)|THIS)|ACTIVE|PASS(?:IVE|_(?:ALWAYS|IF_NOT_HANDLED|NEVER))|SCRIPTED|CONTROL_(?:FWD|BACK|(?:ROT_)?(?:LEFT|RIGHT)|UP|DOWN|(?:ML_)?LBUTTON)|PERMISSION_(?:RETURN_OBJECTS|DEBIT|OVERRIDE_ANIMATIONS|SILENT_ESTATE_MANAGEMENT|TAKE_CONTROLS|TRIGGER_ANIMATION|ATTACH|CHANGE_LINKS|(?:CONTROL|TRACK)_CAMERA|TELEPORT)|INVENTORY_(?:TEXTURE|SOUND|OBJECT|SCRIPT|LANDMARK|CLOTHING|NOTECARD|BODYPART|ANIMATION|GESTURE|ALL|NONE)|CHANGED_(?:INVENTORY|COLOR|SHAPE|SCALE|TEXTURE|LINK|ALLOWED_DROP|OWNER|REGION(?:_START)?|TELEPORT|MEDIA)|OBJECT_(?:CLICK_ACTION|HOVER_HEIGHT|LAST_OWNER_ID|(?:PHYSICS|SERVER|STREAMING)_COST|UNKNOWN_DETAIL|CHARACTER_TIME|PHANTOM|PHYSICS|TEMP_ON_REZ|NAME|DESC|POS|PRIM_(?:COUNT|EQUIVALENCE)|RETURN_(?:PARCEL(?:_OWNER)?|REGION)|REZZER_KEY|ROO?T|VELOCITY|OMEGA|OWNER|GROUP|CREATOR|ATTACHED_POINT|RENDER_WEIGHT|(?:BODY_SHAPE|PATHFINDING)_TYPE|(?:RUNNING|TOTAL)_SCRIPT_COUNT|TOTAL_INVENTORY_COUNT|SCRIPT_(?:MEMORY|TIME))|TYPE_(?:INTEGER|FLOAT|STRING|KEY|VECTOR|ROTATION|INVALID)|(?:DEBUG|PUBLIC)_CHANNEL|ATTACH_(?:AVATAR_CENTER|CHEST|HEAD|BACK|PELVIS|MOUTH|CHIN|NECK|NOSE|BELLY|[LR](?:SHOULDER|HAND|FOOT|EAR|EYE|[UL](?:ARM|LEG)|HIP)|(?:LEFT|RIGHT)_PEC|HUD_(?:CENTER_[12]|TOP_(?:RIGHT|CENTER|LEFT)|BOTTOM(?:_(?:RIGHT|LEFT))?)|[LR]HAND_RING1|TAIL_(?:BASE|TIP)|[LR]WING|FACE_(?:JAW|[LR]EAR|[LR]EYE|TOUNGE)|GROIN|HIND_[LR]FOOT)|LAND_(?:LEVEL|RAISE|LOWER|SMOOTH|NOISE|REVERT)|DATA_(?:ONLINE|NAME|BORN|SIM_(?:POS|STATUS|RATING)|PAYINFO)|PAYMENT_INFO_(?:ON_FILE|USED)|REMOTE_DATA_(?:CHANNEL|REQUEST|REPLY)|PSYS_(?:PART_(?:BF_(?:ZERO|ONE(?:_MINUS_(?:DEST_COLOR|SOURCE_(ALPHA|COLOR)))?|DEST_COLOR|SOURCE_(ALPHA|COLOR))|BLEND_FUNC_(DEST|SOURCE)|FLAGS|(?:START|END)_(?:COLOR|ALPHA|SCALE|GLOW)|MAX_AGE|(?:RIBBON|WIND|INTERP_(?:COLOR|SCALE)|BOUNCE|FOLLOW_(?:SRC|VELOCITY)|TARGET_(?:POS|LINEAR)|EMISSIVE)_MASK)|SRC_(?:MAX_AGE|PATTERN|ANGLE_(?:BEGIN|END)|BURST_(?:RATE|PART_COUNT|RADIUS|SPEED_(?:MIN|MAX))|ACCEL|TEXTURE|TARGET_KEY|OMEGA|PATTERN_(?:DROP|EXPLODE|ANGLE(?:_CONE(?:_EMPTY)?)?)))|VEHICLE_(?:REFERENCE_FRAME|TYPE_(?:NONE|SLED|CAR|BOAT|AIRPLANE|BALLOON)|(?:LINEAR|ANGULAR)_(?:FRICTION_TIMESCALE|MOTOR_DIRECTION)|LINEAR_MOTOR_OFFSET|HOVER_(?:HEIGHT|EFFICIENCY|TIMESCALE)|BUOYANCY|(?:LINEAR|ANGULAR)_(?:DEFLECTION_(?:EFFICIENCY|TIMESCALE)|MOTOR_(?:DECAY_)?TIMESCALE)|VERTICAL_ATTRACTION_(?:EFFICIENCY|TIMESCALE)|BANKING_(?:EFFICIENCY|MIX|TIMESCALE)|FLAG_(?:NO_DEFLECTION_UP|LIMIT_(?:ROLL_ONLY|MOTOR_UP)|HOVER_(?:(?:WATER|TERRAIN|UP)_ONLY|GLOBAL_HEIGHT)|MOUSELOOK_(?:STEER|BANK)|CAMERA_DECOUPLED))|PRIM_(?:ALPHA_MODE(?:_(?:BLEND|EMISSIVE|MASK|NONE))?|NORMAL|SPECULAR|TYPE(?:_(?:BOX|CYLINDER|PRISM|SPHERE|TORUS|TUBE|RING|SCULPT))?|HOLE_(?:DEFAULT|CIRCLE|SQUARE|TRIANGLE)|MATERIAL(?:_(?:STONE|METAL|GLASS|WOOD|FLESH|PLASTIC|RUBBER))?|SHINY_(?:NONE|LOW|MEDIUM|HIGH)|BUMP_(?:NONE|BRIGHT|DARK|WOOD|BARK|BRICKS|CHECKER|CONCRETE|TILE|STONE|DISKS|GRAVEL|BLOBS|SIDING|LARGETILE|STUCCO|SUCTION|WEAVE)|TEXGEN_(?:DEFAULT|PLANAR)|SCULPT_(?:TYPE_(?:SPHERE|TORUS|PLANE|CYLINDER|MASK)|FLAG_(?:MIRROR|INVERT))|PHYSICS(?:_(?:SHAPE_(?:CONVEX|NONE|PRIM|TYPE)))?|(?:POS|ROT)_LOCAL|SLICE|TEXT|FLEXIBLE|POINT_LIGHT|TEMP_ON_REZ|PHANTOM|POSITION|SIZE|ROTATION|TEXTURE|NAME|OMEGA|DESC|LINK_TARGET|COLOR|BUMP_SHINY|FULLBRIGHT|TEXGEN|GLOW|MEDIA_(?:ALT_IMAGE_ENABLE|CONTROLS|(?:CURRENT|HOME)_URL|AUTO_(?:LOOP|PLAY|SCALE|ZOOM)|FIRST_CLICK_INTERACT|(?:WIDTH|HEIGHT)_PIXELS|WHITELIST(?:_ENABLE)?|PERMS_(?:INTERACT|CONTROL)|PARAM_MAX|CONTROLS_(?:STANDARD|MINI)|PERM_(?:NONE|OWNER|GROUP|ANYONE)|MAX_(?:URL_LENGTH|WHITELIST_(?:SIZE|COUNT)|(?:WIDTH|HEIGHT)_PIXELS)))|MASK_(?:BASE|OWNER|GROUP|EVERYONE|NEXT)|PERM_(?:TRANSFER|MODIFY|COPY|MOVE|ALL)|PARCEL_(?:MEDIA_COMMAND_(?:STOP|PAUSE|PLAY|LOOP|TEXTURE|URL|TIME|AGENT|UNLOAD|AUTO_ALIGN|TYPE|SIZE|DESC|LOOP_SET)|FLAG_(?:ALLOW_(?:FLY|(?:GROUP_)?SCRIPTS|LANDMARK|TERRAFORM|DAMAGE|CREATE_(?:GROUP_)?OBJECTS)|USE_(?:ACCESS_(?:GROUP|LIST)|BAN_LIST|LAND_PASS_LIST)|LOCAL_SOUND_ONLY|RESTRICT_PUSHOBJECT|ALLOW_(?:GROUP|ALL)_OBJECT_ENTRY)|COUNT_(?:TOTAL|OWNER|GROUP|OTHER|SELECTED|TEMP)|DETAILS_(?:NAME|DESC|OWNER|GROUP|AREA|ID|SEE_AVATARS))|LIST_STAT_(?:MAX|MIN|MEAN|MEDIAN|STD_DEV|SUM(?:_SQUARES)?|NUM_COUNT|GEOMETRIC_MEAN|RANGE)|PAY_(?:HIDE|DEFAULT)|REGION_FLAG_(?:ALLOW_DAMAGE|FIXED_SUN|BLOCK_TERRAFORM|SANDBOX|DISABLE_(?:COLLISIONS|PHYSICS)|BLOCK_FLY|ALLOW_DIRECT_TELEPORT|RESTRICT_PUSHOBJECT)|HTTP_(?:METHOD|MIMETYPE|BODY_(?:MAXLENGTH|TRUNCATED)|CUSTOM_HEADER|PRAGMA_NO_CACHE|VERBOSE_THROTTLE|VERIFY_CERT)|STRING_(?:TRIM(?:_(?:HEAD|TAIL))?)|CLICK_ACTION_(?:NONE|TOUCH|SIT|BUY|PAY|OPEN(?:_MEDIA)?|PLAY|ZOOM)|TOUCH_INVALID_FACE|PROFILE_(?:NONE|SCRIPT_MEMORY)|RC_(?:DATA_FLAGS|DETECT_PHANTOM|GET_(?:LINK_NUM|NORMAL|ROOT_KEY)|MAX_HITS|REJECT_(?:TYPES|AGENTS|(?:NON)?PHYSICAL|LAND))|RCERR_(?:CAST_TIME_EXCEEDED|SIM_PERF_LOW|UNKNOWN)|ESTATE_ACCESS_(?:ALLOWED_(?:AGENT|GROUP)_(?:ADD|REMOVE)|BANNED_AGENT_(?:ADD|REMOVE))|DENSITY|FRICTION|RESTITUTION|GRAVITY_MULTIPLIER|KFM_(?:COMMAND|CMD_(?:PLAY|STOP|PAUSE)|MODE|FORWARD|LOOP|PING_PONG|REVERSE|DATA|ROTATION|TRANSLATION)|ERR_(?:GENERIC|PARCEL_PERMISSIONS|MALFORMED_PARAMS|RUNTIME_PERMISSIONS|THROTTLED)|CHARACTER_(?:CMD_(?:(?:SMOOTH_)?STOP|JUMP)|DESIRED_(?:TURN_)?SPEED|RADIUS|STAY_WITHIN_PARCEL|LENGTH|ORIENTATION|ACCOUNT_FOR_SKIPPED_FRAMES|AVOIDANCE_MODE|TYPE(?:_(?:[ABCD]|NONE))?|MAX_(?:DECEL|TURN_RADIUS|(?:ACCEL|SPEED)))|PURSUIT_(?:OFFSET|FUZZ_FACTOR|GOAL_TOLERANCE|INTERCEPT)|REQUIRE_LINE_OF_SIGHT|FORCE_DIRECT_PATH|VERTICAL|HORIZONTAL|AVOID_(?:CHARACTERS|DYNAMIC_OBSTACLES|NONE)|PU_(?:EVADE_(?:HIDDEN|SPOTTED)|FAILURE_(?:DYNAMIC_PATHFINDING_DISABLED|INVALID_(?:GOAL|START)|NO_(?:NAVMESH|VALID_DESTINATION)|OTHER|TARGET_GONE|(?:PARCEL_)?UNREACHABLE)|(?:GOAL|SLOWDOWN_DISTANCE)_REACHED)|TRAVERSAL_TYPE(?:_(?:FAST|NONE|SLOW))?|CONTENT_TYPE_(?:ATOM|FORM|HTML|JSON|LLSD|RSS|TEXT|XHTML|XML)|GCNP_(?:RADIUS|STATIC)|(?:PATROL|WANDER)_PAUSE_AT_WAYPOINTS|OPT_(?:AVATAR|CHARACTER|EXCLUSION_VOLUME|LEGACY_LINKSET|MATERIAL_VOLUME|OTHER|STATIC_OBSTACLE|WALKABLE)|SIM_STAT_PCT_CHARS_STEPPED)\\b'
            },
            {
                begin: '\\b(?:FALSE|TRUE)\\b'
            },
            {
                begin: '\\b(?:ZERO_ROTATION)\\b'
            },
            {
                begin: '\\b(?:EOF|JSON_(?:ARRAY|DELETE|FALSE|INVALID|NULL|NUMBER|OBJECT|STRING|TRUE)|NULL_KEY|TEXTURE_(?:BLANK|DEFAULT|MEDIA|PLYWOOD|TRANSPARENT)|URL_REQUEST_(?:GRANTED|DENIED))\\b'
            },
            {
                begin: '\\b(?:ZERO_VECTOR|TOUCH_INVALID_(?:TEXCOORD|VECTOR))\\b'
            }
        ]
    };

    var LSL_FUNCTIONS = {
        className: 'built_in',
        begin: '\\b(?:ll(?:AgentInExperience|(?:Create|DataSize|Delete|KeyCount|Keys|Read|Update)KeyValue|GetExperience(?:Details|ErrorMessage)|ReturnObjectsBy(?:ID|Owner)|Json(?:2List|[GS]etValue|ValueType)|Sin|Cos|Tan|Atan2|Sqrt|Pow|Abs|Fabs|Frand|Floor|Ceil|Round|Vec(?:Mag|Norm|Dist)|Rot(?:Between|2(?:Euler|Fwd|Left|Up))|(?:Euler|Axes)2Rot|Whisper|(?:Region|Owner)?Say|Shout|Listen(?:Control|Remove)?|Sensor(?:Repeat|Remove)?|Detected(?:Name|Key|Owner|Type|Pos|Vel|Grab|Rot|Group|LinkNumber)|Die|Ground|Wind|(?:[GS]et)(?:AnimationOverride|MemoryLimit|PrimMediaParams|ParcelMusicURL|Object(?:Desc|Name)|PhysicsMaterial|Status|Scale|Color|Alpha|Texture|Pos|Rot|Force|Torque)|ResetAnimationOverride|(?:Scale|Offset|Rotate)Texture|(?:Rot)?Target(?:Remove)?|(?:Stop)?MoveToTarget|Apply(?:Rotational)?Impulse|Set(?:KeyframedMotion|ContentType|RegionPos|(?:Angular)?Velocity|Buoyancy|HoverHeight|ForceAndTorque|TimerEvent|ScriptState|Damage|TextureAnim|Sound(?:Queueing|Radius)|Vehicle(?:Type|(?:Float|Vector|Rotation)Param)|(?:Touch|Sit)?Text|Camera(?:Eye|At)Offset|PrimitiveParams|ClickAction|Link(?:Alpha|Color|PrimitiveParams(?:Fast)?|Texture(?:Anim)?|Camera|Media)|RemoteScriptAccessPin|PayPrice|LocalRot)|ScaleByFactor|Get(?:(?:Max|Min)ScaleFactor|ClosestNavPoint|StaticPath|SimStats|Env|PrimitiveParams|Link(?:PrimitiveParams|Number(?:OfSides)?|Key|Name|Media)|HTTPHeader|FreeURLs|Object(?:Details|PermMask|PrimCount)|Parcel(?:MaxPrims|Details|Prim(?:Count|Owners))|Attached(?:List)?|(?:SPMax|Free|Used)Memory|Region(?:Name|TimeDilation|FPS|Corner|AgentCount)|Root(?:Position|Rotation)|UnixTime|(?:Parcel|Region)Flags|(?:Wall|GMT)clock|SimulatorHostname|BoundingBox|GeometricCenter|Creator|NumberOf(?:Prims|NotecardLines|Sides)|Animation(?:List)?|(?:Camera|Local)(?:Pos|Rot)|Vel|Accel|Omega|Time(?:stamp|OfDay)|(?:Object|CenterOf)?Mass|MassMKS|Energy|Owner|(?:Owner)?Key|SunDirection|Texture(?:Offset|Scale|Rot)|Inventory(?:Number|Name|Key|Type|Creator|PermMask)|Permissions(?:Key)?|StartParameter|List(?:Length|EntryType)|Date|Agent(?:Size|Info|Language|List)|LandOwnerAt|NotecardLine|Script(?:Name|State))|(?:Get|Reset|GetAndReset)Time|PlaySound(?:Slave)?|LoopSound(?:Master|Slave)?|(?:Trigger|Stop|Preload)Sound|(?:(?:Get|Delete)Sub|Insert)String|To(?:Upper|Lower)|Give(?:InventoryList|Money)|RezObject|(?:Stop)?LookAt|Sleep|CollisionFilter|(?:Take|Release)Controls|DetachFromAvatar|AttachToAvatar(?:Temp)?|InstantMessage|(?:GetNext)?Email|StopHover|MinEventDelay|RotLookAt|String(?:Length|Trim)|(?:Start|Stop)Animation|TargetOmega|Request(?:Experience)?Permissions|(?:Create|Break)Link|BreakAllLinks|(?:Give|Remove)Inventory|Water|PassTouches|Request(?:Agent|Inventory)Data|TeleportAgent(?:Home|GlobalCoords)?|ModifyLand|CollisionSound|ResetScript|MessageLinked|PushObject|PassCollisions|AxisAngle2Rot|Rot2(?:Axis|Angle)|A(?:cos|sin)|AngleBetween|AllowInventoryDrop|SubStringIndex|List2(?:CSV|Integer|Json|Float|String|Key|Vector|Rot|List(?:Strided)?)|DeleteSubList|List(?:Statistics|Sort|Randomize|(?:Insert|Find|Replace)List)|EdgeOfWorld|AdjustSoundVolume|Key2Name|TriggerSoundLimited|EjectFromLand|(?:CSV|ParseString)2List|OverMyLand|SameGroup|UnSit|Ground(?:Slope|Normal|Contour)|GroundRepel|(?:Set|Remove)VehicleFlags|(?:AvatarOn)?(?:Link)?SitTarget|Script(?:Danger|Profiler)|Dialog|VolumeDetect|ResetOtherScript|RemoteLoadScriptPin|(?:Open|Close)RemoteDataChannel|SendRemoteData|RemoteDataReply|(?:Integer|String)ToBase64|XorBase64|Log(?:10)?|Base64To(?:String|Integer)|ParseStringKeepNulls|RezAtRoot|RequestSimulatorData|ForceMouselook|(?:Load|Release|(?:E|Une)scape)URL|ParcelMedia(?:CommandList|Query)|ModPow|MapDestination|(?:RemoveFrom|AddTo|Reset)Land(?:Pass|Ban)List|(?:Set|Clear)CameraParams|HTTP(?:Request|Response)|TextBox|DetectedTouch(?:UV|Face|Pos|(?:N|Bin)ormal|ST)|(?:MD5|SHA1|DumpList2)String|Request(?:Secure)?URL|Clear(?:Prim|Link)Media|(?:Link)?ParticleSystem|(?:Get|Request)(?:Username|DisplayName)|RegionSayTo|CastRay|GenerateKey|TransferLindenDollars|ManageEstateAccess|(?:Create|Delete)Character|ExecCharacterCmd|Evade|FleeFrom|NavigateTo|PatrolPoints|Pursue|UpdateCharacter|WanderWithin))\\b'
    };

    return {
        illegal: ':',
        contains: [
            LSL_STRINGS,
            {
                className: 'comment',
                variants: [
                    hljs.COMMENT('//', '$'),
                    hljs.COMMENT('/\\*', '\\*/')
                ]
            },
            LSL_NUMBERS,
            {
                className: 'section',
                variants: [
                    {
                        begin: '\\b(?:state|default)\\b'
                    },
                    {
                        begin: '\\b(?:state_(?:entry|exit)|touch(?:_(?:start|end))?|(?:land_)?collision(?:_(?:start|end))?|timer|listen|(?:no_)?sensor|control|(?:not_)?at_(?:rot_)?target|money|email|experience_permissions(?:_denied)?|run_time_permissions|changed|attach|dataserver|moving_(?:start|end)|link_message|(?:on|object)_rez|remote_data|http_re(?:sponse|quest)|path_update|transaction_result)\\b'
                    }
                ]
            },
            LSL_FUNCTIONS,
            LSL_CONSTANTS,
            {
                className: 'type',
                begin: '\\b(?:integer|float|string|key|vector|quaternion|rotation|list)\\b'
            }
        ]
    };
};

var lua = function(hljs) {
  var OPENING_LONG_BRACKET = '\\[=*\\[';
  var CLOSING_LONG_BRACKET = '\\]=*\\]';
  var LONG_BRACKETS = {
    begin: OPENING_LONG_BRACKET, end: CLOSING_LONG_BRACKET,
    contains: ['self']
  };
  var COMMENTS = [
    hljs.COMMENT('--(?!' + OPENING_LONG_BRACKET + ')', '$'),
    hljs.COMMENT(
      '--' + OPENING_LONG_BRACKET,
      CLOSING_LONG_BRACKET,
      {
        contains: [LONG_BRACKETS],
        relevance: 10
      }
    )
  ];
  return {
    lexemes: hljs.UNDERSCORE_IDENT_RE,
    keywords: {
      literal: "true false nil",
      keyword: "and break do else elseif end for goto if in local not or repeat return then until while",
      built_in:
        //Metatags and globals:
        '_G _ENV _VERSION __index __newindex __mode __call __metatable __tostring __len ' +
        '__gc __add __sub __mul __div __mod __pow __concat __unm __eq __lt __le assert ' +
        //Standard methods and properties:
        'collectgarbage dofile error getfenv getmetatable ipairs load loadfile loadstring' +
        'module next pairs pcall print rawequal rawget rawset require select setfenv' +
        'setmetatable tonumber tostring type unpack xpcall arg self' +
        //Library methods and properties (one line per library):
        'coroutine resume yield status wrap create running debug getupvalue ' +
        'debug sethook getmetatable gethook setmetatable setlocal traceback setfenv getinfo setupvalue getlocal getregistry getfenv ' +
        'io lines write close flush open output type read stderr stdin input stdout popen tmpfile ' +
        'math log max acos huge ldexp pi cos tanh pow deg tan cosh sinh random randomseed frexp ceil floor rad abs sqrt modf asin min mod fmod log10 atan2 exp sin atan ' +
        'os exit setlocale date getenv difftime remove time clock tmpname rename execute package preload loadlib loaded loaders cpath config path seeall ' +
        'string sub upper len gfind rep find match char dump gmatch reverse byte format gsub lower ' +
        'table setn insert getn foreachi maxn foreach concat sort remove'
    },
    contains: COMMENTS.concat([
      {
        className: 'function',
        beginKeywords: 'function', end: '\\)',
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {begin: '([_a-zA-Z]\\w*\\.)*([_a-zA-Z]\\w*:)?[_a-zA-Z]\\w*'}),
          {
            className: 'params',
            begin: '\\(', endsWithParent: true,
            contains: COMMENTS
          }
        ].concat(COMMENTS)
      },
      hljs.C_NUMBER_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        begin: OPENING_LONG_BRACKET, end: CLOSING_LONG_BRACKET,
        contains: [LONG_BRACKETS],
        relevance: 5
      }
    ])
  };
};

var makefile = function(hljs) {
  /* Variables: simple (eg $(var)) and special (eg $@) */
  var VARIABLE = {
    className: 'variable',
    variants: [
      {
        begin: '\\$\\(' + hljs.UNDERSCORE_IDENT_RE + '\\)',
        contains: [hljs.BACKSLASH_ESCAPE],
      },
      {
        begin: /\$[@%<?\^\+\*]/
      },
    ]
  };
  /* Quoted string with variables inside */
  var QUOTE_STRING = {
    className: 'string',
    begin: /"/, end: /"/,
    contains: [
      hljs.BACKSLASH_ESCAPE,
      VARIABLE,
    ]
  };
  /* Function: $(func arg,...) */
  var FUNC = {
    className: 'variable',
    begin: /\$\([\w-]+\s/, end: /\)/,
    keywords: {
      built_in:
        'subst patsubst strip findstring filter filter-out sort ' +
        'word wordlist firstword lastword dir notdir suffix basename ' +
        'addsuffix addprefix join wildcard realpath abspath error warning ' +
        'shell origin flavor foreach if or and call eval file value',
    },
    contains: [
      VARIABLE,
    ]
  };
  /* Variable assignment */
  var VAR_ASSIG = {
    begin: '^' + hljs.UNDERSCORE_IDENT_RE + '\\s*[:+?]?=',
    illegal: '\\n',
    returnBegin: true,
    contains: [
      {
        begin: '^' + hljs.UNDERSCORE_IDENT_RE, end: '[:+?]?=',
        excludeEnd: true,
      }
    ]
  };
  /* Meta targets (.PHONY) */
  var META = {
    className: 'meta',
    begin: /^\.PHONY:/, end: /$/,
    keywords: {'meta-keyword': '.PHONY'},
    lexemes: /[\.\w]+/
  };
  /* Targets */
  var TARGET = {
    className: 'section',
    begin: /^[^\s]+:/, end: /$/,
    contains: [VARIABLE,]
  };
  return {
    aliases: ['mk', 'mak'],
    keywords:
      'define endef undefine ifdef ifndef ifeq ifneq else endif ' +
      'include -include sinclude override export unexport private vpath',
    lexemes: /[\w-]+/,
    contains: [
      hljs.HASH_COMMENT_MODE,
      VARIABLE,
      QUOTE_STRING,
      FUNC,
      VAR_ASSIG,
      META,
      TARGET,
    ]
  };
};

var mathematica = function(hljs) {
  return {
    aliases: ['mma'],
    lexemes: '(\\$|\\b)' + hljs.IDENT_RE + '\\b',
    keywords: 'AbelianGroup Abort AbortKernels AbortProtect Above Abs Absolute AbsoluteCorrelation AbsoluteCorrelationFunction AbsoluteCurrentValue AbsoluteDashing AbsoluteFileName AbsoluteOptions AbsolutePointSize AbsoluteThickness AbsoluteTime AbsoluteTiming AccountingForm Accumulate Accuracy AccuracyGoal ActionDelay ActionMenu ActionMenuBox ActionMenuBoxOptions Active ActiveItem ActiveStyle AcyclicGraphQ AddOnHelpPath AddTo AdjacencyGraph AdjacencyList AdjacencyMatrix AdjustmentBox AdjustmentBoxOptions AdjustTimeSeriesForecast AffineTransform After AiryAi AiryAiPrime AiryAiZero AiryBi AiryBiPrime AiryBiZero AlgebraicIntegerQ AlgebraicNumber AlgebraicNumberDenominator AlgebraicNumberNorm AlgebraicNumberPolynomial AlgebraicNumberTrace AlgebraicRules AlgebraicRulesData Algebraics AlgebraicUnitQ Alignment AlignmentMarker AlignmentPoint All AllowedDimensions AllowGroupClose AllowInlineCells AllowKernelInitialization AllowReverseGroupClose AllowScriptLevelChange AlphaChannel AlternatingGroup AlternativeHypothesis Alternatives AmbientLight Analytic AnchoredSearch And AndersonDarlingTest AngerJ AngleBracket AngularGauge Animate AnimationCycleOffset AnimationCycleRepetitions AnimationDirection AnimationDisplayTime AnimationRate AnimationRepetitions AnimationRunning Animator AnimatorBox AnimatorBoxOptions AnimatorElements Annotation Annuity AnnuityDue Antialiasing Antisymmetric Apart ApartSquareFree Appearance AppearanceElements AppellF1 Append AppendTo Apply ArcCos ArcCosh ArcCot ArcCoth ArcCsc ArcCsch ArcSec ArcSech ArcSin ArcSinDistribution ArcSinh ArcTan ArcTanh Arg ArgMax ArgMin ArgumentCountQ ARIMAProcess ArithmeticGeometricMean ARMAProcess ARProcess Array ArrayComponents ArrayDepth ArrayFlatten ArrayPad ArrayPlot ArrayQ ArrayReshape ArrayRules Arrays Arrow Arrow3DBox ArrowBox Arrowheads AspectRatio AspectRatioFixed Assert Assuming Assumptions AstronomicalData Asynchronous AsynchronousTaskObject AsynchronousTasks AtomQ Attributes AugmentedSymmetricPolynomial AutoAction AutoDelete AutoEvaluateEvents AutoGeneratedPackage AutoIndent AutoIndentSpacings AutoItalicWords AutoloadPath AutoMatch Automatic AutomaticImageSize AutoMultiplicationSymbol AutoNumberFormatting AutoOpenNotebooks AutoOpenPalettes AutorunSequencing AutoScaling AutoScroll AutoSpacing AutoStyleOptions AutoStyleWords Axes AxesEdge AxesLabel AxesOrigin AxesStyle Axis ' +
      'BabyMonsterGroupB Back Background BackgroundTasksSettings Backslash Backsubstitution Backward Band BandpassFilter BandstopFilter BarabasiAlbertGraphDistribution BarChart BarChart3D BarLegend BarlowProschanImportance BarnesG BarOrigin BarSpacing BartlettHannWindow BartlettWindow BaseForm Baseline BaselinePosition BaseStyle BatesDistribution BattleLemarieWavelet Because BeckmannDistribution Beep Before Begin BeginDialogPacket BeginFrontEndInteractionPacket BeginPackage BellB BellY Below BenfordDistribution BeniniDistribution BenktanderGibratDistribution BenktanderWeibullDistribution BernoulliB BernoulliDistribution BernoulliGraphDistribution BernoulliProcess BernsteinBasis BesselFilterModel BesselI BesselJ BesselJZero BesselK BesselY BesselYZero Beta BetaBinomialDistribution BetaDistribution BetaNegativeBinomialDistribution BetaPrimeDistribution BetaRegularized BetweennessCentrality BezierCurve BezierCurve3DBox BezierCurve3DBoxOptions BezierCurveBox BezierCurveBoxOptions BezierFunction BilateralFilter Binarize BinaryFormat BinaryImageQ BinaryRead BinaryReadList BinaryWrite BinCounts BinLists Binomial BinomialDistribution BinomialProcess BinormalDistribution BiorthogonalSplineWavelet BipartiteGraphQ BirnbaumImportance BirnbaumSaundersDistribution BitAnd BitClear BitGet BitLength BitNot BitOr BitSet BitShiftLeft BitShiftRight BitXor Black BlackmanHarrisWindow BlackmanNuttallWindow BlackmanWindow Blank BlankForm BlankNullSequence BlankSequence Blend Block BlockRandom BlomqvistBeta BlomqvistBetaTest Blue Blur BodePlot BohmanWindow Bold Bookmarks Boole BooleanConsecutiveFunction BooleanConvert BooleanCountingFunction BooleanFunction BooleanGraph BooleanMaxterms BooleanMinimize BooleanMinterms Booleans BooleanTable BooleanVariables BorderDimensions BorelTannerDistribution Bottom BottomHatTransform BoundaryStyle Bounds Box BoxBaselineShift BoxData BoxDimensions Boxed Boxes BoxForm BoxFormFormatTypes BoxFrame BoxID BoxMargins BoxMatrix BoxRatios BoxRotation BoxRotationPoint BoxStyle BoxWhiskerChart Bra BracketingBar BraKet BrayCurtisDistance BreadthFirstScan Break Brown BrownForsytheTest BrownianBridgeProcess BrowserCategory BSplineBasis BSplineCurve BSplineCurve3DBox BSplineCurveBox BSplineCurveBoxOptions BSplineFunction BSplineSurface BSplineSurface3DBox BubbleChart BubbleChart3D BubbleScale BubbleSizes BulletGauge BusinessDayQ ButterflyGraph ButterworthFilterModel Button ButtonBar ButtonBox ButtonBoxOptions ButtonCell ButtonContents ButtonData ButtonEvaluator ButtonExpandable ButtonFrame ButtonFunction ButtonMargins ButtonMinHeight ButtonNote ButtonNotebook ButtonSource ButtonStyle ButtonStyleMenuListing Byte ByteCount ByteOrdering ' +
      'C CachedValue CacheGraphics CalendarData CalendarType CallPacket CanberraDistance Cancel CancelButton CandlestickChart Cap CapForm CapitalDifferentialD CardinalBSplineBasis CarmichaelLambda Cases Cashflow Casoratian Catalan CatalanNumber Catch CauchyDistribution CauchyWindow CayleyGraph CDF CDFDeploy CDFInformation CDFWavelet Ceiling Cell CellAutoOverwrite CellBaseline CellBoundingBox CellBracketOptions CellChangeTimes CellContents CellContext CellDingbat CellDynamicExpression CellEditDuplicate CellElementsBoundingBox CellElementSpacings CellEpilog CellEvaluationDuplicate CellEvaluationFunction CellEventActions CellFrame CellFrameColor CellFrameLabelMargins CellFrameLabels CellFrameMargins CellGroup CellGroupData CellGrouping CellGroupingRules CellHorizontalScrolling CellID CellLabel CellLabelAutoDelete CellLabelMargins CellLabelPositioning CellMargins CellObject CellOpen CellPrint CellProlog Cells CellSize CellStyle CellTags CellularAutomaton CensoredDistribution Censoring Center CenterDot CentralMoment CentralMomentGeneratingFunction CForm ChampernowneNumber ChanVeseBinarize Character CharacterEncoding CharacterEncodingsPath CharacteristicFunction CharacteristicPolynomial CharacterRange Characters ChartBaseStyle ChartElementData ChartElementDataFunction ChartElementFunction ChartElements ChartLabels ChartLayout ChartLegends ChartStyle Chebyshev1FilterModel Chebyshev2FilterModel ChebyshevDistance ChebyshevT ChebyshevU Check CheckAbort CheckAll Checkbox CheckboxBar CheckboxBox CheckboxBoxOptions ChemicalData ChessboardDistance ChiDistribution ChineseRemainder ChiSquareDistribution ChoiceButtons ChoiceDialog CholeskyDecomposition Chop Circle CircleBox CircleDot CircleMinus CirclePlus CircleTimes CirculantGraph CityData Clear ClearAll ClearAttributes ClearSystemCache ClebschGordan ClickPane Clip ClipboardNotebook ClipFill ClippingStyle ClipPlanes ClipRange Clock ClockGauge ClockwiseContourIntegral Close Closed CloseKernels ClosenessCentrality Closing ClosingAutoSave ClosingEvent ClusteringComponents CMYKColor Coarse Coefficient CoefficientArrays CoefficientDomain CoefficientList CoefficientRules CoifletWavelet Collect Colon ColonForm ColorCombine ColorConvert ColorData ColorDataFunction ColorFunction ColorFunctionScaling Colorize ColorNegate ColorOutput ColorProfileData ColorQuantize ColorReplace ColorRules ColorSelectorSettings ColorSeparate ColorSetter ColorSetterBox ColorSetterBoxOptions ColorSlider ColorSpace Column ColumnAlignments ColumnBackgrounds ColumnForm ColumnLines ColumnsEqual ColumnSpacings ColumnWidths CommonDefaultFormatTypes Commonest CommonestFilter CommonUnits CommunityBoundaryStyle CommunityGraphPlot CommunityLabels CommunityRegionStyle CompatibleUnitQ CompilationOptions CompilationTarget Compile Compiled CompiledFunction Complement CompleteGraph CompleteGraphQ CompleteKaryTree CompletionsListPacket Complex Complexes ComplexExpand ComplexInfinity ComplexityFunction ComponentMeasurements ' +
      'ComponentwiseContextMenu Compose ComposeList ComposeSeries Composition CompoundExpression CompoundPoissonDistribution CompoundPoissonProcess CompoundRenewalProcess Compress CompressedData Condition ConditionalExpression Conditioned Cone ConeBox ConfidenceLevel ConfidenceRange ConfidenceTransform ConfigurationPath Congruent Conjugate ConjugateTranspose Conjunction Connect ConnectedComponents ConnectedGraphQ ConnesWindow ConoverTest ConsoleMessage ConsoleMessagePacket ConsolePrint Constant ConstantArray Constants ConstrainedMax ConstrainedMin ContentPadding ContentsBoundingBox ContentSelectable ContentSize Context ContextMenu Contexts ContextToFilename ContextToFileName Continuation Continue ContinuedFraction ContinuedFractionK ContinuousAction ContinuousMarkovProcess ContinuousTimeModelQ ContinuousWaveletData ContinuousWaveletTransform ContourDetect ContourGraphics ContourIntegral ContourLabels ContourLines ContourPlot ContourPlot3D Contours ContourShading ContourSmoothing ContourStyle ContraharmonicMean Control ControlActive ControlAlignment ControllabilityGramian ControllabilityMatrix ControllableDecomposition ControllableModelQ ControllerDuration ControllerInformation ControllerInformationData ControllerLinking ControllerManipulate ControllerMethod ControllerPath ControllerState ControlPlacement ControlsRendering ControlType Convergents ConversionOptions ConversionRules ConvertToBitmapPacket ConvertToPostScript ConvertToPostScriptPacket Convolve ConwayGroupCo1 ConwayGroupCo2 ConwayGroupCo3 CoordinateChartData CoordinatesToolOptions CoordinateTransform CoordinateTransformData CoprimeQ Coproduct CopulaDistribution Copyable CopyDirectory CopyFile CopyTag CopyToClipboard CornerFilter CornerNeighbors Correlation CorrelationDistance CorrelationFunction CorrelationTest Cos Cosh CoshIntegral CosineDistance CosineWindow CosIntegral Cot Coth Count CounterAssignments CounterBox CounterBoxOptions CounterClockwiseContourIntegral CounterEvaluator CounterFunction CounterIncrements CounterStyle CounterStyleMenuListing CountRoots CountryData Covariance CovarianceEstimatorFunction CovarianceFunction CoxianDistribution CoxIngersollRossProcess CoxModel CoxModelFit CramerVonMisesTest CreateArchive CreateDialog CreateDirectory CreateDocument CreateIntermediateDirectories CreatePalette CreatePalettePacket CreateScheduledTask CreateTemporary CreateWindow CriticalityFailureImportance CriticalitySuccessImportance CriticalSection Cross CrossingDetect CrossMatrix Csc Csch CubeRoot Cubics Cuboid CuboidBox Cumulant CumulantGeneratingFunction Cup CupCap Curl CurlyDoubleQuote CurlyQuote CurrentImage CurrentlySpeakingPacket CurrentValue CurvatureFlowFilter CurveClosed Cyan CycleGraph CycleIndexPolynomial Cycles CyclicGroup Cyclotomic Cylinder CylinderBox CylindricalDecomposition ' +
      'D DagumDistribution DamerauLevenshteinDistance DampingFactor Darker Dashed Dashing DataCompression DataDistribution DataRange DataReversed Date DateDelimiters DateDifference DateFunction DateList DateListLogPlot DateListPlot DatePattern DatePlus DateRange DateString DateTicksFormat DaubechiesWavelet DavisDistribution DawsonF DayCount DayCountConvention DayMatchQ DayName DayPlus DayRange DayRound DeBruijnGraph Debug DebugTag Decimal DeclareKnownSymbols DeclarePackage Decompose Decrement DedekindEta Default DefaultAxesStyle DefaultBaseStyle DefaultBoxStyle DefaultButton DefaultColor DefaultControlPlacement DefaultDuplicateCellStyle DefaultDuration DefaultElement DefaultFaceGridsStyle DefaultFieldHintStyle DefaultFont DefaultFontProperties DefaultFormatType DefaultFormatTypeForStyle DefaultFrameStyle DefaultFrameTicksStyle DefaultGridLinesStyle DefaultInlineFormatType DefaultInputFormatType DefaultLabelStyle DefaultMenuStyle DefaultNaturalLanguage DefaultNewCellStyle DefaultNewInlineCellStyle DefaultNotebook DefaultOptions DefaultOutputFormatType DefaultStyle DefaultStyleDefinitions DefaultTextFormatType DefaultTextInlineFormatType DefaultTicksStyle DefaultTooltipStyle DefaultValues Defer DefineExternal DefineInputStreamMethod DefineOutputStreamMethod Definition Degree DegreeCentrality DegreeGraphDistribution DegreeLexicographic DegreeReverseLexicographic Deinitialization Del Deletable Delete DeleteBorderComponents DeleteCases DeleteContents DeleteDirectory DeleteDuplicates DeleteFile DeleteSmallComponents DeleteWithContents DeletionWarning Delimiter DelimiterFlashTime DelimiterMatching Delimiters Denominator DensityGraphics DensityHistogram DensityPlot DependentVariables Deploy Deployed Depth DepthFirstScan Derivative DerivativeFilter DescriptorStateSpace DesignMatrix Det DGaussianWavelet DiacriticalPositioning Diagonal DiagonalMatrix Dialog DialogIndent DialogInput DialogLevel DialogNotebook DialogProlog DialogReturn DialogSymbols Diamond DiamondMatrix DiceDissimilarity DictionaryLookup DifferenceDelta DifferenceOrder DifferenceRoot DifferenceRootReduce Differences DifferentialD DifferentialRoot DifferentialRootReduce DifferentiatorFilter DigitBlock DigitBlockMinimum DigitCharacter DigitCount DigitQ DihedralGroup Dilation Dimensions DiracComb DiracDelta DirectedEdge DirectedEdges DirectedGraph DirectedGraphQ DirectedInfinity Direction Directive Directory DirectoryName DirectoryQ DirectoryStack DirichletCharacter DirichletConvolve DirichletDistribution DirichletL DirichletTransform DirichletWindow DisableConsolePrintPacket DiscreteChirpZTransform DiscreteConvolve DiscreteDelta DiscreteHadamardTransform DiscreteIndicator DiscreteLQEstimatorGains DiscreteLQRegulatorGains DiscreteLyapunovSolve DiscreteMarkovProcess DiscretePlot DiscretePlot3D DiscreteRatio DiscreteRiccatiSolve DiscreteShift DiscreteTimeModelQ DiscreteUniformDistribution DiscreteVariables DiscreteWaveletData DiscreteWaveletPacketTransform ' +
      'DiscreteWaveletTransform Discriminant Disjunction Disk DiskBox DiskMatrix Dispatch DispersionEstimatorFunction Display DisplayAllSteps DisplayEndPacket DisplayFlushImagePacket DisplayForm DisplayFunction DisplayPacket DisplayRules DisplaySetSizePacket DisplayString DisplayTemporary DisplayWith DisplayWithRef DisplayWithVariable DistanceFunction DistanceTransform Distribute Distributed DistributedContexts DistributeDefinitions DistributionChart DistributionDomain DistributionFitTest DistributionParameterAssumptions DistributionParameterQ Dithering Div Divergence Divide DivideBy Dividers Divisible Divisors DivisorSigma DivisorSum DMSList DMSString Do DockedCells DocumentNotebook DominantColors DOSTextFormat Dot DotDashed DotEqual Dotted DoubleBracketingBar DoubleContourIntegral DoubleDownArrow DoubleLeftArrow DoubleLeftRightArrow DoubleLeftTee DoubleLongLeftArrow DoubleLongLeftRightArrow DoubleLongRightArrow DoubleRightArrow DoubleRightTee DoubleUpArrow DoubleUpDownArrow DoubleVerticalBar DoublyInfinite Down DownArrow DownArrowBar DownArrowUpArrow DownLeftRightVector DownLeftTeeVector DownLeftVector DownLeftVectorBar DownRightTeeVector DownRightVector DownRightVectorBar Downsample DownTee DownTeeArrow DownValues DragAndDrop DrawEdges DrawFrontFaces DrawHighlighted Drop DSolve Dt DualLinearProgramming DualSystemsModel DumpGet DumpSave DuplicateFreeQ Dynamic DynamicBox DynamicBoxOptions DynamicEvaluationTimeout DynamicLocation DynamicModule DynamicModuleBox DynamicModuleBoxOptions DynamicModuleParent DynamicModuleValues DynamicName DynamicNamespace DynamicReference DynamicSetting DynamicUpdating DynamicWrapper DynamicWrapperBox DynamicWrapperBoxOptions ' +
      'E EccentricityCentrality EdgeAdd EdgeBetweennessCentrality EdgeCapacity EdgeCapForm EdgeColor EdgeConnectivity EdgeCost EdgeCount EdgeCoverQ EdgeDashing EdgeDelete EdgeDetect EdgeForm EdgeIndex EdgeJoinForm EdgeLabeling EdgeLabels EdgeLabelStyle EdgeList EdgeOpacity EdgeQ EdgeRenderingFunction EdgeRules EdgeShapeFunction EdgeStyle EdgeThickness EdgeWeight Editable EditButtonSettings EditCellTagsSettings EditDistance EffectiveInterest Eigensystem Eigenvalues EigenvectorCentrality Eigenvectors Element ElementData Eliminate EliminationOrder EllipticE EllipticExp EllipticExpPrime EllipticF EllipticFilterModel EllipticK EllipticLog EllipticNomeQ EllipticPi EllipticReducedHalfPeriods EllipticTheta EllipticThetaPrime EmitSound EmphasizeSyntaxErrors EmpiricalDistribution Empty EmptyGraphQ EnableConsolePrintPacket Enabled Encode End EndAdd EndDialogPacket EndFrontEndInteractionPacket EndOfFile EndOfLine EndOfString EndPackage EngineeringForm Enter EnterExpressionPacket EnterTextPacket Entropy EntropyFilter Environment Epilog Equal EqualColumns EqualRows EqualTilde EquatedTo Equilibrium EquirippleFilterKernel Equivalent Erf Erfc Erfi ErlangB ErlangC ErlangDistribution Erosion ErrorBox ErrorBoxOptions ErrorNorm ErrorPacket ErrorsDialogSettings EstimatedDistribution EstimatedProcess EstimatorGains EstimatorRegulator EuclideanDistance EulerE EulerGamma EulerianGraphQ EulerPhi Evaluatable Evaluate Evaluated EvaluatePacket EvaluationCell EvaluationCompletionAction EvaluationElements EvaluationMode EvaluationMonitor EvaluationNotebook EvaluationObject EvaluationOrder Evaluator EvaluatorNames EvenQ EventData EventEvaluator EventHandler EventHandlerTag EventLabels ExactBlackmanWindow ExactNumberQ ExactRootIsolation ExampleData Except ExcludedForms ExcludePods Exclusions ExclusionsStyle Exists Exit ExitDialog Exp Expand ExpandAll ExpandDenominator ExpandFileName ExpandNumerator Expectation ExpectationE ExpectedValue ExpGammaDistribution ExpIntegralE ExpIntegralEi Exponent ExponentFunction ExponentialDistribution ExponentialFamily ExponentialGeneratingFunction ExponentialMovingAverage ExponentialPowerDistribution ExponentPosition ExponentStep Export ExportAutoReplacements ExportPacket ExportString Expression ExpressionCell ExpressionPacket ExpToTrig ExtendedGCD Extension ExtentElementFunction ExtentMarkers ExtentSize ExternalCall ExternalDataCharacterEncoding Extract ExtractArchive ExtremeValueDistribution ' +
      'FaceForm FaceGrids FaceGridsStyle Factor FactorComplete Factorial Factorial2 FactorialMoment FactorialMomentGeneratingFunction FactorialPower FactorInteger FactorList FactorSquareFree FactorSquareFreeList FactorTerms FactorTermsList Fail FailureDistribution False FARIMAProcess FEDisableConsolePrintPacket FeedbackSector FeedbackSectorStyle FeedbackType FEEnableConsolePrintPacket Fibonacci FieldHint FieldHintStyle FieldMasked FieldSize File FileBaseName FileByteCount FileDate FileExistsQ FileExtension FileFormat FileHash FileInformation FileName FileNameDepth FileNameDialogSettings FileNameDrop FileNameJoin FileNames FileNameSetter FileNameSplit FileNameTake FilePrint FileType FilledCurve FilledCurveBox Filling FillingStyle FillingTransform FilterRules FinancialBond FinancialData FinancialDerivative FinancialIndicator Find FindArgMax FindArgMin FindClique FindClusters FindCurvePath FindDistributionParameters FindDivisions FindEdgeCover FindEdgeCut FindEulerianCycle FindFaces FindFile FindFit FindGeneratingFunction FindGeoLocation FindGeometricTransform FindGraphCommunities FindGraphIsomorphism FindGraphPartition FindHamiltonianCycle FindIndependentEdgeSet FindIndependentVertexSet FindInstance FindIntegerNullVector FindKClan FindKClique FindKClub FindKPlex FindLibrary FindLinearRecurrence FindList FindMaximum FindMaximumFlow FindMaxValue FindMinimum FindMinimumCostFlow FindMinimumCut FindMinValue FindPermutation FindPostmanTour FindProcessParameters FindRoot FindSequenceFunction FindSettings FindShortestPath FindShortestTour FindThreshold FindVertexCover FindVertexCut Fine FinishDynamic FiniteAbelianGroupCount FiniteGroupCount FiniteGroupData First FirstPassageTimeDistribution FischerGroupFi22 FischerGroupFi23 FischerGroupFi24Prime FisherHypergeometricDistribution FisherRatioTest FisherZDistribution Fit FitAll FittedModel FixedPoint FixedPointList FlashSelection Flat Flatten FlattenAt FlatTopWindow FlipView Floor FlushPrintOutputPacket Fold FoldList Font FontColor FontFamily FontForm FontName FontOpacity FontPostScriptName FontProperties FontReencoding FontSize FontSlant FontSubstitutions FontTracking FontVariations FontWeight For ForAll Format FormatRules FormatType FormatTypeAutoConvert FormatValues FormBox FormBoxOptions FortranForm Forward ForwardBackward Fourier FourierCoefficient FourierCosCoefficient FourierCosSeries FourierCosTransform FourierDCT FourierDCTFilter FourierDCTMatrix FourierDST FourierDSTMatrix FourierMatrix FourierParameters FourierSequenceTransform FourierSeries FourierSinCoefficient FourierSinSeries FourierSinTransform FourierTransform FourierTrigSeries FractionalBrownianMotionProcess FractionalPart FractionBox FractionBoxOptions FractionLine Frame FrameBox FrameBoxOptions Framed FrameInset FrameLabel Frameless FrameMargins FrameStyle FrameTicks FrameTicksStyle FRatioDistribution FrechetDistribution FreeQ FrequencySamplingFilterKernel FresnelC FresnelS Friday FrobeniusNumber FrobeniusSolve ' +
      'FromCharacterCode FromCoefficientRules FromContinuedFraction FromDate FromDigits FromDMS Front FrontEndDynamicExpression FrontEndEventActions FrontEndExecute FrontEndObject FrontEndResource FrontEndResourceString FrontEndStackSize FrontEndToken FrontEndTokenExecute FrontEndValueCache FrontEndVersion FrontFaceColor FrontFaceOpacity Full FullAxes FullDefinition FullForm FullGraphics FullOptions FullSimplify Function FunctionExpand FunctionInterpolation FunctionSpace FussellVeselyImportance ' +
      'GaborFilter GaborMatrix GaborWavelet GainMargins GainPhaseMargins Gamma GammaDistribution GammaRegularized GapPenalty Gather GatherBy GaugeFaceElementFunction GaugeFaceStyle GaugeFrameElementFunction GaugeFrameSize GaugeFrameStyle GaugeLabels GaugeMarkers GaugeStyle GaussianFilter GaussianIntegers GaussianMatrix GaussianWindow GCD GegenbauerC General GeneralizedLinearModelFit GenerateConditions GeneratedCell GeneratedParameters GeneratingFunction Generic GenericCylindricalDecomposition GenomeData GenomeLookup GeodesicClosing GeodesicDilation GeodesicErosion GeodesicOpening GeoDestination GeodesyData GeoDirection GeoDistance GeoGridPosition GeometricBrownianMotionProcess GeometricDistribution GeometricMean GeometricMeanFilter GeometricTransformation GeometricTransformation3DBox GeometricTransformation3DBoxOptions GeometricTransformationBox GeometricTransformationBoxOptions GeoPosition GeoPositionENU GeoPositionXYZ GeoProjectionData GestureHandler GestureHandlerTag Get GetBoundingBoxSizePacket GetContext GetEnvironment GetFileName GetFrontEndOptionsDataPacket GetLinebreakInformationPacket GetMenusPacket GetPageBreakInformationPacket Glaisher GlobalClusteringCoefficient GlobalPreferences GlobalSession Glow GoldenRatio GompertzMakehamDistribution GoodmanKruskalGamma GoodmanKruskalGammaTest Goto Grad Gradient GradientFilter GradientOrientationFilter Graph GraphAssortativity GraphCenter GraphComplement GraphData GraphDensity GraphDiameter GraphDifference GraphDisjointUnion ' +
      'GraphDistance GraphDistanceMatrix GraphElementData GraphEmbedding GraphHighlight GraphHighlightStyle GraphHub Graphics Graphics3D Graphics3DBox Graphics3DBoxOptions GraphicsArray GraphicsBaseline GraphicsBox GraphicsBoxOptions GraphicsColor GraphicsColumn GraphicsComplex GraphicsComplex3DBox GraphicsComplex3DBoxOptions GraphicsComplexBox GraphicsComplexBoxOptions GraphicsContents GraphicsData GraphicsGrid GraphicsGridBox GraphicsGroup GraphicsGroup3DBox GraphicsGroup3DBoxOptions GraphicsGroupBox GraphicsGroupBoxOptions GraphicsGrouping GraphicsHighlightColor GraphicsRow GraphicsSpacing GraphicsStyle GraphIntersection GraphLayout GraphLinkEfficiency GraphPeriphery GraphPlot GraphPlot3D GraphPower GraphPropertyDistribution GraphQ GraphRadius GraphReciprocity GraphRoot GraphStyle GraphUnion Gray GrayLevel GreatCircleDistance Greater GreaterEqual GreaterEqualLess GreaterFullEqual GreaterGreater GreaterLess GreaterSlantEqual GreaterTilde Green Grid GridBaseline GridBox GridBoxAlignment GridBoxBackground GridBoxDividers GridBoxFrame GridBoxItemSize GridBoxItemStyle GridBoxOptions GridBoxSpacings GridCreationSettings GridDefaultElement GridElementStyleOptions GridFrame GridFrameMargins GridGraph GridLines GridLinesStyle GroebnerBasis GroupActionBase GroupCentralizer GroupElementFromWord GroupElementPosition GroupElementQ GroupElements GroupElementToWord GroupGenerators GroupMultiplicationTable GroupOrbits GroupOrder GroupPageBreakWithin GroupSetwiseStabilizer GroupStabilizer GroupStabilizerChain Gudermannian GumbelDistribution ' +
      'HaarWavelet HadamardMatrix HalfNormalDistribution HamiltonianGraphQ HammingDistance HammingWindow HankelH1 HankelH2 HankelMatrix HannPoissonWindow HannWindow HaradaNortonGroupHN HararyGraph HarmonicMean HarmonicMeanFilter HarmonicNumber Hash HashTable Haversine HazardFunction Head HeadCompose Heads HeavisideLambda HeavisidePi HeavisideTheta HeldGroupHe HeldPart HelpBrowserLookup HelpBrowserNotebook HelpBrowserSettings HermiteDecomposition HermiteH HermitianMatrixQ HessenbergDecomposition Hessian HexadecimalCharacter Hexahedron HexahedronBox HexahedronBoxOptions HiddenSurface HighlightGraph HighlightImage HighpassFilter HigmanSimsGroupHS HilbertFilter HilbertMatrix Histogram Histogram3D HistogramDistribution HistogramList HistogramTransform HistogramTransformInterpolation HitMissTransform HITSCentrality HodgeDual HoeffdingD HoeffdingDTest Hold HoldAll HoldAllComplete HoldComplete HoldFirst HoldForm HoldPattern HoldRest HolidayCalendar HomeDirectory HomePage Horizontal HorizontalForm HorizontalGauge HorizontalScrollPosition HornerForm HotellingTSquareDistribution HoytDistribution HTMLSave Hue HumpDownHump HumpEqual HurwitzLerchPhi HurwitzZeta HyperbolicDistribution HypercubeGraph HyperexponentialDistribution Hyperfactorial Hypergeometric0F1 Hypergeometric0F1Regularized Hypergeometric1F1 Hypergeometric1F1Regularized Hypergeometric2F1 Hypergeometric2F1Regularized HypergeometricDistribution HypergeometricPFQ HypergeometricPFQRegularized HypergeometricU Hyperlink HyperlinkCreationSettings Hyphenation HyphenationOptions HypoexponentialDistribution HypothesisTestData ' +
      'I Identity IdentityMatrix If IgnoreCase Im Image Image3D Image3DSlices ImageAccumulate ImageAdd ImageAdjust ImageAlign ImageApply ImageAspectRatio ImageAssemble ImageCache ImageCacheValid ImageCapture ImageChannels ImageClip ImageColorSpace ImageCompose ImageConvolve ImageCooccurrence ImageCorners ImageCorrelate ImageCorrespondingPoints ImageCrop ImageData ImageDataPacket ImageDeconvolve ImageDemosaic ImageDifference ImageDimensions ImageDistance ImageEffect ImageFeatureTrack ImageFileApply ImageFileFilter ImageFileScan ImageFilter ImageForestingComponents ImageForwardTransformation ImageHistogram ImageKeypoints ImageLevels ImageLines ImageMargins ImageMarkers ImageMeasurements ImageMultiply ImageOffset ImagePad ImagePadding ImagePartition ImagePeriodogram ImagePerspectiveTransformation ImageQ ImageRangeCache ImageReflect ImageRegion ImageResize ImageResolution ImageRotate ImageRotated ImageScaled ImageScan ImageSize ImageSizeAction ImageSizeCache ImageSizeMultipliers ImageSizeRaw ImageSubtract ImageTake ImageTransformation ImageTrim ImageType ImageValue ImageValuePositions Implies Import ImportAutoReplacements ImportString ImprovementImportance In IncidenceGraph IncidenceList IncidenceMatrix IncludeConstantBasis IncludeFileExtension IncludePods IncludeSingularTerm Increment Indent IndentingNewlineSpacings IndentMaxFraction IndependenceTest IndependentEdgeSetQ IndependentUnit IndependentVertexSetQ Indeterminate IndexCreationOptions Indexed IndexGraph IndexTag Inequality InexactNumberQ InexactNumbers Infinity Infix Information Inherited InheritScope Initialization InitializationCell InitializationCellEvaluation InitializationCellWarning InlineCounterAssignments InlineCounterIncrements InlineRules Inner Inpaint Input InputAliases InputAssumptions InputAutoReplacements InputField InputFieldBox InputFieldBoxOptions InputForm InputGrouping InputNamePacket InputNotebook InputPacket InputSettings InputStream InputString InputStringPacket InputToBoxFormPacket Insert InsertionPointObject InsertResults Inset Inset3DBox Inset3DBoxOptions InsetBox InsetBoxOptions Install InstallService InString Integer IntegerDigits IntegerExponent IntegerLength IntegerPart IntegerPartitions IntegerQ Integers IntegerString Integral Integrate Interactive InteractiveTradingChart Interlaced Interleaving InternallyBalancedDecomposition InterpolatingFunction InterpolatingPolynomial Interpolation InterpolationOrder InterpolationPoints InterpolationPrecision Interpretation InterpretationBox InterpretationBoxOptions InterpretationFunction ' +
      'InterpretTemplate InterquartileRange Interrupt InterruptSettings Intersection Interval IntervalIntersection IntervalMemberQ IntervalUnion Inverse InverseBetaRegularized InverseCDF InverseChiSquareDistribution InverseContinuousWaveletTransform InverseDistanceTransform InverseEllipticNomeQ InverseErf InverseErfc InverseFourier InverseFourierCosTransform InverseFourierSequenceTransform InverseFourierSinTransform InverseFourierTransform InverseFunction InverseFunctions InverseGammaDistribution InverseGammaRegularized InverseGaussianDistribution InverseGudermannian InverseHaversine InverseJacobiCD InverseJacobiCN InverseJacobiCS InverseJacobiDC InverseJacobiDN InverseJacobiDS InverseJacobiNC InverseJacobiND InverseJacobiNS InverseJacobiSC InverseJacobiSD InverseJacobiSN InverseLaplaceTransform InversePermutation InverseRadon InverseSeries InverseSurvivalFunction InverseWaveletTransform InverseWeierstrassP InverseZTransform Invisible InvisibleApplication InvisibleTimes IrreduciblePolynomialQ IsolatingInterval IsomorphicGraphQ IsotopeData Italic Item ItemBox ItemBoxOptions ItemSize ItemStyle ItoProcess ' +
      'JaccardDissimilarity JacobiAmplitude Jacobian JacobiCD JacobiCN JacobiCS JacobiDC JacobiDN JacobiDS JacobiNC JacobiND JacobiNS JacobiP JacobiSC JacobiSD JacobiSN JacobiSymbol JacobiZeta JankoGroupJ1 JankoGroupJ2 JankoGroupJ3 JankoGroupJ4 JarqueBeraALMTest JohnsonDistribution Join Joined JoinedCurve JoinedCurveBox JoinForm JordanDecomposition JordanModelDecomposition ' +
      'K KagiChart KaiserBesselWindow KaiserWindow KalmanEstimator KalmanFilter KarhunenLoeveDecomposition KaryTree KatzCentrality KCoreComponents KDistribution KelvinBei KelvinBer KelvinKei KelvinKer KendallTau KendallTauTest KernelExecute KernelMixtureDistribution KernelObject Kernels Ket Khinchin KirchhoffGraph KirchhoffMatrix KleinInvariantJ KnightTourGraph KnotData KnownUnitQ KolmogorovSmirnovTest KroneckerDelta KroneckerModelDecomposition KroneckerProduct KroneckerSymbol KuiperTest KumaraswamyDistribution Kurtosis KuwaharaFilter ' +
      'Label Labeled LabeledSlider LabelingFunction LabelStyle LaguerreL LambdaComponents LambertW LanczosWindow LandauDistribution Language LanguageCategory LaplaceDistribution LaplaceTransform Laplacian LaplacianFilter LaplacianGaussianFilter Large Larger Last Latitude LatitudeLongitude LatticeData LatticeReduce Launch LaunchKernels LayeredGraphPlot LayerSizeFunction LayoutInformation LCM LeafCount LeapYearQ LeastSquares LeastSquaresFilterKernel Left LeftArrow LeftArrowBar LeftArrowRightArrow LeftDownTeeVector LeftDownVector LeftDownVectorBar LeftRightArrow LeftRightVector LeftTee LeftTeeArrow LeftTeeVector LeftTriangle LeftTriangleBar LeftTriangleEqual LeftUpDownVector LeftUpTeeVector LeftUpVector LeftUpVectorBar LeftVector LeftVectorBar LegendAppearance Legended LegendFunction LegendLabel LegendLayout LegendMargins LegendMarkers LegendMarkerSize LegendreP LegendreQ LegendreType Length LengthWhile LerchPhi Less LessEqual LessEqualGreater LessFullEqual LessGreater LessLess LessSlantEqual LessTilde LetterCharacter LetterQ Level LeveneTest LeviCivitaTensor LevyDistribution Lexicographic LibraryFunction LibraryFunctionError LibraryFunctionInformation LibraryFunctionLoad LibraryFunctionUnload LibraryLoad LibraryUnload LicenseID LiftingFilterData LiftingWaveletTransform LightBlue LightBrown LightCyan Lighter LightGray LightGreen Lighting LightingAngle LightMagenta LightOrange LightPink LightPurple LightRed LightSources LightYellow Likelihood Limit LimitsPositioning LimitsPositioningTokens LindleyDistribution Line Line3DBox LinearFilter LinearFractionalTransform LinearModelFit LinearOffsetFunction LinearProgramming LinearRecurrence LinearSolve LinearSolveFunction LineBox LineBreak LinebreakAdjustments LineBreakChart LineBreakWithin LineColor LineForm LineGraph LineIndent LineIndentMaxFraction LineIntegralConvolutionPlot LineIntegralConvolutionScale LineLegend LineOpacity LineSpacing LineWrapParts LinkActivate LinkClose LinkConnect LinkConnectedQ LinkCreate LinkError LinkFlush LinkFunction LinkHost LinkInterrupt LinkLaunch LinkMode LinkObject LinkOpen LinkOptions LinkPatterns LinkProtocol LinkRead LinkReadHeld LinkReadyQ Links LinkWrite LinkWriteHeld LiouvilleLambda List Listable ListAnimate ListContourPlot ListContourPlot3D ListConvolve ListCorrelate ListCurvePathPlot ListDeconvolve ListDensityPlot Listen ListFourierSequenceTransform ListInterpolation ListLineIntegralConvolutionPlot ListLinePlot ListLogLinearPlot ListLogLogPlot ListLogPlot ListPicker ListPickerBox ListPickerBoxBackground ListPickerBoxOptions ListPlay ListPlot ListPlot3D ListPointPlot3D ListPolarPlot ListQ ListStreamDensityPlot ListStreamPlot ListSurfacePlot3D ListVectorDensityPlot ListVectorPlot ListVectorPlot3D ListZTransform Literal LiteralSearch LocalClusteringCoefficient LocalizeVariables LocationEquivalenceTest LocationTest Locator LocatorAutoCreate LocatorBox LocatorBoxOptions LocatorCentering LocatorPane LocatorPaneBox LocatorPaneBoxOptions ' +
      'LocatorRegion Locked Log Log10 Log2 LogBarnesG LogGamma LogGammaDistribution LogicalExpand LogIntegral LogisticDistribution LogitModelFit LogLikelihood LogLinearPlot LogLogisticDistribution LogLogPlot LogMultinormalDistribution LogNormalDistribution LogPlot LogRankTest LogSeriesDistribution LongEqual Longest LongestAscendingSequence LongestCommonSequence LongestCommonSequencePositions LongestCommonSubsequence LongestCommonSubsequencePositions LongestMatch LongForm Longitude LongLeftArrow LongLeftRightArrow LongRightArrow Loopback LoopFreeGraphQ LowerCaseQ LowerLeftArrow LowerRightArrow LowerTriangularize LowpassFilter LQEstimatorGains LQGRegulator LQOutputRegulatorGains LQRegulatorGains LUBackSubstitution LucasL LuccioSamiComponents LUDecomposition LyapunovSolve LyonsGroupLy ' +
      'MachineID MachineName MachineNumberQ MachinePrecision MacintoshSystemPageSetup Magenta Magnification Magnify MainSolve MaintainDynamicCaches Majority MakeBoxes MakeExpression MakeRules MangoldtLambda ManhattanDistance Manipulate Manipulator MannWhitneyTest MantissaExponent Manual Map MapAll MapAt MapIndexed MAProcess MapThread MarcumQ MardiaCombinedTest MardiaKurtosisTest MardiaSkewnessTest MarginalDistribution MarkovProcessProperties Masking MatchingDissimilarity MatchLocalNameQ MatchLocalNames MatchQ Material MathematicaNotation MathieuC MathieuCharacteristicA MathieuCharacteristicB MathieuCharacteristicExponent MathieuCPrime MathieuGroupM11 MathieuGroupM12 MathieuGroupM22 MathieuGroupM23 MathieuGroupM24 MathieuS MathieuSPrime MathMLForm MathMLText Matrices MatrixExp MatrixForm MatrixFunction MatrixLog MatrixPlot MatrixPower MatrixQ MatrixRank Max MaxBend MaxDetect MaxExtraBandwidths MaxExtraConditions MaxFeatures MaxFilter Maximize MaxIterations MaxMemoryUsed MaxMixtureKernels MaxPlotPoints MaxPoints MaxRecursion MaxStableDistribution MaxStepFraction MaxSteps MaxStepSize MaxValue MaxwellDistribution McLaughlinGroupMcL Mean MeanClusteringCoefficient MeanDegreeConnectivity MeanDeviation MeanFilter MeanGraphDistance MeanNeighborDegree MeanShift MeanShiftFilter Median MedianDeviation MedianFilter Medium MeijerG MeixnerDistribution MemberQ MemoryConstrained MemoryInUse Menu MenuAppearance MenuCommandKey MenuEvaluator MenuItem MenuPacket MenuSortingValue MenuStyle MenuView MergeDifferences Mesh MeshFunctions MeshRange MeshShading MeshStyle Message MessageDialog MessageList MessageName MessageOptions MessagePacket Messages MessagesNotebook MetaCharacters MetaInformation Method MethodOptions MexicanHatWavelet MeyerWavelet Min MinDetect MinFilter MinimalPolynomial MinimalStateSpaceModel Minimize Minors MinRecursion MinSize MinStableDistribution Minus MinusPlus MinValue Missing MissingDataMethod MittagLefflerE MixedRadix MixedRadixQuantity MixtureDistribution Mod Modal Mode Modular ModularLambda Module Modulus MoebiusMu Moment Momentary MomentConvert MomentEvaluate MomentGeneratingFunction Monday Monitor MonomialList MonomialOrder MonsterGroupM MorletWavelet MorphologicalBinarize MorphologicalBranchPoints MorphologicalComponents MorphologicalEulerNumber MorphologicalGraph MorphologicalPerimeter MorphologicalTransform Most MouseAnnotation MouseAppearance MouseAppearanceTag MouseButtons Mouseover MousePointerNote MousePosition MovingAverage MovingMedian MoyalDistribution MultiedgeStyle MultilaunchWarning MultiLetterItalics MultiLetterStyle MultilineFunction Multinomial MultinomialDistribution MultinormalDistribution MultiplicativeOrder Multiplicity Multiselection MultivariateHypergeometricDistribution MultivariatePoissonDistribution MultivariateTDistribution ' +
      'N NakagamiDistribution NameQ Names NamespaceBox Nand NArgMax NArgMin NBernoulliB NCache NDSolve NDSolveValue Nearest NearestFunction NeedCurrentFrontEndPackagePacket NeedCurrentFrontEndSymbolsPacket NeedlemanWunschSimilarity Needs Negative NegativeBinomialDistribution NegativeMultinomialDistribution NeighborhoodGraph Nest NestedGreaterGreater NestedLessLess NestedScriptRules NestList NestWhile NestWhileList NevilleThetaC NevilleThetaD NevilleThetaN NevilleThetaS NewPrimitiveStyle NExpectation Next NextPrime NHoldAll NHoldFirst NHoldRest NicholsGridLines NicholsPlot NIntegrate NMaximize NMaxValue NMinimize NMinValue NominalVariables NonAssociative NoncentralBetaDistribution NoncentralChiSquareDistribution NoncentralFRatioDistribution NoncentralStudentTDistribution NonCommutativeMultiply NonConstants None NonlinearModelFit NonlocalMeansFilter NonNegative NonPositive Nor NorlundB Norm Normal NormalDistribution NormalGrouping Normalize NormalizedSquaredEuclideanDistance NormalsFunction NormFunction Not NotCongruent NotCupCap NotDoubleVerticalBar Notebook NotebookApply NotebookAutoSave NotebookClose NotebookConvertSettings NotebookCreate NotebookCreateReturnObject NotebookDefault NotebookDelete NotebookDirectory NotebookDynamicExpression NotebookEvaluate NotebookEventActions NotebookFileName NotebookFind NotebookFindReturnObject NotebookGet NotebookGetLayoutInformationPacket NotebookGetMisspellingsPacket NotebookInformation NotebookInterfaceObject NotebookLocate NotebookObject NotebookOpen NotebookOpenReturnObject NotebookPath NotebookPrint NotebookPut NotebookPutReturnObject NotebookRead NotebookResetGeneratedCells Notebooks NotebookSave NotebookSaveAs NotebookSelection NotebookSetupLayoutInformationPacket NotebooksMenu NotebookWrite NotElement NotEqualTilde NotExists NotGreater NotGreaterEqual NotGreaterFullEqual NotGreaterGreater NotGreaterLess NotGreaterSlantEqual NotGreaterTilde NotHumpDownHump NotHumpEqual NotLeftTriangle NotLeftTriangleBar NotLeftTriangleEqual NotLess NotLessEqual NotLessFullEqual NotLessGreater NotLessLess NotLessSlantEqual NotLessTilde NotNestedGreaterGreater NotNestedLessLess NotPrecedes NotPrecedesEqual NotPrecedesSlantEqual NotPrecedesTilde NotReverseElement NotRightTriangle NotRightTriangleBar NotRightTriangleEqual NotSquareSubset NotSquareSubsetEqual NotSquareSuperset NotSquareSupersetEqual NotSubset NotSubsetEqual NotSucceeds NotSucceedsEqual NotSucceedsSlantEqual NotSucceedsTilde NotSuperset NotSupersetEqual NotTilde NotTildeEqual NotTildeFullEqual NotTildeTilde NotVerticalBar NProbability NProduct NProductFactors NRoots NSolve NSum NSumTerms Null NullRecords NullSpace NullWords Number NumberFieldClassNumber NumberFieldDiscriminant NumberFieldFundamentalUnits NumberFieldIntegralBasis NumberFieldNormRepresentatives NumberFieldRegulator NumberFieldRootsOfUnity NumberFieldSignature NumberForm NumberFormat NumberMarks NumberMultiplier NumberPadding NumberPoint NumberQ NumberSeparator ' +
      'NumberSigns NumberString Numerator NumericFunction NumericQ NuttallWindow NValues NyquistGridLines NyquistPlot ' +
      'O ObservabilityGramian ObservabilityMatrix ObservableDecomposition ObservableModelQ OddQ Off Offset OLEData On ONanGroupON OneIdentity Opacity Open OpenAppend Opener OpenerBox OpenerBoxOptions OpenerView OpenFunctionInspectorPacket Opening OpenRead OpenSpecialOptions OpenTemporary OpenWrite Operate OperatingSystem OptimumFlowData Optional OptionInspectorSettings OptionQ Options OptionsPacket OptionsPattern OptionValue OptionValueBox OptionValueBoxOptions Or Orange Order OrderDistribution OrderedQ Ordering Orderless OrnsteinUhlenbeckProcess Orthogonalize Out Outer OutputAutoOverwrite OutputControllabilityMatrix OutputControllableModelQ OutputForm OutputFormData OutputGrouping OutputMathEditExpression OutputNamePacket OutputResponse OutputSizeLimit OutputStream Over OverBar OverDot Overflow OverHat Overlaps Overlay OverlayBox OverlayBoxOptions Overscript OverscriptBox OverscriptBoxOptions OverTilde OverVector OwenT OwnValues ' +
      'PackingMethod PaddedForm Padding PadeApproximant PadLeft PadRight PageBreakAbove PageBreakBelow PageBreakWithin PageFooterLines PageFooters PageHeaderLines PageHeaders PageHeight PageRankCentrality PageWidth PairedBarChart PairedHistogram PairedSmoothHistogram PairedTTest PairedZTest PaletteNotebook PalettePath Pane PaneBox PaneBoxOptions Panel PanelBox PanelBoxOptions Paneled PaneSelector PaneSelectorBox PaneSelectorBoxOptions PaperWidth ParabolicCylinderD ParagraphIndent ParagraphSpacing ParallelArray ParallelCombine ParallelDo ParallelEvaluate Parallelization Parallelize ParallelMap ParallelNeeds ParallelProduct ParallelSubmit ParallelSum ParallelTable ParallelTry Parameter ParameterEstimator ParameterMixtureDistribution ParameterVariables ParametricFunction ParametricNDSolve ParametricNDSolveValue ParametricPlot ParametricPlot3D ParentConnect ParentDirectory ParentForm Parenthesize ParentList ParetoDistribution Part PartialCorrelationFunction PartialD ParticleData Partition PartitionsP PartitionsQ ParzenWindow PascalDistribution PassEventsDown PassEventsUp Paste PasteBoxFormInlineCells PasteButton Path PathGraph PathGraphQ Pattern PatternSequence PatternTest PauliMatrix PaulWavelet Pause PausedTime PDF PearsonChiSquareTest PearsonCorrelationTest PearsonDistribution PerformanceGoal PeriodicInterpolation Periodogram PeriodogramArray PermutationCycles PermutationCyclesQ PermutationGroup PermutationLength PermutationList PermutationListQ PermutationMax PermutationMin PermutationOrder PermutationPower PermutationProduct PermutationReplace Permutations PermutationSupport Permute PeronaMalikFilter Perpendicular PERTDistribution PetersenGraph PhaseMargins Pi Pick PIDData PIDDerivativeFilter PIDFeedforward PIDTune Piecewise PiecewiseExpand PieChart PieChart3D PillaiTrace PillaiTraceTest Pink Pivoting PixelConstrained PixelValue PixelValuePositions Placed Placeholder PlaceholderReplace Plain PlanarGraphQ Play PlayRange Plot Plot3D Plot3Matrix PlotDivision PlotJoined PlotLabel PlotLayout PlotLegends PlotMarkers PlotPoints PlotRange PlotRangeClipping PlotRangePadding PlotRegion PlotStyle Plus PlusMinus Pochhammer PodStates PodWidth Point Point3DBox PointBox PointFigureChart PointForm PointLegend PointSize PoissonConsulDistribution PoissonDistribution PoissonProcess PoissonWindow PolarAxes PolarAxesOrigin PolarGridLines PolarPlot PolarTicks PoleZeroMarkers PolyaAeppliDistribution PolyGamma Polygon Polygon3DBox Polygon3DBoxOptions PolygonBox PolygonBoxOptions PolygonHoleScale PolygonIntersections PolygonScale PolyhedronData PolyLog PolynomialExtendedGCD PolynomialForm PolynomialGCD PolynomialLCM PolynomialMod PolynomialQ PolynomialQuotient PolynomialQuotientRemainder PolynomialReduce PolynomialRemainder Polynomials PopupMenu PopupMenuBox PopupMenuBoxOptions PopupView PopupWindow Position Positive PositiveDefiniteMatrixQ PossibleZeroQ Postfix PostScript Power PowerDistribution PowerExpand PowerMod PowerModList ' +
      'PowerSpectralDensity PowersRepresentations PowerSymmetricPolynomial Precedence PrecedenceForm Precedes PrecedesEqual PrecedesSlantEqual PrecedesTilde Precision PrecisionGoal PreDecrement PredictionRoot PreemptProtect PreferencesPath Prefix PreIncrement Prepend PrependTo PreserveImageOptions Previous PriceGraphDistribution PrimaryPlaceholder Prime PrimeNu PrimeOmega PrimePi PrimePowerQ PrimeQ Primes PrimeZetaP PrimitiveRoot PrincipalComponents PrincipalValue Print PrintAction PrintForm PrintingCopies PrintingOptions PrintingPageRange PrintingStartingPageNumber PrintingStyleEnvironment PrintPrecision PrintTemporary Prism PrismBox PrismBoxOptions PrivateCellOptions PrivateEvaluationOptions PrivateFontOptions PrivateFrontEndOptions PrivateNotebookOptions PrivatePaths Probability ProbabilityDistribution ProbabilityPlot ProbabilityPr ProbabilityScalePlot ProbitModelFit ProcessEstimator ProcessParameterAssumptions ProcessParameterQ ProcessStateDomain ProcessTimeDomain Product ProductDistribution ProductLog ProgressIndicator ProgressIndicatorBox ProgressIndicatorBoxOptions Projection Prolog PromptForm Properties Property PropertyList PropertyValue Proportion Proportional Protect Protected ProteinData Pruning PseudoInverse Purple Put PutAppend Pyramid PyramidBox PyramidBoxOptions ' +
      'QBinomial QFactorial QGamma QHypergeometricPFQ QPochhammer QPolyGamma QRDecomposition QuadraticIrrationalQ Quantile QuantilePlot Quantity QuantityForm QuantityMagnitude QuantityQ QuantityUnit Quartics QuartileDeviation Quartiles QuartileSkewness QueueingNetworkProcess QueueingProcess QueueProperties Quiet Quit Quotient QuotientRemainder ' +
      'RadialityCentrality RadicalBox RadicalBoxOptions RadioButton RadioButtonBar RadioButtonBox RadioButtonBoxOptions Radon RamanujanTau RamanujanTauL RamanujanTauTheta RamanujanTauZ Random RandomChoice RandomComplex RandomFunction RandomGraph RandomImage RandomInteger RandomPermutation RandomPrime RandomReal RandomSample RandomSeed RandomVariate RandomWalkProcess Range RangeFilter RangeSpecification RankedMax RankedMin Raster Raster3D Raster3DBox Raster3DBoxOptions RasterArray RasterBox RasterBoxOptions Rasterize RasterSize Rational RationalFunctions Rationalize Rationals Ratios Raw RawArray RawBoxes RawData RawMedium RayleighDistribution Re Read ReadList ReadProtected Real RealBlockDiagonalForm RealDigits RealExponent Reals Reap Record RecordLists RecordSeparators Rectangle RectangleBox RectangleBoxOptions RectangleChart RectangleChart3D RecurrenceFilter RecurrenceTable RecurringDigitsForm Red Reduce RefBox ReferenceLineStyle ReferenceMarkers ReferenceMarkerStyle Refine ReflectionMatrix ReflectionTransform Refresh RefreshRate RegionBinarize RegionFunction RegionPlot RegionPlot3D RegularExpression Regularization Reinstall Release ReleaseHold ReliabilityDistribution ReliefImage ReliefPlot Remove RemoveAlphaChannel RemoveAsynchronousTask Removed RemoveInputStreamMethod RemoveOutputStreamMethod RemoveProperty RemoveScheduledTask RenameDirectory RenameFile RenderAll RenderingOptions RenewalProcess RenkoChart Repeated RepeatedNull RepeatedString Replace ReplaceAll ReplaceHeldPart ReplaceImageValue ReplaceList ReplacePart ReplacePixelValue ReplaceRepeated Resampling Rescale RescalingTransform ResetDirectory ResetMenusPacket ResetScheduledTask Residue Resolve Rest Resultant ResumePacket Return ReturnExpressionPacket ReturnInputFormPacket ReturnPacket ReturnTextPacket Reverse ReverseBiorthogonalSplineWavelet ReverseElement ReverseEquilibrium ReverseGraph ReverseUpEquilibrium RevolutionAxis RevolutionPlot3D RGBColor RiccatiSolve RiceDistribution RidgeFilter RiemannR RiemannSiegelTheta RiemannSiegelZ Riffle Right RightArrow RightArrowBar RightArrowLeftArrow RightCosetRepresentative RightDownTeeVector RightDownVector RightDownVectorBar RightTee RightTeeArrow RightTeeVector RightTriangle RightTriangleBar RightTriangleEqual RightUpDownVector RightUpTeeVector RightUpVector RightUpVectorBar RightVector RightVectorBar RiskAchievementImportance RiskReductionImportance RogersTanimotoDissimilarity Root RootApproximant RootIntervals RootLocusPlot RootMeanSquare RootOfUnityQ RootReduce Roots RootSum Rotate RotateLabel RotateLeft RotateRight RotationAction RotationBox RotationBoxOptions RotationMatrix RotationTransform Round RoundImplies RoundingRadius Row RowAlignments RowBackgrounds RowBox RowHeights RowLines RowMinHeight RowReduce RowsEqual RowSpacings RSolve RudvalisGroupRu Rule RuleCondition RuleDelayed RuleForm RulerUnits Run RunScheduledTask RunThrough RuntimeAttributes RuntimeOptions RussellRaoDissimilarity ' +
      'SameQ SameTest SampleDepth SampledSoundFunction SampledSoundList SampleRate SamplingPeriod SARIMAProcess SARMAProcess SatisfiabilityCount SatisfiabilityInstances SatisfiableQ Saturday Save Saveable SaveAutoDelete SaveDefinitions SawtoothWave Scale Scaled ScaleDivisions ScaledMousePosition ScaleOrigin ScalePadding ScaleRanges ScaleRangeStyle ScalingFunctions ScalingMatrix ScalingTransform Scan ScheduledTaskActiveQ ScheduledTaskData ScheduledTaskObject ScheduledTasks SchurDecomposition ScientificForm ScreenRectangle ScreenStyleEnvironment ScriptBaselineShifts ScriptLevel ScriptMinSize ScriptRules ScriptSizeMultipliers Scrollbars ScrollingOptions ScrollPosition Sec Sech SechDistribution SectionGrouping SectorChart SectorChart3D SectorOrigin SectorSpacing SeedRandom Select Selectable SelectComponents SelectedCells SelectedNotebook Selection SelectionAnimate SelectionCell SelectionCellCreateCell SelectionCellDefaultStyle SelectionCellParentStyle SelectionCreateCell SelectionDebuggerTag SelectionDuplicateCell SelectionEvaluate SelectionEvaluateCreateCell SelectionMove SelectionPlaceholder SelectionSetStyle SelectWithContents SelfLoops SelfLoopStyle SemialgebraicComponentInstances SendMail Sequence SequenceAlignment SequenceForm SequenceHold SequenceLimit Series SeriesCoefficient SeriesData SessionTime Set SetAccuracy SetAlphaChannel SetAttributes Setbacks SetBoxFormNamesPacket SetDelayed SetDirectory SetEnvironment SetEvaluationNotebook SetFileDate SetFileLoadingContext SetNotebookStatusLine SetOptions SetOptionsPacket SetPrecision SetProperty SetSelectedNotebook SetSharedFunction SetSharedVariable SetSpeechParametersPacket SetStreamPosition SetSystemOptions Setter SetterBar SetterBox SetterBoxOptions Setting SetValue Shading Shallow ShannonWavelet ShapiroWilkTest Share Sharpen ShearingMatrix ShearingTransform ShenCastanMatrix Short ShortDownArrow Shortest ShortestMatch ShortestPathFunction ShortLeftArrow ShortRightArrow ShortUpArrow Show ShowAutoStyles ShowCellBracket ShowCellLabel ShowCellTags ShowClosedCellArea ShowContents ShowControls ShowCursorTracker ShowGroupOpenCloseIcon ShowGroupOpener ShowInvisibleCharacters ShowPageBreaks ShowPredictiveInterface ShowSelection ShowShortBoxForm ShowSpecialCharacters ShowStringCharacters ShowSyntaxStyles ShrinkingDelay ShrinkWrapBoundingBox SiegelTheta SiegelTukeyTest Sign Signature SignedRankTest SignificanceLevel SignPadding SignTest SimilarityRules SimpleGraph SimpleGraphQ Simplify Sin Sinc SinghMaddalaDistribution SingleEvaluation SingleLetterItalics SingleLetterStyle SingularValueDecomposition SingularValueList SingularValuePlot SingularValues Sinh SinhIntegral SinIntegral SixJSymbol Skeleton SkeletonTransform SkellamDistribution Skewness SkewNormalDistribution Skip SliceDistribution Slider Slider2D Slider2DBox Slider2DBoxOptions SliderBox SliderBoxOptions SlideView Slot SlotSequence Small SmallCircle Smaller SmithDelayCompensator SmithWatermanSimilarity ' +
      'SmoothDensityHistogram SmoothHistogram SmoothHistogram3D SmoothKernelDistribution SocialMediaData Socket SokalSneathDissimilarity Solve SolveAlways SolveDelayed Sort SortBy Sound SoundAndGraphics SoundNote SoundVolume Sow Space SpaceForm Spacer Spacings Span SpanAdjustments SpanCharacterRounding SpanFromAbove SpanFromBoth SpanFromLeft SpanLineThickness SpanMaxSize SpanMinSize SpanningCharacters SpanSymmetric SparseArray SpatialGraphDistribution Speak SpeakTextPacket SpearmanRankTest SpearmanRho Spectrogram SpectrogramArray Specularity SpellingCorrection SpellingDictionaries SpellingDictionariesPath SpellingOptions SpellingSuggestionsPacket Sphere SphereBox SphericalBesselJ SphericalBesselY SphericalHankelH1 SphericalHankelH2 SphericalHarmonicY SphericalPlot3D SphericalRegion SpheroidalEigenvalue SpheroidalJoiningFactor SpheroidalPS SpheroidalPSPrime SpheroidalQS SpheroidalQSPrime SpheroidalRadialFactor SpheroidalS1 SpheroidalS1Prime SpheroidalS2 SpheroidalS2Prime Splice SplicedDistribution SplineClosed SplineDegree SplineKnots SplineWeights Split SplitBy SpokenString Sqrt SqrtBox SqrtBoxOptions Square SquaredEuclideanDistance SquareFreeQ SquareIntersection SquaresR SquareSubset SquareSubsetEqual SquareSuperset SquareSupersetEqual SquareUnion SquareWave StabilityMargins StabilityMarginsStyle StableDistribution Stack StackBegin StackComplete StackInhibit StandardDeviation StandardDeviationFilter StandardForm Standardize StandbyDistribution Star StarGraph StartAsynchronousTask StartingStepSize StartOfLine StartOfString StartScheduledTask StartupSound StateDimensions StateFeedbackGains StateOutputEstimator StateResponse StateSpaceModel StateSpaceRealization StateSpaceTransform StationaryDistribution StationaryWaveletPacketTransform StationaryWaveletTransform StatusArea StatusCentrality StepMonitor StieltjesGamma StirlingS1 StirlingS2 StopAsynchronousTask StopScheduledTask StrataVariables StratonovichProcess StreamColorFunction StreamColorFunctionScaling StreamDensityPlot StreamPlot StreamPoints StreamPosition Streams StreamScale StreamStyle String StringBreak StringByteCount StringCases StringCount StringDrop StringExpression StringForm StringFormat StringFreeQ StringInsert StringJoin StringLength StringMatchQ StringPosition StringQ StringReplace StringReplaceList StringReplacePart StringReverse StringRotateLeft StringRotateRight StringSkeleton StringSplit StringTake StringToStream StringTrim StripBoxes StripOnInput StripWrapperBoxes StrokeForm StructuralImportance StructuredArray StructuredSelection StruveH StruveL Stub StudentTDistribution Style StyleBox StyleBoxAutoDelete StyleBoxOptions StyleData StyleDefinitions StyleForm StyleKeyMapping StyleMenuListing StyleNameDialogSettings StyleNames StylePrint StyleSheetPath Subfactorial Subgraph SubMinus SubPlus SubresultantPolynomialRemainders ' +
      'SubresultantPolynomials Subresultants Subscript SubscriptBox SubscriptBoxOptions Subscripted Subset SubsetEqual Subsets SubStar Subsuperscript SubsuperscriptBox SubsuperscriptBoxOptions Subtract SubtractFrom SubValues Succeeds SucceedsEqual SucceedsSlantEqual SucceedsTilde SuchThat Sum SumConvergence Sunday SuperDagger SuperMinus SuperPlus Superscript SuperscriptBox SuperscriptBoxOptions Superset SupersetEqual SuperStar Surd SurdForm SurfaceColor SurfaceGraphics SurvivalDistribution SurvivalFunction SurvivalModel SurvivalModelFit SuspendPacket SuzukiDistribution SuzukiGroupSuz SwatchLegend Switch Symbol SymbolName SymletWavelet Symmetric SymmetricGroup SymmetricMatrixQ SymmetricPolynomial SymmetricReduction Symmetrize SymmetrizedArray SymmetrizedArrayRules SymmetrizedDependentComponents SymmetrizedIndependentComponents SymmetrizedReplacePart SynchronousInitialization SynchronousUpdating Syntax SyntaxForm SyntaxInformation SyntaxLength SyntaxPacket SyntaxQ SystemDialogInput SystemException SystemHelpPath SystemInformation SystemInformationData SystemOpen SystemOptions SystemsModelDelay SystemsModelDelayApproximate SystemsModelDelete SystemsModelDimensions SystemsModelExtract SystemsModelFeedbackConnect SystemsModelLabels SystemsModelOrder SystemsModelParallelConnect SystemsModelSeriesConnect SystemsModelStateFeedbackConnect SystemStub ' +
      'Tab TabFilling Table TableAlignments TableDepth TableDirections TableForm TableHeadings TableSpacing TableView TableViewBox TabSpacings TabView TabViewBox TabViewBoxOptions TagBox TagBoxNote TagBoxOptions TaggingRules TagSet TagSetDelayed TagStyle TagUnset Take TakeWhile Tally Tan Tanh TargetFunctions TargetUnits TautologyQ TelegraphProcess TemplateBox TemplateBoxOptions TemplateSlotSequence TemporalData Temporary TemporaryVariable TensorContract TensorDimensions TensorExpand TensorProduct TensorQ TensorRank TensorReduce TensorSymmetry TensorTranspose TensorWedge Tetrahedron TetrahedronBox TetrahedronBoxOptions TeXForm TeXSave Text Text3DBox Text3DBoxOptions TextAlignment TextBand TextBoundingBox TextBox TextCell TextClipboardType TextData TextForm TextJustification TextLine TextPacket TextParagraph TextRecognize TextRendering TextStyle Texture TextureCoordinateFunction TextureCoordinateScaling Therefore ThermometerGauge Thick Thickness Thin Thinning ThisLink ThompsonGroupTh Thread ThreeJSymbol Threshold Through Throw Thumbnail Thursday Ticks TicksStyle Tilde TildeEqual TildeFullEqual TildeTilde TimeConstrained TimeConstraint Times TimesBy TimeSeriesForecast TimeSeriesInvertibility TimeUsed TimeValue TimeZone Timing Tiny TitleGrouping TitsGroupT ToBoxes ToCharacterCode ToColor ToContinuousTimeModel ToDate ToDiscreteTimeModel ToeplitzMatrix ToExpression ToFileName Together Toggle ToggleFalse Toggler TogglerBar TogglerBox TogglerBoxOptions ToHeldExpression ToInvertibleTimeSeries TokenWords Tolerance ToLowerCase ToNumberField TooBig Tooltip TooltipBox TooltipBoxOptions TooltipDelay TooltipStyle Top TopHatTransform TopologicalSort ToRadicals ToRules ToString Total TotalHeight TotalVariationFilter TotalWidth TouchscreenAutoZoom TouchscreenControlPlacement ToUpperCase Tr Trace TraceAbove TraceAction TraceBackward TraceDepth TraceDialog TraceForward TraceInternal TraceLevel TraceOff TraceOn TraceOriginal TracePrint TraceScan TrackedSymbols TradingChart TraditionalForm TraditionalFunctionNotation TraditionalNotation TraditionalOrder TransferFunctionCancel TransferFunctionExpand TransferFunctionFactor TransferFunctionModel TransferFunctionPoles TransferFunctionTransform TransferFunctionZeros TransformationFunction TransformationFunctions TransformationMatrix TransformedDistribution TransformedField Translate TranslationTransform TransparentColor Transpose TreeForm TreeGraph TreeGraphQ TreePlot TrendStyle TriangleWave TriangularDistribution Trig TrigExpand TrigFactor TrigFactorList Trigger TrigReduce TrigToExp TrimmedMean True TrueQ TruncatedDistribution TsallisQExponentialDistribution TsallisQGaussianDistribution TTest Tube TubeBezierCurveBox TubeBezierCurveBoxOptions TubeBox TubeBSplineCurveBox TubeBSplineCurveBoxOptions Tuesday TukeyLambdaDistribution TukeyWindow Tuples TuranGraph TuringMachine ' +
      'Transparent ' +
      'UnateQ Uncompress Undefined UnderBar Underflow Underlined Underoverscript UnderoverscriptBox UnderoverscriptBoxOptions Underscript UnderscriptBox UnderscriptBoxOptions UndirectedEdge UndirectedGraph UndirectedGraphQ UndocumentedTestFEParserPacket UndocumentedTestGetSelectionPacket Unequal Unevaluated UniformDistribution UniformGraphDistribution UniformSumDistribution Uninstall Union UnionPlus Unique UnitBox UnitConvert UnitDimensions Unitize UnitRootTest UnitSimplify UnitStep UnitTriangle UnitVector Unprotect UnsameQ UnsavedVariables Unset UnsetShared UntrackedVariables Up UpArrow UpArrowBar UpArrowDownArrow Update UpdateDynamicObjects UpdateDynamicObjectsSynchronous UpdateInterval UpDownArrow UpEquilibrium UpperCaseQ UpperLeftArrow UpperRightArrow UpperTriangularize Upsample UpSet UpSetDelayed UpTee UpTeeArrow UpValues URL URLFetch URLFetchAsynchronous URLSave URLSaveAsynchronous UseGraphicsRange Using UsingFrontEnd ' +
      'V2Get ValidationLength Value ValueBox ValueBoxOptions ValueForm ValueQ ValuesData Variables Variance VarianceEquivalenceTest VarianceEstimatorFunction VarianceGammaDistribution VarianceTest VectorAngle VectorColorFunction VectorColorFunctionScaling VectorDensityPlot VectorGlyphData VectorPlot VectorPlot3D VectorPoints VectorQ Vectors VectorScale VectorStyle Vee Verbatim Verbose VerboseConvertToPostScriptPacket VerifyConvergence VerifySolutions VerifyTestAssumptions Version VersionNumber VertexAdd VertexCapacity VertexColors VertexComponent VertexConnectivity VertexCoordinateRules VertexCoordinates VertexCorrelationSimilarity VertexCosineSimilarity VertexCount VertexCoverQ VertexDataCoordinates VertexDegree VertexDelete VertexDiceSimilarity VertexEccentricity VertexInComponent VertexInDegree VertexIndex VertexJaccardSimilarity VertexLabeling VertexLabels VertexLabelStyle VertexList VertexNormals VertexOutComponent VertexOutDegree VertexQ VertexRenderingFunction VertexReplace VertexShape VertexShapeFunction VertexSize VertexStyle VertexTextureCoordinates VertexWeight Vertical VerticalBar VerticalForm VerticalGauge VerticalSeparator VerticalSlider VerticalTilde ViewAngle ViewCenter ViewMatrix ViewPoint ViewPointSelectorSettings ViewPort ViewRange ViewVector ViewVertical VirtualGroupData Visible VisibleCell VoigtDistribution VonMisesDistribution ' +
      'WaitAll WaitAsynchronousTask WaitNext WaitUntil WakebyDistribution WalleniusHypergeometricDistribution WaringYuleDistribution WatershedComponents WatsonUSquareTest WattsStrogatzGraphDistribution WaveletBestBasis WaveletFilterCoefficients WaveletImagePlot WaveletListPlot WaveletMapIndexed WaveletMatrixPlot WaveletPhi WaveletPsi WaveletScale WaveletScalogram WaveletThreshold WeaklyConnectedComponents WeaklyConnectedGraphQ WeakStationarity WeatherData WeberE Wedge Wednesday WeibullDistribution WeierstrassHalfPeriods WeierstrassInvariants WeierstrassP WeierstrassPPrime WeierstrassSigma WeierstrassZeta WeightedAdjacencyGraph WeightedAdjacencyMatrix WeightedData WeightedGraphQ Weights WelchWindow WheelGraph WhenEvent Which While White Whitespace WhitespaceCharacter WhittakerM WhittakerW WienerFilter WienerProcess WignerD WignerSemicircleDistribution WilksW WilksWTest WindowClickSelect WindowElements WindowFloating WindowFrame WindowFrameElements WindowMargins WindowMovable WindowOpacity WindowSelected WindowSize WindowStatusArea WindowTitle WindowToolbars WindowWidth With WolframAlpha WolframAlphaDate WolframAlphaQuantity WolframAlphaResult Word WordBoundary WordCharacter WordData WordSearch WordSeparators WorkingPrecision Write WriteString Wronskian ' +
      'XMLElement XMLObject Xnor Xor ' +
      'Yellow YuleDissimilarity ' +
      'ZernikeR ZeroSymmetric ZeroTest ZeroWidthTimes Zeta ZetaZero ZipfDistribution ZTest ZTransform ' +
      '$Aborted $ActivationGroupID $ActivationKey $ActivationUserRegistered $AddOnsDirectory $AssertFunction $Assumptions $AsynchronousTask $BaseDirectory $BatchInput $BatchOutput $BoxForms $ByteOrdering $Canceled $CharacterEncoding $CharacterEncodings $CommandLine $CompilationTarget $ConditionHold $ConfiguredKernels $Context $ContextPath $ControlActiveSetting $CreationDate $CurrentLink $DateStringFormat $DefaultFont $DefaultFrontEnd $DefaultImagingDevice $DefaultPath $Display $DisplayFunction $DistributedContexts $DynamicEvaluation $Echo $Epilog $ExportFormats $Failed $FinancialDataSource $FormatType $FrontEnd $FrontEndSession $GeoLocation $HistoryLength $HomeDirectory $HTTPCookies $IgnoreEOF $ImagingDevices $ImportFormats $InitialDirectory $Input $InputFileName $InputStreamMethods $Inspector $InstallationDate $InstallationDirectory $InterfaceEnvironment $IterationLimit $KernelCount $KernelID $Language $LaunchDirectory $LibraryPath $LicenseExpirationDate $LicenseID $LicenseProcesses $LicenseServer $LicenseSubprocesses $LicenseType $Line $Linked $LinkSupported $LoadedFiles $MachineAddresses $MachineDomain $MachineDomains $MachineEpsilon $MachineID $MachineName $MachinePrecision $MachineType $MaxExtraPrecision $MaxLicenseProcesses $MaxLicenseSubprocesses $MaxMachineNumber $MaxNumber $MaxPiecewiseCases $MaxPrecision $MaxRootDegree $MessageGroups $MessageList $MessagePrePrint $Messages $MinMachineNumber $MinNumber $MinorReleaseNumber $MinPrecision $ModuleNumber $NetworkLicense $NewMessage $NewSymbol $Notebooks $NumberMarks $Off $OperatingSystem $Output $OutputForms $OutputSizeLimit $OutputStreamMethods $Packages $ParentLink $ParentProcessID $PasswordFile $PatchLevelID $Path $PathnameSeparator $PerformanceGoal $PipeSupported $Post $Pre $PreferencesDirectory $PrePrint $PreRead $PrintForms $PrintLiteral $ProcessID $ProcessorCount $ProcessorType $ProductInformation $ProgramName $RandomState $RecursionLimit $ReleaseNumber $RootDirectory $ScheduledTask $ScriptCommandLine $SessionID $SetParentLink $SharedFunctions $SharedVariables $SoundDisplay $SoundDisplayFunction $SuppressInputFormHeads $SynchronousEvaluation $SyntaxHandler $System $SystemCharacterEncoding $SystemID $SystemWordLength $TemporaryDirectory $TemporaryPrefix $TextStyle $TimedOut $TimeUnit $TimeZone $TopDirectory $TraceOff $TraceOn $TracePattern $TracePostAction $TracePreAction $Urgent $UserAddOnsDirectory $UserBaseDirectory $UserDocumentsDirectory $UserName $Version $VersionNumber',
    contains: [
      {
        className: 'comment',
        begin: /\(\*/, end: /\*\)/
      },
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.C_NUMBER_MODE,
      {
        begin: /\{/, end: /\}/,
        illegal: /:/
      }
    ]
  };
};

var matlab = /*
  Formal syntax is not published, helpful link:
  https://github.com/kornilova-l/matlab-IntelliJ-plugin/blob/master/src/main/grammar/Matlab.bnf
*/
function(hljs) {

  var TRANSPOSE_RE = '(\'|\\.\')+';
  var TRANSPOSE = {
    relevance: 0,
    contains: [
      { begin: TRANSPOSE_RE }
    ]
  };

  return {
    keywords: {
      keyword:
        'break case catch classdef continue else elseif end enumerated events for function ' +
        'global if methods otherwise parfor persistent properties return spmd switch try while',
      built_in:
        'sin sind sinh asin asind asinh cos cosd cosh acos acosd acosh tan tand tanh atan ' +
        'atand atan2 atanh sec secd sech asec asecd asech csc cscd csch acsc acscd acsch cot ' +
        'cotd coth acot acotd acoth hypot exp expm1 log log1p log10 log2 pow2 realpow reallog ' +
        'realsqrt sqrt nthroot nextpow2 abs angle complex conj imag real unwrap isreal ' +
        'cplxpair fix floor ceil round mod rem sign airy besselj bessely besselh besseli ' +
        'besselk beta betainc betaln ellipj ellipke erf erfc erfcx erfinv expint gamma ' +
        'gammainc gammaln psi legendre cross dot factor isprime primes gcd lcm rat rats perms ' +
        'nchoosek factorial cart2sph cart2pol pol2cart sph2cart hsv2rgb rgb2hsv zeros ones ' +
        'eye repmat rand randn linspace logspace freqspace meshgrid accumarray size length ' +
        'ndims numel disp isempty isequal isequalwithequalnans cat reshape diag blkdiag tril ' +
        'triu fliplr flipud flipdim rot90 find sub2ind ind2sub bsxfun ndgrid permute ipermute ' +
        'shiftdim circshift squeeze isscalar isvector ans eps realmax realmin pi i inf nan ' +
        'isnan isinf isfinite j why compan gallery hadamard hankel hilb invhilb magic pascal ' +
        'rosser toeplitz vander wilkinson max min nanmax nanmin mean nanmean type table ' +
        'readtable writetable sortrows sort figure plot plot3 scatter scatter3 cellfun ' +
        'legend intersect ismember procrustes hold num2cell '
    },
    illegal: '(//|"|#|/\\*|\\s+/\\w+)',
    contains: [
      {
        className: 'function',
        beginKeywords: 'function', end: '$',
        contains: [
          hljs.UNDERSCORE_TITLE_MODE,
          {
            className: 'params',
            variants: [
              {begin: '\\(', end: '\\)'},
              {begin: '\\[', end: '\\]'}
            ]
          }
        ]
      },
      {
        className: 'built_in',
        begin: /true|false/,
        relevance: 0,
        starts: TRANSPOSE
      },
      {
        begin: '[a-zA-Z][a-zA-Z_0-9]*' + TRANSPOSE_RE,
        relevance: 0
      },
      {
        className: 'number',
        begin: hljs.C_NUMBER_RE,
        relevance: 0,
        starts: TRANSPOSE
      },
      {
        className: 'string',
        begin: '\'', end: '\'',
        contains: [
          hljs.BACKSLASH_ESCAPE,
          {begin: '\'\''}]
      },
      {
        begin: /\]|}|\)/,
        relevance: 0,
        starts: TRANSPOSE
      },
      {
        className: 'string',
        begin: '"', end: '"',
        contains: [
          hljs.BACKSLASH_ESCAPE,
          {begin: '""'}
        ],
        starts: TRANSPOSE
      },
      hljs.COMMENT('^\\s*\\%\\{\\s*$', '^\\s*\\%\\}\\s*$'),
      hljs.COMMENT('\\%', '$')
    ]
  };
};

var maxima = function(hljs) {
  var KEYWORDS = 'if then else elseif for thru do while unless step in and or not';
  var LITERALS = 'true false unknown inf minf ind und %e %i %pi %phi %gamma';
  var BUILTIN_FUNCTIONS =
        ' abasep abs absint absolute_real_time acos acosh acot acoth acsc acsch activate'
      + ' addcol add_edge add_edges addmatrices addrow add_vertex add_vertices adjacency_matrix'
      + ' adjoin adjoint af agd airy airy_ai airy_bi airy_dai airy_dbi algsys alg_type'
      + ' alias allroots alphacharp alphanumericp amortization %and annuity_fv'
      + ' annuity_pv antid antidiff AntiDifference append appendfile apply apply1 apply2'
      + ' applyb1 apropos args arit_amortization arithmetic arithsum array arrayapply'
      + ' arrayinfo arraymake arraysetapply ascii asec asech asin asinh askinteger'
      + ' asksign assoc assoc_legendre_p assoc_legendre_q assume assume_external_byte_order'
      + ' asympa at atan atan2 atanh atensimp atom atvalue augcoefmatrix augmented_lagrangian_method'
      + ' av average_degree backtrace bars barsplot barsplot_description base64 base64_decode'
      + ' bashindices batch batchload bc2 bdvac belln benefit_cost bern bernpoly bernstein_approx'
      + ' bernstein_expand bernstein_poly bessel bessel_i bessel_j bessel_k bessel_simplify'
      + ' bessel_y beta beta_incomplete beta_incomplete_generalized beta_incomplete_regularized'
      + ' bezout bfallroots bffac bf_find_root bf_fmin_cobyla bfhzeta bfloat bfloatp'
      + ' bfpsi bfpsi0 bfzeta biconnected_components bimetric binomial bipartition'
      + ' block blockmatrixp bode_gain bode_phase bothcoef box boxplot boxplot_description'
      + ' break bug_report build_info|10 buildq build_sample burn cabs canform canten'
      + ' cardinality carg cartan cartesian_product catch cauchy_matrix cbffac cdf_bernoulli'
      + ' cdf_beta cdf_binomial cdf_cauchy cdf_chi2 cdf_continuous_uniform cdf_discrete_uniform'
      + ' cdf_exp cdf_f cdf_gamma cdf_general_finite_discrete cdf_geometric cdf_gumbel'
      + ' cdf_hypergeometric cdf_laplace cdf_logistic cdf_lognormal cdf_negative_binomial'
      + ' cdf_noncentral_chi2 cdf_noncentral_student_t cdf_normal cdf_pareto cdf_poisson'
      + ' cdf_rank_sum cdf_rayleigh cdf_signed_rank cdf_student_t cdf_weibull cdisplay'
      + ' ceiling central_moment cequal cequalignore cf cfdisrep cfexpand cgeodesic'
      + ' cgreaterp cgreaterpignore changename changevar chaosgame charat charfun charfun2'
      + ' charlist charp charpoly chdir chebyshev_t chebyshev_u checkdiv check_overlaps'
      + ' chinese cholesky christof chromatic_index chromatic_number cint circulant_graph'
      + ' clear_edge_weight clear_rules clear_vertex_label clebsch_gordan clebsch_graph'
      + ' clessp clesspignore close closefile cmetric coeff coefmatrix cograd col collapse'
      + ' collectterms columnop columnspace columnswap columnvector combination combine'
      + ' comp2pui compare compfile compile compile_file complement_graph complete_bipartite_graph'
      + ' complete_graph complex_number_p components compose_functions concan concat'
      + ' conjugate conmetderiv connected_components connect_vertices cons constant'
      + ' constantp constituent constvalue cont2part content continuous_freq contortion'
      + ' contour_plot contract contract_edge contragrad contrib_ode convert coord'
      + ' copy copy_file copy_graph copylist copymatrix cor cos cosh cot coth cov cov1'
      + ' covdiff covect covers crc24sum create_graph create_list csc csch csetup cspline'
      + ' ctaylor ct_coordsys ctransform ctranspose cube_graph cuboctahedron_graph'
      + ' cunlisp cv cycle_digraph cycle_graph cylindrical days360 dblint deactivate'
      + ' declare declare_constvalue declare_dimensions declare_fundamental_dimensions'
      + ' declare_fundamental_units declare_qty declare_translated declare_unit_conversion'
      + ' declare_units declare_weights decsym defcon define define_alt_display define_variable'
      + ' defint defmatch defrule defstruct deftaylor degree_sequence del delete deleten'
      + ' delta demo demoivre denom depends derivdegree derivlist describe desolve'
      + ' determinant dfloat dgauss_a dgauss_b dgeev dgemm dgeqrf dgesv dgesvd diag'
      + ' diagmatrix diag_matrix diagmatrixp diameter diff digitcharp dimacs_export'
      + ' dimacs_import dimension dimensionless dimensions dimensions_as_list direct'
      + ' directory discrete_freq disjoin disjointp disolate disp dispcon dispform'
      + ' dispfun dispJordan display disprule dispterms distrib divide divisors divsum'
      + ' dkummer_m dkummer_u dlange dodecahedron_graph dotproduct dotsimp dpart'
      + ' draw draw2d draw3d drawdf draw_file draw_graph dscalar echelon edge_coloring'
      + ' edge_connectivity edges eigens_by_jacobi eigenvalues eigenvectors eighth'
      + ' einstein eivals eivects elapsed_real_time elapsed_run_time ele2comp ele2polynome'
      + ' ele2pui elem elementp elevation_grid elim elim_allbut eliminate eliminate_using'
      + ' ellipse elliptic_e elliptic_ec elliptic_eu elliptic_f elliptic_kc elliptic_pi'
      + ' ematrix empty_graph emptyp endcons entermatrix entertensor entier equal equalp'
      + ' equiv_classes erf erfc erf_generalized erfi errcatch error errormsg errors'
      + ' euler ev eval_string evenp every evolution evolution2d evundiff example exp'
      + ' expand expandwrt expandwrt_factored expint expintegral_chi expintegral_ci'
      + ' expintegral_e expintegral_e1 expintegral_ei expintegral_e_simplify expintegral_li'
      + ' expintegral_shi expintegral_si explicit explose exponentialize express expt'
      + ' exsec extdiff extract_linear_equations extremal_subset ezgcd %f f90 facsum'
      + ' factcomb factor factorfacsum factorial factorout factorsum facts fast_central_elements'
      + ' fast_linsolve fasttimes featurep fernfale fft fib fibtophi fifth filename_merge'
      + ' file_search file_type fillarray findde find_root find_root_abs find_root_error'
      + ' find_root_rel first fix flatten flength float floatnump floor flower_snark'
      + ' flush flush1deriv flushd flushnd flush_output fmin_cobyla forget fortran'
      + ' fourcos fourexpand fourier fourier_elim fourint fourintcos fourintsin foursimp'
      + ' foursin fourth fposition frame_bracket freeof freshline fresnel_c fresnel_s'
      + ' from_adjacency_matrix frucht_graph full_listify fullmap fullmapl fullratsimp'
      + ' fullratsubst fullsetify funcsolve fundamental_dimensions fundamental_units'
      + ' fundef funmake funp fv g0 g1 gamma gamma_greek gamma_incomplete gamma_incomplete_generalized'
      + ' gamma_incomplete_regularized gauss gauss_a gauss_b gaussprob gcd gcdex gcdivide'
      + ' gcfac gcfactor gd generalized_lambert_w genfact gen_laguerre genmatrix gensym'
      + ' geo_amortization geo_annuity_fv geo_annuity_pv geomap geometric geometric_mean'
      + ' geosum get getcurrentdirectory get_edge_weight getenv get_lu_factors get_output_stream_string'
      + ' get_pixel get_plot_option get_tex_environment get_tex_environment_default'
      + ' get_vertex_label gfactor gfactorsum ggf girth global_variances gn gnuplot_close'
      + ' gnuplot_replot gnuplot_reset gnuplot_restart gnuplot_start go Gosper GosperSum'
      + ' gr2d gr3d gradef gramschmidt graph6_decode graph6_encode graph6_export graph6_import'
      + ' graph_center graph_charpoly graph_eigenvalues graph_flow graph_order graph_periphery'
      + ' graph_product graph_size graph_union great_rhombicosidodecahedron_graph great_rhombicuboctahedron_graph'
      + ' grid_graph grind grobner_basis grotzch_graph hamilton_cycle hamilton_path'
      + ' hankel hankel_1 hankel_2 harmonic harmonic_mean hav heawood_graph hermite'
      + ' hessian hgfred hilbertmap hilbert_matrix hipow histogram histogram_description'
      + ' hodge horner hypergeometric i0 i1 %ibes ic1 ic2 ic_convert ichr1 ichr2 icosahedron_graph'
      + ' icosidodecahedron_graph icurvature ident identfor identity idiff idim idummy'
      + ' ieqn %if ifactors iframes ifs igcdex igeodesic_coords ilt image imagpart'
      + ' imetric implicit implicit_derivative implicit_plot indexed_tensor indices'
      + ' induced_subgraph inferencep inference_result infix info_display init_atensor'
      + ' init_ctensor in_neighbors innerproduct inpart inprod inrt integerp integer_partitions'
      + ' integrate intersect intersection intervalp intopois intosum invariant1 invariant2'
      + ' inverse_fft inverse_jacobi_cd inverse_jacobi_cn inverse_jacobi_cs inverse_jacobi_dc'
      + ' inverse_jacobi_dn inverse_jacobi_ds inverse_jacobi_nc inverse_jacobi_nd inverse_jacobi_ns'
      + ' inverse_jacobi_sc inverse_jacobi_sd inverse_jacobi_sn invert invert_by_adjoint'
      + ' invert_by_lu inv_mod irr is is_biconnected is_bipartite is_connected is_digraph'
      + ' is_edge_in_graph is_graph is_graph_or_digraph ishow is_isomorphic isolate'
      + ' isomorphism is_planar isqrt isreal_p is_sconnected is_tree is_vertex_in_graph'
      + ' items_inference %j j0 j1 jacobi jacobian jacobi_cd jacobi_cn jacobi_cs jacobi_dc'
      + ' jacobi_dn jacobi_ds jacobi_nc jacobi_nd jacobi_ns jacobi_p jacobi_sc jacobi_sd'
      + ' jacobi_sn JF jn join jordan julia julia_set julia_sin %k kdels kdelta kill'
      + ' killcontext kostka kron_delta kronecker_product kummer_m kummer_u kurtosis'
      + ' kurtosis_bernoulli kurtosis_beta kurtosis_binomial kurtosis_chi2 kurtosis_continuous_uniform'
      + ' kurtosis_discrete_uniform kurtosis_exp kurtosis_f kurtosis_gamma kurtosis_general_finite_discrete'
      + ' kurtosis_geometric kurtosis_gumbel kurtosis_hypergeometric kurtosis_laplace'
      + ' kurtosis_logistic kurtosis_lognormal kurtosis_negative_binomial kurtosis_noncentral_chi2'
      + ' kurtosis_noncentral_student_t kurtosis_normal kurtosis_pareto kurtosis_poisson'
      + ' kurtosis_rayleigh kurtosis_student_t kurtosis_weibull label labels lagrange'
      + ' laguerre lambda lambert_w laplace laplacian_matrix last lbfgs lc2kdt lcharp'
      + ' lc_l lcm lc_u ldefint ldisp ldisplay legendre_p legendre_q leinstein length'
      + ' let letrules letsimp levi_civita lfreeof lgtreillis lhs li liediff limit'
      + ' Lindstedt linear linearinterpol linear_program linear_regression line_graph'
      + ' linsolve listarray list_correlations listify list_matrix_entries list_nc_monomials'
      + ' listoftens listofvars listp lmax lmin load loadfile local locate_matrix_entry'
      + ' log logcontract log_gamma lopow lorentz_gauge lowercasep lpart lratsubst'
      + ' lreduce lriemann lsquares_estimates lsquares_estimates_approximate lsquares_estimates_exact'
      + ' lsquares_mse lsquares_residual_mse lsquares_residuals lsum ltreillis lu_backsub'
      + ' lucas lu_factor %m macroexpand macroexpand1 make_array makebox makefact makegamma'
      + ' make_graph make_level_picture makelist makeOrders make_poly_continent make_poly_country'
      + ' make_polygon make_random_state make_rgb_picture makeset make_string_input_stream'
      + ' make_string_output_stream make_transform mandelbrot mandelbrot_set map mapatom'
      + ' maplist matchdeclare matchfix mat_cond mat_fullunblocker mat_function mathml_display'
      + ' mat_norm matrix matrixmap matrixp matrix_size mattrace mat_trace mat_unblocker'
      + ' max max_clique max_degree max_flow maximize_lp max_independent_set max_matching'
      + ' maybe md5sum mean mean_bernoulli mean_beta mean_binomial mean_chi2 mean_continuous_uniform'
      + ' mean_deviation mean_discrete_uniform mean_exp mean_f mean_gamma mean_general_finite_discrete'
      + ' mean_geometric mean_gumbel mean_hypergeometric mean_laplace mean_logistic'
      + ' mean_lognormal mean_negative_binomial mean_noncentral_chi2 mean_noncentral_student_t'
      + ' mean_normal mean_pareto mean_poisson mean_rayleigh mean_student_t mean_weibull'
      + ' median median_deviation member mesh metricexpandall mgf1_sha1 min min_degree'
      + ' min_edge_cut minfactorial minimalPoly minimize_lp minimum_spanning_tree minor'
      + ' minpack_lsquares minpack_solve min_vertex_cover min_vertex_cut mkdir mnewton'
      + ' mod mode_declare mode_identity ModeMatrix moebius mon2schur mono monomial_dimensions'
      + ' multibernstein_poly multi_display_for_texinfo multi_elem multinomial multinomial_coeff'
      + ' multi_orbit multiplot_mode multi_pui multsym multthru mycielski_graph nary'
      + ' natural_unit nc_degree ncexpt ncharpoly negative_picture neighbors new newcontext'
      + ' newdet new_graph newline newton new_variable next_prime nicedummies niceindices'
      + ' ninth nofix nonarray noncentral_moment nonmetricity nonnegintegerp nonscalarp'
      + ' nonzeroandfreeof notequal nounify nptetrad npv nroots nterms ntermst'
      + ' nthroot nullity nullspace num numbered_boundaries numberp number_to_octets'
      + ' num_distinct_partitions numerval numfactor num_partitions nusum nzeta nzetai'
      + ' nzetar octets_to_number octets_to_oid odd_girth oddp ode2 ode_check odelin'
      + ' oid_to_octets op opena opena_binary openr openr_binary openw openw_binary'
      + ' operatorp opsubst optimize %or orbit orbits ordergreat ordergreatp orderless'
      + ' orderlessp orthogonal_complement orthopoly_recur orthopoly_weight outermap'
      + ' out_neighbors outofpois pade parabolic_cylinder_d parametric parametric_surface'
      + ' parg parGosper parse_string parse_timedate part part2cont partfrac partition'
      + ' partition_set partpol path_digraph path_graph pathname_directory pathname_name'
      + ' pathname_type pdf_bernoulli pdf_beta pdf_binomial pdf_cauchy pdf_chi2 pdf_continuous_uniform'
      + ' pdf_discrete_uniform pdf_exp pdf_f pdf_gamma pdf_general_finite_discrete'
      + ' pdf_geometric pdf_gumbel pdf_hypergeometric pdf_laplace pdf_logistic pdf_lognormal'
      + ' pdf_negative_binomial pdf_noncentral_chi2 pdf_noncentral_student_t pdf_normal'
      + ' pdf_pareto pdf_poisson pdf_rank_sum pdf_rayleigh pdf_signed_rank pdf_student_t'
      + ' pdf_weibull pearson_skewness permanent permut permutation permutations petersen_graph'
      + ' petrov pickapart picture_equalp picturep piechart piechart_description planar_embedding'
      + ' playback plog plot2d plot3d plotdf ploteq plsquares pochhammer points poisdiff'
      + ' poisexpt poisint poismap poisplus poissimp poissubst poistimes poistrim polar'
      + ' polarform polartorect polar_to_xy poly_add poly_buchberger poly_buchberger_criterion'
      + ' poly_colon_ideal poly_content polydecomp poly_depends_p poly_elimination_ideal'
      + ' poly_exact_divide poly_expand poly_expt poly_gcd polygon poly_grobner poly_grobner_equal'
      + ' poly_grobner_member poly_grobner_subsetp poly_ideal_intersection poly_ideal_polysaturation'
      + ' poly_ideal_polysaturation1 poly_ideal_saturation poly_ideal_saturation1 poly_lcm'
      + ' poly_minimization polymod poly_multiply polynome2ele polynomialp poly_normal_form'
      + ' poly_normalize poly_normalize_list poly_polysaturation_extension poly_primitive_part'
      + ' poly_pseudo_divide poly_reduced_grobner poly_reduction poly_saturation_extension'
      + ' poly_s_polynomial poly_subtract polytocompanion pop postfix potential power_mod'
      + ' powerseries powerset prefix prev_prime primep primes principal_components'
      + ' print printf printfile print_graph printpois printprops prodrac product properties'
      + ' propvars psi psubst ptriangularize pui pui2comp pui2ele pui2polynome pui_direct'
      + ' puireduc push put pv qput qrange qty quad_control quad_qag quad_qagi quad_qagp'
      + ' quad_qags quad_qawc quad_qawf quad_qawo quad_qaws quadrilateral quantile'
      + ' quantile_bernoulli quantile_beta quantile_binomial quantile_cauchy quantile_chi2'
      + ' quantile_continuous_uniform quantile_discrete_uniform quantile_exp quantile_f'
      + ' quantile_gamma quantile_general_finite_discrete quantile_geometric quantile_gumbel'
      + ' quantile_hypergeometric quantile_laplace quantile_logistic quantile_lognormal'
      + ' quantile_negative_binomial quantile_noncentral_chi2 quantile_noncentral_student_t'
      + ' quantile_normal quantile_pareto quantile_poisson quantile_rayleigh quantile_student_t'
      + ' quantile_weibull quartile_skewness quit qunit quotient racah_v racah_w radcan'
      + ' radius random random_bernoulli random_beta random_binomial random_bipartite_graph'
      + ' random_cauchy random_chi2 random_continuous_uniform random_digraph random_discrete_uniform'
      + ' random_exp random_f random_gamma random_general_finite_discrete random_geometric'
      + ' random_graph random_graph1 random_gumbel random_hypergeometric random_laplace'
      + ' random_logistic random_lognormal random_negative_binomial random_network'
      + ' random_noncentral_chi2 random_noncentral_student_t random_normal random_pareto'
      + ' random_permutation random_poisson random_rayleigh random_regular_graph random_student_t'
      + ' random_tournament random_tree random_weibull range rank rat ratcoef ratdenom'
      + ' ratdiff ratdisrep ratexpand ratinterpol rational rationalize ratnumer ratnump'
      + ' ratp ratsimp ratsubst ratvars ratweight read read_array read_binary_array'
      + ' read_binary_list read_binary_matrix readbyte readchar read_hashed_array readline'
      + ' read_list read_matrix read_nested_list readonly read_xpm real_imagpart_to_conjugate'
      + ' realpart realroots rearray rectangle rectform rectform_log_if_constant recttopolar'
      + ' rediff reduce_consts reduce_order region region_boundaries region_boundaries_plus'
      + ' rem remainder remarray rembox remcomps remcon remcoord remfun remfunction'
      + ' remlet remove remove_constvalue remove_dimensions remove_edge remove_fundamental_dimensions'
      + ' remove_fundamental_units remove_plot_option remove_vertex rempart remrule'
      + ' remsym remvalue rename rename_file reset reset_displays residue resolvante'
      + ' resolvante_alternee1 resolvante_bipartite resolvante_diedrale resolvante_klein'
      + ' resolvante_klein3 resolvante_produit_sym resolvante_unitaire resolvante_vierer'
      + ' rest resultant return reveal reverse revert revert2 rgb2level rhs ricci riemann'
      + ' rinvariant risch rk rmdir rncombine romberg room rootscontract round row'
      + ' rowop rowswap rreduce run_testsuite %s save saving scalarp scaled_bessel_i'
      + ' scaled_bessel_i0 scaled_bessel_i1 scalefactors scanmap scatterplot scatterplot_description'
      + ' scene schur2comp sconcat scopy scsimp scurvature sdowncase sec sech second'
      + ' sequal sequalignore set_alt_display setdifference set_draw_defaults set_edge_weight'
      + ' setelmx setequalp setify setp set_partitions set_plot_option set_prompt set_random_state'
      + ' set_tex_environment set_tex_environment_default setunits setup_autoload set_up_dot_simplifications'
      + ' set_vertex_label seventh sexplode sf sha1sum sha256sum shortest_path shortest_weighted_path'
      + ' show showcomps showratvars sierpinskiale sierpinskimap sign signum similaritytransform'
      + ' simp_inequality simplify_sum simplode simpmetderiv simtran sin sinh sinsert'
      + ' sinvertcase sixth skewness skewness_bernoulli skewness_beta skewness_binomial'
      + ' skewness_chi2 skewness_continuous_uniform skewness_discrete_uniform skewness_exp'
      + ' skewness_f skewness_gamma skewness_general_finite_discrete skewness_geometric'
      + ' skewness_gumbel skewness_hypergeometric skewness_laplace skewness_logistic'
      + ' skewness_lognormal skewness_negative_binomial skewness_noncentral_chi2 skewness_noncentral_student_t'
      + ' skewness_normal skewness_pareto skewness_poisson skewness_rayleigh skewness_student_t'
      + ' skewness_weibull slength smake small_rhombicosidodecahedron_graph small_rhombicuboctahedron_graph'
      + ' smax smin smismatch snowmap snub_cube_graph snub_dodecahedron_graph solve'
      + ' solve_rec solve_rec_rat some somrac sort sparse6_decode sparse6_encode sparse6_export'
      + ' sparse6_import specint spherical spherical_bessel_j spherical_bessel_y spherical_hankel1'
      + ' spherical_hankel2 spherical_harmonic spherical_to_xyz splice split sposition'
      + ' sprint sqfr sqrt sqrtdenest sremove sremovefirst sreverse ssearch ssort sstatus'
      + ' ssubst ssubstfirst staircase standardize standardize_inverse_trig starplot'
      + ' starplot_description status std std1 std_bernoulli std_beta std_binomial'
      + ' std_chi2 std_continuous_uniform std_discrete_uniform std_exp std_f std_gamma'
      + ' std_general_finite_discrete std_geometric std_gumbel std_hypergeometric std_laplace'
      + ' std_logistic std_lognormal std_negative_binomial std_noncentral_chi2 std_noncentral_student_t'
      + ' std_normal std_pareto std_poisson std_rayleigh std_student_t std_weibull'
      + ' stemplot stirling stirling1 stirling2 strim striml strimr string stringout'
      + ' stringp strong_components struve_h struve_l sublis sublist sublist_indices'
      + ' submatrix subsample subset subsetp subst substinpart subst_parallel substpart'
      + ' substring subvar subvarp sum sumcontract summand_to_rec supcase supcontext'
      + ' symbolp symmdifference symmetricp system take_channel take_inference tan'
      + ' tanh taylor taylorinfo taylorp taylor_simplifier taytorat tcl_output tcontract'
      + ' tellrat tellsimp tellsimpafter tentex tenth test_mean test_means_difference'
      + ' test_normality test_proportion test_proportions_difference test_rank_sum'
      + ' test_sign test_signed_rank test_variance test_variance_ratio tex tex1 tex_display'
      + ' texput %th third throw time timedate timer timer_info tldefint tlimit todd_coxeter'
      + ' toeplitz tokens to_lisp topological_sort to_poly to_poly_solve totaldisrep'
      + ' totalfourier totient tpartpol trace tracematrix trace_options transform_sample'
      + ' translate translate_file transpose treefale tree_reduce treillis treinat'
      + ' triangle triangularize trigexpand trigrat trigreduce trigsimp trunc truncate'
      + ' truncated_cube_graph truncated_dodecahedron_graph truncated_icosahedron_graph'
      + ' truncated_tetrahedron_graph tr_warnings_get tube tutte_graph ueivects uforget'
      + ' ultraspherical underlying_graph undiff union unique uniteigenvectors unitp'
      + ' units unit_step unitvector unorder unsum untellrat untimer'
      + ' untrace uppercasep uricci uriemann uvect vandermonde_matrix var var1 var_bernoulli'
      + ' var_beta var_binomial var_chi2 var_continuous_uniform var_discrete_uniform'
      + ' var_exp var_f var_gamma var_general_finite_discrete var_geometric var_gumbel'
      + ' var_hypergeometric var_laplace var_logistic var_lognormal var_negative_binomial'
      + ' var_noncentral_chi2 var_noncentral_student_t var_normal var_pareto var_poisson'
      + ' var_rayleigh var_student_t var_weibull vector vectorpotential vectorsimp'
      + ' verbify vers vertex_coloring vertex_connectivity vertex_degree vertex_distance'
      + ' vertex_eccentricity vertex_in_degree vertex_out_degree vertices vertices_to_cycle'
      + ' vertices_to_path %w weyl wheel_graph wiener_index wigner_3j wigner_6j'
      + ' wigner_9j with_stdout write_binary_data writebyte write_data writefile wronskian'
      + ' xreduce xthru %y Zeilberger zeroequiv zerofor zeromatrix zeromatrixp zeta'
      + ' zgeev zheev zlange zn_add_table zn_carmichael_lambda zn_characteristic_factors'
      + ' zn_determinant zn_factor_generators zn_invert_by_lu zn_log zn_mult_table'
      + ' absboxchar activecontexts adapt_depth additive adim aform algebraic'
      + ' algepsilon algexact aliases allbut all_dotsimp_denoms allocation allsym alphabetic'
      + ' animation antisymmetric arrays askexp assume_pos assume_pos_pred assumescalar'
      + ' asymbol atomgrad atrig1 axes axis_3d axis_bottom axis_left axis_right axis_top'
      + ' azimuth background background_color backsubst berlefact bernstein_explicit'
      + ' besselexpand beta_args_sum_to_integer beta_expand bftorat bftrunc bindtest'
      + ' border boundaries_array box boxchar breakup %c capping cauchysum cbrange'
      + ' cbtics center cflength cframe_flag cnonmet_flag color color_bar color_bar_tics'
      + ' colorbox columns commutative complex cone context contexts contour contour_levels'
      + ' cosnpiflag ctaypov ctaypt ctayswitch ctayvar ct_coords ctorsion_flag ctrgsimp'
      + ' cube current_let_rule_package cylinder data_file_name debugmode decreasing'
      + ' default_let_rule_package delay dependencies derivabbrev derivsubst detout'
      + ' diagmetric diff dim dimensions dispflag display2d|10 display_format_internal'
      + ' distribute_over doallmxops domain domxexpt domxmxops domxnctimes dontfactor'
      + ' doscmxops doscmxplus dot0nscsimp dot0simp dot1simp dotassoc dotconstrules'
      + ' dotdistrib dotexptsimp dotident dotscrules draw_graph_program draw_realpart'
      + ' edge_color edge_coloring edge_partition edge_type edge_width %edispflag'
      + ' elevation %emode endphi endtheta engineering_format_floats enhanced3d %enumer'
      + ' epsilon_lp erfflag erf_representation errormsg error_size error_syms error_type'
      + ' %e_to_numlog eval even evenfun evflag evfun ev_point expandwrt_denom expintexpand'
      + ' expintrep expon expop exptdispflag exptisolate exptsubst facexpand facsum_combine'
      + ' factlim factorflag factorial_expand factors_only fb feature features'
      + ' file_name file_output_append file_search_demo file_search_lisp file_search_maxima|10'
      + ' file_search_tests file_search_usage file_type_lisp file_type_maxima|10 fill_color'
      + ' fill_density filled_func fixed_vertices flipflag float2bf font font_size'
      + ' fortindent fortspaces fpprec fpprintprec functions gamma_expand gammalim'
      + ' gdet genindex gensumnum GGFCFMAX GGFINFINITY globalsolve gnuplot_command'
      + ' gnuplot_curve_styles gnuplot_curve_titles gnuplot_default_term_command gnuplot_dumb_term_command'
      + ' gnuplot_file_args gnuplot_file_name gnuplot_out_file gnuplot_pdf_term_command'
      + ' gnuplot_pm3d gnuplot_png_term_command gnuplot_postamble gnuplot_preamble'
      + ' gnuplot_ps_term_command gnuplot_svg_term_command gnuplot_term gnuplot_view_args'
      + ' Gosper_in_Zeilberger gradefs grid grid2d grind halfangles head_angle head_both'
      + ' head_length head_type height hypergeometric_representation %iargs ibase'
      + ' icc1 icc2 icounter idummyx ieqnprint ifb ifc1 ifc2 ifg ifgi ifr iframe_bracket_form'
      + ' ifri igeowedge_flag ikt1 ikt2 imaginary inchar increasing infeval'
      + ' infinity inflag infolists inm inmc1 inmc2 intanalysis integer integervalued'
      + ' integrate_use_rootsof integration_constant integration_constant_counter interpolate_color'
      + ' intfaclim ip_grid ip_grid_in irrational isolate_wrt_times iterations itr'
      + ' julia_parameter %k1 %k2 keepfloat key key_pos kinvariant kt label label_alignment'
      + ' label_orientation labels lassociative lbfgs_ncorrections lbfgs_nfeval_max'
      + ' leftjust legend letrat let_rule_packages lfg lg lhospitallim limsubst linear'
      + ' linear_solver linechar linel|10 linenum line_type linewidth line_width linsolve_params'
      + ' linsolvewarn lispdisp listarith listconstvars listdummyvars lmxchar load_pathname'
      + ' loadprint logabs logarc logcb logconcoeffp logexpand lognegint logsimp logx'
      + ' logx_secondary logy logy_secondary logz lriem m1pbranch macroexpansion macros'
      + ' mainvar manual_demo maperror mapprint matrix_element_add matrix_element_mult'
      + ' matrix_element_transpose maxapplydepth maxapplyheight maxima_tempdir|10 maxima_userdir|10'
      + ' maxnegex MAX_ORD maxposex maxpsifracdenom maxpsifracnum maxpsinegint maxpsiposint'
      + ' maxtayorder mesh_lines_color method mod_big_prime mode_check_errorp'
      + ' mode_checkp mode_check_warnp mod_test mod_threshold modular_linear_solver'
      + ' modulus multiplicative multiplicities myoptions nary negdistrib negsumdispflag'
      + ' newline newtonepsilon newtonmaxiter nextlayerfactor niceindicespref nm nmc'
      + ' noeval nolabels nonegative_lp noninteger nonscalar noun noundisp nouns np'
      + ' npi nticks ntrig numer numer_pbranch obase odd oddfun opacity opproperties'
      + ' opsubst optimprefix optionset orientation origin orthopoly_returns_intervals'
      + ' outative outchar packagefile palette partswitch pdf_file pfeformat phiresolution'
      + ' %piargs piece pivot_count_sx pivot_max_sx plot_format plot_options plot_realpart'
      + ' png_file pochhammer_max_index points pointsize point_size points_joined point_type'
      + ' poislim poisson poly_coefficient_ring poly_elimination_order polyfactor poly_grobner_algorithm'
      + ' poly_grobner_debug poly_monomial_order poly_primary_elimination_order poly_return_term_list'
      + ' poly_secondary_elimination_order poly_top_reduction_only posfun position'
      + ' powerdisp pred prederror primep_number_of_tests product_use_gamma program'
      + ' programmode promote_float_to_bigfloat prompt proportional_axes props psexpand'
      + ' ps_file radexpand radius radsubstflag rassociative ratalgdenom ratchristof'
      + ' ratdenomdivide rateinstein ratepsilon ratfac rational ratmx ratprint ratriemann'
      + ' ratsimpexpons ratvarswitch ratweights ratweyl ratwtlvl real realonly redraw'
      + ' refcheck resolution restart resultant ric riem rmxchar %rnum_list rombergabs'
      + ' rombergit rombergmin rombergtol rootsconmode rootsepsilon run_viewer same_xy'
      + ' same_xyz savedef savefactors scalar scalarmatrixp scale scale_lp setcheck'
      + ' setcheckbreak setval show_edge_color show_edges show_edge_type show_edge_width'
      + ' show_id show_label showtime show_vertex_color show_vertex_size show_vertex_type'
      + ' show_vertices show_weight simp simplified_output simplify_products simpproduct'
      + ' simpsum sinnpiflag solvedecomposes solveexplicit solvefactors solvenullwarn'
      + ' solveradcan solvetrigwarn space sparse sphere spring_embedding_depth sqrtdispflag'
      + ' stardisp startphi starttheta stats_numer stringdisp structures style sublis_apply_lambda'
      + ' subnumsimp sumexpand sumsplitfact surface surface_hide svg_file symmetric'
      + ' tab taylordepth taylor_logexpand taylor_order_coefficients taylor_truncate_polynomials'
      + ' tensorkill terminal testsuite_files thetaresolution timer_devalue title tlimswitch'
      + ' tr track transcompile transform transform_xy translate_fast_arrays transparent'
      + ' transrun tr_array_as_ref tr_bound_function_applyp tr_file_tty_messagesp tr_float_can_branch_complex'
      + ' tr_function_call_default trigexpandplus trigexpandtimes triginverses trigsign'
      + ' trivial_solutions tr_numer tr_optimize_max_loop tr_semicompile tr_state_vars'
      + ' tr_warn_bad_function_calls tr_warn_fexpr tr_warn_meval tr_warn_mode'
      + ' tr_warn_undeclared tr_warn_undefined_variable tstep ttyoff tube_extremes'
      + ' ufg ug %unitexpand unit_vectors uric uriem use_fast_arrays user_preamble'
      + ' usersetunits values vect_cross verbose vertex_color vertex_coloring vertex_partition'
      + ' vertex_size vertex_type view warnings weyl width windowname windowtitle wired_surface'
      + ' wireframe xaxis xaxis_color xaxis_secondary xaxis_type xaxis_width xlabel'
      + ' xlabel_secondary xlength xrange xrange_secondary xtics xtics_axis xtics_rotate'
      + ' xtics_rotate_secondary xtics_secondary xtics_secondary_axis xu_grid x_voxel'
      + ' xy_file xyplane xy_scale yaxis yaxis_color yaxis_secondary yaxis_type yaxis_width'
      + ' ylabel ylabel_secondary ylength yrange yrange_secondary ytics ytics_axis'
      + ' ytics_rotate ytics_rotate_secondary ytics_secondary ytics_secondary_axis'
      + ' yv_grid y_voxel yx_ratio zaxis zaxis_color zaxis_type zaxis_width zeroa zerob'
      + ' zerobern zeta%pi zlabel zlabel_rotate zlength zmin zn_primroot_limit zn_primroot_pretest';
  var SYMBOLS = '_ __ %|0 %%|0';

  return {
    lexemes: '[A-Za-z_%][0-9A-Za-z_%]*',
    keywords: {
      keyword: KEYWORDS,
      literal: LITERALS,
      built_in: BUILTIN_FUNCTIONS,
      symbol: SYMBOLS,
    },
    contains: [
      {
        className: 'comment',
        begin: '/\\*',
        end: '\\*/',
        contains: ['self']
      },
      hljs.QUOTE_STRING_MODE,
      {
        className: 'number',
        relevance: 0,
        variants: [
          {
            // float number w/ exponent
            // hmm, I wonder if we ought to include other exponent markers?
            begin: '\\b(\\d+|\\d+\\.|\\.\\d+|\\d+\\.\\d+)[Ee][-+]?\\d+\\b',
          },
          {
            // bigfloat number
            begin: '\\b(\\d+|\\d+\\.|\\.\\d+|\\d+\\.\\d+)[Bb][-+]?\\d+\\b',
            relevance: 10
          },
          {
            // float number w/out exponent
            // Doesn't seem to recognize floats which start with '.'
            begin: '\\b(\\.\\d+|\\d+\\.\\d+)\\b',
          },
          {
            // integer in base up to 36
            // Doesn't seem to recognize integers which end with '.'
            begin: '\\b(\\d+|0[0-9A-Za-z]+)\\.?\\b',
          }
        ]
      }
    ],
    illegal: /@/
  }
};

var mel = function(hljs) {
  return {
    keywords:
      'int float string vector matrix if else switch case default while do for in break ' +
      'continue global proc return about abs addAttr addAttributeEditorNodeHelp addDynamic ' +
      'addNewShelfTab addPP addPanelCategory addPrefixToName advanceToNextDrivenKey ' +
      'affectedNet affects aimConstraint air alias aliasAttr align alignCtx alignCurve ' +
      'alignSurface allViewFit ambientLight angle angleBetween animCone animCurveEditor ' +
      'animDisplay animView annotate appendStringArray applicationName applyAttrPreset ' +
      'applyTake arcLenDimContext arcLengthDimension arclen arrayMapper art3dPaintCtx ' +
      'artAttrCtx artAttrPaintVertexCtx artAttrSkinPaintCtx artAttrTool artBuildPaintMenu ' +
      'artFluidAttrCtx artPuttyCtx artSelectCtx artSetPaintCtx artUserPaintCtx assignCommand ' +
      'assignInputDevice assignViewportFactories attachCurve attachDeviceAttr attachSurface ' +
      'attrColorSliderGrp attrCompatibility attrControlGrp attrEnumOptionMenu ' +
      'attrEnumOptionMenuGrp attrFieldGrp attrFieldSliderGrp attrNavigationControlGrp ' +
      'attrPresetEditWin attributeExists attributeInfo attributeMenu attributeQuery ' +
      'autoKeyframe autoPlace bakeClip bakeFluidShading bakePartialHistory bakeResults ' +
      'bakeSimulation basename basenameEx batchRender bessel bevel bevelPlus binMembership ' +
      'bindSkin blend2 blendShape blendShapeEditor blendShapePanel blendTwoAttr blindDataType ' +
      'boneLattice boundary boxDollyCtx boxZoomCtx bufferCurve buildBookmarkMenu ' +
      'buildKeyframeMenu button buttonManip CBG cacheFile cacheFileCombine cacheFileMerge ' +
      'cacheFileTrack camera cameraView canCreateManip canvas capitalizeString catch ' +
      'catchQuiet ceil changeSubdivComponentDisplayLevel changeSubdivRegion channelBox ' +
      'character characterMap characterOutlineEditor characterize chdir checkBox checkBoxGrp ' +
      'checkDefaultRenderGlobals choice circle circularFillet clamp clear clearCache clip ' +
      'clipEditor clipEditorCurrentTimeCtx clipSchedule clipSchedulerOutliner clipTrimBefore ' +
      'closeCurve closeSurface cluster cmdFileOutput cmdScrollFieldExecuter ' +
      'cmdScrollFieldReporter cmdShell coarsenSubdivSelectionList collision color ' +
      'colorAtPoint colorEditor colorIndex colorIndexSliderGrp colorSliderButtonGrp ' +
      'colorSliderGrp columnLayout commandEcho commandLine commandPort compactHairSystem ' +
      'componentEditor compositingInterop computePolysetVolume condition cone confirmDialog ' +
      'connectAttr connectControl connectDynamic connectJoint connectionInfo constrain ' +
      'constrainValue constructionHistory container containsMultibyte contextInfo control ' +
      'convertFromOldLayers convertIffToPsd convertLightmap convertSolidTx convertTessellation ' +
      'convertUnit copyArray copyFlexor copyKey copySkinWeights cos cpButton cpCache ' +
      'cpClothSet cpCollision cpConstraint cpConvClothToMesh cpForces cpGetSolverAttr cpPanel ' +
      'cpProperty cpRigidCollisionFilter cpSeam cpSetEdit cpSetSolverAttr cpSolver ' +
      'cpSolverTypes cpTool cpUpdateClothUVs createDisplayLayer createDrawCtx createEditor ' +
      'createLayeredPsdFile createMotionField createNewShelf createNode createRenderLayer ' +
      'createSubdivRegion cross crossProduct ctxAbort ctxCompletion ctxEditMode ctxTraverse ' +
      'currentCtx currentTime currentTimeCtx currentUnit curve curveAddPtCtx ' +
      'curveCVCtx curveEPCtx curveEditorCtx curveIntersect curveMoveEPCtx curveOnSurface ' +
      'curveSketchCtx cutKey cycleCheck cylinder dagPose date defaultLightListCheckBox ' +
      'defaultNavigation defineDataServer defineVirtualDevice deformer deg_to_rad delete ' +
      'deleteAttr deleteShadingGroupsAndMaterials deleteShelfTab deleteUI deleteUnusedBrushes ' +
      'delrandstr detachCurve detachDeviceAttr detachSurface deviceEditor devicePanel dgInfo ' +
      'dgdirty dgeval dgtimer dimWhen directKeyCtx directionalLight dirmap dirname disable ' +
      'disconnectAttr disconnectJoint diskCache displacementToPoly displayAffected ' +
      'displayColor displayCull displayLevelOfDetail displayPref displayRGBColor ' +
      'displaySmoothness displayStats displayString displaySurface distanceDimContext ' +
      'distanceDimension doBlur dolly dollyCtx dopeSheetEditor dot dotProduct ' +
      'doubleProfileBirailSurface drag dragAttrContext draggerContext dropoffLocator ' +
      'duplicate duplicateCurve duplicateSurface dynCache dynControl dynExport dynExpression ' +
      'dynGlobals dynPaintEditor dynParticleCtx dynPref dynRelEdPanel dynRelEditor ' +
      'dynamicLoad editAttrLimits editDisplayLayerGlobals editDisplayLayerMembers ' +
      'editRenderLayerAdjustment editRenderLayerGlobals editRenderLayerMembers editor ' +
      'editorTemplate effector emit emitter enableDevice encodeString endString endsWith env ' +
      'equivalent equivalentTol erf error eval evalDeferred evalEcho event ' +
      'exactWorldBoundingBox exclusiveLightCheckBox exec executeForEachObject exists exp ' +
      'expression expressionEditorListen extendCurve extendSurface extrude fcheck fclose feof ' +
      'fflush fgetline fgetword file fileBrowserDialog fileDialog fileExtension fileInfo ' +
      'filetest filletCurve filter filterCurve filterExpand filterStudioImport ' +
      'findAllIntersections findAnimCurves findKeyframe findMenuItem findRelatedSkinCluster ' +
      'finder firstParentOf fitBspline flexor floatEq floatField floatFieldGrp floatScrollBar ' +
      'floatSlider floatSlider2 floatSliderButtonGrp floatSliderGrp floor flow fluidCacheInfo ' +
      'fluidEmitter fluidVoxelInfo flushUndo fmod fontDialog fopen formLayout format fprint ' +
      'frameLayout fread freeFormFillet frewind fromNativePath fwrite gamma gauss ' +
      'geometryConstraint getApplicationVersionAsFloat getAttr getClassification ' +
      'getDefaultBrush getFileList getFluidAttr getInputDeviceRange getMayaPanelTypes ' +
      'getModifiers getPanel getParticleAttr getPluginResource getenv getpid glRender ' +
      'glRenderEditor globalStitch gmatch goal gotoBindPose grabColor gradientControl ' +
      'gradientControlNoAttr graphDollyCtx graphSelectContext graphTrackCtx gravity grid ' +
      'gridLayout group groupObjectsByName HfAddAttractorToAS HfAssignAS HfBuildEqualMap ' +
      'HfBuildFurFiles HfBuildFurImages HfCancelAFR HfConnectASToHF HfCreateAttractor ' +
      'HfDeleteAS HfEditAS HfPerformCreateAS HfRemoveAttractorFromAS HfSelectAttached ' +
      'HfSelectAttractors HfUnAssignAS hardenPointCurve hardware hardwareRenderPanel ' +
      'headsUpDisplay headsUpMessage help helpLine hermite hide hilite hitTest hotBox hotkey ' +
      'hotkeyCheck hsv_to_rgb hudButton hudSlider hudSliderButton hwReflectionMap hwRender ' +
      'hwRenderLoad hyperGraph hyperPanel hyperShade hypot iconTextButton iconTextCheckBox ' +
      'iconTextRadioButton iconTextRadioCollection iconTextScrollList iconTextStaticLabel ' +
      'ikHandle ikHandleCtx ikHandleDisplayScale ikSolver ikSplineHandleCtx ikSystem ' +
      'ikSystemInfo ikfkDisplayMethod illustratorCurves image imfPlugins inheritTransform ' +
      'insertJoint insertJointCtx insertKeyCtx insertKnotCurve insertKnotSurface instance ' +
      'instanceable instancer intField intFieldGrp intScrollBar intSlider intSliderGrp ' +
      'interToUI internalVar intersect iprEngine isAnimCurve isConnected isDirty isParentOf ' +
      'isSameObject isTrue isValidObjectName isValidString isValidUiName isolateSelect ' +
      'itemFilter itemFilterAttr itemFilterRender itemFilterType joint jointCluster jointCtx ' +
      'jointDisplayScale jointLattice keyTangent keyframe keyframeOutliner ' +
      'keyframeRegionCurrentTimeCtx keyframeRegionDirectKeyCtx keyframeRegionDollyCtx ' +
      'keyframeRegionInsertKeyCtx keyframeRegionMoveKeyCtx keyframeRegionScaleKeyCtx ' +
      'keyframeRegionSelectKeyCtx keyframeRegionSetKeyCtx keyframeRegionTrackCtx ' +
      'keyframeStats lassoContext lattice latticeDeformKeyCtx launch launchImageEditor ' +
      'layerButton layeredShaderPort layeredTexturePort layout layoutDialog lightList ' +
      'lightListEditor lightListPanel lightlink lineIntersection linearPrecision linstep ' +
      'listAnimatable listAttr listCameras listConnections listDeviceAttachments listHistory ' +
      'listInputDeviceAxes listInputDeviceButtons listInputDevices listMenuAnnotation ' +
      'listNodeTypes listPanelCategories listRelatives listSets listTransforms ' +
      'listUnselected listerEditor loadFluid loadNewShelf loadPlugin ' +
      'loadPluginLanguageResources loadPrefObjects localizedPanelLabel lockNode loft log ' +
      'longNameOf lookThru ls lsThroughFilter lsType lsUI Mayatomr mag makeIdentity makeLive ' +
      'makePaintable makeRoll makeSingleSurface makeTubeOn makebot manipMoveContext ' +
      'manipMoveLimitsCtx manipOptions manipRotateContext manipRotateLimitsCtx ' +
      'manipScaleContext manipScaleLimitsCtx marker match max memory menu menuBarLayout ' +
      'menuEditor menuItem menuItemToShelf menuSet menuSetPref messageLine min minimizeApp ' +
      'mirrorJoint modelCurrentTimeCtx modelEditor modelPanel mouse movIn movOut move ' +
      'moveIKtoFK moveKeyCtx moveVertexAlongDirection multiProfileBirailSurface mute ' +
      'nParticle nameCommand nameField namespace namespaceInfo newPanelItems newton nodeCast ' +
      'nodeIconButton nodeOutliner nodePreset nodeType noise nonLinear normalConstraint ' +
      'normalize nurbsBoolean nurbsCopyUVSet nurbsCube nurbsEditUV nurbsPlane nurbsSelect ' +
      'nurbsSquare nurbsToPoly nurbsToPolygonsPref nurbsToSubdiv nurbsToSubdivPref ' +
      'nurbsUVSet nurbsViewDirectionVector objExists objectCenter objectLayer objectType ' +
      'objectTypeUI obsoleteProc oceanNurbsPreviewPlane offsetCurve offsetCurveOnSurface ' +
      'offsetSurface openGLExtension openMayaPref optionMenu optionMenuGrp optionVar orbit ' +
      'orbitCtx orientConstraint outlinerEditor outlinerPanel overrideModifier ' +
      'paintEffectsDisplay pairBlend palettePort paneLayout panel panelConfiguration ' +
      'panelHistory paramDimContext paramDimension paramLocator parent parentConstraint ' +
      'particle particleExists particleInstancer particleRenderInfo partition pasteKey ' +
      'pathAnimation pause pclose percent performanceOptions pfxstrokes pickWalk picture ' +
      'pixelMove planarSrf plane play playbackOptions playblast plugAttr plugNode pluginInfo ' +
      'pluginResourceUtil pointConstraint pointCurveConstraint pointLight pointMatrixMult ' +
      'pointOnCurve pointOnSurface pointPosition poleVectorConstraint polyAppend ' +
      'polyAppendFacetCtx polyAppendVertex polyAutoProjection polyAverageNormal ' +
      'polyAverageVertex polyBevel polyBlendColor polyBlindData polyBoolOp polyBridgeEdge ' +
      'polyCacheMonitor polyCheck polyChipOff polyClipboard polyCloseBorder polyCollapseEdge ' +
      'polyCollapseFacet polyColorBlindData polyColorDel polyColorPerVertex polyColorSet ' +
      'polyCompare polyCone polyCopyUV polyCrease polyCreaseCtx polyCreateFacet ' +
      'polyCreateFacetCtx polyCube polyCut polyCutCtx polyCylinder polyCylindricalProjection ' +
      'polyDelEdge polyDelFacet polyDelVertex polyDuplicateAndConnect polyDuplicateEdge ' +
      'polyEditUV polyEditUVShell polyEvaluate polyExtrudeEdge polyExtrudeFacet ' +
      'polyExtrudeVertex polyFlipEdge polyFlipUV polyForceUV polyGeoSampler polyHelix ' +
      'polyInfo polyInstallAction polyLayoutUV polyListComponentConversion polyMapCut ' +
      'polyMapDel polyMapSew polyMapSewMove polyMergeEdge polyMergeEdgeCtx polyMergeFacet ' +
      'polyMergeFacetCtx polyMergeUV polyMergeVertex polyMirrorFace polyMoveEdge ' +
      'polyMoveFacet polyMoveFacetUV polyMoveUV polyMoveVertex polyNormal polyNormalPerVertex ' +
      'polyNormalizeUV polyOptUvs polyOptions polyOutput polyPipe polyPlanarProjection ' +
      'polyPlane polyPlatonicSolid polyPoke polyPrimitive polyPrism polyProjection ' +
      'polyPyramid polyQuad polyQueryBlindData polyReduce polySelect polySelectConstraint ' +
      'polySelectConstraintMonitor polySelectCtx polySelectEditCtx polySeparate ' +
      'polySetToFaceNormal polySewEdge polyShortestPathCtx polySmooth polySoftEdge ' +
      'polySphere polySphericalProjection polySplit polySplitCtx polySplitEdge polySplitRing ' +
      'polySplitVertex polyStraightenUVBorder polySubdivideEdge polySubdivideFacet ' +
      'polyToSubdiv polyTorus polyTransfer polyTriangulate polyUVSet polyUnite polyWedgeFace ' +
      'popen popupMenu pose pow preloadRefEd print progressBar progressWindow projFileViewer ' +
      'projectCurve projectTangent projectionContext projectionManip promptDialog propModCtx ' +
      'propMove psdChannelOutliner psdEditTextureFile psdExport psdTextureFile putenv pwd ' +
      'python querySubdiv quit rad_to_deg radial radioButton radioButtonGrp radioCollection ' +
      'radioMenuItemCollection rampColorPort rand randomizeFollicles randstate rangeControl ' +
      'readTake rebuildCurve rebuildSurface recordAttr recordDevice redo reference ' +
      'referenceEdit referenceQuery refineSubdivSelectionList refresh refreshAE ' +
      'registerPluginResource rehash reloadImage removeJoint removeMultiInstance ' +
      'removePanelCategory rename renameAttr renameSelectionList renameUI render ' +
      'renderGlobalsNode renderInfo renderLayerButton renderLayerParent ' +
      'renderLayerPostProcess renderLayerUnparent renderManip renderPartition ' +
      'renderQualityNode renderSettings renderThumbnailUpdate renderWindowEditor ' +
      'renderWindowSelectContext renderer reorder reorderDeformers requires reroot ' +
      'resampleFluid resetAE resetPfxToPolyCamera resetTool resolutionNode retarget ' +
      'reverseCurve reverseSurface revolve rgb_to_hsv rigidBody rigidSolver roll rollCtx ' +
      'rootOf rot rotate rotationInterpolation roundConstantRadius rowColumnLayout rowLayout ' +
      'runTimeCommand runup sampleImage saveAllShelves saveAttrPreset saveFluid saveImage ' +
      'saveInitialState saveMenu savePrefObjects savePrefs saveShelf saveToolSettings scale ' +
      'scaleBrushBrightness scaleComponents scaleConstraint scaleKey scaleKeyCtx sceneEditor ' +
      'sceneUIReplacement scmh scriptCtx scriptEditorInfo scriptJob scriptNode scriptTable ' +
      'scriptToShelf scriptedPanel scriptedPanelType scrollField scrollLayout sculpt ' +
      'searchPathArray seed selLoadSettings select selectContext selectCurveCV selectKey ' +
      'selectKeyCtx selectKeyframeRegionCtx selectMode selectPref selectPriority selectType ' +
      'selectedNodes selectionConnection separator setAttr setAttrEnumResource ' +
      'setAttrMapping setAttrNiceNameResource setConstraintRestPosition ' +
      'setDefaultShadingGroup setDrivenKeyframe setDynamic setEditCtx setEditor setFluidAttr ' +
      'setFocus setInfinity setInputDeviceMapping setKeyCtx setKeyPath setKeyframe ' +
      'setKeyframeBlendshapeTargetWts setMenuMode setNodeNiceNameResource setNodeTypeFlag ' +
      'setParent setParticleAttr setPfxToPolyCamera setPluginResource setProject ' +
      'setStampDensity setStartupMessage setState setToolTo setUITemplate setXformManip sets ' +
      'shadingConnection shadingGeometryRelCtx shadingLightRelCtx shadingNetworkCompare ' +
      'shadingNode shapeCompare shelfButton shelfLayout shelfTabLayout shellField ' +
      'shortNameOf showHelp showHidden showManipCtx showSelectionInTitle ' +
      'showShadingGroupAttrEditor showWindow sign simplify sin singleProfileBirailSurface ' +
      'size sizeBytes skinCluster skinPercent smoothCurve smoothTangentSurface smoothstep ' +
      'snap2to2 snapKey snapMode snapTogetherCtx snapshot soft softMod softModCtx sort sound ' +
      'soundControl source spaceLocator sphere sphrand spotLight spotLightPreviewPort ' +
      'spreadSheetEditor spring sqrt squareSurface srtContext stackTrace startString ' +
      'startsWith stitchAndExplodeShell stitchSurface stitchSurfacePoints strcmp ' +
      'stringArrayCatenate stringArrayContains stringArrayCount stringArrayInsertAtIndex ' +
      'stringArrayIntersector stringArrayRemove stringArrayRemoveAtIndex ' +
      'stringArrayRemoveDuplicates stringArrayRemoveExact stringArrayToString ' +
      'stringToStringArray strip stripPrefixFromName stroke subdAutoProjection ' +
      'subdCleanTopology subdCollapse subdDuplicateAndConnect subdEditUV ' +
      'subdListComponentConversion subdMapCut subdMapSewMove subdMatchTopology subdMirror ' +
      'subdToBlind subdToPoly subdTransferUVsToCache subdiv subdivCrease ' +
      'subdivDisplaySmoothness substitute substituteAllString substituteGeometry substring ' +
      'surface surfaceSampler surfaceShaderList swatchDisplayPort switchTable symbolButton ' +
      'symbolCheckBox sysFile system tabLayout tan tangentConstraint texLatticeDeformContext ' +
      'texManipContext texMoveContext texMoveUVShellContext texRotateContext texScaleContext ' +
      'texSelectContext texSelectShortestPathCtx texSmudgeUVContext texWinToolCtx text ' +
      'textCurves textField textFieldButtonGrp textFieldGrp textManip textScrollList ' +
      'textToShelf textureDisplacePlane textureHairColor texturePlacementContext ' +
      'textureWindow threadCount threePointArcCtx timeControl timePort timerX toNativePath ' +
      'toggle toggleAxis toggleWindowVisibility tokenize tokenizeList tolerance tolower ' +
      'toolButton toolCollection toolDropped toolHasOptions toolPropertyWindow torus toupper ' +
      'trace track trackCtx transferAttributes transformCompare transformLimits translator ' +
      'trim trunc truncateFluidCache truncateHairCache tumble tumbleCtx turbulence ' +
      'twoPointArcCtx uiRes uiTemplate unassignInputDevice undo undoInfo ungroup uniform unit ' +
      'unloadPlugin untangleUV untitledFileName untrim upAxis updateAE userCtx uvLink ' +
      'uvSnapshot validateShelfName vectorize view2dToolCtx viewCamera viewClipPlane ' +
      'viewFit viewHeadOn viewLookAt viewManip viewPlace viewSet visor volumeAxis vortex ' +
      'waitCursor warning webBrowser webBrowserPrefs whatIs window windowPref wire ' +
      'wireContext workspace wrinkle wrinkleContext writeTake xbmLangPathList xform',
    illegal: '</',
    contains: [
      hljs.C_NUMBER_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        begin: '`', end: '`',
        contains: [hljs.BACKSLASH_ESCAPE]
      },
      { // eats variables
        begin: '[\\$\\%\\@](\\^\\w\\b|#\\w+|[^\\s\\w{]|{\\w+}|\\w+)'
      },
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE
    ]
  };
};

var mercury = function(hljs) {
  var KEYWORDS = {
    keyword:
      'module use_module import_module include_module end_module initialise ' +
      'mutable initialize finalize finalise interface implementation pred ' +
      'mode func type inst solver any_pred any_func is semidet det nondet ' +
      'multi erroneous failure cc_nondet cc_multi typeclass instance where ' +
      'pragma promise external trace atomic or_else require_complete_switch ' +
      'require_det require_semidet require_multi require_nondet ' +
      'require_cc_multi require_cc_nondet require_erroneous require_failure',
    meta:
      // pragma
      'inline no_inline type_spec source_file fact_table obsolete memo ' +
      'loop_check minimal_model terminates does_not_terminate ' +
      'check_termination promise_equivalent_clauses ' +
      // preprocessor
      'foreign_proc foreign_decl foreign_code foreign_type ' +
      'foreign_import_module foreign_export_enum foreign_export ' +
      'foreign_enum may_call_mercury will_not_call_mercury thread_safe ' +
      'not_thread_safe maybe_thread_safe promise_pure promise_semipure ' +
      'tabled_for_io local untrailed trailed attach_to_io_state ' +
      'can_pass_as_mercury_type stable will_not_throw_exception ' +
      'may_modify_trail will_not_modify_trail may_duplicate ' +
      'may_not_duplicate affects_liveness does_not_affect_liveness ' +
      'doesnt_affect_liveness no_sharing unknown_sharing sharing',
    built_in:
      'some all not if then else true fail false try catch catch_any ' +
      'semidet_true semidet_false semidet_fail impure_true impure semipure'
  };

  var COMMENT = hljs.COMMENT('%', '$');

  var NUMCODE = {
    className: 'number',
    begin: "0'.\\|0[box][0-9a-fA-F]*"
  };

  var ATOM = hljs.inherit(hljs.APOS_STRING_MODE, {relevance: 0});
  var STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, {relevance: 0});
  var STRING_FMT = {
    className: 'subst',
    begin: '\\\\[abfnrtv]\\|\\\\x[0-9a-fA-F]*\\\\\\|%[-+# *.0-9]*[dioxXucsfeEgGp]',
    relevance: 0
  };
  STRING.contains.push(STRING_FMT);

  var IMPLICATION = {
    className: 'built_in',
    variants: [
      {begin: '<=>'},
      {begin: '<=', relevance: 0},
      {begin: '=>', relevance: 0},
      {begin: '/\\\\'},
      {begin: '\\\\/'}
    ]
  };

  var HEAD_BODY_CONJUNCTION = {
    className: 'built_in',
    variants: [
      {begin: ':-\\|-->'},
      {begin: '=', relevance: 0}
    ]
  };

  return {
    aliases: ['m', 'moo'],
    keywords: KEYWORDS,
    contains: [
      IMPLICATION,
      HEAD_BODY_CONJUNCTION,
      COMMENT,
      hljs.C_BLOCK_COMMENT_MODE,
      NUMCODE,
      hljs.NUMBER_MODE,
      ATOM,
      STRING,
      {begin: /:-/} // relevance booster
    ]
  };
};

var mipsasm = function(hljs) {
    //local labels: %?[FB]?[AT]?\d{1,2}\w+
  return {
    case_insensitive: true,
    aliases: ['mips'],
    lexemes: '\\.?' + hljs.IDENT_RE,
    keywords: {
      meta:
        //GNU preprocs
        '.2byte .4byte .align .ascii .asciz .balign .byte .code .data .else .end .endif .endm .endr .equ .err .exitm .extern .global .hword .if .ifdef .ifndef .include .irp .long .macro .rept .req .section .set .skip .space .text .word .ltorg ',
      built_in:
        '$0 $1 $2 $3 $4 $5 $6 $7 $8 $9 $10 $11 $12 $13 $14 $15 ' + // integer registers
        '$16 $17 $18 $19 $20 $21 $22 $23 $24 $25 $26 $27 $28 $29 $30 $31 ' + // integer registers
        'zero at v0 v1 a0 a1 a2 a3 a4 a5 a6 a7 ' + // integer register aliases
        't0 t1 t2 t3 t4 t5 t6 t7 t8 t9 s0 s1 s2 s3 s4 s5 s6 s7 s8 ' + // integer register aliases
        'k0 k1 gp sp fp ra ' + // integer register aliases
        '$f0 $f1 $f2 $f2 $f4 $f5 $f6 $f7 $f8 $f9 $f10 $f11 $f12 $f13 $f14 $f15 ' + // floating-point registers
        '$f16 $f17 $f18 $f19 $f20 $f21 $f22 $f23 $f24 $f25 $f26 $f27 $f28 $f29 $f30 $f31 ' + // floating-point registers
        'Context Random EntryLo0 EntryLo1 Context PageMask Wired EntryHi ' + // Coprocessor 0 registers
        'HWREna BadVAddr Count Compare SR IntCtl SRSCtl SRSMap Cause EPC PRId ' + // Coprocessor 0 registers
        'EBase Config Config1 Config2 Config3 LLAddr Debug DEPC DESAVE CacheErr ' + // Coprocessor 0 registers
        'ECC ErrorEPC TagLo DataLo TagHi DataHi WatchLo WatchHi PerfCtl PerfCnt ' // Coprocessor 0 registers
    },
    contains: [
      {
        className: 'keyword',
        begin: '\\b('+     //mnemonics
            // 32-bit integer instructions
            'addi?u?|andi?|b(al)?|beql?|bgez(al)?l?|bgtzl?|blezl?|bltz(al)?l?|' +
            'bnel?|cl[oz]|divu?|ext|ins|j(al)?|jalr(\.hb)?|jr(\.hb)?|lbu?|lhu?|' +
            'll|lui|lw[lr]?|maddu?|mfhi|mflo|movn|movz|move|msubu?|mthi|mtlo|mul|' +
            'multu?|nop|nor|ori?|rotrv?|sb|sc|se[bh]|sh|sllv?|slti?u?|srav?|' +
            'srlv?|subu?|sw[lr]?|xori?|wsbh|' +
            // floating-point instructions
            'abs\.[sd]|add\.[sd]|alnv.ps|bc1[ft]l?|' +
            'c\.(s?f|un|u?eq|[ou]lt|[ou]le|ngle?|seq|l[et]|ng[et])\.[sd]|' +
            '(ceil|floor|round|trunc)\.[lw]\.[sd]|cfc1|cvt\.d\.[lsw]|' +
            'cvt\.l\.[dsw]|cvt\.ps\.s|cvt\.s\.[dlw]|cvt\.s\.p[lu]|cvt\.w\.[dls]|' +
            'div\.[ds]|ldx?c1|luxc1|lwx?c1|madd\.[sd]|mfc1|mov[fntz]?\.[ds]|' +
            'msub\.[sd]|mth?c1|mul\.[ds]|neg\.[ds]|nmadd\.[ds]|nmsub\.[ds]|' +
            'p[lu][lu]\.ps|recip\.fmt|r?sqrt\.[ds]|sdx?c1|sub\.[ds]|suxc1|' +
            'swx?c1|' +
            // system control instructions
            'break|cache|d?eret|[de]i|ehb|mfc0|mtc0|pause|prefx?|rdhwr|' +
            'rdpgpr|sdbbp|ssnop|synci?|syscall|teqi?|tgei?u?|tlb(p|r|w[ir])|' +
            'tlti?u?|tnei?|wait|wrpgpr'+
        ')',
        end: '\\s'
      },
      hljs.COMMENT('[;#]', '$'),
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        begin: '\'',
        end: '[^\\\\]\'',
        relevance: 0
      },
      {
        className: 'title',
        begin: '\\|', end: '\\|',
        illegal: '\\n',
        relevance: 0
      },
      {
        className: 'number',
        variants: [
            {begin: '0x[0-9a-f]+'}, //hex
            {begin: '\\b-?\\d+'}           //bare number
        ],
        relevance: 0
      },
      {
        className: 'symbol',
        variants: [
            {begin: '^\\s*[a-z_\\.\\$][a-z0-9_\\.\\$]+:'}, //GNU MIPS syntax
            {begin: '^\\s*[0-9]+:'}, // numbered local labels
            {begin: '[0-9]+[bf]' }  // number local label reference (backwards, forwards)
        ],
        relevance: 0
      }
    ],
    illegal: '\/'
  };
};

var mizar = function(hljs) {
  return {
    keywords:
      'environ vocabularies notations constructors definitions ' +
      'registrations theorems schemes requirements begin end definition ' +
      'registration cluster existence pred func defpred deffunc theorem ' +
      'proof let take assume then thus hence ex for st holds consider ' +
      'reconsider such that and in provided of as from be being by means ' +
      'equals implies iff redefine define now not or attr is mode ' +
      'suppose per cases set thesis contradiction scheme reserve struct ' +
      'correctness compatibility coherence symmetry assymetry ' +
      'reflexivity irreflexivity connectedness uniqueness commutativity ' +
      'idempotence involutiveness projectivity',
    contains: [
      hljs.COMMENT('::', '$')
    ]
  };
};

var perl = function(hljs) {
  var PERL_KEYWORDS = 'getpwent getservent quotemeta msgrcv scalar kill dbmclose undef lc ' +
    'ma syswrite tr send umask sysopen shmwrite vec qx utime local oct semctl localtime ' +
    'readpipe do return format read sprintf dbmopen pop getpgrp not getpwnam rewinddir qq' +
    'fileno qw endprotoent wait sethostent bless s|0 opendir continue each sleep endgrent ' +
    'shutdown dump chomp connect getsockname die socketpair close flock exists index shmget' +
    'sub for endpwent redo lstat msgctl setpgrp abs exit select print ref gethostbyaddr ' +
    'unshift fcntl syscall goto getnetbyaddr join gmtime symlink semget splice x|0 ' +
    'getpeername recv log setsockopt cos last reverse gethostbyname getgrnam study formline ' +
    'endhostent times chop length gethostent getnetent pack getprotoent getservbyname rand ' +
    'mkdir pos chmod y|0 substr endnetent printf next open msgsnd readdir use unlink ' +
    'getsockopt getpriority rindex wantarray hex system getservbyport endservent int chr ' +
    'untie rmdir prototype tell listen fork shmread ucfirst setprotoent else sysseek link ' +
    'getgrgid shmctl waitpid unpack getnetbyname reset chdir grep split require caller ' +
    'lcfirst until warn while values shift telldir getpwuid my getprotobynumber delete and ' +
    'sort uc defined srand accept package seekdir getprotobyname semop our rename seek if q|0 ' +
    'chroot sysread setpwent no crypt getc chown sqrt write setnetent setpriority foreach ' +
    'tie sin msgget map stat getlogin unless elsif truncate exec keys glob tied closedir' +
    'ioctl socket readlink eval xor readline binmode setservent eof ord bind alarm pipe ' +
    'atan2 getgrent exp time push setgrent gt lt or ne m|0 break given say state when';
  var SUBST = {
    className: 'subst',
    begin: '[$@]\\{', end: '\\}',
    keywords: PERL_KEYWORDS
  };
  var METHOD = {
    begin: '->{', end: '}'
    // contains defined later
  };
  var VAR = {
    variants: [
      {begin: /\$\d/},
      {begin: /[\$%@](\^\w\b|#\w+(::\w+)*|{\w+}|\w+(::\w*)*)/},
      {begin: /[\$%@][^\s\w{]/, relevance: 0}
    ]
  };
  var STRING_CONTAINS = [hljs.BACKSLASH_ESCAPE, SUBST, VAR];
  var PERL_DEFAULT_CONTAINS = [
    VAR,
    hljs.HASH_COMMENT_MODE,
    hljs.COMMENT(
      '^\\=\\w',
      '\\=cut',
      {
        endsWithParent: true
      }
    ),
    METHOD,
    {
      className: 'string',
      contains: STRING_CONTAINS,
      variants: [
        {
          begin: 'q[qwxr]?\\s*\\(', end: '\\)',
          relevance: 5
        },
        {
          begin: 'q[qwxr]?\\s*\\[', end: '\\]',
          relevance: 5
        },
        {
          begin: 'q[qwxr]?\\s*\\{', end: '\\}',
          relevance: 5
        },
        {
          begin: 'q[qwxr]?\\s*\\|', end: '\\|',
          relevance: 5
        },
        {
          begin: 'q[qwxr]?\\s*\\<', end: '\\>',
          relevance: 5
        },
        {
          begin: 'qw\\s+q', end: 'q',
          relevance: 5
        },
        {
          begin: '\'', end: '\'',
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        {
          begin: '"', end: '"'
        },
        {
          begin: '`', end: '`',
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        {
          begin: '{\\w+}',
          contains: [],
          relevance: 0
        },
        {
          begin: '\-?\\w+\\s*\\=\\>',
          contains: [],
          relevance: 0
        }
      ]
    },
    {
      className: 'number',
      begin: '(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b',
      relevance: 0
    },
    { // regexp container
      begin: '(\\/\\/|' + hljs.RE_STARTERS_RE + '|\\b(split|return|print|reverse|grep)\\b)\\s*',
      keywords: 'split return print reverse grep',
      relevance: 0,
      contains: [
        hljs.HASH_COMMENT_MODE,
        {
          className: 'regexp',
          begin: '(s|tr|y)/(\\\\.|[^/])*/(\\\\.|[^/])*/[a-z]*',
          relevance: 10
        },
        {
          className: 'regexp',
          begin: '(m|qr)?/', end: '/[a-z]*',
          contains: [hljs.BACKSLASH_ESCAPE],
          relevance: 0 // allows empty "//" which is a common comment delimiter in other languages
        }
      ]
    },
    {
      className: 'function',
      beginKeywords: 'sub', end: '(\\s*\\(.*?\\))?[;{]', excludeEnd: true,
      relevance: 5,
      contains: [hljs.TITLE_MODE]
    },
    {
      begin: '-\\w\\b',
      relevance: 0
    },
    {
      begin: "^__DATA__$",
      end: "^__END__$",
      subLanguage: 'mojolicious',
      contains: [
        {
            begin: "^@@.*",
            end: "$",
            className: "comment"
        }
      ]
    }
  ];
  SUBST.contains = PERL_DEFAULT_CONTAINS;
  METHOD.contains = PERL_DEFAULT_CONTAINS;

  return {
    aliases: ['pl', 'pm'],
    lexemes: /[\w\.]+/,
    keywords: PERL_KEYWORDS,
    contains: PERL_DEFAULT_CONTAINS
  };
};

var mojolicious = function(hljs) {
  return {
    subLanguage: 'xml',
    contains: [
      {
        className: 'meta',
        begin: '^__(END|DATA)__$'
      },
    // mojolicious line
      {
        begin: "^\\s*%{1,2}={0,2}", end: '$',
        subLanguage: 'perl'
      },
    // mojolicious block
      {
        begin: "<%{1,2}={0,2}",
        end: "={0,1}%>",
        subLanguage: 'perl',
        excludeBegin: true,
        excludeEnd: true
      }
    ]
  };
};

var monkey = function(hljs) {
  var NUMBER = {
    className: 'number', relevance: 0,
    variants: [
      {
        begin: '[$][a-fA-F0-9]+'
      },
      hljs.NUMBER_MODE
    ]
  };

  return {
    case_insensitive: true,
    keywords: {
      keyword: 'public private property continue exit extern new try catch ' +
        'eachin not abstract final select case default const local global field ' +
        'end if then else elseif endif while wend repeat until forever for ' +
        'to step next return module inline throw import',

      built_in: 'DebugLog DebugStop Error Print ACos ACosr ASin ASinr ATan ATan2 ATan2r ATanr Abs Abs Ceil ' +
        'Clamp Clamp Cos Cosr Exp Floor Log Max Max Min Min Pow Sgn Sgn Sin Sinr Sqrt Tan Tanr Seed PI HALFPI TWOPI',

      literal: 'true false null and or shl shr mod'
    },
    illegal: /\/\*/,
    contains: [
      hljs.COMMENT('#rem', '#end'),
      hljs.COMMENT(
        "'",
        '$',
        {
          relevance: 0
        }
      ),
      {
        className: 'function',
        beginKeywords: 'function method', end: '[(=:]|$',
        illegal: /\n/,
        contains: [
          hljs.UNDERSCORE_TITLE_MODE
        ]
      },
      {
        className: 'class',
        beginKeywords: 'class interface', end: '$',
        contains: [
          {
            beginKeywords: 'extends implements'
          },
          hljs.UNDERSCORE_TITLE_MODE
        ]
      },
      {
        className: 'built_in',
        begin: '\\b(self|super)\\b'
      },
      {
        className: 'meta',
        begin: '\\s*#', end: '$',
        keywords: {'meta-keyword': 'if else elseif endif end then'}
      },
      {
        className: 'meta',
        begin: '^\\s*strict\\b'
      },
      {
        beginKeywords: 'alias', end: '=',
        contains: [hljs.UNDERSCORE_TITLE_MODE]
      },
      hljs.QUOTE_STRING_MODE,
      NUMBER
    ]
  }
};

var moonscript = function(hljs) {
  var KEYWORDS = {
    keyword:
      // Moonscript keywords
      'if then not for in while do return else elseif break continue switch and or ' +
      'unless when class extends super local import export from using',
    literal:
      'true false nil',
    built_in:
      '_G _VERSION assert collectgarbage dofile error getfenv getmetatable ipairs load ' +
      'loadfile loadstring module next pairs pcall print rawequal rawget rawset require ' +
      'select setfenv setmetatable tonumber tostring type unpack xpcall coroutine debug ' +
      'io math os package string table'
  };
  var JS_IDENT_RE = '[A-Za-z$_][0-9A-Za-z$_]*';
  var SUBST = {
    className: 'subst',
    begin: /#\{/, end: /}/,
    keywords: KEYWORDS
  };
  var EXPRESSIONS = [
    hljs.inherit(hljs.C_NUMBER_MODE,
      {starts: {end: '(\\s*/)?', relevance: 0}}), // a number tries to eat the following slash to prevent treating it as a regexp
    {
      className: 'string',
      variants: [
        {
          begin: /'/, end: /'/,
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        {
          begin: /"/, end: /"/,
          contains: [hljs.BACKSLASH_ESCAPE, SUBST]
        }
      ]
    },
    {
      className: 'built_in',
      begin: '@__' + hljs.IDENT_RE
    },
    {
      begin: '@' + hljs.IDENT_RE // relevance booster on par with CoffeeScript
    },
    {
      begin: hljs.IDENT_RE + '\\\\' + hljs.IDENT_RE // inst\method
    }
  ];
  SUBST.contains = EXPRESSIONS;

  var TITLE = hljs.inherit(hljs.TITLE_MODE, {begin: JS_IDENT_RE});
  var PARAMS_RE = '(\\(.*\\))?\\s*\\B[-=]>';
  var PARAMS = {
    className: 'params',
    begin: '\\([^\\(]', returnBegin: true,
    /* We need another contained nameless mode to not have every nested
    pair of parens to be called "params" */
    contains: [{
      begin: /\(/, end: /\)/,
      keywords: KEYWORDS,
      contains: ['self'].concat(EXPRESSIONS)
    }]
  };

  return {
    aliases: ['moon'],
    keywords: KEYWORDS,
    illegal: /\/\*/,
    contains: EXPRESSIONS.concat([
      hljs.COMMENT('--', '$'),
      {
        className: 'function',  // function: -> =>
        begin: '^\\s*' + JS_IDENT_RE + '\\s*=\\s*' + PARAMS_RE, end: '[-=]>',
        returnBegin: true,
        contains: [TITLE, PARAMS]
      },
      {
        begin: /[\(,:=]\s*/, // anonymous function start
        relevance: 0,
        contains: [
          {
            className: 'function',
            begin: PARAMS_RE, end: '[-=]>',
            returnBegin: true,
            contains: [PARAMS]
          }
        ]
      },
      {
        className: 'class',
        beginKeywords: 'class',
        end: '$',
        illegal: /[:="\[\]]/,
        contains: [
          {
            beginKeywords: 'extends',
            endsWithParent: true,
            illegal: /[:="\[\]]/,
            contains: [TITLE]
          },
          TITLE
        ]
      },
      {
        className: 'name',    // table
        begin: JS_IDENT_RE + ':', end: ':',
        returnBegin: true, returnEnd: true,
        relevance: 0
      }
    ])
  };
};

var n1ql = function(hljs) {
  return {
    case_insensitive: true,
    contains: [
      {
        beginKeywords:
          'build create index delete drop explain infer|10 insert merge prepare select update upsert|10',
        end: /;/, endsWithParent: true,
        keywords: {
          // Taken from http://developer.couchbase.com/documentation/server/current/n1ql/n1ql-language-reference/reservedwords.html
          keyword:
            'all alter analyze and any array as asc begin between binary boolean break bucket build by call ' +
            'case cast cluster collate collection commit connect continue correlate cover create database ' +
            'dataset datastore declare decrement delete derived desc describe distinct do drop each element ' +
            'else end every except exclude execute exists explain fetch first flatten for force from ' +
            'function grant group gsi having if ignore ilike in include increment index infer inline inner ' +
            'insert intersect into is join key keys keyspace known last left let letting like limit lsm map ' +
            'mapping matched materialized merge minus namespace nest not number object offset on ' +
            'option or order outer over parse partition password path pool prepare primary private privilege ' +
            'procedure public raw realm reduce rename return returning revoke right role rollback satisfies ' +
            'schema select self semi set show some start statistics string system then to transaction trigger ' +
            'truncate under union unique unknown unnest unset update upsert use user using validate value ' +
            'valued values via view when where while with within work xor',
          // Taken from http://developer.couchbase.com/documentation/server/4.5/n1ql/n1ql-language-reference/literals.html
          literal:
            'true false null missing|5',
          // Taken from http://developer.couchbase.com/documentation/server/4.5/n1ql/n1ql-language-reference/functions.html
          built_in:
            'array_agg array_append array_concat array_contains array_count array_distinct array_ifnull array_length ' +
            'array_max array_min array_position array_prepend array_put array_range array_remove array_repeat array_replace ' +
            'array_reverse array_sort array_sum avg count max min sum greatest least ifmissing ifmissingornull ifnull ' +
            'missingif nullif ifinf ifnan ifnanorinf naninf neginfif posinfif clock_millis clock_str date_add_millis ' +
            'date_add_str date_diff_millis date_diff_str date_part_millis date_part_str date_trunc_millis date_trunc_str ' +
            'duration_to_str millis str_to_millis millis_to_str millis_to_utc millis_to_zone_name now_millis now_str ' +
            'str_to_duration str_to_utc str_to_zone_name decode_json encode_json encoded_size poly_length base64 base64_encode ' +
            'base64_decode meta uuid abs acos asin atan atan2 ceil cos degrees e exp ln log floor pi power radians random ' +
            'round sign sin sqrt tan trunc object_length object_names object_pairs object_inner_pairs object_values ' +
            'object_inner_values object_add object_put object_remove object_unwrap regexp_contains regexp_like regexp_position ' +
            'regexp_replace contains initcap length lower ltrim position repeat replace rtrim split substr title trim upper ' +
            'isarray isatom isboolean isnumber isobject isstring type toarray toatom toboolean tonumber toobject tostring'
        },
        contains: [
          {
            className: 'string',
            begin: '\'', end: '\'',
            contains: [hljs.BACKSLASH_ESCAPE],
            relevance: 0
          },
          {
            className: 'string',
            begin: '"', end: '"',
            contains: [hljs.BACKSLASH_ESCAPE],
            relevance: 0
          },
          {
            className: 'symbol',
            begin: '`', end: '`',
            contains: [hljs.BACKSLASH_ESCAPE],
            relevance: 2
          },
          hljs.C_NUMBER_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      },
      hljs.C_BLOCK_COMMENT_MODE
    ]
  };
};

var nginx = function(hljs) {
  var VAR = {
    className: 'variable',
    variants: [
      {begin: /\$\d+/},
      {begin: /\$\{/, end: /}/},
      {begin: '[\\$\\@]' + hljs.UNDERSCORE_IDENT_RE}
    ]
  };
  var DEFAULT = {
    endsWithParent: true,
    lexemes: '[a-z/_]+',
    keywords: {
      literal:
        'on off yes no true false none blocked debug info notice warn error crit ' +
        'select break last permanent redirect kqueue rtsig epoll poll /dev/poll'
    },
    relevance: 0,
    illegal: '=>',
    contains: [
      hljs.HASH_COMMENT_MODE,
      {
        className: 'string',
        contains: [hljs.BACKSLASH_ESCAPE, VAR],
        variants: [
          {begin: /"/, end: /"/},
          {begin: /'/, end: /'/}
        ]
      },
      // this swallows entire URLs to avoid detecting numbers within
      {
        begin: '([a-z]+):/', end: '\\s', endsWithParent: true, excludeEnd: true,
        contains: [VAR]
      },
      {
        className: 'regexp',
        contains: [hljs.BACKSLASH_ESCAPE, VAR],
        variants: [
          {begin: "\\s\\^", end: "\\s|{|;", returnEnd: true},
          // regexp locations (~, ~*)
          {begin: "~\\*?\\s+", end: "\\s|{|;", returnEnd: true},
          // *.example.com
          {begin: "\\*(\\.[a-z\\-]+)+"},
          // sub.example.*
          {begin: "([a-z\\-]+\\.)+\\*"}
        ]
      },
      // IP
      {
        className: 'number',
        begin: '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}(:\\d{1,5})?\\b'
      },
      // units
      {
        className: 'number',
        begin: '\\b\\d+[kKmMgGdshdwy]*\\b',
        relevance: 0
      },
      VAR
    ]
  };

  return {
    aliases: ['nginxconf'],
    contains: [
      hljs.HASH_COMMENT_MODE,
      {
        begin: hljs.UNDERSCORE_IDENT_RE + '\\s+{', returnBegin: true,
        end: '{',
        contains: [
          {
            className: 'section',
            begin: hljs.UNDERSCORE_IDENT_RE
          }
        ],
        relevance: 0
      },
      {
        begin: hljs.UNDERSCORE_IDENT_RE + '\\s', end: ';|{', returnBegin: true,
        contains: [
          {
            className: 'attribute',
            begin: hljs.UNDERSCORE_IDENT_RE,
            starts: DEFAULT
          }
        ],
        relevance: 0
      }
    ],
    illegal: '[^\\s\\}]'
  };
};

var nimrod = function(hljs) {
  return {
    aliases: ['nim'],
    keywords: {
      keyword:
        'addr and as asm bind block break case cast const continue converter ' +
        'discard distinct div do elif else end enum except export finally ' +
        'for from generic if import in include interface is isnot iterator ' +
        'let macro method mixin mod nil not notin object of or out proc ptr ' +
        'raise ref return shl shr static template try tuple type using var ' +
        'when while with without xor yield',
      literal:
        'shared guarded stdin stdout stderr result true false',
      built_in:
        'int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float ' +
        'float32 float64 bool char string cstring pointer expr stmt void ' +
        'auto any range array openarray varargs seq set clong culong cchar ' +
        'cschar cshort cint csize clonglong cfloat cdouble clongdouble ' +
        'cuchar cushort cuint culonglong cstringarray semistatic'
    },
    contains: [ {
        className: 'meta', // Actually pragma
        begin: /{\./,
        end: /\.}/,
        relevance: 10
      }, {
        className: 'string',
        begin: /[a-zA-Z]\w*"/,
        end: /"/,
        contains: [{begin: /""/}]
      }, {
        className: 'string',
        begin: /([a-zA-Z]\w*)?"""/,
        end: /"""/
      },
      hljs.QUOTE_STRING_MODE,
      {
        className: 'type',
        begin: /\b[A-Z]\w+\b/,
        relevance: 0
      }, {
        className: 'number',
        relevance: 0,
        variants: [
          {begin: /\b(0[xX][0-9a-fA-F][_0-9a-fA-F]*)('?[iIuU](8|16|32|64))?/},
          {begin: /\b(0o[0-7][_0-7]*)('?[iIuUfF](8|16|32|64))?/},
          {begin: /\b(0(b|B)[01][_01]*)('?[iIuUfF](8|16|32|64))?/},
          {begin: /\b(\d[_\d]*)('?[iIuUfF](8|16|32|64))?/}
        ]
      },
      hljs.HASH_COMMENT_MODE
    ]
  }
};

var nix = function(hljs) {
  var NIX_KEYWORDS = {
    keyword:
      'rec with let in inherit assert if else then',
    literal:
      'true false or and null',
    built_in:
      'import abort baseNameOf dirOf isNull builtins map removeAttrs throw ' +
      'toString derivation'
  };
  var ANTIQUOTE = {
    className: 'subst',
    begin: /\$\{/,
    end: /}/,
    keywords: NIX_KEYWORDS
  };
  var ATTRS = {
    begin: /[a-zA-Z0-9-_]+(\s*=)/, returnBegin: true,
    relevance: 0,
    contains: [
      {
        className: 'attr',
        begin: /\S+/
      }
    ]
  };
  var STRING = {
    className: 'string',
    contains: [ANTIQUOTE],
    variants: [
      {begin: "''", end: "''"},
      {begin: '"', end: '"'}
    ]
  };
  var EXPRESSIONS = [
    hljs.NUMBER_MODE,
    hljs.HASH_COMMENT_MODE,
    hljs.C_BLOCK_COMMENT_MODE,
    STRING,
    ATTRS
  ];
  ANTIQUOTE.contains = EXPRESSIONS;
  return {
    aliases: ["nixos"],
    keywords: NIX_KEYWORDS,
    contains: EXPRESSIONS
  };
};

var nsis = function(hljs) {
  var CONSTANTS = {
    className: 'variable',
    begin: /\$(ADMINTOOLS|APPDATA|CDBURN_AREA|CMDLINE|COMMONFILES32|COMMONFILES64|COMMONFILES|COOKIES|DESKTOP|DOCUMENTS|EXEDIR|EXEFILE|EXEPATH|FAVORITES|FONTS|HISTORY|HWNDPARENT|INSTDIR|INTERNET_CACHE|LANGUAGE|LOCALAPPDATA|MUSIC|NETHOOD|OUTDIR|PICTURES|PLUGINSDIR|PRINTHOOD|PROFILE|PROGRAMFILES32|PROGRAMFILES64|PROGRAMFILES|QUICKLAUNCH|RECENT|RESOURCES_LOCALIZED|RESOURCES|SENDTO|SMPROGRAMS|SMSTARTUP|STARTMENU|SYSDIR|TEMP|TEMPLATES|VIDEOS|WINDIR)/
  };

  var DEFINES = {
    // ${defines}
    className: 'variable',
    begin: /\$+{[\w\.:-]+}/
  };

  var VARIABLES = {
    // $variables
    className: 'variable',
    begin: /\$+\w+/,
    illegal: /\(\){}/
  };

  var LANGUAGES = {
    // $(language_strings)
    className: 'variable',
    begin: /\$+\([\w\^\.:-]+\)/
  };

  var PARAMETERS = {
    // command parameters
    className: 'params',
    begin: '(ARCHIVE|FILE_ATTRIBUTE_ARCHIVE|FILE_ATTRIBUTE_NORMAL|FILE_ATTRIBUTE_OFFLINE|FILE_ATTRIBUTE_READONLY|FILE_ATTRIBUTE_SYSTEM|FILE_ATTRIBUTE_TEMPORARY|HKCR|HKCU|HKDD|HKEY_CLASSES_ROOT|HKEY_CURRENT_CONFIG|HKEY_CURRENT_USER|HKEY_DYN_DATA|HKEY_LOCAL_MACHINE|HKEY_PERFORMANCE_DATA|HKEY_USERS|HKLM|HKPD|HKU|IDABORT|IDCANCEL|IDIGNORE|IDNO|IDOK|IDRETRY|IDYES|MB_ABORTRETRYIGNORE|MB_DEFBUTTON1|MB_DEFBUTTON2|MB_DEFBUTTON3|MB_DEFBUTTON4|MB_ICONEXCLAMATION|MB_ICONINFORMATION|MB_ICONQUESTION|MB_ICONSTOP|MB_OK|MB_OKCANCEL|MB_RETRYCANCEL|MB_RIGHT|MB_RTLREADING|MB_SETFOREGROUND|MB_TOPMOST|MB_USERICON|MB_YESNO|NORMAL|OFFLINE|READONLY|SHCTX|SHELL_CONTEXT|SYSTEM|TEMPORARY)'
  };

  var COMPILER = {
    // !compiler_flags
    className: 'keyword',
    begin: /\!(addincludedir|addplugindir|appendfile|cd|define|delfile|echo|else|endif|error|execute|finalize|getdllversion|gettlbversion|if|ifdef|ifmacrodef|ifmacrondef|ifndef|include|insertmacro|macro|macroend|makensis|packhdr|searchparse|searchreplace|system|tempfile|undef|verbose|warning)/
  };

  var METACHARS = {
    // $\n, $\r, $\t, $$
    className: 'meta',
    begin: /\$(\\[nrt]|\$)/
  };

  var PLUGINS = {
    // plug::ins
    className: 'class',
    begin: /\w+\:\:\w+/
  };

    var STRING = {
      className: 'string',
      variants: [
        {
          begin: '"', end: '"'
        },
        {
          begin: '\'', end: '\''
        },
        {
          begin: '`', end: '`'
        }
      ],
      illegal: /\n/,
      contains: [
        METACHARS,
        CONSTANTS,
        DEFINES,
        VARIABLES,
        LANGUAGES
      ]
  };

  return {
    case_insensitive: false,
    keywords: {
      keyword:
      'Abort AddBrandingImage AddSize AllowRootDirInstall AllowSkipFiles AutoCloseWindow BGFont BGGradient BrandingText BringToFront Call CallInstDLL Caption ChangeUI CheckBitmap ClearErrors CompletedText ComponentText CopyFiles CRCCheck CreateDirectory CreateFont CreateShortCut Delete DeleteINISec DeleteINIStr DeleteRegKey DeleteRegValue DetailPrint DetailsButtonText DirText DirVar DirVerify EnableWindow EnumRegKey EnumRegValue Exch Exec ExecShell ExecShellWait ExecWait ExpandEnvStrings File FileBufSize FileClose FileErrorText FileOpen FileRead FileReadByte FileReadUTF16LE FileReadWord FileSeek FileWrite FileWriteByte FileWriteUTF16LE FileWriteWord FindClose FindFirst FindNext FindWindow FlushINI FunctionEnd GetCurInstType GetCurrentAddress GetDlgItem GetDLLVersion GetDLLVersionLocal GetErrorLevel GetFileTime GetFileTimeLocal GetFullPathName GetFunctionAddress GetInstDirError GetLabelAddress GetTempFileName Goto HideWindow Icon IfAbort IfErrors IfFileExists IfRebootFlag IfSilent InitPluginsDir InstallButtonText InstallColors InstallDir InstallDirRegKey InstProgressFlags InstType InstTypeGetText InstTypeSetText Int64Cmp Int64CmpU Int64Fmt IntCmp IntCmpU IntFmt IntOp IntPtrCmp IntPtrCmpU IntPtrOp IsWindow LangString LicenseBkColor LicenseData LicenseForceSelection LicenseLangString LicenseText LoadLanguageFile LockWindow LogSet LogText ManifestDPIAware ManifestSupportedOS MessageBox MiscButtonText Name Nop OutFile Page PageCallbacks PageExEnd Pop Push Quit ReadEnvStr ReadINIStr ReadRegDWORD ReadRegStr Reboot RegDLL Rename RequestExecutionLevel ReserveFile Return RMDir SearchPath SectionEnd SectionGetFlags SectionGetInstTypes SectionGetSize SectionGetText SectionGroupEnd SectionIn SectionSetFlags SectionSetInstTypes SectionSetSize SectionSetText SendMessage SetAutoClose SetBrandingImage SetCompress SetCompressor SetCompressorDictSize SetCtlColors SetCurInstType SetDatablockOptimize SetDateSave SetDetailsPrint SetDetailsView SetErrorLevel SetErrors SetFileAttributes SetFont SetOutPath SetOverwrite SetRebootFlag SetRegView SetShellVarContext SetSilent ShowInstDetails ShowUninstDetails ShowWindow SilentInstall SilentUnInstall Sleep SpaceTexts StrCmp StrCmpS StrCpy StrLen SubCaption Unicode UninstallButtonText UninstallCaption UninstallIcon UninstallSubCaption UninstallText UninstPage UnRegDLL Var VIAddVersionKey VIFileVersion VIProductVersion WindowIcon WriteINIStr WriteRegBin WriteRegDWORD WriteRegExpandStr WriteRegMultiStr WriteRegNone WriteRegStr WriteUninstaller XPStyle',
      literal:
      'admin all auto both bottom bzip2 colored components current custom directory false force hide highest ifdiff ifnewer instfiles lastused leave left license listonly lzma nevershow none normal notset off on open print right show silent silentlog smooth textonly top true try un.components un.custom un.directory un.instfiles un.license uninstConfirm user Win10 Win7 Win8 WinVista zlib'
    },
    contains: [
      hljs.HASH_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.COMMENT(
        ';',
        '$',
        {
          relevance: 0
        }
      ),
      {
        className: 'function',
        beginKeywords: 'Function PageEx Section SectionGroup', end: '$'
      },
      STRING,
      COMPILER,
      DEFINES,
      VARIABLES,
      LANGUAGES,
      PARAMETERS,
      PLUGINS,
      hljs.NUMBER_MODE
    ]
  };
};

var objectivec = function(hljs) {
  var API_CLASS = {
    className: 'built_in',
    begin: '\\b(AV|CA|CF|CG|CI|CL|CM|CN|CT|MK|MP|MTK|MTL|NS|SCN|SK|UI|WK|XC)\\w+',
  };
  var OBJC_KEYWORDS = {
    keyword:
      'int float while char export sizeof typedef const struct for union ' +
      'unsigned long volatile static bool mutable if do return goto void ' +
      'enum else break extern asm case short default double register explicit ' +
      'signed typename this switch continue wchar_t inline readonly assign ' +
      'readwrite self @synchronized id typeof ' +
      'nonatomic super unichar IBOutlet IBAction strong weak copy ' +
      'in out inout bycopy byref oneway __strong __weak __block __autoreleasing ' +
      '@private @protected @public @try @property @end @throw @catch @finally ' +
      '@autoreleasepool @synthesize @dynamic @selector @optional @required ' +
      '@encode @package @import @defs @compatibility_alias ' +
      '__bridge __bridge_transfer __bridge_retained __bridge_retain ' +
      '__covariant __contravariant __kindof ' +
      '_Nonnull _Nullable _Null_unspecified ' +
      '__FUNCTION__ __PRETTY_FUNCTION__ __attribute__ ' +
      'getter setter retain unsafe_unretained ' +
      'nonnull nullable null_unspecified null_resettable class instancetype ' +
      'NS_DESIGNATED_INITIALIZER NS_UNAVAILABLE NS_REQUIRES_SUPER ' +
      'NS_RETURNS_INNER_POINTER NS_INLINE NS_AVAILABLE NS_DEPRECATED ' +
      'NS_ENUM NS_OPTIONS NS_SWIFT_UNAVAILABLE ' +
      'NS_ASSUME_NONNULL_BEGIN NS_ASSUME_NONNULL_END ' +
      'NS_REFINED_FOR_SWIFT NS_SWIFT_NAME NS_SWIFT_NOTHROW ' +
      'NS_DURING NS_HANDLER NS_ENDHANDLER NS_VALUERETURN NS_VOIDRETURN',
    literal:
      'false true FALSE TRUE nil YES NO NULL',
    built_in:
      'BOOL dispatch_once_t dispatch_queue_t dispatch_sync dispatch_async dispatch_once'
  };
  var LEXEMES = /[a-zA-Z@][a-zA-Z0-9_]*/;
  var CLASS_KEYWORDS = '@interface @class @protocol @implementation';
  return {
    aliases: ['mm', 'objc', 'obj-c'],
    keywords: OBJC_KEYWORDS,
    lexemes: LEXEMES,
    illegal: '</',
    contains: [
      API_CLASS,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.C_NUMBER_MODE,
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        variants: [
          {
            begin: '@"', end: '"',
            illegal: '\\n',
            contains: [hljs.BACKSLASH_ESCAPE]
          },
          {
            begin: '\'', end: '[^\\\\]\'',
            illegal: '[^\\\\][^\']'
          }
        ]
      },
      {
        className: 'meta',
        begin: '#',
        end: '$',
        contains: [
          {
            className: 'meta-string',
            variants: [
              { begin: '\"', end: '\"' },
              { begin: '<', end: '>' }
            ]
          }
        ]
      },
      {
        className: 'class',
        begin: '(' + CLASS_KEYWORDS.split(' ').join('|') + ')\\b', end: '({|$)', excludeEnd: true,
        keywords: CLASS_KEYWORDS, lexemes: LEXEMES,
        contains: [
          hljs.UNDERSCORE_TITLE_MODE
        ]
      },
      {
        begin: '\\.'+hljs.UNDERSCORE_IDENT_RE,
        relevance: 0
      }
    ]
  };
};

var ocaml = function(hljs) {
  /* missing support for heredoc-like string (OCaml 4.0.2+) */
  return {
    aliases: ['ml'],
    keywords: {
      keyword:
        'and as assert asr begin class constraint do done downto else end ' +
        'exception external for fun function functor if in include ' +
        'inherit! inherit initializer land lazy let lor lsl lsr lxor match method!|10 method ' +
        'mod module mutable new object of open! open or private rec sig struct ' +
        'then to try type val! val virtual when while with ' +
        /* camlp4 */
        'parser value',
      built_in:
        /* built-in types */
        'array bool bytes char exn|5 float int int32 int64 list lazy_t|5 nativeint|5 string unit ' +
        /* (some) types in Pervasives */
        'in_channel out_channel ref',
      literal:
        'true false'
    },
    illegal: /\/\/|>>/,
    lexemes: '[a-z_]\\w*!?',
    contains: [
      {
        className: 'literal',
        begin: '\\[(\\|\\|)?\\]|\\(\\)',
        relevance: 0
      },
      hljs.COMMENT(
        '\\(\\*',
        '\\*\\)',
        {
          contains: ['self']
        }
      ),
      { /* type variable */
        className: 'symbol',
        begin: '\'[A-Za-z_](?!\')[\\w\']*'
        /* the grammar is ambiguous on how 'a'b should be interpreted but not the compiler */
      },
      { /* polymorphic variant */
        className: 'type',
        begin: '`[A-Z][\\w\']*'
      },
      { /* module or constructor */
        className: 'type',
        begin: '\\b[A-Z][\\w\']*',
        relevance: 0
      },
      { /* don't color identifiers, but safely catch all identifiers with '*/
        begin: '[a-z_]\\w*\'[\\w\']*', relevance: 0
      },
      hljs.inherit(hljs.APOS_STRING_MODE, {className: 'string', relevance: 0}),
      hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null}),
      {
        className: 'number',
        begin:
          '\\b(0[xX][a-fA-F0-9_]+[Lln]?|' +
          '0[oO][0-7_]+[Lln]?|' +
          '0[bB][01_]+[Lln]?|' +
          '[0-9][0-9_]*([Lln]|(\\.[0-9_]*)?([eE][-+]?[0-9_]+)?)?)',
        relevance: 0
      },
      {
        begin: /[-=]>/ // relevance booster
      }
    ]
  }
};

var openscad = function(hljs) {
	var SPECIAL_VARS = {
		className: 'keyword',
		begin: '\\$(f[asn]|t|vp[rtd]|children)'
	},
	LITERALS = {
		className: 'literal',
		begin: 'false|true|PI|undef'
	},
	NUMBERS = {
		className: 'number',
		begin: '\\b\\d+(\\.\\d+)?(e-?\\d+)?', //adds 1e5, 1e-10
		relevance: 0
	},
	STRING = hljs.inherit(hljs.QUOTE_STRING_MODE,{illegal: null}),
	PREPRO = {
		className: 'meta',
		keywords: {'meta-keyword': 'include use'},
		begin: 'include|use <',
		end: '>'
	},
	PARAMS = {
		className: 'params',
		begin: '\\(', end: '\\)',
		contains: ['self', NUMBERS, STRING, SPECIAL_VARS, LITERALS]
	},
	MODIFIERS = {
		begin: '[*!#%]',
		relevance: 0
	},
	FUNCTIONS = {
		className: 'function',
		beginKeywords: 'module function',
		end: '\\=|\\{',
		contains: [PARAMS, hljs.UNDERSCORE_TITLE_MODE]
	};

	return {
		aliases: ['scad'],
		keywords: {
			keyword: 'function module include use for intersection_for if else \\%',
			literal: 'false true PI undef',
			built_in: 'circle square polygon text sphere cube cylinder polyhedron translate rotate scale resize mirror multmatrix color offset hull minkowski union difference intersection abs sign sin cos tan acos asin atan atan2 floor round ceil ln log pow sqrt exp rands min max concat lookup str chr search version version_num norm cross parent_module echo import import_dxf dxf_linear_extrude linear_extrude rotate_extrude surface projection render children dxf_cross dxf_dim let assign'
		},
		contains: [
			hljs.C_LINE_COMMENT_MODE,
			hljs.C_BLOCK_COMMENT_MODE,
			NUMBERS,
			PREPRO,
			STRING,
			SPECIAL_VARS,
			MODIFIERS,
			FUNCTIONS
		]
	}
};

var oxygene = function(hljs) {
  var OXYGENE_KEYWORDS = 'abstract add and array as asc aspect assembly async begin break block by case class concat const copy constructor continue '+
    'create default delegate desc distinct div do downto dynamic each else empty end ensure enum equals event except exit extension external false '+
    'final finalize finalizer finally flags for forward from function future global group has if implementation implements implies in index inherited '+
    'inline interface into invariants is iterator join locked locking loop matching method mod module namespace nested new nil not notify nullable of '+
    'old on operator or order out override parallel params partial pinned private procedure property protected public queryable raise read readonly '+
    'record reintroduce remove repeat require result reverse sealed select self sequence set shl shr skip static step soft take then to true try tuple '+
    'type union unit unsafe until uses using var virtual raises volatile where while with write xor yield await mapped deprecated stdcall cdecl pascal '+
    'register safecall overload library platform reference packed strict published autoreleasepool selector strong weak unretained';
  var CURLY_COMMENT =  hljs.COMMENT(
    '{',
    '}',
    {
      relevance: 0
    }
  );
  var PAREN_COMMENT = hljs.COMMENT(
    '\\(\\*',
    '\\*\\)',
    {
      relevance: 10
    }
  );
  var STRING = {
    className: 'string',
    begin: '\'', end: '\'',
    contains: [{begin: '\'\''}]
  };
  var CHAR_STRING = {
    className: 'string', begin: '(#\\d+)+'
  };
  var FUNCTION = {
    className: 'function',
    beginKeywords: 'function constructor destructor procedure method', end: '[:;]',
    keywords: 'function constructor|10 destructor|10 procedure|10 method|10',
    contains: [
      hljs.TITLE_MODE,
      {
        className: 'params',
        begin: '\\(', end: '\\)',
        keywords: OXYGENE_KEYWORDS,
        contains: [STRING, CHAR_STRING]
      },
      CURLY_COMMENT, PAREN_COMMENT
    ]
  };
  return {
    case_insensitive: true,
    lexemes: /\.?\w+/,
    keywords: OXYGENE_KEYWORDS,
    illegal: '("|\\$[G-Zg-z]|\\/\\*|</|=>|->)',
    contains: [
      CURLY_COMMENT, PAREN_COMMENT, hljs.C_LINE_COMMENT_MODE,
      STRING, CHAR_STRING,
      hljs.NUMBER_MODE,
      FUNCTION,
      {
        className: 'class',
        begin: '=\\bclass\\b', end: 'end;',
        keywords: OXYGENE_KEYWORDS,
        contains: [
          STRING, CHAR_STRING,
          CURLY_COMMENT, PAREN_COMMENT, hljs.C_LINE_COMMENT_MODE,
          FUNCTION
        ]
      }
    ]
  };
};

var parser3 = function(hljs) {
  var CURLY_SUBCOMMENT = hljs.COMMENT(
    '{',
    '}',
    {
      contains: ['self']
    }
  );
  return {
    subLanguage: 'xml', relevance: 0,
    contains: [
      hljs.COMMENT('^#', '$'),
      hljs.COMMENT(
        '\\^rem{',
        '}',
        {
          relevance: 10,
          contains: [
            CURLY_SUBCOMMENT
          ]
        }
      ),
      {
        className: 'meta',
        begin: '^@(?:BASE|USE|CLASS|OPTIONS)$',
        relevance: 10
      },
      {
        className: 'title',
        begin: '@[\\w\\-]+\\[[\\w^;\\-]*\\](?:\\[[\\w^;\\-]*\\])?(?:.*)$'
      },
      {
        className: 'variable',
        begin: '\\$\\{?[\\w\\-\\.\\:]+\\}?'
      },
      {
        className: 'keyword',
        begin: '\\^[\\w\\-\\.\\:]+'
      },
      {
        className: 'number',
        begin: '\\^#[0-9a-fA-F]+'
      },
      hljs.C_NUMBER_MODE
    ]
  };
};

var pf = function(hljs) {
  var MACRO = {
    className: 'variable',
    begin: /\$[\w\d#@][\w\d_]*/
  };
  var TABLE = {
    className: 'variable',
    begin: /<(?!\/)/, end: />/
  };

  return {
    aliases: ['pf.conf'],
    lexemes: /[a-z0-9_<>-]+/,
    keywords: {
      built_in: /* block match pass are "actions" in pf.conf(5), the rest are
                 * lexically similar top-level commands.
                 */
        'block match pass load anchor|5 antispoof|10 set table',
      keyword:
        'in out log quick on rdomain inet inet6 proto from port os to route' +
        'allow-opts divert-packet divert-reply divert-to flags group icmp-type' +
        'icmp6-type label once probability recieved-on rtable prio queue' +
        'tos tag tagged user keep fragment for os drop' +
        'af-to|10 binat-to|10 nat-to|10 rdr-to|10 bitmask least-stats random round-robin' +
        'source-hash static-port' +
        'dup-to reply-to route-to' +
        'parent bandwidth default min max qlimit' +
        'block-policy debug fingerprints hostid limit loginterface optimization' +
        'reassemble ruleset-optimization basic none profile skip state-defaults' +
        'state-policy timeout' +
        'const counters persist' +
        'no modulate synproxy state|5 floating if-bound no-sync pflow|10 sloppy' +
        'source-track global rule max-src-nodes max-src-states max-src-conn' +
        'max-src-conn-rate overload flush' +
        'scrub|5 max-mss min-ttl no-df|10 random-id',
      literal:
        'all any no-route self urpf-failed egress|5 unknown'
    },
    contains: [
      hljs.HASH_COMMENT_MODE,
      hljs.NUMBER_MODE,
      hljs.QUOTE_STRING_MODE,
      MACRO,
      TABLE
    ]
  };
};

var pgsql = function(hljs) {
  var COMMENT_MODE = hljs.COMMENT('--', '$');
  var UNQUOTED_IDENT = '[a-zA-Z_][a-zA-Z_0-9$]*';
  var DOLLAR_STRING = '\\$([a-zA-Z_]?|[a-zA-Z_][a-zA-Z_0-9]*)\\$';
  var LABEL = '<<\\s*' + UNQUOTED_IDENT + '\\s*>>';

  var SQL_KW = 
    // https://www.postgresql.org/docs/11/static/sql-keywords-appendix.html
    // https://www.postgresql.org/docs/11/static/sql-commands.html
    // SQL commands (starting words)
    'ABORT ALTER ANALYZE BEGIN CALL CHECKPOINT|10 CLOSE CLUSTER COMMENT COMMIT COPY CREATE DEALLOCATE DECLARE ' +
    'DELETE DISCARD DO DROP END EXECUTE EXPLAIN FETCH GRANT IMPORT INSERT LISTEN LOAD LOCK MOVE NOTIFY ' +
    'PREPARE REASSIGN|10 REFRESH REINDEX RELEASE RESET REVOKE ROLLBACK SAVEPOINT SECURITY SELECT SET SHOW ' +
    'START TRUNCATE UNLISTEN|10 UPDATE VACUUM|10 VALUES ' +
    // SQL commands (others)
    'AGGREGATE COLLATION CONVERSION|10 DATABASE DEFAULT PRIVILEGES DOMAIN TRIGGER EXTENSION FOREIGN ' +
    'WRAPPER|10 TABLE FUNCTION GROUP LANGUAGE LARGE OBJECT MATERIALIZED VIEW OPERATOR CLASS ' +
    'FAMILY POLICY PUBLICATION|10 ROLE RULE SCHEMA SEQUENCE SERVER STATISTICS SUBSCRIPTION SYSTEM ' +
    'TABLESPACE CONFIGURATION DICTIONARY PARSER TEMPLATE TYPE USER MAPPING PREPARED ACCESS ' +
    'METHOD CAST AS TRANSFORM TRANSACTION OWNED TO INTO SESSION AUTHORIZATION ' +
    'INDEX PROCEDURE ASSERTION ' +
    // additional reserved key words
    'ALL ANALYSE AND ANY ARRAY ASC ASYMMETRIC|10 BOTH CASE CHECK ' +
    'COLLATE COLUMN CONCURRENTLY|10 CONSTRAINT CROSS ' +
    'DEFERRABLE RANGE ' +
    'DESC DISTINCT ELSE EXCEPT FOR FREEZE|10 FROM FULL HAVING ' +
    'ILIKE IN INITIALLY INNER INTERSECT IS ISNULL JOIN LATERAL LEADING LIKE LIMIT ' +
    'NATURAL NOT NOTNULL NULL OFFSET ON ONLY OR ORDER OUTER OVERLAPS PLACING PRIMARY ' +
    'REFERENCES RETURNING SIMILAR SOME SYMMETRIC TABLESAMPLE THEN ' +
    'TRAILING UNION UNIQUE USING VARIADIC|10 VERBOSE WHEN WHERE WINDOW WITH ' +
    // some of non-reserved (which are used in clauses or as PL/pgSQL keyword)
    'BY RETURNS INOUT OUT SETOF|10 IF STRICT CURRENT CONTINUE OWNER LOCATION OVER PARTITION WITHIN ' +
    'BETWEEN ESCAPE EXTERNAL INVOKER DEFINER WORK RENAME VERSION CONNECTION CONNECT ' +
    'TABLES TEMP TEMPORARY FUNCTIONS SEQUENCES TYPES SCHEMAS OPTION CASCADE RESTRICT ADD ADMIN ' +
    'EXISTS VALID VALIDATE ENABLE DISABLE REPLICA|10 ALWAYS PASSING COLUMNS PATH ' +
    'REF VALUE OVERRIDING IMMUTABLE STABLE VOLATILE BEFORE AFTER EACH ROW PROCEDURAL ' +
    'ROUTINE NO HANDLER VALIDATOR OPTIONS STORAGE OIDS|10 WITHOUT INHERIT DEPENDS CALLED ' +
    'INPUT LEAKPROOF|10 COST ROWS NOWAIT SEARCH UNTIL ENCRYPTED|10 PASSWORD CONFLICT|10 ' +
    'INSTEAD INHERITS CHARACTERISTICS WRITE CURSOR ALSO STATEMENT SHARE EXCLUSIVE INLINE ' +
    'ISOLATION REPEATABLE READ COMMITTED SERIALIZABLE UNCOMMITTED LOCAL GLOBAL SQL PROCEDURES ' +
    'RECURSIVE SNAPSHOT ROLLUP CUBE TRUSTED|10 INCLUDE FOLLOWING PRECEDING UNBOUNDED RANGE GROUPS ' +
    'UNENCRYPTED|10 SYSID FORMAT DELIMITER HEADER QUOTE ENCODING FILTER OFF ' +
    // some parameters of VACUUM/ANALYZE/EXPLAIN
    'FORCE_QUOTE FORCE_NOT_NULL FORCE_NULL COSTS BUFFERS TIMING SUMMARY DISABLE_PAGE_SKIPPING ' +
    //
    'RESTART CYCLE GENERATED IDENTITY DEFERRED IMMEDIATE LEVEL LOGGED UNLOGGED ' +
    'OF NOTHING NONE EXCLUDE ATTRIBUTE ' +
    // from GRANT (not keywords actually)
    'USAGE ROUTINES ' +
    // actually literals, but look better this way (due to IS TRUE, IS FALSE, ISNULL etc)
    'TRUE FALSE NAN INFINITY ';

  var ROLE_ATTRS = // only those not in keywrods already
    'SUPERUSER NOSUPERUSER CREATEDB NOCREATEDB CREATEROLE NOCREATEROLE INHERIT NOINHERIT ' +
    'LOGIN NOLOGIN REPLICATION NOREPLICATION BYPASSRLS NOBYPASSRLS ';

  var PLPGSQL_KW = 
    'ALIAS BEGIN CONSTANT DECLARE END EXCEPTION RETURN PERFORM|10 RAISE GET DIAGNOSTICS ' +
    'STACKED|10 FOREACH LOOP ELSIF EXIT WHILE REVERSE SLICE DEBUG LOG INFO NOTICE WARNING ASSERT ' +
    'OPEN ';

  var TYPES =
    // https://www.postgresql.org/docs/11/static/datatype.html
    'BIGINT INT8 BIGSERIAL SERIAL8 BIT VARYING VARBIT BOOLEAN BOOL BOX BYTEA CHARACTER CHAR VARCHAR ' +
    'CIDR CIRCLE DATE DOUBLE PRECISION FLOAT8 FLOAT INET INTEGER INT INT4 INTERVAL JSON JSONB LINE LSEG|10 ' +
    'MACADDR MACADDR8 MONEY NUMERIC DEC DECIMAL PATH POINT POLYGON REAL FLOAT4 SMALLINT INT2 ' +
    'SMALLSERIAL|10 SERIAL2|10 SERIAL|10 SERIAL4|10 TEXT TIME ZONE TIMETZ|10 TIMESTAMP TIMESTAMPTZ|10 TSQUERY|10 TSVECTOR|10 ' +
    'TXID_SNAPSHOT|10 UUID XML NATIONAL NCHAR ' +
    'INT4RANGE|10 INT8RANGE|10 NUMRANGE|10 TSRANGE|10 TSTZRANGE|10 DATERANGE|10 ' +
    // pseudotypes
    'ANYELEMENT ANYARRAY ANYNONARRAY ANYENUM ANYRANGE CSTRING INTERNAL ' +
    'RECORD PG_DDL_COMMAND VOID UNKNOWN OPAQUE REFCURSOR ' +
    // spec. type
    'NAME ' +
    // OID-types
    'OID REGPROC|10 REGPROCEDURE|10 REGOPER|10 REGOPERATOR|10 REGCLASS|10 REGTYPE|10 REGROLE|10 ' +
    'REGNAMESPACE|10 REGCONFIG|10 REGDICTIONARY|10 ';// +
    
  var TYPES_RE = 
    TYPES.trim()
         .split(' ')
         .map( function(val) { return val.split('|')[0]; } )
         .join('|');

  var SQL_BI =
    'CURRENT_TIME CURRENT_TIMESTAMP CURRENT_USER CURRENT_CATALOG|10 CURRENT_DATE LOCALTIME LOCALTIMESTAMP ' +
    'CURRENT_ROLE|10 CURRENT_SCHEMA|10 SESSION_USER PUBLIC ';

  var PLPGSQL_BI =
    'FOUND NEW OLD TG_NAME|10 TG_WHEN|10 TG_LEVEL|10 TG_OP|10 TG_RELID|10 TG_RELNAME|10 ' +
    'TG_TABLE_NAME|10 TG_TABLE_SCHEMA|10 TG_NARGS|10 TG_ARGV|10 TG_EVENT|10 TG_TAG|10 ' +
    // get diagnostics
    'ROW_COUNT RESULT_OID|10 PG_CONTEXT|10 RETURNED_SQLSTATE COLUMN_NAME CONSTRAINT_NAME ' +
    'PG_DATATYPE_NAME|10 MESSAGE_TEXT TABLE_NAME SCHEMA_NAME PG_EXCEPTION_DETAIL|10 ' +
    'PG_EXCEPTION_HINT|10 PG_EXCEPTION_CONTEXT|10 ';

  var PLPGSQL_EXCEPTIONS =
    // exceptions https://www.postgresql.org/docs/current/static/errcodes-appendix.html
    'SQLSTATE SQLERRM|10 ' +
    'SUCCESSFUL_COMPLETION WARNING DYNAMIC_RESULT_SETS_RETURNED IMPLICIT_ZERO_BIT_PADDING ' +
    'NULL_VALUE_ELIMINATED_IN_SET_FUNCTION PRIVILEGE_NOT_GRANTED PRIVILEGE_NOT_REVOKED ' +
    'STRING_DATA_RIGHT_TRUNCATION DEPRECATED_FEATURE NO_DATA NO_ADDITIONAL_DYNAMIC_RESULT_SETS_RETURNED ' +
    'SQL_STATEMENT_NOT_YET_COMPLETE CONNECTION_EXCEPTION CONNECTION_DOES_NOT_EXIST CONNECTION_FAILURE ' +
    'SQLCLIENT_UNABLE_TO_ESTABLISH_SQLCONNECTION SQLSERVER_REJECTED_ESTABLISHMENT_OF_SQLCONNECTION ' +
    'TRANSACTION_RESOLUTION_UNKNOWN PROTOCOL_VIOLATION TRIGGERED_ACTION_EXCEPTION FEATURE_NOT_SUPPORTED ' +
    'INVALID_TRANSACTION_INITIATION LOCATOR_EXCEPTION INVALID_LOCATOR_SPECIFICATION INVALID_GRANTOR ' +
    'INVALID_GRANT_OPERATION INVALID_ROLE_SPECIFICATION DIAGNOSTICS_EXCEPTION ' +
    'STACKED_DIAGNOSTICS_ACCESSED_WITHOUT_ACTIVE_HANDLER CASE_NOT_FOUND CARDINALITY_VIOLATION ' +
    'DATA_EXCEPTION ARRAY_SUBSCRIPT_ERROR CHARACTER_NOT_IN_REPERTOIRE DATETIME_FIELD_OVERFLOW ' +
    'DIVISION_BY_ZERO ERROR_IN_ASSIGNMENT ESCAPE_CHARACTER_CONFLICT INDICATOR_OVERFLOW ' +
    'INTERVAL_FIELD_OVERFLOW INVALID_ARGUMENT_FOR_LOGARITHM INVALID_ARGUMENT_FOR_NTILE_FUNCTION ' +
    'INVALID_ARGUMENT_FOR_NTH_VALUE_FUNCTION INVALID_ARGUMENT_FOR_POWER_FUNCTION ' +
    'INVALID_ARGUMENT_FOR_WIDTH_BUCKET_FUNCTION INVALID_CHARACTER_VALUE_FOR_CAST ' +
    'INVALID_DATETIME_FORMAT INVALID_ESCAPE_CHARACTER INVALID_ESCAPE_OCTET INVALID_ESCAPE_SEQUENCE ' +
    'NONSTANDARD_USE_OF_ESCAPE_CHARACTER INVALID_INDICATOR_PARAMETER_VALUE INVALID_PARAMETER_VALUE ' +
    'INVALID_REGULAR_EXPRESSION INVALID_ROW_COUNT_IN_LIMIT_CLAUSE ' +
    'INVALID_ROW_COUNT_IN_RESULT_OFFSET_CLAUSE INVALID_TABLESAMPLE_ARGUMENT INVALID_TABLESAMPLE_REPEAT ' +
    'INVALID_TIME_ZONE_DISPLACEMENT_VALUE INVALID_USE_OF_ESCAPE_CHARACTER MOST_SPECIFIC_TYPE_MISMATCH ' +
    'NULL_VALUE_NOT_ALLOWED NULL_VALUE_NO_INDICATOR_PARAMETER NUMERIC_VALUE_OUT_OF_RANGE ' +
    'SEQUENCE_GENERATOR_LIMIT_EXCEEDED STRING_DATA_LENGTH_MISMATCH STRING_DATA_RIGHT_TRUNCATION ' +
    'SUBSTRING_ERROR TRIM_ERROR UNTERMINATED_C_STRING ZERO_LENGTH_CHARACTER_STRING ' +
    'FLOATING_POINT_EXCEPTION INVALID_TEXT_REPRESENTATION INVALID_BINARY_REPRESENTATION ' +
    'BAD_COPY_FILE_FORMAT UNTRANSLATABLE_CHARACTER NOT_AN_XML_DOCUMENT INVALID_XML_DOCUMENT ' +
    'INVALID_XML_CONTENT INVALID_XML_COMMENT INVALID_XML_PROCESSING_INSTRUCTION ' +
    'INTEGRITY_CONSTRAINT_VIOLATION RESTRICT_VIOLATION NOT_NULL_VIOLATION FOREIGN_KEY_VIOLATION ' +
    'UNIQUE_VIOLATION CHECK_VIOLATION EXCLUSION_VIOLATION INVALID_CURSOR_STATE ' +
    'INVALID_TRANSACTION_STATE ACTIVE_SQL_TRANSACTION BRANCH_TRANSACTION_ALREADY_ACTIVE ' +
    'HELD_CURSOR_REQUIRES_SAME_ISOLATION_LEVEL INAPPROPRIATE_ACCESS_MODE_FOR_BRANCH_TRANSACTION ' +
    'INAPPROPRIATE_ISOLATION_LEVEL_FOR_BRANCH_TRANSACTION ' +
    'NO_ACTIVE_SQL_TRANSACTION_FOR_BRANCH_TRANSACTION READ_ONLY_SQL_TRANSACTION ' +
    'SCHEMA_AND_DATA_STATEMENT_MIXING_NOT_SUPPORTED NO_ACTIVE_SQL_TRANSACTION ' +
    'IN_FAILED_SQL_TRANSACTION IDLE_IN_TRANSACTION_SESSION_TIMEOUT INVALID_SQL_STATEMENT_NAME ' +
    'TRIGGERED_DATA_CHANGE_VIOLATION INVALID_AUTHORIZATION_SPECIFICATION INVALID_PASSWORD ' +
    'DEPENDENT_PRIVILEGE_DESCRIPTORS_STILL_EXIST DEPENDENT_OBJECTS_STILL_EXIST ' +
    'INVALID_TRANSACTION_TERMINATION SQL_ROUTINE_EXCEPTION FUNCTION_EXECUTED_NO_RETURN_STATEMENT ' +
    'MODIFYING_SQL_DATA_NOT_PERMITTED PROHIBITED_SQL_STATEMENT_ATTEMPTED ' +
    'READING_SQL_DATA_NOT_PERMITTED INVALID_CURSOR_NAME EXTERNAL_ROUTINE_EXCEPTION ' +
    'CONTAINING_SQL_NOT_PERMITTED MODIFYING_SQL_DATA_NOT_PERMITTED ' +
    'PROHIBITED_SQL_STATEMENT_ATTEMPTED READING_SQL_DATA_NOT_PERMITTED ' +
    'EXTERNAL_ROUTINE_INVOCATION_EXCEPTION INVALID_SQLSTATE_RETURNED NULL_VALUE_NOT_ALLOWED ' +
    'TRIGGER_PROTOCOL_VIOLATED SRF_PROTOCOL_VIOLATED EVENT_TRIGGER_PROTOCOL_VIOLATED ' +
    'SAVEPOINT_EXCEPTION INVALID_SAVEPOINT_SPECIFICATION INVALID_CATALOG_NAME ' +
    'INVALID_SCHEMA_NAME TRANSACTION_ROLLBACK TRANSACTION_INTEGRITY_CONSTRAINT_VIOLATION ' +
    'SERIALIZATION_FAILURE STATEMENT_COMPLETION_UNKNOWN DEADLOCK_DETECTED ' +
    'SYNTAX_ERROR_OR_ACCESS_RULE_VIOLATION SYNTAX_ERROR INSUFFICIENT_PRIVILEGE CANNOT_COERCE ' +
    'GROUPING_ERROR WINDOWING_ERROR INVALID_RECURSION INVALID_FOREIGN_KEY INVALID_NAME ' +
    'NAME_TOO_LONG RESERVED_NAME DATATYPE_MISMATCH INDETERMINATE_DATATYPE COLLATION_MISMATCH ' +
    'INDETERMINATE_COLLATION WRONG_OBJECT_TYPE GENERATED_ALWAYS UNDEFINED_COLUMN ' +
    'UNDEFINED_FUNCTION UNDEFINED_TABLE UNDEFINED_PARAMETER UNDEFINED_OBJECT ' +
    'DUPLICATE_COLUMN DUPLICATE_CURSOR DUPLICATE_DATABASE DUPLICATE_FUNCTION ' +
    'DUPLICATE_PREPARED_STATEMENT DUPLICATE_SCHEMA DUPLICATE_TABLE DUPLICATE_ALIAS ' +
    'DUPLICATE_OBJECT AMBIGUOUS_COLUMN AMBIGUOUS_FUNCTION AMBIGUOUS_PARAMETER AMBIGUOUS_ALIAS ' +
    'INVALID_COLUMN_REFERENCE INVALID_COLUMN_DEFINITION INVALID_CURSOR_DEFINITION ' +
    'INVALID_DATABASE_DEFINITION INVALID_FUNCTION_DEFINITION ' +
    'INVALID_PREPARED_STATEMENT_DEFINITION INVALID_SCHEMA_DEFINITION INVALID_TABLE_DEFINITION ' +
    'INVALID_OBJECT_DEFINITION WITH_CHECK_OPTION_VIOLATION INSUFFICIENT_RESOURCES DISK_FULL ' +
    'OUT_OF_MEMORY TOO_MANY_CONNECTIONS CONFIGURATION_LIMIT_EXCEEDED PROGRAM_LIMIT_EXCEEDED ' +
    'STATEMENT_TOO_COMPLEX TOO_MANY_COLUMNS TOO_MANY_ARGUMENTS OBJECT_NOT_IN_PREREQUISITE_STATE ' +
    'OBJECT_IN_USE CANT_CHANGE_RUNTIME_PARAM LOCK_NOT_AVAILABLE OPERATOR_INTERVENTION ' +
    'QUERY_CANCELED ADMIN_SHUTDOWN CRASH_SHUTDOWN CANNOT_CONNECT_NOW DATABASE_DROPPED ' +
    'SYSTEM_ERROR IO_ERROR UNDEFINED_FILE DUPLICATE_FILE SNAPSHOT_TOO_OLD CONFIG_FILE_ERROR ' +
    'LOCK_FILE_EXISTS FDW_ERROR FDW_COLUMN_NAME_NOT_FOUND FDW_DYNAMIC_PARAMETER_VALUE_NEEDED ' +
    'FDW_FUNCTION_SEQUENCE_ERROR FDW_INCONSISTENT_DESCRIPTOR_INFORMATION ' +
    'FDW_INVALID_ATTRIBUTE_VALUE FDW_INVALID_COLUMN_NAME FDW_INVALID_COLUMN_NUMBER ' +
    'FDW_INVALID_DATA_TYPE FDW_INVALID_DATA_TYPE_DESCRIPTORS ' +
    'FDW_INVALID_DESCRIPTOR_FIELD_IDENTIFIER FDW_INVALID_HANDLE FDW_INVALID_OPTION_INDEX ' +
    'FDW_INVALID_OPTION_NAME FDW_INVALID_STRING_LENGTH_OR_BUFFER_LENGTH ' +
    'FDW_INVALID_STRING_FORMAT FDW_INVALID_USE_OF_NULL_POINTER FDW_TOO_MANY_HANDLES ' +
    'FDW_OUT_OF_MEMORY FDW_NO_SCHEMAS FDW_OPTION_NAME_NOT_FOUND FDW_REPLY_HANDLE ' +
    'FDW_SCHEMA_NOT_FOUND FDW_TABLE_NOT_FOUND FDW_UNABLE_TO_CREATE_EXECUTION ' +
    'FDW_UNABLE_TO_CREATE_REPLY FDW_UNABLE_TO_ESTABLISH_CONNECTION PLPGSQL_ERROR ' +
    'RAISE_EXCEPTION NO_DATA_FOUND TOO_MANY_ROWS ASSERT_FAILURE INTERNAL_ERROR DATA_CORRUPTED ' +
    'INDEX_CORRUPTED ';

  var FUNCTIONS =
    // https://www.postgresql.org/docs/11/static/functions-aggregate.html
    'ARRAY_AGG AVG BIT_AND BIT_OR BOOL_AND BOOL_OR COUNT EVERY JSON_AGG JSONB_AGG JSON_OBJECT_AGG ' +
    'JSONB_OBJECT_AGG MAX MIN MODE STRING_AGG SUM XMLAGG ' +
    'CORR COVAR_POP COVAR_SAMP REGR_AVGX REGR_AVGY REGR_COUNT REGR_INTERCEPT REGR_R2 REGR_SLOPE ' +
    'REGR_SXX REGR_SXY REGR_SYY STDDEV STDDEV_POP STDDEV_SAMP VARIANCE VAR_POP VAR_SAMP ' +
    'PERCENTILE_CONT PERCENTILE_DISC ' +
    // https://www.postgresql.org/docs/11/static/functions-window.html
    'ROW_NUMBER RANK DENSE_RANK PERCENT_RANK CUME_DIST NTILE LAG LEAD FIRST_VALUE LAST_VALUE NTH_VALUE ' +
    // https://www.postgresql.org/docs/11/static/functions-comparison.html
    'NUM_NONNULLS NUM_NULLS ' +
    // https://www.postgresql.org/docs/11/static/functions-math.html
    'ABS CBRT CEIL CEILING DEGREES DIV EXP FLOOR LN LOG MOD PI POWER RADIANS ROUND SCALE SIGN SQRT ' +
    'TRUNC WIDTH_BUCKET ' +
    'RANDOM SETSEED ' +
    'ACOS ACOSD ASIN ASIND ATAN ATAND ATAN2 ATAN2D COS COSD COT COTD SIN SIND TAN TAND ' +
    // https://www.postgresql.org/docs/11/static/functions-string.html
    'BIT_LENGTH CHAR_LENGTH CHARACTER_LENGTH LOWER OCTET_LENGTH OVERLAY POSITION SUBSTRING TREAT TRIM UPPER ' +
    'ASCII BTRIM CHR CONCAT CONCAT_WS CONVERT CONVERT_FROM CONVERT_TO DECODE ENCODE INITCAP' +
    'LEFT LENGTH LPAD LTRIM MD5 PARSE_IDENT PG_CLIENT_ENCODING QUOTE_IDENT|10 QUOTE_LITERAL|10 ' +
    'QUOTE_NULLABLE|10 REGEXP_MATCH REGEXP_MATCHES REGEXP_REPLACE REGEXP_SPLIT_TO_ARRAY ' +
    'REGEXP_SPLIT_TO_TABLE REPEAT REPLACE REVERSE RIGHT RPAD RTRIM SPLIT_PART STRPOS SUBSTR ' +
    'TO_ASCII TO_HEX TRANSLATE ' +
    // https://www.postgresql.org/docs/11/static/functions-binarystring.html
    'OCTET_LENGTH GET_BIT GET_BYTE SET_BIT SET_BYTE ' +
    // https://www.postgresql.org/docs/11/static/functions-formatting.html
    'TO_CHAR TO_DATE TO_NUMBER TO_TIMESTAMP ' +
    // https://www.postgresql.org/docs/11/static/functions-datetime.html
    'AGE CLOCK_TIMESTAMP|10 DATE_PART DATE_TRUNC ISFINITE JUSTIFY_DAYS JUSTIFY_HOURS JUSTIFY_INTERVAL ' +
    'MAKE_DATE MAKE_INTERVAL|10 MAKE_TIME MAKE_TIMESTAMP|10 MAKE_TIMESTAMPTZ|10 NOW STATEMENT_TIMESTAMP|10 ' +
    'TIMEOFDAY TRANSACTION_TIMESTAMP|10 ' +
    // https://www.postgresql.org/docs/11/static/functions-enum.html
    'ENUM_FIRST ENUM_LAST ENUM_RANGE ' +
    // https://www.postgresql.org/docs/11/static/functions-geometry.html
    'AREA CENTER DIAMETER HEIGHT ISCLOSED ISOPEN NPOINTS PCLOSE POPEN RADIUS WIDTH ' +
    'BOX BOUND_BOX CIRCLE LINE LSEG PATH POLYGON ' +
    // https://www.postgresql.org/docs/11/static/functions-net.html
    'ABBREV BROADCAST HOST HOSTMASK MASKLEN NETMASK NETWORK SET_MASKLEN TEXT INET_SAME_FAMILY' +
    'INET_MERGE MACADDR8_SET7BIT ' +
    // https://www.postgresql.org/docs/11/static/functions-textsearch.html
    'ARRAY_TO_TSVECTOR GET_CURRENT_TS_CONFIG NUMNODE PLAINTO_TSQUERY PHRASETO_TSQUERY WEBSEARCH_TO_TSQUERY ' +
    'QUERYTREE SETWEIGHT STRIP TO_TSQUERY TO_TSVECTOR JSON_TO_TSVECTOR JSONB_TO_TSVECTOR TS_DELETE ' +
    'TS_FILTER TS_HEADLINE TS_RANK TS_RANK_CD TS_REWRITE TSQUERY_PHRASE TSVECTOR_TO_ARRAY ' +
    'TSVECTOR_UPDATE_TRIGGER TSVECTOR_UPDATE_TRIGGER_COLUMN ' +
    // https://www.postgresql.org/docs/11/static/functions-xml.html
    'XMLCOMMENT XMLCONCAT XMLELEMENT XMLFOREST XMLPI XMLROOT ' +
    'XMLEXISTS XML_IS_WELL_FORMED XML_IS_WELL_FORMED_DOCUMENT XML_IS_WELL_FORMED_CONTENT ' +
    'XPATH XPATH_EXISTS XMLTABLE XMLNAMESPACES ' +
    'TABLE_TO_XML TABLE_TO_XMLSCHEMA TABLE_TO_XML_AND_XMLSCHEMA ' +
    'QUERY_TO_XML QUERY_TO_XMLSCHEMA QUERY_TO_XML_AND_XMLSCHEMA ' +
    'CURSOR_TO_XML CURSOR_TO_XMLSCHEMA ' +
    'SCHEMA_TO_XML SCHEMA_TO_XMLSCHEMA SCHEMA_TO_XML_AND_XMLSCHEMA ' +
    'DATABASE_TO_XML DATABASE_TO_XMLSCHEMA DATABASE_TO_XML_AND_XMLSCHEMA ' +
    'XMLATTRIBUTES ' +
    // https://www.postgresql.org/docs/11/static/functions-json.html
    'TO_JSON TO_JSONB ARRAY_TO_JSON ROW_TO_JSON JSON_BUILD_ARRAY JSONB_BUILD_ARRAY JSON_BUILD_OBJECT ' +
    'JSONB_BUILD_OBJECT JSON_OBJECT JSONB_OBJECT JSON_ARRAY_LENGTH JSONB_ARRAY_LENGTH JSON_EACH ' +
    'JSONB_EACH JSON_EACH_TEXT JSONB_EACH_TEXT JSON_EXTRACT_PATH JSONB_EXTRACT_PATH ' +
    'JSON_OBJECT_KEYS JSONB_OBJECT_KEYS JSON_POPULATE_RECORD JSONB_POPULATE_RECORD JSON_POPULATE_RECORDSET ' +
    'JSONB_POPULATE_RECORDSET JSON_ARRAY_ELEMENTS JSONB_ARRAY_ELEMENTS JSON_ARRAY_ELEMENTS_TEXT ' +
    'JSONB_ARRAY_ELEMENTS_TEXT JSON_TYPEOF JSONB_TYPEOF JSON_TO_RECORD JSONB_TO_RECORD JSON_TO_RECORDSET ' +
    'JSONB_TO_RECORDSET JSON_STRIP_NULLS JSONB_STRIP_NULLS JSONB_SET JSONB_INSERT JSONB_PRETTY ' +
    // https://www.postgresql.org/docs/11/static/functions-sequence.html
    'CURRVAL LASTVAL NEXTVAL SETVAL ' +
    // https://www.postgresql.org/docs/11/static/functions-conditional.html
    'COALESCE NULLIF GREATEST LEAST ' +
    // https://www.postgresql.org/docs/11/static/functions-array.html
    'ARRAY_APPEND ARRAY_CAT ARRAY_NDIMS ARRAY_DIMS ARRAY_FILL ARRAY_LENGTH ARRAY_LOWER ARRAY_POSITION ' +
    'ARRAY_POSITIONS ARRAY_PREPEND ARRAY_REMOVE ARRAY_REPLACE ARRAY_TO_STRING ARRAY_UPPER CARDINALITY ' +
    'STRING_TO_ARRAY UNNEST ' +
    // https://www.postgresql.org/docs/11/static/functions-range.html
    'ISEMPTY LOWER_INC UPPER_INC LOWER_INF UPPER_INF RANGE_MERGE ' +
    // https://www.postgresql.org/docs/11/static/functions-srf.html
    'GENERATE_SERIES GENERATE_SUBSCRIPTS ' +
    // https://www.postgresql.org/docs/11/static/functions-info.html
    'CURRENT_DATABASE CURRENT_QUERY CURRENT_SCHEMA|10 CURRENT_SCHEMAS|10 INET_CLIENT_ADDR INET_CLIENT_PORT ' +
    'INET_SERVER_ADDR INET_SERVER_PORT ROW_SECURITY_ACTIVE FORMAT_TYPE ' +
    'TO_REGCLASS TO_REGPROC TO_REGPROCEDURE TO_REGOPER TO_REGOPERATOR TO_REGTYPE TO_REGNAMESPACE TO_REGROLE ' +
    'COL_DESCRIPTION OBJ_DESCRIPTION SHOBJ_DESCRIPTION ' +
    'TXID_CURRENT TXID_CURRENT_IF_ASSIGNED TXID_CURRENT_SNAPSHOT TXID_SNAPSHOT_XIP TXID_SNAPSHOT_XMAX ' +
    'TXID_SNAPSHOT_XMIN TXID_VISIBLE_IN_SNAPSHOT TXID_STATUS ' +
    // https://www.postgresql.org/docs/11/static/functions-admin.html
    'CURRENT_SETTING SET_CONFIG BRIN_SUMMARIZE_NEW_VALUES BRIN_SUMMARIZE_RANGE BRIN_DESUMMARIZE_RANGE ' +
    'GIN_CLEAN_PENDING_LIST ' +
    // https://www.postgresql.org/docs/11/static/functions-trigger.html
    'SUPPRESS_REDUNDANT_UPDATES_TRIGGER ' +
    // ihttps://www.postgresql.org/docs/devel/static/lo-funcs.html
    'LO_FROM_BYTEA LO_PUT LO_GET LO_CREAT LO_CREATE LO_UNLINK LO_IMPORT LO_EXPORT LOREAD LOWRITE ' +
    //
    'GROUPING CAST ';

    var FUNCTIONS_RE = 
      FUNCTIONS.trim()
               .split(' ')
               .map( function(val) { return val.split('|')[0]; } )
               .join('|');

    return {
        aliases: ['postgres','postgresql'],
        case_insensitive: true,
        keywords: {
          keyword:
            SQL_KW + PLPGSQL_KW + ROLE_ATTRS,
          built_in:
            SQL_BI + PLPGSQL_BI + PLPGSQL_EXCEPTIONS,
        },
        // Forbid some cunstructs from other languages to improve autodetect. In fact
        // "[a-z]:" is legal (as part of array slice), but improbabal.
        illegal: /:==|\W\s*\(\*|(^|\s)\$[a-z]|{{|[a-z]:\s*$|\.\.\.|TO:|DO:/,
        contains: [
          // special handling of some words, which are reserved only in some contexts
          {
            className: 'keyword',
            variants: [
              { begin: /\bTEXT\s*SEARCH\b/ },
              { begin: /\b(PRIMARY|FOREIGN|FOR(\s+NO)?)\s+KEY\b/ },
              { begin: /\bPARALLEL\s+(UNSAFE|RESTRICTED|SAFE)\b/ },
              { begin: /\bSTORAGE\s+(PLAIN|EXTERNAL|EXTENDED|MAIN)\b/ },
              { begin: /\bMATCH\s+(FULL|PARTIAL|SIMPLE)\b/ },
              { begin: /\bNULLS\s+(FIRST|LAST)\b/ },
              { begin: /\bEVENT\s+TRIGGER\b/ },
              { begin: /\b(MAPPING|OR)\s+REPLACE\b/ },
              { begin: /\b(FROM|TO)\s+(PROGRAM|STDIN|STDOUT)\b/ },
              { begin: /\b(SHARE|EXCLUSIVE)\s+MODE\b/ },
              { begin: /\b(LEFT|RIGHT)\s+(OUTER\s+)?JOIN\b/ },
              { begin: /\b(FETCH|MOVE)\s+(NEXT|PRIOR|FIRST|LAST|ABSOLUTE|RELATIVE|FORWARD|BACKWARD)\b/ },
              { begin: /\bPRESERVE\s+ROWS\b/ },
              { begin: /\bDISCARD\s+PLANS\b/ },
              { begin: /\bREFERENCING\s+(OLD|NEW)\b/ },
              { begin: /\bSKIP\s+LOCKED\b/ },
              { begin: /\bGROUPING\s+SETS\b/ },
              { begin: /\b(BINARY|INSENSITIVE|SCROLL|NO\s+SCROLL)\s+(CURSOR|FOR)\b/ },
              { begin: /\b(WITH|WITHOUT)\s+HOLD\b/ },
              { begin: /\bWITH\s+(CASCADED|LOCAL)\s+CHECK\s+OPTION\b/ },
              { begin: /\bEXCLUDE\s+(TIES|NO\s+OTHERS)\b/ },
              { begin: /\bFORMAT\s+(TEXT|XML|JSON|YAML)\b/ },
              { begin: /\bSET\s+((SESSION|LOCAL)\s+)?NAMES\b/ },
              { begin: /\bIS\s+(NOT\s+)?UNKNOWN\b/ },
              { begin: /\bSECURITY\s+LABEL\b/ },
              { begin: /\bSTANDALONE\s+(YES|NO|NO\s+VALUE)\b/ },
              { begin: /\bWITH\s+(NO\s+)?DATA\b/ },
              { begin: /\b(FOREIGN|SET)\s+DATA\b/ },
              { begin: /\bSET\s+(CATALOG|CONSTRAINTS)\b/ },
              { begin: /\b(WITH|FOR)\s+ORDINALITY\b/ },
              { begin: /\bIS\s+(NOT\s+)?DOCUMENT\b/ },
              { begin: /\bXML\s+OPTION\s+(DOCUMENT|CONTENT)\b/ },
              { begin: /\b(STRIP|PRESERVE)\s+WHITESPACE\b/ },
              { begin: /\bNO\s+(ACTION|MAXVALUE|MINVALUE)\b/ },
              { begin: /\bPARTITION\s+BY\s+(RANGE|LIST|HASH)\b/ },
              { begin: /\bAT\s+TIME\s+ZONE\b/ },
              { begin: /\bGRANTED\s+BY\b/ },
              { begin: /\bRETURN\s+(QUERY|NEXT)\b/ },
              { begin: /\b(ATTACH|DETACH)\s+PARTITION\b/ },
              { begin: /\bFORCE\s+ROW\s+LEVEL\s+SECURITY\b/ },
              { begin: /\b(INCLUDING|EXCLUDING)\s+(COMMENTS|CONSTRAINTS|DEFAULTS|IDENTITY|INDEXES|STATISTICS|STORAGE|ALL)\b/ },
              { begin: /\bAS\s+(ASSIGNMENT|IMPLICIT|PERMISSIVE|RESTRICTIVE|ENUM|RANGE)\b/ }
            ]
          },
          // functions named as keywords, followed by '('
          {
            begin: /\b(FORMAT|FAMILY|VERSION)\s*\(/,
            //keywords: { built_in: 'FORMAT FAMILY VERSION' }
          },
          // INCLUDE ( ... ) in index_parameters in CREATE TABLE
          {
            begin: /\bINCLUDE\s*\(/,
            keywords: 'INCLUDE'
          },
          // not highlight RANGE if not in frame_clause (not 100% correct, but seems satisfactory)
          {
            begin: /\bRANGE(?!\s*(BETWEEN|UNBOUNDED|CURRENT|[-0-9]+))/
          },
          // disable highlighting in commands CREATE AGGREGATE/COLLATION/DATABASE/OPERTOR/TEXT SEARCH .../TYPE
          // and in PL/pgSQL RAISE ... USING
          {
            begin: /\b(VERSION|OWNER|TEMPLATE|TABLESPACE|CONNECTION\s+LIMIT|PROCEDURE|RESTRICT|JOIN|PARSER|COPY|START|END|COLLATION|INPUT|ANALYZE|STORAGE|LIKE|DEFAULT|DELIMITER|ENCODING|COLUMN|CONSTRAINT|TABLE|SCHEMA)\s*=/
          },
          // PG_smth; HAS_some_PRIVILEGE
          {
            //className: 'built_in',
            begin: /\b(PG_\w+?|HAS_[A-Z_]+_PRIVILEGE)\b/,
            relevance: 10
          },
          // extract
          {
            begin: /\bEXTRACT\s*\(/,
            end: /\bFROM\b/,
            returnEnd: true,
            keywords: {
              //built_in: 'EXTRACT',
              type:     'CENTURY DAY DECADE DOW DOY EPOCH HOUR ISODOW ISOYEAR MICROSECONDS ' +
                        'MILLENNIUM MILLISECONDS MINUTE MONTH QUARTER SECOND TIMEZONE TIMEZONE_HOUR ' +
                        'TIMEZONE_MINUTE WEEK YEAR'
            }
          },
          // xmlelement, xmlpi - special NAME
          {
            begin: /\b(XMLELEMENT|XMLPI)\s*\(\s*NAME/,
            keywords: {
              //built_in: 'XMLELEMENT XMLPI',
              keyword:  'NAME'
            }
          },
          // xmlparse, xmlserialize
          {
            begin: /\b(XMLPARSE|XMLSERIALIZE)\s*\(\s*(DOCUMENT|CONTENT)/,
            keywords: {
              //built_in: 'XMLPARSE XMLSERIALIZE',
              keyword:  'DOCUMENT CONTENT'
            }
          },
          // Sequences. We actually skip everything between CACHE|INCREMENT|MAXVALUE|MINVALUE and
          // nearest following numeric constant. Without with trick we find a lot of "keywords"
          // in 'avrasm' autodetection test...
          {
            beginKeywords: 'CACHE INCREMENT MAXVALUE MINVALUE',
            end: hljs.C_NUMBER_RE,
            returnEnd: true,
            keywords: 'BY CACHE INCREMENT MAXVALUE MINVALUE'
          },
          // WITH|WITHOUT TIME ZONE as part of datatype
          {
            className: 'type',
            begin: /\b(WITH|WITHOUT)\s+TIME\s+ZONE\b/
          },
          // INTERVAL optional fields
          {
            className: 'type',
            begin: /\bINTERVAL\s+(YEAR|MONTH|DAY|HOUR|MINUTE|SECOND)(\s+TO\s+(MONTH|HOUR|MINUTE|SECOND))?\b/
          },
          // Pseudo-types which allowed only as return type
          {
            begin: /\bRETURNS\s+(LANGUAGE_HANDLER|TRIGGER|EVENT_TRIGGER|FDW_HANDLER|INDEX_AM_HANDLER|TSM_HANDLER)\b/,
            keywords: {
              keyword: 'RETURNS',
              type: 'LANGUAGE_HANDLER TRIGGER EVENT_TRIGGER FDW_HANDLER INDEX_AM_HANDLER TSM_HANDLER'
            }
          },
          // Known functions - only when followed by '('
          {
            begin: '\\b(' + FUNCTIONS_RE + ')\\s*\\('
            //keywords: { built_in: FUNCTIONS }
          },
          // Types
          {
            begin: '\\.(' + TYPES_RE + ')\\b' // prevent highlight as type, say, 'oid' in 'pgclass.oid'
          },
          {
            begin: '\\b(' + TYPES_RE + ')\\s+PATH\\b', // in XMLTABLE
            keywords: {
              keyword: 'PATH', // hopefully no one would use PATH type in XMLTABLE...
              type: TYPES.replace('PATH ','')
            }
          },
          {
            className: 'type',
            begin: '\\b(' + TYPES_RE + ')\\b'
          },
          // Strings, see https://www.postgresql.org/docs/11/static/sql-syntax-lexical.html#SQL-SYNTAX-CONSTANTS
          {
            className: 'string',
            begin: '\'', end: '\'',
            contains: [{begin: '\'\''}]
          },
          {
            className: 'string',
            begin: '(e|E|u&|U&)\'', end: '\'',
            contains: [{begin: '\\\\.'}],
            relevance: 10
          },
          {
            begin: DOLLAR_STRING,
            endSameAsBegin: true,
            contains: [
              {
                // actually we want them all except SQL; listed are those with known implementations
                // and XML + JSON just in case
                subLanguage: ['pgsql','perl','python','tcl','r','lua','java','php','ruby','bash','scheme','xml','json'],
                endsWithParent: true
              }
            ]
          },
          // identifiers in quotes
          {
            begin: '"', end: '"',
            contains: [{begin: '""'}]
          },
          // numbers
          hljs.C_NUMBER_MODE,
          // comments
          hljs.C_BLOCK_COMMENT_MODE,
          COMMENT_MODE,
          // PL/pgSQL staff
          // %ROWTYPE, %TYPE, $n
          {
            className: 'meta',
            variants: [
              {begin: '%(ROW)?TYPE', relevance: 10}, // %TYPE, %ROWTYPE
              {begin: '\\$\\d+'},                    // $n
              {begin: '^#\\w', end: '$'}             // #compiler option
            ]
          },
          // <<labeles>>
          {
            className: 'symbol',
            begin: LABEL,
            relevance: 10
          }
        ]
  };
};

var php = function(hljs) {
  var VARIABLE = {
    begin: '\\$+[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*'
  };
  var PREPROCESSOR = {
    className: 'meta', begin: /<\?(php)?|\?>/
  };
  var STRING = {
    className: 'string',
    contains: [hljs.BACKSLASH_ESCAPE, PREPROCESSOR],
    variants: [
      {
        begin: 'b"', end: '"'
      },
      {
        begin: 'b\'', end: '\''
      },
      hljs.inherit(hljs.APOS_STRING_MODE, {illegal: null}),
      hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null})
    ]
  };
  var NUMBER = {variants: [hljs.BINARY_NUMBER_MODE, hljs.C_NUMBER_MODE]};
  return {
    aliases: ['php', 'php3', 'php4', 'php5', 'php6', 'php7'],
    case_insensitive: true,
    keywords:
      'and include_once list abstract global private echo interface as static endswitch ' +
      'array null if endwhile or const for endforeach self var while isset public ' +
      'protected exit foreach throw elseif include __FILE__ empty require_once do xor ' +
      'return parent clone use __CLASS__ __LINE__ else break print eval new ' +
      'catch __METHOD__ case exception default die require __FUNCTION__ ' +
      'enddeclare final try switch continue endfor endif declare unset true false ' +
      'trait goto instanceof insteadof __DIR__ __NAMESPACE__ ' +
      'yield finally',
    contains: [
      hljs.HASH_COMMENT_MODE,
      hljs.COMMENT('//', '$', {contains: [PREPROCESSOR]}),
      hljs.COMMENT(
        '/\\*',
        '\\*/',
        {
          contains: [
            {
              className: 'doctag',
              begin: '@[A-Za-z]+'
            }
          ]
        }
      ),
      hljs.COMMENT(
        '__halt_compiler.+?;',
        false,
        {
          endsWithParent: true,
          keywords: '__halt_compiler',
          lexemes: hljs.UNDERSCORE_IDENT_RE
        }
      ),
      {
        className: 'string',
        begin: /<<<['"]?\w+['"]?$/, end: /^\w+;?$/,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          {
            className: 'subst',
            variants: [
              {begin: /\$\w+/},
              {begin: /\{\$/, end: /\}/}
            ]
          }
        ]
      },
      PREPROCESSOR,
      {
        className: 'keyword', begin: /\$this\b/
      },
      VARIABLE,
      {
        // swallow composed identifiers to avoid parsing them as keywords
        begin: /(::|->)+[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/
      },
      {
        className: 'function',
        beginKeywords: 'function', end: /[;{]/, excludeEnd: true,
        illegal: '\\$|\\[|%',
        contains: [
          hljs.UNDERSCORE_TITLE_MODE,
          {
            className: 'params',
            begin: '\\(', end: '\\)',
            contains: [
              'self',
              VARIABLE,
              hljs.C_BLOCK_COMMENT_MODE,
              STRING,
              NUMBER
            ]
          }
        ]
      },
      {
        className: 'class',
        beginKeywords: 'class interface', end: '{', excludeEnd: true,
        illegal: /[:\(\$"]/,
        contains: [
          {beginKeywords: 'extends implements'},
          hljs.UNDERSCORE_TITLE_MODE
        ]
      },
      {
        beginKeywords: 'namespace', end: ';',
        illegal: /[\.']/,
        contains: [hljs.UNDERSCORE_TITLE_MODE]
      },
      {
        beginKeywords: 'use', end: ';',
        contains: [hljs.UNDERSCORE_TITLE_MODE]
      },
      {
        begin: '=>' // No markup, just a relevance booster
      },
      STRING,
      NUMBER
    ]
  };
};

var plaintext = function(hljs) {
    return {
        disableAutodetect: true
    };
};

var pony = function(hljs) {
  var KEYWORDS = {
    keyword:
      'actor addressof and as be break class compile_error compile_intrinsic ' +
      'consume continue delegate digestof do else elseif embed end error ' +
      'for fun if ifdef in interface is isnt lambda let match new not object ' +
      'or primitive recover repeat return struct then trait try type until ' +
      'use var where while with xor',
    meta:
      'iso val tag trn box ref',
    literal:
      'this false true'
  };

  var TRIPLE_QUOTE_STRING_MODE = {
    className: 'string',
    begin: '"""', end: '"""',
    relevance: 10
  };

  var QUOTE_STRING_MODE = {
    className: 'string',
    begin: '"', end: '"',
    contains: [hljs.BACKSLASH_ESCAPE]
  };

  var SINGLE_QUOTE_CHAR_MODE = {
    className: 'string',
    begin: '\'', end: '\'',
    contains: [hljs.BACKSLASH_ESCAPE],
    relevance: 0
  };

  var TYPE_NAME = {
    className: 'type',
    begin: '\\b_?[A-Z][\\w]*',
    relevance: 0
  };

  var PRIMED_NAME = {
    begin: hljs.IDENT_RE + '\'', relevance: 0
  };

  /**
   * The `FUNCTION` and `CLASS` modes were intentionally removed to simplify
   * highlighting and fix cases like
   * ```
   * interface Iterator[A: A]
   *   fun has_next(): Bool
   *   fun next(): A?
   * ```
   * where it is valid to have a function head without a body
   */

  return {
    keywords: KEYWORDS,
    contains: [
      TYPE_NAME,
      TRIPLE_QUOTE_STRING_MODE,
      QUOTE_STRING_MODE,
      SINGLE_QUOTE_CHAR_MODE,
      PRIMED_NAME,
      hljs.C_NUMBER_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE
    ]
  };
};

var powershell = function(hljs) {
  var BACKTICK_ESCAPE = {
    begin: '`[\\s\\S]',
    relevance: 0
  };
  var VAR = {
    className: 'variable',
    variants: [
      {begin: /\$[\w\d][\w\d_:]*/}
    ]
  };
  var LITERAL = {
    className: 'literal',
    begin: /\$(null|true|false)\b/
  };
  var QUOTE_STRING = {
    className: 'string',
    variants: [
      { begin: /"/, end: /"/ },
      { begin: /@"/, end: /^"@/ }
    ],
    contains: [
      BACKTICK_ESCAPE,
      VAR,
      {
        className: 'variable',
        begin: /\$[A-z]/, end: /[^A-z]/
      }
    ]
  };
  var APOS_STRING = {
    className: 'string',
    variants: [
      { begin: /'/, end: /'/ },
      { begin: /@'/, end: /^'@/ }
    ]
  };

  var PS_HELPTAGS = {
    className: 'doctag',
    variants: [
      /* no paramater help tags */ 
      { begin: /\.(synopsis|description|example|inputs|outputs|notes|link|component|role|functionality)/ },
      /* one parameter help tags */
      { begin: /\.(parameter|forwardhelptargetname|forwardhelpcategory|remotehelprunspace|externalhelp)\s+\S+/ }
    ]
  };
  var PS_COMMENT = hljs.inherit(
    hljs.COMMENT(null, null),
    {
      variants: [
        /* single-line comment */
        { begin: /#/, end: /$/ },
        /* multi-line comment */
        { begin: /<#/, end: /#>/ }
      ],
      contains: [PS_HELPTAGS]
    }
  );

  return {
    aliases: ['ps'],
    lexemes: /-?[A-z\.\-]+/,
    case_insensitive: true,
    keywords: {
      keyword: 'if else foreach return function do while until elseif begin for trap data dynamicparam end break throw param continue finally in switch exit filter try process catch',
      built_in: 'Add-Computer Add-Content Add-History Add-JobTrigger Add-Member Add-PSSnapin Add-Type Checkpoint-Computer Clear-Content Clear-EventLog Clear-History Clear-Host Clear-Item Clear-ItemProperty Clear-Variable Compare-Object Complete-Transaction Connect-PSSession Connect-WSMan Convert-Path ConvertFrom-Csv ConvertFrom-Json ConvertFrom-SecureString ConvertFrom-StringData ConvertTo-Csv ConvertTo-Html ConvertTo-Json ConvertTo-SecureString ConvertTo-Xml Copy-Item Copy-ItemProperty Debug-Process Disable-ComputerRestore Disable-JobTrigger Disable-PSBreakpoint Disable-PSRemoting Disable-PSSessionConfiguration Disable-WSManCredSSP Disconnect-PSSession Disconnect-WSMan Disable-ScheduledJob Enable-ComputerRestore Enable-JobTrigger Enable-PSBreakpoint Enable-PSRemoting Enable-PSSessionConfiguration Enable-ScheduledJob Enable-WSManCredSSP Enter-PSSession Exit-PSSession Export-Alias Export-Clixml Export-Console Export-Counter Export-Csv Export-FormatData Export-ModuleMember Export-PSSession ForEach-Object Format-Custom Format-List Format-Table Format-Wide Get-Acl Get-Alias Get-AuthenticodeSignature Get-ChildItem Get-Command Get-ComputerRestorePoint Get-Content Get-ControlPanelItem Get-Counter Get-Credential Get-Culture Get-Date Get-Event Get-EventLog Get-EventSubscriber Get-ExecutionPolicy Get-FormatData Get-Host Get-HotFix Get-Help Get-History Get-IseSnippet Get-Item Get-ItemProperty Get-Job Get-JobTrigger Get-Location Get-Member Get-Module Get-PfxCertificate Get-Process Get-PSBreakpoint Get-PSCallStack Get-PSDrive Get-PSProvider Get-PSSession Get-PSSessionConfiguration Get-PSSnapin Get-Random Get-ScheduledJob Get-ScheduledJobOption Get-Service Get-TraceSource Get-Transaction Get-TypeData Get-UICulture Get-Unique Get-Variable Get-Verb Get-WinEvent Get-WmiObject Get-WSManCredSSP Get-WSManInstance Group-Object Import-Alias Import-Clixml Import-Counter Import-Csv Import-IseSnippet Import-LocalizedData Import-PSSession Import-Module Invoke-AsWorkflow Invoke-Command Invoke-Expression Invoke-History Invoke-Item Invoke-RestMethod Invoke-WebRequest Invoke-WmiMethod Invoke-WSManAction Join-Path Limit-EventLog Measure-Command Measure-Object Move-Item Move-ItemProperty New-Alias New-Event New-EventLog New-IseSnippet New-Item New-ItemProperty New-JobTrigger New-Object New-Module New-ModuleManifest New-PSDrive New-PSSession New-PSSessionConfigurationFile New-PSSessionOption New-PSTransportOption New-PSWorkflowExecutionOption New-PSWorkflowSession New-ScheduledJobOption New-Service New-TimeSpan New-Variable New-WebServiceProxy New-WinEvent New-WSManInstance New-WSManSessionOption Out-Default Out-File Out-GridView Out-Host Out-Null Out-Printer Out-String Pop-Location Push-Location Read-Host Receive-Job Register-EngineEvent Register-ObjectEvent Register-PSSessionConfiguration Register-ScheduledJob Register-WmiEvent Remove-Computer Remove-Event Remove-EventLog Remove-Item Remove-ItemProperty Remove-Job Remove-JobTrigger Remove-Module Remove-PSBreakpoint Remove-PSDrive Remove-PSSession Remove-PSSnapin Remove-TypeData Remove-Variable Remove-WmiObject Remove-WSManInstance Rename-Computer Rename-Item Rename-ItemProperty Reset-ComputerMachinePassword Resolve-Path Restart-Computer Restart-Service Restore-Computer Resume-Job Resume-Service Save-Help Select-Object Select-String Select-Xml Send-MailMessage Set-Acl Set-Alias Set-AuthenticodeSignature Set-Content Set-Date Set-ExecutionPolicy Set-Item Set-ItemProperty Set-JobTrigger Set-Location Set-PSBreakpoint Set-PSDebug Set-PSSessionConfiguration Set-ScheduledJob Set-ScheduledJobOption Set-Service Set-StrictMode Set-TraceSource Set-Variable Set-WmiInstance Set-WSManInstance Set-WSManQuickConfig Show-Command Show-ControlPanelItem Show-EventLog Sort-Object Split-Path Start-Job Start-Process Start-Service Start-Sleep Start-Transaction Start-Transcript Stop-Computer Stop-Job Stop-Process Stop-Service Stop-Transcript Suspend-Job Suspend-Service Tee-Object Test-ComputerSecureChannel Test-Connection Test-ModuleManifest Test-Path Test-PSSessionConfigurationFile Trace-Command Unblock-File Undo-Transaction Unregister-Event Unregister-PSSessionConfiguration Unregister-ScheduledJob Update-FormatData Update-Help Update-List Update-TypeData Use-Transaction Wait-Event Wait-Job Wait-Process Where-Object Write-Debug Write-Error Write-EventLog Write-Host Write-Output Write-Progress Write-Verbose Write-Warning Add-MDTPersistentDrive Disable-MDTMonitorService Enable-MDTMonitorService Get-MDTDeploymentShareStatistics Get-MDTMonitorData Get-MDTOperatingSystemCatalog Get-MDTPersistentDrive Import-MDTApplication Import-MDTDriver Import-MDTOperatingSystem Import-MDTPackage Import-MDTTaskSequence New-MDTDatabase Remove-MDTMonitorData Remove-MDTPersistentDrive Restore-MDTPersistentDrive Set-MDTMonitorData Test-MDTDeploymentShare Test-MDTMonitorData Update-MDTDatabaseSchema Update-MDTDeploymentShare Update-MDTLinkedDS Update-MDTMedia Update-MDTMedia Add-VamtProductKey Export-VamtData Find-VamtManagedMachine Get-VamtConfirmationId Get-VamtProduct Get-VamtProductKey Import-VamtData Initialize-VamtData Install-VamtConfirmationId Install-VamtProductActivation Install-VamtProductKey Update-VamtProduct',
      nomarkup: '-ne -eq -lt -gt -ge -le -not -like -notlike -match -notmatch -contains -notcontains -in -notin -replace'
    },
    contains: [
      BACKTICK_ESCAPE,
      hljs.NUMBER_MODE,
      QUOTE_STRING,
      APOS_STRING,
      LITERAL,
      VAR,
      PS_COMMENT
    ]
  };
};

var processing = function(hljs) {
  return {
    keywords: {
      keyword: 'BufferedReader PVector PFont PImage PGraphics HashMap boolean byte char color ' +
        'double float int long String Array FloatDict FloatList IntDict IntList JSONArray JSONObject ' +
        'Object StringDict StringList Table TableRow XML ' +
        // Java keywords
        'false synchronized int abstract float private char boolean static null if const ' +
        'for true while long throw strictfp finally protected import native final return void ' +
        'enum else break transient new catch instanceof byte super volatile case assert short ' +
        'package default double public try this switch continue throws protected public private',
      literal: 'P2D P3D HALF_PI PI QUARTER_PI TAU TWO_PI',
      title: 'setup draw',
      built_in: 'displayHeight displayWidth mouseY mouseX mousePressed pmouseX pmouseY key ' +
        'keyCode pixels focused frameCount frameRate height width ' +
        'size createGraphics beginDraw createShape loadShape PShape arc ellipse line point ' +
        'quad rect triangle bezier bezierDetail bezierPoint bezierTangent curve curveDetail curvePoint ' +
        'curveTangent curveTightness shape shapeMode beginContour beginShape bezierVertex curveVertex ' +
        'endContour endShape quadraticVertex vertex ellipseMode noSmooth rectMode smooth strokeCap ' +
        'strokeJoin strokeWeight mouseClicked mouseDragged mouseMoved mousePressed mouseReleased ' +
        'mouseWheel keyPressed keyPressedkeyReleased keyTyped print println save saveFrame day hour ' +
        'millis minute month second year background clear colorMode fill noFill noStroke stroke alpha ' +
        'blue brightness color green hue lerpColor red saturation modelX modelY modelZ screenX screenY ' +
        'screenZ ambient emissive shininess specular add createImage beginCamera camera endCamera frustum ' +
        'ortho perspective printCamera printProjection cursor frameRate noCursor exit loop noLoop popStyle ' +
        'pushStyle redraw binary boolean byte char float hex int str unbinary unhex join match matchAll nf ' +
        'nfc nfp nfs split splitTokens trim append arrayCopy concat expand reverse shorten sort splice subset ' +
        'box sphere sphereDetail createInput createReader loadBytes loadJSONArray loadJSONObject loadStrings ' +
        'loadTable loadXML open parseXML saveTable selectFolder selectInput beginRaw beginRecord createOutput ' +
        'createWriter endRaw endRecord PrintWritersaveBytes saveJSONArray saveJSONObject saveStream saveStrings ' +
        'saveXML selectOutput popMatrix printMatrix pushMatrix resetMatrix rotate rotateX rotateY rotateZ scale ' +
        'shearX shearY translate ambientLight directionalLight lightFalloff lights lightSpecular noLights normal ' +
        'pointLight spotLight image imageMode loadImage noTint requestImage tint texture textureMode textureWrap ' +
        'blend copy filter get loadPixels set updatePixels blendMode loadShader PShaderresetShader shader createFont ' +
        'loadFont text textFont textAlign textLeading textMode textSize textWidth textAscent textDescent abs ceil ' +
        'constrain dist exp floor lerp log mag map max min norm pow round sq sqrt acos asin atan atan2 cos degrees ' +
        'radians sin tan noise noiseDetail noiseSeed random randomGaussian randomSeed'
    },
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.C_NUMBER_MODE
    ]
  };
};

var profile = function(hljs) {
  return {
    contains: [
      hljs.C_NUMBER_MODE,
      {
        begin: '[a-zA-Z_][\\da-zA-Z_]+\\.[\\da-zA-Z_]{1,3}', end: ':',
        excludeEnd: true
      },
      {
        begin: '(ncalls|tottime|cumtime)', end: '$',
        keywords: 'ncalls tottime|10 cumtime|10 filename',
        relevance: 10
      },
      {
        begin: 'function calls', end: '$',
        contains: [hljs.C_NUMBER_MODE],
        relevance: 10
      },
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        begin: '\\(', end: '\\)$',
        excludeBegin: true, excludeEnd: true,
        relevance: 0
      }
    ]
  };
};

var prolog = function(hljs) {

  var ATOM = {

    begin: /[a-z][A-Za-z0-9_]*/,
    relevance: 0
  };

  var VAR = {

    className: 'symbol',
    variants: [
      {begin: /[A-Z][a-zA-Z0-9_]*/},
      {begin: /_[A-Za-z0-9_]*/},
    ],
    relevance: 0
  };

  var PARENTED = {

    begin: /\(/,
    end: /\)/,
    relevance: 0
  };

  var LIST = {

    begin: /\[/,
    end: /\]/
  };

  var LINE_COMMENT = {

    className: 'comment',
    begin: /%/, end: /$/,
    contains: [hljs.PHRASAL_WORDS_MODE]
  };

  var BACKTICK_STRING = {

    className: 'string',
    begin: /`/, end: /`/,
    contains: [hljs.BACKSLASH_ESCAPE]
  };

  var CHAR_CODE = {

    className: 'string', // 0'a etc.
    begin: /0\'(\\\'|.)/
  };

  var SPACE_CODE = {

    className: 'string',
    begin: /0\'\\s/ // 0'\s
  };

  var PRED_OP = { // relevance booster
    begin: /:-/
  };

  var inner = [

    ATOM,
    VAR,
    PARENTED,
    PRED_OP,
    LIST,
    LINE_COMMENT,
    hljs.C_BLOCK_COMMENT_MODE,
    hljs.QUOTE_STRING_MODE,
    hljs.APOS_STRING_MODE,
    BACKTICK_STRING,
    CHAR_CODE,
    SPACE_CODE,
    hljs.C_NUMBER_MODE
  ];

  PARENTED.contains = inner;
  LIST.contains = inner;

  return {
    contains: inner.concat([
      {begin: /\.$/} // relevance booster
    ])
  };
};

var properties = function(hljs) {

  // whitespaces: space, tab, formfeed
  var WS0 = '[ \\t\\f]*';
  var WS1 = '[ \\t\\f]+';
  // delimiter
  var DELIM = '(' + WS0+'[:=]'+WS0+ '|' + WS1 + ')';
  var KEY_ALPHANUM = '([^\\\\\\W:= \\t\\f\\n]|\\\\.)+';
  var KEY_OTHER = '([^\\\\:= \\t\\f\\n]|\\\\.)+';

  var DELIM_AND_VALUE = {
          // skip DELIM
          end: DELIM,
          relevance: 0,
          starts: {
            // value: everything until end of line (again, taking into account backslashes)
            className: 'string',
            end: /$/,
            relevance: 0,
            contains: [
              { begin: '\\\\\\n' }
            ]
          }
        };

  return {
    case_insensitive: true,
    illegal: /\S/,
    contains: [
      hljs.COMMENT('^\\s*[!#]', '$'),
      // key: everything until whitespace or = or : (taking into account backslashes)
      // case of a "normal" key
      {
        begin: KEY_ALPHANUM + DELIM,
        returnBegin: true,
        contains: [
          {
            className: 'attr',
            begin: KEY_ALPHANUM,
            endsParent: true,
            relevance: 0
          }
        ],
        starts: DELIM_AND_VALUE
      },
      // case of key containing non-alphanumeric chars => relevance = 0
      {
        begin: KEY_OTHER + DELIM,
        returnBegin: true,
        relevance: 0,
        contains: [
          {
            className: 'meta',
            begin: KEY_OTHER,
            endsParent: true,
            relevance: 0
          }
        ],
        starts: DELIM_AND_VALUE
      },
      // case of an empty key
      {
        className: 'attr',
        relevance: 0,
        begin: KEY_OTHER + WS0 + '$'
      }
    ]
  };
};

var protobuf = function(hljs) {
  return {
    keywords: {
      keyword: 'package import option optional required repeated group oneof',
      built_in: 'double float int32 int64 uint32 uint64 sint32 sint64 ' +
        'fixed32 fixed64 sfixed32 sfixed64 bool string bytes',
      literal: 'true false'
    },
    contains: [
      hljs.QUOTE_STRING_MODE,
      hljs.NUMBER_MODE,
      hljs.C_LINE_COMMENT_MODE,
      {
        className: 'class',
        beginKeywords: 'message enum service', end: /\{/,
        illegal: /\n/,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {
            starts: {endsWithParent: true, excludeEnd: true} // hack: eating everything after the first title
          })
        ]
      },
      {
        className: 'function',
        beginKeywords: 'rpc',
        end: /;/, excludeEnd: true,
        keywords: 'rpc returns'
      },
      {
        begin: /^\s*[A-Z_]+/,
        end: /\s*=/, excludeEnd: true
      }
    ]
  };
};

var puppet = function(hljs) {

  var PUPPET_KEYWORDS = {
    keyword:
    /* language keywords */
      'and case default else elsif false if in import enherits node or true undef unless main settings $string ',
    literal:
    /* metaparameters */
      'alias audit before loglevel noop require subscribe tag ' +
    /* normal attributes */
      'owner ensure group mode name|0 changes context force incl lens load_path onlyif provider returns root show_diff type_check ' +
      'en_address ip_address realname command environment hour monute month monthday special target weekday '+
      'creates cwd ogoutput refresh refreshonly tries try_sleep umask backup checksum content ctime force ignore ' +
      'links mtime purge recurse recurselimit replace selinux_ignore_defaults selrange selrole seltype seluser source ' +
      'souirce_permissions sourceselect validate_cmd validate_replacement allowdupe attribute_membership auth_membership forcelocal gid '+
      'ia_load_module members system host_aliases ip allowed_trunk_vlans description device_url duplex encapsulation etherchannel ' +
      'native_vlan speed principals allow_root auth_class auth_type authenticate_user k_of_n mechanisms rule session_owner shared options ' +
      'device fstype enable hasrestart directory present absent link atboot blockdevice device dump pass remounts poller_tag use ' +
      'message withpath adminfile allow_virtual allowcdrom category configfiles flavor install_options instance package_settings platform ' +
      'responsefile status uninstall_options vendor unless_system_user unless_uid binary control flags hasstatus manifest pattern restart running ' +
      'start stop allowdupe auths expiry gid groups home iterations key_membership keys managehome membership password password_max_age ' +
      'password_min_age profile_membership profiles project purge_ssh_keys role_membership roles salt shell uid baseurl cost descr enabled ' +
      'enablegroups exclude failovermethod gpgcheck gpgkey http_caching include includepkgs keepalive metadata_expire metalink mirrorlist ' +
      'priority protect proxy proxy_password proxy_username repo_gpgcheck s3_enabled skip_if_unavailable sslcacert sslclientcert sslclientkey ' +
      'sslverify mounted',
    built_in:
    /* core facts */
      'architecture augeasversion blockdevices boardmanufacturer boardproductname boardserialnumber cfkey dhcp_servers ' +
      'domain ec2_ ec2_userdata facterversion filesystems ldom fqdn gid hardwareisa hardwaremodel hostname id|0 interfaces '+
      'ipaddress ipaddress_ ipaddress6 ipaddress6_ iphostnumber is_virtual kernel kernelmajversion kernelrelease kernelversion ' +
      'kernelrelease kernelversion lsbdistcodename lsbdistdescription lsbdistid lsbdistrelease lsbmajdistrelease lsbminordistrelease ' +
      'lsbrelease macaddress macaddress_ macosx_buildversion macosx_productname macosx_productversion macosx_productverson_major ' +
      'macosx_productversion_minor manufacturer memoryfree memorysize netmask metmask_ network_ operatingsystem operatingsystemmajrelease '+
      'operatingsystemrelease osfamily partitions path physicalprocessorcount processor processorcount productname ps puppetversion '+
      'rubysitedir rubyversion selinux selinux_config_mode selinux_config_policy selinux_current_mode selinux_current_mode selinux_enforced '+
      'selinux_policyversion serialnumber sp_ sshdsakey sshecdsakey sshrsakey swapencrypted swapfree swapsize timezone type uniqueid uptime '+
      'uptime_days uptime_hours uptime_seconds uuid virtual vlans xendomains zfs_version zonenae zones zpool_version'
  };

  var COMMENT = hljs.COMMENT('#', '$');

  var IDENT_RE = '([A-Za-z_]|::)(\\w|::)*';

  var TITLE = hljs.inherit(hljs.TITLE_MODE, {begin: IDENT_RE});

  var VARIABLE = {className: 'variable', begin: '\\$' + IDENT_RE};

  var STRING = {
    className: 'string',
    contains: [hljs.BACKSLASH_ESCAPE, VARIABLE],
    variants: [
      {begin: /'/, end: /'/},
      {begin: /"/, end: /"/}
    ]
  };

  return {
    aliases: ['pp'],
    contains: [
      COMMENT,
      VARIABLE,
      STRING,
      {
        beginKeywords: 'class', end: '\\{|;',
        illegal: /=/,
        contains: [TITLE, COMMENT]
      },
      {
        beginKeywords: 'define', end: /\{/,
        contains: [
          {
            className: 'section', begin: hljs.IDENT_RE, endsParent: true
          }
        ]
      },
      {
        begin: hljs.IDENT_RE + '\\s+\\{', returnBegin: true,
        end: /\S/,
        contains: [
          {
            className: 'keyword',
            begin: hljs.IDENT_RE
          },
          {
            begin: /\{/, end: /\}/,
            keywords: PUPPET_KEYWORDS,
            relevance: 0,
            contains: [
              STRING,
              COMMENT,
              {
                begin:'[a-zA-Z_]+\\s*=>',
                returnBegin: true, end: '=>',
                contains: [
                  {
                    className: 'attr',
                    begin: hljs.IDENT_RE,
                  }
                ]
              },
              {
                className: 'number',
                begin: '(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b',
                relevance: 0
              },
              VARIABLE
            ]
          }
        ],
        relevance: 0
      }
    ]
  }
};

var purebasic = // Base deafult colors in PB IDE: background: #FFFFDF; foreground: #000000;

function(hljs) {
  var STRINGS = { // PB IDE color: #0080FF (Azure Radiance)
    className: 'string',
    begin: '(~)?"', end: '"',
    illegal: '\\n'
  };
  var CONSTANTS = { // PB IDE color: #924B72 (Cannon Pink)
    //  "#" + a letter or underscore + letters, digits or underscores + (optional) "$"
    className: 'symbol',
    begin: '#[a-zA-Z_]\\w*\\$?'
  };

  return {
    aliases: ['pb', 'pbi'],
    keywords: // PB IDE color: #006666 (Blue Stone) + Bold
      // The following keywords list was taken and adapted from GuShH's PureBasic language file for GeSHi...
      'And As Break CallDebugger Case CompilerCase CompilerDefault CompilerElse CompilerEndIf CompilerEndSelect ' +
      'CompilerError CompilerIf CompilerSelect Continue Data DataSection EndDataSection Debug DebugLevel ' +
      'Default Define Dim DisableASM DisableDebugger DisableExplicit Else ElseIf EnableASM ' +
      'EnableDebugger EnableExplicit End EndEnumeration EndIf EndImport EndInterface EndMacro EndProcedure ' +
      'EndSelect EndStructure EndStructureUnion EndWith Enumeration Extends FakeReturn For Next ForEach ' +
      'ForEver Global Gosub Goto If Import ImportC IncludeBinary IncludeFile IncludePath Interface Macro ' +
      'NewList Not Or ProcedureReturn Protected Prototype ' +
      'PrototypeC Read ReDim Repeat Until Restore Return Select Shared Static Step Structure StructureUnion ' +
      'Swap To Wend While With XIncludeFile XOr ' +
      'Procedure ProcedureC ProcedureCDLL ProcedureDLL Declare DeclareC DeclareCDLL DeclareDLL',
    contains: [
      // COMMENTS | PB IDE color: #00AAAA (Persian Green)
      hljs.COMMENT(';', '$', {relevance: 0}),

      { // PROCEDURES DEFINITIONS
        className: 'function',
        begin: '\\b(Procedure|Declare)(C|CDLL|DLL)?\\b',
        end: '\\(',
        excludeEnd: true,
        returnBegin: true,
        contains: [
          { // PROCEDURE KEYWORDS | PB IDE color: #006666 (Blue Stone) + Bold
            className: 'keyword',
            begin: '(Procedure|Declare)(C|CDLL|DLL)?',
            excludeEnd: true
          },
          { // PROCEDURE RETURN TYPE SETTING | PB IDE color: #000000 (Black)
            className: 'type',
            begin: '\\.\\w*'
            // end: ' ',
          },
          hljs.UNDERSCORE_TITLE_MODE // PROCEDURE NAME | PB IDE color: #006666 (Blue Stone)
        ]
      },
      STRINGS,
      CONSTANTS
    ]
  };
};

var python = function(hljs) {
  var KEYWORDS = {
    keyword:
      'and elif is global as in if from raise for except finally print import pass return ' +
      'exec else break not with class assert yield try while continue del or def lambda ' +
      'async await nonlocal|10',
    built_in:
      'Ellipsis NotImplemented',
    literal: 'False None True'
  };
  var PROMPT = {
    className: 'meta',  begin: /^(>>>|\.\.\.) /
  };
  var SUBST = {
    className: 'subst',
    begin: /\{/, end: /\}/,
    keywords: KEYWORDS,
    illegal: /#/
  };
  var STRING = {
    className: 'string',
    contains: [hljs.BACKSLASH_ESCAPE],
    variants: [
      {
        begin: /(u|b)?r?'''/, end: /'''/,
        contains: [hljs.BACKSLASH_ESCAPE, PROMPT],
        relevance: 10
      },
      {
        begin: /(u|b)?r?"""/, end: /"""/,
        contains: [hljs.BACKSLASH_ESCAPE, PROMPT],
        relevance: 10
      },
      {
        begin: /(fr|rf|f)'''/, end: /'''/,
        contains: [hljs.BACKSLASH_ESCAPE, PROMPT, SUBST]
      },
      {
        begin: /(fr|rf|f)"""/, end: /"""/,
        contains: [hljs.BACKSLASH_ESCAPE, PROMPT, SUBST]
      },
      {
        begin: /(u|r|ur)'/, end: /'/,
        relevance: 10
      },
      {
        begin: /(u|r|ur)"/, end: /"/,
        relevance: 10
      },
      {
        begin: /(b|br)'/, end: /'/
      },
      {
        begin: /(b|br)"/, end: /"/
      },
      {
        begin: /(fr|rf|f)'/, end: /'/,
        contains: [hljs.BACKSLASH_ESCAPE, SUBST]
      },
      {
        begin: /(fr|rf|f)"/, end: /"/,
        contains: [hljs.BACKSLASH_ESCAPE, SUBST]
      },
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE
    ]
  };
  var NUMBER = {
    className: 'number', relevance: 0,
    variants: [
      {begin: hljs.BINARY_NUMBER_RE + '[lLjJ]?'},
      {begin: '\\b(0o[0-7]+)[lLjJ]?'},
      {begin: hljs.C_NUMBER_RE + '[lLjJ]?'}
    ]
  };
  var PARAMS = {
    className: 'params',
    begin: /\(/, end: /\)/,
    contains: ['self', PROMPT, NUMBER, STRING]
  };
  SUBST.contains = [STRING, NUMBER, PROMPT];
  return {
    aliases: ['py', 'gyp', 'ipython'],
    keywords: KEYWORDS,
    illegal: /(<\/|->|\?)|=>/,
    contains: [
      PROMPT,
      NUMBER,
      STRING,
      hljs.HASH_COMMENT_MODE,
      {
        variants: [
          {className: 'function', beginKeywords: 'def'},
          {className: 'class', beginKeywords: 'class'}
        ],
        end: /:/,
        illegal: /[${=;\n,]/,
        contains: [
          hljs.UNDERSCORE_TITLE_MODE,
          PARAMS,
          {
            begin: /->/, endsWithParent: true,
            keywords: 'None'
          }
        ]
      },
      {
        className: 'meta',
        begin: /^[\t ]*@/, end: /$/
      },
      {
        begin: /\b(print|exec)\(/ // don’t highlight keywords-turned-functions in Python 3
      }
    ]
  };
};

var q = function(hljs) {
  var Q_KEYWORDS = {
  keyword:
    'do while select delete by update from',
  literal:
    '0b 1b',
  built_in:
    'neg not null string reciprocal floor ceiling signum mod xbar xlog and or each scan over prior mmu lsq inv md5 ltime gtime count first var dev med cov cor all any rand sums prds mins maxs fills deltas ratios avgs differ prev next rank reverse iasc idesc asc desc msum mcount mavg mdev xrank mmin mmax xprev rotate distinct group where flip type key til get value attr cut set upsert raze union inter except cross sv vs sublist enlist read0 read1 hopen hclose hdel hsym hcount peach system ltrim rtrim trim lower upper ssr view tables views cols xcols keys xkey xcol xasc xdesc fkeys meta lj aj aj0 ij pj asof uj ww wj wj1 fby xgroup ungroup ej save load rsave rload show csv parse eval min max avg wavg wsum sin cos tan sum',
  type:
    '`float `double int `timestamp `timespan `datetime `time `boolean `symbol `char `byte `short `long `real `month `date `minute `second `guid'
  };
  return {
  aliases:['k', 'kdb'],
  keywords: Q_KEYWORDS,
  lexemes: /(`?)[A-Za-z0-9_]+\b/,
  contains: [
  hljs.C_LINE_COMMENT_MODE,
    hljs.QUOTE_STRING_MODE,
    hljs.C_NUMBER_MODE
     ]
  };
};

var qml = function(hljs) {
  var KEYWORDS = {
      keyword:
        'in of on if for while finally var new function do return void else break catch ' +
        'instanceof with throw case default try this switch continue typeof delete ' +
        'let yield const export super debugger as async await import',
      literal:
        'true false null undefined NaN Infinity',
      built_in:
        'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent ' +
        'encodeURI encodeURIComponent escape unescape Object Function Boolean Error ' +
        'EvalError InternalError RangeError ReferenceError StopIteration SyntaxError ' +
        'TypeError URIError Number Math Date String RegExp Array Float32Array ' +
        'Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array ' +
        'Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require ' +
        'module console window document Symbol Set Map WeakSet WeakMap Proxy Reflect ' +
        'Behavior bool color coordinate date double enumeration font geocircle georectangle ' +
        'geoshape int list matrix4x4 parent point quaternion real rect ' +
        'size string url variant vector2d vector3d vector4d' +
        'Promise'
    };

  var QML_IDENT_RE = '[a-zA-Z_][a-zA-Z0-9\\._]*';

  // Isolate property statements. Ends at a :, =, ;, ,, a comment or end of line.
  // Use property class.
  var PROPERTY = {
      className: 'keyword',
      begin: '\\bproperty\\b',
      starts: {
        className: 'string',
        end: '(:|=|;|,|//|/\\*|$)',
        returnEnd: true
      }
  };

  // Isolate signal statements. Ends at a ) a comment or end of line.
  // Use property class.
  var SIGNAL = {
      className: 'keyword',
      begin: '\\bsignal\\b',
      starts: {
        className: 'string',
        end: '(\\(|:|=|;|,|//|/\\*|$)',
        returnEnd: true
      }
  };

  // id: is special in QML. When we see id: we want to mark the id: as attribute and
  // emphasize the token following.
  var ID_ID = {
      className: 'attribute',
      begin: '\\bid\\s*:',
      starts: {
        className: 'string',
        end: QML_IDENT_RE,
        returnEnd: false
      }
  };

  // Find QML object attribute. An attribute is a QML identifier followed by :.
  // Unfortunately it's hard to know where it ends, as it may contain scalars,
  // objects, object definitions, or javascript. The true end is either when the parent
  // ends or the next attribute is detected.
  var QML_ATTRIBUTE = {
    begin: QML_IDENT_RE + '\\s*:',
    returnBegin: true,
    contains: [
      {
        className: 'attribute',
        begin: QML_IDENT_RE,
        end: '\\s*:',
        excludeEnd: true,
        relevance: 0
      }
    ],
    relevance: 0
  };

  // Find QML object. A QML object is a QML identifier followed by { and ends at the matching }.
  // All we really care about is finding IDENT followed by { and just mark up the IDENT and ignore the {.
  var QML_OBJECT = {
    begin: QML_IDENT_RE + '\\s*{', end: '{',
    returnBegin: true,
    relevance: 0,
    contains: [
      hljs.inherit(hljs.TITLE_MODE, {begin: QML_IDENT_RE})
    ]
  };

  return {
    aliases: ['qt'],
    case_insensitive: false,
    keywords: KEYWORDS,
    contains: [
      {
        className: 'meta',
        begin: /^\s*['"]use (strict|asm)['"]/
      },
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      { // template string
        className: 'string',
        begin: '`', end: '`',
        contains: [
          hljs.BACKSLASH_ESCAPE,
          {
            className: 'subst',
            begin: '\\$\\{', end: '\\}'
          }
        ]
      },
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: 'number',
        variants: [
          { begin: '\\b(0[bB][01]+)' },
          { begin: '\\b(0[oO][0-7]+)' },
          { begin: hljs.C_NUMBER_RE }
        ],
        relevance: 0
      },
      { // "value" container
        begin: '(' + hljs.RE_STARTERS_RE + '|\\b(case|return|throw)\\b)\\s*',
        keywords: 'return throw case',
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.REGEXP_MODE,
          { // E4X / JSX
            begin: /</, end: />\s*[);\]]/,
            relevance: 0,
            subLanguage: 'xml'
          }
        ],
        relevance: 0
      },
      SIGNAL,
      PROPERTY,
      {
        className: 'function',
        beginKeywords: 'function', end: /\{/, excludeEnd: true,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {begin: /[A-Za-z$_][0-9A-Za-z$_]*/}),
          {
            className: 'params',
            begin: /\(/, end: /\)/,
            excludeBegin: true,
            excludeEnd: true,
            contains: [
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          }
        ],
        illegal: /\[|%/
      },
      {
        begin: '\\.' + hljs.IDENT_RE, relevance: 0 // hack: prevents detection of keywords after dots
      },
      ID_ID,
      QML_ATTRIBUTE,
      QML_OBJECT
    ],
    illegal: /#/
  };
};

var r = function(hljs) {
  var IDENT_RE = '([a-zA-Z]|\\.[a-zA-Z.])[a-zA-Z0-9._]*';

  return {
    contains: [
      hljs.HASH_COMMENT_MODE,
      {
        begin: IDENT_RE,
        lexemes: IDENT_RE,
        keywords: {
          keyword:
            'function if in break next repeat else for return switch while try tryCatch ' +
            'stop warning require library attach detach source setMethod setGeneric ' +
            'setGroupGeneric setClass ...',
          literal:
            'NULL NA TRUE FALSE T F Inf NaN NA_integer_|10 NA_real_|10 NA_character_|10 ' +
            'NA_complex_|10'
        },
        relevance: 0
      },
      {
        // hex value
        className: 'number',
        begin: "0[xX][0-9a-fA-F]+[Li]?\\b",
        relevance: 0
      },
      {
        // explicit integer
        className: 'number',
        begin: "\\d+(?:[eE][+\\-]?\\d*)?L\\b",
        relevance: 0
      },
      {
        // number with trailing decimal
        className: 'number',
        begin: "\\d+\\.(?!\\d)(?:i\\b)?",
        relevance: 0
      },
      {
        // number
        className: 'number',
        begin: "\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d*)?i?\\b",
        relevance: 0
      },
      {
        // number with leading decimal
        className: 'number',
        begin: "\\.\\d+(?:[eE][+\\-]?\\d*)?i?\\b",
        relevance: 0
      },

      {
        // escaped identifier
        begin: '`',
        end: '`',
        relevance: 0
      },

      {
        className: 'string',
        contains: [hljs.BACKSLASH_ESCAPE],
        variants: [
          {begin: '"', end: '"'},
          {begin: "'", end: "'"}
        ]
      }
    ]
  };
};

var reasonml = function(hljs) {
  function orReValues(ops){
    return ops
    .map(function(op) {
      return op
        .split('')
        .map(function(char) {
          return '\\' + char;
        })
        .join('');
    })
    .join('|');
  }

  var RE_IDENT = '~?[a-z$_][0-9a-zA-Z$_]*';
  var RE_MODULE_IDENT = '`?[A-Z$_][0-9a-zA-Z$_]*';

  var RE_PARAM_TYPEPARAM = '\'?[a-z$_][0-9a-z$_]*';
  var RE_PARAM_TYPE = '\s*:\s*[a-z$_][0-9a-z$_]*(\(\s*(' + RE_PARAM_TYPEPARAM + '\s*(,' + RE_PARAM_TYPEPARAM + ')*)?\s*\))?';
  var RE_PARAM = RE_IDENT + '(' + RE_PARAM_TYPE + ')?(' + RE_PARAM_TYPE + ')?';
  var RE_OPERATOR = "(" + orReValues(['||', '&&', '++', '**', '+.', '*', '/', '*.', '/.', '...', '|>']) + "|==|===)";
  var RE_OPERATOR_SPACED = "\\s+" + RE_OPERATOR + "\\s+";

  var KEYWORDS = {
    keyword:
      'and as asr assert begin class constraint do done downto else end exception external' +
      'for fun function functor if in include inherit initializer' +
      'land lazy let lor lsl lsr lxor match method mod module mutable new nonrec' +
      'object of open or private rec sig struct then to try type val virtual when while with',
    built_in:
      'array bool bytes char exn|5 float int int32 int64 list lazy_t|5 nativeint|5 ref string unit ',
    literal:
      'true false'
  };

  var RE_NUMBER = '\\b(0[xX][a-fA-F0-9_]+[Lln]?|' +
    '0[oO][0-7_]+[Lln]?|' +
    '0[bB][01_]+[Lln]?|' +
    '[0-9][0-9_]*([Lln]|(\\.[0-9_]*)?([eE][-+]?[0-9_]+)?)?)';

  var NUMBER_MODE = {
    className: 'number',
    relevance: 0,
    variants: [
      {
        begin: RE_NUMBER
      },
      {
        begin: '\\(\\-' + RE_NUMBER + '\\)'
      }
    ]
  };

  var OPERATOR_MODE = {
    className: 'operator',
    relevance: 0,
    begin: RE_OPERATOR
  };
  var LIST_CONTENTS_MODES = [
    {
      className: 'identifier',
      relevance: 0,
      begin: RE_IDENT
    },
    OPERATOR_MODE,
    NUMBER_MODE
  ];

  var MODULE_ACCESS_CONTENTS = [
    hljs.QUOTE_STRING_MODE,
    OPERATOR_MODE,
    {
      className: 'module',
      begin: "\\b" + RE_MODULE_IDENT, returnBegin: true,
      end: "\.",
      contains: [
        {
          className: 'identifier',
          begin: RE_MODULE_IDENT,
          relevance: 0
        }
      ]
    }
  ];

  var PARAMS_CONTENTS = [
    {
      className: 'module',
      begin: "\\b" + RE_MODULE_IDENT, returnBegin: true,
      end: "\.",
      relevance: 0,
      contains: [
        {
          className: 'identifier',
          begin: RE_MODULE_IDENT,
          relevance: 0
        }
      ]
    }
  ];

  var PARAMS_MODE = {
    begin: RE_IDENT,
    end: '(,|\\n|\\))',
    relevance: 0,
    contains: [
      OPERATOR_MODE,
      {
        className: 'typing',
        begin: ':',
        end: '(,|\\n)',
        returnBegin: true,
        relevance: 0,
        contains: PARAMS_CONTENTS
      }
    ]
  };

  var FUNCTION_BLOCK_MODE = {
    className: 'function',
    relevance: 0,
    keywords: KEYWORDS,
    variants: [
      {
        begin: '\\s(\\(\\.?.*?\\)|' + RE_IDENT + ')\\s*=>',
        end: '\\s*=>',
        returnBegin: true,
        relevance: 0,
        contains: [
          {
            className: 'params',
            variants: [
              {
                begin: RE_IDENT
              },
              {
                begin: RE_PARAM
              },
              {
                begin: /\(\s*\)/,
              }
            ]
          }
        ]
      },
      {
        begin: '\\s\\(\\.?[^;\\|]*\\)\\s*=>',
        end: '\\s=>',
        returnBegin: true,
        relevance: 0,
        contains: [
          {
            className: 'params',
            relevance: 0,
            variants: [
              PARAMS_MODE
            ]
          }
        ]
      },
      {
        begin: '\\(\\.\\s' + RE_IDENT + '\\)\\s*=>'
      }
    ]
  };
  MODULE_ACCESS_CONTENTS.push(FUNCTION_BLOCK_MODE);

  var CONSTRUCTOR_MODE = {
    className: 'constructor',
    begin: RE_MODULE_IDENT + '\\(',
    end: '\\)',
    illegal: '\\n',
    keywords: KEYWORDS,
    contains: [
      hljs.QUOTE_STRING_MODE,
      OPERATOR_MODE,
      {
        className: 'params',
        begin: '\\b' + RE_IDENT
      }
    ]
  };

  var PATTERN_MATCH_BLOCK_MODE = {
    className: 'pattern-match',
    begin: '\\|',
    returnBegin: true,
    keywords: KEYWORDS,
    end: '=>',
    relevance: 0,
    contains: [
      CONSTRUCTOR_MODE,
      OPERATOR_MODE,
      {
        relevance: 0,
        className: 'constructor',
        begin: RE_MODULE_IDENT
      }
    ]
  };

  var MODULE_ACCESS_MODE = {
    className: 'module-access',
    keywords: KEYWORDS,
    returnBegin: true,
    variants: [
      {
        begin: "\\b(" + RE_MODULE_IDENT + "\\.)+" + RE_IDENT
      },
      {
        begin: "\\b(" + RE_MODULE_IDENT + "\\.)+\\(",
        end: "\\)",
        returnBegin: true,
        contains: [
          FUNCTION_BLOCK_MODE,
          {
            begin: '\\(',
            end: '\\)',
            skip: true
          }
        ].concat(MODULE_ACCESS_CONTENTS)
      },
      {
        begin: "\\b(" + RE_MODULE_IDENT + "\\.)+{",
        end: "}"
      }
    ],
    contains: MODULE_ACCESS_CONTENTS
  };

  PARAMS_CONTENTS.push(MODULE_ACCESS_MODE);

  return {
    aliases: ['re'],
    keywords: KEYWORDS,
    illegal: '(:\\-|:=|\\${|\\+=)',
    contains: [
      hljs.COMMENT('/\\*', '\\*/', { illegal: '^(\\#,\\/\\/)' }),
      {
        className: 'character',
        begin: '\'(\\\\[^\']+|[^\'])\'',
        illegal: '\\n',
        relevance: 0
      },
      hljs.QUOTE_STRING_MODE,
      {
        className: 'literal',
        begin: '\\(\\)',
        relevance: 0
      },
      {
        className: 'literal',
        begin: '\\[\\|',
        end: '\\|\\]',
        relevance:  0,
        contains: LIST_CONTENTS_MODES
      },
      {
        className: 'literal',
        begin: '\\[',
        end: '\\]',
        relevance: 0,
        contains: LIST_CONTENTS_MODES
      },
      CONSTRUCTOR_MODE,
      {
        className: 'operator',
        begin: RE_OPERATOR_SPACED,
        illegal: '\\-\\->',
        relevance: 0
      },
      NUMBER_MODE,
      hljs.C_LINE_COMMENT_MODE,
      PATTERN_MATCH_BLOCK_MODE,
      FUNCTION_BLOCK_MODE,
      {
        className: 'module-def',
        begin: "\\bmodule\\s+" + RE_IDENT + "\\s+" + RE_MODULE_IDENT + "\\s+=\\s+{",
        end: "}",
        returnBegin: true,
        keywords: KEYWORDS,
        relevance: 0,
        contains: [
          {
            className: 'module',
            relevance: 0,
            begin: RE_MODULE_IDENT
          },
          {
            begin: '{',
            end: '}',
            skip: true
          }
        ].concat(MODULE_ACCESS_CONTENTS)
      },
      MODULE_ACCESS_MODE
    ]
  };
};

var rib = function(hljs) {
  return {
    keywords:
      'ArchiveRecord AreaLightSource Atmosphere Attribute AttributeBegin AttributeEnd Basis ' +
      'Begin Blobby Bound Clipping ClippingPlane Color ColorSamples ConcatTransform Cone ' +
      'CoordinateSystem CoordSysTransform CropWindow Curves Cylinder DepthOfField Detail ' +
      'DetailRange Disk Displacement Display End ErrorHandler Exposure Exterior Format ' +
      'FrameAspectRatio FrameBegin FrameEnd GeneralPolygon GeometricApproximation Geometry ' +
      'Hider Hyperboloid Identity Illuminate Imager Interior LightSource ' +
      'MakeCubeFaceEnvironment MakeLatLongEnvironment MakeShadow MakeTexture Matte ' +
      'MotionBegin MotionEnd NuPatch ObjectBegin ObjectEnd ObjectInstance Opacity Option ' +
      'Orientation Paraboloid Patch PatchMesh Perspective PixelFilter PixelSamples ' +
      'PixelVariance Points PointsGeneralPolygons PointsPolygons Polygon Procedural Projection ' +
      'Quantize ReadArchive RelativeDetail ReverseOrientation Rotate Scale ScreenWindow ' +
      'ShadingInterpolation ShadingRate Shutter Sides Skew SolidBegin SolidEnd Sphere ' +
      'SubdivisionMesh Surface TextureCoordinates Torus Transform TransformBegin TransformEnd ' +
      'TransformPoints Translate TrimCurve WorldBegin WorldEnd',
    illegal: '</',
    contains: [
      hljs.HASH_COMMENT_MODE,
      hljs.C_NUMBER_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE
    ]
  };
};

var roboconf = function(hljs) {
  var IDENTIFIER = '[a-zA-Z-_][^\\n{]+\\{';

  var PROPERTY = {
    className: 'attribute',
    begin: /[a-zA-Z-_]+/, end: /\s*:/, excludeEnd: true,
    starts: {
      end: ';',
      relevance: 0,
      contains: [
        {
          className: 'variable',
          begin: /\.[a-zA-Z-_]+/
        },
        {
          className: 'keyword',
          begin: /\(optional\)/
        }
      ]
    }
  };

  return {
    aliases: ['graph', 'instances'],
    case_insensitive: true,
    keywords: 'import',
    contains: [
      // Facet sections
      {
        begin: '^facet ' + IDENTIFIER,
        end: '}',
        keywords: 'facet',
        contains: [
          PROPERTY,
          hljs.HASH_COMMENT_MODE
        ]
      },

      // Instance sections
      {
        begin: '^\\s*instance of ' + IDENTIFIER,
        end: '}',
        keywords: 'name count channels instance-data instance-state instance of',
        illegal: /\S/,
        contains: [
          'self',
          PROPERTY,
          hljs.HASH_COMMENT_MODE
        ]
      },

      // Component sections
      {
        begin: '^' + IDENTIFIER,
        end: '}',
        contains: [
          PROPERTY,
          hljs.HASH_COMMENT_MODE
        ]
      },

      // Comments
      hljs.HASH_COMMENT_MODE
    ]
  };
};

var routeros = // Colors from RouterOS terminal:
//   green        - #0E9A00
//   teal         - #0C9A9A
//   purple       - #99069A
//   light-brown  - #9A9900

function(hljs) {

  var STATEMENTS = 'foreach do while for if from to step else on-error and or not in';

  // Global commands: Every global command should start with ":" token, otherwise it will be treated as variable.
  var GLOBAL_COMMANDS = 'global local beep delay put len typeof pick log time set find environment terminal error execute parse resolve toarray tobool toid toip toip6 tonum tostr totime';

  // Common commands: Following commands available from most sub-menus:
  var COMMON_COMMANDS = 'add remove enable disable set get print export edit find run debug error info warning';

  var LITERALS = 'true false yes no nothing nil null';

  var OBJECTS = 'traffic-flow traffic-generator firewall scheduler aaa accounting address-list address align area bandwidth-server bfd bgp bridge client clock community config connection console customer default dhcp-client dhcp-server discovery dns e-mail ethernet filter firewall firmware gps graphing group hardware health hotspot identity igmp-proxy incoming instance interface ip ipsec ipv6 irq l2tp-server lcd ldp logging mac-server mac-winbox mangle manual mirror mme mpls nat nd neighbor network note ntp ospf ospf-v3 ovpn-server page peer pim ping policy pool port ppp pppoe-client pptp-server prefix profile proposal proxy queue radius resource rip ripng route routing screen script security-profiles server service service-port settings shares smb sms sniffer snmp snooper socks sstp-server system tool tracking type upgrade upnp user-manager users user vlan secret vrrp watchdog web-access wireless pptp pppoe lan wan layer7-protocol lease simple raw';

  var VAR = {
    className: 'variable',
    variants: [
      {begin: /\$[\w\d#@][\w\d_]*/},
      {begin: /\$\{(.*?)}/}
    ]
  };
  
  var QUOTE_STRING = {
    className: 'string',
    begin: /"/, end: /"/,
    contains: [
      hljs.BACKSLASH_ESCAPE,
      VAR,
      {
        className: 'variable',
        begin: /\$\(/, end: /\)/,
        contains: [hljs.BACKSLASH_ESCAPE]
      }
    ]
  };
  
  var APOS_STRING = {
    className: 'string',
    begin: /'/, end: /'/
  };
  //////////////////////////////////////////////////////////////////////
  return {
    aliases: ['routeros', 'mikrotik'],
    case_insensitive: true,
    lexemes: /:?[\w-]+/,
    keywords: {
      literal: LITERALS,
      keyword: STATEMENTS + ' :' + STATEMENTS.split(' ').join(' :') + ' :' + GLOBAL_COMMANDS.split(' ').join(' :'),
    },
    contains: [
      { // недопустимые конструкции
        variants: [
          { begin: /^@/, end: /$/, },               // dns
          { begin: /\/\*/, end: /\*\//, },          // -- comment
          { begin: /%%/, end: /$/, },               // -- comment
          { begin: /^'/, end: /$/, },               // Monkey one line comment
          { begin: /^\s*\/[\w-]+=/, end: /$/, },    // jboss-cli
          { begin: /\/\//, end: /$/, },             // Stan comment
          { begin: /^\[\</, end: /\>\]$/, },        // F# class declaration?
          { begin: /<\//, end: />/, },              // HTML tags
          { begin: /^facet /, end: /\}/, },         // roboconf - лютый костыль )))
          { begin: '^1\\.\\.(\\d+)$', end: /$/, },  // tap  
        ],
        illegal: /./,
      },
      hljs.COMMENT('^#', '$'),
      QUOTE_STRING,
      APOS_STRING,
      VAR,
      { // attribute=value
        begin: /[\w-]+\=([^\s\{\}\[\]\(\)]+)/, 
        relevance: 0,
        returnBegin: true,
        contains: [
          {
            className: 'attribute',
            begin: /[^=]+/
          },
          {
            begin: /=/, 
            endsWithParent:  true,
            relevance: 0,
            contains: [
              QUOTE_STRING,
              APOS_STRING,
              VAR,
              {
                className: 'literal',
                begin: '\\b(' + LITERALS.split(' ').join('|') + ')\\b',
              },
              /*{
                // IPv4 addresses and subnets
                className: 'number',
                variants: [
                  {begin: IPADDR_wBITMASK+'(,'+IPADDR_wBITMASK+')*'}, //192.168.0.0/24,1.2.3.0/24
                  {begin: IPADDR+'-'+IPADDR},       // 192.168.0.1-192.168.0.3
                  {begin: IPADDR+'(,'+IPADDR+')*'}, // 192.168.0.1,192.168.0.34,192.168.24.1,192.168.0.1
                ]
              }, // */
              /*{
                // MAC addresses and DHCP Client IDs
                className: 'number',
                begin: /\b(1:)?([0-9A-Fa-f]{1,2}[:-]){5}([0-9A-Fa-f]){1,2}\b/,
              }, //*/
              {
                // Не форматировать не классифицированные значения. Необходимо для исключения подсветки значений как built_in.
                // className: 'number',  
                begin: /("[^"]*"|[^\s\{\}\[\]]+)/,
              }, //*/
            ]
          } //*/
        ]
      },//*/
      {
        // HEX values
        className: 'number',
        begin: /\*[0-9a-fA-F]+/,
      }, //*/

      { 
        begin: '\\b(' + COMMON_COMMANDS.split(' ').join('|') + ')([\\s\[\(]|\])',
        returnBegin: true,
        contains: [
          {
            className: 'builtin-name', //'function',
            begin: /\w+/,
          },
        ],  
      },
      
      { 
        className: 'built_in',
        variants: [
          {begin: '(\\.\\./|/|\\s)((' + OBJECTS.split(' ').join('|') + ');?\\s)+',relevance: 10,},
          {begin: /\.\./,},
        ],
      },//*/
    ]
  };
};

var rsl = function(hljs) {
  return {
    keywords: {
      keyword:
        'float color point normal vector matrix while for if do return else break extern continue',
      built_in:
        'abs acos ambient area asin atan atmosphere attribute calculatenormal ceil cellnoise ' +
        'clamp comp concat cos degrees depth Deriv diffuse distance Du Dv environment exp ' +
        'faceforward filterstep floor format fresnel incident length lightsource log match ' +
        'max min mod noise normalize ntransform opposite option phong pnoise pow printf ' +
        'ptlined radians random reflect refract renderinfo round setcomp setxcomp setycomp ' +
        'setzcomp shadow sign sin smoothstep specular specularbrdf spline sqrt step tan ' +
        'texture textureinfo trace transform vtransform xcomp ycomp zcomp'
    },
    illegal: '</',
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.APOS_STRING_MODE,
      hljs.C_NUMBER_MODE,
      {
        className: 'meta',
        begin: '#', end: '$'
      },
      {
        className: 'class',
        beginKeywords: 'surface displacement light volume imager', end: '\\('
      },
      {
        beginKeywords: 'illuminate illuminance gather', end: '\\('
      }
    ]
  };
};

var ruleslanguage = function(hljs) {
  return {
    keywords: {
       keyword: 'BILL_PERIOD BILL_START BILL_STOP RS_EFFECTIVE_START RS_EFFECTIVE_STOP RS_JURIS_CODE RS_OPCO_CODE ' +
         'INTDADDATTRIBUTE|5 INTDADDVMSG|5 INTDBLOCKOP|5 INTDBLOCKOPNA|5 INTDCLOSE|5 INTDCOUNT|5 ' +
         'INTDCOUNTSTATUSCODE|5 INTDCREATEMASK|5 INTDCREATEDAYMASK|5 INTDCREATEFACTORMASK|5 ' +
         'INTDCREATEHANDLE|5 INTDCREATEOVERRIDEDAYMASK|5 INTDCREATEOVERRIDEMASK|5 ' +
         'INTDCREATESTATUSCODEMASK|5 INTDCREATETOUPERIOD|5 INTDDELETE|5 INTDDIPTEST|5 INTDEXPORT|5 ' +
         'INTDGETERRORCODE|5 INTDGETERRORMESSAGE|5 INTDISEQUAL|5 INTDJOIN|5 INTDLOAD|5 INTDLOADACTUALCUT|5 ' +
         'INTDLOADDATES|5 INTDLOADHIST|5 INTDLOADLIST|5 INTDLOADLISTDATES|5 INTDLOADLISTENERGY|5 ' +
         'INTDLOADLISTHIST|5 INTDLOADRELATEDCHANNEL|5 INTDLOADSP|5 INTDLOADSTAGING|5 INTDLOADUOM|5 ' +
         'INTDLOADUOMDATES|5 INTDLOADUOMHIST|5 INTDLOADVERSION|5 INTDOPEN|5 INTDREADFIRST|5 INTDREADNEXT|5 ' +
         'INTDRECCOUNT|5 INTDRELEASE|5 INTDREPLACE|5 INTDROLLAVG|5 INTDROLLPEAK|5 INTDSCALAROP|5 INTDSCALE|5 ' +
         'INTDSETATTRIBUTE|5 INTDSETDSTPARTICIPANT|5 INTDSETSTRING|5 INTDSETVALUE|5 INTDSETVALUESTATUS|5 ' +
         'INTDSHIFTSTARTTIME|5 INTDSMOOTH|5 INTDSORT|5 INTDSPIKETEST|5 INTDSUBSET|5 INTDTOU|5 ' +
         'INTDTOURELEASE|5 INTDTOUVALUE|5 INTDUPDATESTATS|5 INTDVALUE|5 STDEV INTDDELETEEX|5 ' +
         'INTDLOADEXACTUAL|5 INTDLOADEXCUT|5 INTDLOADEXDATES|5 INTDLOADEX|5 INTDLOADEXRELATEDCHANNEL|5 ' +
         'INTDSAVEEX|5 MVLOAD|5 MVLOADACCT|5 MVLOADACCTDATES|5 MVLOADACCTHIST|5 MVLOADDATES|5 MVLOADHIST|5 ' +
         'MVLOADLIST|5 MVLOADLISTDATES|5 MVLOADLISTHIST|5 IF FOR NEXT DONE SELECT END CALL ABORT CLEAR CHANNEL FACTOR LIST NUMBER ' +
         'OVERRIDE SET WEEK DISTRIBUTIONNODE ELSE WHEN THEN OTHERWISE IENUM CSV INCLUDE LEAVE RIDER SAVE DELETE ' +
         'NOVALUE SECTION WARN SAVE_UPDATE DETERMINANT LABEL REPORT REVENUE EACH ' +
         'IN FROM TOTAL CHARGE BLOCK AND OR CSV_FILE RATE_CODE AUXILIARY_DEMAND ' +
         'UIDACCOUNT RS BILL_PERIOD_SELECT HOURS_PER_MONTH INTD_ERROR_STOP SEASON_SCHEDULE_NAME ' +
         'ACCOUNTFACTOR ARRAYUPPERBOUND CALLSTOREDPROC GETADOCONNECTION GETCONNECT GETDATASOURCE ' +
         'GETQUALIFIER GETUSERID HASVALUE LISTCOUNT LISTOP LISTUPDATE LISTVALUE PRORATEFACTOR RSPRORATE ' +
         'SETBINPATH SETDBMONITOR WQ_OPEN BILLINGHOURS DATE DATEFROMFLOAT DATETIMEFROMSTRING ' +
         'DATETIMETOSTRING DATETOFLOAT DAY DAYDIFF DAYNAME DBDATETIME HOUR MINUTE MONTH MONTHDIFF ' +
         'MONTHHOURS MONTHNAME ROUNDDATE SAMEWEEKDAYLASTYEAR SECOND WEEKDAY WEEKDIFF YEAR YEARDAY ' +
         'YEARSTR COMPSUM HISTCOUNT HISTMAX HISTMIN HISTMINNZ HISTVALUE MAXNRANGE MAXRANGE MINRANGE ' +
         'COMPIKVA COMPKVA COMPKVARFROMKQKW COMPLF IDATTR FLAG LF2KW LF2KWH MAXKW POWERFACTOR ' +
         'READING2USAGE AVGSEASON MAXSEASON MONTHLYMERGE SEASONVALUE SUMSEASON ACCTREADDATES ' +
         'ACCTTABLELOAD CONFIGADD CONFIGGET CREATEOBJECT CREATEREPORT EMAILCLIENT EXPBLKMDMUSAGE ' +
         'EXPMDMUSAGE EXPORT_USAGE FACTORINEFFECT GETUSERSPECIFIEDSTOP INEFFECT ISHOLIDAY RUNRATE ' +
         'SAVE_PROFILE SETREPORTTITLE USEREXIT WATFORRUNRATE TO TABLE ACOS ASIN ATAN ATAN2 BITAND CEIL ' +
         'COS COSECANT COSH COTANGENT DIVQUOT DIVREM EXP FABS FLOOR FMOD FREPM FREXPN LOG LOG10 MAX MAXN ' +
         'MIN MINNZ MODF POW ROUND ROUND2VALUE ROUNDINT SECANT SIN SINH SQROOT TAN TANH FLOAT2STRING ' +
         'FLOAT2STRINGNC INSTR LEFT LEN LTRIM MID RIGHT RTRIM STRING STRINGNC TOLOWER TOUPPER TRIM ' +
         'NUMDAYS READ_DATE STAGING',
       built_in: 'IDENTIFIER OPTIONS XML_ELEMENT XML_OP XML_ELEMENT_OF DOMDOCCREATE DOMDOCLOADFILE DOMDOCLOADXML ' +
         'DOMDOCSAVEFILE DOMDOCGETROOT DOMDOCADDPI DOMNODEGETNAME DOMNODEGETTYPE DOMNODEGETVALUE DOMNODEGETCHILDCT ' +
         'DOMNODEGETFIRSTCHILD DOMNODEGETSIBLING DOMNODECREATECHILDELEMENT DOMNODESETATTRIBUTE ' +
         'DOMNODEGETCHILDELEMENTCT DOMNODEGETFIRSTCHILDELEMENT DOMNODEGETSIBLINGELEMENT DOMNODEGETATTRIBUTECT ' +
         'DOMNODEGETATTRIBUTEI DOMNODEGETATTRIBUTEBYNAME DOMNODEGETBYNAME'
    },
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.C_NUMBER_MODE,
      {
        className: 'literal',
        variants: [
          {begin: '#\\s+[a-zA-Z\\ \\.]*', relevance: 0}, // looks like #-comment
          {begin: '#[a-zA-Z\\ \\.]+'}
        ]
      }
    ]
  };
};

var rust = function(hljs) {
  var NUM_SUFFIX = '([ui](8|16|32|64|128|size)|f(32|64))\?';
  var KEYWORDS =
    'alignof as be box break const continue crate do else enum extern ' +
    'false fn for if impl in let loop match mod mut offsetof once priv ' +
    'proc pub pure ref return self Self sizeof static struct super trait true ' +
    'type typeof unsafe unsized use virtual while where yield move default';
  var BUILTINS =
    // functions
    'drop ' +
    // types
    'i8 i16 i32 i64 i128 isize ' +
    'u8 u16 u32 u64 u128 usize ' +
    'f32 f64 ' +
    'str char bool ' +
    'Box Option Result String Vec ' +
    // traits
    'Copy Send Sized Sync Drop Fn FnMut FnOnce ToOwned Clone Debug ' +
    'PartialEq PartialOrd Eq Ord AsRef AsMut Into From Default Iterator ' +
    'Extend IntoIterator DoubleEndedIterator ExactSizeIterator ' +
    'SliceConcatExt ToString ' +
    // macros
    'assert! assert_eq! bitflags! bytes! cfg! col! concat! concat_idents! ' +
    'debug_assert! debug_assert_eq! env! panic! file! format! format_args! ' +
    'include_bin! include_str! line! local_data_key! module_path! ' +
    'option_env! print! println! select! stringify! try! unimplemented! ' +
    'unreachable! vec! write! writeln! macro_rules! assert_ne! debug_assert_ne!';
  return {
    aliases: ['rs'],
    keywords: {
      keyword:
        KEYWORDS,
      literal:
        'true false Some None Ok Err',
      built_in:
        BUILTINS
    },
    lexemes: hljs.IDENT_RE + '!?',
    illegal: '</',
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.COMMENT('/\\*', '\\*/', {contains: ['self']}),
      hljs.inherit(hljs.QUOTE_STRING_MODE, {begin: /b?"/, illegal: null}),
      {
        className: 'string',
        variants: [
           { begin: /r(#*)"(.|\n)*?"\1(?!#)/ },
           { begin: /b?'\\?(x\w{2}|u\w{4}|U\w{8}|.)'/ }
        ]
      },
      {
        className: 'symbol',
        begin: /'[a-zA-Z_][a-zA-Z0-9_]*/
      },
      {
        className: 'number',
        variants: [
          { begin: '\\b0b([01_]+)' + NUM_SUFFIX },
          { begin: '\\b0o([0-7_]+)' + NUM_SUFFIX },
          { begin: '\\b0x([A-Fa-f0-9_]+)' + NUM_SUFFIX },
          { begin: '\\b(\\d[\\d_]*(\\.[0-9_]+)?([eE][+-]?[0-9_]+)?)' +
                   NUM_SUFFIX
          }
        ],
        relevance: 0
      },
      {
        className: 'function',
        beginKeywords: 'fn', end: '(\\(|<)', excludeEnd: true,
        contains: [hljs.UNDERSCORE_TITLE_MODE]
      },
      {
        className: 'meta',
        begin: '#\\!?\\[', end: '\\]',
        contains: [
          {
            className: 'meta-string',
            begin: /"/, end: /"/
          }
        ]
      },
      {
        className: 'class',
        beginKeywords: 'type', end: ';',
        contains: [
          hljs.inherit(hljs.UNDERSCORE_TITLE_MODE, {endsParent: true})
        ],
        illegal: '\\S'
      },
      {
        className: 'class',
        beginKeywords: 'trait enum struct union', end: '{',
        contains: [
          hljs.inherit(hljs.UNDERSCORE_TITLE_MODE, {endsParent: true})
        ],
        illegal: '[\\w\\d]'
      },
      {
        begin: hljs.IDENT_RE + '::',
        keywords: {built_in: BUILTINS}
      },
      {
        begin: '->'
      }
    ]
  };
};

var sas = function(hljs) {

    // Data step and PROC SQL statements
    var SAS_KEYWORDS = ''+
        'do if then else end until while '+
        ''+
        'abort array attrib by call cards cards4 catname continue '+
        'datalines datalines4 delete delim delimiter display dm drop '+
        'endsas error file filename footnote format goto in infile '+
        'informat input keep label leave length libname link list '+
        'lostcard merge missing modify options output out page put '+
        'redirect remove rename replace retain return select set skip '+
        'startsas stop title update waitsas where window x systask '+
        ''+
        'add and alter as cascade check create delete describe '+
        'distinct drop foreign from group having index insert into in '+
        'key like message modify msgtype not null on or order primary '+
        'references reset restrict select set table unique update '+
        'validate view where';

    // Built-in SAS functions
    var SAS_FUN = ''+
        'abs|addr|airy|arcos|arsin|atan|attrc|attrn|band|'+
        'betainv|blshift|bnot|bor|brshift|bxor|byte|cdf|ceil|'+
        'cexist|cinv|close|cnonct|collate|compbl|compound|'+
        'compress|cos|cosh|css|curobs|cv|daccdb|daccdbsl|'+
        'daccsl|daccsyd|dacctab|dairy|date|datejul|datepart|'+
        'datetime|day|dclose|depdb|depdbsl|depdbsl|depsl|'+
        'depsl|depsyd|depsyd|deptab|deptab|dequote|dhms|dif|'+
        'digamma|dim|dinfo|dnum|dopen|doptname|doptnum|dread|'+
        'dropnote|dsname|erf|erfc|exist|exp|fappend|fclose|'+
        'fcol|fdelete|fetch|fetchobs|fexist|fget|fileexist|'+
        'filename|fileref|finfo|finv|fipname|fipnamel|'+
        'fipstate|floor|fnonct|fnote|fopen|foptname|foptnum|'+
        'fpoint|fpos|fput|fread|frewind|frlen|fsep|fuzz|'+
        'fwrite|gaminv|gamma|getoption|getvarc|getvarn|hbound|'+
        'hms|hosthelp|hour|ibessel|index|indexc|indexw|input|'+
        'inputc|inputn|int|intck|intnx|intrr|irr|jbessel|'+
        'juldate|kurtosis|lag|lbound|left|length|lgamma|'+
        'libname|libref|log|log10|log2|logpdf|logpmf|logsdf|'+
        'lowcase|max|mdy|mean|min|minute|mod|month|mopen|'+
        'mort|n|netpv|nmiss|normal|note|npv|open|ordinal|'+
        'pathname|pdf|peek|peekc|pmf|point|poisson|poke|'+
        'probbeta|probbnml|probchi|probf|probgam|probhypr|'+
        'probit|probnegb|probnorm|probt|put|putc|putn|qtr|'+
        'quote|ranbin|rancau|ranexp|rangam|range|rank|rannor|'+
        'ranpoi|rantbl|rantri|ranuni|repeat|resolve|reverse|'+
        'rewind|right|round|saving|scan|sdf|second|sign|'+
        'sin|sinh|skewness|soundex|spedis|sqrt|std|stderr|'+
        'stfips|stname|stnamel|substr|sum|symget|sysget|'+
        'sysmsg|sysprod|sysrc|system|tan|tanh|time|timepart|'+
        'tinv|tnonct|today|translate|tranwrd|trigamma|'+
        'trim|trimn|trunc|uniform|upcase|uss|var|varfmt|'+
        'varinfmt|varlabel|varlen|varname|varnum|varray|'+
        'varrayx|vartype|verify|vformat|vformatd|vformatdx|'+
        'vformatn|vformatnx|vformatw|vformatwx|vformatx|'+
        'vinarray|vinarrayx|vinformat|vinformatd|vinformatdx|'+
        'vinformatn|vinformatnx|vinformatw|vinformatwx|'+
        'vinformatx|vlabel|vlabelx|vlength|vlengthx|vname|'+
        'vnamex|vtype|vtypex|weekday|year|yyq|zipfips|zipname|'+
        'zipnamel|zipstate';

    // Built-in macro functions
    var SAS_MACRO_FUN = 'bquote|nrbquote|cmpres|qcmpres|compstor|'+
        'datatyp|display|do|else|end|eval|global|goto|'+
        'if|index|input|keydef|label|left|length|let|'+
        'local|lowcase|macro|mend|nrbquote|nrquote|'+
        'nrstr|put|qcmpres|qleft|qlowcase|qscan|'+
        'qsubstr|qsysfunc|qtrim|quote|qupcase|scan|str|'+
        'substr|superq|syscall|sysevalf|sysexec|sysfunc|'+
        'sysget|syslput|sysprod|sysrc|sysrput|then|to|'+
        'trim|unquote|until|upcase|verify|while|window';

    return {
        aliases: ['sas', 'SAS'],
        case_insensitive: true, // SAS is case-insensitive
        keywords: {
            literal:
                'null missing _all_ _automatic_ _character_ _infile_ '+
                '_n_ _name_ _null_ _numeric_ _user_ _webout_',
            meta:
                SAS_KEYWORDS
        },
        contains: [
            {
                // Distinct highlight for proc <proc>, data, run, quit
                className: 'keyword',
                begin: /^\s*(proc [\w\d_]+|data|run|quit)[\s\;]/
            },
            {
                // Macro variables
                className: 'variable',
                begin: /\&[a-zA-Z_\&][a-zA-Z0-9_]*\.?/
            },
            {
                // Special emphasis for datalines|cards
                className: 'emphasis',
                begin: /^\s*datalines|cards.*;/,
                end: /^\s*;\s*$/
            },
            {   // Built-in macro variables take precedence
                className: 'built_in',
                begin: '%(' + SAS_MACRO_FUN + ')'
            },
            {
                // User-defined macro functions highlighted after
                className: 'name',
                begin: /%[a-zA-Z_][a-zA-Z_0-9]*/
            },
            {
                className: 'meta',
                begin: '[^%](' + SAS_FUN + ')[\(]'
            },
            {
                className: 'string',
                variants: [
                    hljs.APOS_STRING_MODE,
                    hljs.QUOTE_STRING_MODE
                ]
            },
            hljs.COMMENT('\\*', ';'),
            hljs.C_BLOCK_COMMENT_MODE
        ]
    };
};

var scala = function(hljs) {

  var ANNOTATION = { className: 'meta', begin: '@[A-Za-z]+' };

  // used in strings for escaping/interpolation/substitution
  var SUBST = {
    className: 'subst',
    variants: [
      {begin: '\\$[A-Za-z0-9_]+'},
      {begin: '\\${', end: '}'}
    ]
  };

  var STRING = {
    className: 'string',
    variants: [
      {
        begin: '"', end: '"',
        illegal: '\\n',
        contains: [hljs.BACKSLASH_ESCAPE]
      },
      {
        begin: '"""', end: '"""',
        relevance: 10
      },
      {
        begin: '[a-z]+"', end: '"',
        illegal: '\\n',
        contains: [hljs.BACKSLASH_ESCAPE, SUBST]
      },
      {
        className: 'string',
        begin: '[a-z]+"""', end: '"""',
        contains: [SUBST],
        relevance: 10
      }
    ]

  };

  var SYMBOL = {
    className: 'symbol',
    begin: '\'\\w[\\w\\d_]*(?!\')'
  };

  var TYPE = {
    className: 'type',
    begin: '\\b[A-Z][A-Za-z0-9_]*',
    relevance: 0
  };

  var NAME = {
    className: 'title',
    begin: /[^0-9\n\t "'(),.`{}\[\]:;][^\n\t "'(),.`{}\[\]:;]+|[^0-9\n\t "'(),.`{}\[\]:;=]/,
    relevance: 0
  };

  var CLASS = {
    className: 'class',
    beginKeywords: 'class object trait type',
    end: /[:={\[\n;]/,
    excludeEnd: true,
    contains: [
      {
        beginKeywords: 'extends with',
        relevance: 10
      },
      {
        begin: /\[/,
        end: /\]/,
        excludeBegin: true,
        excludeEnd: true,
        relevance: 0,
        contains: [TYPE]
      },
      {
        className: 'params',
        begin: /\(/,
        end: /\)/,
        excludeBegin: true,
        excludeEnd: true,
        relevance: 0,
        contains: [TYPE]
      },
      NAME
    ]
  };

  var METHOD = {
    className: 'function',
    beginKeywords: 'def',
    end: /[:={\[(\n;]/,
    excludeEnd: true,
    contains: [NAME]
  };

  return {
    keywords: {
      literal: 'true false null',
      keyword: 'type yield lazy override def with val var sealed abstract private trait object if forSome for while throw finally protected extends import final return else break new catch super class case package default try this match continue throws implicit'
    },
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      STRING,
      SYMBOL,
      TYPE,
      METHOD,
      CLASS,
      hljs.C_NUMBER_MODE,
      ANNOTATION
    ]
  };
};

var scheme = function(hljs) {
  var SCHEME_IDENT_RE = '[^\\(\\)\\[\\]\\{\\}",\'`;#|\\\\\\s]+';
  var SCHEME_SIMPLE_NUMBER_RE = '(\\-|\\+)?\\d+([./]\\d+)?';
  var SCHEME_COMPLEX_NUMBER_RE = SCHEME_SIMPLE_NUMBER_RE + '[+\\-]' + SCHEME_SIMPLE_NUMBER_RE + 'i';
  var BUILTINS = {
    'builtin-name':
      'case-lambda call/cc class define-class exit-handler field import ' +
      'inherit init-field interface let*-values let-values let/ec mixin ' +
      'opt-lambda override protect provide public rename require ' +
      'require-for-syntax syntax syntax-case syntax-error unit/sig unless ' +
      'when with-syntax and begin call-with-current-continuation ' +
      'call-with-input-file call-with-output-file case cond define ' +
      'define-syntax delay do dynamic-wind else for-each if lambda let let* ' +
      'let-syntax letrec letrec-syntax map or syntax-rules \' * + , ,@ - ... / ' +
      '; < <= = => > >= ` abs acos angle append apply asin assoc assq assv atan ' +
      'boolean? caar cadr call-with-input-file call-with-output-file ' +
      'call-with-values car cdddar cddddr cdr ceiling char->integer ' +
      'char-alphabetic? char-ci<=? char-ci<? char-ci=? char-ci>=? char-ci>? ' +
      'char-downcase char-lower-case? char-numeric? char-ready? char-upcase ' +
      'char-upper-case? char-whitespace? char<=? char<? char=? char>=? char>? ' +
      'char? close-input-port close-output-port complex? cons cos ' +
      'current-input-port current-output-port denominator display eof-object? ' +
      'eq? equal? eqv? eval even? exact->inexact exact? exp expt floor ' +
      'force gcd imag-part inexact->exact inexact? input-port? integer->char ' +
      'integer? interaction-environment lcm length list list->string ' +
      'list->vector list-ref list-tail list? load log magnitude make-polar ' +
      'make-rectangular make-string make-vector max member memq memv min ' +
      'modulo negative? newline not null-environment null? number->string ' +
      'number? numerator odd? open-input-file open-output-file output-port? ' +
      'pair? peek-char port? positive? procedure? quasiquote quote quotient ' +
      'rational? rationalize read read-char real-part real? remainder reverse ' +
      'round scheme-report-environment set! set-car! set-cdr! sin sqrt string ' +
      'string->list string->number string->symbol string-append string-ci<=? ' +
      'string-ci<? string-ci=? string-ci>=? string-ci>? string-copy ' +
      'string-fill! string-length string-ref string-set! string<=? string<? ' +
      'string=? string>=? string>? string? substring symbol->string symbol? ' +
      'tan transcript-off transcript-on truncate values vector ' +
      'vector->list vector-fill! vector-length vector-ref vector-set! ' +
      'with-input-from-file with-output-to-file write write-char zero?'
  };

  var SHEBANG = {
    className: 'meta',
    begin: '^#!',
    end: '$'
  };

  var LITERAL = {
    className: 'literal',
    begin: '(#t|#f|#\\\\' + SCHEME_IDENT_RE + '|#\\\\.)'
  };

  var NUMBER = {
    className: 'number',
    variants: [
      { begin: SCHEME_SIMPLE_NUMBER_RE, relevance: 0 },
      { begin: SCHEME_COMPLEX_NUMBER_RE, relevance: 0 },
      { begin: '#b[0-1]+(/[0-1]+)?' },
      { begin: '#o[0-7]+(/[0-7]+)?' },
      { begin: '#x[0-9a-f]+(/[0-9a-f]+)?' }
    ]
  };

  var STRING = hljs.QUOTE_STRING_MODE;

  var COMMENT_MODES = [
    hljs.COMMENT(
      ';',
      '$',
      {
        relevance: 0
      }
    ),
    hljs.COMMENT('#\\|', '\\|#')
  ];

  var IDENT = {
    begin: SCHEME_IDENT_RE,
    relevance: 0
  };

  var QUOTED_IDENT = {
    className: 'symbol',
    begin: '\'' + SCHEME_IDENT_RE
  };

  var BODY = {
    endsWithParent: true,
    relevance: 0
  };

  var QUOTED_LIST = {
    variants: [
      { begin: /'/ },
      { begin: '`' }
    ],
    contains: [
      {
        begin: '\\(', end: '\\)',
        contains: ['self', LITERAL, STRING, NUMBER, IDENT, QUOTED_IDENT]
      }
    ]
  };

  var NAME = {
    className: 'name',
    begin: SCHEME_IDENT_RE,
    lexemes: SCHEME_IDENT_RE,
    keywords: BUILTINS
  };

  var LAMBDA = {
    begin: /lambda/, endsWithParent: true, returnBegin: true,
    contains: [
      NAME,
      {
        begin: /\(/, end: /\)/, endsParent: true,
        contains: [IDENT],
      }
    ]
  };

  var LIST = {
    variants: [
      { begin: '\\(', end: '\\)' },
      { begin: '\\[', end: '\\]' }
    ],
    contains: [LAMBDA, NAME, BODY]
  };

  BODY.contains = [LITERAL, NUMBER, STRING, IDENT, QUOTED_IDENT, QUOTED_LIST, LIST].concat(COMMENT_MODES);

  return {
    illegal: /\S/,
    contains: [SHEBANG, NUMBER, STRING, QUOTED_IDENT, QUOTED_LIST, LIST].concat(COMMENT_MODES)
  };
};

var scilab = function(hljs) {

  var COMMON_CONTAINS = [
    hljs.C_NUMBER_MODE,
    {
      className: 'string',
      begin: '\'|\"', end: '\'|\"',
      contains: [hljs.BACKSLASH_ESCAPE, {begin: '\'\''}]
    }
  ];

  return {
    aliases: ['sci'],
    lexemes: /%?\w+/,
    keywords: {
      keyword: 'abort break case clear catch continue do elseif else endfunction end for function '+
        'global if pause return resume select try then while',
      literal:
        '%f %F %t %T %pi %eps %inf %nan %e %i %z %s',
      built_in: // Scilab has more than 2000 functions. Just list the most commons
       'abs and acos asin atan ceil cd chdir clearglobal cosh cos cumprod deff disp error '+
       'exec execstr exists exp eye gettext floor fprintf fread fsolve imag isdef isempty '+
       'isinfisnan isvector lasterror length load linspace list listfiles log10 log2 log '+
       'max min msprintf mclose mopen ones or pathconvert poly printf prod pwd rand real '+
       'round sinh sin size gsort sprintf sqrt strcat strcmps tring sum system tanh tan '+
       'type typename warning zeros matrix'
    },
    illegal: '("|#|/\\*|\\s+/\\w+)',
    contains: [
      {
        className: 'function',
        beginKeywords: 'function', end: '$',
        contains: [
          hljs.UNDERSCORE_TITLE_MODE,
          {
            className: 'params',
            begin: '\\(', end: '\\)'
          }
        ]
      },
      {
        begin: '[a-zA-Z_][a-zA-Z_0-9]*(\'+[\\.\']*|[\\.\']+)', end: '',
        relevance: 0
      },
      {
        begin: '\\[', end: '\\]\'*[\\.\']*',
        relevance: 0,
        contains: COMMON_CONTAINS
      },
      hljs.COMMENT('//', '$')
    ].concat(COMMON_CONTAINS)
  };
};

var scss = function(hljs) {
  var IDENT_RE = '[a-zA-Z-][a-zA-Z0-9_-]*';
  var VARIABLE = {
    className: 'variable',
    begin: '(\\$' + IDENT_RE + ')\\b'
  };
  var HEXCOLOR = {
    className: 'number', begin: '#[0-9A-Fa-f]+'
  };
  var DEF_INTERNALS = {
    className: 'attribute',
    begin: '[A-Z\\_\\.\\-]+', end: ':',
    excludeEnd: true,
    illegal: '[^\\s]',
    starts: {
      endsWithParent: true, excludeEnd: true,
      contains: [
        HEXCOLOR,
        hljs.CSS_NUMBER_MODE,
        hljs.QUOTE_STRING_MODE,
        hljs.APOS_STRING_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        {
          className: 'meta', begin: '!important'
        }
      ]
    }
  };
  return {
    case_insensitive: true,
    illegal: '[=/|\']',
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: 'selector-id', begin: '\\#[A-Za-z0-9_-]+',
        relevance: 0
      },
      {
        className: 'selector-class', begin: '\\.[A-Za-z0-9_-]+',
        relevance: 0
      },
      {
        className: 'selector-attr', begin: '\\[', end: '\\]',
        illegal: '$'
      },
      {
        className: 'selector-tag', // begin: IDENT_RE, end: '[,|\\s]'
        begin: '\\b(a|abbr|acronym|address|area|article|aside|audio|b|base|big|blockquote|body|br|button|canvas|caption|cite|code|col|colgroup|command|datalist|dd|del|details|dfn|div|dl|dt|em|embed|fieldset|figcaption|figure|footer|form|frame|frameset|(h[1-6])|head|header|hgroup|hr|html|i|iframe|img|input|ins|kbd|keygen|label|legend|li|link|map|mark|meta|meter|nav|noframes|noscript|object|ol|optgroup|option|output|p|param|pre|progress|q|rp|rt|ruby|samp|script|section|select|small|span|strike|strong|style|sub|sup|table|tbody|td|textarea|tfoot|th|thead|time|title|tr|tt|ul|var|video)\\b',
        relevance: 0
      },
      {
        begin: ':(visited|valid|root|right|required|read-write|read-only|out-range|optional|only-of-type|only-child|nth-of-type|nth-last-of-type|nth-last-child|nth-child|not|link|left|last-of-type|last-child|lang|invalid|indeterminate|in-range|hover|focus|first-of-type|first-line|first-letter|first-child|first|enabled|empty|disabled|default|checked|before|after|active)'
      },
      {
        begin: '::(after|before|choices|first-letter|first-line|repeat-index|repeat-item|selection|value)'
      },
      VARIABLE,
      {
        className: 'attribute',
        begin: '\\b(z-index|word-wrap|word-spacing|word-break|width|widows|white-space|visibility|vertical-align|unicode-bidi|transition-timing-function|transition-property|transition-duration|transition-delay|transition|transform-style|transform-origin|transform|top|text-underline-position|text-transform|text-shadow|text-rendering|text-overflow|text-indent|text-decoration-style|text-decoration-line|text-decoration-color|text-decoration|text-align-last|text-align|tab-size|table-layout|right|resize|quotes|position|pointer-events|perspective-origin|perspective|page-break-inside|page-break-before|page-break-after|padding-top|padding-right|padding-left|padding-bottom|padding|overflow-y|overflow-x|overflow-wrap|overflow|outline-width|outline-style|outline-offset|outline-color|outline|orphans|order|opacity|object-position|object-fit|normal|none|nav-up|nav-right|nav-left|nav-index|nav-down|min-width|min-height|max-width|max-height|mask|marks|margin-top|margin-right|margin-left|margin-bottom|margin|list-style-type|list-style-position|list-style-image|list-style|line-height|letter-spacing|left|justify-content|initial|inherit|ime-mode|image-orientation|image-resolution|image-rendering|icon|hyphens|height|font-weight|font-variant-ligatures|font-variant|font-style|font-stretch|font-size-adjust|font-size|font-language-override|font-kerning|font-feature-settings|font-family|font|float|flex-wrap|flex-shrink|flex-grow|flex-flow|flex-direction|flex-basis|flex|filter|empty-cells|display|direction|cursor|counter-reset|counter-increment|content|column-width|column-span|column-rule-width|column-rule-style|column-rule-color|column-rule|column-gap|column-fill|column-count|columns|color|clip-path|clip|clear|caption-side|break-inside|break-before|break-after|box-sizing|box-shadow|box-decoration-break|bottom|border-width|border-top-width|border-top-style|border-top-right-radius|border-top-left-radius|border-top-color|border-top|border-style|border-spacing|border-right-width|border-right-style|border-right-color|border-right|border-radius|border-left-width|border-left-style|border-left-color|border-left|border-image-width|border-image-source|border-image-slice|border-image-repeat|border-image-outset|border-image|border-color|border-collapse|border-bottom-width|border-bottom-style|border-bottom-right-radius|border-bottom-left-radius|border-bottom-color|border-bottom|border|background-size|background-repeat|background-position|background-origin|background-image|background-color|background-clip|background-attachment|background-blend-mode|background|backface-visibility|auto|animation-timing-function|animation-play-state|animation-name|animation-iteration-count|animation-fill-mode|animation-duration|animation-direction|animation-delay|animation|align-self|align-items|align-content)\\b',
        illegal: '[^\\s]'
      },
      {
        begin: '\\b(whitespace|wait|w-resize|visible|vertical-text|vertical-ideographic|uppercase|upper-roman|upper-alpha|underline|transparent|top|thin|thick|text|text-top|text-bottom|tb-rl|table-header-group|table-footer-group|sw-resize|super|strict|static|square|solid|small-caps|separate|se-resize|scroll|s-resize|rtl|row-resize|ridge|right|repeat|repeat-y|repeat-x|relative|progress|pointer|overline|outside|outset|oblique|nowrap|not-allowed|normal|none|nw-resize|no-repeat|no-drop|newspaper|ne-resize|n-resize|move|middle|medium|ltr|lr-tb|lowercase|lower-roman|lower-alpha|loose|list-item|line|line-through|line-edge|lighter|left|keep-all|justify|italic|inter-word|inter-ideograph|inside|inset|inline|inline-block|inherit|inactive|ideograph-space|ideograph-parenthesis|ideograph-numeric|ideograph-alpha|horizontal|hidden|help|hand|groove|fixed|ellipsis|e-resize|double|dotted|distribute|distribute-space|distribute-letter|distribute-all-lines|disc|disabled|default|decimal|dashed|crosshair|collapse|col-resize|circle|char|center|capitalize|break-word|break-all|bottom|both|bolder|bold|block|bidi-override|below|baseline|auto|always|all-scroll|absolute|table|table-cell)\\b'
      },
      {
        begin: ':', end: ';',
        contains: [
          VARIABLE,
          HEXCOLOR,
          hljs.CSS_NUMBER_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.APOS_STRING_MODE,
          {
            className: 'meta', begin: '!important'
          }
        ]
      },
      {
        begin: '@', end: '[{;]',
        keywords: 'mixin include extend for if else each while charset import debug media page content font-face namespace warn',
        contains: [
          VARIABLE,
          hljs.QUOTE_STRING_MODE,
          hljs.APOS_STRING_MODE,
          HEXCOLOR,
          hljs.CSS_NUMBER_MODE,
          {
            begin: '\\s[A-Za-z0-9_.-]+',
            relevance: 0
          }
        ]
      }
    ]
  };
};

var shell = function(hljs) {
  return {
    aliases: ['console'],
    contains: [
      {
        className: 'meta',
        begin: '^\\s{0,3}[\\w\\d\\[\\]()@-]*[>%$#]',
        starts: {
          end: '$', subLanguage: 'bash'
        }
      }
    ]
  }
};

var smali = function(hljs) {
  var smali_instr_low_prio = ['add', 'and', 'cmp', 'cmpg', 'cmpl', 'const', 'div', 'double', 'float', 'goto', 'if', 'int', 'long', 'move', 'mul', 'neg', 'new', 'nop', 'not', 'or', 'rem', 'return', 'shl', 'shr', 'sput', 'sub', 'throw', 'ushr', 'xor'];
  var smali_instr_high_prio = ['aget', 'aput', 'array', 'check', 'execute', 'fill', 'filled', 'goto/16', 'goto/32', 'iget', 'instance', 'invoke', 'iput', 'monitor', 'packed', 'sget', 'sparse'];
  var smali_keywords = ['transient', 'constructor', 'abstract', 'final', 'synthetic', 'public', 'private', 'protected', 'static', 'bridge', 'system'];
  return {
    aliases: ['smali'],
    contains: [
      {
        className: 'string',
        begin: '"', end: '"',
        relevance: 0
      },
      hljs.COMMENT(
        '#',
        '$',
        {
          relevance: 0
        }
      ),
      {
        className: 'keyword',
        variants: [
          {begin: '\\s*\\.end\\s[a-zA-Z0-9]*'},
          {begin: '^[ ]*\\.[a-zA-Z]*', relevance: 0},
          {begin: '\\s:[a-zA-Z_0-9]*', relevance: 0},
          {begin: '\\s(' + smali_keywords.join('|') + ')'}
        ]
      },
      {
        className: 'built_in',
        variants : [
          {
            begin: '\\s('+smali_instr_low_prio.join('|')+')\\s'
          },
          {
            begin: '\\s('+smali_instr_low_prio.join('|')+')((\\-|/)[a-zA-Z0-9]+)+\\s',
            relevance: 10
          },
          {
            begin: '\\s('+smali_instr_high_prio.join('|')+')((\\-|/)[a-zA-Z0-9]+)*\\s',
            relevance: 10
          },
        ]
      },
      {
        className: 'class',
        begin: 'L[^\(;:\n]*;',
        relevance: 0
      },
      {
        begin: '[vp][0-9]+',
      }
    ]
  };
};

var smalltalk = function(hljs) {
  var VAR_IDENT_RE = '[a-z][a-zA-Z0-9_]*';
  var CHAR = {
    className: 'string',
    begin: '\\$.{1}'
  };
  var SYMBOL = {
    className: 'symbol',
    begin: '#' + hljs.UNDERSCORE_IDENT_RE
  };
  return {
    aliases: ['st'],
    keywords: 'self super nil true false thisContext', // only 6
    contains: [
      hljs.COMMENT('"', '"'),
      hljs.APOS_STRING_MODE,
      {
        className: 'type',
        begin: '\\b[A-Z][A-Za-z0-9_]*',
        relevance: 0
      },
      {
        begin: VAR_IDENT_RE + ':',
        relevance: 0
      },
      hljs.C_NUMBER_MODE,
      SYMBOL,
      CHAR,
      {
        // This looks more complicated than needed to avoid combinatorial
        // explosion under V8. It effectively means `| var1 var2 ... |` with
        // whitespace adjacent to `|` being optional.
        begin: '\\|[ ]*' + VAR_IDENT_RE + '([ ]+' + VAR_IDENT_RE + ')*[ ]*\\|',
        returnBegin: true, end: /\|/,
        illegal: /\S/,
        contains: [{begin: '(\\|[ ]*)?' + VAR_IDENT_RE}]
      },
      {
        begin: '\\#\\(', end: '\\)',
        contains: [
          hljs.APOS_STRING_MODE,
          CHAR,
          hljs.C_NUMBER_MODE,
          SYMBOL
        ]
      }
    ]
  };
};

var sml = function(hljs) {
  return {
    aliases: ['ml'],
    keywords: {
      keyword:
        /* according to Definition of Standard ML 97  */
        'abstype and andalso as case datatype do else end eqtype ' +
        'exception fn fun functor handle if in include infix infixr ' +
        'let local nonfix of op open orelse raise rec sharing sig ' +
        'signature struct structure then type val with withtype where while',
      built_in:
        /* built-in types according to basis library */
        'array bool char exn int list option order real ref string substring vector unit word',
      literal:
        'true false NONE SOME LESS EQUAL GREATER nil'
    },
    illegal: /\/\/|>>/,
    lexemes: '[a-z_]\\w*!?',
    contains: [
      {
        className: 'literal',
        begin: /\[(\|\|)?\]|\(\)/,
        relevance: 0
      },
      hljs.COMMENT(
        '\\(\\*',
        '\\*\\)',
        {
          contains: ['self']
        }
      ),
      { /* type variable */
        className: 'symbol',
        begin: '\'[A-Za-z_](?!\')[\\w\']*'
        /* the grammar is ambiguous on how 'a'b should be interpreted but not the compiler */
      },
      { /* polymorphic variant */
        className: 'type',
        begin: '`[A-Z][\\w\']*'
      },
      { /* module or constructor */
        className: 'type',
        begin: '\\b[A-Z][\\w\']*',
        relevance: 0
      },
      { /* don't color identifiers, but safely catch all identifiers with '*/
        begin: '[a-z_]\\w*\'[\\w\']*'
      },
      hljs.inherit(hljs.APOS_STRING_MODE, {className: 'string', relevance: 0}),
      hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null}),
      {
        className: 'number',
        begin:
          '\\b(0[xX][a-fA-F0-9_]+[Lln]?|' +
          '0[oO][0-7_]+[Lln]?|' +
          '0[bB][01_]+[Lln]?|' +
          '[0-9][0-9_]*([Lln]|(\\.[0-9_]*)?([eE][-+]?[0-9_]+)?)?)',
        relevance: 0
      },
      {
        begin: /[-=]>/ // relevance booster
      }
    ]
  };
};

var sqf = function(hljs) {
  var CPP = hljs.getLanguage('cpp').exports;

  // In SQF, a variable start with _
  var VARIABLE = {
    className: 'variable',
    begin: /\b_+[a-zA-Z_]\w*/
  };

  // In SQF, a function should fit myTag_fnc_myFunction pattern
  // https://community.bistudio.com/wiki/Functions_Library_(Arma_3)#Adding_a_Function
  var FUNCTION = {
    className: 'title',
    begin: /[a-zA-Z][a-zA-Z0-9]+_fnc_\w*/
  };

  // In SQF strings, quotes matching the start are escaped by adding a consecutive.
  // Example of single escaped quotes: " "" " and  ' '' '.
  var STRINGS = {
    className: 'string',
    variants: [
      {
        begin: '"',
        end: '"',
        contains: [{begin: '""', relevance: 0}]
      },
      {
        begin: '\'',
        end: '\'',
        contains: [{begin: '\'\'', relevance: 0}]
      }
    ]
  };

  return {
    aliases: ['sqf'],
    case_insensitive: true,
    keywords: {
      keyword:
        'case catch default do else exit exitWith for forEach from if ' +
        'private switch then throw to try waitUntil while with',
      built_in:
        'abs accTime acos action actionIDs actionKeys actionKeysImages actionKeysNames ' +
        'actionKeysNamesArray actionName actionParams activateAddons activatedAddons activateKey ' +
        'add3DENConnection add3DENEventHandler add3DENLayer addAction addBackpack addBackpackCargo ' +
        'addBackpackCargoGlobal addBackpackGlobal addCamShake addCuratorAddons addCuratorCameraArea ' +
        'addCuratorEditableObjects addCuratorEditingArea addCuratorPoints addEditorObject addEventHandler ' +
        'addForce addGoggles addGroupIcon addHandgunItem addHeadgear addItem addItemCargo ' +
        'addItemCargoGlobal addItemPool addItemToBackpack addItemToUniform addItemToVest addLiveStats ' +
        'addMagazine addMagazineAmmoCargo addMagazineCargo addMagazineCargoGlobal addMagazineGlobal ' +
        'addMagazinePool addMagazines addMagazineTurret addMenu addMenuItem addMissionEventHandler ' +
        'addMPEventHandler addMusicEventHandler addOwnedMine addPlayerScores addPrimaryWeaponItem ' +
        'addPublicVariableEventHandler addRating addResources addScore addScoreSide addSecondaryWeaponItem ' +
        'addSwitchableUnit addTeamMember addToRemainsCollector addTorque addUniform addVehicle addVest ' +
        'addWaypoint addWeapon addWeaponCargo addWeaponCargoGlobal addWeaponGlobal addWeaponItem ' +
        'addWeaponPool addWeaponTurret admin agent agents AGLToASL aimedAtTarget aimPos airDensityRTD ' +
        'airplaneThrottle airportSide AISFinishHeal alive all3DENEntities allAirports allControls ' +
        'allCurators allCutLayers allDead allDeadMen allDisplays allGroups allMapMarkers allMines ' +
        'allMissionObjects allow3DMode allowCrewInImmobile allowCuratorLogicIgnoreAreas allowDamage ' +
        'allowDammage allowFileOperations allowFleeing allowGetIn allowSprint allPlayers allSimpleObjects ' +
        'allSites allTurrets allUnits allUnitsUAV allVariables ammo ammoOnPylon and animate animateBay ' +
        'animateDoor animatePylon animateSource animationNames animationPhase animationSourcePhase ' +
        'animationState append apply armoryPoints arrayIntersect asin ASLToAGL ASLToATL assert ' +
        'assignAsCargo assignAsCargoIndex assignAsCommander assignAsDriver assignAsGunner assignAsTurret ' +
        'assignCurator assignedCargo assignedCommander assignedDriver assignedGunner assignedItems ' +
        'assignedTarget assignedTeam assignedVehicle assignedVehicleRole assignItem assignTeam ' +
        'assignToAirport atan atan2 atg ATLToASL attachedObject attachedObjects attachedTo attachObject ' +
        'attachTo attackEnabled backpack backpackCargo backpackContainer backpackItems backpackMagazines ' +
        'backpackSpaceFor behaviour benchmark binocular boundingBox boundingBoxReal boundingCenter ' +
        'breakOut breakTo briefingName buildingExit buildingPos buttonAction buttonSetAction cadetMode ' +
        'call callExtension camCommand camCommit camCommitPrepared camCommitted camConstuctionSetParams ' +
        'camCreate camDestroy cameraEffect cameraEffectEnableHUD cameraInterest cameraOn cameraView ' +
        'campaignConfigFile camPreload camPreloaded camPrepareBank camPrepareDir camPrepareDive ' +
        'camPrepareFocus camPrepareFov camPrepareFovRange camPreparePos camPrepareRelPos camPrepareTarget ' +
        'camSetBank camSetDir camSetDive camSetFocus camSetFov camSetFovRange camSetPos camSetRelPos ' +
        'camSetTarget camTarget camUseNVG canAdd canAddItemToBackpack canAddItemToUniform canAddItemToVest ' +
        'cancelSimpleTaskDestination canFire canMove canSlingLoad canStand canSuspend ' +
        'canTriggerDynamicSimulation canUnloadInCombat canVehicleCargo captive captiveNum cbChecked ' +
        'cbSetChecked ceil channelEnabled cheatsEnabled checkAIFeature checkVisibility className ' +
        'clearAllItemsFromBackpack clearBackpackCargo clearBackpackCargoGlobal clearGroupIcons ' +
        'clearItemCargo clearItemCargoGlobal clearItemPool clearMagazineCargo clearMagazineCargoGlobal ' +
        'clearMagazinePool clearOverlay clearRadio clearWeaponCargo clearWeaponCargoGlobal clearWeaponPool ' +
        'clientOwner closeDialog closeDisplay closeOverlay collapseObjectTree collect3DENHistory ' +
        'collectiveRTD combatMode commandArtilleryFire commandChat commander commandFire commandFollow ' +
        'commandFSM commandGetOut commandingMenu commandMove commandRadio commandStop ' +
        'commandSuppressiveFire commandTarget commandWatch comment commitOverlay compile compileFinal ' +
        'completedFSM composeText configClasses configFile configHierarchy configName configProperties ' +
        'configSourceAddonList configSourceMod configSourceModList confirmSensorTarget ' +
        'connectTerminalToUAV controlsGroupCtrl copyFromClipboard copyToClipboard copyWaypoints cos count ' +
        'countEnemy countFriendly countSide countType countUnknown create3DENComposition create3DENEntity ' +
        'createAgent createCenter createDialog createDiaryLink createDiaryRecord createDiarySubject ' +
        'createDisplay createGearDialog createGroup createGuardedPoint createLocation createMarker ' +
        'createMarkerLocal createMenu createMine createMissionDisplay createMPCampaignDisplay ' +
        'createSimpleObject createSimpleTask createSite createSoundSource createTask createTeam ' +
        'createTrigger createUnit createVehicle createVehicleCrew createVehicleLocal crew ctAddHeader ' +
        'ctAddRow ctClear ctCurSel ctData ctFindHeaderRows ctFindRowHeader ctHeaderControls ctHeaderCount ' +
        'ctRemoveHeaders ctRemoveRows ctrlActivate ctrlAddEventHandler ctrlAngle ctrlAutoScrollDelay ' +
        'ctrlAutoScrollRewind ctrlAutoScrollSpeed ctrlChecked ctrlClassName ctrlCommit ctrlCommitted ' +
        'ctrlCreate ctrlDelete ctrlEnable ctrlEnabled ctrlFade ctrlHTMLLoaded ctrlIDC ctrlIDD ' +
        'ctrlMapAnimAdd ctrlMapAnimClear ctrlMapAnimCommit ctrlMapAnimDone ctrlMapCursor ctrlMapMouseOver ' +
        'ctrlMapScale ctrlMapScreenToWorld ctrlMapWorldToScreen ctrlModel ctrlModelDirAndUp ctrlModelScale ' +
        'ctrlParent ctrlParentControlsGroup ctrlPosition ctrlRemoveAllEventHandlers ctrlRemoveEventHandler ' +
        'ctrlScale ctrlSetActiveColor ctrlSetAngle ctrlSetAutoScrollDelay ctrlSetAutoScrollRewind ' +
        'ctrlSetAutoScrollSpeed ctrlSetBackgroundColor ctrlSetChecked ctrlSetEventHandler ctrlSetFade ' +
        'ctrlSetFocus ctrlSetFont ctrlSetFontH1 ctrlSetFontH1B ctrlSetFontH2 ctrlSetFontH2B ctrlSetFontH3 ' +
        'ctrlSetFontH3B ctrlSetFontH4 ctrlSetFontH4B ctrlSetFontH5 ctrlSetFontH5B ctrlSetFontH6 ' +
        'ctrlSetFontH6B ctrlSetFontHeight ctrlSetFontHeightH1 ctrlSetFontHeightH2 ctrlSetFontHeightH3 ' +
        'ctrlSetFontHeightH4 ctrlSetFontHeightH5 ctrlSetFontHeightH6 ctrlSetFontHeightSecondary ' +
        'ctrlSetFontP ctrlSetFontPB ctrlSetFontSecondary ctrlSetForegroundColor ctrlSetModel ' +
        'ctrlSetModelDirAndUp ctrlSetModelScale ctrlSetPixelPrecision ctrlSetPosition ctrlSetScale ' +
        'ctrlSetStructuredText ctrlSetText ctrlSetTextColor ctrlSetTooltip ctrlSetTooltipColorBox ' +
        'ctrlSetTooltipColorShade ctrlSetTooltipColorText ctrlShow ctrlShown ctrlText ctrlTextHeight ' +
        'ctrlTextWidth ctrlType ctrlVisible ctRowControls ctRowCount ctSetCurSel ctSetData ' +
        'ctSetHeaderTemplate ctSetRowTemplate ctSetValue ctValue curatorAddons curatorCamera ' +
        'curatorCameraArea curatorCameraAreaCeiling curatorCoef curatorEditableObjects curatorEditingArea ' +
        'curatorEditingAreaType curatorMouseOver curatorPoints curatorRegisteredObjects curatorSelected ' +
        'curatorWaypointCost current3DENOperation currentChannel currentCommand currentMagazine ' +
        'currentMagazineDetail currentMagazineDetailTurret currentMagazineTurret currentMuzzle ' +
        'currentNamespace currentTask currentTasks currentThrowable currentVisionMode currentWaypoint ' +
        'currentWeapon currentWeaponMode currentWeaponTurret currentZeroing cursorObject cursorTarget ' +
        'customChat customRadio cutFadeOut cutObj cutRsc cutText damage date dateToNumber daytime ' +
        'deActivateKey debriefingText debugFSM debugLog deg delete3DENEntities deleteAt deleteCenter ' +
        'deleteCollection deleteEditorObject deleteGroup deleteGroupWhenEmpty deleteIdentity ' +
        'deleteLocation deleteMarker deleteMarkerLocal deleteRange deleteResources deleteSite deleteStatus ' +
        'deleteTeam deleteVehicle deleteVehicleCrew deleteWaypoint detach detectedMines ' +
        'diag_activeMissionFSMs diag_activeScripts diag_activeSQFScripts diag_activeSQSScripts ' +
        'diag_captureFrame diag_captureFrameToFile diag_captureSlowFrame diag_codePerformance ' +
        'diag_drawMode diag_enable diag_enabled diag_fps diag_fpsMin diag_frameNo diag_lightNewLoad ' +
        'diag_list diag_log diag_logSlowFrame diag_mergeConfigFile diag_recordTurretLimits ' +
        'diag_setLightNew diag_tickTime diag_toggle dialog diarySubjectExists didJIP didJIPOwner ' +
        'difficulty difficultyEnabled difficultyEnabledRTD difficultyOption direction directSay disableAI ' +
        'disableCollisionWith disableConversation disableDebriefingStats disableMapIndicators ' +
        'disableNVGEquipment disableRemoteSensors disableSerialization disableTIEquipment ' +
        'disableUAVConnectability disableUserInput displayAddEventHandler displayCtrl displayParent ' +
        'displayRemoveAllEventHandlers displayRemoveEventHandler displaySetEventHandler dissolveTeam ' +
        'distance distance2D distanceSqr distributionRegion do3DENAction doArtilleryFire doFire doFollow ' +
        'doFSM doGetOut doMove doorPhase doStop doSuppressiveFire doTarget doWatch drawArrow drawEllipse ' +
        'drawIcon drawIcon3D drawLine drawLine3D drawLink drawLocation drawPolygon drawRectangle ' +
        'drawTriangle driver drop dynamicSimulationDistance dynamicSimulationDistanceCoef ' +
        'dynamicSimulationEnabled dynamicSimulationSystemEnabled echo edit3DENMissionAttributes editObject ' +
        'editorSetEventHandler effectiveCommander emptyPositions enableAI enableAIFeature ' +
        'enableAimPrecision enableAttack enableAudioFeature enableAutoStartUpRTD enableAutoTrimRTD ' +
        'enableCamShake enableCaustics enableChannel enableCollisionWith enableCopilot ' +
        'enableDebriefingStats enableDiagLegend enableDynamicSimulation enableDynamicSimulationSystem ' +
        'enableEndDialog enableEngineArtillery enableEnvironment enableFatigue enableGunLights ' +
        'enableInfoPanelComponent enableIRLasers enableMimics enablePersonTurret enableRadio enableReload ' +
        'enableRopeAttach enableSatNormalOnDetail enableSaving enableSentences enableSimulation ' +
        'enableSimulationGlobal enableStamina enableTeamSwitch enableTraffic enableUAVConnectability ' +
        'enableUAVWaypoints enableVehicleCargo enableVehicleSensor enableWeaponDisassembly ' +
        'endLoadingScreen endMission engineOn enginesIsOnRTD enginesRpmRTD enginesTorqueRTD entities ' +
        'environmentEnabled estimatedEndServerTime estimatedTimeLeft evalObjectArgument everyBackpack ' +
        'everyContainer exec execEditorScript execFSM execVM exp expectedDestination exportJIPMessages ' +
        'eyeDirection eyePos face faction fadeMusic fadeRadio fadeSound fadeSpeech failMission ' +
        'fillWeaponsFromPool find findCover findDisplay findEditorObject findEmptyPosition ' +
        'findEmptyPositionReady findIf findNearestEnemy finishMissionInit finite fire fireAtTarget ' +
        'firstBackpack flag flagAnimationPhase flagOwner flagSide flagTexture fleeing floor flyInHeight ' +
        'flyInHeightASL fog fogForecast fogParams forceAddUniform forcedMap forceEnd forceFlagTexture ' +
        'forceFollowRoad forceMap forceRespawn forceSpeed forceWalk forceWeaponFire forceWeatherChange ' +
        'forEachMember forEachMemberAgent forEachMemberTeam forgetTarget format formation ' +
        'formationDirection formationLeader formationMembers formationPosition formationTask formatText ' +
        'formLeader freeLook fromEditor fuel fullCrew gearIDCAmmoCount gearSlotAmmoCount gearSlotData ' +
        'get3DENActionState get3DENAttribute get3DENCamera get3DENConnections get3DENEntity ' +
        'get3DENEntityID get3DENGrid get3DENIconsVisible get3DENLayerEntities get3DENLinesVisible ' +
        'get3DENMissionAttribute get3DENMouseOver get3DENSelected getAimingCoef getAllEnvSoundControllers ' +
        'getAllHitPointsDamage getAllOwnedMines getAllSoundControllers getAmmoCargo getAnimAimPrecision ' +
        'getAnimSpeedCoef getArray getArtilleryAmmo getArtilleryComputerSettings getArtilleryETA ' +
        'getAssignedCuratorLogic getAssignedCuratorUnit getBackpackCargo getBleedingRemaining ' +
        'getBurningValue getCameraViewDirection getCargoIndex getCenterOfMass getClientState ' +
        'getClientStateNumber getCompatiblePylonMagazines getConnectedUAV getContainerMaxLoad ' +
        'getCursorObjectParams getCustomAimCoef getDammage getDescription getDir getDirVisual ' +
        'getDLCAssetsUsage getDLCAssetsUsageByName getDLCs getEditorCamera getEditorMode ' +
        'getEditorObjectScope getElevationOffset getEnvSoundController getFatigue getForcedFlagTexture ' +
        'getFriend getFSMVariable getFuelCargo getGroupIcon getGroupIconParams getGroupIcons getHideFrom ' +
        'getHit getHitIndex getHitPointDamage getItemCargo getMagazineCargo getMarkerColor getMarkerPos ' +
        'getMarkerSize getMarkerType getMass getMissionConfig getMissionConfigValue getMissionDLCs ' +
        'getMissionLayerEntities getModelInfo getMousePosition getMusicPlayedTime getNumber ' +
        'getObjectArgument getObjectChildren getObjectDLC getObjectMaterials getObjectProxy ' +
        'getObjectTextures getObjectType getObjectViewDistance getOxygenRemaining getPersonUsedDLCs ' +
        'getPilotCameraDirection getPilotCameraPosition getPilotCameraRotation getPilotCameraTarget ' +
        'getPlateNumber getPlayerChannel getPlayerScores getPlayerUID getPos getPosASL getPosASLVisual ' +
        'getPosASLW getPosATL getPosATLVisual getPosVisual getPosWorld getPylonMagazines getRelDir ' +
        'getRelPos getRemoteSensorsDisabled getRepairCargo getResolution getShadowDistance getShotParents ' +
        'getSlingLoad getSoundController getSoundControllerResult getSpeed getStamina getStatValue ' +
        'getSuppression getTerrainGrid getTerrainHeightASL getText getTotalDLCUsageTime getUnitLoadout ' +
        'getUnitTrait getUserMFDText getUserMFDvalue getVariable getVehicleCargo getWeaponCargo ' +
        'getWeaponSway getWingsOrientationRTD getWingsPositionRTD getWPPos glanceAt globalChat globalRadio ' +
        'goggles goto group groupChat groupFromNetId groupIconSelectable groupIconsVisible groupId ' +
        'groupOwner groupRadio groupSelectedUnits groupSelectUnit gunner gusts halt handgunItems ' +
        'handgunMagazine handgunWeapon handsHit hasInterface hasPilotCamera hasWeapon hcAllGroups ' +
        'hcGroupParams hcLeader hcRemoveAllGroups hcRemoveGroup hcSelected hcSelectGroup hcSetGroup ' +
        'hcShowBar hcShownBar headgear hideBody hideObject hideObjectGlobal hideSelection hint hintC ' +
        'hintCadet hintSilent hmd hostMission htmlLoad HUDMovementLevels humidity image importAllGroups ' +
        'importance in inArea inAreaArray incapacitatedState inflame inflamed infoPanel ' +
        'infoPanelComponentEnabled infoPanelComponents infoPanels inGameUISetEventHandler inheritsFrom ' +
        'initAmbientLife inPolygon inputAction inRangeOfArtillery insertEditorObject intersect is3DEN ' +
        'is3DENMultiplayer isAbleToBreathe isAgent isArray isAutoHoverOn isAutonomous isAutotest ' +
        'isBleeding isBurning isClass isCollisionLightOn isCopilotEnabled isDamageAllowed isDedicated ' +
        'isDLCAvailable isEngineOn isEqualTo isEqualType isEqualTypeAll isEqualTypeAny isEqualTypeArray ' +
        'isEqualTypeParams isFilePatchingEnabled isFlashlightOn isFlatEmpty isForcedWalk isFormationLeader ' +
        'isGroupDeletedWhenEmpty isHidden isInRemainsCollector isInstructorFigureEnabled isIRLaserOn ' +
        'isKeyActive isKindOf isLaserOn isLightOn isLocalized isManualFire isMarkedForCollection ' +
        'isMultiplayer isMultiplayerSolo isNil isNull isNumber isObjectHidden isObjectRTD isOnRoad ' +
        'isPipEnabled isPlayer isRealTime isRemoteExecuted isRemoteExecutedJIP isServer isShowing3DIcons ' +
        'isSimpleObject isSprintAllowed isStaminaEnabled isSteamMission isStreamFriendlyUIEnabled isText ' +
        'isTouchingGround isTurnedOut isTutHintsEnabled isUAVConnectable isUAVConnected isUIContext ' +
        'isUniformAllowed isVehicleCargo isVehicleRadarOn isVehicleSensorEnabled isWalking ' +
        'isWeaponDeployed isWeaponRested itemCargo items itemsWithMagazines join joinAs joinAsSilent ' +
        'joinSilent joinString kbAddDatabase kbAddDatabaseTargets kbAddTopic kbHasTopic kbReact ' +
        'kbRemoveTopic kbTell kbWasSaid keyImage keyName knowsAbout land landAt landResult language ' +
        'laserTarget lbAdd lbClear lbColor lbColorRight lbCurSel lbData lbDelete lbIsSelected lbPicture ' +
        'lbPictureRight lbSelection lbSetColor lbSetColorRight lbSetCurSel lbSetData lbSetPicture ' +
        'lbSetPictureColor lbSetPictureColorDisabled lbSetPictureColorSelected lbSetPictureRight ' +
        'lbSetPictureRightColor lbSetPictureRightColorDisabled lbSetPictureRightColorSelected ' +
        'lbSetSelectColor lbSetSelectColorRight lbSetSelected lbSetText lbSetTextRight lbSetTooltip ' +
        'lbSetValue lbSize lbSort lbSortByValue lbText lbTextRight lbValue leader leaderboardDeInit ' +
        'leaderboardGetRows leaderboardInit leaderboardRequestRowsFriends leaderboardsRequestUploadScore ' +
        'leaderboardsRequestUploadScoreKeepBest leaderboardState leaveVehicle libraryCredits ' +
        'libraryDisclaimers lifeState lightAttachObject lightDetachObject lightIsOn lightnings limitSpeed ' +
        'linearConversion lineIntersects lineIntersectsObjs lineIntersectsSurfaces lineIntersectsWith ' +
        'linkItem list listObjects listRemoteTargets listVehicleSensors ln lnbAddArray lnbAddColumn ' +
        'lnbAddRow lnbClear lnbColor lnbCurSelRow lnbData lnbDeleteColumn lnbDeleteRow ' +
        'lnbGetColumnsPosition lnbPicture lnbSetColor lnbSetColumnsPos lnbSetCurSelRow lnbSetData ' +
        'lnbSetPicture lnbSetText lnbSetValue lnbSize lnbSort lnbSortByValue lnbText lnbValue load loadAbs ' +
        'loadBackpack loadFile loadGame loadIdentity loadMagazine loadOverlay loadStatus loadUniform ' +
        'loadVest local localize locationPosition lock lockCameraTo lockCargo lockDriver locked ' +
        'lockedCargo lockedDriver lockedTurret lockIdentity lockTurret lockWP log logEntities logNetwork ' +
        'logNetworkTerminate lookAt lookAtPos magazineCargo magazines magazinesAllTurrets magazinesAmmo ' +
        'magazinesAmmoCargo magazinesAmmoFull magazinesDetail magazinesDetailBackpack ' +
        'magazinesDetailUniform magazinesDetailVest magazinesTurret magazineTurretAmmo mapAnimAdd ' +
        'mapAnimClear mapAnimCommit mapAnimDone mapCenterOnCamera mapGridPosition markAsFinishedOnSteam ' +
        'markerAlpha markerBrush markerColor markerDir markerPos markerShape markerSize markerText ' +
        'markerType max members menuAction menuAdd menuChecked menuClear menuCollapse menuData menuDelete ' +
        'menuEnable menuEnabled menuExpand menuHover menuPicture menuSetAction menuSetCheck menuSetData ' +
        'menuSetPicture menuSetValue menuShortcut menuShortcutText menuSize menuSort menuText menuURL ' +
        'menuValue min mineActive mineDetectedBy missionConfigFile missionDifficulty missionName ' +
        'missionNamespace missionStart missionVersion mod modelToWorld modelToWorldVisual ' +
        'modelToWorldVisualWorld modelToWorldWorld modParams moonIntensity moonPhase morale move ' +
        'move3DENCamera moveInAny moveInCargo moveInCommander moveInDriver moveInGunner moveInTurret ' +
        'moveObjectToEnd moveOut moveTime moveTo moveToCompleted moveToFailed musicVolume name nameSound ' +
        'nearEntities nearestBuilding nearestLocation nearestLocations nearestLocationWithDubbing ' +
        'nearestObject nearestObjects nearestTerrainObjects nearObjects nearObjectsReady nearRoads ' +
        'nearSupplies nearTargets needReload netId netObjNull newOverlay nextMenuItemIndex ' +
        'nextWeatherChange nMenuItems not numberOfEnginesRTD numberToDate objectCurators objectFromNetId ' +
        'objectParent objStatus onBriefingGroup onBriefingNotes onBriefingPlan onBriefingTeamSwitch ' +
        'onCommandModeChanged onDoubleClick onEachFrame onGroupIconClick onGroupIconOverEnter ' +
        'onGroupIconOverLeave onHCGroupSelectionChanged onMapSingleClick onPlayerConnected ' +
        'onPlayerDisconnected onPreloadFinished onPreloadStarted onShowNewObject onTeamSwitch ' +
        'openCuratorInterface openDLCPage openMap openSteamApp openYoutubeVideo or orderGetIn overcast ' +
        'overcastForecast owner param params parseNumber parseSimpleArray parseText parsingNamespace ' +
        'particlesQuality pickWeaponPool pitch pixelGrid pixelGridBase pixelGridNoUIScale pixelH pixelW ' +
        'playableSlotsNumber playableUnits playAction playActionNow player playerRespawnTime playerSide ' +
        'playersNumber playGesture playMission playMove playMoveNow playMusic playScriptedMission ' +
        'playSound playSound3D position positionCameraToWorld posScreenToWorld posWorldToScreen ' +
        'ppEffectAdjust ppEffectCommit ppEffectCommitted ppEffectCreate ppEffectDestroy ppEffectEnable ' +
        'ppEffectEnabled ppEffectForceInNVG precision preloadCamera preloadObject preloadSound ' +
        'preloadTitleObj preloadTitleRsc preprocessFile preprocessFileLineNumbers primaryWeapon ' +
        'primaryWeaponItems primaryWeaponMagazine priority processDiaryLink productVersion profileName ' +
        'profileNamespace profileNameSteam progressLoadingScreen progressPosition progressSetPosition ' +
        'publicVariable publicVariableClient publicVariableServer pushBack pushBackUnique putWeaponPool ' +
        'queryItemsPool queryMagazinePool queryWeaponPool rad radioChannelAdd radioChannelCreate ' +
        'radioChannelRemove radioChannelSetCallSign radioChannelSetLabel radioVolume rain rainbow random ' +
        'rank rankId rating rectangular registeredTasks registerTask reload reloadEnabled remoteControl ' +
        'remoteExec remoteExecCall remoteExecutedOwner remove3DENConnection remove3DENEventHandler ' +
        'remove3DENLayer removeAction removeAll3DENEventHandlers removeAllActions removeAllAssignedItems ' +
        'removeAllContainers removeAllCuratorAddons removeAllCuratorCameraAreas ' +
        'removeAllCuratorEditingAreas removeAllEventHandlers removeAllHandgunItems removeAllItems ' +
        'removeAllItemsWithMagazines removeAllMissionEventHandlers removeAllMPEventHandlers ' +
        'removeAllMusicEventHandlers removeAllOwnedMines removeAllPrimaryWeaponItems removeAllWeapons ' +
        'removeBackpack removeBackpackGlobal removeCuratorAddons removeCuratorCameraArea ' +
        'removeCuratorEditableObjects removeCuratorEditingArea removeDrawIcon removeDrawLinks ' +
        'removeEventHandler removeFromRemainsCollector removeGoggles removeGroupIcon removeHandgunItem ' +
        'removeHeadgear removeItem removeItemFromBackpack removeItemFromUniform removeItemFromVest ' +
        'removeItems removeMagazine removeMagazineGlobal removeMagazines removeMagazinesTurret ' +
        'removeMagazineTurret removeMenuItem removeMissionEventHandler removeMPEventHandler ' +
        'removeMusicEventHandler removeOwnedMine removePrimaryWeaponItem removeSecondaryWeaponItem ' +
        'removeSimpleTask removeSwitchableUnit removeTeamMember removeUniform removeVest removeWeapon ' +
        'removeWeaponAttachmentCargo removeWeaponCargo removeWeaponGlobal removeWeaponTurret ' +
        'reportRemoteTarget requiredVersion resetCamShake resetSubgroupDirection resize resources ' +
        'respawnVehicle restartEditorCamera reveal revealMine reverse reversedMouseY roadAt ' +
        'roadsConnectedTo roleDescription ropeAttachedObjects ropeAttachedTo ropeAttachEnabled ' +
        'ropeAttachTo ropeCreate ropeCut ropeDestroy ropeDetach ropeEndPosition ropeLength ropes ' +
        'ropeUnwind ropeUnwound rotorsForcesRTD rotorsRpmRTD round runInitScript safeZoneH safeZoneW ' +
        'safeZoneWAbs safeZoneX safeZoneXAbs safeZoneY save3DENInventory saveGame saveIdentity ' +
        'saveJoysticks saveOverlay saveProfileNamespace saveStatus saveVar savingEnabled say say2D say3D ' +
        'scopeName score scoreSide screenshot screenToWorld scriptDone scriptName scudState ' +
        'secondaryWeapon secondaryWeaponItems secondaryWeaponMagazine select selectBestPlaces ' +
        'selectDiarySubject selectedEditorObjects selectEditorObject selectionNames selectionPosition ' +
        'selectLeader selectMax selectMin selectNoPlayer selectPlayer selectRandom selectRandomWeighted ' +
        'selectWeapon selectWeaponTurret sendAUMessage sendSimpleCommand sendTask sendTaskResult ' +
        'sendUDPMessage serverCommand serverCommandAvailable serverCommandExecutable serverName serverTime ' +
        'set set3DENAttribute set3DENAttributes set3DENGrid set3DENIconsVisible set3DENLayer ' +
        'set3DENLinesVisible set3DENLogicType set3DENMissionAttribute set3DENMissionAttributes ' +
        'set3DENModelsVisible set3DENObjectType set3DENSelected setAccTime setActualCollectiveRTD ' +
        'setAirplaneThrottle setAirportSide setAmmo setAmmoCargo setAmmoOnPylon setAnimSpeedCoef ' +
        'setAperture setApertureNew setArmoryPoints setAttributes setAutonomous setBehaviour ' +
        'setBleedingRemaining setBrakesRTD setCameraInterest setCamShakeDefParams setCamShakeParams ' +
        'setCamUseTI setCaptive setCenterOfMass setCollisionLight setCombatMode setCompassOscillation ' +
        'setConvoySeparation setCuratorCameraAreaCeiling setCuratorCoef setCuratorEditingAreaType ' +
        'setCuratorWaypointCost setCurrentChannel setCurrentTask setCurrentWaypoint setCustomAimCoef ' +
        'setCustomWeightRTD setDamage setDammage setDate setDebriefingText setDefaultCamera setDestination ' +
        'setDetailMapBlendPars setDir setDirection setDrawIcon setDriveOnPath setDropInterval ' +
        'setDynamicSimulationDistance setDynamicSimulationDistanceCoef setEditorMode setEditorObjectScope ' +
        'setEffectCondition setEngineRPMRTD setFace setFaceAnimation setFatigue setFeatureType ' +
        'setFlagAnimationPhase setFlagOwner setFlagSide setFlagTexture setFog setFormation ' +
        'setFormationTask setFormDir setFriend setFromEditor setFSMVariable setFuel setFuelCargo ' +
        'setGroupIcon setGroupIconParams setGroupIconsSelectable setGroupIconsVisible setGroupId ' +
        'setGroupIdGlobal setGroupOwner setGusts setHideBehind setHit setHitIndex setHitPointDamage ' +
        'setHorizonParallaxCoef setHUDMovementLevels setIdentity setImportance setInfoPanel setLeader ' +
        'setLightAmbient setLightAttenuation setLightBrightness setLightColor setLightDayLight ' +
        'setLightFlareMaxDistance setLightFlareSize setLightIntensity setLightnings setLightUseFlare ' +
        'setLocalWindParams setMagazineTurretAmmo setMarkerAlpha setMarkerAlphaLocal setMarkerBrush ' +
        'setMarkerBrushLocal setMarkerColor setMarkerColorLocal setMarkerDir setMarkerDirLocal ' +
        'setMarkerPos setMarkerPosLocal setMarkerShape setMarkerShapeLocal setMarkerSize ' +
        'setMarkerSizeLocal setMarkerText setMarkerTextLocal setMarkerType setMarkerTypeLocal setMass ' +
        'setMimic setMousePosition setMusicEffect setMusicEventHandler setName setNameSound ' +
        'setObjectArguments setObjectMaterial setObjectMaterialGlobal setObjectProxy setObjectTexture ' +
        'setObjectTextureGlobal setObjectViewDistance setOvercast setOwner setOxygenRemaining ' +
        'setParticleCircle setParticleClass setParticleFire setParticleParams setParticleRandom ' +
        'setPilotCameraDirection setPilotCameraRotation setPilotCameraTarget setPilotLight setPiPEffect ' +
        'setPitch setPlateNumber setPlayable setPlayerRespawnTime setPos setPosASL setPosASL2 setPosASLW ' +
        'setPosATL setPosition setPosWorld setPylonLoadOut setPylonsPriority setRadioMsg setRain ' +
        'setRainbow setRandomLip setRank setRectangular setRepairCargo setRotorBrakeRTD setShadowDistance ' +
        'setShotParents setSide setSimpleTaskAlwaysVisible setSimpleTaskCustomData ' +
        'setSimpleTaskDescription setSimpleTaskDestination setSimpleTaskTarget setSimpleTaskType ' +
        'setSimulWeatherLayers setSize setSkill setSlingLoad setSoundEffect setSpeaker setSpeech ' +
        'setSpeedMode setStamina setStaminaScheme setStatValue setSuppression setSystemOfUnits ' +
        'setTargetAge setTaskMarkerOffset setTaskResult setTaskState setTerrainGrid setText ' +
        'setTimeMultiplier setTitleEffect setTrafficDensity setTrafficDistance setTrafficGap ' +
        'setTrafficSpeed setTriggerActivation setTriggerArea setTriggerStatements setTriggerText ' +
        'setTriggerTimeout setTriggerType setType setUnconscious setUnitAbility setUnitLoadout setUnitPos ' +
        'setUnitPosWeak setUnitRank setUnitRecoilCoefficient setUnitTrait setUnloadInCombat ' +
        'setUserActionText setUserMFDText setUserMFDvalue setVariable setVectorDir setVectorDirAndUp ' +
        'setVectorUp setVehicleAmmo setVehicleAmmoDef setVehicleArmor setVehicleCargo setVehicleId ' +
        'setVehicleLock setVehiclePosition setVehicleRadar setVehicleReceiveRemoteTargets ' +
        'setVehicleReportOwnPosition setVehicleReportRemoteTargets setVehicleTIPars setVehicleVarName ' +
        'setVelocity setVelocityModelSpace setVelocityTransformation setViewDistance ' +
        'setVisibleIfTreeCollapsed setWantedRPMRTD setWaves setWaypointBehaviour setWaypointCombatMode ' +
        'setWaypointCompletionRadius setWaypointDescription setWaypointForceBehaviour setWaypointFormation ' +
        'setWaypointHousePosition setWaypointLoiterRadius setWaypointLoiterType setWaypointName ' +
        'setWaypointPosition setWaypointScript setWaypointSpeed setWaypointStatements setWaypointTimeout ' +
        'setWaypointType setWaypointVisible setWeaponReloadingTime setWind setWindDir setWindForce ' +
        'setWindStr setWingForceScaleRTD setWPPos show3DIcons showChat showCinemaBorder showCommandingMenu ' +
        'showCompass showCuratorCompass showGPS showHUD showLegend showMap shownArtilleryComputer ' +
        'shownChat shownCompass shownCuratorCompass showNewEditorObject shownGPS shownHUD shownMap ' +
        'shownPad shownRadio shownScoretable shownUAVFeed shownWarrant shownWatch showPad showRadio ' +
        'showScoretable showSubtitles showUAVFeed showWarrant showWatch showWaypoint showWaypoints side ' +
        'sideChat sideEnemy sideFriendly sideRadio simpleTasks simulationEnabled simulCloudDensity ' +
        'simulCloudOcclusion simulInClouds simulWeatherSync sin size sizeOf skill skillFinal skipTime ' +
        'sleep sliderPosition sliderRange sliderSetPosition sliderSetRange sliderSetSpeed sliderSpeed ' +
        'slingLoadAssistantShown soldierMagazines someAmmo sort soundVolume spawn speaker speed speedMode ' +
        'splitString sqrt squadParams stance startLoadingScreen step stop stopEngineRTD stopped str ' +
        'sunOrMoon supportInfo suppressFor surfaceIsWater surfaceNormal surfaceType swimInDepth ' +
        'switchableUnits switchAction switchCamera switchGesture switchLight switchMove ' +
        'synchronizedObjects synchronizedTriggers synchronizedWaypoints synchronizeObjectsAdd ' +
        'synchronizeObjectsRemove synchronizeTrigger synchronizeWaypoint systemChat systemOfUnits tan ' +
        'targetKnowledge targets targetsAggregate targetsQuery taskAlwaysVisible taskChildren ' +
        'taskCompleted taskCustomData taskDescription taskDestination taskHint taskMarkerOffset taskParent ' +
        'taskResult taskState taskType teamMember teamName teams teamSwitch teamSwitchEnabled teamType ' +
        'terminate terrainIntersect terrainIntersectASL terrainIntersectAtASL text textLog textLogFormat ' +
        'tg time timeMultiplier titleCut titleFadeOut titleObj titleRsc titleText toArray toFixed toLower ' +
        'toString toUpper triggerActivated triggerActivation triggerArea triggerAttachedVehicle ' +
        'triggerAttachObject triggerAttachVehicle triggerDynamicSimulation triggerStatements triggerText ' +
        'triggerTimeout triggerTimeoutCurrent triggerType turretLocal turretOwner turretUnit tvAdd tvClear ' +
        'tvCollapse tvCollapseAll tvCount tvCurSel tvData tvDelete tvExpand tvExpandAll tvPicture ' +
        'tvSetColor tvSetCurSel tvSetData tvSetPicture tvSetPictureColor tvSetPictureColorDisabled ' +
        'tvSetPictureColorSelected tvSetPictureRight tvSetPictureRightColor tvSetPictureRightColorDisabled ' +
        'tvSetPictureRightColorSelected tvSetText tvSetTooltip tvSetValue tvSort tvSortByValue tvText ' +
        'tvTooltip tvValue type typeName typeOf UAVControl uiNamespace uiSleep unassignCurator ' +
        'unassignItem unassignTeam unassignVehicle underwater uniform uniformContainer uniformItems ' +
        'uniformMagazines unitAddons unitAimPosition unitAimPositionVisual unitBackpack unitIsUAV unitPos ' +
        'unitReady unitRecoilCoefficient units unitsBelowHeight unlinkItem unlockAchievement ' +
        'unregisterTask updateDrawIcon updateMenuItem updateObjectTree useAISteeringComponent ' +
        'useAudioTimeForMoves userInputDisabled vectorAdd vectorCos vectorCrossProduct vectorDiff ' +
        'vectorDir vectorDirVisual vectorDistance vectorDistanceSqr vectorDotProduct vectorFromTo ' +
        'vectorMagnitude vectorMagnitudeSqr vectorModelToWorld vectorModelToWorldVisual vectorMultiply ' +
        'vectorNormalized vectorUp vectorUpVisual vectorWorldToModel vectorWorldToModelVisual vehicle ' +
        'vehicleCargoEnabled vehicleChat vehicleRadio vehicleReceiveRemoteTargets vehicleReportOwnPosition ' +
        'vehicleReportRemoteTargets vehicles vehicleVarName velocity velocityModelSpace verifySignature ' +
        'vest vestContainer vestItems vestMagazines viewDistance visibleCompass visibleGPS visibleMap ' +
        'visiblePosition visiblePositionASL visibleScoretable visibleWatch waves waypointAttachedObject ' +
        'waypointAttachedVehicle waypointAttachObject waypointAttachVehicle waypointBehaviour ' +
        'waypointCombatMode waypointCompletionRadius waypointDescription waypointForceBehaviour ' +
        'waypointFormation waypointHousePosition waypointLoiterRadius waypointLoiterType waypointName ' +
        'waypointPosition waypoints waypointScript waypointsEnabledUAV waypointShow waypointSpeed ' +
        'waypointStatements waypointTimeout waypointTimeoutCurrent waypointType waypointVisible ' +
        'weaponAccessories weaponAccessoriesCargo weaponCargo weaponDirection weaponInertia weaponLowered ' +
        'weapons weaponsItems weaponsItemsCargo weaponState weaponsTurret weightRTD WFSideText wind ',
      literal:
        'blufor civilian configNull controlNull displayNull east endl false grpNull independent lineBreak ' +
        'locationNull nil objNull opfor pi resistance scriptNull sideAmbientLife sideEmpty sideLogic ' +
        'sideUnknown taskNull teamMemberNull true west',
    },
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.NUMBER_MODE,
      VARIABLE,
      FUNCTION,
      STRINGS,
      CPP.preprocessor
    ],
    illegal: /#|^\$ /
  };
};

var sql = function(hljs) {
  var COMMENT_MODE = hljs.COMMENT('--', '$');
  return {
    case_insensitive: true,
    illegal: /[<>{}*]/,
    contains: [
      {
        beginKeywords:
          'begin end start commit rollback savepoint lock alter create drop rename call ' +
          'delete do handler insert load replace select truncate update set show pragma grant ' +
          'merge describe use explain help declare prepare execute deallocate release ' +
          'unlock purge reset change stop analyze cache flush optimize repair kill ' +
          'install uninstall checksum restore check backup revoke comment values with',
        end: /;/, endsWithParent: true,
        lexemes: /[\w\.]+/,
        keywords: {
          keyword:
            'as abort abs absolute acc acce accep accept access accessed accessible account acos action activate add ' +
            'addtime admin administer advanced advise aes_decrypt aes_encrypt after agent aggregate ali alia alias ' +
            'all allocate allow alter always analyze ancillary and anti any anydata anydataset anyschema anytype apply ' +
            'archive archived archivelog are as asc ascii asin assembly assertion associate asynchronous at atan ' +
            'atn2 attr attri attrib attribu attribut attribute attributes audit authenticated authentication authid ' +
            'authors auto autoallocate autodblink autoextend automatic availability avg backup badfile basicfile ' +
            'before begin beginning benchmark between bfile bfile_base big bigfile bin binary_double binary_float ' +
            'binlog bit_and bit_count bit_length bit_or bit_xor bitmap blob_base block blocksize body both bound ' +
            'bucket buffer_cache buffer_pool build bulk by byte byteordermark bytes cache caching call calling cancel ' +
            'capacity cascade cascaded case cast catalog category ceil ceiling chain change changed char_base ' +
            'char_length character_length characters characterset charindex charset charsetform charsetid check ' +
            'checksum checksum_agg child choose chr chunk class cleanup clear client clob clob_base clone close ' +
            'cluster_id cluster_probability cluster_set clustering coalesce coercibility col collate collation ' +
            'collect colu colum column column_value columns columns_updated comment commit compact compatibility ' +
            'compiled complete composite_limit compound compress compute concat concat_ws concurrent confirm conn ' +
            'connec connect connect_by_iscycle connect_by_isleaf connect_by_root connect_time connection ' +
            'consider consistent constant constraint constraints constructor container content contents context ' +
            'contributors controlfile conv convert convert_tz corr corr_k corr_s corresponding corruption cos cost ' +
            'count count_big counted covar_pop covar_samp cpu_per_call cpu_per_session crc32 create creation ' +
            'critical cross cube cume_dist curdate current current_date current_time current_timestamp current_user ' +
            'cursor curtime customdatum cycle data database databases datafile datafiles datalength date_add ' +
            'date_cache date_format date_sub dateadd datediff datefromparts datename datepart datetime2fromparts ' +
            'day day_to_second dayname dayofmonth dayofweek dayofyear days db_role_change dbtimezone ddl deallocate ' +
            'declare decode decompose decrement decrypt deduplicate def defa defau defaul default defaults ' +
            'deferred defi defin define degrees delayed delegate delete delete_all delimited demand dense_rank ' +
            'depth dequeue des_decrypt des_encrypt des_key_file desc descr descri describ describe descriptor ' +
            'deterministic diagnostics difference dimension direct_load directory disable disable_all ' +
            'disallow disassociate discardfile disconnect diskgroup distinct distinctrow distribute distributed div ' +
            'do document domain dotnet double downgrade drop dumpfile duplicate duration each edition editionable ' +
            'editions element ellipsis else elsif elt empty enable enable_all enclosed encode encoding encrypt ' +
            'end end-exec endian enforced engine engines enqueue enterprise entityescaping eomonth error errors ' +
            'escaped evalname evaluate event eventdata events except exception exceptions exchange exclude excluding ' +
            'execu execut execute exempt exists exit exp expire explain explode export export_set extended extent external ' +
            'external_1 external_2 externally extract failed failed_login_attempts failover failure far fast ' +
            'feature_set feature_value fetch field fields file file_name_convert filesystem_like_logging final ' +
            'finish first first_value fixed flash_cache flashback floor flush following follows for forall force foreign ' +
            'form forma format found found_rows freelist freelists freepools fresh from from_base64 from_days ' +
            'ftp full function general generated get get_format get_lock getdate getutcdate global global_name ' +
            'globally go goto grant grants greatest group group_concat group_id grouping grouping_id groups ' +
            'gtid_subtract guarantee guard handler hash hashkeys having hea head headi headin heading heap help hex ' +
            'hierarchy high high_priority hosts hour hours http id ident_current ident_incr ident_seed identified ' +
            'identity idle_time if ifnull ignore iif ilike ilm immediate import in include including increment ' +
            'index indexes indexing indextype indicator indices inet6_aton inet6_ntoa inet_aton inet_ntoa infile ' +
            'initial initialized initially initrans inmemory inner innodb input insert install instance instantiable ' +
            'instr interface interleaved intersect into invalidate invisible is is_free_lock is_ipv4 is_ipv4_compat ' +
            'is_not is_not_null is_used_lock isdate isnull isolation iterate java join json json_exists ' +
            'keep keep_duplicates key keys kill language large last last_day last_insert_id last_value lateral lax lcase ' +
            'lead leading least leaves left len lenght length less level levels library like like2 like4 likec limit ' +
            'lines link list listagg little ln load load_file lob lobs local localtime localtimestamp locate ' +
            'locator lock locked log log10 log2 logfile logfiles logging logical logical_reads_per_call ' +
            'logoff logon logs long loop low low_priority lower lpad lrtrim ltrim main make_set makedate maketime ' +
            'managed management manual map mapping mask master master_pos_wait match matched materialized max ' +
            'maxextents maximize maxinstances maxlen maxlogfiles maxloghistory maxlogmembers maxsize maxtrans ' +
            'md5 measures median medium member memcompress memory merge microsecond mid migration min minextents ' +
            'minimum mining minus minute minutes minvalue missing mod mode model modification modify module monitoring month ' +
            'months mount move movement multiset mutex name name_const names nan national native natural nav nchar ' +
            'nclob nested never new newline next nextval no no_write_to_binlog noarchivelog noaudit nobadfile ' +
            'nocheck nocompress nocopy nocycle nodelay nodiscardfile noentityescaping noguarantee nokeep nologfile ' +
            'nomapping nomaxvalue nominimize nominvalue nomonitoring none noneditionable nonschema noorder ' +
            'nopr nopro noprom nopromp noprompt norely noresetlogs noreverse normal norowdependencies noschemacheck ' +
            'noswitch not nothing notice notnull notrim novalidate now nowait nth_value nullif nulls num numb numbe ' +
            'nvarchar nvarchar2 object ocicoll ocidate ocidatetime ociduration ociinterval ociloblocator ocinumber ' +
            'ociref ocirefcursor ocirowid ocistring ocitype oct octet_length of off offline offset oid oidindex old ' +
            'on online only opaque open operations operator optimal optimize option optionally or oracle oracle_date ' +
            'oradata ord ordaudio orddicom orddoc order ordimage ordinality ordvideo organization orlany orlvary ' +
            'out outer outfile outline output over overflow overriding package pad parallel parallel_enable ' +
            'parameters parent parse partial partition partitions pascal passing password password_grace_time ' +
            'password_lock_time password_reuse_max password_reuse_time password_verify_function patch path patindex ' +
            'pctincrease pctthreshold pctused pctversion percent percent_rank percentile_cont percentile_disc ' +
            'performance period period_add period_diff permanent physical pi pipe pipelined pivot pluggable plugin ' +
            'policy position post_transaction pow power pragma prebuilt precedes preceding precision prediction ' +
            'prediction_cost prediction_details prediction_probability prediction_set prepare present preserve ' +
            'prior priority private private_sga privileges procedural procedure procedure_analyze processlist ' +
            'profiles project prompt protection public publishingservername purge quarter query quick quiesce quota ' +
            'quotename radians raise rand range rank raw read reads readsize rebuild record records ' +
            'recover recovery recursive recycle redo reduced ref reference referenced references referencing refresh ' +
            'regexp_like register regr_avgx regr_avgy regr_count regr_intercept regr_r2 regr_slope regr_sxx regr_sxy ' +
            'reject rekey relational relative relaylog release release_lock relies_on relocate rely rem remainder rename ' +
            'repair repeat replace replicate replication required reset resetlogs resize resource respect restore ' +
            'restricted result result_cache resumable resume retention return returning returns reuse reverse revoke ' +
            'right rlike role roles rollback rolling rollup round row row_count rowdependencies rowid rownum rows ' +
            'rtrim rules safe salt sample save savepoint sb1 sb2 sb4 scan schema schemacheck scn scope scroll ' +
            'sdo_georaster sdo_topo_geometry search sec_to_time second seconds section securefile security seed segment select ' +
            'self semi sequence sequential serializable server servererror session session_user sessions_per_user set ' +
            'sets settings sha sha1 sha2 share shared shared_pool short show shrink shutdown si_averagecolor ' +
            'si_colorhistogram si_featurelist si_positionalcolor si_stillimage si_texture siblings sid sign sin ' +
            'size size_t sizes skip slave sleep smalldatetimefromparts smallfile snapshot some soname sort soundex ' +
            'source space sparse spfile split sql sql_big_result sql_buffer_result sql_cache sql_calc_found_rows ' +
            'sql_small_result sql_variant_property sqlcode sqldata sqlerror sqlname sqlstate sqrt square standalone ' +
            'standby start starting startup statement static statistics stats_binomial_test stats_crosstab ' +
            'stats_ks_test stats_mode stats_mw_test stats_one_way_anova stats_t_test_ stats_t_test_indep ' +
            'stats_t_test_one stats_t_test_paired stats_wsr_test status std stddev stddev_pop stddev_samp stdev ' +
            'stop storage store stored str str_to_date straight_join strcmp strict string struct stuff style subdate ' +
            'subpartition subpartitions substitutable substr substring subtime subtring_index subtype success sum ' +
            'suspend switch switchoffset switchover sync synchronous synonym sys sys_xmlagg sysasm sysaux sysdate ' +
            'sysdatetimeoffset sysdba sysoper system system_user sysutcdatetime table tables tablespace tablesample tan tdo ' +
            'template temporary terminated tertiary_weights test than then thread through tier ties time time_format ' +
            'time_zone timediff timefromparts timeout timestamp timestampadd timestampdiff timezone_abbr ' +
            'timezone_minute timezone_region to to_base64 to_date to_days to_seconds todatetimeoffset trace tracking ' +
            'transaction transactional translate translation treat trigger trigger_nestlevel triggers trim truncate ' +
            'try_cast try_convert try_parse type ub1 ub2 ub4 ucase unarchived unbounded uncompress ' +
            'under undo unhex unicode uniform uninstall union unique unix_timestamp unknown unlimited unlock unnest unpivot ' +
            'unrecoverable unsafe unsigned until untrusted unusable unused update updated upgrade upped upper upsert ' +
            'url urowid usable usage use use_stored_outlines user user_data user_resources users using utc_date ' +
            'utc_timestamp uuid uuid_short validate validate_password_strength validation valist value values var ' +
            'var_samp varcharc vari varia variab variabl variable variables variance varp varraw varrawc varray ' +
            'verify version versions view virtual visible void wait wallet warning warnings week weekday weekofyear ' +
            'wellformed when whene whenev wheneve whenever where while whitespace window with within without work wrapped ' +
            'xdb xml xmlagg xmlattributes xmlcast xmlcolattval xmlelement xmlexists xmlforest xmlindex xmlnamespaces ' +
            'xmlpi xmlquery xmlroot xmlschema xmlserialize xmltable xmltype xor year year_to_month years yearweek',
          literal:
            'true false null unknown',
          built_in:
            'array bigint binary bit blob bool boolean char character date dec decimal float int int8 integer interval number ' +
            'numeric real record serial serial8 smallint text time timestamp tinyint varchar varying void'
        },
        contains: [
          {
            className: 'string',
            begin: '\'', end: '\'',
            contains: [hljs.BACKSLASH_ESCAPE, {begin: '\'\''}]
          },
          {
            className: 'string',
            begin: '"', end: '"',
            contains: [hljs.BACKSLASH_ESCAPE, {begin: '""'}]
          },
          {
            className: 'string',
            begin: '`', end: '`',
            contains: [hljs.BACKSLASH_ESCAPE]
          },
          hljs.C_NUMBER_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          COMMENT_MODE,
          hljs.HASH_COMMENT_MODE
        ]
      },
      hljs.C_BLOCK_COMMENT_MODE,
      COMMENT_MODE,
      hljs.HASH_COMMENT_MODE
    ]
  };
};

var stan = function(hljs) {
  return {
    contains: [
      hljs.HASH_COMMENT_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      {
        begin: hljs.UNDERSCORE_IDENT_RE,
        lexemes: hljs.UNDERSCORE_IDENT_RE,
        keywords: {
          // Stan's keywords
          name:
            'for in while repeat until if then else',
          // Stan's probablity distributions (less beta and gamma, as commonly
          // used for parameter names). So far, _log and _rng variants are not
          // included
          symbol:
            'bernoulli bernoulli_logit binomial binomial_logit '               +
            'beta_binomial hypergeometric categorical categorical_logit '      +
            'ordered_logistic neg_binomial neg_binomial_2 '                    +
            'neg_binomial_2_log poisson poisson_log multinomial normal '       +
            'exp_mod_normal skew_normal student_t cauchy double_exponential '  +
            'logistic gumbel lognormal chi_square inv_chi_square '             +
            'scaled_inv_chi_square exponential inv_gamma weibull frechet '     +
            'rayleigh wiener pareto pareto_type_2 von_mises uniform '          +
            'multi_normal multi_normal_prec multi_normal_cholesky multi_gp '   +
            'multi_gp_cholesky multi_student_t gaussian_dlm_obs dirichlet '    +
            'lkj_corr lkj_corr_cholesky wishart inv_wishart',
          // Stan's data types
          'selector-tag':
            'int real vector simplex unit_vector ordered positive_ordered '    +
            'row_vector matrix cholesky_factor_corr cholesky_factor_cov '      +
            'corr_matrix cov_matrix',
          // Stan's model blocks
          title:
            'functions model data parameters quantities transformed '          +
            'generated',
          literal:
            'true false'
        },
        relevance: 0
      },
      // The below is all taken from the R language definition
      {
        // hex value
        className: 'number',
        begin: "0[xX][0-9a-fA-F]+[Li]?\\b",
        relevance: 0
      },
      {
        // hex value
        className: 'number',
        begin: "0[xX][0-9a-fA-F]+[Li]?\\b",
        relevance: 0
      },
      {
        // explicit integer
        className: 'number',
        begin: "\\d+(?:[eE][+\\-]?\\d*)?L\\b",
        relevance: 0
      },
      {
        // number with trailing decimal
        className: 'number',
        begin: "\\d+\\.(?!\\d)(?:i\\b)?",
        relevance: 0
      },
      {
        // number
        className: 'number',
        begin: "\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d*)?i?\\b",
        relevance: 0
      },
      {
        // number with leading decimal
        className: 'number',
        begin: "\\.\\d+(?:[eE][+\\-]?\\d*)?i?\\b",
        relevance: 0
      }
    ]
  };
};

var stata = function(hljs) {
  return {
    aliases: ['do', 'ado'],
    case_insensitive: true,
    keywords: 'if else in foreach for forv forva forval forvalu forvalue forvalues by bys bysort xi quietly qui capture about ac ac_7 acprplot acprplot_7 adjust ado adopath adoupdate alpha ameans an ano anov anova anova_estat anova_terms anovadef aorder ap app appe appen append arch arch_dr arch_estat arch_p archlm areg areg_p args arima arima_dr arima_estat arima_p as asmprobit asmprobit_estat asmprobit_lf asmprobit_mfx__dlg asmprobit_p ass asse asser assert avplot avplot_7 avplots avplots_7 bcskew0 bgodfrey binreg bip0_lf biplot bipp_lf bipr_lf bipr_p biprobit bitest bitesti bitowt blogit bmemsize boot bootsamp bootstrap bootstrap_8 boxco_l boxco_p boxcox boxcox_6 boxcox_p bprobit br break brier bro brow brows browse brr brrstat bs bs_7 bsampl_w bsample bsample_7 bsqreg bstat bstat_7 bstat_8 bstrap bstrap_7 ca ca_estat ca_p cabiplot camat canon canon_8 canon_8_p canon_estat canon_p cap caprojection capt captu captur capture cat cc cchart cchart_7 cci cd censobs_table centile cf char chdir checkdlgfiles checkestimationsample checkhlpfiles checksum chelp ci cii cl class classutil clear cli clis clist clo clog clog_lf clog_p clogi clogi_sw clogit clogit_lf clogit_p clogitp clogl_sw cloglog clonevar clslistarray cluster cluster_measures cluster_stop cluster_tree cluster_tree_8 clustermat cmdlog cnr cnre cnreg cnreg_p cnreg_sw cnsreg codebook collaps4 collapse colormult_nb colormult_nw compare compress conf confi confir confirm conren cons const constr constra constrai constrain constraint continue contract copy copyright copysource cor corc corr corr2data corr_anti corr_kmo corr_smc corre correl correla correlat correlate corrgram cou coun count cox cox_p cox_sw coxbase coxhaz coxvar cprplot cprplot_7 crc cret cretu cretur creturn cross cs cscript cscript_log csi ct ct_is ctset ctst_5 ctst_st cttost cumsp cumsp_7 cumul cusum cusum_7 cutil d|0 datasig datasign datasigna datasignat datasignatu datasignatur datasignature datetof db dbeta de dec deco decod decode deff des desc descr descri describ describe destring dfbeta dfgls dfuller di di_g dir dirstats dis discard disp disp_res disp_s displ displa display distinct do doe doed doedi doedit dotplot dotplot_7 dprobit drawnorm drop ds ds_util dstdize duplicates durbina dwstat dydx e|0 ed edi edit egen eivreg emdef en enc enco encod encode eq erase ereg ereg_lf ereg_p ereg_sw ereghet ereghet_glf ereghet_glf_sh ereghet_gp ereghet_ilf ereghet_ilf_sh ereghet_ip eret eretu eretur ereturn err erro error est est_cfexist est_cfname est_clickable est_expand est_hold est_table est_unhold est_unholdok estat estat_default estat_summ estat_vce_only esti estimates etodow etof etomdy ex exi exit expand expandcl fac fact facto factor factor_estat factor_p factor_pca_rotated factor_rotate factormat fcast fcast_compute fcast_graph fdades fdadesc fdadescr fdadescri fdadescrib fdadescribe fdasav fdasave fdause fh_st file open file read file close file filefilter fillin find_hlp_file findfile findit findit_7 fit fl fli flis flist for5_0 form forma format fpredict frac_154 frac_adj frac_chk frac_cox frac_ddp frac_dis frac_dv frac_in frac_mun frac_pp frac_pq frac_pv frac_wgt frac_xo fracgen fracplot fracplot_7 fracpoly fracpred fron_ex fron_hn fron_p fron_tn fron_tn2 frontier ftodate ftoe ftomdy ftowdate g|0 gamhet_glf gamhet_gp gamhet_ilf gamhet_ip gamma gamma_d2 gamma_p gamma_sw gammahet gdi_hexagon gdi_spokes ge gen gene gener genera generat generate genrank genstd genvmean gettoken gl gladder gladder_7 glim_l01 glim_l02 glim_l03 glim_l04 glim_l05 glim_l06 glim_l07 glim_l08 glim_l09 glim_l10 glim_l11 glim_l12 glim_lf glim_mu glim_nw1 glim_nw2 glim_nw3 glim_p glim_v1 glim_v2 glim_v3 glim_v4 glim_v5 glim_v6 glim_v7 glm glm_6 glm_p glm_sw glmpred glo glob globa global glogit glogit_8 glogit_p gmeans gnbre_lf gnbreg gnbreg_5 gnbreg_p gomp_lf gompe_sw gomper_p gompertz gompertzhet gomphet_glf gomphet_glf_sh gomphet_gp gomphet_ilf gomphet_ilf_sh gomphet_ip gphdot gphpen gphprint gprefs gprobi_p gprobit gprobit_8 gr gr7 gr_copy gr_current gr_db gr_describe gr_dir gr_draw gr_draw_replay gr_drop gr_edit gr_editviewopts gr_example gr_example2 gr_export gr_print gr_qscheme gr_query gr_read gr_rename gr_replay gr_save gr_set gr_setscheme gr_table gr_undo gr_use graph graph7 grebar greigen greigen_7 greigen_8 grmeanby grmeanby_7 gs_fileinfo gs_filetype gs_graphinfo gs_stat gsort gwood h|0 hadimvo hareg hausman haver he heck_d2 heckma_p heckman heckp_lf heckpr_p heckprob hel help hereg hetpr_lf hetpr_p hetprob hettest hexdump hilite hist hist_7 histogram hlogit hlu hmeans hotel hotelling hprobit hreg hsearch icd9 icd9_ff icd9p iis impute imtest inbase include inf infi infil infile infix inp inpu input ins insheet insp inspe inspec inspect integ inten intreg intreg_7 intreg_p intrg2_ll intrg_ll intrg_ll2 ipolate iqreg ir irf irf_create irfm iri is_svy is_svysum isid istdize ivprob_1_lf ivprob_lf ivprobit ivprobit_p ivreg ivreg_footnote ivtob_1_lf ivtob_lf ivtobit ivtobit_p jackknife jacknife jknife jknife_6 jknife_8 jkstat joinby kalarma1 kap kap_3 kapmeier kappa kapwgt kdensity kdensity_7 keep ksm ksmirnov ktau kwallis l|0 la lab labe label labelbook ladder levels levelsof leverage lfit lfit_p li lincom line linktest lis list lloghet_glf lloghet_glf_sh lloghet_gp lloghet_ilf lloghet_ilf_sh lloghet_ip llogi_sw llogis_p llogist llogistic llogistichet lnorm_lf lnorm_sw lnorma_p lnormal lnormalhet lnormhet_glf lnormhet_glf_sh lnormhet_gp lnormhet_ilf lnormhet_ilf_sh lnormhet_ip lnskew0 loadingplot loc loca local log logi logis_lf logistic logistic_p logit logit_estat logit_p loglogs logrank loneway lookfor lookup lowess lowess_7 lpredict lrecomp lroc lroc_7 lrtest ls lsens lsens_7 lsens_x lstat ltable ltable_7 ltriang lv lvr2plot lvr2plot_7 m|0 ma mac macr macro makecns man manova manova_estat manova_p manovatest mantel mark markin markout marksample mat mat_capp mat_order mat_put_rr mat_rapp mata mata_clear mata_describe mata_drop mata_matdescribe mata_matsave mata_matuse mata_memory mata_mlib mata_mosave mata_rename mata_which matalabel matcproc matlist matname matr matri matrix matrix_input__dlg matstrik mcc mcci md0_ md1_ md1debug_ md2_ md2debug_ mds mds_estat mds_p mdsconfig mdslong mdsmat mdsshepard mdytoe mdytof me_derd mean means median memory memsize meqparse mer merg merge mfp mfx mhelp mhodds minbound mixed_ll mixed_ll_reparm mkassert mkdir mkmat mkspline ml ml_5 ml_adjs ml_bhhhs ml_c_d ml_check ml_clear ml_cnt ml_debug ml_defd ml_e0 ml_e0_bfgs ml_e0_cycle ml_e0_dfp ml_e0i ml_e1 ml_e1_bfgs ml_e1_bhhh ml_e1_cycle ml_e1_dfp ml_e2 ml_e2_cycle ml_ebfg0 ml_ebfr0 ml_ebfr1 ml_ebh0q ml_ebhh0 ml_ebhr0 ml_ebr0i ml_ecr0i ml_edfp0 ml_edfr0 ml_edfr1 ml_edr0i ml_eds ml_eer0i ml_egr0i ml_elf ml_elf_bfgs ml_elf_bhhh ml_elf_cycle ml_elf_dfp ml_elfi ml_elfs ml_enr0i ml_enrr0 ml_erdu0 ml_erdu0_bfgs ml_erdu0_bhhh ml_erdu0_bhhhq ml_erdu0_cycle ml_erdu0_dfp ml_erdu0_nrbfgs ml_exde ml_footnote ml_geqnr ml_grad0 ml_graph ml_hbhhh ml_hd0 ml_hold ml_init ml_inv ml_log ml_max ml_mlout ml_mlout_8 ml_model ml_nb0 ml_opt ml_p ml_plot ml_query ml_rdgrd ml_repor ml_s_e ml_score ml_searc ml_technique ml_unhold mleval mlf_ mlmatbysum mlmatsum mlog mlogi mlogit mlogit_footnote mlogit_p mlopts mlsum mlvecsum mnl0_ mor more mov move mprobit mprobit_lf mprobit_p mrdu0_ mrdu1_ mvdecode mvencode mvreg mvreg_estat n|0 nbreg nbreg_al nbreg_lf nbreg_p nbreg_sw nestreg net newey newey_7 newey_p news nl nl_7 nl_9 nl_9_p nl_p nl_p_7 nlcom nlcom_p nlexp2 nlexp2_7 nlexp2a nlexp2a_7 nlexp3 nlexp3_7 nlgom3 nlgom3_7 nlgom4 nlgom4_7 nlinit nllog3 nllog3_7 nllog4 nllog4_7 nlog_rd nlogit nlogit_p nlogitgen nlogittree nlpred no nobreak noi nois noisi noisil noisily note notes notes_dlg nptrend numlabel numlist odbc old_ver olo olog ologi ologi_sw ologit ologit_p ologitp on one onew onewa oneway op_colnm op_comp op_diff op_inv op_str opr opro oprob oprob_sw oprobi oprobi_p oprobit oprobitp opts_exclusive order orthog orthpoly ou out outf outfi outfil outfile outs outsh outshe outshee outsheet ovtest pac pac_7 palette parse parse_dissim pause pca pca_8 pca_display pca_estat pca_p pca_rotate pcamat pchart pchart_7 pchi pchi_7 pcorr pctile pentium pergram pergram_7 permute permute_8 personal peto_st pkcollapse pkcross pkequiv pkexamine pkexamine_7 pkshape pksumm pksumm_7 pl plo plot plugin pnorm pnorm_7 poisgof poiss_lf poiss_sw poisso_p poisson poisson_estat post postclose postfile postutil pperron pr prais prais_e prais_e2 prais_p predict predictnl preserve print pro prob probi probit probit_estat probit_p proc_time procoverlay procrustes procrustes_estat procrustes_p profiler prog progr progra program prop proportion prtest prtesti pwcorr pwd q\\s qby qbys qchi qchi_7 qladder qladder_7 qnorm qnorm_7 qqplot qqplot_7 qreg qreg_c qreg_p qreg_sw qu quadchk quantile quantile_7 que quer query range ranksum ratio rchart rchart_7 rcof recast reclink recode reg reg3 reg3_p regdw regr regre regre_p2 regres regres_p regress regress_estat regriv_p remap ren rena renam rename renpfix repeat replace report reshape restore ret retu retur return rm rmdir robvar roccomp roccomp_7 roccomp_8 rocf_lf rocfit rocfit_8 rocgold rocplot rocplot_7 roctab roctab_7 rolling rologit rologit_p rot rota rotat rotate rotatemat rreg rreg_p ru run runtest rvfplot rvfplot_7 rvpplot rvpplot_7 sa safesum sample sampsi sav save savedresults saveold sc sca scal scala scalar scatter scm_mine sco scob_lf scob_p scobi_sw scobit scor score scoreplot scoreplot_help scree screeplot screeplot_help sdtest sdtesti se search separate seperate serrbar serrbar_7 serset set set_defaults sfrancia sh she shel shell shewhart shewhart_7 signestimationsample signrank signtest simul simul_7 simulate simulate_8 sktest sleep slogit slogit_d2 slogit_p smooth snapspan so sor sort spearman spikeplot spikeplot_7 spikeplt spline_x split sqreg sqreg_p sret sretu sretur sreturn ssc st st_ct st_hc st_hcd st_hcd_sh st_is st_issys st_note st_promo st_set st_show st_smpl st_subid stack statsby statsby_8 stbase stci stci_7 stcox stcox_estat stcox_fr stcox_fr_ll stcox_p stcox_sw stcoxkm stcoxkm_7 stcstat stcurv stcurve stcurve_7 stdes stem stepwise stereg stfill stgen stir stjoin stmc stmh stphplot stphplot_7 stphtest stphtest_7 stptime strate strate_7 streg streg_sw streset sts sts_7 stset stsplit stsum sttocc sttoct stvary stweib su suest suest_8 sum summ summa summar summari summariz summarize sunflower sureg survcurv survsum svar svar_p svmat svy svy_disp svy_dreg svy_est svy_est_7 svy_estat svy_get svy_gnbreg_p svy_head svy_header svy_heckman_p svy_heckprob_p svy_intreg_p svy_ivreg_p svy_logistic_p svy_logit_p svy_mlogit_p svy_nbreg_p svy_ologit_p svy_oprobit_p svy_poisson_p svy_probit_p svy_regress_p svy_sub svy_sub_7 svy_x svy_x_7 svy_x_p svydes svydes_8 svygen svygnbreg svyheckman svyheckprob svyintreg svyintreg_7 svyintrg svyivreg svylc svylog_p svylogit svymarkout svymarkout_8 svymean svymlog svymlogit svynbreg svyolog svyologit svyoprob svyoprobit svyopts svypois svypois_7 svypoisson svyprobit svyprobt svyprop svyprop_7 svyratio svyreg svyreg_p svyregress svyset svyset_7 svyset_8 svytab svytab_7 svytest svytotal sw sw_8 swcnreg swcox swereg swilk swlogis swlogit swologit swoprbt swpois swprobit swqreg swtobit swweib symmetry symmi symplot symplot_7 syntax sysdescribe sysdir sysuse szroeter ta tab tab1 tab2 tab_or tabd tabdi tabdis tabdisp tabi table tabodds tabodds_7 tabstat tabu tabul tabula tabulat tabulate te tempfile tempname tempvar tes test testnl testparm teststd tetrachoric time_it timer tis tob tobi tobit tobit_p tobit_sw token tokeni tokeniz tokenize tostring total translate translator transmap treat_ll treatr_p treatreg trim trnb_cons trnb_mean trpoiss_d2 trunc_ll truncr_p truncreg tsappend tset tsfill tsline tsline_ex tsreport tsrevar tsrline tsset tssmooth tsunab ttest ttesti tut_chk tut_wait tutorial tw tware_st two twoway twoway__fpfit_serset twoway__function_gen twoway__histogram_gen twoway__ipoint_serset twoway__ipoints_serset twoway__kdensity_gen twoway__lfit_serset twoway__normgen_gen twoway__pci_serset twoway__qfit_serset twoway__scatteri_serset twoway__sunflower_gen twoway_ksm_serset ty typ type typeof u|0 unab unabbrev unabcmd update us use uselabel var var_mkcompanion var_p varbasic varfcast vargranger varirf varirf_add varirf_cgraph varirf_create varirf_ctable varirf_describe varirf_dir varirf_drop varirf_erase varirf_graph varirf_ograph varirf_rename varirf_set varirf_table varlist varlmar varnorm varsoc varstable varstable_w varstable_w2 varwle vce vec vec_fevd vec_mkphi vec_p vec_p_w vecirf_create veclmar veclmar_w vecnorm vecnorm_w vecrank vecstable verinst vers versi versio version view viewsource vif vwls wdatetof webdescribe webseek webuse weib1_lf weib2_lf weib_lf weib_lf0 weibhet_glf weibhet_glf_sh weibhet_glfa weibhet_glfa_sh weibhet_gp weibhet_ilf weibhet_ilf_sh weibhet_ilfa weibhet_ilfa_sh weibhet_ip weibu_sw weibul_p weibull weibull_c weibull_s weibullhet wh whelp whi which whil while wilc_st wilcoxon win wind windo window winexec wntestb wntestb_7 wntestq xchart xchart_7 xcorr xcorr_7 xi xi_6 xmlsav xmlsave xmluse xpose xsh xshe xshel xshell xt_iis xt_tis xtab_p xtabond xtbin_p xtclog xtcloglog xtcloglog_8 xtcloglog_d2 xtcloglog_pa_p xtcloglog_re_p xtcnt_p xtcorr xtdata xtdes xtfront_p xtfrontier xtgee xtgee_elink xtgee_estat xtgee_makeivar xtgee_p xtgee_plink xtgls xtgls_p xthaus xthausman xtht_p xthtaylor xtile xtint_p xtintreg xtintreg_8 xtintreg_d2 xtintreg_p xtivp_1 xtivp_2 xtivreg xtline xtline_ex xtlogit xtlogit_8 xtlogit_d2 xtlogit_fe_p xtlogit_pa_p xtlogit_re_p xtmixed xtmixed_estat xtmixed_p xtnb_fe xtnb_lf xtnbreg xtnbreg_pa_p xtnbreg_refe_p xtpcse xtpcse_p xtpois xtpoisson xtpoisson_d2 xtpoisson_pa_p xtpoisson_refe_p xtpred xtprobit xtprobit_8 xtprobit_d2 xtprobit_re_p xtps_fe xtps_lf xtps_ren xtps_ren_8 xtrar_p xtrc xtrc_p xtrchh xtrefe_p xtreg xtreg_be xtreg_fe xtreg_ml xtreg_pa_p xtreg_re xtregar xtrere_p xtset xtsf_ll xtsf_llti xtsum xttab xttest0 xttobit xttobit_8 xttobit_p xttrans yx yxview__barlike_draw yxview_area_draw yxview_bar_draw yxview_dot_draw yxview_dropline_draw yxview_function_draw yxview_iarrow_draw yxview_ilabels_draw yxview_normal_draw yxview_pcarrow_draw yxview_pcbarrow_draw yxview_pccapsym_draw yxview_pcscatter_draw yxview_pcspike_draw yxview_rarea_draw yxview_rbar_draw yxview_rbarm_draw yxview_rcap_draw yxview_rcapsym_draw yxview_rconnected_draw yxview_rline_draw yxview_rscatter_draw yxview_rspike_draw yxview_spike_draw yxview_sunflower_draw zap_s zinb zinb_llf zinb_plf zip zip_llf zip_p zip_plf zt_ct_5 zt_hc_5 zt_hcd_5 zt_is_5 zt_iss_5 zt_sho_5 zt_smp_5 ztbase_5 ztcox_5 ztdes_5 ztereg_5 ztfill_5 ztgen_5 ztir_5 ztjoin_5 ztnb ztnb_p ztp ztp_p zts_5 ztset_5 ztspli_5 ztsum_5 zttoct_5 ztvary_5 ztweib_5',
        contains: [
      {
        className: 'symbol',
        begin: /`[a-zA-Z0-9_]+'/
      },
      {
        className: 'variable',
        begin: /\$\{?[a-zA-Z0-9_]+\}?/
      },
      {
        className: 'string',
        variants: [
          {begin: '`"[^\r\n]*?"\''},
          {begin: '"[^\r\n"]*"'}
        ]
      },

      {
        className: 'built_in',
        variants: [
          {
            begin: '\\b(abs|acos|asin|atan|atan2|atanh|ceil|cloglog|comb|cos|digamma|exp|floor|invcloglog|invlogit|ln|lnfact|lnfactorial|lngamma|log|log10|max|min|mod|reldif|round|sign|sin|sqrt|sum|tan|tanh|trigamma|trunc|betaden|Binomial|binorm|binormal|chi2|chi2tail|dgammapda|dgammapdada|dgammapdadx|dgammapdx|dgammapdxdx|F|Fden|Ftail|gammaden|gammap|ibeta|invbinomial|invchi2|invchi2tail|invF|invFtail|invgammap|invibeta|invnchi2|invnFtail|invnibeta|invnorm|invnormal|invttail|nbetaden|nchi2|nFden|nFtail|nibeta|norm|normal|normalden|normd|npnchi2|tden|ttail|uniform|abbrev|char|index|indexnot|length|lower|ltrim|match|plural|proper|real|regexm|regexr|regexs|reverse|rtrim|string|strlen|strlower|strltrim|strmatch|strofreal|strpos|strproper|strreverse|strrtrim|strtrim|strupper|subinstr|subinword|substr|trim|upper|word|wordcount|_caller|autocode|byteorder|chop|clip|cond|e|epsdouble|epsfloat|group|inlist|inrange|irecode|matrix|maxbyte|maxdouble|maxfloat|maxint|maxlong|mi|minbyte|mindouble|minfloat|minint|minlong|missing|r|recode|replay|return|s|scalar|d|date|day|dow|doy|halfyear|mdy|month|quarter|week|year|d|daily|dofd|dofh|dofm|dofq|dofw|dofy|h|halfyearly|hofd|m|mofd|monthly|q|qofd|quarterly|tin|twithin|w|weekly|wofd|y|yearly|yh|ym|yofd|yq|yw|cholesky|colnumb|colsof|corr|det|diag|diag0cnt|el|get|hadamard|I|inv|invsym|issym|issymmetric|J|matmissing|matuniform|mreldif|nullmat|rownumb|rowsof|sweep|syminv|trace|vec|vecdiag)(?=\\(|$)'
          }
        ]
      },

      hljs.COMMENT('^[ \t]*\\*.*$', false),
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE
    ]
  };
};

var step21 = function(hljs) {
  var STEP21_IDENT_RE = '[A-Z_][A-Z0-9_.]*';
  var STEP21_KEYWORDS = {
    keyword: 'HEADER ENDSEC DATA'
  };
  var STEP21_START = {
    className: 'meta',
    begin: 'ISO-10303-21;',
    relevance: 10
  };
  var STEP21_CLOSE = {
    className: 'meta',
    begin: 'END-ISO-10303-21;',
    relevance: 10
  };

  return {
    aliases: ['p21', 'step', 'stp'],
    case_insensitive: true, // STEP 21 is case insensitive in theory, in practice all non-comments are capitalized.
    lexemes: STEP21_IDENT_RE,
    keywords: STEP21_KEYWORDS,
    contains: [
      STEP21_START,
      STEP21_CLOSE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.COMMENT('/\\*\\*!', '\\*/'),
      hljs.C_NUMBER_MODE,
      hljs.inherit(hljs.APOS_STRING_MODE, {illegal: null}),
      hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null}),
      {
        className: 'string',
        begin: "'", end: "'"
      },
      {
        className: 'symbol',
        variants: [
          {
            begin: '#', end: '\\d+',
            illegal: '\\W'
          }
        ]
      }
    ]
  };
};

var stylus = function(hljs) {

  var VARIABLE = {
    className: 'variable',
    begin: '\\$' + hljs.IDENT_RE
  };

  var HEX_COLOR = {
    className: 'number',
    begin: '#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})'
  };

  var AT_KEYWORDS = [
    'charset',
    'css',
    'debug',
    'extend',
    'font-face',
    'for',
    'import',
    'include',
    'media',
    'mixin',
    'page',
    'warn',
    'while'
  ];

  var PSEUDO_SELECTORS = [
    'after',
    'before',
    'first-letter',
    'first-line',
    'active',
    'first-child',
    'focus',
    'hover',
    'lang',
    'link',
    'visited'
  ];

  var TAGS = [
    'a',
    'abbr',
    'address',
    'article',
    'aside',
    'audio',
    'b',
    'blockquote',
    'body',
    'button',
    'canvas',
    'caption',
    'cite',
    'code',
    'dd',
    'del',
    'details',
    'dfn',
    'div',
    'dl',
    'dt',
    'em',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hgroup',
    'html',
    'i',
    'iframe',
    'img',
    'input',
    'ins',
    'kbd',
    'label',
    'legend',
    'li',
    'mark',
    'menu',
    'nav',
    'object',
    'ol',
    'p',
    'q',
    'quote',
    'samp',
    'section',
    'span',
    'strong',
    'summary',
    'sup',
    'table',
    'tbody',
    'td',
    'textarea',
    'tfoot',
    'th',
    'thead',
    'time',
    'tr',
    'ul',
    'var',
    'video'
  ];

  var TAG_END = '[\\.\\s\\n\\[\\:,]';

  var ATTRIBUTES = [
    'align-content',
    'align-items',
    'align-self',
    'animation',
    'animation-delay',
    'animation-direction',
    'animation-duration',
    'animation-fill-mode',
    'animation-iteration-count',
    'animation-name',
    'animation-play-state',
    'animation-timing-function',
    'auto',
    'backface-visibility',
    'background',
    'background-attachment',
    'background-clip',
    'background-color',
    'background-image',
    'background-origin',
    'background-position',
    'background-repeat',
    'background-size',
    'border',
    'border-bottom',
    'border-bottom-color',
    'border-bottom-left-radius',
    'border-bottom-right-radius',
    'border-bottom-style',
    'border-bottom-width',
    'border-collapse',
    'border-color',
    'border-image',
    'border-image-outset',
    'border-image-repeat',
    'border-image-slice',
    'border-image-source',
    'border-image-width',
    'border-left',
    'border-left-color',
    'border-left-style',
    'border-left-width',
    'border-radius',
    'border-right',
    'border-right-color',
    'border-right-style',
    'border-right-width',
    'border-spacing',
    'border-style',
    'border-top',
    'border-top-color',
    'border-top-left-radius',
    'border-top-right-radius',
    'border-top-style',
    'border-top-width',
    'border-width',
    'bottom',
    'box-decoration-break',
    'box-shadow',
    'box-sizing',
    'break-after',
    'break-before',
    'break-inside',
    'caption-side',
    'clear',
    'clip',
    'clip-path',
    'color',
    'column-count',
    'column-fill',
    'column-gap',
    'column-rule',
    'column-rule-color',
    'column-rule-style',
    'column-rule-width',
    'column-span',
    'column-width',
    'columns',
    'content',
    'counter-increment',
    'counter-reset',
    'cursor',
    'direction',
    'display',
    'empty-cells',
    'filter',
    'flex',
    'flex-basis',
    'flex-direction',
    'flex-flow',
    'flex-grow',
    'flex-shrink',
    'flex-wrap',
    'float',
    'font',
    'font-family',
    'font-feature-settings',
    'font-kerning',
    'font-language-override',
    'font-size',
    'font-size-adjust',
    'font-stretch',
    'font-style',
    'font-variant',
    'font-variant-ligatures',
    'font-weight',
    'height',
    'hyphens',
    'icon',
    'image-orientation',
    'image-rendering',
    'image-resolution',
    'ime-mode',
    'inherit',
    'initial',
    'justify-content',
    'left',
    'letter-spacing',
    'line-height',
    'list-style',
    'list-style-image',
    'list-style-position',
    'list-style-type',
    'margin',
    'margin-bottom',
    'margin-left',
    'margin-right',
    'margin-top',
    'marks',
    'mask',
    'max-height',
    'max-width',
    'min-height',
    'min-width',
    'nav-down',
    'nav-index',
    'nav-left',
    'nav-right',
    'nav-up',
    'none',
    'normal',
    'object-fit',
    'object-position',
    'opacity',
    'order',
    'orphans',
    'outline',
    'outline-color',
    'outline-offset',
    'outline-style',
    'outline-width',
    'overflow',
    'overflow-wrap',
    'overflow-x',
    'overflow-y',
    'padding',
    'padding-bottom',
    'padding-left',
    'padding-right',
    'padding-top',
    'page-break-after',
    'page-break-before',
    'page-break-inside',
    'perspective',
    'perspective-origin',
    'pointer-events',
    'position',
    'quotes',
    'resize',
    'right',
    'tab-size',
    'table-layout',
    'text-align',
    'text-align-last',
    'text-decoration',
    'text-decoration-color',
    'text-decoration-line',
    'text-decoration-style',
    'text-indent',
    'text-overflow',
    'text-rendering',
    'text-shadow',
    'text-transform',
    'text-underline-position',
    'top',
    'transform',
    'transform-origin',
    'transform-style',
    'transition',
    'transition-delay',
    'transition-duration',
    'transition-property',
    'transition-timing-function',
    'unicode-bidi',
    'vertical-align',
    'visibility',
    'white-space',
    'widows',
    'width',
    'word-break',
    'word-spacing',
    'word-wrap',
    'z-index'
  ];

  // illegals
  var ILLEGAL = [
    '\\?',
    '(\\bReturn\\b)', // monkey
    '(\\bEnd\\b)', // monkey
    '(\\bend\\b)', // vbscript
    '(\\bdef\\b)', // gradle
    ';', // a whole lot of languages
    '#\\s', // markdown
    '\\*\\s', // markdown
    '===\\s', // markdown
    '\\|',
    '%', // prolog
  ];

  return {
    aliases: ['styl'],
    case_insensitive: false,
    keywords: 'if else for in',
    illegal: '(' + ILLEGAL.join('|') + ')',
    contains: [

      // strings
      hljs.QUOTE_STRING_MODE,
      hljs.APOS_STRING_MODE,

      // comments
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,

      // hex colors
      HEX_COLOR,

      // class tag
      {
        begin: '\\.[a-zA-Z][a-zA-Z0-9_-]*' + TAG_END,
        returnBegin: true,
        contains: [
          {className: 'selector-class', begin: '\\.[a-zA-Z][a-zA-Z0-9_-]*'}
        ]
      },

      // id tag
      {
        begin: '\\#[a-zA-Z][a-zA-Z0-9_-]*' + TAG_END,
        returnBegin: true,
        contains: [
          {className: 'selector-id', begin: '\\#[a-zA-Z][a-zA-Z0-9_-]*'}
        ]
      },

      // tags
      {
        begin: '\\b(' + TAGS.join('|') + ')' + TAG_END,
        returnBegin: true,
        contains: [
          {className: 'selector-tag', begin: '\\b[a-zA-Z][a-zA-Z0-9_-]*'}
        ]
      },

      // psuedo selectors
      {
        begin: '&?:?:\\b(' + PSEUDO_SELECTORS.join('|') + ')' + TAG_END
      },

      // @ keywords
      {
        begin: '\@(' + AT_KEYWORDS.join('|') + ')\\b'
      },

      // variables
      VARIABLE,

      // dimension
      hljs.CSS_NUMBER_MODE,

      // number
      hljs.NUMBER_MODE,

      // functions
      //  - only from beginning of line + whitespace
      {
        className: 'function',
        begin: '^[a-zA-Z][a-zA-Z0-9_\-]*\\(.*\\)',
        illegal: '[\\n]',
        returnBegin: true,
        contains: [
          {className: 'title', begin: '\\b[a-zA-Z][a-zA-Z0-9_\-]*'},
          {
            className: 'params',
            begin: /\(/,
            end: /\)/,
            contains: [
              HEX_COLOR,
              VARIABLE,
              hljs.APOS_STRING_MODE,
              hljs.CSS_NUMBER_MODE,
              hljs.NUMBER_MODE,
              hljs.QUOTE_STRING_MODE
            ]
          }
        ]
      },

      // attributes
      //  - only from beginning of line + whitespace
      //  - must have whitespace after it
      {
        className: 'attribute',
        begin: '\\b(' + ATTRIBUTES.reverse().join('|') + ')\\b',
        starts: {
          // value container
          end: /;|$/,
          contains: [
            HEX_COLOR,
            VARIABLE,
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.CSS_NUMBER_MODE,
            hljs.NUMBER_MODE,
            hljs.C_BLOCK_COMMENT_MODE
          ],
          illegal: /\./,
          relevance: 0
        }
      }
    ]
  };
};

var subunit = function(hljs) {
  var DETAILS = {
    className: 'string',
    begin: '\\[\n(multipart)?', end: '\\]\n'
  };
  var TIME = {
    className: 'string',
    begin: '\\d{4}-\\d{2}-\\d{2}(\\s+)\\d{2}:\\d{2}:\\d{2}\.\\d+Z'
  };
  var PROGRESSVALUE = {
    className: 'string',
    begin: '(\\+|-)\\d+'
  };
  var KEYWORDS = {
    className: 'keyword',
    relevance: 10,
    variants: [
      { begin: '^(test|testing|success|successful|failure|error|skip|xfail|uxsuccess)(:?)\\s+(test)?' },
      { begin: '^progress(:?)(\\s+)?(pop|push)?' },
      { begin: '^tags:' },
      { begin: '^time:' }
    ],
  };
  return {
    case_insensitive: true,
    contains: [
      DETAILS,
      TIME,
      PROGRESSVALUE,
      KEYWORDS
    ]
  };
};

var swift = function(hljs) {
  var SWIFT_KEYWORDS = {
      keyword: '#available #colorLiteral #column #else #elseif #endif #file ' +
        '#fileLiteral #function #if #imageLiteral #line #selector #sourceLocation ' +
        '_ __COLUMN__ __FILE__ __FUNCTION__ __LINE__ Any as as! as? associatedtype ' +
        'associativity break case catch class continue convenience default defer deinit didSet do ' +
        'dynamic dynamicType else enum extension fallthrough false fileprivate final for func ' +
        'get guard if import in indirect infix init inout internal is lazy left let ' +
        'mutating nil none nonmutating open operator optional override postfix precedence ' +
        'prefix private protocol Protocol public repeat required rethrows return ' +
        'right self Self set static struct subscript super switch throw throws true ' +
        'try try! try? Type typealias unowned var weak where while willSet',
      literal: 'true false nil',
      built_in: 'abs advance alignof alignofValue anyGenerator assert assertionFailure ' +
        'bridgeFromObjectiveC bridgeFromObjectiveCUnconditional bridgeToObjectiveC ' +
        'bridgeToObjectiveCUnconditional c contains count countElements countLeadingZeros ' +
        'debugPrint debugPrintln distance dropFirst dropLast dump encodeBitsAsWords ' +
        'enumerate equal fatalError filter find getBridgedObjectiveCType getVaList ' +
        'indices insertionSort isBridgedToObjectiveC isBridgedVerbatimToObjectiveC ' +
        'isUniquelyReferenced isUniquelyReferencedNonObjC join lazy lexicographicalCompare ' +
        'map max maxElement min minElement numericCast overlaps partition posix ' +
        'precondition preconditionFailure print println quickSort readLine reduce reflect ' +
        'reinterpretCast reverse roundUpToAlignment sizeof sizeofValue sort split ' +
        'startsWith stride strideof strideofValue swap toString transcode ' +
        'underestimateCount unsafeAddressOf unsafeBitCast unsafeDowncast unsafeUnwrap ' +
        'unsafeReflect withExtendedLifetime withObjectAtPlusZero withUnsafePointer ' +
        'withUnsafePointerToObject withUnsafeMutablePointer withUnsafeMutablePointers ' +
        'withUnsafePointer withUnsafePointers withVaList zip'
    };

  var TYPE = {
    className: 'type',
    begin: '\\b[A-Z][\\w\u00C0-\u02B8\']*',
    relevance: 0
  };
  // slightly more special to swift
  var OPTIONAL_USING_TYPE = {
    className: 'type',
    begin: '\\b[A-Z][\\w\u00C0-\u02B8\']*[!?]'
  };
  var BLOCK_COMMENT = hljs.COMMENT(
    '/\\*',
    '\\*/',
    {
      contains: ['self']
    }
  );
  var SUBST = {
    className: 'subst',
    begin: /\\\(/, end: '\\)',
    keywords: SWIFT_KEYWORDS,
    contains: [] // assigned later
  };
  var STRING = {
    className: 'string',
    contains: [hljs.BACKSLASH_ESCAPE, SUBST],
    variants: [
      {begin: /"""/, end: /"""/},
      {begin: /"/, end: /"/},
    ]
  };
  var NUMBERS = {
      className: 'number',
      begin: '\\b([\\d_]+(\\.[\\deE_]+)?|0x[a-fA-F0-9_]+(\\.[a-fA-F0-9p_]+)?|0b[01_]+|0o[0-7_]+)\\b',
      relevance: 0
  };
  SUBST.contains = [NUMBERS];

  return {
    keywords: SWIFT_KEYWORDS,
    contains: [
      STRING,
      hljs.C_LINE_COMMENT_MODE,
      BLOCK_COMMENT,
      OPTIONAL_USING_TYPE,
      TYPE,
      NUMBERS,
      {
        className: 'function',
        beginKeywords: 'func', end: '{', excludeEnd: true,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {
            begin: /[A-Za-z$_][0-9A-Za-z$_]*/
          }),
          {
            begin: /</, end: />/
          },
          {
            className: 'params',
            begin: /\(/, end: /\)/, endsParent: true,
            keywords: SWIFT_KEYWORDS,
            contains: [
              'self',
              NUMBERS,
              STRING,
              hljs.C_BLOCK_COMMENT_MODE,
              {begin: ':'} // relevance booster
            ],
            illegal: /["']/
          }
        ],
        illegal: /\[|%/
      },
      {
        className: 'class',
        beginKeywords: 'struct protocol class extension enum',
        keywords: SWIFT_KEYWORDS,
        end: '\\{',
        excludeEnd: true,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {begin: /[A-Za-z$_][\u00C0-\u02B80-9A-Za-z$_]*/})
        ]
      },
      {
        className: 'meta', // @attributes
        begin: '(@discardableResult|@warn_unused_result|@exported|@lazy|@noescape|' +
                  '@NSCopying|@NSManaged|@objc|@objcMembers|@convention|@required|' +
                  '@noreturn|@IBAction|@IBDesignable|@IBInspectable|@IBOutlet|' +
                  '@infix|@prefix|@postfix|@autoclosure|@testable|@available|' +
                  '@nonobjc|@NSApplicationMain|@UIApplicationMain)'

      },
      {
        beginKeywords: 'import', end: /$/,
        contains: [hljs.C_LINE_COMMENT_MODE, BLOCK_COMMENT]
      }
    ]
  };
};

var taggerscript = function(hljs) {

  var COMMENT = {
    className: 'comment',
    begin: /\$noop\(/,
    end: /\)/,
    contains: [{
      begin: /\(/,
      end: /\)/,
      contains: ['self', {
        begin: /\\./
      }]
    }],
    relevance: 10
  };

  var FUNCTION = {
    className: 'keyword',
    begin: /\$(?!noop)[a-zA-Z][_a-zA-Z0-9]*/,
    end: /\(/,
    excludeEnd: true
  };

  var VARIABLE = {
    className: 'variable',
    begin: /%[_a-zA-Z0-9:]*/,
    end: '%'
  };

  var ESCAPE_SEQUENCE = {
    className: 'symbol',
    begin: /\\./
  };

  return {
    contains: [
      COMMENT,
      FUNCTION,
      VARIABLE,
      ESCAPE_SEQUENCE
    ]
  };
};

var yaml = function(hljs) {
  var LITERALS = 'true false yes no null';

  var keyPrefix = '^[ \\-]*';
  var keyName =  '[a-zA-Z_][\\w\\-]*';
  var KEY = {
    className: 'attr',
    variants: [
      { begin: keyPrefix + keyName + ":"},
      { begin: keyPrefix + '"' + keyName + '"' + ":"},
      { begin: keyPrefix + "'" + keyName + "'" + ":"}
    ]
  };

  var TEMPLATE_VARIABLES = {
    className: 'template-variable',
    variants: [
      { begin: '\{\{', end: '\}\}' }, // jinja templates Ansible
      { begin: '%\{', end: '\}' } // Ruby i18n
    ]
  };
  var STRING = {
    className: 'string',
    relevance: 0,
    variants: [
      {begin: /'/, end: /'/},
      {begin: /"/, end: /"/},
      {begin: /\S+/}
    ],
    contains: [
      hljs.BACKSLASH_ESCAPE,
      TEMPLATE_VARIABLES
    ]
  };

  return {
    case_insensitive: true,
    aliases: ['yml', 'YAML', 'yaml'],
    contains: [
      KEY,
      {
        className: 'meta',
        begin: '^---\s*$',
        relevance: 10
      },
      { // multi line string
        className: 'string',
        begin: '[\\|>] *$',
        returnEnd: true,
        contains: STRING.contains,
        // very simple termination: next hash key
        end: KEY.variants[0].begin
      },
      { // Ruby/Rails erb
        begin: '<%[%=-]?', end: '[%-]?%>',
        subLanguage: 'ruby',
        excludeBegin: true,
        excludeEnd: true,
        relevance: 0
      },
      { // local tags
        className: 'type',
        begin: '!' + hljs.UNDERSCORE_IDENT_RE,
      },
      { // data type
        className: 'type',
        begin: '!!' + hljs.UNDERSCORE_IDENT_RE,
      },
      { // fragment id &ref
        className: 'meta',
        begin: '&' + hljs.UNDERSCORE_IDENT_RE + '$',
      },
      { // fragment reference *ref
        className: 'meta',
        begin: '\\*' + hljs.UNDERSCORE_IDENT_RE + '$'
      },
      { // array listing
        className: 'bullet',
        begin: '^ *-',
        relevance: 0
      },
      hljs.HASH_COMMENT_MODE,
      {
        beginKeywords: LITERALS,
        keywords: {literal: LITERALS}
      },
      hljs.C_NUMBER_MODE,
      STRING
    ]
  };
};

var tap = function(hljs) {
  return {
    case_insensitive: true,
    contains: [
      hljs.HASH_COMMENT_MODE,
      // version of format and total amount of testcases
      {
        className: 'meta',
        variants: [
          { begin: '^TAP version (\\d+)$' },
          { begin: '^1\\.\\.(\\d+)$' }
        ],
      },
      // YAML block
      {
        begin: '(\s+)?---$', end: '\\.\\.\\.$',
        subLanguage: 'yaml',
        relevance: 0
      },
	  // testcase number
      {
        className: 'number',
        begin: ' (\\d+) '
      },
	  // testcase status and description
      {
        className: 'symbol',
        variants: [
          { begin: '^ok' },
          { begin: '^not ok' }
        ],
      },
    ]
  };
};

var tcl = function(hljs) {
  return {
    aliases: ['tk'],
    keywords: 'after append apply array auto_execok auto_import auto_load auto_mkindex ' +
      'auto_mkindex_old auto_qualify auto_reset bgerror binary break catch cd chan clock ' +
      'close concat continue dde dict encoding eof error eval exec exit expr fblocked ' +
      'fconfigure fcopy file fileevent filename flush for foreach format gets glob global ' +
      'history http if incr info interp join lappend|10 lassign|10 lindex|10 linsert|10 list ' +
      'llength|10 load lrange|10 lrepeat|10 lreplace|10 lreverse|10 lsearch|10 lset|10 lsort|10 '+
      'mathfunc mathop memory msgcat namespace open package parray pid pkg::create pkg_mkIndex '+
      'platform platform::shell proc puts pwd read refchan regexp registry regsub|10 rename '+
      'return safe scan seek set socket source split string subst switch tcl_endOfWord '+
      'tcl_findLibrary tcl_startOfNextWord tcl_startOfPreviousWord tcl_wordBreakAfter '+
      'tcl_wordBreakBefore tcltest tclvars tell time tm trace unknown unload unset update '+
      'uplevel upvar variable vwait while',
    contains: [
      hljs.COMMENT(';[ \\t]*#', '$'),
      hljs.COMMENT('^[ \\t]*#', '$'),
      {
        beginKeywords: 'proc',
        end: '[\\{]',
        excludeEnd: true,
        contains: [
          {
            className: 'title',
            begin: '[ \\t\\n\\r]+(::)?[a-zA-Z_]((::)?[a-zA-Z0-9_])*',
            end: '[ \\t\\n\\r]',
            endsWithParent: true,
            excludeEnd: true
          }
        ]
      },
      {
        excludeEnd: true,
        variants: [
          {
            begin: '\\$(\\{)?(::)?[a-zA-Z_]((::)?[a-zA-Z0-9_])*\\(([a-zA-Z0-9_])*\\)',
            end: '[^a-zA-Z0-9_\\}\\$]'
          },
          {
            begin: '\\$(\\{)?(::)?[a-zA-Z_]((::)?[a-zA-Z0-9_])*',
            end: '(\\))?[^a-zA-Z0-9_\\}\\$]'
          }
        ]
      },
      {
        className: 'string',
        contains: [hljs.BACKSLASH_ESCAPE],
        variants: [
          hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null})
        ]
      },
      {
        className: 'number',
        variants: [hljs.BINARY_NUMBER_MODE, hljs.C_NUMBER_MODE]
      }
    ]
  }
};

var tex = function(hljs) {
  var COMMAND = {
    className: 'tag',
    begin: /\\/,
    relevance: 0,
    contains: [
      {
        className: 'name',
        variants: [
          {begin: /[a-zA-Z\u0430-\u044f\u0410-\u042f]+[*]?/},
          {begin: /[^a-zA-Z\u0430-\u044f\u0410-\u042f0-9]/}
        ],
        starts: {
          endsWithParent: true,
          relevance: 0,
          contains: [
            {
              className: 'string', // because it looks like attributes in HTML tags
              variants: [
                {begin: /\[/, end: /\]/},
                {begin: /\{/, end: /\}/}
              ]
            },
            {
              begin: /\s*=\s*/, endsWithParent: true,
              relevance: 0,
              contains: [
                {
                  className: 'number',
                  begin: /-?\d*\.?\d+(pt|pc|mm|cm|in|dd|cc|ex|em)?/
                }
              ]
            }
          ]
        }
      }
    ]
  };

  return {
    contains: [
      COMMAND,
      {
        className: 'formula',
        contains: [COMMAND],
        relevance: 0,
        variants: [
          {begin: /\$\$/, end: /\$\$/},
          {begin: /\$/, end: /\$/}
        ]
      },
      hljs.COMMENT(
        '%',
        '$',
        {
          relevance: 0
        }
      )
    ]
  };
};

var thrift = function(hljs) {
  var BUILT_IN_TYPES = 'bool byte i16 i32 i64 double string binary';
  return {
    keywords: {
      keyword:
        'namespace const typedef struct enum service exception void oneway set list map required optional',
      built_in:
        BUILT_IN_TYPES,
      literal:
        'true false'
    },
    contains: [
      hljs.QUOTE_STRING_MODE,
      hljs.NUMBER_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: 'class',
        beginKeywords: 'struct enum service exception', end: /\{/,
        illegal: /\n/,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {
            starts: {endsWithParent: true, excludeEnd: true} // hack: eating everything after the first title
          })
        ]
      },
      {
        begin: '\\b(set|list|map)\\s*<', end: '>',
        keywords: BUILT_IN_TYPES,
        contains: ['self']
      }
    ]
  };
};

var tp = function(hljs) {
  var TPID = {
    className: 'number',
    begin: '[1-9][0-9]*', /* no leading zeros */
    relevance: 0
  };
  var TPLABEL = {
    className: 'symbol',
    begin: ':[^\\]]+'
  };
  var TPDATA = {
    className: 'built_in',
    begin: '(AR|P|PAYLOAD|PR|R|SR|RSR|LBL|VR|UALM|MESSAGE|UTOOL|UFRAME|TIMER|' +
    'TIMER_OVERFLOW|JOINT_MAX_SPEED|RESUME_PROG|DIAG_REC)\\[', end: '\\]',
    contains: [
      'self',
      TPID,
      TPLABEL
    ]
  };
  var TPIO = {
    className: 'built_in',
    begin: '(AI|AO|DI|DO|F|RI|RO|UI|UO|GI|GO|SI|SO)\\[', end: '\\]',
    contains: [
      'self',
      TPID,
      hljs.QUOTE_STRING_MODE, /* for pos section at bottom */
      TPLABEL
    ]
  };

  return {
    keywords: {
      keyword:
        'ABORT ACC ADJUST AND AP_LD BREAK CALL CNT COL CONDITION CONFIG DA DB ' +
        'DIV DETECT ELSE END ENDFOR ERR_NUM ERROR_PROG FINE FOR GP GUARD INC ' +
        'IF JMP LINEAR_MAX_SPEED LOCK MOD MONITOR OFFSET Offset OR OVERRIDE ' +
        'PAUSE PREG PTH RT_LD RUN SELECT SKIP Skip TA TB TO TOOL_OFFSET ' +
        'Tool_Offset UF UT UFRAME_NUM UTOOL_NUM UNLOCK WAIT X Y Z W P R STRLEN ' +
        'SUBSTR FINDSTR VOFFSET PROG ATTR MN POS',
      literal:
        'ON OFF max_speed LPOS JPOS ENABLE DISABLE START STOP RESET'
    },
    contains: [
      TPDATA,
      TPIO,
      {
        className: 'keyword',
        begin: '/(PROG|ATTR|MN|POS|END)\\b'
      },
      {
        /* this is for cases like ,CALL */
        className: 'keyword',
        begin: '(CALL|RUN|POINT_LOGIC|LBL)\\b'
      },
      {
        /* this is for cases like CNT100 where the default lexemes do not
         * separate the keyword and the number */
        className: 'keyword',
        begin: '\\b(ACC|CNT|Skip|Offset|PSPD|RT_LD|AP_LD|Tool_Offset)'
      },
      {
        /* to catch numbers that do not have a word boundary on the left */
        className: 'number',
        begin: '\\d+(sec|msec|mm/sec|cm/min|inch/min|deg/sec|mm|in|cm)?\\b',
        relevance: 0
      },
      hljs.COMMENT('//', '[;$]'),
      hljs.COMMENT('!', '[;$]'),
      hljs.COMMENT('--eg:', '$'),
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        begin: '\'', end: '\''
      },
      hljs.C_NUMBER_MODE,
      {
        className: 'variable',
        begin: '\\$[A-Za-z0-9_]+'
      }
    ]
  };
};

var twig = function(hljs) {
  var PARAMS = {
    className: 'params',
    begin: '\\(', end: '\\)'
  };

  var FUNCTION_NAMES = 'attribute block constant cycle date dump include ' +
                  'max min parent random range source template_from_string';

  var FUNCTIONS = {
    beginKeywords: FUNCTION_NAMES,
    keywords: {name: FUNCTION_NAMES},
    relevance: 0,
    contains: [
      PARAMS
    ]
  };

  var FILTER = {
    begin: /\|[A-Za-z_]+:?/,
    keywords:
      'abs batch capitalize convert_encoding date date_modify default ' +
      'escape first format join json_encode keys last length lower ' +
      'merge nl2br number_format raw replace reverse round slice sort split ' +
      'striptags title trim upper url_encode',
    contains: [
      FUNCTIONS
    ]
  };

  var TAGS = 'autoescape block do embed extends filter flush for ' +
    'if import include macro sandbox set spaceless use verbatim';

  TAGS = TAGS + ' ' + TAGS.split(' ').map(function(t){return 'end' + t}).join(' ');

  return {
    aliases: ['craftcms'],
    case_insensitive: true,
    subLanguage: 'xml',
    contains: [
      hljs.COMMENT(/\{#/, /#}/),
      {
        className: 'template-tag',
        begin: /\{%/, end: /%}/,
        contains: [
          {
            className: 'name',
            begin: /\w+/,
            keywords: TAGS,
            starts: {
              endsWithParent: true,
              contains: [FILTER, FUNCTIONS],
              relevance: 0
            }
          }
        ]
      },
      {
        className: 'template-variable',
        begin: /\{\{/, end: /}}/,
        contains: ['self', FILTER, FUNCTIONS]
      }
    ]
  };
};

var typescript = function(hljs) {
  var JS_IDENT_RE = '[A-Za-z$_][0-9A-Za-z$_]*';
  var KEYWORDS = {
    keyword:
      'in if for while finally var new function do return void else break catch ' +
      'instanceof with throw case default try this switch continue typeof delete ' +
      'let yield const class public private protected get set super ' +
      'static implements enum export import declare type namespace abstract ' +
      'as from extends async await',
    literal:
      'true false null undefined NaN Infinity',
    built_in:
      'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent ' +
      'encodeURI encodeURIComponent escape unescape Object Function Boolean Error ' +
      'EvalError InternalError RangeError ReferenceError StopIteration SyntaxError ' +
      'TypeError URIError Number Math Date String RegExp Array Float32Array ' +
      'Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array ' +
      'Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require ' +
      'module console window document any number boolean string void Promise'
  };

  var DECORATOR = {
    className: 'meta',
    begin: '@' + JS_IDENT_RE,
  };

  var ARGS =
  {
    begin: '\\(',
    end: /\)/,
    keywords: KEYWORDS,
    contains: [
      'self',
      hljs.QUOTE_STRING_MODE,
      hljs.APOS_STRING_MODE,
      hljs.NUMBER_MODE
    ]
  };

  var PARAMS = {
    className: 'params',
    begin: /\(/, end: /\)/,
    excludeBegin: true,
    excludeEnd: true,
    keywords: KEYWORDS,
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      DECORATOR,
      ARGS
    ]
  };

  return {
    aliases: ['ts'],
    keywords: KEYWORDS,
    contains: [
      {
        className: 'meta',
        begin: /^\s*['"]use strict['"]/
      },
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      { // template string
        className: 'string',
        begin: '`', end: '`',
        contains: [
          hljs.BACKSLASH_ESCAPE,
          {
            className: 'subst',
            begin: '\\$\\{', end: '\\}'
          }
        ]
      },
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: 'number',
        variants: [
          { begin: '\\b(0[bB][01]+)' },
          { begin: '\\b(0[oO][0-7]+)' },
          { begin: hljs.C_NUMBER_RE }
        ],
        relevance: 0
      },
      { // "value" container
        begin: '(' + hljs.RE_STARTERS_RE + '|\\b(case|return|throw)\\b)\\s*',
        keywords: 'return throw case',
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.REGEXP_MODE,
          {
            className: 'function',
            begin: '(\\(.*?\\)|' + hljs.IDENT_RE + ')\\s*=>', returnBegin: true,
            end: '\\s*=>',
            contains: [
              {
                className: 'params',
                variants: [
                  {
                    begin: hljs.IDENT_RE
                  },
                  {
                    begin: /\(\s*\)/,
                  },
                  {
                    begin: /\(/, end: /\)/,
                    excludeBegin: true, excludeEnd: true,
                    keywords: KEYWORDS,
                    contains: [
                      'self',
                      hljs.C_LINE_COMMENT_MODE,
                      hljs.C_BLOCK_COMMENT_MODE
                    ]
                  }
                ]
              }
            ]
          }
        ],
        relevance: 0
      },
      {
        className: 'function',
        begin: 'function', end: /[\{;]/, excludeEnd: true,
        keywords: KEYWORDS,
        contains: [
          'self',
          hljs.inherit(hljs.TITLE_MODE, { begin: JS_IDENT_RE }),
          PARAMS
        ],
        illegal: /%/,
        relevance: 0 // () => {} is more typical in TypeScript
      },
      {
        beginKeywords: 'constructor', end: /\{/, excludeEnd: true,
        contains: [
          'self',
          PARAMS
        ]
      },
      { // prevent references like module.id from being higlighted as module definitions
        begin: /module\./,
        keywords: { built_in: 'module' },
        relevance: 0
      },
      {
        beginKeywords: 'module', end: /\{/, excludeEnd: true
      },
      {
        beginKeywords: 'interface', end: /\{/, excludeEnd: true,
        keywords: 'interface extends'
      },
      {
        begin: /\$[(.]/ // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
      },
      {
        begin: '\\.' + hljs.IDENT_RE, relevance: 0 // hack: prevents detection of keywords after dots
      },
      DECORATOR,
      ARGS
    ]
  };
};

var vala = function(hljs) {
  return {
    keywords: {
      keyword:
        // Value types
        'char uchar unichar int uint long ulong short ushort int8 int16 int32 int64 uint8 ' +
        'uint16 uint32 uint64 float double bool struct enum string void ' +
        // Reference types
        'weak unowned owned ' +
        // Modifiers
        'async signal static abstract interface override virtual delegate ' +
        // Control Structures
        'if while do for foreach else switch case break default return try catch ' +
        // Visibility
        'public private protected internal ' +
        // Other
        'using new this get set const stdout stdin stderr var',
      built_in:
        'DBus GLib CCode Gee Object Gtk Posix',
      literal:
        'false true null'
    },
    contains: [
      {
        className: 'class',
        beginKeywords: 'class interface namespace', end: '{', excludeEnd: true,
        illegal: '[^,:\\n\\s\\.]',
        contains: [
          hljs.UNDERSCORE_TITLE_MODE
        ]
      },
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: 'string',
        begin: '"""', end: '"""',
        relevance: 5
      },
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.C_NUMBER_MODE,
      {
        className: 'meta',
        begin: '^#', end: '$',
        relevance: 2
      }
    ]
  };
};

var vbnet = function(hljs) {
  return {
    aliases: ['vb'],
    case_insensitive: true,
    keywords: {
      keyword:
        'addhandler addressof alias and andalso aggregate ansi as assembly auto binary by byref byval ' + /* a-b */
        'call case catch class compare const continue custom declare default delegate dim distinct do ' + /* c-d */
        'each equals else elseif end enum erase error event exit explicit finally for friend from function ' + /* e-f */
        'get global goto group handles if implements imports in inherits interface into is isfalse isnot istrue ' + /* g-i */
        'join key let lib like loop me mid mod module mustinherit mustoverride mybase myclass ' + /* j-m */
        'namespace narrowing new next not notinheritable notoverridable ' + /* n */
        'of off on operator option optional or order orelse overloads overridable overrides ' + /* o */
        'paramarray partial preserve private property protected public ' + /* p */
        'raiseevent readonly redim rem removehandler resume return ' + /* r */
        'select set shadows shared skip static step stop structure strict sub synclock ' + /* s */
        'take text then throw to try unicode until using when where while widening with withevents writeonly xor', /* t-x */
      built_in:
        'boolean byte cbool cbyte cchar cdate cdec cdbl char cint clng cobj csbyte cshort csng cstr ctype ' +  /* b-c */
        'date decimal directcast double gettype getxmlnamespace iif integer long object ' + /* d-o */
        'sbyte short single string trycast typeof uinteger ulong ushort', /* s-u */
      literal:
        'true false nothing'
    },
    illegal: '//|{|}|endif|gosub|variant|wend|^\\$ ', /* reserved deprecated keywords */
    contains: [
      hljs.inherit(hljs.QUOTE_STRING_MODE, {contains: [{begin: '""'}]}),
      hljs.COMMENT(
        '\'',
        '$',
        {
          returnBegin: true,
          contains: [
            {
              className: 'doctag',
              begin: '\'\'\'|<!--|-->',
              contains: [hljs.PHRASAL_WORDS_MODE]
            },
            {
              className: 'doctag',
              begin: '</?', end: '>',
              contains: [hljs.PHRASAL_WORDS_MODE]
            }
          ]
        }
      ),
      hljs.C_NUMBER_MODE,
      {
        className: 'meta',
        begin: '#', end: '$',
        keywords: {'meta-keyword': 'if else elseif end region externalsource'}
      }
    ]
  };
};

var vbscript = function(hljs) {
  return {
    aliases: ['vbs'],
    case_insensitive: true,
    keywords: {
      keyword:
        'call class const dim do loop erase execute executeglobal exit for each next function ' +
        'if then else on error option explicit new private property let get public randomize ' +
        'redim rem select case set stop sub while wend with end to elseif is or xor and not ' +
        'class_initialize class_terminate default preserve in me byval byref step resume goto',
      built_in:
        'lcase month vartype instrrev ubound setlocale getobject rgb getref string ' +
        'weekdayname rnd dateadd monthname now day minute isarray cbool round formatcurrency ' +
        'conversions csng timevalue second year space abs clng timeserial fixs len asc ' +
        'isempty maths dateserial atn timer isobject filter weekday datevalue ccur isdate ' +
        'instr datediff formatdatetime replace isnull right sgn array snumeric log cdbl hex ' +
        'chr lbound msgbox ucase getlocale cos cdate cbyte rtrim join hour oct typename trim ' +
        'strcomp int createobject loadpicture tan formatnumber mid scriptenginebuildversion ' +
        'scriptengine split scriptengineminorversion cint sin datepart ltrim sqr ' +
        'scriptenginemajorversion time derived eval date formatpercent exp inputbox left ascw ' +
        'chrw regexp server response request cstr err',
      literal:
        'true false null nothing empty'
    },
    illegal: '//',
    contains: [
      hljs.inherit(hljs.QUOTE_STRING_MODE, {contains: [{begin: '""'}]}),
      hljs.COMMENT(
        /'/,
        /$/,
        {
          relevance: 0
        }
      ),
      hljs.C_NUMBER_MODE
    ]
  };
};

var vbscriptHtml = function(hljs) {
  return {
    subLanguage: 'xml',
    contains: [
      {
        begin: '<%', end: '%>',
        subLanguage: 'vbscript'
      }
    ]
  };
};

var verilog = function(hljs) {
  var SV_KEYWORDS = {
    keyword:
      'accept_on alias always always_comb always_ff always_latch and assert assign ' +
      'assume automatic before begin bind bins binsof bit break buf|0 bufif0 bufif1 ' +
      'byte case casex casez cell chandle checker class clocking cmos config const ' +
      'constraint context continue cover covergroup coverpoint cross deassign default ' +
      'defparam design disable dist do edge else end endcase endchecker endclass ' +
      'endclocking endconfig endfunction endgenerate endgroup endinterface endmodule ' +
      'endpackage endprimitive endprogram endproperty endspecify endsequence endtable ' +
      'endtask enum event eventually expect export extends extern final first_match for ' +
      'force foreach forever fork forkjoin function generate|5 genvar global highz0 highz1 ' +
      'if iff ifnone ignore_bins illegal_bins implements implies import incdir include ' +
      'initial inout input inside instance int integer interconnect interface intersect ' +
      'join join_any join_none large let liblist library local localparam logic longint ' +
      'macromodule matches medium modport module nand negedge nettype new nexttime nmos ' +
      'nor noshowcancelled not notif0 notif1 or output package packed parameter pmos ' +
      'posedge primitive priority program property protected pull0 pull1 pulldown pullup ' +
      'pulsestyle_ondetect pulsestyle_onevent pure rand randc randcase randsequence rcmos ' +
      'real realtime ref reg reject_on release repeat restrict return rnmos rpmos rtran ' +
      'rtranif0 rtranif1 s_always s_eventually s_nexttime s_until s_until_with scalared ' +
      'sequence shortint shortreal showcancelled signed small soft solve specify specparam ' +
      'static string strong strong0 strong1 struct super supply0 supply1 sync_accept_on ' +
      'sync_reject_on table tagged task this throughout time timeprecision timeunit tran ' +
      'tranif0 tranif1 tri tri0 tri1 triand trior trireg type typedef union unique unique0 ' +
      'unsigned until until_with untyped use uwire var vectored virtual void wait wait_order ' +
      'wand weak weak0 weak1 while wildcard wire with within wor xnor xor',
    literal:
      'null',
    built_in:
      '$finish $stop $exit $fatal $error $warning $info $realtime $time $printtimescale ' +
      '$bitstoreal $bitstoshortreal $itor $signed $cast $bits $stime $timeformat ' +
      '$realtobits $shortrealtobits $rtoi $unsigned $asserton $assertkill $assertpasson ' +
      '$assertfailon $assertnonvacuouson $assertoff $assertcontrol $assertpassoff ' +
      '$assertfailoff $assertvacuousoff $isunbounded $sampled $fell $changed $past_gclk ' +
      '$fell_gclk $changed_gclk $rising_gclk $steady_gclk $coverage_control ' +
      '$coverage_get $coverage_save $set_coverage_db_name $rose $stable $past ' +
      '$rose_gclk $stable_gclk $future_gclk $falling_gclk $changing_gclk $display ' +
      '$coverage_get_max $coverage_merge $get_coverage $load_coverage_db $typename ' +
      '$unpacked_dimensions $left $low $increment $clog2 $ln $log10 $exp $sqrt $pow ' +
      '$floor $ceil $sin $cos $tan $countbits $onehot $isunknown $fatal $warning ' +
      '$dimensions $right $high $size $asin $acos $atan $atan2 $hypot $sinh $cosh ' +
      '$tanh $asinh $acosh $atanh $countones $onehot0 $error $info $random ' +
      '$dist_chi_square $dist_erlang $dist_exponential $dist_normal $dist_poisson ' +
      '$dist_t $dist_uniform $q_initialize $q_remove $q_exam $async$and$array ' +
      '$async$nand$array $async$or$array $async$nor$array $sync$and$array ' +
      '$sync$nand$array $sync$or$array $sync$nor$array $q_add $q_full $psprintf ' +
      '$async$and$plane $async$nand$plane $async$or$plane $async$nor$plane ' +
      '$sync$and$plane $sync$nand$plane $sync$or$plane $sync$nor$plane $system ' +
      '$display $displayb $displayh $displayo $strobe $strobeb $strobeh $strobeo ' +
      '$write $readmemb $readmemh $writememh $value$plusargs ' +
      '$dumpvars $dumpon $dumplimit $dumpports $dumpportson $dumpportslimit ' +
      '$writeb $writeh $writeo $monitor $monitorb $monitorh $monitoro $writememb ' +
      '$dumpfile $dumpoff $dumpall $dumpflush $dumpportsoff $dumpportsall ' +
      '$dumpportsflush $fclose $fdisplay $fdisplayb $fdisplayh $fdisplayo ' +
      '$fstrobe $fstrobeb $fstrobeh $fstrobeo $swrite $swriteb $swriteh ' +
      '$swriteo $fscanf $fread $fseek $fflush $feof $fopen $fwrite $fwriteb ' +
      '$fwriteh $fwriteo $fmonitor $fmonitorb $fmonitorh $fmonitoro $sformat ' +
      '$sformatf $fgetc $ungetc $fgets $sscanf $rewind $ftell $ferror'
    };
  return {
    aliases: ['v', 'sv', 'svh'],
    case_insensitive: false,
    keywords: SV_KEYWORDS, lexemes: /[\w\$]+/,
    contains: [
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      {
        className: 'number',
        contains: [hljs.BACKSLASH_ESCAPE],
        variants: [
          {begin: '\\b((\\d+\'(b|h|o|d|B|H|O|D))[0-9xzXZa-fA-F_]+)'},
          {begin: '\\B((\'(b|h|o|d|B|H|O|D))[0-9xzXZa-fA-F_]+)'},
          {begin: '\\b([0-9_])+', relevance: 0}
        ]
      },
      /* parameters to instances */
      {
        className: 'variable',
        variants: [
          {begin: '#\\((?!parameter).+\\)'},
          {begin: '\\.\\w+', relevance: 0},
        ]
      },
      {
        className: 'meta',
        begin: '`', end: '$',
        keywords: {'meta-keyword': 'define __FILE__ ' +
          '__LINE__ begin_keywords celldefine default_nettype define ' +
          'else elsif end_keywords endcelldefine endif ifdef ifndef ' +
          'include line nounconnected_drive pragma resetall timescale ' +
          'unconnected_drive undef undefineall'},
        relevance: 0
      }
    ]
  }; // return
};

var vhdl = function(hljs) {
  // Regular expression for VHDL numeric literals.

  // Decimal literal:
  var INTEGER_RE = '\\d(_|\\d)*';
  var EXPONENT_RE = '[eE][-+]?' + INTEGER_RE;
  var DECIMAL_LITERAL_RE = INTEGER_RE + '(\\.' + INTEGER_RE + ')?' + '(' + EXPONENT_RE + ')?';
  // Based literal:
  var BASED_INTEGER_RE = '\\w+';
  var BASED_LITERAL_RE = INTEGER_RE + '#' + BASED_INTEGER_RE + '(\\.' + BASED_INTEGER_RE + ')?' + '#' + '(' + EXPONENT_RE + ')?';

  var NUMBER_RE = '\\b(' + BASED_LITERAL_RE + '|' + DECIMAL_LITERAL_RE + ')';

  return {
    case_insensitive: true,
    keywords: {
      keyword:
        'abs access after alias all and architecture array assert assume assume_guarantee attribute ' +
        'begin block body buffer bus case component configuration constant context cover disconnect ' +
        'downto default else elsif end entity exit fairness file for force function generate ' +
        'generic group guarded if impure in inertial inout is label library linkage literal ' +
        'loop map mod nand new next nor not null of on open or others out package parameter port ' +
        'postponed procedure process property protected pure range record register reject ' +
        'release rem report restrict restrict_guarantee return rol ror select sequence ' +
        'severity shared signal sla sll sra srl strong subtype then to transport type ' +
        'unaffected units until use variable view vmode vprop vunit wait when while with xnor xor',
      built_in:
        'boolean bit character ' +
        'integer time delay_length natural positive ' +
        'string bit_vector file_open_kind file_open_status ' +
        'std_logic std_logic_vector unsigned signed boolean_vector integer_vector ' +
        'std_ulogic std_ulogic_vector unresolved_unsigned u_unsigned unresolved_signed u_signed ' +
        'real_vector time_vector',
      literal:
        'false true note warning error failure ' +  // severity_level
        'line text side width'                      // textio
    },
    illegal: '{',
    contains: [
      hljs.C_BLOCK_COMMENT_MODE,      // VHDL-2008 block commenting.
      hljs.COMMENT('--', '$'),
      hljs.QUOTE_STRING_MODE,
      {
        className: 'number',
        begin: NUMBER_RE,
        relevance: 0
      },
      {
        className: 'string',
        begin: '\'(U|X|0|1|Z|W|L|H|-)\'',
        contains: [hljs.BACKSLASH_ESCAPE]
      },
      {
        className: 'symbol',
        begin: '\'[A-Za-z](_?[A-Za-z0-9])*',
        contains: [hljs.BACKSLASH_ESCAPE]
      }
    ]
  };
};

var vim = function(hljs) {
  return {
    lexemes: /[!#@\w]+/,
    keywords: {
      keyword:
        // express version except: ! & * < = > !! # @ @@
        'N|0 P|0 X|0 a|0 ab abc abo al am an|0 ar arga argd arge argdo argg argl argu as au aug aun b|0 bN ba bad bd be bel bf bl bm bn bo bp br brea breaka breakd breakl bro bufdo buffers bun bw c|0 cN cNf ca cabc caddb cad caddf cal cat cb cc ccl cd ce cex cf cfir cgetb cgete cg changes chd che checkt cl cla clo cm cmapc cme cn cnew cnf cno cnorea cnoreme co col colo com comc comp con conf cope '+
        'cp cpf cq cr cs cst cu cuna cunme cw delm deb debugg delc delf dif diffg diffo diffp diffpu diffs diffthis dig di dl dell dj dli do doautoa dp dr ds dsp e|0 ea ec echoe echoh echom echon el elsei em en endfo endf endt endw ene ex exe exi exu f|0 files filet fin fina fini fir fix fo foldc foldd folddoc foldo for fu go gr grepa gu gv ha helpf helpg helpt hi hid his ia iabc if ij il im imapc '+
        'ime ino inorea inoreme int is isp iu iuna iunme j|0 ju k|0 keepa kee keepj lN lNf l|0 lad laddb laddf la lan lat lb lc lch lcl lcs le lefta let lex lf lfir lgetb lgete lg lgr lgrepa lh ll lla lli lmak lm lmapc lne lnew lnf ln loadk lo loc lockv lol lope lp lpf lr ls lt lu lua luad luaf lv lvimgrepa lw m|0 ma mak map mapc marks mat me menut mes mk mks mksp mkv mkvie mod mz mzf nbc nb nbs new nm nmapc nme nn nnoreme noa no noh norea noreme norm nu nun nunme ol o|0 om omapc ome on ono onoreme opt ou ounme ow p|0 '+
        'profd prof pro promptr pc ped pe perld po popu pp pre prev ps pt ptN ptf ptj ptl ptn ptp ptr pts pu pw py3 python3 py3d py3f py pyd pyf quita qa rec red redi redr redraws reg res ret retu rew ri rightb rub rubyd rubyf rund ru rv sN san sa sal sav sb sbN sba sbf sbl sbm sbn sbp sbr scrip scripte scs se setf setg setl sf sfir sh sim sig sil sl sla sm smap smapc sme sn sni sno snor snoreme sor '+
        'so spelld spe spelli spellr spellu spellw sp spr sre st sta startg startr star stopi stj sts sun sunm sunme sus sv sw sy synti sync tN tabN tabc tabdo tabe tabf tabfir tabl tabm tabnew '+
        'tabn tabo tabp tabr tabs tab ta tags tc tcld tclf te tf th tj tl tm tn to tp tr try ts tu u|0 undoj undol una unh unl unlo unm unme uns up ve verb vert vim vimgrepa vi viu vie vm vmapc vme vne vn vnoreme vs vu vunme windo w|0 wN wa wh wi winc winp wn wp wq wqa ws wu wv x|0 xa xmapc xm xme xn xnoreme xu xunme y|0 z|0 ~ '+
        // full version
        'Next Print append abbreviate abclear aboveleft all amenu anoremenu args argadd argdelete argedit argglobal arglocal argument ascii autocmd augroup aunmenu buffer bNext ball badd bdelete behave belowright bfirst blast bmodified bnext botright bprevious brewind break breakadd breakdel breaklist browse bunload '+
        'bwipeout change cNext cNfile cabbrev cabclear caddbuffer caddexpr caddfile call catch cbuffer cclose center cexpr cfile cfirst cgetbuffer cgetexpr cgetfile chdir checkpath checktime clist clast close cmap cmapclear cmenu cnext cnewer cnfile cnoremap cnoreabbrev cnoremenu copy colder colorscheme command comclear compiler continue confirm copen cprevious cpfile cquit crewind cscope cstag cunmap '+
        'cunabbrev cunmenu cwindow delete delmarks debug debuggreedy delcommand delfunction diffupdate diffget diffoff diffpatch diffput diffsplit digraphs display deletel djump dlist doautocmd doautoall deletep drop dsearch dsplit edit earlier echo echoerr echohl echomsg else elseif emenu endif endfor '+
        'endfunction endtry endwhile enew execute exit exusage file filetype find finally finish first fixdel fold foldclose folddoopen folddoclosed foldopen function global goto grep grepadd gui gvim hardcopy help helpfind helpgrep helptags highlight hide history insert iabbrev iabclear ijump ilist imap '+
        'imapclear imenu inoremap inoreabbrev inoremenu intro isearch isplit iunmap iunabbrev iunmenu join jumps keepalt keepmarks keepjumps lNext lNfile list laddexpr laddbuffer laddfile last language later lbuffer lcd lchdir lclose lcscope left leftabove lexpr lfile lfirst lgetbuffer lgetexpr lgetfile lgrep lgrepadd lhelpgrep llast llist lmake lmap lmapclear lnext lnewer lnfile lnoremap loadkeymap loadview '+
        'lockmarks lockvar lolder lopen lprevious lpfile lrewind ltag lunmap luado luafile lvimgrep lvimgrepadd lwindow move mark make mapclear match menu menutranslate messages mkexrc mksession mkspell mkvimrc mkview mode mzscheme mzfile nbclose nbkey nbsart next nmap nmapclear nmenu nnoremap '+
        'nnoremenu noautocmd noremap nohlsearch noreabbrev noremenu normal number nunmap nunmenu oldfiles open omap omapclear omenu only onoremap onoremenu options ounmap ounmenu ownsyntax print profdel profile promptfind promptrepl pclose pedit perl perldo pop popup ppop preserve previous psearch ptag ptNext '+
        'ptfirst ptjump ptlast ptnext ptprevious ptrewind ptselect put pwd py3do py3file python pydo pyfile quit quitall qall read recover redo redir redraw redrawstatus registers resize retab return rewind right rightbelow ruby rubydo rubyfile rundo runtime rviminfo substitute sNext sandbox sargument sall saveas sbuffer sbNext sball sbfirst sblast sbmodified sbnext sbprevious sbrewind scriptnames scriptencoding '+
        'scscope set setfiletype setglobal setlocal sfind sfirst shell simalt sign silent sleep slast smagic smapclear smenu snext sniff snomagic snoremap snoremenu sort source spelldump spellgood spellinfo spellrepall spellundo spellwrong split sprevious srewind stop stag startgreplace startreplace '+
        'startinsert stopinsert stjump stselect sunhide sunmap sunmenu suspend sview swapname syntax syntime syncbind tNext tabNext tabclose tabedit tabfind tabfirst tablast tabmove tabnext tabonly tabprevious tabrewind tag tcl tcldo tclfile tearoff tfirst throw tjump tlast tmenu tnext topleft tprevious '+'trewind tselect tunmenu undo undojoin undolist unabbreviate unhide unlet unlockvar unmap unmenu unsilent update vglobal version verbose vertical vimgrep vimgrepadd visual viusage view vmap vmapclear vmenu vnew '+
        'vnoremap vnoremenu vsplit vunmap vunmenu write wNext wall while winsize wincmd winpos wnext wprevious wqall wsverb wundo wviminfo xit xall xmapclear xmap xmenu xnoremap xnoremenu xunmap xunmenu yank',
      built_in: //built in func
        'synIDtrans atan2 range matcharg did_filetype asin feedkeys xor argv ' +
        'complete_check add getwinposx getqflist getwinposy screencol ' +
        'clearmatches empty extend getcmdpos mzeval garbagecollect setreg ' +
        'ceil sqrt diff_hlID inputsecret get getfperm getpid filewritable ' +
        'shiftwidth max sinh isdirectory synID system inputrestore winline ' +
        'atan visualmode inputlist tabpagewinnr round getregtype mapcheck ' +
        'hasmapto histdel argidx findfile sha256 exists toupper getcmdline ' +
        'taglist string getmatches bufnr strftime winwidth bufexists ' +
        'strtrans tabpagebuflist setcmdpos remote_read printf setloclist ' +
        'getpos getline bufwinnr float2nr len getcmdtype diff_filler luaeval ' +
        'resolve libcallnr foldclosedend reverse filter has_key bufname ' +
        'str2float strlen setline getcharmod setbufvar index searchpos ' +
        'shellescape undofile foldclosed setqflist buflisted strchars str2nr ' +
        'virtcol floor remove undotree remote_expr winheight gettabwinvar ' +
        'reltime cursor tabpagenr finddir localtime acos getloclist search ' +
        'tanh matchend rename gettabvar strdisplaywidth type abs py3eval ' +
        'setwinvar tolower wildmenumode log10 spellsuggest bufloaded ' +
        'synconcealed nextnonblank server2client complete settabwinvar ' +
        'executable input wincol setmatches getftype hlID inputsave ' +
        'searchpair or screenrow line settabvar histadd deepcopy strpart ' +
        'remote_peek and eval getftime submatch screenchar winsaveview ' +
        'matchadd mkdir screenattr getfontname libcall reltimestr getfsize ' +
        'winnr invert pow getbufline byte2line soundfold repeat fnameescape ' +
        'tagfiles sin strwidth spellbadword trunc maparg log lispindent ' +
        'hostname setpos globpath remote_foreground getchar synIDattr ' +
        'fnamemodify cscope_connection stridx winbufnr indent min ' +
        'complete_add nr2char searchpairpos inputdialog values matchlist ' +
        'items hlexists strridx browsedir expand fmod pathshorten line2byte ' +
        'argc count getwinvar glob foldtextresult getreg foreground cosh ' +
        'matchdelete has char2nr simplify histget searchdecl iconv ' +
        'winrestcmd pumvisible writefile foldlevel haslocaldir keys cos ' +
        'matchstr foldtext histnr tan tempname getcwd byteidx getbufvar ' +
        'islocked escape eventhandler remote_send serverlist winrestview ' +
        'synstack pyeval prevnonblank readfile cindent filereadable changenr ' +
        'exp'
    },
    illegal: /;/,
    contains: [
      hljs.NUMBER_MODE,
      {
        className: 'string',
        begin: '\'', end: '\'',
        illegal: '\\n'
      },

      /*
      A double quote can start either a string or a line comment. Strings are
      ended before the end of a line by another double quote and can contain
      escaped double-quotes and post-escaped line breaks.

      Also, any double quote at the beginning of a line is a comment but we
      don't handle that properly at the moment: any double quote inside will
      turn them into a string. Handling it properly will require a smarter
      parser.
      */
      {
        className: 'string',
        begin: /"(\\"|\n\\|[^"\n])*"/
      },
      hljs.COMMENT('"', '$'),

      {
        className: 'variable',
        begin: /[bwtglsav]:[\w\d_]*/
      },
      {
        className: 'function',
        beginKeywords: 'function function!', end: '$',
        relevance: 0,
        contains: [
          hljs.TITLE_MODE,
          {
            className: 'params',
            begin: '\\(', end: '\\)'
          }
        ]
      },
      {
        className: 'symbol',
        begin: /<[\w-]+>/
      }
    ]
  };
};

var x86asm = function(hljs) {
  return {
    case_insensitive: true,
    lexemes: '[.%]?' + hljs.IDENT_RE,
    keywords: {
      keyword:
        'lock rep repe repz repne repnz xaquire xrelease bnd nobnd ' +
        'aaa aad aam aas adc add and arpl bb0_reset bb1_reset bound bsf bsr bswap bt btc btr bts call cbw cdq cdqe clc cld cli clts cmc cmp cmpsb cmpsd cmpsq cmpsw cmpxchg cmpxchg486 cmpxchg8b cmpxchg16b cpuid cpu_read cpu_write cqo cwd cwde daa das dec div dmint emms enter equ f2xm1 fabs fadd faddp fbld fbstp fchs fclex fcmovb fcmovbe fcmove fcmovnb fcmovnbe fcmovne fcmovnu fcmovu fcom fcomi fcomip fcomp fcompp fcos fdecstp fdisi fdiv fdivp fdivr fdivrp femms feni ffree ffreep fiadd ficom ficomp fidiv fidivr fild fimul fincstp finit fist fistp fisttp fisub fisubr fld fld1 fldcw fldenv fldl2e fldl2t fldlg2 fldln2 fldpi fldz fmul fmulp fnclex fndisi fneni fninit fnop fnsave fnstcw fnstenv fnstsw fpatan fprem fprem1 fptan frndint frstor fsave fscale fsetpm fsin fsincos fsqrt fst fstcw fstenv fstp fstsw fsub fsubp fsubr fsubrp ftst fucom fucomi fucomip fucomp fucompp fxam fxch fxtract fyl2x fyl2xp1 hlt ibts icebp idiv imul in inc incbin insb insd insw int int01 int1 int03 int3 into invd invpcid invlpg invlpga iret iretd iretq iretw jcxz jecxz jrcxz jmp jmpe lahf lar lds lea leave les lfence lfs lgdt lgs lidt lldt lmsw loadall loadall286 lodsb lodsd lodsq lodsw loop loope loopne loopnz loopz lsl lss ltr mfence monitor mov movd movq movsb movsd movsq movsw movsx movsxd movzx mul mwait neg nop not or out outsb outsd outsw packssdw packsswb packuswb paddb paddd paddsb paddsiw paddsw paddusb paddusw paddw pand pandn pause paveb pavgusb pcmpeqb pcmpeqd pcmpeqw pcmpgtb pcmpgtd pcmpgtw pdistib pf2id pfacc pfadd pfcmpeq pfcmpge pfcmpgt pfmax pfmin pfmul pfrcp pfrcpit1 pfrcpit2 pfrsqit1 pfrsqrt pfsub pfsubr pi2fd pmachriw pmaddwd pmagw pmulhriw pmulhrwa pmulhrwc pmulhw pmullw pmvgezb pmvlzb pmvnzb pmvzb pop popa popad popaw popf popfd popfq popfw por prefetch prefetchw pslld psllq psllw psrad psraw psrld psrlq psrlw psubb psubd psubsb psubsiw psubsw psubusb psubusw psubw punpckhbw punpckhdq punpckhwd punpcklbw punpckldq punpcklwd push pusha pushad pushaw pushf pushfd pushfq pushfw pxor rcl rcr rdshr rdmsr rdpmc rdtsc rdtscp ret retf retn rol ror rdm rsdc rsldt rsm rsts sahf sal salc sar sbb scasb scasd scasq scasw sfence sgdt shl shld shr shrd sidt sldt skinit smi smint smintold smsw stc std sti stosb stosd stosq stosw str sub svdc svldt svts swapgs syscall sysenter sysexit sysret test ud0 ud1 ud2b ud2 ud2a umov verr verw fwait wbinvd wrshr wrmsr xadd xbts xchg xlatb xlat xor cmove cmovz cmovne cmovnz cmova cmovnbe cmovae cmovnb cmovb cmovnae cmovbe cmovna cmovg cmovnle cmovge cmovnl cmovl cmovnge cmovle cmovng cmovc cmovnc cmovo cmovno cmovs cmovns cmovp cmovpe cmovnp cmovpo je jz jne jnz ja jnbe jae jnb jb jnae jbe jna jg jnle jge jnl jl jnge jle jng jc jnc jo jno js jns jpo jnp jpe jp sete setz setne setnz seta setnbe setae setnb setnc setb setnae setcset setbe setna setg setnle setge setnl setl setnge setle setng sets setns seto setno setpe setp setpo setnp addps addss andnps andps cmpeqps cmpeqss cmpleps cmpless cmpltps cmpltss cmpneqps cmpneqss cmpnleps cmpnless cmpnltps cmpnltss cmpordps cmpordss cmpunordps cmpunordss cmpps cmpss comiss cvtpi2ps cvtps2pi cvtsi2ss cvtss2si cvttps2pi cvttss2si divps divss ldmxcsr maxps maxss minps minss movaps movhps movlhps movlps movhlps movmskps movntps movss movups mulps mulss orps rcpps rcpss rsqrtps rsqrtss shufps sqrtps sqrtss stmxcsr subps subss ucomiss unpckhps unpcklps xorps fxrstor fxrstor64 fxsave fxsave64 xgetbv xsetbv xsave xsave64 xsaveopt xsaveopt64 xrstor xrstor64 prefetchnta prefetcht0 prefetcht1 prefetcht2 maskmovq movntq pavgb pavgw pextrw pinsrw pmaxsw pmaxub pminsw pminub pmovmskb pmulhuw psadbw pshufw pf2iw pfnacc pfpnacc pi2fw pswapd maskmovdqu clflush movntdq movnti movntpd movdqa movdqu movdq2q movq2dq paddq pmuludq pshufd pshufhw pshuflw pslldq psrldq psubq punpckhqdq punpcklqdq addpd addsd andnpd andpd cmpeqpd cmpeqsd cmplepd cmplesd cmpltpd cmpltsd cmpneqpd cmpneqsd cmpnlepd cmpnlesd cmpnltpd cmpnltsd cmpordpd cmpordsd cmpunordpd cmpunordsd cmppd comisd cvtdq2pd cvtdq2ps cvtpd2dq cvtpd2pi cvtpd2ps cvtpi2pd cvtps2dq cvtps2pd cvtsd2si cvtsd2ss cvtsi2sd cvtss2sd cvttpd2pi cvttpd2dq cvttps2dq cvttsd2si divpd divsd maxpd maxsd minpd minsd movapd movhpd movlpd movmskpd movupd mulpd mulsd orpd shufpd sqrtpd sqrtsd subpd subsd ucomisd unpckhpd unpcklpd xorpd addsubpd addsubps haddpd haddps hsubpd hsubps lddqu movddup movshdup movsldup clgi stgi vmcall vmclear vmfunc vmlaunch vmload vmmcall vmptrld vmptrst vmread vmresume vmrun vmsave vmwrite vmxoff vmxon invept invvpid pabsb pabsw pabsd palignr phaddw phaddd phaddsw phsubw phsubd phsubsw pmaddubsw pmulhrsw pshufb psignb psignw psignd extrq insertq movntsd movntss lzcnt blendpd blendps blendvpd blendvps dppd dpps extractps insertps movntdqa mpsadbw packusdw pblendvb pblendw pcmpeqq pextrb pextrd pextrq phminposuw pinsrb pinsrd pinsrq pmaxsb pmaxsd pmaxud pmaxuw pminsb pminsd pminud pminuw pmovsxbw pmovsxbd pmovsxbq pmovsxwd pmovsxwq pmovsxdq pmovzxbw pmovzxbd pmovzxbq pmovzxwd pmovzxwq pmovzxdq pmuldq pmulld ptest roundpd roundps roundsd roundss crc32 pcmpestri pcmpestrm pcmpistri pcmpistrm pcmpgtq popcnt getsec pfrcpv pfrsqrtv movbe aesenc aesenclast aesdec aesdeclast aesimc aeskeygenassist vaesenc vaesenclast vaesdec vaesdeclast vaesimc vaeskeygenassist vaddpd vaddps vaddsd vaddss vaddsubpd vaddsubps vandpd vandps vandnpd vandnps vblendpd vblendps vblendvpd vblendvps vbroadcastss vbroadcastsd vbroadcastf128 vcmpeq_ospd vcmpeqpd vcmplt_ospd vcmpltpd vcmple_ospd vcmplepd vcmpunord_qpd vcmpunordpd vcmpneq_uqpd vcmpneqpd vcmpnlt_uspd vcmpnltpd vcmpnle_uspd vcmpnlepd vcmpord_qpd vcmpordpd vcmpeq_uqpd vcmpnge_uspd vcmpngepd vcmpngt_uspd vcmpngtpd vcmpfalse_oqpd vcmpfalsepd vcmpneq_oqpd vcmpge_ospd vcmpgepd vcmpgt_ospd vcmpgtpd vcmptrue_uqpd vcmptruepd vcmplt_oqpd vcmple_oqpd vcmpunord_spd vcmpneq_uspd vcmpnlt_uqpd vcmpnle_uqpd vcmpord_spd vcmpeq_uspd vcmpnge_uqpd vcmpngt_uqpd vcmpfalse_ospd vcmpneq_ospd vcmpge_oqpd vcmpgt_oqpd vcmptrue_uspd vcmppd vcmpeq_osps vcmpeqps vcmplt_osps vcmpltps vcmple_osps vcmpleps vcmpunord_qps vcmpunordps vcmpneq_uqps vcmpneqps vcmpnlt_usps vcmpnltps vcmpnle_usps vcmpnleps vcmpord_qps vcmpordps vcmpeq_uqps vcmpnge_usps vcmpngeps vcmpngt_usps vcmpngtps vcmpfalse_oqps vcmpfalseps vcmpneq_oqps vcmpge_osps vcmpgeps vcmpgt_osps vcmpgtps vcmptrue_uqps vcmptrueps vcmplt_oqps vcmple_oqps vcmpunord_sps vcmpneq_usps vcmpnlt_uqps vcmpnle_uqps vcmpord_sps vcmpeq_usps vcmpnge_uqps vcmpngt_uqps vcmpfalse_osps vcmpneq_osps vcmpge_oqps vcmpgt_oqps vcmptrue_usps vcmpps vcmpeq_ossd vcmpeqsd vcmplt_ossd vcmpltsd vcmple_ossd vcmplesd vcmpunord_qsd vcmpunordsd vcmpneq_uqsd vcmpneqsd vcmpnlt_ussd vcmpnltsd vcmpnle_ussd vcmpnlesd vcmpord_qsd vcmpordsd vcmpeq_uqsd vcmpnge_ussd vcmpngesd vcmpngt_ussd vcmpngtsd vcmpfalse_oqsd vcmpfalsesd vcmpneq_oqsd vcmpge_ossd vcmpgesd vcmpgt_ossd vcmpgtsd vcmptrue_uqsd vcmptruesd vcmplt_oqsd vcmple_oqsd vcmpunord_ssd vcmpneq_ussd vcmpnlt_uqsd vcmpnle_uqsd vcmpord_ssd vcmpeq_ussd vcmpnge_uqsd vcmpngt_uqsd vcmpfalse_ossd vcmpneq_ossd vcmpge_oqsd vcmpgt_oqsd vcmptrue_ussd vcmpsd vcmpeq_osss vcmpeqss vcmplt_osss vcmpltss vcmple_osss vcmpless vcmpunord_qss vcmpunordss vcmpneq_uqss vcmpneqss vcmpnlt_usss vcmpnltss vcmpnle_usss vcmpnless vcmpord_qss vcmpordss vcmpeq_uqss vcmpnge_usss vcmpngess vcmpngt_usss vcmpngtss vcmpfalse_oqss vcmpfalsess vcmpneq_oqss vcmpge_osss vcmpgess vcmpgt_osss vcmpgtss vcmptrue_uqss vcmptruess vcmplt_oqss vcmple_oqss vcmpunord_sss vcmpneq_usss vcmpnlt_uqss vcmpnle_uqss vcmpord_sss vcmpeq_usss vcmpnge_uqss vcmpngt_uqss vcmpfalse_osss vcmpneq_osss vcmpge_oqss vcmpgt_oqss vcmptrue_usss vcmpss vcomisd vcomiss vcvtdq2pd vcvtdq2ps vcvtpd2dq vcvtpd2ps vcvtps2dq vcvtps2pd vcvtsd2si vcvtsd2ss vcvtsi2sd vcvtsi2ss vcvtss2sd vcvtss2si vcvttpd2dq vcvttps2dq vcvttsd2si vcvttss2si vdivpd vdivps vdivsd vdivss vdppd vdpps vextractf128 vextractps vhaddpd vhaddps vhsubpd vhsubps vinsertf128 vinsertps vlddqu vldqqu vldmxcsr vmaskmovdqu vmaskmovps vmaskmovpd vmaxpd vmaxps vmaxsd vmaxss vminpd vminps vminsd vminss vmovapd vmovaps vmovd vmovq vmovddup vmovdqa vmovqqa vmovdqu vmovqqu vmovhlps vmovhpd vmovhps vmovlhps vmovlpd vmovlps vmovmskpd vmovmskps vmovntdq vmovntqq vmovntdqa vmovntpd vmovntps vmovsd vmovshdup vmovsldup vmovss vmovupd vmovups vmpsadbw vmulpd vmulps vmulsd vmulss vorpd vorps vpabsb vpabsw vpabsd vpacksswb vpackssdw vpackuswb vpackusdw vpaddb vpaddw vpaddd vpaddq vpaddsb vpaddsw vpaddusb vpaddusw vpalignr vpand vpandn vpavgb vpavgw vpblendvb vpblendw vpcmpestri vpcmpestrm vpcmpistri vpcmpistrm vpcmpeqb vpcmpeqw vpcmpeqd vpcmpeqq vpcmpgtb vpcmpgtw vpcmpgtd vpcmpgtq vpermilpd vpermilps vperm2f128 vpextrb vpextrw vpextrd vpextrq vphaddw vphaddd vphaddsw vphminposuw vphsubw vphsubd vphsubsw vpinsrb vpinsrw vpinsrd vpinsrq vpmaddwd vpmaddubsw vpmaxsb vpmaxsw vpmaxsd vpmaxub vpmaxuw vpmaxud vpminsb vpminsw vpminsd vpminub vpminuw vpminud vpmovmskb vpmovsxbw vpmovsxbd vpmovsxbq vpmovsxwd vpmovsxwq vpmovsxdq vpmovzxbw vpmovzxbd vpmovzxbq vpmovzxwd vpmovzxwq vpmovzxdq vpmulhuw vpmulhrsw vpmulhw vpmullw vpmulld vpmuludq vpmuldq vpor vpsadbw vpshufb vpshufd vpshufhw vpshuflw vpsignb vpsignw vpsignd vpslldq vpsrldq vpsllw vpslld vpsllq vpsraw vpsrad vpsrlw vpsrld vpsrlq vptest vpsubb vpsubw vpsubd vpsubq vpsubsb vpsubsw vpsubusb vpsubusw vpunpckhbw vpunpckhwd vpunpckhdq vpunpckhqdq vpunpcklbw vpunpcklwd vpunpckldq vpunpcklqdq vpxor vrcpps vrcpss vrsqrtps vrsqrtss vroundpd vroundps vroundsd vroundss vshufpd vshufps vsqrtpd vsqrtps vsqrtsd vsqrtss vstmxcsr vsubpd vsubps vsubsd vsubss vtestps vtestpd vucomisd vucomiss vunpckhpd vunpckhps vunpcklpd vunpcklps vxorpd vxorps vzeroall vzeroupper pclmullqlqdq pclmulhqlqdq pclmullqhqdq pclmulhqhqdq pclmulqdq vpclmullqlqdq vpclmulhqlqdq vpclmullqhqdq vpclmulhqhqdq vpclmulqdq vfmadd132ps vfmadd132pd vfmadd312ps vfmadd312pd vfmadd213ps vfmadd213pd vfmadd123ps vfmadd123pd vfmadd231ps vfmadd231pd vfmadd321ps vfmadd321pd vfmaddsub132ps vfmaddsub132pd vfmaddsub312ps vfmaddsub312pd vfmaddsub213ps vfmaddsub213pd vfmaddsub123ps vfmaddsub123pd vfmaddsub231ps vfmaddsub231pd vfmaddsub321ps vfmaddsub321pd vfmsub132ps vfmsub132pd vfmsub312ps vfmsub312pd vfmsub213ps vfmsub213pd vfmsub123ps vfmsub123pd vfmsub231ps vfmsub231pd vfmsub321ps vfmsub321pd vfmsubadd132ps vfmsubadd132pd vfmsubadd312ps vfmsubadd312pd vfmsubadd213ps vfmsubadd213pd vfmsubadd123ps vfmsubadd123pd vfmsubadd231ps vfmsubadd231pd vfmsubadd321ps vfmsubadd321pd vfnmadd132ps vfnmadd132pd vfnmadd312ps vfnmadd312pd vfnmadd213ps vfnmadd213pd vfnmadd123ps vfnmadd123pd vfnmadd231ps vfnmadd231pd vfnmadd321ps vfnmadd321pd vfnmsub132ps vfnmsub132pd vfnmsub312ps vfnmsub312pd vfnmsub213ps vfnmsub213pd vfnmsub123ps vfnmsub123pd vfnmsub231ps vfnmsub231pd vfnmsub321ps vfnmsub321pd vfmadd132ss vfmadd132sd vfmadd312ss vfmadd312sd vfmadd213ss vfmadd213sd vfmadd123ss vfmadd123sd vfmadd231ss vfmadd231sd vfmadd321ss vfmadd321sd vfmsub132ss vfmsub132sd vfmsub312ss vfmsub312sd vfmsub213ss vfmsub213sd vfmsub123ss vfmsub123sd vfmsub231ss vfmsub231sd vfmsub321ss vfmsub321sd vfnmadd132ss vfnmadd132sd vfnmadd312ss vfnmadd312sd vfnmadd213ss vfnmadd213sd vfnmadd123ss vfnmadd123sd vfnmadd231ss vfnmadd231sd vfnmadd321ss vfnmadd321sd vfnmsub132ss vfnmsub132sd vfnmsub312ss vfnmsub312sd vfnmsub213ss vfnmsub213sd vfnmsub123ss vfnmsub123sd vfnmsub231ss vfnmsub231sd vfnmsub321ss vfnmsub321sd rdfsbase rdgsbase rdrand wrfsbase wrgsbase vcvtph2ps vcvtps2ph adcx adox rdseed clac stac xstore xcryptecb xcryptcbc xcryptctr xcryptcfb xcryptofb montmul xsha1 xsha256 llwpcb slwpcb lwpval lwpins vfmaddpd vfmaddps vfmaddsd vfmaddss vfmaddsubpd vfmaddsubps vfmsubaddpd vfmsubaddps vfmsubpd vfmsubps vfmsubsd vfmsubss vfnmaddpd vfnmaddps vfnmaddsd vfnmaddss vfnmsubpd vfnmsubps vfnmsubsd vfnmsubss vfrczpd vfrczps vfrczsd vfrczss vpcmov vpcomb vpcomd vpcomq vpcomub vpcomud vpcomuq vpcomuw vpcomw vphaddbd vphaddbq vphaddbw vphadddq vphaddubd vphaddubq vphaddubw vphaddudq vphadduwd vphadduwq vphaddwd vphaddwq vphsubbw vphsubdq vphsubwd vpmacsdd vpmacsdqh vpmacsdql vpmacssdd vpmacssdqh vpmacssdql vpmacsswd vpmacssww vpmacswd vpmacsww vpmadcsswd vpmadcswd vpperm vprotb vprotd vprotq vprotw vpshab vpshad vpshaq vpshaw vpshlb vpshld vpshlq vpshlw vbroadcasti128 vpblendd vpbroadcastb vpbroadcastw vpbroadcastd vpbroadcastq vpermd vpermpd vpermps vpermq vperm2i128 vextracti128 vinserti128 vpmaskmovd vpmaskmovq vpsllvd vpsllvq vpsravd vpsrlvd vpsrlvq vgatherdpd vgatherqpd vgatherdps vgatherqps vpgatherdd vpgatherqd vpgatherdq vpgatherqq xabort xbegin xend xtest andn bextr blci blcic blsi blsic blcfill blsfill blcmsk blsmsk blsr blcs bzhi mulx pdep pext rorx sarx shlx shrx tzcnt tzmsk t1mskc valignd valignq vblendmpd vblendmps vbroadcastf32x4 vbroadcastf64x4 vbroadcasti32x4 vbroadcasti64x4 vcompresspd vcompressps vcvtpd2udq vcvtps2udq vcvtsd2usi vcvtss2usi vcvttpd2udq vcvttps2udq vcvttsd2usi vcvttss2usi vcvtudq2pd vcvtudq2ps vcvtusi2sd vcvtusi2ss vexpandpd vexpandps vextractf32x4 vextractf64x4 vextracti32x4 vextracti64x4 vfixupimmpd vfixupimmps vfixupimmsd vfixupimmss vgetexppd vgetexpps vgetexpsd vgetexpss vgetmantpd vgetmantps vgetmantsd vgetmantss vinsertf32x4 vinsertf64x4 vinserti32x4 vinserti64x4 vmovdqa32 vmovdqa64 vmovdqu32 vmovdqu64 vpabsq vpandd vpandnd vpandnq vpandq vpblendmd vpblendmq vpcmpltd vpcmpled vpcmpneqd vpcmpnltd vpcmpnled vpcmpd vpcmpltq vpcmpleq vpcmpneqq vpcmpnltq vpcmpnleq vpcmpq vpcmpequd vpcmpltud vpcmpleud vpcmpnequd vpcmpnltud vpcmpnleud vpcmpud vpcmpequq vpcmpltuq vpcmpleuq vpcmpnequq vpcmpnltuq vpcmpnleuq vpcmpuq vpcompressd vpcompressq vpermi2d vpermi2pd vpermi2ps vpermi2q vpermt2d vpermt2pd vpermt2ps vpermt2q vpexpandd vpexpandq vpmaxsq vpmaxuq vpminsq vpminuq vpmovdb vpmovdw vpmovqb vpmovqd vpmovqw vpmovsdb vpmovsdw vpmovsqb vpmovsqd vpmovsqw vpmovusdb vpmovusdw vpmovusqb vpmovusqd vpmovusqw vpord vporq vprold vprolq vprolvd vprolvq vprord vprorq vprorvd vprorvq vpscatterdd vpscatterdq vpscatterqd vpscatterqq vpsraq vpsravq vpternlogd vpternlogq vptestmd vptestmq vptestnmd vptestnmq vpxord vpxorq vrcp14pd vrcp14ps vrcp14sd vrcp14ss vrndscalepd vrndscaleps vrndscalesd vrndscaless vrsqrt14pd vrsqrt14ps vrsqrt14sd vrsqrt14ss vscalefpd vscalefps vscalefsd vscalefss vscatterdpd vscatterdps vscatterqpd vscatterqps vshuff32x4 vshuff64x2 vshufi32x4 vshufi64x2 kandnw kandw kmovw knotw kortestw korw kshiftlw kshiftrw kunpckbw kxnorw kxorw vpbroadcastmb2q vpbroadcastmw2d vpconflictd vpconflictq vplzcntd vplzcntq vexp2pd vexp2ps vrcp28pd vrcp28ps vrcp28sd vrcp28ss vrsqrt28pd vrsqrt28ps vrsqrt28sd vrsqrt28ss vgatherpf0dpd vgatherpf0dps vgatherpf0qpd vgatherpf0qps vgatherpf1dpd vgatherpf1dps vgatherpf1qpd vgatherpf1qps vscatterpf0dpd vscatterpf0dps vscatterpf0qpd vscatterpf0qps vscatterpf1dpd vscatterpf1dps vscatterpf1qpd vscatterpf1qps prefetchwt1 bndmk bndcl bndcu bndcn bndmov bndldx bndstx sha1rnds4 sha1nexte sha1msg1 sha1msg2 sha256rnds2 sha256msg1 sha256msg2 hint_nop0 hint_nop1 hint_nop2 hint_nop3 hint_nop4 hint_nop5 hint_nop6 hint_nop7 hint_nop8 hint_nop9 hint_nop10 hint_nop11 hint_nop12 hint_nop13 hint_nop14 hint_nop15 hint_nop16 hint_nop17 hint_nop18 hint_nop19 hint_nop20 hint_nop21 hint_nop22 hint_nop23 hint_nop24 hint_nop25 hint_nop26 hint_nop27 hint_nop28 hint_nop29 hint_nop30 hint_nop31 hint_nop32 hint_nop33 hint_nop34 hint_nop35 hint_nop36 hint_nop37 hint_nop38 hint_nop39 hint_nop40 hint_nop41 hint_nop42 hint_nop43 hint_nop44 hint_nop45 hint_nop46 hint_nop47 hint_nop48 hint_nop49 hint_nop50 hint_nop51 hint_nop52 hint_nop53 hint_nop54 hint_nop55 hint_nop56 hint_nop57 hint_nop58 hint_nop59 hint_nop60 hint_nop61 hint_nop62 hint_nop63',
      built_in:
        // Instruction pointer
        'ip eip rip ' +
        // 8-bit registers
        'al ah bl bh cl ch dl dh sil dil bpl spl r8b r9b r10b r11b r12b r13b r14b r15b ' +
        // 16-bit registers
        'ax bx cx dx si di bp sp r8w r9w r10w r11w r12w r13w r14w r15w ' +
        // 32-bit registers
        'eax ebx ecx edx esi edi ebp esp eip r8d r9d r10d r11d r12d r13d r14d r15d ' +
        // 64-bit registers
        'rax rbx rcx rdx rsi rdi rbp rsp r8 r9 r10 r11 r12 r13 r14 r15 ' +
        // Segment registers
        'cs ds es fs gs ss ' +
        // Floating point stack registers
        'st st0 st1 st2 st3 st4 st5 st6 st7 ' +
        // MMX Registers
        'mm0 mm1 mm2 mm3 mm4 mm5 mm6 mm7 ' +
        // SSE registers
        'xmm0  xmm1  xmm2  xmm3  xmm4  xmm5  xmm6  xmm7  xmm8  xmm9 xmm10  xmm11 xmm12 xmm13 xmm14 xmm15 ' +
        'xmm16 xmm17 xmm18 xmm19 xmm20 xmm21 xmm22 xmm23 xmm24 xmm25 xmm26 xmm27 xmm28 xmm29 xmm30 xmm31 ' +
        // AVX registers
        'ymm0  ymm1  ymm2  ymm3  ymm4  ymm5  ymm6  ymm7  ymm8  ymm9 ymm10  ymm11 ymm12 ymm13 ymm14 ymm15 ' +
        'ymm16 ymm17 ymm18 ymm19 ymm20 ymm21 ymm22 ymm23 ymm24 ymm25 ymm26 ymm27 ymm28 ymm29 ymm30 ymm31 ' +
        // AVX-512F registers
        'zmm0  zmm1  zmm2  zmm3  zmm4  zmm5  zmm6  zmm7  zmm8  zmm9 zmm10  zmm11 zmm12 zmm13 zmm14 zmm15 ' +
        'zmm16 zmm17 zmm18 zmm19 zmm20 zmm21 zmm22 zmm23 zmm24 zmm25 zmm26 zmm27 zmm28 zmm29 zmm30 zmm31 ' +
        // AVX-512F mask registers
        'k0 k1 k2 k3 k4 k5 k6 k7 ' +
        // Bound (MPX) register
        'bnd0 bnd1 bnd2 bnd3 ' +
        // Special register
        'cr0 cr1 cr2 cr3 cr4 cr8 dr0 dr1 dr2 dr3 dr8 tr3 tr4 tr5 tr6 tr7 ' +
        // NASM altreg package
        'r0 r1 r2 r3 r4 r5 r6 r7 r0b r1b r2b r3b r4b r5b r6b r7b ' +
        'r0w r1w r2w r3w r4w r5w r6w r7w r0d r1d r2d r3d r4d r5d r6d r7d ' +
        'r0h r1h r2h r3h ' +
        'r0l r1l r2l r3l r4l r5l r6l r7l r8l r9l r10l r11l r12l r13l r14l r15l ' +

        'db dw dd dq dt ddq do dy dz ' +
        'resb resw resd resq rest resdq reso resy resz ' +
        'incbin equ times ' +
        'byte word dword qword nosplit rel abs seg wrt strict near far a32 ptr',

      meta:
        '%define %xdefine %+ %undef %defstr %deftok %assign %strcat %strlen %substr %rotate %elif %else %endif ' +
        '%if %ifmacro %ifctx %ifidn %ifidni %ifid %ifnum %ifstr %iftoken %ifempty %ifenv %error %warning %fatal %rep ' +
        '%endrep %include %push %pop %repl %pathsearch %depend %use %arg %stacksize %local %line %comment %endcomment ' +
        '.nolist ' +
        '__FILE__ __LINE__ __SECT__  __BITS__ __OUTPUT_FORMAT__ __DATE__ __TIME__ __DATE_NUM__ __TIME_NUM__ ' +
        '__UTC_DATE__ __UTC_TIME__ __UTC_DATE_NUM__ __UTC_TIME_NUM__  __PASS__ struc endstruc istruc at iend ' +
        'align alignb sectalign daz nodaz up down zero default option assume public ' +

        'bits use16 use32 use64 default section segment absolute extern global common cpu float ' +
        '__utf16__ __utf16le__ __utf16be__ __utf32__ __utf32le__ __utf32be__ ' +
        '__float8__ __float16__ __float32__ __float64__ __float80m__ __float80e__ __float128l__ __float128h__ ' +
        '__Infinity__ __QNaN__ __SNaN__ Inf NaN QNaN SNaN float8 float16 float32 float64 float80m float80e ' +
        'float128l float128h __FLOAT_DAZ__ __FLOAT_ROUND__ __FLOAT__'
    },
    contains: [
      hljs.COMMENT(
        ';',
        '$',
        {
          relevance: 0
        }
      ),
      {
        className: 'number',
        variants: [
          // Float number and x87 BCD
          {
            begin: '\\b(?:([0-9][0-9_]*)?\\.[0-9_]*(?:[eE][+-]?[0-9_]+)?|' +
                   '(0[Xx])?[0-9][0-9_]*\\.?[0-9_]*(?:[pP](?:[+-]?[0-9_]+)?)?)\\b',
            relevance: 0
          },

          // Hex number in $
          { begin: '\\$[0-9][0-9A-Fa-f]*', relevance: 0 },

          // Number in H,D,T,Q,O,B,Y suffix
          { begin: '\\b(?:[0-9A-Fa-f][0-9A-Fa-f_]*[Hh]|[0-9][0-9_]*[DdTt]?|[0-7][0-7_]*[QqOo]|[0-1][0-1_]*[BbYy])\\b' },

          // Number in X,D,T,Q,O,B,Y prefix
          { begin: '\\b(?:0[Xx][0-9A-Fa-f_]+|0[DdTt][0-9_]+|0[QqOo][0-7_]+|0[BbYy][0-1_]+)\\b'}
        ]
      },
      // Double quote string
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        variants: [
          // Single-quoted string
          { begin: '\'', end: '[^\\\\]\'' },
          // Backquoted string
          { begin: '`', end: '[^\\\\]`' }
        ],
        relevance: 0
      },
      {
        className: 'symbol',
        variants: [
          // Global label and local label
          { begin: '^\\s*[A-Za-z._?][A-Za-z0-9_$#@~.?]*(:|\\s+label)' },
          // Macro-local label
          { begin: '^\\s*%%[A-Za-z0-9_$#@~.?]*:' }
        ],
        relevance: 0
      },
      // Macro parameter
      {
        className: 'subst',
        begin: '%[0-9]+',
        relevance: 0
      },
      // Macro parameter
      {
        className: 'subst',
        begin: '%!\S+',
        relevance: 0
      },
      {
        className: 'meta',
        begin: /^\s*\.[\w_-]+/
      }
    ]
  };
};

var xl = function(hljs) {
  var BUILTIN_MODULES =
    'ObjectLoader Animate MovieCredits Slides Filters Shading Materials LensFlare Mapping VLCAudioVideo ' +
    'StereoDecoder PointCloud NetworkAccess RemoteControl RegExp ChromaKey Snowfall NodeJS Speech Charts';

  var XL_KEYWORDS = {
    keyword:
      'if then else do while until for loop import with is as where when by data constant ' +
      'integer real text name boolean symbol infix prefix postfix block tree',
    literal:
      'true false nil',
    built_in:
      'in mod rem and or xor not abs sign floor ceil sqrt sin cos tan asin ' +
      'acos atan exp expm1 log log2 log10 log1p pi at text_length text_range ' +
      'text_find text_replace contains page slide basic_slide title_slide ' +
      'title subtitle fade_in fade_out fade_at clear_color color line_color ' +
      'line_width texture_wrap texture_transform texture scale_?x scale_?y ' +
      'scale_?z? translate_?x translate_?y translate_?z? rotate_?x rotate_?y ' +
      'rotate_?z? rectangle circle ellipse sphere path line_to move_to ' +
      'quad_to curve_to theme background contents locally time mouse_?x ' +
      'mouse_?y mouse_buttons ' +
      BUILTIN_MODULES
  };

  var DOUBLE_QUOTE_TEXT = {
    className: 'string',
    begin: '"', end: '"', illegal: '\\n'
  };
  var SINGLE_QUOTE_TEXT = {
    className: 'string',
    begin: '\'', end: '\'', illegal: '\\n'
  };
  var LONG_TEXT = {
    className: 'string',
    begin: '<<', end: '>>'
  };
  var BASED_NUMBER = {
    className: 'number',
    begin: '[0-9]+#[0-9A-Z_]+(\\.[0-9-A-Z_]+)?#?([Ee][+-]?[0-9]+)?'
  };
  var IMPORT = {
    beginKeywords: 'import', end: '$',
    keywords: XL_KEYWORDS,
    contains: [DOUBLE_QUOTE_TEXT]
  };
  var FUNCTION_DEFINITION = {
    className: 'function',
    begin: /[a-z][^\n]*->/, returnBegin: true, end: /->/,
    contains: [
      hljs.inherit(hljs.TITLE_MODE, {starts: {
        endsWithParent: true,
        keywords: XL_KEYWORDS
      }})
    ]
  };
  return {
    aliases: ['tao'],
    lexemes: /[a-zA-Z][a-zA-Z0-9_?]*/,
    keywords: XL_KEYWORDS,
    contains: [
    hljs.C_LINE_COMMENT_MODE,
    hljs.C_BLOCK_COMMENT_MODE,
    DOUBLE_QUOTE_TEXT,
    SINGLE_QUOTE_TEXT,
    LONG_TEXT,
    FUNCTION_DEFINITION,
    IMPORT,
    BASED_NUMBER,
    hljs.NUMBER_MODE
    ]
  };
};

var xquery = function(hljs) {
  // see https://www.w3.org/TR/xquery/#id-terminal-delimitation
  var KEYWORDS = 'module schema namespace boundary-space preserve no-preserve strip default collation base-uri ordering context decimal-format decimal-separator copy-namespaces empty-sequence except exponent-separator external grouping-separator inherit no-inherit lax minus-sign per-mille percent schema-attribute schema-element strict unordered zero-digit ' +
  'declare import option function validate variable ' +
  'for at in let where order group by return if then else ' +
  'tumbling sliding window start when only end previous next stable ' +
  'ascending descending allowing empty greatest least some every satisfies switch case typeswitch try catch ' +
  'and or to union intersect instance of treat as castable cast map array ' +
  'delete insert into replace value rename copy modify update';

  // Node Types (sorted by inheritance)
  // atomic types (sorted by inheritance)
  var TYPE = 'item document-node node attribute document element comment namespace namespace-node processing-instruction text construction ' +
  'xs:anyAtomicType xs:untypedAtomic xs:duration xs:time xs:decimal xs:float xs:double xs:gYearMonth xs:gYear xs:gMonthDay xs:gMonth xs:gDay xs:boolean xs:base64Binary xs:hexBinary xs:anyURI xs:QName xs:NOTATION xs:dateTime xs:dateTimeStamp xs:date xs:string xs:normalizedString xs:token xs:language xs:NMTOKEN xs:Name xs:NCName xs:ID xs:IDREF xs:ENTITY xs:integer xs:nonPositiveInteger xs:negativeInteger xs:long xs:int xs:short xs:byte xs:nonNegativeInteger xs:unisignedLong xs:unsignedInt xs:unsignedShort xs:unsignedByte xs:positiveInteger xs:yearMonthDuration xs:dayTimeDuration';

  var LITERAL = 'eq ne lt le gt ge is ' +
    'self:: child:: descendant:: descendant-or-self:: attribute:: following:: following-sibling:: parent:: ancestor:: ancestor-or-self:: preceding:: preceding-sibling:: ' +
    'NaN';

  // functions (TODO: find regex for op: without breaking build)
  var BUILT_IN = {
    className: 'built_in',
    variants: [{
      begin: /\barray\:/,
      end: /(?:append|filter|flatten|fold\-(?:left|right)|for-each(?:\-pair)?|get|head|insert\-before|join|put|remove|reverse|size|sort|subarray|tail)\b/
    }, {
      begin: /\bmap\:/,
      end: /(?:contains|entry|find|for\-each|get|keys|merge|put|remove|size)\b/
    }, {
      begin: /\bmath\:/,
      end: /(?:a(?:cos|sin|tan[2]?)|cos|exp(?:10)?|log(?:10)?|pi|pow|sin|sqrt|tan)\b/
    }, {
      begin: /\bop\:/,
      end: /\(/,
      excludeEnd: true
    }, {
      begin: /\bfn\:/,
      end: /\(/,
      excludeEnd: true
    },
// do not highlight inbuilt strings as variable or xml element names
    {
      begin: /[^<\/\$\:'"-]\b(?:abs|accumulator\-(?:after|before)|adjust\-(?:date(?:Time)?|time)\-to\-timezone|analyze\-string|apply|available\-(?:environment\-variables|system\-properties)|avg|base\-uri|boolean|ceiling|codepoints?\-(?:equal|to\-string)|collation\-key|collection|compare|concat|contains(?:\-token)?|copy\-of|count|current(?:\-)?(?:date(?:Time)?|time|group(?:ing\-key)?|output\-uri|merge\-(?:group|key))?data|dateTime|days?\-from\-(?:date(?:Time)?|duration)|deep\-equal|default\-(?:collation|language)|distinct\-values|document(?:\-uri)?|doc(?:\-available)?|element\-(?:available|with\-id)|empty|encode\-for\-uri|ends\-with|environment\-variable|error|escape\-html\-uri|exactly\-one|exists|false|filter|floor|fold\-(?:left|right)|for\-each(?:\-pair)?|format\-(?:date(?:Time)?|time|integer|number)|function\-(?:arity|available|lookup|name)|generate\-id|has\-children|head|hours\-from\-(?:dateTime|duration|time)|id(?:ref)?|implicit\-timezone|in\-scope\-prefixes|index\-of|innermost|insert\-before|iri\-to\-uri|json\-(?:doc|to\-xml)|key|lang|last|load\-xquery\-module|local\-name(?:\-from\-QName)?|(?:lower|upper)\-case|matches|max|minutes\-from\-(?:dateTime|duration|time)|min|months?\-from\-(?:date(?:Time)?|duration)|name(?:space\-uri\-?(?:for\-prefix|from\-QName)?)?|nilled|node\-name|normalize\-(?:space|unicode)|not|number|one\-or\-more|outermost|parse\-(?:ietf\-date|json)|path|position|(?:prefix\-from\-)?QName|random\-number\-generator|regex\-group|remove|replace|resolve\-(?:QName|uri)|reverse|root|round(?:\-half\-to\-even)?|seconds\-from\-(?:dateTime|duration|time)|snapshot|sort|starts\-with|static\-base\-uri|stream\-available|string\-?(?:join|length|to\-codepoints)?|subsequence|substring\-?(?:after|before)?|sum|system\-property|tail|timezone\-from\-(?:date(?:Time)?|time)|tokenize|trace|trans(?:form|late)|true|type\-available|unordered|unparsed\-(?:entity|text)?\-?(?:public\-id|uri|available|lines)?|uri\-collection|xml\-to\-json|years?\-from\-(?:date(?:Time)?|duration)|zero\-or\-one)\b/,
    }, {
      begin: /\blocal\:/,
      end: /\(/,
      excludeEnd: true
    }, {
      begin: /\bzip\:/,
      end: /(?:zip\-file|(?:xml|html|text|binary)\-entry| (?:update\-)?entries)\b/
    }, {
      begin: /\b(?:util|db|functx|app|xdmp|xmldb)\:/,
      end: /\(/,
      excludeEnd: true
    }
  ]
  };

  var TITLE = {
    className: 'title',
    begin: /\bxquery version "[13]\.[01]"\s?(?:encoding ".+")?/,
    end: /;/
  };

  var VAR = {
    className: 'variable',
    begin: /[\$][\w-:]+/
  };

  var NUMBER = {
    className: 'number',
    begin: '(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b',
    relevance: 0
  };

  var STRING = {
    className: 'string',
    variants: [{
        begin: /"/,
        end: /"/,
        contains: [{
          begin: /""/,
          relevance: 0
        }]
      },
      {
        begin: /'/,
        end: /'/,
        contains: [{
          begin: /''/,
          relevance: 0
        }]
      }
    ]
  };

  var ANNOTATION = {
    className: 'meta',
    begin: /%[\w-:]+/
  };

  var COMMENT = {
    className: 'comment',
    begin: '\\(:',
    end: ':\\)',
    relevance: 10,
    contains: [{
      className: 'doctag',
      begin: '@\\w+'
    }]
  };

  // see https://www.w3.org/TR/xquery/#id-computedConstructors
  // mocha: computed_inbuilt
  // see https://www.regexpal.com/?fam=99749
  var COMPUTED = {
    beginKeywords: 'element attribute comment document processing-instruction',
    end: '{',
    excludeEnd: true
  };

  // mocha: direct_method
    var DIRECT = {
      begin: /<([\w\._:\-]+)((\s*.*)=('|").*('|"))?>/,
      end: /(\/[\w\._:\-]+>)/,
      subLanguage: 'xml',
      contains: [{
        begin: '{',
        end: '}',
        subLanguage: 'xquery'
      }, 'self']
    };


  var CONTAINS = [
    VAR,
    BUILT_IN,
    STRING,
    NUMBER,
    COMMENT,
    ANNOTATION,
    TITLE,
    COMPUTED,
    DIRECT
  ];



  return {
    aliases: ['xpath', 'xq'],
    case_insensitive: false,
    lexemes: /[a-zA-Z\$][a-zA-Z0-9_:\-]*/,
    illegal: /(proc)|(abstract)|(extends)|(until)|(#)/,
    keywords: {
      keyword: KEYWORDS,
      type: TYPE,
      literal: LITERAL
    },
    contains: CONTAINS
  };
};

var zephir = function(hljs) {
  var STRING = {
    className: 'string',
    contains: [hljs.BACKSLASH_ESCAPE],
    variants: [
      {
        begin: 'b"', end: '"'
      },
      {
        begin: 'b\'', end: '\''
      },
      hljs.inherit(hljs.APOS_STRING_MODE, {illegal: null}),
      hljs.inherit(hljs.QUOTE_STRING_MODE, {illegal: null})
    ]
  };
  var NUMBER = {variants: [hljs.BINARY_NUMBER_MODE, hljs.C_NUMBER_MODE]};
  return {
    aliases: ['zep'],
    case_insensitive: true,
    keywords:
      'and include_once list abstract global private echo interface as static endswitch ' +
      'array null if endwhile or const for endforeach self var let while isset public ' +
      'protected exit foreach throw elseif include __FILE__ empty require_once do xor ' +
      'return parent clone use __CLASS__ __LINE__ else break print eval new ' +
      'catch __METHOD__ case exception default die require __FUNCTION__ ' +
      'enddeclare final try switch continue endfor endif declare unset true false ' +
      'trait goto instanceof insteadof __DIR__ __NAMESPACE__ ' +
      'yield finally int uint long ulong char uchar double float bool boolean string' +
      'likely unlikely',
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.HASH_COMMENT_MODE,
      hljs.COMMENT(
        '/\\*',
        '\\*/',
        {
          contains: [
            {
              className: 'doctag',
              begin: '@[A-Za-z]+'
            }
          ]
        }
      ),
      hljs.COMMENT(
        '__halt_compiler.+?;',
        false,
        {
          endsWithParent: true,
          keywords: '__halt_compiler',
          lexemes: hljs.UNDERSCORE_IDENT_RE
        }
      ),
      {
        className: 'string',
        begin: '<<<[\'"]?\\w+[\'"]?$', end: '^\\w+;',
        contains: [hljs.BACKSLASH_ESCAPE]
      },
      {
        // swallow composed identifiers to avoid parsing them as keywords
        begin: /(::|->)+[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/
      },
      {
        className: 'function',
        beginKeywords: 'function', end: /[;{]/, excludeEnd: true,
        illegal: '\\$|\\[|%',
        contains: [
          hljs.UNDERSCORE_TITLE_MODE,
          {
            className: 'params',
            begin: '\\(', end: '\\)',
            contains: [
              'self',
              hljs.C_BLOCK_COMMENT_MODE,
              STRING,
              NUMBER
            ]
          }
        ]
      },
      {
        className: 'class',
        beginKeywords: 'class interface', end: '{', excludeEnd: true,
        illegal: /[:\(\$"]/,
        contains: [
          {beginKeywords: 'extends implements'},
          hljs.UNDERSCORE_TITLE_MODE
        ]
      },
      {
        beginKeywords: 'namespace', end: ';',
        illegal: /[\.']/,
        contains: [hljs.UNDERSCORE_TITLE_MODE]
      },
      {
        beginKeywords: 'use', end: ';',
        contains: [hljs.UNDERSCORE_TITLE_MODE]
      },
      {
        begin: '=>' // No markup, just a relevance booster
      },
      STRING,
      NUMBER
    ]
  };
};

highlight.registerLanguage('1c', _1c);
highlight.registerLanguage('abnf', abnf);
highlight.registerLanguage('accesslog', accesslog);
highlight.registerLanguage('actionscript', actionscript);
highlight.registerLanguage('ada', ada);
highlight.registerLanguage('angelscript', angelscript);
highlight.registerLanguage('apache', apache);
highlight.registerLanguage('applescript', applescript);
highlight.registerLanguage('arcade', arcade);
highlight.registerLanguage('cpp', cpp);
highlight.registerLanguage('arduino', arduino);
highlight.registerLanguage('armasm', armasm);
highlight.registerLanguage('xml', xml);
highlight.registerLanguage('asciidoc', asciidoc);
highlight.registerLanguage('aspectj', aspectj);
highlight.registerLanguage('autohotkey', autohotkey);
highlight.registerLanguage('autoit', autoit);
highlight.registerLanguage('avrasm', avrasm);
highlight.registerLanguage('awk', awk);
highlight.registerLanguage('axapta', axapta);
highlight.registerLanguage('bash', bash);
highlight.registerLanguage('basic', basic);
highlight.registerLanguage('bnf', bnf);
highlight.registerLanguage('brainfuck', brainfuck);
highlight.registerLanguage('cal', cal);
highlight.registerLanguage('capnproto', capnproto);
highlight.registerLanguage('ceylon', ceylon);
highlight.registerLanguage('clean', clean);
highlight.registerLanguage('clojure', clojure);
highlight.registerLanguage('clojure-repl', clojureRepl);
highlight.registerLanguage('cmake', cmake);
highlight.registerLanguage('coffeescript', coffeescript);
highlight.registerLanguage('coq', coq);
highlight.registerLanguage('cos', cos);
highlight.registerLanguage('crmsh', crmsh);
highlight.registerLanguage('crystal', crystal);
highlight.registerLanguage('cs', cs);
highlight.registerLanguage('csp', csp);
highlight.registerLanguage('css', css);
highlight.registerLanguage('d', d);
highlight.registerLanguage('markdown', markdown);
highlight.registerLanguage('dart', dart);
highlight.registerLanguage('delphi', delphi);
highlight.registerLanguage('diff', diff);
highlight.registerLanguage('django', django);
highlight.registerLanguage('dns', dns);
highlight.registerLanguage('dockerfile', dockerfile);
highlight.registerLanguage('dos', dos);
highlight.registerLanguage('dsconfig', dsconfig);
highlight.registerLanguage('dts', dts);
highlight.registerLanguage('dust', dust);
highlight.registerLanguage('ebnf', ebnf);
highlight.registerLanguage('elixir', elixir);
highlight.registerLanguage('elm', elm);
highlight.registerLanguage('ruby', ruby);
highlight.registerLanguage('erb', erb);
highlight.registerLanguage('erlang-repl', erlangRepl);
highlight.registerLanguage('erlang', erlang);
highlight.registerLanguage('excel', excel);
highlight.registerLanguage('fix', fix);
highlight.registerLanguage('flix', flix);
highlight.registerLanguage('fortran', fortran);
highlight.registerLanguage('fsharp', fsharp);
highlight.registerLanguage('gams', gams);
highlight.registerLanguage('gauss', gauss);
highlight.registerLanguage('gcode', gcode);
highlight.registerLanguage('gherkin', gherkin);
highlight.registerLanguage('glsl', glsl);
highlight.registerLanguage('gml', gml);
highlight.registerLanguage('go', go);
highlight.registerLanguage('golo', golo);
highlight.registerLanguage('gradle', gradle);
highlight.registerLanguage('groovy', groovy);
highlight.registerLanguage('haml', haml);
highlight.registerLanguage('handlebars', handlebars);
highlight.registerLanguage('haskell', haskell);
highlight.registerLanguage('haxe', haxe);
highlight.registerLanguage('hsp', hsp);
highlight.registerLanguage('htmlbars', htmlbars);
highlight.registerLanguage('http', http);
highlight.registerLanguage('hy', hy);
highlight.registerLanguage('inform7', inform7);
highlight.registerLanguage('ini', ini);
highlight.registerLanguage('irpf90', irpf90);
highlight.registerLanguage('isbl', isbl);
highlight.registerLanguage('java', java);
highlight.registerLanguage('javascript', javascript);
highlight.registerLanguage('jboss-cli', jbossCli);
highlight.registerLanguage('json', json);
highlight.registerLanguage('julia', julia);
highlight.registerLanguage('julia-repl', juliaRepl);
highlight.registerLanguage('kotlin', kotlin);
highlight.registerLanguage('lasso', lasso);
highlight.registerLanguage('ldif', ldif);
highlight.registerLanguage('leaf', leaf);
highlight.registerLanguage('less', less);
highlight.registerLanguage('lisp', lisp);
highlight.registerLanguage('livecodeserver', livecodeserver);
highlight.registerLanguage('livescript', livescript);
highlight.registerLanguage('llvm', llvm);
highlight.registerLanguage('lsl', lsl);
highlight.registerLanguage('lua', lua);
highlight.registerLanguage('makefile', makefile);
highlight.registerLanguage('mathematica', mathematica);
highlight.registerLanguage('matlab', matlab);
highlight.registerLanguage('maxima', maxima);
highlight.registerLanguage('mel', mel);
highlight.registerLanguage('mercury', mercury);
highlight.registerLanguage('mipsasm', mipsasm);
highlight.registerLanguage('mizar', mizar);
highlight.registerLanguage('perl', perl);
highlight.registerLanguage('mojolicious', mojolicious);
highlight.registerLanguage('monkey', monkey);
highlight.registerLanguage('moonscript', moonscript);
highlight.registerLanguage('n1ql', n1ql);
highlight.registerLanguage('nginx', nginx);
highlight.registerLanguage('nimrod', nimrod);
highlight.registerLanguage('nix', nix);
highlight.registerLanguage('nsis', nsis);
highlight.registerLanguage('objectivec', objectivec);
highlight.registerLanguage('ocaml', ocaml);
highlight.registerLanguage('openscad', openscad);
highlight.registerLanguage('oxygene', oxygene);
highlight.registerLanguage('parser3', parser3);
highlight.registerLanguage('pf', pf);
highlight.registerLanguage('pgsql', pgsql);
highlight.registerLanguage('php', php);
highlight.registerLanguage('plaintext', plaintext);
highlight.registerLanguage('pony', pony);
highlight.registerLanguage('powershell', powershell);
highlight.registerLanguage('processing', processing);
highlight.registerLanguage('profile', profile);
highlight.registerLanguage('prolog', prolog);
highlight.registerLanguage('properties', properties);
highlight.registerLanguage('protobuf', protobuf);
highlight.registerLanguage('puppet', puppet);
highlight.registerLanguage('purebasic', purebasic);
highlight.registerLanguage('python', python);
highlight.registerLanguage('q', q);
highlight.registerLanguage('qml', qml);
highlight.registerLanguage('r', r);
highlight.registerLanguage('reasonml', reasonml);
highlight.registerLanguage('rib', rib);
highlight.registerLanguage('roboconf', roboconf);
highlight.registerLanguage('routeros', routeros);
highlight.registerLanguage('rsl', rsl);
highlight.registerLanguage('ruleslanguage', ruleslanguage);
highlight.registerLanguage('rust', rust);
highlight.registerLanguage('sas', sas);
highlight.registerLanguage('scala', scala);
highlight.registerLanguage('scheme', scheme);
highlight.registerLanguage('scilab', scilab);
highlight.registerLanguage('scss', scss);
highlight.registerLanguage('shell', shell);
highlight.registerLanguage('smali', smali);
highlight.registerLanguage('smalltalk', smalltalk);
highlight.registerLanguage('sml', sml);
highlight.registerLanguage('sqf', sqf);
highlight.registerLanguage('sql', sql);
highlight.registerLanguage('stan', stan);
highlight.registerLanguage('stata', stata);
highlight.registerLanguage('step21', step21);
highlight.registerLanguage('stylus', stylus);
highlight.registerLanguage('subunit', subunit);
highlight.registerLanguage('swift', swift);
highlight.registerLanguage('taggerscript', taggerscript);
highlight.registerLanguage('yaml', yaml);
highlight.registerLanguage('tap', tap);
highlight.registerLanguage('tcl', tcl);
highlight.registerLanguage('tex', tex);
highlight.registerLanguage('thrift', thrift);
highlight.registerLanguage('tp', tp);
highlight.registerLanguage('twig', twig);
highlight.registerLanguage('typescript', typescript);
highlight.registerLanguage('vala', vala);
highlight.registerLanguage('vbnet', vbnet);
highlight.registerLanguage('vbscript', vbscript);
highlight.registerLanguage('vbscript-html', vbscriptHtml);
highlight.registerLanguage('verilog', verilog);
highlight.registerLanguage('vhdl', vhdl);
highlight.registerLanguage('vim', vim);
highlight.registerLanguage('x86asm', x86asm);
highlight.registerLanguage('xl', xl);
highlight.registerLanguage('xquery', xquery);
highlight.registerLanguage('zephir', zephir);

var lib = highlight;

class Field {
    constructor() {
        this.type = 'html';
        this.renderExample = node => {
            let code = node.assignedNodes().reduce((lines, line) => {
                if (line && line.nodeType === 1) {
                    lines.push(line.outerHTML);
                }
                return lines;
            }, []);
            const parsed = code.join('\n').replace(/"/g, "'").replace(/&quot;/g, '"').replace(/ class='hydrated'/g, '');
            this.code = lib.highlight(this.type, parsed, false).value;
        };
    }
    componentDidLoad() {
        const elem = this.el.shadowRoot.querySelector('slot');
        elem.addEventListener('slotchange', event => this.renderExample(event.target));
        this.renderExample(elem);
    }
    render() {
        return [
            h("slot", null),
            h("pre", null,
                h("code", Object.assign({ class: this.type }, { innerHTML: this.code })))
        ];
    }
    static get is() { return "c-code-sample"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "code": {
            "state": true
        },
        "el": {
            "elementRef": true
        },
        "type": {
            "type": String,
            "attr": "type"
        }
    }; }
    static get style() { return ".hljs{display:block;background:#fff;padding:.5em;color:#333;overflow-x:auto}.hljs-comment,.hljs-meta{color:#969896}.hljs-emphasis,.hljs-quote,.hljs-string,.hljs-strong,.hljs-template-variable,.hljs-variable{color:#df5000}.hljs-keyword,.hljs-selector-tag,.hljs-type{color:#a71d5d}.hljs-attribute,.hljs-bullet,.hljs-literal,.hljs-symbol{color:#0086b3}.hljs-name,.hljs-section{color:#63a35c}.hljs-tag{color:#333}.hljs-attr,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-selector-pseudo,.hljs-title{color:#795da3}.hljs-addition{color:#55a532;background-color:#eaffea}.hljs-deletion{color:#bd2c00;background-color:#ffecec}.hljs-link{text-decoration:underline}:host{display:block}slot{display:none}pre{white-space:pre-wrap;margin:0}"; }
}

export { Field as CCodeSample };
