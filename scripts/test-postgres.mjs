import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import path from "node:path";

export const TEST_FILES = ["app/*.test.mjs", "server/*.test.mjs", "test-support/*.test.mjs"];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isMac = process.platform === "darwin";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let activeChild = null;

export function testEnvironment(source = process.env) {
  return {...source, REED_TEST_POSTGRES_REQUIRED: "1", PG_POOL_SIZE: source.PG_POOL_SIZE || "8"};
}

export function loopbackConnectionString(port) {
  return `postgres://postgres:postgres@127.0.0.1:${port}/reedleaves_test`;
}

export function publishedPort(output) {
  const match = String(output).match(/127\.0\.0\.1:(\d+)/);
  if (!match) throw new Error(`Docker no devolvió un puerto loopback válido: ${String(output).trim()}`);
  return Number(match[1]);
}

function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd: root, stdio: options.stdio || "inherit", env: options.env || process.env});
    let stdout = "";
    let stderr = "";
    activeChild = child;
    if (child.stdout) child.stdout.setEncoding("utf8").on("data", chunk => stdout += chunk);
    if (child.stderr) child.stderr.setEncoding("utf8").on("data", chunk => stderr += chunk);
    child.once("error", error => {
      if (activeChild === child) activeChild = null;
      reject(error);
    });
    child.once("close", (code, signal) => {
      if (activeChild === child) activeChild = null;
      options.onClose?.(child);
      resolve({code, signal, stdout, stderr});
    });
    options.onChild?.(child);
  });
}

export function signalExitCode(signal) {
  return signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : null;
}

export async function runUnlessInterrupted(signal, action) {
  const exitCode = signalExitCode(signal);
  if (exitCode !== null) return {interrupted: true, exitCode};
  return {interrupted: false, value: await action()};
}

export async function removeTemporaryContainer({containerId, containerName, contextArgs = [], runCommand = run}) {
  const target = containerId || containerName;
  if (!target) return;
  const result = await runCommand("docker", [...contextArgs, "rm", "--force", target], {stdio: "ignore"});
  if (result.code !== 0) throw new Error(`No se pudo retirar el contenedor temporal ${target}; npm test falla. Ejecuta docker rm --force ${target} para retirarlo.`);
}

async function commandExists(command) {
  const result = await run("which", [command], {stdio: "ignore"});
  return result.code === 0;
}

async function docker(args, options = {}) {
  const context = options.context;
  return run("docker", [...(context ? ["--context", context] : []), ...args], options);
}

function assertSuccess(result, description) {
  if (result.code !== 0) throw new Error(`${description} (salida ${result.code ?? result.signal ?? "desconocida"}).`);
}

async function ensureDockerAvailable() {
  let hasDocker = await commandExists("docker");
  let hasColima = isMac && await commandExists("colima");
  if (!hasDocker || (isMac && !hasColima)) {
    if (!isMac) throw new Error("Docker no está disponible. Instala Docker Engine y vuelve a ejecutar npm test.");
    if (!await commandExists("brew")) {
      throw new Error("Falta Docker o Colima y Homebrew no está disponible. Instala Homebrew, Docker CLI y Colima; después vuelve a ejecutar npm test.");
    }
    console.log("Preparando Docker CLI y Colima con Homebrew…");
    assertSuccess(await run("brew", ["install", ...(!hasDocker ? ["docker"] : []), ...(!hasColima ? ["colima"] : [])]), "No se pudieron instalar los requisitos con Homebrew");
    hasDocker = await commandExists("docker");
    hasColima = await commandExists("colima");
  }
  if (!hasDocker) throw new Error("No se encontró el ejecutable docker después de instalarlo. Revisa PATH y vuelve a ejecutar npm test.");
  return {hasColima};
}

async function dockerContext() {
  const result = await docker(["context", "show"], {stdio: "pipe"});
  return result.code === 0 ? result.stdout.trim() : null;
}

async function daemonReady(context) {
  const info = await docker(["info", "--format", "{{.ServerVersion}}"], {stdio: "pipe", context});
  return info.code === 0;
}

