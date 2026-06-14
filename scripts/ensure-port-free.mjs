import { execFileSync } from "node:child_process";

const port = process.argv[2];

if (!port || !/^\d+$/.test(port)) {
  console.error("Usage: node scripts/ensure-port-free.mjs <port>");
  process.exit(1);
}

function listPidsOnPort(targetPort) {
  try {
    const output = execFileSync(
      "lsof",
      ["-ti", `tcp:${targetPort}`, "-sTCP:LISTEN"],
      { encoding: "utf8" }
    );

    return output
      .split("\n")
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const pids = [...new Set(listPidsOnPort(port))];

for (const pid of pids) {
  if (pid === process.pid) {
    continue;
  }

  console.log(`Freeing port ${port}: stopping process ${pid}`);
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
  }
}

if (pids.length > 0) {
  await sleep(1000);
}

for (const pid of listPidsOnPort(port)) {
  console.log(`Freeing port ${port}: force-stopping process ${pid}`);
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
  }
}
