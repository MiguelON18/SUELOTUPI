const carousel = document.querySelector('#shicras-carousel');
const slides = [...carousel.querySelectorAll('.shicras-slide')];
const controls = carousel.querySelector('.shicras-controls');
const count = controls.querySelector('.shicras-count');
let active = 0;

function showSlide(index) {
  active = (index + slides.length) % slides.length;
  slides.forEach((slide, i) => {
    slide.hidden = i !== active;
  });
  count.textContent = `${active + 1} de ${slides.length}`;
}

controls.querySelectorAll('button').forEach(button => {
  button.addEventListener('click', () => showSlide(active + Number(button.dataset.step)));
});
showSlide(0);
controls.hidden = false;