async function startRuntime({hasColima, originalContext}) {
  const contexts = new Set([originalContext].filter(Boolean));
  if (hasColima) {
    console.log("Iniciando Colima para las pruebas…");
    const started = await run("colima", ["start", "--activate=false"]);
    assertSuccess(started, "No se pudo iniciar Colima");
    contexts.add("colima");
  }
  if (isMac) {
    const desktop = await run("open", ["-Ra", "Docker"], {stdio: "ignore"});
    if (desktop.code === 0) {
      console.log("Iniciando Docker Desktop…");
      const opened = await run("open", ["-a", "Docker"]);
      assertSuccess(opened, "No se pudo iniciar Docker Desktop");
      const listed = await docker(["context", "ls", "--format", "{{.Name}}"], {stdio: "pipe"});
      for (const name of listed.stdout.split(/\r?\n/).map(value => value.trim())) if (/desktop/i.test(name)) contexts.add(name);
    }
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    for (const context of contexts) if (await daemonReady(context)) return context;
    await sleep(1000);
  }
  throw new Error("Docker/Colima está instalado, pero el daemon no arrancó. Inicia Docker Desktop o ejecuta `colima start`, y vuelve a ejecutar npm test.");
}

async function prepareRuntime() {
  const availability = await ensureDockerAvailable();
  const originalContext = await dockerContext();
  if (await daemonReady(originalContext)) return originalContext;
  return startRuntime({...availability, originalContext});
}

export async function runLocalPostgresTests({env = process.env, command, runtime = prepareRuntime, randomId = randomUUID} = {}) {
  const execute = command || ((testEnv) => run(process.execPath, ["--import", "./test-support/offline.mjs", "--test", "--test-concurrency=2", ...TEST_FILES], {env: testEnv}));
  if (env.REED_TEST_POSTGRES_URL) {
    const result = await execute(testEnvironment(env));
    return result.code ?? (result.signal === "SIGINT" ? 130 : 143);
  }
  const context = await runtime();
  const containerName = `reedleaves-test-postgres-${process.pid}-${randomId().slice(0, 8)}`;
  const dockerContextArgs = context ? ["--context", context] : [];
  let containerId = null;
  let child = null;
  let signal = null;
  const handleSignal = received => { signal ||= received; (child || activeChild)?.kill(received); };
  const onInt = () => handleSignal("SIGINT");
  const onTerm = () => handleSignal("SIGTERM");
  process.once("SIGINT", onInt);
  process.once("SIGTERM", onTerm);
  try {
    const started = await run("docker", [...dockerContextArgs, "run", "--detach", "--rm", "--name", containerName,
      "--publish", "127.0.0.1::5432", "--env", "POSTGRES_DB=reedleaves_test", "--env", "POSTGRES_USER=postgres",
      "--env", "POSTGRES_PASSWORD=postgres", "postgres:16"], {stdio: "pipe"});
    const creation = await runUnlessInterrupted(signal, async()=>{
      assertSuccess(started, "No se pudo crear PostgreSQL temporal");
      containerId = started.stdout.trim();
    });
    if (creation.interrupted) return creation.exitCode;
    if (!containerId) throw new Error("Docker no devolvió el ID del contenedor PostgreSQL.");
    let port;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (signal) return signalExitCode(signal);
      const mapping = await run("docker", [...dockerContextArgs, "port", containerId, "5432/tcp"], {stdio: "pipe"});
      if (mapping.code === 0 && mapping.stdout.trim()) {
        port = publishedPort(mapping.stdout);
        const ready = await run("docker", [...dockerContextArgs, "exec", containerId, "pg_isready", "-U", "postgres", "-d", "reedleaves_test"], {stdio: "ignore"});
        if (ready.code === 0) break;
        port = undefined;
      }
      await sleep(500);
    }
    if (signal) return signalExitCode(signal);
    if (!port) throw new Error("PostgreSQL temporal no quedó listo en 30 segundos.");
    const testEnv = testEnvironment({...env, REED_TEST_POSTGRES_URL: loopbackConnectionString(port)});
    const execution = await runUnlessInterrupted(signal, ()=>new Promise((resolve, reject) => {
      const childProcess = spawn(process.execPath, ["--import", "./test-support/offline.mjs", "--test", "--test-concurrency=2", ...TEST_FILES], {
        cwd: root, stdio: "inherit", env: testEnv
      });
      child = childProcess;
      activeChild = childProcess;
      childProcess.once("error", reject);
      childProcess.once("close", (code, receivedSignal) => {
        if (activeChild === childProcess) activeChild = null;
        child = null;
        resolve({code, signal: receivedSignal});
      });
    }));
    if (execution.interrupted) return execution.exitCode;
    const result = execution.value;
    if (signal) return signalExitCode(signal);
    return result.code ?? signalExitCode(result.signal) ?? 1;
  } finally {
    try {
      await removeTemporaryContainer({containerId, containerName: containerId || signal ? containerName : null, contextArgs: dockerContextArgs});
    } finally {
      process.removeListener("SIGINT", onInt);
      process.removeListener("SIGTERM", onTerm);
    }
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try { process.exitCode = await runLocalPostgresTests(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
