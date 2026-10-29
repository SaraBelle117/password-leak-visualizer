# Reflection

**Course:** SE/CprE 4210 — Learning Sprint 3, Problem 5

**Team:** Hacker Team 8 (Sara Theriault)

## Experience

I picked this topic because I thought it would be fun to have a way to visualize/demonstrate just how big the gap is between brute force and timing side-channel attacks. During the process, I ended up wanting to try doing it on my own, which is why I ended up adding the "versus" mode. One part that was surprisingly tricky was for the versus mode. I wanted landing on a box to select the character already present, so typing would overwrite it. The issue was that the arrow keys' default behavior kept collapsing that selection and dropping the cursor before or after the character, so I overrode it with `e.preventDefault()`. 

## How it deepened my understanding

One cool part of this part of the learning sprint was I used a formula from another course at ISU (CPRE 4310), which is how I got the formula for calculating the number of guesses for brute-force (N = C^L: where C is the number of characters in the alphabet, and L is the key length). I also liked that having the versus mode demonstrates the "helplessness" against a timing side-channel attack, since the gap between the two is the whole point. Brute force is C^L, while the leak-driven attack is only about C x L, exponential versus linear. 

## Workflow

I used Claude (Opus 4.8) to assist with development in this project, but all design decisions were made by me. I started this project by taking some of the design elements from the previous learning sprint repository I made, and had Claude generate the initial skeleton of the HTML file. From there, I played around with what I had, and would tweak minor styling changes, and all features were my own suggestions, with implementation assisted by Claude to save time. If I had to change or add anything in the future, I would add a slider for decreasing/increasing the speed of the attacker, to illustrate the differences in cycles/computing power and how that speeds up an attack. I tested the visualizer by using it myself and trying to break it, switching the leak on and off, changing the character sets, and pausing mid-run, and checking each time that the attack still recovered the key and the counts looked correct. 