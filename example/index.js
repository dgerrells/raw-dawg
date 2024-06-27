import { fromRaw, toRaw } from "../src/index";

document.getElementById("convertBtn").addEventListener("click", () => {
  const example = {
    a: 1.23,
    b: "hello world",
    c: [1, 2, "a", { b: "ya" }],
    d: {
      e: {
        x: 1,
        y: -22,
        z: "oof",
      },
      isTrue: false,
      isYa: undefined,
    },
    isFalse: null,
  };
  console.log(example, toRaw(example), fromRaw(toRaw(example)));

  const jsonInput = document.querySelector("#jsonInput").value;
  if (!jsonInput) {
    return;
  }

  try {
    const encoder = new TextEncoder();
    // 10mb max size;
    const buff = new Uint8Array(10000000);
    const object = JSON.parse(jsonInput);
    const rawDawgEncoded = toRaw(object, buff);

    console.log(fromRaw(rawDawgEncoded));

    console.table([
      ["lib", "encode", "decode", "size", "gzip"],
      [
        "raw-dawg",
        measurePerformance(() => {
          toRaw(object, buff);
        }),
        measurePerformance(() => {
          fromRaw(rawDawgEncoded);
        }),
        `${(toRaw(object, buff).length / 1000).toFixed(2)} kb`,
        "tbd",
      ],
      [
        "json",
        measurePerformance(() => JSON.stringify(object)),
        measurePerformance(() => JSON.parse(jsonInput)),
        `${(encoder.encode(JSON.stringify(object)).length / 1000).toFixed(
          2
        )} kb`,
        "tbd",
      ],
    ]);
  } catch (e) {
    console.log("oops", e);
  }
});

function measurePerformance(fn, numSamples = 100) {
  const start = performance.now(); // Get the current time in milliseconds

  for (let i = 0; i < numSamples; i++) {
    fn(); // Execute the input function
  }

  const end = performance.now(); // Get the current time after running the function

  // Calculate the average execution time in milliseconds
  const averageTime = (end - start) / numSamples;

  return averageTime;
}

console.log(
  JSON.stringify({
    player: {
      loc: {
        x: 12,
        y: -1,
        z: 0,
      },
      health: 122,
      name: "jackson",
      id: "dJsj34J2(3",
    },
    bullets: new Array(1000).fill("").map(() => ({
      loc: {
        x: Math.random() * 100,
        y: Math.random() * 100,
        z: Math.random() * 100,
      },
      speed: Math.random() * 10,
      dir: {
        x: 2,
        y: Math.random(),
        z: Math.random() * 10,
      },
    })),
    enemies: new Array(1000).fill("").map(() => ({
      loc: {
        x: Math.random() * 100,
        y: Math.random() * 100,
        z: Math.random() * 100,
      },
      speed: Math.random() * 10,
      health: 20,
      dir: {
        x: 2,
        y: Math.random(),
        z: Math.random() * 10,
      },
      type: 45,
      bool: Math.random() < 0.5,
    })),
    input: {
      isTouchDown: false,
      loc: {
        x: 12,
        y: 399,
      },
    },
  })
);
