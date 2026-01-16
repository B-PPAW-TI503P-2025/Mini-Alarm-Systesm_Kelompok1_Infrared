// Function to apply theme
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Change icon
  const icon = document.getElementById('themeIcon');
  if(icon) {
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

// Function to toggle
function toggleTheme() {
  const current = localStorage.getItem('theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
}

// Initial load (Run immediately)
(function() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();