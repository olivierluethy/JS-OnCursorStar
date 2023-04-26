document.addEventListener('DOMContentLoaded', function() {
    const myClass = document.querySelector(".cursorInfoAnimate"); // Selects the element with the class "cursorInfoAnimate"
    let counter = 0; // Initializes the counter variable to 0
    let mouseX = 0; // Initializes the mouseX variable to 0
    let mouseY = 0; // Initializes the mouseY variable to 0

    myClass.addEventListener('mousemove', function(event) { // Adds an event listener for mousemove events on the selected element
        mouseX = event.clientX - myClass.offsetLeft; // Calculates the x-coordinate of the mouse relative to the selected element
        mouseY = event.clientY - myClass.offsetTop; // Calculates the y-coordinate of the mouse relative to the selected element
    });

    setInterval(() => { // Repeatedly executes a function at a specified interval (50 milliseconds in this case)
        if (myClass.matches(':hover')) { // Checks if the selected element is being hovered over by the mouse
            const displayedNumber = document.createElement('div'); // Creates a new <div> element
            displayedNumber.className = 'number'; // Sets the class of the new element to "number"
            displayedNumber.innerHTML = counter; // Sets the innerHTML of the new element to the value of the counter variable
            displayedNumber.style.top = `${mouseY}px`; // Sets the top CSS property of the new element to the y-coordinate of the mouse
            displayedNumber.style.left = `${mouseX}px`; // Sets the left CSS property of the new element to the x-coordinate of the mouse
            myClass.appendChild(displayedNumber); // Appends the new element as a child of the selected element

            // Toggle the counter between 0 and 1
            counter = counter === 0 ? 1 : 0; // Toggles the value of the counter variable between 0 and 1

            setTimeout(() => { // Executes a function after a specified delay (1 millisecond in this case)
                displayedNumber.style.top = `${myClass.offsetHeight}px`; // Sets the top CSS property of the new element to be just below the bottom edge of the selected element
                setTimeout(() => { // Executes a function after a specified delay (750 milliseconds in this case)
                    displayedNumber.remove(); // Removes the new element from its parent
                }, 750);
            }, 1);
        }
    }, 50);
});