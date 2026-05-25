document.getElementById("build-time").textContent =
  new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

const greetings = [
  "hello, world",
  "ping received",
  "still alive",
  "all systems nominal",
  "shipped from the edge",
];

const btn = document.getElementById("ping");
const reply = document.getElementById("reply");

btn.addEventListener("click", () => {
  const msg = greetings[Math.floor(Math.random() * greetings.length)];
  reply.textContent = msg;
});
