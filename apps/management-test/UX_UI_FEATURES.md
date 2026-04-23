# 🎨 Melhorias de UX/UI - Atalhos e Animações

## ⌨️ Atalhos de Teclado

O sistema agora possui atalhos de teclado para agilizar a navegação e ações!

### Navegação
| Atalho | Ação |
|--------|------|
| `Ctrl+H` | Voltar para HOME |
| `Esc` | Voltar / Fechar modal |
| `Ctrl+1` | Abrir TRADE |
| `Ctrl+2` | Abrir HUBR |
| `Ctrl+3` | Abrir RAIO (ROPS) |
| `Ctrl+4` | Abrir WMS |
| `Ctrl+5` | Executar Teste |

### Ações
| Atalho | Ação |
|--------|------|
| `Ctrl+S` | Salvar/Gerar (contexto atual) |
| `Ctrl+N` | Novo/Limpar (contexto atual) |
| `Ctrl+E` | Exportar (contexto atual) |
| `Ctrl+K` ou `?` | Mostrar menu de atalhos |

### Utilitários
| Atalho | Ação |
|--------|------|
| `Ctrl+L` | Alternar tema claro/escuro |
| `Ctrl+R` | Recarregar dados |

**Dica:** Pressione `Ctrl` e verá uma dica visual mostrando que pode usar `K` para ver todos os atalhos!

---

## ✨ Animações e Microinterações

### 1. **Ripple Effect**
- Efeito Material Design em todos os botões e cards
- Feedback visual ao clicar
- Ativa automaticamente em: `button`, `.btn`, `.home-card`

```javascript
// Uso manual (opcional):
createRipple(event);
```

### 2. **Confetti 🎉**
- Celebração ao completar ações com sucesso
- Ativa automaticamente ao mostrar toast de sucesso
- Personalizável via JavaScript

```javascript
// Uso manual:
createConfetti({
  count: 50,        // Quantidade de confetes
  duration: 3000,   // Duração em ms
  origin: { x: 0.5, y: 0 }  // Posição inicial
});
```

### 3. **Shake - Feedback de Erro**
- Balança o elemento quando há erro
- Ativa automaticamente em toasts de erro

```javascript
// Uso manual:
shakeElement('#meu-elemento');
// ou
shakeElement(document.querySelector('.my-class'));
```

### 4. **Pulse - Chamar Atenção**
- Pulsa um elemento para chamar atenção

```javascript
pulseElement('#elemento', 2000); // 2 segundos
```

### 5. **Skeleton Loading**
- Estados de carregamento elegantes

```javascript
// Criar skeletons
createSkeleton('#container', 'text', 3);  // 3 linhas de texto
createSkeleton('#container', 'title', 1); // 1 título

// Remover quando carregar
removeSkeleton('#container');
```

### 6. **Toast Aprimorado**
- Agora com tipos visuais distintos: `success`, `error`, `warning`, `info`
- Ícones automáticos
- Confetti em success, shake em error

```javascript
showToast('Mensagem', 'success', 3000);
showToast('Erro ao salvar', 'error');
showToast('Cuidado!', 'warning');
showToast('Informação útil', 'info');
```

### 7. **Transições de Página**
- Animações suaves ao trocar entre views
- Fade in/out automático

### 8. **Stagger Animation**
- Anima elementos sequencialmente com delay

```javascript
staggerAnimation('.home-card', 'animate-fade-in-up', 50);
```

---

## 🎨 Classes CSS de Animação

### Classes Utilitárias
```css
.animate-fade-in         /* Fade simples */
.animate-fade-in-up      /* Fade + slide de baixo pra cima */
.animate-fade-in-down    /* Fade + slide de cima pra baixo */
.animate-slide-in-right  /* Slide da direita */
.animate-slide-in-left   /* Slide da esquerda */
.animate-scale-in        /* Escala de pequeno pra normal */
.animate-bounce          /* Pula */
.animate-shake           /* Balança */
.animate-pulse           /* Pulsa */
.animate-spin            /* Gira */
```

