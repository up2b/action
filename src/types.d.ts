import { Runner } from './runner';

export interface Application {
  tauriPath: string;
  runner: Runner;
  name: string;
  version: string;
  wixLanguage: string | string[] | { [language: string]: unknown };
}

export interface Artifact {
  path: string;
  arch: string;
}

export interface Rename {
  searchValue: string;
  replaceValue: string;
}

export interface BuildOptions {
  tauriScript: string | null;
  rename: Rename | null;
  addFeaturesSuffix: boolean;
  args: string[] | null;
}

export interface InitOptions {
  distPath: string | null;
  iconPath: string | null;
  bundleIdentifier: string | null;
  appVersion: string | null;
  appName: string | null;
}

export interface CargoManifestBin {
  name: string;
}

export interface CargoManifest {
  workspace?: { package?: { version?: string; name?: string } };
  package: { version: string; name: string; 'default-run': string };
  bin: CargoManifestBin[];
}

export interface Info {
  tauriPath: string | null;
  name: string;
  version: string;
  wixLanguage: string | string[] | { [language: string]: unknown };
  rpmRelease: string;
}

export type TargetPlatform = 'android' | 'ios' | 'macos' | 'linux' | 'windows';
export interface TargetInfo {
  arch: string;
  platform: TargetPlatform;
}

export interface TauriConfig {
  package?: {
    productName?: string;
    version?: string;
  };
  build?: {
    distDir?: string;
    beforeBuildCommand?: string;
  };
  tauri?: {
    bundle?: {
      identifier: string;
      rpm?: {
        release?: string;
      };
      windows?: {
        wix?: {
          language?: string | string[] | { [language: string]: unknown };
        };
      };
    };
  };
}

export interface CargoConfig {
  build?: {
    target?: string;
    'target-dir'?: string;
  };
}
