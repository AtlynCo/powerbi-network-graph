import fs from "node:fs";
import path from "node:path";

const target = path.resolve("node_modules", "powerbi-visuals-webpack-plugin", "src", "localizationLoader.js");
if (fs.existsSync(target)) {
  let content = fs.readFileSync(target, "utf8");
  if (!content.includes("const fn = new Function")) {
    const pattern = /const result = Object\.entries\(eval\((?:source|executable)\)\)\.filter\(/;
    if (pattern.test(content)) {
      content = content.replace(
        pattern,
        `const fn = new Function(
\t\tsource.replace(/^\\s*export\\s+const\\s+locales\\s*=/m, "let locales =") +
\t\t\t"\\nreturn locales;",
\t);
\tconst locales = fn();
\tconst result = Object.entries(locales).filter(`
      );
      content = content.replace(
        /const executable = source\.replace\(.*?;\r?\n/,
        ""
      );
      fs.writeFileSync(target, content, "utf8");
      console.log("Patched powerbi-visuals-webpack-plugin localizationLoader.js successfully.");
    }
  }
}

// The SDK's package path invokes shells for API and certificate checks. Keep
// those checks intact while preventing their Windows child windows.
for (const [file, replacements] of [
  ["WebPackWrap.js", [
    ["exec(`npm install --save powerbi-visuals-api@${apiVersion}`)", "exec(`npm install --save powerbi-visuals-api@${apiVersion}`, { windowsHide: true })"],
    ["exec('npm list powerbi-visuals-api version')", "exec('npm list powerbi-visuals-api version', { windowsHide: true })"]
  ]],
  ["CertificateTools.js", [
    ["nodeExec(command, options, callback ? callback : defaultCallback)", "nodeExec(command, { ...options, windowsHide: true }, callback ? callback : defaultCallback)"]
  ]]
]) {
  const filePath = path.resolve("node_modules", "powerbi-visuals-tools", "lib", file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, "utf8");
  for (const [before, after] of replacements) {
    if (!content.includes(after)) {
      if (!content.includes(before)) throw new Error(`Unknown SDK launch path in ${file}; refusing unsafe package execution`);
      content = content.replace(before, after);
    }
  }
  fs.writeFileSync(filePath, content, "utf8");
}

// Playwright's browser launcher and its failure cleanup also need hidden
// Windows children. Stop only the launched browser and its descendants.
const launcher = path.resolve("node_modules", "playwright-core", "lib", "server", "utils", "processLauncher.js");
if (fs.existsSync(launcher)) {
  let content = fs.readFileSync(launcher, "utf8");
  const beforeLaunch = "  const spawnOptions = {\n";
  const afterLaunch = "  const spawnOptions = {\n    windowsHide: true,\n";
  const beforeKill = "const taskkillProcess = childProcess.spawnSync(`taskkill /pid ${spawnedProcess.pid} /T /F`, { shell: true });";
  const afterKill = `const taskkillProcess = childProcess.spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
            "$ErrorActionPreference='Stop'; $p=@(Get-CimInstance Win32_Process); $ids=@(" + spawnedProcess.pid +
            "); for ($i=0; $i -lt $ids.Count; $i++) { $parent=$ids[$i]; $ids += @($p | Where-Object { $_.ParentProcessId -eq $parent } | ForEach-Object { [int]$_.ProcessId }) }; [array]::Reverse($ids); foreach ($id in $ids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }"], { windowsHide: true });`;
  for (const [before, after] of [[beforeLaunch, afterLaunch], [beforeKill, afterKill]]) {
    if (!content.includes(after)) {
      if (!content.includes(before)) throw new Error("Unknown Playwright launch path; refusing unsafe browser execution");
      content = content.replace(before, after);
    }
  }
  fs.writeFileSync(launcher, content, "utf8");
}
