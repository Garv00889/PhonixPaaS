/**
 * ==============================================================================
 * PHONIXPAAS — WORD-BY-WORD FADE-UP ANIMATION ENGINE
 * "Smooth, not too fast, best looking"
 * Staggered Word Reveal Engine throughout the platform
 * ==============================================================================
 */

(function () {
  'use strict';

  // Target selectors EXCLUSIVELY for the Main Context (Hero headline, subtitle, badge, CTAs)
  const DEFAULT_SELECTORS = [
    // Main Context Hero Elements
    '.rd-hero-content .rd-hero-badge span',
    '.rd-hero-content .rd-hero-title',
    '.rd-hero-content .rd-hero-subtitle',
    '.rd-hero-content .rd-hero-ctas .btn',
    '.rd-hero-badge span',
    '.rd-hero-title',
    '.rd-hero-subtitle',
    '.rd-hero-ctas .btn',

    // Explicit opt-in for any custom element marked as main context
    '.main-context',
    '[data-main-context]',
    '[data-word-fade]'
  ];

  // Disallowed tags and selectors that should NEVER be split
  const EXCLUDED_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'CANVAS', 'SVG', 'PATH', 'CIRCLE',
    'RECT', 'LINE', 'POLYGON', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'PRE', 'CODE'
  ]);

  const EXCLUDED_SELECTORS = [
    '.no-char-fade',
    '[data-no-char-fade]',
    '.rd-terminal',
    '.terminal-window',
    '#terminalOutput',
    '.rd-terminal-body',
    '.rd-code',
    'pre',
    'code',
    '.rd-avatar-circle',
    '.rd-dot',
    '#cyclingText' // Handled via dedicated cycling animator
  ];

  let observer = null;
  let isReducedMotion = false;
  let revealQueueIndex = 0;

  // Initialize engine
  function init() {
    isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    initIntersectionObserver();
    scanAndProcess(document.body);
    initMutationObserver();
    initHeroCyclingHook();
  }

  // Setup IntersectionObserver for scroll-triggered word cascades
  function initIntersectionObserver() {
    if (typeof IntersectionObserver === 'undefined') return;

    observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          revealElement(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0,
      rootMargin: '120px 0px 120px 0px'
    });
  }

  // Reveal element words with smooth cascade
  function revealElement(el) {
    if (!el) return;
    if (el.classList.contains('char-revealed')) return;

    const rect = el.getBoundingClientRect();
    const inViewport = rect.top < (window.innerHeight || 800) && rect.bottom > 0;
    const initialDelaySec = inViewport ? Math.min((revealQueueIndex++) * 0.035, 0.4) : 0;

    setTimeout(() => {
      if (el && !el.classList.contains('char-revealed')) {
        el.classList.add('char-revealed');
      }
    }, initialDelaySec * 1000);

    // Clean up after animation finishes to free compositor resources
    const maxDelay = parseFloat(el.getAttribute('data-word-max-delay') || '0.6');
    const totalDuration = (initialDelaySec + maxDelay + 0.75) * 1000;
    setTimeout(() => {
      if (el && el.isConnected) {
        el.classList.add('char-done');
      }
    }, totalDuration);
  }

  // Check if an element should be ignored
  function isExcluded(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return true;
    if (EXCLUDED_TAGS.has(el.tagName)) return true;
    if (el.hasAttribute('data-char-split')) return true;

    for (const sel of EXCLUDED_SELECTORS) {
      if (el.matches && el.matches(sel)) return true;
      if (el.closest && el.closest(sel)) return true;
    }

    // Skip pure numbers that look like real-time counters (e.g. "98%", "34.5°C")
    const text = el.textContent.trim();
    if (/^[\d.,%°C\s/:-]+$/.test(text) && text.length < 12 && !el.matches('h1, h2, h3, .rd-hero-title')) {
      return true;
    }

    return false;
  }

  // Recursively collect text nodes inside an element
  function getTextNodes(root) {
    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent || !node.textContent.trim()) {
          return NodeFilter.FILTER_SKIP;
        }
        let parent = node.parentElement;
        while (parent && parent !== root) {
          if (isExcluded(parent)) return NodeFilter.FILTER_REJECT;
          parent = parent.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }
    return textNodes;
  }

  // Core word splitting function
  function processElement(el, immediate = false) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (isExcluded(el)) return;

    // Check if element or parent has gradient text
    const isGradient = el.classList.contains('rd-gradient-text') ||
      !!(el.closest && el.closest('.rd-gradient-text')) ||
      window.getComputedStyle(el).webkitBackgroundClip === 'text';

    if (isGradient) {
      el.setAttribute('data-is-gradient', 'true');
    }

    const originalText = el.textContent;
    const textNodes = getTextNodes(el);
    if (textNodes.length === 0) return;

    // Store original text for screen readers (WCAG Accessibility)
    if (!el.hasAttribute('aria-label') && originalText.trim()) {
      el.setAttribute('aria-label', originalText.trim());
    }

    // Count words across all text nodes
    let totalWords = 0;
    textNodes.forEach(n => {
      const words = n.textContent.trim().split(/\s+/).filter(Boolean);
      totalWords += words.length;
    });

    // Dynamic stagger calculation for "smooth, not too fast, best looking"
    // Short titles/badges (1-5 words): 80ms per word
    // Medium sentences (6-15 words): 65ms per word
    // Longer text (paragraphs): 48ms per word, capped max delay at 1.1s
    let staggerSec = 0.080;
    if (totalWords > 15) staggerSec = 0.048;
    else if (totalWords > 5) staggerSec = 0.065;

    let wordCounter = 0;
    let maxWordDelay = 0;

    textNodes.forEach(textNode => {
      const text = textNode.textContent;
      if (!text) return;

      const tokens = text.split(/(\s+)/);
      const fragment = document.createDocumentFragment();

      tokens.forEach(token => {
        if (!token) return;

        // Preserved whitespace token
        if (/^\s+$/.test(token)) {
          const spaceSpan = document.createElement('span');
          spaceSpan.className = 'char-fade-space';
          spaceSpan.textContent = token;
          fragment.appendChild(spaceSpan);
          return;
        }

        // Word token — the unit of animation
        const wordSpan = document.createElement('span');
        wordSpan.className = 'char-fade-word';
        wordSpan.setAttribute('aria-hidden', 'true');
        wordSpan.textContent = token;

        // Compute smooth word delay
        const delay = wordCounter * staggerSec;
        wordSpan.style.setProperty('--word-delay', `${delay.toFixed(3)}s`);
        if (delay > maxWordDelay) maxWordDelay = delay;

        fragment.appendChild(wordSpan);
        wordCounter++;
      });

      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    });

    el.setAttribute('data-char-split', 'true');
    el.setAttribute('data-word-max-delay', maxWordDelay.toFixed(3));

    // Handle immediate reveal or register with IntersectionObserver
    if (immediate || isReducedMotion) {
      revealElement(el);
    } else if (observer) {
      observer.observe(el);
    } else {
      revealElement(el);
    }
  }

  // Scan a DOM container and process all matching targets
  function scanAndProcess(container = document.body) {
    if (!container || container.nodeType !== Node.ELEMENT_NODE) return;

    DEFAULT_SELECTORS.forEach(selector => {
      try {
        const matches = container.querySelectorAll(selector);
        matches.forEach(el => {
          if (!isExcluded(el) && !el.hasAttribute('data-char-split')) {
            processElement(el, false);
          }
        });
      } catch (e) {}
    });
  }

  // MutationObserver to automatically animate dynamically injected DOM nodes (dashboard views, modals, cards)
  function initMutationObserver() {
    if (typeof MutationObserver === 'undefined') return;

    let debounceTimer = null;
    const pendingNodes = new Set();

    const mutationObserver = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && !isExcluded(node)) {
              pendingNodes.add(node);
            }
          });
        }
      }

      if (pendingNodes.size > 0) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          pendingNodes.forEach(node => {
            if (node.isConnected) {
              DEFAULT_SELECTORS.forEach(sel => {
                try {
                  if (node.matches && node.matches(sel)) {
                    processElement(node, true);
                  }
                } catch (e) {}
              });
              scanAndProcess(node);
            }
          });
          pendingNodes.clear();
        }, 50);
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Hero Cycling Headline Text Animator (word-by-word)
  function initHeroCyclingHook() {
    const cyclingEl = document.getElementById('cyclingText');
    if (!cyclingEl) return;

    // Helper to animate new phrase word-by-word with fade-up
    window.animateCyclingWord = function (newPhrase) {
      if (!cyclingEl) return;

      cyclingEl.classList.remove('char-revealed');
      cyclingEl.innerHTML = '';

      const words = newPhrase.split(/(\s+)/);
      let wordIdx = 0;

      words.forEach(token => {
        if (!token) return;
        if (/^\s+$/.test(token)) {
          const space = document.createElement('span');
          space.className = 'char-fade-space';
          space.textContent = token;
          cyclingEl.appendChild(space);
          return;
        }

        const wordSpan = document.createElement('span');
        wordSpan.className = 'char-fade-word';
        wordSpan.setAttribute('aria-hidden', 'true');
        wordSpan.textContent = token;
        wordSpan.style.setProperty('--word-delay', `${(wordIdx * 0.110).toFixed(3)}s`);

        cyclingEl.appendChild(wordSpan);
        wordIdx++;
      });

      cyclingEl.setAttribute('aria-label', newPhrase);

      requestAnimationFrame(() => {
        cyclingEl.classList.add('char-revealed');
      });
    };

    // Initial render of first word
    const initialText = cyclingEl.textContent.trim() || 'recycled hardware';
    window.animateCyclingWord(initialText);
  }

  // Expose public API
  window.CharFadeUp = {
    init,
    processElement,
    scanAndProcess,
    revealElement,
    animateText: function (el, text) {
      if (!el) return;
      el.textContent = text;
      el.removeAttribute('data-char-split');
      el.classList.remove('char-revealed', 'char-done');
      processElement(el, true);
    },
    revealAll: function () {
      document.querySelectorAll('[data-char-split="true"]').forEach(el => revealElement(el));
    }
  };

  // Auto-boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
