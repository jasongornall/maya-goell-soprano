// ----- Reveal animations and the header settle -----
// WHY this file exists: the original Squarespace site animates
// its content with JavaScript: blocks fade in and rise a little,
// one by one, as they scroll into view. An earlier version of
// this remake tried to copy that with pure CSS scroll-driven
// animations (animation-timeline: view()), which whole families
// of browsers do not support (older Safari, Firefox without a
// flag, in-app webviews). In those browsers the hidden start
// states were skipped entirely and nothing ever moved: the
// content just sat there. So the motion now lives in CSS
// transitions in style.css (see the Motion section there), and
// this script's only job is to flip classes at the right
// moments. No JavaScript animates anything here: no animation
// loops, no tweening of styles, just class flips.
//
// The matching half of the setup is a short script in each
// page's <head> that adds a "js-reveal" class to <html> before
// anything paints. style.css starts .reveal blocks hidden ONLY
// under that class, so with JavaScript off, every block simply
// shows and nothing can be left invisible. This file sets
// window.mayaRevealReady as its first act; the head script
// checks that flag after a couple of seconds and takes the
// class back off if this file ever fails to load, so a missing
// animations.js can never leave a page blank either.
window.mayaRevealReady = true;

(function () {
  var blocks = document.querySelectorAll(".reveal");

  function show(block) { block.classList.add("revealed"); }
  function showAll() {
    for (var i = 0; i < blocks.length; i++) show(blocks[i]);
  }

  // Visitors who ask their system for reduced motion get no
  // reveal at all: everything is simply there. (style.css
  // removes the hidden start state for them too, so this is a
  // belt-and-braces second path, not the only one.)
  var reduceMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    // A browser too old for IntersectionObserver also lands
    // here: show everything at once rather than leave any of
    // it hidden.
    showAll();
  } else {
    // Each block is revealed once, as soon as a slice of it
    // (15%) enters the screen, then unwatched: the original
    // plays its animation once per element, not back and forth
    // as you scroll up and down. Blocks already on screen when
    // the page loads are reported by the observer right away,
    // so heroes and page titles reveal promptly on load.
    var watcher = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          show(entry.target);
          watcher.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    for (var i = 0; i < blocks.length; i++) watcher.observe(blocks[i]);
  }

  // ----- Header settle -----
  // The header starts transparent (with per-page text colors,
  // see "Header colors, per page" in style.css) and settles
  // into its solid cream bar once the visitor has scrolled a
  // little. The class flip is all that happens here; the
  // background, shadow and text colors ease over in style.css
  // transitions, so the settle works in every browser. 10px is
  // early enough that the bar is solid before anything can
  // slide awkwardly underneath it.
  var header = document.querySelector("header");
  if (header) {
    var settle = function () {
      header.classList.toggle("scrolled", window.scrollY > 10);
    };
    window.addEventListener("scroll", settle, { passive: true });
    settle();
  }
})();
