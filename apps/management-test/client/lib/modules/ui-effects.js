// ============================================================
//  ui-effects.js — Efeitos visuais e microinterações
// ============================================================

// ══════════════════════════════════════════════════════════
//  1. RIPPLE EFFECT - Material Design style
// ══════════════════════════════════════════════════════════

function createRipple(event) {
  const button = event.currentTarget;
  
  // Se já tem ripple-container, usa ela
  if (!button.classList.contains('ripple-container')) {
    button.classList.add('ripple-container');
  }
  
  const circle = document.createElement('span');
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;
  
  const rect = button.getBoundingClientRect();
  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - rect.left - radius}px`;
  circle.style.top = `${event.clientY - rect.top - radius}px`;
  circle.classList.add('ripple');
  
  const ripple = button.getElementsByClassName('ripple')[0];
  if (ripple) {
    ripple.remove();
  }
  
  button.appendChild(circle);
}

// Adiciona ripple em todos os botões automaticamente
function initRippleEffect() {
  document.addEventListener('click', (e) => {
    const button = e.target.closest('button, .btn, .home-card');
    if (button && !button.disabled) {
      createRipple(e);
    }
  }, true);
}

// ══════════════════════════════════════════════════════════
//  2. CONFETTI - Celebration effect
// ══════════════════════════════════════════════════════════

function createConfetti(options = {}) {
  const {
    count = 50,
    duration = 3000,
    origin = { x: 0.5, y: 0 }
  } = options;
  
  const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ffa07a'];
  
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-piece';
      
      // Posição inicial aleatória
      const startX = (origin.x * window.innerWidth) + (Math.random() - 0.5) * 400;
      confetti.style.left = `${startX}px`;
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      
      // Delay aleatório
      confetti.style.animationDelay = `${Math.random() * 0.5}s`;
      confetti.style.animationDuration = `${2 + Math.random()}s`;
      
      document.body.appendChild(confetti);
      
      setTimeout(() => confetti.remove(), duration);
    }, i * 30);
  }
}

// ══════════════════════════════════════════════════════════
//  3. SHAKE - Error feedback
// ══════════════════════════════════════════════════════════

function shakeElement(element) {
  if (typeof element === 'string') {
    element = document.querySelector(element);
  }
  
  if (!element) return;
  
  element.classList.add('animate-shake');
  setTimeout(() => {
    element.classList.remove('animate-shake');
  }, 500);
}

// ══════════════════════════════════════════════════════════
//  4. PULSE - Attention grabber
// ══════════════════════════════════════════════════════════

function pulseElement(element, duration = 2000) {
  if (typeof element === 'string') {
    element = document.querySelector(element);
  }
  
  if (!element) return;
  
  element.classList.add('animate-pulse');
  setTimeout(() => {
    element.classList.remove('animate-pulse');
  }, duration);
}

// ══════════════════════════════════════════════════════════
//  5. SKELETON LOADING - Placeholder states
// ══════════════════════════════════════════════════════════

function createSkeleton(container, type = 'text', count = 3) {
  if (typeof container === 'string') {
    container = document.querySelector(container);
  }
  
  if (!container) return;
  
  container.innerHTML = '';
  
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = `skeleton skeleton-${type}`;
    
    if (type === 'text') {
      skeleton.style.width = `${60 + Math.random() * 40}%`;
    }
    
    container.appendChild(skeleton);
  }
}

function removeSkeleton(container) {
  if (typeof container === 'string') {
    container = document.querySelector(container);
  }
  
  if (!container) return;
  
  const skeletons = container.querySelectorAll('.skeleton');
  skeletons.forEach(s => s.remove());
}

// ══════════════════════════════════════════════════════════
//  6. TOAST IMPROVEMENTS - Enhanced showToast
// ══════════════════════════════════════════════════════════

const originalShowToast = window.showToast;

window.showToast = function(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  // Remove classes antigas
  toast.className = 'toast';
  
  // Adiciona classe de tipo
  toast.classList.add(`toast-${type}`);
  
  // Define ícone baseado no tipo
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  const icon = icons[type] || '';
  toast.innerHTML = `
    ${icon ? `<span class="toast-icon">${icon}</span>` : ''}
    <span class="toast-message">${message}</span>
  `;
  
  // Animação de entrada
  toast.classList.add('show');
  toast.style.display = 'flex';
  
  // Auto-hide
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
      toast.style.display = 'none';
      toast.classList.remove('hide');
    }, 300);
  }, duration);
  
  // Celebração em success
  if (type === 'success') {
    setTimeout(() => {
      createConfetti({ count: 30, duration: 2000 });
    }, 100);
  }
  
  // Shake em error
  if (type === 'error') {
    shakeElement(toast);
  }
};

// ══════════════════════════════════════════════════════════
//  7. PAGE TRANSITIONS - Smooth view changes
// ══════════════════════════════════════════════════════════

const originalGoModule = window.goModule;
const originalGoHome = window.goHome;

if (originalGoModule) {
  window.goModule = function(module) {
    const currentViewEl = document.querySelector('[id^="view-"]:not([style*="display: none"])');
    
    if (currentViewEl) {
      currentViewEl.classList.add('view-transition-exit');
      setTimeout(() => {
        originalGoModule(module);
        const newViewEl = document.querySelector('[id^="view-"]:not([style*="display: none"])');
        if (newViewEl) {
          newViewEl.classList.add('view-transition-enter');
          setTimeout(() => {
            newViewEl.classList.remove('view-transition-enter');
          }, 400);
        }
      }, 150);
    } else {
      originalGoModule(module);
    }
  };
}

if (originalGoHome) {
  window.goHome = function() {
    const currentViewEl = document.querySelector('[id^="view-"]:not([style*="display: none"])');
    
    if (currentViewEl && currentViewEl.id !== 'view-home') {
      currentViewEl.classList.add('view-transition-exit');
      setTimeout(() => {
        originalGoHome();
        const homeEl = document.getElementById('view-home');
        if (homeEl) {
          homeEl.classList.add('view-transition-enter');
          setTimeout(() => {
            homeEl.classList.remove('view-transition-enter');
          }, 400);
        }
      }, 150);
    } else {
      originalGoHome();
    }
  };
}

// ══════════════════════════════════════════════════════════
//  8. SMOOTH SCROLL TO ELEMENT
// ══════════════════════════════════════════════════════════

function scrollToElement(element, offset = 0) {
  if (typeof element === 'string') {
    element = document.querySelector(element);
  }
  
  if (!element) return;
  
  const y = element.getBoundingClientRect().top + window.pageYOffset + offset;
  window.scrollTo({ top: y, behavior: 'smooth' });
}

// ══════════════════════════════════════════════════════════
//  9. PROGRESSIVE IMAGE LOADING
// ══════════════════════════════════════════════════════════

function loadImageWithFade(img) {
  if (img.complete) {
    img.classList.add('animate-fade-in');
  } else {
    img.addEventListener('load', () => {
      img.classList.add('animate-fade-in');
    });
  }
}

// ══════════════════════════════════════════════════════════
//  10. STAGGER ANIMATION HELPER
// ══════════════════════════════════════════════════════════

function staggerAnimation(elements, animationClass = 'animate-fade-in-up', delay = 50) {
  if (typeof elements === 'string') {
    elements = document.querySelectorAll(elements);
  }
  
  elements.forEach((el, index) => {
    setTimeout(() => {
      el.classList.add(animationClass);
    }, index * delay);
  });
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRippleEffect);
} else {
  initRippleEffect();
}

console.log('✨ UI effects loaded! Ripple, confetti, animations ready.');
