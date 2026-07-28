import { pbkdf2Sync, randomBytes } from "node:crypto";

async function readSecret() {
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8").trimEnd();
  }

  process.stdout.write("Admin password: ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      resolve(value);
    };
    process.stdin.on("data", (key) => {
      if (key === "\u0003") {
        process.stdin.setRawMode(false);
        reject(new Error("Cancelled"));
      } else if (key === "\r" || key === "\n") finish();
      else if (key === "\u007f" || key === "\b") value = value.slice(0, -1);
      else value += key;
    });
  });
}

const password = await readSecret();
if (password.length < 12) throw new Error("Use an administrator password with at least 12 characters.");
const iterations = 210_000;
const salt = randomBytes(18);
const derived = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const base64url = (value) => value.toString("base64url");
process.stdout.write(`pbkdf2$${iterations}$${base64url(salt)}$${base64url(derived)}\n`);
