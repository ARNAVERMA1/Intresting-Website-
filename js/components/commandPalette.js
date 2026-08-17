/**
 * Command palette — ⌘K / Ctrl+K, or press "/".
 *
 * Every hidden capability on the page has a discoverable home here: jump to a
 * section, toggle sound, regenerate or save your signature, enable motion
 * tilt on a phone. The easter eggs stay hidden (finding them is the reward),
 * but nothing *functional* is locked behind knowing a secret.
 *
 * Fully keyboard-driven, focus-trapped while open, and restores focus to
 * wherever you were when it closes.
 */
(function (global) {
  'use strict';

  function initCommandPalette(actions) {
    const overlay = document.createElement('div');
    overlay.className = 'ae-palette';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Command palette');
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="ae-palette-panel">
        <input class="ae-palette-input" type="text" placeholder="Type a command…"
               aria-label="Search commands" autocomplete="off" spellcheck="false" />
        <ul class="ae-palette-list" role="listbox" aria-label="Commands"></ul>
        <p class="ae-palette-hint"><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>↵</kbd> run · <kbd>esc</kbd> close</p>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.ae-palette-input');
    const list = overlay.querySelector('.ae-palette-list');

    let filtered = actions.slice();
    let activeIndex = 0;
    let open = false;
    let lastFocused = null;

    function render() {
      list.innerHTML = '';
      filtered.forEach((action, i) => {
        const li = document.createElement('li');
        li.className = 'ae-palette-item' + (i === activeIndex ? ' is-active' : '');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === activeIndex));
        li.innerHTML = `
          <span class="ae-palette-icon" aria-hidden="true">${action.icon || '◆'}</span>
          <span class="ae-palette-label">${action.label}</span>
          ${action.hint ? `<span class="ae-palette-meta">${action.hint}</span>` : ''}
        `;
        li.addEventListener('click', () => run(i));
        li.addEventListener('pointerenter', () => {
          activeIndex = i;
          render();
        });
        list.appendChild(li);
      });
      if (!filtered.length) {
        const li = document.createElement('li');
        li.className = 'ae-palette-empty';
        li.textContent = 'Nothing matches that.';
        list.appendChild(li);
      }
    }

    function filter(query) {
      const q = query.trim().toLowerCase();
      filtered = q
        ? actions.filter((a) => (a.label + ' ' + (a.keywords || '')).toLowerCase().includes(q))
        : actions.slice();
      activeIndex = 0;
      render();
    }

    function setOpen(next) {
      if (open === next) return;
      open = next;
      overlay.hidden = !open;
      overlay.classList.toggle('is-open', open);
      document.body.classList.toggle('ae-palette-open', open);

      if (open) {
        lastFocused = document.activeElement;
        input.value = '';
        filter('');
        requestAnimationFrame(() => input.focus());
      } else {
        lastFocused?.focus?.();
      }
    }

    function run(index) {
      const action = filtered[index];
      if (!action) return;
      setOpen(false);
      // Let the overlay finish closing before the action moves the page.
      setTimeout(() => action.run(), 60);
    }

    input.addEventListener('input', () => filter(input.value));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) setOpen(false);
    });

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
        render();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        run(activeIndex);
      } else if (e.key === 'Tab') {
        // Only the input is focusable inside, so trapping is just "stay put".
        e.preventDefault();
      }
    });

    window.addEventListener('keydown', (e) => {
      const typingInField =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      } else if (e.key === '/' && !open && !typingInField) {
        e.preventDefault();
        setOpen(true);
      }
    });

    render();

    return { open: () => setOpen(true), close: () => setOpen(false), toggle: () => setOpen(!open) };
  }

  global.AECommandPalette = { initCommandPalette };
})(window);
