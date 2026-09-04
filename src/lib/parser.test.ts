import { describe, expect, it } from "vitest";
import { parseManifest } from "@/lib/parser";

describe("parseManifest", () => {
  it("parses package.json dependencies and devDependencies", async () => {
    const result = await parseManifest(
      JSON.stringify({
        name: "demo",
        dependencies: {
          lodash: "^4.17.15",
          axios: "~0.21.1"
        },
        devDependencies: {
          typescript: "^5.7.2"
        }
      }),
      "auto",
      true
    );

    expect(result.ecosystem).toBe("npm");
    expect(result.projectName).toBe("demo");
    expect(result.packages.map((pkg) => pkg.name)).toEqual(["axios", "lodash", "typescript"]);
    expect(result.packages.find((pkg) => pkg.name === "lodash")?.version).toBe("4.17.15");
  });

  it("excludes devDependencies when requested", async () => {
    const result = await parseManifest(
      JSON.stringify({
        dependencies: {
          react: "^18.3.1"
        },
        devDependencies: {
          eslint: "^8.57.1"
        }
      }),
      "npm",
      false
    );

    expect(result.packages.map((pkg) => pkg.name)).toEqual(["react"]);
  });

  it("skips package.json dependencies with non-string versions", async () => {
    const result = await parseManifest(
      JSON.stringify({
        dependencies: {
          react: "^18.3.1",
          broken: { version: "1.0.0" }
        }
      }),
      "npm",
      true
    );

    expect(result.packages.map((pkg) => pkg.name)).toEqual(["react"]);
    expect(result.warnings).toEqual([
      { message: 'Skipped npm package "broken" because its version specifier is not a string.' }
    ]);
  });

  it("normalizes npm aliases and does not treat workspace specs as concrete versions", async () => {
    const result = await parseManifest(
      JSON.stringify({
        dependencies: {
          lodashAlias: "npm:lodash@4.17.15",
          localPackage: "workspace:*"
        }
      }),
      "npm",
      true
    );

    expect(result.packages.map((pkg) => `${pkg.name}:${pkg.version ?? "none"}`)).toEqual([
      "localPackage:none",
      "lodash:4.17.15"
    ]);
    expect(result.warnings).toEqual([
      { message: 'Package "localPackage" uses unsupported npm specifier "workspace:*"; querying without a concrete version.' }
    ]);
  });

  it("parses requirements.txt version operators", async () => {
    const result = await parseManifest(
      ["django==4.2.1", "requests>=2.31.0", "flask~=3.0.0", "numpy # comment"].join("\n"),
      "pip",
      true
    );

    expect(result.ecosystem).toBe("pip");
    expect(result.packages.map((pkg) => `${pkg.name}:${pkg.version ?? "none"}`)).toEqual([
      "django:4.2.1",
      "flask:3.0.0",
      "numpy:none",
      "requests:2.31.0"
    ]);
  });

  it("warns on requirements.txt lines with malformed trailing content", async () => {
    const result = await parseManifest(["requests>=2.31.0", "django invalid trailing text"].join("\n"), "pip", true);

    expect(result.packages.map((pkg) => pkg.name)).toEqual(["requests"]);
    expect(result.warnings).toEqual([
      { line: 2, message: "Could not parse requirements.txt line 2." }
    ]);
  });
});
