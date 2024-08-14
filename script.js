const scrollContainer1 = document.getElementById('scrollContainer1');
const scrollContainer2 = document.getElementById('scrollContainer2');
const scrollContainerBimbi = document.getElementById('scrollContainerBimbi');

const popup = document.getElementById('popup');
const popupClose = document.getElementById('popupClose');
const popupImage = document.getElementById('popupImage');
const popupPrev = document.getElementById('popupPrev');
const popupNext = document.getElementById('popupNext');

var numFoto=188;
var activeImg; 

function loadImages(scrollContainer, start,end) {
  for (let i = start; i <= end; i++) {
    const img = new Image();
    img.dataset.src = `file/foto/img-${i}.jpg`; // Assumi che le immagini siano nella stessa directory del file HTML
    img.alt = `Immagine ${i}`;
    img.classList.add('image');
    img.classList.add('lazy');
    img.addEventListener('click', ()=>{
        activeImg=i;
        console.log(activeImg)
        openPopup()
        });
    scrollContainer.appendChild(img);
  }
}

function openPopup() {
  popupImage.src = `file/foto/img-${activeImg}.jpg`;
  popup.style.display = 'flex';
}

function closePopup() {
  popup.style.display = 'none';
}

function nextImg(){
    console.log(activeImg)
    if(activeImg<numFoto){
        activeImg+=1;
    }else{
        activeImg=0;
    }
    openPopup()
}

function prevImg(){
    if(activeImg>0){
        activeImg-=1;
    }else{
        activeImg=numFoto;
    }
    openPopup()
}

popupClose.addEventListener('click', closePopup);

loadImages(scrollContainer1,0,84);
loadImages(scrollContainer2,85,169);
loadImages(scrollContainerBimbi,170,numFoto);

/*Lazy load image */ 
document.addEventListener("DOMContentLoaded", function() {
  const lazyImages = document.querySelectorAll('.lazy');

  const options = {
    root: null, // Usato come root element per il rilevamento dell'intersezione
    rootMargin: '0px', // Margine di root element
    threshold: 0.1 // Percentuale di intersezione per attivare l'azione
  };

  const lazyImageObserver = new IntersectionObserver(function(entries, observer) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        const lazyImage = entry.target;
        lazyImage.src = lazyImage.dataset.src;
        lazyImage.classList.remove('lazy');
        lazyImageObserver.unobserve(lazyImage);
      }
    });
  }, options);

  lazyImages.forEach(function(lazyImage) {
    lazyImageObserver.observe(lazyImage);
  });
});
