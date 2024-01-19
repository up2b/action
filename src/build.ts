import { existsSync } from 'fs';
import { join } from 'path';

import { initProject } from './init-project';
import { getRunner } from './runner';
import {
  addFeaturesSuffix,
  getInfo,
  getTargetDir,
  getTargetInfo,
  getTauriDir,
  getWorkspaceDir,
  renameFiles,
} from './utils';

import type { Artifact, BuildOptions, InitOptions } from './types';

export async function buildProject(
  root: string,
  debug: boolean,
  buildOpts: BuildOptions,
  initOpts: InitOptions,
): Promise<Artifact[]> {
  const runner = await getRunner(root, buildOpts.tauriScript);

  const tauriArgs = debug
    ? ['--debug', ...(buildOpts.args ?? [])]
    : buildOpts.args ?? [];

  const targetArgIdx = [...tauriArgs].findIndex(
    (e) => e === '-t' || e === '--target',
  );
  const targetPath =
    targetArgIdx >= 0 ? [...tauriArgs][targetArgIdx + 1] : undefined;

  const configArgIdx = [...tauriArgs].findIndex(
    (e) => e === '-c' || e === '--config',
  );
  const configArg =
    configArgIdx >= 0 ? [...tauriArgs][configArgIdx + 1] : undefined;

  const profileArgIdx = [...tauriArgs].findIndex((e) => e === '--profile');
  const profile =
    profileArgIdx >= 0 ? [...tauriArgs][profileArgIdx + 1] : undefined;

  const targetInfo = getTargetInfo(targetPath);

  if (!getTauriDir(root)) {
    await initProject(root, runner, initOpts);
  }

  const info = getInfo(root, targetInfo, configArg);

  if (!info.tauriPath) {
    throw Error("Couldn't detect path of tauri app");
  }

  const app = {
    tauriPath: info.tauriPath,
    runner,
    name: info.name,
    version: info.version,
    wixLanguage: info.wixLanguage,
    rpmRelease: info.rpmRelease,
  };

  await runner.execTauriCommand(['build'], [...tauriArgs], root);

  let fileAppName = app.name;
  // on Linux, the app product name is converted to kebab-case
  if (targetInfo.platform === 'linux') {
    fileAppName = fileAppName
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z])(?=[a-z])/g, '$1-$2')
      .replace(/[ _.]/g, '-')
      .toLowerCase();
  }

  const cratePath = getWorkspaceDir(app.tauriPath) ?? app.tauriPath;

  const artifactsPath = join(
    getTargetDir(cratePath),
    targetPath ?? '',
    profile ? profile : debug ? 'debug' : 'release',
  );

  let artifacts: Artifact[] = [];

  let arch = targetInfo.arch;

  if (targetInfo.platform === 'macos') {
    if (arch === 'x86_64') {
      arch = 'x64';
    } else if (arch === 'arm64') {
      arch = 'aarch64';
    }

    artifacts = [
      join(
        artifactsPath,
        `bundle/dmg/${fileAppName}_${app.version}_${arch}.dmg`,
      ),
      join(artifactsPath, `bundle/macos/${fileAppName}.app`),
      join(artifactsPath, `bundle/macos/${fileAppName}.app.tar.gz`),
      join(artifactsPath, `bundle/macos/${fileAppName}.app.tar.gz.sig`),
    ].map((path) => ({ path, arch }));
  } else if (targetInfo.platform === 'windows') {
    if (arch.startsWith('i')) {
      arch = 'x86';
    } else if (arch === 'aarch64') {
      arch = 'arm64';
    } else {
      arch = 'x64';
    }

    // If multiple Wix languages are specified, multiple installers (.msi) will be made
    // The .zip and .sig are only generated for the first specified language
    let langs;
    if (typeof app.wixLanguage === 'string') {
      langs = [app.wixLanguage];
    } else if (Array.isArray(app.wixLanguage)) {
      langs = app.wixLanguage;
    } else {
      langs = Object.keys(app.wixLanguage);
    }

    const winArtifacts: string[] = [];

    langs.forEach((lang) => {
      winArtifacts.push(
        join(
          artifactsPath,
          `bundle/msi/${fileAppName}_${app.version}_${arch}_${lang}.msi`,
        ),
      );
      winArtifacts.push(
        join(
          artifactsPath,
          `bundle/msi/${fileAppName}_${app.version}_${arch}_${lang}.msi.zip`,
        ),
      );
      winArtifacts.push(
        join(
          artifactsPath,
          `bundle/msi/${fileAppName}_${app.version}_${arch}_${lang}.msi.zip.sig`,
        ),
      );
    });

    winArtifacts.push(
      join(
        artifactsPath,
        `bundle/nsis/${fileAppName}_${app.version}_${arch}-setup.exe`,
      ),
    );
    winArtifacts.push(
      join(
        artifactsPath,
        `bundle/nsis/${fileAppName}_${app.version}_${arch}-setup.nsis.zip`,
      ),
    );
    winArtifacts.push(
      join(
        artifactsPath,
        `bundle/nsis/${fileAppName}_${app.version}_${arch}-setup.nsis.zip.sig`,
      ),
    );

    artifacts = winArtifacts.map((path) => ({ path, arch }));
  } else {
    const debianArch =
      arch === 'x64' || arch === 'x86_64'
        ? 'amd64'
        : arch === 'x32' || arch === 'i686'
          ? 'i386'
          : arch === 'arm'
            ? 'armhf'
            : arch === 'aarch64'
              ? 'arm64'
              : arch;
    const rpmArch =
      arch === 'x64' || arch === 'x86_64'
        ? 'x86_64'
        : arch === 'x32' || arch === 'x86' || arch === 'i686'
          ? 'i386'
          : arch === 'arm'
            ? 'armhfp'
            : arch;
    const appImageArch =
      arch === 'x64' || arch === 'x86_64'
        ? 'amd64'
        : arch === 'x32' || arch === 'i686'
          ? 'i386'
          : arch;

    artifacts = [
      {
        path: join(
          artifactsPath,
          `bundle/deb/${fileAppName}_${app.version}_${debianArch}.deb`,
        ),
        arch: debianArch,
      },
      {
        path: join(
          artifactsPath,
          `bundle/rpm/${fileAppName}-${app.version}-${app.rpmRelease}.${rpmArch}.rpm`,
        ),
        arch: rpmArch,
      },
      {
        path: join(
          artifactsPath,
          `bundle/appimage/${fileAppName}_${app.version}_${appImageArch}.AppImage`,
        ),
        arch: appImageArch,
      },
      {
        path: join(
          artifactsPath,
          `bundle/appimage/${fileAppName}_${app.version}_${appImageArch}.AppImage.tar.gz`,
        ),
        arch: appImageArch,
      },
      {
        path: join(
          artifactsPath,
          `bundle/appimage/${fileAppName}_${app.version}_${appImageArch}.AppImage.tar.gz.sig`,
        ),
        arch: appImageArch,
      },
    ];
  }

  console.log(
    `Looking for artifacts in:\n${artifacts.map((a) => a.path).join('\n')}`,
  );
  let filteredArtifacts = artifacts.filter((p) => existsSync(p.path));

  if (buildOpts.addFeaturesSuffix) {
    const featuresArgIdx = [...tauriArgs].findIndex(
      (e) => e === '-f' || e === '--features',
    );
    const featuresString =
      featuresArgIdx >= 0 ? [...tauriArgs][featuresArgIdx + 1] : undefined;
    const features = featuresString
      ? featuresString
          .split(',')
          .map((f) => f.trim())
          .filter((s) => s !== '')
      : undefined;
    const featuresSuffix = features && features.join('-');

    if (featuresSuffix) {
      const artifactsWithFeatures = await addFeaturesSuffix(
        filteredArtifacts,
        featuresSuffix,
      );
      console.log(
        `\nArtifacts with features added:\n${artifactsWithFeatures.map((a) => a.path).join('\n')}`,
      );
      filteredArtifacts = artifactsWithFeatures;
    }
  }

  if (!buildOpts.rename) {
    return filteredArtifacts;
  }

  const renamedArtifacts = await renameFiles(
    filteredArtifacts,
    buildOpts.rename,
  );

  console.log(
    `\nRenamed artifacts to:\n${renamedArtifacts.map((a) => a.path).join('\n')}`,
  );

  return renamedArtifacts;
}
