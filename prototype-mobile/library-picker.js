/* Sélecteur personnalisé de la bibliothèque, conservant le select natif pour le filtrage. */
(() => {
  const init = () => {
    const native = document.getElementById('family-filter');
    if (!native || document.getElementById('family-picker-button')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'gp-family-picker';
    const button = document.createElement('button');
    button.type = 'button'; button.id = 'family-picker-button';
    button.className = 'gp-family-trigger';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const text = document.createElement('span');
    const arrow = document.createElement('span');
    arrow.className = 'gp-family-arrow'; arrow.textContent = '⌄';
    button.append(text, arrow);
    const list = document.createElement('div');
    list.className = 'gp-family-options'; list.id = 'gp-family-options';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', "Famille d’aliments");
    list.hidden = true;
    native.parentNode.insertBefore(wrapper, native);
    wrapper.append(native, button, list);
    native.classList.add('gp-native-family');
    native.tabIndex = -1;
    native.setAttribute('aria-hidden', 'true');
    const sync = () => {
      text.textContent = native.selectedOptions[0]?.textContent || 'Toutes les familles';
      list.querySelectorAll('[role=option]').forEach(el => {
        const active = el.dataset.value === native.value;
        el.setAttribute('aria-selected', String(active));
        el.classList.toggle('selected', active);
      });
    };
    const close = (focus = false) => {
      list.hidden = true; button.setAttribute('aria-expanded', 'false');
      if (focus) button.focus();
    };
    const open = () => {
      list.hidden = false; button.setAttribute('aria-expanded', 'true');
      const selected = list.querySelector('[aria-selected=true]');
      if (selected) selected.scrollIntoView({block:'nearest'});
    };
    Array.from(native.options).forEach(option => {
      const item = document.createElement('button');
      item.type = 'button'; item.className = 'gp-family-option';
      item.setAttribute('role', 'option');
      item.dataset.value = option.value;
      item.textContent = option.textContent;
      item.addEventListener('click', () => {
        native.value = item.dataset.value;
        native.dispatchEvent(new Event('change', {bubbles:true}));
        sync(); close(true);
      });
      list.appendChild(item);
    });
    sync();
    button.addEventListener('click', () => list.hidden ? open() : close());
    button.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); open();
        (list.querySelector('[aria-selected=true]') || list.querySelector('button'))?.focus();
      }
    });
    list.addEventListener('keydown', e => {
      const options = Array.from(list.querySelectorAll('button'));
      const index = options.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); options[(index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus();
      }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault(); options[e.key === 'Home' ? 0 : options.length-1]?.focus();
      }
    });
    document.addEventListener('pointerdown', e => {
      if (!wrapper.contains(e.target)) close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !list.hidden) close(true);
    });
    native.addEventListener('change', sync);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
