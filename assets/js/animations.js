// Scroll-based animations using Intersection Observer API
// Vanilla JS - no dependencies

document.addEventListener('DOMContentLoaded', function() {
  // Set up Intersection Observer for fade-in animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver(function(entries, observer) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all sections with fade-in class
  const sections = document.querySelectorAll('.section');
  sections.forEach(section => {
    observer.observe(section);
  });

  // Add subtle parallax effect to header
  const header = document.querySelector('header');
  if (header) {
    window.addEventListener('scroll', function() {
      const scrollPosition = window.pageYOffset;
      const opacity = 1 - Math.min(scrollPosition / 300, 0.8);
      header.style.opacity = opacity;
    });
  }

  // Add hover effects to cards
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-4px)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });
});