### Classes de Transição
```css
.transition-all       /* Transição suave em tudo */
.transition-fast      /* Transição rápida (150ms) */
.transition-slow      /* Transição lenta (400ms) */
.transition-colors    /* Apenas cores */
.transition-transform /* Apenas transform */
```

### Efeitos de Hover
```css
.hover-lift        /* Levanta ao passar mouse */
.hover-glow        /* Brilho ao passar mouse */
.hover-scale       /* Aumenta ao passar mouse */
.hover-brightness  /* Fica mais claro ao passar mouse */
```

---

## 🌓 Tema Claro/Escuro

O app agora suporta tema claro! 

- **Alternar:** `Ctrl+L` ou via JavaScript
- **Persistência:** Salvo automaticamente no localStorage
- **Padrão:** Tema escuro

```javascript
// Via JavaScript:
toggleTheme();

// Ou manualmente:
document.documentElement.setAttribute('data-theme', 'light');
document.documentElement.setAttribute('data-theme', 'dark');
```

---

## 🎯 Boas Práticas de Uso

### 1. **Animações em Listas/Grids**
Use `staggerAnimation` para animar múltiplos elementos:
```javascript
// Ao carregar lista de produtos
staggerAnimation('.product-item', 'animate-fade-in-up', 50);
```

### 2. **Feedback de Loading**
Use skeletons enquanto carrega dados:
```javascript
createSkeleton('#product-list', 'text', 5);
// ... fetch data ...
removeSkeleton('#product-list');
// render real data
```

### 3. **Feedback de Ações**
```javascript
// Success
showToast('NF gerada com sucesso!', 'success');

// Error
showToast('Erro ao conectar com Salesforce', 'error');

// Warning
showToast('Alguns produtos estão fora de estoque', 'warning');

// Info
showToast('Carregando produtos...', 'info', 2000);
```

### 4. **Scroll Suave**
```javascript
scrollToElement('#secao-nf', -100); // offset de -100px
```

---

## ♿ Acessibilidade

O sistema respeita preferências de acessibilidade:

```css
@media (prefers-reduced-motion: reduce) {
  /* Todas as animações são reduzidas a ~0ms */
}
```

Usuários que configuraram "reduzir movimento" no sistema operacional terão animações mínimas.

---

## 📱 Responsividade

Todas as animações e atalhos funcionam perfeitamente em:
- Desktop (Windows, Mac, Linux)
- Tablet
- Mobile (toques em vez de ripple em alguns casos)

---

## 🚀 Performance

- **Ripple:** Usa CSS animations (GPU accelerated)
- **Confetti:** Remove elementos do DOM automaticamente
- **Skeletons:** CSS puro, sem JavaScript durante loading
- **Transitions:** Apenas transform e opacity (60fps garantido)

---

## 📝 Changelog

### v38 - UX/UI Overhaul
- ✨ Sistema completo de keyboard shortcuts
- 🎨 Ripple effect em todos os botões
- 🎉 Confetti em ações de sucesso
- 💫 17 tipos de animações CSS
- 🌓 Suporte a tema claro/escuro
- 🔔 Toast aprimorado com tipos visuais
- 📐 Transições suaves entre páginas
- ⚡ Performance otimizada

---

## 🎓 Exemplos Práticos

### Criar NF com Feedback Completo
```javascript
async function createNFWithFeedback() {
  // Loading
  createSkeleton('#nf-preview', 'text', 5);
  showToast('Gerando Nota Fiscal...', 'info', 2000);
  
  try {
    await generateNF();
    removeSkeleton('#nf-preview');
    showToast('✅ NF criada com sucesso!', 'success');
    // Confetti automático!
  } catch (error) {
    removeSkeleton('#nf-preview');
    showToast('❌ Erro ao gerar NF', 'error');
    shakeElement('#generate-btn');
  }
}
```

### Animar Grid ao Carregar
```javascript
function renderProducts(products) {
  const grid = document.getElementById('product-grid');
  grid.innerHTML = products.map(p => `<div class="product-card">...</div>`).join('');
  
  // Anima cada card com delay
  staggerAnimation('.product-card', 'animate-fade-in-up', 60);
}
```

---

💡 **Dica Final:** Pressione `Ctrl+K` ou `?` no app para ver todos os atalhos disponíveis!
