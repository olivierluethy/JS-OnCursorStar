document.addEventListener('DOMContentLoaded', function() {
    const myClass = document.querySelector(".cursorInfoAnimate");
    let counter = 0;
    let mouseX = 0;
    let mouseY = 0;

    myClass.addEventListener('mousemove', function(event) {
        mouseX = event.clientX - myClass.offsetLeft;
        mouseY = event.clientY - myClass.offsetTop;
    });

    setInterval(() => {
      if(myClass.matches(':hover')){
        const displayedNumber = document.createElement('div');
        displayedNumber.className = 'number';
        displayedNumber.innerHTML = counter;
        displayedNumber.style.top = `${mouseY}px`;
        displayedNumber.style.left = `${mouseX}px`;
        myClass.appendChild(displayedNumber);
  
        // Toggle the counter between 0 and 1
        counter = counter === 0 ? 1 : 0;
  
        setTimeout(() => {
          displayedNumber.style.top = `${myClass.offsetHeight}px`;
          setTimeout(() => {
            displayedNumber.remove();
          }, 750);
        }, 1);
      }
    }, 50);
});
