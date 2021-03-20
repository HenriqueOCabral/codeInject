import http from "http";
import { exec, spawn } from "child_process";

const port = process.env.PORT || 3000;

async function runCommandWithSpawn(command) {
  const [cmd, ...args] = command.split(/\s/);
  const { stdout, stderr } = spawn(cmd, args || [], { cwd: "./documents" });

  for await (const result of stdout) {
    return result.toString().split("\n");
  }
}

async function runCommandWithDocker(command) {
  const nodeScript = `    
    async function runIt () {
    const { spawn } = require('child_process')
    const { stdout, stderr } = spawn("${command}", { cwd: "./documents", shell:true})

    for await(const result of stdout) {
        return result.toString()
      }
    }
    runIt().then(console.log).catch(console.error)
`;
  const dockerCommand = `docker run --rm \
        -v "$PWD"/documents:/documents \
        node: 14-alpine -e '${nodeScript}'
`;

  const { stdout, stderr } = spawn(dockerCommand, { shell: true });

  for await (const result of stdout) {
    return result
      .toString()
      .split("\n")
      .filter((i) => !!i);
  }
}

async function runCommandWithExec(command) {
  const promise = new Promise((resolve, reject) => {
    exec(command, (err, res) => (err ? reject(err) : resolve(res)));
  });

  const response = await promise.split("\n").filter((i) => !!i);
  return response;
}

http
  .createServer(async (req, res) => {
    const path = req.url.replace(/\W/, "");

    const routes = {
      exec: runCommandWithExec,
      spawn: runCommandWithSpawn,
      docker: runCommandWithDocker,
    };
    for await (const data of req) {
      const { command } = JSON.parse(data);
      const response = await routes[path](command);
      res.write(JSON.stringify(response || "Empty"));
      res.end();
    }
  })
  .listen(port, () => console.log("Server Running on:", port));
